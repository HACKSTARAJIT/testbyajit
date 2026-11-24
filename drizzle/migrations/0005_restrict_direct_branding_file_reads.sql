DROP POLICY "branding read for anon" ON storage.objects;
DROP POLICY "branding read for authenticated" ON storage.objects;
CREATE POLICY "branding owner read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'branding' AND owner_id = (SELECT auth.uid()::text));