const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

const plans = {
  free: { name: "Free Starter", price: 0, allowance: 10 },
  standard: { name: "StudyPal Standard", price: 99, allowance: 200 },
  owner: { name: "Owner Access", price: 0, allowance: null }
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function serveFile(res, filePath, type) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, JSON.stringify({ error: "Not found" }));
    send(res, 200, data, type);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/healthz") {
    return send(res, 200, JSON.stringify({
      status: "ok",
      service: "studypal",
      version: "0.1.0"
    }));
  }

  if (url.pathname === "/api/plans") {
    return send(res, 200, JSON.stringify(plans));
  }

  if (url.pathname === "/api/platform") {
    return send(res, 200, JSON.stringify({
      brand: "StudyPal",
      tagline: "Your 24/7 Learning Companion",
      promise: "Any Subject. Any Curriculum. Any Language.",
      infrastructure: "IZAKHONO",
      payments: "IZAKHONO Pay adapter planned",
      auth: "IZAKHONO auth adapter planned",
      storage: "IZAKHONO object storage adapter planned",
      ai: "Provider-agnostic server adapter planned"
    }));
  }

  if (url.pathname === "/styles.css") {
    return serveFile(res, path.join(publicDir, "styles.css"), "text/css; charset=utf-8");
  }

  if (url.pathname === "/app.js") {
    return serveFile(res, path.join(publicDir, "app.js"), "application/javascript; charset=utf-8");
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return serveFile(res, path.join(publicDir, "index.html"), "text/html; charset=utf-8");
  }

  return send(res, 404, JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`StudyPal listening on port ${PORT}`);
});
