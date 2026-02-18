-- Run this in Supabase SQL Editor to create test accounts
-- All passwords are bcrypt-hashed (12 rounds)

-- Admin Account
-- Login: admin@tcgexpress.com / admin123
INSERT INTO express_users (email, password_hash, role, contact_name, phone, is_active, is_verified, driver_status)
VALUES ('admin@tcgexpress.com', '$2b$12$XN6VcMlFXU1EYPOIoOieI./CwY2jUE4SwUvs3wBfV0Yze3cnnZyh6', 'admin', 'Admin', '+65 0000 0000', true, true, 'approved')
ON CONFLICT (email) DO NOTHING;

-- Test client account
-- Login: client@test.com / test123
INSERT INTO express_users (email, password_hash, role, contact_name, phone, company_name, is_active, is_verified)
VALUES ('client@test.com', '$2b$12$lNoP6N/efR8e0xvJt0uMaeNzmjofWW9tGHMVrE6Zq/x1DVqNDj/ne', 'client', 'Test Company', '+65 1111 1111', 'Test Corp Pte Ltd', true, true)
ON CONFLICT (email) DO NOTHING;

-- Test driver account (pre-approved)
-- Login: driver@test.com / test123
INSERT INTO express_users (email, password_hash, role, contact_name, phone, vehicle_type, vehicle_plate, license_number, driver_status, is_active, is_verified)
VALUES ('driver@test.com', '$2b$12$lNoP6N/efR8e0xvJt0uMaeNzmjofWW9tGHMVrE6Zq/x1DVqNDj/ne', 'driver', 'Test Driver', '+65 2222 2222', 'car', 'SBA1234A', 'S1234567D', 'approved', true, true)
ON CONFLICT (email) DO NOTHING;
