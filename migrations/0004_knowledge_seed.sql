-- Keywords for the demo skills and a few demo FAQ/policy entries. Safe to run again.
UPDATE skills SET keywords = 'checkup, check up, consultation, examination, first visit, চেকআপ, পরামর্শ, দাঁত দেখানো, প্রথম ভিজিট' WHERE title = 'Check-up and consultation';
UPDATE skills SET keywords = 'scaling, cleaning, polish, tartar, plaque, স্কেলিং, ক্লিনিং, দাঁত পরিষ্কার, পাথর, ময়লা' WHERE title = 'Scaling and polishing';
UPDATE skills SET keywords = 'filling, cavity, decay, hole, ফিলিং, গর্ত, পোকা, ক্ষয়' WHERE title = 'Fillings';
UPDATE skills SET keywords = 'root canal, rct, nerve, infection, abscess, রুট ক্যানেল, আরসিটি, স্নায়ু, ব্যথা' WHERE title = 'Root canal treatment';
UPDATE skills SET keywords = 'braces, aligners, orthodontic, crooked, straighten, ব্রেসেস, ক্লিপ, দাঁত সোজা, তার' WHERE title = 'Braces and aligners';
UPDATE skills SET keywords = 'whitening, bleaching, yellow, stain, সাদা, হোয়াইটেনিং, হলুদ দাঁত, দাগ' WHERE title = 'Teeth whitening';
UPDATE skills SET keywords = 'extraction, remove tooth, wisdom, pull, দাঁত তোলা, আক্কেল দাঁত, এক্সট্রাকশন' WHERE title = 'Tooth extraction';
UPDATE skills SET kind = 'policy', keywords = 'cancel, reschedule, late, delay, payment, bkash, nagad, card, বাতিল, দেরি, পেমেন্ট, বিকাশ, নগদ' WHERE title = 'Booking and cancellation policy';

INSERT INTO skills (title, description, content, kind, keywords, enabled, updated_at)
SELECT column1, column2, column3, column4, column5, 1, '2026-11-14T00:00:00.000Z' FROM (VALUES
  ('Where to park', 'Parking for patients. রোগীদের পার্কিং।', 'Parking is available behind the building. Cars can be left for the duration of the visit.', 'faq', 'parking, car, গাড়ি, পার্কিং, গাড়ি রাখা'),
  ('Treating children', 'Dental care for kids. শিশুদের দাঁতের যত্ন।', 'Our dentists see children as well as adults. Bring the child with a parent or guardian, and tell us if the child is nervous so we can go slowly.', 'faq', 'children, kids, child, baby, শিশু, বাচ্চা, ছেলেমেয়ে'),
  ('What to bring on your first visit', 'What to bring to the first appointment. প্রথম ভিজিটে কী আনবেন।', 'Bring any old prescriptions, dental X-rays and a list of medicines you take. Tell the dentist about allergies. Arrive 10 minutes early.', 'faq', 'bring, first visit, documents, prescription, xray, x-ray, প্রথম ভিজিট, প্রেসক্রিপশন, এক্স-রে, কী আনব'),
  ('Emergency and after-hours pain', 'Urgent dental pain and what to do. জরুরি দাঁতের ব্যথা।', 'The booking line answers at any time. For urgent dental pain during opening hours, call and ask for the earliest slot. For severe swelling, heavy bleeding, trouble breathing or an accident, go to the nearest emergency department straight away. We do not give medical advice over the phone; a dentist will call you back.', 'policy', 'emergency, urgent, after hours, swelling, bleeding, জরুরি, ব্যথা, ফোলা, রক্ত, রাতে'),
  ('Pain during treatment', 'Comfort during treatment. চিকিৎসার সময় আরাম।', 'Local anaesthesia is used for treatments that could hurt. If you feel pain, raise your hand and the dentist will stop. For any question about medicine, a dentist will answer you directly.', 'faq', 'pain, hurt, anaesthesia, anesthesia, numb, ব্যথা, অবশ, ইনজেকশন, ভয়')
) v WHERE NOT EXISTS (SELECT 1 FROM skills s WHERE s.title = v.column1);
