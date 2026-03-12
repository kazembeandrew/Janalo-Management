// API Layer - GraphQL Schema
// GraphQL implementation for complex financial queries and real-time data

import { gql, ApolloServer } from 'apollo-server-express';
import { EnhancedAccountingService } from '../../domain/services/EnhancedAccountingService';
import { AuthorizationService } from '../../domain/services/AuthorizationService';
import { AuditService } from '../../domain/services/AuditService';
import { Money } from '../../domain/value-objects/Money';
import { AccountCode } from '../../domain/value-objects/AccountCode';

// GraphQL Schema Definition
const typeDefs = gql`
  # Custom scalars
  scalar Date
  scalar Money

  # Enums
  enum AccountType {
    ASSET
    LIABILITY
    EQUITY
    REVENUE
    EXPENSE
  }

  enum AccountCategory {
    CURRENT_ASSET
    FIXED_ASSET
    CURRENT_LIABILITY
    LONG_TERM_LIABILITY
    OWNERS_EQUITY
    RETAINED_EARNINGS
    OPERATING_REVENUE
    OTHER_REVENUE
    COST_OF_GOODS_SOLD
    OPERATING_EXPENSE
    OTHER_EXPENSE
  }

  enum JournalEntryStatus {
    DRAFT
    POSTED
    VOIDED
  }

  enum ReportType {
    TRIAL_BALANCE
    INCOME_STATEMENT
    BALANCE_SHEET
  }

  enum SortOrder {
    ASC
    DESC
  }

  # Types
  type Account {
    id: ID!
    code: String!
    name: String!
    type: AccountType!
    category: AccountCategory!
    isActive: Boolean!
    createdAt: Date!
    updatedAt: Date!
  }

  type Money {
    amount: Float!
    currency: String!
  }

  type JournalEntryLine {
    id: ID!
    accountId: ID!
    account: Account
    debit: Money
    credit: Money
    description: String
  }

  type JournalEntry {
    id: ID!
    entryNumber: Int!
    description: String!
    entryDate: Date!
    status: JournalEntryStatus!
    lines: [JournalEntryLine!]!
    totalDebit: Money!
    totalCredit: Money!
    createdBy: ID!
    approvedBy: ID
    createdAt: Date!
    updatedAt: Date!
  }

  type AccountBalance {
    account: Account!
    balance: Money!
    asOfDate: Date!
    lastTransactionDate: Date
  }

  type TrialBalanceEntry {
    account: Account!
    debitBalance: Money!
    creditBalance: Money!
  }

  type TrialBalance {
    entries: [TrialBalanceEntry!]!
    totalDebit: Money!
    totalCredit: Money!
    asOfDate: Date!
    generatedAt: Date!
  }

  type ReportJob {
    id: ID!
    reportType: ReportType!
    status: String!
    progress: Int
    result: String
    error: String
    createdAt: Date!
    completedAt: Date
  }

  type AuditLogEntry {
    id: ID!
    eventType: String!
    resourceType: String!
    resourceId: ID
    action: String!
    description: String!
    userId: ID
    timestamp: Date!
    oldValues: String
    newValues: String
  }

  type Permission {
    id: ID!
    resource: String!
    action: String!
    description: String
  }

  type Role {
    id: ID!
    name: String!
    description: String
    permissions: [Permission!]!
  }

  type UserPermissions {
    userId: ID!
    roles: [Role!]!
    permissions: [Permission!]!
    effectivePermissions: [String!]!
  }

  # Input Types
  input CreateJournalEntryInput {
    description: String!
    entryDate: Date!
    lines: [JournalEntryLineInput!]!
  }

  input JournalEntryLineInput {
    accountId: ID!
    debit: Float
    credit: Float
    description: String
  }

  input PostJournalEntryInput {
    approvedBy: ID
  }

  input AccountBalanceFilter {
    accountIds: [ID!]
    asOfDate: Date
  }

  input JournalEntryFilter {
    status: JournalEntryStatus
    startDate: Date
    endDate: Date
    accountId: ID
    createdBy: ID
    limit: Int
    offset: Int
    sortBy: String
    sortOrder: SortOrder
  }

  input AuditLogFilter {
    resourceType: String
    resourceId: ID
    userId: ID
    startDate: Date
    endDate: Date
    limit: Int
    offset: Int
  }

  input GenerateReportInput {
    reportType: ReportType!
    parameters: String
    priority: String
  }

  # Queries
  type Query {
    # Account queries
    accounts(limit: Int, offset: Int): [Account!]!
    account(id: ID!): Account

    # Journal entry queries
    journalEntries(filter: JournalEntryFilter): [JournalEntry!]!
    journalEntry(id: ID!): JournalEntry

    # Balance queries
    accountBalances(filter: AccountBalanceFilter): [AccountBalance!]!
    accountBalance(accountId: ID!, asOfDate: Date): AccountBalance

    # Report queries
    trialBalance(asOfDate: Date): TrialBalance!
    reportJob(id: ID!): ReportJob

    # Audit queries
    auditTrail(filter: AuditLogFilter): [AuditLogEntry!]!

    # Permission queries
    userPermissions: UserPermissions!
    availablePermissions: [Permission!]!
    roles: [Role!]!
  }

  # Mutations
  type Mutation {
    # Journal entry mutations
    createJournalEntry(input: CreateJournalEntryInput!): JournalEntry!
    postJournalEntry(id: ID!, input: PostJournalEntryInput): JournalEntry!
    voidJournalEntry(id: ID!, reason: String!): JournalEntry!

    # Report mutations
    generateReport(input: GenerateReportInput!): ReportJob!

    # Permission mutations (admin only)
    assignUserRole(userId: ID!, roleId: ID!): Boolean!
    removeUserRole(userId: ID!, roleId: ID!): Boolean!
  }

  # Subscriptions (for real-time updates)
  type Subscription {
    journalEntryPosted: JournalEntry!
    accountBalanceChanged(accountId: ID!): AccountBalance!
  }
`;

