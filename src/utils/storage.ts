import { getConfig } from "@/config";

type StorageType = "localStorage" | "sessionStorage";

/**
 * 本地存储封装（替代 @pureadmin/utils 的 storageLocal）
 * 统一 JSON 序列化，读取失败时降级返回原始字符串
 */
class WebStorage {
  private storage: globalThis.Storage;

  constructor(type: StorageType = "localStorage") {
    this.storage = type === "localStorage" ? window.localStorage : window.sessionStorage;
  }

  getItem<T>(key: string): T {
    const value = this.storage.getItem(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  setItem(key: string, value: unknown) {
    this.storage.setItem(key, JSON.stringify(value));
  }

  removeItem(key: string) {
    this.storage.removeItem(key);
  }

  clear() {
    this.storage.clear();
  }
}

export const storageLocal = () => new WebStorage("localStorage");
export const storageSession = () => new WebStorage("sessionStorage");

/** 拼装带命名空间前缀的 key */
export const namespacedKey = (key: string) =>
  `${getConfig()?.ResponsiveStorageNameSpace ?? ""}${key}`;
