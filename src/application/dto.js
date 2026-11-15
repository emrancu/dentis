/** Read-model shapes returned to the outside world. snake_case, as written in contracts/. */
export const skillDto = (s) => ({ id: s.id, title: s.title, description: s.description, title_bn: s.titleBn, description_bn: s.descriptionBn, content: s.content, kind: s.kind, keywords: s.keywords, enabled: s.enabled, updated_at: s.updatedAt });

export const doctorDto = (d) => ({
  id: d.id,
  name_en: d.nameEn,
  name_bn: d.nameBn,
  specialty: d.specialty,
  specialty_bn: d.specialtyBn,
  days: d.days,
  start_time: d.startTime,
  end_time: d.endTime,
  active: d.active,
});

export const appointmentDto = (a, patient, doctor) => ({
  id: a.id,
  slot: a.slot,
  status: a.status,
  service: a.service,
  call_id: a.callId,
  patient_name: patient?.fullName ?? null,
  phone: patient?.phone ?? null,
  doctor_id: a.doctorId,
  doctor_name: doctor?.nameEn ?? null,
});

export const extractionDto = (e) => ({
  patient_name: e?.patientName ?? null,
  phone: e?.phone ?? null,
  reason_for_visit: e?.reasonForVisit ?? null,
  preferred_datetime: e?.preferredDatetime ?? null,
  intent: e?.intent ?? null,
  outcome: e?.outcome ?? null,
  notes: e?.notes ?? null,
});

export const callbackDto = (c) => ({
  id: c.id,
  call_id: c.callId,
  name: c.name,
  phone: c.phone,
  reason: c.reason,
  preferred_time: c.preferredTime,
  status: c.status,
  created_at: c.createdAt,
});
