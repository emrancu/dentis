-- See agentic-hub/contracts/data-model.md
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL DEFAULT '',
  specialty TEXT NOT NULL DEFAULT '',
  days TEXT NOT NULL DEFAULT '[6,0,1,2,3,4]',
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_s INTEGER,
  status TEXT NOT NULL DEFAULT 'in_progress',
  patient_id INTEGER REFERENCES patients(id),
  recording_key TEXT,
  summary TEXT,
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_calls_started ON calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_ip ON calls(ip_hash, started_at);

CREATE TABLE IF NOT EXISTS call_extractions (
  call_id TEXT PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  patient_name TEXT,
  phone TEXT,
  reason_for_visit TEXT,
  preferred_datetime TEXT,
  intent TEXT,
  outcome TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS transcript_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  speaker TEXT NOT NULL,
  text_bn TEXT NOT NULL,
  text_en TEXT,
  ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_turns_call ON transcript_turns(call_id, idx);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  call_id TEXT REFERENCES calls(id),
  doctor_id INTEGER NOT NULL REFERENCES doctors(id),
  slot TEXT NOT NULL,
  service TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'booked',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appt_slot ON appointments(slot);
CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_id);
-- one active appointment per doctor and slot
CREATE UNIQUE INDEX IF NOT EXISTS uq_appt_active_slot ON appointments(doctor_id, slot) WHERE status = 'booked';

CREATE TABLE IF NOT EXISTS callbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT REFERENCES calls(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  reason TEXT NOT NULL,
  preferred_time TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
