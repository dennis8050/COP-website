import { useState } from "react";
import { useData } from "../hooks/data";
import { Heading, State, download } from "../components/UI";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { jsPDF } from "jspdf";
export default function Dashboard({ reports = false }: { reports?: boolean }) {
  const [from, setFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
  );
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [chart, setChart] = useState("week");
  const [member, setMember] = useState("");
  const [service, setService] = useState("");
  const [ministry, setMinistry] = useState("");
  const [method, setMethod] = useState("");
  const members = useData("/members?limit=100");
  const services = useData("/services?limit=100");
  const ministries = useData("/ministries?limit=100");
  const {
    data: d,
    loading,
    error,
  } = useData(
    `/${reports ? "reports/attendance" : "dashboard"}?from=${from}&to=${to}&member_id=${member}&service_id=${service}&ministry_id=${ministry}&attendance_method=${method}`,
  );
  function csv() {
    const rows = [
      ["Date", "Member", "Service", "Status", "Method"],
      ...d.rows.map((r: any) => [
        r.date.slice(0, 10),
        r.first_name + " " + r.last_name,
        r.name,
        r.status,
        r.attendance_method,
      ]),
    ];
    const safe = (v: string) =>
      '"' + ((/^[=+@-]/.test(v) ? "'" : "") + v).replaceAll('"', '""') + '"';
    download(
      "church-attendance.csv",
      new Blob([rows.map((r: string[]) => r.map(safe).join(",")).join("\n")], {
        type: "text/csv",
      }),
    );
  }
  function pdf() {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Church Attendance Report", 14, 20);
    doc.setFontSize(11);
    doc.text(`${from} to ${to}`, 14, 30);
    doc.text(
      `Total attendance: ${d.total_attendance} | Present: ${d.present} | Rate: ${d.attendance_percentage}%`,
      14,
      40,
    );
    let y = 55;
    for (const r of d.rows) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(
        `${r.date.slice(0, 10)}  ${r.first_name} ${r.last_name}  ${r.name}  ${r.status}`.slice(
          0,
          105,
        ),
        14,
        y,
      );
      y += 7;
    }
    doc.save("church-attendance.pdf");
  }
  return (
    <>
      <Heading
        title={reports ? "Attendance reports" : "Community overview"}
        sub="Every number represents a person. See how your community is growing."
      >
        {reports && (
          <div className="buttons">
            <button disabled={!d} onClick={csv}>
              Export CSV
            </button>
            <button disabled={!d} className="secondary" onClick={pdf}>
              Export PDF
            </button>
          </div>
        )}
      </Heading>
      <div className="toolbar">
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        {reports && (
          <>
            {[
              ["Member", member, setMember, members.data?.items],
              ["Service", service, setService, services.data?.items],
              ["Ministry", ministry, setMinistry, ministries.data?.items],
            ].map(([label, value, set, items]: any) => (
              <label key={label}>
                {label}
                <select value={value} onChange={(e) => set(e.target.value)}>
                  <option value="">All</option>
                  {items?.map((x: any) => (
                    <option key={x.id} value={x.id}>
                      {x.name || x.first_name + " " + x.last_name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="">All</option>
                {["QR_SCAN", "MANUAL", "ADMIN"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      <State loading={loading} error={error}>
        <div className="grid stats">
          {[
            ["Total members", d?.total_members],
            ["Active members", d?.active_members],
            ["Today’s attendance", d?.today],
            ["Weekly attendance", d?.weekly],
            ["Monthly attendance", d?.monthly],
            ["Attendance rate", d?.attendance_percentage + "%"],
            ["Average attendance", d?.average_attendance],
            ["New members", d?.new_members],
          ].map(([t, v]) => (
            <article className="card stat" key={t}>
              <span>{t}</span>
              <strong>{v}</strong>
            </article>
          ))}
        </div>
        <div className="grid two">
          <article className="card">
            <h2>Attendance over time</h2>
            <select
              aria-label="Chart grouping"
              value={chart}
              onChange={(e) => setChart(e.target.value)}
            >
              <option value="week">By week</option>
              <option value="month">By month</option>
              <option value="service">By service</option>
              <option value="member">Member percentage</option>
            </select>
            <p className="muted">Present members by service</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={
                  (chart === "week"
                    ? d?.weekly_series
                    : chart === "month"
                      ? d?.monthly_series
                      : chart === "service"
                        ? d?.by_service
                        : d?.by_member) || []
                }
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey={
                    chart === "service" || chart === "member" ? "name" : "date"
                  }
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey={chart === "member" ? "percentage" : "present"}
                  fill="#287d80"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </article>
          <article className="card">
            <h2>Attendance by ministry</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={d?.by_ministry || []}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="present" fill="#c29547" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>
        </div>
        <div className="card table-wrap">
          <h2>Recent attendance</h2>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Service</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {d?.rows
                ?.slice(0, reports ? 500 : 10)
                .map((x: any, i: number) => (
                  <tr key={i}>
                    <td>
                      {x.first_name} {x.last_name}
                    </td>
                    <td>{x.name}</td>
                    <td>{x.date.slice(0, 10)}</td>
                    <td>
                      <span className="badge">{x.status}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!d?.rows?.length && (
            <p className="empty">No attendance in this date range.</p>
          )}
        </div>
      </State>
    </>
  );
}
