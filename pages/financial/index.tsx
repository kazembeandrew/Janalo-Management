import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Disbursement } from './Disbursement';
import { Repayment } from './Repayment';
import { WriteOff } from './WriteOff';
import { Analytics } from './Analytics';
import { Compliance } from './Compliance';
import { FinancialManagement } from './FinancialManagement';
import { FinancialStatements } from '../FinancialStatements';

export const FinancialRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<FinancialManagement />} />
      <Route path="/disbursement" element={<Disbursement />} />
      <Route path="/repayment" element={<Repayment />} />
      <Route path="/write-off" element={<WriteOff />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/compliance" element={<Compliance />} />
      <Route path="/statements" element={<FinancialStatements />} />
    </Routes>
  );
};