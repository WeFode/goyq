<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import type { FormInstance, FormRules } from "element-plus";
import {
  addUser,
  assignRoles,
  deleteUser,
  updateUser,
  updateUserPassword,
  userListQuery
} from "@/api/user";
import { roleListQuery } from "@/api/role";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { useTable } from "@/composables/useTable";

defineOptions({ name: "SystemUser" });

const route = useRoute();

/* ============ 列表 ============ */
const query = reactive<{
  username: string;
  nickname: string;
  status: number | null;
}>({
  username: "",
  nickname: "",
  status: null
});

const {
  loading,
  list,
  pagination,
  selectedRows,
  selectedNum,
  search,
  refresh,
  onSelectionChange,
  clearSelection
} = useTable({
  fetcher: params => userListQuery(params),
  query,
  // 路由 query 中的 status 需要在 onMounted 中读取，因此手动触发首次加载
  immediate: false
});

/* ============ 新增/编辑 ============ */
const editVisible = ref(false);
const editTitle = ref("新增用户");
const editSubmitting = ref(false);
const editFormRef = ref<FormInstance>();

const editForm = reactive({
  id: null as string | null,
  username: "",
  nickname: "",
  password: "",
  email: "",
  mobile: "",
  avatar: "",
  is_super: false,
  status: 1
});

const isCreate = computed(() => editTitle.value === "新增用户");

const editRules = computed<FormRules>(() => ({
  username: [{ required: true, message: "账号名为必填项", trigger: "blur" }],
  nickname: [{ required: true, message: "真实姓名为必填项", trigger: "blur" }],
  // 仅新增时密码必填；编辑时留空表示不修改
  password: isCreate.value
    ? [{ required: true, message: "用户密码为必填项", trigger: "blur" }]
    : []
}));

function openEdit(row?: any) {
  editTitle.value = row ? "编辑用户" : "新增用户";
  editForm.id = row?.id ?? null;
  editForm.username = row?.username ?? "";
  editForm.nickname = row?.nickname ?? "";
  editForm.password = "";
  editForm.email = row?.email ?? "";
  editForm.mobile = row?.mobile ?? "";
  editForm.avatar = row?.avatar ?? "";
  editForm.is_super = row?.is_super ?? false;
  editForm.status = row?.status ?? 1;
  editVisible.value = true;
}

async function submitEdit() {
  const formEl = editFormRef.value;
  if (!formEl) return;

  await formEl.validate(async valid => {
    if (!valid) return;

    editSubmitting.value = true;
    try {
      const payload: any = {
        id: editForm.id,
        username: editForm.username,
        nickname: editForm.nickname,
        email: editForm.email,
        mobile: editForm.mobile,
        avatar: editForm.avatar,
        status: editForm.status,
        is_super: editForm.is_super
      };
      if (isCreate.value) payload.password = editForm.password;

      isCreate.value ? await addUser(payload) : await updateUser(payload);

      message(`${isCreate.value ? "新增" : "编辑"}成功`, { type: "success" });
      editVisible.value = false;
      refresh();
    } catch (error) {
      console.error("提交用户信息失败:", error);
    } finally {
      editSubmitting.value = false;
    }
  });
}

/* ============ 状态 / 超管开关 ============ */
const statusLoadingMap = reactive<Record<string, boolean>>({});
const superLoadingMap = reactive<Record<string, boolean>>({});

async function handleStatusChange(row: any) {
  const newStatus = row.status;
  const oldStatus = newStatus === 1 ? 2 : 1;
  statusLoadingMap[row.id] = true;

  try {
    await updateUser({
      id: row.id,
      nickname: row.nickname,
      email: row.email,
      mobile: row.mobile,
      is_super: row.is_super,
      status: newStatus
    });
    message(`已${newStatus === 1 ? "启用" : "停用"}用户 ${row.nickname}`, {
      type: "success"
    });
  } catch (error) {
    row.status = oldStatus;
    message(`${newStatus === 1 ? "启用" : "停用"}用户失败`, { type: "error" });
  } finally {
    statusLoadingMap[row.id] = false;
  }
}

async function handleSuperChange(row: any) {
  const newValue = row.is_super;
  superLoadingMap[row.id] = true;

  try {
    await updateUser({
      id: row.id,
      nickname: row.nickname,
      email: row.email,
      mobile: row.mobile,
      is_super: newValue,
      status: row.status
    });
    message(
      `${newValue ? "已设置" : "已取消"} ${row.nickname} 用户的超管权限`,
      { type: "success" }
    );
  } catch (error) {
    row.is_super = !newValue;
    message(
      `${newValue ? "设置" : "取消"} ${row.nickname} 用户的超管权限失败`,
      { type: "error" }
    );
  } finally {
    superLoadingMap[row.id] = false;
  }
}

