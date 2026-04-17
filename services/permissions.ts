import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface Permission {
    id: string;
    name: string;
    category: 'module' | 'action' | 'data' | 'special';
    description: string;
    is_active: boolean;
}

export interface UserPermission {
    user_id: string;
    permission_id: string;
    granted: boolean;
    granted_at: string;
    granted_by: string;
}

export interface PermissionTemplate {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    created_at: string;
}

class PermissionService {
    private profile: any;

    constructor() {
        this.profile = null;
    }

    setProfile(profile: any) {
        this.profile = profile;
    }

    /**
     * Check if current user has a specific permission
     */
    async hasPermission(permissionName: string): Promise<boolean> {
        if (!this.profile) {
            const { data: { session } } = await (supabase as any).auth.getSession();
            if (!session?.user) return false;
            
            const { data: profile } = await (supabase as any)
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();
            
            this.profile = profile;
        }

        if (!this.profile) return false;

        // Map legacy permission names to resource/action
        const { resource, action } = this.parsePermission(permissionName);

        try {
            const { data, error } = await (supabase as any)
                .rpc('has_permission', {
                    p_user_id: this.profile.id,
                    p_resource: resource,
                    p_action: action
                });

            if (error) throw error;
            return !!data;
        } catch (error) {
            console.error('Error checking permission:', error);
            return false;
        }
    }

    /**
     * Helper to map legacy strings to database resource/action pairs
     */
    private parsePermission(name: string): { resource: string, action: string } {
        // Special hardcoded mappings first
        const mappings: Record<string, { resource: string, action: string }> = {
            'approve_loan': { resource: 'loans', action: 'approve' },
            'disburse_loan': { resource: 'loans', action: 'disburse' },
            'create_loan': { resource: 'loans', action: 'create' },
            'edit_loan': { resource: 'loans', action: 'update' },
            'view_loans': { resource: 'loans', action: 'view' },
            'financial_approval': { resource: 'journal_entries', action: 'approve' },
            'system_admin': { resource: 'users', action: 'manage_roles' },
            'manage_users': { resource: 'users', action: 'update' },
            'view_users': { resource: 'users', action: 'read' },
            'view_audit_logs': { resource: 'audit_logs', action: 'read' },
            'approve_deletion': { resource: 'users', action: 'approve_deletion' }
        };

        if (mappings[name]) return mappings[name];

        // Generic patterns
        if (name.startsWith('view_')) return { resource: name.replace('view_', ''), action: 'read' };
        if (name.startsWith('create_')) return { resource: name.replace('create_', ''), action: 'create' };
        if (name.startsWith('edit_')) return { resource: name.replace('edit_', ''), action: 'update' };
        if (name.startsWith('delete_')) return { resource: name.replace('delete_', ''), action: 'delete' };
        if (name.startsWith('can_')) return { resource: 'general', action: name.replace('can_', '') };

        return { resource: 'general', action: name };
    }

    /**
     * Get all permissions for current user
     */
    async getUserPermissions(): Promise<Array<{permission_name: string, category: string, granted: boolean}>> {
        if (!this.profile) {
            const { data: { session } } = await (supabase as any).auth.getSession();
            if (!session?.user) return [];
            
            const { data: profile } = await (supabase as any)
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();
            
            this.profile = profile;
        }

        try {
            const { data, error } = await (supabase as any)
                .rpc('get_user_permissions', {
                    user_uuid: this.profile.id
                });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting user permissions:', error);
            return [];
        }
    }

    /**
     * Check if user can access a specific module
     */
    async canAccessModule(moduleName: string): Promise<boolean> {
        const permissionName = `view_${moduleName}`;
        return await this.hasPermission(permissionName);
    }

    /**
     * Check if user can perform a specific action
     */
    async canPerformAction(actionName: string): Promise<boolean> {
        const permissionName = actionName.startsWith('can_') ? actionName : `can_${actionName}`;
        return await this.hasPermission(permissionName);
    }

    /**
     * Get all available permissions
     */
    async getAvailablePermissions(): Promise<Permission[]> {
        try {
            const { data, error } = await (supabase as any)
                .from('permissions')
                .select('*')
                .eq('is_active', true)
                .order('category, name');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting available permissions:', error);
            return [];
        }
    }

