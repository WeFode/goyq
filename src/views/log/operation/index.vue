<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import {
  deleteOperationLog,
  logsOperationListQuery
} from "@/api/logOperation";
import { hasAuth } from "@/router/utils";
import AuditVerifyButton from "@/components/audit/AuditVerifyButton.vue";
import { message } from "@/utils/message";
import { downloadExcel } from "@/utils/export";

defineOptions({ name: "SystemOperationLog" });

/* ============ 列表 ============ */
const loading = ref(false);
const list = ref<any[]>([]);
const selected = ref<any[]>([]);
const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
});

const query = reactive({
  username: "",
  module: undefined as string | undefined,
  dateRange: [] as string[]
});

/** 模块下拉：与后端 module_name 保持一致 */
const moduleOptions = [
  "账号管理",
  "角色管理",
  "菜单管理",
  "权限管理",
  "员工管理",
  "部门管理",
  "职位管理",
  "邀请码管理",
  "流程管理",
  "审批实例",
  "审批任务",
  "通知公告"
];

async function load() {
  loading.value = true;
  try {
    const res: any = await logsOperationListQuery({
      pageNum: pagination.currentPage,
      pageSize: pagination.pageSize,
      username: query.username || undefined,
      module: query.module || undefined,
      startTime: query.dateRange?.[0] || undefined,
      endTime: query.dateRange?.[1] || undefined
    });
    list.value = res?.data?.list ?? [];
    pagination.total = res?.data?.total ?? 0;
  } catch (error: any) {
    console.error("加载操作日志失败:", error);
  } finally {
    loading.value = false;
  }
}

function search() {
  pagination.currentPage = 1;
  load();
}

function resetQuery() {
  query.username = "";
  query.module = undefined;
  query.dateRange = [];
  search();
}

function onSelectionChange(rows: any[]) {
  selected.value = rows;
}

async function handleBatchDelete() {
  if (!selected.value.length) return;
  try {
    await deleteOperationLog(selected.value.map(row => row.id));
    message("删除成功", { type: "success" });
    load();
  } catch (error) {
    console.error("删除操作日志失败:", error);
  }
}

const exporting = ref(false);

/** 按当前筛选条件导出，与列表保持同一口径 */
async function handleExport() {
  exporting.value = true;
  try {
    await downloadExcel(
      "export/operation-logs",
      {
        module: query.module || undefined,
        keyword: query.username || undefined,
        startAt: query.dateRange?.[0] || undefined,
        endAt: query.dateRange?.[1] || undefined
      },
      "操作日志.xlsx"
    );
  } finally {
    exporting.value = false;
  }
}

const formatTime = (value: any) => {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD HH:mm:ss") : String(value);
};

const resultMap = {
  "1": { text: "成功", type: "success" as const, dot: true },
  "0": { text: "失败", type: "danger" as const, dot: true }
};

onMounted(load);
</script>

<template>
  <AppPage title="操作日志" description="记录关键业务操作，用于审计与问题追溯；开启哈希链后可校验记录是否被篡改">
    <template #actions>
      <AuditVerifyButton type="operation" />
      <el-button
        v-if="hasAuth('system:operation:export')"
        :loading="exporting"
        @click="handleExport"
      >
        <AppIcon icon="ep:download" :size="14" />
        导出 Excel
      </el-button>
    </template>

    <AppSearchBar :loading="loading" @search="search" @reset="resetQuery">
      <el-form-item label="操作人">
        <el-input v-model="query.username" placeholder="请输入操作人" clearable />
      </el-form-item>
      <el-form-item label="操作模块">
        <el-select v-model="query.module" placeholder="全部模块" clearable>
          <el-option
            v-for="item in moduleOptions"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="操作时间">
        <el-date-picker
          v-model="query.dateRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
        />
      </el-form-item>
    </AppSearchBar>

    <AppDataTable
      :data="list"
      :loading="loading"
      :pagination="pagination"
      :selected-num="selected.length"
      selection
      empty-text="暂无操作日志"
      @selection-change="onSelectionChange"
      @page-change="load"
    >
      <template #batch>
        <el-button
          v-if="hasAuth('system:operation:delete')"
          type="danger"
          link
          @click="handleBatchDelete"
        >
          批量删除
        </el-button>
      </template>

      <el-table-column label="操作人" prop="username" min-width="130">
        <template #default="{ row }">
          <span class="app-text--strong">{{ row.username || "-" }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作模块" prop="moduleName" min-width="140">
        <template #default="{ row }">
          {{ row.moduleName || row.module || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="操作内容" prop="summary" min-width="260">
        <template #default="{ row }">
          <span class="app-text--secondary">
            {{ row.summary || row.description || row.method || "-" }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="IP 地址" prop="ip" width="140">
        <template #default="{ row }">
          {{ row.ip || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="耗时" width="100" align="center">
        <template #default="{ row }">
          {{ (row.duration ?? row.costTime) != null ? `${row.duration ?? row.costTime} ms` : "-" }}
        </template>
      </el-table-column>
      <el-table-column label="结果" width="100" align="center">
        <template #default="{ row }">
          <AppStatusTag
            :value="String(row.status ?? row.success ?? 1)"
            :map="resultMap"
            fallback="成功"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.createdAt ?? row.operateTime) }}
        </template>
      </el-table-column>
    </AppDataTable>
  </AppPage>
</template>
