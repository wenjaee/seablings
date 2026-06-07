/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  devIndicators: false,
  // Allow phones/other devices on the same Wi-Fi to load Next dev resources.
  // Without this, /_next/* is blocked cross-origin and the page never hydrates
  // (login button then just refreshes the page). Update if this machine's IP changes.
  allowedDevOrigins: ["192.168.1.69"]
};

export default nextConfig;
