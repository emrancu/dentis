import { buildServices } from './composition.js';
import { SystemClock } from './domain/shared/time.js';
import { D1CallRepository } from './infrastructure/d1/call-repository.js';
import { D1CallbackRepository, D1SettingsRepository, D1SkillRepository } from './infrastructure/d1/content-repositories.js';
import { D1AppointmentRepository, D1DoctorRepository, D1PatientRepository } from './infrastructure/d1/scheduling-repositories.js';
import { OpenAIRealtimeGateway } from './infrastructure/openai/realtime-gateway.js';
import { R2RecordingStore } from './infrastructure/r2/r2-recording-store.js';
import { WebCryptoSecurity } from './infrastructure/security/web-crypto-security.js';
import { createApp } from './interface/http/app.js';

let app;

function buildApp(env) {
  const accessKey = env.ADMIN_ACCESS_KEY ?? '';
  return createApp(
    buildServices({
      calls: new D1CallRepository(env.DB),
      patients: new D1PatientRepository(env.DB),
      appointments: new D1AppointmentRepository(env.DB),
      doctors: new D1DoctorRepository(env.DB),
      skills: new D1SkillRepository(env.DB),
      settings: new D1SettingsRepository(env.DB),
      callbacks: new D1CallbackRepository(env.DB),
      recordings: new R2RecordingStore(env.RECORDINGS),
      gateway: new OpenAIRealtimeGateway({ apiKey: env.OPENAI_API_KEY }),
      security: new WebCryptoSecurity({ secret: accessKey || 'admin-not-configured' }),
      clock: new SystemClock(),
      accessKey,
    }),
    { assets: env.ASSETS },
  );
}

export default {
  fetch(request, env, ctx) {
    app ??= buildApp(env);
    return app.handle(request, ctx);
  },
};
