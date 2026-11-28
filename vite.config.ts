/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    svgr({ exportAsDefault: true }),
    react(),
  ],

  resolve: {
    alias: {},
  },
  server: {
    port: 4240,
    host: "localhost",
    // publicnode blocks browser calls to its Solana RPC; the dev server forwards them like a backend would.
    proxy: {
      "/solana-rpc": {
        target: "https://solana-rpc.publicnode.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/solana-rpc/, ""),
        configure: (proxy) =>
          proxy.on("proxyReq", (request) => {
            request.removeHeader("origin");
            request.removeHeader("referer");
          }),
      },
    },
    fs: {
      strict: false,
    },
  },

  worker: {
    format: "es",
    plugins: () => [],
  },

  build: {
    sourcemap: false,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      plugins: [],
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      tsconfig: "./tsconfig.json",
      // Limit target browsers due to issue: Big integer literals are not available in the configured target environment ("chrome87", "edge88", "es2020", "firefox78", "safari13" + 2 overrides)'
      target: "ES2022",
    },
  },
});
