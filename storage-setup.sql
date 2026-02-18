-- Run in Supabase SQL Editor to create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('express-uploads', 'express-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to uploaded files
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'express-uploads');
CREATE POLICY "Anyone can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'express-uploads');
CREATE POLICY "Anyone can update" ON storage.objects FOR UPDATE USING (bucket_id = 'express-uploads');
CREATE POLICY "Anyone can delete" ON storage.objects FOR DELETE USING (bucket_id = 'express-uploads');
