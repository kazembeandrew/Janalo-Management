/**
 * Validation utilities for loan management system
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates loan amount input
 */
export const validateLoanAmount = (amount: number): ValidationResult => {
  if (isNaN(amount) || amount <= 0) {
    return { isValid: false, error: 'Loan amount must be greater than 0' };
  }
  if (amount > 10000000) {
    return { isValid: false, error: 'Loan amount cannot exceed MK 10,000,000' };
  }
  return { isValid: true };
};

/**
 * Validates interest rate
 */
export const validateInterestRate = (rate: number): ValidationResult => {
  if (isNaN(rate) || rate < 0) {
    return { isValid: false, error: 'Interest rate cannot be negative' };
  }
  if (rate > 50) {
    return { isValid: false, error: 'Interest rate cannot exceed 50% per month' };
  }
  return { isValid: true };
};

/**
 * Validates loan term in months
 */
export const validateLoanTerm = (months: number): ValidationResult => {
  if (isNaN(months) || months <= 0) {
    return { isValid: false, error: 'Loan term must be greater than 0' };
  }
  if (months > 360) {
    return { isValid: false, error: 'Loan term cannot exceed 30 years (360 months)' };
  }
  return { isValid: true };
};

/**
 * Validates borrower information
 */
export const validateBorrower = (borrower: any): ValidationResult => {
  if (!borrower) {
    return { isValid: false, error: 'Borrower is required' };
  }
  if (!borrower.full_name || borrower.full_name.trim().length < 2) {
    return { isValid: false, error: 'Borrower name is required' };
  }
  return { isValid: true };
};

/**
 * Validates repayment amount
 */
export const validateRepaymentAmount = (amount: number, outstanding: number): ValidationResult => {
  if (isNaN(amount) || amount <= 0) {
    return { isValid: false, error: 'Repayment amount must be greater than 0' };
  }
  if (amount > outstanding * 1.1) {
    return { isValid: false, error: 'Repayment amount exceeds reasonable limit' };
  }
  return { isValid: true };
};

/**
 * Validates email format
 */
export const validateEmail = (email: string): ValidationResult => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  return { isValid: true };
};

/**
 * Validates phone number format
 */
export const validatePhone = (phone: string): ValidationResult => {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  if (!phone || !phoneRegex.test(phone) || phone.replace(/\D/g, '').length < 7) {
    return { isValid: false, error: 'Invalid phone number format' };
  }
  return { isValid: true };
};

/**
 * Validates required field
 */
export const validateRequired = (value: any, fieldName: string): ValidationResult => {
  if (!value || (typeof value === 'string' && value.trim().length === 0)) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  return { isValid: true };
};

/**
 * Validates file upload
 */
export const validateFileUpload = (file: File, maxSizeMB: number = 10, allowedTypes: string[] = ['image/jpeg', 'image/png', 'application/pdf']): ValidationResult => {
  if (!file) {
    return { isValid: false, error: 'File is required' };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: `File type ${file.type} is not allowed` };
  }
  
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { isValid: false, error: `File size cannot exceed ${maxSizeMB}MB` };
  }
  
  return { isValid: true };
};

/**
 * Validates loan reference number format
 */
export const validateReferenceNumber = (reference: string): ValidationResult => {
  if (!reference || reference.trim().length === 0) {
    return { isValid: false, error: 'Reference number is required' };
  }
  
  // Check for valid format (e.g., JAN-2024-001)
  const refRegex = /^[A-Z]{3}-\d{4}-\d{3}$/;
  if (!refRegex.test(reference)) {
    return { isValid: false, error: 'Reference number must be in format: XXX-YYYY-ZZZ' };
  }
  
  return { isValid: true };
};

/**
 * Validates decision reason for loan actions
 */
export const validateDecisionReason = (reason: string): ValidationResult => {
  if (!reason || reason.trim().length < 10) {
    return { isValid: false, error: 'Decision reason must be at least 10 characters' };
  }
  if (reason.length > 500) {
    return { isValid: false, error: 'Decision reason cannot exceed 500 characters' };
  }
  return { isValid: true };
};
