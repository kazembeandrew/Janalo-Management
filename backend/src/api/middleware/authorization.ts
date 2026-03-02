// API Layer - Middleware
// Authorization middleware for protecting API endpoints

import { Request, Response, NextFunction } from 'express';
import { AuthorizationService } from '../../domain/services/AuthorizationService';
import { IPermissionRepository, IRoleRepository, IUserRoleRepository } from '../../domain/repositories/rbac-interfaces';
import { SupabaseClientWrapper } from '../../infrastructure/external/SupabaseClientWrapper';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: string;
      };
      permissions?: string[];
    }
  }
}

export class AuthorizationMiddleware {
  constructor(
    private readonly authService: AuthorizationService,
    private readonly supabase: SupabaseClientWrapper
  ) {}

  // Middleware to check if user has specific permission
  requirePermission(resource: string, action: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        await this.authService.requirePermission(req.user.id, resource, action);
        next();
      } catch (error: any) {
        console.error('Authorization error:', error.message);
        res.status(403).json({ error: 'Insufficient permissions' });
      }
    };
  }

  // Middleware to check if user has any of the specified permissions (OR logic)
  requireAnyPermission(permissions: Array<{ resource: string; action: string }>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        await this.authService.requireAnyPermission(req.user.id, permissions);
        next();
      } catch (error: any) {
        console.error('Authorization error:', error.message);
        res.status(403).json({ error: 'Insufficient permissions' });
      }
    };
  }

  // Middleware to check if user is admin (backward compatibility)
  requireAdmin() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const isAdmin = await this.authService.isAdmin(req.user.id);
        if (!isAdmin) {
          return res.status(403).json({ error: 'Admin access required' });
        }

        next();
      } catch (error: any) {
        console.error('Admin check error:', error.message);
        res.status(403).json({ error: 'Admin access required' });
      }
    };
  }

  // Middleware to load user permissions into request
  loadUserPermissions() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.user?.id) {
          const permissions = await this.authService.getUserPermissions(req.user.id);
          req.permissions = permissions.map(p => p.fullName);
        }
        next();
      } catch (error: any) {
        console.error('Error loading user permissions:', error.message);
        // Don't fail the request, just continue without permissions
        req.permissions = [];
        next();
      }
    };
  }

  // Helper method to authenticate user from JWT token
  async authenticateUser(req: Request): Promise<boolean> {
    try {
      const authHeader = req.headers.authorization || req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
      }

      const token = authHeader.replace('Bearer ', '');
      const client = this.supabase.getClient();

      const { data: { user }, error } = await client.auth.getUser(token);

      if (error || !user) {
        return false;
      }

      // Get user role from database for backward compatibility
      const { data: profile } = await client
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      req.user = {
        id: user.id,
        email: user.email || '',
        role: profile?.role
      };

      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }

  // Combined middleware: authenticate + load permissions
  authenticateAndLoadPermissions() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authenticated = await this.authenticateUser(req);
        if (!authenticated) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        // Load permissions
        if (req.user?.id) {
          const permissions = await this.authService.getUserPermissions(req.user.id);
          req.permissions = permissions.map(p => p.fullName);
        }

        next();
      } catch (error: any) {
        console.error('Authentication error:', error.message);
        res.status(401).json({ error: 'Authentication failed' });
      }
    };
  }
}
