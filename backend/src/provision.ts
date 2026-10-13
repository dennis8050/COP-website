import { db } from "./database.js";
// Cognito invokes this only after a verified signup; self-service accounts are always MEMBER.
export async function handler(event: {
  triggerSource: string;
  userName: string;
  request: { userAttributes: Record<string, string> };
}) {
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") return event;
  const a = event.request.userAttributes;
  const c = await (await db()).connect();
  try {
    await c.query("BEGIN");
    const result = await c.query(
      "INSERT INTO users(cognito_sub,email,name,role) VALUES($1,$2,$3,'MEMBER') ON CONFLICT(cognito_sub) DO UPDATE SET email=EXCLUDED.email RETURNING id",
      [a.sub, a.email, (a.name || "Church Member").slice(0, 150)],
    );
    const names = (a.name || "Church Member").split(" ");
    const existingMember = await c.query(
      "SELECT id,district_id FROM members WHERE lower(email)=lower($1) AND user_id IS NULL AND deleted_at IS NULL ORDER BY created_at LIMIT 1 FOR UPDATE",
      [a.email],
    );
    if (existingMember.rowCount) {
      await c.query("UPDATE members SET user_id=$1 WHERE id=$2", [result.rows[0].id, existingMember.rows[0].id]);
      // Pre-registered users receive their existing administrator-approved district.
      await c.query("UPDATE users SET district_id=$2 WHERE id=$1 AND role='MEMBER'",[result.rows[0].id,existingMember.rows[0].district_id]);
    } else
      await c.query(
        "INSERT INTO members(user_id,first_name,last_name,email) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO NOTHING",
        [
          result.rows[0].id,
          names[0],
          names.slice(1).join(" ") || "Member",
          a.email,
        ],
      );
    await c.query("COMMIT");
    return event;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
