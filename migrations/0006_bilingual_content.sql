-- Bilingual content, part 2 of 2: the English fields become English only and the Bangla twins are filled.
-- Demo data. Safe to run again.

-- Services: English description, Bangla title and description.
UPDATE skills SET description = 'First visit, oral examination and a treatment plan.', title_bn = 'চেকআপ ও পরামর্শ', description_bn = 'প্রথম পরামর্শ, দাঁত ও মুখের পরীক্ষা এবং চিকিৎসার পরিকল্পনা।' WHERE title = 'Check-up and consultation';
UPDATE skills SET description = 'Professional teeth cleaning that removes plaque and tartar.', title_bn = 'স্কেলিং ও পলিশিং', description_bn = 'প্লাক ও টার্টার সরিয়ে দাঁত পরিষ্কার করা।' WHERE title = 'Scaling and polishing';
UPDATE skills SET description = 'Tooth-coloured fillings for cavities.', title_bn = 'ফিলিং', description_bn = 'ক্ষয় বা গর্ত হওয়া দাঁতে দাঁতের রঙের ফিলিং।' WHERE title = 'Fillings';
UPDATE skills SET description = 'Saves a badly decayed or infected tooth.', title_bn = 'রুট ক্যানেল চিকিৎসা', description_bn = 'ক্ষয় বা সংক্রমণে নষ্ট হতে বসা দাঁত বাঁচানোর চিকিৎসা।' WHERE title = 'Root canal treatment';
UPDATE skills SET description = 'Metal and ceramic braces to straighten teeth.', title_bn = 'ব্রেসেস ও অ্যালাইনার', description_bn = 'ধাপে ধাপে দাঁত সোজা করার মেটাল ও সিরামিক ব্রেসেস।' WHERE title = 'Braces and aligners';
UPDATE skills SET description = 'Safe in-clinic whitening for a brighter smile.', title_bn = 'দাঁত সাদা করা', description_bn = 'ক্লিনিকে নিরাপদ পদ্ধতিতে উজ্জ্বল হাসি।' WHERE title = 'Teeth whitening';
UPDATE skills SET description = 'Removal of damaged teeth and wisdom teeth.', title_bn = 'দাঁত তোলা', description_bn = 'ক্ষতিগ্রস্ত দাঁত ও আক্কেল দাঁত তোলা।' WHERE title = 'Tooth extraction';

-- Agent-only entries (policy and FAQ): English description only, Bangla twins filled.
UPDATE skills SET description = 'How appointments, delays and cancellations work.', title_bn = 'অ্যাপয়েন্টমেন্ট ও বাতিলের নিয়ম', description_bn = 'অ্যাপয়েন্টমেন্ট, দেরি ও বাতিলের নিয়ম।' WHERE title = 'Booking and cancellation policy';
UPDATE skills SET description = 'Parking for patients.', title_bn = 'পার্কিং কোথায়', description_bn = 'রোগীদের জন্য পার্কিং।' WHERE title = 'Where to park';
UPDATE skills SET description = 'Dental care for kids.', title_bn = 'শিশুদের চিকিৎসা', description_bn = 'শিশুদের দাঁতের যত্ন।' WHERE title = 'Treating children';
UPDATE skills SET description = 'What to bring to the first appointment.', title_bn = 'প্রথম ভিজিটে কী আনবেন', description_bn = 'প্রথম অ্যাপয়েন্টমেন্টে যা সঙ্গে আনতে হবে।' WHERE title = 'What to bring on your first visit';
UPDATE skills SET description = 'Urgent dental pain and what to do.', title_bn = 'জরুরি ও রাতের ব্যথা', description_bn = 'জরুরি দাঁতের ব্যথায় কী করবেন।' WHERE title = 'Emergency and after-hours pain';
UPDATE skills SET description = 'Comfort during treatment.', title_bn = 'চিকিৎসার সময় ব্যথা', description_bn = 'চিকিৎসার সময় আরাম।' WHERE title = 'Pain during treatment';

-- The hero already shows implants, so the clinic offers them (demo data).
INSERT INTO skills (title, description, title_bn, description_bn, content, kind, keywords, enabled, updated_at)
SELECT column1, column2, column3, column4, column5, column6, column7, 1, '2026-11-14T00:00:00.000Z' FROM (VALUES (
  'Dental implants',
  'A lasting replacement for a missing tooth.',
  'ডেন্টাল ইমপ্ল্যান্ট',
  'হারানো দাঁতের স্থায়ী বিকল্প।',
  'Single dental implant: from 60000 taka, including the post and the crown. It needs a consultation and an X-ray first, then usually two or three visits over a few months. Demo price list.',
  'service',
  'implant, implants, missing tooth, replace tooth, ইমপ্ল্যান্ট, ইমপ্লান্ট, দাঁত নেই, হারানো দাঁত, নকল দাঁত'
)) v WHERE NOT EXISTS (SELECT 1 FROM skills s WHERE s.title = v.column1);

-- Doctors: Bangla specialty.
UPDATE doctors SET specialty_bn = 'সাধারণ ডেন্টাল সেবা ও ক্লিনিং' WHERE name_en = 'Dr. Nusrat Jahan';
UPDATE doctors SET specialty_bn = 'রুট ক্যানেল ও এন্ডোডন্টিক্স' WHERE name_en = 'Dr. Tanvir Rahman';
UPDATE doctors SET specialty_bn = 'ব্রেসেস ও অর্থোডন্টিক্স' WHERE name_en = 'Dr. Farhana Islam';

-- Clinic profile: English only, plus the Bangla twins.
UPDATE settings SET value = 'House 12, Road 27, Dhanmondi, Dhaka 1209' WHERE key = 'address';
UPDATE settings SET value = 'Saturday to Thursday, 10:00 am to 8:00 pm. Closed on Friday.' WHERE key = 'hours';
UPDATE settings SET value = 'Dhanmondi Road 27, beside the Star Kabab restaurant. Five minutes walk from Dhanmondi Lake. Parking is available behind the building.' WHERE key = 'directions';
UPDATE settings SET value = 'Please arrive 10 minutes early and bring any old prescriptions or X-rays. Brush your teeth before the visit. Tell the dentist about any medicine or allergy.' WHERE key = 'prep_notes';
INSERT OR REPLACE INTO settings (key, value) VALUES
  ('address_bn', 'বাড়ি ১২, রোড ২৭, ধানমন্ডি, ঢাকা ১২০৯'),
  ('hours_bn', 'শনিবার থেকে বৃহস্পতিবার, সকাল ১০:০০ থেকে রাত ৮:০০। শুক্রবার বন্ধ।'),
  ('directions_bn', 'ধানমন্ডি ২৭ নম্বর রোড, স্টার কাবাব রেস্টুরেন্টের পাশে। ধানমন্ডি লেক থেকে হেঁটে পাঁচ মিনিট। ভবনের পেছনে পার্কিংয়ের জায়গা আছে।'),
  ('prep_notes_bn', 'আসার সময় ১০ মিনিট আগে আসুন এবং পুরনো প্রেসক্রিপশন বা এক্স-রে সঙ্গে আনুন। আসার আগে দাঁত ব্রাশ করে নিন। কোনো ওষুধ বা অ্যালার্জি থাকলে ডেন্টিস্টকে জানান।');
