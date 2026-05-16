import express, { Request, Response } from 'express';
import fs from 'fs';
import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const isDev = process.env.NODE_ENV !== 'production';

app.set('trust proxy', 1);

const publicDir = path.join(process.cwd(), 'public');
const visitsLogPath = path.join(process.cwd(), 'visits.log');

type VisitLogEntry = {
  visitNumber: number;
  timestamp: string;
  ip: string;
  os: string;
  userAgent: string;
};

const getInitialVisitCount = () => {
  try {
    if (!fs.existsSync(visitsLogPath)) return 0;

    const logContent = fs.readFileSync(visitsLogPath, 'utf8').trim();
    if (!logContent) return 0;

    return logContent.split('\n').length;
  } catch (error) {
    console.error('Failed to read visit log:', error);
    return 0;
  }
};

let visitCount = getInitialVisitCount();

const detectOs = (userAgent: string) => {
  const ua = userAgent.toLowerCase();

  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';

  return 'Unknown';
};

const getClientIp = (req: Request) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const proxyIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  if (proxyIp) {
    return proxyIp.split(',')[0].trim();
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
};

const logVisit = async (req: Request) => {
  visitCount += 1;

  const userAgent = req.get('user-agent') || 'unknown';
  const entry: VisitLogEntry = {
    visitNumber: visitCount,
    timestamp: new Date().toISOString(),
    ip: getClientIp(req),
    os: detectOs(userAgent),
    userAgent,
  };

  console.log(`[VISIT ${entry.visitNumber}]`, entry);

  try {
    await fs.promises.appendFile(visitsLogPath, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (error) {
    console.error('Failed to write visit log:', error);
  }
};

// Serve static files from /public
app.use(express.static(publicDir));

// Root route
app.get('/', async (req, res) => {
  await logVisit(req);
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

    await page.emulateMediaType('print');

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
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
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
