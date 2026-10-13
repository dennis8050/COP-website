import { z } from "zod";
import { districtId } from "./district.js";
const text = z.string().trim().max(500);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);
const optional = text.nullish();
export const schemas = {
  members: z.object({
    first_name: text.min(1),
    last_name: text.min(1),
    email: z.string().email().max(254).nullable().optional(),
    phone: z
      .string()
      .regex(/^[+()\d .-]{7,30}$/)
      .nullable()
      .optional(),
    date_of_birth: date.nullish(),
    gender: optional,
    address: optional,
    emergency_contact: optional,
    membership_date: date.optional(),
    ministry_id: z.string().uuid().nullish(),
    profile_photo: z
      .string()
      .url()
      .refine((v) => v.startsWith("https://"))
      .nullish(),
    status: z.enum(["active", "inactive"]).optional(),
    district_id: districtId.optional(),
    sms_consent: z.boolean().optional(),
    sms_opted_out: z.boolean().optional(),
    followup_exempt: z.boolean().optional(),
  }),
  services: z.object({
    name: text.min(1),
    description: text.optional(),
    date,
    start_time: time,
    end_time: time.nullish(),
    location: text.optional(),
    status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
    district_id: districtId.optional(),
    attendance_deadline_at: z.string().datetime({offset:true}).nullish(),
  }),
  events: z.object({
    name: text.min(1),
    description: z.string().max(5000).optional(),
    date,
    start_time: time,
    end_time: time.nullish(),
    location: text.optional(),
    maximum_capacity: z.number().int().positive().nullish(),
    registration_required: z.boolean().optional(),
    district_id: districtId.optional(),
    image: z
      .string()
      .url()
      .refine((v) => v.startsWith("https://"))
      .nullish(),
  }),
  ministries: z.object({
    name: text.min(1),
    description: text.optional(),
    leader_id: z.string().uuid().nullish(),
    meeting_schedule: text.optional(),
    status: z.enum(["active", "inactive"]).optional(),
    district_id: districtId.optional(),
  }),
  attendance: z.object({
    member_id: z.string().uuid(),
    service_id: z.string().uuid(),
    status: z.enum(["present", "absent", "excused"]).default("present"),
    attendance_method: z.enum(["MANUAL", "ADMIN"]).default("MANUAL"),
  }),
  scan: z.object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    service_id: z.string().uuid(),
  }),
};
export const uuid = z.string().uuid();
export const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
