# Agent tools

The voice model calls these through the browser, which posts to `POST /api/agent/tools/:name` with `{ call_id, args }`. Results are always HTTP 200:

- success: `{ "ok": true, … }`
- failure: `{ "ok": false, "error": "<code>", "message": "<what the agent should do>", … }`

Dates are `YYYY-MM-DD`, times are 24-hour `HH:MM`, clinic-local. Phone numbers may be in Bangla or English digits and are normalised to `01XXXXXXXXX`.

| Tool | Args | Success fields | Failure codes |
|---|---|---|---|
| `get_current_datetime` | | `date, time, weekday_en, weekday_bn` | |
| `get_clinic_info` | | `name_en, name_bn, phone, address, address_bn, directions, directions_bn, hours, hours_bn` | |
| `list_doctors` | | `doctors: [{name_en,name_bn,specialty,specialty_bn,days,start_time,end_time}]` | |
| `list_skills` | | `skills: [{title,description}]` | |
| `lookup_skill` | `query` (the caller's words, Bangla or English; matches title, keywords, description and details) | `found, skills: [{title,description,title_bn,description_bn,content}]` (top 3) | |
| `get_skill` | `title` (exact, case-insensitive, one of the titles listed in the prompt) | `found: true, skill: {title,description,title_bn,description_bn,content}` | `skill_not_found` (use `lookup_skill` instead) |
| `check_availability` | `date`, `doctor_name?`, `period?` (`morning`, `afternoon`, `evening`) | `date, weekday_bn, slots: [{time,doctor_name_en,doctor_name_bn}]` (max 8) | `date_invalid`, `doctor_not_found` |
| `book_appointment` | `patient_name`, `phone`, `reason`, `date`, `time`, `doctor_name?` | `appointment_id, slot, doctor_name_en, doctor_name_bn, patient_name, phone_spoken` | `name_invalid`, `phone_invalid`, `date_invalid`, `time_invalid`, `slot_in_past`, `slot_too_far`, `doctor_not_found`, `slot_unavailable` (with `alternatives`) |
| `reschedule_appointment` | `phone`, `new_date`, `new_time`, `old_date?`, `doctor_name?` | `appointment_id, slot, doctor_name_en, doctor_name_bn` | `phone_invalid`, `appointment_not_found`, `appointment_ambiguous` (with `appointments`), `slot_unavailable` and the date and time codes |
| `cancel_appointment` | `phone`, `date?` | `appointment_id, slot` | `phone_invalid`, `appointment_not_found`, `appointment_ambiguous` |
| `save_patient_details` | `patient_name?`, `phone?`, `reason?`, `preferred_datetime_text?`, `intent?`, `notes?` | `saved: [field names]` | `phone_invalid`, `name_invalid` |
| `request_human_callback` | `name`, `phone`, `reason`, `preferred_time?` | `callback_id` | `phone_invalid`, `name_invalid` |
| `end_call` | | `ok` only. The browser hangs up after the agent finishes speaking | |

`intent` values: `booking`, `reschedule`, `cancel`, `enquiry`, `callback`, `other`.

Only enabled skills are visible to `list_skills`, `lookup_skill` and `get_skill`, whatever their kind (`service`, `faq` or `policy`).

Effects on the call: a booking, reschedule, cancel or callback sets the call's `outcome` in its extraction (see [data-model](data-model.md)). Unknown tool: HTTP 404 `unknown_tool`.
