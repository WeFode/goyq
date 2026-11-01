<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position } from "@vue-flow/core";

/**
 * 流程节点卡片
 *
 * 样式取向参考 n8n / Dify：类型识别交给「图标芯片 + 类型标签」，
 * 不再用左侧色条（border-left）——色条在深色背景、选中态、以及卡片
 * 需要显示角标时都会打架，而且类型信息重复表达了一遍。
 *
 * 减负做法：
 * - 未配置的状态直接写在摘要行上（警告色 + 具体缺什么），不用点开面板才知道；
 * - 「+ 插入下一步」常驻卡片下方而不是藏进菜单，配置一条流程的手次明显减少。
 */

const props = defineProps<{
  id: string;
  data: any;
  selected?: boolean;
}>();

interface NodeMeta {
  label: string;
  icon: string;
  /** 图标芯片配色（类型识别的唯一视觉线索） */
  tone: string;
  chip: string;
}

const NODE_META: Record<string, NodeMeta> = {
  start: { label: "发起", icon: "ep:user-filled", tone: "#4e5969", chip: "#f2f3f5" },
  approve: { label: "审批人", icon: "ri:admin-line", tone: "#1f5ae0", chip: "#eef3ff" },
  cc: { label: "抄送人", icon: "ep:copy-document", tone: "#e37318", chip: "#fff3e6" },
  condition: { label: "条件分支", icon: "ep:select", tone: "#7a5af8", chip: "#f2eeff" },
  end: { label: "结束", icon: "ep:check", tone: "#0faf5f", chip: "#e9f9ef" }
};

const meta = computed<NodeMeta>(() => NODE_META[props.data?.type] ?? NODE_META.approve);

const typeLabel = computed(() => meta.value.label);

const title = computed(() => props.data?.name || meta.value.label);

/** 审批方式短标签 */
const signTypeLabel = computed(() => {
  const approveType = props.data?.approvers?.approveType;
  if (approveType === "ALL_SIGN") return "会签";
  if (approveType === "ORDER_SIGN") return "顺序";
  return "或签";
});

/** 审批人来源摘要：动态类型说清“运行时怎么算出人”，不假装现在就能数出人数 */
const assigneeLabel = computed(() => {
  const assignment = props.data?.approvers?.assignment;
  const type = assignment?.type;
  if (!type || type === "specificUser") {
    const count = assignment?.value?.length ?? 0;
    return count ? `${count} 人` : "未选审批人";
  }
  if (type === "multiLevelLeader") {
    return `连续 ${assignment?.level ?? 1} 级上级`;
  }
  if (type === "formUser") {
    return assignment?.fieldName ? `取自「${assignment.fieldName}」` : "未选人员字段";
  }
  if (type === "specifiedDeptLeader") {
    const names = (assignment?.value ?? []).map((item: any) => item.name).filter(Boolean);
    return names.length ? `${names.join("、")} 的主管` : "未选部门";
  }
  if (type === "deptGroup") {
    const names = (assignment?.value ?? []).map((item: any) => item.name).filter(Boolean);
    return names.length ? `${names.join("、")} 全员` : "未选部门";
  }
  if (type === "roleGroup") {
    const names = (assignment?.value ?? []).map((item: any) => item.name).filter(Boolean);
    return names.length ? `角色：${names.join("、")}` : "未选角色";
  }
  const dynamicText: Record<string, string> = {
    initiatorLeader: "发起人直属上级",
    deptLeader: "发起人部门主管"
  };
  return dynamicText[type] ?? "按规则解析";
});

/** 摘要文案 */
const summary = computed(() => {
  const data = props.data ?? {};
  if (data.type === "start") {
    return data.allowModifyApprovers ? "发起人可调整审批人" : "由发起人提交";
  }
  if (data.type === "end") return "流程终止";
  if (data.type === "cc") {
    const count = data.ccUsers?.value?.length ?? 0;
    return count ? `${count} 位抄送人` : "未配置抄送人";
  }
  if (data.type === "condition") {
    const branches = Number(data.branchCount ?? 0);
    if (!branches) return "还没有分支连线";
    return `${branches} 条分支${data.hasDefaultBranch ? " · 含默认分支" : " · 缺默认分支"}`;
  }
  return `${assigneeLabel.value} · ${signTypeLabel.value}`;
});

/** 卡片上的「待办事项」：不点开面板也能知道还缺什么 */
const problems = computed<string[]>(() => {
  const data = props.data ?? {};
  const list: string[] = [];
  if (data.type === "approve") {
    const assignment = data.approvers?.assignment;
    if (!assignment?.type) list.push("未选择审批人来源");
    else if (["specificUser", "deptGroup", "roleGroup", "specifiedDeptLeader"].includes(assignment.type)
      && !(assignment.value?.length)) {
      list.push("未选择具体对象");
    } else if (assignment.type === "formUser" && !assignment.fieldName) {
      list.push("未选择人员字段");
    }
  }
  if (data.type === "cc" && !(data.ccUsers?.value?.length)) list.push("未选择抄送人");
  if (data.type === "condition") {
    if (!Number(data.branchCount ?? 0)) list.push("没有分支连线");
    else if (!data.hasDefaultBranch) list.push("缺默认分支");
  }
  return list;
});

