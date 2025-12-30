const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1); // важно для Render

app.use(express.static(path.join(__dirname)));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.get("/generate-pdf", async (req, res) => {
  let browser;

  try {
    const launchOptions = {
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    };

    // задаём executablePath ТОЛЬКО если он реально задан в env
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });

    const proto = req.get("x-forwarded-proto") || req.protocol;
    const url = `${proto}://${req.get("host")}/`;

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    await page.emulateMediaType("print");

    // ждём чтобы блок реально был видимым
    await page.waitForSelector(".pdf-only", { visible: true, timeout: 30000 });

    // дождаться шрифтов
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });

    await sleep(150);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", right: "15mm", bottom: "12mm", left: "15mm" },
      // scale лучше убрать для начала, чтобы исключить сюрпризы
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

app.get("/health", (req, res) => res.status(200).send("ok"));

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
