import { test, expect } from "@playwright/test";
import { confirmedMessage, parseSettings, passwordChangeError } from "../src/lib/settings";

test("settings require authoritative booleans and leave website appearance outside the mobile patch", () => {
  const result = parseSettings({ email: "demo@example.test", mailAvailable: false, preferences: { emailComments: true, emailConfirmations: false, theme: "dark" } });
  expect(result).toEqual({ email: "demo@example.test", mailAvailable: false, preferences: { emailComments: true, emailConfirmations: false } });
  for (const input of [null, { email: "demo@example.test" }, { email: "demo@example.test", mailAvailable: true, preferences: { emailComments: "false", emailConfirmations: true } }])
    expect(() => parseSettings(input)).toThrow("could not be read");
});

test("password changes follow server lengths, preserve whitespace and require a different matching password", () => {
  const valid = { currentPassword: "Existing password", newPassword: " New password ", confirmPassword: " New password " };
  expect(passwordChangeError(valid)).toBeNull();
  expect(passwordChangeError({ ...valid, currentPassword: "" })).toContain("current password");
  expect(passwordChangeError({ ...valid, currentPassword: "x".repeat(257) })).toContain("current password");
  expect(passwordChangeError({ ...valid, currentPassword: "x".repeat(256) })).toBeNull();
  for (const length of [7, 129]) expect(passwordChangeError({ ...valid, newPassword: "x".repeat(length), confirmPassword: "x".repeat(length) })).toContain("8 and 128");
  for (const length of [8, 128]) expect(passwordChangeError({ ...valid, newPassword: "x".repeat(length), confirmPassword: "x".repeat(length) })).toBeNull();
  expect(passwordChangeError({ ...valid, confirmPassword: "New password" })).toContain("do not match");
  expect(passwordChangeError({ currentPassword: "same-password", newPassword: "same-password", confirmPassword: "same-password" })).toContain("different password");
});

test("password and email actions never infer success from an empty or mismatched response", () => {
  expect(confirmedMessage({ success: "Password changed." }, "success")).toBe("Password changed.");
  expect(confirmedMessage({ message: "Check your inbox." }, "message")).toBe("Check your inbox.");
  for (const input of [null, {}, { success: true }, { success: " " }, { message: "Unrelated" }])
    expect(() => confirmedMessage(input, "success")).toThrow("did not confirm");
});
