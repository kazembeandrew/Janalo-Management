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
import { UserProfile as User, UserRole, Role } from '../types';

// Define local Permission interface since it doesn't exist in types
interface Permission {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
}
import { 
  validateRequiredFields, 
  formatCurrency, 
  formatDate 
} from './_shared/utils';
import { auditService } from './audit';
import { searchService } from './search';
import { permissionService } from './permissions';
import { supabase } from '@/lib/supabase';

interface CreateUserInput {
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  department?: string;
  position?: string;
  status?: 'active' | 'inactive' | 'pending';
  permissions?: string[];
}

interface UpdateUserInput {
  id: string;
  email?: string;
  full_name?: string;
  role?: string;
  phone?: string;
  department?: string;
  position?: string;
  status?: 'active' | 'inactive' | 'pending';
  permissions?: string[];
}

interface UserFilters extends FilterParams {
  role?: string;
  status?: string;
  department?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

/**
 * Users Service for managing user operations
 */
export class UsersService extends BaseServiceClass {
  private static instance: UsersService;

  /**
   * Get singleton instance
   */
  public static getInstance(): UsersService {
    if (!UsersService.instance) {
      UsersService.instance = new UsersService();
    }
    return UsersService.instance;
  }

  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput): Promise<ServiceResult<User>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['email', 'full_name', 'role'];
      const missing = validateRequiredFields(input, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      // Validate email format
      if (!this.validateEmailFormat(input.email)) {
        throw new Error('Invalid email format');
      }

      // Check if user already exists with same email
      const existingUser = await this.getUserByEmail(input.email);
      if (existingUser.data) {
        throw new Error('A user with this email already exists');
      }

      // Validate role exists
      const rolesResult = await this.getUserRoles();
      const validRoles = rolesResult.data || [];
      const roleExists = validRoles.some(role => role.name === input.role);
      
      if (!roleExists) {
        throw new Error(`Invalid role: ${input.role}`);
      }

      const { data, error } = await (supabase as any)
        .from('users')
        .insert([{
          email: input.email.trim().toLowerCase(),
          full_name: input.full_name.trim(),
          role: input.role as UserRole,
          is_active: input.status === 'active',
          phone: input.phone?.trim(),
          department: input.department?.trim(),
          position: input.position?.trim(),
          status: input.status || 'pending'
        }])
        .select()
        .single();

      if (error) throw error;
      const user = data as User;

      // Log audit
      await this.logAudit('create_user', 'user', user.id, {
        action: 'create',
        user_id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      });

      // Update search index
      await searchService.indexUser(user);

      return user;
    }, 'Failed to create user');
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<ServiceResult<User>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('User ID is required');
      }

      // Simulate database query
      const user = await this.fetchUserFromDatabase(id);
      
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    }, 'Failed to get user');
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<ServiceResult<User>> {
    return this.handleAsyncOperation(async () => {
      if (!email) {
        throw new Error('Email is required');
      }

      // Simulate database query
      const user = await this.fetchUserByEmailFromDatabase(email);
      
      return user;
    }, 'Failed to get user by email');
  }

  /**
   * Get all users with pagination and filtering
   */
  async getUsers(
    filters?: UserFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ServiceResult<ListResponse<User>>> {
    return this.handleAsyncOperation(async () => {
      // Simulate database query
      const result = await this.fetchUsersFromDatabase(filters, pagination, sort);
      
      return result;
    }, 'Failed to get users');
  }

  /**
   * Update user
   */
  async updateUser(input: UpdateUserInput): Promise<ServiceResult<User>> {
    return this.handleAsyncOperation(async () => {
      if (!input.id) {
        throw new Error('User ID is required');
      }

      const existingUser = await this.getUserById(input.id);
      if (!existingUser.data) {
        throw new Error('User not found');
      }

      // Check if email is being changed and if it already exists
      if (input.email && input.email !== existingUser.data.email) {
        if (!this.validateEmailFormat(input.email)) {
          throw new Error('Invalid email format');
        }
        
        const existingWithEmail = await this.getUserByEmail(input.email);
        if (existingWithEmail.data && existingWithEmail.data.id !== input.id) {
          throw new Error('A user with this email already exists');
        }
      }

      const updatedUser: User = {
        ...existingUser.data,
        ...input,
        role: input.role as UserRole || existingUser.data.role,
        created_at: existingUser.data.created_at // Keep original creation date
      };

      // Log audit
      await this.logAudit('update_user', 'user', input.id, {
        action: 'update',
        user_id: input.id,
        changes: input
      });

      // Update search index
      await searchService.updateUserIndex(updatedUser);

      return updatedUser;
    }, 'Failed to update user');
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('User ID is required');
      }

      const existingUser = await this.getUserById(id);
      if (!existingUser.data) {
        throw new Error('User not found');
      }

      // Check if user has active loans or other dependencies
      const hasActiveLoans = await this.userHasActiveLoans(id);
      if (hasActiveLoans) {
        throw new Error('Cannot delete user with active loans or responsibilities');
      }

      // Log audit
      await this.logAudit('delete_user', 'user', id, {
        action: 'delete',
        user_id: id,
        email: existingUser.data.email,
        full_name: existingUser.data.full_name
      });

      // Remove from search index
      await searchService.removeFromIndex('user', id);

      return true;
    }, 'Failed to delete user');
  }

  /**
   * Activate user
   */
  async activateUser(id: string, activatedBy?: string): Promise<ServiceResult<User>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('User ID is required');
      }

      const existingUser = await this.getUserById(id);
      if (!existingUser.data) {
        throw new Error('User not found');
      }

      const updatedUser: User = {
        ...existingUser.data,
        status: 'active',
        activated_at: new Date().toISOString(),
        activated_by: activatedBy || this.getProfile()?.id
      };

      // Log audit
      await this.logAudit('activate_user', 'user', id, {
        action: 'activate',
        user_id: id,
        activated_by: updatedUser.activated_by
      });

      // Update search index
      await searchService.updateUserIndex(updatedUser);

      return updatedUser;
    }, 'Failed to activate user');
  }

  /**
   * Deactivate user
   */
  async deactivateUser(id: string, deactivatedBy?: string): Promise<ServiceResult<User>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('User ID is required');
      }

      const existingUser = await this.getUserById(id);
      if (!existingUser.data) {
        throw new Error('User not found');
      }

      const updatedUser: User = {
        ...existingUser.data,
        status: 'inactive',
        deactivated_at: new Date().toISOString(),
        deactivated_by: deactivatedBy || this.getProfile()?.id
      };

      // Log audit
      await this.logAudit('deactivate_user', 'user', id, {
        action: 'deactivate',
        user_id: id,
        deactivated_by: updatedUser.deactivated_by
      });

      // Update search index
      await searchService.updateUserIndex(updatedUser);

      return updatedUser;
    }, 'Failed to deactivate user');
  }

  /**
   * Get user roles
   */
  async getUserRoles(): Promise<ServiceResult<Role[]>> {
    return this.handleAsyncOperation(async () => {
      // Simulate database query
      const roles = await this.fetchRolesFromDatabase();
      
      return roles;
    }, 'Failed to get user roles');
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string): Promise<ServiceResult<Permission[]>> {
    return this.handleAsyncOperation(async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Simulate database query
      const permissions = await this.fetchUserPermissionsFromDatabase(userId);
      
      return permissions;
    }, 'Failed to get user permissions');
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, role: string, assignedBy?: string): Promise<ServiceResult<User>> {
    return this.handleAsyncOperation(async () => {
      if (!userId || !role) {
        throw new Error('User ID and role are required');
      }

      const existingUser = await this.getUserById(userId);
      if (!existingUser.data) {
        throw new Error('User not found');
      }

      // Validate role exists
      const rolesResult = await this.getUserRoles();
      const validRoles = rolesResult.data || [];
      const roleExists = validRoles.some(r => r.name === role);
      
      if (!roleExists) {
        throw new Error(`Invalid role: ${role}`);
      }

      const updatedUser: User = {
        ...existingUser.data,
        role: role as UserRole,
        role_assigned_at: new Date().toISOString(),
        role_assigned_by: assignedBy || this.getProfile()?.id
      };

      // Log audit
      await this.logAudit('assign_role', 'user', userId, {
        action: 'role_assignment',
        user_id: userId,
        role: role,
        assigned_by: updatedUser.role_assigned_by
      });

      // Update search index
      await searchService.updateUserIndex(updatedUser);

      return updatedUser;
    }, 'Failed to assign role');
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(): Promise<ServiceResult<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    pendingUsers: number;
    roleDistribution: Array<{
      role: string;
      count: number;
      percentage: number;
    }>;
    departmentDistribution: Array<{
      department: string;
      count: number;
      percentage: number;
    }>;
  }>> {
    return this.handleAsyncOperation(async () => {
      const usersResult = await this.getUsers();
      const users = usersResult.data?.data || [];

      const totalUsers = users.length;
      const activeUsers = users.filter(user => user.status === 'active').length;
      const inactiveUsers = users.filter(user => user.status === 'inactive').length;
      const pendingUsers = users.filter(user => user.status === 'pending').length;

      // Role distribution
      const roleMap = new Map<string, number>();
      users.forEach(user => {
        const count = roleMap.get(user.role) || 0;
        roleMap.set(user.role, count + 1);
      });

      const roleDistribution = Array.from(roleMap.entries()).map(([role, count]) => ({
        role,
        count,
        percentage: totalUsers > 0 ? (count / totalUsers) * 100 : 0
      }));

      // Department distribution
      const deptMap = new Map<string, number>();
      users.forEach(user => {
        const dept = user.department || 'Unassigned';
        const count = deptMap.get(dept) || 0;
        deptMap.set(dept, count + 1);
      });

      const departmentDistribution = Array.from(deptMap.entries()).map(([department, count]) => ({
        department,
        count,
        percentage: totalUsers > 0 ? (count / totalUsers) * 100 : 0
      }));

      return {
        totalUsers,
        activeUsers,
        inactiveUsers,
        pendingUsers,
        roleDistribution,
        departmentDistribution
      };
    }, 'Failed to get user statistics');
  }

  /**
   * Search users
   */
  async searchUsers(query: string, filters?: UserFilters): Promise<ServiceResult<ListResponse<User>>> {
    return this.handleAsyncOperation(async () => {
      if (!query || query.trim() === '') {
        throw new Error('Search query is required');
      }

      // Use search service and convert to ListResponse format
      const searchResult = await searchService.searchUsers(query, 50);
      
      if (searchResult.error) {
        throw new Error(searchResult.error.message);
      }

      // Convert search results to User type and create ListResponse
      const users: User[] = searchResult.data?.map(result => ({
        id: result.id || '',
        email: result.email || '',
        full_name: result.full_name || '',
        role: (result.role as UserRole) || 'loan_officer',
        is_active: result.status === 'active',
        status: result.status || 'pending',
        created_at: result.created_at || ''
      })) || [];

      return {
        data: users,
        total: users.length,
        page: 1,
        limit: 50,
        totalPages: Math.ceil(users.length / 50)
      };
    }, 'Failed to search users');
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: string): Promise<ServiceResult<User[]>> {
    return this.handleAsyncOperation(async () => {
      if (!role) {
        throw new Error('Role is required');
      }

      // Simulate database query
      const users = await this.fetchUsersByRoleFromDatabase(role);
      
      return users;
    }, 'Failed to get users by role');
  }

  /**
   * Get users by department
   */
  async getUsersByDepartment(department: string): Promise<ServiceResult<User[]>> {
    return this.handleAsyncOperation(async () => {
      if (!department) {
        throw new Error('Department is required');
      }

      // Simulate database query
      const users = await this.fetchUsersByDepartmentFromDatabase(department);
      
      return users;
    }, 'Failed to get users by department');
  }

  /**
   * Validate email format (helper method)
   */
  private validateEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if user has active loans
   */
  private async userHasActiveLoans(userId: string): Promise<boolean> {
    // Simulate database query
    // This would check if the user has any active loans or other responsibilities
    return false;
  }

  // Private helper methods for database operations
  // In a real implementation, these would query the actual database

  // Private helper methods for database operations
  private async fetchUserFromDatabase(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) return null;
    return data as User;
  }

  private async fetchUserByEmailFromDatabase(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();
      
    if (error) return null;
    return data as User;
  }

  private async fetchUsersFromDatabase(
    filters?: UserFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ListResponse<User>> {
    let query = (supabase as any).from('users').select('*', { count: 'exact' });

    if (filters?.search) {
      query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }
    if (filters?.role) {
      query = query.eq('role', filters.role);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.department) {
      query = query.eq('department', filters.department);
    }
    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    if (sort) {
      query = query.order(sort.sortBy || 'full_name', { ascending: sort.sortOrder === 'asc' });
    } else {
      query = query.order('full_name', { ascending: true });
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const start = (page - 1) * limit;

    const { data, count, error } = await query.range(start, start + limit - 1);

    if (error) throw error;

    return {
      data: (data || []) as User[],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    };
  }

  private async fetchRolesFromDatabase(): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('name');
      
    if (error) throw error;
    return data as Role[];
  }

  private async fetchUserPermissionsFromDatabase(userId: string): Promise<Permission[]> {
    const { data, error } = await supabase.rpc('get_user_permissions', {
      user_id: userId
    });
    
    if (error) {
        console.error('Error fetching permissions:', error);
        return [];
    }
    return data as Permission[];
  }

  private async fetchUsersByRoleFromDatabase(role: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', role)
      .order('full_name');
      
    if (error) throw error;
    return data as User[];
  }

  private async fetchUsersByDepartmentFromDatabase(department: string): Promise<User[]> {
    const { data, error } = await (supabase as any)
      .from('users')
      .select('*')
      .eq('department', department)
      .order('full_name');
      
    if (error) throw error;
    return data as User[];
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// Export singleton instance
export const usersService = UsersService.getInstance();