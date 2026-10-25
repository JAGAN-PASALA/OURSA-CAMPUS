import base64
from collections import defaultdict, deque
import hashlib
import json
import shutil
import threading
import time
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

import cv2
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import GroupShuffleSplit

import database as db
from config import get_settings

ROOT = Path(__file__).resolve().parent
settings = get_settings()
MODELS = ROOT / "models"
BEHAVIOUR_MODEL = MODELS / "behaviour_classifier.joblib"
CANDIDATE_MODELS = MODELS / "candidates"
FACE_DETECTOR = MODELS / "face_detection_yunet_2023mar.onnx"
FACE_RECOGNIZER = MODELS / "face_recognition_sface_2021dec.onnx"
MODEL_URLS = {
    FACE_DETECTOR: "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    FACE_RECOGNIZER: "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
}


class VisionService:
    def __init__(self):
        self.pose_model = None
        self.object_model = None
        self.face_detector = None
        self.face_recognizer = None
        self.behaviour_model = joblib.load(BEHAVIOUR_MODEL) if BEHAVIOUR_MODEL.exists() else None
        self.lock = threading.Lock()
        self.incident_cooldown: dict[str, float] = {}
        self.prediction_history: dict[str, deque[np.ndarray]] = defaultdict(lambda: deque(maxlen=settings.behaviour_smoothing_frames))
        self.alert_started: dict[str, float] = {}
        self.alert_emitted: set[str] = set()
        self.behaviour_episodes: dict[str, dict] = {}
        self.biometric_touch: dict[str, float] = {}
        self.person_tracks: dict[str, list[dict]] = defaultdict(list)
        self.next_track_id: dict[str, int] = defaultdict(int)
        # Keep a short-lived identity attached to a stable person track. This
        # prevents a downward-facing student who is still physically visible
        # from becoming absent just because one face frame was missed.
        self.track_identities: dict[str, dict] = {}

    def _download_face_models(self):
        MODELS.mkdir(parents=True, exist_ok=True)
        for path, url in MODEL_URLS.items():
            if not path.exists():
                if not settings.allow_model_downloads:
                    raise RuntimeError(f"Required model asset is missing: {path.name}. Install verified model files before startup.")
                urllib.request.urlretrieve(url, path)

    def _load_faces(self):
        if self.face_detector is None:
            self._download_face_models()
            self.face_detector = cv2.FaceDetectorYN.create(str(FACE_DETECTOR), "", (320, 320), .84, .3, 5000)
            self.face_recognizer = cv2.FaceRecognizerSF.create(str(FACE_RECOGNIZER), "")

    def _load_yolo(self):
        if self.pose_model is None:
            from ultralytics import YOLO
            pose_path = MODELS / "yolo11n-pose.pt"
            object_path = MODELS / "yolo11n.pt"
            if not settings.allow_model_downloads and (not pose_path.exists() or not object_path.exists()):
                raise RuntimeError("Required YOLO model assets are missing. Install verified yolo11n-pose.pt and yolo11n.pt files before startup.")
            self.pose_model = YOLO(str(pose_path) if pose_path.exists() else "yolo11n-pose.pt")
            self.object_model = YOLO(str(object_path) if object_path.exists() else "yolo11n.pt")

    def detect_faces(self, frame: np.ndarray, institution_id: int):
        self._load_faces()
        height, width = frame.shape[:2]
        self.face_detector.setInputSize((width, height))
        _, faces = self.face_detector.detect(frame)
        found = []
        if faces is None:
            return found
        enrolled = db.load_embeddings(institution_id)
        for face in faces:
            aligned = self.face_recognizer.alignCrop(frame, face)
            feature = self.face_recognizer.feature(aligned).flatten().astype(np.float32)
            feature = feature / (np.linalg.norm(feature) or 1)
            best = {"name": "Unknown", "entity_type": None, "student_id": None, "user_id": None, "role": None, "designation": None, "confidence": 0.0, "match_threshold": settings.face_match_threshold}
            for known in enrolled:
                known_feature = np.array(known["embedding"], dtype=np.float32).reshape(1, -1)
                score = float(self.face_recognizer.match(feature.reshape(1, -1), known_feature, cv2.FaceRecognizerSF_FR_COSINE))
                if score > best["confidence"]:
                    best = {key: known.get(key) for key in ("name", "entity_type", "student_id", "user_id", "role", "designation")} | {"confidence": score, "match_threshold": settings.face_match_threshold}
            if best["confidence"] < best["match_threshold"]:
                best = {"name": "Unknown", "entity_type": None, "student_id": None, "user_id": None, "role": None, "designation": None, "confidence": best["confidence"]}
            else:
                entity_id = best.get("student_id") or best.get("user_id")
                touch_key = f"{best.get('entity_type')}:{entity_id}"
                now_mono = time.monotonic()
                if entity_id and now_mono - self.biometric_touch.get(touch_key, 0) >= 3600:
                    db.touch_biometric(best["entity_type"], entity_id)
                    self.biometric_touch[touch_key] = now_mono
            x, y, w, h = [int(v) for v in face[:4]]
            found.append({**best, "box": [x, y, w, h], "feature": feature.tolist()})
        return found

    @staticmethod
    def _validate_registration_quality(frame: np.ndarray, visible: dict) -> None:
        x, y, w, h = visible["box"]
        if min(w, h) < settings.face_min_size_pixels:
            raise ValueError("Move closer to the camera so the face is at least 80 pixels wide and tall.")
        crop = frame[max(0, y):max(0, y) + h, max(0, x):max(0, x) + w]
        if crop.size == 0:
            raise ValueError("The face crop is invalid. Centre your face and try again.")
        grey = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(grey))
        blur = float(cv2.Laplacian(grey, cv2.CV_64F).var())
        if brightness < settings.face_min_brightness:
            raise ValueError("The face is too dark. Use brighter, even lighting and try again.")
        if brightness > settings.face_max_brightness:
            raise ValueError("The face is overexposed. Reduce direct light and try again.")
        if blur < settings.face_min_blur_variance:
            raise ValueError("The face image is blurred. Hold still, clean the lens and try again.")

    def register_face(self, frame: np.ndarray, student_id: int, institution_id: int):
        faces = self.detect_faces(frame, institution_id)
        if len(faces) != 1:
            raise ValueError("Show exactly one clear face to the camera.")
        visible = faces[0]
        self._validate_registration_quality(frame, visible)
        if visible.get("user_id") or (visible.get("student_id") and visible["student_id"] != student_id):
            raise ValueError(f"The camera recognises {visible['name']}, but a different student is selected.")
        duplicate = self._duplicate_identity(visible["feature"], institution_id, "student", student_id)
        if duplicate:
            raise ValueError(f"This face is already registered to {duplicate['name']} ({duplicate['designation']}).")
        samples = db.save_embedding(student_id, visible["feature"])
        remaining = max(0, settings.face_enrollment_samples - samples)
        message = "Face profile is ready" if not remaining else f"Face sample saved. Capture {remaining} more varied sample(s)."
        return {"student_id": student_id, "samples": samples, "ready": remaining == 0, "message": message}

    def register_staff_face(self, frame: np.ndarray, user_id: int, institution_id: int):
        faces = self.detect_faces(frame, institution_id)
        if len(faces) != 1:
            raise ValueError("Show exactly one clear face to the camera.")
        visible = faces[0]
        self._validate_registration_quality(frame, visible)
        if visible.get("student_id") or (visible.get("user_id") and visible["user_id"] != user_id):
            raise ValueError(f"The camera recognises {visible['name']}, but a different staff member is selected.")
        duplicate = self._duplicate_identity(visible["feature"], institution_id, "staff", user_id)
        if duplicate:
            raise ValueError(f"This face is already registered to {duplicate['name']} ({duplicate['designation']}).")
        samples = db.save_staff_embedding(user_id, visible["feature"])
        remaining = max(0, settings.face_enrollment_samples - samples)
        message = "Staff face profile is ready" if not remaining else f"Staff face sample saved. Capture {remaining} more varied sample(s)."
        return {"user_id": user_id, "samples": samples, "ready": remaining == 0, "message": message}

    @staticmethod
    def _duplicate_identity(feature: list[float], institution_id: int, entity_type: str, entity_id: int) -> dict | None:
        candidate = np.array(feature, dtype=np.float32)
        for known in db.load_embeddings(institution_id, include_incomplete=True):
            same = known.get("student_id") == entity_id if entity_type == "student" else known.get("user_id") == entity_id
            if same:
                continue
            score = float(np.dot(candidate, np.array(known["embedding"], dtype=np.float32)))
            if score >= settings.face_duplicate_threshold:
                return known
        return None

    def track_behaviour_episode(self, institution_id: int, classroom_id: str, class_session_id: int | None, student_id: int | None, behaviour: str, confidence: float) -> None:
        if not class_session_id or not student_id or behaviour in {"uncertain", "unclassified"}:
            return
        now_mono = time.monotonic()
        now = datetime.now(timezone.utc)
        prefix = f"{institution_id}:{class_session_id}:{student_id}:"
        key = f"{prefix}{behaviour}"
        for existing in [item for item in self.behaviour_episodes if item.startswith(prefix) and item != key]:
            self.behaviour_episodes.pop(existing, None)
        state = self.behaviour_episodes.setdefault(key, {"started_mono": now_mono, "started_at": now, "confidence_total": 0.0, "samples": 0})
        state["confidence_total"] += confidence
        state["samples"] += 1
        duration = now_mono - state["started_mono"]
        if duration >= settings.behaviour_episode_threshold_seconds:
            average = state["confidence_total"] / max(1, state["samples"])
            state["episode_id"] = db.save_behaviour_episode(institution_id, class_session_id, student_id, behaviour, state["started_at"], now, average, state.get("episode_id"))

    @staticmethod
    def pose_features(keypoints: np.ndarray):
        points = keypoints.astype(float)
        visible = points[:, 2] > .2
        if visible.sum() < 6:
            return None
        centre = points[visible, :2].mean(axis=0)
        scale = np.linalg.norm(points[5, :2] - points[6, :2])
        if scale < 5:
            scale = max(np.ptp(points[visible, 0]), np.ptp(points[visible, 1]), 1)
        normalised = (points[:, :2] - centre) / scale
        return np.concatenate([normalised.flatten(), points[:, 2]]).tolist()

    @staticmethod
    def raised_hand(keypoints: np.ndarray) -> bool:
        for shoulder_index, wrist_index in ((5, 9), (6, 10)):
            shoulder, wrist = keypoints[shoulder_index], keypoints[wrist_index]
            if shoulder[2] > .25 and wrist[2] > .25 and wrist[1] < shoulder[1]:
                return True
        return False

    @staticmethod
    def _face_is_on_phone(face_box: list[int], phone_box: list[int]) -> bool:
        fx, fy, fw, fh = face_box
        px1, py1, px2, py2, _confidence = phone_box
        centre_x, centre_y = fx + fw / 2, fy + fh / 2
        face_area = max(1, fw * fh)
        phone_area = max(1, (px2 - px1) * (py2 - py1))
        return px1 <= centre_x <= px2 and py1 <= centre_y <= py2 and phone_area >= face_area * 1.15

    @classmethod
    def face_for_person(
        cls,
        faces: list[dict],
        box: list[int],
        phone_boxes: list[list[int]] | None = None,
    ) -> tuple[dict | None, bool]:
        """Return the physical face, rejecting a face detected on a phone.

        The rejection is intentionally conservative: if a real face is also
        visible, it wins; only a face whose centre is inside a detected phone
        screen is rejected. The holder is not assigned the phone owner's
        identity for attendance.
        """
        x, y, w, h = box
        candidates = []
        for face in faces:
            fx, fy, fw, fh = face["box"]
            centre_x, centre_y = fx + fw / 2, fy + fh / 2
            if x <= centre_x <= x + w and y <= centre_y <= y + h:
                candidates.append((abs(centre_x - (x + w / 2)), face))
        if not candidates:
            return None, False
        phone_boxes = phone_boxes or []
        physical = [
            item for item in candidates
            if not any(cls._face_is_on_phone(item[1]["box"], phone_box) for phone_box in phone_boxes)
        ]
        if physical:
            # Prefer the larger/clearer physical face, then proximity to the
            # person's upper body. This avoids selecting a small phone face.
            return max(physical, key=lambda item: (item[1]["box"][2] * item[1]["box"][3], -item[0]))[1], False
        return None, True

    def _remember_track_identity(self, track_id: str, face: dict) -> None:
        identity = face.get("student_id") or face.get("user_id")
        if not identity:
            return
        self.track_identities[track_id] = {
            "student_id": face.get("student_id"),
            "user_id": face.get("user_id"),
            "entity_type": face.get("entity_type"),
            "role": face.get("role"),
            "designation": face.get("designation"),
            "name": face.get("name") or "Unknown",
            "confidence": float(face.get("confidence") or 0),
            "last_seen": time.monotonic(),
        }

    def _cached_track_identity(self, track_id: str) -> dict | None:
        cached = self.track_identities.get(track_id)
        if not cached:
            return None
        now_mono = time.monotonic()
        age = now_mono - float(cached.get("last_seen", 0))
        if age > max(1, settings.attendance_identity_grace_seconds):
            self.track_identities.pop(track_id, None)
            return None
        # A continuously tracked body may keep its face pointed down while
        # writing. Refresh the grace window on every stable body track so a
        # temporary face miss does not turn into a false absence.
        cached["last_seen"] = now_mono
        return {
            "name": cached["name"],
            "entity_type": cached["entity_type"],
            "student_id": cached.get("student_id"),
            "user_id": cached.get("user_id"),
            "role": cached.get("role"),
            "designation": cached.get("designation"),
            "confidence": max(0.0, float(cached.get("confidence") or 0) * 0.95),
        }

    @staticmethod
    def _box_iou(first: list[int], second: list[int]) -> float:
        ax, ay, aw, ah = first
        bx, by, bw, bh = second
        left, top = max(ax, bx), max(ay, by)
        right, bottom = min(ax + aw, bx + bw), min(ay + ah, by + bh)
        intersection = max(0, right - left) * max(0, bottom - top)
        union = max(1, aw * ah + bw * bh - intersection)
        return intersection / union

    def assign_track_ids(self, institution_id: int, classroom_id: str, boxes: list[list[int]]) -> list[str]:
        """Maintain stable short-lived IDs instead of using detection order."""
        key = f"{institution_id}:{classroom_id}"
        now = time.monotonic()
        tracks = [row for row in self.person_tracks[key] if now - row["last_seen"] <= settings.behaviour_track_timeout_seconds]
        used: set[int] = set()
        assigned: list[str] = []
        for box in boxes:
            candidates = [
                (self._box_iou(box, track["box"]), index, track)
                for index, track in enumerate(tracks)
                if index not in used
            ]
            score, index, track = max(candidates, default=(0.0, -1, None), key=lambda row: row[0])
            if track is None or score < 0.25:
                self.next_track_id[key] += 1
                track = {"id": f"{key}:{self.next_track_id[key]}", "box": box, "last_seen": now}
                tracks.append(track)
                index = len(tracks) - 1
            else:
                track["box"] = box
                track["last_seen"] = now
            used.add(index)
            assigned.append(track["id"])
        self.person_tracks[key] = tracks
        return assigned

    @staticmethod
    def associate_phones(person_boxes: list[list[int]], phone_boxes: list[list[int]]) -> dict[int, float]:
        """Attach each phone to one containing/overlapping person, never everyone."""
        associations: dict[int, float] = {}
        for px1, py1, px2, py2, confidence in phone_boxes:
            centre_x, centre_y = (px1 + px2) / 2, (py1 + py2) / 2
            candidates: list[tuple[float, int]] = []
            for index, (x, y, w, h) in enumerate(person_boxes):
                if x <= centre_x <= x + w and y <= centre_y <= y + h:
                    relative_y = (centre_y - y) / max(h, 1)
                    # Prefer a phone around the upper body/hands over one near a
                    # neighbouring person's feet.
                    score = 1.0 - min(abs(relative_y - 0.5), 0.5)
                    candidates.append((score, index))
            if candidates:
                _, person_index = max(candidates)
                associations[person_index] = max(associations.get(person_index, 0.0), confidence)
        return associations

    @staticmethod
    def phone_boxes_for_people(person_boxes: list[list[int]], phone_boxes: list[list[int]]) -> dict[int, list[list[int]]]:
        grouped: dict[int, list[list[int]]] = defaultdict(list)
        for phone_box in phone_boxes:
            px1, py1, px2, py2, _confidence = phone_box
            centre_x, centre_y = (px1 + px2) / 2, (py1 + py2) / 2
            candidates: list[tuple[float, int]] = []
            for index, (x, y, w, h) in enumerate(person_boxes):
                if x <= centre_x <= x + w and y <= centre_y <= y + h:
                    relative_y = (centre_y - y) / max(h, 1)
                    candidates.append((1.0 - min(abs(relative_y - 0.5), 0.5), index))
            if candidates:
                _, person_index = max(candidates)
                grouped[person_index].append(phone_box)
        return grouped

    def sustained_alert(self, key: str, active: bool, required_seconds: int) -> tuple[bool, float]:
        now = time.monotonic()
        if not active:
            self.alert_started.pop(key, None)
            self.alert_emitted.discard(key)
            return False, 0
        started = self.alert_started.setdefault(key, now)
        duration = now - started
        if duration >= required_seconds and key not in self.alert_emitted:
            self.alert_emitted.add(key)
            return True, duration
        return False, duration

    def analyse(self, frame: np.ndarray, classroom_id: str, sample_label: str, sample_track_id: str | None, institution_id: int, actor_user_id: int | None = None, class_session_id: int | None = None, gesture_teacher_id: int | None = None):
        with self.lock:
            self._load_yolo()
            faces = self.detect_faces(frame, institution_id)
            pose_results = self.pose_model.predict(frame, verbose=False, conf=.35, imgsz=640)[0]
            object_results = self.object_model.predict(frame, verbose=False, conf=.35, imgsz=640, classes=[67])[0]
            phones = len(object_results.boxes) if object_results.boxes is not None else 0
            people = []
            if pose_results.keypoints is not None and pose_results.boxes is not None:
                points = pose_results.keypoints.data.cpu().numpy()
                boxes = pose_results.boxes.xyxy.cpu().numpy()
                person_boxes = [[int(x1), int(y1), int(x2 - x1), int(y2 - y1)] for x1, y1, x2, y2 in boxes]
                track_ids = self.assign_track_ids(institution_id, classroom_id, person_boxes)
                phone_boxes = []
                if object_results.boxes is not None:
                    phone_xyxy = object_results.boxes.xyxy.cpu().numpy()
                    phone_confidences = object_results.boxes.conf.cpu().numpy()
                    phone_boxes = [[int(x1), int(y1), int(x2), int(y2), float(confidence)] for (x1, y1, x2, y2), confidence in zip(phone_xyxy, phone_confidences)]
                phone_associations = self.associate_phones(person_boxes, phone_boxes)
                phone_boxes_by_person = self.phone_boxes_for_people(person_boxes, phone_boxes)
                for index, person_points in enumerate(points):
                    features = self.pose_features(person_points)
                    behaviour, confidence = "unclassified", 0.0
                    if features is not None and self.behaviour_model is not None:
                        probabilities = self.behaviour_model.predict_proba([features])[0]
                        history = self.prediction_history[track_ids[index]]
                        history.append(probabilities)
                        smoothed = np.mean(np.stack(history), axis=0)
                        choice = int(np.argmax(smoothed))
                        confidence = float(smoothed[choice])
                        predicted = str(self.behaviour_model.classes_[choice])
                        threshold = settings.behaviour_class_thresholds.get(predicted, settings.behaviour_confidence_threshold)
                        enough_frames = len(history) >= min(3, settings.behaviour_smoothing_frames)
                        behaviour = predicted if enough_frames and confidence >= threshold else "uncertain"
                    x1, y1, x2, y2 = [int(v) for v in boxes[index]]
                    person_box = [x1, y1, x2 - x1, y2 - y1]
                    face, phone_face_rejected = self.face_for_person(faces, person_box, phone_boxes_by_person.get(index, []))
                    raised = self.raised_hand(person_points)
                    recognised = bool(face and (face.get("student_id") or face.get("user_id")))
                    phone_confidence = phone_associations.get(index)
                    if phone_confidence is not None:
                        behaviour = "mobile phone usage"
                        confidence = phone_confidence
                    identity_source = "face" if recognised else None
                    if phone_face_rejected:
                        # A face detected on a phone is evidence of a possible
                        # spoof, not evidence that the phone holder is present.
                        for candidate in faces:
                            if any(self._face_is_on_phone(candidate["box"], phone_box) for phone_box in phone_boxes_by_person.get(index, [])):
                                candidate["spoof_rejected"] = True
                                candidate["name"] = "Spoof rejected"
                                candidate["student_id"] = None
                                candidate["user_id"] = None
                                candidate["entity_type"] = None
                                candidate["role"] = None
                                candidate["designation"] = None
                        face = None
                        recognised = False
                    elif recognised:
                        self._remember_track_identity(track_ids[index], face)
                    else:
                        cached = self._cached_track_identity(track_ids[index])
                        if cached:
                            face = cached
                            recognised = True
                            identity_source = "temporal_track"
                    person = {"track_id": track_ids[index], "behaviour": behaviour, "confidence": confidence, "phone_detected": phone_confidence is not None, "spoof_rejected": phone_face_rejected, "face_visible": identity_source == "face", "identity_source": identity_source, "box": person_box, "entity_type": face.get("entity_type") if face else None, "student_id": face.get("student_id") if face else None, "user_id": face.get("user_id") if face else None, "role": face.get("role") if face else None, "designation": face.get("designation") if face else None, "student_name": face["name"] if recognised else "Unknown", "raised_hand": raised, "features": features}
                    people.append(person)
                    if person["student_id"] and features is not None:
                        db.record_behaviour_observation(institution_id, class_session_id, person["student_id"], behaviour, confidence)
                        self.track_behaviour_episode(institution_id, classroom_id, class_session_id, person["student_id"], behaviour, confidence)
            sample_saved = False
            if sample_label != "none":
                selected = next((person for person in people if person["track_id"] == sample_track_id), None)
                if not selected:
                    raise ValueError("Select the tracked person whose behaviour you are labelling.")
                identity_id = selected.get("student_id") or selected.get("user_id")
                if not identity_id:
                    raise ValueError("Training samples require a recognised, consented volunteer.")
                subject_key = f"{selected.get('entity_type')}:{identity_id}"
                session_key = f"class:{class_session_id}" if class_session_id else f"manual:{datetime.now(timezone.utc).date().isoformat()}:{actor_user_id}"
                db.save_behaviour_sample(
                    sample_label,
                    selected.pop("features"),
                    actor_user_id,
                    dataset_version=settings.behaviour_dataset_version,
                    subject_key=subject_key,
                    session_key=session_key,
                    camera_key=classroom_id,
                    track_id=selected["track_id"],
                    consent_verified=True,
                )
                sample_saved = True
            for person in people:
                person.pop("features", None)
            marked = []
            for person in people:
                # Attendance is granted only to a physical person track. A
                # face found on a phone is deliberately excluded.
                if person.get("spoof_rejected"):
                    continue
                if person.get("student_id"):
                    attendance = db.mark_attendance(person["student_id"], person["confidence"], class_session_id)
                    if attendance["newly_present"]:
                        marked.append(person["student_name"])
                elif person.get("user_id"):
                    db.mark_staff_presence(institution_id, person["user_id"], person["confidence"], class_session_id)
            normalized_incidents = [(p["behaviour"], p["confidence"], p["student_id"]) for p in people if p["behaviour"] not in ("attentive", "uncertain", "unclassified", "fighting")]
            # During breaks/unlinked CCTV operation, retain only sustained safety
            # events below; do not add phones, sleeping or talking to academics.
            for behaviour, confidence, incident_student in (normalized_incidents if class_session_id else []):
                key = f"{classroom_id}:{incident_student}:{behaviour}"
                if time.time() - self.incident_cooldown.get(key, 0) > 20:
                    db.create_incident(institution_id, incident_student, classroom_id, behaviour, confidence, class_session_id)
                    self.incident_cooldown[key] = time.time()
            policy = db.monitoring_policy(institution_id)
            alerts = []
            fighting_people = [person for person in people if person["behaviour"] == "fighting"]
            fight_key = f"{institution_id}:{class_session_id or classroom_id}:fighting"
            fight_triggered, fight_duration = self.sustained_alert(fight_key, bool(fighting_people), policy["fight_alert_seconds"])
            if fight_triggered:
                incident_student = next((person["student_id"] for person in fighting_people if person["student_id"]), None)
                incident_id = db.create_incident(institution_id, incident_student, classroom_id, "sustained fighting", max((person["confidence"] for person in fighting_people), default=0), class_session_id, fight_duration, True)
                alerts.append({"id": incident_id, "type": "fighting", "message": f"Fighting detected continuously for {round(fight_duration)} seconds"})
            crowd_key = f"{institution_id}:{class_session_id or classroom_id}:crowd"
            crowd_triggered, crowd_duration = self.sustained_alert(crowd_key, len(people) >= policy["crowd_threshold"], policy["crowd_alert_seconds"])
            if crowd_triggered:
                incident_id = db.create_incident(institution_id, None, classroom_id, "crowd threshold exceeded", 1.0, class_session_id, crowd_duration, True)
                alerts.append({"id": incident_id, "type": "crowd", "message": f"Crowd alert: {len(people)} people detected"})
            raised_people = [person for person in people if person["raised_hand"]]
            teacher_confirmed = bool(gesture_teacher_id) and any(person.get("user_id") == gesture_teacher_id for person in raised_people)
            exit_candidates = []
            if teacher_confirmed:
                for person in raised_people:
                    if not person.get("student_id"):
                        continue
                    auto_approved = False
                    if class_session_id and gesture_teacher_id and db.student_in_class_session(class_session_id, person["student_id"]):
                        request = db.create_raised_hand_request(institution_id, class_session_id, person["student_id"], gesture_teacher_id, f"camera:{classroom_id}:{round(time.time())}")
                        auto_approved = False
                    else:
                        request = {"created": False}
                    exit_candidates.append({"student_id": person["student_id"], "student_name": person["student_name"], "auto_approved": auto_approved, "request_id": request.get("request_id"), "status": request.get("status")})
            annotated = frame.copy()
            for face in faces:
                x, y, w, h = face["box"]
                colour = (52, 179, 128) if face.get("student_id") else (121, 79, 191) if face.get("user_id") else (60, 150, 230)
                cv2.rectangle(annotated, (x, y), (x + w, y + h), colour, 2)
                cv2.putText(annotated, f'{face["name"]} {face["confidence"]:.2f}', (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, .55, colour, 2)
            for person in people:
                x, y, w, h = person["box"]
                cv2.putText(annotated, f'{person["behaviour"]} {person["confidence"]:.2f}', (x, y + h - 8), cv2.FONT_HERSHEY_SIMPLEX, .55, (183, 91, 80), 2)
            if phones:
                cv2.putText(annotated, f"PHONE DETECTED: {phones}", (18, 30), cv2.FONT_HERSHEY_SIMPLEX, .75, (55, 55, 230), 2)
            ok, encoded = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 78])
            public_faces = [{k: v for k, v in face.items() if k not in {"feature", "match_threshold"}} for face in faces]
            return {"faces": public_faces, "people": people, "phones": phones, "sample_saved": sample_saved, "attendance_marked": marked, "exit_permission_candidates": exit_candidates, "alerts": alerts, "behaviour_model_status": "ready" if self.behaviour_model is not None else "safe_mode", "behaviour_model_message": "Validated behaviour classification is active" if self.behaviour_model is not None else "Face attendance and crowd safety monitoring are active. Classroom behaviour and fighting labels stay hidden until a candidate passes grouped validation and approval.", "annotated_image": base64.b64encode(encoded).decode() if ok else None}

    def train_behaviour_model(self, actor_user_id: int | None = None):
        rows = db.list_behaviour_samples(settings.behaviour_dataset_version)
        labels = [row["label"] for row in rows]
        classes = sorted(set(labels))
        counts = {label: labels.count(label) for label in classes}
        group_keys = [f'{row["subject_key"]}|{row["session_key"]}|{row["camera_key"]}' for row in rows]
        groups_by_class = {label: len({group for group, row_label in zip(group_keys, labels) if row_label == label}) for label in classes}
        if len(classes) < 2:
            raise ValueError("The approved dataset needs at least two behaviour classes.")
        if min(counts.values(), default=0) < settings.behaviour_min_samples_per_class:
            raise ValueError(f"Each behaviour needs at least {settings.behaviour_min_samples_per_class} reviewed samples before candidate training.")
        if min(groups_by_class.values(), default=0) < settings.behaviour_min_groups_per_class:
            raise ValueError(f"Each behaviour needs at least {settings.behaviour_min_groups_per_class} independent person/session/camera groups.")
        features = np.array([row["features"] for row in rows], dtype=float)
        split = None
        for seed in range(42, 82):
            train_indexes, test_indexes = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=seed).split(features, labels, group_keys))
            if set(np.array(labels)[train_indexes]) == set(classes) and set(np.array(labels)[test_indexes]) == set(classes):
                split = train_indexes, test_indexes
                break
        if split is None:
            raise ValueError("The grouped dataset cannot create a holdout containing every class. Add independent people, sessions and cameras.")
        train_indexes, test_indexes = split
        x_train, x_test = features[train_indexes], features[test_indexes]
        label_array = np.array(labels)
        y_train, y_test = label_array[train_indexes], label_array[test_indexes]
        model = RandomForestClassifier(n_estimators=220, max_depth=14, class_weight="balanced", random_state=42)
        model.fit(x_train, y_train)
        predictions = model.predict(x_test)
        accuracy = float(accuracy_score(y_test, predictions))
        report = classification_report(y_test, predictions, labels=classes, output_dict=True, zero_division=0)
        matrix = confusion_matrix(y_test, predictions, labels=classes).tolist()
        macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(y_test, predictions, average="macro", zero_division=0)
        metrics = {
            "classes": classes,
            "sample_counts": counts,
            "independent_groups_by_class": groups_by_class,
            "train_groups": len(set(np.array(group_keys)[train_indexes])),
            "holdout_groups": len(set(np.array(group_keys)[test_indexes])),
            "accuracy": accuracy,
            "macro_precision": float(macro_precision),
            "macro_recall": float(macro_recall),
            "macro_f1": float(macro_f1),
            "confusion_matrix": matrix,
            "classification_report": report,
            "notice": "Candidate only; shadow pilot and authorised promotion are still required.",
        }
        CANDIDATE_MODELS.mkdir(parents=True, exist_ok=True)
        version = f"behaviour-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}"
        candidate_path = CANDIDATE_MODELS / f"{version}.joblib"
        joblib.dump(model, candidate_path)
        checksum = hashlib.sha256(candidate_path.read_bytes()).hexdigest()
        db.register_behaviour_model_candidate(
            version=version,
            dataset_version=settings.behaviour_dataset_version,
            model_path=str(candidate_path.relative_to(ROOT)),
            sha256=checksum,
            samples=len(rows),
            groups=len(set(group_keys)),
            metrics=metrics,
            created_by=actor_user_id,
        )
        return {"version": version, "status": "candidate", "samples": len(rows), "groups": len(set(group_keys)), **metrics}

    def activate_candidate(self, model_path: str, expected_sha256: str) -> None:
        source = (ROOT / model_path).resolve()
        candidates_root = CANDIDATE_MODELS.resolve()
        if candidates_root not in source.parents or not source.is_file():
            raise ValueError("Candidate model file is unavailable")
        if hashlib.sha256(source.read_bytes()).hexdigest() != expected_sha256:
            raise ValueError("Candidate model checksum verification failed")
        model = joblib.load(source)
        if not hasattr(model, "predict_proba") or getattr(model, "classes_", None) is None:
            raise ValueError("Candidate model is incompatible")
        MODELS.mkdir(parents=True, exist_ok=True)
        temporary = MODELS / "behaviour_classifier.pending.joblib"
        shutil.copy2(source, temporary)
        temporary.replace(BEHAVIOUR_MODEL)
        self.behaviour_model = model


vision = VisionService()
