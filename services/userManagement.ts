import { 
  BaseServiceClass, 
  ServiceResult, 
  PaginationParams, 
  SortParams, 
  FilterParams, 
  ListResponse 
} from './_shared/baseService';
import { 
  RoleDefinition, 
  RolePermission, 
  UserRoleAssignment, 
  Employee 
} from '../types';
import { validateRequiredFields } from './_shared/utils';
import { auditService } from './audit';
import { supabase } from '@/lib/supabase';

// ============================================
// ROLE DEFINITION SERVICE
// ============================================

interface RoleDefinitionFilters extends FilterParams {
  code?: string;
  is_system?: boolean;
  is_active?: boolean;
}

export class RoleDefinitionService extends BaseServiceClass {
  private static instance: RoleDefinitionService;

  public static getInstance(): RoleDefinitionService {
    if (!RoleDefinitionService.instance) {
      RoleDefinitionService.instance = new RoleDefinitionService();
    }
    return RoleDefinitionService.instance;
  }

  async createRoleDefinition(input: Omit<RoleDefinition, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<RoleDefinition>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['name', 'code'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('roles')
        .insert([{ ...input, is_system: input.is_system || false, is_active: input.is_active !== false }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'role_definition', (data as any).id, input);
      return data as RoleDefinition;
    }, 'Failed to create role definition');
  }

  async getRoleDefinition(id: string): Promise<ServiceResult<RoleDefinition>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('roles').select().eq('id', id).single();
      if (error) throw error;
      return data as RoleDefinition;
    }, 'Failed to get role definition');
  }

  async getRoleDefinitions(filters?: RoleDefinitionFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<RoleDefinition>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('roles').select('*', { count: 'exact' });
      
      if (filters?.code) query = query.eq('code', filters.code);
      if (filters?.is_system !== undefined) query = query.eq('is_system', filters.is_system);
      if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);

      if (sort) {
        query = query.order(sort.sortBy || 'name', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('name', { ascending: true });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as RoleDefinition[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get role definitions');
  }

  async getRoleByCode(code: string): Promise<ServiceResult<RoleDefinition>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('roles').select().eq('code', code).single();
      if (error) throw error;
      return data as RoleDefinition;
    }, 'Failed to get role by code');
  }

  async updateRoleDefinition(id: string, updates: Partial<RoleDefinition>): Promise<ServiceResult<RoleDefinition>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('roles').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'role_definition', id, updates);
      return data as RoleDefinition;
    }, 'Failed to update role definition');
  }

  async deleteRoleDefinition(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const role = await this.getRoleDefinition(id);
      if (role.data?.is_system) {
        throw new Error('Cannot delete system roles');
      }
      const { error } = await (supabase as any).from('roles').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'role_definition', id, {});
      return true;
    }, 'Failed to delete role definition');
  }

  async getAllRoles(): Promise<ServiceResult<RoleDefinition[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as RoleDefinition[];
    }, 'Failed to get all roles');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// ROLE PERMISSION SERVICE
// ============================================

interface RolePermissionFilters extends FilterParams {
  role_id?: string;
  permission?: string;
  resource?: string;
}

export class RolePermissionService extends BaseServiceClass {
  private static instance: RolePermissionService;

  public static getInstance(): RolePermissionService {
    if (!RolePermissionService.instance) {
      RolePermissionService.instance = new RolePermissionService();
    }
    return RolePermissionService.instance;
  }

