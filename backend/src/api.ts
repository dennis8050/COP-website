import { analytics } from "./services/analytics.js";
import { z } from "zod";
import { query, db } from "./database.js";
import { authenticate, localLogin, User } from "./auth.js";
import { ApiError, allow } from "./errors.js";
import { schemas, uuid, paging } from "./validation.js";
import { districtId, isAreaAdmin, districtFor, authorizedRecord, existingDistrict } from "./district.js";
import { followupApi } from "./followup-api.js";
export type Request = {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  body: unknown;
};
const admin = ["ADMIN"];
const managers = ["ADMIN", "PASTOR"];
const readers = ["ADMIN", "PASTOR", "STAFF"];
const resourceNames = ["members", "services", "events", "ministries"] as const;
type Resource = (typeof resourceNames)[number];
const columns = {
  members: [
    "first_name",
    "last_name",
    "email",
    "phone",
    "date_of_birth",
    "gender",
    "address",
    "emergency_contact",
    "membership_date",
    "ministry_id",
    "profile_photo",
    "status", "district_id", "sms_consent", "sms_opted_out", "followup_exempt",
  ],
  services: [
    "name",
    "description",
    "date",
    "start_time",
    "end_time",
    "location",
    "status", "district_id", "attendance_deadline_at",
  ],
  events: [
    "name",
    "description",
    "date",
    "start_time",
    "end_time",
    "location",
    "maximum_capacity",
    "registration_required",
    "image", "district_id",
  ],
  ministries: [
    "name",
    "description",
    "leader_id",
    "meeting_schedule",
    "status", "district_id",
  ],
};
function required<T>(rows: T[], name = "Resource"): T {
  if (!rows[0]) throw new ApiError(404, "NOT_FOUND", name + " was not found");
  return rows[0];
}
async function audit(u: User, action: string, resource: string, id: string) {
  await query(
    "INSERT INTO audit_log(user_id,action,resource,resource_id) VALUES($1,$2,$3,$4)",
    [u.id, action, resource, id],
  );
}
// All district filtering is server-side. The caller's query string never expands privileges.
function addScope(u: User, alias: string, vals: unknown[], requested?: string) {
  const district = districtFor(u, requested);
  if (district) {
    vals.push(district);
    return `${alias}.district_id=$${vals.length}`;
  }
  return "true";
}
function requireDistrictInput(u: User, input: Record<string,unknown>, old?: string | null) {
  const proposed = input.district_id;
  const district = proposed === undefined ? (old || districtFor(u)) : districtId.parse(proposed);
  if (!district) throw new ApiError(400,"DISTRICT_REQUIRED","Assign a district to this record");
  if (!isAreaAdmin(u) && district !== districtFor(u)) throw new ApiError(403,"DISTRICT_FORBIDDEN","Cannot manage another district");
  return district;
}
export async function execute(
  r: Request,
): Promise<{ status: number; data: unknown }> {
  const parts = r.path.replace(/\/$/, "").split("/").filter(Boolean);
  const [name, id, action] = parts;
  const b = r.body;
  if (r.method === "POST" && r.path === "/auth/login") {
    const v = z
      .object({
        email: z.string().email(),
        password: z.string().min(1).max(128),
        district_id: districtId,
      })
      .parse(b);
    return { status: 200, data: await localLogin(v.email, v.password, v.district_id) };
  }
  if (r.method === "GET" && name === "public") {
    if (id === "districts") return {status:200, data:await query("SELECT id,name FROM districts WHERE active=true ORDER BY name")};
    if (id === "settings")
      return {
        status: 200,
        data: required(await query("SELECT data FROM settings WHERE id=1"))
          .data,
      };
    if (id === "events")
      return {
        status: 200,
        data: await query(
          "SELECT * FROM events WHERE deleted_at IS NULL AND date>=current_date ORDER BY date LIMIT 50",
        ),
      };
    if (id === "ministries")
      return {
        status: 200,
        data: await query(
          "SELECT id,name,description,meeting_schedule FROM ministries WHERE status='active' ORDER BY name",
        ),
      };
  }
  if (r.method === "POST" && name === "contact") {
    const v = z
      .object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        message: z.string().min(10).max(3000),
      })
      .parse(b);
    await query(
      "INSERT INTO contact_messages(name,email,message) VALUES($1,$2,$3)",
      [v.name, v.email, v.message],
    );
    return {
      status: 201,
      data: { message: "Thank you. Your message has been received." },
    };
  }
  const u = await authenticate(r.headers.authorization);
  if (name === "auth" && id === "district" && r.method === "POST") {
    const v = z.object({district_id:districtId}).parse(b);
    districtFor(u,v.district_id);
    return {status:200,data:{district_id:v.district_id, authorized:true}};
  }
  if (name === "districts" && r.method === "GET") {
    const selected=id ? districtId.parse(id) : undefined;
    districtFor(u,selected);
    const vals:unknown[]=[];
    const where=addScope(u,"d",vals,selected);
    return {status:200,data:await query(`SELECT d.id,d.name,(SELECT count(*)::int FROM members m WHERE m.district_id=d.id AND m.deleted_at IS NULL) AS members FROM districts d WHERE d.active=true AND ${where} ORDER BY name`,vals)};
  }
  if (name === "followup") return followupApi(r,u);

  if (name === "me") {
    if (!id) {
      await query("UPDATE users SET last_login=now() WHERE id=$1", [u.id]);
      return { status: 200, data: u };
    }
    const member = required(
      await query(
        "SELECT * FROM members WHERE user_id=$1 AND deleted_at IS NULL",
        [u.id],
      ),
      "Member profile",
    );
    if (!isAreaAdmin(u) && member.district_id !== districtFor(u))
      throw new ApiError(403,"DISTRICT_MISMATCH","Your profile district assignment requires administrator review");
    if (id === "profile" && r.method === "PUT") {
      const v = z
        .object({
          phone: z
            .string()
            .regex(/^[+()\d .-]{7,30}$/)
            .nullable()
            .optional(),
          address: z.string().max(500).nullable().optional(),
          emergency_contact: z.string().max(500).nullable().optional(),
          sms_consent: z.boolean().optional(),
          sms_opted_out: z.boolean().optional(),
        })
        .parse(b);
      const keys = Object.keys(v);
      if (keys.length)
        await query(
          `UPDATE members SET ${keys.map((k, i) => k + "=$" + (i + 2)).join(",")} WHERE id=$1`,
          [member.id, ...Object.values(v)],
        );
      return {
        status: 200,
        data: required(
          await query("SELECT * FROM members WHERE id=$1", [member.id]),
        ),
      };
    }
    if (id === "statistics") {
      const eligible = await query(
        "SELECT s.id,s.date,COALESCE(a.status,'absent') AS status FROM services s LEFT JOIN attendance a ON a.service_id=s.id AND a.member_id=$1 WHERE s.deleted_at IS NULL AND s.status<>'cancelled' AND s.district_id=$3 AND s.date BETWEEN $2::date AND current_date ORDER BY s.date DESC",
        [member.id, member.membership_date, member.district_id],
      );
      let streak = 0;
      for (const x of eligible) {
        if (x.status !== "present") break;
        streak++;
      }
      const present = eligible.filter((x) => x.status === "present");
      return {
        status: 200,
        data: {
          total_services: eligible.length,
          present: present.length,
          attendance_percentage: eligible.length
            ? Math.round((present.length / eligible.length) * 100)
            : 0,
          streak,
          last_attendance: present[0]?.date || null,
          series: eligible.reverse(),
        },
      };
    }
    if (id === "profile") return { status: 200, data: member };
    if (id === "attendance")
      return {
        status: 200,
        data: await query(
          "SELECT a.*,s.name,s.date FROM attendance a JOIN services s ON s.id=a.service_id WHERE a.member_id=$1 AND s.deleted_at IS NULL ORDER BY s.date DESC LIMIT 200",
          [member.id],
        ),
      };
  }
  if (name === "users") {
    allow(u.role, admin);
    if (r.method === "GET")
      return {
        status: 200,
        data: await query(
          "SELECT id,name,email,role,status,district_id,last_login,created_at FROM users ORDER BY name LIMIT 100",
        ),
      };
    if (r.method === "PUT" && id) {
      uuid.parse(id);
      const v = z
        .object({
          role: z.enum(["ADMIN", "PASTOR", "STAFF", "MEMBER"]),
          status: z.enum(["active", "inactive"]),
          district_id: districtId.nullable().optional(),
        })
        .parse(b);
      if (id === u.id && (v.role !== "ADMIN" || v.status !== "active"))
        throw new ApiError(
          409,
          "SELF_LOCKOUT",
          "You cannot remove your own administrator access",
        );
      const target = required(
        await query(
          "UPDATE users SET role=$2,status=$3,district_id=CASE WHEN $5::boolean THEN $4 ELSE district_id END WHERE id=$1 RETURNING id,name,email,role,status,district_id",
          [id, v.role, v.status, v.district_id ?? null, Object.prototype.hasOwnProperty.call(v,"district_id")],
        ),
      );
      await audit(u, "update", "users", id);
      return { status: 200, data: target };
    }
  }
  if (name === "settings") {
    allow(u.role, admin);
    if (r.method === "GET")
      return {
        status: 200,
        data: required(await query("SELECT data FROM settings WHERE id=1"))
          .data,
      };
    if (r.method === "PUT") {
      const v = z
        .object({
          church_name: z.string().min(1).max(150),
          mission: z.string().max(2000),
          vision: z.string().max(2000),
          values: z.string().max(2000),
          address: z.string().max(500),
          email: z.string().email(),
          phone: z.string().max(40),
          social_links: z.array(z.string().url()).max(10),
          service_times: z
            .array(
              z.object({
                name: z.string().max(100),
                time: z.string().max(100),
              }),
            )
            .max(20),
        })
        .parse(b);
      await query("UPDATE settings SET data=$1 WHERE id=1", [
        JSON.stringify(v),
      ]);
      return { status: 200, data: v };
    }
  }
  if (name === "reports" && id === "members") {
    allow(u.role, managers);
    const vals:unknown[]=[];
    const scope=addScope(u,"m",vals,r.query.district_id);
    return {status:200,data:await query(`SELECT m.id,m.first_name,m.last_name,m.email,m.phone,m.status,m.district_id,m.membership_date,mi.name AS ministry FROM members m LEFT JOIN ministries mi ON mi.id=m.ministry_id WHERE m.deleted_at IS NULL AND ${scope} ORDER BY m.last_name LIMIT 10000`,vals)};
  }
  if (name === "contact" && r.method === "GET") {
    allow(u.role, admin);
    return {
      status: 200,
      data: await query(
        "SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100",
      ),
    };
  }
  if (name === "dashboard" || name === "reports") {
    allow(u.role, managers);
    return { status: 200, data: await analytics(r.query, u) };
  }
  if (name === "services" && action === "finalize" && r.method === "POST") {
    allow(u.role,managers);
    const serviceId=uuid.parse(id);
    await authorizedRecord(u,"services",serviceId);
    const [service]=await query("SELECT s.*, ds.timezone FROM services s JOIN district_followup_settings ds ON ds.district_id=s.district_id WHERE s.id=$1",[serviceId]);
    if (!service || !service.end_time || !service.attendance_deadline_at) throw new ApiError(409,"DEADLINE_REQUIRED","Set a service end time and attendance deadline before finalization");
    const [result]=await query(`UPDATE services SET attendance_finalized_at=now(),status='completed' WHERE id=$1 AND attendance_finalized_at IS NULL AND attendance_deadline_at<=now() AND ((date::text || ' ' || end_time::text)::timestamp AT TIME ZONE $2)<=now() RETURNING id,attendance_finalized_at`,[serviceId,service.timezone]);
    if (!result) throw new ApiError(409,"NOT_READY","Deadline has not passed, service has not ended, or attendance is already finalized");
    await audit(u,"finalize","services",serviceId);
    return {status:200,data:result};
  }
  if (resourceNames.includes(name as Resource)) {
    const resource = name as Resource;
    const soft = resource !== "ministries";
    if (id) uuid.parse(id);
    if (resource === "members" && action === "attendance") {
      allow(u.role, readers);
      await authorizedRecord(u,"members",id!);
      return {status:200,data:await query("SELECT a.*,s.name,s.date FROM attendance a JOIN services s ON s.id=a.service_id WHERE a.member_id=$1 ORDER BY s.date DESC",[id])};
    }
    if (resource === "members" && action === "qr" && r.method === "POST") {
      allow(u.role, managers);
      await authorizedRecord(u,"members",id!);
      return {status:200,data:required(await query("UPDATE members SET qr_token=encode(gen_random_bytes(32),'hex') WHERE id=$1 AND deleted_at IS NULL RETURNING qr_token",[id]))};
    }
    if (r.method === "GET") {
      allow(u.role, readers);
      if (id) {
        await authorizedRecord(u, resource, id);
        const row = required(await query(`SELECT * FROM ${resource} WHERE id=$1 ${soft ? "AND deleted_at IS NULL" : ""}`,[id]));
        if (u.role === "STAFF") delete row.qr_token;
        return { status: 200, data: row };
      }
      const p = paging.parse(r.query);
      const vals: unknown[] = [];
      const where = [soft ? "deleted_at IS NULL" : "true",addScope(u,resource,vals,r.query.district_id)];
      if (r.query.search) {
        vals.push("%" + r.query.search + "%");
        where.push(
          resource === "members"
            ? `(first_name ILIKE $${vals.length} OR last_name ILIKE $${vals.length} OR email ILIKE $${vals.length} OR phone ILIKE $${vals.length} OR id::text ILIKE $${vals.length})`
            : `name ILIKE $${vals.length}`,
        );
      }
      if (resource === "members")
        for (const k of ["status", "ministry_id", "gender"])
          if (r.query[k]) {
            vals.push(r.query[k]);
            where.push(`${k}=$${vals.length}`);
          }
      if (resource === "members" && r.query.registered_from) {
        vals.push(z.string().date().parse(r.query.registered_from));
        where.push(`created_at >= $${vals.length}::date`);
      }
      const total = required(
        await query(
          `SELECT count(*)::int AS count FROM ${resource} WHERE ${where.join(" AND ")}`,
          vals,
        ),
      ).count;
      vals.push(p.limit, (p.page - 1) * p.limit);
      const rows = await query(
        `SELECT * FROM ${resource} WHERE ${where.join(" AND ")} ORDER BY ${resource === "members" ? "last_name" : "created_at"} LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
        vals,
      );
      if (u.role === "STAFF") rows.forEach((x) => delete x.qr_token);
      return { status: 200, data: { items: rows, total, ...p } };
    }
    allow(u.role, managers);
    if (r.method === "DELETE" && id) {
      await authorizedRecord(u,resource,id);
      const rows = await query(
        soft
          ? `UPDATE ${resource} SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`
          : `UPDATE ministries SET status='inactive' WHERE id=$1 RETURNING id`,
        [id],
      );
      required(rows);
      await audit(u, "delete", resource, id);
      return { status: 200, data: { id } };
    }
    if (r.method === "POST" || r.method === "PUT") {
      const v = (
        r.method === "PUT" ? schemas[resource].partial() : schemas[resource]
      ).parse(b);
      if (r.method === "PUT" && !id) throw new ApiError(400,"ID_REQUIRED","Resource ID is required");
      const old = r.method === "PUT" ? await authorizedRecord(u,resource,id!) : undefined;
      const district = requireDistrictInput(u,v,old?.district_id);
      await existingDistrict(district);
      // Prevent cross-district references from linking otherwise isolated records.
      const fields=v as Record<string, unknown>;
      if (resource === "members" && fields.ministry_id) {
        const mi=await query("SELECT district_id FROM ministries WHERE id=$1",[fields.ministry_id]);
        if (!mi[0] || mi[0].district_id !== district) throw new ApiError(400,"DISTRICT_MISMATCH","Ministry belongs to another district");
      }
      if (resource === "ministries" && fields.leader_id) {
        const leader=await query("SELECT district_id FROM members WHERE id=$1",[fields.leader_id]);
        if (!leader[0] || leader[0].district_id !== district) throw new ApiError(400,"DISTRICT_MISMATCH","Leader belongs to another district");
      }
      if (resource === "services" && old) {
        const finalized=await query("SELECT attendance_finalized_at FROM services WHERE id=$1",[id]);
        if (finalized[0]?.attendance_finalized_at) throw new ApiError(409,"SERVICE_FINALIZED","Service attendance is finalized");
      }
      (v as Record<string,unknown>).district_id=district;
      const keys = columns[resource].filter((k) =>
        Object.prototype.hasOwnProperty.call(v, k),
      );
      if (!keys.length)
        throw new ApiError(400, "EMPTY_UPDATE", "Enter at least one field");
      const values = keys.map((k) => (v as Record<string, unknown>)[k]);
      let row;
      if (r.method === "POST")
        row = required(
          await query(
            `INSERT INTO ${resource} (${keys.join(",")}) VALUES(${keys.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING *`,
            values,
          ),
        );
      else {
        if (!id)
          throw new ApiError(400, "ID_REQUIRED", "Resource ID is required");
        row = required(
          await query(
            `UPDATE ${resource} SET ${keys.map((k, i) => k + "=$" + (i + 2)).join(",")} WHERE id=$1 ${soft ? "AND deleted_at IS NULL" : ""} RETURNING *`,
            [id, ...values],
          ),
        );
      }
      await audit(
        u,
        r.method === "POST" ? "create" : "update",
        resource,
        row.id,
      );
      return { status: r.method === "POST" ? 201 : 200, data: row };
    }
  }
  if (name === "attendance") {
    allow(u.role, readers);
    if (r.method === "GET") {
      const p = paging.parse(r.query);
      let where = "m.deleted_at IS NULL AND s.deleted_at IS NULL";
      const vals: unknown[] = [];
      if (id) {
        uuid.parse(id);
        vals.push(id);
        where += " AND a.id=$1";
      }
      if (r.query.service_id) {
        vals.push(uuid.parse(r.query.service_id));
        where += ` AND a.service_id=$${vals.length}`;
      }
      where += " AND " + addScope(u,"a",vals,r.query.district_id);
      vals.push(p.limit, (p.page - 1) * p.limit);
      const rows = await query(
        `SELECT a.*,m.first_name,m.last_name,s.name AS service_name,s.date FROM attendance a JOIN members m ON m.id=a.member_id JOIN services s ON s.id=a.service_id WHERE ${where} ORDER BY a.check_in_time DESC LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
        vals,
      );
      return { status: 200, data: id ? required(rows) : rows };
    }
    if (r.method === "DELETE") {
      allow(u.role, admin);
      uuid.parse(id);
      await authorizedRecord(u,"attendance",id);
      const [check]=await query("SELECT s.attendance_finalized_at FROM attendance a JOIN services s ON s.id=a.service_id WHERE a.id=$1",[id]);
      if(check?.attendance_finalized_at) throw new ApiError(409,"SERVICE_FINALIZED","Attendance has been finalized");
      required(
        await query("DELETE FROM attendance WHERE id=$1 RETURNING id", [id]),
      );
      await audit(u, "delete", "attendance", id);
      return { status: 200, data: { id } };
    }
    if (r.method === "PUT") {
      allow(u.role, managers);
      uuid.parse(id);
      await authorizedRecord(u,"attendance",id);
      const [check]=await query("SELECT s.attendance_finalized_at FROM attendance a JOIN services s ON s.id=a.service_id WHERE a.id=$1",[id]);
      if(check?.attendance_finalized_at) throw new ApiError(409,"SERVICE_FINALIZED","Attendance has been finalized");
      const v = z
        .object({ status: z.enum(["present", "absent", "excused"]) })
        .parse(b);
      return {
        status: 200,
        data: required(
          await query(
            "UPDATE attendance SET status=$2 WHERE id=$1 RETURNING *",
            [id, v.status],
          ),
        ),
      };
    }
    if (r.method === "POST") {
      const scan = id === "scan";
      const v = scan ? schemas.scan.parse(b) : schemas.attendance.parse(b);
      const client = await (await db()).connect();
      try {
        await client.query("BEGIN");
        const member = required(
          (
            await client.query(
              scan
                ? "SELECT id,first_name,last_name,district_id FROM members WHERE qr_token=$1 AND status='active' AND deleted_at IS NULL FOR SHARE"
                : "SELECT id,first_name,last_name,district_id FROM members WHERE id=$1 AND status='active' AND deleted_at IS NULL FOR SHARE",
              [
                scan
                  ? (v as { token: string }).token
                  : (v as { member_id: string }).member_id,
              ],
            )
          ).rows,
          "Active member",
        );
        const service = required(
          (
            await client.query(
              "SELECT * FROM services WHERE id=$1 AND status<>'cancelled' AND deleted_at IS NULL FOR SHARE",
              [v.service_id],
            )
          ).rows,
          "Service",
        );
        if (!member.district_id || member.district_id !== service.district_id)
          throw new ApiError(409,"DISTRICT_MISMATCH","Member and service districts do not match");
        if (!isAreaAdmin(u) && member.district_id !== districtFor(u))
          throw new ApiError(403,"DISTRICT_FORBIDDEN","Cannot record attendance for another district");
        if (service.attendance_finalized_at) throw new ApiError(409,"SERVICE_FINALIZED","Attendance has been finalized");
        const status = scan ? "present" : (v as { status: string }).status;
        const method = scan
          ? "QR_SCAN"
          : (v as { attendance_method: string }).attendance_method;
        const row = (
          await client.query(
            "INSERT INTO attendance(member_id,service_id,status,attendance_method,created_by,district_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
            [member.id, v.service_id, status, method, u.id, member.district_id],
          )
        ).rows[0];
        await client.query("COMMIT");
        return {
          status: 201,
          data: {
            ...row,
            member_name: member.first_name + " " + member.last_name,
            service_name: service.name,
          },
        };
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }
  }
  throw new ApiError(404, "NOT_FOUND", "Endpoint was not found");
}
