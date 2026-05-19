#!/usr/bin/env tsx
/**
 * Generate test fixture PDFs and images for receipt2sheet tests.
 * Run: pnpm fixtures:generate
 *
 * All fixtures use fake vendor names and addresses. No PII.
 * Inspired by real-world receipt complexity — not trivial test data.
 *
 * IMPORTANT: compress must be false for pdf-parse compatibility.
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const FIXTURES_DIR = path.resolve(import.meta.dirname!, '../test/fixtures/receipts');
fs.mkdirSync(FIXTURES_DIR, { recursive: true });

function pdfToBuffer(fn: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ compress: false, size: 'LETTER', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    fn(doc);
    doc.end();
  });
}

/**
 * Fixture 1: Payment processor receipt (Elavon-style)
 * Complex because: surcharges, payment metadata, T&C noise, not a clean invoice
 */
async function generatePaymentProcessorReceipt(): Promise<void> {
  const buf = await pdfToBuffer((doc) => {
    doc.fontSize(10).font('Helvetica');
    doc.text('From: SUMMIT PEST CONTROL INC noreply@elavon.com');
    doc.text('Subject: Order Confirmation');
    doc.text('Date: February 19, 2024 at 3:13 PM');
    doc.text('To: customer@example.com');
    doc.moveDown();

    doc.fontSize(24).fillColor('#2e7d32').text('$116.91 USD', { align: 'right' });
    doc.fontSize(10).fillColor('#000').text('02/19/2024 05:13:17 PM', { align: 'right' });
    doc.text('SUMMIT PEST CONTROL INC', { align: 'right' });
    doc.moveDown();

    doc.fontSize(14).fillColor('#fff');
    doc.rect(50, doc.y, 500, 30).fill('#2e7d32');
    doc.fillColor('#fff').text('Your payment has been approved', 50, doc.y - 25, {
      align: 'center',
      width: 500,
    });
    doc.fillColor('#000');
    doc.moveDown(2);

    doc.fontSize(9);
    doc.text(
      'Thank you for your recent payment to SPC Credit Cards, 720 E MAIN ST, DURANGO, CO, ' +
        '81301-5512, 970-555-8228, INFO@SUMMITPESTCO.COM. Please keep this receipt for your files ' +
        'in the event you need to contact SPC Credit Cards about your payment.',
    );
    doc.moveDown();

    const labelX = 250;
    const valX = 380;
    const fields = [
      ['Payment', 'VISA 41**********4415'],
      ['Transaction ID', '190224O2D-FCDA0508-306E-4A22-8C6C-1522DC8577A1'],
      ['Approval Code', '09534I'],
      ['ECI', ''],
      ['Amount', '$113.51 USD'],
      ['Invoice Number', '01-0479685'],
      ['Credit Surcharge', '$3.40 USD'],
      ['Total of all charges and fees', '$116.91 USD'],
    ];

    for (const [label, value] of fields) {
      doc.font('Helvetica-Bold').text(label, labelX, doc.y, { width: 120, align: 'right' });
      if (value) {
        doc.font('Helvetica').text(value, valX, doc.y - doc.currentLineHeight());
      }
      doc.moveDown(0.3);
    }

    doc.moveDown();
    doc.text('Service information will follow shortly. Thank you');
    doc.moveDown();

    doc.fontSize(18).fillColor('#2e7d32').text('Total    $116.91 USD', { align: 'center' });
    doc.fillColor('#000');
    doc.moveDown();

    doc.fontSize(8);
    doc.text(
      'Please remember that this payment using a credit card includes a Surcharge charged by LPC Credit ' +
        'Cards. There is no surcharge for debit card payments.',
    );
    doc.moveDown(0.5);
    doc.text(
      'Elavon is a third party payment processor engaged by the biller to process online credit and debit card bill ' +
        'payments. The biller may charge you a credit card Surcharge for your use of the Elavon Hosted Web Page ' +
        'payment service to make online bill payments to the biller using a credit card. The Surcharge is in addition ' +
        'to the Amount paid to the biller for credit card payments.',
    );
  });

  const filename = 'payment-processor-pest-control.pdf';
  fs.writeFileSync(path.join(FIXTURES_DIR, filename), buf);
  console.log(`  ${filename} (${buf.length} bytes)`);
}

