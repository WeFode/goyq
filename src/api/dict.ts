import { http } from "@/utils/http";

/** 字典 */
export interface Dict {
  id: string;
  dictCode: string;
  dictName: string;
  category: "system" | "business";
  isSystem: boolean;
  status: number;
  remark?: string;
  itemCount: number;
  createdAt?: string;
  updatedAt?: string;
}

/** 字典项 */
export interface DictItem {
  id: string;
  dictCode: string;
  itemValue: string;
  itemLabel: string;
  tone: string;
  sort: number;
  status: number;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 获取字典列表 */
export const dictListQuery = (params?: object) => {
  return http.request<any>("get", "/sys/dict/list", { params });
};

/** 新建字典 */
export const addDict = (data?: object) => {
  return http.request<any>("post", "/sys/dict", { data });
};

/** 更新字典 */
export const updateDict = (id: string, data?: object) => {
  return http.request<any>("put", `/sys/dict/${id}`, { data });
};

/** 删除字典 */
export const deleteDict = (id: string) => {
  return http.request<any>("delete", `/sys/dict/${id}`);
};

/** 按编码获取字典项 */
export const dictItemsQuery = (params: object) => {
  return http.request<any>("get", "/sys/dict/items", { params });
};

/** 批量获取字典项（多个编码用英文逗号分隔） */
export const dictOptionsQuery = (codes: string) => {
  return http.request<any>("get", "/sys/dict/options", { params: { codes } });
};

/** 新建字典项 */
export const addDictItem = (data?: object) => {
  return http.request<any>("post", "/sys/dict/item", { data });
};

/** 更新字典项 */
export const updateDictItem = (id: string, data?: object) => {
  return http.request<any>("put", `/sys/dict/item/${id}`, { data });
};

/** 删除字典项 */
export const deleteDictItem = (id: string) => {
  return http.request<any>("delete", `/sys/dict/item/${id}`);
};
