
CREATE POLICY "mock-uploads user select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mock-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "mock-uploads user insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mock-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "mock-uploads user delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mock-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
