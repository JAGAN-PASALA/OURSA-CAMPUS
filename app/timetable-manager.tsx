"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch, request } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Assignment = { id:number; section_id:number; term_id:number; teacher_id:number; course_title:string; course_code:string; teacher_name:string };
type Slot = { id:number; assignment_id:number; weekday:number; period_number:number; start_time:string; end_time:string; classroom:string; effective_from:string; effective_to:string; publication_status:string };
type Context = { can_manage:boolean; assignments:Assignment[]; terms:{id:number; name:string; academic_year:string; start_date:string; end_date:string}[]; sections:{id:number;name:string}[]; teachers:{id:number;name:string}[]; mentors:{section_id:number;term_id:number;teacher_id:number}[]; timetable:Slot[]; changes:{id:number;slot_id:number;payload:Slot}[] };
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function TimetableManager({ userId }: { userId:number }) {
  const [data,setData] = useState<Context>();
  const [section,setSection] = useState("");
  const [term,setTerm] = useState("");
  const [subject,setSubject] = useState("");
  const [mentor,setMentor] = useState("");
  const [editing,setEditing] = useState<number>();
  const [form,setForm] = useState({ weekday:0, period_number:1, start_time:"09:00", end_time:"10:00", classroom:"" });
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [importFile,setImportFile] = useState<File>();
  const [importPreview,setImportPreview] = useState<{valid:number;invalid:number;commit_allowed:boolean;rows:{row:number;valid:boolean;errors:string[]}[]} | null>(null);
  const load = useCallback(async () => {
    const result = await request<Context>("/api/timetable/context");
    setData(result);
    setSection(s => result.sections.some(r=>String(r.id)===s) ? s : String(result.sections[0]?.id || ""));
    setTerm(t => result.terms.some(r=>String(r.id)===t) ? t : String(result.terms[0]?.id || ""));
  },[]);
  useEffect(()=>{
    const timer = window.setTimeout(() => {
      void load().catch(e=>setMessage(e.message));
    }, 0);
    return () => window.clearTimeout(timer);
  },[load]);
  const assignments = data?.assignments.filter(a=>a.section_id===Number(section)&&a.term_id===Number(term)) || [];
  const selected = assignments.find(a=>String(a.id)===subject) || assignments[0];
  const semester = data?.terms.find(t=>t.id===Number(term));
  const canEdit = data?.can_manage || data?.mentors.some(m=>m.section_id===Number(section)&&m.term_id===Number(term)&&m.teacher_id===userId);
  const slots = data?.timetable.filter(s=>assignments.some(a=>a.id===s.assignment_id)) || [];
  async function act(action:()=>Promise<unknown>, success:string) {
    setBusy(true); setMessage("");
    try { await action(); await load(); setMessage(success); setEditing(undefined); }
    catch(e) { setMessage(e instanceof Error ? e.message : "Unable to save"); }
    finally { setBusy(false); }
  }
  function submit(e:FormEvent) {
    e.preventDefault(); if(!selected) return;
    const path = editing ? `/api/timetable/${editing}` : data?.can_manage ? "/api/admin/academics/timetable" : "/api/academics/timetable/proposals";
    void act(()=>request(path, editing ? "PATCH" : "POST", {...form,assignment_id:selected.id}), data?.can_manage ? "Timetable published. Changes to existing periods apply from tomorrow." : "Proposal sent to the HOD or administrator for approval.");
  }
  function review(path:string, approved:boolean) {
    const reason = approved ? undefined : window.prompt("Reason for rejection")?.trim();
    if(!approved && !reason) return;
    void act(()=>request(path,"PATCH",{decision:approved?"approved":"rejected",reason}),"Review saved.");
  }
  async function runImport(commit=false) {
    if(!importFile) return setMessage("Choose a CSV or XLSX timetable file first.");
    const body=new FormData(); body.append("file",importFile); if(commit) body.append("confirm","true");
    const slug=localStorage.getItem("ours_institution_slug"); const headers:Record<string,string>={}; if(slug) headers["X-Institution-Slug"]=slug;
    setBusy(true);
    try { const response=await apiFetch(`/api/admin/import/timetable/${commit?"commit":"preview"}`,{method:"POST",credentials:"include",headers,body}); const result=await response.json(); if(!response.ok) throw new Error(typeof result.detail==="string"?result.detail:result.detail?.message||"Import failed"); if(commit){setMessage(`Timetable import completed: ${result.created} created, ${result.updated} updated.`);setImportPreview(null);await load();}else{setImportPreview(result);setMessage(`Preview ready: ${result.valid} valid, ${result.invalid} need correction.`);}}
    catch(e){setMessage(e instanceof Error?e.message:"Import failed");} finally{setBusy(false);}
  }
  if(!data) return <section className="panel" role="status">{message || "Loading timetable…"}</section>;
  return <div className="academic-workspace">
    <section className="panel academic-form">
      <h2>Semester timetable</h2>
      <div className="form-row">
        <label>Class<select value={section} onChange={e=>{setSection(e.target.value);setSubject("");setEditing(undefined);}}>{data.sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Academic year / semester<select value={term} onChange={e=>{setTerm(e.target.value);setSubject("");setEditing(undefined);}}>{data.terms.map(t=><option key={t.id} value={t.id}>{t.academic_year} · {t.name}</option>)}</select></label>
      </div>
      {semester && <p>Semester: {semester.start_date} to {semester.end_date}. Every new period uses these dates automatically.</p>}
      {data.can_manage && <div className="form-row">
        <label>Class mentor<select value={mentor || String(data.mentors.find(m=>m.section_id===Number(section)&&m.term_id===Number(term))?.teacher_id || "")} onChange={e=>setMentor(e.target.value)}><option value="">Select teacher</option>{data.teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <Button disabled={busy||!mentor||!section||!term} onClick={()=>void act(()=>request("/api/timetable/mentors","POST",{section_id:Number(section),term_id:Number(term),teacher_id:Number(mentor)}),"Class mentor assigned.")}>Save mentor</Button>
        <Button variant="outline" disabled={busy||!section} onClick={()=>{const name=window.prompt("Correct class name",data.sections.find(s=>s.id===Number(section))?.name)?.trim();if(name) void act(()=>request(`/api/admin/academics/sections/${section}`,"PATCH",{name}),"Class name corrected.");}}>Rename class</Button>
        <Button variant="outline" disabled={busy||!section} onClick={()=>{if(window.confirm("Archive this class? Active students must be moved or withdrawn first. History will be preserved."))void act(()=>request(`/api/admin/academics/sections/${section}`,"DELETE"),"Class archived.");}}>Archive class</Button>
      </div>}
      <p role="status">{message}</p>
    </section>
    {data.can_manage&&<section className="panel academic-form"><h2>Import or update timetable</h2><p>Use the template, preview row mappings and conflicts, then explicitly confirm. Existing periods require action=update.</p><div className="form-row"><a href="/api/admin/import/timetable/template">Download CSV template</a><Input type="file" accept=".csv,.xlsx" onChange={e=>{setImportFile(e.target.files?.[0]);setImportPreview(null);}}/><Button type="button" variant="outline" disabled={busy} onClick={()=>void runImport(false)}>Preview</Button><Button type="button" disabled={busy||!importPreview?.commit_allowed} onClick={()=>void runImport(true)}>Confirm import</Button></div>{importPreview&&<div><strong>{importPreview.valid} valid · {importPreview.invalid} invalid</strong>{importPreview.rows.filter(r=>!r.valid).map(r=><p key={r.row}>Row {r.row}: {r.errors.join("; ")}</p>)}</div>}</section>}
    <form className="panel academic-form" onSubmit={submit}>
      <h2>{editing ? "Change period" : "Add period"}</h2>
      <div className="form-row">
        <label>Subject<select required value={selected?.id || ""} onChange={e=>setSubject(e.target.value)}><option value="" disabled>Select subject</option>{assignments.map(a=><option key={a.id} value={a.id}>{a.course_title} ({a.course_code})</option>)}</select></label>
        <label>Assigned teacher<Input readOnly value={selected?.teacher_name || "No subject allocated"}/></label>
      </div>
      {!assignments.length && <p>The HOD must allocate subjects and teachers to this class and semester first, under Teacher allocation.</p>}
      <div className="form-row">
        <label>Weekday<select value={form.weekday} onChange={e=>setForm({...form,weekday:Number(e.target.value)})}>{days.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>
        <label>Period<Input type="number" min="1" max="20" required value={form.period_number} onChange={e=>setForm({...form,period_number:Number(e.target.value)})}/></label>
        <label>Starts<Input type="time" required value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})}/></label>
        <label>Ends<Input type="time" required value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})}/></label>
        <label>Classroom<Input required value={form.classroom} onChange={e=>setForm({...form,classroom:e.target.value})}/></label>
      </div>
      <Button disabled={busy||!selected} type="submit">{busy?"Saving…":data.can_manage?"Publish period":"Send for approval"}</Button>
      {editing && <Button type="button" variant="outline" onClick={()=>setEditing(undefined)}>Cancel edit</Button>}
      <small>Subject teachers are assigned by the HOD. Class, teacher and room conflicts are checked before publication.</small>
    </form>
    <div className="timetable-grid">{days.map((day,i)=><section className="panel" key={day}><h3>{day}</h3>{slots.filter(s=>s.weekday===i).sort((a,b)=>a.period_number-b.period_number).map(s=>{
      const a=assignments.find(a=>a.id===s.assignment_id);
      return <article className="timetable-period" key={s.id}><strong>Period {s.period_number} · {a?.course_title}</strong><p>{a?.teacher_name} · {s.classroom}</p><p>{s.start_time}–{s.end_time} · {s.publication_status}</p><small>{s.effective_from} to {s.effective_to}</small>
        {canEdit&&s.publication_status==="published"&&<Button variant="outline" disabled={busy} onClick={()=>{setEditing(s.id);setSubject(String(s.assignment_id));setForm({weekday:s.weekday,period_number:s.period_number,start_time:s.start_time,end_time:s.end_time,classroom:s.classroom});window.scrollTo({top:0,behavior:"smooth"});}}>Edit</Button>}
        {data.can_manage&&s.publication_status==="pending"&&<><Button disabled={busy} onClick={()=>review(`/api/admin/academics/timetable/${s.id}/review`,true)}>Approve</Button><Button variant="outline" disabled={busy} onClick={()=>review(`/api/admin/academics/timetable/${s.id}/review`,false)}>Reject</Button></>}
        {data.can_manage&&<Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm("Remove this period and cancel its future classes? Recorded history is kept.")) void act(()=>request(`/api/timetable/${s.id}`,"DELETE"),"Period removed.");}}>Remove</Button>}
      </article>;
    })}{!slots.some(s=>s.weekday===i)&&<p>No periods scheduled.</p>}</section>)}</div>
    {data.changes.length>0&&<section className="panel"><h2>Proposed changes</h2>{data.changes.map(c=><article key={c.id}><p>Period {c.payload.period_number} · {days[c.payload.weekday]} · {c.payload.start_time}–{c.payload.end_time} · {c.payload.classroom}</p>{data.can_manage&&<><Button disabled={busy} onClick={()=>review(`/api/timetable/changes/${c.id}/review`,true)}>Approve change</Button><Button variant="outline" disabled={busy} onClick={()=>review(`/api/timetable/changes/${c.id}/review`,false)}>Reject</Button></>}</article>)}</section>}
  </div>;
}
