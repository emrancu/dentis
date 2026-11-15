-- Agent knowledge is one plain form: no separate Bangla fields.
-- Keep the Bangla title and description searchable by moving them into keywords, then drop the columns.
UPDATE skills SET keywords = TRIM(keywords || CASE WHEN keywords = '' THEN '' ELSE ', ' END || title_bn) WHERE title_bn <> '' AND instr(keywords, title_bn) = 0;
UPDATE skills SET content = TRIM(content || CASE WHEN content = '' THEN '' ELSE char(10) END || description_bn) WHERE description_bn <> '' AND instr(content, description_bn) = 0;
ALTER TABLE skills DROP COLUMN title_bn;
ALTER TABLE skills DROP COLUMN description_bn;
