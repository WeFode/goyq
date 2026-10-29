import type { App, Component, Plugin } from "vue";

/** 常用 lodash 方法统一出口，业务侧无需直接依赖 lodash-es */
export { cloneDeep, debounce, isEqual } from "lodash-es";

/**
 * 通用工具集，用于替代 @pureadmin/utils 中的零散方法，
 * 只保留项目实际使用到的能力，避免引入整包依赖。
 */

const isEmptyValue = (value: unknown): boolean => {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
};

/** 单个值或集合内所有值是否都为空 */
export function isAllEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(isEmptyValue);
  if (value && typeof value === "object") {
    return Object.values(value as object).every(isEmptyValue);
  }
  return isEmptyValue(value);
}

export const isString = (value: unknown): value is string =>
  typeof value === "string";

export const isNumber = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(value);

export const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

export const isFunction = (value: unknown): value is Function =>
  typeof value === "function";

export const isObject = (value: unknown): value is Record<string, any> =>
  Object.prototype.toString.call(value) === "[object Object]";

export const isArray = Array.isArray;

export const isUrl = (value: string): boolean =>
  /^(https?|ftp):\/\//.test(value ?? "");

export const isEmail = (value: string): boolean =>
  /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(value ?? "");

export const isPhone = (value: string): boolean =>
  /^1[3-9]\d{9}$/.test(value ?? "");

/** `children` 是否包含 `arr` 中的全部元素 */
export function isIncludeAllChildren(
  arr: string[],
  children: string[]
): boolean {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.every(item => children?.includes(item));
}

/** 取两个数组的交集 */
export function intersection<T>(a: T[], b: T[]): T[] {
  return a.filter(item => b.includes(item));
}

/** 提取数组中指定 key 组成的数组 */
export function getKeyList<T extends Record<string, any>>(
  list: T[],
  key: keyof T
): Array<T[keyof T]> {
  return (list ?? []).map(item => item[key]);
}

/** 取分隔符之前的内容 */
export function subBefore(value: string, delimiter: string): string {
  const index = (value ?? "").indexOf(delimiter);
  return index === -1 ? value : value.slice(0, index);
}

/** 取分隔符之后的内容 */
export function subAfter(value: string, delimiter: string): string {
  const index = (value ?? "").indexOf(delimiter);
  return index === -1 ? value : value.slice(index + delimiter.length);
}

/** 是否移动端 */
export function deviceDetection(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/** 新窗口打开链接 */
export function openLink(url: string) {
  window.open(url, "_blank");
}

/** 通过 url 下载文件 */
export function downloadByUrl(url: string, fileName?: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName ?? "";
  anchor.target = "_blank";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/** 复制文本到剪贴板 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const result = document.execCommand("copy");
  document.body.removeChild(textarea);
  return result;
}

/** 字节数转可读文本 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, index)).toFixed(decimals)} ${units[index]}`;
}

/** 延时 */
export function delay(ms = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 为组件挂载 install 方法，便于 app.use 注册 */
export function withInstall<T extends Component>(component: T): Plugin {
  const comp = component as T & Plugin;
  comp.install = (app: App) => {
    app.component((comp as any).name, comp);
  };
  return comp;
}
