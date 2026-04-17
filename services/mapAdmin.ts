import { BaseServiceClass, ServiceResult } from './_shared/baseService';
import { supabase } from '@/lib/supabase';
import { auditService } from './audit';

export interface Territory {
  id: string;
  name: string;
  description?: string;
  center_lat: number;
  center_lng: number;
  zoom_level?: number;
  boundary_polygon?: any;
  radius_meters?: number;
  assigned_officer_id?: string;
  assigned_officer_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientLocation {
  borrower_id: string;
  full_name: string;
  phone: string;
  lat: number;
  lng: number;
  distance_km?: number;
  loan_id: string;
  principal: number;
  status: string;
  officer_name: string;
  officer_id: string;
  is_par: boolean;
  last_visit: string;
}

export interface GeoPerformanceMetrics {
  id?: string;
  territory_id?: string;
  metric_date: string;
  total_clients: number;
  active_loans: number;
  par_count: number;
  total_outstanding: number;
  visits_this_month: number;
  avg_distance_between_clients?: number;
  calculated_at?: string;
}

export interface TerritoryStats {
  territory_name: string;
  officer_name: string;
  total_clients: number;
  active_loans: number;
  par_count: number;
  total_outstanding: number;
  avg_loan_size: number;
  coverage_percentage: number;
}

/**
 * Map Admin Service for managing geographic operations, territories, and location-based analytics
 */
export class MapAdminService extends BaseServiceClass {
  private static instance: MapAdminService;

  public static getInstance(): MapAdminService {
    if (!MapAdminService.instance) {
      MapAdminService.instance = new MapAdminService();
    }
    return MapAdminService.instance;
  }

  // ==================== Territory Management ====================

  /**
   * Get all territories
   */
  async getTerritories(activeOnly = true): Promise<ServiceResult<Territory[]>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any)
        .from('territories')
        .select(`
          *,
          users!territories_assigned_officer_id_fkey(full_name)
        `);
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query.order('name');
      
      if (error) throw error;

