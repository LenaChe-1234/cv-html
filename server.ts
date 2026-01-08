// import express, { Request, Response } from 'express';
// import puppeteer, { Browser, Page } from 'puppeteer';
// import path from 'path';

// const app = express();
// const PORT = Number(process.env.PORT) || 3000;

// const isDev = process.env.NODE_ENV !== 'production';

// app.set('trust proxy', 1);

// const publicDir = path.join(process.cwd(), 'public');

// // Serve static files from /public
// app.use(express.static(publicDir));

// // Root route
// app.get('/', (_req, res) => {
//   res.sendFile(path.join(publicDir, 'index.html'));
// });

// // Helper
// const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// app.get('/generate-pdf', async (req: Request, res: Response) => {
//   const targetUrl = String(req.query.url || '').trim();

//   if (!targetUrl) {
//     res.status(400).send('Missing required query param: ?url=');
//     return;
//   }

//   // ===== URL allowlist validation =====
//   let parsed: URL;
//   try {
//     parsed = new URL(targetUrl);
//   } catch {
//     res.status(400).send('Invalid URL');
//     return;
//   }

//   if (isDev) {
//     // allow local only
//     const allowedLocal =
//       parsed.protocol === 'http:' &&
//       (parsed.hostname === 'localhost' ||
//         parsed.hostname === '127.0.0.1' ||
//         parsed.hostname === '0.0.0.0');

//     if (!allowedLocal) {
//       res.status(403).send('URL not allowed (dev mode)');
//       return;
//     }
//   } else {
//     // allow only these in prod
//     const allowed = [
//       { host: 'lenache-1234.github.io', pathPrefix: '/cv-html' },
//       { host: 'cv-html-i450.onrender.com', pathPrefix: '/' },
//     ];

//     const ok = allowed.some(({ host, pathPrefix }) => {
//       return (
//         parsed.protocol === 'https:' &&
//         parsed.hostname === host &&
//         parsed.pathname.startsWith(pathPrefix)
//       );
//     });

//     if (!ok) {
//       res.status(403).send('URL not allowed');
//       return;
//     }
//   }
//   // ===== END allowlist =====

//   let browser: Browser | null = null;

//   try {
//     browser = await puppeteer.launch({
//       headless: true,
//       args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
//     });

//     const page: Page = await browser.newPage();
//     await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });

//     // Helpful diagnostics (you will see them in terminal logs)
//     page.on('console', (msg) => console.log('[PAGE]', msg.text()));
//     page.on('pageerror', (err) => console.error('[PAGE ERROR]', err));

//     // IMPORTANT: networkidle0 often hangs / breaks PDF when there are external requests.
//     await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
//     await page.waitForTimeout(500);

//     await page.emulateMediaType('screen');

//     // Hide the button in the generated PDF
//     await page.addStyleTag({
//       content: `.download-btn { display: none !important; }`,
//     });

//     // Wait for fonts
//     await page.evaluate(async () => {
//       if (document.fonts?.ready) await document.fonts.ready;
//     });

//     await delay(150);

//     console.log('Final page URL:', page.url());

//     const pdfBuffer = await page.pdf({
//       format: 'A4',
//       printBackground: true,
//       preferCSSPageSize: true,
//       margin: { top: '12mm', right: '15mm', bottom: '12mm', left: '15mm' },
//     });

//     console.log('PDF size (bytes):', pdfBuffer.length);

//     // PDF validity checks
//     const head = pdfBuffer.subarray(0, 5).toString('ascii');
//     const tail = pdfBuffer.subarray(Math.max(0, pdfBuffer.length - 30)).toString('ascii');

//     console.log('PDF head:', head);
//     console.log('PDF tail:', tail);

//     if (head !== '%PDF-') {
//       throw new Error('Not a PDF (missing %PDF- header)');
//     }
//     if (!tail.includes('%%EOF')) {
//       throw new Error('PDF seems truncated (missing %%EOF)');
//     }
//     if (pdfBuffer.length < 1000) {
//       throw new Error(`Generated PDF is too small (${pdfBuffer.length} bytes)`);
//     }

