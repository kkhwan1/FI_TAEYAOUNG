/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove output mode to allow default server rendering
  // output: 'standalone',  // DISABLED - causes static generation errors

  // Enable React Strict Mode for better development error detection
  reactStrictMode: true,

  // Skip trailing slash redirect to avoid Pages Router compatibility layer
  skipTrailingSlashRedirect: true,

  // Disable static generation for error pages to avoid Pages Router hooks
  generateBuildId: async () => {
    return 'custom-build-id';
  },

  // ESLint configuration
  eslint: {
    // NOTE: Temporarily ignore ESLint errors during builds
    // TODO: Remove once all linting issues are resolved
    ignoreDuringBuilds: true,
  },

  // TypeScript configuration
  typescript: {
    // NOTE: Temporarily ignore TypeScript errors during builds
    // Known issue: Next.js 15 async params type errors (framework-level)
    // TODO: Remove once Next.js 15 typing issues are resolved
    ignoreBuildErrors: true,
  },

  // Compiler options
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pybjnkbmtlyaftuiieyq.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Compression settings
  compress: true,

  // Power pack settings for better performance
  poweredByHeader: false,

  // Bundle analyzer is now integrated in the main webpack config

  // Experimental features (Next.js 14.2.16)
  experimental: {
    // Enable modern bundling optimizations
    optimizePackageImports: ['lucide-react', 'recharts'],
  },

  // Webpack configuration for development
  webpack: (config, { isServer, dev }) => {
    // Windows 파일 감시 안정화 (polling 모드)
    // 증상: 코드 수정 후 변경 감지 실패, webpack 캐시 문제
    // 해결: polling 모드로 강제 파일 감시
    if (dev) {
      config.watchOptions = {
        poll: 1000, // 1초마다 파일 변경 확인
        aggregateTimeout: 300, // 변경 감지 후 300ms 대기 후 재빌드
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
      };
    }

    // Bundle analyzer integration
    if (process.env.ANALYZE === 'true' && !isServer) {
      // Dynamic import to avoid bundling in production
      import('webpack-bundle-analyzer').then(({ BundleAnalyzerPlugin }) => {
        if (!config.plugins) config.plugins = [];
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: '../analyze/client.html',
            openAnalyzer: false,
          })
        );
      }).catch(console.error);
    }

    return config;
  },

};


module.exports = nextConfig;
