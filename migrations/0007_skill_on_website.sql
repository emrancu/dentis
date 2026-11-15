-- A service can be known to the voice agent but hidden from the website. Applied once by wrangler.
ALTER TABLE skills ADD COLUMN on_website INTEGER NOT NULL DEFAULT 1;
