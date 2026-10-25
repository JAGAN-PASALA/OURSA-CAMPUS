import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
const config = JSON.parse(new URL(self.location.href).searchParams.get("config") || "{}");
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
if(config.appId) {
  const messaging=getMessaging(initializeApp(config));
  // FCM displays notification payloads; do not show a duplicate here.
  onBackgroundMessage(messaging, () => {});
}
// No API responses, account data or camera frames are cached.
