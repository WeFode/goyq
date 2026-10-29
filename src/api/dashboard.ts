import { http } from "@/utils/http";

/** 首页看板聚合数据 */
export const getDashboardOverview = (params?: { days?: number }) => {
  return http.request<any>("get", "/dashboard/overview", { params });
};
