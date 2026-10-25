import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { ApiError } from "../src/lib/api-client";
import * as profile from "../src/lib/profile";
import * as discussion from "../src/lib/discussion";

// Exercise the installed SDK's real multipart encoder, which browser fetch never uses.
function nativeModules(platform = "android") {
  const payload = Uint8Array.from([255, 216, 255, 83, 117, 114, 105, 79, 83]);
  class LocalFile {
    constructor(public uri: string) {}
    get name() { return this.uri.split("/").pop()!; }
    get type() { return "image/jpeg"; }
    get exists() { return !this.uri.includes("missing"); }
    get size() { return this.exists ? payload.length : 0; }
    async bytes() { return payload; }
  }
  class NativeFormData { _parts: unknown[] = []; }
  const cache = new Map<string, Record<string, any>>();
  const load = (file: string): Record<string, any> => {
    const filename = resolve(file);
    if (cache.has(filename)) return cache.get(filename)!;
    const module = { exports: {} as Record<string, any> };
    cache.set(filename, module.exports);
    const code = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: filename,
    }).outputText;
    runInNewContext(code, {
      module, exports: module.exports, Blob, File, Uint8Array, TextEncoder,
      FormData: platform === "web" ? FormData : NativeFormData,
      require: (id: string) => {
        if (id === "react-native") return { Platform: { OS: platform } };
        if (id === "expo-file-system") return { File: LocalFile };
        if (id === "expo-image-picker") return {};
        if (id === "expo-crypto") return { randomUUID: () => "unused-picker-id" };
        if (id.endsWith("api-client")) return { ApiError };
        if (id === "./profile") return profile;
        if (id === "./discussion") return discussion;
        if (id.endsWith("blobUtils")) return { blobToArrayBufferAsync: (blob: Blob) => blob.arrayBuffer() };
        if (id.startsWith(".")) return load(resolve(dirname(filename), id + ".ts"));
        throw new Error(`Unexpected native-upload dependency: ${id}`);
      },
    });
    return module.exports;
  };
  const { installFormDataPatch } = load("node_modules/expo/src/winter/FormData.ts");
  installFormDataPatch(NativeFormData);
  const { convertFormDataAsync } = load("node_modules/expo/src/winter/fetch/convertFormData.ts");
  return { load, NativeFormData, convertFormDataAsync, payload };
}

test("SDK 58 rejects legacy URI multipart parts before reaching the server", async () => {
  const { NativeFormData, convertFormDataAsync } = nativeModules();
  const form = new NativeFormData() as unknown as FormData;
  form.append("media", { uri: "file:///cache/bridge.jpg", name: "bridge.jpg", type: "image/jpeg" } as unknown as Blob);
  const error = await convertFormDataAsync(form).then(() => null, (cause: Error) => cause.message);
  expect(error).toBe("Unsupported FormDataPart implementation");
});

for (const platform of ["android", "ios"]) {
  test(`${platform} report, avatar, cover and repost encode actual file bytes with SDK 58`, async () => {
    const { load, convertFormDataAsync, payload } = nativeModules(platform);
    const photo = { uri: "file:///cache/bridge.jpg", name: "bridge.jpg", mimeType: "image/jpeg", size: payload.length };
    const report = load("src/reporting/media.ts").assessmentForm([{ ...photo, id: "photo" }], "Bridge railing", "Visible damage");
    const account = load("src/lib/profile-media.ts").profileForm({ name: "Demo Citizen", avatar: photo, cover: photo, removeAvatar: false, removeCover: false });
    const repost = load("src/lib/repost-media.ts").repostForm("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb", null, "A closer view", photo);
    for (const [form, fields] of [[report, ["media"]], [account, ["avatar", "cover"]], [repost, ["image"]]] as const) {
      const { body, boundary } = await convertFormDataAsync(form);
      const parsed = await new Response(body, { headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` } }).formData();
      for (const field of fields) {
        const file = parsed.get(field) as File;
        expect(file.name).toBe("bridge.jpg");
        expect(file.type).toBe("image/jpeg");
        expect(new Uint8Array(await file.arrayBuffer())).toEqual(payload);
      }
      if (form === report) {
        expect(parsed.get("headline")).toBe("Bridge railing");
        expect(parsed.get("caption")).toBe("Visible damage");
      }
    }
  });
}

test("missing native cache files keep a useful selection error", () => {
  const { load, NativeFormData } = nativeModules();
  const { appendUpload } = load("src/lib/upload-file.ts");
  expect(() => appendUpload(new NativeFormData(), "media", { uri: "file:///cache/missing.jpg", name: "missing.jpg" })).toThrow("no longer available");
});

test("browser uploads retain the selected File and its filename", () => {
  const { load } = nativeModules("web");
  const { appendUpload } = load("src/lib/upload-file.ts");
  const form = new FormData();
  appendUpload(form, "media", { uri: "blob:test", name: "railing.jpg", file: new File(["evidence"], "camera.jpg", { type: "image/jpeg" }) });
  expect((form.get("media") as File).name).toBe("railing.jpg");
  expect(() => appendUpload(form, "cover", { uri: "blob:expired", name: "expired.jpg" })).toThrow("no longer available");
});
