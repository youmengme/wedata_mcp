import { chromium, type BrowserContext, type Page } from "playwright";
import { Jimp } from "jimp";
import jsQR from "jsqr";
import qrcode from "qrcode-terminal";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const STORAGE_PATH = join(homedir(), ".wedata-mcp", "storage-state.json");

async function decodeQR(base64: string): Promise<string | null> {
  const buffer = Buffer.from(base64, "base64");
  const image = await Jimp.read(buffer);
  const { width, height, data } = image.bitmap;
  const code = jsQR(new Uint8ClampedArray(data), width, height);
  return code?.data ?? null;
}

async function ensureLogin(context: BrowserContext, page: Page) {
  await page.goto("https://wedata.weixin.qq.com/");
  // 检查是否已登录：如果没有出现二维码说明 session 有效
  const qrImg = await page.waitForSelector(
    "img.weui-desktop-scan-login__qrcode", { timeout: 5000 }
  ).catch(() => null);

  if (!qrImg) {
    console.log("已通过 storageState 恢复登录态，无需扫码。");
    return;
  }

  // 需要扫码登录
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
  // 等待二维码消失（登录成功后页面会跳转）
  await page.waitForSelector("img.weui-desktop-scan-login__qrcode", {
    state: "hidden", timeout: 120000,
  });
  await page.waitForTimeout(3000);

  // 保存登录态
  const { mkdirSync } = await import("node:fs");
  mkdirSync(join(homedir(), ".wedata-mcp"), { recursive: true });
  await context.storageState({ path: STORAGE_PATH });
  console.log(`登录态已保存到: ${STORAGE_PATH}`);
}

async function main() {
  const browser = await chromium.launch({ headless: false, channel: "chrome" });

  // 如果有保存的 storageState，加载它
  const contextOptions: any = { viewport: { width: 1440, height: 900 } };
  if (existsSync(STORAGE_PATH)) {
    contextOptions.storageState = STORAGE_PATH;
    console.log("检测到已保存的登录态，尝试恢复...");
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // 拦截 API 请求
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("/cgi/") || url.includes("/api/")) {
      const ct = response.headers()["content-type"] || "";
      if (!ct.includes("json") && !ct.includes("text")) return;
      console.log(`\n[API] ${response.status()} ${url}`);
      try {
        const body = await response.json();
        console.log(JSON.stringify(body, null, 2).substring(0, 1500));
        console.log("---");
      } catch {}
    }
  });

  await ensureLogin(context, page);

  // 导航到性能报告页面
  console.log("\n>>> 正在访问：性能报告...");
  await page.goto(
    "https://wedata.weixin.qq.com/mp2/wxa-monitor-board/performance-report",
    { waitUntil: "networkidle" }
  );
  await page.waitForTimeout(5000);
  console.log(">>> 页面加载完成。浏览器保持打开，按 Ctrl+C 退出。");

  await new Promise(() => {});
}

main();
