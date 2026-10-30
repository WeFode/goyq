<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  addEmployee,
  assignEmployeeAccount,
  deleteEmployee,
  employeeListQuery,
  updateEmployee
} from "@/api/employee";
import { deptTreeQuery } from "@/api/dept";
import { positionListQuery } from "@/api/position";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { useTable } from "@/composables/useTable";
import { downloadExcel } from "@/utils/export";

defineOptions({ name: "EMPLOYEE" });

/* ============ 列表 ============ */
const query = reactive<{
  employeeName: string;
  departmentId: string | undefined;
  employmentStatus: number | null;
}>({
  employeeName: "",
  departmentId: undefined,
  employmentStatus: null
});

const { loading, list, pagination, search, refresh, reset } = useTable({
  fetcher: params => employeeListQuery(params),
  query
});

const exporting = ref(false);

/** 按当前筛选条件导出员工花名册 */
async function handleExport() {
  exporting.value = true;
  try {
    await downloadExcel(
      "export/hr-employees",
      {
        keyword: query.employeeName || undefined,
        departmentId: query.departmentId || undefined,
        employmentStatus: query.employmentStatus ?? undefined
      },
      "员工花名册.xlsx"
    );
  } finally {
    exporting.value = false;
  }
}

/* ============ 字典 ============ */
const deptTree = ref<any[]>([]);
const positionOptions = ref<any[]>([]);

async function loadDicts() {
  try {
    const [deptRes, posRes]: any[] = await Promise.all([
      deptTreeQuery(),
      positionListQuery({ page: 1, pageSize: 200 })
    ]);
    deptTree.value = deptRes?.data?.tree ?? deptRes?.data ?? [];
    positionOptions.value = posRes?.data?.list ?? [];
  } catch (error) {
    console.error("加载部门/职位字典失败:", error);
  }
}

const deptName = (id: string) => {
  const walk = (nodes: any[]): string => {
    for (const node of nodes) {
      if (node.id === id) return node.deptName ?? node.name ?? "-";
      if (node.children?.length) {
        const found = walk(node.children);
        if (found) return found;
      }
    }
    return "";
  };
  return walk(deptTree.value) || "-";
};

const positionName = (id: string) =>
  positionOptions.value.find(item => item.id === id)?.positionName ?? "-";

/* ============ 新增 / 编辑 ============ */
const dialogVisible = ref(false);
const dialogTitle = ref("新增员工");
const submitting = ref(false);
const editId = ref<string | null>(null);
const formRef = ref<FormInstance>();

const form = reactive({
  employeeNumber: "",
  employeeName: "",
  /** 主部门 */
  primaryDeptId: undefined as string | undefined,
  /** 兼任部门 */
  extraDeptIds: [] as string[],
  positionId: undefined as string | undefined,
  hireDate: "",
  employmentStatus: 1,
  workEmail: "",
  workMobile: "",
  address: "",
  gender: 1
});

const rules: FormRules = {
  employeeName: [{ required: true, message: "请填写员工姓名", trigger: "blur" }],
  primaryDeptId: [
    { required: true, message: "请选择主部门", trigger: "change" }
  ],
  positionId: [{ required: true, message: "请选择职位", trigger: "change" }]
};

/** 列表主部门名称：后端返回 departments 数组 */
const primaryDeptName = (row: any) => {
  const list = row?.departments ?? [];
  const primary = list.find((item: any) => item.isPrimary) ?? list[0];
  return primary?.departmentName ?? "-";
};

const allDeptNames = (row: any) =>
  (row?.departments ?? []).map((item: any) => item.departmentName);

function openCreate() {
  editId.value = null;
  dialogTitle.value = "新增员工";
  Object.assign(form, {
    employeeNumber: "",
    employeeName: "",
    primaryDeptId: undefined,
    extraDeptIds: [],
    positionId: undefined,
    hireDate: "",
    employmentStatus: 1,
    workEmail: "",
    workMobile: "",
    address: "",
    gender: 1
  });
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editId.value = row.id;
  dialogTitle.value = "编辑员工";
  const depts = row.departments ?? [];
  const primary =
    depts.find((item: any) => item.isPrimary) ?? depts[0] ?? null;

  Object.assign(form, {
    employeeNumber: row.employeeNumber ?? "",
    employeeName: row.employeeName ?? "",
    primaryDeptId: primary?.departmentId,
    extraDeptIds: depts
      .filter((item: any) => item.departmentId !== primary?.departmentId)
      .map((item: any) => item.departmentId),
    positionId: row.positionId,
    hireDate: row.hireDate ?? "",
    employmentStatus: row.employmentStatus ?? 1,
    workEmail: row.workEmail ?? "",
    workMobile: row.workMobile ?? "",
    address: row.address ?? "",
    gender: row.gender ?? 1
  });
  dialogVisible.value = true;
}

