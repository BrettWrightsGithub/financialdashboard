-- Ensure accounts has editable profile fields used by the Accounts page.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS owner text,
  ADD COLUMN IF NOT EXISTS subtype text;

-- Backfill display_name from provider/raw name.
UPDATE public.accounts
SET display_name = COALESCE(NULLIF(display_name, ''), NULLIF(name, ''), 'Unnamed account')
WHERE COALESCE(NULLIF(display_name, ''), '') = '';

-- Backfill subtype from legacy account_type when available.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name = 'account_type'
  ) THEN
    EXECUTE '
      UPDATE public.accounts
      SET subtype = COALESCE(NULLIF(subtype, ''''), NULLIF(account_type, ''''), ''other'')
      WHERE COALESCE(NULLIF(subtype, ''''), '''') = ''''
    ';
  ELSE
    UPDATE public.accounts
    SET subtype = COALESCE(NULLIF(subtype, ''), 'other')
    WHERE COALESCE(NULLIF(subtype, ''), '') = '';
  END IF;
END $$;

-- Default owner where missing.
UPDATE public.accounts
SET owner = COALESCE(NULLIF(owner, ''), 'Joint')
WHERE COALESCE(NULLIF(owner, ''), '') = '';
