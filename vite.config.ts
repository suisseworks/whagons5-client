import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { VitePWA } from 'vite-plugin-pwa';

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

  return {
    plugins: [
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
      // Include PWA plugin to provide virtual module resolution in all modes
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
        includeAssets: ['whagons.svg'],
        manifest: {
          name: 'WHagons',
          short_name: 'WHagons',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#ffffff'
        },
        workbox: {
          // Default precaching of build assets; include large vendor chunks as well
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
                cacheableResponse: { statuses: [0, 200] }
              }
            }
          ]
        },
        devOptions: { enabled: false }
      })
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

            if (id.includes('/node_modules/firebase/auth') || id.includes('/node_modules/@firebase/auth')) return 'firebase';

            const uiPkgs = ['@radix-ui/react-avatar','@radix-ui/react-collapsible','@radix-ui/react-dialog','@radix-ui/react-dropdown-menu','@radix-ui/react-label','@radix-ui/react-separator','@radix-ui/react-slot','@radix-ui/react-tabs','@radix-ui/react-tooltip','lucide-react','class-variance-authority'];
            if (uiPkgs.some(p => id.includes(`/node_modules/${p}/`))) return 'ui';

            const mdPkgs = ['react-markdown','remark-breaks','remark-gfm','prismjs'];
            if (mdPkgs.some(p => id.includes(`/node_modules/${p}/`))) return 'markdown';

            if (id.includes('/node_modules/axios')) return 'http';

            if (id.includes('/node_modules/sockjs-client')) return 'sockjs';

            // Icons and crypto helpers
            if (id.includes('/node_modules/@fortawesome')) return 'icons';
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
