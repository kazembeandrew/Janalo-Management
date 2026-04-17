/**
 * User-Friendly Error Handling Framework
 * 
 * Provides actionable, context-aware error messages instead of generic technical errors.
 * Reduces support tickets by guiding users to resolution.
 * 
 * Usage:
 * ```typescript
 * throw createUserError('INSUFFICIENT_FUNDS', currentBalance, requiredAmount);
 * ```
 */

export class UserFriendlyError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    public suggestedAction: string,
    public technicalDetails?: any
  ) {
    super(userMessage);
    this.name = 'UserFriendlyError';
  }

  toJSON() {
    return {
      code: this.code,
      userMessage: this.userMessage,
      suggestedAction: this.suggestedAction,
      technicalDetails: this.technicalDetails
    };
  }
}

// ============================================================================
// ERROR MESSAGE TEMPLATES
// ============================================================================

export const ERROR_MESSAGES = {
  // Financial Operations
  INSUFFICIENT_FUNDS: {
    template: (balance: number, required: number) => ({
      userMessage: `Insufficient funds. Available: MK ${balance.toLocaleString()}, Required: MK ${required.toLocaleString()}`,
      suggestedAction: 'Deposit funds or select a different account with sufficient balance.'
    })
  },
  
  LOAN_NOT_ACTIVE: {
    template: (status: string) => ({
      userMessage: `Cannot process repayment. Loan status is "${status}".`,
      suggestedAction: 'Only active or overdue loans can receive repayments. Contact your loan officer if this seems incorrect.'
    })
  },
  
  INVALID_ACCOUNT: {
    template: (accountName: string) => ({
      userMessage: `Account "${accountName}" does not accept repayments.`,
      suggestedAction: 'Please select Main Bank or Cash account for repayments. Contact administrator to configure account settings.'
    })
  },
  
  DUPLICATE_REPAYMENT: {
    template: () => ({
      userMessage: 'This repayment has already been recorded.',
      suggestedAction: 'Check the repayment history to confirm. If you believe this is an error, contact support.'
    })
  },
  
  OVERPAYMENT_EXCEEDS_LIMIT: {
    template: (maxAllowed: number) => ({
      userMessage: `Payment exceeds maximum allowed overpayment limit (MK ${maxAllowed.toLocaleString()}).`,
      suggestedAction: 'Reduce payment amount or request manual override from supervisor.'
    })
  },

  REPAYMENT_ALREADY_REVERSED: {
    template: (reversedAt: string) => ({
      userMessage: `This repayment was already reversed on ${new Date(reversedAt).toLocaleDateString()}.`,
      suggestedAction: 'Check the audit log for reversal details. Cannot reverse an already reversed repayment.'
    })
  },

  INVALID_REPAYMENT_STATUS: {
    template: (status: string) => ({
      userMessage: `Cannot reverse repayment in "${status}" status.`,
      suggestedAction: 'Only completed repayments can be reversed. Pending or failed repayments are handled differently.'
    })
  },

  // Loan Operations
  LOAN_NOT_FOUND: {
    template: (loanId: string) => ({
      userMessage: `Loan ${loanId.substring(0, 8)}... not found.`,
      suggestedAction: 'Verify the loan ID is correct. The loan may have been deleted or you may not have permission to view it.'
    })
  },

  LOAN_ALREADY_DISBURSED: {
    template: () => ({
      userMessage: 'This loan has already been disbursed.',
      suggestedAction: 'Cannot disburse the same loan twice. Check the loan status and transaction history.'
    })
  },

  LOAN_NOT_APPROVED: {
    template: (status: string) => ({
      userMessage: `Cannot disburse loan. Current status: "${status}".`,
      suggestedAction: 'Loan must be approved before disbursement. Complete the approval workflow first.'
    })
  },

  INSUFFICIENT_PRINCIPAL: {
    template: (principal: number) => ({
      userMessage: `Principal amount (MK ${principal.toLocaleString()}) is below minimum threshold.`,
      suggestedAction: 'Minimum loan amount is MK 10,000. Please increase the principal amount.'
    })
  },

  // Account Operations
  ACCOUNT_NOT_FOUND: {
    template: (accountId: string) => ({
      userMessage: `Account not found.`,
      suggestedAction: 'Verify the account ID is correct. The account may have been deleted or archived.'
    })
  },

  ACCOUNT_INACTIVE: {
    template: (accountName: string) => ({
      userMessage: `Account "${accountName}" is inactive.`,
      suggestedAction: 'Cannot perform operations on inactive accounts. Activate the account or select a different one.'
    })
  },

  // Authorization Errors
  INSUFFICIENT_PERMISSIONS: {
    template: (requiredRole: string) => ({
      userMessage: `Insufficient permissions. Required role: ${requiredRole}.`,
      suggestedAction: 'Contact your administrator to request the necessary permissions for this operation.'
    })
  },

  SESSION_EXPIRED: {
    template: () => ({
      userMessage: 'Your session has expired.',
      suggestedAction: 'Please log in again to continue. Your work has been saved and will not be lost.'
    })
  },

  // Validation Errors
  INVALID_AMOUNT: {
    template: (amount: number) => ({
      userMessage: `Invalid amount: MK ${amount.toLocaleString()}.`,
      suggestedAction: 'Amount must be greater than zero. Please enter a valid positive number.'
    })
  },

  INVALID_DATE: {
    template: (field: string) => ({
      userMessage: `Invalid date for ${field}.`,
      suggestedAction: 'Please enter a valid date. Future dates may not be allowed for this operation.'
    })
  },

  MISSING_REQUIRED_FIELD: {
    template: (fieldName: string) => ({
      userMessage: `Required field missing: ${fieldName}.`,
      suggestedAction: `Please fill in the "${fieldName}" field before proceeding.`
    })
  },

  // Network/Technical Errors
  NETWORK_ERROR: {
    template: () => ({
      userMessage: 'Network connection error.',
      suggestedAction: 'Check your internet connection and try again. If the problem persists, contact IT support.'
    })
  },

  SERVER_ERROR: {
    template: () => ({
      userMessage: 'Server error occurred.',
      suggestedAction: 'Our team has been notified. Please try again in a few minutes. If the issue persists, contact support.'
    })
  },

  RATE_LIMIT_EXCEEDED: {
    template: (retryAfter: number) => ({
      userMessage: `Too many requests. Please wait ${retryAfter} seconds before trying again.`,
      suggestedAction: 'This protects against accidental duplicate submissions. Wait briefly and retry.'
    })
  }
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a user-friendly error from a predefined template
 * 
 * @param errorCode - Error code from ERROR_MESSAGES
 * @param args - Arguments to pass to the template function
 * @returns UserFriendlyError instance
 * 
 * @example
 * throw createUserError('INSUFFICIENT_FUNDS', 150000, 200000);
 */
export function createUserError(
  errorCode: keyof typeof ERROR_MESSAGES,
  ...args: any[]
): UserFriendlyError {
  const config = ERROR_MESSAGES[errorCode];
  
  if (!config) {
    console.error(`Unknown error code: ${errorCode}`);
    return new UserFriendlyError(
      'UNKNOWN_ERROR',
      'An unexpected error occurred.',
      'Please contact support with the error code: UNKNOWN_ERROR'
    );
  }

  const templateResult = (config.template as any)(...args);
  const { userMessage, suggestedAction } = templateResult;
  
  return new UserFriendlyError(
    errorCode,
    userMessage,
    suggestedAction
  );
}

/**
 * Check if an error is a UserFriendlyError
 */
export function isUserFriendlyError(error: any): error is UserFriendlyError {
  return error instanceof UserFriendlyError;
}

/**
 * Convert a standard Error to UserFriendlyError with fallback
 */
export function convertToUserFriendlyError(
  error: any,
  fallbackCode: keyof typeof ERROR_MESSAGES = 'SERVER_ERROR'
): UserFriendlyError {
  if (isUserFriendlyError(error)) {
    return error;
  }

  // Try to map common error patterns
  if (error?.code === 'PGRST301') {
    return createUserError('LOAN_NOT_FOUND', error?.details || 'unknown');
  }

  if (error?.code === '23505') {
    return createUserError('DUPLICATE_REPAYMENT');
  }

  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return createUserError('NETWORK_ERROR');
  }

  // Fallback to generic error
  return createUserError(fallbackCode);
}
