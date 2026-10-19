import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function usePersonalTasks() {
  const { user } = useAuth();
  const client = useQueryClient();
  const key = ['personal-tasks', user?.id];
  const query = useQuery({ queryKey: key, enabled: !!user, queryFn: async () => {
    const [lists, tasks] = await Promise.all([
      supabase.from('personal_task_lists').select('*').eq('user_id', user?.id ?? '').order('created_at'),
      supabase.from('personal_tasks').select('*').eq('user_id', user?.id ?? '').order('created_at'),
    ]);
    if (lists.error) throw lists.error;
    if (tasks.error) throw tasks.error;
    return { lists: lists.data, tasks: tasks.data };
  }});
  const mutation = useMutation({ mutationFn: async (operation: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (!user) throw new Error('Sign in to save your tasks.');
    const result = await operation();
    if (result.error) throw new Error(result.error.message.includes('duplicate key') ? 'A task with this name already exists in this list.' : result.error.message);
  }, onSuccess: async () => { await client.invalidateQueries({queryKey:key}); toast.success('Saved'); }, onError: (e) => toast.error(e.message) });
  return { ...query, user, lists: query.data?.lists ?? [], tasks: query.data?.tasks ?? [], save: mutation.mutateAsync, saving: mutation.isPending };
}
