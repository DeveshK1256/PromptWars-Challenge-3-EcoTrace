/**
 * Tests for Firestore security rules logic.
 * Validates the rule helper functions' intended behavior.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const rulesContent = readFileSync(resolve("firestore.rules"), "utf-8");

describe("Firestore rules file", () => {
  it("exists and is not empty", () => {
    expect(rulesContent.length).toBeGreaterThan(0);
  });

  it("uses rules_version 2", () => {
    expect(rulesContent).toContain("rules_version = '2'");
  });

  it("has signedIn() helper function", () => {
    expect(rulesContent).toContain("function signedIn()");
    expect(rulesContent).toContain("request.auth != null");
  });

  it("has owns() helper that checks uid", () => {
    expect(rulesContent).toContain("function owns(userId)");
    expect(rulesContent).toContain("request.auth.uid == userId");
  });

  it("has user document rules with ownership check", () => {
    expect(rulesContent).toContain("match /users/{userId}");
    expect(rulesContent).toContain("allow read, delete: if owns(userId)");
  });

  it("has footprints subcollection rules", () => {
    expect(rulesContent).toContain("match /footprints/{footprintId}");
    expect(rulesContent).toContain("allow read: if owns(userId)");
  });

  it("prevents footprint updates", () => {
    // Footprints should be immutable once created
    expect(rulesContent).toMatch(/footprints.*\n.*allow update: if false/s);
  });

  it("prevents activity updates", () => {
    expect(rulesContent).toMatch(/activities.*\n.*allow update: if false/s);
  });

  it("has field validation for user documents", () => {
    expect(rulesContent).toContain("function safeUserFields()");
    expect(rulesContent).toContain("function validUserData()");
  });

  it("validates greenPoints is non-negative integer", () => {
    expect(rulesContent).toContain("greenPoints is int");
    expect(rulesContent).toContain("greenPoints >= 0");
  });

  it("limits greenPoints to 1 million", () => {
    expect(rulesContent).toContain("greenPoints <= 1000000");
  });

  it("has point change cap of +200", () => {
    expect(rulesContent).toContain("function validPointChange()");
    expect(rulesContent).toContain("greenPoints <= resource.data.greenPoints + 200");
  });

  it("validates displayName length <= 80", () => {
    expect(rulesContent).toContain("displayName.size() <= 80");
  });

  it("validates photoURL length <= 400", () => {
    expect(rulesContent).toContain("photoURL.size() <= 400");
  });

  it("enforces email matches auth token email", () => {
    expect(rulesContent).toContain("request.resource.data.email == request.auth.token.email");
  });

  it("requires new accounts to start with 0 points", () => {
    expect(rulesContent).toContain("request.resource.data.greenPoints == 0");
  });

  it("has publicProfiles collection with public read", () => {
    expect(rulesContent).toContain("match /publicProfiles/{userId}");
    expect(rulesContent).toContain("allow read: if true");
  });

  it("validates publicProfile greenPoints match user document", () => {
    expect(rulesContent).toContain("get(/databases/$(database)/documents/users/$(userId)).data.greenPoints");
  });

  it("has footprint field validation", () => {
    expect(rulesContent).toContain("function safeFootprintFields()");
    expect(rulesContent).toContain("totalKg");
    expect(rulesContent).toContain("breakdown");
  });
});
