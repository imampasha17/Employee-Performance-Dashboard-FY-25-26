import { createServer } from "./server.js";
import fs from "fs";

export default async function handler(req: any, res: any) {
  // Direct ping route that doesn't depend on server.ts logic
  if (req.url?.includes("/api/ping")) {
    return res.status(200).json({ 
      status: "ok", 
      message: "Vercel handler is alive (direct)",
      time: new Date().toISOString(),
      cwd: process.cwd(),
      files: fs.readdirSync(process.cwd()),
      apiFiles: fs.existsSync("./api") ? fs.readdirSync("./api") : "no api dir"
    });
  }

  console.log("Vercel Handler started:", req.method, req.url);
  try {
    console.log("Calling createServer...");
    const app = await createServer();
    console.log("Executing request...");
    return app(req, res);
  } catch (err: any) {
    console.error("CRITICAL Vercel Handler Error:", err);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ 
        error: "CRITICAL_SERVER_ERROR", 
        message: err.message,
        stack: err.stack,
        hint: "Check Vercel logs for more details"
      });
    }
  }
}
