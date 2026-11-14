-- OPTIONAL sample data so the portal is not empty on a fresh install.
-- These are invented test conversations, not real calls. Skip this file in production.
INSERT OR IGNORE INTO patients (id, full_name, phone, created_at) VALUES
  (1, 'Rahim Uddin', '01712345678', '2026-11-13T05:12:00.000Z'),
  (2, 'Sumaiya Akter', '01898765432', '2026-11-13T09:40:00.000Z');

INSERT OR IGNORE INTO calls (id, started_at, ended_at, duration_s, status, patient_id, summary) VALUES
  ('sample-booked', '2026-11-13T05:10:00.000Z', '2026-11-13T05:13:12.000Z', 192, 'booked', 1, 'The patient has a toothache and booked a check-up with Dr. Nusrat Jahan for Sunday at 11:00.'),
  ('sample-enquiry', '2026-11-13T08:02:00.000Z', '2026-11-13T08:03:25.000Z', 85, 'enquiry', NULL, 'The caller asked about the cost of scaling and polishing and the clinic hours. No booking was made.'),
  ('sample-followup', '2026-11-13T09:38:00.000Z', '2026-11-13T09:41:05.000Z', 185, 'follow_up_needed', 2, 'The caller asked whether a medicine is safe during pregnancy. The agent declined medical advice and requested a doctor callback.'),
  ('sample-incomplete', '2026-11-14T03:20:00.000Z', '2026-11-14T03:20:40.000Z', 40, 'incomplete', NULL, NULL);

INSERT OR IGNORE INTO call_extractions (call_id, patient_name, phone, reason_for_visit, preferred_datetime, intent, outcome) VALUES
  ('sample-booked', 'Rahim Uddin', '01712345678', 'toothache', '2026-11-15T11:00', 'booking', 'booked'),
  ('sample-enquiry', NULL, NULL, 'scaling price and hours', NULL, 'enquiry', NULL),
  ('sample-followup', 'Sumaiya Akter', '01898765432', 'medicine question', NULL, 'callback', 'callback_needed');

