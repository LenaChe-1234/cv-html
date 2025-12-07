const puppeteer = require("puppeteer");

async function generatePdfFromUrl(url, outputPath) {
  const browser = await puppeteer.launch(); // Запуск браузера
  const page = await browser.newPage(); // Открытие новой вкладки

  await page.goto(url, { waitUntil: "networkidle2" }); // Переход на URL
  // или await page.setContent('<h1>Привет, мир!</h1><p>Это PDF.</p>'); // для загрузки своего HTML

  await page.pdf({
    path: outputPath,
    format: "A4", // Формат бумаги
    printBackground: true, // Печатать фон
    margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" }, // Отступы
  });

  await browser.close(); // Закрытие браузера
  console.log(`PDF сохранен в ${outputPath}`);
}

// Пример использования:
generatePdfFromUrl("https://www.google.com", "google.pdf"); // Печать с Google
// generatePdfFromUrl('http://localhost:8000', 'local.pdf'); // Печать локальной страницы
