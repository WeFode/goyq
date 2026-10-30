<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessageBox } from "element-plus";
import {
  createTenant,
  currentTenantQuery,
  switchTenant,
  tenantListQuery,
  tenantUsageQuery,
  updateTenant,
  type TenantInfo,
  type TenantUsage
} from "@/api/tenant";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { useTable } from "@/composables/useTable";
import { setToken, userKey } from "@/utils/auth";
import { storageLocal } from "@/utils/storage";

/**
 * 租户管理（平台管理员）
 * 开通租户 = 租户记录 + 根部门 + 管理员账号/员工，由后端一次性完成。
 * 切换租户会重签 token，前端替换本地令牌后整页刷新以重建菜单与权限。
 */
defineOptions({ name: "SystemTenant" });

const PLAN_MAP: Record<string, string> = {
  standard: "标准版",
  professional: "专业版",
  enterprise: "企业版"
};

const STATUS_MAP = {
  1: { text: "启用", type: "success" as const, dot: true },
  2: { text: "停用", type: "info" as const, dot: true },
  3: { text: "归档", type: "warning" as const, dot: true }
};

const PLANS = [
  { value: "standard", label: "标准版" },
  { value: "professional", label: "专业版" },
  { value: "enterprise", label: "企业版" }
];

const currentTenant = ref<TenantInfo | null>(null);

const query = reactive<{ keyword: string; status?: number }>({
  keyword: "",
  status: undefined
});

const { loading, list, pagination, search, refresh, reset } = useTable({
  fetcher: params => tenantListQuery(params),
  query
});

/* ==================== 开通 / 编辑 ==================== */
const dialogVisible = ref(false);
const dialogTitle = ref("开通租户");
const submitting = ref(false);
const editId = ref<string | null>(null);
const formRef = ref<FormInstance>();

const form = reactive({
  code: "",
  name: "",
  contactName: "",
  contactPhone: "",
  plan: "standard",
  status: 1,
  expireAt: "",
  maxUsers: 0,
  remark: "",
  adminUsername: "",
  adminPassword: "",
  adminNickname: ""
});

const rules: FormRules = {
  code: [
    { required: true, message: "请填写租户编码", trigger: "blur" },
    {
      pattern: /^[a-z][a-z0-9-]{2,31}$/,
      message: "小写字母开头，可包含小写字母、数字与短横线",
      trigger: "blur"
    }
  ],
  name: [{ required: true, message: "请填写租户名称", trigger: "blur" }],
  adminUsername: [
    { required: true, message: "请填写管理员账号", trigger: "blur" },
    { min: 3, max: 20, message: "长度 3-20 位", trigger: "blur" }
  ],
  adminPassword: [
    { required: true, message: "请填写管理员初始密码", trigger: "blur" },
    { min: 6, max: 32, message: "长度 6-32 位", trigger: "blur" }
  ],
  adminNickname: [
    { required: true, message: "请填写管理员姓名", trigger: "blur" }
  ]
};

function openCreate() {
  editId.value = null;
  dialogTitle.value = "开通租户";
  form.code = "";
  form.name = "";
  form.contactName = "";
  form.contactPhone = "";
  form.plan = "standard";
  form.status = 1;
  form.expireAt = "";
  form.maxUsers = 0;
  form.remark = "";
  form.adminUsername = "";
  form.adminPassword = "";
  form.adminNickname = "";
  dialogVisible.value = true;
}

function openEdit(row: TenantInfo) {
  editId.value = row.id;
  dialogTitle.value = "编辑租户";
  form.code = row.code;
  form.name = row.name;
  form.contactName = row.contactName ?? "";
  form.contactPhone = row.contactPhone ?? "";
  form.plan = row.plan || "standard";
  form.status = row.status ?? 1;
  form.expireAt = row.expireAt ?? "";
  form.maxUsers = row.maxUsers ?? 0;
  form.remark = row.remark ?? "";
  dialogVisible.value = true;
}

