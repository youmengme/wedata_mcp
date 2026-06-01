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

  await page.goto("https://wedata.weixin.qq.com/mp2/wxa-monitor-board/runtime", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(5000);

  // 找到时序图 SVG 容器
  const chartContainer = page.locator(".sequence-chart").first();
  const box = await chartContainer.boundingBox();
  if (!box) { console.log("找不到时序图容器"); return; }

  console.log("=== 逐个 hover 获取各阶段耗时 ===\n");

  // 获取所有有颜色的 rect（排除白色背景）
  const barData = await page.evaluate(() => {
    const svg = document.querySelector(".sequence-chart svg");
    if (!svg) return [];
    const rects = Array.from(svg.querySelectorAll("rect[data-v-4f55ea35]"));
    const colored = rects.filter(r => {
      const fill = r.getAttribute("fill") || "";
      return fill && fill !== "white" && !fill.includes("white");
    });
    return colored.map(r => {
      const rect = r.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width };
    });
  });

  console.log(`找到 ${barData.length} 个有色条形\n`);

  // hover 每个条形，获取出现的文本
  for (let i = 0; i < barData.length; i++) {
    const bar = barData[i];
    await page.mouse.move(bar.x, bar.y);
    await page.waitForTimeout(500);

    // 检查页面上新出现的 tooltip 或浮层文本
    const tipText = await page.evaluate(() => {
      // 检查各种可能的 tooltip 元素
      const selectors = [
        "[class*='tooltip']", "[class*='Tooltip']",
        "[class*='popover']", "[class*='tip']",
        "[role='tooltip']", ".sequence-chart [class*='info']",
        ".sequence-chart span",
      ];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const text = (el as HTMLElement).innerText?.trim();
          if (text && text.includes("ms")) return text;
        }
      }
      // 检查 sequence-chart 内的所有文本变化
      const chart = document.querySelector(".sequence-chart");
      const allText = (chart as HTMLElement)?.innerText || "";
      const msMatch = allText.match(/[\w一-鿿:]+\s*\n?\s*\d+\.?\d*ms/g);
      return msMatch ? msMatch.join(" | ") : "";
    });

    if (tipText) console.log(`Bar ${i}: ${tipText}`);
  }

  // 切换同行对比到 top 10%
  console.log("\n\n=== 切换同行对比到 top 10% ===\n");
  await page.locator("text=同行对比").first().click();
  await page.waitForTimeout(500);
  await page.locator("text=10%").first().click();
  await page.waitForTimeout(3000);

  // 再次获取时序图文本
  const seqText = await page.evaluate(() => {
    const body = document.body.innerText;
    const match = body.match(/页面切换耗时时序图[\s\S]*?(?=页面切换耗时分析)/);
    return match?.[0] || "";
  });
  console.log(seqText);

  await context.close();
}

main();
