<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import dayjs from "dayjs";
import type { FormInstance, FormRules } from "element-plus";
import ApprovalTimeline from "./ApprovalTimeline.vue";
import ApprovalComments from "./ApprovalComments.vue";
import FormFieldDisplay from "./FormFieldDisplay.vue";
import WorkflowFormRenderer from "./WorkflowFormRenderer.vue";
import AttachmentUpload, { type AttachmentInfo } from "./AttachmentUpload.vue";
import UserSelectDialog from "./UserSelectDialog.vue";
import { message } from "@/utils/message";
import {
  readCcMessage,
  addSignTask,
  returnTask,
  resubmitInstance
} from "@/api/workflow";
import { formatApprovalNo } from "@/utils/workflow";

/**
 * 审批详情抽屉
 * 左：申请信息 + 评论；右：流程进度
 * 操作：同意 / 拒绝 / 撤销 / 重新发起 / 打印
 */
interface Props {
  modelValue: boolean;
  detail?: any;
  formConfig?: any;
  permission?: any;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  detail: () => ({}),
  formConfig: null,
  permission: null,
  loading: false
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "approve", data: any): void;
  (e: "cancel", data: any): void;
  (e: "reinitiate", data: any): void;
  (e: "refresh"): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: value => emit("update:modelValue", value)
});

/* ============ 状态与权限 ============ */
import { TASK_STATUS, WORKFLOW_STATUS, dictText } from "@/utils/dicts";

const statusMeta = computed(
  () =>
    WORKFLOW_STATUS[props.detail?.status] ?? {
      text: "未知状态",
      type: "info",
      icon: "ep:timer"
    }
);

const canApprove = computed(() => props.permission?.canApprove === true);
const canCancel = computed(() => props.permission?.canCancel === true);
const canReinitiate = computed(() => {
  // 仅已驳回/已撤销的流程允许重新发起
  const status = props.detail?.status;
  if (!["rejected", "cancelled"].includes(status)) return false;
  if (props.permission?.canReinitiate !== undefined) {
    return props.permission.canReinitiate;
  }
  return Boolean(
    props.permission?.isInitiator ||
      props.permission?.isApprover ||
      props.permission?.isCcRecipient
  );
});

/* ============ 表单字段 ============ */
const fields = computed<any[]>(() => props.formConfig?.fields ?? []);

/**
 * 本节点可见字段
 *
 * 后端没下发权限清单时全部可见（存量流程行为不变）；
 * 下发了清单时，被标为不可见的字段连标签都不占位——
 * “隐藏”如果只做到不渲染值，标题还在那儿，依旧会泄露“有这个字段”。
 */
const visibleFields = computed(() => {
  const permissions: any[] = props.permission?.fieldPermissions ?? [];
  if (!permissions.length) return fields.value;
  const defaultVisible = props.permission?.defaultFieldVisible !== false;
  return fields.value.filter(field => {
    const hit = permissions.find(item => item.field === field.name);
    return hit ? hit.visible !== false : defaultVisible;
  });
});

/** 本节点可改字段：必须同时可见与可改 */
const editableFields = computed(() => {
  const permissions: any[] = props.permission?.fieldPermissions ?? [];
  if (!permissions.length) return [];
  const defaultEditable = props.permission?.defaultFieldEditable === true;
  return visibleFields.value.filter(field => {
    const hit = permissions.find(item => item.field === field.name);
    return hit ? hit.editable === true : defaultEditable;
  });
});

const canEditForm = computed(
  () => canApprove.value && props.permission?.canEditForm === true && editableFields.value.length > 0
);

/** 本节点标了必填的字段名（后端在同意时会再校一道，这里只用于文案提示） */
const requiredFieldNames = computed(() => {
  const permissions: any[] = props.permission?.fieldPermissions ?? [];
  return permissions.filter(item => item.required).map(item => item.field);
});

/** 必填字段的中文标签，直接告诉审批人要填哪几项，不让人提交时才看到报错 */
const requiredFieldLabels = computed(() =>
  requiredFieldNames.value.map(
    name => fields.value.find(field => field.name === name)?.label ?? name
  )
);

/** 审批人可改字段的草稿值 */
const formDraft = reactive<Record<string, any>>({});

function resetFormDraft() {
  Object.keys(formDraft).forEach(key => delete formDraft[key]);
  if (!canEditForm.value) return;
  editableFields.value.forEach(field => {
    formDraft[field.name] = props.detail?.formData?.[field.name];
  });
}

