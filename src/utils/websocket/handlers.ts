import { markNotificationRead, NotificationType } from "@/api/notification";
import { emitter } from "@/utils/mitt";
import { ElNotification } from "element-plus";
import { h } from "vue";
import router from "@/router";

// WebSocket消息类型定义
export interface WebSocketMessage {
  type: "notification" | "pong";
  data?: NotificationData;
  timestamp?: number;
}

// 通知数据类型
export interface NotificationData {
  id: string;
  notificationType: NotificationType;
  title: string;
  content: string;
  relatedId?: string;
  relatedType?: string;
  extraData?: any;
}

// 通知类型配置映射
const notificationTypeConfig: Record<
  NotificationType,
  { color: string; text: string }
> = {
  [NotificationType.WORKFLOW_TASK]: {
    color: "warning",
    text: "新的审批任务"
  },
  [NotificationType.WORKFLOW_CC]: { color: "info", text: "抄送通知" },
  [NotificationType.WORKFLOW_APPROVED]: {
    color: "success",
    text: "审批已通过"
  },
  [NotificationType.WORKFLOW_REJECTED]: {
    color: "error",
    text: "审批已驳回"
  },
  [NotificationType.WORKFLOW_COMMENT]: {
    color: "info",
    text: "审批评论"
  },
  [NotificationType.INVITATION_SUCCESS]: {
    color: "success",
    text: "邀请成功"
  },
  [NotificationType.ANNOUNCEMENT]: {
    color: "warning",
    text: "部门公告"
  }
};

// 根据通知类型处理跳转
function handleNotificationClick(notification: NotificationData) {
  // 标记通知为已读
  markNotificationRead({ notificationId: notification.id }).catch(() => {
    console.warn("标记通知已读失败");
  });

  const { notificationType, relatedId } = notification;

  switch (notificationType) {
    case NotificationType.WORKFLOW_TASK:
      // 跳转到待办标签页
      router.push({
        path: "/engine/instance/index",
        query: { instanceId: relatedId, tab: "todo" }
      });
      break;

    case NotificationType.WORKFLOW_CC:
      // 跳转到抄送标签页
      router.push({
        path: "/engine/instance/index",
        query: { instanceId: relatedId, tab: "cc" }
      });
      break;

    case NotificationType.WORKFLOW_APPROVED:
    case NotificationType.WORKFLOW_REJECTED:
    case NotificationType.WORKFLOW_COMMENT:
      // 跳转到我发起的标签页
      router.push({
        path: "/engine/instance/index",
        query: { instanceId: relatedId, tab: "initiated" }
      });
      break;

    case NotificationType.INVITATION_SUCCESS:
      // 跳转到用户管理页面
      router.push(
        {
          path: "/system/user/index",
          query: { status: 2 }
        });
      break;

    case NotificationType.ANNOUNCEMENT:
      // 触发打开公告详情弹窗事件
      emitter.emit("openAnnouncementDetail", notification);
      break;

    default:
      console.warn("未知的通知类型:", notificationType);
  }
}

// 保存监听器函数引用，用于防重复注册
let wsMessageHandler: ((message: WebSocketMessage) => void) | null = null;
let wsConnectedHandler: ((connected: boolean) => void) | null = null;
let wsErrorHandler: ((error: string) => void) | null = null;
let isHandlersSetup = false;

// 初始化消息处理器
export function setupWebSocketHandlers(): void {
  // 防止重复注册
  if (isHandlersSetup) {
    console.warn("[WebSocket] 消息处理器已初始化，跳过重复注册");
    return;
  }

  // 处理 WebSocket 消息
  wsMessageHandler = (message: WebSocketMessage) => {
    console.log("[WebSocket] 收到消息:", message);

    // 忽略心跳响应
    if (message.type === "pong") {
      return;
    }

    // 处理通知消息
    if (message.type === "notification" && message.data) {
      const notification = message.data;
      const typeConfig =
        notificationTypeConfig[notification.notificationType] || {
          color: "info",
          text: "系统通知"
        };

      // 显示通知气泡
      const notificationInstance = ElNotification({
        title: typeConfig.text,
        message: h("div", { class: "flex flex-col gap-2" }, [
          h(
            "div",
            { class: "text-[var(--el-text-color-primary)] font-medium" },
            notification.title
          ),
          h(
            "div",
            { class: "text-[var(--el-text-color-regular)] text-sm" },
            notification.content
          ),
          h(
            "el-button",
            {
              type: "primary",
              text: true,
              class: "mt-2 !p-0 cursor-pointer hover:underline",
              onClick: () => {
                notificationInstance.close();
                handleNotificationClick(notification);
              }
            },
            "查看详情 →"
          )
        ]),
        type: typeConfig.color as any,
        duration: 6000,
        position: "top-right",
        offset: 60
      });

      // 触发未读数量更新事件
      (emitter as any).emit("notificationReceived");
    }
  };

  // 处理连接状态变化
  wsConnectedHandler = (connected: boolean) => {
    if (connected) {
      console.log("[WebSocket] 连接已建立");
    } else {
      console.log("[WebSocket] 连接已断开");
    }
  };

  // 处理错误
  wsErrorHandler = (error: string) => {
    console.error("[WebSocket] 错误:", error);
  };

  // 注册事件监听器
  (emitter as any).on("wsMessage", wsMessageHandler);
  emitter.on("wsConnected", wsConnectedHandler);
  emitter.on("wsError", wsErrorHandler);

  isHandlersSetup = true;
  console.log("[WebSocket] 消息处理器初始化完成");
}
