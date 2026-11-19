# Agent tools

The brain (an OpenAI mini chat model) calls these while it answers a turn. `POST /api/agent/turn` runs them on the server, and `POST /api/agent/tools/:name` with `{ call_id, args }` runs one directly. Results are always HTTP 200:

- success: `{ "ok": true, … }`
- failure: `{ "ok": false, "error": "<code>", "message": "<what the agent should do>", … }`

Dates are `YYYY-MM-DD`, times are 24-hour `HH:MM`, clinic-local. Phone numbers may be in Bangla or English digits and are normalised to `01XXXXXXXXX`. `phone_spoken` is the one standard way to say a number aloud: English digit words in groups (`zero one seven, one two three four, five six seven eight`). The agent saves the number with `save_patient_details` as soon as it has it and reads back `phone_spoken`, so the digits are never spoken in Bangla and a wrong number is caught at once.

| Tool | Args | Success fields | Failure codes |
|---|---|---|---|
| `get_current_datetime` | | `date, time, weekday_en, weekday_bn` | |
| `get_clinic_info` | | `name_en, name_bn, phone, phone_spoken, address, address_bn, directions, directions_bn, hours, hours_bn` | |
| `list_doctors` | | `doctors: [{name_en,name_bn,specialty,specialty_bn,degree,degree_bn,gender,experience_years,days,start_time,end_time}]` | |
| `get_skill` | `title` (exact, case-insensitive, one of the titles listed in the prompt) | `found: true, skill: {title,content}` | `skill_not_found` (pick a title from the prompt, or hand over to a human) |
| `check_availability` | `date`, `doctor_name?`, `period?` (`morning`, `afternoon`, `evening`) | `date, weekday_bn, slots: [{time,doctor_name_en,doctor_name_bn}]` (max 8) | `date_invalid`, `doctor_not_found` |
| `book_appointment` | `patient_name`, `phone`, `date`, `time`, `reason?` (only if the caller said it), `doctor_name?` | `appointment_id, slot, weekday_bn, doctor_name_en, doctor_name_bn, patient_name, phone_spoken` | `name_invalid`, `phone_invalid`, `date_invalid`, `time_invalid`, `slot_in_past`, `slot_too_far`, `doctor_not_found`, `slot_unavailable` (with `alternatives`) |
| `reschedule_appointment` | `phone`, `new_date`, `new_time`, `old_date?`, `doctor_name?` | `appointment_id, slot, weekday_bn, doctor_name_en, doctor_name_bn` | `phone_invalid`, `appointment_not_found`, `appointment_ambiguous` (with `appointments`), `slot_unavailable` and the date and time codes |
| `cancel_appointment` | `phone`, `date?` | `appointment_id, slot, weekday_bn` | `phone_invalid`, `appointment_not_found`, `appointment_ambiguous` |
| `save_patient_details` | `patient_name?`, `phone?`, `reason?`, `preferred_datetime_text?`, `intent?`, `notes?` | `saved: [field names]`, and `phone_spoken` when a phone was saved | `phone_invalid`, `name_invalid` |
| `request_human_callback` | `name`, `phone`, `reason` (clear English for staff), `preferred_time?`, `urgent?` (true for emergencies, swelling, bleeding, accidents, an upset caller) | `callback_id, phone_spoken` | `phone_invalid`, `name_invalid` |
| `end_call` | | `ok` only. The turn ends with an `end_call` event, the browser speaks the scripted closing line and hangs up | |

`intent` values: `booking`, `reschedule`, `cancel`, `enquiry`, `callback`, `other`.

Only enabled skills are visible to `get_skill`.

Effects on the call: a booking, reschedule, cancel or callback sets the call's `outcome` in its extraction (see [data-model](data-model.md)). Unknown tool: HTTP 404 `unknown_tool`.
