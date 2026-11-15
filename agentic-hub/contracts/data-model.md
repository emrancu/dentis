# Data model (D1 / SQLite)

Times are ISO 8601 UTC unless named `slot` (clinic-local `YYYY-MM-DDTHH:MM`).

| Table | Columns | Purpose |
|---|---|---|
| `settings` | `key` PK, `value` | Clinic profile and agent prompt as key/value |
| `skills` | `id` PK, `title`, `description`, `content`, `kind`, `enabled`, `updated_at` | Agent knowledge, for the agent only. Staff write it in English or Bangla, one plain form with no language fields |
| `doctors` | `id` PK, `name_en`, `name_bn`, `specialty`, `specialty_bn`, `days` (JSON array 0=Sun…6=Sat), `start_time`, `end_time`, `active` | Who can be booked |
| `patients` | `id` PK, `full_name`, `phone` UNIQUE, `created_at` | The person behind calls |
| `calls` | `id` PK (uuid), `started_at`, `ended_at`, `duration_s`, `status`, `patient_id` FK, `summary`, `ip_hash` | One record per call |
| `call_extractions` | `call_id` PK FK, `patient_name`, `phone`, `reason_for_visit`, `preferred_datetime`, `intent`, `outcome`, `notes` | Structured fields |
| `transcript_turns` | `id` PK, `call_id` FK, `idx`, `speaker`, `text_bn`, `text_en`, `ts` | Full transcript |
| `appointments` | `id` PK, `patient_id` FK, `call_id` FK, `doctor_id` FK, `slot`, `service`, `status`, `created_at` | Bookings |
| `callbacks` | `id` PK, `call_id` FK, `name`, `phone`, `reason`, `preferred_time`, `urgent`, `status`, `created_at` | Human follow-up requests |

## Rules
- `calls.status`: `in_progress`, `booked`, `rescheduled`, `cancelled`, `enquiry`, `follow_up_needed`, `incomplete`, `failed`.
- `call_extractions.outcome`: `booked`, `rescheduled`, `cancelled`, `callback_needed`, or null.
- Status is derived when the call finishes: outcome first, then callback intent, then `incomplete` if the patient spoke fewer than 2 turns, else `enquiry`. `failed` when the call errored with no patient speech. A call still `in_progress` after 30 minutes becomes `incomplete`.
- `appointments.status`: `booked`, `cancelled`, `completed`. One active appointment per doctor and slot.
- `transcript_turns.speaker`: `agent` or `patient`. `text_en` and `calls.summary` are no longer written (there is no post-call analysis). The columns stay for old rows.
- `patients.phone` is unique and normalised to `01XXXXXXXXX`.
- `callbacks.status`: `open` or `resolved`.
- No audio is stored. `calls.recording_key` is an unused column left from the old recording feature; nothing reads or writes it.
- `skills.kind`: `service`, `faq` or `policy`. All are agent only. Default `service`.
- `skills.title` is unique ignoring case (checked by the application).
- `settings` keys for the agent: `agent_instructions` (up to 4000 characters) `agent_greeting` (up to 300) and `agent_closing` (up to 300). An empty value means "use the default text in code".
- Schema changes are numbered files in `migrations/`, applied once and tracked with `wrangler d1 migrations apply`. The optional sample calls live in `seed/` and are not a migration.
- `doctors.specialty_bn` defaults to an empty string.
- The clinic profile settings keys gain `address_bn`, `hours_bn`, `directions_bn`. (`prep_notes` and `prep_notes_bn` were removed; old rows are ignored.)
