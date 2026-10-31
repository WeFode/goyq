import { http } from "@/utils/http";

/** 附件预览元信息 */
export interface FilePreviewInfo {
  fileId: string;
  fileName: string;
  fileSize: number;
  /** 含点，如 ".pdf" */
  fileExt: string;
  mimeType: string;
  /** 预览方式：image / pdf / none */
  kind: "image" | "pdf" | "none" | string;
  previewable: boolean;
  /** 带时效的签名预览地址 */
  previewUrl: string;
  downloadUrl: string;
  /** 不可预览时的原因说明 */
  message: string;
  pageCount: number;
  charCount: number;
  /** 0待处理 1完成 2失败 3不支持 */
  textStatus: number;
  maxPreviewMb: number;
  extractors: string[];
}

/** 附件正文命中 */
export interface FileTextHit {
  fileId: string;
  snippet: string;
  /** false 表示命中位置在取回窗口之外，片段是文档开头 */
  snippetIsHit: boolean;
  pageCount: number;
  charCount: number;
}

/**
 * 获取附件预览元信息。
 * 预览地址带时效（默认 15 分钟），过期需重新调用本接口换取，不要长期缓存。
 */
export const filePreviewQuery = (fileId: string) => {
  return http.request<any>("get", `/common/file/${fileId}/preview`);
};

/**
 * 附件正文检索（通用入口，需 sys:file:search）。
 * fileIds 必须由调用方按业务可见性收敛，能力层不判断“你能看哪个文件”。
 */
export const fileTextSearch = (data: { keyword: string; fileIds: string[] }) => {
  return http.request<any>("post", "/common/file/text-search", { data });
};
