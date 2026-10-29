import {http} from "@/utils/http";

/** 获取权限列表 */
export const permissionListQuery = (params?: object) => {
  return http.request<any>("get", "/sys/permission/list", {params});
};

/** 添加权限 */
export const addPermission = (data?: object) => {
  return http.request<any>("post", "/sys/permission", {data});
};

/** 更新权限 */
export const updatePermission = (id: string, data?: any) => {
  return http.request<any>("put", `/sys/permission/${id}`, {
    data
  });
};

/** 删除权限 */
export const deletePermission = (id: string) => {
  return http.request<any>("delete", `/sys/permission/${id}`);
};

// 获取用户权限
export const getUserPermissionList = () => {
  return http.request<any>("get", "/sys/user/permissions");
};

/** 角色分配权限 */
export const updateRolePermissions = (roleId: string, data?: object) => {
  return http.request<any>("post", `/sys/role/${roleId}/permissions`, {
    data
  });
};

/** 获取角色当前已有的权限数据 */
export const getRolePermissions = (roleId: string) => {
  return http.request<any>("get", `/sys/role/${roleId}/permissions`);
};
