import path from 'node:path'
/** @type {import('next').NextConfig} */
const config={
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  ...(process.platform === 'win32' ? {} : { output: 'standalone' }),
  ...(process.env.NEXT_PUBLIC_BASE_PATH ? { basePath: process.env.NEXT_PUBLIC_BASE_PATH } : {}),
  outputFileTracingRoot:path.resolve(import.meta.dirname,'../..'),
  serverExternalPackages:['bullmq','ioredis'],
  webpack(webpackConfig) {
    webpackConfig.resolve.fallback = { ...webpackConfig.resolve.fallback, '@valkey/valkey-glide': false }
    return webpackConfig
  },
  headers:async()=>[{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]}]
};export default config;
