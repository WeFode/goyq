<script setup lang="ts">
import { computed, markRaw, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  MarkerType,
  VueFlow
} from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import FlowNode from "@/components/workflow/FlowNode.vue";
import UserSelectDialog from "@/components/workflow/UserSelectDialog.vue";
import ConditionEditor from "@/components/workflow/ConditionEditor.vue";
import {
  conditionSummary,
  hasFallbackBranch,
  isConditionUsable,
  parseFormFields,
  type ConditionConfig
} from "@/utils/condition";
import {
  getWorkflowDetail,
  updateWorkflow
} from "@/api/workflow";
import { getFormList } from "@/api/form";
import { message } from "@/utils/message";
import { groupOptions } from "@/utils/workflow";
import {
  ASSIGNMENT_TYPE,
  DEDUP_POLICY,
  EMPTY_APPROVER_POLICY,
  STATIC_ASSIGNMENTS,
  TIMEOUT_ACTION
} from "@/utils/dicts";
import {
  ApproveType,
  AssignmentType,
  NodeType,
  type NodeGovernance
} from "../workflow/utils/types";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import "@vue-flow/minimap/dist/style.css";

defineOptions({ name: "EngineDesigner" });

const route = useRoute();
const router = useRouter();

const definitionId = computed(() =>
  route.query.id ? String(route.query.id) : ""
);

const loading = ref(false);
const saving = ref(false);

/* ============ 基础信息 ============ */
const basic = reactive({
  name: "",
  groupName: "",
  formDesignId: undefined as any,
  isEnabled: true
});

const formOptions = ref<any[]>([]);

/* ============ 画布 ============ */
const nodes = ref<any[]>([]);
const edges = ref<any[]>([]);
const selectedId = ref<string>("");
const selectedEdgeId = ref<string>("");

const nodeTypes = markRaw({ appNode: FlowNode });

const selectedNode = computed(() =>
  nodes.value.find(item => item.id === selectedId.value)
);

const selectedData = computed<any>(() => selectedNode.value?.data ?? {});

const selectedEdge = computed(() =>
  edges.value.find(item => item.id === selectedEdgeId.value)
);

/** 当前选中连线的起点节点（条件只在“从条件节点出发”的连线上才有意义） */
const selectedEdgeSource = computed(() =>
  nodes.value.find(node => node.id === selectedEdge.value?.source)
);

const isSelectedEdgeFromCondition = computed(
  () => selectedEdgeSource.value?.data?.type === NodeType.CONDITION
);

/** 某节点的出边，顺序即分支判定优先级 */
function branchesOf(nodeId: string) {
  return edges.value.filter(edge => edge.source === nodeId);
}

/** 可选字段：来自当前关联表单的字段列表 */
const conditionFields = computed<any[]>(() => {
  const form = formOptions.value.find(item => item.id === basic.formDesignId);
  return parseFormFields(form?.formConfig);
});

function edgeConditionOf(edge: any): ConditionConfig | null {
  return edge?.data?.condition ?? null;
}

const nodeNameOf = (nodeId: string) =>
  nodes.value.find(node => node.id === nodeId)?.data?.name ?? nodeId;

/** 分支的人读描述：条件摘要 > 默认标记 > 无条件 */
function branchLabel(edge: any): string {
  const summary = conditionSummary(edge?.data?.condition, conditionFields.value);
  if (summary) return summary;
  return edge?.data?.isDefault ? "默认分支" : "无条件（直接流转）";
}

function selectBranch(edgeId: string) {
  selectedEdgeId.value = edgeId;
  selectedId.value = "";
}

function removeSelectedEdge() {
  if (!selectedEdgeId.value) return;
  edges.value = edges.value.filter(edge => edge.id !== selectedEdgeId.value);
  selectedEdgeId.value = "";
  syncDerived();
}

/**
 * vue-flow 渲染的是 edge.label，而 label 又要能跟着条件变。
 * 所以手写标签单独存在 data.customLabel，每次改条件/默认标记后重算一次 label。
 */
function refreshEdgeLabels() {
  edges.value = edges.value.map(edge => {
    const custom = String(edge?.data?.customLabel ?? "").trim();
    const summary = conditionSummary(edge?.data?.condition, conditionFields.value);
    const label = custom || summary || (edge?.data?.isDefault ? "默认" : "");
    return { ...edge, label };
  });
}

function setEdgeCustomLabel(value: string) {
  if (!selectedEdgeId.value) return;
  edges.value = edges.value.map(edge =>
    edge.id === selectedEdgeId.value
      ? { ...edge, data: { ...(edge.data ?? {}), customLabel: value } }
      : edge
  );
  refreshEdgeLabels();
}

const NODE_TEMPLATES: Array<{
  type: NodeType;
  label: string;
  icon: string;
  desc: string;
}> = [
  { type: NodeType.APPROVE, label: "审批人", icon: "ri:admin-line", desc: "需要指定人员审批" },
  { type: NodeType.CC, label: "抄送人", icon: "ep:copy-document", desc: "知会相关人查看" },
  { type: NodeType.CONDITION, label: "条件分支", icon: "ep:select", desc: "按条件进入不同分支" },
  { type: NodeType.END, label: "结束", icon: "ep:check", desc: "流程终止节点" }
];

const edgeOptions = {
  type: "smoothstep",
  animated: false,
  markerEnd: MarkerType.ArrowClosed,
  style: { stroke: "#c9cdd4", strokeWidth: 1.4 }
};

let nodeSeq = 1;
let edgeSeq = 1;

/** 治理配置的面板默认值：与后端“不配 = 保持原行为”对齐 */
function defaultGovernance(): NodeGovernance {
  return {
    timeout: { enabled: false, hours: 24, action: "remind", remindLimit: 2, transferTo: [] },
    emptyApprovers: { policy: "error", fallback: [] },
    dedup: { policy: "none", includeInitiator: true },
    fieldPermissions: [],
    defaultFieldVisible: true,
    defaultFieldEditable: false
  };
}

/**
 * 只把“真的改过”的治理项写进库
 *
 * 默认值全量序列化会让每个节点都带上一堆 governance，
 * 既把 process_config 撑大，也让“这个节点到底有没配治理”从数据上看不出来。
 */
function normalizeGovernance(raw: any): NodeGovernance | undefined {
  if (!raw) return undefined;
  const out: NodeGovernance = {};
  if (raw.timeout?.enabled && Number(raw.timeout.hours) > 0) {
    out.timeout = {
      enabled: true,
      hours: Number(raw.timeout.hours),
      action: (raw.timeout.action || "remind") as any,
      remindLimit: Number(raw.timeout.remindLimit ?? 0) || undefined,
      transferTo: raw.timeout.action === "transfer" ? raw.timeout.transferTo ?? [] : undefined
    };
  }
  if (raw.emptyApprovers?.policy && raw.emptyApprovers.policy !== "error") {
    out.emptyApprovers = {
      policy: raw.emptyApprovers.policy as any,
      fallback: raw.emptyApprovers.policy === "transferTo" ? raw.emptyApprovers.fallback ?? [] : undefined
    };
  }
  if (raw.dedup?.policy && raw.dedup.policy !== "none") {
    out.dedup = { policy: raw.dedup.policy as any, includeInitiator: raw.dedup.includeInitiator !== false };
  }
  const permissions = (raw.fieldPermissions ?? []).filter(
    (item: any) => item?.field && (!item.visible || !item.editable || item.required)
  );
  if (permissions.length) {
    out.fieldPermissions = permissions;
    out.defaultFieldVisible = raw.defaultFieldVisible !== false;
    out.defaultFieldEditable = raw.defaultFieldEditable === true;
  }
  return Object.keys(out).length ? out : undefined;
}

