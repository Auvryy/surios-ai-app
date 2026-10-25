// Read-only checks for the raster assets used by the installed app configuration.
// Run after exporting: node scripts/check-brand-assets.mjs [--json] [--root PATH]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const imageRequire = createRequire(require.resolve("@expo/image-utils"));
const { PNG } = imageRequire("pngjs");
const ORANGE = [201, 61, 0];
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
// Android uses 108dp layers with a central 66dp safe zone. Check a conservative
// circle inside that zone so even the corners of the glyph cannot be clipped.
// https://developer.android.com/develop/ui/compose/system/icon_design_adaptive
const SAFE_RADIUS_RATIO = 66 / 108 / 2;
const errors = [];
const assets = {};
let root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let json = false;

for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--json") json = true;
  else if (argument === "--root" && process.argv[index + 1]) {
    root = resolve(process.argv[++index]);
  } else {
    console.error(`Unknown or incomplete argument: ${argument}`);
    console.error(
      "Usage: node scripts/check-brand-assets.mjs [--json] [--root PATH]",
    );
    process.exit(2);
  }
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function loadPng(path, size) {
  try {
    const png = PNG.sync.read(readFileSync(resolve(root, path)), {
      checkCRC: true,
    });
    if (size)
      check(
        png.width === size && png.height === size,
        `${path}: expected ${size}×${size}, got ${png.width}×${png.height}.`,
      );
    else
      check(
        png.width === png.height && png.width >= 1024,
        `${path}: the source master must be square and at least 1024px.`,
      );
    assets[path] = { width: png.width, height: png.height };
    return png;
  } catch (error) {
    errors.push(
      `${path}: ${error.code === "ENOENT" ? "missing; run the brand asset exporter first" : `cannot decode PNG (${error.message})`}.`,
    );
    return null;
  }
}

function boundsOf(png, predicate) {
  let left = png.width;
  let top = png.height;
  let right = -1;
  let bottom = -1;
  let count = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      if (!predicate(png.data, offset)) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      count += 1;
    }
  }
  return count
    ? {
        left,
        top,
        right,
        bottom,
        width: right - left + 1,
        height: bottom - top + 1,
        count,
      }
    : null;
}

function checkCentered(path, png, bounds, tolerance = 2) {
  check(!!bounds, `${path}: the owl glyph is empty.`);
  if (!bounds) return;
  check(
    Math.abs((bounds.left + bounds.right + 1) / 2 - png.width / 2) <=
      tolerance &&
      Math.abs((bounds.top + bounds.bottom + 1) / 2 - png.height / 2) <=
        tolerance,
    `${path}: owl bounds must be centered within ${tolerance}px.`,
  );
  assets[path].glyphBounds = bounds;
}

// Measure the distance to the orange–white segment rather than requiring every
// antialiased pixel to be one exact RGB value. Opaque corners stay exact orange.
function opaquePaletteDistance(data, offset) {
  const progress = Math.max(0, Math.min(1, data[offset + 2] / 255));
  return Math.max(
    ...ORANGE.map((channel, index) =>
      Math.abs(data[offset + index] - (channel + (255 - channel) * progress)),
    ),
  );
}

function checkOpaqueMark(path, png) {
  if (!png) return;
  let transparent = 0;
  let unexpected = 0;
  let orange = 0;
  for (let offset = 0; offset < png.data.length; offset += 4) {
    if (png.data[offset + 3] !== 255) transparent += 1;
    if (opaquePaletteDistance(png.data, offset) > 8) unexpected += 1;
    if (ORANGE.every((channel, index) => png.data[offset + index] === channel))
      orange += 1;
  }
  check(
    !transparent,
    `${path}: app icons must be fully opaque (${transparent} nonopaque pixels).`,
  );
  check(
    !unexpected,
    `${path}: ${unexpected} pixels fall outside the orange/white antialiased palette.`,
  );
  check(
    orange > png.width * png.height * 0.2,
    `${path}: expected a solid orange background.`,
  );
  const corners = [
    0,
    (png.width - 1) * 4,
    (png.height - 1) * png.width * 4,
    (png.width * png.height - 1) * 4,
  ];
  check(
    corners.every((offset) =>
      ORANGE.every((channel, index) => png.data[offset + index] === channel),
    ),
    `${path}: all four corners must be #C93D00; let the operating system apply icon masks.`,
  );
  const bounds = boundsOf(
    png,
    (data, offset) =>
      data[offset + 2] >= 245 && data[offset] >= 245 && data[offset + 1] >= 245,
  );
  checkCentered(path, png, bounds, png.width < 100 ? 1 : 2);
  check(
    (bounds?.count ?? 0) > png.width * png.height * 0.04,
    `${path}: expected a clearly visible white owl.`,
  );
}

