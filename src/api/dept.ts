import {http} from "@/utils/http";

/** 获取部门列表 */
export const deptListQuery = (params: any) => {
  return http.request<any>("get", "/hr/department/list", {params});
};

/** 新增部门 */
export const addDept = (data: any) => {
  return http.request<any>("post", "/hr/department", {data});
};

/** 更新部门 */
export const updateDept = (data: any) => {
  return http.request<any>("put", `/hr/department/${data.id}`, {data});
};

/** 删除部门 */
export const deleteDept = (id: number) => {
  return http.request<any>("delete", `/hr/department/${id}`);
};

/** 获取部门树 */
export const deptTreeQuery = () => {
  return http.request<any>("get", "/hr/department/tree", {});
};
