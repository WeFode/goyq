import {http} from "@/utils/http";

/** 获取员工列表 */
export const employeeListQuery = (data: any) => {
  return http.request<any>("get", "/hr/employee/list", {params: data});
};

/** 获取员工选择器列表 */
export const employeeSelectorListQuery = (data: any) => {
  return http.request<any>("get", "/hr/employee/selector-list", {params: data});
};

/** 新增员工 */
export const addEmployee = (data: any) => {
  return http.request<any>("post", "/hr/employee", {data});
};

/** 更新员工 */
export const updateEmployee = (data: any) => {    
  return http.request<any>("put", `/hr/employee/${data.id}`, {data});
};

/** 删除员工 */
export const deleteEmployee = (id: number) => {
  return http.request<any>("delete", `/hr/employee/${id}`);
};

/** 获取员工详情 */
export const getEmployee = (id: string) => {
  return http.request<any>("get", `/hr/employee/${id}`);
};

/** 分配员工账号 */
export const assignEmployeeAccount = (data: any) => {
  return http.request<any>("post", "/hr/employee/assign-account", {data});
};

/** 获取没有账号的员工列表 */
export const getEmployeeWithoutAccount = () => {
  return http.request<any>("get", "/hr/employee/without-account");
};

/** 更新个人资料 */
export const updateEmployeeProfile = (data: any) => {
  return http.request<any>("put", "/hr/employee/profile", {data});
};