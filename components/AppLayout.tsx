import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ToastProvider } from './ToastProvider';
import { Breadcrumbs } from './Breadcrumbs';
import { Sidebar, Header, MobileSearchModal } from '@/components/layout';
import { createNavigationItems } from '@/config/navigation';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [counts, setCounts] = useState({ inbox: 0, loans: 0 });
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchFocused, setGlobalSearchFocused] = useState(false);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState<string | null>(null);
  const [globalSearchResults, setGlobalSearchResults] = useState<{ borrowers: any[]; loans: any[] }>({
    borrowers: [],
    loans: [],
  });
  const globalSearchSeq = useRef(0);
  const globalSearchCache = useRef(new Map<string, { borrowers: any[]; loans: any[] }>());

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearchOpen: () => setIsMobileSearchOpen(true),
    enabled: true,
  });

  // Fetch notification counts
  useEffect(() => {
    fetchCounts();

    const channel = supabase
      .channel('global-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, () =>
        fetchCounts()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchCounts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCounts = async () => {
    if (!profile) return;
    const { data } = await (supabase as any).rpc('get_notification_counts');
    if (data) setCounts(data as any);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Search logic
  const performGlobalSearch = async (query: string) => {
    const normalized = query.trim().replace(/^#/, '');
    const tokens = normalized.split(/\s+/).map((t) => t.trim()).filter(Boolean).slice(0, 4);

    // Search borrowers by name
    let bQuery = (supabase as any).from('borrowers').select('id, full_name').limit(5);
    for (const t of tokens) bQuery = bQuery.ilike('full_name', `%${t}%`);
    const bRes = await bQuery;
    if (bRes.error) throw bRes.error;

    // Search loans by reference number
    const lResByRef = await (supabase as any)
      .from('loans')
      .select('id, reference_no, borrowers(full_name)')
      .ilike('reference_no', `%${normalized}%`)
      .limit(5);
    if (lResByRef.error) throw lResByRef.error;

    // Search loans by borrower name
    let mbQuery = (supabase as any).from('borrowers').select('id').limit(25);
    for (const t of tokens) mbQuery = mbQuery.ilike('full_name', `%${t}%`);
    const mbRes = await mbQuery;
    if (mbRes.error) throw mbRes.error;
    const matchingBorrowers = mbRes.data;

    let lResByBorrower: any = { data: [] };
    if (matchingBorrowers && matchingBorrowers.length > 0) {
      const borrowerIds = (matchingBorrowers as any[]).map((b) => b.id);
      lResByBorrower = await (supabase as any)
        .from('loans')
        .select('id, reference_no, borrowers(full_name)')
        .in('borrower_id', borrowerIds)
        .limit(5);
      if (lResByBorrower.error) throw lResByBorrower.error;
    }

    // Combine and deduplicate loan results
    const allLoans = [...(lResByRef.data || []), ...(lResByBorrower.data || [])];
    const uniqueLoans = allLoans
      .filter((loan, index, self) => index === self.findIndex((l) => l.id === loan.id))
      .slice(0, 5);

    return { borrowers: bRes.data || [], loans: uniqueLoans };
  };

  const runGlobalSearch = async (query: string, opts?: { force?: boolean }) => {
    const normalized = query.trim();
    if (!normalized) {
      setGlobalSearchError(null);
      setGlobalSearchResults({ borrowers: [], loans: [] });
      setGlobalSearchLoading(false);
      return { borrowers: [], loans: [] };
    }

    // Check cache
    if (!opts?.force) {
      const cached = globalSearchCache.current.get(normalized);
      if (cached) {
        setGlobalSearchError(null);
        setGlobalSearchResults(cached);
        setGlobalSearchLoading(false);
        return cached;
      }
    }

    const seq = ++globalSearchSeq.current;
    setGlobalSearchLoading(true);
    setGlobalSearchError(null);

    try {
      const results = await performGlobalSearch(normalized);
      if (seq !== globalSearchSeq.current) return results;

      globalSearchCache.current.set(normalized, results);
      if (globalSearchCache.current.size > 100) globalSearchCache.current.clear();

      setGlobalSearchResults(results);
      setGlobalSearchLoading(false);
      return results;
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as any).message)
          : 'Search failed';
      if (seq !== globalSearchSeq.current) return { borrowers: [], loans: [] };
      setGlobalSearchError(message);
      setGlobalSearchResults({ borrowers: [], loans: [] });
      setGlobalSearchLoading(false);
      return { borrowers: [], loans: [] };
    }
  };

  const closeGlobalSearch = useCallback(() => {
    setGlobalSearchFocused(false);
    setGlobalSearchQuery('');
    setGlobalSearchResults({ borrowers: [], loans: [] });
    setGlobalSearchLoading(false);
    setGlobalSearchError(null);
  }, []);

  const handleGlobalSearchSubmit = async (query: string) => {
    const results = await runGlobalSearch(query, { force: true });
    if (results.borrowers.length === 1 && results.loans.length === 0) {
      setIsMobileSearchOpen(false);
      closeGlobalSearch();
      navigate(`/borrowers/${results.borrowers[0].id}`);
    } else if (results.loans.length === 1 && results.borrowers.length === 0) {
      setIsMobileSearchOpen(false);
      closeGlobalSearch();
      navigate(`/loans/${results.loans[0].id}`);
    }
    return results;
  };

  const showGlobalDropdown =
    globalSearchFocused &&
    globalSearchQuery.trim().length >= 2 &&
    (globalSearchLoading ||
      !!globalSearchError ||
      globalSearchResults.borrowers.length > 0 ||
      globalSearchResults.loans.length > 0);

  // Create navigation items with current counts
  const navigation = createNavigationItems(counts);

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 via-gray-100/30 to-indigo-50/20 flex flex-col md:flex-row">
      <ToastProvider />

      {/* Mobile Search Modal */}
      <MobileSearchModal
        isOpen={isMobileSearchOpen}
        onClose={() => setIsMobileSearchOpen(false)}
        globalSearchQuery={globalSearchQuery}
        onGlobalSearchQueryChange={setGlobalSearchQuery}
        onGlobalSearchFocusChange={setGlobalSearchFocused}
        onGlobalSearch={runGlobalSearch}
        onGlobalSearchSubmit={handleGlobalSearchSubmit}
        showGlobalDropdown={showGlobalDropdown}
        globalSearchLoading={globalSearchLoading}
        globalSearchError={globalSearchError}
        globalSearchResults={globalSearchResults}
        onCloseGlobalSearch={closeGlobalSearch}
      />

      {/* Sidebar */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        navigation={navigation}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuOpen={() => setIsMobileMenuOpen(true)}
          onSearchOpen={() => setIsMobileSearchOpen(true)}
          globalSearchQuery={globalSearchQuery}
          onGlobalSearchQueryChange={setGlobalSearchQuery}
          onGlobalSearchFocusChange={setGlobalSearchFocused}
          onGlobalSearch={runGlobalSearch}
          onGlobalSearchSubmit={handleGlobalSearchSubmit}
          showGlobalDropdown={showGlobalDropdown}
          globalSearchLoading={globalSearchLoading}
          globalSearchError={globalSearchError}
          globalSearchResults={globalSearchResults}
          onCloseGlobalSearch={closeGlobalSearch}
        />

        <main
          className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 md:px-6 md:py-6 scroll-smooth"
          style={{ background: '#f1f5f9' }}
        >
          <Breadcrumbs />
          <div className="mt-4 animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
};