// GraphQL Resolvers
function createResolvers(
  accountingService: EnhancedAccountingService,
  authService: AuthorizationService,
  auditService: AuditService
) {
  return {
    // Custom scalar resolvers
    Date: {
      parseValue(value: string) {
        return new Date(value);
      },
      serialize(value: Date) {
        return value.toISOString();
      },
      parseLiteral(ast: any) {
        if (ast.kind === 'StringValue') {
          return new Date(ast.value);
        }
        return null;
      }
    },

    Money: {
      amount: (money: Money) => money.amount,
      currency: (money: Money) => money.currency
    },

    // Query resolvers
    Query: {
      accounts: async (_: any, { limit = 50, offset = 0 }: any, context: any) => {
        // Check permissions
        await authService.requirePermission(context.userId, 'accounts', 'read');

        // This would need an accounts repository method
        // For now, return empty array
        return [];
      },

      account: async (_: any, { id }: any, context: any) => {
        await authService.requirePermission(context.userId, 'accounts', 'read');
        // Implementation needed
        return null;
      },

      journalEntries: async (_: any, { filter = {} }: any, context: any) => {
        await authService.requirePermission(context.userId, 'journal_entries', 'read');

        const {
          status,
          startDate,
          endDate,
          accountId,
          createdBy,
          limit = 50,
          offset = 0
        } = filter;

        // Implementation needed - would use repository with filters
        return [];
      },

      journalEntry: async (_: any, { id }: any, context: any) => {
        await authService.requirePermission(context.userId, 'journal_entries', 'read');
        // Implementation needed
        return null;
      },

      accountBalances: async (_: any, { filter = {} }: any, context: any) => {
        await authService.requirePermission(context.userId, 'accounts', 'read');

        const { accountIds, asOfDate } = filter;

        if (accountIds && accountIds.length > 0) {
          const balances = await accountingService.getMultipleAccountBalances(
            accountIds,
            asOfDate ? new Date(asOfDate) : undefined
          );

          return Array.from(balances.entries()).map(([accountId, balance]) => ({
            account: { id: accountId }, // Would need to fetch account details
            balance,
            asOfDate: asOfDate || new Date().toISOString(),
            lastTransactionDate: null // Would need to implement
          }));
        }

        return [];
      },

      accountBalance: async (_: any, { accountId, asOfDate }: any, context: any) => {
        await authService.requirePermission(context.userId, 'accounts', 'read');

        const balance = await accountingService.getAccountBalance(
          accountId,
          asOfDate ? new Date(asOfDate) : undefined
        );

        return {
          account: { id: accountId },
          balance,
          asOfDate: asOfDate || new Date().toISOString(),
          lastTransactionDate: null
        };
      },

      trialBalance: async (_: any, { asOfDate }: any, context: any) => {
        await authService.requirePermission(context.userId, 'reports', 'read');

        const entries = await accountingService.generateTrialBalance(
          asOfDate ? new Date(asOfDate) : new Date()
        );

        const totalDebit = entries.reduce(
          (sum, entry) => sum.add(entry.debitBalance),
          new Money(0)
        );

        const totalCredit = entries.reduce(
          (sum, entry) => sum.add(entry.creditBalance),
          new Money(0)
        );

        // Log audit event
        await auditService.logReportGenerated(
          context.userId,
          'Trial Balance (GraphQL)',
          { asOfDate },
          context.req?.ip,
          context.req?.get('User-Agent')
        );

        return {
          entries: entries.map(item => ({
            account: item.account.toJSON(),
            debitBalance: item.debitBalance,
            creditBalance: item.creditBalance
          })),
          totalDebit,
          totalCredit,
          asOfDate: (asOfDate ? new Date(asOfDate) : new Date()).toISOString(),
          generatedAt: new Date().toISOString()
        };
      },

      reportJob: async (_: any, { id }: any, context: any) => {
        // Implementation needed - would check job status
        return null;
      },

      auditTrail: async (_: any, { filter = {} }: any, context: any) => {
        await authService.requirePermission(context.userId, 'audit_logs', 'read');

        const { resourceType, resourceId, userId, startDate, endDate, limit = 100, offset = 0 } = filter;

        if (resourceType && resourceId) {
          const auditTrail = await auditService.getAuditTrail(resourceType, resourceId);
          return auditTrail.slice(offset, offset + limit).map(entry => entry.toJSON());
        }

        return [];
      },

      userPermissions: async (_: any, __: any, context: any) => {
        const permissions = await authService.getUserPermissions(context.userId);
        const roles = await authService.getUserRoles(context.userId);

        return {
          userId: context.userId,
          roles: roles.map(r => r.toJSON()),
          permissions: permissions.map(p => p.toJSON()),
          effectivePermissions: permissions.map(p => p.fullName)
        };
      },

      availablePermissions: async (_: any, __: any, context: any) => {
        await authService.requirePermission(context.userId, 'users', 'manage_roles');
        return await authService.getAllPermissions();
      },

      roles: async (_: any, __: any, context: any) => {
        await authService.requirePermission(context.userId, 'users', 'manage_roles');
        const roles = await authService.getAllRoles();
        return roles.map(r => r.toJSON());
      }
    },

    // Mutation resolvers
    Mutation: {
      createJournalEntry: async (_: any, { input }: any, context: any) => {
        await authService.requirePermission(context.userId, 'journal_entries', 'create');

        const entry = await accountingService.createJournalEntry(
          input.description,
          new Date(input.entryDate),
          input.lines.map((line: any) => ({
            accountId: line.accountId,
            debit: typeof line.debit === 'number' ? line.debit : undefined,
            credit: typeof line.credit === 'number' ? line.credit : undefined,
            description: line.description
          })),
          context.userId
        );

        // Log audit event
        await auditService.logJournalEntryCreated(
          entry.id,
          context.userId,
          {
            entryNumber: entry.entryNumber,
            description: entry.description,
            totalDebit: entry.totalDebit.amount,
            totalCredit: entry.totalCredit.amount
          },
          context.req?.ip,
          context.req?.get('User-Agent')
        );

        return entry.toJSON();
      },

      postJournalEntry: async (_: any, { id, input }: any, context: any) => {
        await authService.requirePermission(context.userId, 'journal_entries', 'post');

        const entry = await accountingService.postJournalEntry(id, context.userId);
        return entry.toJSON();
      },

      voidJournalEntry: async (_: any, { id, reason }: any, context: any) => {
        await authService.requirePermission(context.userId, 'journal_entries', 'void');

        // Implementation needed - would void the journal entry
        // For now, return placeholder
        throw new Error('Void journal entry not yet implemented');
      },

      generateReport: async (_: any, { input }: any, context: any) => {
        await authService.requirePermission(context.userId, 'reports', 'generate');

        const priority =
          input.priority === 'low' || input.priority === 'high' || input.priority === 'medium'
            ? input.priority
            : 'medium';

        const jobId = await accountingService.generateReportAsync(
          input.reportType,
          input.parameters ? JSON.parse(input.parameters) : {},
          context.userId,
          priority
        );

        return {
          id: jobId,
          reportType: input.reportType,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
      },

      assignUserRole: async (_: any, { userId, roleId }: any, context: any) => {
        await authService.requirePermission(context.userId, 'users', 'manage_roles');

        await authService.assignRoleToUser(userId, roleId, context.userId);
        return true;
      },

      removeUserRole: async (_: any, { userId, roleId }: any, context: any) => {
        await authService.requirePermission(context.userId, 'users', 'manage_roles');

        await authService.removeRoleFromUser(userId, roleId);
        return true;
      }
    },

    // Field resolvers for relationships
    JournalEntry: {
      lines: async (parent: any) => {
        // Implementation needed - would fetch lines for the entry
        return parent.lines || [];
      }
    },

    JournalEntryLine: {
      account: async (parent: any) => {
        // Implementation needed - would fetch account details
        return { id: parent.accountId };
      }
    }
  };
}

// Create Apollo Server instance
export function createGraphQLServer(
  accountingService: EnhancedAccountingService,
  authService: AuthorizationService,
  auditService: AuditService
) {
  const resolvers = createResolvers(accountingService, authService, auditService);

  return new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }: any) => {
      // Extract user from request (would be set by auth middleware)
      const userId = req.user?.id;
      return {
        userId,
        req
      };
    },
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      return {
        message: error.message,
        code: error.extensions?.code || 'INTERNAL_ERROR',
        path: error.path
      };
    },
    introspection: process.env.NODE_ENV !== 'production', // Disable in production if desired
    playground: process.env.NODE_ENV !== 'production'
  });
}