INSERT OR IGNORE INTO transcript_turns (call_id, idx, speaker, text_bn, text_en, ts) VALUES
  ('sample-booked', 0, 'agent', 'আসসালামু আলাইকুম, ডেন্টিস ডেন্টাল কেয়ারে আপনাকে স্বাগতম। আমি কীভাবে আপনাকে সাহায্য করতে পারি?', 'Peace be upon you, welcome to Dentis Dental Care. How can I help you?', '2026-11-13T05:10:04.000Z'),
  ('sample-booked', 1, 'patient', 'আমি একটা appointment নিতে চাই, আমার দাঁতে খুব ব্যথা।', 'I want to take an appointment, I have a bad toothache.', '2026-11-13T05:10:15.000Z'),
  ('sample-booked', 2, 'agent', 'ঠিক আছে, আপনার ব্যথার জন্য আমি দেখে দিচ্ছি। আপনার পুরো নামটা বলবেন?', 'Okay, I will arrange it for your pain. Could you tell me your full name?', '2026-11-13T05:10:22.000Z'),
  ('sample-booked', 3, 'patient', 'রহিম উদ্দিন।', 'Rahim Uddin.', '2026-11-13T05:10:30.000Z'),
  ('sample-booked', 4, 'agent', 'ধন্যবাদ রহিম সাহেব। আপনার ফোন নম্বরটা বলবেন?', 'Thank you, Mr. Rahim. May I have your phone number?', '2026-11-13T05:10:36.000Z'),
  ('sample-booked', 5, 'patient', 'জিরো ওয়ান সেভেন ওয়ান টু থ্রি ফোর ফাইভ সিক্স সেভেন এইট।', 'Zero one seven one two three four five six seven eight.', '2026-11-13T05:10:50.000Z'),
  ('sample-booked', 6, 'agent', 'নম্বরটা হলো ০ ১ ৭ ১ ২, ৩ ৪ ৫ ৬, ৭ ৮। ঠিক আছে?', 'The number is 0 1 7 1 2, 3 4 5 6, 7 8. Is that correct?', '2026-11-13T05:11:00.000Z'),
  ('sample-booked', 7, 'patient', 'জি, ঠিক আছে। রবিবার সকালের দিকে হলে ভালো হয়।', 'Yes, correct. Sunday morning would be good.', '2026-11-13T05:11:10.000Z'),
  ('sample-booked', 8, 'agent', 'রবিবার, ১৫ নভেম্বর সকাল ১১টায় ডা. নুসরাত জাহানের সময় খালি আছে। আপনার জন্য বুক করে দেব?', 'On Sunday 15 November at 11 am, Dr. Nusrat Jahan is free. Shall I book it for you?', '2026-11-13T05:11:40.000Z'),
  ('sample-booked', 9, 'patient', 'হ্যাঁ, করে দিন।', 'Yes, please do.', '2026-11-13T05:11:48.000Z'),
  ('sample-booked', 10, 'agent', 'বুক হয়ে গেছে। রবিবার সকাল ১১টায় ডা. নুসরাত জাহান, নাম রহিম উদ্দিন। আল্লাহ হাফেজ।', 'Booked. Sunday 11 am with Dr. Nusrat Jahan, name Rahim Uddin. Goodbye.', '2026-11-13T05:12:10.000Z'),
  ('sample-enquiry', 0, 'agent', 'আসসালামু আলাইকুম, ডেন্টিস ডেন্টাল কেয়ার। কীভাবে সাহায্য করতে পারি?', 'Peace be upon you, Dentis Dental Care. How can I help?', '2026-11-13T08:02:04.000Z'),
  ('sample-enquiry', 1, 'patient', 'scaling করতে কত টাকা লাগে?', 'How much does scaling cost?', '2026-11-13T08:02:14.000Z'),
  ('sample-enquiry', 2, 'agent', 'স্কেলিং ও পলিশিংয়ের ফি ১৫০০ টাকা, সময় লাগে প্রায় ৪০ মিনিট।', 'Scaling and polishing costs 1500 taka and takes about 40 minutes.', '2026-11-13T08:02:30.000Z'),
  ('sample-enquiry', 3, 'patient', 'আপনারা কয়টা পর্যন্ত খোলা থাকেন?', 'Until what time are you open?', '2026-11-13T08:02:45.000Z'),
  ('sample-enquiry', 4, 'agent', 'শনিবার থেকে বৃহস্পতিবার সকাল ১০টা থেকে রাত ৮টা পর্যন্ত। শুক্রবার বন্ধ।', 'Saturday to Thursday, 10 am to 8 pm. Closed on Friday.', '2026-11-13T08:03:00.000Z'),
  ('sample-followup', 0, 'agent', 'আসসালামু আলাইকুম, ডেন্টিস ডেন্টাল কেয়ারে স্বাগতম।', 'Peace be upon you, welcome to Dentis Dental Care.', '2026-11-13T09:38:04.000Z'),
  ('sample-followup', 1, 'patient', 'আমি প্রেগন্যান্ট, আমি কি এই ওষুধটা খেতে পারব? দাঁতের ব্যথার জন্য।', 'I am pregnant, can I take this medicine for my toothache?', '2026-11-13T09:38:20.000Z'),
  ('sample-followup', 2, 'agent', 'দুঃখিত, ওষুধ নিয়ে আমি পরামর্শ দিতে পারি না। ডাক্তার আপনাকে ফোন করে জানালে ভালো হবে। আপনার নাম আর নম্বরটা বলবেন?', 'Sorry, I cannot advise on medicine. It is better if the doctor calls you. May I have your name and number?', '2026-11-13T09:38:40.000Z'),
  ('sample-followup', 3, 'patient', 'সুমাইয়া আক্তার, ০১৮৯৮৭৬৫৪৩২।', 'Sumaiya Akter, 01898765432.', '2026-11-13T09:39:05.000Z'),
  ('sample-followup', 4, 'agent', 'ধন্যবাদ, আমাদের টিম আপনাকে আজই ফোন করবে।', 'Thank you, our team will call you today.', '2026-11-13T09:39:30.000Z'),
  ('sample-incomplete', 0, 'agent', 'আসসালামু আলাইকুম, ডেন্টিস ডেন্টাল কেয়ারে স্বাগতম।', 'Peace be upon you, welcome to Dentis Dental Care.', '2026-11-14T03:20:04.000Z'),
  ('sample-incomplete', 1, 'patient', 'হ্যালো?', 'Hello?', '2026-11-14T03:20:20.000Z');

INSERT OR IGNORE INTO appointments (id, patient_id, call_id, doctor_id, slot, service, status, created_at) VALUES
  (1, 1, 'sample-booked', 1, '2026-11-15T11:00', 'toothache', 'booked', '2026-11-13T05:12:00.000Z');

INSERT OR IGNORE INTO callbacks (id, call_id, name, phone, reason, preferred_time, status, created_at) VALUES
  (1, 'sample-followup', 'Sumaiya Akter', '01898765432', 'Asked if a toothache medicine is safe during pregnancy. Needs a doctor to call.', 'today', 'open', '2026-11-13T09:39:30.000Z');