function checkTransparentMark(
  path,
  png,
  colors,
  safeZone = false,
  splashImageWidth = null,
) {
  if (!png) return;
  let unexpected = 0;
  let opaqueInk = 0;
  let outsideSafeZone = 0;
  let maximumRadiusSquared = 0;
  const centerX = png.width / 2;
  const centerY = png.height / 2;
  // This SDK's Android splash image sits in a 288dp canvas masked to a 192dp
  // circle. Account for the configured imageWidth before checking its pixels.
  const radius = splashImageWidth
    ? (96 * png.width) / splashImageWidth
    : png.width * SAFE_RADIUS_RATIO;
  const checkRadius = safeZone || splashImageWidth !== null;
  for (let offset = 0; offset < png.data.length; offset += 4) {
    const alpha = png.data[offset + 3];
    if (alpha === 0) continue;
    if (alpha >= 250) opaqueInk += 1;
    // RGB of almost-transparent pixels can vary after resampling. Compare the
    // visible contribution of the color error, not those hidden RGB channels.
    const distance = Math.min(
      ...colors.map((color) =>
        Math.max(
          ...color.map((channel, index) =>
            Math.abs(png.data[offset + index] - channel),
          ),
        ),
      ),
    );
    if ((distance * alpha) / 255 > 12) unexpected += 1;
    if (checkRadius) {
      const pixel = offset / 4;
      const x = (pixel % png.width) + 0.5 - centerX;
      const y = Math.floor(pixel / png.width) + 0.5 - centerY;
      const radiusSquared = x * x + y * y;
      maximumRadiusSquared = Math.max(maximumRadiusSquared, radiusSquared);
      if (radiusSquared > radius * radius) outsideSafeZone += 1;
    }
  }
  const bounds = boundsOf(png, (data, offset) => data[offset + 3] > 0);
  checkCentered(path, png, bounds);
  check(
    opaqueInk > png.width * png.height * 0.025,
    `${path}: expected a visible, solid owl silhouette.`,
  );
  check(
    !unexpected,
    `${path}: ${unexpected} visible pixels fall outside the intended monochrome palette.`,
  );
  check(
    bounds &&
      bounds.left > 0 &&
      bounds.top > 0 &&
      bounds.right < png.width - 1 &&
      bounds.bottom < png.height - 1,
    `${path}: the owl must have transparent outer padding.`,
  );
  if (safeZone) {
    check(
      !outsideSafeZone,
      `${path}: ${outsideSafeZone} ink pixels exceed the circular Android 66/108 safe area (radius ${radius.toFixed(2)}px).`,
    );
    // Android recommends a glyph at least 48dp on its 108dp layer.
    check(
      bounds && Math.max(bounds.width, bounds.height) >= png.width * (48 / 108),
      `${path}: owl is too small for the Android launcher (minimum 48/108 of the layer).`,
    );
    assets[path].safeRadius = Number(radius.toFixed(2));
  }
  if (checkRadius)
    assets[path].inkRadius = Number(Math.sqrt(maximumRadiusSquared).toFixed(2));
  if (splashImageWidth) {
    check(
      !outsideSafeZone,
      `${path}: ${outsideSafeZone} ink pixels exceed the Android splash mask at imageWidth ${splashImageWidth} (source radius ${radius.toFixed(2)}px).`,
    );
    assets[path].safeRadius = Number(radius.toFixed(2));
  }
}

function checkSourceMaster(path, png) {
  if (!png) return;
  let transparent = 0;
  let orangeInk = 0;
  let otherInk = 0;
  for (let offset = 0; offset < png.data.length; offset += 4) {
    const [red, green, blue, alpha] = png.data.subarray(offset, offset + 4);
    if (alpha === 0) transparent += 1;
    // Keep the original image-generation output as provenance. Exports are
    // recolored exactly, while this source may contain orange edge variations.
    if (alpha >= 128) {
      if (red > green + 40 && green > blue + 10) orangeInk += 1;
      else otherInk += 1;
    }
  }
  check(
    transparent > png.width * png.height * 0.1,
    `${path}: the source master needs real transparent padding.`,
  );
  check(
    orangeInk > png.width * png.height * 0.025 && otherInk < orangeInk * 0.01,
    `${path}: expected orange-family source ink on transparency.`,
  );
}

