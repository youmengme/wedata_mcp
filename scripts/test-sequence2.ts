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

  // 方法1: 检查 SVG rect 元素的属性
  console.log("\n=== SVG rect 元素 ===");
  const rects = await page.evaluate(() => {
    const svgRects = Array.from(document.querySelectorAll("svg rect"));
    return svgRects.map(r => ({
      x: r.getAttribute("x"),
      y: r.getAttribute("y"),
      width: r.getAttribute("width"),
      height: r.getAttribute("height"),
      fill: r.getAttribute("fill"),
      class: r.getAttribute("class"),
      title: r.querySelector("title")?.textContent || "",
      dataAttrs: Array.from(r.attributes)
        .filter(a => a.name.startsWith("data-"))
        .map(a => `${a.name}=${a.value}`),
    })).filter(r => parseFloat(r.width || "0") > 5 && parseFloat(r.height || "0") > 5);
  });
  console.log(JSON.stringify(rects.slice(0, 20), null, 2));

  // 方法2: hover 每个条形获取 tooltip
  console.log("\n=== Hover 获取 tooltip ===");
  const bars = await page.locator("svg rect").all();
  const tooltips: string[] = [];
  for (let i = 0; i < Math.min(bars.length, 20); i++) {
    const box = await bars[i].boundingBox();
    if (!box || box.width < 10 || box.height < 5) continue;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    const tip = await page.evaluate(() => {
      const tooltip = document.querySelector(
        "[class*='tooltip'], [class*='Tooltip'], [role='tooltip']"
      );
      return (tooltip as HTMLElement)?.innerText || "";
    });
    if (tip && !tooltips.includes(tip)) {
      tooltips.push(tip);
      console.log(`Bar ${i}: ${tip}`);
    }
  }

  // 方法3: 检查页面上是否有隐藏的数据表格
  console.log("\n=== 时序图下方文本 ===");
  const seqText = await page.evaluate(() => {
    const body = document.body.innerText;
    const match = body.match(/页面切换耗时时序图[\s\S]{0,2000}/);
    return match?.[0] || "";
  });
  console.log(seqText);

  await context.close();
}

main();
