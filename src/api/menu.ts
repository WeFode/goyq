import {http} from "@/utils/http";

// 菜单列表
export const menuListQuery = (params?: any) => {
  return http.request<any>("get", "/sys/menu/list", {params});
};

// 新增菜单
export const addMenu = (data?: any) => {
  return http.request<any>("post", "/sys/menu", {data});
};

// 修改菜单
export const updateMenu = (data?: any) => {
  return http.request<any>("put", `/sys/menu/${data.id}`, {data});
};

// 删除菜单
export const deleteMenu = (id: number) => {
  return http.request<any>("delete", `/sys/menu/${id}`);
};

// 获取用户菜单动态路由
export const getAsyncRoutes = () => {
  return http.request("get", "/sys/menu/user");
};