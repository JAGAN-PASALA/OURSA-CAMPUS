import { Capacitor } from "@capacitor/core";
import { nativePlatform, request } from "./api-client";

type Config = { enabled:boolean; firebase:Record<string,string>; vapid_key:string };
export async function enableNotifications(prompt = true) {
  const config = await request<Config>("/api/public/push-config");
  if(!config.enabled) throw new Error("Your administrator must configure notification delivery first. Updates remain available here.");
  let token: string;
  if(nativePlatform()) {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
    const permission = prompt ? await FirebaseMessaging.requestPermissions() : await FirebaseMessaging.checkPermissions();
    if(permission.receive !== "granted") throw new Error("Enable notifications in your device settings.");
    token = (await FirebaseMessaging.getToken()).token;
  } else {
    const { isSupported, getMessaging, getToken } = await import("firebase/messaging");
    if(!window.isSecureContext || !await isSupported()) throw new Error("Push needs HTTPS or localhost and a supported browser. On iPhone, add the website to the Home Screen and open it there.");
    if(!config.firebase.appId || !config.vapid_key) throw new Error("Web notification configuration is incomplete.");
    const permission = prompt ? await Notification.requestPermission() : Notification.permission;
    if(permission !== "granted") throw new Error("Notifications are not permitted by this browser.");
    const { initializeApp, getApps } = await import("firebase/app");
    const app = getApps()[0] || initializeApp(config.firebase);
    const registration = await navigator.serviceWorker.register(`/push-sw.js?config=${encodeURIComponent(JSON.stringify(config.firebase))}`, {scope:"/"});
    await navigator.serviceWorker.ready;
    token = await getToken(getMessaging(app), {vapidKey:config.vapid_key,serviceWorkerRegistration:registration});
  }
  return request<{id:number}>("/api/me/push-devices","POST",{token,platform:Capacitor.getPlatform(),device_label:nativePlatform()?Capacitor.getPlatform():navigator.userAgent.slice(0,100)});
}

export async function disableNotifications(deviceId:number) {
  await request(`/api/me/push-devices/${deviceId}`,"DELETE");
  if(nativePlatform()) {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
    await FirebaseMessaging.deleteToken();
  } else {
    const { getApps } = await import("firebase/app");
    if(getApps().length) {
      const { getMessaging, deleteToken } = await import("firebase/messaging");
      await deleteToken(getMessaging(getApps()[0]));
    }
  }
}