function checkConfig() {
  let expo;
  try {
    expo = JSON.parse(readFileSync(resolve(root, "app.json"), "utf8")).expo;
  } catch (error) {
    errors.push(`app.json: cannot read Expo configuration (${error.message}).`);
    return;
  }
  check(
    expo?.name === "SuriOS" &&
      expo?.slug === "surios-ai-app" &&
      expo?.scheme === "surios",
    "app.json: preserve the SuriOS app name, slug and URL scheme.",
  );
  check(
    expo?.userInterfaceStyle === "light",
    "app.json: SuriOS must remain light-only.",
  );
  check(expo?.primaryColor === "#C93D00", "app.json: native primaryColor must remain SuriOS orange.");
  check(
    expo?.orientation === "portrait",
    "app.json: preserve the existing portrait orientation.",
  );
  check(
    expo?.icon === "./assets/images/icon.png",
    "app.json: icon must reference ./assets/images/icon.png.",
  );
  const adaptive = expo?.android?.adaptiveIcon;
  for (const [field, expected] of Object.entries({
    foregroundImage: "./assets/images/android-icon-foreground.png",
    backgroundImage: "./assets/images/android-icon-background.png",
    monochromeImage: "./assets/images/android-icon-monochrome.png",
    backgroundColor: "#C93D00",
  })) {
    check(
      adaptive?.[field] === expected,
      `app.json: android.adaptiveIcon.${field} must be ${expected}.`,
    );
  }
  check(
    expo?.web?.favicon === "./assets/images/favicon.png",
    "app.json: web.favicon must reference ./assets/images/favicon.png.",
  );
  const splashPlugins = Array.isArray(expo?.plugins)
    ? expo.plugins.filter(
        (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
      )
    : [];
  check(
    splashPlugins.length === 1,
    "app.json: configure exactly one expo-splash-screen plugin.",
  );
  const splash = splashPlugins[0]?.[1];
  for (const [field, expected] of Object.entries({
    image: "./assets/images/splash-icon.png",
    imageWidth: 176,
    resizeMode: "contain",
    backgroundColor: "#FAFAFA",
  })) {
    check(
      splash?.[field] === expected,
      `app.json: expo-splash-screen.${field} must be ${JSON.stringify(expected)}.`,
    );
  }
  check(
    !splash?.dark &&
      !splash?.android?.dark &&
      !splash?.ios?.dark &&
      !expo?.splash?.dark,
    "app.json: omit dark splash variants; the app is light-only.",
  );
  check(
    !expo?.android?.icon && !expo?.ios?.icon,
    "app.json: platform icon overrides must not bypass the shared SuriOS icon.",
  );
  return Number.isFinite(splash?.imageWidth) && splash.imageWidth > 0
    ? splash.imageWidth
    : 176;
}

const splashImageWidth = checkConfig() ?? 176;

const paths = {
  master: "assets/brand/orie-mark.png",
  icon: "assets/images/icon.png",
  foreground: "assets/images/android-icon-foreground.png",
  background: "assets/images/android-icon-background.png",
  monochrome: "assets/images/android-icon-monochrome.png",
  splash: "assets/images/splash-icon.png",
  favicon: "assets/images/favicon.png",
};
const pngs = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [
    key,
    loadPng(path, key === "favicon" ? 48 : key === "master" ? null : 1024),
  ]),
);

checkOpaqueMark(paths.icon, pngs.icon);
checkOpaqueMark(paths.favicon, pngs.favicon);
checkSourceMaster(paths.master, pngs.master);
checkTransparentMark(paths.foreground, pngs.foreground, [WHITE], true);
checkTransparentMark(paths.monochrome, pngs.monochrome, [WHITE, BLACK], true);
checkTransparentMark(
  paths.splash,
  pngs.splash,
  [ORANGE],
  false,
  splashImageWidth,
);

if (pngs.background) {
  let invalid = 0;
  for (let offset = 0; offset < pngs.background.data.length; offset += 4) {
    if (
      pngs.background.data[offset + 3] !== 255 ||
      !ORANGE.every(
        (channel, index) => pngs.background.data[offset + index] === channel,
      )
    )
      invalid += 1;
  }
  check(
    !invalid,
    `${paths.background}: every pixel must be opaque #C93D00 (${invalid} invalid pixels).`,
  );
}

if (pngs.foreground && pngs.monochrome) {
  const first = pngs.foreground;
  const second = pngs.monochrome;
  let mismatch = first.width !== second.width || first.height !== second.height;
  if (!mismatch) {
    for (let offset = 3; offset < first.data.length; offset += 4) {
      if (first.data[offset] !== second.data[offset]) {
        mismatch = true;
        break;
      }
    }
  }
  check(
    !mismatch,
    "Android foreground and monochrome layers must use the identical owl alpha silhouette.",
  );
}

const report = { ok: errors.length === 0, assets, errors };
if (json) console.log(JSON.stringify(report, null, 2));
else if (report.ok)
  console.log(
    `SuriOS branding passed: ${Object.keys(assets).length} PNGs, app configuration, orange/white palettes and Android safe zone.`,
  );
else {
  console.error(`SuriOS branding failed (${errors.length} checks):`);
  for (const error of errors) console.error(`- ${error}`);
}
if (!report.ok) process.exitCode = 1;
