import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface AuditLog {
    id: string;
    user_id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: any;
    created_at: string;
    users?: {
        full_name: string;
    };
}

export interface PermissionAuditLog extends AuditLog {
    details: {
        user_id: string;
        permission_id: string;
        permission_name: string;
        granted: boolean;
        granted_by: string;
        previous_status?: boolean;
        bulk_operation?: boolean;
        affected_users?: string[];
        template_id?: string;
        template_name?: string;
    };
}

class AuditService {
    private profile: any;

    constructor() {
        this.profile = null;
    }

    setProfile(profile: any) {
        this.profile = profile;
    }

    /**
     * Log a general audit entry
     */
    async logAudit(
        action: string,
        entity_type: string,
        entity_id: string,
        details: any
    ): Promise<boolean> {
        try {
            const { error } = await (supabase as any).from('audit_logs').insert({
                user_id: this.profile?.id,
                action,
                entity_type,
                entity_id,
                details
            });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error logging audit:', error);
            return false;
        }
    }

    /**
     * Log a permission change
     */
    async logPermissionChange(
        action: 'Permission Granted' | 'Permission Revoked' | 'Bulk Grant' | 'Bulk Revoke' | 'Template Applied',
        details: any,
        targetUserId: string
    ): Promise<boolean> {
        try {
            const { error } = await (supabase as any).from('audit_logs').insert({
                user_id: this.profile?.id,
                action,
                entity_type: 'permission',
                entity_id: targetUserId,
                details
            });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error logging permission change:', error);
            return false;
        }
    }

    /**
     * Log a permission template operation
     */
    async logTemplateOperation(
        action: 'Template Created' | 'Template Applied' | 'Template Deleted',
        details: any,
        targetUserId: string
    ): Promise<boolean> {
        try {
            const { error } = await (supabase as any).from('audit_logs').insert({
                user_id: this.profile?.id,
                action,
                entity_type: 'permission_template',
                entity_id: targetUserId,
                details
            });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error logging template operation:', error);
            return false;
        }
    }

