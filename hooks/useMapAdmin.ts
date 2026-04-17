import { useState, useEffect, useCallback, useMemo } from 'react';
import { mapAdminService } from '@/services/mapAdmin';
import type { Territory, ClientLocation, GeoPerformanceMetrics } from '@/services/mapAdmin';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface UseMapAdminReturn {
  // Data
  territories: Territory[];
  locations: ClientLocation[];
  metrics: GeoPerformanceMetrics[];
  
  // Loading states
  loading: {
    territories: boolean;
    locations: boolean;
    metrics: boolean;
  };
  
  // Filters
  filters: {
    officer_id: string;
    status: string;
    search_term: string;
    territory_id: string;
  };
  
  // Actions
  fetchTerritories: () => Promise<void>;
  fetchLocations: () => Promise<void>;
  fetchMetrics: (territoryId?: string) => Promise<void>;
  setFilter: (key: keyof UseMapAdminReturn['filters'], value: string) => void;
  refreshMetrics: (territoryId?: string) => Promise<void>;
  
  // Territory CRUD
  createTerritory: (territory: Omit<Territory, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateTerritory: (id: string, updates: Partial<Territory>) => Promise<void>;
  deleteTerritory: (id: string) => Promise<void>;
  assignOfficer: (territoryId: string, officerId: string, notes?: string) => Promise<void>;
  
  // Computed values
  filteredLocations: ClientLocation[];
  stats: {
    totalClients: number;
    activeLoans: number;
    parCount: number;
    totalOutstanding: number;
    coverageArea: number;
  };
}

export const useMapAdmin = (): UseMapAdminReturn => {
  const { profile, effectiveRoles } = useAuth();
  
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [locations, setLocations] = useState<ClientLocation[]>([]);
  const [metrics, setMetrics] = useState<GeoPerformanceMetrics[]>([]);
  
  const [loading, setLoading] = useState({
    territories: false,
    locations: false,
    metrics: false
  });
  
  const [filters, setFilters] = useState({
    officer_id: 'all',
    status: 'all',
    search_term: '',
    territory_id: ''
  });

  const isExec = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');

  // Fetch territories
  const fetchTerritories = useCallback(async () => {
    if (!isExec) return;
    
    setLoading(prev => ({ ...prev, territories: true }));
    try {
      const result = await mapAdminService.getTerritories(true);
      if (result.success && result.data) {
        setTerritories(result.data);
      } else {
        toast.error(result.error?.message || 'Failed to fetch territories');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch territories');
    } finally {
      setLoading(prev => ({ ...prev, territories: false }));
    }
  }, [isExec]);

  // Fetch locations
  const fetchLocations = useCallback(async () => {
    setLoading(prev => ({ ...prev, locations: true }));
    try {
      const result = await mapAdminService.getClientLocations({
        officer_id: filters.officer_id,
        status: filters.status === 'all' ? undefined : filters.status,
        search_term: filters.search_term || undefined,
        territory_id: filters.territory_id || undefined
      });
      
      if (result.success && result.data) {
        setLocations(result.data);
      } else {
        toast.error(result.error?.message || 'Failed to fetch locations');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch locations');
    } finally {
      setLoading(prev => ({ ...prev, locations: false }));
    }
  }, [filters]);

  // Fetch metrics
  const fetchMetrics = useCallback(async (territoryId?: string) => {
    if (!isExec) return;
    
    setLoading(prev => ({ ...prev, metrics: true }));
    try {
      const result = await mapAdminService.getGeoMetrics(territoryId);
      if (result.success && result.data) {
        setMetrics(result.data);
      } else {
        toast.error(result.error?.message || 'Failed to fetch metrics');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch metrics');
    } finally {
      setLoading(prev => ({ ...prev, metrics: false }));
    }
  }, [isExec]);

  // Refresh metrics
  const refreshMetrics = useCallback(async (territoryId?: string) => {
    try {
      const result = await mapAdminService.refreshMetrics(territoryId);
      if (result.success) {
        toast.success('Metrics refreshed successfully');
        await fetchMetrics(territoryId);
      } else {
        toast.error(result.error?.message || 'Failed to refresh metrics');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh metrics');
    }
  }, [fetchMetrics]);

  // Set filter
  const setFilter = useCallback((key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Territory CRUD operations
  const createTerritory = useCallback(async (territory: Omit<Territory, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const result = await mapAdminService.createTerritory(territory);
      if (result.success) {
        toast.success('Territory created successfully');
        await fetchTerritories();
      } else {
        toast.error(result.error?.message || 'Failed to create territory');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create territory');
    }
  }, [fetchTerritories]);

  const updateTerritory = useCallback(async (id: string, updates: Partial<Territory>) => {
    try {
      const result = await mapAdminService.updateTerritory(id, updates);
      if (result.success) {
        toast.success('Territory updated successfully');
        await fetchTerritories();
      } else {
        toast.error(result.error?.message || 'Failed to update territory');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update territory');
    }
  }, [fetchTerritories]);

  const deleteTerritory = useCallback(async (id: string) => {
    try {
      const result = await mapAdminService.deleteTerritory(id, false);
      if (result.success) {
        toast.success('Territory deleted successfully');
        await fetchTerritories();
      } else {
        toast.error(result.error?.message || 'Failed to delete territory');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete territory');
    }
  }, [fetchTerritories]);

  const assignOfficer = useCallback(async (territoryId: string, officerId: string, notes?: string) => {
    try {
      const result = await mapAdminService.assignOfficerToTerritory(territoryId, officerId, notes);
      if (result.success) {
        toast.success('Officer assigned successfully');
        await fetchTerritories();
      } else {
        toast.error(result.error?.message || 'Failed to assign officer');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign officer');
    }
  }, [fetchTerritories]);

  // Filtered locations (currently just returns all locations as filtering is done server-side)
  const filteredLocations = useMemo(() => {
    return locations;
  }, [locations]);

  // Computed statistics
  const stats = useMemo(() => {
    const totalClients = locations.length;
    const activeLoans = locations.filter(loc => loc.status === 'active').length;
    const parCount = locations.filter(loc => loc.is_par).length;
    const totalOutstanding = locations.reduce((sum, loc) => sum + (loc.principal || 0), 0);
    
    // Calculate coverage area (simple bounding box approximation in km²)
    let coverageArea = 0;
    if (locations.length > 1) {
      const lats = locations.map(loc => loc.lat);
      const lngs = locations.map(loc => loc.lng);
      const latRange = Math.max(...lats) - Math.min(...lats);
      const lngRange = Math.max(...lngs) - Math.min(...lngs);
      // Rough conversion: 1 degree ≈ 111 km
      coverageArea = (latRange * 111) * (lngRange * 111 * Math.cos((Math.max(...lats) + Math.min(...lats)) / 2 * Math.PI / 180));
    }

    return {
      totalClients,
      activeLoans,
      parCount,
      totalOutstanding,
      coverageArea
    };
  }, [locations]);

  // Initial data fetch
  useEffect(() => {
    if (profile) {
      fetchTerritories();
      fetchLocations();
      if (isExec) {
        fetchMetrics();
      }
    }
  }, [profile, isExec, fetchTerritories, fetchLocations, fetchMetrics]);

  return {
    territories,
    locations,
    metrics,
    loading,
    filters,
    fetchTerritories,
    fetchLocations,
    fetchMetrics,
    setFilter,
    refreshMetrics,
    createTerritory,
    updateTerritory,
    deleteTerritory,
    assignOfficer,
    filteredLocations,
    stats
  };
};
