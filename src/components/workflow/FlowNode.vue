<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position } from "@vue-flow/core";

/** 流程设计器节点：圆角卡片 + 类型徽标 + 审批人摘要 */
const props = defineProps<{
  id: string;
  data: any;
  selected?: boolean;
}>();

const NODE_META: Record<string, { label: string; icon: string; tone: string }> = {
  start: { label: "发起人", icon: "ep:user-filled", tone: "is-start" },
  approve: { label: "审批人", icon: "ri:admin-line", tone: "is-approve" },
  cc: { label: "抄送人", icon: "ep:copy-document", tone: "is-cc" },
  condition: { label: "条件分支", icon: "ep:select", tone: "is-condition" },
  end: { label: "流程结束", icon: "ep:check", tone: "is-end" }
};

const meta = computed(
  () => NODE_META[props.data?.type] ?? NODE_META.approve
);

const summary = computed(() => {
  const data = props.data ?? {};
  if (data.type === "start") {
    return data.allowModifyApprovers ? "发起人可调整审批人" : "由发起人提交";
  }
  if (data.type === "cc") {
    const count = data.ccUsers?.value?.length ?? 0;
    return count ? `${count} 位抄送人` : "未配置抄送人";
  }
  if (data.type === "condition") {
    return data.conditionLabel || "满足条件时进入该分支";
  }
  if (data.type === "end") return "流程完成";
  const count = data.approvers?.assignment?.value?.length ?? 0;
  const typeText =
    data.approvers?.approveType === "ALL_SIGN"
      ? "会签"
      : data.approvers?.approveType === "ORDER_SIGN"
        ? "顺序"
        : "或签";
  return count ? `${count} 位审批人 · ${typeText}` : `未配置审批人 · ${typeText}`;
});
</script>

<template>
  <div class="flow-node" :class="[meta.tone, { 'is-selected': selected }]">
    <Handle v-if="data?.type !== 'start'" type="target" :position="Position.Left" />

    <div class="flow-node__header">
      <span class="flow-node__icon">
        <AppIcon :icon="meta.icon" :size="14" />
      </span>
      <span class="flow-node__badge">{{ meta.label }}</span>
    </div>

    <div class="flow-node__title">{{ data?.name || meta.label }}</div>
    <div class="flow-node__summary">{{ summary }}</div>

    <Handle v-if="data?.type !== 'end'" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped lang="scss">
.flow-node {
  width: 200px;
  padding: 10px 12px;
  background: var(--app-container);
  border: 1px solid var(--app-border);
  border-left: 3px solid var(--app-text-4);
  border-radius: var(--app-radius-md);
  box-shadow: var(--app-shadow-sm);
  transition: box-shadow var(--app-duration-fast) var(--app-ease);

  &.is-selected {
    box-shadow: 0 0 0 2px var(--app-primary-border);
  }

  &.is-start {
    border-left-color: var(--app-text-2);
  }

  &.is-approve {
    border-left-color: var(--app-primary);
  }

  &.is-cc {
    border-left-color: var(--app-warning);
  }

  &.is-condition {
    border-left-color: #7a5af8;
  }

  &.is-end {
    border-left-color: var(--app-success);
  }

  &__header {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--app-text-2);
    background: var(--app-info-bg);
    border-radius: var(--app-radius-xs);
  }

  &__badge {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__title {
    margin-top: 6px;
    overflow: hidden;
    font-size: var(--app-font-14);
    font-weight: 500;
    color: var(--app-text-1);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__summary {
    margin-top: 2px;
    overflow: hidden;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
