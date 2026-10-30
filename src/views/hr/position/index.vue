<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  addPosition,
  deletePosition,
  positionListQuery,
  updatePosition
} from "@/api/position";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { useTable } from "@/composables/useTable";

defineOptions({ name: "POSITION" });

/* ============ 列表 ============ */
const query = reactive<{ positionName: string; status: boolean | null }>({
  positionName: "",
  status: null
});

const { loading, list, pagination, search, refresh, reset } = useTable({
  fetcher: params => positionListQuery(params),
  query
});

/* ============ 新增 / 编辑 ============ */
const dialogVisible = ref(false);
const dialogTitle = ref("新增职位");
const submitting = ref(false);
const editId = ref<string | null>(null);
const formRef = ref<FormInstance>();

const form = reactive({
  positionName: "",
  description: "",
  status: true
});

const rules: FormRules = {
  positionName: [{ required: true, message: "请填写职位名称", trigger: "blur" }]
};

function openCreate() {
  editId.value = null;
  dialogTitle.value = "新增职位";
  form.positionName = "";
  form.description = "";
  form.status = true;
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editId.value = row.id;
  dialogTitle.value = "编辑职位";
  form.positionName = row.positionName ?? "";
  form.description = row.description ?? "";
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
        await updatePosition({ id: editId.value, ...form });
        message("保存成功", { type: "success" });
      } else {
        await addPosition({ ...form });
        message("新增成功", { type: "success" });
      }
      dialogVisible.value = false;
      refresh();
    } catch (error) {
      console.error("保存职位失败:", error);
    } finally {
      submitting.value = false;
    }
  });
}

async function handleDelete(row: any) {
  try {
    await deletePosition(row.id);
    message("删除成功", { type: "success" });
    refresh();
  } catch (error) {
    console.error("删除职位失败:", error);
  }
}

function resetQuery() {
  query.positionName = "";
  query.status = null;
  reset();
}

onMounted(() => search());
</script>

<template>
  <AppPage title="职位管理" description="维护公司职位字典，供员工档案选择">
    <template #actions>
      <el-button
        v-if="hasAuth('hr:post:add')"
        type="primary"
        @click="openCreate"
      >
        <AppIcon icon="ep:plus" :size="14" />
        新增职位
      </el-button>
    </template>

    <AppSearchBar :loading="loading" @search="search" @reset="resetQuery">
      <el-form-item label="职位名称">
        <el-input
          v-model="query.positionName"
          placeholder="请输入职位名称"
          clearable
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable>
          <el-option label="正常" :value="true" />
          <el-option label="禁用" :value="false" />
        </el-select>
      </el-form-item>
    </AppSearchBar>

    <AppDataTable
      :data="list"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无职位"
      @page-change="refresh"
    >
      <el-table-column label="职位名称" prop="positionName" min-width="180">
        <template #default="{ row }">
          <span class="app-text--strong">{{ row.positionName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="描述" prop="description" min-width="260">
        <template #default="{ row }">
          <span class="app-text--secondary">{{ row.description || "-" }}</span>
        </template>
      </el-table-column>
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
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="hasAuth('hr:post:edit')"
            link
            type="primary"
            @click="openEdit(row)"
          >
            编辑
          </el-button>
          <el-popconfirm
            v-if="hasAuth('hr:post:delete')"
            :title="`确认删除职位「${row.positionName}」？`"
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
        <el-form-item label="职位名称" prop="positionName">
          <el-input v-model="form.positionName" placeholder="如 软件工程师" clearable />
        </el-form-item>
        <el-form-item label="职位描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入职位职责说明"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" active-text="正常" inactive-text="禁用" />
        </el-form-item>
      </el-form>
    </AppFormDialog>
  </AppPage>
</template>