  async createRolePermission(input: Omit<RolePermission, 'id' | 'created_at'>): Promise<ServiceResult<RolePermission>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['role_id', 'permission', 'resource'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('role_permissions')
        .insert([{ ...input, can_create: input.can_create || false, can_read: input.can_read || false, can_update: input.can_update || false, can_delete: input.can_delete || false, can_approve: input.can_approve || false }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'role_permission', (data as any).id, input);
      return data as RolePermission;
    }, 'Failed to create role permission');
  }

  async getRolePermission(id: string): Promise<ServiceResult<RolePermission>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('role_permissions').select().eq('id', id).single();
      if (error) throw error;
      return data as RolePermission;
    }, 'Failed to get role permission');
  }

  async getRolePermissions(filters?: RolePermissionFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<RolePermission>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('role_permissions').select('*', { count: 'exact' });
      
      if (filters?.role_id) query = query.eq('role_id', filters.role_id);
      if (filters?.permission) query = query.eq('permission', filters.permission);
      if (filters?.resource) query = query.eq('resource', filters.resource);

      if (sort) {
        query = query.order(sort.sortBy || 'created_at', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 50;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as RolePermission[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get role permissions');
  }

  async getPermissionsByRole(roleId: string): Promise<ServiceResult<RolePermission[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('role_permissions')
        .select('*')
        .eq('role_id', roleId)
        .order('resource', { ascending: true });

      if (error) throw error;
      return data as RolePermission[];
    }, 'Failed to get permissions by role');
  }

  async updateRolePermission(id: string, updates: Partial<RolePermission>): Promise<ServiceResult<RolePermission>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('role_permissions').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'role_permission', id, updates);
      return data as RolePermission;
    }, 'Failed to update role permission');
  }

  async deleteRolePermission(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('role_permissions').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'role_permission', id, {});
      return true;
    }, 'Failed to delete role permission');
  }

  async hasPermission(roleId: string, permission: string, resource: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('role_permissions')
        .select('*')
        .eq('role_id', roleId)
        .eq('permission', permission)
        .eq('resource', resource)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    }, 'Failed to check permission');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// USER ROLE ASSIGNMENT SERVICE
// ============================================

interface UserRoleAssignmentFilters extends FilterParams {
  user_id?: string;
  role_id?: string;
  is_active?: boolean;
}

export class UserRoleAssignmentService extends BaseServiceClass {
  private static instance: UserRoleAssignmentService;

  public static getInstance(): UserRoleAssignmentService {
    if (!UserRoleAssignmentService.instance) {
      UserRoleAssignmentService.instance = new UserRoleAssignmentService();
    }
    return UserRoleAssignmentService.instance;
  }

  async assignRoleToUser(input: Omit<UserRoleAssignment, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<UserRoleAssignment>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['user_id', 'role_id', 'assigned_by'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('user_roles')
        .insert([{ ...input, assigned_at: input.assigned_at || new Date().toISOString(), is_active: input.is_active !== false }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('assign_role', 'user_role_assignment', (data as any).id, input);
      return data as UserRoleAssignment;
    }, 'Failed to assign role to user');
  }

  async getUserRoleAssignment(id: string): Promise<ServiceResult<UserRoleAssignment>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('user_roles').select().eq('id', id).single();
      if (error) throw error;
      return data as UserRoleAssignment;
    }, 'Failed to get user role assignment');
  }

  async getUserRoleAssignments(filters?: UserRoleAssignmentFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<UserRoleAssignment>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('user_roles').select('*', { count: 'exact' });
      
      if (filters?.user_id) query = query.eq('user_id', filters.user_id);
      if (filters?.role_id) query = query.eq('role_id', filters.role_id);
      if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);

      if (sort) {
        query = query.order(sort.sortBy || 'assigned_at', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('assigned_at', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as UserRoleAssignment[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get user role assignments');
  }

  async getRolesByUser(userId: string): Promise<ServiceResult<UserRoleAssignment[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('user_roles')
        .select('*, roles(name, code)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data as UserRoleAssignment[];
    }, 'Failed to get roles by user');
  }

  async getUsersByRole(roleId: string): Promise<ServiceResult<UserRoleAssignment[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('user_roles')
        .select('*, user_profiles(full_name, email)')
        .eq('role_id', roleId)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data as UserRoleAssignment[];
    }, 'Failed to get users by role');
  }

  async revokeUserRole(assignmentId: string, revokedBy: string): Promise<ServiceResult<UserRoleAssignment>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('user_roles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', assignmentId)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('revoke_role', 'user_role_assignment', assignmentId, { revoked_by: revokedBy });
      return data as UserRoleAssignment;
    }, 'Failed to revoke user role');
  }

  async updateUserRoleAssignment(id: string, updates: Partial<UserRoleAssignment>): Promise<ServiceResult<UserRoleAssignment>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('user_roles').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'user_role_assignment', id, updates);
      return data as UserRoleAssignment;
    }, 'Failed to update user role assignment');
  }

  async deleteUserRoleAssignment(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('user_roles').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'user_role_assignment', id, {});
      return true;
    }, 'Failed to delete user role assignment');
  }

  async hasActiveRole(userId: string, roleCode: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('roles.code', roleCode)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    }, 'Failed to check user role');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// EMPLOYEE SERVICE
