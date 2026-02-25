-- Add equipment_charges column to express_bids
-- Stores special equipment charges as JSONB array: [{ "name": "Pallet Jack", "amount": 50 }]
ALTER TABLE express_bids ADD COLUMN IF NOT EXISTS equipment_charges JSONB DEFAULT '[]';
