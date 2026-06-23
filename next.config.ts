import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app's directory so Next.js ignores the
  // parent lockfile (silences a warning when this repo sits inside a parent
  // that has its own lockfile).
  turbopack: {
    root: __dirname,
  },
  // The 0G Storage SDK uses Node built-ins at load time. We use it ONLY in
  // server route handlers, so this is a no-op on the client — but if a
  // future import slips into a client component, marking these as external
  // keeps the client bundle from trying to polyfill them.
  serverExternalPackages: ["@0gfoundation/0g-storage-ts-sdk"],
};

export default nextConfig;
