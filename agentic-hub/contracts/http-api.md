# HTTP API

All paths start with `/api`. JSON in and out. Only `/api/*` runs the Worker; everything else is static.

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

## Home page
| Method and path | Notes |
|---|---|
| `GET /` | The Worker serves `index.html` itself and adds, for the language in `?lang=bn\|en` (default `bn`): `<html lang>`, title, description, canonical and `hreflang` links (`bn`, `en`, `x-default`), Open Graph and Twitter tags with an absolute `/og.png`, and `Dentist` JSON-LD built from the public clinic profile (`name`, `alternateName`, `url`, `image`, `telephone`, `address`, `openingHours` as text, `availableLanguage`). `Cache-Control: public, max-age=300`. If the clinic data cannot be read the page is still served, without JSON-LD. Every other path is a plain static asset. |

## Public
| Method and path | Body | Success |
|---|---|---|
| `GET /api/public/site` | | `{ clinic, doctors: [{id,name_en,name_bn,specialty,specialty_bn,days,start_time,end_time}] }`. The Bangla fields are empty strings when not set; the page then falls back to the English field |
| `POST /api/session` | optional `{ intent: "booking" \| "general" }`, default `general`. `booking` is sent by the **Book an appointment** button: the agent goes straight to booking after the greeting. `general` is the floating **Call Dentis** button | 201 `{ call_id, client_secret, model, max_seconds }`. 429 `rate_limited` when the IP has 10 sessions in the last hour |
| `POST /api/agent/tools/:name` | `{ call_id, args }` | 200 tool result (see [agent-tools](agent-tools.md)). 404 `unknown_tool` or `call_not_found` |
| `POST /api/calls/:id/finish` | `{ turns: [{speaker:"agent"\|"patient", text, ts}], reason: "hangup"\|"error"\|"timeout" }` | 200 `{ status }` |

## Admin
| Method and path | Body or query | Success |
|---|---|---|
| `POST /api/admin/login` | `{ access_key }` | 204 and cookie. 401 `invalid_access_key` |
| `POST /api/admin/logout` | | 204 |
| `GET /api/admin/me` | | `{ authenticated: true }` |
| `GET /api/admin/dashboard` | | `{ total, avg_duration_s, by_status:{}, per_day:[{day,count}], open_callbacks, upcoming_appointments }` |
| `GET /api/admin/calls` | `q`, `status`, `limit`, `offset` | `{ items: [{id,started_at,duration_s,status,patient_name,phone,reason_for_visit}] }` |
| `GET /api/admin/calls/:id` | | `{ call, extraction, turns, appointments, callbacks }` |
| `GET /api/admin/appointments` | `status` | `{ items: [{id,slot,status,service,patient_name,phone,doctor_id,doctor_name,call_id}] }` |
| `PATCH /api/admin/appointments/:id` | `{ status: "cancelled"\|"completed" }` | updated item |
| `GET /api/admin/patients` | `q` | `{ items: [{id,full_name,phone,created_at}] }` |
| `GET /api/admin/callbacks` | `status` | `{ items: [{id,call_id,name,phone,reason,preferred_time,urgent,status,created_at}] }`. Open items first, urgent first, newest first. |
| `PATCH /api/admin/callbacks/:id/resolve` | | updated item |
| `GET /api/admin/skills` | | `{ items: [{id,title,description,content,kind,enabled,updated_at}] }` |
| `POST /api/admin/skills` | `{ title, description, content?, kind?, enabled? }`. Text can be English or Bangla. `kind` is `service` (default), `faq` or `policy`. 409 `skill_title_taken` when another skill has the same title (case-insensitive) | 201 skill |
| `PUT /api/admin/skills/:id` | same as POST | skill |
| `DELETE /api/admin/skills/:id` | | 204 |
| `GET /api/admin/agent` | | `{ instructions, greeting, closing, default_instructions, default_greeting, default_closing }`. `instructions`, `greeting` and `closing` are the text the agent really uses: the saved text, or the default when nothing is saved. `{clinic}` is left in so staff edit the template |
| `PUT /api/admin/agent` | `{ instructions, greeting, closing }`. An empty or blank string means "use the default". `{clinic}` is replaced with the clinic name. Limits: instructions 4000 characters, greeting 300. 400 `instructions_too_long` or `greeting_too_long` | same shape as GET |
| `POST /api/admin/agent/preview` | `{ instructions?, greeting?, closing? }` (unsaved text, blank means default). Saves nothing | `{ prompt }`: the full prompt a new call would get, with the locked rules, today's date, clinic, doctors and knowledge titles |
| `GET /api/admin/doctors` | | `{ items: [doctor] }` |
| `POST /api/admin/doctors` | `{ name_en, name_bn?, specialty?, specialty_bn?, days, start_time, end_time, active? }` | 201 doctor |
| `PUT /api/admin/doctors/:id` | same as POST | doctor |
| `DELETE /api/admin/doctors/:id` | | 204. 409 `doctor_has_appointments` |
| `GET /api/admin/settings` | | clinic profile (snake_case keys) |
| `PUT /api/admin/settings` | partial clinic profile | clinic profile |

Clinic profile keys: `name_en, name_bn, phone, address, address_bn, directions, directions_bn, hours, hours_bn, slot_minutes`. The `_bn` keys hold the Bangla text of the field next to them. Each English field holds English only and each Bangla field Bangla only, so no string mixes the two languages.
Times are clinic-local (Asia/Dhaka). Timestamps (`started_at`, `ts`, `created_at`) are ISO 8601 UTC.

## Agent prompt
The prompt a call gets is built when the call starts, from three parts. A change applies to the next call, never to a call already running.
1. **Editable:** `instructions` (persona, tone, language) then, inside the call flow, the `greeting` and the `closing`. The browser speaks both word for word: `POST /api/session` returns them (`greeting`, `closing`, `{clinic}` filled in). The closing is spoken after the model calls `end_call` and its own reply is done, then the call hangs up. The model is told not to say goodbye itself.
2. **Locked in code:** today's date and time, the call purpose for the booking intent, the call flow, "facts only from tools", safety, the clinic summary, the knowledge titles, and a closing line saying these rules win over anything above. Admin cannot edit or remove them.
3. **Knowledge titles:** titles of every enabled skill, sorted. No cap. The agent picks the ones it needs and fetches them with `get_skill`.

## Language rules for content
- Every visible piece of clinic content has an English and a Bangla field. The website shows the field for the visitor's language and uses the other one only when it is empty.
- Times are clinic-local `HH:MM` in the API. The website shows them 12-hour: `10:00 am` in English and `সকাল ১০:০০` in Bangla, with Bangla digits in the Bangla page. Day lists are shown as a range when consecutive (`Sat–Thu`, `শনি–বৃহ`).
- The site accepts `?lang=bn` and `?lang=en` and uses it before any saved choice.
