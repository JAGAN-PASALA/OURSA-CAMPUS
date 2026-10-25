import { build } from "esbuild";
await build({entryPoints:["scripts/push-sw.js"],bundle:true,outfile:"public/push-sw.js",format:"iife",minify:true,target:"es2020"});