//     res.status(200);
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', 'attachment; filename="cv.pdf"');
//     res.setHeader('Content-Length', String(pdfBuffer.length));
//     res.end(pdfBuffer);
//   } catch (err: unknown) {
//     const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
//     console.error('PDF generation error:', message);
//     res.status(500).send(message);
//   } finally {
//     await browser?.close().catch(() => {});
//   }
// });

// app.listen(PORT, () => {
//   console.log(`Server running at http://127.0.0.1:${PORT}`);
// });

import express, { Request, Response } from 'express';
import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const isDev = process.env.NODE_ENV !== 'production';

app.set('trust proxy', 1);

const publicDir = path.join(process.cwd(), 'public');

// Serve static files from /public
app.use(express.static(publicDir));

// Root route
app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Helper
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

app.get('/generate-pdf', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '').trim();

  if (!targetUrl) {
    res.status(400).send('Missing required query param: ?url=');
    return;
  }

  // ===== URL allowlist validation =====
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.status(400).send('Invalid URL');
    return;
  }

  if (isDev) {
    // allow local only
    const allowedLocal =
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '0.0.0.0');

    if (!allowedLocal) {
      res.status(403).send('URL not allowed (dev mode)');
      return;
    }
  } else {
    // allow only these in prod
    const allowed = [
      { host: 'lenache-1234.github.io', pathPrefix: '/cv-html' },
      { host: 'cv-html-i450.onrender.com', pathPrefix: '/' },
    ];

    const ok = allowed.some(({ host, pathPrefix }) => {
      return (
        parsed.protocol === 'https:' &&
        parsed.hostname === host &&
        parsed.pathname.startsWith(pathPrefix)
      );
    });

    if (!ok) {
      res.status(403).send('URL not allowed');
      return;
    }
  }
  // ===== END allowlist =====

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page: Page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });

    // Helpful diagnostics (you will see them in terminal logs)
    page.on('console', (msg) => console.log('[PAGE]', msg.text()));
    page.on('pageerror', (err) => console.error('[PAGE ERROR]', err));

    // IMPORTANT: avoid networkidle0 for public pages (analytics/fonts can keep network busy)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await delay(500);

    await page.emulateMediaType('screen');

    // Hide the button in the generated PDF
    await page.addStyleTag({
      content: `.download-btn { display: none !important; }`,
    });

    // Wait for fonts
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });

    await delay(150);

    console.log('Final page URL:', page.url());

    // In Puppeteer v24 this is Uint8Array
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '12mm', right: '15mm', bottom: '12mm', left: '15mm' },
    });

    // Convert to Buffer for checks + reliable sending
    const pdf = Buffer.from(pdfBytes);

    console.log('PDF size (bytes):', pdf.length);

    // PDF validity checks
    const head = pdf.slice(0, 5).toString('ascii');
    const tail = pdf.slice(Math.max(0, pdf.length - 30)).toString('ascii');

    console.log('PDF head:', head);
    console.log('PDF tail:', tail);

    if (head !== '%PDF-') {
      throw new Error('Not a PDF (missing %PDF- header)');
    }
    // иногда %%EOF чуть дальше из-за пробелов — не всегда стоит падать
    if (!tail.includes('%%EOF')) {
      console.warn('PDF may be truncated (missing %%EOF near the end).');
    }
    if (pdf.length < 1000) {
      throw new Error(`Generated PDF is too small (${pdf.length} bytes)`);
    }

    // Send PDF reliably
    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="cv.pdf"');
    res.setHeader('Content-Length', String(pdf.length));
    res.setHeader('Cache-Control', 'no-store');
    res.end(pdf);
  } catch (err: unknown) {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error('PDF generation error:', message);
    if (!res.headersSent) res.status(500).send(message);
  } finally {
    await browser?.close().catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
