<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  addDept,
  deleteDept,
  deptListQuery,
  updateDept
} from "@/api/dept";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { handleTree } from "@/utils/tree";

defineOptions({ name: "DEPT" });

/* ============ 列表 ============ */
const loading = ref(false);
const treeData = ref<any[]>([]);
const keyword = ref("");

async function load() {
  loading.value = true;
  try {
    const res: any = await deptListQuery({ page: 1, pageSize: 500 });
    const list = res?.data?.list ?? res?.data ?? [];
    treeData.value = Array.isArray(list)
      ? handleTree(list, "id", "parentId")
      : [];
  } catch (error) {
    console.error("加载部门失败:", error);
  } finally {
    loading.value = false;
  }
}

const filteredTree = computed(() => {
  const key = keyword.value.trim();
  if (!key) return treeData.value;
  const filter = (nodes: any[]): any[] =>
    nodes
      .map(node => {
        const children = node.children ? filter(node.children) : [];
        const matched = String(node.deptName ?? "").includes(key);
        return matched || children.length ? { ...node, children } : null;
      })
      .filter(Boolean);
  return filter(treeData.value);
});

const parentOptions = computed(() => {
  const flatten = (nodes: any[], depth = 0): any[] =>
    nodes.flatMap(node => [
      {
        id: node.id,
        label: `${"— ".repeat(depth)}${node.deptName}`
      },
      ...(node.children ? flatten(node.children, depth + 1) : [])
    ]);
  return flatten(treeData.value);
});

/* ============ 新增 / 编辑 ============ */
const dialogVisible = ref(false);
const dialogTitle = ref("新增部门");
const submitting = ref(false);
const editId = ref<string | null>(null);
const formRef = ref<FormInstance>();

const form = reactive({
  parentId: null as string | null,
  deptName: "",
  deptCode: "",
  sortOrder: 0,
  status: true
});

const rules: FormRules = {
  deptName: [{ required: true, message: "请填写部门名称", trigger: "blur" }]
};

function openCreate(parent?: any) {
  editId.value = null;
  dialogTitle.value = "新增部门";
  form.parentId = parent?.id ?? null;
  form.deptName = "";
  form.deptCode = "";
  form.sortOrder = 0;
  form.status = true;
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editId.value = row.id;
  dialogTitle.value = "编辑部门";
  form.parentId = row.parentId ?? null;
  form.deptName = row.deptName ?? "";
  form.deptCode = row.deptCode ?? "";
  form.sortOrder = row.sortOrder ?? 0;
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
        await updateDept({ id: editId.value, ...form });
        message("保存成功", { type: "success" });
      } else {
        await addDept({ ...form });
        message("新增成功", { type: "success" });
      }
      dialogVisible.value = false;
      load();
    } catch (error) {
      console.error("保存部门失败:", error);
    } finally {
      submitting.value = false;
    }
  });
}

async function handleDelete(row: any) {
  try {
    await deleteDept(row.id);
    message("删除成功", { type: "success" });
    load();
  } catch (error) {
    console.error("删除部门失败:", error);
  }
}

onMounted(load);
</script>

<template>
  <AppPage title="部门管理" description="维护组织架构层级与部门负责人">
    <template #actions>
      <el-input
        v-model="keyword"
        placeholder="搜索部门名称"
        clearable
        class="dept-search"
      />
      <el-button v-if="hasAuth('hr:dept:add')" type="primary" @click="openCreate()">
        <AppIcon icon="ep:plus" :size="14" />
        新增部门
      </el-button>
    </template>

    <AppDataTable
      :data="filteredTree"
      :loading="loading"
      row-key="id"
      :show-pagination="false"
      empty-text="暂无部门"
    >
      <el-table-column label="部门名称" min-width="220">
        <template #default="{ row }">
          <span class="app-text--strong">{{ row.deptName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="部门编码" prop="deptCode" width="160">
        <template #default="{ row }">
          <span class="app-text--secondary">{{ row.deptCode || "-" }}</span>
        </template>
      </el-table-column>
      <el-table-column label="排序" prop="sortOrder" width="90" align="center" />
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <AppStatusTag
            :value="row.status ? 1 : 0"
            :map="{
              1: { text: '正常', type: 'success', dot: true },
              0: { text: '禁用', type: 'info', dot: true }
            }"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="hasAuth('hr:dept:add')"
            link
            type="primary"
            @click="openCreate(row)"
          >
            新增子部门
          </el-button>
          <el-button
            v-if="hasAuth('hr:dept:edit')"
            link
            type="primary"
            @click="openEdit(row)"
          >
            编辑
          </el-button>
          <el-popconfirm
            v-if="hasAuth('hr:dept:delete')"
            :title="`确认删除部门「${row.deptName}」？`"
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
      width="560px"
      @confirm="submit"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-form-item label="上级部门">
          <el-select v-model="form.parentId" placeholder="顶级部门" clearable class="w-full">
            <el-option label="顶级部门" :value="null" />
            <el-option
              v-for="item in parentOptions"
              :key="item.id"
              :label="item.label"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="部门名称" prop="deptName">
          <el-input v-model="form.deptName" placeholder="请输入部门名称" clearable />
        </el-form-item>
        <el-form-item label="部门编码">
          <el-input v-model="form.deptCode" placeholder="用于集成对接，可留空" clearable />
        </el-form-item>
        <el-form-item label="显示排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="999" class="w-full" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" active-text="正常" inactive-text="禁用" />
        </el-form-item>
      </el-form>
    </AppFormDialog>
  </AppPage>
</template>

<style scoped>
.dept-search {
  width: 200px;
}
</style>
