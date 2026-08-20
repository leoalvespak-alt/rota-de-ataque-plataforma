-- Reverse type conversions (data may be lost for non-plain-string cta values)
ALTER TABLE scheduled_publications
  ALTER COLUMN hashtags TYPE text[]  USING ARRAY(SELECT jsonb_array_elements_text(hashtags)),
  ALTER COLUMN cta      TYPE text    USING cta #>> '{}';
