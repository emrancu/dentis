-- Demo data only. Edit everything from /admin.
-- Safe to run again: doctors and skills are only inserted into empty tables, settings use INSERT OR IGNORE.
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('name_en', 'Dentis Dental Care'),
  ('name_bn', 'ডেন্টিস ডেন্টাল কেয়ার'),
  ('phone', '09638-001122'),
  ('address', 'House 12, Road 27, Dhanmondi, Dhaka 1209'),
  ('directions', 'Dhanmondi 27 number road, beside the Star Kabab restaurant. Five minutes walk from Dhanmondi Lake. Parking is available behind the building. (ধানমন্ডি ২৭ নম্বর রোড, লেকের কাছে)'),
  ('hours', 'Saturday to Thursday, 10:00 AM to 8:00 PM. Closed on Friday. (শনিবার থেকে বৃহস্পতিবার, সকাল ১০টা থেকে রাত ৮টা। শুক্রবার বন্ধ)'),
  ('prep_notes', 'Please arrive 10 minutes early and bring any old prescriptions or X-rays. Brush your teeth before the visit. Tell the dentist about any medicine or allergy. (আসার সময় পুরনো প্রেসক্রিপশন বা এক্স-রে সঙ্গে আনবেন)'),
  ('slot_minutes', '30');

INSERT INTO doctors (name_en, name_bn, specialty, days, start_time, end_time)
SELECT * FROM (VALUES
  ('Dr. Nusrat Jahan', 'ডা. নুসরাত জাহান', 'General dentistry and cleaning', '[6,0,1,2,3,4]', '10:00', '17:00'),
  ('Dr. Tanvir Rahman', 'ডা. তানভীর রহমান', 'Root canal and endodontics', '[6,1,3]', '14:00', '20:00'),
  ('Dr. Farhana Islam', 'ডা. ফারহানা ইসলাম', 'Braces and orthodontics', '[0,2,4]', '15:00', '20:00')
) WHERE NOT EXISTS (SELECT 1 FROM doctors);

INSERT INTO skills (title, description, content, enabled, updated_at)
SELECT * FROM (VALUES
  ('Check-up and consultation', 'First visit, oral examination and treatment plan. প্রথম পরামর্শ ও দাঁত পরীক্ষা।', 'Consultation fee: 500 taka, adjusted against treatment if the patient continues. Includes a full oral exam and a written treatment plan. X-ray is charged separately (200 taka per small X-ray). Demo price list.', 1, '2026-11-14T00:00:00.000Z'),
  ('Scaling and polishing', 'Professional teeth cleaning that removes plaque and tartar. দাঁত স্কেলিং ও পলিশিং।', 'Fee: 1500 taka for scaling and polishing. Takes about 40 minutes. Recommended every six months. Mild gum bleeding on the first visit is normal. Demo price list.', 1, '2026-11-14T00:00:00.000Z'),
  ('Fillings', 'Tooth-coloured fillings for cavities. দাঁতের গর্ত ফিলিং।', 'Tooth-coloured composite filling: 1200 to 2500 taka depending on the size of the cavity. One visit for most cases. Demo price list.', 1, '2026-11-14T00:00:00.000Z'),
  ('Root canal treatment', 'Saves a badly decayed or infected tooth. রুট ক্যানেল চিকিৎসা।', 'Root canal fee: 6000 to 12000 taka depending on the tooth. Usually two or three visits. Done by Dr. Tanvir Rahman. A crown is advised afterwards and is charged separately. Demo price list.', 1, '2026-11-14T00:00:00.000Z'),
  ('Braces and aligners', 'Metal and ceramic braces to straighten teeth. ব্রেসেস ও দাঁত সোজা করা।', 'Metal braces start from 35000 taka, ceramic braces from 55000 taka. Monthly adjustment visits. A free consultation with Dr. Farhana Islam is needed first. Demo price list.', 1, '2026-11-14T00:00:00.000Z'),
  ('Teeth whitening', 'Safe in-clinic whitening for a brighter smile. দাঁত সাদা করা।', 'In-clinic whitening: 8000 taka for one 60 minute session. Sensitivity for a day or two can happen. Scaling is advised before whitening. Demo price list.', 1, '2026-11-14T00:00:00.000Z'),
  ('Tooth extraction', 'Removal of damaged teeth and wisdom teeth. দাঁত তোলা।', 'Simple extraction: 1000 taka. Surgical or wisdom tooth extraction: 3000 to 6000 taka. Local anaesthesia is used. Demo price list.', 1, '2026-11-14T00:00:00.000Z'),
  ('Booking and cancellation policy', 'How appointments, delays and cancellations work. অ্যাপয়েন্টমেন্ট ও বাতিলের নিয়ম।', 'Please cancel or reschedule at least 4 hours before the visit. We hold a slot for 15 minutes after the booked time. Payment by cash, bKash, Nagad or card.', 1, '2026-11-14T00:00:00.000Z')
) WHERE NOT EXISTS (SELECT 1 FROM skills);
