// Serve an isolated Expo web export. No app/backend credentials or proxying.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("artifacts/test-web");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://localhost:8082");
    let path = resolve(root, "." + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    if ((await stat(path).catch(() => null))?.isDirectory())
      path = resolve(path, "index.html");
    if (!(await stat(path).catch(() => null))?.isFile() && !extname(path))
      path += ".html";
    // Expo exports dynamic route templates; serve that template on a direct post link.
    if (!(await stat(path).catch(() => null))?.isFile() && /^\/post\/[^/]+$/.test(url.pathname))
      path = resolve(root, "post/[id].html");
    const body = await readFile(path);
    response.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});
server.listen(8082, "localhost", () =>
  console.log("Isolated web export: http://localhost:8082"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => server.close(() => process.exit(0)));
