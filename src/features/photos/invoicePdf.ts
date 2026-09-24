/**
 * Connekyt Photo Purchase — PDF Invoice Generator
 *
 * Generates an official, branded PDF invoice & payment receipt using expo-print
 * and triggers native sharing/saving via expo-sharing.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { logoBase64 } from '@/utils/logoBase64';

export type PhotoInvoiceData = {
  refid: string;
  date: Date;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  paymentMethod: string;
  country: string;
  photoCount: number;
  photographerCount: number;
  currency: string;
  amount: number;
  unlockCode: string;
};

export function buildPhotoInvoiceHtml(data: PhotoInvoiceData): string {
  const formattedDate = data.date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const invoiceNumber = `INV-${data.refid ? data.refid.slice(-8).toUpperCase() : Date.now().toString().slice(-8)}`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Invoice ${invoiceNumber}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1a1e29;
            background-color: #ffffff;
            padding: 40px;
            font-size: 13px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 24px;
            margin-bottom: 28px;
          }
          .brand-logo {
            max-width: 140px;
            max-height: 60px;
            object-fit: contain;
            margin-bottom: 8px;
          }
          .company-name {
            font-size: 20px;
            font-weight: 800;
            color: #083A85;
            letter-spacing: -0.5px;
          }
          .company-sub {
            font-size: 12px;
            color: #64748b;
          }
          .invoice-meta {
            text-align: right;
          }
          .invoice-title {
            font-size: 22px;
            font-weight: 800;
            color: #083A85;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .invoice-tag {
            display: inline-block;
            background-color: #ecfdf5;
            color: #047857;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 9999px;
            border: 1px solid #a7f3d0;
            margin-top: 6px;
            margin-bottom: 8px;
          }
          .meta-row {
            font-size: 12px;
            color: #475569;
            margin-top: 3px;
          }
          .meta-row strong {
            color: #0f172a;
          }
          .details-grid {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 18px 20px;
            margin-bottom: 28px;
          }
          .details-col {
            flex: 1;
          }
          .col-title {
            font-size: 10px;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .col-name {
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
          }
          .col-text {
            font-size: 12px;
            color: #475569;
            line-height: 1.4;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          .items-table th {
            background-color: #f1f5f9;
            color: #475569;
            font-size: 10.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            padding: 10px 14px;
            text-align: left;
            border-bottom: 1px solid #cbd5e1;
          }
          .items-table td {
            padding: 14px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
          }
          .items-table td.qty {
            text-align: center;
          }
          .items-table td.amount {
            text-align: right;
            font-weight: 700;
            color: #0f172a;
          }
          .total-summary {
            width: 280px;
            margin-left: auto;
            margin-bottom: 32px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 12.5px;
            color: #64748b;
          }
          .total-row.final {
            border-top: 2px solid #e2e8f0;
            padding-top: 10px;
            margin-top: 4px;
            font-size: 17px;
            font-weight: 800;
            color: #083A85;
          }
          .unlock-card {
            background: linear-gradient(135deg, rgba(8, 58, 133, 0.05), rgba(242, 12, 143, 0.05));
            border: 1.5px dashed #083A85;
            border-radius: 14px;
            padding: 20px;
            text-align: center;
            margin-bottom: 32px;
          }
          .unlock-label {
            font-size: 11px;
            font-weight: 800;
            color: #083A85;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .unlock-code {
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
            font-size: 26px;
            font-weight: 900;
            letter-spacing: 4px;
            color: #F20C8F;
            background-color: #ffffff;
            display: inline-block;
            padding: 8px 24px;
            border-radius: 10px;
            border: 1px solid #cbd5e1;
            margin-bottom: 10px;
          }
          .unlock-instruction {
            font-size: 11.5px;
            color: #475569;
            max-width: 480px;
            margin: 0 auto;
            line-height: 1.5;
          }
          .footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #94a3b8;
          }
          .footer a {
            color: #083A85;
            text-decoration: none;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            ${logoBase64 ? `<img src="${logoBase64}" class="brand-logo" alt="Connekyt Logo" />` : ''}
            <div class="company-name">Connekyt</div>
            <div class="company-sub">Digital Photography &amp; Creative Marketplace</div>
          </div>
          <div class="invoice-meta">
            <div class="invoice-title">RECEIPT / INVOICE</div>
            <div class="invoice-tag">✓ PAYMENT SETTLED</div>
            <div class="meta-row">Invoice No: <strong>${invoiceNumber}</strong></div>
            <div class="meta-row">Transaction Ref: <strong>${data.refid || 'N/A'}</strong></div>
            <div class="meta-row">Date: <strong>${formattedDate}</strong></div>
          </div>
        </div>

        <div class="details-grid">
          <div class="details-col">
            <div class="col-title">Customer / Buyer</div>
            <div class="col-name">${data.buyerName || 'Valued Customer'}</div>
            <div class="col-text">${data.buyerEmail}</div>
            ${data.buyerPhone ? `<div class="col-text">${data.buyerPhone}</div>` : ''}
            <div class="col-text">Country: ${data.country || 'RW'}</div>
          </div>
          <div class="details-col">
            <div class="col-title">Payment Method</div>
            <div class="col-name">${data.paymentMethod}</div>
            <div class="col-text">Status: <strong>Completed</strong></div>
            <div class="col-text">Processing Partner: PawaPay / XentriPay</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 50%;">Description</th>
              <th class="qty" style="width: 15%;">Quantity</th>
              <th class="qty" style="width: 15%;">Photographers</th>
              <th class="amount" style="width: 20%;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>High-Resolution Event Photos</strong>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                  Original high-resolution digital originals without watermark
                </div>
              </td>
              <td class="qty">${data.photoCount} photo${data.photoCount === 1 ? '' : 's'}</td>
              <td class="qty">${data.photographerCount}</td>
              <td class="amount">${data.currency} ${data.amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="total-summary">
          <div class="total-row">
            <span>Subtotal</span>
            <span>${data.currency} ${data.amount.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Taxes &amp; Gateway Fees</span>
            <span>${data.currency} 0.00</span>
          </div>
          <div class="total-row final">
            <span>Total Paid</span>
            <span>${data.currency} ${data.amount.toFixed(2)}</span>
          </div>
        </div>

        ${data.unlockCode ? `
          <div class="unlock-card">
            <div class="unlock-label">Your Permanent Unlock Code</div>
            <div class="unlock-code">${data.unlockCode}</div>
            <div class="unlock-instruction">
              Keep this code in a safe place. You can use it anytime on the Connekyt mobile app or at
              <strong>connekyt.com</strong> under <em>"Already paid? Unlock"</em> to download your unwatermarked original photos.
            </div>
          </div>
        ` : ''}

        <div class="footer">
          <div>
            Support: <a href="mailto:support@connekyt.com">support@connekyt.com</a> ·
            Web: <a href="https://connekyt.com">connekyt.com</a>
          </div>
          <div>
            Thank you for supporting creative photographers on Connekyt.
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function generateAndSharePhotoInvoice(data: PhotoInvoiceData): Promise<void> {
  try {
    const html = buildPhotoInvoiceHtml(data);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const safeRef = (data.refid || 'receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Connekyt_Invoice_${safeRef}_${Date.now().toString().slice(-6)}.pdf`;
    const destination = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.copyAsync({ from: uri, to: destination });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(destination, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Save or Share Invoice',
      });
    } else {
      Alert.alert('Invoice Ready', `Your invoice was generated successfully and saved to ${filename}`);
    }
  } catch (err: any) {
    Alert.alert('Invoice Error', 'Unable to generate PDF invoice. Please try again.');
    console.warn('PDF Generation error:', err);
  }
}
