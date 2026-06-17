import { useAuth } from '@/context/AuthContext';
import { UserRole, PermissionAction, PermissionResource } from '@/types';

/**
 * Unified permission checking hook that uses the effective roles from AuthContext.
 * This replaces all inline role === 'xxx' checks throughout the application.
 */
export const usePermissions = () => {
  const { effectiveRoles, profile } = useAuth();

  const hasRole = (role: UserRole): boolean => {
    return effectiveRoles.includes(role);
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.some(role => effectiveRoles.includes(role));
  };

  const isAdmin = (): boolean => hasRole('admin');
  const isCEO = (): boolean => hasRole('ceo') || hasRole('admin');
  const isHR = (): boolean => hasRole('hr');
  const isAccountant = (): boolean => hasRole('accountant');
  const isLoanOfficer = (): boolean => hasRole('loan_officer');

  /**
   * Check if user can perform action on resource
   * Uses centralized permission logic based on role hierarchy
   */
  const can = (action: PermissionAction, resource?: string): boolean => {
    // Executive roles (admin/ceo) can do everything
    if (isCEO()) return true;

    // HR-specific permissions
    if (isHR()) {
      if (['create', 'read', 'update'].includes(action) && resource === 'user') return true;
      if (['read'].includes(action) && resource === 'document') return true;
    }

    // Accountant-specific permissions
    if (isAccountant()) {
      if (['create', 'read', 'update'].includes(action) && ['transaction', 'journal_entry', 'account'].includes(resource || '')) return true;
      if (['read'].includes(action) && resource === 'report') return true;
      if (['create', 'read'].includes(action) && resource === 'document') return true;
    }

    // Loan officer permissions
    if (isLoanOfficer()) {
      if (['create', 'read', 'update'].includes(action) && resource === 'borrower') return true;
      if (['create', 'read'].includes(action) && resource === 'loan') return true;
      if (['read'].includes(action) && resource === 'repayment') return true;
      if (['create', 'read'].includes(action) && resource === 'document') return true;
      if (['read'].includes(action) && resource === 'visit') return true;
    }

    return false;
  };

  /**
   * Check if user can access a specific page/route
   */
  const canAccess = (page: string): boolean => {
    const pagePermissions: Record<string, UserRole[]> = {
      'dashboard': ['admin', 'ceo', 'hr', 'accountant', 'loan_officer'],
      'users': ['admin', 'ceo', 'hr'],
      'borrowers': ['admin', 'ceo', 'loan_officer'],
      'loans': ['admin', 'ceo', 'loan_officer', 'accountant'],
      'transactions': ['admin', 'ceo', 'accountant'],
      'reports': ['admin', 'ceo', 'accountant'],
      'documents': ['admin', 'ceo', 'hr', 'accountant', 'loan_officer'],
      'settings': ['admin', 'ceo'],
      'audit': ['admin', 'ceo'],
    };

    const requiredRoles = pagePermissions[page] || [];
    return hasAnyRole(requiredRoles);
  };

  /**
   * Get all effective roles for display purposes
   */
  const getEffectiveRoles = (): UserRole[] => {
    return effectiveRoles;
  };

  /**
   * Check if user is acting in a delegated capacity
   */
  const isDelegated = (): boolean => {
    return profile?.delegated_role !== null && profile?.delegated_role !== undefined;
  };

  return {
    hasRole,
    hasAnyRole,
    isAdmin,
    isCEO,
    isHR,
    isAccountant,
    isLoanOfficer,
    can,
    canAccess,
    getEffectiveRoles,
    isDelegated,
    effectiveRoles,
  };
};
