import { build } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const raw=process.env.MOBILE_API_URL || "";
let url;
try { url=new URL(raw); } catch { throw new Error("Set MOBILE_API_URL to your deployed HTTPS portal origin before building Android/iOS."); }
if(url.protocol!=="https:" || url.pathname!=="/" || url.search || url.hash || url.username || url.password) throw new Error("MOBILE_API_URL must be an HTTPS origin without credentials or a path.");
await build({configFile:false,root:root+"mobile",plugins:[react()],resolve:{alias:{"@":root}},define:{__MOBILE_API_ORIGIN__:JSON.stringify(url.origin)},build:{outDir:"dist",emptyOutDir:true},css:{postcss:root}});
