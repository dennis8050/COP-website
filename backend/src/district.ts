import { z } from "zod";
import { User } from "./auth.js";
import { query } from "./database.js";
import { ApiError } from "./errors.js";
export const districtId = z.enum(["peel-piwc","triumph-piwc","brampton-bolton","innisfil","mississauga-ontario","georgetown","oakville"]);
export const isAreaAdmin = (u: User) => u.role === "ADMIN";
export function districtFor(u: User, selected?: string): string | null {
  if (isAreaAdmin(u)) return selected ? districtId.parse(selected) : null;
  if (!u.district_id) throw new ApiError(403,"DISTRICT_UNASSIGNED","Your account needs a district assignment. Contact your administrator.");
  if (selected && selected !== u.district_id) throw new ApiError(403,"DISTRICT_FORBIDDEN","You are not assigned to the selected district");
  return u.district_id;
}
export async function authorizedRecord(u: User, table: "members"|"services"|"events"|"ministries"|"attendance", id: string) {
  const [record] = await query<{district_id:string|null}>(`SELECT district_id FROM ${table} WHERE id=$1`,[id]);
  if (!record) throw new ApiError(404,"NOT_FOUND","Record not found");
  if (!isAreaAdmin(u) && record.district_id !== districtFor(u)) throw new ApiError(404,"NOT_FOUND","Record not found");
  return record;
}
export async function existingDistrict(id: string) {
  const [d] = await query("SELECT id FROM districts WHERE id=$1 AND active=true",[districtId.parse(id)]);
  if (!d) throw new ApiError(400,"UNKNOWN_DISTRICT","Choose an active district");
  return id;
}
