import { chromium } from "playwright";
import { join } from "node:path";
import { homedir } from "node:os";

const USER_DATA_DIR = join(homedir(), ".wedata-mcp", "chrome-data");

async function main() {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  });
  const page = context.pages()[0] || await context.newPage();

  console.log(">>> 访问运行性能页面...");
  await page.goto("https://wedata.weixin.qq.com/mp2/wxa-monitor-board/runtime", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(5000);

  // 抓取时序图区域的数据
  console.log("\n=== 页面切换耗时时序图（当前） ===");
  const seqData = await page.evaluate(() => {
    // 尝试从 sequence-chart 区域获取文本
    const chart = document.querySelector(".sequence-chart");
    const chartText = (chart as HTMLElement)?.innerText || "";

    // 获取 SVG 中的文本
    const svgTexts = Array.from(document.querySelectorAll("svg text"))
      .map(el => el.textContent?.trim() || "")
      .filter(Boolean);

    // 获取时序图相关的所有文本节点
    const allText = document.body.innerText;
    const seqSection = allText.match(
      /页面切换耗时时序图[\s\S]*?(?=页面切换耗时分析|各页面切换耗时)/
    )?.[0] || "";

    return { chartText, svgTexts: svgTexts.slice(0, 30), seqSection };
  });

  console.log("时序图区域文本:", seqData.seqSection);
  console.log("\nSVG文本:", JSON.stringify(seqData.svgTexts, null, 2));
  console.log("\nChart文本:", seqData.chartText);

  // 点击"同行对比"切换到 10%
  console.log("\n>>> 切换同行对比到 10%...");
  const compareBtn = page.locator('text=同行对比').first();
  await compareBtn.click();
  await page.waitForTimeout(1000);

  // 尝试找到 10% 选项并点击
  const option10 = page.locator('text=10%').first();
  await option10.click().catch(async () => {
    // 可能是下拉菜单
    console.log("尝试其他方式选择 10%...");
    await page.locator('[class*="dropdown"] >> text=10%').first().click();
  });
  await page.waitForTimeout(3000);

  console.log("\n=== 页面切换耗时时序图（含同行10%对比） ===");
  const seqData2 = await page.evaluate(() => {
    const svgTexts = Array.from(document.querySelectorAll("svg text"))
      .map(el => el.textContent?.trim() || "")
      .filter(Boolean);

    const allText = document.body.innerText;
    const seqSection = allText.match(
      /页面切换耗时时序图[\s\S]*?(?=页面切换耗时分析|各页面切换耗时)/
    )?.[0] || "";

    return { svgTexts: svgTexts.slice(0, 50), seqSection };
  });

  console.log("时序图区域文本:", seqData2.seqSection);
  console.log("\nSVG文本:", JSON.stringify(seqData2.svgTexts, null, 2));

  await context.close();
}

main();
