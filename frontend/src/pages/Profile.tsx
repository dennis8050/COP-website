import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useData } from "../hooks/data";
import { api } from "../services/api";
import { Heading, State, action } from "../components/UI";
export default function Profile() {
  const profile = useData("/me/profile");
  const attendance = useData("/me/attendance");
  const events = useData("/public/events");
  const stats = useData("/me/statistics");
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (profile.data?.qr_token)
      QRCode.toDataURL(profile.data.qr_token, { width: 300, margin: 2 }).then(
        setQr,
      );
  }, [profile.data]);
  const records = attendance.data || [];
  const present = records.filter((r: any) => r.status === "present");
  let streak = 0;
  for (const a of records) {
    if (a.status !== "present") break;
    streak++;
  }
  return (
    <>
      <Heading
        title="My community"
        sub="Your profile, attendance and personal check-in code."
      />
      <State loading={profile.loading} error={profile.error}>
        <div className="grid stats">
          {[
            ["Services attended", stats.data?.present || 0],
            [
              "Attendance percentage",
              (stats.data?.attendance_percentage || 0) + "%",
            ],
            ["Current streak", stats.data?.streak || 0],
            [
              "Last attendance",
              stats.data?.last_attendance?.slice(0, 10) || "Not yet",
            ],
          ].map(([t, v]) => (
            <div className="card stat" key={t}>
              <span>{t}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <div className="grid two">
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              values.sms_consent = String(values.sms_consent === "true");
              values.sms_opted_out = String(values.sms_opted_out === "true");
              action(async () => {
                await api("/me/profile", "PUT", {...values, sms_consent:values.sms_consent==="true", sms_opted_out:values.sms_opted_out==="true"});
                profile.reload();
              });
            }}
          >
            <h2>
              {profile.data?.first_name} {profile.data?.last_name}
            </h2>
            <p>{profile.data?.email}</p>
            {["phone", "address", "emergency_contact"].map((k) => (
              <label key={k}>
                {k.replaceAll("_", " ")}
                <input name={k} defaultValue={profile.data?.[k] || ""} />
              </label>
            ))}
            <h3>Attendance follow-up privacy</h3>
            <p className="muted">Automated absence SMS is optional. You can withdraw consent or opt out at any time.</p>
            <label>Consent to attendance follow-up SMS
              <select name="sms_consent" defaultValue={String(profile.data?.sms_consent||false)}><option value="false">No</option><option value="true">Yes, I consent</option></select>
            </label>
            <label>Opt out of follow-up SMS
              <select name="sms_opted_out" defaultValue={String(profile.data?.sms_opted_out||false)}><option value="false">No</option><option value="true">Yes, stop all follow-ups</option></select>
            </label>
            <button>Save profile</button>
          </form>
          <div className="card qr-card">
            <h2>Your personal QR code</h2>
            {qr && <img src={qr} alt="Your personal attendance QR code" />}
            <p>Show this code at the welcome desk. Keep it private.</p>
            <div className="buttons">
              <a className="button" download="my-church-qr.png" href={qr}>
                Download QR
              </a>
              <button className="secondary" onClick={() => window.print()}>
                Print QR
              </button>
            </div>
          </div>
        </div>
        <div className="card table-wrap">
          <h2>My attendance</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Service</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((a: any) => (
                <tr key={a.id}>
                  <td>{a.date.slice(0, 10)}</td>
                  <td>{a.name}</td>
                  <td>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Upcoming events</h2>
          {events.data?.map((e: any) => (
            <p key={e.id}>
              {e.name} · {e.date.slice(0, 10)} · {e.location}
            </p>
          ))}
        </div>
      </State>
    </>
  );
}