// ============================================

interface EmployeeFilters extends FilterParams {
  department?: string;
  position?: string;
  employment_status?: 'active' | 'on_leave' | 'terminated' | 'suspended';
  manager_id?: string;
}

export class EmployeeService extends BaseServiceClass {
  private static instance: EmployeeService;

  public static getInstance(): EmployeeService {
    if (!EmployeeService.instance) {
      EmployeeService.instance = new EmployeeService();
    }
    return EmployeeService.instance;
  }

  async createEmployee(input: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<Employee>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['employee_number', 'first_name', 'last_name', 'email', 'phone', 'department', 'position', 'hire_date', 'employment_status'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('employees')
        .insert([input])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'employee', (data as any).id, input);
      return data as Employee;
    }, 'Failed to create employee');
  }

  async getEmployee(id: string): Promise<ServiceResult<Employee>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('employees').select().eq('id', id).single();
      if (error) throw error;
      return data as Employee;
    }, 'Failed to get employee');
  }

  async getEmployeeByNumber(employeeNumber: string): Promise<ServiceResult<Employee>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('employees').select().eq('employee_number', employeeNumber).single();
      if (error) throw error;
      return data as Employee;
    }, 'Failed to get employee by number');
  }

  async getEmployees(filters?: EmployeeFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<Employee>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('employees').select('*', { count: 'exact' });
      
      if (filters?.department) query = query.eq('department', filters.department);
      if (filters?.position) query = query.eq('position', filters.position);
      if (filters?.employment_status) query = query.eq('employment_status', filters.employment_status);
      if (filters?.manager_id) query = query.eq('manager_id', filters.manager_id);

      if (sort) {
        query = query.order(sort.sortBy || 'last_name', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('employee_number', { ascending: true });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as Employee[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get employees');
  }

  async getEmployeesByDepartment(department: string): Promise<ServiceResult<Employee[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('employees')
        .select('*')
        .eq('department', department)
        .eq('employment_status', 'active')
        .order('last_name', { ascending: true });

      if (error) throw error;
      return data as Employee[];
    }, 'Failed to get employees by department');
  }

  async getDirectReports(managerId: string): Promise<ServiceResult<Employee[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('employees')
        .select('*')
        .eq('manager_id', managerId)
        .eq('employment_status', 'active')
        .order('last_name', { ascending: true });

      if (error) throw error;
      return data as Employee[];
    }, 'Failed to get direct reports');
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<ServiceResult<Employee>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('employees').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'employee', id, updates);
      return data as Employee;
    }, 'Failed to update employee');
  }

  async terminateEmployee(id: string, terminationDate: string, reason?: string): Promise<ServiceResult<Employee>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('employees')
        .update({ employment_status: 'terminated', termination_date: terminationDate })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('terminate_employee', 'employee', id, { termination_date: terminationDate, reason });
      return data as Employee;
    }, 'Failed to terminate employee');
  }

  async deleteEmployee(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('employees').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'employee', id, {});
      return true;
    }, 'Failed to delete employee');
  }

  async searchEmployees(searchTerm: string): Promise<ServiceResult<Employee[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('employees')
        .select('*')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,employee_number.ilike.%${searchTerm}%`)
        .eq('employment_status', 'active')
        .limit(20);

      if (error) throw error;
      return data as Employee[];
    }, 'Failed to search employees');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// Export singleton instances
export const roleDefinitionService = RoleDefinitionService.getInstance();
export const rolePermissionService = RolePermissionService.getInstance();
export const userRoleAssignmentService = UserRoleAssignmentService.getInstance();
export const employeeService = EmployeeService.getInstance();