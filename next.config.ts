import type { NextConfig } from "next"

// next-pwa v5 is CommonJS — use require to avoid ESM/CJS conflict
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Declare turbopack config so Next.js 16 doesn't error when next-pwa
  // adds a webpack config for production builds
  turbopack: {},
}

export default withPWA(nextConfig)
