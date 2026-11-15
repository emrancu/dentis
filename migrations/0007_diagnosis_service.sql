-- A service for callers who do not know what is wrong. Demo data, edit it in admin. Safe to run twice.
INSERT INTO skills (title, description, title_bn, description_bn, content, kind, keywords, enabled, updated_at)
SELECT column1, column2, column3, column4, column5, column6, column7, 1, '2026-11-15T00:00:00.000Z' FROM (VALUES (
  'Diagnosis',
  'For pain or discomfort with no known cause. The dentist examines you and finds the problem.',
  'রোগ নির্ণয়',
  'সমস্যা কী বুঝতে না পারলে ডাক্তার পরীক্ষা করে কারণ খুঁজে বের করেন।',
  'The caller does not need to know what is wrong. Book a consultation and the dentist will examine the mouth, take an X-ray if needed, find the cause and explain the treatment before anything is done. Consultation fee: 500 taka, adjusted against treatment if the patient continues. X-ray is charged separately (200 taka per small X-ray). Never guess a diagnosis on the phone. Demo price list.',
  'service',
  'diagnosis, not sure, unknown problem, pain, ache, sensitivity, check, what is wrong, রোগ নির্ণয়, কী সমস্যা, সমস্যা বুঝতে পারছি না, ব্যথা, শিরশির, দাঁত পরীক্ষা'
)) v WHERE NOT EXISTS (SELECT 1 FROM skills s WHERE s.title = v.column1);
