/** Read-model shapes returned to the outside world. snake_case, as written in contracts/. */
export const skillDto = (s) => ({ id: s.id, title: s.title, content: s.content, enabled: s.enabled, updated_at: s.updatedAt });

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
  urgent: c.urgent,
  status: c.status,
  created_at: c.createdAt,
});
