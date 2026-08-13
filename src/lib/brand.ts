/**
 * Central brand configuration — PRACTICE WITH AJIT.
 *
 * Every user-facing brand string / logo must come from here.
 * To rebrand or swap the logo later, change ONLY this file
 * (plus index.html + public/manifest.webmanifest for static metadata).
 */
import brandLogoAsset from "@/assets/practice-with-ajit-logo.png.asset.json";

const brandLogo = brandLogoAsset.url;

/** Official, full brand name — always use this exact capitalization. */
export const APP_NAME = "PRACTICE WITH AJIT";

/** Short name for tight UI spots (header chips, PWA short_name). */
export const APP_SHORT_NAME = "PRACTICE WITH AJIT";

/** Marketing tagline shown next to the brand name. */
export const APP_TAGLINE = "AI Powered Learning Platform";

/** Full title used in document titles / splash. */
export const APP_FULL_TITLE = `${APP_NAME} — ${APP_TAGLINE}`;

/** AI mentor identity — intentionally separate from the app brand. */
export const AI_NAME = "AJIT AI";

/**
 * Current logo asset. Replace the imported file (or point this at a new
 * asset) to update the header, splash, login and About screens at once.
 */
export const APP_LOGO = brandLogo;

export const APP_LOGO_ALT = `${APP_NAME} logo`;

/** Helper for page titles: "PRACTICE WITH AJIT — Smart Revision". */
export function pageTitle(section?: string) {
  return section ? `${APP_NAME} — ${section}` : APP_FULL_TITLE;
}
