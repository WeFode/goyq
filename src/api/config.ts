import { http } from "@/utils/http";

/** 系统参数 */
export interface ConfigInfo {
  id: string;
  configKey: string;
  configName: string;
  configValue: string;
  configGroup: string;
  valueType: "string" | "number" | "boolean" | "text";
  isSystem: boolean;
  isPublic: boolean;
  sort: number;
  remark?: string;
  updatedAt?: string;
}

/** 参数分组 */
export interface ConfigGroupInfo {
  code: string;
  name: string;
  count: number;
}

/** 获取参数分组 */
export const configGroupsQuery = () => {
  return http.request<any>("get", "/sys/config/groups");
};

/** 获取参数列表 */
export const configListQuery = (params?: object) => {
  return http.request<any>("get", "/sys/config/list", { params });
};

/** 批量保存参数 */
export const batchSaveConfig = (data: object) => {
  return http.request<any>("post", "/sys/config/batch", { data });
};

/** 新增参数 */
export const addConfig = (data?: object) => {
  return http.request<any>("post", "/sys/config", { data });
};

/** 删除参数 */
export const deleteConfig = (id: string) => {
  return http.request<any>("delete", `/sys/config/${id}`);
};

/** 获取公开参数（站点名称 / Logo 等） */
export const publicConfigsQuery = () => {
  return http.request<any>("get", "/sys/config/public");
};
