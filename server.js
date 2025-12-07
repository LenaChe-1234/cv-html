const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (index.html, style.css, photo.jpg, etc.)
app.use(express.static(path.join(__dirname)));

app.get("/generate-pdf", async (req, res) => {
  let browser;

  try {
  browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

    const page = await browser.newPage();

    // Set an initial viewport BEFORE navigation (prevents layout reflow issues)
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

    // Load the CV page from the same container/service
    const url = `http://127.0.0.1:${PORT}/`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector(".page", { timeout: 30000 });

    // Force screen styles (ignore @media print)
    await page.emulateMediaType("screen");

    // Hide the download button in the generated PDF
    await page.addStyleTag({
      content: `.download-btn { display: none !important; }`,
    });

    // Wait for fonts/resources to render
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(200);

    // Measure content size via DOM (more reliable than boundingBox)
    const { width, height } = await page.$eval(".page", (el) => {
      const rect = el.getBoundingClientRect();
      const fullHeight = Math.max(el.scrollHeight, rect.height);
      const fullWidth = Math.max(el.scrollWidth, rect.width);
      return { width: Math.ceil(fullWidth), height: Math.ceil(fullHeight) };
    });

    await page.setViewport({ width, height, deviceScaleFactor: 2 });

    const pdfBuffer = await page.pdf({
      printBackground: true,
      width: `${width}px`,
      height: `${height}px`,
      preferCSSPageSize: false,
      scale: 0.95,
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

   // TEMP: return the real error to the client (for debugging)
   res.status(500).send(String(err?.stack || err || "Unknown PDF error"));
  }
});

// Start the server (Render provides PORT via env)
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
