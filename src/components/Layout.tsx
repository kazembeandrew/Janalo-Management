import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  PlusCircle,
  FileText,
  Receipt,
  MessageSquare,
  Shield
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { ToastProvider } from './ToastProvider';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [counts, setCounts] = useState({ inbox: 0, loans: 0 });

  useEffect(() => {
    fetchCounts();
    
    // Subscribe to relevant tables
    const channel = supabase
      .channel('global-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, () => {
          fetchCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchCounts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Re-fetch when location changes
  useEffect(() => {
      fetchCounts();
  }, [location.pathname]);

  const fetchCounts = async () => {
      if (!profile) return;
      const { data, error } = await supabase.rpc('get_notification_counts');
      if (!error && data) setCounts(data);
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'ceo', 'loan_officer'] },
    { name: 'Borrowers', href: '/borrowers', icon: Users, roles: ['admin', 'ceo', 'loan_officer'] },
    { name: 'Loans', href: '/loans', icon: Banknote, roles: ['admin', 'ceo', 'loan_officer'], badge: counts.loans },
    { name: 'Inbox', href: '/messages', icon: MessageSquare, roles: ['admin', 'ceo', 'loan_officer'], badge: counts.inbox },
    { name: 'Expenses', href: '/expenses', icon: Receipt, roles: ['admin', 'ceo'] },
    { name: 'Reports', href: '/reports', icon: FileText, roles: ['admin', 'ceo'] },
    { name: 'Users', href: '/users', icon: Shield, roles: ['admin', 'ceo'] },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <ToastProvider />
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-indigo-900 text-white transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-6 bg-indigo-800">
          <div className="flex items-center space-x-2">
            <PieChart className="h-8 w-8 text-indigo-300" />
            <span className="text-xl font-bold tracking-wider">JANALO</span>
          </div>
          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-indigo-800 flex justify-between items-center">
          <div className="overflow-hidden">
            <div className="text-xs uppercase text-indigo-300 font-semibold tracking-wider mb-1">
              {profile?.role?.replace('_', ' ')}
            </div>
            <div className="font-medium truncate text-sm">{profile?.full_name}</div>
          </div>
          <NotificationBell />
        </div>

        <nav className="mt-4 px-3 space-y-1">
          {navigation.map((item) => {
            if (profile?.role && !item.roles.includes(profile.role)) {
              return null;
            }

            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors relative group ${
                  isActive
                    ? 'bg-indigo-700 text-white'
                    : 'text-indigo-100 hover:bg-indigo-700'
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
          
           {(profile?.role === 'loan_officer' || profile?.role === 'admin') && (
             <Link
                to="/loans/new"
                className="flex items-center px-4 py-3 text-sm font-medium rounded-md text-green-300 hover:bg-indigo-700 hover:text-green-200 mt-4 border border-indigo-700"
                onClick={() => setIsMobileMenuOpen(false)}
             >
                <PlusCircle className="mr-3 h-5 w-5" />
                New Application
             </Link>
           )}
        </nav>

        <div className="absolute bottom-0 w-full p-4 bg-indigo-900">
          <button
            onClick={handleSignOut}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-indigo-200 rounded-md hover:bg-indigo-800 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 h-16 bg-white shadow-sm z-10">
            <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
            >
                <Menu className="h-6 w-6" />
            </button>
            <span className="font-bold text-gray-900">Janalo Management</span>
            <NotificationBell />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
            {children}
        </main>
      </div>
    </div>
  );
};