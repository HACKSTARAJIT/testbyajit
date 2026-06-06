
CREATE POLICY "Authenticated read study materials" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'study-materials');
CREATE POLICY "Admins upload study materials" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'study-materials' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update study materials" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'study-materials' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete study materials" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'study-materials' AND public.has_role(auth.uid(), 'admin'));
