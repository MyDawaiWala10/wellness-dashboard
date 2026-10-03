import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Lets Server Actions work when testing on a phone through a dev
      // tunnel (VS Code port forwarding / devtunnels). Confirmed against
      // Next's own source (action-handler.js): it compares the browser's
      // `Origin` against `x-forwarded-host`, then falls back to this list.
      // The tunnel rewrites Origin back to `localhost:3000` before the
      // request reaches Next, while x-forwarded-host is the public tunnel
      // domain - so it's `localhost:3000` that needs whitelisting here, not
      // the tunnel hostname. Dev-only; a real production domain is unaffected.
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
