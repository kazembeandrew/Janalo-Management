import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, 
  Users, 
  Banknote, 
  LogOut, 
  Menu, 
  X, 
  PieChart,
  FileText,
  Receipt,
  MessageSquare,
  Shield,
  History,
  Calendar,
  Award,
  Calculator,
  UserCircle,
  Map as MapIcon,
  ClipboardList,
  Landmark,
  Scale,
  Target,
  CalendarDays,
  Settings,
  FileSpreadsheet,
  FolderOpen,
  Search,
  ChevronRight,
  Hash,
  BarChart3,
  Zap,
  PiggyBank,
  Heart,
  Filter,
  Clock
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { OversightIndicator } from './OversightIndicator';
import { ToastProvider } from './ToastProvider';
import { SearchBar } from './ui/SearchBar';
import { Breadcrumbs } from './Breadcrumbs';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, effectiveRoles, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [counts, setCounts] = useState({ inbox: 0, loans: 0 });
  const headerIconButtonClass =
    'flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors';
  
  const performGlobalSearch = async (query: string) => {
    try {
      // Search borrowers by name
      const bRes = await supabase
        .from('borrowers')
        .select('id, full_name')
        .ilike('full_name', `%${query}%`)
        .limit(5);
      
      // Search loans by reference number
      const lResByRef = await supabase
        .from('loans')
        .select('id, reference_no, borrowers(full_name)')
        .ilike('reference_no', `%${query}%`)
        .limit(5);
      
      // Search loans by borrower name through the borrowers table
      const { data: matchingBorrowers } = await supabase
        .from('borrowers')
        .select('id')
        .ilike('full_name', `%${query}%`);
      
      let lResByBorrower: any = { data: [] };
      if (matchingBorrowers && matchingBorrowers.length > 0) {
        const borrowerIds = matchingBorrowers.map(b => b.id);
        lResByBorrower = await supabase
          .from('loans')
          .select('id, reference_no, borrowers(full_name)')
          .in('borrower_id', borrowerIds)
          .limit(5);
      }
      
      // Combine loan results and remove duplicates
      const allLoans = [...(lResByRef.data || []), ...(lResByBorrower.data || [])];
      const uniqueLoans = allLoans.filter((loan, index, self) => 
        index === self.findIndex(l => l.id === loan.id)
      ).slice(0, 5);
      
      return { borrowers: bRes.data || [], loans: uniqueLoans };
    } catch (error: unknown) {
      console.error('Search error:', error instanceof Error ? error.message : String(error));
      return { borrowers: [], loans: [] };
    }
  };

  useEffect(() => {
    fetchCounts();
    
    const channel = supabase
      .channel('global-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchCounts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCounts = async () => {
    if (!profile) return;
    const { data } = await supabase.rpc('get_notification_counts');
    if (data) setCounts(data);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant'] },
    { name: 'Borrowers', href: '/borrowers', icon: Users, roles: ['admin', 'ceo', 'loan_officer'] },
    { name: 'Loans', href: '/loans', icon: Banknote, roles: ['admin', 'ceo', 'loan_officer', 'accountant'], badge: counts.loans },
    { name: 'Financial', href: '/financial', icon: PiggyBank, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Reporting', href: '/reports', icon: FileText, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Administration', href: '/users', icon: Shield, roles: ['admin', 'ceo', 'hr'] },
    { name: 'Communication', href: '/messages', icon: MessageSquare, roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant'], badge: counts.inbox },
    { name: 'Tools', href: '/calculator', icon: Calculator, roles: ['admin', 'ceo', 'loan_officer', 'accountant', 'hr'] },
    { name: 'My Account', href: '/profile', icon: UserCircle, roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant'] },
    // New Admin Features
    { name: 'Advanced Analytics', href: '/analytics', icon: BarChart3, roles: ['admin', 'ceo'] },
    { name: 'Compliance Management', href: '/compliance', icon: Shield, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Financial Management', href: '/financial-management', icon: PiggyBank, roles: ['admin', 'ceo', 'accountant'] },
  ];

  // Get current page title
  const getPageTitle = () => {
    const path = location.pathname;
    const pageTitles: { [key: string]: string } = {
      '/': 'Dashboard',
      '/borrowers': 'Borrowers',
      '/loans': 'Loans',
      '/financial': 'Financial',
      '/reports': 'Reporting',
      '/users': 'Administration',
      '/messages': 'Communication',
      '/calculator': 'Tools',
      '/profile': 'My Account',
      '/analytics': 'Advanced Analytics',
      '/compliance': 'Compliance Management',
      '/financial-management': 'Financial Management'
    };
    return pageTitles[path] || 'JANALO';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <ToastProvider />
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile Search Modal */}
      {isMobileSearchOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex items-start justify-center pt-20 px-4 sm:hidden">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Search</h3>
              <button onClick={() => setIsMobileSearchOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <SearchBar
              placeholder="Search clients or loan references..."
              onSearch={async (query) => {
                const results = await performGlobalSearch(query);
                setIsMobileSearchOpen(false);
                if (results.borrowers.length === 1 && results.loans.length === 0) {
                  navigate(`/borrowers/${results.borrowers[0].id}`);
                } else if (results.loans.length === 1 && results.borrowers.length === 0) {
                  navigate(`/loans/${results.loans[0].id}`);
                }
              }}
              showFilterButton={true}
              showHistory={true}
            />
          </div>
        </div>
      )}

      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-indigo-900 text-white transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-6 bg-indigo-800">
          <div className="flex items-center space-x-2">
            <PieChart className="h-8 w-8 text-indigo-300" />
            <span className="text-xl font-bold tracking-wider">JANALO</span>
          </div>
          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(false)} title="Close menu"><X className="h-6 w-6" /></button>
        </div>

        <div className="px-6 py-4 border-b border-indigo-800">
          <div className="text-xs uppercase text-indigo-300 font-semibold tracking-wider mb-1">
            {profile?.role?.replace('_', ' ')}
            {profile?.delegated_role && <span className="ml-1 text-blue-300">(+ {profile.delegated_role.replace('_', ' ')})</span>}
          </div>
          <div className="font-medium truncate text-sm">{profile?.full_name}</div>
        </div>

        <nav className="mt-4 px-2 space-y-1 overflow-y-auto custom-scrollbar h-[calc(100vh-14rem)] pb-4">
          {navigation.map((item) => {
            const hasAccess = item.roles.some(r => effectiveRoles.includes(r as any));
            if (!hasAccess) return null;

            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-md transition-colors relative group border-l-2 ${
                  isActive
                    ? 'bg-indigo-800/70 text-white border-indigo-300'
                    : 'text-indigo-100 border-transparent hover:bg-indigo-800/60 hover:border-indigo-300'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-indigo-200 group-hover:text-indigo-100'}`} />
                {item.name}
                {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute right-3 top-3 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full animate-pulse shadow-sm">
                        {item.badge > 99 ? '99+' : item.badge}
                    </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 bg-indigo-900 border-t border-indigo-800/70">
          <button onClick={handleSignOut} className="flex items-center w-full px-4 py-2 text-sm font-medium text-indigo-200 rounded-md hover:bg-indigo-800/70 transition-colors">
            <LogOut className="mr-3 h-5 w-5" /> Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 md:px-8 h-16 bg-white border-b border-gray-100 shadow-sm z-40">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-gray-500 hover:text-gray-700" title="Open menu">
                    <Menu className="h-6 w-6" />
                </button>
                
                {/* Mobile Search Button */}
                <button 
                  onClick={() => setIsMobileSearchOpen(true)} 
                  className="sm:hidden text-gray-500 hover:text-gray-700" 
                  title="Search"
                >
                  <Search className="h-5 w-5" />
                </button>
                
                <h1 className="text-lg md:text-xl font-semibold text-gray-900 whitespace-nowrap">{getPageTitle()}</h1>

                <div className="hidden sm:block h-6 w-px bg-gray-200" />
                
                {/* Enhanced Global Search Bar */}
                <div className="hidden sm:block w-full max-w-xl min-w-0">
                  <SearchBar
                    placeholder="Search clients or loan references..."
                    onSearch={async (query) => {
                        const results = await performGlobalSearch(query);
                        // Handle navigation based on results
                        if (results.borrowers.length === 1 && results.loans.length === 0) {
                            navigate(`/borrowers/${results.borrowers[0].id}`);
                        } else if (results.loans.length === 1 && results.borrowers.length === 0) {
                            navigate(`/loans/${results.loans[0].id}`);
                        }
                    }}
                    showFilterButton={true}
                    showHistory={true}
                  />
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <OversightIndicator />
                <Link
                  to="/calculator"
                  className={headerIconButtonClass}
                  title="Loan Calculator"
                >
                  <Calculator className="h-5 w-5" />
                </Link>
                <NotificationBell />
                <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-100">
                    {profile?.full_name?.charAt(0)}
                </div>
            </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-8 md:py-6">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
};