watch(() => [props.detail?.id, canEditForm.value], resetFormDraft, { immediate: true });

/** 只提交真正改过的字段，避免把整个表单重写一遍 */
const formDataPatch = computed(() => {
  if (!canEditForm.value) return undefined;
  const patch: Record<string, any> = {};
  Object.keys(formDraft).forEach(key => {
    const before = props.detail?.formData?.[key];
    if (JSON.stringify(formDraft[key]) !== JSON.stringify(before)) {
      patch[key] = formDraft[key];
    }
  });
  return Object.keys(patch).length ? patch : undefined;
});

const hasFormChanges = computed(() => Boolean(formDataPatch.value));

const fullSpanTypes = [
  "el-textarea",
  "el-upload",
  "el-image-upload",
  // 附件卡片里有不换行的文件名，占半列会把标签列挤成一字一行；整行展示
  "el-file-upload",
  "el-table"
];
const fieldSpan = (field: any) =>
  fullSpanTypes.includes(field.type) ? 2 : 1;

const formatTime = (value: any) => {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD HH:mm") : String(value);
};

/* ============ 同意 / 拒绝 ============ */
const approveVisible = ref(false);
const approveSubmitting = ref(false);
const approveFormRef = ref<FormInstance>();
const approveForm = reactive({
  result: "approve" as "approve" | "reject",
  comment: "",
  attachments: [] as AttachmentInfo[]
});

