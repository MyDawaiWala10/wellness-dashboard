import { describe, expect, it } from "vitest";
import { isProfileLink } from "./profile-link";

// Same cases as the backend's profileLink.test.ts (KEEP IN SYNC).
describe("isProfileLink", () => {
  it("accepts a full http(s) link", () => {
    expect(isProfileLink(" https://www.linkedin.com/in/asha ")).toBe(true);
    expect(isProfileLink("http://practo.com/x")).toBe(true);
  });

  it("refuses empty, partial and unsafe links", () => {
    expect(isProfileLink("")).toBe(false);
    expect(isProfileLink(undefined)).toBe(false);
    expect(isProfileLink("javascript:alert(1)")).toBe(false);
    expect(isProfileLink("data:text/html,hi")).toBe(false);
    expect(isProfileLink("linkedin.com/in/asha")).toBe(false);
    expect(isProfileLink(`https://x.com/${"a".repeat(600)}`)).toBe(false);
  });
});
