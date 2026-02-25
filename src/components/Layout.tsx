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
  Hash
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { ToastProvider } from './ToastProvider';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, effectiveRoles, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [counts, setCounts] = useState({ inbox: 0, loans: 0 });
  
  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{borrowers: any[], loans: any[]}>({ borrowers: [], loans: [] });
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCounts();
    
    const channel = supabase
      .channel('global-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchCounts())
      .subscribe();

    const handleClickOutside = (e: MouseEvent) => {
        if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
            setSearchQuery('');
        }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
      fetchCounts();
      setSearchQuery(''); // Clear search on navigation
  }, [location.pathname]);

  useEffect(() => {
      const delayDebounce = setTimeout(() => {
          if (searchQuery.trim().length > 1) {
              performGlobalSearch();
          } else {
              setSearchResults({ borrowers: [], loans: [] });
          }
      }, 300);
      return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const fetchCounts = async () => {
      if (!profile) return;
      const { data } = await supabase.rpc('get_notification_counts');
      if (data) setCounts(data);
  };

  const performGlobalSearch = async () => {
      setIsSearching(true);
      try {
          const [bRes, lRes] = await Promise.all([
              supabase.from('borrowers').select('id, full_name').ilike('full_name', `%${searchQuery}%`).limit(5),
              supabase.from('loans').select('id, reference_no, borrowers(full_name)').or(`reference_no.ilike.%${searchQuery}%, borrowers.full_name.ilike.%${searchQuery}%`).limit(5)
          ]);
          setSearchResults({ borrowers: bRes.data || [], loans: lRes.data || [] });
      } finally {
          setIsSearching(false);
      }
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant'] },
    { name: 'Borrowers', href: '/borrowers', icon: Users, roles: ['admin', 'ceo', 'loan_officer'] },
    { name: 'Loans', href: '/loans', icon: Banknote, roles: ['admin', 'ceo', 'loan_officer'], badge: counts.loans },
    { name: 'Repayments', href: '/repayments', icon: Receipt, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Repayment Schedule', href: '/schedule', icon: CalendarDays, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Accounts', href: '/accounts', icon: Landmark, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Budgets', href: '/budgets', icon: Target, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Statements', href: '/statements', icon: Scale, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Collections', href: '/collections', icon: Calendar, roles: ['admin', 'loan_officer', 'accountant'] },
    { name: 'Data Import', href: '/import', icon: FileSpreadsheet, roles: ['admin', 'accountant'] },
    { name: 'Document Center', href: '/documents', icon: FolderOpen, roles: ['admin', 'ceo', 'accountant', 'loan_officer', 'hr'] },
    { name: 'Client Map', href: '/map', icon: MapIcon, roles: ['admin', 'ceo', 'loan_officer'] },
    { name: 'Calculator', href: '/calculator', icon: Calculator, roles: ['admin', 'ceo', 'loan_officer'] },
    { name: 'Inbox', href: '/messages', icon: MessageSquare, roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant'], badge: counts.inbox },
    { name: 'Tasks', href: '/tasks', icon: ClipboardList, roles: ['admin', 'ceo', 'hr', 'accountant', 'loan_officer'] },
    { name: 'Performance', href: '/performance', icon: Award, roles: ['admin', 'ceo', 'hr'] },
    { name: 'Expenses', href: '/expenses', icon: Receipt, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Reports', href: '/reports', icon: FileText, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Users', href: '/users', icon: Shield, roles: ['admin', 'ceo', 'hr'] },
    { name: 'Audit Logs', href: '/audit-logs', icon: History, roles: ['admin'] },
    { name: 'System Settings', href: '/settings', icon: Settings, roles: ['admin', 'ceo'] },
    { name: 'My Account', href: '/profile', icon: UserCircle, roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant'] },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <ToastProvider />
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-indigo-900 text-white transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-6 bg-indigo-800">
          <div className="flex items-center space-x-2">
            <PieChart className="h-8 w-8 text-indigo-300" />
            <span className="text-xl font-bold tracking-wider">JANALO</span>
          </div>
          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(false)}><X className="h-6 w-6" /></button>
        </div>

        <div className="px-6 py-4 border-b border-indigo-800">
          <div className="text-xs uppercase text-indigo-300 font-semibold tracking-wider mb-1">
            {profile?.role?.replace('_', ' ')}
            {profile?.delegated_role && <span className="ml-1 text-blue-300">(+ {profile.delegated_role.replace('_', ' ')})</span>}
          </div>
          <div className="font-medium truncate text-sm">{profile?.full_name}</div>
        </div>

        <nav className="mt-4 px-3 space-y-1 overflow-y-auto custom-scrollbar h-[calc(100vh-12rem)]">
          {navigation.map((item) => {
            const hasAccess = item.roles.some(r => effectiveRoles.includes(r as any));
            if (!hasAccess) return null;

            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors relative group ${
                  isActive ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-700'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon className="mr-3 h-5 w-5" />
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

        <div className="absolute bottom-0 w-full p-4 bg-indigo-900">
          <button onClick={handleSignOut} className="flex items-center w-full px-4 py-2 text-sm font-medium text-indigo-200 rounded-md hover:bg-indigo-800 transition-colors">
            <LogOut className="mr-3 h-5 w-5" /> Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 md:px-8 h-16 bg-white shadow-sm z-40">
            <div className="flex items-center flex-1">
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-gray-500 hover:text-gray-700 mr-4">
                    <Menu className="h-6 w-6" />
                </button>
                
                {/* Global Search Bar */}
                <div className="relative max-w-md w-full hidden sm:block" ref={searchRef}>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input 
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                        placeholder="Search clients or loan references..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    
                    {searchQuery.trim().length > 1 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-2 max-h-96 overflow-y-auto custom-scrollbar">
                                {isSearching ? (
                                    <div className="p-4 text-center text-xs text-gray-400 font-bold uppercase tracking-widest">Searching...</div>
                                ) : searchResults.borrowers.length === 0 && searchResults.loans.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-gray-400">No matches found</div>
                                ) : (
                                    <>
                                        {searchResults.borrowers.length > 0 && (
                                            <div className="mb-2">
                                                <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Clients</p>
                                                {searchResults.borrowers.map(b => (
                                                    <button key={b.id} onClick={() => navigate(`/borrowers/${b.id}`)} className="w-full flex items-center justify-between p-3 hover:bg-indigo-50 rounded-xl transition-colors group">
                                                        <div className="flex items-center">
                                                            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs mr-3">{b.full_name.charAt(0)}</div>
                                                            <span className="text-sm font-bold text-gray-700">{b.full_name}</span>
                                                        </div>
                                                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-400" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {searchResults.loans.length > 0 && (
                                            <div>
                                                <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Loans</p>
                                                {searchResults.loans.map(l => (
                                                    <button key={l.id} onClick={() => navigate(`/loans/${l.id}`)} className="w-full flex items-center justify-between p-3 hover:bg-indigo-50 rounded-xl transition-colors group">
                                                        <div className="flex items-center">
                                                            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs mr-3"><Hash className="h-4 w-4" /></div>
                                                            <div className="text-left">
                                                                <span className="text-sm font-bold text-gray-700 block">{l.reference_no}</span>
                                                                <span className="text-[10px] text-gray-400 font-medium">{l.borrowers?.full_name}</span>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-400" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex items-center space-x-4">
                <NotificationBell />
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-200">
                    {profile?.full_name?.charAt(0)}
                </div>
            </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
};