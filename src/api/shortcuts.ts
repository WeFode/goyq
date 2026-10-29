import { http } from "@/utils/http";

// 获取快捷入口列表
export const getShortcutsList = (data?: object) => {
    return http.request("post", "/shortcuts/list", { data });
};

// 获取激活的快捷入口列表（用于前端展示）
export const getActiveShortcuts = (platform: string) => {
    return http.request("get", `/shortcuts/active?platform=${platform}`);
};

// 创建快捷入口
export const createShortcuts = (data?: object) => {
    return http.request("post", "/shortcuts", { data });
};

// 更新快捷入口
export const updateShortcuts = (data?: object) => {
    return http.request("put", "/shortcuts", { data });
};

// 更新快捷入口状态 (1-启用 2-禁用)
export const updateShortcutsStatus = (id: number, status: number) => {
    return http.request("put", `/shortcuts/status`, { data: { id, status } });
};

// 删除快捷入口
export const deleteShortcuts = (id: number) => {
    return http.request("delete", `/shortcuts/${id}`);
};