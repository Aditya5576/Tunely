import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

(async () => {
  try {
    console.log('Starting PDF generation...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    const htmlContent = fs.readFileSync('Tunely_Tech_Breakdown.html', 'utf8');
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
    });
    
    fs.writeFileSync('Tunely_Tech_Breakdown.pdf', pdfBuffer);
    await browser.close();
    console.log('PDF FILE WRITTEN SUCCESSFULLY: Size =', pdfBuffer.length, 'bytes');
  } catch (err) {
    console.error('ERROR GENERATING PDF:', err);
  }
})();