/**
 * Fixture 2: Clean service invoice with line items
 * Has: bill-to, ship-to, line items with qty/rate, sales tax, payment terms
 */
async function generateServiceInvoice(): Promise<void> {
  const buf = await pdfToBuffer((doc) => {
    doc.fontSize(14).fillColor('#2e7d32').font('Helvetica-Bold').text('INVOICE');
    doc.fontSize(11).fillColor('#000').text('Ridgeline Landscaping LLC');
    doc.fontSize(9).font('Helvetica');
    doc.text('482 Elk Creek Rd');
    doc.text('Silverton, CO 81433');
    doc.text('ridgeline.landscaping@example.com');
    doc.text('+1 (970) 555-0951');
    doc.moveDown();

    // Bill to / Ship to
    doc.rect(50, doc.y, 240, 50).fill('#f5f5eb');
    doc.rect(310, doc.y - 50, 240, 50).fill('#f5f5eb');
    doc.fillColor('#000');
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Bill to', 55, doc.y - 45);
    doc.font('Helvetica').text('Jane Smith', 55, doc.y);
    doc.font('Helvetica-Bold').text('Ship to', 315, doc.y - doc.currentLineHeight() * 2);
    doc.font('Helvetica').text('Jane Smith', 315, doc.y - doc.currentLineHeight());
    doc.moveDown(3);

    // Invoice details
    doc.font('Helvetica-Bold').text('Invoice details');
    doc.font('Helvetica');
    doc.text('Invoice no.: 2823');
    doc.text('Terms: Net 7');
    doc.text('Invoice date: 04/05/2026');
    doc.text('Due date: 04/12/2026');
    doc.moveDown();

    // Table header
    const cols = [50, 80, 190, 330, 430, 470, 530];
    doc.font('Helvetica-Bold').fontSize(8);
    doc.text('#', cols[0], doc.y);
    const headerY = doc.y - doc.currentLineHeight();
    doc.text('Date', cols[1], headerY);
    doc.text('Product or service', cols[2], headerY);
    doc.text('Qty', cols[3], headerY, { width: 40, align: 'right' });
    doc.text('Rate', cols[4], headerY, { width: 50, align: 'right' });
    doc.text('Amount', cols[5], headerY, { width: 80, align: 'right' });
    doc.font('Helvetica');
    doc.moveDown();

    // Line 1
    doc.text('1.', cols[0], doc.y);
    const line1Y = doc.y - doc.currentLineHeight();
    doc.text('03/11/2026', cols[1], line1Y);
    doc.text('Maintenance Visits — Two visits in March', cols[2], line1Y, { width: 140 });
    doc.text('2', cols[3], line1Y, { width: 40, align: 'right' });
    doc.text('$120.00', cols[4], line1Y, { width: 50, align: 'right' });
    doc.text('$240.00', cols[5], line1Y, { width: 80, align: 'right' });
    doc.moveDown();

    // Line 2
    doc.text('2.', cols[0], doc.y);
    const line2Y = doc.y - doc.currentLineHeight();
    doc.text('Sales Tax', cols[2], line2Y);
    doc.text('0.081', cols[3], line2Y, { width: 40, align: 'right' });
    doc.text('$240.00', cols[4], line2Y, { width: 50, align: 'right' });
    doc.text('$19.44', cols[5], line2Y, { width: 80, align: 'right' });
    doc.moveDown();

    // Total
    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(16);
    doc.text('Total', 400, doc.y, { width: 50 });
    doc.text('$259.44', 460, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });
    doc.font('Helvetica').fontSize(9);

    doc.moveDown(3);
    doc.fillColor('#2e7d32').font('Helvetica-Bold').text('Ways to pay');
    doc.fillColor('#000').font('Helvetica');
    doc.text('Thank you for your business! We accept ACH, or can coordinate in-person payment.');
  });

  const filename = 'service-invoice-landscaping.pdf';
  fs.writeFileSync(path.join(FIXTURES_DIR, filename), buf);
  console.log(`  ${filename} (${buf.length} bytes)`);
}

