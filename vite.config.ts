import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
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
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React
          vendor: ['react', 'react-dom'],
          
          // Routing
          router: ['react-router-dom'],
          
          // State Management  
          redux: ['@reduxjs/toolkit', 'react-redux', 'redux-persist'],
          
          // Authentication
          firebase: ['firebase/auth', '@firebase/auth'],
          
          // UI Components
          ui: [
            '@radix-ui/react-avatar',
            '@radix-ui/react-collapsible', 
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            'lucide-react',
            'class-variance-authority',
          ],
          
          // Markdown & Code
          markdown: [
            'react-markdown', 
            'remark-breaks', 
            'remark-gfm',
            'prismjs',
          ],
          
          // HTTP Client
          http: ['axios'],
          
          // WebSocket/SockJS
          sockjs: ['sockjs-client'],
          
          // Utilities
          utils: [
            'tailwind-merge',
            'tailwindcss-animate',
            'clsx',
          ],
        },
      },
    },
  },
});
