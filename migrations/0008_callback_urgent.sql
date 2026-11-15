-- The agent can mark a callback as urgent (pain emergency, complaint) so staff call those first. Applied once by wrangler.
ALTER TABLE callbacks ADD COLUMN urgent INTEGER NOT NULL DEFAULT 0;
