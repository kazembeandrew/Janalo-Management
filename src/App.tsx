import React, { PropsWithChildren } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PresenceProvider } from '@/context/PresenceContext';
import { Layout } from '@/components/Layout';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Borrowers } from '@/pages/Borrowers';
import { BorrowerDetails } from '@/pages/BorrowerDetails';
import { Loans } from '@/pages/Loans';
import { CreateLoan } from '@/pages/CreateLoan';
import { EditLoan } from '@/pages/EditLoan';
import { LoanDetails } from '@/pages/LoanDetails';
import { Reports } from '@/pages/Reports';
import { Expenses } from '@/pages/Expenses';
import { Messages } from '@/pages/Messages';
import { Users } from '@/pages/Users';
import { AuditLogs } from '@/pages/AuditLogs';
import { Collections } from '@/pages/Collections';
import { Performance } from '@/pages/Performance';
import { Calculator } from '@/pages/Calculator';
import { Profile } from '@/pages/Profile';
import { ClientMap } from '@/pages/ClientMap';
import { Tasks } from '@/pages/Tasks';
import { Repayments } from '@/pages/Repayments';
import { Accounts } from '@/pages/Accounts';
import { FinancialStatements } from '@/pages/FinancialStatements';
import { Budgets } from '@/pages/Budgets';
import { RepaymentSchedule } from '@/pages/RepaymentSchedule';
import { SystemSettings } from '@/pages/SystemSettings';
import { ImportData } from '@/pages/ImportData';
import { DocumentCenter } from '@/pages/DocumentCenter';

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
                <Borrowers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/borrowers/:id"
            element={
              <ProtectedRoute>
                <BorrowerDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loans"
            element={
              <ProtectedRoute>
                <Loans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/repayments"
            element={
              <ProtectedRoute>
                <Repayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <RepaymentSchedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts"
            element={
              <ProtectedRoute>
                <Accounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/budgets"
            element={
              <ProtectedRoute>
                <Budgets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/statements"
            element={
              <ProtectedRoute>
                <FinancialStatements />
              </ProtectedRoute>
            }
          />
          <Route
            path="/collections"
            element={
              <ProtectedRoute>
                <Collections />
              </ProtectedRoute>
            }
          />
          <Route
            path="/performance"
            element={
              <ProtectedRoute>
                <Performance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calculator"
            element={
              <ProtectedRoute>
                <Calculator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <ClientMap />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loans/new"
            element={
              <ProtectedRoute>
                <CreateLoan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loans/edit/:id"
            element={
              <ProtectedRoute>
                <EditLoan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loans/:id"
            element={
              <ProtectedRoute>
                <LoanDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <Expenses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute>
                <AuditLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SystemSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/import"
            element={
              <ProtectedRoute>
                <ImportData />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <DocumentCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
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