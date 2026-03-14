import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || "https://localhost:7011";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false
        },
        "/chatHub": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          ws: true
        },
        "/uploads": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
