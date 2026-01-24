import { getEnvVariables } from '@/lib/getEnvVariables';

function stripProtocolAndPath(input: string): string {
  return input.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
}

function hostWithoutPort(host: string): string {
  // Handles "localhost:5173" / "tenant.localhost:5173"
  return host.split(':')[0];
}

function isLocalHost(hostOrHostname: string): boolean {
  const h = hostWithoutPort(hostOrHostname).toLowerCase();
  return h === 'localhost' || h.endsWith('.localhost') || h === '127.0.0.1';
}

function baseDomainFromCurrentHost(): string | null {
  // Example: "tenant.localhost:5173" -> "localhost:5173"
  // Example: "tenant.whagons.com" -> "whagons.com"
  const host = window.location.host;
  const parts = host.split('.');
  if (parts.length <= 1) return null;
  return parts.slice(1).join('.');
}

export function buildInvitationLink(params: {
  invitationToken: string;
  tenantDomainPrefix?: string | null;
}): string {
  const { invitationToken, tenantDomainPrefix } = params;
  const { VITE_DOMAIN, VITE_DEVELOPMENT } = getEnvVariables();

  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const isDev = (import.meta as any).env?.DEV === true || VITE_DEVELOPMENT === 'true';

  // Prefer env domain; for local dev, fall back to the current host's base domain.
  let baseDomain =
    (typeof VITE_DOMAIN === 'string' && VITE_DOMAIN.trim() ? VITE_DOMAIN.trim() : '') ||
    (isDev ? baseDomainFromCurrentHost() : null) ||
    'whagons5.whagons.com';

  baseDomain = stripProtocolAndPath(baseDomain);

  // In local dev, ensure we keep the active frontend port if baseDomain doesn't already include one.
  if (isDev && isLocalHost(baseDomain) && window.location.port && !baseDomain.includes(':')) {
    baseDomain = `${baseDomain}:${window.location.port}`;
  }

  const host = tenantDomainPrefix ? `${tenantDomainPrefix}.${baseDomain}` : baseDomain;
  return `${protocol}://${host}/auth/invitation/${invitationToken}`;
}

