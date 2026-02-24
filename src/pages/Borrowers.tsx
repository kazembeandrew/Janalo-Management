import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Borrower } from '@/types';
import { Plus, Search, MapPin, Phone, Briefcase, User, ChevronLeft, ChevronRight, ExternalLink, Map as MapIcon, Home, Building2, X, Activity, RefreshCw } from 'lucide-react';
import { MapPicker } from '@/components/MapPicker';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 9;

export const Borrowers: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Map Picker State
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [activeMapTarget, setActiveMapTarget] = useState<'address' | 'employment' | null>(null);
  
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null);
  
  // Reassignment State
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignBorrower, setReassignBorrower] = useState<Borrower | null>(null);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [officers, setOfficers] = useState<{id: string, full_name: string}[]>([]);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address: '', // Residence
    employment: '' // Business/Work
  });

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const canCreate = effectiveRoles.includes('admin') || effectiveRoles.includes('loan_officer');
  const isExec = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');

  useEffect(() => {
    fetchBorrowers();
    if (isExec) {
        fetchOfficers();
    }
  }, [profile, page, searchTerm, effectiveRoles]); 

  const fetchOfficers = async () => {
      const { data } = await supabase.from('users').select('id, full_name').eq('role', 'loan_officer');
      setOfficers(data || []);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
      setPage(1);
  };

  const fetchBorrowers = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let query = supabase
        .from('borrowers')
        .select('*, loans(id, status)', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (effectiveRoles.includes('loan_officer') && !isExec) {
        query = query.eq('created_by', profile.id);
      }

      if (searchTerm.trim()) {
        query = query.or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      setBorrowers(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching borrowers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
      if (!reassignBorrower || !selectedOfficer) return;
      
      try {
          const { error } = await supabase
            .from('borrowers')
            .update({ created_by: selectedOfficer })
            .eq('id', reassignBorrower.id);
          
          if (error) throw error;
          
          toast.success(`Client successfully reassigned.`);
          setShowReassignModal(false);
          setReassignBorrower(null);
          setSelectedOfficer('');
          fetchBorrowers();
      } catch (error) {
          console.error(error);
          toast.error('Failed to reassign client.');
      }
  };

  const openCreateModal = () => {
    setEditingBorrower(null);
    setFormData({ full_name: '', phone: '', address: '', employment: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (borrower: Borrower) => {
    setEditingBorrower(borrower);
    setFormData({
      full_name: borrower.full_name,
      phone: borrower.phone,
      address: borrower.address,
      employment: borrower.employment
    });
    setIsModalOpen(true);
  };

  const handleOpenMap = (target: 'address' | 'employment') => {
      setActiveMapTarget(target);
      setShowMapPicker(true);
  };

  const handleLocationSelect = (lat: number, lng: number) => {
      if (activeMapTarget) {
          setFormData({ ...formData, [activeMapTarget]: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
      }
      setShowMapPicker(false);
      setActiveMapTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      if (editingBorrower) {
        const { error } = await supabase
          .from('borrowers')
          .update({
            full_name: formData.full_name,
            phone: formData.phone,
            address: formData.address,
            employment: formData.employment
          })
          .eq('id', editingBorrower.id);

        if (error) throw error;
        toast.success('Client updated');
      } else {
        const { error } = await supabase.from('borrowers').insert([
          {
            ...formData,
            created_by: profile.id
          }
        ]);

        if (error) throw error;
        toast.success('Client registered');
      }

      setIsModalOpen(false);
      setFormData({ full_name: '', phone: '', address: '', employment: '' });
      setEditingBorrower(null);
      if (!editingBorrower) setPage(1);
      fetchBorrowers();
    } catch (error) {
      console.error('Error saving borrower:', error);
      toast.error('Error saving borrower');
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {effectiveRoles.includes('loan_officer') && !isExec ? 'My Clients' : 'All Borrowers'}
          </h1>
          <p className="text-sm text-gray-500">
            {effectiveRoles.includes('loan_officer') && !isExec 
              ? 'Manage clients assigned to you' 
              : 'Directory of all borrowers in the system'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Borrower
          </button>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all sm:text-sm"
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>

      <div className="min-h-[400px]">
        {loading ? (
             <div className="flex items-center justify-center h-64">
                <RefreshCw className="animate-spin h-8 w-8 text-indigo-600" />
            </div>
        ) : borrowers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 border-dashed">
             <User className="mx-auto h-12 w-12 text-gray-300 mb-4" />
             <h3 className="text-sm font-bold text-gray-900">No borrowers found</h3>
             <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating a new borrower.'}
             </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {borrowers.map((borrower) => {
                const activeLoans = borrower.loans?.filter((l: any) => l.status === 'active').length || 0;
                const totalLoans = borrower.loans?.length || 0;

                return (
                    <div key={borrower.id} className="bg-white overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 group flex flex-col">
                        <div className="p-6 flex-1">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center min-w-0">
                                    <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg mr-3 shrink-0">
                                        {(borrower.full_name || 'C').charAt(0)}
                                    </div>
                                    <h3 className="text-base font-bold text-gray-900 truncate">{borrower.full_name || 'Unnamed Client'}</h3>
                                </div>
                                {activeLoans > 0 && (
                                    <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[8px] font-bold uppercase rounded-full border border-green-100">Active</span>
                                )}
                            </div>
                            <div className="space-y-3 text-sm text-gray-600">
                                <div className="flex items-center">
                                    <Phone className="h-4 w-4 mr-3 text-gray-400" />
                                    <span className="font-medium">{borrower.phone || 'No phone'}</span>
                                </div>
                                <div className="flex items-start">
                                    <Home className="h-4 w-4 mr-3 text-gray-400 mt-0.5" />
                                    <span className="truncate text-xs">{borrower.address || 'No residence address'}</span>
                                </div>
                                <div className="flex items-start">
                                    <Building2 className="h-4 w-4 mr-3 text-gray-400 mt-0.5" />
                                    <span className="truncate text-xs">{borrower.employment || 'No business address'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 grid grid-cols-2 gap-4">
                            <div className="flex items-center text-[10px] font-bold text-gray-500 uppercase">
                                <Activity className="h-3 w-3 mr-1.5 text-indigo-500" />
                                {totalLoans} Total Loans
                            </div>
                            <div className="flex items-center text-[10px] font-bold text-gray-500 uppercase justify-end">
                                <Briefcase className="h-3 w-3 mr-1.5 text-emerald-500" />
                                {activeLoans} Active
                            </div>
                        </div>
                        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-between items-center">
                            <Link to={`/borrowers/${borrower.id}`} className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center">
                                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View Profile
                            </Link>
                            <div className="flex space-x-4">
                                {isExec && (
                                    <button 
                                        onClick={() => { setReassignBorrower(borrower); setShowReassignModal(true); }}
                                        className="text-gray-500 hover:text-indigo-600 text-xs font-bold"
                                    >
                                        Reassign
                                    </button>
                                )}
                                {canCreate && (
                                <button 
                                    onClick={() => openEditModal(borrower)}
                                    className="text-gray-500 hover:text-indigo-600 text-xs font-bold"
                                >
                                    Edit
                                </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
          </div>
        )}
      </div>

       {/* Pagination Controls */}
       {totalCount > 0 && (
        <div className="bg-white px-6 py-4 flex items-center justify-between border border-gray-200 rounded-2xl shadow-sm mt-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Showing <span className="text-gray-900">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-gray-900">{Math.min(page * ITEMS_PER_PAGE, totalCount)}</span> of <span className="text-gray-900">{totalCount}</span>
                    </p>
                </div>
                <div>
                    <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className="relative inline-flex items-center px-3 py-2 rounded-l-xl border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-xs font-bold text-gray-700">
                            Page {page} of {totalPages || 1}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || totalPages === 0 || loading}
                            className="relative inline-flex items-center px-3 py-2 rounded-r-xl border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </nav>
                </div>
            </div>
             <div className="flex items-center justify-between w-full sm:hidden">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="px-4 py-2 border border-gray-300 text-xs font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    Previous
                </button>
                <span className="text-xs font-bold text-gray-700">
                    {page} / {totalPages}
                </span>
                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || totalPages === 0 || loading}
                    className="px-4 py-2 border border-gray-300 text-xs font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </div>
      )}

      {/* Reassign Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Reassign Client</h3>
                    <p className="text-sm text-gray-500 mb-6">
                        Select a new loan officer to manage <strong>{reassignBorrower?.full_name}</strong>.
                    </p>
                    
                    <select
                        className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={selectedOfficer}
                        onChange={(e) => setSelectedOfficer(e.target.value)}
                    >
                        <option value="">-- Select Officer --</option>
                        {officers.map(o => (
                            <option key={o.id} value={o.id}>{o.full_name}</option>
                        ))}
                    </select>

                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={() => setShowReassignModal(false)}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleReassign}
                            disabled={!selectedOfficer}
                            className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <form onSubmit={handleSubmit}>
                <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center text-lg">
                        {editingBorrower ? <><Building2 className="mr-3 h-6 w-6 text-indigo-300" /> Edit Client Profile</> : <><Plus className="mr-3 h-6 w-6 text-indigo-300" /> Register New Client</>}
                    </h3>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                </div>

                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                            <input
                                required
                                type="text"
                                className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                                placeholder="e.g. John Phiri"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                            <input
                                required
                                type="text"
                                className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                                placeholder="e.g. +265 888 123 456"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-6 pt-4 border-t border-gray-100">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center">
                                <Home className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                                Residence Address
                            </label>
                            <div className="flex gap-2">
                                <input
                                    required
                                    type="text"
                                    className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Manual entry or pin on map..."
                                />
                                <button 
                                    type="button"
                                    onClick={() => handleOpenMap('address')}
                                    className="p-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all shadow-sm"
                                    title="Pin Residence on Map"
                                >
                                    <MapIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center">
                                <Building2 className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                                Business or Work Address
                            </label>
                            <div className="flex gap-2">
                                <input
                                    required
                                    type="text"
                                    className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                                    value={formData.employment}
                                    onChange={(e) => setFormData({ ...formData, employment: e.target.value })}
                                    placeholder="Manual entry or pin on map..."
                                />
                                <button 
                                    type="button"
                                    onClick={() => handleOpenMap('employment')}
                                    className="p-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all shadow-sm"
                                    title="Pin Business on Map"
                                >
                                    <MapIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 px-8 py-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
                  >
                    {editingBorrower ? 'Update Profile' : 'Register Client'}
                  </button>
                </div>
              </form>
            </div>
        </div>
      )}

      {showMapPicker && (
          <MapPicker 
            onSelect={handleLocationSelect} 
            onClose={() => { setShowMapPicker(false); setActiveMapTarget(null); }} 
            initialLocation={activeMapTarget && formData[activeMapTarget].includes(',') ? {
                lat: parseFloat(formData[activeMapTarget].split(',')[0]),
                lng: parseFloat(formData[activeMapTarget].split(',')[1])
            } : undefined}
          />
      )}
    </div>
  );
};