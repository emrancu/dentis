/**
 * Ports: the shapes the application layer needs from the outside world.
 * Adapters in `infrastructure/` implement them; tests use in-memory versions from `test/support`.
 * (Documentation only, nothing here is executed.)
 *
 * @typedef {object} CallRepository
 * @property {(call) => Promise<void>} create
 * @property {(id: string) => Promise<object|null>} findById
 * @property {(call) => Promise<void>} save
 * @property {(q: {q?: string, status?: string, limit: number, offset: number}) => Promise<{call: object, extraction: object|null}[]>} list
 * @property {(ipHash: string, sinceIso: string) => Promise<number>} countRecentByIp
 * @property {(cutoffIso: string, nowIso: string) => Promise<void>} expireStale  in_progress calls started before cutoff become incomplete
 * @property {(callId: string, turns: {idx:number,speaker:string,textBn:string,textEn:string|null,ts:string}[]) => Promise<void>} saveTurns  replaces all turns
 * @property {(callId: string) => Promise<object[]>} getTurns
 * @property {(callId: string, fields: object) => Promise<void>} mergeExtraction  sets only the fields that are not undefined
 * @property {(callId: string) => Promise<object|null>} getExtraction
 * @property {(sinceIso: string) => Promise<{total:number, avgDurationS:number, byStatus:object, perDay:{day:string,count:number}[]}>} stats
 *
 * @typedef {object} PatientRepository
 * @property {(phone: string) => Promise<object|null>} findByPhone
 * @property {(id: number) => Promise<object|null>} findById
 * @property {(ids: number[]) => Promise<object[]>} findManyByIds
 * @property {(patient) => Promise<object>} insert  returns the patient with its id
 * @property {(q?: string) => Promise<object[]>} list
 *
 * @typedef {object} AppointmentRepository
 * @property {(appointment) => Promise<object>} insert
 * @property {(id: number) => Promise<object|null>} findById
 * @property {(appointment) => Promise<void>} save
 * @property {(date: string) => Promise<object[]>} listOnDate  every status
 * @property {(patientId: number) => Promise<object[]>} listForPatient
 * @property {(callId: string) => Promise<object[]>} listForCall
 * @property {(status?: string) => Promise<object[]>} list
 * @property {(doctorId: number) => Promise<number>} countForDoctor
 * @property {(fromSlot: string) => Promise<number>} countUpcoming
 *
 * @typedef {object} DoctorRepository
 * @property {() => Promise<object[]>} list
 * @property {(id: number) => Promise<object|null>} findById
 * @property {(doctor) => Promise<object>} insert
 * @property {(doctor) => Promise<void>} save
 * @property {(id: number) => Promise<void>} remove
 *
 * @typedef {object} SkillRepository
 * @property {() => Promise<object[]>} list
 * @property {(id: number) => Promise<object|null>} findById
 * @property {(skill) => Promise<object>} insert
 * @property {(skill) => Promise<void>} save
 * @property {(id: number) => Promise<void>} remove
 *
 * @typedef {object} SettingsRepository
 * @property {() => Promise<Record<string,string>>} all
 * @property {(map: Record<string,string>) => Promise<void>} setMany
 *
 * @typedef {object} CallbackRepository
 * @property {(callback) => Promise<object>} insert
 * @property {(id: number) => Promise<object|null>} findById
 * @property {(callback) => Promise<void>} save
 * @property {(status?: string) => Promise<object[]>} list
 * @property {(callId: string) => Promise<object[]>} listForCall
 * @property {() => Promise<number>} countOpen
 *
 * @typedef {object} RecordingStore
 * @property {(key: string, body: ArrayBuffer, contentType: string) => Promise<void>} put
 * @property {(key: string) => Promise<{body: ReadableStream|ArrayBuffer, contentType: string}|null>} get
 *
 * @typedef {object} RealtimeGateway
 * @property {(session: {instructions: string, tools: object[]}) => Promise<{value: string, model: string}>} createClientSecret
 *
 * @typedef {object} CallAnalyzer
 * @property {(input: {turns: object[]}) => Promise<{summary: string, english: string[], extraction: object}>} analyze
 *
 * @typedef {object} Security
 * @property {(data: string) => Promise<string>} hmac
 * @property {(data: string) => Promise<string>} sha256
 * @property {(a: string, b: string) => Promise<boolean>} safeEqual
 *
 * @typedef {{ now(): Date }} Clock
 */
export {};
