import { chromium } from "playwright";
import { Jimp } from "jimp";
import jsQR from "jsqr";
import qrcode from "qrcode-terminal";
import { join } from "node:path";
import { homedir } from "node:os";

const USER_DATA_DIR = join(homedir(), ".wedata-mcp", "chrome-data");

async function decodeQR(base64: string): Promise<string | null> {
  const buffer = Buffer.from(base64, "base64");
  const image = await Jimp.read(buffer);
  const { width, height, data } = image.bitmap;
  const code = jsQR(new Uint8ClampedArray(data), width, height);
  return code?.data ?? null;
}

async function main() {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  });

  const page = context.pages()[0] || await context.newPage();

  // 先访问首页检查登录态
  await page.goto("https://wedata.weixin.qq.com/");
  await page.waitForTimeout(3000);

  const qrImg = await page.waitForSelector(
    "img.weui-desktop-scan-login__qrcode", { timeout: 5000 }
  ).catch(() => null);

  if (qrImg) {
    const src = await qrImg.getAttribute("src");
    if (src) {
      const fullUrl = src.startsWith("http")
        ? src : new URL(src, page.url()).toString();
      const resp = await page.request.get(fullUrl);
      const base64 = (await resp.body()).toString("base64");
      const qrData = await decodeQR(base64);
      if (qrData) {
        console.log("\n请用微信扫描二维码登录：\n");
        qrcode.generate(qrData, { small: true });
      }
    }
    console.log("\n等待扫码登录...");
    // 等待 URL 离开登录页（选择账号后才会跳转）
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 120000,
    });
    await page.waitForTimeout(3000);
    console.log("登录成功！当前 URL:", page.url());
  } else {
    console.log("已登录，无需扫码。");
  }

  // 导航到性能报告页面
  console.log("\n>>> 访问性能报告页面...");
  await page.goto(
    "https://wedata.weixin.qq.com/mp2/wxa-monitor-board/performance-report",
    { waitUntil: "networkidle" }
  );
  await page.waitForTimeout(5000);

  console.log(">>> 页面标题:", await page.title());
  console.log(">>> 当前 URL:", page.url());

  // 抓取页面渲染后的内容
  const content = await page.evaluate(() => {
    const result: Record<string, string[]> = {};
    const headers = document.querySelectorAll("h2, h3, .card-title, .title");
    result["headers"] = Array.from(headers).map(el => el.textContent?.trim() || "");

    const numbers = document.querySelectorAll(
      ".number, .value, .metric-value, [class*='num'], [class*='value']"
    );
    result["numbers"] = Array.from(numbers)
      .map(el => `${el.className}: ${el.textContent?.trim()}`)
      .filter(s => s.length < 200).slice(0, 50);

    const tables = document.querySelectorAll("table");
    result["tables"] = Array.from(tables).map(table => {
      const rows = table.querySelectorAll("tr");
      return Array.from(rows).map(row =>
        Array.from(row.querySelectorAll("td, th"))
          .map(cell => cell.textContent?.trim()).join(" | ")
      ).join("\n");
    });

    const body = document.querySelector(
      ".main-content, .page-content, main, .app-content"
    );
    result["bodyText"] = [(body || document.body).innerText.substring(0, 3000)];
    return result;
  });

  console.log("\n=== Headers ===");
  console.log(JSON.stringify(content.headers, null, 2));
  console.log("\n=== 数值 ===");
  console.log(JSON.stringify(content.numbers, null, 2));
  console.log("\n=== 表格 ===");
  content.tables.forEach((t, i) => console.log(`表格${i}:\n${t}\n`));
  console.log("\n=== 页面文本(前3000字) ===");
  console.log(content.bodyText[0]);

  console.log("\n>>> 完成。按 Ctrl+C 退出。");
  await new Promise(() => {});
}

main();
