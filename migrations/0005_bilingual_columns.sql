-- Bilingual content, part 1 of 2: schema. Every display field gets a Bangla twin.
-- Runs once (tracked by wrangler d1 migrations apply).
ALTER TABLE skills ADD COLUMN title_bn TEXT NOT NULL DEFAULT '';
ALTER TABLE skills ADD COLUMN description_bn TEXT NOT NULL DEFAULT '';
ALTER TABLE doctors ADD COLUMN specialty_bn TEXT NOT NULL DEFAULT '';
