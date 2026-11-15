import { doctorDto } from '../../shared/dto.js';
import { json, noContent, readJson } from '../../shared/http.js';

const admin = { admin: true };
const id = (params) => Number(params.id);
const doctorInput = (b) => ({ nameEn: b.name_en, nameBn: b.name_bn, specialty: b.specialty, specialtyBn: b.specialty_bn, days: b.days, startTime: b.start_time, endTime: b.end_time, active: b.active });

export function registerDoctorRoutes(router, s) {
  router.add('GET', '/api/admin/doctors', async () => json({ items: (await s.doctorDirectory.list()).map(doctorDto) }), admin);
  router.add('POST', '/api/admin/doctors', async ({ request }) => json(doctorDto(await s.doctorDirectory.create(doctorInput(await readJson(request)))), 201), admin);
  router.add('PUT', '/api/admin/doctors/:id', async ({ request, params }) => json(doctorDto(await s.doctorDirectory.update(id(params), doctorInput(await readJson(request))))), admin);
  router.add('DELETE', '/api/admin/doctors/:id', async ({ params }) => (await s.doctorDirectory.remove(id(params)), noContent()), admin);
}
