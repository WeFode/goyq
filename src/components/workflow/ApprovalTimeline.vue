<script setup lang="ts">
import { computed } from "vue";
import dayjs from "dayjs";
import { getAttachmentUrl, isImageFile } from "@/utils/workflow";

/**
 * 审批流程时间轴：发起人 + 各审批/抄送节点
 * 数据来源：detail.processTimeline（后端已组装节点、审批人与状态）
 */
interface Props {
  nodes: any[];
  initiatorName?: string;
  initiatorAvatar?: string;
  initiatorDeptName?: string;
  createdAt?: string;
}

const props = withDefaults(defineProps<Props>(), {
  nodes: () => [],
  initiatorName: "",
  initiatorAvatar: "",
  initiatorDeptName: "",
  createdAt: ""
});

const formatTime = (value: any) => {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD HH:mm") : String(value);
};

const NODE_STATUS_VIEW: Record<string, { text: string; tone: string; dot: string }> = {
  completed: { text: "已完成", tone: "success", dot: "is-success" },
  approved: { text: "已完成", tone: "success", dot: "is-success" },
  running: { text: "审批中", tone: "primary", dot: "is-primary" },
  in_progress: { text: "审批中", tone: "primary", dot: "is-primary" },
  processing: { text: "审批中", tone: "primary", dot: "is-primary" },
  pending: { text: "待审批", tone: "warning", dot: "is-warning" },
  rejected: { text: "已驳回", tone: "danger", dot: "is-danger" },
  cancelled: { text: "已取消", tone: "info", dot: "is-muted" },
  canceled: { text: "已取消", tone: "info", dot: "is-muted" },
  skipped: { text: "已跳过", tone: "info", dot: "is-muted" }
};

const ASSIGNEE_STATUS: Record<string, { text: string; type: any }> = {
  pending: { text: "待审批", type: "warning" },
  running: { text: "审批中", type: "primary" },
  approved: { text: "已同意", type: "success" },
  rejected: { text: "已驳回", type: "danger" },
  skipped: { text: "已跳过", type: "info" },
  transferred: { text: "已转交", type: "info" },
  cancelled: { text: "已取消", type: "info" },
  completed: { text: "已完成", type: "success" }
};

const APPROVE_TYPE_TEXT: Record<string, string> = {
  ANY_SIGN: "或签",
  ALL_SIGN: "会签",
  ORDER_SIGN: "顺序审批"
};

const statusMeta = (status: string) =>
  NODE_STATUS_VIEW[status] ?? { text: "未知状态", tone: "info", dot: "is-muted" };

const assigneeMeta = (status: string) =>
  ASSIGNEE_STATUS[status] ?? { text: "未知状态", type: "info" };

/** 需要展示的节点：跳过结束节点 */
const visibleNodes = computed(() =>
  (props.nodes ?? []).filter(
    node => node.nodeType !== "start" && node.nodeType !== "end"
  )
);

