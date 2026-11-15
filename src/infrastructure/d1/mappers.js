import { Appointment } from '../../domain/scheduling/appointment.js';
import { Call } from '../../domain/calls/call.js';
import { CallbackRequest } from '../../domain/calls/callback-request.js';
import { Doctor } from '../../domain/scheduling/doctor.js';
import { Patient } from '../../domain/scheduling/patient.js';
import { Skill } from '../../domain/skills/skill.js';

/** Row (snake_case) to domain object. */
export const toCall = (r) =>
  new Call({ id: r.id, startedAt: r.started_at, endedAt: r.ended_at, durationS: r.duration_s, status: r.status, patientId: r.patient_id, recordingKey: r.recording_key, summary: r.summary, ipHash: r.ip_hash });

export const toExtraction = (r) =>
  r && { patientName: r.patient_name, phone: r.phone, reasonForVisit: r.reason_for_visit, preferredDatetime: r.preferred_datetime, intent: r.intent, outcome: r.outcome, notes: r.notes };

export const toPatient = (r) => new Patient({ id: r.id, fullName: r.full_name, phone: r.phone, createdAt: r.created_at });

export const toDoctor = (r) =>
  new Doctor({ id: r.id, nameEn: r.name_en, nameBn: r.name_bn, specialty: r.specialty, specialtyBn: r.specialty_bn, days: JSON.parse(r.days), startTime: r.start_time, endTime: r.end_time, active: Boolean(r.active) });

export const toSkill = (r) => new Skill({ id: r.id, title: r.title, description: r.description, titleBn: r.title_bn, descriptionBn: r.description_bn, content: r.content, kind: r.kind, keywords: r.keywords, enabled: Boolean(r.enabled), onWebsite: Boolean(r.on_website), updatedAt: r.updated_at });

export const toAppointment = (r) =>
  new Appointment({ id: r.id, patientId: r.patient_id, callId: r.call_id, doctorId: r.doctor_id, slot: r.slot, service: r.service, status: r.status, createdAt: r.created_at });

export const toCallback = (r) =>
  new CallbackRequest({ id: r.id, callId: r.call_id, name: r.name, phone: r.phone, reason: r.reason, preferredTime: r.preferred_time, status: r.status, createdAt: r.created_at });
