<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import WorkflowFormRenderer from "./WorkflowFormRenderer.vue";
import UserSelectDialog from "./UserSelectDialog.vue";
import { AssignmentType } from "@/views/engine/workflow/utils/types";

/**
 * 发起审批弹窗：填写表单 + 可选调整审批人/抄送人 + 草稿
 * 提交数据格式与原实现保持一致
 */
interface Props {
  modelValue: boolean;
  workflow?: any;
  formConfig?: any;
}

const props = withDefaults(defineProps<Props>(), {
  workflow: null,
  formConfig: null
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "submitted"): void;
  (e: "submit", payload: any): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: value => emit("update:modelValue", value)
});

const DRAFT_KEY_PREFIX = "workflow_draft_";

const formData = reactive<Record<string, any>>({});
const approverIds = ref<Array<string | number>>([]);
const ccUserIds = ref<Array<string | number>>([]);
const approverNames = ref<Array<any>>([]);
const ccNames = ref<Array<any>>([]);
const submitting = ref(false);
const formRendererRef = ref();

const userSelectVisible = ref(false);
const userSelectTarget = ref<"approver" | "cc">("approver");

/** 发起节点配置：决定是否允许修改审批人/抄送人 */
const startNode = computed<any>(() => {
  const raw = props.workflow?.processConfig;
  if (!raw) return null;
  try {
    const config = typeof raw === "string" ? JSON.parse(raw) : raw;
    return (config?.nodes ?? []).find((node: any) => node.type === "start") ?? null;
  } catch {
    return null;
  }
});

const allowModifyApprovers = computed(
  () => startNode.value?.allowModifyApprovers === true
);
const allowModifyCcUsers = computed(
  () => startNode.value?.allowModifyCcUsers === true
);

const fields = computed(() => props.formConfig?.fields ?? []);

const draftKey = computed(() =>
  props.workflow ? `${DRAFT_KEY_PREFIX}${props.workflow.id}` : ""
);

