import { http } from "@/utils/http";

// 通知类型定义
export enum NotificationType {
  WORKFLOW_TASK = "workflow_task", // 审批任务
  WORKFLOW_CC = "workflow_cc", // 抄送通知
  WORKFLOW_APPROVED = "workflow_approved", // 审批通过
  WORKFLOW_REJECTED = "workflow_rejected", // 审批驳回
  WORKFLOW_COMMENT = "workflow_comment", // 审批评论
  INVITATION_SUCCESS = "invitation_success", // 邀请成功
  ANNOUNCEMENT = "announcement" // 公告
}

// 通知数据接口
export interface Notification {
  id: string;
  receiverId: string;
  receiverName: string;
  notificationType: NotificationType;
  title: string;
  content: string;
  relatedId?: string;
  relatedType?: string;
  isRead: boolean;
  readAt?: string;
  extraData?: any;
  createdAt: string;
}

// 获取通知列表
export function getNotificationList(params: {
  page: number;
  pageSize: number;
}) {
  return http.get<any, any>("/notification/list", { params });
}

// 获取未读数量
export function getUnreadCount() {
  return http.get<any, any>("/notification/unread-count");
}

// 标记单条已读
export const markNotificationRead =(data?: object) => {
  return http.request<any>("post", "/notification/mark-read", {data});
}

// 标记全部已读
export function markAllNotificationsRead() {
  return http.post("/notification/mark-all-read");
}


/** 管理员勾选部门发布公告 */
export function publishAnnouncement(data: any) {
  return http.post("/notification/announcement", {data});
}