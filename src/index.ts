#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAuthTools } from "./tools/auth.js";
import { registerPerformanceTools } from "./tools/performance.js";
import { registerErrorTools } from "./tools/error.js";

const server = new McpServer({
  name: "wedata-mcp",
  version: "0.1.0",
});

registerAuthTools(server);
registerPerformanceTools(server);
registerErrorTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
