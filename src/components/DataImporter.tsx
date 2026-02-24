import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2, ArrowRight, Table2, UserPlus, Download, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface ParsedRow {
  [key: string]: any;
}

interface ImportPreview {
  headers: string[];
  rows: ParsedRow[];
  type: 'loans' | 'repayments';
  matchedBorrowers: { [key: string]: string };
}

export const DataImporter: React.FC = () => {
  const { profile } = useAuth();
  const [officers, setOfficers] = useState<{id: string, full_name: string}[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; errors: string[]; createdBorrowers: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      fetchOfficers();
  }, []);

  const fetchOfficers = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'loan_officer')
        .eq('is_active', true);
      
      if (data) {
          setOfficers(data);
          if (profile?.role === 'loan_officer') {
              setSelectedOfficerId(profile.id);
          }
      }
  };

  const downloadTemplate = (type: 'loans' | 'repayments') => {
    const headers = type === 'loans' 
      ? [['Reference', 'Name', 'Phones', 'Occupation', 'Loan', 'Date Disbursed', 'Term', 'Interest']]
      : [['Borrower Name', 'Amount Paid', 'Payment Date (YYYY-MM-DD)']];
    
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `Janalo_${type}_Template.xlsx`);
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setPreview(null);
    setImportResults(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error('File appears to be empty or has no data rows');
        setIsProcessing(false);
        return;
      }

      const headers = (jsonData[0] as string[]).map(h => String(h).trim());
      const rows = jsonData.slice(1).map(row => {
        const obj: ParsedRow = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx];
        });
        return obj;
      });

      let type: 'loans' | 'repayments' = 'loans';
      if (headers.includes('Amount Paid') || headers.includes('Payment Date (YYYY-MM-DD)')) {
          type = 'repayments';
      }

      const borrowerNames = new Set<string>();
      const nameKey = type === 'loans' ? 'Name' : 'Borrower Name';
      
      rows.forEach(row => {
        if (row[nameKey]) {
          borrowerNames.add(String(row[nameKey]).trim());
        }
      });

      const matchedBorrowers: { [key: string]: string } = {};
      if (borrowerNames.size > 0) {
        const { data: borrowers } = await supabase
          .from('borrowers')
          .select('id, full_name');
        
        const nameMap = new Map(borrowers?.map(b => [b.full_name.toLowerCase(), b.id]));
        
        borrowerNames.forEach(name => {
            const id = nameMap.get(name.toLowerCase());
            if (id) matchedBorrowers[name] = id;
        });
      }

      setPreview({ headers, rows, type, matchedBorrowers });
      toast.success(`File parsed. Detected ${rows.length} records.`);
    } catch (error: any) {
      console.error('Parse error:', error);
      toast.error('Failed to parse file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!preview || !profile) return;
    if (!selectedOfficerId) {
        toast.error("Please select a Loan Officer to assign these records to.");
        return;
    }

    setIsImporting(true);
    const errors: string[] = [];
    let success = 0;
    let createdBorrowers = 0;
    const currentMatchedBorrowers = { ...preview.matchedBorrowers };

    try {
      // Pre-fetch existing references to prevent duplicates in this batch
      const { data: existingLoans } = await supabase.from('loans').select('reference_no');
      const existingRefs = new Set(existingLoans?.map(l => l.reference_no.toUpperCase()) || []);

      for (const row of preview.rows) {
        const nameKey = preview.type === 'loans' ? 'Name' : 'Borrower Name';
        const borrowerName = String(row[nameKey] || '').trim();
        if (!borrowerName) continue;

        let borrowerId = currentMatchedBorrowers[borrowerName];

        // Create borrower if they don't exist
        if (!borrowerId) {
          const { data: existing } = await supabase
            .from('borrowers')
            .select('id')
            .ilike('full_name', borrowerName)
            .maybeSingle();
          
          if (existing) {
              borrowerId = existing.id;
              currentMatchedBorrowers[borrowerName] = borrowerId;
          } else {
              const { data: newBorrower, error: createError } = await supabase
                .from('borrowers')
                .insert([{
                  full_name: borrowerName,
                  created_by: selectedOfficerId,
                  address: 'Imported Record',
                  phone: preview.type === 'loans' ? String(row['Phones'] || 'N/A') : 'N/A',
                  employment: preview.type === 'loans' ? String(row['Occupation'] || 'N/A') : 'N/A'
                }])
                .select()
                .single();

              if (createError) {
                errors.push(`Failed to create borrower "${borrowerName}": ${createError.message}`);
                continue;
              }

              borrowerId = newBorrower.id;
              currentMatchedBorrowers[borrowerName] = borrowerId;
              createdBorrowers++;
          }
        }

        if (preview.type === 'loans') {
          const ref = String(row['Reference'] || '').toUpperCase().trim();
          
          if (ref && existingRefs.has(ref)) {
              errors.push(`Skipped: Loan reference "${ref}" already exists in system.`);
              continue;
          }

          const principal = Number(row['Loan']) || 0;
          const rate = Number(row['Interest']) || 0;
          const term = Number(row['Term']) || 0;
          const interest = principal * (rate / 100) * term;
          const total = principal + interest;
          
          const finalRef = ref || `IMP-${Date.now().toString().slice(-6)}-${success}`;

          const { error } = await supabase.from('loans').insert([{
            reference_no: finalRef,
            borrower_id: borrowerId,
            officer_id: selectedOfficerId,
            principal_amount: principal,
            interest_rate: rate,
            term_months: term,
            disbursement_date: row['Date Disbursed'] || new Date().toISOString().split('T')[0],
            interest_type: 'flat',
            status: 'pending',
            principal_outstanding: principal,
            interest_outstanding: interest,
            total_payable: total,
            monthly_installment: total / (term || 1)
          }]);

          if (error) {
              errors.push(`Loan error for ${borrowerName}: ${error.message}`);
          } else {
              success++;
              if (ref) existingRefs.add(ref);
          }
        } else {
          // Repayment Import
          const { data: activeLoans } = await supabase
            .from('loans')
            .select('*')
            .eq('borrower_id', borrowerId)
            .eq('status', 'active')
            .limit(1);
          
          if (!activeLoans || activeLoans.length === 0) {
              errors.push(`No active loan for ${borrowerName}`);
              continue;
          }

          const loan = activeLoans[0];
          const amount = Number(row['Amount Paid']) || 0;
          
          const { error } = await supabase.from('repayments').insert([{
              loan_id: loan.id,
              amount_paid: amount,
              principal_paid: amount * 0.8, 
              interest_paid: amount * 0.2,
              payment_date: row['Payment Date (YYYY-MM-DD)'] || new Date().toISOString().split('T')[0],
              recorded_by: selectedOfficerId
          }]);

          if (error) errors.push(`Repayment error for ${borrowerName}: ${error.message}`);
          else success++;
        }
      }

      setImportResults({ success, errors, createdBorrowers });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={() => downloadTemplate('loans')}
            className="flex items-center justify-center gap-2 p-4 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all group"
          >
              <Download className="h-5 w-5 text-indigo-600 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                  <p className="text-sm font-bold text-gray-900">Loan Template</p>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Excel Format</p>
              </div>
          </button>
          <button 
            onClick={() => downloadTemplate('repayments')}
            className="flex items-center justify-center gap-2 p-4 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all group"
          >
              <Download className="h-5 w-5 text-green-600 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                  <p className="text-sm font-bold text-gray-900">Repayment Template</p>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Excel Format</p>
              </div>
          </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center">
              <UserCheck className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
              Assign Imported Data To Officer
          </label>
          <select 
            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
            value={selectedOfficerId}
            onChange={(e) => setSelectedOfficerId(e.target.value)}
          >
              <option value="">-- Select Target Loan Officer --</option>
              {officers.map(o => (
                  <option key={o.id} value={o.id}>{o.full_name}</option>
              ))}
          </select>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30 group"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center">
          <div className="p-4 bg-indigo-100 rounded-2xl mb-4 group-hover:bg-indigo-200 transition-colors">
            <Upload className="h-8 w-8 text-indigo-600" />
          </div>
          <p className="text-base font-bold text-gray-900">
            Upload Completed Template
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Drag & drop or click to select your Excel file
          </p>
        </div>
      </div>

      {isProcessing && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <span className="ml-3 text-sm font-bold text-gray-600 uppercase tracking-widest">Validating Data...</span>
        </div>
      )}

      {preview && !importResults && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 flex items-center">
                <Table2 className="h-4 w-4 mr-2 text-indigo-600" />
                Import Preview: {preview.type === 'loans' ? 'New Applications' : 'Bulk Repayments'}
              </h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">
                {preview.rows.length} records detected
              </p>
            </div>
            <button
              onClick={handleImport}
              disabled={isImporting || !selectedOfficerId}
              className="inline-flex items-center px-6 py-2.5 bg-indigo-900 hover:bg-indigo-800 disabled:bg-gray-300 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200"
            >
              {isImporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
              ) : (
                <><ArrowRight className="h-4 w-4 mr-2" /> Execute Import</>
              )}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {preview.headers.map((header, idx) => (
                    <th key={idx} className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.rows.slice(0, 10).map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
                    {preview.headers.map((header, colIdx) => {
                      const nameKey = preview.type === 'loans' ? 'Name' : 'Borrower Name';
                      const isNew = header === nameKey && !preview.matchedBorrowers[String(row[header] || '').trim()];
                      return (
                        <td key={colIdx} className="px-6 py-3 text-gray-700 whitespace-nowrap">
                          {String(row[header] ?? '')}
                          {isNew && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase">
                              <UserPlus className="h-2 w-2 mr-1" /> New Client
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importResults && (
        <div className={`rounded-2xl p-8 border shadow-sm animate-in zoom-in-95 duration-300 ${importResults.errors.length === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start">
            <div className={`p-3 rounded-xl mr-4 ${importResults.errors.length === 0 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                {importResults.errors.length === 0 ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-bold ${importResults.errors.length === 0 ? 'text-green-900' : 'text-amber-900'}`}>
                Import Process Complete
              </h3>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/50 p-3 rounded-xl border border-white/20">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Successful</p>
                    <p className="text-xl font-bold text-gray-900">{importResults.success}</p>
                </div>
                <div className="bg-white/50 p-3 rounded-xl border border-white/20">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">New Clients</p>
                    <p className="text-xl font-bold text-indigo-600">{importResults.createdBorrowers}</p>
                </div>
                <div className="bg-white/50 p-3 rounded-xl border border-white/20">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Failed</p>
                    <p className="text-xl font-bold text-red-600">{importResults.errors.length}</p>
                </div>
              </div>
              {importResults.errors.length > 0 && (
                  <div className="mt-4 p-4 bg-white/30 rounded-xl border border-white/20">
                      <p className="text-xs font-bold text-gray-700 uppercase mb-2">Error Log:</p>
                      <ul className="text-[10px] text-red-700 space-y-1 list-disc pl-4">
                          {importResults.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                          {importResults.errors.length > 5 && <li>...and {importResults.errors.length - 5} more errors</li>}
                      </ul>
                  </div>
              )}
              <button onClick={() => setImportResults(null)} className="mt-6 text-sm font-bold text-indigo-600 hover:underline">Import another file</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};