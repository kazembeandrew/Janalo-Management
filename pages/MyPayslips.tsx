import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { FileText, Download, Calendar, DollarSign, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Payslip {
  payPeriod: string;
  fileName: string;
  createdAt: string;
  downloadUrl: string | null;
}

export const MyPayslips: React.FC = () => {
  const { profile } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPayslips();
  }, [profile?.id]);

  const fetchPayslips = async () => {
    if (!profile?.id) return;
    
    setIsLoading(true);
    try {
      // List files from user's payslip folder
      const { data: files, error } = await supabase.storage
        .from('payslips')
        .list(profile.id);

      if (error) throw error;

      if (!files || files.length === 0) {
        setPayslips([]);
        return;
      }

      // Sort by name (pay period) descending
      const sortedFiles = files
        .filter(f => f.name.endsWith('.pdf'))
        .sort((a, b) => b.name.localeCompare(a.name));

      const payslipList: Payslip[] = sortedFiles.map(file => ({
        payPeriod: file.name.replace('.pdf', ''),
        fileName: file.name,
        createdAt: file.created_at || new Date().toISOString(),
        downloadUrl: null
      }));

      setPayslips(payslipList);
    } catch (error: any) {
      console.error('Error fetching payslips:', error);
      toast.error('Failed to load payslips');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (payslip: Payslip) => {
    if (!profile?.id) return;
    
    setDownloadingId(payslip.payPeriod);
    try {
      const filePath = `${profile.id}/${payslip.fileName}`;
      
      // Create signed URL valid for 1 hour
      const { data: urlData, error: urlError } = await supabase.storage
        .from('payslips')
        .createSignedUrl(filePath, 60 * 60);

      if (urlError) throw urlError;

      if (urlData?.signedUrl) {
        // Open in new tab for download/view
        window.open(urlData.signedUrl, '_blank');
        toast.success('Opening payslip...');
      }
    } catch (error: any) {
      console.error('Error downloading payslip:', error);
      toast.error('Failed to download payslip');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatPayPeriod = (period: string) => {
    // Format "2026-04" to "April 2026"
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Payslips</h1>
          <p className="text-sm text-gray-500">View and download your payslips from settled payroll periods.</p>
        </div>
        <button
          onClick={fetchPayslips}
          disabled={isLoading}
          className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Payslip List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading your payslips...</p>
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-gray-50 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No payslips yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Your payslips will appear here once payroll has been settled for your pay periods.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {payslips.map((payslip) => (
              <div
                key={payslip.payPeriod}
                className="p-4 sm:p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-indigo-600" />
                    </div>

                    {/* Info */}
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {formatPayPeriod(payslip.payPeriod)}
                      </h3>
                      <div className="flex items-center text-sm text-gray-500 mt-1 space-x-3">
                        <span className="flex items-center">
                          <Calendar className="h-3.5 w-3.5 mr-1" />
                          Generated {new Date(payslip.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center text-green-600">
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Paid
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => handleDownload(payslip)}
                    disabled={downloadingId === payslip.payPeriod}
                    className="flex items-center px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {downloadingId === payslip.payPeriod ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Opening...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">About Your Payslips</p>
            <p className="opacity-80">
              Payslips are generated automatically when your salary is paid. Each payslip is stored securely 
              and can only be accessed by you and authorized administrators. Download links are valid for 1 hour.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPayslips;
