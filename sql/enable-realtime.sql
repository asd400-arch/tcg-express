-- Enable Supabase Realtime on required tables
-- Run this in Supabase SQL Editor

ALTER PUBLICATION supabase_realtime ADD TABLE express_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE express_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE express_bids;
ALTER PUBLICATION supabase_realtime ADD TABLE express_driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE express_notifications;
