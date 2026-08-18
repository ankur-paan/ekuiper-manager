import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ApiError } from '@/lib/api';

function blockedIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  return (
    octets[0] === 0 ||
    (octets[0] === 169 && octets[1] === 254) ||
    octets[0] >= 224
  );
}

function blockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized === '::' || normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
    normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('ff');
}

export function normalizeNodeUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, 'eKuiper URL is required', 'INVALID_NODE_URL');
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ApiError(400, 'eKuiper URL is invalid', 'INVALID_NODE_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ApiError(400, 'eKuiper URL must use HTTP or HTTPS', 'INVALID_NODE_URL');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ApiError(400, 'eKuiper URL cannot contain credentials, query, or fragment', 'INVALID_NODE_URL');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new ApiError(400, 'eKuiper URL must not contain a path', 'INVALID_NODE_URL');
  }
  url.pathname = '';
  return url.origin;
}

export async function assertSafeNodeDestination(url: URL): Promise<void> {
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new ApiError(502, 'eKuiper hostname could not be resolved', 'NODE_DNS_FAILED');
  }
  if (!addresses.length) {
    throw new ApiError(502, 'eKuiper hostname did not resolve', 'NODE_DNS_FAILED');
  }
  for (const { address } of addresses) {
    const family = isIP(address);
    if ((family === 4 && blockedIpv4(address)) || (family === 6 && blockedIpv6(address))) {
      throw new ApiError(400, 'eKuiper address is not a permitted network destination', 'NODE_ADDRESS_REJECTED');
    }
  }
}
