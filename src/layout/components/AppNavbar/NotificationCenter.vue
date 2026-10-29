<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  getNotificationList,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  NotificationType,
  type Notification
} from "@/api/notification";
import { emitter } from "@/utils/mitt";
import { formatRelativeTime } from "@/utils/formatTime";

/**
 * 通知中心：顶栏铃铛 + 未读气泡 + 全部通知抽屉
 * 公告类通知直接展示通知正文，不额外请求详情接口
 */
const router = useRouter();

const popoverVisible = ref(false);
const loading = ref(false);
const unreadCount = ref(0);
const notifications = ref<Notification[]>([]);

const drawerVisible = ref(false);
const drawerLoading = ref(false);
const drawerList = ref<Notification[]>([]);
const drawerTotal = ref(0);
const drawerPage = ref(1);
const drawerPageSize = ref(20);
const filterType = ref<"all" | "unread" | "read">("all");

const announcement = ref<Notification | null>(null);
const announcementVisible = ref(false);

/** 通知类型 → 图标与色彩 */
const typeMeta: Record<string, { icon: string; className: string }> = {
  [NotificationType.WORKFLOW_TASK]: {
    icon: "ri:list-check",
    className: "is-primary"
  },
  [NotificationType.WORKFLOW_CC]: {
    icon: "ep:copy-document",
    className: "is-warning"
  },
  [NotificationType.WORKFLOW_APPROVED]: {
    icon: "ep:circle-check",
    className: "is-success"
  },
  [NotificationType.WORKFLOW_REJECTED]: {
    icon: "ep:circle-close",
    className: "is-danger"
  },
  [NotificationType.WORKFLOW_COMMENT]: {
    icon: "ep:message",
    className: "is-info"
  },
  [NotificationType.INVITATION_SUCCESS]: {
    icon: "ep:user-filled",
    className: "is-primary"
  },
  [NotificationType.ANNOUNCEMENT]: {
    icon: "ri:file-info-line",
    className: "is-info"
  }
};

const getMeta = (type: string) =>
  typeMeta[type] ?? { icon: "ep:bell", className: "is-info" };

const recentList = computed(() => notifications.value.slice(0, 6));

async function loadUnreadCount() {
  try {
    const res: any = await getUnreadCount();
    if (res?.code === 0) unreadCount.value = res.data?.count ?? 0;
  } catch (error) {
    console.error("加载未读数量失败:", error);
  }
}

async function loadNotifications() {
  loading.value = true;
  try {
    const res: any = await getNotificationList({ page: 1, pageSize: 50 });
    if (res?.code === 0) notifications.value = res.data?.list ?? [];
  } catch (error) {
    console.error("加载通知列表失败:", error);
  } finally {
    loading.value = false;
  }
}

async function loadDrawerList() {
  drawerLoading.value = true;
  try {
    const params: { page: number; pageSize: number; isRead?: boolean } = {
      page: drawerPage.value,
      pageSize: drawerPageSize.value
    };
    if (filterType.value === "unread") params.isRead = false;
    if (filterType.value === "read") params.isRead = true;

    const res: any = await getNotificationList(params);
    if (res?.code === 0) {
      drawerList.value = res.data?.list ?? [];
      drawerTotal.value = res.data?.total ?? 0;
    }
  } catch (error) {
    console.error("加载通知列表失败:", error);
  } finally {
    drawerLoading.value = false;
  }
}

async function markRead(item: Notification) {
  if (item.isRead) return;
  try {
    await markNotificationRead({ notificationId: item.id });
    item.isRead = true;
    unreadCount.value = Math.max(0, unreadCount.value - 1);
    emitter.emit("workCountChanged", null);
  } catch (error) {
    console.error("标记已读失败:", error);
  }
}

async function markAllRead() {
  try {
    await markAllNotificationsRead();
    notifications.value.forEach(item => (item.isRead = true));
    drawerList.value.forEach(item => (item.isRead = true));
    unreadCount.value = 0;
    emitter.emit("workCountChanged", null);
    ElMessage.success("已全部标记为已读");
  } catch (error) {
    console.error("标记全部已读失败:", error);
  }
}

