import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { navigateWithAuth, SessionExpiredError, BASE_URL } from "../browser/manager.js";

const JS_ERROR_URL = `${BASE_URL}/mp2/js-error-list`;

function sessionExpiredResponse() {
  return { content: [{ type: "text" as const, text: "登录态已过期，请先调用 login 工具扫码登录。" }] };
}

async function selectDropdown(page: any, label: string, value: string) {
  const filterRow = await page.locator(`text=${label}`).first();
  const dropdown = filterRow.locator("..").locator(
    ".weui-desktop-form__dropdowncascade__dt__value_ele, .weui-desktop-picker__value_text"
  ).first();
  await dropdown.click();
  await page.waitForTimeout(500);
  await page.locator(`.weui-desktop-dropdown__item:has-text("${value}")`).first().click();
  await page.waitForTimeout(1000);
}

async function applyFilters(page: any, opts: {
  time_range?: string;
  version?: string;
  error_type?: string;
  error_content?: string;
}) {
  const timeLabels: Record<string, string> = {
    past1day: "过去1天",
    past3days: "过去3天",
    past7days: "过去7天",
    past14days: "过去14天",
    past30days: "过去30天",
  };

  if (opts.time_range && opts.time_range !== "past7days") {
    try { await selectDropdown(page, "时间", timeLabels[opts.time_range]); } catch {}
    await page.waitForTimeout(2000);
  }
  if (opts.version) {
    try { await selectDropdown(page, "小程序版本", opts.version); } catch {}
    await page.waitForTimeout(2000);
  }
  if (opts.error_type) {
    try { await selectDropdown(page, "错误类型", opts.error_type); } catch {}
    await page.waitForTimeout(2000);
  }
  if (opts.error_content) {
    const input = page.locator('input[placeholder*="错误内容"], input[placeholder*="搜索"]').first();
    await input.fill(opts.error_content);
    await input.press("Enter");
    await page.waitForTimeout(2000);
  }
}

