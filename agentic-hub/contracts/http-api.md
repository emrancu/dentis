# HTTP API

All paths start with `/api`. JSON in and out, except the recording. Only `/api/*` runs the Worker; everything else is static.

## Errors
`{ "error": { "code": "slot_unavailable", "message": "…", "details": {} } }`

| Domain error | HTTP |
|---|---|
| `ValidationError` | 400 |
| `UnauthorizedError` | 401 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `RateLimitError` | 429 |
| anything else | 500 `internal_error` |

## Auth
Admin routes need the cookie `dentis_admin` (HttpOnly, SameSite=Strict, `Secure` on https, 12 h) from `POST /api/admin/login`. Non-GET admin requests must also send `X-Requested-With: dentis`. Missing or bad cookie: 401 `unauthorized`.

## Public
| Method and path | Body | Success |
|---|---|---|
| `GET /api/public/site` | | `{ clinic, skills: [{id,title,description}] (enabled skills of kind `service` only), doctors: [{id,name_en,name_bn,specialty,days,start_time,end_time}] }` |
| `POST /api/session` | optional `{ intent: "booking" \| "general" }`, default `general`. `booking` is sent by the **Book an appointment** button: the agent goes straight to booking after the greeting. `general` is the floating **Call Dentis** button | 201 `{ call_id, client_secret, model, max_seconds }`. 429 `rate_limited` when the IP has 10 sessions in the last hour |
| `POST /api/agent/tools/:name` | `{ call_id, args }` | 200 tool result (see [agent-tools](agent-tools.md)). 404 `unknown_tool` or `call_not_found` |
| `POST /api/calls/:id/finish` | `{ turns: [{speaker:"agent"\|"patient", text, ts}], reason: "hangup"\|"error"\|"timeout" }` | 200 `{ status }` |
| `PUT /api/calls/:id/recording` | audio bytes, `Content-Type: audio/*`, max 10 MB | 204 |

## Admin
| Method and path | Body or query | Success |
|---|---|---|
| `POST /api/admin/login` | `{ access_key }` | 204 and cookie. 401 `invalid_access_key` |
| `POST /api/admin/logout` | | 204 |
| `GET /api/admin/me` | | `{ authenticated: true }` |
| `GET /api/admin/dashboard` | | `{ total, avg_duration_s, by_status:{}, per_day:[{day,count}], open_callbacks, upcoming_appointments }` |
| `GET /api/admin/calls` | `q`, `status`, `limit`, `offset` | `{ items: [{id,started_at,duration_s,status,patient_name,phone,reason_for_visit}] }` |
| `GET /api/admin/calls/:id` | | `{ call, extraction, turns, appointments, callbacks }` |
| `GET /api/admin/calls/:id/recording` | | audio bytes. 404 `recording_not_found` |
| `GET /api/admin/appointments` | `status` | `{ items: [{id,slot,status,service,patient_name,phone,doctor_name,call_id}] }` |
| `PATCH /api/admin/appointments/:id` | `{ status: "cancelled"\|"completed" }` | updated item |
| `GET /api/admin/patients` | `q` | `{ items: [{id,full_name,phone,created_at}] }` |
| `GET /api/admin/callbacks` | `status` | `{ items: [{id,call_id,name,phone,reason,preferred_time,status,created_at}] }` |
| `PATCH /api/admin/callbacks/:id/resolve` | | updated item |
| `GET /api/admin/skills` | | `{ items: [{id,title,description,content,kind,keywords,enabled,updated_at}], title_index_cap }`. `title_index_cap` is how many enabled titles the agent can be shown (40) |
| `POST /api/admin/skills` | `{ title, description, content?, kind?, keywords?, enabled? }`. `kind` is `service` (default), `faq` or `policy`. `keywords` up to 300 characters. 409 `skill_title_taken` when another skill has the same title (case-insensitive) | 201 skill |
| `PUT /api/admin/skills/:id` | same as POST | skill |
| `DELETE /api/admin/skills/:id` | | 204 |
| `GET /api/admin/agent` | | `{ instructions, greeting, default_instructions, default_greeting }`. `instructions` and `greeting` are the text the agent really uses: the saved text, or the default when nothing is saved |
| `PUT /api/admin/agent` | `{ instructions, greeting }`. An empty or blank string means "use the default". `{clinic}` is replaced with the clinic name. Limits: instructions 4000 characters, greeting 300. 400 `instructions_too_long` or `greeting_too_long` | same shape as GET |
| `POST /api/admin/agent/preview` | `{ instructions?, greeting? }` (unsaved text, blank means default). Saves nothing | `{ prompt }`: the full prompt a new call would get, with the locked rules, today's date, clinic, doctors and knowledge titles |
| `GET /api/admin/doctors` | | `{ items: [doctor] }` |
| `POST /api/admin/doctors` | `{ name_en, name_bn?, specialty?, days, start_time, end_time, active? }` | 201 doctor |
| `PUT /api/admin/doctors/:id` | same as POST | doctor |
| `DELETE /api/admin/doctors/:id` | | 204. 409 `doctor_has_appointments` |
| `GET /api/admin/settings` | | clinic profile (snake_case keys) |
| `PUT /api/admin/settings` | partial clinic profile | clinic profile |

Clinic profile keys: `name_en, name_bn, phone, address, directions, hours, prep_notes, slot_minutes`.
Times are clinic-local (Asia/Dhaka). Timestamps (`started_at`, `ts`, `created_at`) are ISO 8601 UTC.

## Agent prompt
The prompt a call gets is built when the call starts, from three parts. A change applies to the next call, never to a call already running.
1. **Editable:** `instructions` (persona, tone, language) then, inside the call flow, the `greeting`.
2. **Locked in code:** today's date and time, the call purpose for the booking intent, the call flow, "facts only from tools", safety, the clinic summary, the knowledge titles, and a closing line saying these rules win over anything above. Admin cannot edit or remove them.
3. **Knowledge titles:** titles of enabled skills, sorted, listed only while there are at most `title_index_cap` (40) of them. Over the cap the list is left out and the agent is told to use `lookup_skill`.