function submit() {
  const formEl = formRef.value;
  if (!formEl) return;

  formEl.validate(async valid => {
    if (!valid) return;
    submitting.value = true;
    try {
      // 后端人员部门关系为多对多，通过 departments 数组提交
      const departments = [
        ...(form.primaryDeptId
          ? [{ departmentId: form.primaryDeptId, isPrimary: true }]
          : []),
        ...form.extraDeptIds.map((id: string) => ({
          departmentId: id,
          isPrimary: false
        }))
      ];

      const payload = {
        employeeNumber: form.employeeNumber,
        employeeName: form.employeeName,
        departments,
        positionId: form.positionId,
        hireDate: form.hireDate,
        employmentStatus: form.employmentStatus,
        workEmail: form.workEmail,
        workMobile: form.workMobile,
        address: form.address,
        gender: form.gender
      };

      if (editId.value) {
        await updateEmployee({ id: editId.value, ...payload });
        message("保存成功", { type: "success" });
      } else {
        await addEmployee(payload);
        message("新增成功", { type: "success" });
      }
      dialogVisible.value = false;
      refresh();
    } catch (error) {
      console.error("保存员工失败:", error);
    } finally {
      submitting.value = false;
    }
  });
}

async function handleDelete(row: any) {
  try {
    await deleteEmployee(row.id);
    message("删除成功", { type: "success" });
    refresh();
  } catch (error) {
    console.error("删除员工失败:", error);
  }
}

/* ============ 分配账号 ============ */
const accountVisible = ref(false);
const accountSubmitting = ref(false);
const accountTarget = ref<any>(null);
const accountForm = reactive({ username: "", password: "" });

function openAccount(row: any) {
  accountTarget.value = row;
  accountForm.username = row.workEmail?.split("@")[0] ?? row.employeeNumber ?? "";
  accountForm.password = "";
  accountVisible.value = true;
}

async function submitAccount() {
  if (!accountForm.username || !accountForm.password) {
    message("请填写账号与初始密码", { type: "warning" });
    return;
  }
  accountSubmitting.value = true;
  try {
    await assignEmployeeAccount({
      employeeId: accountTarget.value.id,
      username: accountForm.username,
      password: accountForm.password
    });
    message("账号分配成功", { type: "success" });
    accountVisible.value = false;
    refresh();
  } catch (error) {
    console.error("分配账号失败:", error);
  } finally {
    accountSubmitting.value = false;
  }
}

function resetQuery() {
  query.employeeName = "";
  query.departmentId = undefined;
  query.employmentStatus = null;
  reset();
}

onMounted(async () => {
  await loadDicts();
  search();
});
</script>

