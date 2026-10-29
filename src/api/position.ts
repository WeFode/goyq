import {http} from "@/utils/http";

/** 获取岗位列表 */
export const positionListQuery = (data: any) => {
  return http.request<any>("get", "/hr/position/list", {params: data});
};

/** 新增岗位 */
export const addPosition = (data: any) => {
  return http.request<any>("post", "/hr/position", {data});
};

/** 更新岗位 */
export const updatePosition = (data: any) => {    
  return http.request<any>("put", `/hr/position/${data.id}`, {data});
};

/** 删除岗位 */
export const deletePosition = (id: number) => {
  return http.request<any>("delete", `/hr/position/${id}`);
};

/** 获取岗位详情 */
export const getPosition = (id: number) => {
  return http.request<any>("get", `/hr/position/${id}`);
};
