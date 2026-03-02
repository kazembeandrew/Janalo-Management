// API Layer - Validation Schemas
// Request/response validation using Zod for type safety and runtime validation

import { z } from 'zod';

// Common validation schemas
export const uuidSchema = z.string().uuid('Invalid UUID format');

export const moneySchema = z.object({
  amount: z.number().finite('Amount must be a finite number'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('USD')
}).refine(data => data.amount >= 0, {
  message: 'Amount cannot be negative'
});

export const accountCodeSchema = z.string()
  .regex(/^[0-9]{4}(-[0-9]{2})*$/, 'Account code must be in format XXXX-XX-XX (digits only)')
  .min(4, 'Account code must be at least 4 characters')
  .max(20, 'Account code must be at most 20 characters');

export const dateSchema = z.string()
  .refine(date => !isNaN(Date.parse(date)), 'Invalid date format')
  .transform(date => new Date(date));

// Journal Entry validation schemas
export const createJournalEntrySchema = z.object({
  body: z.object({
    description: z.string()
      .min(1, 'Description is required')
      .max(500, 'Description must be at most 500 characters'),
    entryDate: dateSchema,
    lines: z.array(z.object({
      accountId: uuidSchema,
      debit: z.number().min(0).optional(),
      credit: z.number().min(0).optional(),
      description: z.string().max(255).optional()
    }))
    .min(1, 'At least one journal line is required')
    .max(100, 'Cannot have more than 100 journal lines')
    .refine(lines => {
      // Ensure each line has either debit or credit, but not both
      return lines.every(line =>
        (line.debit && !line.credit) || (!line.debit && line.credit)
      );
    }, 'Each line must have either debit or credit amount, but not both')
    .refine(lines => {
      // Ensure debits equal credits
      const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
      return Math.abs(totalDebit - totalCredit) < 0.01; // Allow for floating point precision
    }, 'Journal entry must balance (debits must equal credits)')
  })
});

export const postJournalEntrySchema = z.object({
  params: z.object({
    id: uuidSchema
  })
});

export const getJournalEntriesSchema = z.object({
  query: z.object({
    status: z.enum(['draft', 'posted', 'voided']).optional(),
    limit: z.string().transform(val => parseInt(val)).refine(val => val > 0 && val <= 1000, 'Limit must be between 1 and 1000').optional(),
    offset: z.string().transform(val => parseInt(val)).refine(val => val >= 0, 'Offset must be non-negative').optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional()
  }).optional()
});

export const getJournalEntrySchema = z.object({
  params: z.object({
    id: uuidSchema
  })
});

// Account balance validation schemas
export const getAccountBalanceSchema = z.object({
  params: z.object({
    accountId: uuidSchema
  }),
  query: z.object({
    asOfDate: dateSchema.optional()
  }).optional()
});

// Trial balance validation schemas
export const getTrialBalanceSchema = z.object({
  query: z.object({
    asOfDate: dateSchema.optional(),
    format: z.enum(['json', 'csv', 'pdf']).optional()
  }).optional()
});

// Audit trail validation schemas
export const getAuditTrailSchema = z.object({
  params: z.object({
    resourceType: z.enum(['journal_entry', 'account', 'user', 'loan', 'repayment']),
    resourceId: uuidSchema
  }),
  query: z.object({
    limit: z.string().transform(val => parseInt(val)).refine(val => val > 0 && val <= 1000, 'Limit must be between 1 and 1000').optional(),
    offset: z.string().transform(val => parseInt(val)).refine(val => val >= 0, 'Offset must be non-negative').optional()
  }).optional()
});

// User permissions validation schemas
export const getUserPermissionsSchema = z.object({
  // No parameters needed - gets current user's permissions
});

// Async job validation schemas
export const getJobStatusSchema = z.object({
  params: z.object({
    jobId: z.string().min(1, 'Job ID is required')
  })
});

// Async report generation validation schemas
export const generateReportSchema = z.object({
  body: z.object({
    reportType: z.enum(['trial_balance', 'income_statement', 'balance_sheet']),
    parameters: z.record(z.any()).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional()
  })
});

// Cache management validation schemas
export const cacheManagementSchema = z.object({
  // No parameters needed for cache operations
});

// Response validation schemas
export const journalEntryResponseSchema = z.object({
  id: uuidSchema,
  entryNumber: z.number().int().positive(),
  description: z.string(),
  entryDate: z.string(),
  status: z.enum(['draft', 'posted', 'voided']),
  lines: z.array(z.object({
    id: uuidSchema,
    accountId: uuidSchema,
    debit: moneySchema.optional(),
    credit: moneySchema.optional(),
    description: z.string().optional()
  })),
  totalDebit: moneySchema,
  totalCredit: moneySchema,
  createdBy: uuidSchema,
  approvedBy: uuidSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const accountBalanceResponseSchema = z.object({
  accountId: uuidSchema,
  balance: moneySchema,
  asOfDate: z.string()
});

export const trialBalanceResponseSchema = z.array(z.object({
  account: z.object({
    id: uuidSchema,
    code: accountCodeSchema,
    name: z.string(),
    type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
    category: z.string(),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string()
  }),
  debitBalance: moneySchema,
  creditBalance: moneySchema
}));

export const auditLogResponseSchema = z.object({
  id: uuidSchema,
  eventType: z.string(),
  resourceType: z.string(),
  resourceId: uuidSchema.optional(),
  action: z.string(),
  description: z.string(),
  userId: uuidSchema.optional(),
  timestamp: z.string(),
  oldValues: z.record(z.any()).optional(),
  newValues: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

export const jobStatusResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  progress: z.number().min(0).max(100).optional(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  result: z.any().optional(),
  error: z.string().optional()
});

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  timestamp: z.string(),
  services: z.object({
    accounting: z.string(),
    authorization: z.string(),
    audit: z.string(),
    cache: z.string(),
    async_jobs: z.string()
  }),
  performance: z.object({
    cache: z.object({
      health: z.boolean(),
      memoryUsage: z.any().optional(),
      keys: z.number()
    }),
    queue: z.object({
      pending: z.number(),
      processing: z.number(),
      total: z.number(),
      handlers: z.array(z.string())
    })
  }).optional()
});

// Error response schemas
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.any().optional()
});

export const validationErrorResponseSchema = z.object({
  error: z.string(),
  code: z.literal('VALIDATION_ERROR'),
  details: z.array(z.object({
    field: z.string(),
    message: z.string()
  }))
});

// Utility functions for validation
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

export function formatValidationError(error: z.ZodError): { error: string; code: string; details: Array<{ field: string; message: string }> } {
  return {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }))
  };
}
