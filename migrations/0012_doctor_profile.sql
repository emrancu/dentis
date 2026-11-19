-- Doctor profile: degree (with a Bangla twin), gender and years of experience. Staff edit them in admin.
-- Runs once (tracked by wrangler d1 migrations apply). The demo values below are invented, like the demo doctors.
ALTER TABLE doctors ADD COLUMN degree TEXT NOT NULL DEFAULT '';
ALTER TABLE doctors ADD COLUMN degree_bn TEXT NOT NULL DEFAULT '';
ALTER TABLE doctors ADD COLUMN gender TEXT NOT NULL DEFAULT '';
ALTER TABLE doctors ADD COLUMN experience_years INTEGER;

UPDATE doctors SET degree = 'BDS', degree_bn = 'বিডিএস', gender = 'female', experience_years = 8 WHERE name_en = 'Dr. Nusrat Jahan' AND degree = '';
UPDATE doctors SET degree = 'BDS, MS (Endodontics)', degree_bn = 'বিডিএস, এমএস (এন্ডোডন্টিক্স)', gender = 'male', experience_years = 12 WHERE name_en = 'Dr. Tanvir Rahman' AND degree = '';
UPDATE doctors SET degree = 'BDS, MDS (Orthodontics)', degree_bn = 'বিডিএস, এমডিএস (অর্থোডন্টিক্স)', gender = 'female', experience_years = 10 WHERE name_en = 'Dr. Farhana Islam' AND degree = '';
