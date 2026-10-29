import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a phone load the dev server through an ngrok link. Without
  // it Next blocks its dev scripts for that host, the page never hydrates and
  // forms do nothing.
  allowedDevOrigins: ["*.ngrok-free.app"],
  // Dev logs print each Server Action's arguments, and Login's include the
  // password in plain text. Off.
  logging: { serverFunctions: false },
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
