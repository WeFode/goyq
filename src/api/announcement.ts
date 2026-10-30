import { http } from "@/utils/http";

/** 公告 */
export interface Announcement {
  id: string;
  title: string;
  content: string;
  deptIds: string[];
  deptNames: string[];
  status: number;
  publisherId?: string;
  publisherName?: string;
  targetCount: number;
  successCount: number;
  readCount: number;
  createdAt?: string;
  updatedAt?: string;
}

/** 公告列表 */
export const announcementListQuery = (params?: object) => {
  return http.request<any>("get", "/announcement/list", { params });
};

/** 公告详情 */
export const announcementDetailQuery = (id: string) => {
  return http.request<any>("get", `/announcement/${id}`);
};

/** 发布公告 */
export const publishAnnouncement = (data?: object) => {
  return http.request<any>("post", "/announcement", { data });
};

/** 撤回公告 */
export const withdrawAnnouncement = (id: string) => {
  return http.request<any>("post", `/announcement/${id}/withdraw`);
};

/** 删除公告 */
export const deleteAnnouncement = (id: string) => {
  return http.request<any>("delete", `/announcement/${id}`);
};
