-- Skills get a type (service | faq | policy) and search keywords. Applied once by wrangler.
ALTER TABLE skills ADD COLUMN kind TEXT NOT NULL DEFAULT 'service';
ALTER TABLE skills ADD COLUMN keywords TEXT NOT NULL DEFAULT '';
