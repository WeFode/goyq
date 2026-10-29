<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  addRole,
  deleteRole,
  getRoleMenu,
  getRolePermissions,
  roleListQuery,
  updateRole,
  updateRoleMenu,
  updateRolePermissions
} from "@/api/role";
import { menuListQuery } from "@/api/menu";
import { permissionListQuery } from "@/api/permission";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { handleTree } from "@/utils/tree";
import { useTable } from "@/composables/useTable";

defineOptions({ name: "SystemRole" });

/* ============ 列表 ============ */
const query = reactive<{ roleName: string; status: number | null }>({
  roleName: "",
  status: null
});

const { loading, list, pagination, search, refresh, reset } = useTable({
  fetcher: params => roleListQuery(params),
  query
});

/* ============ 新增 / 编辑 ============ */
const dialogVisible = ref(false);
const dialogTitle = ref("新增角色");
const submitting = ref(false);
const editId = ref<string | null>(null);
const formRef = ref<FormInstance>();

const form = reactive({
  roleName: "",
  remark: "",
  status: 1
});

const rules: FormRules = {
  roleName: [{ required: true, message: "请填写角色名称", trigger: "blur" }]
};

function openCreate() {
  editId.value = null;
  dialogTitle.value = "新增角色";
  form.roleName = "";
  form.remark = "";
  form.status = 1;
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editId.value = row.id;
  dialogTitle.value = "编辑角色";
  form.roleName = row.roleName ?? "";
  form.remark = row.remark ?? "";
  form.status = row.status ?? 1;
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
        await updateRole({ id: editId.value, ...form });
        message("保存成功", { type: "success" });
      } else {
        await addRole({ ...form });
        message("新增成功", { type: "success" });
      }
      dialogVisible.value = false;
      refresh();
    } catch (error) {
      console.error("保存角色失败:", error);
    } finally {
      submitting.value = false;
    }
  });
}

async function handleDelete(row: any) {
  try {
    await deleteRole(row.id);
    message("删除成功", { type: "success" });
    refresh();
  } catch (error) {
    console.error("删除角色失败:", error);
  }
}

/* ============ 菜单授权 ============ */
const menuDialogVisible = ref(false);
const menuSubmitting = ref(false);
const menuTree = ref<any[]>([]);
const menuTreeRef = ref();
const menuTarget = ref<any>(null);

async function openMenuAssign(row: any) {
  menuTarget.value = row;
  menuDialogVisible.value = true;
  try {
    const [menuRes, roleMenuRes] = await Promise.all([
      menuListQuery({}),
      getRoleMenu(row.id)
    ]);
    const rawList = menuRes?.data?.list ?? menuRes?.data ?? [];
    menuTree.value = Array.isArray(rawList)
      ? handleTree(rawList, "id", "parent_id")
      : [];
    const checkedIds =
      roleMenuRes?.data?.menuIds ?? roleMenuRes?.data ?? [];
    setTimeout(() => {
      menuTreeRef.value?.setCheckedKeys(Array.isArray(checkedIds) ? checkedIds : []);
    }, 0);
  } catch (error) {
    console.error("加载菜单授权数据失败:", error);
  }
}

async function submitMenuAssign() {
  if (!menuTarget.value) return;
  menuSubmitting.value = true;
  try {
    const checked = menuTreeRef.value?.getCheckedKeys() ?? [];
    const halfChecked = menuTreeRef.value?.getHalfCheckedKeys() ?? [];
    await updateRoleMenu({
      roleId: menuTarget.value.id,
      menuIds: [...checked, ...halfChecked]
    });
    message("菜单授权已保存", { type: "success" });
    menuDialogVisible.value = false;
  } catch (error) {
    console.error("保存菜单授权失败:", error);
  } finally {
    menuSubmitting.value = false;
  }
}

/* ============ 权限授权 ============ */
const permDialogVisible = ref(false);
const permSubmitting = ref(false);
const permTree = ref<any[]>([]);
const permTreeRef = ref();
const permTarget = ref<any>(null);

