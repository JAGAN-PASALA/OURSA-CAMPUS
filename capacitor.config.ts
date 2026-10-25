import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "in.ours.smartclassroom",
  appName: "OUR'S Smart Classroom",
  webDir: "mobile/dist",
  server: { androidScheme:"https", cleartext:false },
  android: {allowMixedContent:false,webContentsDebuggingEnabled:false},
  ios: {contentInset:"automatic"},
  plugins: {FirebaseMessaging:{presentationOptions:["badge","sound","alert"]}},
  experimental: {ios:{spm:{packageOptions:{"@capacitor-firebase/messaging":{symlink:true}}}}},
};
export default config;
