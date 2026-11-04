import type { NextConfig } from 'next';
import { networkInterfaces } from 'node:os';

/** LAN / Tailscale IPs so phone preview over Wi‑Fi can load Next.js 16+ client bundles. */
function localDevOrigins() {
  const origins = new Set<string>(['127.0.0.1', 'localhost']);
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (!addr.internal) origins.add(addr.address);
    }
  }
  return [...origins];
}

const nextConfig: NextConfig = {
  output: 'export',
  // Next 16 blocks cross-origin /_next/* from phone LAN IPs unless allowlisted.
  allowedDevOrigins: localDevOrigins(),
  images: {
    // Serve original files — no WebP/AVIF recompression so project media keeps source color accuracy.
    unoptimized: true,
    localPatterns: [
      { pathname: '/**' },
      { pathname: '/media/dji-romo/**' },
    ],
  },
};

export default nextConfig;
