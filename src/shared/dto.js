/** Response shape of a doctor, used by the admin API and the public site. snake_case, as written in contracts/. */
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