const approveRules = computed<FormRules>(() => ({
  comment: [
    {
      validator: (_rule, value, callback) => {
        if (approveForm.result === "reject" && !value) {
          callback(new Error("拒绝时必须填写原因"));
        } else if (value && value.length > 500) {
          callback(new Error("审批意见不能超过 500 字"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
}));

function openApprove(result: "approve" | "reject") {
  approveForm.result = result;
  approveForm.comment = "";
  approveForm.attachments = [];
  approveVisible.value = true;
}

async function submitApprove() {
  const formEl = approveFormRef.value;
  if (!formEl) return;

  await formEl.validate(valid => {
    if (!valid) return;
    approveSubmitting.value = true;
    emit("approve", {
      result: approveForm.result,
      comment: approveForm.comment,
      fileIds: approveForm.attachments.map(file => file.id),
      formDataPatch: approveForm.result === "approve" ? formDataPatch.value : undefined
    });
    approveSubmitting.value = false;
    approveVisible.value = false;
  });
}

/* ============ 撤销 ============ */
const cancelVisible = ref(false);
const cancelSubmitting = ref(false);
const cancelForm = reactive({ reason: "" });

function submitCancel() {
  cancelSubmitting.value = true;
  emit("cancel", {
    instanceId: props.detail?.id,
    reason: cancelForm.reason
  });
  cancelSubmitting.value = false;
  cancelVisible.value = false;
}

/* ============ 重新发起 ============ */
const reinitiateVisible = ref(false);
const reinitiateSubmitting = ref(false);
const reinitiateForm = reactive<Record<string, any>>({});
const reinitiateRendererRef = ref();

function openReinitiate() {
  Object.keys(reinitiateForm).forEach(key => delete reinitiateForm[key]);
  Object.assign(reinitiateForm, props.detail?.formData ?? {});
  reinitiateVisible.value = true;
}

async function submitReinitiate() {
  // 必填项校验：未填时阻断提交
  const valid = (await reinitiateRendererRef.value?.validate?.()) ?? true;
  if (!valid) {
    message("请先完善必填项", { type: "warning" });
    return;
  }

  reinitiateSubmitting.value = true;
  emit("reinitiate", {
    definitionId: props.detail?.definitionId,
    instanceTitle:
      props.detail?.instanceTitle || props.detail?.definitionName,
    formData: { ...reinitiateForm },
    formDesignId: props.detail?.formDesignId
  });
  reinitiateSubmitting.value = false;
  reinitiateVisible.value = false;
}

/* ============ 加签 / 退回 ============ */
const pendingTaskId = computed(() => props.permission?.pendingTaskId || "");
const hasPendingTask = computed(
  () => Boolean(pendingTaskId.value) && props.detail?.status === "running"
);
const pendingApproveType = computed(
  () => props.permission?.pendingApproveType || ""
);
// 任意一人审批节点加签没有语义（一人通过即完成），后端也会拒绝；这里用禁用态说明原因
const addSignDisabled = computed(
  () => pendingApproveType.value === "ANY_SIGN"
);

const addSignVisible = ref(false);
const addSignSubmitting = ref(false);
const addSignForm = reactive({
  signType: "before" as "before" | "after",
  comment: ""
});
const signerUsers = ref<any[]>([]);
const userSelectVisible = ref(false);

const signerNames = computed(() =>
  signerUsers.value.map(user => user.employeeName ?? user.name ?? "").join("、")
);

function openAddSign() {
  addSignForm.signType = "before";
  addSignForm.comment = "";
  signerUsers.value = [];
  addSignVisible.value = true;
}

function onSignersSelected(users: any[]) {
  signerUsers.value = users;
}

async function submitAddSign() {
  if (!pendingTaskId.value) {
    message("当前没有待办任务", { type: "warning" });
    return;
  }
  if (!signerUsers.value.length) {
    message("请选择加签人", { type: "warning" });
    return;
  }

  addSignSubmitting.value = true;
  try {
    const res: any = await addSignTask(pendingTaskId.value, {
      signType: addSignForm.signType,
      addSignerIds: signerUsers.value.map(user => String(user.id)),
      comment: addSignForm.comment
    });
    message(res?.message || "加签成功", { type: "success" });
    addSignVisible.value = false;
    emit("refresh");
  } catch (error) {
    // 业务错误已由请求拦截器统一提示，这里不重复弹提示
    console.error("加签失败:", error);
  } finally {
    addSignSubmitting.value = false;
  }
}

const returnVisible = ref(false);
const returnSubmitting = ref(false);
const returnForm = reactive({
  returnType: "initiator" as "initiator" | "previous" | "specified",
  returnTo: "",
  comment: ""
});

// 只能退回到已完成审批的节点；是否早于当前节点由后端再校验，不信任前端
const returnNodeOptions = computed(() =>
  (props.detail?.processTimeline ?? [])
    .filter(
      (node: any) =>
        node.nodeType === "approve" && node.nodeStatus === "completed"
    )
    .map((node: any) => ({ label: node.nodeName, value: node.nodeId }))
);

function openReturn() {
  returnForm.returnType = returnNodeOptions.value.length
    ? "previous"
    : "initiator";
  returnForm.returnTo = "";
  returnForm.comment = "";
  returnVisible.value = true;
}

async function submitReturn() {
  if (!pendingTaskId.value) {
    message("当前没有待办任务", { type: "warning" });
    return;
  }
  if (!returnForm.comment.trim()) {
    message("请填写退回原因", { type: "warning" });
    return;
  }
  if (returnForm.returnType === "specified" && !returnForm.returnTo) {
    message("请选择要退回到的节点", { type: "warning" });
    return;
  }

  returnSubmitting.value = true;
  try {
    const res: any = await returnTask(pendingTaskId.value, {
      returnType: returnForm.returnType,
      returnTo:
        returnForm.returnType === "specified"
          ? returnForm.returnTo
          : undefined,
      comment: returnForm.comment
    });
    message(res?.message || "已退回", { type: "success" });
    returnVisible.value = false;
    emit("refresh");
  } catch (error) {
    console.error("退回失败:", error);
  } finally {
    returnSubmitting.value = false;
  }
}

/* ============ 退回后重新提交（沿用同一实例） ============ */
const canResubmit = computed(
  () =>
    props.detail?.status === "returned" &&
    props.permission?.isInitiator === true
);
const resubmitVisible = ref(false);
const resubmitSubmitting = ref(false);
const resubmitForm = reactive<Record<string, any>>({});
const resubmitRendererRef = ref();

function openResubmit() {
  Object.keys(resubmitForm).forEach(key => delete resubmitForm[key]);
  Object.assign(resubmitForm, props.detail?.formData ?? {});
  resubmitVisible.value = true;
}

async function submitResubmit() {
  const valid = (await resubmitRendererRef.value?.validate?.()) ?? true;
  if (!valid) {
    message("请先完善必填项", { type: "warning" });
    return;
  }

  resubmitSubmitting.value = true;
  try {
    const res: any = await resubmitInstance(props.detail.id, {
      ...resubmitForm
    });
    message(res?.message || "已重新提交", { type: "success" });
    resubmitVisible.value = false;
    emit("refresh");
  } catch (error) {
    console.error("重新提交失败:", error);
  } finally {
    resubmitSubmitting.value = false;
  }
}

/* ============ 打印 ============ */
const plainValue = (field: any): string => {
  const raw = props.detail?.formData?.[field.name];
  if (raw === null || raw === undefined || raw === "") return "-";

  const fieldProps =
    typeof field.props === "string"
      ? (() => {
          try {
            return JSON.parse(field.props);
          } catch {
            return {};
          }
        })()
      : field.props ?? {};

  if (["el-select", "el-radio-group"].includes(field.type)) {
    const option = (fieldProps.options ?? []).find(
      (item: any) => item.value === raw
    );
    return option?.label ?? String(raw);
  }
  if (field.type === "el-checkbox-group" && Array.isArray(raw)) {
    return raw
      .map(
        value =>
          (fieldProps.options ?? []).find((item: any) => item.value === value)
            ?.label ?? value
      )
      .join("、");
  }
  if (field.type === "el-date-picker") {
    const date = dayjs(Array.isArray(raw) ? raw[0] : raw);
    return date.isValid() ? date.format("YYYY-MM-DD HH:mm") : String(raw);
  }
  if (["el-upload", "el-image-upload", "el-file-upload"].includes(field.type)) {
    return Array.isArray(raw)
      ? raw.map((file: any) => file.name || file.fileName).join("、")
      : "-";
  }
  if (field.type === "el-input-number") {
    return `${Number(raw).toLocaleString()}${fieldProps.unit ?? ""}`;
  }
  return String(raw);
};

function handlePrint() {
  const printWindow = window.open("", "_blank", "width=900,height=720");
  if (!printWindow) return;

  const rows = fields.value
    .map(
      field =>
        `<tr><th>${field.label ?? ""}</th><td>${plainValue(field)}</td></tr>`
    )
    .join("");

  const timeline = (props.detail?.processTimeline ?? [])
    .filter((node: any) => node.nodeType === "approve")
    .map((node: any) => {
      const assignees = (node.assignees ?? [])
        .map(
          (assignee: any) =>
            `${assignee.name ?? ""}（${dictText(TASK_STATUS, assignee.status, "待处理")}）${
              assignee.comment ? `：${assignee.comment}` : ""
            }`
        )
        .join("<br/>");
      return `<div class="node"><strong>${node.nodeName ?? ""}</strong><div>${assignees}</div></div>`;
    })
    .join("");

  printWindow.document.write(`
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>${props.detail?.instanceTitle ?? "审批单"}</title>
        <style>
          body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; padding: 32px; color: #1d2129; }
          h1 { font-size: 20px; text-align: center; margin-bottom: 8px; }
          .meta { text-align: center; font-size: 12px; color: #4e5969; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { border: 1px solid #e5e6eb; padding: 8px 12px; text-align: left; vertical-align: top; }
          th { width: 160px; background: #f7f8fa; font-weight: 500; color: #4e5969; }
          h2 { font-size: 14px; margin: 24px 0 12px; }
          .node { padding: 8px 0; border-bottom: 1px dashed #e5e6eb; font-size: 13px; }
        </style>
      </head>
      <body>
        <h1>${props.detail?.instanceTitle ?? props.detail?.definitionName ?? "审批单"}</h1>
        <div class="meta">
          审批编号：${formatApprovalNo(props.detail?.id, props.detail?.createdAt)}
          &nbsp;&nbsp;|&nbsp;&nbsp; 申请人：${props.detail?.initiatorName ?? "-"}
          &nbsp;&nbsp;|&nbsp;&nbsp; 申请时间：${formatTime(props.detail?.createdAt)}
        </div>
        <table>${rows || "<tr><td>无表单数据</td></tr>"}</table>
        ${timeline ? `<h2>审批记录</h2>${timeline}` : ""}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

/* ============ 抄送已读 ============ */
watch(
  () => props.permission,
  permission => {
    if (
      permission?.canReadCc &&
      !props.detail?.isRead &&
      permission?.noReadCcTaskId
    ) {
      readCcMessage({ ccId: permission.noReadCcTaskId }).catch(() => undefined);
    }
  },
  { immediate: true, deep: true }
);
</script>

<template>
  <el-drawer
    v-model="visible"
    size="1180px"
    :show-close="false"
    destroy-on-close
    class="app-approval-drawer"
  >
    <template #header>
      <div class="app-approval__header">
        <div class="app-approval__heading">
          <h2 class="app-approval__title">
            {{ detail.instanceTitle || detail.definitionName || "审批详情" }}
          </h2>
          <div class="app-approval__sub">
            <span>发起部门：{{ detail.initiatorDeptName || "-" }}</span>
            <span class="app-approval__no">
              审批编号：{{ formatApprovalNo(detail.id, detail.createdAt) }}
            </span>
          </div>
        </div>

        <div class="app-approval__actions">
          <el-tag :type="statusMeta.type" effect="light" size="large">
            <AppIcon :icon="statusMeta.icon" :size="13" />
            {{ statusMeta.text }}
          </el-tag>

          <el-button
            v-if="canApprove"
            type="success"
            plain
            @click="openApprove('approve')"
          >
            <AppIcon icon="ep:check" :size="14" />
            同意
          </el-button>
          <el-button
            v-if="canApprove"
            type="danger"
            plain
            @click="openApprove('reject')"
          >
            <AppIcon icon="ep:close" :size="14" />
            拒绝
          </el-button>
          <el-button
            v-if="hasPendingTask"
            :disabled="addSignDisabled"
            :title="
              addSignDisabled
                ? '任意一人审批节点不支持加签（一人通过即完成），请改用转派'
                : '邀请他人在您之前/之后签署'
            "
            @click="openAddSign"
          >
            加签
          </el-button>
          <el-button v-if="hasPendingTask" plain @click="openReturn">
            退回
          </el-button>
          <el-button
            v-if="canCancel"
            type="warning"
            plain
            @click="cancelVisible = true"
          >
            撤销流程
          </el-button>
          <el-button
            v-if="canResubmit"
            type="primary"
            @click="openResubmit"
          >
            重新提交
          </el-button>
          <el-button v-if="canReinitiate" type="primary" plain @click="openReinitiate">
            重新发起
          </el-button>
          <el-button @click="handlePrint">
            <AppIcon icon="ep:printer" :size="14" />
            打印
          </el-button>
          <el-button text @click="visible = false">
            <AppIcon icon="ep:close" :size="14" />
            关闭
          </el-button>
        </div>
      </div>
    </template>

    <div v-loading="loading" class="app-approval">
      <!-- 左侧：申请信息 + 评论 -->
      <section class="app-approval__main">
        <el-alert
          v-if="detail.status === 'returned'"
          type="warning"
          :closable="false"
          show-icon
        >
          <template #title>
            该申请已被退回发起人{{
              canResubmit ? "，请修改后重新提交" : "，等待发起人修改后重新提交"
            }}
          </template>
        </el-alert>

        <AppDetailSection title="申请信息">
          <!-- table-layout 必须固定：auto 布局下附件卡片里 nowrap 的文件名会把
               申请信息表撑成“标签列一字一行、值列也被挤压”的惨状 -->
          <el-descriptions :column="2" border label-width="96px">
            <el-descriptions-item label="申请人">
              <div class="app-approval__person">
                <AppUserAvatar
                  :name="detail.initiatorName"
                  :avatar="detail.initiatorAvatar"
                  :size="24"
                />
                <span>{{ detail.initiatorName || "-" }}</span>
              </div>
            </el-descriptions-item>
            <el-descriptions-item label="申请时间">
              {{ formatTime(detail.createdAt) }}
            </el-descriptions-item>

            <el-descriptions-item
              v-for="field in visibleFields"
              :key="field.name"
              :label="field.label"
              :span="fieldSpan(field)"
            >
              <FormFieldDisplay
                :field="field"
                :value="detail.formData?.[field.name]"
              />
            </el-descriptions-item>
          </el-descriptions>

          <!-- 本节点可改字段：单独一块，不让审批人在只读表单里找哪个能改 -->
          <div v-if="canEditForm" class="app-approval__edit">
            <div class="app-approval__edit-head">
              <AppIcon icon="ep:edit" :size="14" />
              <span>本节点可修改 {{ editableFields.length }} 项</span>
              <em v-if="hasFormChanges" class="app-approval__edit-flag">
                已修改，同意时一并保存
              </em>
              <em v-else class="app-approval__edit-muted">未修改则不提交</em>
            </div>
            <p class="app-approval__edit-tip">
              <template v-if="requiredFieldLabels.length">
                本节点必填：{{ requiredFieldLabels.join("、") }}；
              </template>
              修改内容会记入审批历史。
            </p>
            <WorkflowFormRenderer
              v-model="formDraft"
              :fields="editableFields"
              label-width="96px"
            />
          </div>
        </AppDetailSection>

        <AppDetailSection title="评论记录">
          <!-- 详情首帧尚未加载完成时不挂载，避免子组件收到 undefined 的必填 props -->
          <ApprovalComments
            v-if="detail.id"
            :instance-id="detail.id"
            :history="detail.history"
            @success="$emit('refresh')"
          />
        </AppDetailSection>
      </section>

      <!-- 右侧：流程进度 -->
      <aside class="app-approval__aside">
        <AppDetailSection title="流程进度">
          <ApprovalTimeline
            :nodes="detail.processTimeline ?? []"
            :history="detail.history ?? []"
            :initiator-name="detail.initiatorName"
            :initiator-avatar="detail.initiatorAvatar"
            :initiator-dept-name="detail.initiatorDeptName"
            :created-at="detail.createdAt"
          />
        </AppDetailSection>
      </aside>
    </div>
  </el-drawer>

  <!-- 同意 / 拒绝 -->
  <AppFormDialog
    v-model="approveVisible"
    :title="approveForm.result === 'approve' ? '同意审批' : '拒绝审批'"
    :loading="approveSubmitting"
    width="560px"
    @confirm="submitApprove"
  >
    <el-form
      ref="approveFormRef"
      :model="approveForm"
      :rules="approveRules"
      label-width="88px"
    >
      <el-form-item label="审批意见" prop="comment">
        <el-input
          v-model="approveForm.comment"
          type="textarea"
          :rows="4"
          maxlength="500"
          show-word-limit
          :placeholder="
            approveForm.result === 'approve'
              ? '请输入审批意见（选填）'
              : '请输入拒绝原因（必填）'
          "
        />
      </el-form-item>
      <el-form-item label="附件">
        <AttachmentUpload v-model="approveForm.attachments" :limit="5" />
      </el-form-item>
    </el-form>
  </AppFormDialog>

  <!-- 撤销 -->
  <AppFormDialog
    v-model="cancelVisible"
    title="撤销流程"
    :loading="cancelSubmitting"
    width="480px"
    @confirm="submitCancel"
  >
    <el-form label-width="80px">
      <el-form-item label="撤销原因">
        <el-input
          v-model="cancelForm.reason"
          type="textarea"
          :rows="3"
          maxlength="200"
          show-word-limit
          placeholder="请说明撤销原因（选填）"
        />
      </el-form-item>
    </el-form>
  </AppFormDialog>

  <!-- 重新发起 -->
  <AppFormDialog
    v-model="reinitiateVisible"
    title="重新发起审批"
    :loading="reinitiateSubmitting"
    width="720px"
    confirm-text="提交"
    @confirm="submitReinitiate"
  >
    <WorkflowFormRenderer
      ref="reinitiateRendererRef"
      :fields="fields"
      :model-value="reinitiateForm"
      @update:model-value="value => Object.assign(reinitiateForm, value)"
    />
  </AppFormDialog>

  <!-- 加签 -->
  <AppFormDialog
    v-model="addSignVisible"
    title="加签"
    :loading="addSignSubmitting"
    width="520px"
    confirm-text="确认加签"
    @confirm="submitAddSign"
  >
    <el-form label-width="88px">
      <el-form-item label="加签方式">
        <el-radio-group v-model="addSignForm.signType">
          <el-radio value="before">前加签（先由加签人审）</el-radio>
          <el-radio value="after">后加签（您审完再由加签人审）</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="加签人" required>
        <div class="app-approval__picker">
          <span v-if="signerNames" class="app-approval__picker-value">
            {{ signerNames }}
          </span>
          <span v-else class="app-approval__picker-empty">请选择加签人</span>
          <el-button link type="primary" @click="userSelectVisible = true">
            选择
          </el-button>
        </div>
      </el-form-item>
      <el-form-item label="加签说明">
        <el-input
          v-model="addSignForm.comment"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          placeholder="请说明加签原因（选填）"
        />
      </el-form-item>
    </el-form>
  </AppFormDialog>

  <!-- 退回 -->
  <AppFormDialog
    v-model="returnVisible"
    title="退回"
    :loading="returnSubmitting"
    width="520px"
    confirm-text="确认退回"
    @confirm="submitReturn"
  >
    <el-form label-width="88px">
      <el-form-item label="退回到">
        <el-radio-group v-model="returnForm.returnType">
          <el-radio value="initiator">发起人</el-radio>
          <el-radio
            value="previous"
            :disabled="!returnNodeOptions.length"
          >
            上一步
          </el-radio>
          <el-radio
            value="specified"
            :disabled="!returnNodeOptions.length"
          >
            指定节点
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item
        v-if="returnForm.returnType === 'specified'"
        label="目标节点"
        required
      >
        <el-select
          v-model="returnForm.returnTo"
          placeholder="请选择节点"
          style="width: 100%"
        >
          <el-option
            v-for="node in returnNodeOptions"
            :key="node.value"
            :label="node.label"
            :value="node.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="退回原因" required>
        <el-input
          v-model="returnForm.comment"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          placeholder="请说明退回原因"
        />
      </el-form-item>
    </el-form>
  </AppFormDialog>

  <!-- 退回后重新提交：沿用同一实例，表单预填后可修改 -->
  <AppFormDialog
    v-model="resubmitVisible"
    title="修改后重新提交"
    :loading="resubmitSubmitting"
    width="720px"
    confirm-text="重新提交"
    @confirm="submitResubmit"
  >
    <WorkflowFormRenderer
      ref="resubmitRendererRef"
      :fields="fields"
      :model-value="resubmitForm"
      @update:model-value="value => Object.assign(resubmitForm, value)"
    />
  </AppFormDialog>

  <UserSelectDialog
    v-model="userSelectVisible"
    title="选择加签人"
    multiple
    :selected-ids="signerUsers.map(user => String(user.id))"
    @confirm="onSignersSelected"
  />
</template>

<style scoped lang="scss">
.app-approval {
  display: flex;
  gap: 16px;
  align-items: flex-start;

  // el-descriptions 默认是 auto 表格布局：只要某个值单元格里有不换行的长内容
  // （附件文件名、长英文单词），浏览器就会把它撑宽、把标签列/其他值列压到
  // min-content（一字一行）。固定列宽 + 允许内容换行才能真正稳住排版。
  :deep(.el-descriptions__table) {
    table-layout: fixed;
  }

  :deep(.el-descriptions__content) {
    min-width: 0;
    word-break: break-word;
    white-space: normal;
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }

  &__aside {
    flex: 0 0 380px;
    padding: 16px;
    background: var(--app-subtle);
    border-radius: var(--app-radius-md);
  }

  /* 加签人选择：只读展示 + 弹窗选人 */
  &__picker {
    display: flex;
    flex: 1;
    gap: 8px;
    align-items: center;
    width: 100%;
    min-width: 0;
  }

  &__picker-value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--app-text-1);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__picker-empty {
    flex: 1;
    color: var(--app-text-4);
  }

  &__header {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  &__title {
    font-size: var(--app-font-16);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__sub {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 4px;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__no {
    padding-left: 12px;
    border-left: 1px solid var(--app-border);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  &__person {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  /* 本节点可改字段区：与上方只读表单明确分开 */
  &__edit {
    margin-top: 12px;
    padding: 10px 12px;
    background: var(--app-fill-light, #f7f8fa);
    border: 1px solid var(--app-border);
    border-left: 3px solid var(--app-primary);
    border-radius: var(--app-radius-sm);
  }

  &__edit-head {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: var(--app-font-13);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__edit-flag {
    padding: 0 6px;
    font-size: var(--app-font-12);
    font-style: normal;
    color: var(--app-primary);
    background: var(--app-primary-bg);
    border-radius: 8px;
  }

  &__edit-muted {
    font-size: var(--app-font-12);
    font-style: normal;
    color: var(--app-text-3);
  }

  &__edit-tip {
    margin: 4px 0 10px;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }
}

@media (width <= 1280px) {
  .app-approval {
    flex-direction: column;

    &__aside {
      flex-basis: auto;
      width: 100%;
    }
  }
}
</style>

<style lang="scss">
.app-approval-drawer {
  .el-drawer__header {
    align-items: center;
    padding: 12px 20px;
  }

  .el-drawer__body {
    padding: 16px 20px;
    background: var(--app-page-bg);
  }
}
</style>