/**
 * Fixture 3: E-commerce order summary (inspired by Amazon)
 * Has: order #, shipping info, subtotals, a credit/discount line, tax
 */
async function generateEcommerceOrder(): Promise<void> {
  const buf = await pdfToBuffer((doc) => {
    doc.fontSize(9).text('Order Details', 50, 50);
    doc.text('5/16/26, 9:21 AM', 450, 50, { align: 'right' });
    doc.moveDown(2);

    doc.fontSize(20).font('Helvetica-Bold').text('Order Summary');
    doc.fontSize(10).font('Helvetica');
    doc.text('Order placed January 5, 2026       Order # 111-2725430-3019452');
    doc.moveDown();

    // Three columns: Ship to, Payment method, Order Summary
    const colY = doc.y;
    doc.font('Helvetica-Bold').text('Ship to', 50, colY);
    doc.font('Helvetica');
    doc.text('John Doe', 50, doc.y);
    doc.text('123 Main St Apt 4', 50, doc.y);
    doc.text('DENVER, CO 80202', 50, doc.y);
    doc.text('United States', 50, doc.y);

    doc.font('Helvetica-Bold').text('Payment method', 220, colY);
    doc.font('Helvetica');
    doc.text('Visa ending in 5098', 220, doc.y);
    doc.text('Earns 5% back on items using', 220, doc.y);
    doc.text('Day delivery', 220, doc.y);

    doc.font('Helvetica-Bold').text('Order Summary', 420, colY);
    doc.font('Helvetica').fontSize(9);
    const summaryX = 420;
    const summaryValX = 520;
    const summaryItems = [
      ['Item(s) Subtotal:', '$89.97'],
      ['Shipping & Handling:', '$0.00'],
      ['Ring Protect:', '-$9.00'],
      ['Total before tax:', '$80.97'],
      ['Estimated tax:', '$8.55'],
    ];
    let sy = colY + 15;
    for (const [label, val] of summaryItems) {
      doc.text(label, summaryX, sy);
      doc.text(val, summaryValX, sy, { width: 40, align: 'right' });
      sy += 13;
    }
    doc.font('Helvetica-Bold');
    doc.text('Grand Total:', summaryX, sy);
    doc.text('$89.52', summaryValX, sy, { width: 40, align: 'right' });
    doc.font('Helvetica');

    doc.moveDown(8);

    // Product listing
    doc.rect(50, doc.y, 500, 80).stroke('#ddd');
    const prodY = doc.y + 10;
    doc.fontSize(10).fillColor('#007185').text(
      'Ring Pathlight Battery — Motion-activated pathlight, bright LEDs, works with Amazon Sidewalk, Black',
      120,
      prodY,
      { width: 400 },
    );
    doc.fillColor('#000').fontSize(9);
    doc.text('Sold by: Amazon.com', 120, doc.y);
    doc.text('Supplied by: Other', 120, doc.y);
    doc.text('Return window closed on February 5, 2026', 120, doc.y);
    doc.text('$29.99', 120, doc.y);
    doc.text('Qty: 3', 120, doc.y);

    doc.moveDown(3);
    doc.fontSize(7).fillColor('#999').text('Back to top', { align: 'center' });
    doc.moveDown();
    doc.text(
      'Conditions of Use    Privacy Notice    Consumer Health Data Privacy Disclosure    Your Ads Privacy Choices',
      { align: 'center' },
    );
    doc.text('© 1996-2026, Amazon.com, Inc. or its affiliates', { align: 'center' });
  });

  const filename = 'ecommerce-order-amazon.pdf';
  fs.writeFileSync(path.join(FIXTURES_DIR, filename), buf);
  console.log(`  ${filename} (${buf.length} bytes)`);
}

