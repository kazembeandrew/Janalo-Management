import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './finance';

/**
 * Converts an array of objects into a CSV string and triggers a download.
 */
export const exportToCSV = (data: any[], filename: string) => {
  if (!data || !data.length) return;

  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(obj => 
    Object.values(obj)
      .map(val => {
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',')
  );

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Generates a PDF receipt for a repayment.
 */
export const generateReceiptPDF = (loan: any, repayment: any, officerName: string) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text('JANALO ENTERPRISES', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text('Official Repayment Receipt', 105, 28, { align: 'center' });
    
    // Divider
    doc.setDrawColor(200);
    doc.line(20, 35, 190, 35);
    
    // Receipt Info
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Receipt ID: ${repayment.id.slice(0, 8).toUpperCase()}`, 20, 45);
    doc.text(`Date: ${new Date(repayment.payment_date).toLocaleDateString()}`, 190, 45, { align: 'right' });
    
    // Client Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENT DETAILS', 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Name: ${loan.borrowers?.full_name}`, 20, 68);
    doc.text(`Phone: ${loan.borrowers?.phone || 'N/A'}`, 20, 74);
    doc.text(`Loan ID: ${loan.id.slice(0, 8)}`, 20, 80);
    
    // Payment Table
    autoTable(doc, {
        startY: 90,
        head: [['Description', 'Amount (MK)']],
        body: [
            ['Principal Paid', repayment.principal_paid.toFixed(2)],
            ['Interest Paid', repayment.interest_paid.toFixed(2)],
            ['Penalty Paid', repayment.penalty_paid.toFixed(2)],
            [{ content: 'TOTAL RECEIVED', styles: { fontStyle: 'bold' } }, { content: repayment.amount_paid.toFixed(2), styles: { fontStyle: 'bold' } }]
        ],
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY;
    
    // Outstanding
    doc.setFontSize(10);
    doc.text('OUTSTANDING BALANCE', 20, finalY + 15);
    doc.setFont('helvetica', 'bold');
    const totalOutstanding = loan.principal_outstanding + loan.interest_outstanding + (loan.penalty_outstanding || 0);
    doc.text(`MK ${totalOutstanding.toLocaleString()}`, 190, finalY + 15, { align: 'right' });
    
    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Recorded by: ${officerName}`, 20, 280);
    doc.text('Thank you for your payment. Please keep this receipt for your records.', 105, 285, { align: 'center' });
    
    doc.save(`Receipt_${loan.borrowers?.full_name.replace(/\s+/g, '_')}_${repayment.id.slice(0, 4)}.pdf`);
};

/**
 * Generates a full account statement PDF for a loan.
 */
export const generateStatementPDF = (loan: any, repayments: any[]) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(79, 70, 229);
    doc.text('JANALO ENTERPRISES', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Loan Account Statement', 105, 30, { align: 'center' });
    
    // Client & Loan Info
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENT INFORMATION', 20, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${loan.borrowers?.full_name}`, 20, 52);
    doc.text(`Phone: ${loan.borrowers?.phone || 'N/A'}`, 20, 58);
    doc.text(`Address: ${loan.borrowers?.address || 'N/A'}`, 20, 64);
    
    doc.setFont('helvetica', 'bold');
    doc.text('LOAN SUMMARY', 120, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(`Loan ID: ${loan.id.slice(0, 8).toUpperCase()}`, 120, 52);
    doc.text(`Principal: ${formatCurrency(loan.principal_amount)}`, 120, 58);
    doc.text(`Status: ${loan.status.toUpperCase()}`, 120, 64);
    
    // Balances Box
    doc.setDrawColor(230);
    doc.setFillColor(249, 250, 251);
    doc.rect(20, 75, 170, 25, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL OUTSTANDING BALANCE', 105, 85, { align: 'center' });
    doc.setFontSize(16);
    const total = loan.principal_outstanding + loan.interest_outstanding + (loan.penalty_outstanding || 0);
    doc.text(formatCurrency(total), 105, 93, { align: 'center' });
    
    // Repayment Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('REPAYMENT HISTORY', 20, 115);
    
    const tableRows = repayments.map(r => [
        new Date(r.payment_date).toLocaleDateString(),
        formatCurrency(r.amount_paid),
        formatCurrency(r.principal_paid),
        formatCurrency(r.interest_paid),
        formatCurrency(r.penalty_paid)
    ]);
    
    autoTable(doc, {
        startY: 120,
        head: [['Date', 'Total Paid', 'Principal', 'Interest', 'Penalty']],
        body: tableRows.length > 0 ? tableRows : [['-', 'No repayments recorded', '-', '-', '-']],
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
    });
    
    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Generated on ${new Date().toLocaleString()} • Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    }
    
    doc.save(`Statement_${loan.borrowers?.full_name.replace(/\s+/g, '_')}.pdf`);
};

/**
 * Generates a PDF report for a table of data.
 */
export const generateTablePDF = (title: string, headers: string[], rows: any[][], filename: string) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229);
    doc.text('JANALO ENTERPRISES', 105, 15, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(title, 105, 25, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 32, { align: 'center' });
    
    autoTable(doc, {
        startY: 40,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
    });
    
    doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
};