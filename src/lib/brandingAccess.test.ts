import { describe, expect, it } from "vitest";
import { canReadBranding, type BrandingAccess } from "../../supabase/functions/branding-url/access";

const denied: BrandingAccess = { userId: null, roles: [], enabledIntro: false, enabledFeedback: false };
describe("branding file authorization", () => {
  it("denies anonymous unpublished files", () => expect(canReadBranding(denied)).toBe(false));
  it("allows only an explicitly enabled intro anonymously", () => {
    expect(canReadBranding({ ...denied, enabledIntro: true })).toBe(true);
    expect(canReadBranding({ ...denied, enabledFeedback: true })).toBe(false);
  });
  it("denies arbitrary files to new accounts", () => {
    expect(canReadBranding({ ...denied, userId: "new-account" })).toBe(false);
  });
  it("allows students enabled feedback but not unpublished files", () => {
    const student = { ...denied, userId: "student", roles: ["student"] };
    expect(canReadBranding({ ...student, enabledFeedback: true })).toBe(true);
    expect(canReadBranding(student)).toBe(false);
  });
  it("requires verified identity for administrative access", () => {
    expect(canReadBranding({ ...denied, roles: ["admin"] })).toBe(false);
    expect(canReadBranding({ ...denied, userId: "admin", roles: ["admin"] })).toBe(true);
  });
});