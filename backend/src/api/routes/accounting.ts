// API Layer - Routes
// Accounting API routes with proper authorization and audit logging

import express, { Request, Response } from 'express';
import { AccountingService } from '../../domain/services/AccountingService';
import { AuthorizationService } from '../../domain/services/AuthorizationService';
import { AuditService } from '../../domain/services/AuditService';
import { AuthorizationMiddleware } from '../middleware/authorization';
import { JournalEntry, JournalEntryStatus } from '../../domain/entities/JournalEntry';
import { Money } from '../../domain/value-objects/Money';

export function createAccountingRoutes(
  accountingService: AccountingService,
  authService: AuthorizationService,
  auditService: AuditService,
  authMiddleware: AuthorizationMiddleware
) {
  const router = express.Router();

  // Journal Entries API
  router.post('/journal-entries',
    authMiddleware.authenticateAndLoadPermissions(),
    authMiddleware.requirePermission('journal_entries', 'create'),
    async (req: Request, res: Response) => {
      try {
        const { description, entryDate, lines } = req.body;
        const userId = req.user!.id;

        const entry = await accountingService.createJournalEntry(
          description,
          new Date(entryDate),
          lines,
          userId
        );

        // Log audit event
        await auditService.logJournalEntryCreated(
          entry.id,
          userId,
          {
            entryNumber: entry.entryNumber,
            description: entry.description,
            totalDebit: entry.totalDebit.amount,
            totalCredit: entry.totalCredit.amount
          },
          req.ip,
          req.get('User-Agent')
        );

        res.status(201).json({
          success: true,
          data: entry.toJSON()
        });
      } catch (error: any) {
        console.error('Create journal entry error:', error.message);
        res.status(400).json({ error: error.message });
      }
    }
  );

  router.get('/journal-entries',
    authMiddleware.authenticateAndLoadPermissions(),
    authMiddleware.requirePermission('journal_entries', 'read'),
    async (req: Request, res: Response) => {
      try {
        const { status, limit = 50, offset = 0 } = req.query;
        const userId = req.user!.id;

        // For now, return empty array - implement proper querying later
        // This would need additional repository methods for complex queries
        res.json({
          success: true,
          data: [],
          pagination: { limit: Number(limit), offset: Number(offset) }
        });
      } catch (error: any) {
        console.error('Get journal entries error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  router.get('/journal-entries/:id',
    authMiddleware.authenticateAndLoadPermissions(),
    authMiddleware.requirePermission('journal_entries', 'read'),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const userId = req.user!.id;

        // This would need a method to get journal entry by ID from repository
        // For now, return not found
        res.status(404).json({ error: 'Journal entry not found' });
      } catch (error: any) {
        console.error('Get journal entry error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  router.post('/journal-entries/:id/post',
    authMiddleware.authenticateAndLoadPermissions(),
    authMiddleware.requirePermission('journal_entries', 'post'),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const userId = req.user!.id;

        // This would need implementation to post journal entry
        // For now, return success
        res.json({
          success: true,
          message: 'Journal entry posted successfully'
        });
      } catch (error: any) {
        console.error('Post journal entry error:', error.message);
        res.status(400).json({ error: error.message });
      }
    }
  );

  // Account balance API
  router.get('/accounts/:accountId/balance',
    authMiddleware.authenticateAndLoadPermissions(),
    authMiddleware.requirePermission('accounts', 'read'),
    async (req: Request, res: Response) => {
      try {
        const { accountId } = req.params;
        const { asOfDate } = req.query;

        const balance = await accountingService.getAccountBalance(
          accountId,
          asOfDate ? new Date(asOfDate as string) : undefined
        );

        res.json({
          success: true,
          data: {
            accountId,
            balance: balance.toJSON(),
            asOfDate: asOfDate || new Date().toISOString()
          }
        });
      } catch (error: any) {
        console.error('Get account balance error:', error.message);
        res.status(400).json({ error: error.message });
      }
    }
  );

  // Trial balance API
  router.get('/reports/trial-balance',
    authMiddleware.authenticateAndLoadPermissions(),
    authMiddleware.requirePermission('reports', 'read'),
    async (req: Request, res: Response) => {
      try {
        const { asOfDate } = req.query;
        const userId = req.user!.id;

        const trialBalance = await accountingService.generateTrialBalance(
          asOfDate ? new Date(asOfDate as string) : new Date()
        );

        // Log audit event
        await auditService.logReportGenerated(
          userId,
          'Trial Balance',
          { asOfDate },
          req.ip,
          req.get('User-Agent')
        );

        res.json({
          success: true,
          data: trialBalance.map(item => ({
            account: item.account.toJSON(),
            debitBalance: item.debitBalance.toJSON(),
            creditBalance: item.creditBalance.toJSON()
          }))
        });
      } catch (error: any) {
        console.error('Generate trial balance error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Audit trail API
  router.get('/audit/:resourceType/:resourceId',
    authMiddleware.authenticateAndLoadPermissions(),
    authMiddleware.requirePermission('audit_logs', 'read'),
    async (req: Request, res: Response) => {
      try {
        const { resourceType, resourceId } = req.params;

        const auditTrail = await auditService.getAuditTrail(resourceType, resourceId);

        res.json({
          success: true,
          data: auditTrail.map(entry => entry.toJSON())
        });
      } catch (error: any) {
        console.error('Get audit trail error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // User permissions API
  router.get('/user/permissions',
    authMiddleware.authenticateAndLoadPermissions(),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;

        const permissions = await authService.getUserPermissions(userId);
        const roles = await authService.getUserRoles(userId);

        res.json({
          success: true,
          data: {
            permissions: permissions.map(p => p.toJSON()),
            roles: roles.map(r => r.toJSON()),
            permissionStrings: req.permissions || []
          }
        });
      } catch (error: any) {
        console.error('Get user permissions error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  return router;
}
