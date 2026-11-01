<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import dayjs from "dayjs";
import {
  approveInstance,
  cancelMyApproval,
  checkInstancePermission,
  delegateTask,
  getMyCcList,
  getMyDoneList,
  getMyInitiatedList,
  getMyTodoList,
  getMyWorkCount,
  getWorkflowInstanceDetail,
  getWorkflowList,
  initiateWorkflow,
  rejectInstance
} from "@/api/workflow";
import { getFormList } from "@/api/form";
import { useUserStoreHook } from "@/store/modules/user";
import { hasAuth } from "@/router/utils";
import { downloadExcel } from "@/utils/export";
import { message } from "@/utils/message";
import { emitter } from "@/utils/mitt";
import { statusConfig, getAttachmentUrl } from "@/utils/workflow";
import {
  previewAttachment,
  getAttachmentFileId
} from "@/composables/useFilePreview";
import ApprovalDetail from "@/components/workflow/ApprovalDetail.vue";
import WorkflowLaunchDialog from "@/components/workflow/WorkflowLaunchDialog.vue";
import FormFieldDisplay from "@/components/workflow/FormFieldDisplay.vue";
import AttachmentUpload, {
  type AttachmentInfo
} from "@/components/workflow/AttachmentUpload.vue";

defineOptions({ name: "EngineInstance" });

const route = useRoute();
const userStore = useUserStoreHook();

/* ============ Tab 定义 ============ */
type TabKey = "initiated" | "todo" | "done" | "cc" | "approved" | "cancelled";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "initiated", label: "我发起的" },
  { key: "todo", label: "我待办的" },
  { key: "done", label: "我已办的" },
  { key: "cc", label: "抄送给我的" },
  { key: "approved", label: "已通过" },
  { key: "cancelled", label: "已取消" }
];

const activeTab = ref<TabKey>("initiated");
const isCcTab = computed(() => activeTab.value === "cc");

const exporting = ref(false);

/** 导出当前 Tab 视角的审批实例；“我发起的” Tab 仅导出本人发起的数据 */
async function handleExport() {
  exporting.value = true;
  try {
    await downloadExcel(
      "export/workflow-instances",
      {
        keyword: filters[activeTab.value]?.keyword || undefined,
        mine: activeTab.value === "initiated" ? true : undefined
      },
      "审批实例.xlsx"
    );
  } finally {
    exporting.value = false;
  }
}

/* ============ 列表数据 ============ */
const loading = ref(false);
const lists = reactive<Record<TabKey, any[]>>({
  initiated: [],
  todo: [],
  done: [],
  cc: [],
  approved: [],
  cancelled: []
});

const pagination = reactive<
  Record<TabKey, { currentPage: number; pageSize: number; total: number }>
>({
  initiated: { currentPage: 1, pageSize: 10, total: 0 },
  todo: { currentPage: 1, pageSize: 10, total: 0 },
  done: { currentPage: 1, pageSize: 10, total: 0 },
  cc: { currentPage: 1, pageSize: 10, total: 0 },
  approved: { currentPage: 1, pageSize: 10, total: 0 },
  cancelled: { currentPage: 1, pageSize: 10, total: 0 }
});

const filters = reactive<
  Record<TabKey, { keyword: string; searchInitiatorOnly: boolean; extra?: any }>
>({
  initiated: { keyword: "", searchInitiatorOnly: false, extra: "" },
  todo: { keyword: "", searchInitiatorOnly: false },
  done: { keyword: "", searchInitiatorOnly: false },
  cc: { keyword: "", searchInitiatorOnly: false, extra: "" },
  approved: { keyword: "", searchInitiatorOnly: false },
  cancelled: { keyword: "", searchInitiatorOnly: false }
});

const workCount = ref({
  pendingTaskCount: 0,
  unreadCcCount: 0,
  totalCount: 0
});

const currentList = computed(() => lists[activeTab.value]);
const currentPage = computed({
  get: () => pagination[activeTab.value].currentPage,
  set: value => (pagination[activeTab.value].currentPage = value)
});

/* ============ 工作流与表单配置 ============ */
const workflowList = ref<any[]>([]);
const formList = ref<any[]>([]);

function formConfigOfDefinition(definitionId: any) {
  const workflow = workflowList.value.find(item => item.id === definitionId);
  if (!workflow) return null;
  return formList.value.find(item => item.id === workflow.formDesignId) ?? null;
}

/* ============ 列表加载 ============ */
async function loadList(type: TabKey = activeTab.value) {
  loading.value = true;
  const page = pagination[type];
  const filter = filters[type];

  const params: Record<string, any> = {
    page: page.currentPage,
    pageSize: page.pageSize,
    deptId:
      userStore.departments?.find((item: any) => item.isPrimary)
        ?.departmentId || undefined,
    searchInitiatorOnly: filter.searchInitiatorOnly
  };

  if (filter.keyword) params.keyword = filter.keyword;

  if (type === "initiated" && filter.extra) params.status = filter.extra;
  if (type === "cc" && filter.extra !== "" && filter.extra !== undefined) {
    params.isRead = filter.extra;
  }
  if (type === "approved") params.status = "approved";
  if (type === "cancelled") params.status = "cancelled";

  try {
    let res: any;
    switch (type) {
      case "todo":
        res = await getMyTodoList(params);
        break;
      case "done":
        res = await getMyDoneList(params);
        break;
      case "cc":
        res = await getMyCcList(params);
        break;
      default:
        res = await getMyInitiatedList(params);
    }
    lists[type] = res?.data?.list ?? [];
    pagination[type].total = res?.data?.total ?? 0;
    if (type === activeTab.value) {
      const stillExists = lists[type].some(
        (row: any) => instanceIdOf(row) === selectedKey.value
      );
      if (!stillExists) autoSelectFirst();
    }
  } catch (error) {
    console.error(`加载列表失败(${type}):`, error);
  } finally {
    loading.value = false;
  }
}

