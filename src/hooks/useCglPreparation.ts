import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { defaultConfig, preparationDate, type StudyConfig } from '@/lib/cglPreparation';
import { localDate } from '@/lib/cglPreparation';
import { detailsOf } from '@/lib/externalMocks';
import { toast } from 'sonner';

export function usePreparationWrite() {
  const { user } = useAuth(); const client = useQueryClient();
  const write = useMutation({ mutationFn: async (operation: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (!user) throw new Error('Sign in to save your preparation.');
    const { error } = await operation(); if (error) throw new Error(error.message);
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ['cgl', user?.id] }); toast.success('Saved'); }, onError: (e) => toast.error(e.message) });
  return { user, save: write.mutateAsync, saving: write.isPending };
}
export function useStudyConfig() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['cgl', user?.id, 'settings'], enabled: !!user, queryFn: async () => {
    const [settings, target, goal] = await Promise.all([
      supabase.from('cgl_study_settings').select('settings').eq('user_id', user?.id ?? '').maybeSingle(),
      supabase.from('user_exam_targets').select('*').eq('user_id', user?.id ?? '').eq('exam_name', 'SSC CGL Tier-2').maybeSingle(),
      supabase.from('study_time_goals').select('daily_goal_seconds').eq('user_id', user?.id ?? '').maybeSingle(),
    ]);
    if (settings.error) throw settings.error; if (target.error) throw target.error; if (goal.error) throw goal.error;
    const stored = (settings.data?.settings ?? {}) as unknown as Partial<StudyConfig>;
    const config: StudyConfig = { ...defaultConfig, ...(goal.data?.daily_goal_seconds ? { dailyHours: goal.data.daily_goal_seconds / 3600 } : {}), ...stored,
      examDate: target.data?.exam_date ?? stored.examDate ?? '',
      targets: stored.targets?.length ? stored.targets : target.data?.target_score !== null && target.data?.target_score !== undefined ? [{ name: 'Final', score: target.data.target_score }] : [],
    };
    return { config, configured: !!settings.data };
  } });
}
export function useExternalMocks() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['cgl', user?.id, 'external'], enabled: !!user, queryFn: async () => {
    const { data, error } = await supabase.from('imported_mock_reports').select('*').eq('user_id', user?.id ?? '').eq('entry_kind', 'manual_external').order('created_at', { ascending: false }).limit(500);
    if (error) throw error; return (data ?? []).filter(r => r.manual_details !== null);
  } });
}
export function useRevisionData() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['cgl', user?.id, 'revision'], enabled: !!user, queryFn: async () => {
    const [schedules, attempts] = await Promise.all([
      supabase.from('spaced_revision_schedules').select('*').eq('user_id', user?.id ?? '').order('due_date').limit(1000),
      supabase.from('spaced_revision_attempts').select('*').eq('user_id', user?.id ?? '').order('created_at', { ascending: false }).limit(1000),
    ]);
    if (schedules.error) throw schedules.error; if (attempts.error) throw attempts.error;
    const wrongIds = schedules.data?.flatMap(s => s.wrong_question_id ? [s.wrong_question_id] : []) ?? [];
    const mockIds = schedules.data?.flatMap(s => s.mock_question_id ? [s.mock_question_id] : []) ?? [];
    const [wrong, mock] = await Promise.all([
      wrongIds.length ? supabase.from('wrong_questions').select('id,question_text,topic,test_name,wrong_count,subject_id,subjects(name)').eq('user_id', user?.id ?? '').in('id', wrongIds) : Promise.resolve({ data: [], error: null }),
      mockIds.length ? supabase.from('mock_mistake_questions').select('id,question_text,ai_topic,topic,ai_subject,wrong_count,mock_mistake_mocks(name,subject)').eq('user_id', user?.id ?? '').in('id', mockIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (wrong.error) throw wrong.error; if (mock.error) throw mock.error;
    const metadata = new Map<string, { text: string; subject: string; topic: string; source: string; wrong: number }>();
    wrong.data?.forEach(q => metadata.set(`wrong:${q.id}`, { text: q.question_text ?? 'App Test question', subject: q.subjects?.name ?? 'App Test', topic: q.topic ?? '', source: q.test_name ?? 'Wrong Questions', wrong: q.wrong_count }));
    mock.data?.forEach(q => metadata.set(`mock:${q.id}`, { text: q.question_text, subject: q.ai_subject ?? q.mock_mistake_mocks?.subject ?? 'Mock Mistakes', topic: q.ai_topic ?? q.topic ?? '', source: q.mock_mistake_mocks?.name ?? 'Mock', wrong: q.wrong_count }));
    return { schedules: schedules.data ?? [], attempts: attempts.data ?? [], metadata };
  } });
}
export function useCommandData(config: StudyConfig) {
  const { user } = useAuth(); const date = preparationDate(config); const calendarDate = localDate(new Date(), config.timezone);
  return useQuery({ queryKey: ['cgl', user?.id, 'command', date, calendarDate], enabled: !!user, queryFn: async () => {
    const [tasks, study, reviews, internal, typing] = await Promise.all([
      supabase.from('cgl_command_tasks').select('*').eq('user_id', user?.id ?? '').order('task_date', { ascending: false }).limit(500),
      supabase.from('study_time_entries').select('duration_seconds,subject_name').eq('user_id', user?.id ?? '').eq('study_date', calendarDate).eq('needs_confirmation', false),
      supabase.from('daily_reviews').select('command_review').eq('user_id', user?.id ?? '').eq('review_date', date).maybeSingle(),
      supabase.from('test_attempts').select('id,marks_obtained,accuracy,created_at,tests(title,total_marks,subjects(name))').eq('user_id', user?.id ?? '').eq('status', 'completed').order('created_at', { ascending: false }).limit(30),
      supabase.from('cgl_command_tasks').select('task_date,typing_wpm,typing_accuracy').eq('user_id', user?.id ?? '').not('typing_wpm', 'is', null).order('task_date').limit(100),
    ]);
    for (const result of [tasks, study, reviews, internal, typing]) if (result.error) throw result.error;
    return { date, calendarDate, tasks: tasks.data ?? [], studySeconds: study.data?.reduce((sum, s) => sum + s.duration_seconds, 0) ?? 0, review: reviews.data?.command_review,
      internal: internal.data ?? [], typing: typing.data ?? [] };
  } });
}
export const fullExternalMocks = (rows: ReturnType<typeof useExternalMocks>['data']) => (rows ?? []).map(detailsOf).filter(d => d.type === 'Full Mock');