    /**
     * Get permission audit logs
     */
    async getPermissionAuditLogs(
        userId?: string,
        action?: string,
        startDate?: string,
        endDate?: string,
        limit: number = 100
    ): Promise<PermissionAuditLog[]> {
        try {
            let query = (supabase as any)
                .from('audit_logs')
                .select(`
                    *,
                    users!audit_logs_user_id_fkey(full_name)
                `)
                .eq('entity_type', 'permission')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (userId) {
                query = query.eq('user_id', userId);
            }

            if (action) {
                query = query.eq('action', action);
            }

            if (startDate) {
                query = query.gte('created_at', startDate);
            }

            if (endDate) {
                query = query.lte('created_at', endDate);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as PermissionAuditLog[];
        } catch (error) {
            console.error('Error getting permission audit logs:', error);
            return [];
        }
    }

    /**
     * Get template audit logs
     */
    async getTemplateAuditLogs(
        userId?: string,
        action?: string,
        startDate?: string,
        endDate?: string,
        limit: number = 50
    ): Promise<PermissionAuditLog[]> {
        try {
            let query = (supabase as any)
                .from('audit_logs')
                .select(`
                    *,
                    users!audit_logs_user_id_fkey(full_name)
                `)
                .eq('entity_type', 'permission_template')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (userId) {
                query = query.eq('user_id', userId);
            }

            if (action) {
                query = query.eq('action', action);
            }

            if (startDate) {
                query = query.gte('created_at', startDate);
            }

            if (endDate) {
                query = query.lte('created_at', endDate);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as PermissionAuditLog[];
        } catch (error) {
            console.error('Error getting template audit logs:', error);
            return [];
        }
    }

    /**
     * Get all audit logs for a specific user
     */
    async getUserAuditLogs(
        targetUserId: string,
        limit: number = 100
    ): Promise<AuditLog[]> {
        try {
            const { data, error } = await (supabase as any)
                .from('audit_logs')
                .select(`
                    *,
                    users!audit_logs_user_id_fkey(full_name)
                `)
                .eq('entity_id', targetUserId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data as AuditLog[];
        } catch (error) {
            console.error('Error getting user audit logs:', error);
            return [];
        }
    }

    /**
     * Get security-related audit logs
     */
    async getSecurityAuditLogs(
        startDate?: string,
        endDate?: string,
        limit: number = 100
    ): Promise<AuditLog[]> {
        try {
            const securityActions = [
                'Permission Granted',
                'Permission Revoked', 
                'Bulk Grant',
                'Bulk Revoke',
                'Template Applied',
                'Template Created',
                'User Created',
                'User Promoted',
                'Access Revoked',
                'Role Delegated',
                'Delegation Cleared'
            ];

            let query = (supabase as any)
                .from('audit_logs')
                .select(`
                    *,
                    users!audit_logs_user_id_fkey(full_name)
                `)
                .in('action', securityActions)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (startDate) {
                query = query.gte('created_at', startDate);
            }

            if (endDate) {
                query = query.lte('created_at', endDate);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as AuditLog[];
        } catch (error) {
            console.error('Error getting security audit logs:', error);
            return [];
        }
    }

    /**
     * Export audit logs to CSV
     */
    exportAuditLogsToCSV(logs: AuditLog[], filename: string = 'audit_logs'): void {
        const headers = [
            'Timestamp',
            'User',
            'Action',
            'Entity Type',
            'Entity ID',
            'Details'
        ];

        const rows = logs.map(log => [
            new Date(log.created_at).toLocaleString(),
            log.users?.full_name || log.user_id,
            log.action,
            log.entity_type,
            log.entity_id,
            JSON.stringify(log.details)
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Get permission change summary
     */
    async getPermissionChangeSummary(
        startDate?: string,
        endDate?: string
    ): Promise<{
        totalChanges: number;
        grantedChanges: number;
        revokedChanges: number;
        bulkOperations: number;
        uniqueUsersAffected: number;
        topPermissions: Array<{name: string, count: number}>;
    }> {
        try {
            const { data, error } = await (supabase as any)
                .rpc('get_permission_change_summary', {
                    start_date: startDate,
                    end_date: endDate
                });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting permission change summary:', error);
            return {
                totalChanges: 0,
                grantedChanges: 0,
                revokedChanges: 0,
                bulkOperations: 0,
                uniqueUsersAffected: 0,
                topPermissions: []
            };
        }
    }

    /**
     * Check for suspicious permission activity
     */
    async checkSuspiciousActivity(
        userId: string,
        timeWindowHours: number = 24
    ): Promise<{
        hasSuspiciousActivity: boolean;
        issues: string[];
        recommendations: string[];
    }> {
        try {
            const { data, error } = await (supabase as any)
                .rpc('check_permission_suspicious_activity', {
                    user_id: userId,
                    time_window_hours: timeWindowHours
                });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error checking suspicious activity:', error);
            return {
                hasSuspiciousActivity: false,
                issues: [],
                recommendations: []
            };
        }
    }
}

// Create singleton instance
export const auditService = new AuditService();

// Hook for React components
export const useAudit = () => {
    const { profile } = useAuth();

    useEffect(() => {
        auditService.setProfile(profile);
    }, [profile]);

    return {
        logPermissionChange: auditService.logPermissionChange.bind(auditService),
        logTemplateOperation: auditService.logTemplateOperation.bind(auditService),
        getPermissionAuditLogs: auditService.getPermissionAuditLogs.bind(auditService),
        getTemplateAuditLogs: auditService.getTemplateAuditLogs.bind(auditService),
        getUserAuditLogs: auditService.getUserAuditLogs.bind(auditService),
        getSecurityAuditLogs: auditService.getSecurityAuditLogs.bind(auditService),
        exportAuditLogsToCSV: auditService.exportAuditLogsToCSV.bind(auditService),
        getPermissionChangeSummary: auditService.getPermissionChangeSummary.bind(auditService),
        checkSuspiciousActivity: auditService.checkSuspiciousActivity.bind(auditService)
    };
};