      const territories: Territory[] = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        center_lat: t.center_lat,
        center_lng: t.center_lng,
        zoom_level: t.zoom_level,
        boundary_polygon: t.boundary_polygon,
        radius_meters: t.radius_meters,
        assigned_officer_id: t.assigned_officer_id,
        assigned_officer_name: t.users?.full_name || null,
        is_active: t.is_active,
        created_at: t.created_at,
        updated_at: t.updated_at
      }));

      return territories;
    }, 'Failed to fetch territories');
  }

  /**
   * Get a single territory by ID
   */
  async getTerritoryById(id: string): Promise<ServiceResult<Territory>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('territories')
        .select(`
          *,
          users!territories_assigned_officer_id_fkey(full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const territory: Territory = {
        id: data.id,
        name: data.name,
        description: data.description,
        center_lat: data.center_lat,
        center_lng: data.center_lng,
        zoom_level: data.zoom_level,
        boundary_polygon: data.boundary_polygon,
        radius_meters: data.radius_meters,
        assigned_officer_id: data.assigned_officer_id,
        assigned_officer_name: data.users?.full_name || null,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at
      };

      return territory;
    }, 'Failed to fetch territory');
  }

  /**
   * Create a new territory
   */
  async createTerritory(territory: Omit<Territory, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<Territory>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('territories')
        .insert([{
          name: territory.name,
          description: territory.description,
          center_lat: territory.center_lat,
          center_lng: territory.center_lng,
          zoom_level: territory.zoom_level || 12,
          boundary_polygon: territory.boundary_polygon,
          radius_meters: territory.radius_meters,
          assigned_officer_id: territory.assigned_officer_id,
          is_active: territory.is_active !== false
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        center_lat: data.center_lat,
        center_lng: data.center_lng,
        zoom_level: data.zoom_level,
        boundary_polygon: data.boundary_polygon,
        radius_meters: data.radius_meters,
        assigned_officer_id: data.assigned_officer_id,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    }, 'Failed to create territory');
  }

  /**
   * Update an existing territory
   */
  async updateTerritory(id: string, updates: Partial<Territory>): Promise<ServiceResult<Territory>> {
    return this.handleAsyncOperation(async () => {
      const updateData: any = { ...updates };
      delete updateData.id;
      delete updateData.created_at;
      delete updateData.updated_at;
      delete updateData.assigned_officer_name;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await (supabase as any)
        .from('territories')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log audit trail
      await auditService.logAudit('UPDATE_TERRITORY', 'territory', id, updates);

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        center_lat: data.center_lat,
        center_lng: data.center_lng,
        zoom_level: data.zoom_level,
        boundary_polygon: data.boundary_polygon,
        radius_meters: data.radius_meters,
        assigned_officer_id: data.assigned_officer_id,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    }, 'Failed to update territory');
  }

  /**
   * Delete a territory (soft delete by setting is_active to false)
   */
  async deleteTerritory(id: string, hardDelete = false): Promise<ServiceResult<void>> {
    return this.handleAsyncOperation(async () => {
      if (hardDelete) {
        const { error } = await (supabase as any)
          .from('territories')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('territories')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;
      }

      // Log audit trail
      await auditService.logAudit('DELETE_TERRITORY', 'territory', id, null);

      return;
    }, 'Failed to delete territory');
  }

  /**
   * Assign officer to territory
   */
  async assignOfficerToTerritory(
    territoryId: string,
    officerId: string,
    notes?: string
  ): Promise<ServiceResult<void>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).rpc('assign_officer_to_territory', {
        p_territory_id: territoryId,
        p_officer_id: officerId,
        p_notes: notes || null
      });

      if (error) throw error;

      // Log audit trail
      await auditService.logAudit('ASSIGN_OFFICER_TO_TERRITORY', 'territory', territoryId, { officer_id: officerId, notes });

      return;
    }, 'Failed to assign officer to territory');
  }

  // ==================== Client Location Queries ====================

  /**
   * Get client locations with optional filtering
   */
  async getClientLocations(filters?: {
    officer_id?: string;
    status?: string;
    search_term?: string;
    territory_id?: string;
  }): Promise<ServiceResult<ClientLocation[]>> {
    return this.handleAsyncOperation(async () => {
      let query = supabase
        .from('visitations')
        .select(`
          location_lat,
          location_long,
          visit_date,
          loan_id,
          loans (
            principal_amount,
            borrower_id,
            officer_id,
            status,
            updated_at,
            borrowers (
              full_name,
              phone
            ),
            users!officer_id (
              full_name
            )
          )
        `)
        .not('location_lat', 'is', null)
        .order('visit_date', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Process and deduplicate by borrower (keep latest visitation)
      const latestMap = new Map<string, ClientLocation>();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      data?.forEach((v: any) => {
        const loan = v.loans;
        const borrower = loan?.borrowers;
        const bId = loan?.borrower_id;

        if (borrower && bId && !latestMap.has(bId)) {
          const lastUpdate = new Date(loan.updated_at);
          const isPar = loan.status === 'active' && lastUpdate < thirtyDaysAgo;

          latestMap.set(bId, {
            borrower_id: bId,
            full_name: borrower.full_name,
            phone: borrower.phone,
            lat: v.location_lat,
            lng: v.location_long,
            last_visit: v.visit_date,
            loan_id: v.loan_id,
            principal: loan.principal_amount,
            status: loan.status,
            officer_name: loan.users?.full_name || 'Unknown',
            officer_id: loan.officer_id,
            is_par: isPar
          });
        }
      });

      let locations = Array.from(latestMap.values());

      // Apply filters
      if (filters?.officer_id && filters.officer_id !== 'all') {
        locations = locations.filter(loc => loc.officer_id === filters.officer_id);
      }

      if (filters?.status) {
        locations = locations.filter(loc => 
          filters.status === 'par' ? loc.is_par : loc.status === filters.status
        );
      }

      if (filters?.search_term) {
        const term = filters.search_term.toLowerCase();
        locations = locations.filter(loc =>
          loc.full_name.toLowerCase().includes(term) ||
          loc.phone?.toLowerCase().includes(term)
        );
      }

      return locations;
    }, 'Failed to fetch client locations');
  }

  /**
   * Get clients within a radius of a point
   */
  async getClientsWithinRadius(
    lat: number,
    lng: number,
    radiusKm: number
  ): Promise<ServiceResult<ClientLocation[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).rpc('get_clients_within_radius', {
        center_lat: lat,
        center_lng: lng,
        radius_km: radiusKm
      });

      if (error) throw error;

      // Transform RPC result to match ClientLocation interface
      const locations: ClientLocation[] = (data || []).map((item: any) => ({
        borrower_id: item.borrower_id,
        full_name: item.full_name,
        phone: item.phone,
        lat: item.lat,
        lng: item.lng,
        distance_km: item.distance_km,
        loan_id: '', // Not returned by RPC function
        principal: item.principal,
        status: item.loan_status,
        officer_name: item.officer_name || 'Unknown',
        officer_id: '', // Not returned by RPC function
        is_par: item.loan_status === 'active', // Simplified
        last_visit: new Date().toISOString() // Placeholder
      }));

      return locations;
    }, 'Failed to fetch clients within radius');
  }

  // ==================== Performance Metrics ====================

  /**
   * Get geographic performance metrics
   */
  async getGeoMetrics(territoryId?: string): Promise<ServiceResult<GeoPerformanceMetrics[]>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any)
        .from('geo_performance_metrics')
        .select('*')
        .order('metric_date', { ascending: false })
        .limit(30);

      if (territoryId) {
        query = query.eq('territory_id', territoryId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []) as GeoPerformanceMetrics[];
    }, 'Failed to fetch geo metrics');
  }

  /**
   * Refresh geographic performance metrics
   */
  async refreshMetrics(territoryId?: string): Promise<ServiceResult<void>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).rpc('refresh_geo_metrics', {
        p_territory_id: territoryId || null
      });

      if (error) throw error;

      // Log audit trail
      await auditService.logAudit('REFRESH_METRICS', 'territory', territoryId || 'all', null);

      return;
    }, 'Failed to refresh metrics');
  }

  /**
   * Get territory statistics
   */
  async getTerritoryStats(territoryId: string): Promise<ServiceResult<TerritoryStats>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).rpc('get_territory_stats', {
        p_territory_id: territoryId
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          territory_name: 'Unknown',
          officer_name: 'Unassigned',
          total_clients: 0,
          active_loans: 0,
          par_count: 0,
          total_outstanding: 0,
          avg_loan_size: 0,
          coverage_percentage: 0
        };
      }

      return data[0];
    }, 'Failed to fetch territory stats');
  }
}

export const mapAdminService = MapAdminService.getInstance();
