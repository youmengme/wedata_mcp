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

  // 先切换同行对比到 top 10%
  await page.locator("text=同行对比").first().click();
  await page.waitForTimeout(500);
  await page.locator("text=10%").first().click();
  await page.waitForTimeout(3000);

  // 从 SVG 提取所有 rect 的位置和尺寸，以及 text 标签
  const chartData = await page.evaluate(() => {
    const container = document.querySelector(".sequence-chart");
    if (!container) return null;

    const svg = container.querySelector("svg");
    if (!svg) return null;

    // 获取所有 g 元素（每行一个 g）
    const groups = Array.from(svg.querySelectorAll("g"));

    // 获取所有 text 元素
    const texts = Array.from(svg.querySelectorAll("text"))
      .map(t => ({ text: t.textContent?.trim() || "", x: parseFloat(t.getAttribute("x") || "0"), y: parseFloat(t.getAttribute("y") || "0") }));

    // 获取所有 rect 元素及其属性
    const rects = Array.from(svg.querySelectorAll("rect"))
      .map(r => ({
        x: parseFloat(r.getAttribute("x") || "0"),
        y: parseFloat(r.getAttribute("y") || "0"),
        width: parseFloat(r.getAttribute("width") || "0"),
        height: parseFloat(r.getAttribute("height") || "0"),
        fill: r.getAttribute("fill") || window.getComputedStyle(r).fill || "",
        transform: r.parentElement?.getAttribute("transform") || "",
      }))
      .filter(r => r.width > 5 && r.height > 5);

    // 获取时间轴总时间
    const timeText = container.textContent || "";
    const totalTimeMatch = timeText.match(/(\d+)ms\s*$/);
    const totalTime = totalTimeMatch ? parseInt(totalTimeMatch[1]) : 854;

    return { texts, rects, totalTime, html: container.innerHTML.substring(0, 3000) };
  });

  if (!chartData) { console.log("找不到时序图"); return; }

  console.log("总时间:", chartData.totalTime, "ms");
  console.log("\n=== SVG Texts ===");
  console.log(JSON.stringify(chartData.texts.filter(t => t.text), null, 2));
  console.log("\n=== Rects (前30个) ===");
  console.log(JSON.stringify(chartData.rects.slice(0, 30), null, 2));
  console.log("\n=== HTML片段 ===");
  console.log(chartData.html);

  await context.close();
}

main();
