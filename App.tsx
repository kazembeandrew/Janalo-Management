import React, { PropsWithChildren } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, AuthRedirectHandler } from '@/context/AuthContext';
import { PresenceProvider } from '@/context/PresenceContext';
import { Layout } from '@/components/AppLayout';
import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary';
import { lazyLoad } from '@/utils/lazyLoad';

// Critical components - loaded immediately
import { Login } from '@/pages/Login';
import { ResetPassword } from '@/pages/ResetPassword';
import { Dashboard } from '@/pages/Dashboard';

// Lazy loaded heavy components
const LazyBorrowers = lazyLoad(() => import('@/pages/Borrowers'));
const LazyBorrowerDetails = lazyLoad(() => import('@/pages/BorrowerDetails'));
const LazyCreateLoan = lazyLoad(() => import('@/pages/CreateLoan'));
const LazyEditLoan = lazyLoad(() => import('@/pages/EditLoan'));
const LazyLoanDetails = lazyLoad(() => import('@/pages/LoanDetails'));
const LazyExpenses = lazyLoad(() => import('@/pages/Expenses'));
const LazyAuditLogs = lazyLoad(() => import('@/pages/AuditLogs'));
const LazyCollections = lazyLoad(() => import('@/pages/Collections'));
const LazyPerformance = lazyLoad(() => import('@/pages/Performance'));
const LazyProfile = lazyLoad(() => import('@/pages/Profile'));
const LazyClientMap = lazyLoad(() => import('@/pages/ClientMap'));
const LazyTasks = lazyLoad(() => import('@/pages/Tasks'));
const LazyRepayments = lazyLoad(() => import('@/pages/Repayments'));
const LazyAccounts = lazyLoad(() => import('@/pages/Accounts'));
const LazyLedger = lazyLoad(() => import('@/pages/Ledger'));
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
const LazyLoansManagement = lazyLoad(() => import('@/pages/LoansManagement'));
const LazyReporting = lazyLoad(() => import('@/pages/Reporting'));
const LazyAdministration = lazyLoad(() => import('@/pages/Administration'));
const LazyCommunication = lazyLoad(() => import('@/pages/Communication'));
const LazyTools = lazyLoad(() => import('@/pages/Tools'));
const LazyFinancial = lazyLoad(() => import('@/pages/financial').then(m => ({ default: m.FinancialRoutes })));
const LazyLoanEnhancements = lazyLoad(() => import('@/pages/LoanEnhancements'));
const LazyBusinessIntelligencePage = lazyLoad(() => import('@/pages/BusinessIntelligencePage'));
const LazyPayroll = lazyLoad(() => import('@/pages/Payroll'));
const LazyMyPayslips = lazyLoad(() => import('@/pages/MyPayslips'));
const LazyAccountStructureMap = lazyLoad(() => import('@/pages/AccountStructureMap'));
const LazyFundAllocations = lazyLoad(() => import('@/pages/FundAllocations'));
const LazyMyFieldFunds = lazyLoad(() => import('@/pages/MyFieldFunds'));
const LazyStaffExpenseClaims = lazyLoad(() => import('@/pages/StaffExpenseClaims').then(m => ({ default: m.StaffExpenseClaims })));

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
          <AuthRedirectHandler>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Legacy route redirects */}
              <Route path="/financial-management" element={<Navigate to="/financial" replace />} />
              <Route path="/user-management" element={<Navigate to="/users" replace />} />
              <Route path="/communications" element={<Navigate to="/messages" replace />} />
              <Route path="/reporting" element={<Navigate to="/reports" replace />} />
              <Route path="/tools" element={<Navigate to="/calculator" replace />} />
              <Route path="/my-field-funds" element={<Navigate to="/my-staff-funds" replace />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Dashboard" />}>
                      <Dashboard />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/borrowers"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Borrowers" />}>
                      <LazyBorrowers />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/borrowers/:id"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Borrower Details" />}>
                      <LazyBorrowerDetails />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/loans"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Loans" />}>
                      <LazyLoansManagement />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financial/*"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Financial Management" />}>
                      <LazyFinancial />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calculator"
                element={
                  <ProtectedRoute>
                    <LazyTools />
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
                    <LazyCommunication />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <LazyReporting />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute>
                    <LazyAdministration />
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
                path="/collections"
                element={
                  <ProtectedRoute>
                    <LazyCollections />
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
                path="/account-structure-map"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Account Structure Map" />}>
                      <LazyAccountStructureMap />
                    </ErrorBoundary>
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
                path="/budgets"
                element={
                  <ProtectedRoute>
                    <LazyBudgets />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fund-allocations"
                element={
                  <ProtectedRoute>
                    <LazyFundAllocations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-staff-funds"
                element={
                  <ProtectedRoute>
                    <LazyMyFieldFunds />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-expense-claims"
                element={
                  <ProtectedRoute>
                    <LazyStaffExpenseClaims />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ledger"
                element={
                  <ProtectedRoute>
                    <LazyLedger />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/loan-enhancements"
                element={
                  <ProtectedRoute>
                    <LazyLoanEnhancements />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/business-intelligence"
                element={
                  <ProtectedRoute>
                    <LazyBusinessIntelligencePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payroll"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Payroll" />}>
                      <LazyPayroll />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />

              {/* Missing routes */}
              <Route
                path="/tasks"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Tasks" />}>
                      <LazyTasks />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client-map"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Client Map" />}>
                      <LazyClientMap />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/repayments"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Repayments" />}>
                      <LazyRepayments />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/schedule"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Repayment Schedule" />}>
                      <LazyRepaymentSchedule />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Document Center" />}>
                      <LazyDocumentCenter />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/expenses"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Expenses" />}>
                      <LazyExpenses />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit-logs"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Audit Logs" />}>
                      <LazyAuditLogs />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/performance"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Performance" />}>
                      <LazyPerformance />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="System Settings" />}>
                      <LazySystemSettings />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/import"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="Import Data" />}>
                      <LazyImportData />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-payslips"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallback={<PageErrorFallback page="My Payslips" />}>
                      <LazyMyPayslips />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthRedirectHandler>
        </HashRouter>
      </PresenceProvider>
    </AuthProvider>
  );
};

export default App;
