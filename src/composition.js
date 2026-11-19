import { AdminAuth } from './admin/auth.js';
import { AdminQueries, ResolveCallback, UpdateAppointmentStatus } from './admin/portal.js';
import { AgentSettings } from './agent/agent-settings.js';
import { RenewListenUrl, SynthesizeSpeech } from './agent/speech.js';
import { RunAgentTurn } from './agent/agent-turn.js';
import { ToolExecutor } from './agent/tool-executor.js';
import { CallNotes } from './calls/call-notes.js';
import { FinishCall, RequestCallback, SaveCallDetails, StartCall } from './calls/call-records.js';
import { ClinicService } from './clinic/clinic.js';
import { DoctorDirectory } from './scheduling/doctor-directory.js';
import { GetPublicSite } from './website/public-site.js';
import { AgentKnowledge, SkillCatalog } from './knowledge/knowledge.js';
import { PatientRegistry } from './scheduling/patient-registry.js';
import { BookAppointment, CancelAppointment, CheckAvailability, RescheduleAppointment } from './scheduling/scheduling.js';

/**
 * The only place that knows both use cases and adapters.
 * `ports` is the stores (D1), the OpenAI brain, the ElevenLabs voice and the security helper, plus `clock`, `accessKey` and an optional `newId`.
 */
export function buildServices(ports) {
  const { calls, patients, appointments, doctors, skills, settings, callbacks, voice, brain, security, clock, accessKey, newId } = ports;
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
  const toolExecutor = new ToolExecutor({
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
  });

  return {
    adminAuth: new AdminAuth({ accessKey, security, clock }),
    adminQueries: new AdminQueries({ calls, patients, appointments, doctors, callbacks, clock }),
    updateAppointmentStatus: new UpdateAppointmentStatus({ appointments, patients, doctors }),
    resolveCallback: new ResolveCallback({ callbacks }),
    skillCatalog: new SkillCatalog({ skills, clock }),
    doctorDirectory: new DoctorDirectory({ doctors, appointments }),
    clinic,
    agentSettings: new AgentSettings({ settings, doctors, skills, clock }),
    getPublicSite: new GetPublicSite({ clinic, doctors }),
    startCall: new StartCall({ calls, settings, voice, brain, security, clock, newId }),
    synthesizeSpeech: new SynthesizeSpeech({ voice, calls }),
    renewListenUrl: new RenewListenUrl({ voice, calls }),
    finishCall: new FinishCall({ calls, clock }),
    checkAvailability,
    bookAppointment,
    rescheduleAppointment,
    cancelAppointment,
    saveCallDetails,
    requestCallback,
    runAgentTurn: new RunAgentTurn({ brain, toolExecutor, calls, doctors, skills, settings, clock }),
    toolExecutor,
  };
}
