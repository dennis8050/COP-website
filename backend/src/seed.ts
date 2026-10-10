import bcrypt from "bcryptjs";
import { db } from "./database.js";
if (process.env.NODE_ENV !== "development" || process.env.AUTH_MODE !== "local")
  throw new Error("Seeds are development-only");
if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 12)
  throw new Error("Set DEMO_PASSWORD of at least 12 characters");
const c = await (await db()).connect();
try {
  await c.query("BEGIN");
  const hash = await bcrypt.hash(process.env.DEMO_PASSWORD, 12);
  let admin = "";
  for (const [name, email, role] of [
    ["Demo Administrator", "admin@example.test", "ADMIN"],
    ["Demo Pastor", "pastor@example.test", "PASTOR"],
    ["Demo Staff One", "staff1@example.test", "STAFF"],
    ["Demo Staff Two", "staff2@example.test", "STAFF"],
  ]) {
    const r = await c.query(
      "INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET password_hash=$4 RETURNING id",
      [name, email, role, hash],
    );
    if (role === "ADMIN") admin = r.rows[0].id;
  }
  const ministries = [];
  for (const name of [
    "Youth",
    "Men’s Ministry",
    "Women’s Ministry",
    "Children",
    "Music",
    "Prayer",
  ])
    ministries.push(
      (
        await c.query(
          "INSERT INTO ministries(name,description) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET name=$1 RETURNING id",
          [name, "Faith and fellowship through " + name],
        )
      ).rows[0].id,
    );
  for (let i = 0; i < 20; i++) {
    const email = `member${i + 1}@example.test`;
    const u = (
      await c.query(
        "INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,'MEMBER',$3) ON CONFLICT(email) DO UPDATE SET password_hash=$3 RETURNING id",
        ["Demo Member " + (i + 1), email, hash],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO members(user_id,first_name,last_name,email,membership_date,ministry_id) VALUES($1,$2,$3,$4,current_date-180,$5) ON CONFLICT(user_id) DO NOTHING",
      [
        u.id,
        ["Alex", "Jordan", "Morgan", "Taylor", "Casey"][i % 5],
        "Example " + (i + 1),
        email,
        ministries[i % 6],
      ],
    );
  }
  const members = (
    await c.query("SELECT id FROM members ORDER BY last_name LIMIT 20")
  ).rows;
  for (let n = 0; n < 8; n++) {
    const service = (
      await c.query(
        "INSERT INTO services(name,date,start_time,end_time,location,status) VALUES('Sunday Worship',current_date-($1::int*7),'09:00','11:00','Main Sanctuary','completed') RETURNING id",
        [n],
      )
    ).rows[0];
    for (let i = 0; i < members.length; i++)
      await c.query(
        "INSERT INTO attendance(member_id,service_id,status,attendance_method,created_by) VALUES($1,$2,$3,'MANUAL',$4) ON CONFLICT DO NOTHING",
        [
          members[i].id,
          service.id,
          i % 7 === n % 7 ? "absent" : "present",
          admin,
        ],
      );
  }
  await c.query(
    "INSERT INTO services(name,date,start_time,end_time,location) VALUES('Sunday Worship',current_date+3,'09:00','11:00','Main Sanctuary')",
  );
  await c.query(
    "INSERT INTO events(name,description,date,start_time,location) VALUES('Community Sunday','A welcoming morning of worship and fellowship.',current_date+10,'09:00','Main Sanctuary'),('Youth Gathering','Connect, learn and grow together.',current_date+15,'18:00','Community Hall')",
  );
  await c.query("COMMIT");
  console.log("Fictional development data created");
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  c.release();
  await (await db()).end();
}