/* ============ 删除 ============ */
async function handleDelete(row: any) {
  try {
    await deleteUser(row.id);
    message("删除成功", { type: "success" });
    refresh();
  } catch (error) {
    console.error("删除用户失败:", error);
  }
}

function handleBatchDelete() {
  message(`已删除用户编号为 ${selectedRows.value.map(row => row.id)} 的数据`, {
    type: "success"
  });
  clearSelection();
  refresh();
}

/* ============ 重置密码 ============ */
const pwdVisible = ref(false);
const pwdSubmitting = ref(false);
const pwdFormRef = ref<FormInstance>();
const pwdTarget = ref<any>(null);
const pwdForm = reactive({ newPwd: "" });

const pwdRules: FormRules = {
  newPwd: [{ required: true, message: "请输入新密码", trigger: "blur" }]
};

/** 密码强度：仅按长度给出 4 档提示，不引入额外依赖 */
const pwdStrength = computed(() => {
  const value = pwdForm.newPwd ?? "";
  if (!value) return { level: -1, text: "", color: "" };
  if (value.length < 6)
    return { level: 0, text: "过于简单", color: "var(--app-danger)" };
  if (value.length < 8)
    return { level: 1, text: "一般", color: "var(--app-warning)" };
  if (value.length < 12)
    return { level: 2, text: "较强", color: "var(--app-primary)" };
  return { level: 3, text: "强", color: "var(--app-success)" };
});

function openResetPwd(row: any) {
  pwdTarget.value = row;
  pwdForm.newPwd = "";
  pwdVisible.value = true;
}

async function submitResetPwd() {
  const formEl = pwdFormRef.value;
  if (!formEl) return;

  await formEl.validate(async valid => {
    if (!valid) return;

    pwdSubmitting.value = true;
    try {
      await updateUserPassword(pwdTarget.value.id, pwdForm.newPwd);
      message(`已成功重置 ${pwdTarget.value.nickname} 用户的密码`, {
        type: "success"
      });
      pwdVisible.value = false;
    } catch (error) {
      console.error("重置密码失败:", error);
    } finally {
      pwdSubmitting.value = false;
    }
  });
}

/* ============ 分配角色 ============ */
const roleVisible = ref(false);
const roleSubmitting = ref(false);
const roleOptions = ref<any[]>([]);
const roleTarget = ref<any>(null);
const roleIds = ref<string[]>([]);

async function loadRoleOptions() {
  try {
    const res: any = await roleListQuery({ page: 1, pageSize: 50 });
    roleOptions.value = res?.data?.list ?? [];
  } catch (error) {
    console.error("加载角色列表失败:", error);
  }
}

function openRole(row: any) {
  roleTarget.value = row;
  roleIds.value = (row.roles ?? []).map((role: any) => role.id);
  roleVisible.value = true;
}

async function submitRole() {
  roleSubmitting.value = true;
  try {
    await assignRoles(roleTarget.value.id, roleIds.value);
    message(`已成功分配 ${roleTarget.value.nickname} 用户的角色`, {
      type: "success"
    });
    roleVisible.value = false;
    refresh();
  } catch (error) {
    console.error("分配角色失败:", error);
  } finally {
    roleSubmitting.value = false;
  }
}

/* ============ 初始化 ============ */
function resetQuery() {
  query.username = "";
  query.nickname = "";
  query.status = null;
  search();
}

onMounted(() => {
  const status = route.query.status;
  if (status) query.status = Number(status);
  search();
  loadRoleOptions();
});
</script>

