import {
  LayoutDashboard,
  Users,
  Banknote,
  MessageSquare,
  TrendingUp,
  Landmark,
  GitBranch,
  Receipt,
  PieChart,
  FileSpreadsheet,
  PiggyBank,
  FileText,
  ShieldCheck,
  Shield,
  Calculator,
  UserCircle,
  Briefcase,
  BookOpen,
  FileCheck,
  Settings,
  Globe,
  Wallet,
  Coins,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavigationItem {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  roles: string[];
  badge?: number;
  section: string;
  legacyRoutes?: string[]; // For redirect support
}

export interface SectionGroup {
  title: string;
  icon: ComponentType<{ className?: string }>;
  items: string[];
  color: string;
}

// Page titles mapping
export const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/borrowers': 'Borrowers',
  '/loans': 'Loans',
  '/financial': 'Financial Overview',
  '/reports': 'Reporting',
  '/users': 'Administration',
  '/messages': 'Communication',
  '/calculator': 'Tools',
  '/profile': 'My Account',
  '/accounts': 'Accounts',
  '/statements': 'Statements',
  '/budgets': 'Budgets',
  '/ledger': 'Ledger',
  '/analytics': 'Advanced Analytics',
  '/compliance': 'Compliance Management',
  '/financial-management': 'Financial Management',
  '/oversight': 'System Oversight',
  '/payroll': 'Payroll & Tax Management',
  '/account-structure-map': 'Account Structure Map',
  '/loan-enhancements': 'Loan Enhancements',
  '/user-management': 'User Management',
  '/communications': 'Communications',
  '/business-intelligence': 'Business Intelligence',
  '/collections': 'Collections',
  '/notifications': 'Notifications',
  '/notifications/settings': 'Notification Settings',
  '/tasks': 'Tasks',
  '/documents': 'Document Center',
  '/expenses': 'Expenses',
  '/audit-logs': 'Audit Logs',
  '/performance': 'Performance',
  '/client-map': 'Map Administration',
  '/repayments': 'Repayments',
  '/schedule': 'Repayment Schedule',
  '/settings': 'System Settings',
  '/import': 'Import Data',
  '/my-payslips': 'My Payslips',
  '/my-expense-claims': 'My Expense Claims',
  '/my-staff-funds': 'My Staff Funds',
};

// Route redirects for legacy URLs
export const ROUTE_REDIRECTS: Record<string, string> = {
  '/financial-management': '/financial',
  '/user-management': '/users',
  '/communications': '/messages',
  '/reporting': '/reports',
  '/tools': '/calculator',
};