async function loadWorkflowList() {
  try {
    const res: any = await getWorkflowList({
      page: 1,
      pageSize: 50,
      isEnabled: true
    });
    workflowList.value = res?.data?.list ?? [];
  } catch (error) {
    console.error("获取工作流列表失败:", error);
  }
}

async function loadFormList() {
  try {
    const res: any = await getFormList({ page: 1, pageSize: 100 });
    formList.value = (res?.data?.list ?? []).map((item: any) => {
      const parsed = { ...item, fields: [] as any[] };
      if (item.formConfig) {
        try {
          parsed.fields = JSON.parse(item.formConfig)?.fields ?? [];
        } catch {
          parsed.fields = [];
        }
      }
      return parsed;
    });
  } catch (error) {
    console.error("获取表单列表失败:", error);
  }
}

async function loadWorkCount() {
  try {
    const res: any = await getMyWorkCount();
    if (res?.data?.workCount) workCount.value = res.data.workCount;
  } catch (error) {
    console.error("获取工作计数失败:", error);
  }
}

/* ============ 交互 ============ */
function handleTabChange(key: string) {
  activeTab.value = key as TabKey;
  pagination[key as TabKey].currentPage = 1;
  loadList(key as TabKey);
}

/** 翻页：先把新页码写回当前 Tab，再按该页加载列表 */
function handlePageChange(page: number) {
  const key = activeTab.value;
  if (pagination[key].currentPage === page) return;
  pagination[key].currentPage = page;
  loadList(key);
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    pagination[activeTab.value].currentPage = 1;
    loadList();
  }, 400);
}

function handleFilterChange() {
  pagination[activeTab.value].currentPage = 1;
  loadList();
}

/* ============ 详情 ============ */
const detailVisible = ref(false);
const detailLoading = ref(false);
const currentDetail = ref<any>({});
const currentPermission = ref<any>(null);
const currentFormConfig = ref<any>(null);

async function openDetail(instanceId: string) {
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const [detailRes, permissionRes] = await Promise.all([
      getWorkflowInstanceDetail(instanceId),
      checkInstancePermission(instanceId)
    ]);
    currentDetail.value = detailRes?.data?.instance ?? detailRes?.data ?? {};
    currentPermission.value =
      permissionRes?.data?.permission ?? permissionRes?.data ?? {};
    currentFormConfig.value = formConfigOfDefinition(
      currentDetail.value.definitionId
    );
  } catch (error) {
    console.error("获取流程详情失败:", error);
    message("获取流程详情失败", { type: "error" });
    detailVisible.value = false;
  } finally {
    detailLoading.value = false;
  }
}

async function handleRefreshDetail() {
  const instanceId =
    currentDetail.value?.id || currentDetail.value?.instanceId;
  if (!instanceId) return;
  await openDetail(instanceId);
  loadList();
  loadWorkCount();
}

/* ============ 审批动作 ============ */
async function handleApprove(data: any) {
  const taskId = currentPermission.value?.pendingTaskId;
  if (!taskId) {
    message("未找到待办任务", { type: "error" });
    return;
  }

  try {
    if (data.result === "approve") {
      await approveInstance(taskId, {
        comment: data.comment,
        fileIds: data.fileIds ?? [],
        // 本节点字段权限允许修改时随审批一并提交；后端会再校一道
        formDataPatch: data.formDataPatch
      });
      message("审批通过", { type: "success" });
    } else {
      await rejectInstance(taskId, {
        comment: data.comment,
        fileIds: data.fileIds ?? []
      });
      message("已拒绝", { type: "success" });
    }
    detailVisible.value = false;
    previewCache.clear();
    loadList();
    loadWorkCount();
  } catch (error) {
    console.error("审批处理失败:", error);
  }
}

async function handleCancel(data: any) {
  try {
    await cancelMyApproval(data.instanceId, data.reason ?? "");
    message("流程已撤销", { type: "success" });
    detailVisible.value = false;
    loadList();
    loadWorkCount();
  } catch (error) {
    console.error("撤销失败:", error);
  }
}

async function handleReinitiate(payload: any) {
  try {
    await initiateWorkflow(payload);
    message("审批申请已提交", { type: "success" });
    detailVisible.value = false;
    loadList();
  } catch (error) {
    console.error("重新发起失败:", error);
  }
}

/* ============ 快捷审批（待办列表） ============ */
const quickVisible = ref(false);
const quickSubmitting = ref(false);
const quickTarget = ref<any>(null);
const quickForm = reactive({
  result: "approve" as "approve" | "reject",
  comment: "",
  attachments: [] as AttachmentInfo[]
});

function openQuickApprove(row: any, result: "approve" | "reject") {
  quickTarget.value = row;
  quickForm.result = result;
  quickForm.comment = "";
  quickForm.attachments = [];
  quickVisible.value = true;
}

