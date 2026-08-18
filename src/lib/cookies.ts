export function useSecureCookies(): boolean {
  const configuredOrigin = process.env.MANAGER_ORIGIN;
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).protocol === 'https:';
    } catch {
      // Invalid origins are rejected by mutation origin checks. Keep the
      // production-safe cookie default until the installation is corrected.
    }
  }
  return process.env.NODE_ENV === 'production';
}