const hasProblem = computed(() => problems.value.length > 0);

const chipStyle = computed(() => ({
  color: meta.value.tone,
  background: meta.value.chip
}));

const ringStyle = computed(() => {
  if (props.selected) {
    return { borderColor: meta.value.tone, boxShadow: `0 0 0 3px ${meta.value.chip}` };
  }
  return {};
});

function insertAfter() {
  props.data?.onInsertAfter?.(props.id);
}

function removeNode() {
  props.data?.onRemove?.(props.id);
}
</script>

<template>
  <div class="flow-card" :class="{ 'is-selected': selected }" :style="ringStyle">
    <Handle v-if="data?.type !== 'start'" type="target" :position="Position.Left" />

    <!-- 有治理配置时给个角标，避免超时/去重这类设置藏在面板里没人知道生效没有 -->
    <span v-if="data?.governanceMark" class="flow-card__mark" :title="data.governanceMark">
      {{ data.governanceMark }}
    </span>

    <header class="flow-card__head">
      <span class="flow-card__chip" :style="chipStyle">
        <AppIcon :icon="meta.icon" :size="13" />
      </span>
      <span class="flow-card__type">{{ typeLabel }}</span>
      <span v-if="hasProblem" class="flow-card__flag">
        <AppIcon icon="ep:warning-filled" :size="12" />
      </span>
    </header>

    <div class="flow-card__title">{{ title }}</div>
    <div class="flow-card__summary" :class="{ 'is-warn': hasProblem }">{{ summary }}</div>

    <div v-if="hasProblem" class="flow-card__problems">
      <span v-for="text in problems" :key="text">{{ text }}</span>
    </div>

    <footer class="flow-card__actions">
      <button v-if="data?.type !== 'end'" type="button" class="flow-card__action" title="在此节点之后插入" @click.stop="insertAfter">
        <AppIcon icon="ep:plus" :size="12" />
        插入
      </button>
      <button
        v-if="data?.type !== 'start'"
        type="button"
        class="flow-card__action is-danger"
        title="删除节点"
        @click.stop="removeNode"
      >
        <AppIcon icon="ep:delete" :size="12" />
      </button>
    </footer>

    <Handle v-if="data?.type !== 'end'" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped lang="scss">
.flow-card {
  position: relative;
  width: 208px;
  padding: 10px 12px 8px;
  background: var(--app-container);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  box-shadow: 0 1px 2px rgba(15, 34, 67, 0.06);
  cursor: pointer;
  transition: border-color var(--app-duration-fast) var(--app-ease),
    box-shadow var(--app-duration-fast) var(--app-ease);

  &:hover {
    box-shadow: 0 4px 14px rgba(15, 34, 67, 0.1);
  }

  &__head {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  &__chip {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 6px;
  }

  &__type {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__flag {
    display: inline-flex;
    margin-left: auto;
    color: var(--app-warning, #e37318);
  }

  &__title {
    margin-top: 6px;
    overflow: hidden;
    font-size: var(--app-font-14);
    font-weight: 600;
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

    &.is-warn {
      color: var(--app-warning, #e37318);
    }
  }

  &__problems {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px dashed var(--app-border);

    span {
      font-size: var(--app-font-12);
      color: var(--app-warning, #e37318);
    }
  }

  &__mark {
    position: absolute;
    top: -8px;
    right: 8px;
    padding: 0 6px;
    font-size: 11px;
    line-height: 16px;
    color: var(--app-primary);
    background: var(--app-primary-bg);
    border: 1px solid var(--app-primary-border);
    border-radius: 8px;
  }

  &__actions {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: 8px;
    opacity: 0;
    transition: opacity var(--app-duration-fast) var(--app-ease);
  }

  &:hover &__actions,
  &.is-selected &__actions {
    opacity: 1;
  }

  &__action {
    display: inline-flex;
    gap: 3px;
    align-items: center;
    padding: 2px 8px;
    font-size: var(--app-font-12);
    color: var(--app-text-2);
    cursor: pointer;
    background: var(--app-fill-light, #f7f8fa);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-xs);
    transition: all var(--app-duration-fast) var(--app-ease);

    &:hover {
      color: var(--app-primary);
      background: var(--app-primary-bg);
      border-color: var(--app-primary-border);
    }

    &.is-danger {
      padding: 2px 6px;
    }

    &.is-danger:hover {
      color: var(--app-danger, #d9372b);
      background: #fdeceb;
      border-color: #f5c2be;
    }
  }
}
</style>