async function submitQuickApprove() {
  if (!quickTarget.value?.id) return;
  if (quickForm.result === "reject" && !quickForm.comment.trim()) {
    message("拒绝时必须填写原因", { type: "warning" });
    return;
  }

  quickSubmitting.value = true;
  try {
    const payload = {
      comment: quickForm.comment,
      fileIds: quickForm.attachments.map(file => file.id)
    };
    if (quickForm.result === "approve") {
      await approveInstance(quickTarget.value.id, payload);
      message("审批通过", { type: "success" });
    } else {
      await rejectInstance(quickTarget.value.id, payload);
      message("已拒绝", { type: "success" });
    }
    quickVisible.value = false;
    previewCache.clear();
    loadList("todo");
    loadWorkCount();
  } catch (error) {
    console.error("快捷审批失败:", error);
  } finally {
    quickSubmitting.value = false;
  }
}

/* ============ 发起审批 ============ */
const workflowSelectVisible = ref(false);
const workflowKeyword = ref("");
const selectedWorkflow = ref<any>(null);
const launchVisible = ref(false);
const launchFormConfig = ref<any>(null);

const filteredWorkflows = computed(() => {
  const key = workflowKeyword.value.trim().toLowerCase();
  const list = workflowList.value ?? [];
  if (!key) return list;
  return list.filter(
    item =>
      String(item.name ?? "").toLowerCase().includes(key) ||
      String(item.groupName ?? "").toLowerCase().includes(key)
  );
});

function chooseWorkflow(workflow: any) {
  selectedWorkflow.value = workflow;
  launchFormConfig.value = formConfigOfDefinition(
    workflow.id
  ) ?? formList.value.find(item => item.id === workflow.formDesignId);
  workflowSelectVisible.value = false;
  nextTick(() => (launchVisible.value = true));
}

function handleLaunchSubmit(payload: any) {
  initiateWorkflow(payload)
    .then(() => {
      message("审批申请已提交", { type: "success" });
      (launchDialogRef.value as any)?.handleSubmitted();
      loadList(activeTab.value);
    })
    .catch((error: any) => console.error("发起审批失败:", error));
}

const launchDialogRef = ref();

const statusMeta = (status: string) =>
  statusConfig[status] ?? { text: "未知状态", type: "info", icon: "ep:timer" };

const formatTime = (value: any) => {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.format("MM-DD HH:mm") : String(value);
};

/* ============ 事件与初始化 ============ */
const handleWorkCountChanged = () => loadWorkCount();
const handleDeptChanged = () => {
  loadList();
  loadWorkCount();
};

watch(activeTab, () => {
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
});

onMounted(async () => {
  emitter.on("workCountChanged", handleWorkCountChanged);
  emitter.on("primaryDeptChanged", handleDeptChanged);

  await Promise.all([loadWorkflowList(), loadFormList(), loadWorkCount()]);

  const { tab, instanceId, id } = route.query as Record<string, string>;

  if (tab) {
    // URL 里的 tab 可能来自手工输入或旧书签：未知值直接回落到「我发起的」。
    // 不兜底会让 filters[activeTab]/pagination[activeTab] 取到 undefined，
    // 页面报错 reading 'keyword' / 'currentPage' 并且列表全空。
    const fallbackTab = tabs.find(item => item.key === tab)?.key ?? "initiated";
    activeTab.value = fallbackTab as TabKey;
    await loadList(activeTab.value);
    if (instanceId) openDetail(instanceId);
  } else {
    await loadList("initiated");
  }

  if (id) {
    const workflow =
      workflowList.value.find(item => String(item.id) === String(id)) ??
      workflowList.value[0];
    if (workflow) chooseWorkflow(workflow);
  }
});

onUnmounted(() => {
  emitter.off("workCountChanged", handleWorkCountChanged);
  emitter.off("primaryDeptChanged", handleDeptChanged);
  if (searchTimer) clearTimeout(searchTimer);
});

/* ============ 收件箱：分组 / 选中 / 预览 ============ */
const selectedKey = ref<string>("");
const previewLoading = ref(false);
const previewDetail = ref<any>(null);
const previewCache = new Map<string, any>();

const instanceIdOf = (row: any): string => row?.instanceId || row?.id || "";

const selectedRow = computed(
  () =>
    currentList.value.find(
      (row: any) => instanceIdOf(row) === selectedKey.value
    ) ?? null
);

/** 按时间分组：今天 / 昨天 / 近 7 天 / 更早 */
const groupedList = computed(() => {
  const groups = [
    { label: "今天", items: [] as any[] },
    { label: "昨天", items: [] as any[] },
    { label: "近 7 天", items: [] as any[] },
    { label: "更早", items: [] as any[] }
  ];
  currentList.value.forEach((row: any) => {
    const at = dayjs(row.createdAt);
    const diff = at.isValid()
      ? dayjs().startOf("day").diff(at.startOf("day"), "day")
      : 99;
    const index = diff <= 0 ? 0 : diff === 1 ? 1 : diff <= 7 ? 2 : 3;
    groups[index].items.push(row);
  });
  return groups.filter(group => group.items.length > 0);
});

function selectRow(row: any) {
  const id = instanceIdOf(row);
  if (!id) return;
  selectedKey.value = id;
  loadPreview(id);
}

async function loadPreview(instanceId: string) {
  if (previewCache.has(instanceId)) {
    previewDetail.value = previewCache.get(instanceId);
    return;
  }
  previewLoading.value = true;
  previewDetail.value = null;
  try {
    const res: any = await getWorkflowInstanceDetail(instanceId);
    const detail = res?.data?.instance ?? res?.data ?? null;
    previewCache.set(instanceId, detail);
    if (selectedKey.value === instanceId) previewDetail.value = detail;
  } catch (error) {
    console.warn("[instance] 预览加载失败:", error);
  } finally {
    previewLoading.value = false;
  }
}

