-- Agent knowledge is a title and its details. Clean the demo entries, then drop description and kind.

-- 0009 copied the Bangla description onto a second line of the details. The agent would read it twice.
UPDATE skills SET content = rtrim(substr(content, 1, instr(content, char(10)) - 1))
WHERE instr(content, char(10)) > 0 AND title IN (
  'Check-up and consultation', 'Scaling and polishing', 'Fillings', 'Root canal treatment', 'Braces and aligners',
  'Teeth whitening', 'Tooth extraction', 'Booking and cancellation policy', 'Where to park', 'Treating children',
  'What to bring on your first visit', 'Emergency and after-hours pain', 'Pain during treatment', 'Dental implants', 'Diagnosis'
);

-- "Demo price list." is a note for us. The agent must not say it to a caller.
UPDATE skills SET content = trim(replace(content, ' Demo price list.', ''));

-- Diagnosis repeated the whole consultation fee text.
UPDATE skills SET content = replace(content, ' Consultation fee: 500 taka, adjusted against treatment if the patient continues. X-ray is charged separately (200 taka per small X-ray).', ' The fee is the same as for the Check-up and consultation.')
WHERE title = 'Diagnosis';

ALTER TABLE skills DROP COLUMN description;
ALTER TABLE skills DROP COLUMN kind;

-- The "Before your visit" field was removed from the app. Its two settings rows are left over.
DELETE FROM settings WHERE key IN ('prep_notes', 'prep_notes_bn');
