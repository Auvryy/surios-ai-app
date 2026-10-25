import { isRecord } from "../auth/contracts";
import { ApiError } from "./api-client";

export type EmailPreferences = {
  emailComments: boolean;
  emailConfirmations: boolean;
};
export type AccountSettings = {
  preferences: EmailPreferences;
  email: string;
  mailAvailable: boolean;
};
export type PasswordChange = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function parseSettings(value: unknown): AccountSettings {
  if (!isRecord(value) || !isRecord(value.preferences) ||
      typeof value.preferences.emailComments !== "boolean" ||
      typeof value.preferences.emailConfirmations !== "boolean" ||
      typeof value.email !== "string" || !value.email.trim() ||
      typeof value.mailAvailable !== "boolean") {
    throw new ApiError("Your settings could not be read. Please try again.");
  }
  // Stored website appearance is deliberately left untouched by the light-only mobile app.
  return {
    preferences: { emailComments: value.preferences.emailComments, emailConfirmations: value.preferences.emailConfirmations },
    email: value.email,
    mailAvailable: value.mailAvailable,
  };
}

export function passwordChangeError(input: PasswordChange): string | null {
  if (!input.currentPassword || input.currentPassword.length > 256) return "Enter your current password.";
  if (input.newPassword.length < 8 || input.newPassword.length > 128) return "Use a password between 8 and 128 characters.";
  if (input.newPassword !== input.confirmPassword) return "The passwords do not match.";
  if (input.newPassword === input.currentPassword) return "Choose a different password.";
  return null;
}

export function confirmedMessage(value: unknown, field: "success" | "message"): string {
  if (!isRecord(value) || typeof value[field] !== "string" || !value[field].trim())
    throw new ApiError("The server did not confirm this request. Please check your connection and try again.");
  return value[field];
}
