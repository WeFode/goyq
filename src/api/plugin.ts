import { http } from "@/utils/http";

/** 应用（插件）信息：目录事实 + 当前租户的开通状态 */
export interface PluginInfo {
  /** 应用编码，同时是表前缀与权限码前缀 */
  code: string;
  name: string;
  icon?: string;
  version: string;
  /** 核心应用不可停用 */
  core: boolean;
  /** 未显式配置时的默认开通状态 */
  defaultEnabled: boolean;
  /** 当前租户最终可用状态 */
  enabled: boolean;
  /** 是否存在显式开通记录 */
  overridden: boolean;
  statusOverride: boolean;
  /** 平台目录上下架 */
  catalogStatus: boolean;
  description?: string;
  menuNames?: string;
  pathPrefixes?: string;
  permissionPrefix?: string;
  configJson?: string;
  expireAt?: string;
  remark?: string;
  sort: number;
}

/** 应用目录列表（平台运营视角，可指定租户） */
export const pluginListQuery = (params?: { tenantId?: string; keyword?: string }) => {
  return http.request<any>("get", "/sys/plugin/list", { params });
};

/** 当前租户可用应用（应用中心） */
export const myPluginsQuery = () => {
  return http.request<any>("get", "/sys/plugin/mine");
};

/** 开通/停用应用（需 sys:plugin:enable） */
export const setPluginStatus = (data: {
  code: string;
  tenantId?: string;
  status: boolean;
  remark?: string;
}) => {
  return http.request<any>("put", `/sys/plugin/${data.code}/status`, { data });
};

/** 保存应用级参数（需 sys:plugin:config） */
export const setPluginConfig = (data: {
  code: string;
  tenantId?: string;
  configJson: string;
}) => {
  return http.request<any>("put", `/sys/plugin/${data.code}/config`, { data });
};
