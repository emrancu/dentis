# Data model (D1 / SQLite)

Times are ISO 8601 UTC unless named `slot` (clinic-local `YYYY-MM-DDTHH:MM`).

| Table | Columns | Purpose |
|---|---|---|
| `settings` | `key` PK, `value` | Clinic profile as key/value |
| `skills` | `id` PK, `title`, `description`, `content`, `enabled`, `updated_at` | Agent knowledge |
| `doctors` | `id` PK, `name_en`, `name_bn`, `specialty`, `days` (JSON array 0=Sun…6=Sat), `start_time`, `end_time`, `active` | Who can be booked |
| `patients` | `id` PK, `full_name`, `phone` UNIQUE, `created_at` | The person behind calls |
| `calls` | `id` PK (uuid), `started_at`, `ended_at`, `duration_s`, `status`, `patient_id` FK, `recording_key`, `summary`, `ip_hash` | One record per call |
| `call_extractions` | `call_id` PK FK, `patient_name`, `phone`, `reason_for_visit`, `preferred_datetime`, `intent`, `outcome`, `notes` | Structured fields |
| `transcript_turns` | `id` PK, `call_id` FK, `idx`, `speaker`, `text_bn`, `text_en`, `ts` | Full transcript |
| `appointments` | `id` PK, `patient_id` FK, `call_id` FK, `doctor_id` FK, `slot`, `service`, `status`, `created_at` | Bookings |
| `callbacks` | `id` PK, `call_id` FK, `name`, `phone`, `reason`, `preferred_time`, `status`, `created_at` | Human follow-up requests |

## Rules
- `calls.status`: `in_progress`, `booked`, `rescheduled`, `cancelled`, `enquiry`, `follow_up_needed`, `incomplete`, `failed`.
- `call_extractions.outcome`: `booked`, `rescheduled`, `cancelled`, `callback_needed`, or null.
- Status is derived when the call finishes: outcome first, then callback intent, then `incomplete` if the patient spoke fewer than 2 turns, else `enquiry`. `failed` when the call errored with no patient speech. A call still `in_progress` after 30 minutes becomes `incomplete`.
- `appointments.status`: `booked`, `cancelled`, `completed`. One active appointment per doctor and slot.
- `transcript_turns.speaker`: `agent` or `patient`. `text_en` is filled after the call by the analyzer.
- `patients.phone` is unique and normalised to `01XXXXXXXXX`.
- `callbacks.status`: `open` or `resolved`.
- Recordings live in R2 under `calls/<call_id>.<ext>`; the key is in `calls.recording_key`.
