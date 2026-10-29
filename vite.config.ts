import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    base: env.VITE_PUBLIC_PATH || "/",
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    server: {
      port: Number(env.VITE_PORT || 8849),
      host: "0.0.0.0",
      proxy: {
        // 业务接口
        "/api/v1": {
          target: env.VITE_PROXY_TARGET || "http://1.95.208.188:6886",
          changeOrigin: true,
          secure: false,
          ws: true
        },
        // WebSocket
        "/ws": {
          target: env.VITE_WS_PROXY_TARGET || "ws://127.0.0.1:8080",
          changeOrigin: true,
          ws: true,
          rewrite: path => path.replace(/^\/ws/, "/api/v1")
        },
        // 附件（后端 serverRoot=resource，/files/xxx 直接映射 resource/files/xxx）
        "/files": {
          target: env.VITE_FILE_PROXY_TARGET || "http://192.168.3.54:8080",
          changeOrigin: true
        },
        // 接口文档（Swagger UI）
        "/swagger": {
          target: env.VITE_PROXY_TARGET || "http://1.95.208.188:6886",
          changeOrigin: true
        },
        "/api.json": {
          target: env.VITE_PROXY_TARGET || "http://1.95.208.188:6886",
          changeOrigin: true
        }
      }
    },
    build: {
      target: "es2015",
      sourcemap: false,
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        output: {
          chunkFileNames: "static/js/[name]-[hash].js",
          entryFileNames: "static/js/[name]-[hash].js",
          assetFileNames: "static/[ext]/[name]-[hash].[ext]"
        }
      }
    }
  };
});
