import { AdminAuth } from './application/admin-auth.js';
import { AdminQueries, ResolveCallback, UpdateAppointmentStatus } from './application/admin-portal.js';
import { ToolExecutor } from './application/agent/tool-executor.js';
import { CallNotes } from './application/call-notes.js';
import { AnalyzeCall, FinishCall, RequestCallback, SaveCallDetails, StartCall, StoreRecording } from './application/call-records.js';
import { ClinicService, DoctorDirectory, GetPublicSite } from './application/clinic.js';
import { AgentKnowledge, SkillCatalog } from './application/knowledge.js';
import { PatientRegistry } from './application/patient-registry.js';
import { BookAppointment, CancelAppointment, CheckAvailability, RescheduleAppointment } from './application/scheduling.js';

/**
 * The only place that knows both use cases and adapters.
 * `ports` is everything listed in application/ports.js plus `clock`, `accessKey` and an optional `newId`.
 */
export function buildServices(ports) {
  const { calls, patients, appointments, doctors, skills, settings, callbacks, recordings, gateway, analyzer, security, clock, accessKey, newId } = ports;
  const notes = new CallNotes({ calls });
  const patientRegistry = new PatientRegistry({ patients, clock });
  const clinic = new ClinicService({ settings });
  const knowledge = new AgentKnowledge({ skills });
  const scheduling = { doctors, settings, appointments, patients, patientRegistry, notes, clock };
  const checkAvailability = new CheckAvailability(scheduling);
  const bookAppointment = new BookAppointment(scheduling);
  const rescheduleAppointment = new RescheduleAppointment(scheduling);
  const cancelAppointment = new CancelAppointment(scheduling);
  const saveCallDetails = new SaveCallDetails({ notes, patientRegistry });
  const requestCallback = new RequestCallback({ callbacks, notes, clock });

  return {
    adminAuth: new AdminAuth({ accessKey, security, clock }),
    adminQueries: new AdminQueries({ calls, patients, appointments, doctors, callbacks, recordings, clock }),
    updateAppointmentStatus: new UpdateAppointmentStatus({ appointments, patients, doctors }),
    resolveCallback: new ResolveCallback({ callbacks }),
    skillCatalog: new SkillCatalog({ skills, clock }),
    doctorDirectory: new DoctorDirectory({ doctors, appointments }),
    clinic,
    getPublicSite: new GetPublicSite({ clinic, skills, doctors }),
    startCall: new StartCall({ calls, doctors, skills, settings, gateway, security, clock, newId }),
    finishCall: new FinishCall({ calls, clock }),
    analyzeCall: new AnalyzeCall({ calls, analyzer }),
    storeRecording: new StoreRecording({ calls, recordings }),
    checkAvailability,
    bookAppointment,
    rescheduleAppointment,
    cancelAppointment,
    saveCallDetails,
    requestCallback,
    toolExecutor: new ToolExecutor({
      calls,
      clock,
      clinic,
      doctors,
      knowledge,
      checkAvailability,
      bookAppointment,
      rescheduleAppointment,
      cancelAppointment,
      saveCallDetails,
      requestCallback,
    }),
  };
}
