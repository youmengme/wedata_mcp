import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SESSION_DIR = join(homedir(), ".wedata-mcp");
const SESSION_FILE = join(SESSION_DIR, "session.json");

export interface SessionData {
  cookies: string;
  token: string;
  appId: string;
  expireAt: number;
}

export function loadSession(): SessionData | null {
  if (!existsSync(SESSION_FILE)) return null;
  try {
    const data = JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
    if (data.expireAt && Date.now() > data.expireAt) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionData): void {
  mkdirSync(SESSION_DIR, { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

export function clearSession(): void {
  if (existsSync(SESSION_FILE)) {
    unlinkSync(SESSION_FILE);
  }
}