/** 卡片上的治理角标：让“这个节点配了超时自动上报”在画布上一眼看得到 */
function governanceMarkOf(governance: any): string {
  const marks: string[] = [];
  if (governance?.timeout?.enabled) marks.push("超时");
  if (governance?.dedup?.policy && governance.dedup.policy !== "none") marks.push("去重");
  if (governance?.emptyApprovers?.policy && governance.emptyApprovers.policy !== "error") marks.push("兜底");
  if (governance?.fieldPermissions?.length) marks.push("字段权限");
  return marks.length ? marks.join("·") : "";
}

/** 给节点挂上卡片内的快捷操作，并把派生信息（分支数、治理角标）算进 data */
function decorate(node: any): any {
  return {
    ...node,
    data: {
      ...node.data,
      onInsertAfter: insertAfterNode,
      onRemove: removeNodeById
    }
  };
}

function makeNode(type: NodeType, position = { x: 120, y: 120 }): any {
  const base = {
    id: `${type}_${Date.now()}_${nodeSeq++}`,
    type: "appNode",
    position,
    data: {
      type,
      name:
        type === NodeType.START
          ? "发起人"
          : type === NodeType.END
            ? "流程结束"
            : type === NodeType.CC
              ? "抄送人"
              : type === NodeType.CONDITION
                ? "条件分支"
                : "审批人",
      approvers:
        type === NodeType.APPROVE
          ? { approveType: ApproveType.ANY_SIGN, assignment: { type: AssignmentType.SPECIFIC_USER, value: [] } }
          : undefined,
      ccUsers:
        type === NodeType.CC
          ? { type: AssignmentType.SPECIFIC_USER, value: [] }
          : undefined,
      governance: type === NodeType.APPROVE ? defaultGovernance() : undefined,
      allowModifyApprovers: false,
      allowModifyCcUsers: false
    }
  };
  return decorate(base) as any;
}

function addNode(type: NodeType) {
  const index = nodes.value.length;
  const node = makeNode(type, {
    x: 120 + (index % 3) * 240,
    y: 80 + Math.floor(index / 3) * 140
  });
  nodes.value = [...nodes.value, node];
  selectedId.value = node.id;
  syncDerived();
}

/**
 * 卡片上的“插入”：新建审批节点并自动与当前节点连线。
 *
 * 这是设计器里最高频的动作，所以不让用户走“仍侧边栏选类型 → 拖到空白处 → 从接口拉一条线”三步，
 * 一次点击直接得到“下一个审批人”，位置也预排在右下游。
 */
function insertAfterNode(sourceId: string) {
  const source = nodes.value.find(node => node.id === sourceId);
  if (!source) return;

  const siblings = branchesOf(sourceId);
  const node = makeNode(NodeType.APPROVE, {
    x: Number(source.position?.x ?? 120) + 260,
    y: Number(source.position?.y ?? 120) + siblings.length * 130
  });
  node.data.name = `审批人 ${nodeSeq}`;

  edges.value = [
    ...edges.value,
    {
      id: `edge_${Date.now()}_${edgeSeq++}`,
      source: sourceId,
      target: node.id,
      label: "",
      data: { condition: null, isDefault: false, customLabel: "" },
      ...edgeOptions
    }
  ];
  nodes.value = [...nodes.value, node];
  selectedEdgeId.value = "";
  selectedId.value = node.id;
  syncDerived();
}

function removeNodeById(nodeId: string) {
  const target = nodes.value.find(node => node.id === nodeId);
  if (target?.data?.type === NodeType.START) {
    message("发起人节点不可删除", { type: "warning" });
    return;
  }
  nodes.value = nodes.value.filter(node => node.id !== nodeId);
  edges.value = edges.value.filter(
    edge => edge.source !== nodeId && edge.target !== nodeId
  );
  if (selectedId.value === nodeId) selectedId.value = "";
  syncDerived();
}

/**
 * 把卡片需要的派生信息（分支数、是否有默认分支、治理角标）同步进 data
 *
 * 只在结构变化后手动调用，不用 watch：watch 里再改 nodes 会自己触发自己。
 */
function syncDerived() {
  nodes.value = nodes.value.map(node => {
    const outgoing = branchesOf(node.id);
    const branchCount = node.data?.type === NodeType.CONDITION ? outgoing.length : 0;
    const hasDefaultBranch = outgoing.some(
      edge => edge?.data?.isDefault || !edge?.data?.condition?.conditions?.length
    );
    const governanceMark = governanceMarkOf(node.data?.governance);
    if (
      node.data?.branchCount === branchCount &&
      node.data?.hasDefaultBranch === hasDefaultBranch &&
      node.data?.governanceMark === governanceMark
    ) {
      return node;
    }
    return { ...node, data: { ...node.data, branchCount, hasDefaultBranch, governanceMark } };
  });
}

/** 更新节点的治理配置（面板上的任何一个治理项都走这里） */
function updateGovernance(patch: Record<string, any>) {
  const current = selectedData.value?.governance ?? defaultGovernance();
  updateNodeData({ governance: { ...current, ...patch } });
  syncDerived();
}

const governance = computed<NodeGovernance>(() =>
  selectedData.value?.governance ?? defaultGovernance()
);

/**
 * 可在设计器里配的审批人来源
 *
 * 只列出能真配好的：角色组/部门组/指定部门主管需要部门与角色选择器，
 * 而当前只有员工选择弹窗，把它们放进下拉只会给一个“选了但配不了”的选项。
 */
const ASSIGNMENT_OPTIONS: Array<{
  value: AssignmentType;
  need?: "people" | "level" | "field";
}> = [
  { value: AssignmentType.SPECIFIC_USER, need: "people" },
  { value: AssignmentType.INITIATOR_LEADER },
  { value: AssignmentType.DEPT_LEADER },
  { value: AssignmentType.MULTI_LEVEL_LEADER, need: "level" },
  { value: AssignmentType.FORM_USER, need: "field" }
];

const assignmentNeed = computed(
  () => ASSIGNMENT_OPTIONS.find(item => item.value === assignmentType.value)?.need
);

const assignmentType = computed<AssignmentType>(
  () => selectedData.value?.approvers?.assignment?.type ?? AssignmentType.SPECIFIC_USER
);

/** 人员字段候选：表单里没有专门的“人员”控件，先列出文本/数字字段并给出明确提示 */
const userFieldOptions = computed(() =>
  conditionFields.value.map(field => ({
    label: field.label || field.name,
    value: field.name
  }))
);

/** 字段权限行：把表单字段与已配权限合并，没配过的按默认值展示 */
const fieldPermissionRows = computed(() => {
  const existing = governance.value.fieldPermissions ?? [];
  const defaultVisible = governance.value.defaultFieldVisible !== false;
  const defaultEditable = governance.value.defaultFieldEditable === true;
  return conditionFields.value.map(field => {
    const hit = existing.find(item => item.field === field.name);
    return {
      field: field.name,
      label: field.label || field.name,
      visible: hit ? hit.visible : defaultVisible,
      editable: hit ? hit.editable : defaultEditable,
      required: hit ? hit.required : false
    };
  });
});

