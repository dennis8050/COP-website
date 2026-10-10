import { CognitoJwtVerifier } from "aws-jwt-verify";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { query } from "./database.js";
import { ApiError } from "./errors.js";
export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};
const local = process.env.AUTH_MODE === "local";
if (
  local &&
  process.env.NODE_ENV !== "development" &&
  process.env.NODE_ENV !== "test"
)
  throw new Error("Local authentication is restricted to development/test");
function key() {
  const s = process.env.LOCAL_JWT_SECRET;
  if (!s || s.length < 32)
    throw new Error("LOCAL_JWT_SECRET requires 32 characters");
  return new TextEncoder().encode(s);
}
const verifier = !local
  ? CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      tokenUse: "access",
      clientId: process.env.COGNITO_CLIENT_ID!,
    })
  : null;
export async function authenticate(header?: string): Promise<User> {
  if (!header?.startsWith("Bearer "))
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in");
  let sub: string;
  try {
    sub = local
      ? String(
          (
            await jwtVerify(header.slice(7), key(), {
              issuer: "church-local",
              audience: "church-api",
            })
          ).payload.sub,
        )
      : (await verifier!.verify(header.slice(7))).sub;
  } catch {
    throw new ApiError(401, "INVALID_TOKEN", "Your session has expired");
  }
  const rows = await query<User>(
    local
      ? "SELECT id,name,email,role,status FROM users WHERE id=$1"
      : "SELECT id,name,email,role,status FROM users WHERE cognito_sub=$1",
    [sub],
  );
  if (!rows[0] || rows[0].status !== "active")
    throw new ApiError(403, "ACCOUNT_INACTIVE", "Your account is not active");
  return rows[0];
}
export async function localLogin(email: string, password: string) {
  if (!local)
    throw new ApiError(404, "NOT_FOUND", "Use Cognito authentication");
  const [u] = await query(
    "SELECT * FROM users WHERE email=$1 AND status='active'",
    [email.toLowerCase()],
  );
  if (!u?.password_hash || !(await bcrypt.compare(password, u.password_hash)))
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect",
    );
  await query("UPDATE users SET last_login=now() WHERE id=$1", [u.id]);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(u.id)
    .setIssuer("church-local")
    .setAudience("church-api")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key());
  return {
    token,
    user: { id: u.id, name: u.name, email: u.email, role: u.role },
  };
}
