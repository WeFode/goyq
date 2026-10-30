import axios from "axios";
import { getToken, formatToken } from "@/utils/auth";
import { message } from "@/utils/message";

/**
 * Excel 导出下载
 *
 * 说明：项目统一的 http 封装会在响应拦截里按 code 字段解包，
 * 无法承载二进制流，因此这里使用独立 axios 实例直接请求导出接口，
 * 由后端写出 Content-Disposition 附件流。
 */

/** 从 Content-Disposition 解析文件名，优先 RFC 5987 的 UTF-8 形式 */
function resolveFileName(disposition: string, fallback: string): string {
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      // 解码失败时退回兜底名称
    }
  }
  const ascii = /filename="?([^";]+)"?/i.exec(disposition);
  if (ascii?.[1]) return ascii[1];
  return fallback;
}

/**
 * 请求导出接口并触发浏览器下载
 *
 * @param path 接口路径（不含 /api/v1 前缀），如 export/hr-employees
 * @param params 查询条件
 * @param fallbackName 无法从响应头取名时使用的文件名
 */
export async function downloadExcel(
  path: string,
  params?: Record<string, any>,
  fallbackName = "导出数据.xlsx"
): Promise<void> {
  const token = getToken()?.accessToken;

  let response;
  try {
    response = await axios.get(`/api/v1/${path}`, {
      params,
      responseType: "blob",
      timeout: 120000,
      withCredentials: true,
      headers: token ? { Authorization: formatToken(token) } : {}
    });
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 401) {
      message("登录已过期，请重新登录", { type: "error" });
    } else if (status === 403) {
      message("没有权限执行导出", { type: "error" });
    } else {
      message(error?.message || "导出失败", { type: "error" });
    }
    return;
  }

  const blob: Blob = response.data;
  // 后端出错时会返回 JSON 错误体（同样是 blob），需先识别再提示
  if (blob.type && blob.type.includes("application/json")) {
    try {
      const parsed = JSON.parse(await blob.text());
      message(parsed?.message || "导出失败", { type: "error" });
    } catch {
      message("导出失败", { type: "error" });
    }
    return;
  }

  const fileName = resolveFileName(
    String(response.headers?.["content-disposition"] || ""),
    fallbackName
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  message(`已导出「${fileName}」`, { type: "success" });
}
