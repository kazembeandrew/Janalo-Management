import { supabase } from '@/lib/supabase';

export type NotificationType = 'success' | 'warning' | 'error' | 'info';

export interface CreateNotificationOptions {
  userId: string;
  title: string;
  message: string;
  link?: string;
  type?: NotificationType;
}

export const createNotification = async (options: CreateNotificationOptions): Promise<void> => {
  const { userId, title, message, link, type = 'info' } = options;
  
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    link,
    type
  });

  if (error) {
    console.error('Failed to create notification:', error);
  }
};

export const notifyTaskAssigned = async (
  userId: string, 
  taskTitle: string
): Promise<void> => {
  await createNotification({
    userId,
    title: 'New Task Assigned',
    message: `CEO has authorized the task: "${taskTitle}". You can now start working on it.`,
    link: '/tasks',
    type: 'success'
  });
};

export const notifyTaskCompleted = async (
  userId: string, 
  taskTitle: string
): Promise<void> => {
  await createNotification({
    userId,
    title: 'Task Completed',
    message: `CEO has marked your task "${taskTitle}" as completed.`,
    link: '/tasks',
    type: 'success'
  });
};

export const notifyExpenseApproved = async (
  userId: string,
  description: string,
  amountFormatted: string
): Promise<void> => {
  await createNotification({
    userId,
    title: 'Expense Approved',
    message: `Your expense for "${description}" (${amountFormatted}) has been authorized.`,
    link: '/expenses',
    type: 'success'
  });
};