function patchTimeout(patch: Record<string, any>) {
  updateGovernance({ timeout: { ...defaultGovernance().timeout, ...governance.value.timeout, ...patch } });
}

function patchEmptyApprovers(patch: Record<string, any>) {
  updateGovernance({
    emptyApprovers: {
      policy: "error",
      ...governance.value.emptyApprovers,
      ...patch
    }
  });
}

function patchDedup(patch: Record<string, any>) {
  updateGovernance({
    dedup: { policy: "none", includeInitiator: true, ...governance.value.dedup, ...patch }
  });
}

/**
 * 字段权限只在“跟默认值不同”时才落库
 *
 * 把每个字段都写满 visible=true/editable=false 的默认行，
 * 会把 process_config 撑大且让人分不清到底配了什么。
 */
function patchFieldPermission(row: any, patch: Record<string, any>) {
  const next = { ...row, ...patch };
  // 改可改时自动保证可见；不可见时不行“隐形可改”
  if (patch.editable === true) next.visible = true;
  if (patch.visible === false) next.editable = false;

  const existing = [...(governance.value.fieldPermissions ?? [])];
  const index = existing.findIndex(item => item.field === row.field);
  const isDefault =
    next.visible === true && next.editable === false && next.required === false;

  if (isDefault) {
    if (index >= 0) existing.splice(index, 1);
  } else if (index >= 0) {
    existing[index] = { field: row.field, visible: next.visible, editable: next.editable, required: next.required };
  } else {
    existing.push({ field: row.field, visible: next.visible, editable: next.editable, required: next.required });
  }
  updateGovernance({ fieldPermissions: existing });
}

function setAssignmentType(type: AssignmentType) {
  updateNodeData({
    approvers: {
      ...(selectedData.value.approvers ?? {}),
      assignment: { type, value: [], level: type === AssignmentType.MULTI_LEVEL_LEADER ? 2 : undefined }
    }
  });
}

function setAssignmentLevel(level: number) {
  updateNodeData({
    approvers: {
      ...(selectedData.value.approvers ?? {}),
      assignment: { ...(selectedData.value.approvers?.assignment ?? {}), level }
    }
  });
}

function setAssignmentField(fieldName: string) {
  updateNodeData({
    approvers: {
      ...(selectedData.value.approvers ?? {}),
      assignment: { ...(selectedData.value.approvers?.assignment ?? {}), fieldName }
    }
  });
}

/**
 * 自动布局：按拓扑层级重排坐标
 *
 * 手工对齐连线是流程图里最没价值的时间消耗；分支按上下均分，
 * 汇聚的节点取最大层级，保证“从左到右”读得通。
 */
function autoLayout() {
  const levels = new Map<string, number>();
  const visited = new Set<string>();

  const depthOf = (nodeId: string, guard = 0): number => {
    if (guard > 50) return 0;
    const cached = levels.get(nodeId);
    if (cached !== undefined) return cached;
    const incoming = edges.value.filter(edge => edge.target === nodeId);
    let depth = 0;
    if (incoming.length) {
      depth = Math.max(
        ...incoming.map(edge => depthOf(edge.source, guard + 1) + 1)
      );
    }
    levels.set(nodeId, depth);
    return depth;
  };

  nodes.value.forEach(node => {
    if (!visited.has(node.id)) {
      depthOf(node.id);
      visited.add(node.id);
    }
  });

  const grouped = new Map<number, string[]>();
  nodes.value.forEach(node => {
    const depth = levels.get(node.id) ?? 0;
    grouped.set(depth, [...(grouped.get(depth) ?? []), node.id]);
  });

  const columnWidth = 268;
  const rowHeight = 132;
  nodes.value = nodes.value.map(node => {
    const depth = levels.get(node.id) ?? 0;
    const row = (grouped.get(depth) ?? []).indexOf(node.id);
    return {
      ...node,
      position: { x: 60 + depth * columnWidth, y: 80 + row * rowHeight }
    };
  });
  message("已按流程顺序重新排列", { type: "success" });
}

function removeSelected() {
  if (!selectedId.value) return;
  if (selectedData.value?.type === NodeType.START) {
    message("发起人节点不可删除", { type: "warning" });
    return;
  }
  removeNodeById(selectedId.value);
}

function onNodeClick({ node }: any) {
  selectedId.value = node.id;
  selectedEdgeId.value = "";
}

/**
 * 拖拽建立连线。
 *
 * vue-flow 不会自己把拖出的连接写回 v-model:edges，必须在这里接住 `connect` 事件。
 * 少了这一步设计器根本画不出连线（之前的流程边全部来自 SQL 种子），
 * 条件分支也就无从谈起——先能连，再谈条件。
 */
function onConnect(params: any) {
  const { source, target } = params ?? {};
  if (!source || !target) return;
  if (source === target) {
    message("不能连到自己", { type: "warning" });
    return;
  }
  if (nodes.value.find(node => node.id === target)?.data?.type === NodeType.START) {
    message("发起节点不能作为连线目标", { type: "warning" });
    return;
  }
  if (
    edges.value.some(
      edge => edge.source === source && edge.target === target
    )
  ) {
    message("这两节点之间已经有连线", { type: "warning" });
    return;
  }

  const id = `edge_${Date.now()}_${edgeSeq++}`;
  edges.value = [
    ...edges.value,
    {
      id,
      source,
      target,
      label: "",
      data: { condition: null, isDefault: false, customLabel: "" },
      ...edgeOptions
    }
  ];
  selectedId.value = "";
  selectedEdgeId.value = id;
  syncDerived();
}

function onEdgeClick({ edge }: any) {
  selectedEdgeId.value = edge.id;
  selectedId.value = "";
}

function clearSelection() {
  selectedId.value = "";
  selectedEdgeId.value = "";
}

function updateEdgeData(patch: Record<string, any>) {
  if (!selectedEdgeId.value) return;
  edges.value = edges.value.map(edge =>
    edge.id === selectedEdgeId.value
      ? { ...edge, data: { ...(edge.data ?? {}), ...patch } }
      : edge
  );
}

function updateNodeData(patch: Record<string, any>) {
  if (!selectedId.value) return;
  nodes.value = nodes.value.map(node =>
    node.id === selectedId.value
      ? { ...node, data: { ...node.data, ...patch } }
      : node
  );
}

/* ============ 人员选择 ============ */
const userSelectVisible = ref(false);
const userSelectTarget = ref<"approver" | "cc" | "transfer">("approver");

const userSelectTitle = computed(
  () =>
    ({
      approver: "选择审批人",
      cc: "选择抄送人",
      transfer: "选择接手人"
    })[userSelectTarget.value]
);

const approverList = computed<any[]>(
  () => selectedData.value?.approvers?.assignment?.value ?? []
);
const ccList = computed<any[]>(() => selectedData.value?.ccUsers?.value ?? []);

function openUserSelect(target: "approver" | "cc" | "transfer") {
  userSelectTarget.value = target;
  userSelectVisible.value = true;
}