<template>
  <AppPage title="员工管理" description="维护员工档案、组织归属与登录账号">
    <template #actions>
      <el-button
        v-if="hasAuth('hr:employee:export')"
        :loading="exporting"
        @click="handleExport"
      >
        <AppIcon icon="ep:download" :size="14" />
        导出 Excel
      </el-button>
      <el-button
        v-if="hasAuth('hr:employee:add')"
        type="primary"
        @click="openCreate"
      >
        <AppIcon icon="ep:plus" :size="14" />
        新增员工
      </el-button>
    </template>

    <AppSearchBar :loading="loading" @search="search" @reset="resetQuery">
      <el-form-item label="员工姓名">
        <el-input
          v-model="query.employeeName"
          placeholder="请输入员工姓名"
          clearable
        />
      </el-form-item>
      <el-form-item label="所属部门">
        <el-tree-select
          v-model="query.departmentId"
          :data="deptTree"
          node-key="id"
          :props="{ label: 'deptName', children: 'children', value: 'id' }"
          placeholder="全部部门"
          clearable
          check-strictly
          class="employee-select"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.employmentStatus" placeholder="全部" clearable>
          <el-option label="在职" :value="1" />
          <el-option label="离职" :value="2" />
        </el-select>
      </el-form-item>
    </AppSearchBar>

    <AppDataTable
      :data="list"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无员工"
      @page-change="refresh"
    >
      <el-table-column label="员工姓名" min-width="150">
        <template #default="{ row }">
          <div class="employee-cell">
            <AppUserAvatar
              :name="row.employeeName"
              :avatar="row.avatar"
              :size="26"
            />
            <span class="app-text--strong">{{ row.employeeName }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="员工编号" prop="employeeNumber" width="130">
        <template #default="{ row }">
          {{ row.employeeNumber || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="所属部门" min-width="160">
        <template #default="{ row }">
          <div class="dept-cell">
            <el-tag
              v-for="name in allDeptNames(row)"
              :key="name"
              size="small"
              effect="plain"
            >
              {{ name }}
            </el-tag>
            <span v-if="!row.departments?.length" class="app-text--tertiary">
              -
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="职位" min-width="120">
        <template #default="{ row }">
          {{ row.positionName || positionName(row.positionId) }}
        </template>
      </el-table-column>
      <el-table-column label="手机号" prop="workMobile" width="130">
        <template #default="{ row }">
          {{ row.workMobile || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="入职日期" prop="hireDate" width="120">
        <template #default="{ row }">
          {{ row.hireDate || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <AppStatusTag
            :value="row.employmentStatus"
            :map="{
              1: { text: '在职', type: 'success', dot: true },
              2: { text: '离职', type: 'info', dot: true }
            }"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="hasAuth('hr:employee:edit')"
            link
            type="primary"
            @click="openEdit(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="hasAuth('hr:employee:account')"
            link
            type="primary"
            @click="openAccount(row)"
          >
            分配账号
          </el-button>
          <el-popconfirm
            v-if="hasAuth('hr:employee:delete')"
            :title="`确认删除员工「${row.employeeName}」？`"
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
      width="640px"
      @confirm="submit"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="员工姓名" prop="employeeName">
              <el-input v-model="form.employeeName" placeholder="请输入姓名" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="员工编号">
              <el-input v-model="form.employeeNumber" placeholder="可留空自动生成" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="主部门" prop="primaryDeptId">
              <el-tree-select
                v-model="form.primaryDeptId"
                :data="deptTree"
                node-key="id"
                :props="{ label: 'deptName', children: 'children', value: 'id' }"
                placeholder="请选择主部门"
                check-strictly
                class="w-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="兼任部门">
              <el-tree-select
                v-model="form.extraDeptIds"
                :data="deptTree"
                node-key="id"
                :props="{ label: 'deptName', children: 'children', value: 'id' }"
                placeholder="可多选"
                check-strictly
                multiple
                show-checkbox
                class="w-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="职位" prop="positionId">
              <el-select v-model="form.positionId" placeholder="请选择职位" class="w-full">
                <el-option
                  v-for="item in positionOptions"
                  :key="item.id"
                  :label="item.positionName"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入职日期">
              <el-date-picker
                v-model="form.hireDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择入职日期"
                class="w-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="在职状态">
              <el-select v-model="form.employmentStatus" class="w-full">
                <el-option label="在职" :value="1" />
                <el-option label="离职" :value="2" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="工作邮箱">
              <el-input v-model="form.workEmail" placeholder="请输入工作邮箱" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号">
              <el-input v-model="form.workMobile" placeholder="请输入手机号" clearable />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </AppFormDialog>

    <!-- 分配账号 -->
    <AppFormDialog
      v-model="accountVisible"
      :title="`分配账号 · ${accountTarget?.employeeName ?? ''}`"
      :loading="accountSubmitting"
      width="480px"
      @confirm="submitAccount"
    >
      <el-form label-width="88px">
        <el-form-item label="登录账号" required>
          <el-input v-model="accountForm.username" placeholder="请输入登录账号" clearable />
        </el-form-item>
        <el-form-item label="初始密码" required>
          <el-input
            v-model="accountForm.password"
            type="password"
            placeholder="请输入初始密码（至少 6 位）"
            show-password
          />
        </el-form-item>
      </el-form>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="账号将绑定该员工档案，员工可使用该账号登录系统"
      />
    </AppFormDialog>
  </AppPage>
</template>

<style scoped lang="scss">
.employee-cell {
  display: flex;
  gap: 8px;
  align-items: center;
}

.dept-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.employee-select {
  width: 200px !important;
}
</style>
