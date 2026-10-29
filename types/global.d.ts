import type { App } from "vue";

/**
 * 全局类型声明，无需引入直接在 `.vue` 、`.ts` 文件使用即可获得类型提示
 */
declare global {
  /** 打包压缩格式的类型声明 */
  type ViteCompression =
    | "none"
    | "gzip"
    | "brotli"
    | "both"
    | "gzip-clear"
    | "brotli-clear"
    | "both-clear";

  /** 全局自定义环境变量的类型声明 */
  interface ViteEnv {
    VITE_PORT: number;
    VITE_PUBLIC_PATH: string;
    VITE_ROUTER_HISTORY: string;
    VITE_HIDE_HOME: string;
    VITE_API_URL: string;
    VITE_FILE_BASE_URL: string;
    VITE_WS_URL: string;
  }

  interface Window {
    __APP__: App<Element>;
  }

  /** 对应 public/platform-config.json 文件的类型声明 */
  interface PlatformConfigs {
    Version?: string;
    Title?: string;
    FixedHeader?: boolean;
    KeepAlive?: boolean;
    HideTabs?: boolean;
    ResponsiveStorageNameSpace?: string;
  }

  /** 缓存到浏览器本地存储的类型声明 */
  interface StorageConfigs {
    sidebarStatus?: boolean;
    showLogo?: boolean;
    username?: string;
  }
}

export {};