function onUsersSelected(users: any[]) {
  const value = users.map(user => ({
    id: user.id,
    name: user.employeeName ?? user.name
  }));

  if (userSelectTarget.value === "approver") {
    updateNodeData({
      approvers: {
        ...(selectedData.value.approvers ?? {}),
        assignment: {
          type: AssignmentType.SPECIFIC_USER,
          value
        }
      }
    });
  } else if (userSelectTarget.value === "transfer") {
    // 超时转交的接手人存在治理配置里，不能混进审批人名单
    patchTimeout({ transferTo: value });
  } else {
    updateNodeData({
      ccUsers: { type: AssignmentType.SPECIFIC_USER, value }
    });
  }
}

/* ============ 数据转换 ============ */
function toFlowNodes(configNodes: any[]): any[] {
  return (configNodes ?? []).map((node, index) => ({
    id: String(node.id ?? `${node.type}_${index}`),
    type: "appNode",
    position: {
      x: Number(node.position?.x ?? node.x ?? 120 + (index % 3) * 240),
      y: Number(node.position?.y ?? node.y ?? 80 + Math.floor(index / 3) * 140)
    },
    data: {
      type: node.type,
      name: node.name,
      approvers: node.approvers,
      ccUsers: node.ccUsers,
      governance: node.type === NodeType.APPROVE ? { ...defaultGovernance(), ...(node.governance ?? {}) } : node.governance,
      allowModifyApprovers: node.allowModifyApprovers ?? false,
      allowModifyCcUsers: node.allowModifyCcUsers ?? false,
      conditionLabel: node.conditionLabel,
      // 保留后端节点上的其余字段（如 allowResubmit / allowWithdraw），保存时原样回写
      rawNode: node
    }
  })).map(decorate);
}

function toFlowEdges(configEdges: any[]): any[] {
  return (configEdges ?? []).map((edge, index) => ({
    id: String(edge.id ?? `edge_${index}`),
    source: String(edge.source),
    target: String(edge.target),
    label: edge.label,
    // 条件与默认标记跟着连线走：后端只认 edges[].condition / isDefault
    data: {
      condition: edge.condition ?? null,
      isDefault: Boolean(edge.isDefault),
      customLabel: edge.customLabel ?? ""
    },
    ...edgeOptions
  }));
}

function buildProcessConfig() {
  const configNodes = nodes.value.map(node => {
    const raw = node.data?.rawNode ?? {};
    const x = Math.round(node.position.x);
    const y = Math.round(node.position.y);

    return {
      // 先展开原始节点，保证未在界面上暴露的字段不丢失
      ...raw,
      id: node.id,
      type: node.data?.type,
      name: node.data?.name,
      // 后端节点坐标为 position 对象，同时保留扁平 x/y 以兼容旧数据
      position: { ...(raw.position ?? {}), x, y },
      x,
      y,
      approvers: node.data?.approvers,
      ccUsers: node.data?.ccUsers,
      allowModifyApprovers: node.data?.allowModifyApprovers,
      allowModifyCcUsers: node.data?.allowModifyCcUsers,
      conditionLabel: node.data?.conditionLabel,
      governance: normalizeGovernance(node.data?.governance)
    };
  });

  const configEdges = edges.value.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: typeof edge.label === "string" ? edge.label : undefined,
    customLabel: edge.data?.customLabel || undefined,
    condition: edge.data?.condition ?? undefined,
    isDefault: edge.data?.isDefault === true ? true : undefined
  }));

  return JSON.stringify({ nodes: configNodes, edges: configEdges });
}

/* ============ 分支配置 ============ */
const conditionVisible = ref(false);
const conditionDraft = ref<ConditionConfig | null>(null);

function openConditionEditor() {
  if (!selectedEdgeId.value) return;
  conditionDraft.value = JSON.parse(
    JSON.stringify(edgeConditionOf(selectedEdge.value) ?? {
      logic: "AND",
      conditions: []
    })
  );
  conditionVisible.value = true;
}

function saveCondition(next: ConditionConfig) {
  conditionDraft.value = next;
  if (!isConditionUsable(next)) {
    message("条件还没填完整（字段、操作符、比较值都需要），半填的条件会永远不命中", {
      type: "warning"
    });
    return;
  }
  updateEdgeData({ condition: next, isDefault: false });
  refreshEdgeLabels();
  conditionVisible.value = false;
  message("分支条件已配置", { type: "success" });
}

function clearCondition() {
  updateEdgeData({ condition: null });
  refreshEdgeLabels();
}

function toggleDefaultBranch(checked: boolean) {
  updateEdgeData({ isDefault: checked });
  refreshEdgeLabels();
}

/**
 * 调整分支优先级：后端按连线顺序取第一条命中的分支，
 * 所以“上移/下移”就是改 edges 数组里的位置，而不是改条件本身。
 */
function moveBranch(edgeId: string, delta: number) {
  const ordered = edges.value;
  const from = ordered.findIndex(edge => edge.id === edgeId);
  if (from < 0) return;
  const source = ordered[from].source;
  // 只在同一起点的连线之间换位，不能把别的节点的连线插进来
  const siblings = ordered
    .map((edge, index) => ({ edge, index }))
    .filter(item => item.edge.source === source);
  const position = siblings.findIndex(item => item.edge.id === edgeId);
  const swapWith = siblings[position + delta];
  if (!swapWith) return;

  const next = [...ordered];
  [next[from], next[swapWith.index]] = [next[swapWith.index], next[from]];
  edges.value = next;
  syncDerived();
}

/**
 * 保存前检查：与后端 validateConditionBranches 同规则 + 节点本身的配置完整性。
 * 只提示不阻断（草稿允许没画完），但把问题集中列出来，
 * 不让人发不起单了才去一个个节点找“到底哪里没配”。
 */
function checkConditionBranches(): string[] {
  const problems: string[] = [];
  nodes.value
    .filter(node => node.data?.type === NodeType.CONDITION)
    .forEach(node => {
      const outgoing = branchesOf(node.id);
      if (!outgoing.length) {
        problems.push(`条件分支「${node.data?.name ?? node.id}」还没有任何连线`);
        return;
      }
      if (outgoing.length > 1 && !hasFallbackBranch(outgoing)) {
        problems.push(
          `条件分支「${node.data?.name ?? node.id}」的多条连线都配了条件，请至少把一条设为默认分支`
        );
      }
    });
  return problems;
}

/**
 * 待处理清单：包括“会报错”的结构问题与“能保存但发起时会被拦”的配置缺失。
 * 顶部引导条与保存提示共用这一份，避免两处口径不一致。
 */
