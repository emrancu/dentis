import { buildServices } from './composition.js';
import { SystemClock } from './shared/time.js';
import { D1CallRepository, D1CallbackRepository } from './calls/store.js';
import { D1SettingsRepository } from './clinic/store.js';
import { D1SkillRepository } from './knowledge/store.js';
import { D1AppointmentRepository, D1DoctorRepository, D1PatientRepository } from './scheduling/store.js';
import { ElevenLabsVoice } from './agent/elevenlabs-voice.js';
import { GEMINI_DEFAULT_MODEL, GEMINI_ENDPOINT, OpenAIBrain } from './agent/openai-brain.js';
import { WebCryptoSecurity } from './admin/security.js';
import { createApp } from './app.js';

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
      brain: env.GEMINI_API_KEY
        ? new OpenAIBrain({ apiKey: env.GEMINI_API_KEY, endpoint: GEMINI_ENDPOINT, model: env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL })
        : new OpenAIBrain({ apiKey: env.OPENAI_API_KEY, ...(env.OPENAI_MODEL ? { model: env.OPENAI_MODEL } : {}) }),
      voice: new ElevenLabsVoice({ apiKey: env.ELEVENLABS_API_KEY, ...(env.ELEVENLABS_VOICE_ID ? { voiceId: env.ELEVENLABS_VOICE_ID } : {}), ...(env.ELEVENLABS_TTS_MODEL ? { ttsModel: env.ELEVENLABS_TTS_MODEL } : {}) }),
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
