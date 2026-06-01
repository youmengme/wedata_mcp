import { chromium, type BrowserContext, type Page } from "playwright";
import { join } from "node:path";
import { homedir } from "node:os";

const USER_DATA_DIR = join(homedir(), ".wedata-mcp", "chrome-data");

let context: BrowserContext | null = null;
let page: Page | null = null;

export async function launchBrowser(): Promise<Page> {
  if (page && !page.isClosed()) return page;

  context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  });

  page = context.pages()[0] || await context.newPage();
  return page;
}

export async function getPage(): Promise<Page> {
  if (!page || page.isClosed()) {
    return launchBrowser();
  }
  return page;
}

export async function isLoggedIn(): Promise<boolean> {
  const p = await getPage();
  await p.goto("https://wedata.weixin.qq.com/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2000);
  const qr = await p.waitForSelector(
    "img.weui-desktop-scan-login__qrcode", { timeout: 3000 }
  ).catch(() => null);
  return qr === null;
}

export class SessionExpiredError extends Error {
  constructor() {
    super("登录态已过期，请先调用 login 工具扫码登录。");
    this.name = "SessionExpiredError";
  }
}

export async function navigateWithAuth(url: string): Promise<Page> {
  const p = await getPage();
  await p.goto(url, { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  if (p.url().includes("/login")) {
    throw new SessionExpiredError();
  }
  return p;
}

export const BASE_URL = "https://wedata.weixin.qq.com";
