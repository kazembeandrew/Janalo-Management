import { vi, describe, it, expect, beforeEach } from 'vitest';
import { loanService } from '../loans';
import { Loan } from '../../types';

// Mock the API client
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('Loan Service', () => {
  const mockLoan: Loan = {
    id: 'loan-1',
    reference_no: 'LN-001',
    borrower_id: 'borrower-1',
    officer_id: 'officer-1',
    principal_amount: 10000,
    interest_rate: 12,
    interest_type: 'flat',
    term_months: 12,
    monthly_installment: 933.33,
    total_payable: 11200,
    principal_outstanding: 10000,
    interest_outstanding: 1200,
    penalty_outstanding: 0,
    status: 'active',
    disbursement_date: '2024-01-01',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    borrowers: {
      full_name: 'John Doe',
      phone: '+255712345678',
      address: 'Employed'
    },
    repayments: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLoans', () => {
    it('should fetch loans successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          data: [mockLoan],
          page: 1,
          limit: 10,
          total: 1
        }
      };

      // @ts-ignore - Mock implementation
      require('../../lib/api').api.get.mockResolvedValue(mockResponse);

      const result = await loanService.getLoans();

      expect(result).toEqual(mockResponse);
      expect(require('../../lib/api').api.get).toHaveBeenCalledWith('/loans', {
        params: { page: 1, limit: 10 }
      });
    });

    it('should handle API errors', async () => {
      const mockError = {
        success: false,
        error: { message: 'Server error', code: 500 }
      };

      // @ts-ignore - Mock implementation
      require('../../lib/api').api.get.mockResolvedValue(mockError);

      const result = await loanService.getLoans();

      expect(result).toEqual(mockError);
    });

    it('should handle network errors', async () => {
      // @ts-ignore - Mock implementation
      require('../../lib/api').api.get.mockRejectedValue(new Error('Network error'));

      const result = await loanService.getLoans();

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Network error');
    });

    it('should fetch loans with filters', async () => {
      const filters = {
        status: 'active' as any,
        officer_id: 'officer-1',
        date_from: '2024-01-01',
        date_to: '2024-12-31'
      };

      const mockResponse = {
        success: true,
        data: {
          data: [mockLoan],
          page: 1,
          limit: 10,
          total: 1
        }
      };

      // @ts-ignore - Mock implementation
      require('../../lib/api').api.get.mockResolvedValue(mockResponse);

      const result = await loanService.getLoans(filters);

      expect(result).toEqual(mockResponse);
      expect(require('../../lib/api').api.get).toHaveBeenCalledWith('/loans', {
          params: {
            page: 1,
            limit: 10,
            status: 'active' as any,
            officer_id: 'officer-1',
            date_from: '2024-01-01',
            date_to: '2024-12-31'
          }
      });
    });
  });

  describe('getLoanById', () => {
    it('should fetch loan by ID successfully', async () => {
      const mockResponse = {
        success: true,
        data: mockLoan
      };

      // @ts-ignore - Mock implementation
      require('../../lib/api').api.get.mockResolvedValue(mockResponse);

      const result = await loanService.getLoanById('loan-1');

      expect(result).toEqual(mockResponse);
      expect(require('../../lib/api').api.get).toHaveBeenCalledWith('/loans/loan-1');
    });

    it('should handle loan not found', async () => {
      const mockResponse = {
        success: false,
        error: { message: 'Loan not found', code: 404 }
      };

      // @ts-ignore - Mock implementation
      require('../../lib/api').api.get.mockResolvedValue(mockResponse);

      const result = await loanService.getLoanById('non-existent-loan');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('createLoan', () => {
    it('should create loan successfully', async () => {
      const loanData = {
        borrower_id: 'borrower-1',
        officer_id: 'officer-1',
        principal_amount: 15000,
        interest_rate: 15,
        interest_type: 'flat' as any,
        term_months: 12,
        disbursement_date: '2024-01-01'
      };

      const mockResponse = {
        success: true,
        data: { ...mockLoan, ...loanData, id: 'new-loan-id' }
      };

      // @ts-ignore - Mock implementation
      require('../../lib/api').api.post.mockResolvedValue(mockResponse);

      const result = await loanService.createLoan(loanData);

      expect(result).toEqual(mockResponse);
      expect(require('../../lib/api').api.post).toHaveBeenCalledWith('/loans', loanData);
    });

    it('should validate required fields', async () => {
      const invalidLoanData = {
        borrower_id: '',
        officer_id: 'officer-1',
        principal_amount: 0,
        interest_rate: -5,
        term_months: 0,
        interest_type: 'flat' as any,
        disbursement_date: '2024-01-01'
      };

      const result = await loanService.createLoan(invalidLoanData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Validation failed');
    });

    it('should handle server validation errors', async () => {
      const loanData = {
        borrower_id: 'borrower-1',
        officer_id: 'officer-1',
        principal_amount: 15000,
        interest_rate: 15,
        interest_type: 'flat' as any,
        term_months: 12,
        disbursement_date: '2024-01-01'
      };

      const mockResponse = {
        success: false,
        error: { 
          message: 'Validation failed', 
          code: 400,
          details: ['Borrower not found', 'Officer not authorized']
        }
      };

      // @ts-ignore - Mock implementation
      require('../../lib/api').api.post.mockResolvedValue(mockResponse);

      const result = await loanService.createLoan(loanData);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateLoan', () => {
    it('should update loan successfully', async () => {
      const updateData = {
        id: 'loan-1',
        interest_rate: 14,
        status: 'completed' as any
      };

      const mockResponse = {
        success: true,
        data: { ...mockLoan, ...updateData }
      };

      // @ts-ignore - Mock implementation
      require('../../lib/api').api.put.mockResolvedValue(mockResponse);

      const result = await loanService.updateLoan(updateData);

      expect(result).toEqual(mockResponse);
      expect(require('../../lib/api').api.put).toHaveBeenCalledWith('/loans/loan-1', updateData);
    });

    it('should handle partial updates', async () => {
      const partialUpdate = {
        id: 'loan-1',
        interest_rate: 14
      };

      const mockResponse = {
        success: true,
        data: { ...mockLoan, interest_rate: 14 }
      };

      // @ts-ignore - Mock implementation
      require('../../lib/api').api.put.mockResolvedValue(mockResponse);

      const result = await loanService.updateLoan(partialUpdate);

      expect(result).toEqual(mockResponse);
      expect(require('../../lib/api').api.put).toHaveBeenCalledWith('/loans/loan-1', partialUpdate);
    });

    it('should validate update data', async () => {
      const invalidUpdate = {
        id: 'loan-1',
        interest_rate: -10,
        term_months: -1
      };

      const result = await loanService.updateLoan(invalidUpdate);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Validation failed');
    });
  });

  describe('deleteLoan', () => {
    it('should delete loan successfully', async () => {
      const mockResponse = {
        success: true,
        data: { message: 'Loan deleted successfully' }
      };

      // @ts-ignore - Mock implementation
      require('../../lib/api').api.delete.mockResolvedValue(mockResponse);

      const result = await loanService.deleteLoan('loan-1');

      expect(result).toEqual(mockResponse);
      expect(require('../../lib/api').api.delete).toHaveBeenCalledWith('/loans/loan-1');
    });

    it('should handle loan not found', async () => {
      const mockResponse = {
        success: false,
        error: { message: 'Loan not found', code: 404 }
      };

      // @ts-ignore - Mock implementation
      require('../../lib/api').api.delete.mockResolvedValue(mockResponse);

      const result = await loanService.deleteLoan('non-existent-loan');

      expect(result).toEqual(mockResponse);
    });

    it('should handle deletion of loan with active repayments', async () => {
      const mockResponse = {
        success: false,
        error: { 
          message: 'Cannot delete loan with active repayments', 
          code: 400 
        }
      };

      // @ts-ignore - Mock implementation
      require('../../lib/api').api.delete.mockResolvedValue(mockResponse);

      const result = await loanService.deleteLoan('loan-with-repayments');

      expect(result).toEqual(mockResponse);
    });
  });

});
