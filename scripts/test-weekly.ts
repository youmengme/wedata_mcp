import { chromium } from "playwright";
import { join } from "node:path";
import { homedir } from "node:os";

const USER_DATA_DIR = join(homedir(), ".wedata-mcp", "chrome-data");
const BASE = "https://wedata.weixin.qq.com";

async function main() {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  });
  const page = context.pages()[0] || await context.newPage();

  console.log("=== get_weekly_performance_stats ===\n");
  await page.goto(`${BASE}/mp2/wxa-monitor-board/performance-report`, { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);

  const data = await page.evaluate(() => {
    const body = document.body.innerText;

    const openRate = body.match(/整体打开率[\s\S]*?均值\s*\n\s*([\d.]+%)/)?.[1] || "";
    const openRateRef = body.match(/整体打开率[\s\S]*?同类均值：([\d.]+%)/)?.[1] || "";
    const launchTime = body.match(/总启动耗时[\s\S]*?均值\s*\n\s*(\d+)ms/)?.[1] || "";
    const launchTimeRef = body.match(/总启动耗时[\s\S]*?同类均值：(\d+)ms/)?.[1] || "";
    const reqTime = body.match(/请求处理耗时[\s\S]*?均值\s*\n\s*(\d+)ms/)?.[1] || "";
    const reqTimeRef = body.match(/请求处理耗时[\s\S]*?同类均值：(\d+)ms/)?.[1] || "";
    const reqErr = body.match(/请求错误率[\s\S]*?均值\s*\n\s*([\d.]+%)/)?.[1] || "";
    const reqErrRef = body.match(/请求错误率[\s\S]*?同类均值：([\d.]+%)/)?.[1] || "";
    const switchTime = body.match(/页面切换耗时[\s\S]*?均值\s*\n\s*(\d+)ms/)?.[1] || "";
    const switchTimeRef = body.match(/页面切换耗时[\s\S]*?同类均值：(\d+)ms/)?.[1] || "";
    const exitRate = body.match(/异常退出率[\s\S]*?均值\s*\n\s*([\d.]+%)/)?.[1] || "";
    const exitRateRef = body.match(/异常退出率[\s\S]*?同类均值：([\d.]+%)/)?.[1] || "";

    return {
      openRate, openRateRef,
      launchTime, launchTimeRef,
      reqTime, reqTimeRef,
      reqErr, reqErrRef,
      switchTime, switchTimeRef,
      exitRate, exitRateRef,
    };
  });

  console.log(`整体打开率: ${data.openRate} | 同类: ${data.openRateRef}`);
  console.log(`总启动耗时: ${data.launchTime}ms | 同类: ${data.launchTimeRef}ms`);
  console.log(`请求处理耗时: ${data.reqTime}ms | 同类: ${data.reqTimeRef}ms`);
  console.log(`请求错误率: ${data.reqErr} | 同类: ${data.reqErrRef}`);
  console.log(`页面切换耗时: ${data.switchTime}ms | 同类: ${data.switchTimeRef}ms`);
  console.log(`异常退出率: ${data.exitRate} | 同类: ${data.exitRateRef}`);

  await context.close();
}

main();