function autoSelectFirst() {
  const first = currentList.value[0];
  if (first) {
    selectRow(first);
  } else {
    selectedKey.value = "";
    previewDetail.value = null;
  }
}

/* ============ 汇总展示辅助 ============ */
const AMOUNT_KEYS = ["amount", "budget", "total", "money", "fee"];

const formAmount = (row: any): number | null => {
  const data = row?.formData ?? {};
  for (const key of AMOUNT_KEYS) {
    const value = data[key];
    if (typeof value === "number" && value > 0) return value;
  }
  return null;
};

const formatAmount = (value: number) =>
  `¥${Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;

const approveTypeLabel = (type?: string) =>
  type === "ALL_SIGN"
    ? "会签"
    : type === "ANY_SIGN"
      ? "或签"
      : type === "ORDER_SIGN"
        ? "串行"
        : "";

const attachmentCountOf = (row: any) => Number(row?.attachmentCount ?? 0);

/** 预览区字段：多展示几列，过滤掉上传/子表 */
function previewFields(row: any) {
  const fields = row?.formConfig?.fields ?? [];
  return fields
    .filter((field: any) => {
      if (!field?.name) return false;
      if (
        ["el-upload", "el-image-upload", "el-file-upload", "el-table"].includes(
          field.type
        )
      ) {
        return false;
      }
      const value = row.formData?.[field.name];
      if (value === null || value === undefined || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
    .slice(0, 6);
}

/** 预览区附件（从表单数据中提取上传字段） */
const previewAttachments = computed<any[]>(() => {
  const data = selectedRow.value?.formData ?? {};
  const files: any[] = [];
  Object.values(data).forEach((value: any) => {
    if (!Array.isArray(value)) return;
    value.forEach((item: any) => {
      const fileId = getAttachmentFileId(item);
      const url = getAttachmentUrl(item);
      if (!fileId && !url) return;
      files.push({
        // fileId 必须保留：预览器只认 fileId（能预览与否、用哪种方式由后端判定），
        // 之前这里只留了 url，导致审批中心无法接入应用内离线预览
        fileId,
        name: item.fileName || item.name || "附件",
        url
      });
    });
  });
  return files;
});

/** 附件点击走应用内离线预览 */
function onPreviewAttachment(file: any) {
  if (previewAttachment(file)) return;
  message("附件地址不可用", { type: "error" });
}

const previewTimeline = computed<any[]>(
  () => previewDetail.value?.processTimeline ?? []
);

const nodeTypeText = (node: any) =>
  node?.nodeType === "cc"
    ? "抄送"
    : node?.nodeType === "start"
      ? "发起"
      : node?.nodeType === "end"
        ? "结束"
        : "审批";

const assigneeType = (status: string) =>
  status === "approved"
    ? "success"
    : status === "rejected"
      ? "danger"
      : status === "pending"
        ? "warning"
        : "info";

const assigneeText = (status: string) =>
  status === "approved"
    ? "已同意"
    : status === "rejected"
      ? "已驳回"
      : status === "pending"
        ? "待处理"
        : status === "skipped"
          ? "已跳过"
          : "已取消";

function nodeDuration(node: any) {
  if (!node?.startedAt) return "";
  const start = dayjs(node.startedAt);
  const end = node.completedAt ? dayjs(node.completedAt) : dayjs();
  if (!start.isValid()) return "";
  const minutes = Math.max(0, end.diff(start, "minute"));
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.round(minutes / 6) / 10;
  if (hours < 24) return `${hours} 小时`;
  return `${Math.round(hours / 24)} 天`;
}

function openFullDetail(row: any) {
  const id = instanceIdOf(row);
  if (id) openDetail(id);
}
</script>

<template>
  <AppPage title="审批中心" description="处理待办、跟踪流程进展与发起新审批">
    <template #actions>
      <el-button
        v-if="!isCcTab && hasAuth('engine:instance:export')"
        :loading="exporting"
        @click="handleExport"
      >
        <AppIcon icon="ep:download" :size="14" />
        导出 Excel
      </el-button>
      <el-button type="primary" @click="workflowSelectVisible = true">
        <AppIcon icon="ep:plus" :size="14" />
        发起审批
      </el-button>
    </template>

    <!-- Tab 与筛选 -->
    <div class="approval-center">
      <el-tabs
        :model-value="activeTab"
        class="approval-center__tabs"
        @update:model-value="handleTabChange"
      >
        <el-tab-pane v-for="tab in tabs" :key="tab.key" :name="tab.key">
          <template #label>
            <span class="approval-center__tab">
              {{ tab.label }}
              <el-badge
                v-if="tab.key === 'todo' && workCount.pendingTaskCount > 0"
                :value="workCount.pendingTaskCount"
                :max="99"
              />
              <el-badge
                v-if="tab.key === 'cc' && workCount.unreadCcCount > 0"
                :value="workCount.unreadCcCount"
                :max="99"
                type="danger"
              />
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>

      <div class="approval-center__toolbar">
        <div class="approval-center__filters">
          <el-input
            v-model="filters[activeTab].keyword"
            placeholder="搜索标题或发起人"
            clearable
            class="approval-center__search"
            @input="handleSearch"
            @clear="handleFilterChange"
          >
            <template #prefix>
              <AppIcon icon="ep:search" :size="14" />
            </template>
          </el-input>

          <el-checkbox
            v-model="filters[activeTab].searchInitiatorOnly"
            @change="handleFilterChange"
          >
            仅搜索发起人
          </el-checkbox>

          <el-select
            v-if="activeTab === 'initiated'"
            v-model="filters.initiated.extra"
            placeholder="全部状态"
            clearable
            class="approval-center__select"
            @change="handleFilterChange"
          >
            <el-option label="审批中" value="running" />
            <el-option label="已通过" value="approved" />
            <el-option label="已拒绝" value="rejected" />
            <el-option label="已取消" value="cancelled" />
          </el-select>

          <el-select
            v-if="activeTab === 'cc'"
            v-model="filters.cc.extra"
            placeholder="全部"
            clearable
            class="approval-center__select"
            @change="handleFilterChange"
          >
            <el-option label="已读" :value="true" />
            <el-option label="未读" :value="false" />
          </el-select>
        </div>

        <el-button :loading="loading" @click="loadList()">
          <AppIcon icon="ep:refresh" :size="14" />
          刷新
        </el-button>
      </div>

      <!-- 收件箱：左侧分组列表 + 右侧inline 预览 -->
      <div class="approval-inbox">
        <aside v-loading="loading" class="approval-inbox__list">
          <template v-if="groupedList.length">
            <section
              v-for="group in groupedList"
              :key="group.label"
              class="approval-inbox__group"
            >
              <header class="approval-inbox__group-head">
                <span>{{ group.label }}</span>
                <span class="approval-inbox__group-count">{{ group.items.length }}</span>
              </header>

              <button
                v-for="row in group.items"
                :key="row.id"
                type="button"
                class="approval-card"
                :class="{ 'is-active': instanceIdOf(row) === selectedKey }"
                @click="selectRow(row)"
              >
                <span
                  class="approval-card__rail"
                  :class="`is-${statusMeta(row.status).type}`"
                />
                <div class="approval-card__body">
                  <div class="approval-card__head">
                    <AppUserAvatar
                      :name="row.initiatorName"
                      :avatar="row.initiatorAvatar"
                      :size="30"
                    />
                    <div class="approval-card__title-wrap">
                      <span class="approval-card__title">
                        {{ row.instanceTitle || row.definitionName }}
                      </span>
                      <span class="approval-card__meta">
                        {{ row.definitionName }}
                        <template v-if="row.definitionGroup">
                          · {{ row.definitionGroup }}
                        </template>
                        · {{ row.initiatorName }} · {{ formatTime(row.createdAt) }}
                      </span>
                    </div>
                    <el-tag
                      v-if="!isCcTab"
                      :type="statusMeta(row.status).type as any"
                      effect="light"
                      size="small"
                    >
                      {{ statusMeta(row.status).text }}
                    </el-tag>
                    <el-tag
                      v-else
                      :type="row.isRead ? 'info' : 'danger'"
                      effect="light"
                      size="small"
                    >
                      {{ row.isRead ? "已读" : "未读" }}
                    </el-tag>
                  </div>

                  <div class="approval-card__chips">
                    <span v-if="activeTab === 'todo'" class="approval-chip is-progress">
                      待我审批
                    </span>
                    <span v-if="formAmount(row)" class="approval-chip is-amount">
                      {{ formatAmount(formAmount(row)!) }}
                    </span>
                    <span
                      v-if="approveTypeLabel(row.approveType)"
                      class="approval-chip"
                    >
                      {{ approveTypeLabel(row.approveType) }}
                    </span>
                    <span v-if="attachmentCountOf(row)" class="approval-chip">
                      {{ attachmentCountOf(row) }} 个附件
                    </span>
                    <span v-if="row.nodeTotal" class="approval-chip is-progress">
                      节点 {{ row.nodeCompleted ?? 0 }}/{{ row.nodeTotal }}
                    </span>
                    <span v-if="(row.ccNames || []).length" class="approval-chip">
                      抄送 {{ (row.ccNames || []).length }} 人
                    </span>
                  </div>

                  <div
                    v-if="row.currentNodeName || row.nodeName"
                    class="approval-card__node"
                  >
                    <span class="approval-card__node-dot" />
                    <span class="approval-card__node-name">
                      {{ row.currentNodeName || row.nodeName }}
                    </span>
                    <span
                      v-if="(row.currentAssignees || []).length"
                      class="approval-card__node-people"
                    >
                      待 {{ (row.currentAssignees || []).join("、") }}
                    </span>
                  </div>
                </div>
              </button>
            </section>
          </template>

          <AppEmpty
            v-else-if="!loading"
            :description="`暂无${tabs.find(tab => tab.key === activeTab)?.label}数据`"
            :image-size="80"
          />

          <div v-if="pagination[activeTab].total > 0" class="approval-inbox__pager">
            <el-pagination
              size="small"
              background
              layout="prev, pager, next"
              :current-page="currentPage"
              :page-size="pagination[activeTab].pageSize"
              :total="pagination[activeTab].total"
              @current-change="handlePageChange"
            />
          </div>
        </aside>

        <section v-loading="previewLoading" class="approval-preview">
          <template v-if="selectedRow">
            <header class="approval-preview__head">
              <div class="approval-preview__title-row">
                <h3 class="approval-preview__title">
                  {{ selectedRow.instanceTitle || selectedRow.definitionName }}
                </h3>
                <el-tag
                  :type="statusMeta(selectedRow.status).type as any"
                  effect="light"
                >
                  {{ statusMeta(selectedRow.status).text }}
                </el-tag>
              </div>
              <p class="approval-preview__meta">
                {{ selectedRow.definitionName }}
                <template v-if="selectedRow.definitionGroup">
                  · {{ selectedRow.definitionGroup }}
                </template>
                · 发起人 {{ selectedRow.initiatorName }}
                <template v-if="selectedRow.initiatorDeptName">
                  · {{ selectedRow.initiatorDeptName }}
                </template>
                · {{ formatTime(selectedRow.createdAt) }}
              </p>
            </header>

            <div class="approval-preview__stats">
              <div class="approval-preview__stat">
                <span class="label">当前节点</span>
                <span class="value">
                  {{ selectedRow.currentNodeName || selectedRow.nodeName || "已完成" }}
                </span>
              </div>
              <div class="approval-preview__stat">
                <span class="label">节点进度</span>
                <span class="value">
                  {{ selectedRow.nodeCompleted ?? 0 }} / {{ selectedRow.nodeTotal ?? 0 }}
                </span>
              </div>
              <div class="approval-preview__stat">
                <span class="label">附件</span>
                <span class="value">{{ attachmentCountOf(selectedRow) }} 个</span>
              </div>
              <div v-if="formAmount(selectedRow)" class="approval-preview__stat">
                <span class="label">金额</span>
                <span class="value is-strong">
                  {{ formatAmount(formAmount(selectedRow)!) }}
                </span>
              </div>
            </div>

            <div v-if="previewFields(selectedRow).length" class="approval-preview__section">
              <h4 class="approval-preview__section-title">申请内容</h4>
              <div class="approval-preview__fields">
                <div
                  v-for="field in previewFields(selectedRow)"
                  :key="field.name"
                  class="approval-preview__field"
                >
                  <span class="approval-preview__field-label">{{ field.label }}</span>
                  <span class="approval-preview__field-value">
                    <FormFieldDisplay
                      :field="field"
                      :value="selectedRow.formData?.[field.name]"
                    />
                  </span>
                </div>
              </div>
            </div>

            <div v-if="previewAttachments.length" class="approval-preview__section">
              <h4 class="approval-preview__section-title">
                附件材料（{{ previewAttachments.length }}）
              </h4>
              <div class="approval-preview__files">
                <div
                  v-for="file in previewAttachments"
                  :key="file.fileId || file.url"
                  class="approval-preview__file"
                  role="button"
                  tabindex="0"
                  title="点击预览"
                  @click="onPreviewAttachment(file)"
                  @keydown.enter.prevent="onPreviewAttachment(file)"
                >
                  <AppIcon icon="ep:files" :size="14" />
                  <span>{{ file.name }}</span>
                  <a
                    class="approval-preview__file-dl"
                    :href="file.url"
                    target="_blank"
                    rel="noopener"
                    title="下载"
                    @click.stop
                  >
                    <AppIcon icon="ep:download" :size="13" />
                  </a>
                </div>
              </div>
            </div>

            <div v-if="previewTimeline.length" class="approval-preview__section">
              <h4 class="approval-preview__section-title">流程进度</h4>
              <ol class="approval-preview__timeline">
                <li
                  v-for="node in previewTimeline"
                  :key="node.nodeId"
                  class="approval-preview__node"
                  :class="`is-${node.nodeStatus}`"
                >
                  <span class="approval-preview__node-dot" />
                  <div class="approval-preview__node-body">
                    <div class="approval-preview__node-head">
                      <span class="approval-preview__node-name">{{ node.nodeName }}</span>
                      <span class="approval-preview__node-badge">{{ nodeTypeText(node) }}</span>
                      <span
                        v-if="approveTypeLabel(node.approveType)"
                        class="approval-preview__node-badge is-approve"
                      >
                        {{ approveTypeLabel(node.approveType) }}
                      </span>
                      <span
                        v-if="(node.nodeType === 'approve' || node.nodeType === 'cc') && nodeDuration(node)"
                        class="approval-preview__node-time"
                      >
                        {{ nodeDuration(node) }}
                      </span>
                    </div>

                    <div
                      v-if="(node.assignees || []).length"
                      class="approval-preview__node-people"
                    >
                      <span
                        v-for="assignee in node.assignees"
                        :key="assignee.id"
                        class="approval-preview__person"
                        :class="`is-${assignee.status}`"
                      >
                        {{ assignee.name }} · {{ assigneeText(assignee.status) }}
                      </span>
                    </div>

                    <div
                      v-if="(node.ccUsers || []).length"
                      class="approval-preview__node-people"
                    >
                      <span
                        v-for="ccUser in node.ccUsers"
                        :key="ccUser.id"
                        class="approval-preview__person is-cc"
                      >
                        抄送 {{ ccUser.name }}
                      </span>
                    </div>
                  </div>
                </li>
              </ol>
            </div>

            <footer class="approval-preview__actions">
              <template v-if="activeTab === 'todo' && selectedRow.canApprove">
                <el-button
                  type="success"
                  @click="openQuickApprove(selectedRow, 'approve')"
                >
                  同意
                </el-button>
                <el-button
                  type="danger"
                  plain
                  @click="openQuickApprove(selectedRow, 'reject')"
                >
                  拒绝
                </el-button>
              </template>
              <el-button type="primary" plain @click="openFullDetail(selectedRow)">
                查看完整详情
              </el-button>
            </footer>
          </template>

          <div v-else class="approval-preview__empty">
            <AppIcon icon="ep:document" :size="28" color="var(--app-text-4)" />
            <p>从左侧选择一条审批查看详情</p>
          </div>
        </section>
      </div>
    </div>

    <!-- 选择流程 -->
    <AppFormDialog
      v-model="workflowSelectVisible"
      title="选择审批流程"
      width="640px"
      confirm-text="关闭"
      :show-cancel="false"
      @confirm="workflowSelectVisible = false"
      @cancel="workflowSelectVisible = false"
    >
      <div class="approval-picker">
        <el-input
          v-model="workflowKeyword"
          placeholder="搜索流程名称或分组"
          clearable
        >
          <template #prefix>
            <AppIcon icon="ep:search" :size="14" />
          </template>
        </el-input>

        <div class="approval-picker__list">
          <button
            v-for="workflow in filteredWorkflows"
            :key="workflow.id"
            type="button"
            class="approval-picker__item"
            @click="chooseWorkflow(workflow)"
          >
            <span class="approval-picker__icon">
              <AppIcon icon="ep:document" :size="16" />
            </span>
            <span class="approval-picker__name">{{ workflow.name }}</span>
            <span v-if="workflow.groupName" class="approval-picker__group">
              {{ workflow.groupName }}
            </span>
            <AppIcon icon="ep:arrow-right" :size="13" color="var(--app-text-4)" />
          </button>

          <AppEmpty
            v-if="filteredWorkflows.length === 0"
            description="暂无可发起的流程"
            :image-size="80"
          />
        </div>
      </div>
    </AppFormDialog>

    <!-- 详情 -->
    <ApprovalDetail
      v-model="detailVisible"
      :detail="currentDetail"
      :form-config="currentFormConfig"
      :permission="currentPermission"
      :loading="detailLoading"
      @approve="handleApprove"
      @cancel="handleCancel"
      @reinitiate="handleReinitiate"
      @refresh="handleRefreshDetail"
    />

    <!-- 发起审批 -->
    <WorkflowLaunchDialog
      ref="launchDialogRef"
      v-model="launchVisible"
      :workflow="selectedWorkflow"
      :form-config="launchFormConfig"
      @submit="handleLaunchSubmit"
      @submitted="loadList(activeTab)"
    />

    <!-- 快捷审批 -->
    <AppFormDialog
      v-model="quickVisible"
      :title="quickForm.result === 'approve' ? '同意审批' : '拒绝审批'"
      :loading="quickSubmitting"
      width="560px"
      @confirm="submitQuickApprove"
    >
      <el-form label-width="88px">
        <el-form-item label="审批意见">
          <el-input
            v-model="quickForm.comment"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            :placeholder="
              quickForm.result === 'approve'
                ? '请输入审批意见（选填）'
                : '请输入拒绝原因（必填）'
            "
          />
        </el-form-item>
        <el-form-item label="附件">
          <AttachmentUpload v-model="quickForm.attachments" :limit="5" />
        </el-form-item>
      </el-form>
    </AppFormDialog>
  </AppPage>
</template>

<style scoped lang="scss">
.approval-center {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__tabs {
    padding: 0 16px;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);

    :deep(.el-tabs__header) {
      margin-bottom: 0;
    }

    :deep(.el-tabs__nav-wrap::after) {
      display: none;
    }
  }

  &__tab {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  &__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }

  &__search {
    width: 240px;
  }

  &__select {
    width: 140px;
  }
}

/* ============ 收件箱：列表 + 预览 ============ */
.approval-inbox {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  gap: 16px;
  align-items: start;

  &__list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: calc(100vh - 300px);
    padding: 8px;
    overflow: auto;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__group-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px 4px;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__group-count {
    margin-left: 6px;
    color: var(--app-text-4);
  }

  &__pager {
    display: flex;
    justify-content: center;
    padding: 10px 0 4px;
  }
}

.approval-card {
  position: relative;
  display: flex;
  width: 100%;
  padding: 10px 12px 10px 16px;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--app-radius-sm);
  transition:
    background-color var(--app-duration-fast) var(--app-ease),
    border-color var(--app-duration-fast) var(--app-ease);

  &:hover {
    background: var(--app-subtle);
  }

  &.is-active {
    background: var(--app-primary-bg);
    border-color: var(--app-primary-border);
  }

  &__rail {
    position: absolute;
    top: 14px;
    bottom: 14px;
    left: 6px;
    width: 3px;
    background: var(--app-text-4);
    border-radius: 2px;

    &.is-success {
      background: var(--app-success);
    }

    &.is-warning {
      background: var(--app-warning);
    }

    &.is-danger {
      background: var(--app-danger);
    }

    &.is-primary {
      background: var(--app-primary);
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    min-width: 0;
  }

  &__head {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  &__title-wrap {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__title {
    overflow: hidden;
    font-size: var(--app-font-14);
    font-weight: 500;
    color: var(--app-text-1);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    overflow: hidden;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-left: 40px;
  }

  &__node {
    display: flex;
    gap: 6px;
    align-items: center;
    padding-left: 40px;
    font-size: var(--app-font-12);
    color: var(--app-text-2);
  }

  &__node-dot {
    width: 6px;
    height: 6px;
    background: var(--app-primary);
    border-radius: 50%;
  }

  &__node-name {
    font-weight: 500;
    color: var(--app-primary);
  }

  &__node-people {
    color: var(--app-text-3);
  }
}

.approval-chip {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 1px 8px;
  font-size: var(--app-font-12);
  color: var(--app-text-2);
  background: var(--app-subtle);
  border-radius: 999px;

  &.is-amount {
    font-weight: 500;
    color: var(--app-warning);
    background: var(--app-warning-bg);
  }

  &.is-progress {
    color: var(--app-primary);
    background: var(--app-primary-bg);
  }
}

.approval-preview {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 560px;
  padding: 20px;
  background: var(--app-container);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);

  &__head {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__title-row {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    font-size: var(--app-font-16);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__meta {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    padding: 12px 16px;
    background: var(--app-subtle);
    border-radius: var(--app-radius-sm);
  }

  &__stat {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .label {
      font-size: var(--app-font-12);
      color: var(--app-text-3);
    }

    .value {
      font-size: var(--app-font-13);
      color: var(--app-text-1);
    }

    .value.is-strong {
      font-weight: 600;
      color: var(--app-warning);
    }
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__section-title {
    font-size: var(--app-font-13);
    font-weight: 600;
    color: var(--app-text-2);
  }

  &__fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 20px;
  }

  &__field {
    display: flex;
    gap: 8px;
    align-items: baseline;
    min-width: 0;
    font-size: var(--app-font-13);
  }

  &__field-label {
    flex-shrink: 0;
    width: 84px;
    color: var(--app-text-3);
  }

  &__field-value {
    flex: 1;
    min-width: 0;
    color: var(--app-text-1);
  }

  &__files {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__file {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding: 6px 10px;
    font-size: var(--app-font-12);
    color: var(--app-text-2);
    text-decoration: none;
    background: var(--app-subtle);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
    cursor: pointer;
    transition:
      color var(--app-duration-fast),
      border-color var(--app-duration-fast);

    &:hover {
      color: var(--app-primary);
      border-color: var(--app-primary-border);
    }
  }

  /* 预览与下载分离：默认在应用内离线预览，下载仍是直链 */
  &__file-dl {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    color: var(--app-text-4);

    &:hover {
      color: var(--app-primary);
    }
  }

  &__timeline {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  &__node {
    position: relative;
    display: flex;
    gap: 12px;

    &::before {
      position: absolute;
      top: 18px;
      bottom: -14px;
      left: 8px;
      width: 1px;
      content: "";
      background: var(--app-border);
    }

    &:last-child::before {
      display: none;
    }

    &-dot {
      position: relative;
      z-index: 1;
      flex-shrink: 0;
      width: 9px;
      height: 9px;
      margin-top: 5px;
      background: var(--app-text-4);
      border-radius: 50%;
    }

    &.is-completed &-dot {
      background: var(--app-success);
    }

    &.is-in_progress &-dot {
      background: var(--app-primary);
      box-shadow: 0 0 0 3px var(--app-primary-bg);
    }

    &.is-pending &-dot {
      background: var(--app-warning);
    }

    &.is-rejected &-dot {
      background: var(--app-danger);
    }

    &-body {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    &-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    &-name {
      font-size: var(--app-font-13);
      font-weight: 500;
      color: var(--app-text-1);
    }

    &-badge {
      padding: 0 6px;
      font-size: var(--app-font-12);
      color: var(--app-text-3);
      background: var(--app-subtle);
      border-radius: 4px;

      &.is-approve {
        color: var(--app-primary);
        background: var(--app-primary-bg);
      }
    }

    &-time {
      margin-left: auto;
      font-size: var(--app-font-12);
      color: var(--app-text-4);
    }

    &-people {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
  }

  &__person {
    padding: 1px 8px;
    font-size: var(--app-font-12);
    color: var(--app-text-2);
    background: var(--app-subtle);
    border-radius: 999px;

    &.is-approved {
      color: var(--app-success);
      background: var(--app-success-bg);
    }

    &.is-rejected {
      color: var(--app-danger);
      background: var(--app-danger-bg);
    }

    &.is-pending {
      color: var(--app-warning);
      background: var(--app-warning-bg);
    }

    &.is-cc {
      color: var(--app-text-3);
      background: transparent;
      border: 1px dashed var(--app-border);
    }
  }

  &__actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 14px;
    margin-top: auto;
    border-top: 1px solid var(--app-border);
  }

  &__empty {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    justify-content: center;
    color: var(--app-text-3);
  }
}

@media (width <= 1200px) {
  .approval-inbox {
    grid-template-columns: minmax(0, 1fr);
  }

  .approval-preview {
    position: static;
  }
}

.approval-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 420px;
    overflow: hidden auto;
  }

  &__item {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    padding: 12px;
    text-align: left;
    cursor: pointer;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
    transition:
      border-color var(--app-duration-fast) var(--app-ease),
      background-color var(--app-duration-fast) var(--app-ease);

    &:hover {
      background: var(--app-subtle);
      border-color: var(--app-primary-border);
    }
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    color: var(--app-primary);
    background: var(--app-primary-bg);
    border-radius: var(--app-radius-sm);
  }

  &__name {
    flex: 1;
    font-size: var(--app-font-14);
    color: var(--app-text-1);
  }

  &__group {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }
}

@media (width <= 900px) {
  .approval-item {
    flex-direction: column;
    align-items: stretch;

    &__summary {
      padding-left: 0;
    }

    &__actions {
      justify-content: flex-end;
    }
  }
}
</style>
