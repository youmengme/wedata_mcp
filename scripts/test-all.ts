import { chromium } from "playwright";
import { join } from "node:path";
import { homedir } from "node:os";

const USER_DATA_DIR = join(homedir(), ".wedata-mcp", "chrome-data");
const BASE = "https://wedata.weixin.qq.com";

const TOOLS: Record<string, string> = {
  get_performance_report: `${BASE}/mp2/wxa-monitor-board/performance-report`,
  get_launch_open_rate: `${BASE}/mp2/wxa-monitor-board/launch/open`,
  get_launch_cost: `${BASE}/mp2/wxa-monitor-board/launch/cost`,
  get_launch_download: `${BASE}/mp2/wxa-monitor-board/launch/download`,
  get_network_performance: `${BASE}/mp2/wxa-monitor-board/network`,
  get_runtime_performance: `${BASE}/mp2/wxa-monitor-board/runtime`,
  get_tiyan_overview: `${BASE}/mp2/wxa-monitor-board/tiyan/overview`,
  get_tiyan_blank_screen: `${BASE}/mp2/wxa-monitor-board/tiyan/page-blank`,
  get_js_errors: `${BASE}/mp2/js-error-list`,
};

async function main() {
  const toolName = process.argv[2];
  if (!toolName || !TOOLS[toolName]) {
    console.log("用法: npx tsx scripts/test-all.ts <tool_name>");
    console.log("可用:", Object.keys(TOOLS).join(", "));
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  });
  const page = context.pages()[0] || await context.newPage();

  console.log(`\n=== ${toolName} ===\n`);
  await page.goto(TOOLS[toolName], { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);

  const text = await page.evaluate(() =>
    document.body.innerText.substring(0, 5000)
  );
  console.log(text);

  await context.close();
}

main();
