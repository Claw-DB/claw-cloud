const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep dev and build outputs separate so `next build` can't corrupt an active `next dev` cache.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next-build',
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

module.exports = nextConfig;