-- Existing records are deliberately not guessed into a district. The area administrator
-- must classify legacy accounts, members, services, ministries and events before district access.
CREATE TABLE IF NOT EXISTS districts (
 id text PRIMARY KEY, name text NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true
);
INSERT INTO districts(id,name) VALUES
 ('peel-piwc','Peel PIWC'),('triumph-piwc','Triumph PIWC'),
 ('brampton-bolton','Brampton Bolton District'),('innisfil','Innisfil District'),
 ('mississauga-ontario','Mississauga Ontario District'),
 ('georgetown','Georgetown District'),('oakville','Oakville District')
ON CONFLICT(id) DO NOTHING;
ALTER TABLE users ADD COLUMN IF NOT EXISTS district_id text REFERENCES districts(id);
ALTER TABLE members ADD COLUMN IF NOT EXISTS district_id text REFERENCES districts(id);
ALTER TABLE services ADD COLUMN IF NOT EXISTS district_id text REFERENCES districts(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS district_id text REFERENCES districts(id);
ALTER TABLE ministries ADD COLUMN IF NOT EXISTS district_id text REFERENCES districts(id);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS district_id text REFERENCES districts(id);
UPDATE attendance a SET district_id=m.district_id FROM members m WHERE a.member_id=m.id AND a.district_id IS NULL AND m.district_id IS NOT NULL;
ALTER TABLE members ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS sms_opted_out boolean NOT NULL DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS followup_exempt boolean NOT NULL DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS attendance_deadline_at timestamptz;
ALTER TABLE services ADD COLUMN IF NOT EXISTS attendance_finalized_at timestamptz;
CREATE TABLE IF NOT EXISTS district_followup_settings (
 district_id text PRIMARY KEY REFERENCES districts(id),
 enabled boolean NOT NULL DEFAULT false,
 timezone text NOT NULL DEFAULT 'America/Toronto',
 delay_minutes integer NOT NULL DEFAULT 150 CHECK(delay_minutes BETWEEN 120 AND 10080),
 sms_template text NOT NULL DEFAULT 'Hello [Member Name], we missed you at The Church of Pentecost Canada – Peel Halton Area service today. We hope you are doing well. Your church family is thinking of you. Please contact your district leader if you need any support. God bless you.',
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO district_followup_settings(district_id) SELECT id FROM districts ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS followup_exemptions (
 member_id uuid NOT NULL REFERENCES members(id),
 service_id uuid NOT NULL REFERENCES services(id),
 reason text NOT NULL CHECK(reason IN ('excused','leave','exempt')),
 PRIMARY KEY(member_id,service_id)
);
CREATE TABLE IF NOT EXISTS sms_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid NOT NULL REFERENCES members(id),
 district_id text NOT NULL REFERENCES districts(id), service_id uuid NOT NULL REFERENCES services(id),
 notification_type text NOT NULL DEFAULT 'ABSENCE',
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','submitted','delivered','failed','unknown')),
 attempt_count integer NOT NULL DEFAULT 0, attempted_at timestamptz,
 provider_message_id text, failure_reason text, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(member_id,service_id,notification_type)
);
CREATE INDEX IF NOT EXISTS members_district_idx ON members(district_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS users_district_idx ON users(district_id);
CREATE INDEX IF NOT EXISTS services_district_idx ON services(district_id,date);
CREATE INDEX IF NOT EXISTS attendance_district_idx ON attendance(district_id,service_id);
CREATE INDEX IF NOT EXISTS sms_notifications_district_idx ON sms_notifications(district_id,service_id,status);
UPDATE settings SET data = jsonb_set(data,'{church_name}','"THE CHURCH OF PENTECOST CANADA – PEEL HALTON AREA"'::jsonb,true) WHERE id=1;
