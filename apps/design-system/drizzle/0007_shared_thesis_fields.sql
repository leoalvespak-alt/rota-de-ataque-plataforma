ALTER TABLE editorial_theses
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tenets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS active boolean,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'design-system',
  ADD COLUMN IF NOT EXISTS design_thesis_id uuid;

UPDATE editorial_theses
   SET description = COALESCE(NULLIF(description, ''), summary, core_statement, title),
       active = COALESCE(active, status = 'active'),
       design_thesis_id = COALESCE(design_thesis_id, id);
