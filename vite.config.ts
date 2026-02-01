import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import { visualizer } from 'rollup-plugin-visualizer';
import JavaScriptObfuscator from 'javascript-obfuscator';
// import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
// Custom selective obfuscation plugin: only obfuscate chunks that include files under src/store/indexedDB
function cacheObfuscator(options: any) {
  return {
    name: 'whagons:cache-obfuscator',
    apply: 'build',
    enforce: 'post',
    generateBundle(_outputOptions: any, bundle: any) {
      for (const [_fileName, chunk] of Object.entries<any>(bundle)) {
        if (chunk?.type !== 'chunk' || typeof chunk.code !== 'string') continue;
        const modules = Object.keys(chunk.modules || {});
        const touchesCache = modules.some((m) => m.includes('/src/store/indexedDB/'));
        if (!touchesCache) continue;
        const result = JavaScriptObfuscator.obfuscate(chunk.code, options);
        chunk.code = result.getObfuscatedCode();
      }
    }
  } as any;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDevFlag = env.VITE_DEVELOPMENT === 'true';
  const enableHttps = env.VITE_ENABLE_HTTPS === 'true';

  // Check if mkcert certificates exist
  const certPath = path.resolve(__dirname, 'localhost+3.pem');
  const keyPath = path.resolve(__dirname, 'localhost+3-key.pem');
  const hasMkcertCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);
  const shouldUseHttps = enableHttps && hasMkcertCerts;

  return {
    worker: {
      format: 'es',
    },
    server: {
      host: true,  // Listen on all addresses (allows access via IP)
      // Allow tenant subdomains in local dev like `tenant.localhost`
      // (prevents "Blocked request. This host is not allowed" in some Vite versions/configs)
      allowedHosts: ['.localhost', 'localhost', '127.0.0.1'],
      // Use mkcert certificates if HTTPS is explicitly enabled and certificates are available
      ...(shouldUseHttps ? {
        https: {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      } : {})
    },
    plugins: [
      // Only use basicSsl if HTTPS is enabled, mkcert certs don't exist
      enableHttps && !hasMkcertCerts && basicSsl(),
      react(), 
      tailwindcss(),
      visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
      // Obfuscate only cache-related chunks in production (uses obfuscator.io engine)
      !isDevFlag && cacheObfuscator({
        controlFlowFlattening: true,
        stringArray: true,
        stringArrayRotate: true,
        rotateStringArray: true,
        splitStrings: true,
        splitStringsChunkLength: 6,
        numbersToExpressions: true,
        identifierNamesGenerator: 'hexadecimal',
        selfDefending: false,
        deadCodeInjection: false,
        sourceMap: false,
        compact: true
      }),
      // PWA plugin temporarily disabled for debugging
      // VitePWA({
      //   registerType: 'autoUpdate',
      //   injectRegister: null,
      //   includeAssets: ['whagons.svg'],
      //   manifest: {
      //     name: 'WHagons',
      //     short_name: 'WHagons',
      //     start_url: '/',
      //     display: 'standalone',
      //     background_color: '#ffffff',
      //     theme_color: '#ffffff'
      //   },
      //   workbox: {
      //     // Default precaching of build assets; include large vendor chunks as well
      //     globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      //     maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      //     // Enable skipWaiting and clientsClaim for immediate updates
      //     skipWaiting: true,
      //     clientsClaim: true,
      //     // Check for updates more frequently
      //     cleanupOutdatedCaches: true,
      //     runtimeCaching: [
      //       {
      //         urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
      //         handler: 'NetworkFirst',
      //         options: {
      //           cacheName: 'api-cache',
      //           expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
      //           cacheableResponse: { statuses: [0, 200] }
      //         }
      //       }
      //     ]
      //   },
      //   devOptions: { enabled: false }
      // })
    ].filter(Boolean),
    define: {
      global: 'globalThis',
    },
    preview: {
      allowedHosts: ['whagons5.whagons.com'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['firebase', '@firebase/app', '@firebase/messaging', '@firebase/auth', '@firebase/component'],
    },
    optimizeDeps: {
      // Exclude FontAwesome from pre-bundling to avoid circular dependency issues
      exclude: ['@fortawesome/pro-regular-svg-icons', '@fortawesome/fontawesome-common-types'],
      // Explicitly include firebase and all @firebase packages to ensure proper resolution
      include: [
        'firebase/app',
        'firebase/messaging',
        'firebase/auth',
        '@firebase/app',
        '@firebase/messaging',
        '@firebase/auth',
        '@firebase/component',
      ],
    },
    build: {
      // Enable build caching for faster rebuilds
      cacheDir: 'node_modules/.vite',
      // Optimize chunk size warnings
      chunkSizeWarningLimit: 1000,
      // Use esbuild for faster minification (faster than terser)
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Put all firebase packages in a single chunk to avoid "Service not available" issues
            if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
              return 'firebase-bundle';
            }

            // Split cache/IndexedDB code into its own chunk
            if (id.includes('/src/store/indexedDB/')) return 'cache-sec';

            // Preserve existing groupings
            if (id.includes('/node_modules/react')) return 'vendor';
            if (id.includes('/node_modules/react-dom')) return 'vendor';

            // Heavy data grid packages
            if (id.includes('/node_modules/ag-grid-community')) return 'ag-grid';
            if (id.includes('/node_modules/ag-grid-enterprise')) return 'ag-grid';
            if (id.includes('/node_modules/ag-grid-react')) return 'ag-grid-react';

            if (id.includes('/node_modules/react-router-dom')) return 'router';

            if (id.includes('/node_modules/@reduxjs/toolkit')) return 'redux';
            if (id.includes('/node_modules/react-redux')) return 'redux';
            if (id.includes('/node_modules/redux-persist')) return 'redux';

            const uiPkgs = ['@radix-ui/react-avatar','@radix-ui/react-collapsible','@radix-ui/react-dialog','@radix-ui/react-dropdown-menu','@radix-ui/react-label','@radix-ui/react-separator','@radix-ui/react-slot','@radix-ui/react-tabs','@radix-ui/react-tooltip','lucide-react','class-variance-authority'];
            if (uiPkgs.some(p => id.includes(`/node_modules/${p}/`))) return 'ui';

            const mdPkgs = ['react-markdown','remark-breaks','remark-gfm','prismjs'];
            if (mdPkgs.some(p => id.includes(`/node_modules/${p}/`))) return 'markdown';

            if (id.includes('/node_modules/axios')) return 'http';

            // Don't chunk FontAwesome separately - causes circular dependency issues
            // Keep it in main bundle to avoid initialization order problems
            // if (id.includes('/node_modules/@fortawesome')) return 'icons';
            if (id.includes('/node_modules/crypto-js')) return 'crypto';

            const utilPkgs = ['tailwind-merge','tailwindcss-animate','clsx'];
            if (utilPkgs.some(p => id.includes(`/node_modules/${p}/`))) return 'utils';

            return undefined;
          },
        },
      },
    },
  };
});
