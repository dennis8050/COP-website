import { useEffect, useState } from "react";
import { useAuth } from "../hooks/auth";
import { useData } from "../hooks/data";
import { api } from "../services/api";
import { action, Heading, State } from "../components/UI";
export default function Followup(){
 const {user}=useAuth();const districts=useData("/public/districts");
 const [district,setDistrict]=useState("");const [service,setService]=useState("");
 const [saving,setSaving]=useState(false);
 useEffect(()=>{if(user?.district_id)setDistrict(user.district_id)},[user?.district_id]);
 const chosen=district || user?.district_id || "";
 const settings=useData(`/followup/settings${chosen?`?district_id=${chosen}`:""}`);
 const services=useData(`/services?limit=100${chosen?`&district_id=${chosen}`:""}`);
 const summary=useData(`/followup/summary${chosen?`?district_id=${chosen}`:""}`);
 const absent=useData(service?`/followup/absences?service_id=${service}${chosen?`&district_id=${chosen}`:""}`:null);
 const notifications=useData(`/followup/notifications${chosen?`?district_id=${chosen}`:""}`);
 const setting=settings.data?.[0];
 return <><Heading title="Attendance Follow-Up" sub="Review finalized attendance, consent and SMS delivery records. Automated sending is off unless explicitly configured and enabled." />
 <div className="card toolbar"><label>District <select value={chosen} onChange={e=>{setDistrict(e.target.value);setService("")}} disabled={user?.role!=="ADMIN"}>
 {user?.role==="ADMIN"&&<option value="">All districts</option>}
 {districts.data?.filter((d:any)=>user?.role==="ADMIN"||d.id===user?.district_id).map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}
 </select></label><label>Finalized service <select value={service} onChange={e=>setService(e.target.value)}><option value="">Choose a finalized service</option>{services.data?.items?.filter((s:any)=>s.attendance_finalized_at).map((s:any)=><option key={s.id} value={s.id}>{s.name} · {String(s.date).slice(0,10)}</option>)}</select></label></div>
 <State loading={settings.loading} error={settings.error}>
 <div className="grid two"><section className="card"><h2>Notification settings</h2>{!chosen?<p>Select a district to edit its settings.</p>:setting&&<form key={chosen+String(setting.updated_at)} onSubmit={async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));setSaving(true);await action(async()=>{await api("/followup/settings","PUT",{district_id:chosen,enabled:d.enabled==="true",delay_minutes:Number(d.delay_minutes),sms_template:d.sms_template,timezone:d.timezone});await settings.reload()},"Settings saved");setSaving(false)}}>
 <label>Send automatically<select name="enabled" defaultValue={String(setting.enabled)}><option value="false">Paused / Disabled</option><option value="true">Enable (requires provider activation)</option></select></label>
 <label>Delay after service ends (minutes)<input name="delay_minutes" type="number" min="120" max="10080" defaultValue={setting.delay_minutes}/></label>
 <label>Time zone (IANA)<input name="timezone" required defaultValue={setting.timezone}/></label>
 <label>Message template <textarea name="sms_template" rows={5} required defaultValue={setting.sms_template}/></label>
 <p className="muted">Use [Member Name] and [District Name]. Consent, finalized attendance, expiry of the deadline, and valid E.164 phone numbers are mandatory. An AWS sending gate remains disabled by default.</p>
 <button disabled={saving}>Save settings</button></form>}</section>
 <section className="card"><h2>Notification status</h2>{summary.data?.length?summary.data?.map((x:any)=><p key={x.district_id+x.status}>{x.district_id} · {x.status}: <strong>{x.total}</strong></p>):<p>No notifications recorded.</p>}</section></div>
 </State>
 {service&&<section className="card"><h2>Missing attendance entries</h2><p className="muted">These members have no present or checked-in record in the finalized roster. SMS requires consent and eligibility checks; this list is not a sending command.</p><State loading={absent.loading} error={absent.error}>
 <div className="table-wrap"><table><thead><tr><th>Member</th><th>Attendance</th><th>Consent</th><th>Exemption</th></tr></thead><tbody>{absent.data?.map((m:any)=><tr key={m.id}><td>{m.first_name} {m.last_name}</td><td>{m.attendance_state}</td><td>{m.sms_consent&&!m.sms_opted_out?"Consented":"Not eligible"}</td><td>{m.followup_exempt?"Exempt":"—"}</td></tr>)}</tbody></table></div>
 </State></section>}
 <section className="card"><h2>Notification history</h2><State loading={notifications.loading} error={notifications.error}>
 <div className="table-wrap"><table><thead><tr><th>Member</th><th>District</th><th>Service</th><th>Status</th><th>Attempts</th><th>Reason</th></tr></thead><tbody>{notifications.data?.map((n:any)=><tr key={n.id}><td>{n.first_name} {n.last_name}</td><td>{n.district_id}</td><td>{n.service_name}</td><td>{n.status}</td><td>{n.attempt_count}</td><td>{n.failure_reason||"—"}</td></tr>)}</tbody></table></div>
 </State></section></>;
}