<template>
  <AppPage title="账号管理" description="维护系统登录账号、状态与角色分配">
    <template #actions>
      <el-button
        v-if="hasAuth('sys:user:add')"
        type="primary"
        @click="openEdit()"
      >
        <AppIcon icon="ep:plus" :size="14" />
        新增账号
      </el-button>
    </template>

    <AppSearchBar :loading="loading" @search="search" @reset="resetQuery">
      <el-form-item label="姓名">
        <el-input v-model="query.nickname" placeholder="请输入姓名" clearable />
      </el-form-item>
      <el-form-item label="账号名">
        <el-input v-model="query.username" placeholder="请输入账号名" clearable />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable>
          <el-option label="启用" :value="1" />
          <el-option label="停用" :value="2" />
        </el-select>
      </el-form-item>
    </AppSearchBar>

    <AppDataTable
      :data="list"
      :loading="loading"
      :pagination="pagination"
      :selected-num="selectedNum"
      selection
      empty-text="暂无用户"
      @selection-change="onSelectionChange"
      @page-change="refresh"
    >
      <template #batch>
        <el-button
          v-if="hasAuth('sys:user:delete')"
          type="danger"
          link
          @click="handleBatchDelete"
        >
          批量删除
        </el-button>
      </template>

      <el-table-column label="账号名" prop="username" min-width="140">
        <template #default="{ row }">
          <span class="app-text--strong">{{ row.username || "-" }}</span>
        </template>
      </el-table-column>

      <el-table-column label="姓名" prop="nickname" min-width="120">
        <template #default="{ row }">
          <div class="user-cell">
            <AppUserAvatar :name="row.nickname" :avatar="row.avatar" :size="26" />
            <span>{{ row.nickname || "-" }}</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="超管" prop="is_super" width="90" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.is_super"
            :loading="superLoadingMap[row.id]"
            :disabled="!hasAuth('sys:user:superSwitch')"
            @change="handleSuperChange(row)"
          />
        </template>
      </el-table-column>

      <el-table-column label="角色" prop="roles" min-width="180">
        <template #default="{ row }">
          <div class="role-cell">
            <el-tag
              v-for="role in row.roles"
              :key="role.id"
              size="small"
              type="primary"
              effect="light"
            >
              {{ role.roleName }}
            </el-tag>
            <span v-if="!row.roles?.length" class="app-text--tertiary">-</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="状态" prop="status" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.status"
            :active-value="1"
            :inactive-value="2"
            :loading="statusLoadingMap[row.id]"
            :disabled="!hasAuth('sys:user:status')"
            @change="handleStatusChange(row)"
          />
        </template>
      </el-table-column>

      <el-table-column label="创建时间" prop="created_at" width="170" />

      <el-table-column label="操作" width="210" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="hasAuth('sys:user:edit')"
            link
            type="primary"
            @click="openEdit(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="hasAuth('sys:user:resetPwd')"
            link
            type="primary"
            @click="openResetPwd(row)"
          >
            重置密码
          </el-button>
          <el-button
            v-if="hasAuth('sys:user:assignRole') && !row.is_super"
            link
            type="primary"
            @click="openRole(row)"
          >
            分配角色
          </el-button>
          <el-popconfirm
            v-if="hasAuth('sys:user:delete')"
            :title="`确认删除用户「${row.nickname}」？`"
            width="220"
            @confirm="handleDelete(row)"
          >
            <template #reference>
              <el-button link type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </AppDataTable>

    <!-- 新增/编辑 -->
    <AppFormDialog
      v-model="editVisible"
      :title="editTitle"
      :loading="editSubmitting"
      width="560px"
      @confirm="submitEdit"
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-width="88px"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="账号名" prop="username">
              <el-input
                v-model="editForm.username"
                placeholder="请输入账号名"
                clearable
                :disabled="!isCreate"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="真实姓名" prop="nickname">
              <el-input
                v-model="editForm.nickname"
                placeholder="请输入真实姓名"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col v-if="isCreate" :span="12">
            <el-form-item label="初始密码" prop="password">
              <el-input
                v-model="editForm.password"
                type="password"
                placeholder="请输入初始密码"
                show-password
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否超管">
              <el-switch v-model="editForm.is_super" />
            </el-form-item>
          </el-col>
          <el-col v-if="isCreate" :span="12">
            <el-form-item label="账号状态">
              <el-switch
                v-model="editForm.status"
                :active-value="1"
                :inactive-value="2"
                inline-prompt
                active-text="启用"
                inactive-text="停用"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </AppFormDialog>

    <!-- 重置密码 -->
    <AppFormDialog
      v-model="pwdVisible"
      :title="`重置「${pwdTarget?.nickname ?? ''}」的密码`"
      :loading="pwdSubmitting"
      width="440px"
      @confirm="submitResetPwd"
    >
      <el-form
        ref="pwdFormRef"
        :model="pwdForm"
        :rules="pwdRules"
        label-width="72px"
      >
        <el-form-item label="新密码" prop="newPwd">
          <el-input
            v-model="pwdForm.newPwd"
            type="password"
            placeholder="请输入新密码（至少 6 位）"
            show-password
            clearable
          />
        </el-form-item>
        <el-form-item v-if="pwdForm.newPwd" label="强度">
          <span class="pwd-strength" :style="{ color: pwdStrength.color }">
            {{ pwdStrength.text }}
          </span>
        </el-form-item>
      </el-form>
    </AppFormDialog>

    <!-- 分配角色 -->
    <AppFormDialog
      v-model="roleVisible"
      :title="`分配「${roleTarget?.nickname ?? ''}」的角色`"
      :loading="roleSubmitting"
      width="440px"
      @confirm="submitRole"
    >
      <el-form label-width="72px">
        <el-form-item label="真实姓名">
          <el-input :model-value="roleTarget?.nickname" disabled />
        </el-form-item>
        <el-form-item label="角色列表">
          <el-select
            v-model="roleIds"
            placeholder="请选择角色"
            multiple
            clearable
            class="w-full"
          >
            <el-option
              v-for="item in roleOptions"
              :key="item.id"
              :label="item.roleName"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </AppFormDialog>
  </AppPage>
</template>

<style scoped lang="scss">
.user-cell {
  display: flex;
  gap: 8px;
  align-items: center;
}

.role-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pwd-strength {
  font-size: var(--app-font-13);
  font-weight: 500;
}
</style>
