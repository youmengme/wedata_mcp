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

  // 切换同行对比到 top 10%
  await page.locator("text=同行对比").first().click();
  await page.waitForTimeout(500);
  await page.locator("text=10%").first().click();
  await page.waitForTimeout(3000);

  // 用更宽泛的方式找到时序图区域并 hover 每个条形
  const results = await page.evaluate(() => {
    // 找到包含"页面切换耗时时序图"文本的区域
    const allSvgs = Array.from(document.querySelectorAll("svg"));
    // 时序图的 SVG 应该包含 "处理路由" 等文本
    const targetSvg = allSvgs.find(svg =>
      svg.textContent?.includes("处理路由")
    );
    if (!targetSvg) return { error: "找不到时序图SVG", svgCount: allSvgs.length };

    const rects = Array.from(targetSvg.querySelectorAll("rect"));
    const texts = Array.from(targetSvg.querySelectorAll("text"))
      .map(t => ({ content: t.textContent?.trim() || "", x: t.getBoundingClientRect().x, y: t.getBoundingClientRect().y }));

    // 获取有意义的 rect（高度>5, 宽度>5）
    const bars = rects
      .map(r => {
        const bbox = r.getBoundingClientRect();
        return {
          x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
          fill: r.getAttribute("fill") || window.getComputedStyle(r).fill,
        };
      })
      .filter(r => r.width > 10 && r.height > 10 && r.height < 50);

    return { bars, texts, svgBBox: targetSvg.getBoundingClientRect() };
  });

  if ("error" in results) {
    console.log(results.error, "SVG数量:", results.svgCount);
    await context.close();
    return;
  }

  console.log(`找到 ${results.bars.length} 个条形, ${results.texts.length} 个文本\n`);

  // hover 每个条形获取 tooltip
  const stages: string[] = [];
  for (const bar of results.bars) {
    await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
    await page.waitForTimeout(400);

    const tip = await page.evaluate(() => {
      // 查找任何包含 "ms" 的浮层
      const all = document.querySelectorAll("*");
      for (const el of all) {
        const style = window.getComputedStyle(el);
        if (style.position === "absolute" || style.position === "fixed") {
          const text = (el as HTMLElement).innerText?.trim();
          if (text && text.includes("ms") && text.length < 100) {
            return text;
          }
        }
      }
      return "";
    });
    if (tip && !stages.includes(tip)) {
      stages.push(tip);
      console.log(tip);
    }
  }

  if (stages.length === 0) {
    console.log("\n无法通过 hover 获取 tooltip，尝试从页面文本提取...");
    const pageText = await page.evaluate(() => {
      const body = document.body.innerText;
      return body.match(/页面切换耗时时序图[\s\S]*?(?=页面切换耗时分析)/)?.[0] || "";
    });
    console.log(pageText);
  }

  await context.close();
}

main();
