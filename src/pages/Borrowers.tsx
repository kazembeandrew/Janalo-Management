import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Borrower } from '@/types';
import { Plus, Search, MapPin, Phone, Briefcase, User, ChevronLeft, ChevronRight } from 'lucide-react';

const ITEMS_PER_PAGE = 9;

export const Borrowers: React.FC = () => {
  const { profile } = useAuth();
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null);
  
  // Reassignment State
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignBorrower, setReassignBorrower] = useState<Borrower | null>(null);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [officers, setOfficers] = useState<{id: string, full_name: string}[]>([]);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address: '',
    employment: ''
  });

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const canCreate = profile?.role === 'admin' || profile?.role === 'loan_officer';
  const isExec = profile?.role === 'admin' || profile?.role === 'ceo';

  useEffect(() => {
    fetchBorrowers();
    if (isExec) {
        fetchOfficers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, page, searchTerm]); // Re-fetch on search or page change

  const fetchOfficers = async () => {
      const { data } = await supabase.from('users').select('id, full_name').eq('role', 'loan_officer');
      setOfficers(data || []);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
      setPage(1); // Reset to page 1 on search
  };

  const fetchBorrowers = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let query = supabase
        .from('borrowers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Enforce: Loan Officers only see their own clients
      if (profile.role === 'loan_officer') {
        query = query.eq('created_by', profile.id);
      }

      // Server-side search
      if (searchTerm.trim()) {
        query = query.or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      // Pagination
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
          
          alert(`Client successfully reassigned.`);
          setShowReassignModal(false);
          setReassignBorrower(null);
          setSelectedOfficer('');
          fetchBorrowers();
      } catch (error) {
          console.error(error);
          alert('Failed to reassign client.');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      if (editingBorrower) {
        // Update existing
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
      } else {
        // Create new
        const { error } = await supabase.from('borrowers').insert([
          {
            ...formData,
            created_by: profile.id
          }
        ]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      setFormData({ full_name: '', phone: '', address: '', employment: '' });
      setEditingBorrower(null);
      if (!editingBorrower) setPage(1); // Go to first page on create
      fetchBorrowers();
    } catch (error) {
      console.error('Error saving borrower:', error);
      alert('Error saving borrower');
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {profile?.role === 'loan_officer' ? 'My Clients' : 'All Borrowers'}
          </h1>
          <p className="text-sm text-gray-500">
            {profile?.role === 'loan_officer' 
              ? 'Manage clients assigned to you' 
              : 'Directory of all borrowers in the system'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="Search by name or phone (Server-side)..."
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>

      <div className="min-h-[400px]">
        {loading ? (
             <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        ) : borrowers.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-lg border border-gray-200 border-dashed">
             <User className="mx-auto h-12 w-12 text-gray-400" />
             <h3 className="mt-2 text-sm font-medium text-gray-900">No borrowers found</h3>
             <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating a new borrower.'}
             </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {borrowers.map((borrower) => (
                <div key={borrower.id} className="bg-white overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900 truncate">{borrower.full_name || 'Unnamed Client'}</h3>
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                            {(borrower.full_name || 'C').charAt(0)}
                        </div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        {borrower.phone || 'No phone'}
                    </div>
                    <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="truncate">{borrower.address || 'No address'}</span>
                    </div>
                    <div className="flex items-center">
                        <Briefcase className="h-4 w-4 mr-2 text-gray-400" />
                        {borrower.employment || 'Unknown employment'}
                    </div>
                    </div>
                </div>
                <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs text-gray-400">ID: {borrower.id.slice(0, 8)}</span>
                    <div className="flex space-x-3">
                        {isExec && (
                            <button 
                                onClick={() => { setReassignBorrower(borrower); setShowReassignModal(true); }}
                                className="text-indigo-600 hover:text-indigo-900 text-xs font-medium"
                            >
                                Reassign
                            </button>
                        )}
                        {canCreate && (
                        <button 
                            onClick={() => openEditModal(borrower)}
                            className="text-indigo-600 hover:text-indigo-900 text-xs font-medium"
                        >
                            Edit
                        </button>
                        )}
                    </div>
                </div>
                </div>
            ))}
          </div>
        )}
      </div>

       {/* Pagination Controls */}
       {totalCount > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg shadow-sm">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(page * ITEMS_PER_PAGE, totalCount)}</span> of <span className="font-medium">{totalCount}</span> results
                    </p>
                </div>
                <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                            <span className="sr-only">Previous</span>
                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                            Page {page} of {totalPages || 1}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || totalPages === 0 || loading}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                            <span className="sr-only">Next</span>
                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </nav>
                </div>
            </div>
             {/* Mobile Pagination View */}
             <div className="flex items-center justify-between w-full sm:hidden">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    Previous
                </button>
                <span className="text-sm text-gray-700">
                    Page {page}
                </span>
                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || totalPages === 0 || loading}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </div>
      )}

      {/* Reassign Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowReassignModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Reassign Client</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Select a new loan officer to manage <strong>{reassignBorrower?.full_name}</strong>.
                        </p>
                        
                        <select
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            value={selectedOfficer}
                            onChange={(e) => setSelectedOfficer(e.target.value)}
                        >
                            <option value="">-- Select Officer --</option>
                            {officers.map(o => (
                                <option key={o.id} value={o.id}>{o.full_name}</option>
                            ))}
                        </select>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setShowReassignModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReassign}
                                disabled={!selectedOfficer}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                            >
                                Confirm Reassignment
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setIsModalOpen(false)}></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    {editingBorrower ? 'Edit Borrower' : 'Register New Borrower'}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name</label>
                      <input
                        required
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <input
                        required
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Address</label>
                      <input
                        required
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Employment / Business</label>
                      <input
                        required
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={formData.employment}
                        onChange={(e) => setFormData({ ...formData, employment: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-900 text-base font-medium text-white hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {editingBorrower ? 'Update Client' : 'Save Client'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};