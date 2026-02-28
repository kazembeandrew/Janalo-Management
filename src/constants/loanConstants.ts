/**
 * Loan management system constants
 */

// File upload constants
export const FILE_UPLOAD = {
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  LOAN_DOCUMENTS_BUCKET: 'loan-documents',
  VISIT_IMAGE_PREFIX: 'visit_',
  APPLICATION_FORM_PREFIX: 'application_form_',
  ID_CARD_PREFIX: 'id_card',
  GUARANTOR_PREFIX: 'guarantor',
  COLLATERAL_PREFIX: 'collateral'
} as const;

// Loan validation constants
export const LOAN_VALIDATION = {
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 10000000,
  MIN_INTEREST_RATE: 0,
  MAX_INTEREST_RATE: 50,
  MIN_TERM_MONTHS: 1,
  MAX_TERM_MONTHS: 360,
  MIN_REASON_LENGTH: 10,
  MAX_REASON_LENGTH: 500,
  OVERPAYMENT_TOLERANCE: 1.1
} as const;

// Pagination constants
export const PAGINATION = {
  ITEMS_PER_PAGE: 10,
  DEFAULT_PAGE: 1
} as const;

// Loan status constants
export const LOAN_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DEFAULTED: 'defaulted',
  REJECTED: 'rejected',
  REASSESS: 'reassess'
} as const;

// User role constants
export const USER_ROLES = {
  ADMIN: 'admin',
  CEO: 'ceo',
  LOAN_OFFICER: 'loan_officer',
  ACCOUNTANT: 'accountant'
} as const;

// Filter types for loan list
export const FILTER_TYPES = {
  ALL: 'all',
  ACTIVE: 'active',
  PENDING: 'pending',
  REASSESS: 'reassess',
  COMPLETED: 'completed',
  DEFAULTED: 'defaulted',
  REJECTED: 'rejected'
} as const;

// Priority levels
export const PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
} as const;

// Sort options
export const SORT_OPTIONS = {
  PRIORITY: 'priority',
  DATE: 'date',
  TYPE: 'type',
  AMOUNT: 'amount'
} as const;

// Interest types
export const INTEREST_TYPES = {
  FLAT: 'flat',
  REDUCING: 'reducing'
} as const;

// Document types
export const DOCUMENT_TYPES = {
  ID_CARD: 'id_card',
  GUARANTOR: 'guarantor',
  COLLATERAL: 'collateral',
  APPLICATION_FORM: 'application_form'
} as const;

// Audit log actions
export const AUDIT_ACTIONS = {
  LOAN_APPROVED: 'LOAN_APPROVED',
  LOAN_REJECTED: 'LOAN_REJECTED',
  LOAN_WRITTEN_OFF: 'LOAN_WRITTEN_OFF',
  REPAYMENT_REVERSED: 'REPAYMENT_REVERSED',
  EXPENSE_APPROVED: 'EXPENSE_APPROVED',
  TASK_APPROVED: 'TASK_APPROVED',
  USER_ARCHIVE_APPROVED: 'USER_ARCHIVE_APPROVED',
  SYSTEM_RESET_REQUESTED: 'SYSTEM_RESET_REQUESTED',
  SYSTEM_RESET_CANCELLED: 'SYSTEM_RESET_CANCELLED',
  SYSTEM_FACTORY_RESET: 'SYSTEM_FACTORY_RESET'
} as const;

// Account codes
export const ACCOUNT_CODES = {
  PORTFOLIO: 'PORTFOLIO',
  EQUITY: 'EQUITY',
  OPERATIONAL: 'OPERATIONAL'
} as const;

// Time constants
export const TIME_CONSTANTS = {
  OVERDUE_DAYS: 30,
  REALTIME_FALLBACK_INTERVAL: 30000,
  REALTIME_FALLBACK_DURATION: 300000,
  CACHE_TTL: {
    AI_INSIGHTS: 600000, // 10 minutes
    DASHBOARD: 300000,   // 5 minutes
    API_DATA: 120000    // 2 minutes
  }
} as const;

// UI constants
export const UI = {
  TOAST_DURATION: 4000,
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 200,
  MODAL_Z_INDEX: 50,
  IMAGE_VIEWER_Z_INDEX: 100
} as const;

// Regex patterns
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[\d\s\-\+\(\)]+$/,
  REFERENCE_NUMBER: /^[A-Z]{3}-\d{4}-\d{3}$/
} as const;

// Error messages
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_PHONE: 'Invalid phone number format',
  INVALID_AMOUNT: 'Amount must be greater than 0',
  INVALID_INTEREST_RATE: 'Interest rate cannot be negative',
  INVALID_TERM: 'Loan term must be greater than 0',
  FILE_TOO_LARGE: `File size cannot exceed ${FILE_UPLOAD.MAX_SIZE_MB}MB`,
  INVALID_FILE_TYPE: 'File type not allowed',
  REFERENCE_FORMAT: 'Reference number must be in format: XXX-YYYY-ZZZ',
  REASON_TOO_SHORT: `Decision reason must be at least ${LOAN_VALIDATION.MIN_REASON_LENGTH} characters`,
  REASON_TOO_LONG: `Decision reason cannot exceed ${LOAN_VALIDATION.MAX_REASON_LENGTH} characters`
} as const;