export function registerErrorTools(server: McpServer) {
  server.tool(
    "get_js_errors",
    "获取 JS 错误列表及影响面：错误内容、次数、占比、人数、人数占比",
    {
      time_range: z.enum(["past1day", "past3days", "past7days", "past14days", "past30days"])
        .default("past7days").describe("时间范围"),
      version: z.string().optional().describe("小程序版本号，如 '7.48.1'"),
      error_type: z.string().optional().describe("错误类型筛选"),
      error_content: z.string().optional().describe("按错误内容关键词搜索"),
    },
    async ({ time_range, version, error_type, error_content }) => {
      const page = await navigateWithAuth(JS_ERROR_URL);
      await applyFilters(page, { time_range, version, error_type, error_content });

      const text = await page.evaluate(() =>
        document.body.innerText.substring(0, 5000)
      );
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "get_js_error_detail",
    "查看某个 JS 错误的详情：筛选条件、错误内容/堆栈、错误人数、错误次数",
    {
      index: z.number().default(1).describe("错误列表中的序号，从1开始"),
      time_range: z.enum(["past1day", "past3days", "past7days", "past14days", "past30days"])
        .default("past7days").describe("时间范围"),
      version: z.string().optional().describe("小程序版本号"),
      error_type: z.string().optional().describe("错误类型筛选"),
      error_content: z.string().optional().describe("按错误内容关键词搜索"),
    },
    async ({ index, time_range, version, error_type, error_content }) => {
      const page = await navigateWithAuth(JS_ERROR_URL);
      await applyFilters(page, { time_range, version, error_type, error_content });

      const detailLinks = page.locator('text=查看详情');
      const count = await detailLinks.count();
      if (index > count) {
        return { content: [{ type: "text", text: `只有 ${count} 个错误，无法查看第 ${index} 个` }] };
      }
      await detailLinks.nth(index - 1).click();
      await page.waitForTimeout(5000);

      const data = await page.evaluate(() => {
        const values = Array.from(document.querySelectorAll(".js-error__value"))
          .map(el => el.textContent?.trim() || "");

        // 错误代码区域（错误内容+堆栈）
        const codeBlock = document.querySelector(".js-error__code, pre, code");
        const errorStack = codeBlock?.textContent?.trim()
          || document.body.innerText.match(/Script error[\s\S]*?(?=错误概览)/)?.[0]?.trim()
          || "";

        // 页面全文前部分提取筛选条件和关键信息
        const bodyText = document.body.innerText;
        const filterLine = bodyText.match(
          /\d{4}\/\d{2}\/\d{2}-\d{4}\/\d{2}\/\d{2}[^\n]*/
        )?.[0] || "";

        // 错误人数和错误次数
        const userCount = bodyText.match(/错误人数\s*\n?\s*(\S+)/)?.[1] || values[0] || "";
        const errorCount = bodyText.match(/错误次数\s*\n?\s*(\S+)/)?.[1] || values[1] || "";

        // 错误内容（在筛选条件和"错误概览"之间）
        const contentMatch = bodyText.match(
          /错误次数\s*\n\s*\d+\s*\n([\s\S]*?)(?=错误概览)/
        );
        const errorContent = contentMatch?.[1]?.trim() || "";

        return { filterLine, errorContent, userCount, errorCount };
      });

      const output = [
        `筛选条件: ${data.filterLine}`,
        `错误人数: ${data.userCount}`,
        `错误次数: ${data.errorCount}`,
        ``,
        `错误内容:`,
        data.errorContent,
      ].join("\n");

      return { content: [{ type: "text", text: output }] };
    }
  );

  server.tool(
    "get_js_error_distribution",
    "获取某个 JS 错误的分布数据：系统类型、客户端版本、基础库版本、设备类型的饼图分布",
    {
      index: z.number().default(1).describe("错误列表中的序号，从1开始"),
      time_range: z.enum(["past1day", "past3days", "past7days", "past14days", "past30days"])
        .default("past7days").describe("时间范围"),
      version: z.string().optional().describe("小程序版本号"),
    },
    async ({ index, time_range, version }) => {
      const page = await navigateWithAuth(JS_ERROR_URL);
      await applyFilters(page, { time_range, version });

      const detailLinks = page.locator('text=查看详情');
      const count = await detailLinks.count();
      if (index > count) {
        return { content: [{ type: "text", text: `只有 ${count} 个错误，无法查看第 ${index} 个` }] };
      }
      await detailLinks.nth(index - 1).click();
      await page.waitForTimeout(5000);

      // 点击"分布"按钮
      await page.locator('text=分布').first().click();
      await page.waitForTimeout(2000);

      const tabs = ["系统类型", "客户端版本", "基础库版本", "设备类型"];
      const results: string[] = [];

      for (const tab of tabs) {
        await page.locator(`text=${tab}`).first().click();
        await page.waitForTimeout(1500);

        const tabData = await page.evaluate((tabName: string) => {
          // 从 SVG text 元素提取饼图数据
          const svgTexts = Array.from(document.querySelectorAll("svg text"))
            .map(el => el.textContent?.trim() || "")
            .filter(t => t && t !== "");

          // 从图例区域提取
          const chartArea = document.querySelector(".js-error__piechart")
            || document.querySelector("[class*='piechart']");
          const chartText = (chartArea as HTMLElement)?.innerText || "";

          // 从页面文本中提取当前 tab 下的分布列表
          const body = document.body.innerText;
          const tabIdx = body.indexOf(tabName);
          if (tabIdx === -1) return { svgTexts, chartText: "" };

          const afterTab = body.substring(tabIdx + tabName.length, tabIdx + 1000);
          const lines = afterTab.split("\n").filter(l => l.trim()).slice(0, 15);
          return { svgTexts, chartText: lines.join("\n") };
        }, tab);

        results.push(`【${tab}】`);
        if (tabData.svgTexts.length > 0) {
          results.push(tabData.svgTexts.filter(t => !["错误人数", "错误次数"].includes(t)).join(", "));
        }
        if (tabData.chartText) {
          results.push(tabData.chartText);
        }
        results.push("");
      }

      return { content: [{ type: "text", text: results.join("\n") }] };
    }
  );
}
