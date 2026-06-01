import { chromium } from "playwright";
import { join } from "node:path";
import { homedir } from "node:os";

const USER_DATA_DIR = join(homedir(), ".wedata-mcp", "chrome-data");

const PAGES = [
  { name: "启动性能", url: "https://wedata.weixin.qq.com/mp2/wxa-monitor-board/launch" },
  { name: "网络性能", url: "https://wedata.weixin.qq.com/mp2/wxa-monitor-board/network" },
  { name: "运行性能", url: "https://wedata.weixin.qq.com/mp2/wxa-monitor-board/runtime" },
  { name: "体验性能-概况", url: "https://wedata.weixin.qq.com/mp2/wxa-monitor-board/tiyan/overview" },
  { name: "体验性能-白屏", url: "https://wedata.weixin.qq.com/mp2/wxa-monitor-board/tiyan/page-blank" },
];

async function main() {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  });
  const page = context.pages()[0] || await context.newPage();

  // 探索 JS 错误详情页 - 分布 Tab
  console.log(`\n>>> 访问 JS 错误列表并进入详情页...`);
  await page.goto("https://wedata.weixin.qq.com/mp2/js-error-list", { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);

  // 点击第一个"查看详情"
  const detailLink = page.locator('text=查看详情').first();
  await detailLink.click();
  await page.waitForTimeout(5000);

  // 点击"分布"按钮
  console.log(">>> 点击'分布'按钮...");
  await page.locator('text=分布').first().click();
  await page.waitForTimeout(2000);

  // 遍历每个 Tab 并抓取数据
  const tabs = ["系统类型", "客户端版本", "基础库版本", "设备类型"];
  for (const tab of tabs) {
    console.log(`\n>>> 切换到 Tab: ${tab}`);
    await page.locator(`.js-error__chart-type >> text=${tab}`).click().catch(async () => {
      await page.locator(`text=${tab}`).nth(0).click();
    });
    await page.waitForTimeout(2000);

    const tabData = await page.evaluate(() => {
      // 尝试获取饼图/图表区域的文本
      const chartArea = document.querySelector(".js-error__piechart")
        || document.querySelector("[class*='piechart']");
      const chartText = chartArea?.innerText || "";
      // 获取图例/标签
      const legends = Array.from(document.querySelectorAll("[class*='legend'], [class*='label']"))
        .map(el => (el as HTMLElement).innerText?.trim())
        .filter(Boolean).slice(0, 20);
      return { chartText, legends };
    });
    console.log(`图表文本: ${tabData.chartText.substring(0, 500)}`);
    console.log(`图例: ${JSON.stringify(tabData.legends)}`);
  }

  console.log("\n>>> URL:", page.url());

  const content = await page.evaluate(() => {
    const result: Record<string, string[]> = {};

    result["headers"] = Array.from(
      document.querySelectorAll("h2, h3, h4, .card-title, .title")
    ).map(el => el.textContent?.trim() || "").filter(Boolean);

    result["classes"] = Array.from(
      new Set(
        Array.from(document.querySelectorAll("[class]"))
          .flatMap(el => Array.from(el.classList))
          .filter(c => c.includes("val") || c.includes("num")
            || c.includes("metric") || c.includes("chart")
            || c.includes("table") || c.includes("card"))
      )
    ).slice(0, 50);

    const body = document.body.innerText.substring(0, 5000);
    result["bodyText"] = [body];
    return result;
  });

  console.log("\n=== Headers ===");
  console.log(JSON.stringify(content.headers, null, 2));
  console.log("\n=== 相关 CSS Classes ===");
  console.log(JSON.stringify(content.classes, null, 2));
  console.log("\n=== 页面文本 ===");
  console.log(content.bodyText[0]);

  console.log("\n>>> 完成。按 Ctrl+C 退出。");
  await new Promise(() => {});
}

main();
