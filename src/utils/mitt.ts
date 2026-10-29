import type { Emitter } from "mitt";
import mitt from "mitt";

/** 全局公共事件类型声明 */
type Events = {
  /** 标签页发生变化 */
  tagViewsChange: string;
  /** 侧边栏 Logo 显示状态 */
  logoChange: boolean;
  /** WebSocket 收到消息 */
  websocketMessage: string;
  wsMessage: {
    id: number;
    type: string;
    content: string;
    fromUserId: number;
    toUserId: number;
    createdAt: string;
    isRead: boolean;
    isRecalled: boolean;
  };
  wsConnected: boolean;
  wsError: string;
  /** 工作台统计数量变化 */
  workCountChanged: null;
  /** 打开公告详情（WebSocket 推送时触发） */
  openAnnouncementDetail: any;
  /** 主部门切换 */
  primaryDeptChanged: {
    departmentId: string;
    departments: any[];
  };
};

export const emitter: Emitter<Events> = mitt<Events>();
