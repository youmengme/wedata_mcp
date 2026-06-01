import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPage, launchBrowser, isLoggedIn, BASE_URL } from "../browser/manager.js";
import { Jimp } from "jimp";
import jsQR from "jsqr";
import qrcode from "qrcode-terminal";

async function decodeQR(base64: string): Promise<string | null> {
  const buffer = Buffer.from(base64, "base64");
  const image = await Jimp.read(buffer);
  const { width, height, data } = image.bitmap;
  const code = jsQR(new Uint8ClampedArray(data), width, height);
  return code?.data ?? null;
}

export function registerAuthTools(server: McpServer) {
  server.tool(
    "login",
    "发起微信小程序后台扫码登录，终端显示二维码",
    {},
    async () => {
      const page = await launchBrowser();
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      const qrImg = await page.waitForSelector(
        "img.weui-desktop-scan-login__qrcode", { timeout: 5000 }
      ).catch(() => null);

      if (!qrImg) {
        return { content: [{ type: "text", text: "已登录，无需扫码。" }] };
      }

      const src = await qrImg.getAttribute("src");
      if (!src) {
        return { content: [{ type: "text", text: "无法获取二维码" }] };
      }

      const fullUrl = src.startsWith("http")
        ? src : new URL(src, page.url()).toString();
      const resp = await page.request.get(fullUrl);
      const base64 = (await resp.body()).toString("base64");
      const qrData = await decodeQR(base64);

      if (qrData) {
        qrcode.generate(qrData, { small: true });
      }

      return {
        content: [
          { type: "text", text: "二维码已在终端显示，请用微信扫码。扫码并选择账号后调用 check_session 确认。" },
          { type: "image", data: base64, mimeType: "image/png" },
        ],
      };
    }
  );

  server.tool(
    "check_session",
    "检查当前浏览器是否已登录",
    {},
    async () => {
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        return { content: [{ type: "text", text: "已登录，可以正常使用。" }] };
      }
      return { content: [{ type: "text", text: "未登录，请先调用 login 扫码。" }] };
    }
  );
}