function submit() {
  formRef.value?.validate(async valid => {
    if (!valid) return;
    submitting.value = true;
    try {
      if (editId.value) {
        await updateTenant(editId.value, {
          name: form.name,
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          plan: form.plan,
          status: form.status,
          expireAt: form.expireAt,
          maxUsers: form.maxUsers,
          remark: form.remark
        });
        message("保存成功", { type: "success" });
      } else {
        await createTenant({
          code: form.code,
          name: form.name,
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          plan: form.plan,
          expireAt: form.expireAt,
          maxUsers: form.maxUsers,
          remark: form.remark,
          adminUsername: form.adminUsername,
          adminPassword: form.adminPassword,
          adminNickname: form.adminNickname
        });
        message("租户开通成功", { type: "success" });
      }
      dialogVisible.value = false;
      refresh();
    } catch (error) {
      console.error("保存租户失败:", error);
    } finally {
      submitting.value = false;
    }
  });
}

/* ==================== 切换租户 ==================== */
async function handleSwitch(row: TenantInfo) {
  await ElMessageBox.confirm(
    `切换后将进入「${row.name}」的数据视角，并重新加载菜单与权限。是否继续？`,
    "切换租户",
    { type: "warning", confirmButtonText: "切换", cancelButtonText: "取消" }
  );

  try {
    const res = await switchTenant(row.id);
    const data = res?.data;
    const cached = storageLocal().getItem<any>(userKey) ?? {};
    setToken({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expireAt: data.expireAt,
      user: {
        id: cached.id ?? "",
        username: cached.username ?? "",
        nickname: cached.nickname ?? "",
        employeeId: cached.employeeId ?? "",
        avatar: cached.avatar ?? "",
        departments: cached.departments ?? [],
        // 切换租户不改变账号本身，这两个字段在刷新后会由业务接口重新拉取
        is_super: cached.is_super ?? false,
        status: cached.status ?? 1
      }
    });
    message(`已切换到「${data.tenant?.name ?? row.name}」`, { type: "success" });
    window.setTimeout(() => window.location.reload(), 400);
  } catch (error) {
    console.error("切换租户失败:", error);
  }
}

/* ==================== 用量与配额 ==================== */
const usageVisible = ref(false);
const usageLoading = ref(false);
const usage = ref<TenantUsage | null>(null);
const usageTenantName = ref("");

async function openUsage(row: TenantInfo) {
  usageVisible.value = true;
  usageLoading.value = true;
  usageTenantName.value = row.name;
  usage.value = null;
  try {
    const res = await tenantUsageQuery({ tenantId: row.id });
    usage.value = res?.data?.usage ?? null;
  } catch (error) {
    console.error("加载租户用量失败:", error);
  } finally {
    usageLoading.value = false;
  }
}

/** 配额占用进度的颜色阶段 */
function percentStatus(percent: number): "" | "warning" | "exception" {
  if (percent >= 100) return "exception";
  if (percent >= 80) return "warning";
  return "";
}

function planText(plan?: string): string {
  if (!plan) return "-";
  return PLAN_MAP[plan] || plan;
}

/** 用量抽屉里的资源统计 */
const usageStats = computed(() => {
  if (!usage.value) return [];
  return [
    { label: "角色", value: usage.value.roleCount },
    { label: "部门", value: usage.value.deptCount },
    { label: "员工档案", value: usage.value.employeeCount },
    { label: "流程定义", value: usage.value.workflowCount },
    { label: "审批实例", value: usage.value.instanceCount },
    { label: "附件", value: usage.value.fileCount }
  ];
});

/* ==================== 当前租户 ==================== */
async function loadCurrent() {
  try {
    const res = await currentTenantQuery();
    currentTenant.value = res?.data?.tenant ?? null;
  } catch (error) {
    console.warn("获取当前租户失败:", error);
  }
}

function resetQuery() {
  query.keyword = "";
  query.status = undefined;
  reset();
}

onMounted(() => {
  loadCurrent();
  search();
});
</script>

