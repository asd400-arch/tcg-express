-- Run in Supabase SQL Editor to create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('express-uploads', 'express-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public READ access to uploaded files (for displaying images)
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'express-uploads');

-- Block anon INSERT/UPDATE/DELETE — all writes go through API route with service role key
-- If old permissive policies exist, drop them first:
DROP POLICY IF EXISTS "Anyone can upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
