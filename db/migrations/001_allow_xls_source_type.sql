DO $$
DECLARE
  existing_name TEXT;
BEGIN
  SELECT c.conname INTO existing_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'files'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%source_type%'
  LIMIT 1;

  IF existing_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE files DROP CONSTRAINT %I', existing_name);
  END IF;

  ALTER TABLE files
    ADD CONSTRAINT files_source_type_check
    CHECK (source_type IN ('pdf', 'docx', 'txt', 'xls', 'image'));
END $$;