/** 点击通知：公告直接预览，其余按类型跳转 */
async function handleClick(item: Notification) {
  popoverVisible.value = false;

  if (item.notificationType === NotificationType.ANNOUNCEMENT) {
    announcement.value = item;
    announcementVisible.value = true;
    markRead(item);
    return;
  }

  markRead(item);

  const { relatedId } = item;
  switch (item.notificationType) {
    case NotificationType.WORKFLOW_TASK:
      router.push({
        path: "/engine/instance/index",
        query: { instanceId: relatedId, tab: "todo" }
      });
      break;
    case NotificationType.WORKFLOW_CC:
      router.push({
        path: "/engine/instance/index",
        query: { instanceId: relatedId, tab: "cc" }
      });
      break;
    case NotificationType.WORKFLOW_APPROVED:
    case NotificationType.WORKFLOW_REJECTED:
      router.push({
        path: "/engine/instance/index",
        query: { instanceId: relatedId, tab: "initiated" }
      });
      break;
    case NotificationType.WORKFLOW_COMMENT:
      router.push({
        path: "/engine/instance/index",
        query: { instanceId: relatedId }
      });
      break;
    case NotificationType.INVITATION_SUCCESS:
      router.push({ path: "/system/user/index", query: { status: 2 } });
      break;
    default:
      break;
  }
}

/** WebSocket 推送公告时直接打开预览 */
function openAnnouncement(payload: any) {
  if (!payload) return;
  announcement.value = {
    id: payload.id,
    notificationType: NotificationType.ANNOUNCEMENT,
    title: payload.title,
    content: payload.content,
    isRead: true,
    createdAt: new Date().toISOString()
  } as Notification;
  announcementVisible.value = true;
  loadUnreadCount();
}

function openDrawer() {
  popoverVisible.value = false;
  drawerVisible.value = true;
  drawerPage.value = 1;
  filterType.value = "all";
  loadDrawerList();
}

onMounted(() => {
  loadUnreadCount();
  emitter.on("openAnnouncementDetail", openAnnouncement);
});

onBeforeUnmount(() => {
  emitter.off("openAnnouncementDetail", openAnnouncement);
});
</script>

<template>
  <el-popover
    v-model:visible="popoverVisible"
    placement="bottom-end"
    :width="360"
    trigger="click"
    popper-class="app-notification-popover"
    @show="loadNotifications"
  >
    <template #reference>
      <div class="app-navbar__action" title="通知中心">
        <el-badge
          :value="unreadCount"
          :max="99"
          :hidden="unreadCount === 0"
          :offset="[2, 2]"
        >
          <AppIcon icon="ep:bell" :size="17" />
        </el-badge>
      </div>
    </template>

    <div class="app-notice">
      <header class="app-notice__header">
        <span class="app-notice__title">通知中心</span>
        <el-button v-if="unreadCount > 0" link type="primary" @click="markAllRead">
          全部已读
        </el-button>
      </header>

      <div v-loading="loading" class="app-notice__list">
        <div
          v-for="item in recentList"
          :key="item.id"
          class="app-notice__item"
          :class="{ 'is-unread': !item.isRead }"
          @click="handleClick(item)"
        >
          <span class="app-notice__icon" :class="getMeta(item.notificationType).className">
            <AppIcon :icon="getMeta(item.notificationType).icon" :size="16" />
          </span>
          <div class="app-notice__body">
            <div class="app-notice__item-title">{{ item.title }}</div>
            <div class="app-notice__item-desc">{{ item.content }}</div>
            <div class="app-notice__item-time">
              {{ formatRelativeTime(item.createdAt) }}
            </div>
          </div>
          <i v-if="!item.isRead" class="app-notice__dot" />
        </div>

        <AppEmpty
          v-if="!loading && recentList.length === 0"
          description="暂无通知消息"
          :image-size="72"
        />
      </div>

      <footer class="app-notice__footer">
        <el-button link type="primary" @click="openDrawer">查看全部通知</el-button>
      </footer>
    </div>
  </el-popover>

  <!-- 全部通知 -->
  <el-drawer v-model="drawerVisible" title="全部通知" size="520px">
    <div class="app-notice-drawer">
      <el-radio-group v-model="filterType" @change="((drawerPage = 1), loadDrawerList())">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="unread">未读</el-radio-button>
        <el-radio-button value="read">已读</el-radio-button>
      </el-radio-group>

      <div v-loading="drawerLoading" class="app-notice-drawer__list">
        <div
          v-for="item in drawerList"
          :key="item.id"
          class="app-notice__item"
          :class="{ 'is-unread': !item.isRead }"
          @click="handleClick(item)"
        >
          <span class="app-notice__icon" :class="getMeta(item.notificationType).className">
            <AppIcon :icon="getMeta(item.notificationType).icon" :size="16" />
          </span>
          <div class="app-notice__body">
            <div class="app-notice__item-title">{{ item.title }}</div>
            <div class="app-notice__item-desc">{{ item.content }}</div>
            <div class="app-notice__item-time">
              {{ formatRelativeTime(item.createdAt) }}
            </div>
          </div>
          <el-button
            v-if="!item.isRead"
            link
            type="primary"
            @click.stop="markRead(item)"
          >
            标记已读
          </el-button>
        </div>

        <AppEmpty
          v-if="!drawerLoading && drawerList.length === 0"
          description="暂无通知消息"
        />
      </div>

      <div v-if="drawerTotal > 0" class="app-notice-drawer__pagination">
        <el-pagination
          v-model:current-page="drawerPage"
          v-model:page-size="drawerPageSize"
          background
          layout="total, prev, pager, next"
          :total="drawerTotal"
          @current-change="loadDrawerList"
        />
      </div>
    </div>
  </el-drawer>

  <!-- 公告预览 -->
  <AppFormDialog
    v-model="announcementVisible"
    :title="announcement?.title ?? '公告详情'"
    width="640px"
    confirm-text="关闭"
    :cancel-text="' '"
    @confirm="announcementVisible = false"
    @cancel="announcementVisible = false"
  >
    <div class="app-announcement">
      <div class="app-announcement__time">
        {{ announcement?.createdAt ?? "" }}
      </div>
      <div class="app-announcement__content">{{ announcement?.content }}</div>
    </div>
  </AppFormDialog>
