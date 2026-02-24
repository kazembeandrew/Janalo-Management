import React, { useState, useRef, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { analyzeImportData, ImportMapping } from '@/services/importService';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2, ArrowRight, Table2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

interface ParsedRow {
  [key: string]: any;
}

interface ImportPreview {
  headers: string[];
  rows: ParsedRow[];
  detectedType: 'loans' | 'repayments' | 'unknown';
  mappings: ImportMapping;
  matchedBorrowers: { [key: string]: string };
}

export const DataImporter: React.FC = () => {
  const { profile } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; errors: string[]; createdBorrowers: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
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

      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1).map(row => {
        const obj: ParsedRow = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx];
        });
        return obj;
      });

      // AI-assisted header mapping
      const mappings = await analyzeImportData(headers);
      
      // Match borrower names to existing records
      const borrowerNames = new Set<string>();
      const borrowerNameKey = mappings.borrowerName || headers.find(h => 
        h.toLowerCase().includes('name') || h.toLowerCase().includes('borrower')
      );
      
      if (borrowerNameKey) {
        rows.forEach(row => {
          if (row[borrowerNameKey]) {
            borrowerNames.add(String(row[borrowerNameKey]).trim());
          }
        });
      }

      const matchedBorrowers: { [key: string]: string } = {};
      if (borrowerNames.size > 0) {
        const { data: borrowers } = await supabase
          .from('borrowers')
          .select('id, full_name')
          .in('full_name', Array.from(borrowerNames));
        
        borrowers?.forEach(b => {
          matchedBorrowers[b.full_name] = b.id;
        });
      }

      setPreview({
        headers,
        rows: rows, // Show all rows in state, but we'll only preview first 10 in UI
        detectedType: mappings.type,
        mappings,
        matchedBorrowers
      });

      toast.success(`File parsed successfully. Detected type: ${mappings.type}`);
    } catch (error: any) {
      console.error('Parse error:', error);
      toast.error('Failed to parse file. Please ensure it is a valid Excel or CSV file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!preview || !profile) return;

    setIsImporting(true);
    const errors: string[] = [];
    let success = 0;
    let createdBorrowers = 0;
    const currentMatchedBorrowers = { ...preview.matchedBorrowers };

    try {
      for (const row of preview.rows) {
        const borrowerName = String(row[preview.mappings.borrowerName || ''] || '').trim();
        if (!borrowerName) {
          errors.push(`Row ${success + errors.length + 1}: Missing borrower name`);
          continue;
        }

        let borrowerId = currentMatchedBorrowers[borrowerName];

        // Auto-create borrower if not found
        if (!borrowerId) {
          const { data: newBorrower, error: createError } = await supabase
            .from('borrowers')
            .insert([{
              full_name: borrowerName,
              created_by: profile.id,
              address: 'Imported Record',
              phone: 'N/A'
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

        if (preview.detectedType === 'loans') {
          const { error } = await supabase.rpc('create_loan_with_journal', {
            p_borrower_id: borrowerId,
            p_officer_id: profile.id,
            p_principal_amount: Number(row[preview.mappings.amount || '']) || 0,
            p_interest_rate: Number(row[preview.mappings.interestRate || '']) || 0,
            p_term_months: Number(row[preview.mappings.term || '']) || 0,
            p_disbursement_date: row[preview.mappings.date || ''] || new Date().toISOString().split('T')[0],
            p_interest_type: 'flat'
          });

          if (error) {
            errors.push(`Failed to create loan for ${borrowerName}: ${error.message}`);
          } else {
            success++;
          }
        } else if (preview.detectedType === 'repayments') {
          // Find active loan for borrower
          const { data: loans } = await supabase
            .from('loans')
            .select('id')
            .eq('borrower_id', borrowerId)
            .eq('status', 'active')
            .limit(1);

          if (!loans || loans.length === 0) {
            errors.push(`No active loan found for ${borrowerName}`);
            continue;
          }

          const { error } = await supabase.rpc('record_repayment_with_journal', {
            p_loan_id: loans[0].id,
            p_amount_paid: Number(row[preview.mappings.amount || '']) || 0,
            p_payment_date: row[preview.mappings.date || ''] || new Date().toISOString().split('T')[0],
            p_recorded_by: profile.id
          });

          if (error) {
            errors.push(`Failed to record repayment for ${borrowerName}: ${error.message}`);
          } else {
            success++;
          }
        }
      }

      setImportResults({ success, errors, createdBorrowers });
      if (success > 0) {
        toast.success(`Successfully imported ${success} records`);
      }
      if (createdBorrowers > 0) {
        toast.success(`Created ${createdBorrowers} new borrower profiles`);
      }
      if (errors.length > 0) {
        toast.error(`${errors.length} records failed to import`);
      }
    } catch (error: any) {
      toast.error('Import failed: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors border-gray-300 hover:border-gray-400 hover:bg-gray-50"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center">
          <div className="p-3 bg-indigo-100 rounded-full mb-3">
            <Upload className="h-6 w-6 text-indigo-600" />
          </div>
          <p className="text-sm font-medium text-gray-900">
            Drag & drop a file here, or click to select
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Supports Excel (.xlsx, .xls) and CSV files
          </p>
        </div>
      </div>

      {isProcessing && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <span className="ml-2 text-sm text-gray-600">Analyzing file with AI...</span>
        </div>
      )}

      {preview && !importResults && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center">
                  <Table2 className="h-4 w-4 mr-2 text-indigo-600" />
                  Preview: {preview.detectedType === 'loans' ? 'Loan Data' : preview.detectedType === 'repayments' ? 'Repayment Data' : 'Unknown Data'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Showing first 10 rows. Missing borrowers will be created automatically.
                </p>
              </div>
              <button
                onClick={handleImport}
                disabled={isImporting || preview.detectedType === 'unknown'}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {isImporting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                ) : (
                  <><ArrowRight className="h-4 w-4 mr-2" /> Import Data</>
                )}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {preview.headers.map((header, idx) => (
                    <th key={idx} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {header}
                      {preview.mappings.borrowerName === header && (
                        <span className="ml-1 text-indigo-600">(Borrower)</span>
                      )}
                      {preview.mappings.amount === header && (
                        <span className="ml-1 text-indigo-600">(Amount)</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {preview.rows.slice(0, 10).map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-gray-50">
                    {preview.headers.map((header, colIdx) => (
                      <td key={colIdx} className="px-4 py-2 text-gray-900 whitespace-nowrap">
                        {String(row[header] ?? '')}
                        {preview.mappings.borrowerName === header && !preview.matchedBorrowers[String(row[header] || '').trim()] && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            <UserPlus className="h-2 w-2 mr-1" /> New
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importResults && (
        <div className={`rounded-xl p-6 ${importResults.errors.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-start">
            {importResults.errors.length === 0 ? (
              <CheckCircle2 className="h-6 w-6 text-green-600 mr-3 shrink-0" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-600 mr-3 shrink-0" />
            )}
            <div>
              <h3 className={`font-semibold ${importResults.errors.length === 0 ? 'text-green-900' : 'text-amber-900'}`}>
                Import Complete
              </h3>
              <div className="mt-1 space-y-1">
                <p className={`text-sm ${importResults.errors.length === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                  Successfully imported {importResults.success} records.
                </p>
                {importResults.createdBorrowers > 0 && (
                  <p className="text-sm text-indigo-700 font-medium">
                    Created {importResults.createdBorrowers} new borrower profiles.
                  </p>
                )}
                {importResults.errors.length > 0 && (
                  <p className="text-sm text-amber-700">
                    {importResults.errors.length} records had errors.
                  </p>
                )}
              </div>
              {importResults.errors.length > 0 && (
                <div className="mt-3 bg-white rounded-lg p-3 max-h-40 overflow-y-auto">
                  <ul className="space-y-1 text-xs text-red-600">
                    {importResults.errors.slice(0, 10).map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                    {importResults.errors.length > 10 && (
                      <li className="text-gray-500">... and {importResults.errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};