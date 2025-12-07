const puppeteer = require("puppeteer");

async function generatePdfFromUrl(url, outputPath) {
  const browser = await puppeteer.launch({
    headless: "new", // или true, в зависимости от версии
  });

  const page = await browser.newPage();

  // Открываем твоё CV
  await page.goto(url, {
    waitUntil: "networkidle2",
  });

  // Используем стили для ЭКРАНА, а не print
  await page.emulateMediaType("screen");

  // Ждём, пока всё дорендерится (шрифты, картинки и т.п.)
  await page.waitForTimeout(1000);

  // Находим основной блок с резюме
  const pageElement = await page.$(".page");
  const boundingBox = await pageElement.boundingBox();

  const width = Math.ceil(boundingBox.width);
  const height = Math.ceil(boundingBox.height);

  // Настраиваем viewport под размер твоего блока .page
  await page.setViewport({
    width,
    height,
    deviceScaleFactor: 2, // более чёткий PDF
  });

  // Генерируем PDF ровно по размеру контента
  await page.pdf({
    path: outputPath,
    width: `${width}px`,
    height: `${height}px`,
    printBackground: true,
    pageRanges: "1", // одна "страница" PDF
    preferCSSPageSize: false, // используем width/height, а не @page
  });

  await browser.close();
  console.log(`PDF saved to ${outputPath}`);
}

// Пример использования:
generatePdfFromUrl("http://localhost:8000", "cv-two-column.pdf");
