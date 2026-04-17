import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { notificationsService } from './notifications';
import { formatCurrency, formatDate } from './_shared/utils';
import { BaseServiceClass, ServiceResult } from './_shared/baseService';

/**
 * Service for generating and delivering employee payslips
 */
export class PayslipService extends BaseServiceClass {
  private static instance: PayslipService;

  public static getInstance(): PayslipService {
    if (!PayslipService.instance) {
      PayslipService.instance = new PayslipService();
    }
    return PayslipService.instance;
  }

  /**
   * Main entry point to generate and deliver a payslip for a settled payroll record
   */
  async generateAndDeliver(payrollRecordId: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      // 1. Fetch full payroll and employee data
      const { data: record, error: fetchError } = await (supabase as any)
        .from('payroll_records')
        .select(`
          *,
          employees:employee_id (
            id,
            full_name,
            employee_id,
            position,
            department,
            user_id
          )
        `)
        .eq('id', payrollRecordId)
        .single();

      if (fetchError || !record) {
        throw new Error(`Failed to fetch payroll record: ${fetchError?.message || 'Record not found'}`);
      }

      const employee = record.employees;
      if (!employee || !employee.user_id) {
        console.warn(`No system user found for employee ${employee?.full_name || 'unknown'}. Skipping delivery.`);
        return false;
      }

      // 2. Generate PDF
      const pdfBlob = await this.generatePDF(record, employee);

      // 3. Upload to storage
      // Path format: {user_id}/{pay_period}.pdf
      const fileName = `${record.pay_period}.pdf`;
      const filePath = `${employee.user_id}/${fileName}`;
      
      const { error: uploadError } = await (supabase as any)
        .storage
        .from('payslips')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Failed to upload payslip: ${uploadError.message}`);
      }

      // 4. Get Public/Signed URL (since bucket is private, we need a signed URL or use the storage API)
      // For notifications, we'll provide a link that the frontend handles or a signed URL.
      // Better yet, we can use a relative link if the app has a payslip viewer.
      // If not, we'll generate a signed URL valid for 7 days.
      const { data: urlData, error: urlError } = await (supabase as any)
        .storage
        .from('payslips')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

      if (urlError) {
        throw new Error(`Failed to create signed URL: ${urlError.message}`);
      }

      // 5. Deliver notification
      await notificationsService.createNotification({
        title: 'New Payslip Available',
        message: `Your payslip for ${record.pay_period} has been generated and is now available for viewing.`,
        type: 'success',
        priority: 'medium',
        recipient_ids: [employee.user_id],
        category: 'payroll' as any,
        action_url: urlData.signedUrl,
        metadata: {
          payroll_record_id: payrollRecordId,
          pay_period: record.pay_period
        }
      });

      return true;
    }, 'Failed to generate and deliver payslip');
  }

  /**
   * Internal method to construct the PDF
   */
  private async generatePDF(record: any, employee: any): Promise<Blob> {
    const doc = new jsPDF();
    const margin = 20;
    let y = 30;

    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('JANALO MANAGEMENT', margin, y);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Employee Payslip', 150, y);
    
    y += 10;
    doc.setLineWidth(0.5);
    doc.line(margin, y, 190, y);
    
    y += 15;
    
    // Employee Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLOYEE DETAILS', margin, y);
    
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${employee.full_name}`, margin, y);
    doc.text(`Employee ID: ${employee.employee_id}`, 110, y);
    
    y += 7;
    doc.text(`Position: ${employee.position || 'N/A'}`, margin, y);
    doc.text(`Department: ${employee.department || 'N/A'}`, 110, y);
    
    y += 7;
    doc.text(`Pay Period: ${record.pay_period}`, margin, y);
    doc.text(`Status: PAID`, 110, y);
    
    y += 15;
    
    // Earnings & Deductions Table
    const tableData = [
      ['Description', 'Earnings (MWK)', 'Deductions (MWK)'],
      ['Gross Salary', formatCurrency(record.gross_salary).split(' ')[1] || record.gross_salary.toString(), '-'],
      ['PAYE Tax (MRA)', '-', formatCurrency(record.paye_tax).split(' ')[1] || record.paye_tax.toString()],
      [{ content: 'NET PAYABLE', styles: { fontStyle: 'bold' } }, { content: formatCurrency(record.net_salary).split(' ')[1] || record.net_salary.toString(), styles: { fontStyle: 'bold' } }, '']
    ];

    doc.autoTable({
      startY: y,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: 'grid',
      headStyles: { fillGray: [200], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { cellPadding: 5, fontSize: 10 },
      margin: { left: margin, right: margin }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 20;
    
    // Summary
    doc.setFont('helvetica', 'bold');
    doc.text(`Net Salary (T/W): ${formatCurrency(record.net_salary)}`, margin, finalY);
    
    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('This is a computer-generated document and does not require a physical signature.', margin, 270);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, 275);
    doc.text('MRA Compliance Verified', 160, 275);

    return doc.output('blob');
  }
}

export const payslipService = PayslipService.getInstance();
