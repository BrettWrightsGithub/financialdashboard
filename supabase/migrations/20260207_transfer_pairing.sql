-- Transfer pairing metadata for deterministic and manual link flows.
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS transfer_pair_id UUID REFERENCES transactions(id),
ADD COLUMN IF NOT EXISTS transfer_match_confidence NUMERIC(4,3),
ADD COLUMN IF NOT EXISTS transfer_match_source TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_pair
ON transactions (transfer_pair_id)
WHERE transfer_pair_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_amount_date
ON transactions (amount, date)
WHERE is_transfer = FALSE;
