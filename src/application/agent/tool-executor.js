import { ConflictError, DomainError, NotFoundError } from '../../domain/shared/errors.js';
import { MAX_CALL_SECONDS } from '../call-records.js';
import { WEEKDAYS_BN, WEEKDAYS_EN, dhakaParts } from '../../domain/shared/time.js';


const TIME_LIMIT_GRACE_SECONDS = 15;

const text = (v) => (v === undefined || v === null ? undefined : String(v));

/**
 * Runs the tool calls the voice model makes. Results follow contracts/agent-tools.md:
 * `{ok:true, …}` or `{ok:false, error, message, …}`. Always returns a result, except for an unknown tool or call.
 */
export class ToolExecutor {
  constructor({ calls, clock, clinic, doctors, knowledge, checkAvailability, bookAppointment, rescheduleAppointment, cancelAppointment, saveCallDetails, requestCallback }) {
    this.calls = calls;
    this.clock = clock;
    this.handlers = {
      get_current_datetime: async () => {
        const n = dhakaParts(clock.now());
        return { date: n.date, time: n.time, weekday_en: WEEKDAYS_EN[n.weekday], weekday_bn: WEEKDAYS_BN[n.weekday] };
      },
      get_clinic_info: async () => {
        const p = await clinic.profile();
        return {
          name_en: p.nameEn,
          name_bn: p.nameBn,
          phone: p.phone,
          address: p.address,
          address_bn: p.addressBn,
          directions: p.directions,
          directions_bn: p.directionsBn,
          hours: p.hours,
          hours_bn: p.hoursBn,
        };
      },
      list_doctors: async () => ({
        doctors: (await doctors.list()).filter((d) => d.active).map((d) => ({ name_en: d.nameEn, name_bn: d.nameBn, specialty: d.specialty, specialty_bn: d.specialtyBn, days: d.days, start_time: d.startTime, end_time: d.endTime })),
      }),
      list_skills: async () => ({ skills: await knowledge.list() }),
      get_skill: (a) => knowledge.get({ title: a.title }),
      lookup_skill: (a) => knowledge.lookup({ query: a.query }),
      check_availability: (a) => checkAvailability.execute({ date: a.date, doctorName: a.doctor_name, period: a.period }),
      book_appointment: (a, callId) =>
        bookAppointment.execute({ callId, patientName: a.patient_name, phone: a.phone, reason: a.reason, date: a.date, time: a.time, doctorName: a.doctor_name }),
      reschedule_appointment: (a, callId) =>
        rescheduleAppointment.execute({ callId, phone: a.phone, newDate: a.new_date, newTime: a.new_time, oldDate: a.old_date, doctorName: a.doctor_name }),
      cancel_appointment: (a, callId) => cancelAppointment.execute({ callId, phone: a.phone, date: a.date }),
      save_patient_details: (a, callId) =>
        saveCallDetails.execute({
          callId,
          patientName: text(a.patient_name),
          phone: text(a.phone),
          reason: text(a.reason),
          preferredDatetimeText: text(a.preferred_datetime_text),
          intent: text(a.intent),
          notes: text(a.notes),
        }),
      request_human_callback: (a, callId) => requestCallback.execute({ callId, name: a.name, phone: a.phone, reason: a.reason, preferredTime: a.preferred_time, urgent: a.urgent === true }),
      end_call: async () => ({}),
    };
  }

  get toolNames() {
    return Object.keys(this.handlers);
  }

  async execute(name, args, callId) {
    const handler = this.handlers[name];
    if (!handler) throw new NotFoundError('unknown_tool', `Unknown tool: ${name}`);
    const call = await this.calls.findById(callId);
    if (!call) throw new NotFoundError('call_not_found', 'Call not found.');
    if (call.isFinished) throw new ConflictError('call_finished', 'This call has ended.');
    // The browser ends the call at the limit. This is the server's own check, in case a client does not.
    if ((this.clock.now() - new Date(call.startedAt)) / 1000 > MAX_CALL_SECONDS + TIME_LIMIT_GRACE_SECONDS) {
      return { ok: false, error: 'call_time_limit', message: 'The call time limit has passed. Say goodbye politely and end the call.' };
    }
    try {
      return { ok: true, ...(await handler(args && typeof args === 'object' ? args : {}, callId)) };
    } catch (error) {
      if (error instanceof DomainError) return { ok: false, error: error.code, message: error.message, ...error.details };
      throw error;
    }
  }
}
