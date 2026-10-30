<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import dayjs from "dayjs";
import type { FormInstance, FormRules } from "element-plus";
import ApprovalTimeline from "./ApprovalTimeline.vue";
import ApprovalComments from "./ApprovalComments.vue";
import FormFieldDisplay from "./FormFieldDisplay.vue";
import WorkflowFormRenderer from "./WorkflowFormRenderer.vue";
import AttachmentUpload, { type AttachmentInfo } from "./AttachmentUpload.vue";
import { message } from "@/utils/message";
import { readCcMessage } from "@/api/workflow";
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

const fullSpanTypes = ["el-textarea", "el-upload", "el-image-upload", "el-table"];
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
      fileIds: approveForm.attachments.map(file => file.id)
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
            v-if="canCancel"
            type="warning"
            plain
            @click="cancelVisible = true"
          >
            撤销流程
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
        <AppDetailSection title="申请信息">
          <el-descriptions :column="2" border>
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
              v-for="field in fields"
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
</template>

<style scoped lang="scss">
.app-approval {
  display: flex;
  gap: 16px;
  align-items: flex-start;

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
