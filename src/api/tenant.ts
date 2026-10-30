import { http } from "@/utils/http";

/** 租户信息 */
export interface TenantInfo {
  id: string;
  code: string;
  name: string;
  contactName?: string;
  contactPhone?: string;
  plan: string;
  status: number;
  expireAt?: string;
  maxUsers: number;
  remark?: string;
  userCount: number;
  createdAt?: string;
}

/** 租户用量与配额 */
export interface TenantUsage {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  plan: string;
  status: number;
  expireAt?: string;
  maxUsers: number;
  userCount: number;
  userPercent: number;
  roleCount: number;
  deptCount: number;
  employeeCount: number;
  workflowCount: number;
  instanceCount: number;
  fileCount: number;
  storageBytes: number;
  storageText: string;
}

/** 租户列表 */
export const tenantListQuery = (params?: object) => {
  return http.request<any>("get", "/sys/tenant/list", { params });
};

/** 租户详情 */
export const tenantDetailQuery = (id: string) => {
  return http.request<any>("get", `/sys/tenant/${id}`);
};

/** 开通租户 */
export const createTenant = (data?: object) => {
  return http.request<any>("post", "/sys/tenant", { data });
};

/** 更新租户 */
export const updateTenant = (id: string, data?: object) => {
  return http.request<any>("put", `/sys/tenant/${id}`, { data });
};

/** 平台管理员切换租户（重签 token） */
export const switchTenant = (id: string) => {
  return http.request<any>("post", `/sys/tenant/${id}/switch`);
};

/** 当前租户 */
export const currentTenantQuery = () => {
  return http.request<any>("get", "/sys/tenant/current");
};

/** 租户用量与配额（不传 tenantId 则统计当租户） */
export const tenantUsageQuery = (params?: object) => {
  return http.request<any>("get", "/sys/tenant/usage", { params });
};
