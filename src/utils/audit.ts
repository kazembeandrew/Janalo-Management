import { supabase } from '@/lib/supabase';

export const recordAuditLog = async (
  action: string,
  entityType: string,
  entityId: string,
  details: any = {}
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details
    });
  } catch (error) {
    console.error('Failed to record audit log:', error);
  }
};