const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = 8080;
const HOST = "0.0.0.0";

// MIME types for serving frontend files
const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// Path to the frontend directory
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");

// Create HTTP server that serves frontend files
const httpServer = http.createServer((req, res) => {
  // Map "/" to "/index.html"
  let filePath = req.url === "/" ? "/index.html" : req.url;

  // Prevent directory traversal
  filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");

  const fullPath = path.join(FRONTEND_DIR, filePath);
  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

// Attach WebSocket server to the HTTP server
const wss = new WebSocket.Server({ server: httpServer });

httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Frontend: http://<YOUR-IP>:${PORT}`);
  console.log(`WebSocket: ws://<YOUR-IP>:${PORT}`);
});

// Track connected clients by type
const clients = {
  frontend: new Set(),
  extension: new Set(),
};

wss.on("connection", (ws) => {
  let clientType = null;

  console.log("New connection established");

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw);
    } catch (err) {
      console.error("Invalid JSON received:", raw.toString());
      return;
    }

    // Register client type on first message
    if (!clientType && message.client) {
      clientType = message.client;
      if (clients[clientType]) {
        clients[clientType].add(ws);
        console.log(`Client registered as: ${clientType}`);
        console.log(
          `Connected clients — frontends: ${clients.frontend.size}, extensions: ${clients.extension.size}`
        );
      } else {
        console.warn(`Unknown client type: ${clientType}`);
      }
    }

    // Forward frontend messages to all extensions
    if (message.client === "frontend" && message.type === "COMMAND") {
      console.log(`Forwarding command: ${message.payload}`);
      clients.extension.forEach((ext) => {
        if (ext.readyState === WebSocket.OPEN) {
          ext.send(JSON.stringify(message));
        }
      });
    }
  });

  ws.on("close", () => {
    if (clientType && clients[clientType]) {
      clients[clientType].delete(ws);
      console.log(`Client disconnected: ${clientType}`);
      console.log(
        `Connected clients — frontends: ${clients.frontend.size}, extensions: ${clients.extension.size}`
      );
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });
});
