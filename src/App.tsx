import React, { PropsWithChildren } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PresenceProvider } from '@/context/PresenceContext';
import { Layout } from '@/components/Layout';
import { lazyLoad } from '@/utils/lazyLoad';

// Critical components - loaded immediately
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';

// Lazy loaded heavy components
const LazyBorrowers = lazyLoad(() => import('@/pages/Borrowers'));
const LazyBorrowerDetails = lazyLoad(() => import('@/pages/BorrowerDetails'));
const LazyLoans = lazyLoad(() => import('@/pages/Loans'));
const LazyCreateLoan = lazyLoad(() => import('@/pages/CreateLoan'));
const LazyEditLoan = lazyLoad(() => import('@/pages/EditLoan'));
const LazyLoanDetails = lazyLoad(() => import('@/pages/LoanDetails'));
const LazyReports = lazyLoad(() => import('@/pages/Reports'));
const LazyExpenses = lazyLoad(() => import('@/pages/Expenses'));
const LazyMessages = lazyLoad(() => import('@/pages/Messages'));
const LazyUsers = lazyLoad(() => import('@/pages/Users'));
const LazyAuditLogs = lazyLoad(() => import('@/pages/AuditLogs'));
const LazyCollections = lazyLoad(() => import('@/pages/Collections'));
const LazyPerformance = lazyLoad(() => import('@/pages/Performance'));
const LazyCalculator = lazyLoad(() => import('@/pages/Calculator'));
const LazyProfile = lazyLoad(() => import('@/pages/Profile'));
const LazyClientMap = lazyLoad(() => import('@/pages/ClientMap'));
const LazyTasks = lazyLoad(() => import('@/pages/Tasks'));
const LazyRepayments = lazyLoad(() => import('@/pages/Repayments'));
const LazyAccounts = lazyLoad(() => import('@/pages/Accounts'));
const LazyFinancialStatements = lazyLoad(() => import('@/pages/FinancialStatements'));
const LazyBudgets = lazyLoad(() => import('@/pages/Budgets'));
const LazyRepaymentSchedule = lazyLoad(() => import('@/pages/RepaymentSchedule'));
const LazySystemSettings = lazyLoad(() => import('@/pages/SystemSettings'));
const LazyImportData = lazyLoad(() => import('@/pages/ImportData'));
const LazyDocumentCenter = lazyLoad(() => import('@/pages/DocumentCenter'));
const LazyOversight = lazyLoad(() => import('@/pages/Oversight'));
const LazyRestructureLoan = lazyLoad(() => import('@/pages/RestructureLoan'));
const LazyNotificationsPage = lazyLoad(() => import('@/pages/NotificationsPage'));
const LazyNotificationSettingsPage = lazyLoad(() => import('@/pages/NotificationSettingsPage'));
const LazyAdvancedAnalytics = lazyLoad(() => import('@/pages/AdvancedAnalytics'));
const LazyComplianceManagement = lazyLoad(() => import('@/pages/ComplianceManagement'));
const LazyWorkflowAutomation = lazyLoad(() => import('@/pages/WorkflowAutomation'));
const LazySecurityManagement = lazyLoad(() => import('@/pages/SecurityManagement'));
const LazySystemAdministration = lazyLoad(() => import('@/pages/SystemAdministration'));
const LazyCommunicationHub = lazyLoad(() => import('@/pages/CommunicationHub'));
const LazyFinancialManagement = lazyLoad(() => import('@/pages/FinancialManagement'));
const LazyCustomerRelationshipManagement = lazyLoad(() => import('@/pages/CustomerRelationshipManagement'));

const ProtectedRoute = ({ children }: PropsWithChildren) => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <PresenceProvider>
        <HashRouter>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/borrowers"
            element={
              <ProtectedRoute>
                <LazyBorrowers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/borrowers/:id"
            element={
              <ProtectedRoute>
                <LazyBorrowerDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loans"
            element={
              <ProtectedRoute>
                <LazyLoans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/repayments"
            element={
              <ProtectedRoute>
                <LazyRepayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <LazyRepaymentSchedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts"
            element={
              <ProtectedRoute>
                <LazyAccounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/budgets"
            element={
              <ProtectedRoute>
                <LazyBudgets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/statements"
            element={
              <ProtectedRoute>
                <LazyFinancialStatements />
              </ProtectedRoute>
            }
          />
          <Route
            path="/collections"
            element={
              <ProtectedRoute>
                <LazyCollections />
              </ProtectedRoute>
            }
          />
          <Route
            path="/performance"
            element={
              <ProtectedRoute>
                <LazyPerformance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calculator"
            element={
              <ProtectedRoute>
                <LazyCalculator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <LazyClientMap />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loans/new"
            element={
              <ProtectedRoute>
                <LazyCreateLoan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loans/edit/:id"
            element={
              <ProtectedRoute>
                <LazyEditLoan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loans/restructure/:id"
            element={
              <ProtectedRoute>
                <LazyRestructureLoan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loans/:id"
            element={
              <ProtectedRoute>
                <LazyLoanDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <LazyMessages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <LazyReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <LazyExpenses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <LazyTasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <LazyUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute>
                <LazyAuditLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <LazySystemSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/import"
            element={
              <ProtectedRoute>
                <LazyImportData />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <LazyDocumentCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/oversight"
            element={
              <ProtectedRoute>
                <LazyOversight />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <LazyProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <LazyNotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications/settings"
            element={
              <ProtectedRoute>
                <LazyNotificationSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <LazyAdvancedAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compliance"
            element={
              <ProtectedRoute>
                <LazyComplianceManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workflows"
            element={
              <ProtectedRoute>
                <LazyWorkflowAutomation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/security"
            element={
              <ProtectedRoute>
                <LazySecurityManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/system-admin"
            element={
              <ProtectedRoute>
                <LazySystemAdministration />
              </ProtectedRoute>
            }
          />
          <Route
            path="/communication"
            element={
              <ProtectedRoute>
                <LazyCommunicationHub />
              </ProtectedRoute>
            }
          />
          <Route
            path="/financial-management"
            element={
              <ProtectedRoute>
                <LazyFinancialManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm"
            element={
              <ProtectedRoute>
                <LazyCustomerRelationshipManagement />
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
      </PresenceProvider>
    </AuthProvider>
  );
};

export default App;