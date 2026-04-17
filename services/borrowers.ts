import { 
  BaseServiceClass, 
  ServiceResult, 
  ServiceError, 
  PaginationParams, 
  SortParams, 
  FilterParams, 
  ListResponse, 
  AuditLogEntry 
} from './_shared/baseService';
import { Borrower, Loan } from '../types';
import { 
  validateRequiredFields, 
  generateAutoReference, 
  formatDate 
} from './_shared/utils';
import { auditService } from './audit';
import { searchService } from './search';
import { supabase } from '@/lib/supabase';

interface CreateBorrowerInput {
  full_name: string;
  phone: string;
  address: string;
  employment: string;
  email?: string;
  id_number?: string;
  date_of_birth?: string;
  gender?: string;
  marital_status?: string;
  next_of_kin?: string;
  next_of_kin_phone?: string;
  created_by?: string;
}

interface UpdateBorrowerInput {
  id: string;
  full_name?: string;
  phone?: string;
  address?: string;
  employment?: string;
  email?: string;
  id_number?: string;
  date_of_birth?: string;
  gender?: string;
  marital_status?: string;
  next_of_kin?: string;
  next_of_kin_phone?: string;
}

interface BorrowerFilters extends FilterParams {
  search?: string;
  employment?: string;
  gender?: string;
  marital_status?: string;
  date_from?: string;
  date_to?: string;
}

/**
 * Borrower Service for managing borrower operations
 */
export class BorrowerService extends BaseServiceClass {
  private static instance: BorrowerService;

  /**
   * Get singleton instance
   */
  public static getInstance(): BorrowerService {
    if (!BorrowerService.instance) {
      BorrowerService.instance = new BorrowerService();
    }
    return BorrowerService.instance;
  }

