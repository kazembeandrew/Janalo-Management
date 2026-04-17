import React from 'react';
import { DataImporter } from '@/components/DataImporter';
import { FileSpreadsheet, Info, AlertTriangle, CheckCircle2, Download } from 'lucide-react';

export const ImportData: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <FileSpreadsheet className="h-6 w-6 mr-2 text-indigo-600" />
          Bulk Data Import
        </h1>
        <p className="text-sm text-gray-500">Migrate historical data or bulk record field collections using official templates.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <DataImporter />
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="font-bold mb-4 flex items-center">
              <Info className="h-4 w-4 mr-2 text-indigo-300" />
              Import Process
            </h3>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-indigo-800 flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                <p className="text-xs text-indigo-100 leading-relaxed">Download the <strong>Excel Template</strong> for the data type you wish to import.</p>
              </li>
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-indigo-800 flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                <p className="text-xs text-indigo-100 leading-relaxed">Fill in the data exactly as shown. Do not rename or remove the column headers.</p>
              </li>
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-indigo-800 flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
                <p className="text-xs text-indigo-100 leading-relaxed">Upload the file. The system will automatically match clients or create new profiles if they don't exist.</p>
              </li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
            <h3 className="font-bold text-amber-900 flex items-center mb-3">
              <AlertTriangle className="h-4 w-4 mr-2 text-amber-600" />
              Important Notes
            </h3>
            <ul className="space-y-2">
              <li className="text-[11px] text-amber-800 flex items-start">
                <div className="h-1 w-1 rounded-full bg-amber-400 mt-1.5 mr-2 shrink-0" />
                Dates must be in <strong>YYYY-MM-DD</strong> format (e.g., 2023-12-31).
              </li>
              <li className="text-[11px] text-amber-800 flex items-start">
                <div className="h-1 w-1 rounded-full bg-amber-400 mt-1.5 mr-2 shrink-0" />
                Imported loans are created as "Pending" and require CEO approval.
              </li>
              <li className="text-[11px] text-amber-800 flex items-start">
                <div className="h-1 w-1 rounded-full bg-amber-400 mt-1.5 mr-2 shrink-0" />
                Repayments are applied to the borrower's current active loan.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};