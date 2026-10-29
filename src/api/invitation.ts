import {http} from "@/utils/http";

/** 获取邀请码列表 */
export const invitationListQuery = (data: any) => {
  return http.request<any>("get", "/hr/invitation-code/list", {params: data});
};

/** 新增邀请码 */
export const addInvitation = (data: any) => {
  return http.request<any>("post", "/hr/invitation-code", {data});
};

/** 更新邀请码 */
export const updateInvitation = (data: any) => {    
  return http.request<any>("put", `/hr/invitation-code/${data.id}`, {data});
};

/** 删除邀请码 */
export const deleteInvitation = (id: string) => {
  return http.request<any>("delete", `/hr/invitation-code/${id}`);
};

/** 获取邀请码详情 */
export const getInvitation = (id: string) => {
  return http.request<any>("get", `/hr/invitation-code/${id}`);
};

/** 申请账号(邀请码注册) */
export const applyAccount = (data: any) => {
  return http.request<any>("post", "/hr/employee/invite", {data});
};