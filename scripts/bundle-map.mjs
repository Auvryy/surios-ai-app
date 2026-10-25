// Pin and ship Leaflet locally. Map rendering never downloads executable code.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const pkg = JSON.parse(
  await readFile(
    new URL("../node_modules/leaflet/package.json", import.meta.url),
    "utf8",
  ),
);
if (pkg.version !== "1.9.4")
  throw new Error("Review the map bridge before upgrading Leaflet.");
const dist = new URL("../node_modules/leaflet/dist/", import.meta.url);
const output = new URL("../assets/map/", import.meta.url);
await mkdir(output, { recursive: true });
const js = (await readFile(new URL("leaflet.js", dist), "utf8")).replace(
  /\/\/# sourceMappingURL=.*/g,
  "",
);
const css = await readFile(new URL("leaflet.css", dist), "utf8");
await writeFile(
  new URL("leaflet.json", output),
  JSON.stringify({ version: pkg.version, js, css }) + "\n",
);
await writeFile(
  new URL("LEAFLET-LICENSE.txt", output),
  await readFile(new URL("../node_modules/leaflet/LICENSE", import.meta.url)),
);
console.log(`Bundled Leaflet ${pkg.version} with its license.`);
