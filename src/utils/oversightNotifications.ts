import { supabase } from '@/lib/supabase';
import { createNotification } from '@/utils/notifications';
import type { NotificationAction, NotificationCategory, NotificationPriority } from '@/components/NotificationBell';

type OversightRelatedEntityType = 'loan' | 'expense' | 'task' | 'user';

interface NotifyOversightItemParams {
  relatedEntityType: OversightRelatedEntityType;
  relatedEntityId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  actions: NotificationAction[];
  link: string;
  excludeUserId?: string;
  senderId?: string;
}

export const getExecutiveUserIds = async (options?: { excludeUserId?: string }): Promise<string[]> => {
  const { excludeUserId } = options || {};

  const { data, error } = await supabase
    .from('users')
    .select('id')
    .or('role.eq.ceo,role.eq.admin');

  if (error) {
    console.error('[oversightNotifications] Failed to fetch exec/admin ids:', error);
    return [];
  }

  return (data || [])
    .map((u) => u.id as string)
    .filter((id) => (excludeUserId ? id !== excludeUserId : true));
};

const createDedupeAwareNotifications = async (params: NotifyOversightItemParams): Promise<void> => {
  const execUserIds = await getExecutiveUserIds({ excludeUserId: params.excludeUserId });
  if (execUserIds.length === 0) return;

  // Dedupe against active notifications for the same related entity.
  const { data: existing } = await supabase
    .from('notifications')
    .select('user_id')
    .in('user_id', execUserIds)
    .eq('related_entity_type', params.relatedEntityType)
    .eq('related_entity_id', params.relatedEntityId)
    .eq('is_archived', false);

  const existingUserIds = new Set((existing || []).map((n) => n.user_id as string));
  const toCreateUserIds = execUserIds.filter((id) => !existingUserIds.has(id));

  await Promise.all(
    toCreateUserIds.map((userId) =>
      createNotification({
        userId,
        title: params.title,
        message: params.message,
        link: params.link,
        type: 'warning',
        priority: params.priority,
        category: params.category,
        actions: params.actions,
        senderId: params.senderId,
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId
      })
    )
  );
};

export const notifyExecutivesForPendingLoan = async (params: {
  loanId: string;
  borrowerName: string;
  amountFormatted?: string;
  excludeUserId?: string;
  senderId?: string;
}): Promise<void> => {
  const amountPart = params.amountFormatted ? ` (${params.amountFormatted})` : '';

  return createDedupeAwareNotifications({
    relatedEntityType: 'loan',
    relatedEntityId: params.loanId,
    title: 'Executive Authorization Required: Loan',
    message: `Loan approval is pending for ${params.borrowerName}${amountPart}.`,
    category: 'loan',
    priority: 'high',
    link: `/loans/${params.loanId}`,
    excludeUserId: params.excludeUserId,
    senderId: params.senderId,
    actions: [
      { label: 'Review Loan', action: 'view_loan', url: `/loans/${params.loanId}`, primary: true }
    ]
  });
};

export const notifyExecutivesForPendingExpense = async (params: {
  expenseId: string;
  description: string;
  amountFormatted?: string;
  excludeUserId?: string;
  senderId?: string;
}): Promise<void> => {
  const amountPart = params.amountFormatted ? ` (${params.amountFormatted})` : '';

  return createDedupeAwareNotifications({
    relatedEntityType: 'expense',
    relatedEntityId: params.expenseId,
    title: 'Executive Authorization Required: Expense',
    message: `Expense approval is pending: "${params.description}"${amountPart}.`,
    category: 'expense',
    priority: 'medium',
    link: '/expenses',
    excludeUserId: params.excludeUserId,
    senderId: params.senderId,
    actions: [{ label: 'Review Expenses', action: 'view_expenses', url: '/expenses', primary: true }]
  });
};

export const notifyExecutivesForPendingTask = async (params: {
  taskId: string;
  title: string;
  excludeUserId?: string;
  senderId?: string;
}): Promise<void> => {
  return createDedupeAwareNotifications({
    relatedEntityType: 'task',
    relatedEntityId: params.taskId,
    title: 'Executive Authorization Required: Task',
    message: `Task approval is pending: "${params.title}".`,
    category: 'task',
    priority: 'medium',
    link: '/tasks',
    excludeUserId: params.excludeUserId,
    senderId: params.senderId,
    actions: [{ label: 'Review Tasks', action: 'view_tasks', url: '/tasks', primary: true }]
  });
};

export const notifyExecutivesForPendingUserArchive = async (params: {
  userId: string;
  fullName: string;
  excludeUserId?: string;
  senderId?: string;
}): Promise<void> => {
  return createDedupeAwareNotifications({
    relatedEntityType: 'user',
    relatedEntityId: params.userId,
    title: 'Executive Authorization Required: User Archive',
    message: `User archive approval is pending for ${params.fullName}.`,
    category: 'security',
    priority: 'low',
    link: '/users',
    excludeUserId: params.excludeUserId,
    senderId: params.senderId,
    actions: [{ label: 'Review Users', action: 'view_users', url: '/users', primary: true }]
  });
};

