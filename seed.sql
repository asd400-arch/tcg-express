-- Run this in Supabase SQL Editor to create admin account
-- Login: admin@tcgexpress.com / admin123

INSERT INTO express_users (email, password_hash, role, contact_name, phone, is_active, is_verified, driver_status)
VALUES ('admin@tcgexpress.com', 'admin123', 'admin', 'Admin', '+65 0000 0000', true, true, 'approved')
ON CONFLICT (email) DO NOTHING;

-- Test client account
-- Login: client@test.com / test123
INSERT INTO express_users (email, password_hash, role, contact_name, phone, company_name, is_active, is_verified)
VALUES ('client@test.com', 'test123', 'client', 'Test Company', '+65 1111 1111', 'Test Corp Pte Ltd', true, true)
ON CONFLICT (email) DO NOTHING;

-- Test driver account (pre-approved)
-- Login: driver@test.com / test123
INSERT INTO express_users (email, password_hash, role, contact_name, phone, vehicle_type, vehicle_plate, license_number, driver_status, is_active, is_verified)
VALUES ('driver@test.com', 'test123', 'driver', 'Test Driver', '+65 2222 2222', 'car', 'SBA1234A', 'S1234567D', 'approved', true, true)
ON CONFLICT (email) DO NOTHING;
