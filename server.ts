import express, { Request, Response } from "express";
import puppeteer, { Browser, Page } from "puppeteer";
import path from "path";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set("trust proxy", 1);

const publicDir = path.join(process.cwd(), "public");

// serve static files from /public
app.use(express.static(publicDir));

// root route (optional but good)
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// helper
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

app.get("/generate-pdf", async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || "").trim();

  if (!targetUrl) {
    res.statusCode = 400;
    res.send("Missing required query param: ?url=");
    return;
  }

  // ===== URL allowlist validation =====
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.statusCode = 400;
    res.send("Invalid URL");
    return;
  }

  const allowedHost = "lenache-1234.github.io";
  const allowedPathPrefix = "/cv-html/";

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== allowedHost ||
    !parsed.pathname.startsWith(allowedPathPrefix)
  ) {
    res.statusCode = 403;
    res.send("URL not allowed");
    return;
  }
  // ===== END allowlist =====

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page: Page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });

    await page.goto(targetUrl, {
      waitUntil: "networkidle0",
      timeout: 45000,
    });

    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 30000 });

    await page.emulateMediaType("screen");

    await page.addStyleTag({
      content: `.download-btn { display: none !important; }`,
    });

    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });

    await delay(150);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", right: "15mm", bottom: "12mm", left: "15mm" },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="cv.pdf"');
    res.statusCode = 200;
    res.send(pdfBuffer);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error("PDF generation error:", message);
    res.statusCode = 500;
    res.send(message);
  } finally {
    await browser?.close().catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});