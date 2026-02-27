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
  Server,
  Megaphone,
  PiggyBank,
  Heart,
  Filter,
  Clock
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { OversightIndicator } from './OversightIndicator';
import { ToastProvider } from './ToastProvider';
import { SearchBar } from './ui/SearchBar';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, effectiveRoles, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [counts, setCounts] = useState({ inbox: 0, loans: 0 });
  
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
    } catch (error) {
      console.error('Search error:', error);
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

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant'] },
    { name: 'Borrowers', href: '/borrowers', icon: Users, roles: ['admin', 'ceo', 'loan_officer'] },
    { name: 'Loans', href: '/loans', icon: Banknote, roles: ['admin', 'ceo', 'loan_officer'], badge: counts.loans },
    { name: 'Repayments', href: '/repayments', icon: Receipt, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Repayment Schedule', href: '/schedule', icon: CalendarDays, roles: ['admin', 'ceo', 'accountant', 'loan_officer'], badge: 0 },
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
    // New Admin Features
    { name: 'Advanced Analytics', href: '/analytics', icon: BarChart3, roles: ['admin', 'ceo'] },
    { name: 'Compliance Management', href: '/compliance', icon: Shield, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Workflow Automation', href: '/workflows', icon: Zap, roles: ['admin', 'ceo'] },
    { name: 'Security Management', href: '/security', icon: Shield, roles: ['admin'] },
    { name: 'System Administration', href: '/system-admin', icon: Server, roles: ['admin'] },
    { name: 'Communication Hub', href: '/communication', icon: Megaphone, roles: ['admin', 'ceo', 'hr'] },
    { name: 'Financial Management', href: '/financial-management', icon: PiggyBank, roles: ['admin', 'ceo', 'accountant'] },
    { name: 'Customer Relations', href: '/crm', icon: Heart, roles: ['admin', 'ceo', 'loan_officer'] },
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
          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(false)} title="Close menu"><X className="h-6 w-6" /></button>
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
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-gray-500 hover:text-gray-700 mr-4" title="Open menu">
                    <Menu className="h-6 w-6" />
                </button>
                
                {/* Enhanced Global Search Bar */}
                <div className="max-w-md w-full hidden sm:block">
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
            
            <div className="flex items-center space-x-4">
                <OversightIndicator />
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