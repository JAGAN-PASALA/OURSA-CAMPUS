"use client";
import { useCallback, useEffect, useState } from "react";
import { nativePlatform, request } from "@/lib/api-client";
import { enableNotifications, disableNotifications } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
type Notice = {id:number;template?:string;message:string;created_at:string;deep_link?:string};
type NoticeCategory = "all"|"attendance"|"academics"|"fees"|"announcements"|"security";
const categories: {value:NoticeCategory;label:string}[]=[
  {value:"all",label:"All"},{value:"attendance",label:"Attendance"},{value:"academics",label:"Assignments & exams"},
  {value:"fees",label:"Fees"},{value:"announcements",label:"Announcements"},{value:"security",label:"Security"},
];
function noticeCategory(row:Notice):NoticeCategory {
  const value=(row.template||"").toLowerCase();
  if(value.includes("attendance")||value.includes("absent")||value.includes("present")) return "attendance";
  if(value.includes("fee")||value.includes("payment")) return "fees";
  if(value.includes("announcement")) return "announcements";
  if(value.includes("security")||value.includes("password")||value.includes("login")) return "security";
  return "academics";
}
const preferenceKey = (id:number)=>`ours.push.${id}.${localStorage.getItem("ours_institution_slug") || ""}`;

export function PushLifecycle({userId}:{userId:number}) {
  useEffect(()=>{
    let disposed=false;
    let cleanup:(()=>void)|undefined;
    if(localStorage.getItem(preferenceKey(userId))) void enableNotifications(false).then(d=>{
      if(!disposed) localStorage.setItem(preferenceKey(userId),String(d.id));
    }).catch(()=>{});
    if(nativePlatform()) void import("@capacitor-firebase/messaging").then(async ({FirebaseMessaging})=>{
      const listener=await FirebaseMessaging.addListener("notificationActionPerformed",event=>{
        const link=String((event.notification.data as Record<string,unknown> | undefined)?.deep_link || "/?view=notifications");
        if(link.startsWith("/?")) window.location.assign(link);
      });
      if(disposed) void listener.remove(); else cleanup=()=>{void listener.remove();};
    });
    return ()=>{disposed=true;cleanup?.();};
  },[userId]);
  return null;
}

export function NotificationCenter({userId,onNavigate}:{userId:number;onNavigate:(view:string)=>void}) {
  const [rows,setRows]=useState<Notice[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [category,setCategory]=useState<NoticeCategory>("all");
  const [device,setDevice]=useState(()=>Number(localStorage.getItem(preferenceKey(userId)))||0);
  const refresh=useCallback(()=>request<Notice[]>("/api/me/notifications").then(setRows).catch(e=>setMessage(e.message)),[]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),30000);return ()=>clearInterval(timer);},[refresh]);
  async function toggle() {
    setBusy(true);
    try {
      if(device) {await disableNotifications(device);localStorage.removeItem(preferenceKey(userId));setDevice(0);setMessage("Device notifications disabled.");}
      else {const registered=await enableNotifications();localStorage.setItem(preferenceKey(userId),String(registered.id));setDevice(registered.id);setMessage("Notifications enabled for this account and device.");}
    } catch(e){setMessage(e instanceof Error?e.message:"Unable to change notifications");}
    finally{setBusy(false);}
  }
  const visible=category==="all"?rows:rows.filter(row=>noticeCategory(row)===category);
  return <section className="panel academic-form"><h2>Notifications</h2><p>Choose a category to keep attendance, coursework, fees and security messages separate.</p><div className="notification-filters" role="tablist" aria-label="Notification categories">{categories.map(item=><button type="button" role="tab" aria-selected={category===item.value} className={category===item.value?"active":""} key={item.value} onClick={()=>setCategory(item.value)}>{item.label}<span>{item.value==="all"?rows.length:rows.filter(row=>noticeCategory(row)===item.value).length}</span></button>)}</div><Button disabled={busy} onClick={()=>void toggle()}>{busy?"Updating…":device?"Disable device notifications":"Enable device notifications"}</Button><p role="status">{message}</p>{visible.map(n=><article key={n.id} className="notification-item"><p>{n.message}</p><small>{new Date(n.created_at).toLocaleString()}</small>{n.deep_link&&<Button variant="outline" onClick={()=>{const url=new URL(n.deep_link!,window.location.origin);onNavigate(url.searchParams.get("view")||"dashboard");}}>Open</Button>}</article>)}{!visible.length&&<p>No notifications in this category.</p>}</section>;
}