/**
 * Fixture 4: Service agreement — NOT an invoice
 * Has: legal terms, signature lines, valued equipment, but no amount due
 */
async function generateServiceAgreement(): Promise<void> {
  const buf = await pdfToBuffer((doc) => {
    doc.fontSize(18).font('Helvetica').text('Mountain Valley Electric Co.', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(13).font('Helvetica-Bold').text('Servisavor Installation Agreement', {
      align: 'center',
    });
    doc.moveDown();

    doc.fontSize(10).font('Helvetica');
    doc.text(
      'It has been determined by a Mountain Valley Electric Company crew that your customer-owned underground power cable has ' +
        'failed. Since the secondary underground power lines are under the jurisdiction of the State Department of Labor and ' +
        'Industries, only licensed electricians or the homeowner are permitted to repair or replace the cables.',
    );
    doc.moveDown(0.5);
    doc.text(
      'Mountain Valley Electric Company offers, as a courtesy to its members, the opportunity to provide limited emergency power to ' +
        'your home when it is determined that your underground power cables need to be repaired or replaced. We have ' +
        'equipment called a Servisavor that can be installed to restore limited power to your meter while you find a licensed ' +
        'electrician to make the repairs. By signing this document below, you are agreeing to the terms and conditions of the ' +
        'installation as follows:',
    );
    doc.moveDown();

    const terms = [
      'The power available is limited to 62.5 amp, 15 Kva. This means that you agree to reduce your electrical load if ' +
        'the Servisavor breaker trips or if you experience any low voltage problems.',
      'The Servisavor is available to you for a limited time of seven (7) calendar days. This means that you agree to ' +
        'hire a licensed electrical contractor to repair or replace your underground cables within that time.',
      'Please contact our Operations Department at (970) 555-1556 immediately if:\n' +
        '   a) You have hired an electrical contractor and the repairs cannot be completed within the 7 days.\n' +
        '   b) You are unable to find an electrical contractor willing to perform the work and need our assistance.',
      'The Servisavor is Mountain Valley Electric Company property and is valued at approximately $5,000.00. You agree to ' +
        'pay all costs associated with the repair or replacement of this equipment if it is vandalized or intentionally damaged.',
    ];

    terms.forEach((term, i) => {
      doc.text(`${i + 1}. ${term}`);
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.font('Helvetica-Bold').text(
      'I acknowledge and agree to the terms and conditions as stated in this document and hereby authorize Mountain ' +
        'Valley Electric Company to install its Servisavor on my property:',
    );
    doc.font('Helvetica');
    doc.moveDown(2);

    doc.text('_________________________________          Date: August 16, 2024');
    doc.text('Signature');
    doc.moveDown();
    doc.text('Jane Doe');
    doc.text('Print Name');
    doc.moveDown();
    doc.text('123 Example Street');
    doc.text('Address');
    doc.moveDown();
    doc.text('Ouray, CO 81427');
    doc.text('City, State, Zip');
  });

  const filename = 'not-an-invoice-service-agreement.pdf';
  fs.writeFileSync(path.join(FIXTURES_DIR, filename), buf);
  console.log(`  ${filename} (${buf.length} bytes)`);
}

/**
 * Fixture 5: Large capital purchase — spa/hot tub
 * Has: deposits, balance due, terms & conditions, multi-line items, DocuSign metadata
 */
async function generateCapitalPurchaseInvoice(): Promise<void> {
  const buf = await pdfToBuffer((doc) => {
    doc.fontSize(7).fillColor('#888').text(
      'DocuSign Envelope ID: CC5B8430-4809-4190-B5A5-D17E9C6AC145',
      50,
      30,
    );
    doc.fillColor('#000');

    doc.fontSize(20).font('Helvetica-Bold').text('Alpine Spa & Hot Tub', 50, 55);
    doc.fontSize(8).font('Helvetica').text('Since 1985', 50, 78);
    doc.text('Remit Payment to:', 50, 92);
    doc.text('1450 Main Ave, Durango, CO 81301', 50, 103);

    doc.fontSize(22).font('Helvetica-Bold').text('Sales Order', 380, 55, {
      width: 180,
      align: 'right',
    });
    doc.fontSize(9).font('Helvetica');
    const infoX = 400;
    const infoValX = 490;
    const infoY = 85;
    const infoFields = [
      ['Sales Order ID:', '1653534'],
      ['Customer ID:', '203280'],
      ['Employee ID:', 'RR'],
      ['Ordered:', '5/26/2025'],
      ['Distribution:', 'Spa Delivery Team'],
    ];
    infoFields.forEach(([label, val], i) => {
      doc.text(label, infoX, infoY + i * 13);
      doc.text(val, infoValX, infoY + i * 13);
    });

    doc.moveDown(2);
    doc.y = 175;

    // Ship to
    doc.font('Helvetica-Bold').text('Ship To:', 250, 150);
    doc.font('Helvetica');
    doc.text('John Doe', 250, 163);
    doc.text('123 Example Court', 250, 175);
    doc.text('Ouray, CO 81427-9725', 250, 187);
    doc.text('Home (970) 555-8952', 250, 199);

    doc.y = 225;

    // Items table header
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Qty', 50, doc.y, { width: 30 });
    const thY = doc.y - doc.currentLineHeight();
    doc.text('Item', 85, thY, { width: 250 });
    doc.text('List Price', 370, thY, { width: 70, align: 'right' });
    doc.text('Unit Price', 440, thY, { width: 60, align: 'right' });
    doc.text('Total', 510, thY, { width: 50, align: 'right' });
    doc.font('Helvetica');
    doc.moveDown(0.5);

    const items = [
      ['1', 'WARRIOR XL - Warrior XL Hot Tub', '$9,750.03', '$7,725.00', '$7,725.00'],
      ['1', '  - WXL-DRIFT-PM - Classic Drift Mahogany finish', '', '', ''],
      ['1', '  - NC0027 - Cover, Mahogany, XL', '', '', ''],
      ['1', '  - AQST - This spa is a floor model', '', '', ''],
      ['1', '  - @EASEKITPH - @ease Chemical kit', '', '', ''],
      ['', '    01-14-3256 - @Ease King Tech Floating System', '', '', ''],
      ['', '    42624BIO - Spa Shock, 35 Oz.', '', '', ''],
      ['', '    42630BIO - Spa Total Alkalinity, 2 Lb.', '', '', ''],
      ['', '    42634BIO - Spa Ph Decreaser, 22 Oz.', '', '', ''],
      ['', '    PPS2100/FC-3128 - Filter Cartridge', '', '', ''],
      ['', '    Water Testing Container', '', '', ''],
      ['1', '  - SPA 220/40 - Set Voltage to 220V / 40A', '', '', ''],
      ['1', '  - 43290 - EVO Step, Black', '', '', ''],
      ['1', '  - CREDIT CARD - Balance Due paid by credit/debit card', '', '', ''],
      ['1', '  - AQ3 - Spa Backyard Delivery', '', '', ''],
      ['1', '  - 29329 - Filter Cartridge, Hose Filter', '', '', ''],
      ['1', '  - 9951 - Solar Cover - 8 X 8 Spa, 1', '', '', ''],
    ];

    for (const [qty, item, list, unit, total] of items) {
      doc.text(qty, 50, doc.y, { width: 30 });
      const iy = doc.y - (qty ? doc.currentLineHeight() : 0);
      doc.text(item, 85, qty ? iy : doc.y);
      if (list) {
        doc.text(list, 370, iy, { width: 70, align: 'right' });
        doc.text(unit, 440, iy, { width: 60, align: 'right' });
        doc.text(total, 510, iy, { width: 50, align: 'right' });
      }
      doc.moveDown(0.2);
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Retail Value $9,750.03, Extended $7,725.00, You Save $2,025.03', 50, doc.y);
    doc.moveDown();

    // Summary table
    const sumX = 430;
    const sumVX = 510;
    doc.font('Helvetica');
    const summary = [
      ['Sub Total', '$7,725.00'],
      ['Taxes', '$625.73'],
      ['Total', '$8,350.73'],
      ['Deposits', '-$500.00'],
      ['Invoices', '$0.00'],
      ['Order Balance', '$7,850.73'],
    ];
    for (const [label, val] of summary) {
      if (label === 'Total' || label === 'Order Balance') doc.font('Helvetica-Bold');
      doc.text(label, sumX, doc.y, { width: 70 });
      doc.text(val, sumVX, doc.y - doc.currentLineHeight(), { width: 60, align: 'right' });
      doc.font('Helvetica');
      doc.moveDown(0.3);
    }

    doc.moveDown();
    doc.text('Deposits / Invoices', 50, doc.y);
    doc.text('Terms: Due On Receipt', 250, doc.y - doc.currentLineHeight());
    doc.moveDown(0.3);
    doc.text('05/26/2025 Deposit - Visa *4415 - Auth 09349I KEYED', 50, doc.y);
    doc.text('$500.00', 430, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });

    doc.moveDown(2);
    doc.font('Helvetica-Bold').text('Terms And Conditions');
    doc.font('Helvetica').fontSize(8);
    doc.moveDown(0.3);
    doc.text('Customer Acceptance of proposal:');
    doc.moveDown(0.3);
    doc.font('Helvetica-BoldOblique').text('DELIVERY:');
    doc.font('Helvetica');
    doc.text(
      'Alpine Spa & Hot Tub provides an appropriate number of delivery personnel, based on the size and shape of the model purchased ' +
        'with unencumbered access by dolly. Additional personnel are available at customer expense for $75 per extra person.',
    );
    doc.moveDown(0.3);
    doc.text(
      'If a crane is necessary, any costs associated with it are the responsibility of the customer.',
    );
  });

  const filename = 'capital-purchase-spa.pdf';
  fs.writeFileSync(path.join(FIXTURES_DIR, filename), buf);
  console.log(`  ${filename} (${buf.length} bytes)`);
}

/**
 * Fixture 6: Minimal valid PNG (receipt photo placeholder)
 * In real use this would be a camera photo of a receipt.
 */
function generateMinimalPng(filename: string): void {
  const minPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg==',
    'base64',
  );
  fs.writeFileSync(path.join(FIXTURES_DIR, filename), minPng);
  console.log(`  ${filename} (${minPng.length} bytes)`);
}

/**
 * Fixture 7: Minimal valid JPEG (receipt photo placeholder)
 */
function generateMinimalJpg(filename: string): void {
  const minJpg = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
      'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwh' +
      'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAAR' +
      'CAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAA' +
      'D/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A' +
      'KwA//9k=',
    'base64',
  );
  fs.writeFileSync(path.join(FIXTURES_DIR, filename), minJpg);
  console.log(`  ${filename} (${minJpg.length} bytes)`);
}

/**
 * Fixture 8: Empty/blank PDF — tests "no content" detection
 */
async function generateEmptyPdf(): Promise<void> {
  const buf = await pdfToBuffer((doc) => {
    // Page with minimal non-invoice content — no dollar amounts, under 50 chars of real text.
    // Tests the "needsVision" detection when text extraction finds nothing useful.
    doc.fontSize(8).fillColor('#ccc').text('Page intentionally left blank');
  });

  const filename = 'empty.pdf';
  fs.writeFileSync(path.join(FIXTURES_DIR, filename), buf);
  console.log(`  ${filename} (${buf.length} bytes)`);
}

async function main() {
  console.log('Generating test fixtures...\n');

  await generatePaymentProcessorReceipt();
  await generateServiceInvoice();
  await generateEcommerceOrder();
  await generateServiceAgreement();
  await generateCapitalPurchaseInvoice();
  generateMinimalPng('receipt-photo.png');
  generateMinimalJpg('receipt-photo.jpg');
  await generateEmptyPdf();

  console.log('\nDone! Fixtures written to test/fixtures/receipts/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
