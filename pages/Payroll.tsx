import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Users, DollarSign, Calculator, FileText, Plus, Edit, Play, CheckCircle, X, AlertCircle, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { payrollService } from '@/services/payroll';
import { payslipService } from '@/services/payslips';
import { accountsService } from '@/services/accounts';
import type { InternalAccount } from '@/types';

// ── Malawi PAYE calculation (MRA brackets) ──
function calculatePAYE(grossMonthly: number): { tax: number; breakdown: string } {
  if (grossMonthly <= 170000) {
    return { tax: 0, breakdown: 'Salary ≤ MWK 170,000 → No tax' };
  }
  
  let tax = 0;
  let breakdownArr: string[] = [];
  let remaining = grossMonthly;
  
  // Band 1: 0 - 170,000 (0%)
  const b1_limit = 170000;
  breakdownArr.push(`First 170,000 @ 0% = 0`);
  remaining -= b1_limit;
  
  // Band 2: Next 1,400,000 (up to 1,570,000) @ 30%
  if (remaining > 0) {
    const b2_limit = 1400000;
    const b2_taxable = Math.min(remaining, b2_limit);
    const b2_tax = b2_taxable * 0.30;
    tax += b2_tax;
    breakdownArr.push(`Next ${b2_taxable.toLocaleString()} @ 30% = MWK ${b2_tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    remaining -= b2_taxable;
  }
  
  // Band 3: Next 8,430,000 (up to 10,000,000) @ 35%
  if (remaining > 0) {
    const b3_limit = 8430000;
    const b3_taxable = Math.min(remaining, b3_limit);
    const b3_tax = b3_taxable * 0.35;
    tax += b3_tax;
    breakdownArr.push(`Next ${b3_taxable.toLocaleString()} @ 35% = MWK ${b3_tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    remaining -= b3_taxable;
  }
  
  // Band 4: Excess over 10,000,000 @ 40%
  if (remaining > 0) {
    const b4_tax = remaining * 0.40;
    tax += b4_tax;
    breakdownArr.push(`Excess ${remaining.toLocaleString()} @ 40% = MWK ${b4_tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }
  
  return { tax: Math.round(tax * 100) / 100, breakdown: breakdownArr.join('\n') };
}

type Employee = {
  id: string;
  user_id: string | null;
  full_name: string;
  employee_id: string;
  position: string;
  department: string;
  monthly_salary: number;
  employment_date: string;
  status: string;
  created_at: string;
};

type AppUser = {
  id: string;
  full_name: string | null;
  email: string;
  role: string | null;
};

type PayrollRecord = {
  id: string;
  employee_id: string;
  pay_period: string;
  gross_salary: number;
  paye_tax: number;
  net_salary: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  journal_entry_id?: string | null;
  payment_account_id?: string | null;
  accounting_status?: 'pending' | 'posted' | 'error';
  accounting_posted_at?: string | null;
  accounting_error_message?: string | null;
  employees?: { full_name: string; employee_id: string; position: string; department: string };
};

const POSITIONS = ['CEO', 'CFO', 'Admin', 'HR Manager', 'Accountant', 'Loan Officer', 'IT Officer', 'Driver', 'Cleaner', 'Security'];
const DEPARTMENTS = ['Executive', 'Finance', 'Administration', 'Human Resources', 'Operations', 'IT', 'Support'];

const fmt = (n: number) => `MWK ${n.toLocaleString('en-MW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatDateFull = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Settlement Journal Entries sub-component
const SettlementJournalTable = ({ period }: { period: string }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEntries = async () => {
      setLoading(true);
      try {
        const { data: records, error } = await supabase
          .from('payroll_records')
          .select('paye_remittance_journal_id, payment_journal_id, paye_remittance_status, paid_at')
          .eq('pay_period', period);
        
        if (error || !records) {
          setEntries([]);
          return;
        }

        // Collect all journal IDs from both PAYE remittances and salary payments
        const journalIds = [
          ...records.map(r => r.paye_remittance_journal_id).filter(Boolean),
          ...records.map(r => r.payment_journal_id).filter(Boolean)
        ];
        
        if (journalIds.length > 0) {
          const { data: journals, error: journalError } = await supabase
            .from('journal_entries')
            .select('id, entry_number, entry_date, description, status, created_at')
            .in('id', journalIds)
            .order('created_at', { ascending: false });
          
          if (!journalError && journals) {
            setEntries(journals);
          }
        } else {
          setEntries([]);
        }
      } catch (error) {
        console.error('Failed to load settlement journals:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadEntries();
  }, [period]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading settlement entries...</div>;
  }

  if (entries.length === 0) {
    return <div className="text-sm text-gray-500">No settlement journal entries recorded yet.</div>;
  }

  return (
    <Table
      data={entries}
      columns={[
        {
          key: 'entry_number',
          title: 'Entry #',
          render: (value) => <span className="font-mono font-semibold">{value}</span>
        },
        { key: 'entry_date', title: 'Date' },
        {
          key: 'description',
          title: 'Description',
          render: (value) => <span className="text-sm">{value}</span>
        },
        {
          key: 'status',
          title: 'Status',
          render: (value) => (
            <Badge variant={value === 'posted' ? 'success' : 'default'}>
              {value}
            </Badge>
          )
        },
        {
          key: 'created_at',
          title: 'Recorded At',
          render: (value) => new Date(value).toLocaleString()
        }
      ]}
      emptyMessage="No settlement entries"
    />
  );
};

const Payroll = () => {
  const { user, profile } = useAuth();
  const role = profile?.role || '';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'payroll' | 'settlement' | 'reports'>('dashboard');

  // Employee form
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState({
    user_id: '',
    employee_id: '',
    position: '',
    department: '',
    monthly_salary: '',
    employment_date: formatDateFull(new Date()),
    status: 'active',
  });

  // Payroll generation
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [payPeriod, setPayPeriod] = useState(formatDate(new Date()));
  const [generating, setGenerating] = useState(false);

  // Detail modal
  const [detailRecord, setDetailRecord] = useState<PayrollRecord | null>(null);
  
  // Accounting integration
  const [paymentAccounts, setPaymentAccounts] = useState<InternalAccount[]>([]);
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState<string>('');
  const [processingAccounting, setProcessingAccounting] = useState(false);

  // Settlement state
  const [settlementPeriod, setSettlementPeriod] = useState(formatDate(new Date()));
  const [settlementData, setSettlementData] = useState<{
    totalNet: number;
    totalPAYE: number;
    employeeCount: number;
    unpaidNet: number;
    unpaidCount: number;
    unremittedPAYE: number;
    allPaid: boolean;
    allRemitted: boolean;
  } | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlingPayment, setSettlingPayment] = useState(false);
  const [remittingTax, setRemittingTax] = useState(false);
  const [generatingPayslips, setGeneratingPayslips] = useState(false);

  const canManageEmployees = ['admin', 'ceo', 'hr', 'cfo'].includes(role);
  const canApprovePayroll = ['admin', 'ceo', 'cfo'].includes(role);
  const canViewPayroll = ['admin', 'ceo', 'cfo', 'hr', 'accountant'].includes(role);

  useEffect(() => { 
    fetchAll();
    fetchPaymentAccounts();
  }, []);
  
  async function fetchPaymentAccounts() {
    try {
      const result = await accountsService.getAccounts();
      if (result.data) {
        // Filter for cash/bank accounts only
        const cashAccounts = result.data.data.filter((acc: InternalAccount) => 
          acc.account_category === 'asset' ||
          acc.name.toLowerCase().includes('bank') ||
          acc.name.toLowerCase().includes('cash') ||
          acc.type?.toLowerCase().includes('bank') ||
          acc.type?.toLowerCase().includes('cash')
        );
        setPaymentAccounts(cashAccounts);
        
        // Set default to first bank account if available
        const bankAccount = cashAccounts.find((acc: InternalAccount) => 
          acc.name.toLowerCase().includes('main bank') ||
          acc.account_code === 'BANK' ||
          acc.code === 'BANK'
        );
        if (bankAccount) {
          setSelectedPaymentAccount(bankAccount.id);
        } else if (cashAccounts.length > 0) {
          setSelectedPaymentAccount(cashAccounts[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch payment accounts:', error);
    }
  }

  async function loadSettlementData(period: string) {
    setSettlementLoading(true);
    try {
      const { data: records, error } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('pay_period', period);
      
      if (error) throw error;
      if (!records || records.length === 0) {
        setSettlementData(null);
        return;
      }

      const safeNum = (val: any) => {
        if (val === null || val === undefined) return 0;
        const n = parseFloat(String(val));
        return isNaN(n) ? 0 : n;
      };

      const totalNet = records.reduce((s, r) => s + safeNum(r.net_salary), 0);
      const totalPAYE = records.reduce((s, r) => s + safeNum(r.paye_tax), 0);
      const unpaidRecords = records.filter((r: any) => r.status === 'approved' && !r.paid_at);
      const unpaidNet = unpaidRecords.reduce((s, r) => s + safeNum(r.net_salary), 0);
      const unremittedRecords = records.filter((r: any) => r.status === 'approved' && r.paye_remittance_status !== 'remitted');
      const unremittedPAYE = unremittedRecords.reduce((s, r) => s + safeNum(r.paye_tax), 0);
      
      // Avoid double counting PAYE across multiple records - handle NaN
      const uniquePAYE = (isNaN(unremittedPAYE) || isNaN(totalPAYE)) ? 0 : Math.min(unremittedPAYE, totalPAYE);

      setSettlementData({
        totalNet: safeNum(totalNet),
        totalPAYE: safeNum(totalPAYE),
        employeeCount: records.length,
        unpaidNet: safeNum(unpaidNet),
        unpaidCount: unpaidRecords.length,
        unremittedPAYE: safeNum(uniquePAYE),
        allPaid: unpaidRecords.length === 0,
        allRemitted: unremittedRecords.length === 0 || safeNum(uniquePAYE) === 0
      });
    } catch (error) {
      console.error('Failed to load settlement data:', error);
      toast.error('Failed to load settlement data');
    } finally {
      setSettlementLoading(false);
    }
  }

  async function handlePaySalaries() {
    if (!settlementData || !selectedPaymentAccount || settlementData.unpaidNet <= 0) {
      toast.error('No unpaid salaries to settle');
      return;
    }
    
    const confirm = window.confirm(
      `This will record payment of MWK ${settlementData.unpaidNet.toLocaleString()} to ${settlementData.unpaidCount} employee(s) from the selected account.\n\nThis will:\n• Debit LIAB_WAGES_PAYABLE (reduce liability)\n• Credit ${paymentAccounts.find(a => a.id === selectedPaymentAccount)?.name || 'selected account'} (reduce balance)\n• Auto-generate and deliver payslips to all employees\n\nProceed?`
    );
    if (!confirm) return;

    setSettlingPayment(true);
    try {
      const result = await payrollService.settlePayrollPayment(settlementPeriod, selectedPaymentAccount, user?.id);
      if (!result.success) throw new Error(result.error?.message);
      
      toast.success(`✅ Salaries paid! ${result.data.employeeCount} employees settled for MWK ${result.data.amount.toLocaleString()}`);
      
      // Generate and deliver payslips to all employees
      toast.loading('📄 Generating payslips for all employees...', { id: 'payslip-gen' });
      await generatePayslipsForPeriod(settlementPeriod);
      
      loadSettlementData(settlementPeriod);
      fetchAll();
    } catch (error: any) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setSettlingPayment(false);
    }
  }

  async function generatePayslipsForPeriod(payPeriod: string) {
    try {
      // Fetch all payroll records for this period that have been paid for ACTIVE employees only
      const { data: payrollRecords, error } = await supabase
        .from('payroll_records')
        .select(`
          id,
          employees!inner(status)
        `)
        .eq('pay_period', payPeriod)
        .eq('status', 'approved')
        .eq('employees.status', 'active')
        .not('paid_at', 'is', null);

      if (error) {
        console.error('Failed to fetch payroll records:', error);
        toast.dismiss('payslip-gen');
        return;
      }

      if (!payrollRecords || payrollRecords.length === 0) {
        console.warn('No paid payroll records found for this period for active employees');
        toast.dismiss('payslip-gen');
        return;
      }

      let successCount = 0;
      let failCount = 0;
      let skipCount = 0;

      for (const record of payrollRecords) {
        try {
          const result = await payslipService.generateAndDeliver(record.id);
          if (result.success) {
            if (result.data === true) {
              successCount++;
            } else if (result.data === false) {
              skipCount++;
              console.warn(`Skipped payslip for record ${record.id} - employee has no system user linked`);
            } else {
              failCount++;
              console.warn(`Failed to generate payslip for record ${record.id}`);
            }
          } else {
            failCount++;
            console.warn(`Failed to generate payslip for record ${record.id}: ${result.error?.message}`);
          }
        } catch (err) {
          failCount++;
          console.error(`Error generating payslip for record ${record.id}:`, err);
        }
      }

      toast.dismiss('payslip-gen');
      if (successCount > 0) {
        toast.success(`📧 Payslips delivered: ${successCount} employee(s)`);
      }
      if (skipCount > 0) {
        toast(`⚠️ ${skipCount} employee(s) have no system account - payslips not delivered. Link user accounts to enable delivery.`, {
          icon: '⚠️',
          style: {
            background: '#DBEAFE',
            border: '#3B82F6',
            color: '#1E40AF',
          },
        });
      }
      if (failCount > 0) {
        toast(`⚠️ Failed to deliver ${failCount} payslip(s). Check console for details.`, {
          icon: '⚠️',
          style: {
            background: '#FEF3C7',
            border: '#F59E0B',
            color: '#92400E',
          },
        });
      }
    } catch (error) {
      toast.dismiss('payslip-gen');
      console.error('Error in payslip generation batch:', error);
      toast.error('Failed to generate some payslips. Check console for details.');
    }
  }

  async function handleRemitPAYE() {
    if (!settlementData || !selectedPaymentAccount || !settlementData.unremittedPAYE || settlementData.unremittedPAYE <= 0) {
      toast.error('No PAYE tax to remit');
      return;
    }
    
    const confirm = window.confirm(
      `This will record PAYE tax remittance of MWK ${Math.round(settlementData.unremittedPAYE || 0).toLocaleString()} to MRA.\n\nThis will:\n• Debit LIAB_PAYE (reduce tax liability)\n• Credit ${paymentAccounts.find(a => a.id === selectedPaymentAccount)?.name || 'selected account'} (reduce balance)\n\nProceed?`
    );
    if (!confirm) return;

    setRemittingTax(true);
    try {
      const result = await payrollService.remitPAYETax(settlementPeriod, selectedPaymentAccount, user?.id);
      if (!result.success) throw new Error(result.error?.message);
      
      toast.success(`✅ PAYE remitted! MWK ${result.data.amount.toLocaleString()} sent to MRA`);
      loadSettlementData(settlementPeriod);
      fetchAll();
    } catch (error: any) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setRemittingTax(false);
    }
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const [empRes, payRes, usersRes] = await Promise.all([
        supabase.from('employees').select('*').order('full_name'),
        supabase.from('payroll_records').select('*, employees(full_name, employee_id, position, department)').order('created_at', { ascending: false }).limit(500),
        supabase.from('users').select('id, full_name, email, role').order('full_name'),
      ]);
      if (empRes.data) setEmployees(empRes.data as Employee[]);
      if (payRes.data) setPayrollRecords(payRes.data as PayrollRecord[]);
      if (usersRes.data) setAppUsers(usersRes.data as AppUser[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }

  // Users already linked to an employee
  const linkedUserIds = new Set(employees.map(e => e.user_id).filter(Boolean));

  // Available users for linking (not already an employee, unless editing this one)
  const availableUsers = appUsers.filter(u => {
    if (editingEmployee?.user_id === u.id) return true;
    return !linkedUserIds.has(u.id);
  });

  // ── Dashboard stats ──
  const activeEmployees = employees.filter(e => e.status === 'active');
  const currentPeriod = formatDate(new Date());
  const currentPayroll = payrollRecords.filter(p => p.pay_period === currentPeriod);
  const totalGross = currentPayroll.reduce((s, p) => s + Number(p.gross_salary), 0);
  const totalPAYE = currentPayroll.reduce((s, p) => s + Number(p.paye_tax), 0);
  const totalNet = currentPayroll.reduce((s, p) => s + Number(p.net_salary), 0);

  // Check if current period has accounting errors
  const hasAccountingErrors = useMemo(() => {
    return currentPayroll.some(r => r.accounting_status === 'error');
  }, [currentPayroll]);

  // ── Employee CRUD ──
  function openNewEmployee() {
    setEditingEmployee(null);
    setEmpForm({ user_id: '', employee_id: '', position: '', department: '', monthly_salary: '', employment_date: formatDateFull(new Date()), status: 'active' });
    setEmpModalOpen(true);
  }

  function openEditEmployee(emp: Employee) {
    setEditingEmployee(emp);
    setEmpForm({
      user_id: emp.user_id || '',
      employee_id: emp.employee_id,
      position: emp.position,
      department: emp.department,
      monthly_salary: String(emp.monthly_salary),
      employment_date: emp.employment_date,
      status: emp.status,
    });
    setEmpModalOpen(true);
  }

  async function saveEmployee() {
    const salary = parseFloat(empForm.monthly_salary);
    if (!empForm.user_id || !empForm.employee_id || !empForm.position || !empForm.department || isNaN(salary)) {
      toast.error('All fields are required. You must select an app user.');
      return;
    }

    const selectedUser = appUsers.find(u => u.id === empForm.user_id);
    const payload = {
      user_id: empForm.user_id,
      full_name: selectedUser?.full_name || selectedUser?.email || '',
      employee_id: empForm.employee_id,
      position: empForm.position,
      department: empForm.department,
      monthly_salary: salary,
      employment_date: empForm.employment_date,
      status: empForm.status,
      created_by: user?.id,
    };

    try {
      let error;
      if (editingEmployee) {
        ({ error } = await supabase.from('employees').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingEmployee.id));
      } else {
        ({ error } = await supabase.from('employees').insert(payload));
      }
      if (error) throw error;
      
      toast.success(editingEmployee ? 'Employee Updated' : 'Employee Added');
      setEmpModalOpen(false);
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save employee');
    }
  }

  // ── Payroll generation ──
  async function generatePayroll() {
    setGenerating(true);
    const active = employees.filter(e => e.status === 'active');
    if (!active.length) {
      toast.error('No active employees');
      setGenerating(false);
      return;
    }
    const records = active.map(emp => {
      const gross = Number(emp.monthly_salary);
      const { tax: paye } = calculatePAYE(gross);
      return {
        employee_id: emp.id,
        pay_period: payPeriod,
        gross_salary: gross,
        paye_tax: paye,
        net_salary: gross - paye,
        status: 'pending',
        created_by: user?.id,
      };
    });

    try {
      const { error } = await supabase.from('payroll_records').upsert(records, { onConflict: 'employee_id,pay_period' });
      if (error) throw error;
      
      toast.success(`Payroll Generated: ${records.length} records for ${payPeriod}`);
      setGenModalOpen(false);
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate payroll');
    } finally {
      setGenerating(false);
    }
  }

  // ── Approve payroll ──
  async function approvePayroll(id: string) {
    try {
      // First, update status to approved
      const { error } = await supabase.from('payroll_records').update({ 
        status: 'approved', 
        approved_by: user?.id, 
        approved_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      }).eq('id', id);
      if (error) throw error;
      
      toast.success('Payroll Approved');
      
      // Check if this was the last pending record for the period
      const record = payrollRecords.find(r => r.id === id);
      if (record) {
        const periodRecords = payrollRecords.filter(r => r.pay_period === record.pay_period);
        const allApproved = periodRecords.every(r => r.id === id ? true : r.status === 'approved');
        const anyPosted = periodRecords.some(r => r.accounting_status === 'posted');
        
        if (allApproved && !anyPosted) {
          const autoPost = window.confirm(`All records for ${record.pay_period} are now approved. Would you like to post to the General Ledger now?`);
          if (autoPost) {
            await approvePayrollPeriodWithAccounting(record.pay_period);
          }
        }
      }
      
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve payroll');
    }
  }
  
  /**
   * Approve entire payroll period and create accounting journal entry
   */
  async function approvePayrollPeriodWithAccounting(period: string) {
    if (!selectedPaymentAccount) {
      toast.error('Please select a payment account first');
      return;
    }
    
    setProcessingAccounting(true);
    
    try {
      // 1. Approve all pending records for this period
      const { error: approveError } = await supabase.from('payroll_records').update({ 
        status: 'approved', 
        approved_by: user?.id, 
        approved_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      }).eq('pay_period', period).eq('status', 'pending');
      
      if (approveError) throw approveError;
      
      // 2. Create accounting journal entry
      const result = await payrollService.approvePayrollWithAccounting(
        period,
        selectedPaymentAccount,
        user?.id || ''
      );
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to create accounting entries');
      }
      
      toast.success(`✅ Payroll approved and posted to ledger! Journal entry created for ${period}`);
      fetchAll();
      
    } catch (error: any) {
      console.error('Payroll accounting integration failed:', error);
      toast.error(`❌ ${error.message || 'Failed to process payroll accounting'}`);
    } finally {
      setProcessingAccounting(false);
    }
  }

  async function approveAllPending(period: string) {
    if (!selectedPaymentAccount) {
      toast.error('Please select a payment account in the Accounting Integration section above.');
      return;
    }
    
    const confirm = window.confirm(`This will approve all records for ${period} and post them to the General Ledger. Proceed?`);
    if (!confirm) return;

    await approvePayrollPeriodWithAccounting(period);
  }

  // ── Reports data ──
  const payrollByPeriod = useMemo(() => {
    const map: Record<string, { gross: number; paye: number; net: number; count: number }> = {};
    payrollRecords.forEach(p => {
      if (!map[p.pay_period]) map[p.pay_period] = { gross: 0, paye: 0, net: 0, count: 0 };
      map[p.pay_period].gross += Number(p.gross_salary);
      map[p.pay_period].paye += Number(p.paye_tax);
      map[p.pay_period].net += Number(p.net_salary);
      map[p.pay_period].count++;
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [payrollRecords]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="page-header-title">Payroll & Tax</h1>
          <p className="text-sm text-gray-500 mt-1">Malawi PAYE compliant payroll processing & MRA reporting</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {canManageEmployees && (
            <Button onClick={openNewEmployee} size="sm" className="rounded-xl shadow-lg shadow-indigo-100 font-bold bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95">
              <Plus className="h-4 w-4 mr-2" /> Add Employee
            </Button>
          )}
          {canViewPayroll && (
            <Button onClick={() => setGenModalOpen(true)} variant="outline" size="sm" className="rounded-xl shadow-sm font-bold border-gray-200 hover:bg-gray-50 transition-all active:scale-95">
              <Play className="h-4 w-4 mr-2 text-emerald-500 fill-emerald-500" /> Generate Payroll
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-100/50 backdrop-blur-sm p-1 rounded-xl inline-flex self-start border border-gray-200 shadow-sm">
        {(['dashboard', 'employees', 'payroll', 'settlement', 'reports'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); if (tab === 'settlement') loadSettlementData(settlementPeriod); }}
              className={`px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all duration-200 flex items-center ${
                activeTab === tab 
                  ? 'bg-white text-indigo-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'
              }`}
            >
              {tab === 'dashboard' && <Calculator className="h-3.5 w-3.5 mr-2" />}
              {tab === 'employees' && <Users className="h-3.5 w-3.5 mr-2" />}
              {tab === 'payroll' && <DollarSign className="h-3.5 w-3.5 mr-2" />}
              {tab === 'settlement' && <CheckCircle className="h-3.5 w-3.5 mr-2" />}
              {tab === 'reports' && <FileText className="h-3.5 w-3.5 mr-2" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
        ))}
      </div>

      {/* ══════════ DASHBOARD ══════════ */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="p-6">
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{activeEmployees.length}</p>
                <p className="text-xs text-gray-500 mt-1">Active employees</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <p className="text-sm font-medium text-gray-600">Total Payroll</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{fmt(totalGross)}</p>
                <p className="text-xs text-gray-500 mt-1">Gross salaries this month</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <p className="text-sm font-medium text-gray-600">PAYE to MRA</p>
                <p className="text-2xl font-bold text-red-600 mt-2">{fmt(totalPAYE)}</p>
                <p className="text-xs text-gray-500 mt-1">Tax to remit to Malawi Revenue Authority</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <p className="text-sm font-medium text-gray-600">Net Salaries</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{fmt(totalNet)}</p>
                <p className="text-xs text-gray-500 mt-1">Take-home pay this month</p>
              </div>
            </Card>
          </div>

          {/* PAYE Brackets Reference */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Malawi PAYE Tax Brackets (MRA)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Income Band</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Max Tax in Band</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    <tr>
                      <td className="px-6 py-4 text-sm text-gray-900">First MWK 170,000</td>
                      <td className="px-6 py-4 text-sm text-gray-900">0%</td>
                      <td className="px-6 py-4 text-sm text-gray-900">MWK 0</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm text-gray-900">MWK 170,001 – 1,570,000</td>
                      <td className="px-6 py-4 text-sm text-gray-900">30%</td>
                      <td className="px-6 py-4 text-sm text-gray-900">MWK 420,000</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm text-gray-900">MWK 1,570,001 – 10,000,000</td>
                      <td className="px-6 py-4 text-sm text-gray-900">35%</td>
                      <td className="px-6 py-4 text-sm text-gray-900">MWK 2,950,500</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm text-gray-900">Above MWK 10,000,000</td>
                      <td className="px-6 py-4 text-sm text-gray-900">40%</td>
                      <td className="px-6 py-4 text-sm text-gray-900">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════ EMPLOYEES ══════════ */}
      {activeTab === 'employees' && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Employee Register</h3>
            <p className="text-sm text-gray-600 mb-4">Employees must be registered app users first. Select a user when adding an employee.</p>
            <Table
              data={employees}
              columns={[
                { key: 'employee_id', title: 'Employee ID' },
                { key: 'full_name', title: 'Full Name' },
                { key: 'position', title: 'Position' },
                { key: 'department', title: 'Department' },
                {
                  key: 'monthly_salary',
                  title: 'Monthly Salary',
                  align: 'right',
                  render: (value) => fmt(Number(value))
                },
                {
                  key: 'status',
                  title: 'Status',
                  render: (value) => (
                    <Badge variant={value === 'active' ? 'success' : 'secondary'}>
                      {value}
                    </Badge>
                  )
                },
                { key: 'employment_date', title: 'Hired' },
                ...(canManageEmployees ? [{
                  key: 'actions',
                  title: 'Actions',
                  render: (value: any, row: Employee) => (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => openEditEmployee(row)}
                        size="sm"
                        variant="outline"
                        className="text-xs px-2 py-1"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  )
                }] : [])
              ]}
              emptyMessage="No employees yet. Add employees by selecting from registered app users."
            />
          </div>
        </Card>
      )}

      {/* ══════════ PAYROLL ══════════ */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Accounting Integration Controls */}
          {canApprovePayroll && (
            <Card className="border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white">
              <div className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Calculator className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">Payroll Accounting Integration</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Approve payroll and automatically create journal entries for accounting
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="payment-account" className="text-sm font-medium text-gray-700 mb-2 block">
                      Payment Account (Source of Funds)
                    </Label>
                    <select 
                      id="payment-account"
                      value={selectedPaymentAccount} 
                      onChange={(e) => setSelectedPaymentAccount(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      disabled={processingAccounting}
                    >
                      <option value="">Select bank or cash account</option>
                      {paymentAccounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.account_code || account.code})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      This account will be credited when salaries are paid
                    </p>
                  </div>

                  <div className="flex items-end gap-2">
                    {hasAccountingErrors ? (
                       <Button 
                       onClick={() => approvePayrollPeriodWithAccounting(currentPeriod)}
                       disabled={!selectedPaymentAccount || processingAccounting}
                       size="lg"
                       className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-lg"
                     >
                       {processingAccounting ? (
                         <>
                           <div className="animate-spin rounded-full h-4 w-4 border-2 border-white mr-2"></div>
                           Retrying...
                         </>
                       ) : (
                         <>
                           <AlertCircle className="h-5 w-5 mr-2" />
                           Retry Posting ({currentPeriod})
                         </>
                       )}
                     </Button>
                    ) : (
                      <Button 
                        onClick={() => approvePayrollPeriodWithAccounting(currentPeriod)}
                        disabled={!selectedPaymentAccount || processingAccounting || !currentPayroll.some(p => p.status === 'pending')}
                        size="lg"
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg"
                      >
                        {processingAccounting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-5 w-5 mr-2" />
                            Approve & Post to Ledger ({currentPeriod})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">This will:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                        <li>Approve all pending payroll records for {currentPeriod}</li>
                        <li>Create journal entry: Debit EXP_SALARIES, Credit LIAB_PAYE, Credit LIAB_WAGES_PAYABLE</li>
                        <li>Update financial statements automatically</li>
                        {hasAccountingErrors && <li className="text-orange-700 font-medium">Retry failed accounting entries</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
          
          {/* Payroll Records Table */}
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Payroll Records</h3>
                {!canApprovePayroll && currentPayroll.some(p => p.status === 'pending') && (
                  <Badge variant="default">Pending Approval</Badge>
                )}
              </div>
              <Table
                data={payrollRecords}
                columns={[
                  { key: 'pay_period', title: 'Period' },
                  {
                    key: 'employees',
                    title: 'Employee',
                    render: (value, row) => row.employees?.full_name || '—'
                  },
                  {
                    key: 'employees',
                    title: 'Position',
                    render: (value, row) => row.employees?.position || '—'
                  },
                  {
                    key: 'gross_salary',
                    title: 'Gross',
                    align: 'right',
                    render: (value) => fmt(Number(value))
                  },
                  {
                    key: 'paye_tax',
                    title: 'PAYE',
                    align: 'right',
                    render: (value) => <span className="text-red-600">{fmt(Number(value))}</span>
                  },
                  {
                    key: 'net_salary',
                    title: 'Net',
                    align: 'right',
                    render: (value) => <span className="font-semibold">{fmt(Number(value))}</span>
                  },
                  {
                    key: 'status',
                    title: 'Status',
                    render: (value) => (
                      <Badge variant={value === 'approved' ? 'success' : value === 'paid' ? 'secondary' : 'default'}>
                        {value}
                      </Badge>
                    )
                  },
                  {
                    key: 'accounting_status',
                    title: 'Accounting',
                    render: (value, row) => {
                      const status = row.accounting_status || 'pending';
                      const isPosted = status === 'posted';
                      const isError = status === 'error';
                      
                      if (isPosted) {
                        return (
                          <div className="flex flex-col">
                            <Badge variant="success" className="bg-green-100 text-green-800 w-fit">✓ Posted</Badge>
                            {row.journal_entry_id && (
                              <span className="text-[9px] text-gray-500 mt-0.5 truncate max-w-[80px]">
                                Ref: {row.journal_entry_id.substring(0, 8)}...
                              </span>
                            )}
                          </div>
                        );
                      }
                      
                      if (isError) {
                        return (
                          <div className="flex flex-col">
                            <Badge variant="error" className="w-fit">⚠ Error</Badge>
                            <span className="text-[9px] text-red-500 mt-0.5 truncate max-w-[80px]">
                              {row.accounting_error_message}
                            </span>
                          </div>
                        );
                      }
                      
                      return <Badge variant="secondary" className="text-gray-500 w-fit">Pending</Badge>;
                    }
                  },

                ]}
                onRowClick={(row) => setDetailRecord(row as PayrollRecord)}
                emptyMessage="No payroll records yet. Generate payroll to get started."
              />
            </div>
          </Card>
        </div>
      )}

      {/* ══════════ SETTLEMENT ══════════ */}
      {activeTab === 'settlement' && (
        <div className="space-y-6">
          {/* Settlement Period Selector */}
          <Card className="border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white">
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Payroll Settlement</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Record actual payments to employees and PAYE tax remittance to MRA
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="settlement-period" className="text-sm font-medium text-gray-700 mb-2 block">
                    Settlement Period
                  </Label>
                  <input 
                    id="settlement-period"
                    type="month"
                    value={settlementPeriod}
                    onChange={(e) => { setSettlementPeriod(e.target.value); loadSettlementData(e.target.value); }}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="settlement-source" className="text-sm font-medium text-gray-700 mb-2 block">
                    Payment Source Account
                  </Label>
                  <select 
                    id="settlement-source"
                    value={selectedPaymentAccount} 
                    onChange={(e) => setSelectedPaymentAccount(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">Select bank or cash account</option>
                    {paymentAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.account_code || account.code}) - MWK {account.balance?.toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Account balance will decrease when payments are recorded</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Settlement Status Cards */}
          {settlementLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : settlementData ? (
            <>
              {/* Status Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <div className="p-6">
                    <p className="text-sm font-medium text-gray-600">Total Employees</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{settlementData.employeeCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Records for {settlementPeriod}</p>
                  </div>
                </Card>
                <Card>
                  <div className="p-6">
                    <p className="text-sm font-medium text-gray-600">Net Salaries Owed</p>
                    <p className="text-2xl font-bold text-orange-600 mt-2">{fmt(settlementData.unpaidNet)}</p>
                    <p className="text-xs text-gray-500 mt-1">{settlementData.unpaidCount} employee(s) unpaid</p>
                  </div>
                </Card>
                <Card>
                  <div className="p-6">
                    <p className="text-sm font-medium text-gray-600">PAYE to MRA</p>
                    <p className="text-2xl font-bold text-red-600 mt-2">{fmt(settlementData.unremittedPAYE)}</p>
                    <p className="text-xs text-gray-500 mt-1">Tax to remit to Malawi Revenue Authority</p>
                  </div>
                </Card>
                <Card>
                  <div className="p-6">
                    <p className="text-sm font-medium text-gray-600">Settlement Status</p>
                    <div className="flex items-center gap-2 mt-2">
                      {settlementData.allPaid && settlementData.allRemitted ? (
                        <Badge variant="success">✓ Fully Settled</Badge>
                      ) : (
                        <Badge variant="default">Pending</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {settlementData.allPaid ? 'Salaries paid' : `${settlementData.unpaidCount} unpaid`} · {settlementData.allRemitted ? 'PAYE remitted' : 'PAYE pending'}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Action Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pay Salaries Card */}
                <Card className={`border-2 ${settlementData.allPaid ? 'border-green-200 bg-green-50/50' : 'border-orange-200 bg-orange-50/30'}`}>
                  <div className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`p-2 rounded-lg ${settlementData.allPaid ? 'bg-green-100' : 'bg-orange-100'}`}>
                        <Users className={`h-5 w-5 ${settlementData.allPaid ? 'text-green-600' : 'text-orange-600'}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">Pay Employee Salaries</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Record payment of net salaries to employees from {selectedPaymentAccount ? paymentAccounts.find(a => a.id === selectedPaymentAccount)?.name : 'selected account'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-white/70 rounded-lg p-4 mb-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Unpaid Employees:</span>
                        <span className="font-semibold">{settlementData.unpaidCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Net Salaries:</span>
                        <span className="font-semibold">{fmt(settlementData.unpaidNet)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Source Account:</span>
                        <span className="font-semibold">{paymentAccounts.find(a => a.id === selectedPaymentAccount)?.name || 'Not selected'}</span>
                      </div>
                      {settlementData.allPaid && (
                        <>
                          <div className="flex items-center gap-2 text-green-700 text-sm pt-2 border-t border-green-200">
                            <CheckCircle className="h-4 w-4" />
                            <span>All salaries have been paid</span>
                          </div>
                          <button
                            onClick={() => {
                              setGeneratingPayslips(true);
                              generatePayslipsForPeriod(settlementPeriod).finally(() => setGeneratingPayslips(false));
                            }}
                            disabled={generatingPayslips}
                            className="mt-3 w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                          >
                            {generatingPayslips ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white"></div>
                                Generating...
                              </>
                            ) : (
                              <>
                                <FileText className="h-4 w-4" />
                                Regenerate Payslips
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                    
                    <Button 
                      onClick={handlePaySalaries}
                      disabled={!selectedPaymentAccount || settlingPayment || settlementData.unpaidNet <= 0}
                      size="lg"
                      className={`w-full ${settlementData.allPaid ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'} text-white font-semibold`}
                    >
                      {settlingPayment ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : settlementData.allPaid ? (
                        <>
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Salaries Paid ✓
                        </>
                      ) : (
                        <>
                          <Users className="h-5 w-5 mr-2" />
                          Pay Salaries (MWK {settlementData.unpaidNet.toLocaleString()})
                        </>
                      )}
                    </Button>
                    
                    {!settlementData.allPaid && (
                      <div className="mt-3 text-xs text-gray-500">
                        <p className="font-medium">This will create a journal entry:</p>
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          <li>Debit: LIAB_WAGES_PAYABLE (reduce liability)</li>
                          <li>Credit: {paymentAccounts.find(a => a.id === selectedPaymentAccount)?.name || 'selected account'} (reduce balance)</li>
                          <li>Auto-generate and deliver payslips to all employees</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Remit PAYE Card */}
                <Card className={`border-2 ${settlementData.allRemitted ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/30'}`}>
                  <div className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`p-2 rounded-lg ${settlementData.allRemitted ? 'bg-green-100' : 'bg-red-100'}`}>
                        <FileText className={`h-5 w-5 ${settlementData.allRemitted ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">Remit PAYE Tax to MRA</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Record PAYE tax payment to Malawi Revenue Authority
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-white/70 rounded-lg p-4 mb-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total PAYE Deducted:</span>
                        <span className="font-semibold">{fmt(settlementData.totalPAYE)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Unremitted PAYE:</span>
                        <span className="font-semibold text-red-600">{fmt(settlementData.unremittedPAYE)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Source Account:</span>
                        <span className="font-semibold">{paymentAccounts.find(a => a.id === selectedPaymentAccount)?.name || 'Not selected'}</span>
                      </div>
                      {settlementData.allRemitted && (
                        <div className="flex items-center gap-2 text-green-700 text-sm pt-2 border-t border-green-200">
                          <CheckCircle className="h-4 w-4" />
                          <span>PAYE tax has been remitted</span>
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      onClick={handleRemitPAYE}
                      disabled={!selectedPaymentAccount || remittingTax || !(settlementData?.unremittedPAYE > 0)}
                      size="lg"
                      className={`w-full ${settlementData?.allRemitted ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white font-semibold`}
                    >
                      {remittingTax ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : settlementData?.allRemitted ? (
                        <>
                          <CheckCircle className="h-5 w-5 mr-2" />
                          PAYE Remitted ✓
                        </>
                      ) : (
                        <>
                          <FileText className="h-5 w-5 mr-2" />
                          Remit PAYE (MWK {Math.round(settlementData?.unremittedPAYE || 0).toLocaleString()})
                        </>
                      )}
                    </Button>
                    
                    {!settlementData.allRemitted && (
                      <div className="mt-3 text-xs text-gray-500">
                        <p className="font-medium">This will create a journal entry:</p>
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          <li>Debit: LIAB_PAYE (reduce tax liability)</li>
                          <li>Credit: {paymentAccounts.find(a => a.id === selectedPaymentAccount)?.name || 'selected account'} (reduce balance)</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Settlement Journal Entries History */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Settlement Journal Entries for {settlementPeriod}</h3>
                  <SettlementJournalTable period={settlementPeriod} />
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No payroll records found for {settlementPeriod}</p>
                <p className="text-sm text-gray-400 mt-1">Generate and approve payroll first, then settle payments here</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══════════ REPORTS ══════════ */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Payroll Summary</h3>
              <Table
                data={payrollByPeriod.map(([period, data]) => ({ period, ...data }))}
                columns={[
                  { key: 'period', title: 'Period' },
                  { key: 'count', title: 'Employees', align: 'right' },
                  {
                    key: 'gross',
                    title: 'Total Gross',
                    align: 'right',
                    render: (value) => fmt(Number(value))
                  },
                  {
                    key: 'paye',
                    title: 'Total PAYE',
                    align: 'right',
                    render: (value) => <span className="text-red-600">{fmt(Number(value))}</span>
                  },
                  {
                    key: 'net',
                    title: 'Total Net',
                    align: 'right',
                    render: (value) => <span className="font-semibold">{fmt(Number(value))}</span>
                  },
                ]}
                emptyMessage="No payroll data"
              />
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">PAYE Tax Summary for MRA</h3>
              <p className="text-sm text-gray-600 mb-4">Summary of PAYE deductions to remit to Malawi Revenue Authority</p>
              <Table
                data={payrollByPeriod.map(([period, data]) => ({ 
                  period, 
                  ...data,
                  effectiveRate: data.gross > 0 ? ((data.paye / data.gross) * 100).toFixed(1) : '0.0'
                }))}
                columns={[
                  { key: 'period', title: 'Period' },
                  {
                    key: 'gross',
                    title: 'Total Taxable Income',
                    align: 'right',
                    render: (value) => fmt(Number(value))
                  },
                  {
                    key: 'paye',
                    title: 'Total PAYE Deducted',
                    align: 'right',
                    render: (value) => <span className="text-red-600 font-semibold">{fmt(Number(value))}</span>
                  },
                  {
                    key: 'effectiveRate',
                    title: 'Effective Rate',
                    align: 'right',
                    render: (value) => `${value}%`
                  },
                ]}
                emptyMessage="No payroll data"
              />
            </div>
          </Card>
        </div>
      )}

      {/* ══════════ EMPLOYEE MODAL ══════════ */}
      <Modal
        isOpen={empModalOpen}
        onClose={() => setEmpModalOpen(false)}
        title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
        size="md"
      >
        <div className="p-6 space-y-4">
          <div>
            <Label>App User *</Label>
            <select
              value={empForm.user_id}
              onChange={(e) => setEmpForm(f => ({ ...f, user_id: e.target.value }))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm mt-1"
            >
              <option value="">Select a registered user</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email} {u.role ? `(${u.role})` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Employee must be a registered user of this system first.</p>
          </div>
          
          <div>
            <Label>Employee ID</Label>
            <Input
              value={empForm.employee_id}
              onChange={(e) => setEmpForm(f => ({ ...f, employee_id: e.target.value }))}
              placeholder="e.g. JN-001"
            />
          </div>
          
          <div>
            <Label>Position</Label>
            <select
              value={empForm.position}
              onChange={(e) => setEmpForm(f => ({ ...f, position: e.target.value }))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm mt-1"
            >
              <option value="">Select position</option>
              {POSITIONS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          
          <div>
            <Label>Department</Label>
            <select
              value={empForm.department}
              onChange={(e) => setEmpForm(f => ({ ...f, department: e.target.value }))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm mt-1"
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          
          <div>
            <Label>Monthly Salary (MWK)</Label>
            <Input
              type="number"
              value={empForm.monthly_salary}
              onChange={(e) => setEmpForm(f => ({ ...f, monthly_salary: e.target.value }))}
            />
          </div>
          
          <div>
            <Label>Employment Date</Label>
            <Input
              type="date"
              value={empForm.employment_date}
              onChange={(e) => setEmpForm(f => ({ ...f, employment_date: e.target.value }))}
            />
          </div>
          
          <div>
            <Label>Status</Label>
            <select
              value={empForm.status}
              onChange={(e) => setEmpForm(f => ({ ...f, status: e.target.value }))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm mt-1"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setEmpModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEmployee}>
              {editingEmployee ? 'Update' : 'Add'} Employee
            </Button>
          </div>
        </div>
      </Modal>

      {/* ══════════ GENERATE PAYROLL MODAL ══════════ */}
      <Modal
        isOpen={genModalOpen}
        onClose={() => setGenModalOpen(false)}
        title="Generate Monthly Payroll"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <div>
            <Label>Pay Period</Label>
            <Input
              type="month"
              value={payPeriod}
              onChange={(e) => setPayPeriod(e.target.value)}
            />
          </div>
          <p className="text-sm text-gray-600">
            This will generate payroll for all <strong>{activeEmployees.length}</strong> active employees with automatic PAYE calculation per MRA brackets.
          </p>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setGenModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={generatePayroll} disabled={generating}>
              {generating ? 'Generating...' : 'Generate Payroll'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ══════════ SALARY BREAKDOWN MODAL ══════════ */}
      <Modal
        isOpen={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        title="Salary Breakdown"
        size="md"
      >
        {detailRecord && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-600">Employee:</span>
              <span className="font-medium">{detailRecord.employees?.full_name}</span>
              <span className="text-gray-600">ID:</span>
              <span className="font-mono">{detailRecord.employees?.employee_id}</span>
              <span className="text-gray-600">Position:</span>
              <span>{detailRecord.employees?.position}</span>
              <span className="text-gray-600">Department:</span>
              <span>{detailRecord.employees?.department}</span>
              <span className="text-gray-600">Period:</span>
              <span className="font-mono">{detailRecord.pay_period}</span>
            </div>
            
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Gross Salary</span>
                <span className="font-semibold">{fmt(Number(detailRecord.gross_salary))}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>PAYE Tax (MRA)</span>
                <span className="font-semibold">- {fmt(Number(detailRecord.paye_tax))}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-lg">
                <span className="font-bold">Net Salary</span>
                <span className="font-bold">{fmt(Number(detailRecord.net_salary))}</span>
              </div>
            </div>
            
            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
              <p className="font-medium mb-1">PAYE Calculation:</p>
              <pre className="whitespace-pre-wrap font-mono">
                {calculatePAYE(Number(detailRecord.gross_salary)).breakdown}
              </pre>
            </div>
            
            <Badge variant={detailRecord.status === 'approved' ? 'success' : 'default'}>
              {detailRecord.status}
            </Badge>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Payroll;