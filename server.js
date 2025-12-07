const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

app.get("/generate-pdf", async (req, res) => {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Загружаем твою страницу CV из этого же сервера
    const url = `http://localhost:${PORT}/`;

    await page.goto(url, { waitUntil: "networkidle2" });

    // 🎯 ВАЖНО: используем экранные стили (двухколоночный layout)
    await page.emulateMediaType("screen");

    // Немного подождать, чтобы текст, шрифты и картинки прорендерились
    await page.waitForTimeout(300);

    // Ищем основной контейнер .page — по нему строим размер PDF
    const pageElement = await page.$(".page");
    const box = await pageElement.boundingBox();

    const width = Math.ceil(box.width);
    const height = Math.ceil(box.height);

    // Устанавливаем Viewport точно под размер блока
    await page.setViewport({
      width,
      height,
      deviceScaleFactor: 2,
    });

    // Генерируем PDF — это будет одна "длинная страница"
    const pdfBuffer = await page.pdf({
      printBackground: true,
      width: `${width}px`,
      height: `${height}px`,
      preferCSSPageSize: false,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=cv.pdf");
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF generation error:", err);
    if (browser) await browser.close();
    res.status(500).send("Failed to generate PDF");
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// const express = require("express");
// const puppeteer = require("puppeteer");
// const path = require("path");

// const app = express();
// const PORT = process.env.PORT || 3000;

// // 1) Отдаём статику (index.html, style.css, картинки и т.д.)
// app.use(express.static(path.join(__dirname)));

// // 2) Роут для генерации PDF
// app.get("/generate-pdf", async (_req, res) => {
//   try {
//     const browser = await puppeteer.launch({
//       headless: "new", // или true, если ругается
//     });

//     const page = await browser.newPage();

//     // Загружаем твоё CV с этого же сервера
//     const cvUrl = `http://localhost:${PORT}/`;
//     await page.goto(cvUrl, {
//       waitUntil: "networkidle2",
//     });

//     // Используем экранные стили (две колонки)
//     await page.emulateMediaType("screen");

//     // Ждём, чтобы всё точно дорендерилось
//     await page.waitForTimeout(500);

//     // Берём размеры блока .page
//     const pageElement = await page.$(".page");
//     const box = await pageElement.boundingBox();

//     const width = Math.ceil(box.width);
//     const height = Math.ceil(box.height);

//     await page.setViewport({
//       width,
//       height,
//       deviceScaleFactor: 2, // чёткий текст
//     });

//     const pdfBuffer = await page.pdf({
//       printBackground: true,
//       width: `${width}px`,
//       height: `${height}px`,
//       preferCSSPageSize: false,
//     });

//     await browser.close();

//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader("Content-Disposition", "attachment; filename=cv.pdf");
//     res.send(pdfBuffer);
//   } catch (err) {
//     console.error("PDF generation error:", err);
//     res.status(500).send("Failed to generate PDF");
//   }
// });

// // 3) Стартуем сервер
// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });
