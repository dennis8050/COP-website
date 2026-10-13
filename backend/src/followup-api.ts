import { z } from "zod";
import { query } from "./database.js";
import { ApiError, allow } from "./errors.js";
import { User } from "./auth.js";
import { Request } from "./api.js";
import { districtId,districtFor } from "./district.js";
import { uuid } from "./validation.js";
const defaultTemplate="Hello [Member Name], we missed you at The Church of Pentecost Canada – Peel Halton Area service today. We hope you are doing well. Your church family is thinking of you. Please contact your district leader if you need any support. God bless you.";
export async function followupApi(r:Request,u:User):Promise<{status:number;data:unknown}> {
  allow(u.role,["ADMIN","PASTOR"]);
  const [,name,id,action]=r.path.split("/"); // /followup/settings or /followup/notifications
  const desired=r.query.district_id;
  const scope=districtFor(u,desired);
  if (id==="settings") {
    if(r.method==="GET") return {status:200,data:await query(`SELECT f.*,d.name AS district_name FROM district_followup_settings f JOIN districts d ON d.id=f.district_id WHERE ${scope?"f.district_id=$1":"true"} ORDER BY d.name`,scope?[scope]:[])};
    if(r.method==="PUT") {
      const v=z.object({district_id:districtId,enabled:z.boolean().optional(),delay_minutes:z.number().int().min(120).max(10080).optional(),sms_template:z.string().min(20).max(480).optional(),timezone:z.string().min(1).max(64).optional()}).parse(r.body);
      districtFor(u,v.district_id);
      if(v.enabled && process.env.SMS_SEND_ENABLED!=="true") throw new ApiError(409,"SMS_PROVIDER_DISABLED","SMS provider is not configured for live sending");
      // Validate timezone using PostgreSQL's IANA-aware time zone catalog.
      if(v.timezone && !(await query("SELECT 1 FROM pg_timezone_names WHERE name=$1",[v.timezone])).length) throw new ApiError(400,"BAD_TIMEZONE","Use an IANA time zone");
      const changes=Object.entries(v).filter(([key])=>key!=="district_id");
      if(!changes.length) throw new ApiError(400,"EMPTY_UPDATE","No settings supplied");
      const vals:unknown[]=[v.district_id];
      const assigns=changes.map(([k,val])=>{vals.push(val);return `${k}=$${vals.length}`;});
      const rows=await query(`UPDATE district_followup_settings SET ${assigns.join(",")},updated_at=now() WHERE district_id=$1 RETURNING *`,vals);
      return {status:200,data:rows[0]};
    }
  }
  if(id==="notifications" && r.method==="GET") {
    const vals:unknown[]=[];const where=["true"];
    if(scope) {vals.push(scope);where.push(`n.district_id=$${vals.length}`);}
    if(r.query.service_id){vals.push(uuid.parse(r.query.service_id));where.push(`n.service_id=$${vals.length}`);}
    if(r.query.status){vals.push(z.enum(["queued","submitted","delivered","failed","unknown"]).parse(r.query.status));where.push(`n.status=$${vals.length}`);}
    return {status:200,data:await query(`SELECT n.id,n.service_id,n.district_id,n.status,n.notification_type,n.attempt_count,n.attempted_at,n.failure_reason,n.updated_at,m.first_name,m.last_name,s.name AS service_name FROM sms_notifications n JOIN members m ON m.id=n.member_id JOIN services s ON s.id=n.service_id WHERE ${where.join(" AND ")} ORDER BY n.updated_at DESC LIMIT 200`,vals)};
  }
  if(id==="absences" && r.method==="GET") {
    const serviceId=uuid.parse(r.query.service_id);
    const [service]=await query("SELECT district_id,attendance_finalized_at FROM services WHERE id=$1",[serviceId]);
    if(!service || !service.attendance_finalized_at || (scope && scope!==service.district_id)) throw new ApiError(404,"NOT_FOUND","Finalized service not found");
    // No notification is sent for absences until the authoritative attendance roster is finalized.
    const rows=await query(`SELECT m.id,m.first_name,m.last_name,m.sms_consent,m.sms_opted_out,m.followup_exempt,CASE WHEN a.status='absent' THEN 'recorded absent' WHEN x.member_id IS NOT NULL THEN 'exempt' ELSE 'missing record' END AS attendance_state FROM members m JOIN services s ON s.id=$1 AND m.district_id=s.district_id LEFT JOIN attendance a ON a.member_id=m.id AND a.service_id=s.id LEFT JOIN followup_exemptions x ON x.member_id=m.id AND x.service_id=s.id WHERE m.deleted_at IS NULL AND m.status='active' AND m.membership_date<=s.date AND (a.id IS NULL OR a.status='absent') ORDER BY m.last_name LIMIT 1000`,[serviceId]);
    return {status:200,data:rows};
  }
  if(id==="summary" && r.method==="GET") {
    const vals=scope?[scope]:[];
    const where=scope?"WHERE district_id=$1":"";
    return {status:200,data:await query(`SELECT district_id,status,count(*)::int AS total FROM sms_notifications ${where} GROUP BY district_id,status ORDER BY district_id,status`,vals)};
  }
  throw new ApiError(404,"NOT_FOUND","Follow-up endpoint not found");
}
export {defaultTemplate};
