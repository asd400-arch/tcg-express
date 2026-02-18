-- Add KYC columns to express_users for driver verification
ALTER TABLE express_users
  ADD COLUMN IF NOT EXISTS driver_type TEXT,
  ADD COLUMN IF NOT EXISTS nric_number TEXT,
  ADD COLUMN IF NOT EXISTS business_reg_number TEXT,
  ADD COLUMN IF NOT EXISTS nric_front_url TEXT,
  ADD COLUMN IF NOT EXISTS nric_back_url TEXT,
  ADD COLUMN IF NOT EXISTS license_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS business_reg_cert_url TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_insurance_url TEXT;