</template>

<style scoped lang="scss">
.app-notice {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--app-border);
  }

  &__title {
    font-size: var(--app-font-14);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__list {
    max-height: 360px;
    padding: 4px 0;
    overflow: hidden auto;
  }

  &__item {
    position: relative;
    display: flex;
    gap: 10px;
    padding: 10px 8px;
    cursor: pointer;
    border-radius: var(--app-radius-sm);
    transition: background-color var(--app-duration-fast) var(--app-ease);

    &:hover {
      background: var(--app-subtle);
    }

    &.is-unread .app-notice__item-title {
      font-weight: 600;
    }
  }

  &__icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--app-radius-sm);

    &.is-primary {
      color: var(--app-primary);
      background: var(--app-primary-bg);
    }

    &.is-success {
      color: var(--app-success);
      background: var(--app-success-bg);
    }

    &.is-warning {
      color: var(--app-warning);
      background: var(--app-warning-bg);
    }

    &.is-danger {
      color: var(--app-danger);
      background: var(--app-danger-bg);
    }

    &.is-info {
      color: var(--app-text-2);
      background: var(--app-info-bg);
    }
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__item-title {
    overflow: hidden;
    font-size: var(--app-font-13);
    color: var(--app-text-1);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__item-desc {
    margin-top: 2px;
    overflow: hidden;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__item-time {
    margin-top: 4px;
    font-size: var(--app-font-12);
    color: var(--app-text-4);
  }

  &__dot {
    position: absolute;
    top: 14px;
    right: 8px;
    width: 6px;
    height: 6px;
    background: var(--app-danger);
    border-radius: 50%;
  }

  &__footer {
    display: flex;
    justify-content: center;
    padding-top: 8px;
    border-top: 1px solid var(--app-border);
  }
}

.app-notice-drawer {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__list {
    display: flex;
    flex-direction: column;
    min-height: 200px;
  }

  &__pagination {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
  }
}

.app-announcement {
  &__time {
    margin-bottom: 12px;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__content {
    font-size: var(--app-font-14);
    line-height: 24px;
    color: var(--app-text-2);
    white-space: pre-wrap;
  }
}
</style>