async function openPermAssign(row: any) {
  permTarget.value = row;
  permDialogVisible.value = true;
  try {
    const [permRes, rolePermRes] = await Promise.all([
      permissionListQuery({ page: 1, pageSize: 500 }),
      getRolePermissions(row.id)
    ]);
    const rawList = permRes?.data?.list ?? permRes?.data ?? [];
    permTree.value = Array.isArray(rawList)
      ? handleTree(
          rawList.map((item: any) => ({
            ...item,
            label: item.permissionName ?? item.permissionKey ?? "-",
            id: item.permissionKey ?? item.id
          })),
          "id",
          "parentId"
        )
      : [];
    const checked = rolePermRes?.data ?? [];
    setTimeout(() => {
      permTreeRef.value?.setCheckedKeys(Array.isArray(checked) ? checked : []);
    }, 0);
  } catch (error) {
    console.error("加载权限授权数据失败:", error);
  }
}

async function submitPermAssign() {
  if (!permTarget.value) return;
  permSubmitting.value = true;
  try {
    const checked = permTreeRef.value?.getCheckedKeys() ?? [];
    const halfChecked = permTreeRef.value?.getHalfCheckedKeys() ?? [];
    await updateRolePermissions(permTarget.value.id, [
      ...checked,
      ...halfChecked
    ]);
    message("权限授权已保存", { type: "success" });
    permDialogVisible.value = false;
  } catch (error) {
    console.error("保存权限授权失败:", error);
  } finally {
    permSubmitting.value = false;
  }
}

function resetQuery() {
  query.roleName = "";
  query.status = null;
  reset();
}

onMounted(() => search());
</script>

<template>
  <AppPage title="角色管理" description="维护角色、菜单权限与操作权限">
    <template #actions>
      <el-button v-if="hasAuth('sys:role:add')" type="primary" @click="openCreate">
        <AppIcon icon="ep:plus" :size="14" />
        新增角色
      </el-button>
    </template>

    <AppSearchBar :loading="loading" @search="search" @reset="resetQuery">
      <el-form-item label="角色名称">
        <el-input v-model="query.roleName" placeholder="请输入角色名称" clearable />
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
      empty-text="暂无角色"
      @page-change="refresh"
    >
      <el-table-column label="角色名称" prop="roleName" min-width="160">
        <template #default="{ row }">
          <span class="app-text--strong">{{ row.roleName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="备注" prop="remark" min-width="220">
        <template #default="{ row }">
          <span class="app-text--secondary">{{ row.remark || "-" }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <AppStatusTag
            :value="row.status"
            :map="{
              1: { text: '启用', type: 'success', dot: true },
              2: { text: '停用', type: 'info', dot: true }
            }"
          />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" prop="createdAt" width="170" />

      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="hasAuth('sys:role:edit')"
            link
            type="primary"
            @click="openEdit(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="hasAuth('sys:role:assignMenu')"
            link
            type="primary"
            @click="openMenuAssign(row)"
          >
            菜单授权
          </el-button>
          <el-button
            v-if="hasAuth('sys:role:assignPermission')"
            link
            type="primary"
            @click="openPermAssign(row)"
          >
            权限授权
          </el-button>
          <el-popconfirm
            v-if="hasAuth('sys:role:delete')"
            :title="`确认删除角色「${row.roleName}」？`"
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
      v-model="dialogVisible"
      :title="dialogTitle"
      :loading="submitting"
      width="520px"
      @confirm="submit"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-form-item label="角色名称" prop="roleName">
          <el-input v-model="form.roleName" placeholder="请输入角色名称" clearable />
        </el-form-item>
        <el-form-item label="角色备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入角色职责说明"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="2">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </AppFormDialog>

    <!-- 菜单授权 -->
    <AppFormDialog
      v-model="menuDialogVisible"
      :title="`菜单授权 · ${menuTarget?.roleName ?? ''}`"
      :loading="menuSubmitting"
      width="560px"
      @confirm="submitMenuAssign"
    >
      <el-tree
        ref="menuTreeRef"
        :data="menuTree"
        show-checkbox
        node-key="id"
        :props="{ label: 'title', children: 'children' }"
        default-expand-all
        class="assign-tree"
      />
    </AppFormDialog>

    <!-- 权限授权 -->
    <AppFormDialog
      v-model="permDialogVisible"
      :title="`权限授权 · ${permTarget?.roleName ?? ''}`"
      :loading="permSubmitting"
      width="560px"
      @confirm="submitPermAssign"
    >
      <el-tree
        ref="permTreeRef"
        :data="permTree"
        show-checkbox
        node-key="id"
        :props="{ label: 'label', children: 'children' }"
        default-expand-all
        class="assign-tree"
      />
    </AppFormDialog>
  </AppPage>
</template>

<style scoped>
.assign-tree {
  max-height: 420px;
  padding: 8px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
}
</style>