const flowIssues = computed(() => {
  const blocking = checkConditionBranches();
  const unfinished: Array<{ nodeId: string; text: string }> = [];

  nodes.value.forEach(node => {
    const data = node.data ?? {};
    const assignment = data.approvers?.assignment;
    if (data.type === NodeType.APPROVE) {
      if (!assignment?.type) {
        unfinished.push({ nodeId: node.id, text: `「${data.name}」未选择审批人来源` });
      } else if (
        STATIC_ASSIGNMENTS.includes(assignment.type) &&
        !assignment.value?.length
      ) {
        unfinished.push({ nodeId: node.id, text: `「${data.name}」未选择具体审批人` });
      } else if (assignment.type === AssignmentType.FORM_USER && !assignment.fieldName) {
        unfinished.push({ nodeId: node.id, text: `「${data.name}」未选择人员字段` });
      } else if (
        [AssignmentType.MULTI_LEVEL_LEADER].includes(assignment.type) &&
        !(Number(assignment.level) > 0)
      ) {
        unfinished.push({ nodeId: node.id, text: `「${data.name}」未设置上级级数` });
      }
    }
    if (data.type === NodeType.CC && !data.ccUsers?.value?.length) {
      unfinished.push({ nodeId: node.id, text: `「${data.name}」未选择抄送人` });
    }
  });

  // 没有结束节点时后端会直接拒掉发起，这算结构问题
  if (!nodes.value.some(node => node.data?.type === NodeType.END)) {
    blocking.push("流程缺少结束节点");
  }

  return { blocking, unfinished };
});

const issueCount = computed(
  () => flowIssues.value.blocking.length + flowIssues.value.unfinished.length
);

function focusNode(nodeId: string) {
  selectedEdgeId.value = "";
  selectedId.value = nodeId;
}

function buildStartNodeConfig() {
  const start = nodes.value.find(node => node.data?.type === NodeType.START);
  const raw = start?.data?.rawNode ?? {};

  return JSON.stringify({
    ...raw,
    id: start?.id ?? raw.id,
    type: NodeType.START,
    name: start?.data?.name ?? raw.name,
    allowModifyApprovers: start?.data?.allowModifyApprovers ?? false,
    allowModifyCcUsers: start?.data?.allowModifyCcUsers ?? false
  });
}

/* ============ 加载 / 保存 ============ */
async function loadFormOptions() {
  try {
    const res: any = await getFormList({ page: 1, pageSize: 100 });
    formOptions.value = res?.data?.list ?? [];
  } catch (error) {
    console.error("加载表单列表失败:", error);
  }
}

async function load() {
  if (!definitionId.value) {
    nodes.value = [makeNode(NodeType.START, { x: 80, y: 120 })];
    selectedId.value = nodes.value[0].id;
    return;
  }

  loading.value = true;
  try {
    const res: any = await getWorkflowDetail(definitionId.value as any);
    const definition = res?.data?.definition ?? res?.data ?? {};

    basic.name = definition.name ?? "";
    basic.groupName = definition.groupName ?? "";
    basic.formDesignId = definition.formDesignId;
    basic.isEnabled = definition.isEnabled ?? true;

    let config: any = {};
    try {
      config = definition.processConfig
        ? JSON.parse(definition.processConfig)
        : {};
    } catch {
      config = {};
    }

    nodes.value = config.nodes?.length
      ? toFlowNodes(config.nodes)
      : [makeNode(NodeType.START, { x: 80, y: 120 })];
    edges.value = toFlowEdges(config.edges ?? []);
    selectedId.value = nodes.value[0]?.id ?? "";
    syncDerived();
  } catch (error) {
    console.error("加载流程失败:", error);
    message("加载流程失败", { type: "error" });
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!basic.name.trim()) {
    message("请填写流程名称", { type: "warning" });
    return;
  }
  if (!definitionId.value) {
    message("当前页面仅支持编辑已有流程，请先在流程列表新增", {
      type: "warning"
    });
    return;
  }

  // 条件分支问题先告知再保存：草稿允许不完整，但得让人知道发起时会被拦
  const { blocking, unfinished } = flowIssues.value;
  const problems = [...blocking, ...unfinished.map(item => item.text)];
  if (problems.length) {
    message(`${problems.slice(0, 3).join("；")}${problems.length > 3 ? ` 等 ${problems.length} 项` : ""}（仍可保存，但发起审批可能被后端拦住）`, {
      type: "warning"
    });
  }

  const payload = {
    name: basic.name,
    groupName: basic.groupName,
    formDesignId: basic.formDesignId,
    processConfig: buildProcessConfig(),
    startNodeConfig: buildStartNodeConfig(),
    isEnabled: basic.isEnabled
  };

  saving.value = true;
  try {
    await updateWorkflow(definitionId.value as any, payload);
    message("保存成功", { type: "success" });
  } catch (error) {
    console.error("保存流程失败:", error);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await loadFormOptions();
  await load();
});
</script>