    /**
     * Get all user permissions with details
     */
    async getAllUserPermissions(): Promise<UserPermission[]> {
        try {
            const { data, error } = await (supabase as any)
                .from('user_permissions')
                .select('*');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting user permissions:', error);
            return [];
        }
    }

    /**
     * Grant permission to user
     */
    async grantPermission(userId: string, permissionId: string): Promise<boolean> {
        try {
            const { error } = await (supabase as any)
                .from('user_permissions')
                .insert({
                    user_id: userId,
                    permission_id: permissionId,
                    granted_by: this.profile?.id
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error granting permission:', error);
            return false;
        }
    }

    /**
     * Revoke permission from user
     */
    async revokePermission(userId: string, permissionId: string): Promise<boolean> {
        try {
            const { error } = await (supabase as any)
                .from('user_permissions')
                .delete()
                .eq('user_id', userId)
                .eq('permission_id', permissionId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error revoking permission:', error);
            return false;
        }
    }

    /**
     * Get all permission templates
     */
    async getPermissionTemplates(): Promise<PermissionTemplate[]> {
        try {
            const { data, error } = await (supabase as any)
                .from('permission_templates')
                .select('*')
                .order('name');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting permission templates:', error);
            return [];
        }
    }

    /**
     * Create a new permission template
     */
    async createTemplate(name: string, description: string, permissionIds: string[]): Promise<boolean> {
        try {
            const { error } = await (supabase as any)
                .from('permission_templates')
                .insert({
                    name,
                    description,
                    permissions: permissionIds,
                    created_by: this.profile?.id
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error creating permission template:', error);
            return false;
        }
    }

    /**
     * Apply template to user
     */
    async applyTemplateToUser(templateId: string, userId: string): Promise<boolean> {
        try {
            // Remove existing permissions for user
            await (supabase as any)
                .from('user_permissions')
                .delete()
                .eq('user_id', userId);

            // Get template permissions
            const { data: template, error: templateError } = await (supabase as any)
                .from('permission_templates')
                .select('permissions')
                .eq('id', templateId)
                .single();

            if (templateError) throw templateError;
            if (!template) return false;

            // Apply template permissions
            const permissions = template.permissions;
            if (permissions.length === 0) return true;

            const operations = permissions.map(permissionId =>
                (supabase as any).from('user_permissions').insert({
                    user_id: userId,
                    permission_id: permissionId,
                    granted_by: this.profile?.id
                })
            );

            await Promise.all(operations);
            return true;
        } catch (error) {
            console.error('Error applying template to user:', error);
            return false;
        }
    }

    /**
     * Bulk grant permissions to multiple users
     */
    async bulkGrantPermissions(userIds: string[], permissionIds: string[]): Promise<boolean> {
        try {
            const operations = [];
            
            for (const userId of userIds) {
                for (const permissionId of permissionIds) {
                    operations.push(
                        (supabase as any).from('user_permissions').insert({
                            user_id: userId,
                            permission_id: permissionId,
                            granted_by: this.profile?.id
                        })
                    );
                }
            }

            await Promise.all(operations);
            return true;
        } catch (error) {
            console.error('Error in bulk grant permissions:', error);
            return false;
        }
    }

    /**
     * Bulk revoke permissions from multiple users
     */
    async bulkRevokePermissions(userIds: string[], permissionIds: string[]): Promise<boolean> {
        try {
            const operations = [];
            
            for (const userId of userIds) {
                for (const permissionId of permissionIds) {
                    operations.push(
                        (supabase as any).from('user_permissions').delete()
                            .eq('user_id', userId)
                            .eq('permission_id', permissionId)
                    );
                }
            }

            await Promise.all(operations);
            return true;
        } catch (error) {
            console.error('Error in bulk revoke permissions:', error);
            return false;
        }
    }

    /**
     * Check if user has any admin-level permissions
     */
    async isAdmin(): Promise<boolean> {
        const adminPermissions = [
            'system_admin',
            'manage_permissions',
            'view_audit_logs'
        ];

        for (const permission of adminPermissions) {
            if (await this.hasPermission(permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if user has financial permissions
     */
    async hasFinancialPermissions(): Promise<boolean> {
        const financialPermissions = [
            'view_financial',
            'view_accounts',
            'view_statements',
            'view_budgets',
            'view_ledger',
            'financial_approval'
        ];

        for (const permission of financialPermissions) {
            if (await this.hasPermission(permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if user has loan management permissions
     */
    async hasLoanPermissions(): Promise<boolean> {
        const loanPermissions = [
            'view_loans',
            'create_loan',
            'edit_loan',
            'approve_loan',
            'disburse_loan'
        ];

        for (const permission of loanPermissions) {
            if (await this.hasPermission(permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if user can create loans
     */
    async canCreateLoan(): Promise<boolean> {
        return await this.hasPermission('create_loan');
    }

    /**
     * Check if user can edit loans
     */
    async canEditLoan(): Promise<boolean> {
        return await this.hasPermission('edit_loan');
    }

    /**
     * Check if user can view loans
     */
    async canViewLoans(): Promise<boolean> {
        return await this.hasPermission('view_loans');
    }

    /**
     * Check if user can import data
     */
    async canImportData(): Promise<boolean> {
        return await this.hasPermission('import_data');
    }

    /**
     * Check if user can manage users
     */
    async canManageUsers(): Promise<boolean> {
        return await this.hasPermission('manage_users');
    }

    /**
     * Check if user can view users
     */
    async canViewUsers(): Promise<boolean> {
        return await this.hasPermission('view_users');
    }
}

// Create singleton instance
export const permissionService = new PermissionService();

// Hook for React components
export const usePermissions = () => {
    const { profile, effectiveRoles } = useAuth();

    useEffect(() => {
        permissionService.setProfile(profile);
    }, [profile]);

    // Synchronous role checking for effective roles (including delegation)
    const hasRole = (role: string): boolean => {
        if (!profile) return false;
        return effectiveRoles.some(r => r === role);
    };

    const hasAnyRole = (roles: string[]): boolean => {
        if (!profile) return false;
        return roles.some(role => hasRole(role));
    };

    const isAdmin = (): boolean => {
        return hasAnyRole(['admin', 'ceo']);
    };

    const isLoanOfficer = (): boolean => {
        return hasRole('loan_officer');
    };

    const canArchiveUser = (): boolean => {
        return hasAnyRole(['admin', 'ceo']);
    };

    const canEditLoan = (): boolean => {
        return hasAnyRole(['admin', 'loan_officer', 'manager']);
    };

    const canCreateLoan = (): boolean => {
        return hasAnyRole(['admin', 'loan_officer', 'manager']);
    };

    const canReviewLoan = (): boolean => {
        return hasAnyRole(['admin', 'ceo']);
    };

    return {
        hasPermission: permissionService.hasPermission.bind(permissionService),
        getUserPermissions: permissionService.getUserPermissions.bind(permissionService),
        canAccessModule: permissionService.canAccessModule.bind(permissionService),
        canPerformAction: permissionService.canPerformAction.bind(permissionService),
        getAvailablePermissions: permissionService.getAvailablePermissions.bind(permissionService),
        getAllUserPermissions: permissionService.getAllUserPermissions.bind(permissionService),
        grantPermission: permissionService.grantPermission.bind(permissionService),
        revokePermission: permissionService.revokePermission.bind(permissionService),
        getPermissionTemplates: permissionService.getPermissionTemplates.bind(permissionService),
        createTemplate: permissionService.createTemplate.bind(permissionService),
        applyTemplateToUser: permissionService.applyTemplateToUser.bind(permissionService),
        bulkGrantPermissions: permissionService.bulkGrantPermissions.bind(permissionService),
        bulkRevokePermissions: permissionService.bulkRevokePermissions.bind(permissionService),
        hasFinancialPermissions: permissionService.hasFinancialPermissions.bind(permissionService),
        hasLoanPermissions: permissionService.hasLoanPermissions.bind(permissionService),
        canCreateLoan: permissionService.canCreateLoan.bind(permissionService),
        canEditLoan: permissionService.canEditLoan.bind(permissionService),
        canViewLoans: permissionService.canViewLoans.bind(permissionService),
        canImportData: permissionService.canImportData.bind(permissionService),
        canManageUsers: permissionService.canManageUsers.bind(permissionService),
        canViewUsers: permissionService.canViewUsers.bind(permissionService),
        // New synchronous role-based methods
        hasRole,
        hasAnyRole,
        isAdmin: () => hasRole('admin') || hasRole('ceo'),
        isLoanOfficer,
        canArchiveUser,
        canReviewLoan
    };
};
