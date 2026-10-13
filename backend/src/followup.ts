/** Scheduled Lambda. No external SMS is attempted until BOTH global feature flag and
 * the district-specific administrator switch are enabled. NEVER run as an API endpoint. */
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@smithy/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { query } from "./database.js";
import { defaultTemplate } from "./followup-api.js";

export function formatAbsenceSms(template:string,name:string,district:string) {
  return (template||defaultTemplate).replaceAll("[Member Name]",name).replaceAll("[District Name]",district);
}
// AWS SNS Query API, signed using the existing AWS SDK signer/role credentials.
// Avoid static credentials, a second provider account, or a dependency on an SNS topic.
async function publishSms(phone:string,message:string) {
  const region=process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if(!region) throw new Error("AWS_REGION is required");
  const hostname=`sns.${region}.amazonaws.com`;
  const body=new URLSearchParams({Action:"Publish",Version:"2010-03-31",PhoneNumber:phone,Message:message,
    "MessageAttributes.entry.1.Name":"AWS.SNS.SMS.SMSType",
    "MessageAttributes.entry.1.Value.DataType":"String",
    "MessageAttributes.entry.1.Value.StringValue":"Transactional"}).toString();
  const signed=await new SignatureV4({credentials:defaultProvider(),region,service:"sns",sha256:Sha256}).sign({protocol:"https:",hostname,method:"POST",path:"/",headers:{host:hostname,"content-type":"application/x-www-form-urlencoded; charset=utf-8"},body});
  const response=await fetch(`https://${hostname}/`,{method:"POST",headers:signed.headers as Record<string,string>,body,signal:AbortSignal.timeout(10000)});
  const reply=await response.text();
  if(!response.ok) throw new Error(`SNS rejected request (${response.status})`);
  const id=/<MessageId>([^<]+)<\/MessageId>/.exec(reply)?.[1];
  if(!id) throw new Error("SNS did not return message ID; delivery status unknown");
  return id;
}
const phoneValid=(p:unknown):p is string=>typeof p==="string" && /^\+[1-9]\d{7,14}$/.test(p);
export async function runFollowups() {
  if(process.env.SMS_SEND_ENABLED!=="true") return {enabled:false,attempted:0};
  const services=await query(`SELECT s.id,s.district_id,s.date,s.name,f.sms_template,d.name AS district_name
    FROM services s JOIN district_followup_settings f ON f.district_id=s.district_id
    JOIN districts d ON d.id=s.district_id
    WHERE f.enabled=true AND s.deleted_at IS NULL AND s.status='completed'
    AND s.attendance_finalized_at IS NOT NULL AND s.attendance_deadline_at<=now()
    AND s.end_time IS NOT NULL
    AND ((s.date::text || ' ' || s.end_time::text)::timestamp AT TIME ZONE f.timezone)
         + (f.delay_minutes * interval '1 minute') <=now()
    AND s.attendance_finalized_at <= now()
    AND ((s.date::text || ' ' || s.end_time::text)::timestamp AT TIME ZONE f.timezone) >= now() - interval '24 hours'
    ORDER BY s.date DESC LIMIT 100`);
  let attempted=0, submitted=0;
  for(const service of services){
    const absent=await query(`SELECT m.id,m.first_name,m.last_name,m.phone
      FROM members m WHERE m.district_id=$1 AND m.status='active' AND m.deleted_at IS NULL
      AND m.sms_consent=true AND m.sms_opted_out=false AND m.followup_exempt=false
      AND m.membership_date<=$3::date
      AND NOT EXISTS(SELECT 1 FROM attendance a WHERE a.member_id=m.id AND a.service_id=$2 AND a.status IN ('present','excused'))
      AND NOT EXISTS(SELECT 1 FROM followup_exemptions x WHERE x.member_id=m.id AND x.service_id=$2)
      ORDER BY m.id`,[service.district_id,service.id,service.date]);
    for(const member of absent){
      if(!phoneValid(member.phone)) continue;
      // Insert-only ensures a concurrent invocation or retry cannot publish twice.
      const [queued]=await query(`INSERT INTO sms_notifications(member_id,district_id,service_id,notification_type)
        VALUES($1,$2,$3,'ABSENCE') ON CONFLICT(member_id,service_id,notification_type) DO NOTHING RETURNING id`,
        [member.id,service.district_id,service.id]);
      if(!queued) continue;
      // Claim BEFORE external call. An interrupted/ambiguous request remains 'unknown',
      // and is never automatically retried (at-most-once initiation, not guaranteed delivery).
      const [claim]=await query("UPDATE sms_notifications SET status='unknown',attempt_count=1,attempted_at=now(),updated_at=now() WHERE id=$1 AND status='queued' AND attempt_count=0 RETURNING id",[queued.id]);
      if(!claim) continue;
      attempted++;
      try{
        const id=await publishSms(member.phone,formatAbsenceSms(service.sms_template,`${member.first_name} ${member.last_name}`,service.district_name));
        await query("UPDATE sms_notifications SET status='submitted',provider_message_id=$2,updated_at=now() WHERE id=$1",[claim.id,id]);
        submitted++;
      }catch(error){
        // Network errors/timeouts have uncertain outcomes. Never duplicate these requests.
        await query("UPDATE sms_notifications SET status='unknown',failure_reason=$2,updated_at=now() WHERE id=$1",[claim.id, (error as Error).message.slice(0,120)]);
        console.error(JSON.stringify({event:"sms_submission_unconfirmed",notification_id:claim.id}));
      }
    }
  }
  return {enabled:true,services:services.length,attempted,submitted};
}
export async function handler() {return runFollowups();}