  /**
   * Create a new borrower
   */
  async createBorrower(input: CreateBorrowerInput): Promise<ServiceResult<Borrower>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['full_name', 'phone', 'address', 'employment'];
      const missing = validateRequiredFields(input, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      // Validate phone number format
      if (!this.isValidPhoneNumber(input.phone)) {
        throw new Error('Invalid phone number format');
      }

      // Check if borrower already exists with same phone number
      const existingBorrower = await this.getBorrowerByPhone(input.phone);
      if (existingBorrower.data) {
        throw new Error('A borrower with this phone number already exists');
      }

      const { data: profile } = await (supabase as any).auth.getUser();

      const { data, error } = await (supabase as any)
        .from('borrowers')
        .insert([{
          full_name: input.full_name.trim(),
          phone: input.phone.trim(),
          email: input.email?.trim()?.toLowerCase(),
          address: input.address.trim(),
          employment: input.employment.trim(),
          gender: input.gender,
          marital_status: input.marital_status,
          created_by: input.created_by || profile?.user?.id
        }])
        .select()
        .single();

      if (error) throw error;
      const borrower = data as Borrower;

      // Log audit
      await this.logAudit('create_borrower', 'borrower', borrower.id, {
        action: 'create',
        borrower_id: borrower.id,
        full_name: borrower.full_name,
        phone: borrower.phone
      });

      // Update search index
      await searchService.indexBorrower(borrower);

      return borrower;
    }, 'Failed to create borrower');
  }

  /**
   * Get borrower by ID
   */
  async getBorrowerById(id: string): Promise<ServiceResult<Borrower>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('Borrower ID is required');
      }

      // Simulate database query
      const borrower = await this.fetchBorrowerFromDatabase(id);
      
      if (!borrower) {
        throw new Error('Borrower not found');
      }

      return borrower;
    }, 'Failed to get borrower');
  }

  /**
   * Get borrower by phone number
   */
  async getBorrowerByPhone(phone: string): Promise<ServiceResult<Borrower>> {
    return this.handleAsyncOperation(async () => {
      if (!phone) {
        throw new Error('Phone number is required');
      }

      // Simulate database query
      const borrower = await this.fetchBorrowerByPhoneFromDatabase(phone);
      
      return borrower;
    }, 'Failed to get borrower by phone');
  }

  /**
   * Get all borrowers with pagination and filtering
   */
  async getBorrowers(
    filters?: BorrowerFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ServiceResult<ListResponse<Borrower>>> {
    return this.handleAsyncOperation(async () => {
      // Simulate database query
      const result = await this.fetchBorrowersFromDatabase(filters, pagination, sort);
      
      return result;
    }, 'Failed to get borrowers');
  }

  /**
   * Update borrower
   */
  async updateBorrower(input: UpdateBorrowerInput): Promise<ServiceResult<Borrower>> {
    return this.handleAsyncOperation(async () => {
      if (!input.id) {
        throw new Error('Borrower ID is required');
      }

      const existingBorrower = await this.getBorrowerById(input.id);
      if (!existingBorrower.data) {
        throw new Error('Borrower not found');
      }

      // Check if phone number is being changed and if it already exists
      if (input.phone && input.phone !== existingBorrower.data.phone) {
        if (!this.isValidPhoneNumber(input.phone)) {
          throw new Error('Invalid phone number format');
        }
        
        const existingWithPhone = await this.getBorrowerByPhone(input.phone);
        if (existingWithPhone.data && existingWithPhone.data.id !== input.id) {
          throw new Error('A borrower with this phone number already exists');
        }
      }

      const updatedBorrower: Borrower = {
        ...existingBorrower.data,
        ...input,
        created_at: existingBorrower.data.created_at // Keep original creation date
      };

      // Log audit
      await this.logAudit('update_borrower', 'borrower', input.id, {
        action: 'update',
        borrower_id: input.id,
        changes: input
      });

      // Update search index
      await searchService.updateBorrowerIndex(updatedBorrower);

      return updatedBorrower;
    }, 'Failed to update borrower');
  }

  /**
   * Delete borrower
   */
  async deleteBorrower(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('Borrower ID is required');
      }

      const existingBorrower = await this.getBorrowerById(id);
      if (!existingBorrower.data) {
        throw new Error('Borrower not found');
      }

      // Check if borrower has active loans - if so, don't allow deletion
      const loans = await this.getBorrowerLoans(id);
      const activeLoans = loans.data?.filter(loan => loan.status === 'active');
      if (activeLoans && activeLoans.length > 0) {
        throw new Error('Cannot delete borrower with active loans');
      }

      // Log audit
      await this.logAudit('delete_borrower', 'borrower', id, {
        action: 'delete',
        borrower_id: id,
        full_name: existingBorrower.data.full_name
      });

      // Remove from search index
      await searchService.removeFromIndex('borrower', id);

      return true;
    }, 'Failed to delete borrower');
  }

  /**
   * Get borrower loans
   */
  async getBorrowerLoans(borrowerId: string): Promise<ServiceResult<Loan[]>> {
    return this.handleAsyncOperation(async () => {
      if (!borrowerId) {
        throw new Error('Borrower ID is required');
      }

      // Simulate database query
      const loans = await this.fetchBorrowerLoansFromDatabase(borrowerId);
      
      return loans;
    }, 'Failed to get borrower loans');
  }

  /**
   * Get borrower loan count and summary
   */
  async getBorrowerLoanSummary(borrowerId: string): Promise<ServiceResult<{
    totalLoans: number;
    activeLoans: number;
    completedLoans: number;
    totalOutstanding: number;
    totalRepaid: number;
  }>> {
    return this.handleAsyncOperation(async () => {
      const loansResult = await this.getBorrowerLoans(borrowerId);
      const loans = loansResult.data || [];

      const totalLoans = loans.length;
      const activeLoans = loans.filter(loan => loan.status === 'active').length;
      const completedLoans = loans.filter(loan => loan.status === 'completed').length;
      
      const totalOutstanding = loans.reduce((sum, loan) => sum + loan.principal_outstanding, 0);
      const totalRepaid = loans.reduce((sum, loan) => sum + (loan.total_payable - loan.principal_outstanding), 0);

      return {
        totalLoans,
        activeLoans,
        completedLoans,
        totalOutstanding,
        totalRepaid
      };
    }, 'Failed to get borrower loan summary');
  }

  /**
   * Search borrowers
   */
  async searchBorrowers(query: string, filters?: BorrowerFilters): Promise<ServiceResult<ListResponse<Borrower>>> {
    return this.handleAsyncOperation(async () => {
      if (!query || query.trim() === '') {
        throw new Error('Search query is required');
      }

      // Use search service and convert to ListResponse format
      const searchResult = await searchService.searchBorrowers(query, 50);
      
      if (searchResult.error) {
        throw new Error(searchResult.error.message);
      }

      // Convert SearchBorrowerResult[] to Borrower[] and create ListResponse
      const borrowers: Borrower[] = searchResult.data?.map(result => ({
        id: result.id,
        full_name: result.full_name,
        email: result.email,
        phone: result.phone,
        created_at: result.created_at,
        // Add required Borrower fields with defaults
        address: '',
        employment: '',
        created_by: ''
      })) || [];

      return {
        data: borrowers,
        total: borrowers.length,
        page: 1,
        limit: 50,
        totalPages: Math.ceil(borrowers.length / 50)
      };
    }, 'Failed to search borrowers');
  }

  /**
   * Get borrower by ID with loan history
   */
  async getBorrowerWithLoans(id: string): Promise<ServiceResult<{
    borrower: Borrower;
    loans: Loan[];
    loanSummary: {
      totalLoans: number;
      activeLoans: number;
      completedLoans: number;
      totalOutstanding: number;
      totalRepaid: number;
    };
  }>> {
    return this.handleAsyncOperation(async () => {
      const borrowerResult = await this.getBorrowerById(id);
      if (!borrowerResult.data) {
        throw new Error('Borrower not found');
      }

      const [loansResult, summaryResult] = await Promise.all([
        this.getBorrowerLoans(id),
        this.getBorrowerLoanSummary(id)
      ]);

      return {
        borrower: borrowerResult.data,
        loans: loansResult.data || [],
        loanSummary: summaryResult.data!
      };
    }, 'Failed to get borrower with loans');
  }

  /**
   * Get borrowers with loan status
   */
  async getBorrowersWithLoanStatus(
    filters?: BorrowerFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ServiceResult<Array<{
    borrower: Borrower;
    loanSummary: {
      totalLoans: number;
      activeLoans: number;
      completedLoans: number;
      totalOutstanding: number;
      totalRepaid: number;
    };
  }>>> {
    return this.handleAsyncOperation(async () => {
      const borrowersResult = await this.getBorrowers(filters, pagination, sort);
      const borrowers = borrowersResult.data?.data || [];

      const borrowersWithLoans = await Promise.all(
        borrowers.map(async (borrower) => {
          const summary = await this.getBorrowerLoanSummary(borrower.id);
          return {
            borrower,
            loanSummary: summary.data!
          };
        })
      );

      // Return just the array, not the paginated response
      return borrowersWithLoans;
    }, 'Failed to get borrowers with loan status');
  }

  /**
   * Validate phone number format
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Basic phone number validation - can be enhanced
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  // Private helper methods for database operations
  private async fetchBorrowerFromDatabase(id: string): Promise<Borrower | null> {
    const { data, error } = await (supabase as any)
      .from('borrowers')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) return null;
    return data as Borrower;
  }

  private async fetchBorrowerByPhoneFromDatabase(phone: string): Promise<Borrower | null> {
    const { data, error } = await (supabase as any)
      .from('borrowers')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();
      
    if (error) return null;
    return data as Borrower;
  }

  private async fetchBorrowersFromDatabase(
    filters?: BorrowerFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ListResponse<Borrower>> {
    let query = (supabase as any).from('borrowers').select('*', { count: 'exact' });

    if (filters?.search) {
      query = query.or(`full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
    }
    if (filters?.employment) {
      query = query.eq('employment', filters.employment);
    }
    if (filters?.gender) {
        query = query.eq('gender', filters.gender);
    }
    if (filters?.marital_status) {
        query = query.eq('marital_status', filters.marital_status);
    }
    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    if (sort) {
      query = query.order(sort.sortBy || 'created_at', { ascending: sort.sortOrder === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const start = (page - 1) * limit;

    const { data, count, error } = await query.range(start, start + limit - 1);

    if (error) throw error;

    return {
      data: (data || []) as Borrower[],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    };
  }

  private async fetchBorrowerLoansFromDatabase(borrowerId: string): Promise<Loan[]> {
    const { data, error } = await (supabase as any)
      .from('loans')
      .select('*')
      .eq('borrower_id', borrowerId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data as Loan[];
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// Export singleton instance
export const borrowerService = BorrowerService.getInstance();