/* ============ 草稿 ============ */
function formatDraftTime(timeStr: string) {
  if (!timeStr) return "";
  const date = new Date(timeStr);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function saveDraft() {
  if (!props.workflow) return;
  try {
    localStorage.setItem(
      draftKey.value,
      JSON.stringify({
        workflowId: props.workflow.id,
        workflowName: props.workflow.name,
        formData: JSON.parse(JSON.stringify(formData)),
        approverIds: [...approverIds.value],
        ccUserIds: [...ccUserIds.value],
        savedAt: new Date().toISOString()
      })
    );
    ElMessageBox.alert("草稿已保存，下次发起可继续填写", "已保存", {
      type: "success",
      confirmButtonText: "知道了"
    }).catch(() => undefined);
  } catch (error) {
    console.error("保存草稿失败:", error);
  }
}

function clearDraft() {
  if (draftKey.value) localStorage.removeItem(draftKey.value);
}

function loadDraft() {
  if (!draftKey.value) return;
  try {
    const raw = localStorage.getItem(draftKey.value);
    if (!raw) return;
    const draft = JSON.parse(raw);

    ElMessageBox.confirm(
      `发现上次保存的草稿（${formatDraftTime(draft.savedAt)}），是否加载？`,
      "发现草稿",
      { confirmButtonText: "加载", cancelButtonText: "放弃", type: "info" }
    )
      .then(() => {
        Object.assign(formData, draft.formData ?? {});
        approverIds.value = [...(draft.approverIds ?? [])];
        ccUserIds.value = [...(draft.ccUserIds ?? [])];
      })
      .catch(() => clearDraft());
  } catch (error) {
    console.error("加载草稿失败:", error);
  }
}

/* ============ 人员选择 ============ */
function openUserSelect(target: "approver" | "cc") {
  userSelectTarget.value = target;
  userSelectVisible.value = true;
}

function onUsersSelected(users: any[]) {
  const ids = users.map(user => user.id);
  const names = users.map(user => ({
    id: user.id,
    name: user.employeeName ?? user.name
  }));

  if (userSelectTarget.value === "approver") {
    approverIds.value = ids;
    approverNames.value = names;
  } else {
    ccUserIds.value = ids;
    ccNames.value = names;
  }
}

function removeUser(target: "approver" | "cc", id: string | number) {
  if (target === "approver") {
    approverIds.value = approverIds.value.filter(item => item !== id);
    approverNames.value = approverNames.value.filter(item => item.id !== id);
  } else {
    ccUserIds.value = ccUserIds.value.filter(item => item !== id);
    ccNames.value = ccNames.value.filter(item => item.id !== id);
  }
}

/* ============ 提交 ============ */
async function submit() {
  if (!props.workflow) return;

  // 必填项校验：未填时阻断提交
  const valid = (await formRendererRef.value?.validate?.()) ?? true;
  if (!valid) {
    message("请先完善必填项", { type: "warning" });
    return;
  }

  const payload: any = {
    definitionId: props.workflow.id,
    instanceTitle: props.workflow.name,
    formData: { ...formData },
    formDesignId: props.workflow.formDesignId
  };

  if (allowModifyApprovers.value && approverIds.value.length) {
    payload.approverIds = approverIds.value;
  }
  if (allowModifyCcUsers.value && ccUserIds.value.length) {
    payload.ccUserIds = ccUserIds.value;
  }

  submitting.value = true;
  try {
    emit("submit", payload);
  } finally {
    submitting.value = false;
  }
}

function resetState() {
  Object.keys(formData).forEach(key => delete formData[key]);
  approverIds.value = [];
  ccUserIds.value = [];
  approverNames.value = [];
  ccNames.value = [];
}

watch(visible, value => {
  if (!value) return;
  resetState();
  loadDraft();
});

/** 提交成功后由父组件调用，清理草稿与表单 */
function handleSubmitted() {
  clearDraft();
  resetState();
  visible.value = false;
  emit("submitted");
}

defineExpose({ handleSubmitted, submitting });
</script>

<template>
  <AppFormDrawer
    v-model="visible"
    :title="workflow?.name ? `发起审批 · ${workflow.name}` : '发起审批'"
    size="720px"
    confirm-text="提交审批"
    @confirm="submit"
  >
    <div class="app-launch">
      <el-alert
        v-if="!fields.length"
        type="warning"
        :closable="false"
        show-icon
        title="该流程未配置表单，可直接提交"
      />

      <WorkflowFormRenderer
        v-else
        ref="formRendererRef"
        :fields="fields"
        :model-value="formData"
        @update:model-value="value => Object.assign(formData, value)"
      />

      <!-- 审批人 -->
      <div v-if="allowModifyApprovers" class="app-launch__section">
        <div class="app-launch__label">
          审批人
          <span class="app-launch__hint">可调整审批人后再提交</span>
        </div>
        <div class="app-launch__people">
          <el-tag
            v-for="user in approverNames"
            :key="user.id"
            closable
            @close="removeUser('approver', user.id)"
          >
            {{ user.name }}
          </el-tag>
          <el-button link type="primary" @click="openUserSelect('approver')">
            <AppIcon icon="ep:plus" :size="12" />
            选择审批人
          </el-button>
        </div>
      </div>

      <!-- 抄送人 -->
      <div v-if="allowModifyCcUsers" class="app-launch__section">
        <div class="app-launch__label">
          抄送人
          <span class="app-launch__hint">抄送人可查看流程进展</span>
        </div>
        <div class="app-launch__people">
          <el-tag
            v-for="user in ccNames"
            :key="user.id"
            closable
            type="info"
            @close="removeUser('cc', user.id)"
          >
            {{ user.name }}
          </el-tag>
          <el-button link type="primary" @click="openUserSelect('cc')">
            <AppIcon icon="ep:plus" :size="12" />
            选择抄送人
          </el-button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="app-launch__footer">
        <el-button link @click="saveDraft">保存草稿</el-button>
        <div class="app-spacer" />
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">
          提交审批
        </el-button>
      </div>
    </template>
  </AppFormDrawer>

  <UserSelectDialog
    v-model="userSelectVisible"
    :title="userSelectTarget === 'approver' ? '选择审批人' : '选择抄送人'"
    :selected-ids="
      userSelectTarget === 'approver' ? approverIds : ccUserIds
    "
    @confirm="onUsersSelected"
  />
</template>

<style scoped lang="scss">
.app-launch {
  display: flex;
  flex-direction: column;
  gap: 20px;

  &__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--app-border);
  }

  &__label {
    font-size: var(--app-font-14);
    font-weight: 500;
    color: var(--app-text-1);
  }

  &__hint {
    margin-left: 8px;
    font-size: var(--app-font-12);
    font-weight: 400;
    color: var(--app-text-3);
  }

  &__people {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  &__footer {
    display: flex;
    align-items: center;
    width: 100%;
  }
}
</style>