<template>
  <AppPage
    title="租户管理"
    description="开通与管理 SaaS 租户；切换后可查看目标租户的数据视角"
  >
    <template #actions>
      <span v-if="currentTenant" class="tenant__current">
        当前租户：<b>{{ currentTenant.name }}</b>
        <code>{{ currentTenant.code }}</code>
      </span>
      <el-button
        v-if="hasAuth('sys:tenant:add')"
        type="primary"
        @click="openCreate"
      >
        <AppIcon icon="ep:plus" :size="14" />
        开通租户
      </el-button>
    </template>

    <AppSearchBar :loading="loading" @search="search" @reset="resetQuery">
      <el-form-item label="关键词">
        <el-input
          v-model="query.keyword"
          placeholder="租户编码或名称"
          clearable
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select
          v-model="query.status"
          placeholder="全部"
          clearable
          class="tenant__select"
        >
          <el-option label="启用" :value="1" />
          <el-option label="停用" :value="2" />
          <el-option label="归档" :value="3" />
        </el-select>
      </el-form-item>
    </AppSearchBar>

    <AppDataTable
      :data="list"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无租户"
      @page-change="refresh"
    >
      <el-table-column label="租户" min-width="200">
        <template #default="{ row }">
          <div class="tenant__cell">
            <span class="app-text--strong">{{ row.name }}</span>
            <code class="tenant__code">{{ row.code }}</code>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="联系人" min-width="150">
        <template #default="{ row }">
          <div class="tenant__cell">
            <span>{{ row.contactName || "-" }}</span>
            <span class="tenant__muted">{{ row.contactPhone || "" }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="套餐" width="110" align="center">
        <template #default="{ row }">
          {{ planText(row.plan) }}
        </template>
      </el-table-column>
      <el-table-column label="用户数" width="120" align="center">
        <template #default="{ row }">
          {{ row.userCount }}
          <span class="tenant__muted">
            / {{ row.maxUsers > 0 ? row.maxUsers : "不限" }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <AppStatusTag :value="row.status" :map="STATUS_MAP" />
        </template>
      </el-table-column>
      <el-table-column label="到期时间" width="170">
        <template #default="{ row }">
          {{ row.expireAt || "长期" }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openUsage(row)">
            用量
          </el-button>
          <el-button
            v-if="hasAuth('sys:tenant:edit')"
            link
            type="primary"
            @click="openEdit(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="hasAuth('sys:tenant:switch')"
            link
            type="primary"
            :disabled="currentTenant?.id === row.id"
            @click="handleSwitch(row)"
          >
            切换
          </el-button>
        </template>
      </el-table-column>
    </AppDataTable>

    <AppFormDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :loading="submitting"
      width="640px"
      @confirm="submit"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-divider content-position="left">租户信息</el-divider>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="租户编码" prop="code">
              <el-input
                v-model="form.code"
                placeholder="如 acme"
                :disabled="!!editId"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="租户名称" prop="name">
              <el-input v-model="form.name" placeholder="如 云启软件" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="form.contactName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="form.contactPhone" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="套餐">
              <el-select v-model="form.plan" class="tenant__select">
                <el-option
                  v-for="plan in PLANS"
                  :key="plan.value"
                  :label="plan.label"
                  :value="plan.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最大用户数">
              <el-input-number
                v-model="form.maxUsers"
                :min="0"
                :max="100000"
                controls-position="right"
                class="tenant__number"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="到期时间">
              <el-date-picker
                v-model="form.expireAt"
                type="datetime"
                placeholder="留空表示长期"
                value-format="YYYY-MM-DD HH:mm:ss"
                class="tenant__date"
              />
            </el-form-item>
          </el-col>
          <el-col v-if="editId" :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio :value="1">启用</el-radio>
                <el-radio :value="2">停用</el-radio>
                <el-radio :value="3">归档</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            maxlength="255"
            show-word-limit
          />
        </el-form-item>

        <template v-if="!editId">
          <el-divider content-position="left">租户管理员</el-divider>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="管理员账号" prop="adminUsername">
                <el-input v-model="form.adminUsername" clearable />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="管理员姓名" prop="adminNickname">
                <el-input v-model="form.adminNickname" clearable />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="初始密码" prop="adminPassword">
            <el-input
              v-model="form.adminPassword"
              type="password"
              show-password
              placeholder="6-32 位"
            />
          </el-form-item>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="开通后将自动创建根部门与管理员的员工档案，管理员可直接登录该租户。"
          />
        </template>
      </el-form>
    </AppFormDialog>

    <!-- 用量与配额 -->
    <AppFormDrawer
      v-model="usageVisible"
      :title="`用量与配额 · ${usageTenantName}`"
      size="520px"
      :loading="usageLoading"
      confirm-text="关闭"
      @confirm="usageVisible = false"
    >
      <template v-if="usage">
        <AppDetailSection title="套餐与账号配额">
          <div class="tenant__field">
            <span class="tenant__field-label">套餐</span>
            <span class="tenant__field-value">{{ planText(usage.plan) }}</span>
          </div>
          <div class="tenant__field">
            <span class="tenant__field-label">到期时间</span>
            <span class="tenant__field-value">{{ usage.expireAt || "长期" }}</span>
          </div>
          <div class="tenant__quota">
            <div class="tenant__quota-head">
              <span>账号占用</span>
              <span class="tenant__quota-num">
                {{ usage.userCount }} /
                {{ usage.maxUsers > 0 ? usage.maxUsers : "不限" }}
              </span>
            </div>
            <el-progress
              :percentage="usage.maxUsers > 0 ? usage.userPercent : 0"
              :status="percentStatus(usage.userPercent)"
              :indeterminate="false"
            />
            <p v-if="usage.maxUsers <= 0" class="tenant__muted">
              该租户未设置账号上限
            </p>
          </div>
        </AppDetailSection>

        <AppDetailSection title="资源用量">
          <div class="tenant__stats">
            <div v-for="item in usageStats" :key="item.label" class="tenant__stat">
              <b>{{ item.value }}</b>
              <span>{{ item.label }}</span>
            </div>
          </div>
          <div class="tenant__field">
            <span class="tenant__field-label">存储占用</span>
            <span class="tenant__field-value">
              {{ usage.storageText }}（{{ usage.fileCount }} 个附件）
            </span>
          </div>
        </AppDetailSection>
      </template>

      <AppEmpty v-else-if="!usageLoading" description="未获取到用量数据" />
    </AppFormDrawer>
  </AppPage>
</template>

<style scoped lang="scss">
.tenant {
  &__current {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding: 0 12px;
    font-size: var(--app-font-12);
    line-height: 28px;
    color: var(--app-text-2);
    background: var(--app-info-bg);
    border-radius: var(--app-radius-round);

    b {
      font-weight: 600;
      color: var(--app-text-1);
    }

    code {
      font-family: "JetBrains Mono", Consolas, monospace;
      color: var(--app-text-3);
    }
  }

  &__cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__code {
    font-family: "JetBrains Mono", Consolas, monospace;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__muted {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__field {
    display: flex;
    gap: 12px;
    align-items: baseline;
    padding: 6px 0;
  }

  &__field-label {
    flex: none;
    width: 76px;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__field-value {
    min-width: 0;
    font-size: var(--app-font-13);
    color: var(--app-text-1);
  }

  &__quota {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 0 4px;
  }

  &__quota-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-size: var(--app-font-13);
    color: var(--app-text-2);
  }

  &__quota-num {
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    padding: 4px 0 12px;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    background: var(--app-subtle);
    border-radius: var(--app-radius-sm);

    b {
      font-size: var(--app-font-20);
      font-weight: 600;
      color: var(--app-text-1);
    }

    span {
      font-size: var(--app-font-12);
      color: var(--app-text-3);
    }
  }

  &__select {
    width: 160px;
  }

  &__number {
    width: 160px;
  }

  &__date {
    width: 100%;
  }
}
</style>
