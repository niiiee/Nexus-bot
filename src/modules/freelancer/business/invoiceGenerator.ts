import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  type: 'invoice' | 'quote';
  freelancerName: string;
  freelancerEmailOrContact: string;
  clientName: string;
  clientCompany?: string;
  currency: string;
  items: InvoiceItem[];
  notes?: string;
  dueDate: string;
}

export class InvoiceGeneratorService {
  public generateInvoiceHtml(data: InvoiceData, lang: 'en' | 'ar' = 'en'): { invoiceNumber: string; html: string; total: number } {
    const isAr = lang === 'ar';
    const invoiceNumber = data.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
    let subtotal = 0;
    for (const item of data.items) {
      subtotal += item.quantity * item.unitPrice;
    }

    const disclaimer = isAr
      ? 'إخلاء مسؤولية: هذا المستند هو نموذج تنظيمي لأغراض التوثيق الداخلي، ولا يعتبر استشارة قانونية أو ضريبية معتمدة.'
      : 'DISCLAIMER: This document is a template for organizational and record-keeping purposes only. It does not constitute formal legal or financial advice.';

    const itemsRows = data.items
      .map(
        (it) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${it.description}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${it.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${it.unitPrice.toFixed(2)} ${data.currency}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${(it.quantity * it.unitPrice).toFixed(2)} ${data.currency}</td>
      </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>${data.type === 'quote' ? (isAr ? 'عرض سعر' : 'Price Quote') : (isAr ? 'فاتورة' : 'Invoice')} - ${invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1f2937; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
    .title { font-size: 28px; font-weight: bold; color: #1e3a8a; }
    .parties { display: flex; justify-content: space-between; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin-top: 30px; }
    th { background: #f3f4f6; padding: 12px; text-align: ${isAr ? 'right' : 'left'}; }
    .total-box { margin-top: 20px; text-align: ${isAr ? 'left' : 'right'}; font-size: 20px; font-weight: bold; }
    .disclaimer { margin-top: 40px; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${data.type === 'quote' ? (isAr ? 'عرض سعر' : 'PRICE QUOTE') : (isAr ? 'فاتورة خدمات' : 'INVOICE')}</div>
      <div><strong>#${invoiceNumber}</strong></div>
      <div>Date: ${new Date().toLocaleDateString()}</div>
      <div>Due Date: ${data.dueDate}</div>
    </div>
    <div style="text-align: ${isAr ? 'left' : 'right'};">
      <strong>${data.freelancerName}</strong><br>
      ${data.freelancerEmailOrContact}
    </div>
  </div>

  <div class="parties">
    <div>
      <strong>${isAr ? 'مقدم إلى (العميل):' : 'Billed To (Client):'}</strong><br>
      ${data.clientName}<br>
      ${data.clientCompany || ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>${isAr ? 'الوصف' : 'Description'}</th>
        <th style="text-align: center;">${isAr ? 'الكمية' : 'Qty'}</th>
        <th style="text-align: right;">${isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
        <th style="text-align: right;">${isAr ? 'الإجمالي' : 'Total'}</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="total-box">
    ${isAr ? 'الإجمالي المستحق:' : 'Total Amount Due:'} ${subtotal.toFixed(2)} ${data.currency}
  </div>

  ${data.notes ? `<div style="margin-top: 20px;"><strong>${isAr ? 'ملاحظات:' : 'Notes:'}</strong><p>${data.notes}</p></div>` : ''}

  <div class="disclaimer">
    ${disclaimer}
  </div>
</body>
</html>`;

    logger.info('InvoiceGenerator', `Generated ${data.type} document #${invoiceNumber} for total ${subtotal} ${data.currency}`);

    return {
      invoiceNumber,
      html,
      total: subtotal,
    };
  }
}

export const invoiceGeneratorService = new InvoiceGeneratorService();
