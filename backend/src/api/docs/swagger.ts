// API Layer - Documentation
// OpenAPI/Swagger documentation for the Accounting API

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Accounting System API',
    version: '1.0.0',
    description: 'Production-ready accounting system with double-entry bookkeeping, audit trails, and comprehensive financial reporting',
    contact: {
      name: 'API Support',
      email: 'support@accounting-system.com'
    },
    license: {
      name: 'Proprietary',
      url: 'https://accounting-system.com/license'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000/api/accounting/v1',
      description: 'Development server'
    },
    {
      url: 'https://api.accounting-system.com/v1',
      description: 'Production server'
    }
  ],
  security: [
    {
      bearerAuth: []
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message'
          },
          code: {
            type: 'string',
            description: 'Error code for programmatic handling'
          },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  description: 'Field name that caused the error'
                },
                message: {
                  type: 'string',
                  description: 'Detailed error message for the field'
                }
              }
            },
            description: 'Detailed validation errors (for validation errors only)'
          }
        },
        required: ['error']
      },
      ValidationError: {
        allOf: [
          { $ref: '#/components/schemas/Error' },
          {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                enum: ['VALIDATION_ERROR'],
                description: 'Always "VALIDATION_ERROR" for validation failures'
              },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: {
                      type: 'string',
                      description: 'Field path that failed validation'
                    },
                    message: {
                      type: 'string',
                      description: 'Validation error message'
                    }
                  }
                },
                description: 'Array of validation errors'
              }
            }
          }
        ]
      },
      Money: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            format: 'decimal',
            description: 'Monetary amount'
          },
          currency: {
            type: 'string',
            default: 'USD',
            description: 'Currency code (ISO 4217)'
          }
        },
        required: ['amount']
      },
      Account: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique account identifier'
          },
          code: {
            type: 'string',
            pattern: '^[0-9]{4}(-[0-9]{2})*$',
            description: 'Hierarchical account code (e.g., 1000-01)'
          },
          name: {
            type: 'string',
            description: 'Human-readable account name'
          },
          type: {
            type: 'string',
            enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
            description: 'Account type for financial reporting'
          },
          category: {
            type: 'string',
            enum: ['current_asset', 'fixed_asset', 'current_liability', 'long_term_liability', 'owners_equity', 'retained_earnings', 'operating_revenue', 'other_revenue', 'cost_of_goods_sold', 'operating_expense', 'other_expense'],
            description: 'Detailed account category'
          },
          isActive: {
            type: 'boolean',
            default: true,
            description: 'Whether the account is active for new transactions'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account last update timestamp'
          }
        },
        required: ['id', 'code', 'name', 'type', 'category', 'isActive', 'createdAt', 'updatedAt']
      },
      JournalEntryLine: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique journal entry line identifier'
          },
          accountId: {
            type: 'string',
            format: 'uuid',
            description: 'Reference to the account'
          },
          debit: {
            $ref: '#/components/schemas/Money',
            description: 'Debit amount (null if credit)'
          },
          credit: {
            $ref: '#/components/schemas/Money',
            description: 'Credit amount (null if debit)'
          },
          description: {
            type: 'string',
            description: 'Optional line description'
          }
        },
        required: ['id', 'accountId']
      },
      JournalEntry: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique journal entry identifier'
          },
          entryNumber: {
            type: 'integer',
            minimum: 1,
            description: 'Sequential entry number for reference'
          },
          description: {
            type: 'string',
            description: 'Business description of the transaction'
          },
          entryDate: {
            type: 'string',
            format: 'date',
            description: 'Date when the transaction occurred'
          },
          status: {
            type: 'string',
            enum: ['draft', 'posted', 'voided'],
            description: 'Current status of the journal entry'
          },
          lines: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/JournalEntryLine'
            },
            minItems: 1,
            description: 'Journal entry lines (debits and credits)'
          },
          totalDebit: {
            $ref: '#/components/schemas/Money',
            description: 'Total debit amount (must equal total credit)'
          },
          totalCredit: {
            $ref: '#/components/schemas/Money',
            description: 'Total credit amount (must equal total debit)'
          },
          createdBy: {
            type: 'string',
            format: 'uuid',
            description: 'User who created the entry'
          },
          approvedBy: {
            type: 'string',
            format: 'uuid',
            description: 'User who approved/posted the entry'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Entry creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Entry last update timestamp'
          }
        },
        required: ['id', 'entryNumber', 'description', 'entryDate', 'status', 'lines', 'totalDebit', 'totalCredit', 'createdBy', 'createdAt', 'updatedAt']
      },
      TrialBalanceEntry: {
        type: 'object',
        properties: {
          account: {
            $ref: '#/components/schemas/Account',
            description: 'Account information'
          },
          debitBalance: {
            $ref: '#/components/schemas/Money',
            description: 'Debit balance for the account'
          },
          creditBalance: {
            $ref: '#/components/schemas/Money',
            description: 'Credit balance for the account'
          }
        },
        required: ['account', 'debitBalance', 'creditBalance']
      },
      JobStatus: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique job identifier'
          },
          type: {
            type: 'string',
            description: 'Job type (e.g., trial_balance, income_statement)'
          },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'failed'],
            description: 'Current job status'
          },
          progress: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Job completion percentage (0-100)'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Job creation timestamp'
          },
          startedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Job start timestamp'
          },
          completedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Job completion timestamp'
          },
          result: {
            description: 'Job result data (when completed)'
          },
          error: {
            type: 'string',
            description: 'Error message (when failed)'
          }
        },
        required: ['id', 'type', 'status', 'createdAt']
      },
      HealthCheck: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['ok', 'error'],
            description: 'Overall system health'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Health check timestamp'
          },
          services: {
            type: 'object',
            properties: {
              accounting: {
                type: 'string',
                description: 'Accounting service status'
              },
              authorization: {
                type: 'string',
                description: 'Authorization service status'
              },
              audit: {
                type: 'string',
                description: 'Audit service status'
              },
              cache: {
                type: 'string',
                description: 'Cache service status'
              },
              async_jobs: {
                type: 'string',
                description: 'Async job processing status'
              }
            }
          },
          performance: {
            type: 'object',
            properties: {
              cache: {
                type: 'object',
                properties: {
                  health: {
                    type: 'boolean',
                    description: 'Cache service health'
                  },
                  memoryUsage: {
                    description: 'Cache memory usage statistics'
                  },
                  keys: {
                    type: 'integer',
                    description: 'Number of cached keys'
                  }
                }
              },
              queue: {
                type: 'object',
                properties: {
                  pending: {
                    type: 'integer',
                    description: 'Number of pending jobs'
                  },
                  processing: {
                    type: 'integer',
                    description: 'Number of jobs being processed'
                  },
                  total: {
                    type: 'integer',
                    description: 'Total jobs in queue'
                  },
                  handlers: {
                    type: 'array',
                    items: {
                      type: 'string'
                    },
                    description: 'Available job handlers'
                  }
                }
              }
            }
          }
        },
        required: ['status', 'timestamp', 'services']
      }
    }
  }
};

const swaggerOptions = {
  swaggerDefinition,
  apis: ['./src/api/routes/*.ts', './src/api/routes/enhanced-accounting.ts'] // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
export const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'list',
    filter: true,
    showRequestDuration: true,
    syntaxHighlight: {
      activate: true,
      theme: 'arta'
    },
    tryItOutEnabled: true,
    requestInterceptor: (req: any) => {
      // Add auth header if token exists
      const token = localStorage.getItem('authToken');
      if (token) {
        req.headers.Authorization = `Bearer ${token}`;
      }
      return req;
    }
  }
};

// Middleware to serve Swagger UI
export function createSwaggerMiddleware() {
  return [
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  ];
}