const sortedAssignees = (node: any) => {
  const list = node.assignees ?? [];
  return node.approveType === "ORDER_SIGN"
    ? [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : list;
};

const attachmentUrl = (file: any) => getAttachmentUrl(file);
const attachmentName = (file: any) =>
  file?.fileName || file?.name || "附件";

const approveTypeLabelOf = (type: string) => APPROVE_TYPE_TEXT[type] ?? "";

/** 已处理人数（会签进度） */
const approvedCount = (node: any) =>
  (node.assignees ?? []).filter((item: any) =>
    ["approved", "rejected", "skipped"].includes(item.status)
  ).length;

/** 节点耗时 */
function nodeDuration(node: any) {
  if (!node?.startedAt) return "";
  const start = new Date(node.startedAt).getTime();
  if (Number.isNaN(start)) return "";
  const end = node.completedAt ? new Date(node.completedAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.round(minutes / 6) / 10;
  if (hours < 24) return `${hours} 小时`;
  return `${Math.round(hours / 24)} 天`;
}

const nodeTypeLabel = (node: any) =>
  node.nodeType === "cc" ? "抄送" : "审批";
</script>

<template>
  <div class="app-timeline">
    <!-- 发起人 -->
    <div class="app-timeline__item">
      <div class="app-timeline__rail">
        <span class="app-timeline__dot is-success">
          <AppIcon icon="ep:check" :size="10" />
        </span>
        <span class="app-timeline__line" />
      </div>
      <div class="app-timeline__body">
        <div class="app-timeline__row">
          <AppUserAvatar
            :name="initiatorName"
            :avatar="initiatorAvatar"
            :size="28"
          />
          <div class="app-timeline__person">
            <span class="app-timeline__name">{{ initiatorName || "发起人" }}</span>
            <span class="app-timeline__meta">
              {{ initiatorDeptName || "发起申请" }} · {{ formatTime(createdAt) }}
            </span>
          </div>
          <el-tag type="success" effect="light" size="small">已发起</el-tag>
        </div>
      </div>
    </div>

    <!-- 流程节点 -->
    <div
      v-for="(node, index) in visibleNodes"
      :key="node.nodeId || index"
      class="app-timeline__item"
      :class="{ 'is-running': node.nodeStatus === 'in_progress' }"
    >
      <div class="app-timeline__rail">
        <span class="app-timeline__dot" :class="statusMeta(node.nodeStatus).dot" />
        <span
          v-if="index < visibleNodes.length - 1"
          class="app-timeline__line"
        />
      </div>

      <div class="app-timeline__body">
        <header class="app-timeline__header">
          <span class="app-timeline__title">{{ node.nodeName }}</span>
          <el-tag
            :type="statusMeta(node.nodeStatus).tone as any"
            effect="plain"
            size="small"
          >
            {{ statusMeta(node.nodeStatus).text }}
          </el-tag>
          <span class="app-timeline__type">
            {{ nodeTypeLabel(node) }}
            <template v-if="node.nodeType === 'approve' && node.approveType">
              · {{ approveTypeLabelOf(node.approveType) }}
            </template>
          </span>
          <span
            v-if="node.nodeType === 'approve' && (node.assignees || []).length > 1"
            class="app-timeline__count"
          >
            {{ approvedCount(node) }}/{{ node.assignees.length }} 已处理
          </span>
          <span v-if="nodeDuration(node)" class="app-timeline__duration">
            {{ nodeDuration(node) }}
          </span>
        </header>

        <!-- 抄送人 -->
        <div
          v-if="node.nodeType === 'cc' && (node.ccUsers || []).length"
          class="app-timeline__cc"
        >
          <span class="app-timeline__meta">抄送</span>
          <el-tag
            v-for="ccUser in node.ccUsers"
            :key="ccUser.id || ccUser.name"
            size="small"
            effect="plain"
            :type="ccUser.isRead ? 'info' : 'warning'"
          >
            {{ ccUser.name }} · {{ ccUser.isRead ? "已读" : "未读" }}
          </el-tag>
        </div>

        <!-- 转派链 -->
        <div
          v-if="node.delegateChain?.length"
          class="app-timeline__delegate"
        >
          <template v-for="(link, linkIndex) in node.delegateChain" :key="linkIndex">
            <span class="app-timeline__delegate-text">
              {{ link.fromName }}
              <AppIcon icon="ep:arrow-right" :size="11" />
              {{ link.toName }}
            </span>
            <span class="app-timeline__meta">
              {{ formatTime(link.time) }}
              <template v-if="link.comment"> · {{ link.comment }}</template>
            </span>
          </template>
        </div>

        <!-- 审批人 -->
        <div v-if="sortedAssignees(node).length" class="app-timeline__assignees">
          <div
            v-for="assignee in sortedAssignees(node)"
            :key="assignee.id || assignee.name"
            class="app-timeline__assignee"
          >
            <div class="app-timeline__row">
              <AppUserAvatar
                :name="assignee.name"
                :avatar="assignee.avatar"
                :size="26"
              />
              <div class="app-timeline__person">
                <span class="app-timeline__name">
                  {{ assignee.name }}
                  <el-tag
                    v-if="assignee.isDelegatedTo"
                    size="small"
                    effect="plain"
                    type="primary"
                  >
                    接收转派
                  </el-tag>
                </span>
                <span v-if="assignee.completedAt" class="app-timeline__meta">
                  {{ formatTime(assignee.completedAt) }}
                </span>
              </div>
              <el-tag
                :type="assigneeMeta(assignee.status).type"
                effect="light"
                size="small"
              >
                {{ assigneeMeta(assignee.status).text }}
              </el-tag>
            </div>

            <div v-if="assignee.comment" class="app-timeline__comment">
              {{ assignee.comment }}
            </div>

            <div
              v-if="assignee.attachments?.length"
              class="app-timeline__attachments"
            >
              <a
                v-for="file in assignee.attachments"
                :key="file.fileId || file.fileName"
                class="app-timeline__attachment"
                :href="attachmentUrl(file)"
                target="_blank"
                rel="noopener"
              >
                <el-image
                  v-if="isImageFile(file)"
                  class="app-timeline__attachment-thumb"
                  :src="attachmentUrl(file)"
                  fit="cover"
                />
                <AppIcon v-else icon="ep:files" :size="14" />
                <span class="app-timeline__attachment-name">
                  {{ attachmentName(file) }}
                </span>
              </a>
            </div>
          </div>
        </div>

        <p v-else class="app-timeline__empty">
          {{ node.nodeType === "cc" ? "暂无抄送人信息" : "暂无审批人信息" }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-timeline {
  display: flex;
  flex-direction: column;

  &__item {
    display: flex;
    gap: 12px;
  }

  &__rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 16px;
    padding-top: 6px;
  }

  &__dot {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    color: #fff;
    border: 2px solid var(--app-container);
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--app-border);

    &.is-primary {
      background: var(--app-primary);
      box-shadow: 0 0 0 1px var(--app-primary-border);
    }

    &.is-success {
      background: var(--app-success);
      box-shadow: 0 0 0 1px #b7e6cd;
    }

    &.is-warning {
      background: var(--app-warning);
      box-shadow: 0 0 0 1px #f5cfa8;
    }

    &.is-danger {
      background: var(--app-danger);
      box-shadow: 0 0 0 1px #f0b6b0;
    }

    &.is-muted {
      background: var(--app-text-4);
    }
  }

  &__line {
    flex: 1;
    width: 1px;
    margin: 4px 0;
    background: var(--app-border);
  }

  &__body {
    flex: 1;
    min-width: 0;
    padding-bottom: 20px;
  }

  &__row {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  &__person {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    line-height: 1.35;
  }

  &__name {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: var(--app-font-14);
    font-weight: 500;
    color: var(--app-text-1);
  }

  &__meta {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__header {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 10px;
  }

  &__title {
    font-size: var(--app-font-14);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__type {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__delegate {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    margin-bottom: 10px;
    font-size: var(--app-font-12);
    background: var(--app-subtle);
    border-radius: var(--app-radius-sm);
  }

  &__delegate-text {
    display: flex;
    gap: 4px;
    align-items: center;
    color: var(--app-text-2);
  }

  &__assignees {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__assignee {
    padding: 10px 12px;
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
  }

  &__comment {
    padding: 8px 10px;
    margin-top: 8px;
    font-size: var(--app-font-13);
    line-height: 20px;
    color: var(--app-text-2);
    white-space: pre-wrap;
    background: var(--app-subtle);
    border-radius: var(--app-radius-xs);
  }

  &__attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  &__attachment {
    display: flex;
    gap: 6px;
    align-items: center;
    max-width: 200px;
    padding: 4px 8px;
    font-size: var(--app-font-12);
    color: var(--app-text-2);
    background: var(--app-subtle);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-xs);
  }

  &__attachment-thumb {
    width: 20px;
    height: 20px;
    border-radius: 2px;
  }

  &__attachment-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__empty {
    font-size: var(--app-font-13);
    color: var(--app-text-4);
  }

  &__count {
    padding: 0 6px;
    font-size: var(--app-font-12);
    color: var(--app-primary);
    background: var(--app-primary-bg);
    border-radius: 4px;
  }

  &__duration {
    margin-left: auto;
    font-size: var(--app-font-12);
    color: var(--app-text-4);
  }

  &__cc {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  &__item.is-running {
    .app-timeline__title {
      color: var(--app-primary);
    }

    .app-timeline__dot {
      box-shadow: 0 0 0 4px var(--app-primary-bg);
    }
  }
}
</style>
