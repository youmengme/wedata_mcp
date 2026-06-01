import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPage, navigateWithAuth, SessionExpiredError, BASE_URL } from "../browser/manager.js";

const URLS = {
  report: `${BASE_URL}/mp2/wxa-monitor-board/performance-report`,
  launch: `${BASE_URL}/mp2/wxa-monitor-board/launch`,
  launchOpen: `${BASE_URL}/mp2/wxa-monitor-board/launch/open`,
  launchCost: `${BASE_URL}/mp2/wxa-monitor-board/launch/cost`,
  launchDownload: `${BASE_URL}/mp2/wxa-monitor-board/launch/download`,
  network: `${BASE_URL}/mp2/wxa-monitor-board/network`,
  runtime: `${BASE_URL}/mp2/wxa-monitor-board/runtime`,
  tiyanOverview: `${BASE_URL}/mp2/wxa-monitor-board/tiyan/overview`,
  tiyanBlank: `${BASE_URL}/mp2/wxa-monitor-board/tiyan/page-blank`,
};

function sessionExpiredResponse() {
  return { content: [{ type: "text" as const, text: "登录态已过期，请先调用 login 工具扫码登录。" }] };
}

export function registerPerformanceTools(server: McpServer) {
  server.tool(
    "get_performance_report",
    "获取性能报告概览：综合评估、业务影响、核心指标、网络错误分布",
    {},
    async () => {
      const page = await navigateWithAuth(URLS.report);
      const text = await page.evaluate(() =>
        document.body.innerText.substring(0, 5000)
      );
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "get_launch_open_rate",
    "获取启动性能-打开率分析：冷启动打开漏斗、各场景打开率及流失、趋势",
    {},
    async () => {
      const page = await navigateWithAuth(URLS.launchOpen);
      const text = await page.evaluate(() =>
        document.body.innerText.substring(0, 5000)
      );
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "get_launch_cost",
    "获取启动性能-启动耗时分析：各阶段耗时、耗时分布、趋势",
    {},
    async () => {
      const page = await navigateWithAuth(URLS.launchCost);
      const text = await page.evaluate(() =>
        document.body.innerText.substring(0, 5000)
      );
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "get_launch_download",
    "获取启动性能-代码下载分析：代码包下载耗时、大小、趋势",
    {},
    async () => {
      const page = await navigateWithAuth(URLS.launchDownload);
      const text = await page.evaluate(() =>
        document.body.innerText.substring(0, 5000)
      );
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "get_network_performance",
    "获取网络性能：请求失败/异常概况、耗时概况、Top接口、失败类型分布",
    {},
    async () => {
      const page = await navigateWithAuth(URLS.network);
      const text = await page.evaluate(() =>
        document.body.innerText.substring(0, 5000)
      );
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "get_runtime_performance",
    "获取运行性能：页面切换耗时时序图（含同行top10%对比）、运行异常、内存分析",
    {},
    async () => {
      const page = await navigateWithAuth(URLS.runtime);

      // 切换同行对比到 top 10%
      await page.locator("text=同行对比").first().click();
      await page.waitForTimeout(500);
      await page.locator("text=10%").first().click();
      await page.waitForTimeout(3000);

      // hover 时序图条形获取各阶段耗时
      const bars = await page.evaluate(() => {
        const allSvgs = Array.from(document.querySelectorAll("svg"));
        const svg = allSvgs.find(s => s.textContent?.includes("处理路由"));
        if (!svg) return [];
        return Array.from(svg.querySelectorAll("rect"))
          .map(r => {
            const b = r.getBoundingClientRect();
            return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
          })
          .filter(r => r.w > 10 && r.h > 10 && r.h < 50);
      });

      const stages: string[] = [];
      for (const bar of bars) {
        await page.mouse.move(bar.x, bar.y);
        await page.waitForTimeout(400);
        const tip = await page.evaluate(() => {
          const all = document.querySelectorAll("*");
          for (const el of all) {
            const style = window.getComputedStyle(el);
            if (style.position === "absolute" || style.position === "fixed") {
              const text = (el as HTMLElement).innerText?.trim();
              if (text && text.includes("ms") && text.length < 100) return text;
            }
          }
          return "";
        });
        if (tip && !stages.includes(tip)) stages.push(tip);
      }
      // 移开鼠标
      await page.mouse.move(0, 0);

      // 获取页面其余数据
      const text = await page.evaluate(() =>
        document.body.innerText.substring(0, 5000)
      );

      const output = stages.length > 0
        ? `页面切换耗时时序图（含同行top10%对比）:\n${stages.join("\n")}\n\n${text}`
        : text;

      return { content: [{ type: "text", text: output }] };
    }
  );

  server.tool(
    "get_tiyan_overview",
    "获取体验性能概况：卡顿率、INP、CLS、愤怒点击、各页面明细",
    {},
    async () => {
      const page = await navigateWithAuth(URLS.tiyanOverview);
      const text = await page.evaluate(() =>
        document.body.innerText.substring(0, 5000)
      );
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "get_tiyan_blank_screen",
    "获取体验性能-白屏分析：白屏次数/占比、各页面白屏明细",
    {},
    async () => {
      const page = await navigateWithAuth(URLS.tiyanBlank);
      const text = await page.evaluate(() =>
        document.body.innerText.substring(0, 5000)
      );
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "get_weekly_performance_stats",
    "获取周性能统计数据：整体打开率、总启动耗时、请求处理耗时、请求错误率、页面切换耗时、异常退出率，及各指标的同类均值",
    {},
    async () => {
      const page = await navigateWithAuth(URLS.report);

      const data = await page.evaluate(() => {
        const body = document.body.innerText;

        const extract = (label: string, pattern: RegExp) => {
          const match = body.match(pattern);
          return match?.[1] || "";
        };

        // 整体打开率 + 同类
        const openRate = body.match(/整体打开率[\s\S]*?均值\s*\n\s*([\d.]+%)/)?.[1] || "";
        const openRateRef = body.match(/整体打开率[\s\S]*?同类均值：([\d.]+%)/)?.[1] || "";

        // 总启动耗时 + 同类
        const launchTime = body.match(/总启动耗时[\s\S]*?均值\s*\n\s*(\d+)ms/)?.[1] || "";
        const launchTimeRef = body.match(/总启动耗时[\s\S]*?同类均值：(\d+)ms/)?.[1] || "";

        // 请求处理耗时 + 同类
        const reqTime = body.match(/请求处理耗时[\s\S]*?均值\s*\n\s*(\d+)ms/)?.[1] || "";
        const reqTimeRef = body.match(/请求处理耗时[\s\S]*?同类均值：(\d+)ms/)?.[1] || "";

        // 请求错误率 + 同类
        const reqErr = body.match(/请求错误率[\s\S]*?均值\s*\n\s*([\d.]+%)/)?.[1] || "";
        const reqErrRef = body.match(/请求错误率[\s\S]*?同类均值：([\d.]+%)/)?.[1] || "";

        // 页面切换耗时 + 同类
        const switchTime = body.match(/页面切换耗时[\s\S]*?均值\s*\n\s*(\d+)ms/)?.[1] || "";
        const switchTimeRef = body.match(/页面切换耗时[\s\S]*?同类均值：(\d+)ms/)?.[1] || "";

        // 异常退出率 + 同类
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

      const output = [
        `整体打开率: ${data.openRate} | 同类: ${data.openRateRef}`,
        `总启动耗时: ${data.launchTime}ms | 同类: ${data.launchTimeRef}ms`,
        `请求处理耗时: ${data.reqTime}ms | 同类: ${data.reqTimeRef}ms`,
        `请求错误率: ${data.reqErr} | 同类: ${data.reqErrRef}`,
        `页面切换耗时: ${data.switchTime}ms | 同类: ${data.switchTimeRef}ms`,
        `异常退出率: ${data.exitRate} | 同类: ${data.exitRateRef}`,
      ].join("\n");

      return { content: [{ type: "text", text: output }] };
    }
  );
}
