import { useEnhancedStore } from '../store/enhancedStore';

/**
 * Hook for accessing and managing current user state
 */
export const useCurrentUser = () => {
  const { currentUser, setCurrentUser, errors, setError, clearError } = useEnhancedStore();

  const setCurrentUserWithErrorHandling = (user: any) => {
    try {
      setCurrentUser(user);
      clearError('currentUser');
    } catch (error) {
      setError('currentUser', error instanceof Error ? error.message : 'Failed to set current user');
    }
  };

  return {
    currentUser,
    setCurrentUser: setCurrentUserWithErrorHandling,
    error: errors.currentUser,
    clearError: () => clearError('currentUser'),
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === 'admin',
    isCEO: currentUser?.role === 'ceo',
    isLoanOfficer: currentUser?.role === 'loan_officer',
    isAccountant: currentUser?.role === 'accountant',
    isHR: currentUser?.role === 'hr',
    effectiveRoles: currentUser?.effective_roles || [],
    hasRole: (role: string) => currentUser?.effective_roles?.includes(role) || false,
  };
};