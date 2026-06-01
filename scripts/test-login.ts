import { chromium } from "playwright";
import { Jimp } from "jimp";
import jsQR from "jsqr";
import qrcode from "qrcode-terminal";

async function decodeQRFromBase64(base64: string): Promise<string | null> {
  const buffer = Buffer.from(base64, "base64");
  const image = await Jimp.read(buffer);
  const { width, height, data } = image.bitmap;
  const code = jsQR(new Uint8ClampedArray(data), width, height);
  return code?.data ?? null;
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  await page.goto("https://wedata.weixin.qq.com/");

  console.log("等待二维码加载...");

  const qrImg = await page.waitForSelector("img.weui-desktop-scan-login__qrcode", {
    timeout: 15000,
  });

  const src = await qrImg.getAttribute("src");
  console.log("二维码 src:", src?.substring(0, 80));
  let base64: string | null = null;

  if (src && src.startsWith("data:image")) {
    base64 = src.split(",")[1];
  } else if (src) {
    const fullUrl = src.startsWith("http") ? src : new URL(src, page.url()).toString();
    const resp = await page.request.get(fullUrl);
    const buffer = await resp.body();
    base64 = buffer.toString("base64");
  }

  if (base64) {
    const qrData = await decodeQRFromBase64(base64);
    if (qrData) {
      console.log("\n请用微信扫描以下二维码登录：\n");
      qrcode.generate(qrData, { small: true });
    } else {
      console.log("二维码解码失败，请在浏览器窗口中扫码。");
    }
  } else {
    console.log("无法获取二维码图片，请在浏览器窗口中扫码。");
  }

  console.log("\n登录完成后按 Ctrl+C 退出（浏览器保持打开）。");
  await new Promise(() => {});
}

main();
