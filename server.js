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

    // Set an initial viewport BEFORE navigation (safe default)
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

    // Load the CV page
    const url = `http://127.0.0.1:${PORT}/`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Use print media type to trigger @media print styles (Level 3)
    await page.emulateMediaType("print");

    // Wait for the print/PDF layout to be present
    await page.waitForSelector(".pdf-only", { timeout: 30000 });

    // Wait for fonts to be ready (robust)
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

    await sleep(200);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
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