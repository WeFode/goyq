import {http} from "@/utils/http";

/** 获取角色列表 */
export const roleListQuery = (params: any) => {
  return http.get("/sys/role/list", { params });
};

/** 新增角色 */
export const addRole = (data: any) => {
  return http.post("/sys/role", {data});
};

/** 更新角色 */
export const updateRole = (data: any) => {
  return http.request<any>("put", "/sys/role/${data.id}", {data});
};

/** 删除角色 */
export const deleteRole = (id: string) => {
  return http.request<any>("delete", `/sys/role/${id}`);
};

/** 更新角色菜单 */
export const updateRoleMenu = (data: {roleId: string; menuIds: number[]}) => {
  return http.request<any>("post", `sys/role/${data.roleId}/menus`, {
    data: {roleId: data.roleId, menuIds: data.menuIds}
  });
};

/** 获取角色菜单 */
export const getRoleMenu = (id: string) => {
  return http.request<any>("get", `/sys/role/${id}/menus`);
};

/** 获取菜单-权限树形结构 */
export const getMenuPermissionTree = () => {
  return http.request<any>("get", "sys/roles/menu-permissions");
};

/** 获取角色权限 */
export const getRolePermissions = (id: string) => {
  return http.request<{
    data: string[];
  }>("get", `/sys/role/${id}/permissions`);
};

/** 更新角色权限 */
export const updateRolePermissions = (
  id: string,
  permissionIds: string[]
) => {
  return http.request<any>("post", `/sys/role/${id}/permissions`, {
    data: {permissionIds: permissionIds}
  });
};
