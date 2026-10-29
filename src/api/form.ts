import { http } from "@/utils/http";

/** 获取表单列表 */
export const getFormList = (params?: object) => {
  return http.request("get", "/workflow/form-design/list", { params });
};

/** 获取表单详情 */
export const getFormById = (id: string) => {
  return http.request("get", `/workflow/form-design/${id}`);
};

/** 新增表单 */ 
export const addForm = (data?: object) => {
  return http.request("post", "/workflow/form-design", { data });
};

/** 更新表单 */
export const updateForm = (data: any) => {
  return http.request("put", `/workflow/form-design/${data?.id}`, { data });
};

/** 删除表单 */
export const deleteForm = (id: string) => {
  return http.request("delete", `/workflow/form-design/${id}`);
};
