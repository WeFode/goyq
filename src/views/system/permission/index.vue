<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  addPermission,
  deletePermission,
  permissionListQuery,
  updatePermission
} from "@/api/permission";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { useTable } from "@/composables/useTable";

defineOptions({ name: "SystemPermission" });

/* ============ 列表 ============ */
const query = reactive<{ keyword: string }>({ keyword: "" });

const { loading, list, pagination, search, refresh, reset } = useTable({
  fetcher: params => permissionListQuery(params),
  query
});

/* ============ 新增 / 编辑 ============ */
const dialogVisible = ref(false);
const dialogTitle = ref("新增权限");
const submitting = ref(false);
const editId = ref<string | null>(null);
const formRef = ref<FormInstance>();

const form = reactive({
  permissionName: "",
  permissionKey: "",
  status: true
});

const rules: FormRules = {
  permissionName: [
    { required: true, message: "请填写权限名称", trigger: "blur" }
  ],
  permissionKey: [
    { required: true, message: "请填写权限编码", trigger: "blur" },
    {
      pattern: /^[a-z0-9]+(:[a-z0-9]+){1,3}$/i,
      message: "编码格式如 sys:user:add",
      trigger: "blur"
    }
  ]
};

function openCreate() {
  editId.value = null;
  dialogTitle.value = "新增权限";
  form.permissionName = "";
  form.permissionKey = "";
  form.status = true;
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editId.value = row.id;
  dialogTitle.value = "编辑权限";
  form.permissionName = row.permissionName ?? "";
  form.permissionKey = row.permissionKey ?? "";
  form.status = row.status ?? true;
  dialogVisible.value = true;
}

function submit() {
  const formEl = formRef.value;
  if (!formEl) return;

  formEl.validate(async valid => {
    if (!valid) return;
    submitting.value = true;
    try {
      if (editId.value) {
        await updatePermission(editId.value, { ...form });
        message("保存成功", { type: "success" });
      } else {
        await addPermission({ ...form, id: undefined });
        message("新增成功", { type: "success" });
      }
      dialogVisible.value = false;
      refresh();
    } catch (error) {
      console.error("保存权限失败:", error);
    } finally {
      submitting.value = false;
    }
  });
}

async function handleDelete(row: any) {
  try {
    await deletePermission(row.id);
    message("删除成功", { type: "success" });
    refresh();
  } catch (error) {
    console.error("删除权限失败:", error);
  }
}

function resetQuery() {
  query.keyword = "";
  reset();
}

onMounted(() => search());
</script>

<template>
  <AppPage title="权限管理" description="维护按钮级权限编码，用于页面元素控制">
    <template #actions>
      <el-button
        v-if="hasAuth('sys:permission:add')"
        type="primary"
        @click="openCreate"
      >
        <AppIcon icon="ep:plus" :size="14" />
        新增权限
      </el-button>
    </template>

    <AppSearchBar :loading="loading" @search="search" @reset="resetQuery">
      <el-form-item label="关键词">
        <el-input
          v-model="query.keyword"
          placeholder="权限名称或编码"
          clearable
        />
      </el-form-item>
    </AppSearchBar>

    <AppDataTable
      :data="list"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无权限"
      @page-change="refresh"
    >
      <el-table-column label="权限名称" min-width="160">
        <template #default="{ row }">
          <span class="app-text--strong">{{ row.permissionName || "-" }}</span>
        </template>
      </el-table-column>
      <el-table-column label="权限编码" min-width="220">
        <template #default="{ row }">
          <code class="perm-code">{{ row.permissionKey || "-" }}</code>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <AppStatusTag
            :value="row.status ? 1 : 0"
            :map="{
              1: { text: '启用', type: 'success', dot: true },
              0: { text: '停用', type: 'info', dot: true }
            }"
          />
        </template>
      </el-table-column>
      <el-table-column label="更新时间" prop="updatedAt" width="180" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="hasAuth('sys:permission:edit')"
            link
            type="primary"
            @click="openEdit(row)"
          >
            编辑
          </el-button>
          <el-popconfirm
            v-if="hasAuth('sys:permission:delete')"
            :title="`确认删除该权限？`"
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

    <AppFormDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :loading="submitting"
      width="520px"
      @confirm="submit"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-form-item label="权限名称" prop="permissionName">
          <el-input v-model="form.permissionName" placeholder="如 新增账号" clearable />
        </el-form-item>
        <el-form-item label="权限编码" prop="permissionKey">
          <el-input v-model="form.permissionKey" placeholder="如 sys:user:add" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
    </AppFormDialog>
  </AppPage>
</template>

<style scoped lang="scss">
.perm-code {
  padding: 2px 6px;
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: var(--app-font-12);
  color: var(--app-text-2);
  background: var(--app-info-bg);
  border-radius: var(--app-radius-xs);
}
</style>
