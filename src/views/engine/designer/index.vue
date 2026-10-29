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
import {
  getWorkflowDetail,
  updateWorkflow
} from "@/api/workflow";
import { getFormList } from "@/api/form";
import { message } from "@/utils/message";
import { groupOptions } from "@/utils/workflow";
import {
  ApproveType,
  AssignmentType,
  NodeType
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

const nodeTypes = markRaw({ appNode: FlowNode });

const selectedNode = computed(() =>
  nodes.value.find(item => item.id === selectedId.value)
);

const selectedData = computed<any>(() => selectedNode.value?.data ?? {});

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
      allowModifyApprovers: false,
      allowModifyCcUsers: false
    }
  };
  return base as any;
}

function addNode(type: NodeType) {
  const index = nodes.value.length;
  const node = makeNode(type, {
    x: 120 + (index % 3) * 240,
    y: 80 + Math.floor(index / 3) * 140
  });
  nodes.value = [...nodes.value, node];
  selectedId.value = node.id;
}

function removeSelected() {
  if (!selectedId.value) return;
  if (selectedData.value?.type === NodeType.START) {
    message("发起人节点不可删除", { type: "warning" });
    return;
  }
  nodes.value = nodes.value.filter(node => node.id !== selectedId.value);
  edges.value = edges.value.filter(
    edge => edge.source !== selectedId.value && edge.target !== selectedId.value
  );
  selectedId.value = "";
}

function onNodeClick({ node }: any) {
  selectedId.value = node.id;
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
const userSelectTarget = ref<"approver" | "cc">("approver");

const approverList = computed<any[]>(
  () => selectedData.value?.approvers?.assignment?.value ?? []
);
const ccList = computed<any[]>(() => selectedData.value?.ccUsers?.value ?? []);

function openUserSelect(target: "approver" | "cc") {
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
      allowModifyApprovers: node.allowModifyApprovers ?? false,
      allowModifyCcUsers: node.allowModifyCcUsers ?? false,
      conditionLabel: node.conditionLabel,
      // 保留后端节点上的其余字段（如 allowResubmit / allowWithdraw），保存时原样回写
      rawNode: node
    }
  }));
}

function toFlowEdges(configEdges: any[]): any[] {
  return (configEdges ?? []).map((edge, index) => ({
    id: String(edge.id ?? `edge_${index}`),
    source: String(edge.source),
    target: String(edge.target),
    label: edge.label,
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
      conditionLabel: node.data?.conditionLabel
    };
  });

  const configEdges = edges.value.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: typeof edge.label === "string" ? edge.label : undefined
  }));

  return JSON.stringify({ nodes: configNodes, edges: configEdges });
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

      <!-- 中间：画布 -->
      <section class="designer__canvas">
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :node-types="nodeTypes"
          :default-edge-options="edgeOptions"
          :min-zoom="0.3"
          :max-zoom="1.6"
          fit-view-on-init
          @node-click="onNodeClick"
          @pane-click="selectedId = ''"
        >
          <Background :gap="16" :size="1" pattern-color="#e5e6eb" />
          <Controls />
          <MiniMap pannable zoomable />
        </VueFlow>
      </section>

      <!-- 右侧：节点属性 -->
      <aside class="designer__panel">
        <AppDetailSection
          :title="selectedNode ? '节点配置' : '节点配置（未选中）'"
        >
          <template v-if="selectedNode" #extra>
            <el-button
              v-if="selectedData.type !== 'start'"
              link
              type="danger"
              @click="removeSelected"
            >
              删除节点
            </el-button>
          </template>

          <div v-if="selectedNode" class="designer__form">
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

                <el-form-item label="审批人">
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

              <!-- 条件节点 -->
              <template v-else-if="selectedData.type === 'condition'">
                <el-form-item label="条件说明">
                  <el-input
                    :model-value="selectedData.conditionLabel"
                    placeholder="例如：金额大于 10000"
                    @update:model-value="value => updateNodeData({ conditionLabel: value })"
                  />
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
      :title="userSelectTarget === 'approver' ? '选择审批人' : '选择抄送人'"
      @confirm="onUsersSelected"
    />
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

  &__hint {
    font-size: var(--app-font-13);
    color: var(--app-text-3);
  }
}

:deep(.vue-flow__minimap) {
  border-radius: var(--app-radius-sm);
}
</style>
