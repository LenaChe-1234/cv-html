"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 3000;
app.set("trust proxy", 1);
const publicDir = path_1.default.join(process.cwd(), "public");
// serve static files from /public
app.use(express_1.default.static(publicDir));
// root route (optional but good)
app.get("/", (_req, res) => {
    res.sendFile(path_1.default.join(publicDir, "index.html"));
});
// helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
app.get("/generate-pdf", async (req, res) => {
    const targetUrl = String(req.query.url || "").trim();
    if (!targetUrl) {
        res.statusCode = 400;
        res.send("Missing required query param: ?url=");
        return;
    }
    // ===== URL allowlist validation =====
    let parsed;
    try {
        parsed = new URL(targetUrl);
    }
    catch {
        res.statusCode = 400;
        res.send("Invalid URL");
        return;
    }
    const allowedHost = "lenache-1234.github.io";
    const allowedPathPrefix = "/cv-html/";
    if (parsed.protocol !== "https:" ||
        parsed.hostname !== allowedHost ||
        !parsed.pathname.startsWith(allowedPathPrefix)) {
        res.statusCode = 403;
        res.send("URL not allowed");
        return;
    }
    // ===== END allowlist =====
    let browser = null;
    try {
        browser = await puppeteer_1.default.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });
        const page = await browser.newPage();
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
            if (document.fonts?.ready)
                await document.fonts.ready;
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
    }
    catch (err) {
        const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
        console.error("PDF generation error:", message);
        res.statusCode = 500;
        res.send(message);
    }
    finally {
        await browser?.close().catch(() => { });
    }
});
app.listen(PORT, () => {
    console.log(`Server running at http://127.0.0.1:${PORT}`);
});
