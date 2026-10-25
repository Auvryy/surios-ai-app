import { test, expect } from "@playwright/test";
import { isGovernment, parseProfilePage, parseSavedProfile, profileChangesError, profileImageUrl, profilePhotoError, PROFILE_PHOTO_LIMIT, type ProfileChanges } from "../src/lib/profile";

const origin = "https://surios.example.test";
const id = "7f66c73b-d78e-43c2-a84d-97c77c2eb2df";
const profile = { id, name: "Demo Citizen", role: "CITIZEN", avatarUrl: "/media/avatar.png", coverUrl: null, governmentProfile: null };
const page = { profile, isOwner: true, total: 0, statistics: null, feed: [], currentPage: 1, hasMore: false };
const changes: ProfileChanges = { name: "Demo Citizen", avatar: null, cover: null, removeAvatar: false, removeCover: false };

test("accepts the real profile envelope and resolves only trusted public media", () => {
  const result = parseProfilePage(page, id, origin);
  expect(result.profile.avatarUrl).toBe(`${origin}/media/avatar.png`);
  expect(result.profile.coverUrl).toBeNull();
  expect(result.feed).toEqual([]);
  expect(result.total).toBe(0);
  expect(profileImageUrl("https://other.example.test/media/photo.jpg", origin)).toBeNull();
  expect(profileImageUrl("//other.example.test/media/photo.jpg", origin)).toBeNull();
  expect(profileImageUrl("javascript:alert(1)", origin)).toBeNull();
  expect(profileImageUrl("/api/account", origin)).toBeNull();
  expect(profileImageUrl("https://name:secret@surios.example.test/media/x.jpg", origin)).toBeNull();
});

test("rejects a different account, malformed post envelopes and unconfirmed saves", () => {
  expect(() => parseProfilePage(page, "someone-else", origin)).toThrow("different profile");
  expect(() => parseProfilePage({ ...page, isOwner: false }, id, origin)).toThrow("different profile");
  expect(() => parseProfilePage({ ...page, total: "0" }, id, origin)).toThrow();
  expect(() => parseProfilePage({ ...page, currentPage: 0 }, id, origin)).toThrow();
  expect(() => parseProfilePage({ ...page, feed: [{ kind: "post", post: {} }] }, id, origin)).toThrow();
  expect(() => parseSavedProfile({ success: true }, id, origin)).toThrow("did not confirm");
  expect(() => parseSavedProfile({ profile: { ...profile, id: "another-user" } }, id, origin)).toThrow();
  expect(parseSavedProfile({ profile }, id, origin).name).toBe(profile.name);
});

test("government profiles retain the server's distinct-hazard statistics for all office roles", () => {
  for (const role of ["OFFICER", "ENGINEER", "ADMIN"]) {
    const office = { level: "BARANGAY", jurisdiction: "Demo Barangay", bio: "Public infrastructure office." };
    const statistics = { reports: 8, inProgress: 3, resolved: 4 };
    const result = parseProfilePage({ ...page, profile: { ...profile, role, governmentProfile: office }, statistics }, id, origin);
    expect(result.profile.governmentProfile).toEqual(office);
    expect(result.statistics).toEqual(statistics);
    expect(isGovernment(result.profile.role)).toBe(true);
  }
  expect(parseProfilePage({ ...page, statistics: { reports: 5000 } }, id, origin).statistics).toBeNull();
  expect(() => parseProfilePage({ ...page, profile: { ...profile, role: "OFFICER" }, statistics: { reports: -1, inProgress: 0, resolved: 0 } }, id, origin)).toThrow("statistics");
});

test("profile validation enforces name, office and exact 4 MiB image boundaries", () => {
  expect(profileChangesError({ ...changes, name: " x " })).toContain("2 and 80");
  expect(profileChangesError({ ...changes, name: "x".repeat(81) })).toContain("2 and 80");
  expect(profileChangesError({ ...changes, name: "  Valid Name  " })).toBeNull();
  const photo = { uri: "file:///photo.png", name: "photo.png", mimeType: "image/png", size: PROFILE_PHOTO_LIMIT };
  expect(profilePhotoError(photo)).toBeNull();
  expect(profilePhotoError({ ...photo, size: PROFILE_PHOTO_LIMIT + 1 })).toContain("4 MB");
  expect(profilePhotoError({ ...photo, size: NaN })).toContain("could not be read");
  expect(profilePhotoError({ ...photo, mimeType: "image/gif" })).toContain("JPEG, PNG, or WebP");
  expect(profileChangesError({ ...changes, avatar: { ...photo, size: PROFILE_PHOTO_LIMIT + 1 }, removeAvatar: true })).toBeNull();
  expect(profileChangesError({ ...changes, governmentProfile: { level: "BARANGAY", jurisdiction: "x", bio: "" } })).toContain("jurisdiction");
  expect(profileChangesError({ ...changes, governmentProfile: { level: "MUNICIPAL", jurisdiction: "Demo municipality", bio: "x".repeat(501) } })).toContain("500");
});