<template>
  <AppPage title="流程设计" description="配置审批节点、审批方式与流转关系">
    <template #actions>
      <el-button @click="router.push('/engine/workflow/index')">
        <AppIcon icon="ep:back" :size="14" />
        返回列表
      </el-button>
      <el-button type="primary" :loading="saving" @click="save">保存流程</el-button>
    </template>

    <div v-loading="loading" class="designer">
      <!-- 左侧：基础信息 + 节点库 -->
      <aside class="designer__side">
        <AppDetailSection title="基础信息">
          <el-form label-position="top" size="small">
            <el-form-item label="流程名称" required>
              <el-input v-model="basic.name" placeholder="请输入流程名称" />
            </el-form-item>
            <el-form-item label="流程分组">
              <el-select v-model="basic.groupName" placeholder="请选择分组" clearable class="w-full">
                <el-option
                  v-for="group in groupOptions"
                  :key="group.value"
                  :label="group.label"
                  :value="group.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="关联表单">
              <el-select
                v-model="basic.formDesignId"
                placeholder="请选择表单"
                clearable
                class="w-full"
              >
                <el-option
                  v-for="form in formOptions"
                  :key="form.id"
                  :label="form.name"
                  :value="form.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="是否启用">
              <el-switch v-model="basic.isEnabled" />
            </el-form-item>
          </el-form>
        </AppDetailSection>

        <AppDetailSection title="添加节点">
          <div class="designer__palette">
            <button
              v-for="template in NODE_TEMPLATES"
              :key="template.type"
              type="button"
              class="designer__palette-item"
              @click="addNode(template.type)"
            >
              <span class="designer__palette-icon">
                <AppIcon :icon="template.icon" :size="15" />
              </span>
              <span class="designer__palette-text">
                <b>{{ template.label }}</b>
                <i>{{ template.desc }}</i>
              </span>
            </button>
          </div>
        </AppDetailSection>
      </aside>

      <!-- 中间：待处理引导 + 画布 -->
      <section class="designer__middle">
        <!-- 引导条：把“还差什么”放在视线起点，而不是让人一个个节点点过去 -->
        <div class="designer__guide" :class="{ 'is-ok': !issueCount }">
          <template v-if="issueCount">
            <AppIcon icon="ep:warning-filled" :size="14" />
            <span class="designer__guide-title">待处理 {{ issueCount }} 项配置</span>
            <div class="designer__guide-list">
              <button
                v-for="text in flowIssues.blocking"
                :key="text"
                type="button"
                class="designer__guide-item is-blocking"
              >
                {{ text }}
              </button>
              <button
                v-for="item in flowIssues.unfinished"
                :key="item.nodeId + item.text"
                type="button"
                class="designer__guide-item"
                @click="focusNode(item.nodeId)"
              >
                {{ item.text }}
              </button>
            </div>
          </template>
          <template v-else>
            <AppIcon icon="ep:circle-check-filled" :size="14" />
            <span class="designer__guide-title is-ok">待处理 0 项 · 全部节点已完成配置</span>
          </template>
        </div>

        <div class="designer__canvas-bar">
          <span class="designer__canvas-tip">从节点右侧圆点拖到目标节点即可连线；选中连线可配分支条件</span>
          <el-button size="small" @click="autoLayout">
            <AppIcon icon="ep:sort" :size="13" />
            自动布局
          </el-button>
        </div>

        <div class="designer__canvas">
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :node-types="nodeTypes"
          :default-edge-options="edgeOptions"
          :min-zoom="0.3"
          :max-zoom="1.6"
          fit-view-on-init
          @connect="onConnect"
          @node-click="onNodeClick"
          @edge-click="onEdgeClick"
          @pane-click="clearSelection"
        >
          <Background :gap="16" :size="1" pattern-color="#e5e6eb" />
          <Controls />
          <MiniMap pannable zoomable />
        </VueFlow>
        </div>
      </section>

      <!-- 右侧：节点属性 -->
      <aside class="designer__panel">
        <AppDetailSection
          :title="
            selectedEdge
              ? '分支连线配置'
              : selectedNode
                ? '节点配置'
                : '节点配置（未选中）'
          "
        >
          <template v-if="selectedEdge" #extra>
            <el-button link type="danger" @click="removeSelectedEdge">
              删除连线
            </el-button>
          </template>
          <template v-else-if="selectedNode" #extra>
            <el-button
              v-if="selectedData.type !== 'start'"
              link
              type="danger"
              @click="removeSelected"
            >
              删除节点
            </el-button>
          </template>

          <!-- 选中连线：条件分支的判定单位是“连线”，不是节点 -->
          <div v-if="selectedEdge" class="designer__form">
            <el-form label-position="top" size="small">
              <el-form-item label="连线">
                <span class="designer__edge-endpoints">
                  {{ nodeNameOf(selectedEdge.source) }} → {{ nodeNameOf(selectedEdge.target) }}
                </span>
              </el-form-item>

              <template v-if="isSelectedEdgeFromCondition">
                <el-form-item label="进入条件">
                  <div class="designer__condition">
                    <p v-if="edgeConditionOf(selectedEdge)" class="designer__condition-summary">
                      {{ conditionSummary(edgeConditionOf(selectedEdge), conditionFields) }}
                    </p>
                    <p v-else class="designer__hint">未配置条件</p>
                    <div class="designer__condition-actions">
                      <el-button link type="primary" @click="openConditionEditor">
                        {{ edgeConditionOf(selectedEdge) ? "修改条件" : "配置条件" }}
                      </el-button>
                      <el-button
                        v-if="edgeConditionOf(selectedEdge)"
                        link
                        @click="clearCondition"
                      >
                        清除
                      </el-button>
                    </div>
                  </div>
                </el-form-item>

                <el-form-item label="默认分支">
                  <el-switch
                    :model-value="selectedEdge.data?.isDefault"
                    @update:model-value="toggleDefaultBranch"
                  />
                  <p class="designer__hint">
                    所有条件都不命中时走这条；每个条件分支建议至少留一条默认。
                  </p>
                </el-form-item>
              </template>

              <el-alert
                v-else
                type="info"
                :closable="false"
                title="只有从「条件分支」节点出发的连线需要配条件"
                description="其他节点的连线按原逻辑直接流转。"
              />

              <el-form-item label="连线标签（留空则用条件摘要）">
                <el-input
                  :model-value="selectedEdge.data?.customLabel ?? ''"
                  placeholder="例如：金额超 1 万"
                  @update:model-value="setEdgeCustomLabel"
                />
              </el-form-item>
            </el-form>
          </div>

          <div v-else-if="selectedNode" class="designer__form">
            <el-form label-position="top" size="small">
              <el-form-item label="节点名称">
                <el-input
                  :model-value="selectedData.name"
                  @update:model-value="value => updateNodeData({ name: value })"
                />
              </el-form-item>

              <!-- 发起节点 -->
              <template v-if="selectedData.type === 'start'">
                <el-form-item label="发起人权限">
                  <el-checkbox
                    :model-value="selectedData.allowModifyApprovers"
                    @update:model-value="value => updateNodeData({ allowModifyApprovers: value })"
                  >
                    允许发起人调整审批人
                  </el-checkbox>
                  <el-checkbox
                    :model-value="selectedData.allowModifyCcUsers"
                    @update:model-value="value => updateNodeData({ allowModifyCcUsers: value })"
                  >
                    允许发起人调整抄送人
                  </el-checkbox>
                </el-form-item>
              </template>

              <!-- 审批节点 -->
              <template v-else-if="selectedData.type === 'approve'">
                <el-form-item label="审批方式">
                  <el-radio-group
                    :model-value="selectedData.approvers?.approveType"
                    @update:model-value="
                      value =>
                        updateNodeData({
                          approvers: {
                            ...(selectedData.approvers ?? {}),
                            approveType: value
                          }
                        })
                    "
                  >
                    <el-radio-button :value="'ANY_SIGN'">或签</el-radio-button>
                    <el-radio-button :value="'ALL_SIGN'">会签</el-radio-button>
                    <el-radio-button :value="'ORDER_SIGN'">顺序审批</el-radio-button>
                  </el-radio-group>
                </el-form-item>

                <el-form-item
                  v-if="selectedData.approvers?.approveType === 'ALL_SIGN'"
                  label="有人驳回时"
                >
                  <el-radio-group
                    :model-value="selectedData.approvers?.rejectPolicy || 'terminate'"
                    @update:model-value="
                      value =>
                        updateNodeData({
                          approvers: {
                            ...(selectedData.approvers ?? {}),
                            rejectPolicy: value
                          }
                        })
                    "
                  >
                    <el-radio-button value="terminate">立即终止</el-radio-button>
                    <el-radio-button value="continue">其余人继续签</el-radio-button>
                  </el-radio-group>
                </el-form-item>

                <el-form-item label="审批人来源">
                  <el-select
                    :model-value="assignmentType"
                    class="w-full"
                    @update:model-value="value => setAssignmentType(value as AssignmentType)"
                  >
                    <el-option
                      v-for="option in ASSIGNMENT_OPTIONS"
                      :key="option.value"
                      :label="ASSIGNMENT_TYPE[option.value]"
                      :value="option.value"
                    />
                  </el-select>
                  <p v-if="assignmentType !== 'specificUser'" class="designer__hint">
                    按规则在发起时自动解析，无需现在指定具体人。
                  </p>
                </el-form-item>

                <!-- 直属上级 / 部门主管：运行时才能确定，这里只说明规则 -->
                <template v-if="assignmentType === 'initiatorLeader' || assignmentType === 'deptLeader'">
                  <el-form-item label="解析规则">
                    <p class="designer__hint">
                      {{
                        assignmentType === 'initiatorLeader'
                          ? '取发起人的直属上级（员工档案上的上级字段）；没有时本节点按“审批人为空”策略处理。'
                          : '取发起人主部门的主管；本部门未设主管时沿组织树往上找到第一个为止。'
                      }}
                    </p>
                  </el-form-item>
                </template>

                <el-form-item v-if="assignmentNeed === 'level'" label="上级级数">
                  <el-input-number
                    :model-value="selectedData.approvers?.assignment?.level ?? 2"
                    :min="1"
                    :max="5"
                    @update:model-value="value => setAssignmentLevel(Number(value))"
                  />
                  <p class="designer__hint">从直属上级开始往上取 N 级；配了会签则同层多人一起签。</p>
                </el-form-item>

                <template v-if="assignmentNeed === 'field'">
                  <el-form-item label="人员字段">
                    <el-select
                      :model-value="selectedData.approvers?.assignment?.fieldName"
                      placeholder="选择表单字段"
                      class="w-full"
                      @update:model-value="value => setAssignmentField(String(value))"
                    >
                      <el-option
                        v-for="option in userFieldOptions"
                        :key="option.value"
                        :label="option.label"
                        :value="option.value"
                      />
                    </el-select>
                  </el-form-item>
                  <el-alert
                    type="warning"
                    :closable="false"
                    title="该字段的值必须是员工 ID（单个或数组）"
                    description="表单目前没有人员控件，用这个规则前请确认字段里存的确实是员工 ID。"
                  />
                </template>

                <el-form-item v-if="assignmentNeed === 'people'" label="审批人">
                  <div class="designer__people">
                    <el-tag
                      v-for="user in approverList"
                      :key="user.id"
                      closable
                      @close="
                        updateNodeData({
                          approvers: {
                            ...(selectedData.approvers ?? {}),
                            assignment: {
                              type: 'specificUser',
                              value: approverList.filter(item => item.id !== user.id)
                            }
                          }
                        })
                      "
                    >
                      {{ user.name }}
                    </el-tag>
                    <el-button link type="primary" @click="openUserSelect('approver')">
                      选择审批人
                    </el-button>
                  </div>
                </el-form-item>

                <!-- 节点治理：默认收起，不增加普通配置的负担 -->
                <el-collapse class="designer__governance">
                  <el-collapse-item name="governance">
                    <template #title>
                      <span class="designer__governance-title">
                        超时与兜底
                        <em v-if="governanceMarkOf(governance)">{{ governanceMarkOf(governance) }}</em>
                      </span>
                    </template>

                    <el-form-item label="超时处理">
                      <el-switch
                        :model-value="governance.timeout?.enabled"
                        @update:model-value="value => patchTimeout({ enabled: Boolean(value) })"
                      />
                      <p class="designer__hint">不配则沿用系统参数里的全局提醒策略。</p>
                    </el-form-item>

                    <template v-if="governance.timeout?.enabled">
                      <el-form-item label="超时时长（小时）">
                        <el-input-number
                          :model-value="governance.timeout.hours ?? 24"
                          :min="1"
                          :max="720"
                          class="w-full"
                          @update:model-value="value => patchTimeout({ hours: Number(value) })"
                        />
                      </el-form-item>
                      <el-form-item label="超时动作">
                        <el-select
                          :model-value="governance.timeout.action || 'remind'"
                          class="w-full"
                          @update:model-value="value => patchTimeout({ action: value })"
                        >
                          <el-option
                            v-for="(text, key) in TIMEOUT_ACTION"
                            :key="key"
                            :label="text"
                            :value="key"
                          />
                        </el-select>
                      </el-form-item>
                      <el-form-item v-if="governance.timeout.action === 'transfer'" label="转交给">
                        <div class="designer__people">
                          <el-tag
                            v-for="user in governance.timeout.transferTo ?? []"
                            :key="user.id"
                            closable
                            @close="
                              patchTimeout({
                                transferTo: (governance.timeout.transferTo ?? []).filter(
                                  item => item.id !== user.id
                                )
                              })
                            "
                          >
                            {{ user.name }}
                          </el-tag>
                          <el-button link type="primary" @click="openUserSelect('transfer')">
                            选择接手人
                          </el-button>
                        </div>
                      </el-form-item>
                      <el-form-item v-if="!governance.timeout.action || governance.timeout.action === 'remind'" label="最多提醒次数">
                        <el-input-number
                          :model-value="governance.timeout.remindLimit ?? 2"
                          :min="0"
                          :max="20"
                          class="w-full"
                          @update:model-value="value => patchTimeout({ remindLimit: Number(value) })"
                        />
                        <p class="designer__hint">0 表示不限次数。</p>
                      </el-form-item>
                    </template>

                    <el-form-item label="审批人为空时">
                      <el-select
                        :model-value="governance.emptyApprovers?.policy || 'error'"
                        class="w-full"
                        @update:model-value="value => patchEmptyApprovers({ policy: value })"
                      >
                        <el-option
                          v-for="(text, key) in EMPTY_APPROVER_POLICY"
                          :key="key"
                          :label="text"
                          :value="key"
                        />
                      </el-select>
                      <p class="designer__hint">
                        “报错”最安全但会卡住发起；“自动跳过”适合主管长期空缺的部门。
                      </p>
                    </el-form-item>

                    <el-form-item label="审批人去重">
                      <el-select
                        :model-value="governance.dedup?.policy || 'none'"
                        class="w-full"
                        @update:model-value="value => patchDedup({ policy: value })"
                      >
                        <el-option
                          v-for="(text, key) in DEDUP_POLICY"
                          :key="key"
                          :label="text"
                          :value="key"
                        />
                      </el-select>
                      <el-checkbox
                        v-if="governance.dedup?.policy && governance.dedup.policy !== 'none'"
                        :model-value="governance.dedup.includeInitiator !== false"
                        class="designer__checkbox"
                        @update:model-value="value => patchDedup({ includeInitiator: Boolean(value) })"
                      >
                        发起人自己也在审批人里时一并去重
                      </el-checkbox>
                    </el-form-item>

                    <el-form-item label="本节点字段权限">
                      <div v-if="fieldPermissionRows.length" class="designer__fields">
                        <div v-for="row in fieldPermissionRows" :key="row.field" class="designer__field-row">
                          <span class="designer__field-name" :title="row.label">{{ row.label }}</span>
                          <el-checkbox
                            :model-value="row.visible"
                            @update:model-value="value => patchFieldPermission(row, { visible: Boolean(value) })"
                          >
                            可见
                          </el-checkbox>
                          <el-checkbox
                            :model-value="row.editable"
                            :disabled="!row.visible"
                            @update:model-value="value => patchFieldPermission(row, { editable: Boolean(value) })"
                          >
                            可改
                          </el-checkbox>
                          <el-checkbox
                            :model-value="row.required"
                            :disabled="!row.editable"
                            @update:model-value="value => patchFieldPermission(row, { required: Boolean(value) })"
                          >
                            必填
                          </el-checkbox>
                        </div>
                      </div>
                      <p v-else class="designer__hint">请先在左侧选择关联表单，才能按字段配置权限。</p>
                      <p class="designer__hint">
                        没列出的字段默认只读可见；审批人可改的字段会在通过时一并保存。
                      </p>
                    </el-form-item>
                  </el-collapse-item>
                </el-collapse>
              </template>

              <!-- 抄送节点 -->
              <template v-else-if="selectedData.type === 'cc'">
                <el-form-item label="抄送人">
                  <div class="designer__people">
                    <el-tag
                      v-for="user in ccList"
                      :key="user.id"
                      closable
                      type="info"
                      @close="
                        updateNodeData({
                          ccUsers: {
                            type: 'specificUser',
                            value: ccList.filter(item => item.id !== user.id)
                          }
                        })
                      "
                    >
                      {{ user.name }}
                    </el-tag>
                    <el-button link type="primary" @click="openUserSelect('cc')">
                      选择抄送人
                    </el-button>
                  </div>
                </el-form-item>
              </template>

              <!-- 条件节点：分支列表与优先级 -->
              <template v-else-if="selectedData.type === 'condition'">
                <el-form-item label="分支说明（仅备注，真正判定看连线上的条件）">
                  <el-input
                    :model-value="selectedData.conditionLabel"
                    placeholder="例如：按金额分流"
                    @update:model-value="value => updateNodeData({ conditionLabel: value })"
                  />
                </el-form-item>

                <el-form-item label="分支顺序（自上而下依次判定，命中即停）">
                  <div v-if="branchesOf(selectedNode.id).length" class="designer__branches">
                    <div
                      v-for="(branch, index) in branchesOf(selectedNode.id)"
                      :key="branch.id"
                      class="designer__branch"
                      :class="{ 'is-active': branch.id === selectedEdgeId }"
                    >
                      <span class="designer__branch-index">{{ index + 1 }}</span>
                      <div class="designer__branch-main">
                        <b>{{ nodeNameOf(branch.target) }}</b>
                        <i>{{ branchLabel(branch) }}</i>
                      </div>
                      <div class="designer__branch-ops">
                        <el-button link :disabled="index === 0" @click="moveBranch(branch.id, -1)">
                          上移
                        </el-button>
                        <el-button
                          link
                          :disabled="index === branchesOf(selectedNode.id).length - 1"
                          @click="moveBranch(branch.id, 1)"
                        >
                          下移
                        </el-button>
                        <el-button link type="primary" @click="selectBranch(branch.id)">
                          配置
                        </el-button>
                      </div>
                    </div>
                  </div>
                  <p v-else class="designer__hint">
                    还没有分支：从本节点拖一条连线到目标节点，再在连线上配条件。
                  </p>
                </el-form-item>
              </template>

              <AppEmpty
                v-else
                description="结束节点无需额外配置"
                :image-size="72"
              />
            </el-form>
          </div>

          <p v-else class="designer__hint">点击画布中的节点进行配置</p>
        </AppDetailSection>
      </aside>
    </div>

    <UserSelectDialog
      v-model="userSelectVisible"
      :title="userSelectTitle"
      @confirm="onUsersSelected"
    />

    <AppFormDialog
      v-model="conditionVisible"
      :title="`配置分支条件 · ${selectedEdge ? nodeNameOf(selectedEdge.target) : ''}`"
      width="680px"
      confirm-text="保存条件"
      @confirm="saveCondition(conditionDraft as ConditionConfig)"
    >
      <ConditionEditor v-model="conditionDraft" :fields="conditionFields" />
    </AppFormDialog>
  </AppPage>
