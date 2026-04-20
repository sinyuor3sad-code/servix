const http = require("http");
const https = require("https");

const TARGET = "orange-morning-06c4.sinyuor3sad.workers.dev";

http.createServer((req, res) => {
  // Get API key from header (n8n sends it as x-goog-api-key)
  const apiKey = req.headers["x-goog-api-key"] || "";

  // Add key as query parameter
  const separator = req.url.includes("?") ? "&" : "?";
  const targetPath = apiKey ? `${req.url}${separator}key=${apiKey}` : req.url;

  let body = [];
  req.on("data", chunk => body.push(chunk));
  req.on("end", () => {
    const options = {
      hostname: TARGET,
      path: targetPath,
      method: req.method,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        "Accept": req.headers["accept"] || "*/*",
      },
    };

    const proxy = https.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxy.on("error", err => {
      console.error("Proxy error:", err.message);
      res.writeHead(502);
      res.end("Proxy error");
    });

    if (body.length > 0) proxy.write(Buffer.concat(body));
    proxy.end();
  });
}).listen(8080, () => console.log("Gemini proxy running on :8080"));
