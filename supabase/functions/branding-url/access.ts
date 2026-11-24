export type BrandingAccess = {
  userId: string | null;
  roles: string[];
  enabledIntro: boolean;
  enabledFeedback: boolean;
};

export function canReadBranding(access: BrandingAccess): boolean {
  if (access.enabledIntro) return true;
  if (!access.userId) return false;
  return access.roles.includes("admin") ||
    (access.roles.includes("student") && access.enabledFeedback);
}