const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Serve static files (index.html, style.css, photo.jpg, etc.)
app.use(express.static(path.join(__dirname)));

app.get("/generate-pdf", async (req, res) => {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        "/usr/bin/google-chrome-stable",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();

    // Set viewport BEFORE navigation
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });

    // Prefer public URL on Render
    const url = `${req.protocol}://${req.get("host")}/`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Use print media type (Level 3)
    await page.emulateMediaType("print");

    // Wait for PDF layout
    await page.waitForSelector(".pdf-only", { timeout: 30000 });

    // Wait for fonts
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

    await sleep(100);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      scale: 0.85,
      margin: {
        top: "12mm",
        right: "15mm",
        bottom: "12mm",
        left: "15mm",
      },
      preferCSSPageSize: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=cv.pdf");
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF generation error:", err?.stack || err);

    if (browser) {
      try {
        await browser.close();
      } catch {}
    }

    res.status(500).send(String(err?.stack || err || "Unknown PDF error"));
  }
});

// Health check (optional, helps debugging)
app.get("/health", (req, res) => res.status(200).send("ok"));

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});