import { chromium } from "playwright";
import { join } from "node:path";
import { homedir } from "node:os";

const USER_DATA_DIR = join(homedir(), ".wedata-mcp", "chrome-data");

async function main() {
  const toolName = process.argv[2] || "check_session";
  console.log(`\n>>> 测试工具: ${toolName}\n`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  });
  const page = context.pages()[0] || await context.newPage();

  if (toolName === "check_session") {
    await page.goto("https://wedata.weixin.qq.com/");
    await page.waitForTimeout(3000);
    const qr = await page.waitForSelector(
      "img.weui-desktop-scan-login__qrcode", { timeout: 3000 }
    ).catch(() => null);
    console.log(qr ? "未登录" : "已登录");

  } else if (toolName === "get_performance_report") {
    await page.goto("https://wedata.weixin.qq.com/mp2/wxa-monitor-board/performance-report", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(3000);
    const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log(text);

  } else if (toolName === "get_js_errors") {
    await page.goto("https://wedata.weixin.qq.com/mp2/js-error-list", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(5000);
    const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log(text);

  } else if (toolName === "get_js_error_detail") {
    await page.goto("https://wedata.weixin.qq.com/mp2/js-error-list", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(5000);
    await page.locator("text=查看详情").first().click();
    await page.waitForTimeout(5000);
    const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log(text);
  }

  console.log("\n>>> 测试完成。按 Ctrl+C 退出。");
  await new Promise(() => {});
}

main();