// Section groups configuration
export const SECTION_GROUPS: SectionGroup[] = [
  {
    title: 'Core Operations',
    icon: Briefcase,
    items: ['Core Operations'],
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    title: 'Financial Management',
    icon: BookOpen,
    items: ['Financial Management'],
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    title: 'Reporting & Analytics',
    icon: FileCheck,
    items: ['Reporting & Analytics'],
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  {
    title: 'Administration',
    icon: Settings,
    items: ['Administration'],
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
];

// Navigation items organized by section
export const createNavigationItems = (counts: { inbox: number; loans: number }): NavigationItem[] => [
  // Core Operations Section
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant', 'hr_manager', 'driver', 'it_support', 'operations'],
    section: 'Core Operations',
  },
  {
    name: 'Borrowers',
    href: '/borrowers',
    icon: Users,
    roles: ['admin', 'ceo', 'loan_officer'],
    section: 'Core Operations',
  },
  {
    name: 'Loans',
    href: '/loans',
    icon: Banknote,
    roles: ['admin', 'ceo', 'loan_officer', 'accountant'],
    badge: counts.loans,
    section: 'Core Operations',
  },
  {
    name: 'Communication',
    href: '/messages',
    icon: MessageSquare,
    roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant', 'hr_manager', 'driver', 'it_support', 'operations'],
    badge: counts.inbox,
    section: 'Core Operations',
  },

  // Financial Management Section
  {
    name: 'Financial Overview',
    href: '/financial',
    icon: TrendingUp,
    roles: ['admin', 'ceo', 'accountant'],
    section: 'Financial Management',
  },
  {
    name: 'Accounts',
    href: '/accounts',
    icon: Landmark,
    roles: ['admin', 'ceo', 'accountant'],
    section: 'Financial Management',
  },
  {
    name: 'Account Map',
    href: '/account-structure-map',
    icon: GitBranch,
    roles: ['admin', 'ceo', 'accountant'],
    section: 'Financial Management',
  },
  {
    name: 'Statements',
    href: '/statements',
    icon: Receipt,
    roles: ['admin', 'ceo', 'accountant'],
    section: 'Financial Management',
  },
  {
    name: 'Budgets',
    href: '/budgets',
    icon: PieChart,
    roles: ['admin', 'ceo', 'accountant'],
    section: 'Financial Management',
  },
  {
    name: 'Fund Allocations',
    href: '/fund-allocations',
    icon: Coins,
    roles: ['admin', 'accountant'],
    section: 'Financial Management',
  },
  {
    name: 'Ledger',
    href: '/ledger',
    icon: FileSpreadsheet,
    roles: ['admin', 'ceo', 'accountant'],
    section: 'Financial Management',
  },

  // Reporting & Analytics
  {
    name: 'Reporting',
    href: '/reports',
    icon: FileText,
    roles: ['admin', 'ceo', 'accountant'],
    section: 'Reporting & Analytics',
  },
  {
    name: 'Map Admin',
    href: '/client-map',
    icon: Globe,
    roles: ['admin', 'ceo'],
    section: 'Reporting & Analytics',
  },
  {
    name: 'Oversight',
    href: '/oversight',
    icon: ShieldCheck,
    roles: ['admin', 'ceo'],
    section: 'Reporting & Analytics',
  },

  // Administration
  {
    name: 'Administration',
    href: '/users',
    icon: Shield,
    roles: ['admin', 'ceo', 'hr'],
    section: 'Administration',
  },
  {
    name: 'Payroll',
    href: '/payroll',
    icon: Users,
    roles: ['admin', 'ceo', 'hr', 'cfo', 'accountant'],
    section: 'Administration',
  },
  {
    name: 'My Payslips',
    href: '/my-payslips',
    icon: Wallet,
    roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant', 'hr_manager', 'driver', 'it_support', 'operations'],
    section: 'Administration',
  },
  {
    name: 'My Staff Funds',
    href: '/my-staff-funds',
    icon: Coins,
    roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant', 'hr_manager', 'driver', 'it_support', 'operations'],
    section: 'Administration',
  },
  {
    name: 'Staff Expense Claims',
    href: '/my-expense-claims',
    icon: Receipt,
    roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant', 'hr_manager', 'driver', 'it_support', 'operations'],
    section: 'Administration',
  },
  {
    name: 'Tools',
    href: '/calculator',
    icon: Calculator,
    roles: ['admin', 'ceo', 'loan_officer', 'accountant', 'hr', 'hr_manager', 'driver', 'it_support', 'operations'],
    section: 'Administration',
  },
  {
    name: 'My Account',
    href: '/profile',
    icon: UserCircle,
    roles: ['admin', 'ceo', 'loan_officer', 'hr', 'accountant', 'hr_manager', 'driver', 'it_support', 'operations'],
    section: 'Administration',
  },
];

// Helper to get items by section
export const getItemsBySection = (
  sectionName: string,
  navigation: NavigationItem[]
): NavigationItem[] => {
  return navigation.filter((item) => item.section === sectionName);
};

// Helper to filter navigation by roles
export const filterNavigationByRoles = (
  navigation: NavigationItem[],
  effectiveRoles: string[]
): NavigationItem[] => {
  return navigation.filter((item) =>
    item.roles.some((role) => effectiveRoles.includes(role))
  );
};