</template>

<style scoped lang="scss">
.designer {
  display: flex;
  gap: 16px;
  height: calc(100vh - 190px);
  min-height: 520px;

  &__side {
    display: flex;
    flex: 0 0 260px;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    overflow: hidden auto;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__palette {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__palette-item {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px 10px;
    text-align: left;
    cursor: pointer;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
    transition: all var(--app-duration-fast) var(--app-ease);

    &:hover {
      border-color: var(--app-primary-border);
      background: var(--app-primary-bg);
    }
  }

  &__palette-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    color: var(--app-primary);
    background: var(--app-primary-bg);
    border-radius: var(--app-radius-xs);
  }

  &__palette-text {
    display: flex;
    flex-direction: column;
    line-height: 1.3;

    b {
      font-size: var(--app-font-13);
      font-weight: 500;
      color: var(--app-text-1);
    }

    i {
      font-size: var(--app-font-12);
      font-style: normal;
      color: var(--app-text-3);
    }
  }

  &__canvas {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__middle {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  &__guide {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    color: var(--app-warning, #e37318);
    background: #fff8ec;
    border: 1px solid #f7dcc0;
    border-radius: var(--app-radius-sm);

    &.is-ok {
      color: var(--app-success, #0faf5f);
      background: #eefaf2;
      border-color: #bbf0cb;
    }
  }

  &__guide-title {
    font-size: var(--app-font-13);
    font-weight: 600;
  }

  &__guide-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__guide-item {
    padding: 1px 8px;
    font-size: var(--app-font-12);
    color: var(--app-text-2);
    cursor: pointer;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-xs);

    &:hover {
      color: var(--app-primary);
      border-color: var(--app-primary-border);
    }

    &.is-blocking {
      color: var(--app-danger, #d9372b);
      border-color: #f5c2be;
    }
  }

  &__canvas-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__canvas-tip {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__governance {
    margin-top: 4px;
    border-top: 1px dashed var(--app-border);

    :deep(.el-collapse-item__header) {
      height: 34px;
      font-size: var(--app-font-13);
      line-height: 34px;
      border-bottom: none;
    }

    :deep(.el-collapse-item__wrap) {
      border-bottom: none;
    }
  }

  &__governance-title {
    display: flex;
    gap: 6px;
    align-items: center;

    em {
      padding: 0 6px;
      font-size: 11px;
      font-style: normal;
      line-height: 16px;
      color: var(--app-primary);
      background: var(--app-primary-bg);
      border-radius: 8px;
    }
  }

  &__fields {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    max-height: 240px;
    overflow-y: auto;
  }

  &__field-row {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 2px 0;
    border-bottom: 1px dashed var(--app-border);

    :deep(.el-checkbox) {
      height: 22px;
      margin-right: 0;
    }

    :deep(.el-checkbox__label) {
      padding-left: 3px;
      font-size: var(--app-font-12);
    }
  }

  &__field-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: var(--app-font-12);
    color: var(--app-text-2);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__checkbox {
    width: 100%;
    margin-top: 4px;
  }

  &__panel {
    flex: 0 0 280px;
    padding: 16px;
    overflow: hidden auto;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__form {
    margin-top: 8px;
  }

  &__people {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  &__edge-endpoints {
    font-size: var(--app-font-13);
    color: var(--app-text-2);
  }

  &__condition {
    width: 100%;
  }

  &__condition-summary {
    margin: 0 0 4px;
    font-size: var(--app-font-13);
    color: var(--app-text-1);
    word-break: break-all;
  }

  &__condition-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__branches {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  &__branch {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    background: var(--app-fill-light, #f7f8fa);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);

    &.is-active {
      background: var(--app-primary-bg);
      border-color: var(--app-primary-border);
    }
  }

  &__branch-index {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    font-size: var(--app-font-12);
    color: var(--app-text-2);
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: 50%;
  }

  &__branch-main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    line-height: 1.3;

    b {
      overflow: hidden;
      font-size: var(--app-font-13);
      font-weight: 500;
      color: var(--app-text-1);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    i {
      overflow: hidden;
      font-size: var(--app-font-12);
      font-style: normal;
      color: var(--app-text-3);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__branch-ops {
    display: flex;
    flex: none;
    gap: 2px;
    align-items: center;
  }

  &__hint {
    font-size: var(--app-font-13);
    color: var(--app-text-3);
  }
}

:deep(.vue-flow__minimap) {
  border-radius: var(--app-radius-sm);
}
</style>
