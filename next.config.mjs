const serverExternalPackages = [
  '@remotion/bundler',
  '@remotion/renderer',
  '@remotion/media-parser',
  '@remotion/player',
  'remotion',
  'esbuild',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages,
};

export default nextConfig;
