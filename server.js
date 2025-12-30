const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

// helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// serve static files
app.use(express.static(path.join(__dirname)));

app.get("/generate-pdf", async (req, res) => {
  let browser;

  const launchOptions = {
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  console.log(
    "PUPPETEER_EXECUTABLE_PATH=",
    process.env.PUPPETEER_EXECUTABLE_PATH
  );

  try {
    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });

    const proto = req.get("x-forwarded-proto") || req.protocol;
    const host = req.get("host");
    const url = `${proto}://${host}/`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // убедимся, что блок вообще есть в HTML
    const hasPdfOnly = await page.$(".pdf-only");
    console.log("has .pdf-only:", Boolean(hasPdfOnly));
    if (!hasPdfOnly) {
      throw new Error("Missing .pdf-only in DOM. Check HTML/template.");
    }

    await delay(300);
    await page.emulateMediaType("print");

    // ждём, пока он реально станет видимым и наполненным
    await page.waitForFunction(
      () => {
        const el = document.querySelector(".pdf-only");
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          el.offsetHeight > 50 &&
          el.innerText.trim().length > 100
        );
      },
      { timeout: 30000 }
    );

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
    res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("PDF generation error:", err?.stack || err);
    res.status(500).send(String(err?.stack || err || "Unknown PDF error"));
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error("Browser close error:", e?.stack || e);
      }
    }
  }
});