-- Agent knowledge has no keywords field: the agent picks entries by title and description.
ALTER TABLE skills DROP COLUMN keywords;
