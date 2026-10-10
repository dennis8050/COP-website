import { z } from "zod";
import { query } from "../database.js";
import { ApiError } from "../errors.js";
import { uuid } from "../validation.js";
function required<T>(rows: T[]): T {
  if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Resource was not found");
  return rows[0];
}
export async function analytics(q: Record<string, string | undefined>) {
  const from = q.from ? z.string().date().parse(q.from) : "2000-01-01";
  const to = q.to ? z.string().date().parse(q.to) : "2100-01-01";
  if (from > to)
    throw new ApiError(400, "DATE_RANGE", "Start date must precede end date");
  const vals: unknown[] = [from, to];
  const filters = [
    "s.date BETWEEN $1::date AND $2::date",
    "s.deleted_at IS NULL",
    "m.deleted_at IS NULL",
  ];
  for (const [param, column] of [
    ["member_id", "a.member_id"],
    ["service_id", "a.service_id"],
    ["ministry_id", "m.ministry_id"],
    ["attendance_method", "a.attendance_method"],
  ])
    if (q[param]) {
      vals.push(
        param === "attendance_method"
          ? z.enum(["QR_SCAN", "MANUAL", "ADMIN"]).parse(q[param])
          : uuid.parse(q[param]),
      );
      filters.push(`${column}=$${vals.length}`);
    }
  const join =
    "FROM attendance a JOIN members m ON m.id=a.member_id JOIN services s ON s.id=a.service_id";
  const where = filters.join(" AND ");
  const summary = required(
    await query(
      `SELECT count(*)::int AS total_attendance,count(*) FILTER(WHERE a.status='present')::int AS present,count(*) FILTER(WHERE a.status='absent')::int AS absent,count(*) FILTER(WHERE a.status='excused')::int AS excused,count(DISTINCT s.id)::int AS total_services ${join} WHERE ${where}`,
      vals,
    ),
  );
  const members = required(
    await query(
      "SELECT count(*)::int AS total_members,count(*) FILTER(WHERE status='active')::int AS active_members,count(*) FILTER(WHERE created_at>=date_trunc('month',now()))::int AS new_members FROM members WHERE deleted_at IS NULL",
    ),
  );
  const period = required(
    await query(
      `SELECT count(*) FILTER(WHERE s.date=current_date)::int AS today,count(*) FILTER(WHERE s.date>=date_trunc('week',current_date))::int AS weekly,count(*) FILTER(WHERE s.date>=date_trunc('month',current_date))::int AS monthly ${join} WHERE a.status='present' AND s.date<=current_date AND s.deleted_at IS NULL AND m.deleted_at IS NULL`,
    ),
  );
  const eligibleVals: unknown[] = [from, to];
  const eligibleFilters = [
    "m.deleted_at IS NULL",
    "s.deleted_at IS NULL",
    "s.status<>'cancelled'",
    "s.date BETWEEN $1::date AND LEAST($2::date,current_date)",
    "m.membership_date<=s.date",
  ];
  for (const [param, column] of [
    ["member_id", "m.id"],
    ["service_id", "s.id"],
    ["ministry_id", "m.ministry_id"],
  ])
    if (q[param]) {
      eligibleVals.push(uuid.parse(q[param]));
      eligibleFilters.push(`${column}=$${eligibleVals.length}`);
    }
  const eligible = required(
    await query(
      `SELECT count(*)::int AS count FROM members m CROSS JOIN services s WHERE ${eligibleFilters.join(" AND ")}`,
      eligibleVals,
    ),
  ).count;
  const series = await query(
    `SELECT s.date,s.name,count(*) FILTER(WHERE a.status='present')::int AS present ${join} WHERE ${where} GROUP BY s.id ORDER BY s.date`,
    vals,
  );
  const byMinistry = await query(
    `SELECT COALESCE(mi.name,'Unassigned') AS name,count(*) FILTER(WHERE a.status='present')::int AS present ${join} LEFT JOIN ministries mi ON mi.id=m.ministry_id WHERE ${where} GROUP BY mi.name`,
    vals,
  );
  const rows = await query(
    `SELECT m.first_name,m.last_name,s.name,s.date,a.status,a.attendance_method,a.check_in_time ${join} WHERE ${where} ORDER BY s.date DESC LIMIT 10000`,
    vals,
  );
  const weeklySeries = await query(
    `SELECT to_char(date_trunc('week',s.date),'YYYY-MM-DD') AS date,count(*) FILTER(WHERE a.status='present')::int AS present ${join} WHERE ${where} GROUP BY date_trunc('week',s.date) ORDER BY date_trunc('week',s.date)`,
    vals,
  );
  const monthlySeries = await query(
    `SELECT to_char(date_trunc('month',s.date),'YYYY-MM') AS date,count(*) FILTER(WHERE a.status='present')::int AS present ${join} WHERE ${where} GROUP BY date_trunc('month',s.date) ORDER BY date_trunc('month',s.date)`,
    vals,
  );
  const byService = await query(
    `SELECT s.name,count(*) FILTER(WHERE a.status='present')::int AS present ${join} WHERE ${where} GROUP BY s.name ORDER BY s.name`,
    vals,
  );
  const byMember = await query(
    `SELECT m.first_name||' '||m.last_name AS name,round(100.0*count(*) FILTER(WHERE a.status='present')/NULLIF(count(*),0))::int AS percentage ${join} WHERE ${where} GROUP BY m.id ORDER BY percentage DESC LIMIT 50`,
    vals,
  );
  return {
    weekly_series: weeklySeries,
    monthly_series: monthlySeries,
    by_service: byService,
    by_member: byMember,
    ...summary,
    ...members,
    ...period,
    attendance_percentage: eligible
      ? Math.round((summary.present / eligible) * 100)
      : 0,
    average_attendance: summary.total_services
      ? Math.round(summary.present / summary.total_services)
      : 0,
    series,
    by_ministry: byMinistry,
    rows,
  };
}
