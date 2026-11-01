<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessageBox } from "element-plus";
import {
  addWorkflow,
  deleteWorkflow,
  getWorkflowDetail,
  getWorkflowList,
  updateWorkflow
} from "@/api/workflow";
import { getFormList } from "@/api/form";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { groupOptions } from "@/utils/workflow";
import { useTable } from "@/composables/useTable";

defineOptions({ name: "EngineWorkFlow" });

const router = useRouter();

/* ============ 列表 ============ */
const query = reactive<{ name: string; groupName: string }>({
  name: "",
  groupName: ""
});

const {
  loading,
  list,
  pagination,
  search,
  refresh,
  reset
} = useTable({
  fetcher: params => getWorkflowList(params),
  query
});

const formOptions = ref<any[]>([]);

async function loadFormOptions() {
  try {
    const res: any = await getFormList({ page: 1, pageSize: 100 });
    formOptions.value = res?.data?.list ?? [];
  } catch (error) {
    console.error("加载表单列表失败:", error);
  }
}

const formName = (formDesignId: any) =>
  formOptions.value.find(item => item.id === formDesignId)?.name ?? "-";

function nodeCount(processConfig: string) {
  if (!processConfig) return 0;
  try {
    return JSON.parse(processConfig).nodes?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * 审批节点数量。新建时后端只落一个发起节点骨架，
 * 所以“节点数 > 0”并不等于“流程可用”：没有审批节点的流程发起时会被后端拦住，
 * 列表里必须单独把这个状态说清楚，否则用户会以为建完就能用。
 */
function approveNodeCount(processConfig: string) {
  if (!processConfig) return 0;
  try {
    const nodes = JSON.parse(processConfig).nodes ?? [];
    return nodes.filter((node: any) => node.type === "approve").length;
  } catch {
    return 0;
  }
}

/* ============ 新增 / 编辑基础信息 ============ */
const dialogVisible = ref(false);
const dialogTitle = ref("新增工作流");
const submitting = ref(false);
const editId = ref<number | null>(null);
const formRef = ref<FormInstance>();

const form = reactive({
  name: "",
  groupName: "",
  formDesignId: undefined as any,
  isEnabled: true
});

const rules: FormRules = {
  name: [{ required: true, message: "请填写流程名称", trigger: "blur" }],
  // 后端 formDesignId 必填（审批单的数据载体），不标出来会直接吃一个接口错误
  formDesignId: [
    { required: true, message: "请选择关联表单", trigger: "change" }
  ]
};

function openCreate() {
  editId.value = null;
  dialogTitle.value = "新增工作流";
  form.name = "";
  form.groupName = "";
  form.formDesignId = undefined;
  form.isEnabled = true;
  dialogVisible.value = true;
}

async function openEdit(row: any) {
  editId.value = row.id;
  dialogTitle.value = "编辑工作流";
  try {
    const res: any = await getWorkflowDetail(row.id);
    const definition = res?.data?.definition ?? res?.data ?? row;
    form.name = definition.name ?? "";
    form.groupName = definition.groupName ?? "";
    form.formDesignId = definition.formDesignId;
    form.isEnabled = definition.isEnabled ?? true;
    dialogVisible.value = true;
  } catch (error) {
    console.error("加载流程失败:", error);
  }
}

async function submit() {
  const formEl = formRef.value;
  if (!formEl) return;

  await formEl.validate(async valid => {
    if (!valid) return;
    submitting.value = true;
    try {
      const payload = {
        name: form.name,
        groupName: form.groupName,
        formDesignId: form.formDesignId,
        isEnabled: form.isEnabled
      };
      if (editId.value) {
        await updateWorkflow(editId.value, payload);
        message("保存成功", { type: "success" });
      } else {
        const res: any = await addWorkflow(payload);
        const createdId = res?.data?.id ?? "";
        dialogVisible.value = false;
        refresh();
        // 流程只建了壳，不引导一下用户会不知道去哪里画节点
        if (createdId) {
          try {
            await ElMessageBox.confirm(
              "流程已创建，当前还没有审批节点，无法发起审批。现在去设计流程节点？",
              "新增成功",
              { confirmButtonText: "去设计流程", cancelButtonText: "稍后再说", type: "success" }
            );
            router.push({
              path: "/engine/designer/index",
              query: { id: createdId }
            });
          } catch {
            /* 选择稍后再说，停在列表 */
          }
          return;
        }
        message("新增成功，请继续配置流程节点", { type: "success" });
      }
      dialogVisible.value = false;
      refresh();
    } catch (error) {
      console.error("保存流程失败:", error);
    } finally {
      submitting.value = false;
    }
  });
}

/* ============ 状态切换 ============ */
const statusLoading = reactive<Record<string, boolean>>({});

async function toggleStatus(row: any) {
  statusLoading[row.id] = true;
  try {
    await updateWorkflow(row.id, {
      name: row.name,
      groupName: row.groupName,
      formDesignId: row.formDesignId,
      processConfig: row.processConfig,
      startNodeConfig: row.startNodeConfig,
      isEnabled: row.isEnabled
    });
    message(`${row.isEnabled ? "启用" : "停用"}成功`, { type: "success" });
  } catch (error) {
    row.isEnabled = !row.isEnabled;
    message(`${row.isEnabled ? "启用" : "停用"}失败`, { type: "error" });
  } finally {
    statusLoading[row.id] = false;
  }
}

/* ============ 复制 / 删除 / 设计 ============ */
async function handleCopy(row: any) {
  try {
    const res: any = await getWorkflowDetail(row.id);
    const definition = res?.data?.definition ?? res?.data ?? row;
    await addWorkflow({
      name: `${definition.name}-副本`,
      groupName: definition.groupName,
      formDesignId: definition.formDesignId,
      processConfig: definition.processConfig,
      startNodeConfig: definition.startNodeConfig,
      isEnabled: false
    });
    message("复制成功", { type: "success" });
    refresh();
  } catch (error) {
    console.error("复制流程失败:", error);
  }
}

async function handleDelete(row: any) {
  try {
    await deleteWorkflow(row.id);
    message("删除成功", { type: "success" });
    refresh();
  } catch (error) {
    console.error("删除流程失败:", error);
  }
}

function openDesigner(row: any) {
  router.push({ path: "/engine/designer/index", query: { id: row.id } });
}

function resetQuery() {
  query.name = "";
  query.groupName = "";
  reset();
}

onMounted(() => {
  loadFormOptions();
  search();
});
</script>

<template>
  <AppPage title="流程管理" description="维护审批流程定义、分组与启用状态">
    <template #actions>
      <el-button v-if="hasAuth('engine:workflow:add')" type="primary" @click="openCreate">
        <AppIcon icon="ep:plus" :size="14" />
        新增流程
      </el-button>
    </template>

    <AppSearchBar :loading="loading" @search="search" @reset="resetQuery">
      <el-form-item label="流程名称">
        <el-input v-model="query.name" placeholder="请输入流程名称" clearable />
      </el-form-item>
      <el-form-item label="流程分组">
        <el-select v-model="query.groupName" placeholder="全部" clearable>
          <el-option
            v-for="group in groupOptions"
            :key="group.value"
            :label="group.label"
            :value="group.value"
          />
        </el-select>
      </el-form-item>
    </AppSearchBar>

    <AppDataTable
      :data="list"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无流程"
      @page-change="refresh"
    >
      <el-table-column label="流程名称" prop="name" min-width="180">
        <template #default="{ row }">
          <span class="app-text--strong">{{ row.name }}</span>
        </template>
      </el-table-column>

      <el-table-column label="分组" prop="groupName" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.groupName" size="small" effect="plain">
            {{ row.groupName }}
          </el-tag>
          <span v-else class="app-text--tertiary">-</span>
        </template>
      </el-table-column>

      <el-table-column label="关联表单" width="160">
        <template #default="{ row }">
          {{ formName(row.formDesignId) }}
        </template>
      </el-table-column>

      <el-table-column label="节点数" width="110" align="center">
        <template #default="{ row }">
          <el-tag v-if="!approveNodeCount(row.processConfig)" type="warning" size="small">
            未配置流程
          </el-tag>
          <span v-else>{{ nodeCount(row.processConfig) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.isEnabled"
            :loading="statusLoading[row.id]"
            :disabled="!hasAuth('engine:workflow:edit')"
            @change="toggleStatus(row)"
          />
        </template>
      </el-table-column>

      <el-table-column label="更新时间" prop="updatedAt" width="170" />

      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="hasAuth('engine:workflow:edit')"
            link
            type="primary"
            @click="openDesigner(row)"
          >
            设计流程
          </el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="primary" @click="handleCopy(row)">复制</el-button>
          <el-popconfirm
            v-if="hasAuth('engine:workflow:delete')"
            :title="`确认删除流程「${row.name}」？`"
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
        <el-form-item label="流程名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入流程名称" clearable />
        </el-form-item>
        <el-form-item label="流程分组">
          <el-select v-model="form.groupName" placeholder="请选择分组" clearable class="w-full">
            <el-option
              v-for="group in groupOptions"
              :key="group.value"
              :label="group.label"
              :value="group.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关联表单">
          <el-select
            v-model="form.formDesignId"
            placeholder="请选择关联表单"
            clearable
            class="w-full"
          >
            <el-option
              v-for="item in formOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="form.isEnabled" />
        </el-form-item>
      </el-form>
    </AppFormDialog>
  </AppPage>
</template>
