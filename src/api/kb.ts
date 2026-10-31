import { http } from "@/utils/http";

/** 知识库分类 */
export interface KbCategory {
  id: string;
  parentId: string;
  name: string;
  scope: "company" | "personal";
  sort: number;
  icon?: string;
  docCount?: number;
}

/** 文档附件 */
export interface KbAttachment {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
  fileExt?: string;
}

/** 知识库文档 */
export interface KbDoc {
  id: string;
  categoryId: string;
  categoryName?: string;
  title: string;
  intro?: string;
  scope: "company" | "personal";
  ownerId?: string;
  ownerName?: string;
  tags?: string;
  fileCount: number;
  viewCount: number;
  downloadCount: number;
  status: number;
  createdAt?: string;
  updatedAt?: string;
  cover?: string;
  /** 正文检索命中的片段，仅 /kb/doc/search 返回 */
  snippet?: string;
  /** false 表示命中位置靠后，片段取的是文档开头 */
  snippetIsHit?: boolean;
  attachments?: KbAttachment[];
}

/** 分类列表（平铺） */
export const kbCategoryListQuery = (params?: object) => {
  return http.request<any>("get", "/kb/category/list", { params });
};

/** 新增分类 */
export const createKbCategory = (data?: object) => {
  return http.request<any>("post", "/kb/category", { data });
};

/** 编辑分类 */
export const updateKbCategory = (id: string, data?: object) => {
  return http.request<any>("put", `/kb/category/${id}`, { data });
};

/** 删除分类 */
export const deleteKbCategory = (id: string) => {
  return http.request<any>("delete", `/kb/category/${id}`);
};

/** 文档列表 */
export const kbDocListQuery = (params?: object) => {
  return http.request<any>("get", "/kb/doc/list", { params });
};

/**
 * 按附件正文检索文档。
 * 可见性由后端按“企业文档全员 / 个人文件仅本人”收敛，前端不需传拥有者。
 */
export const kbDocSearch = (params: {
  keyword: string;
  scope?: string;
  categoryId?: string;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}) => {
  return http.request<any>("get", "/kb/doc/search", { params });
};

/** 文档详情 */
export const kbDocDetailQuery = (id: string) => {
  return http.request<any>("get", `/kb/doc/${id}`);
};

/** 上传文档（绑定已上传的附件） */
export const createKbDoc = (data?: object) => {
  return http.request<any>("post", "/kb/doc", { data });
};

/** 编辑文档 */
export const updateKbDoc = (id: string, data?: object) => {
  return http.request<any>("put", `/kb/doc/${id}`, { data });
};

/** 删除文档 */
export const deleteKbDoc = (id: string) => {
  return http.request<any>("delete", `/kb/doc/${id}`);
};

/** 发布到企业库 */
export const publishKbDoc = (id: string) => {
  return http.request<any>("post", `/kb/doc/${id}/publish`);
};

/** 归档 / 取消归档 */
export const archiveKbDoc = (id: string, status: number) => {
  return http.request<any>("post", `/kb/doc/${id}/archive`, { data: { status } });
};

/** 记录浏览 */
export const viewKbDoc = (id: string) => {
  return http.request<any>("post", `/kb/doc/${id}/view`);
};

/** 下载附件（计数并返回签名地址） */
export const downloadKbDoc = (id: string, attachmentId?: string) => {
  return http.request<any>("post", `/kb/doc/${id}/download`, {
    data: { attachmentId }
  });
};
