// Deterministic platform exports from the committed Orie raster master.
// Uses dependencies already supplied by the locked Expo toolchain; no service calls.
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const imageRequire = createRequire(require.resolve("@expo/image-utils"));
const { PNG } = imageRequire("pngjs");
const { generateImageAsync } = require("@expo/image-utils");
const root = fileURLToPath(new URL("../", import.meta.url));
const scratch = path.join(root, "artifacts/branding");
const output = path.join(root, "assets/images");
const ORANGE = [201, 61, 0];
const WHITE = [255, 255, 255];
await mkdir(scratch, { recursive: true });
await mkdir(output, { recursive: true });

const master = PNG.sync.read(
  await readFile(path.join(root, "assets/brand/orie-mark.png")),
);
// Keep substantial alpha components (the outline/brows and two pupils), omitting
// isolated generation dust. This normalizes a production mask, not its geometry.
const { width, height } = master;
const visited = new Uint8Array(width * height);
const mask = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
const minimumArea = Math.max(24, Math.ceil(width * height * 0.0002));
let kept = 0;
for (let start = 0; start < visited.length; start++) {
  if (visited[start] || master.data[start * 4 + 3] < 32) continue;
  let head = 0,
    tail = 1;
  queue[0] = start;
  visited[start] = 1;
  while (head < tail) {
    const index = queue[head++],
      x = index % width,
      y = Math.floor(index / width);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (
          (!dx && !dy) ||
          x + dx < 0 ||
          x + dx >= width ||
          y + dy < 0 ||
          y + dy >= height
        )
          continue;
        const next = (y + dy) * width + x + dx;
        if (!visited[next] && master.data[next * 4 + 3] >= 32) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
  }
  if (tail >= minimumArea) {
    kept++;
    for (let i = 0; i < tail; i++)
      mask[queue[i]] = master.data[queue[i] * 4 + 3];
  }
}
if (kept < 3)
  throw new Error(
    "The source must retain the owl outline and both separate pupils.",
  );
let left = width,
  top = height,
  right = -1,
  bottom = -1;
for (let i = 0; i < mask.length; i++)
  if (mask[i]) {
    const x = i % width,
      y = Math.floor(i / width);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
if (right < left) throw new Error("The master contains no usable owl artwork.");
const cropped = new PNG({ width: right - left + 1, height: bottom - top + 1 });
for (let y = 0; y < cropped.height; y++)
  for (let x = 0; x < cropped.width; x++) {
    const offset = (y * cropped.width + x) * 4;
    cropped.data.set([...WHITE, mask[(y + top) * width + x + left]], offset);
  }
const croppedPath = path.join(scratch, "owl-alpha.png");
await writeFile(croppedPath, PNG.sync.write(cropped));

async function render(
  name,
  size,
  maxWidth,
  maxHeight,
  color,
  background = null,
) {
  const scale = Math.min(maxWidth / cropped.width, maxHeight / cropped.height);
  const inkWidth = Math.floor(cropped.width * scale),
    inkHeight = Math.floor(cropped.height * scale);
  const resized = await generateImageAsync(
    { projectRoot: root, cacheType: "surios-branding" },
    {
      src: croppedPath,
      width: inkWidth,
      height: inkHeight,
      resizeMode: "contain",
      backgroundColor: "transparent",
    },
  );
  const ink = PNG.sync.read(resized.source);
  const image = new PNG({ width: size, height: size });
  if (background)
    for (let i = 0; i < image.data.length; i += 4)
      image.data.set([...background, 255], i);
  const xOffset = Math.floor((size - ink.width) / 2),
    yOffset = Math.floor((size - ink.height) / 2);
  for (let y = 0; y < ink.height; y++)
    for (let x = 0; x < ink.width; x++) {
      const alpha = ink.data[(y * ink.width + x) * 4 + 3];
      if (!alpha) continue;
      const offset = ((y + yOffset) * size + x + xOffset) * 4;
      if (background)
        image.data.set(
          color
            .map((c, channel) =>
              Math.round(
                (c * alpha) / 255 + background[channel] * (1 - alpha / 255),
              ),
            )
            .concat(255),
          offset,
        );
      else image.data.set([...color, alpha], offset);
    }
  await writeFile(path.join(output, name), PNG.sync.write(image));
  return { file: name, width: size, height: size, inkWidth, inkHeight };
}
const results = [];
results.push(await render("icon.png", 1024, 600, 750, WHITE, ORANGE));
results.push(
  await render("android-icon-foreground.png", 1024, 380, 480, WHITE),
);
// Identical alpha; Android chooses the final themed-icon color itself.
results.push(
  await render("android-icon-monochrome.png", 1024, 380, 480, WHITE),
);
const background = new PNG({ width: 1024, height: 1024 });
for (let i = 0; i < background.data.length; i += 4)
  background.data.set([...ORANGE, 255], i);
await writeFile(
  path.join(output, "android-icon-background.png"),
  PNG.sync.write(background),
);
results.push({
  file: "android-icon-background.png",
  width: 1024,
  height: 1024,
});
results.push(await render("splash-icon.png", 1024, 640, 820, ORANGE));
results.push(await render("favicon.png", 48, 32, 38, WHITE, ORANGE));
await writeFile(
  path.join(scratch, "export-report.json"),
  JSON.stringify(
    { keptComponents: kept, source: { width, height }, exports: results },
    null,
    2,
  ) + "\n",
);
console.log(
  `Exported ${results.length} SuriOS assets from ${kept} retained owl components.`,
);
