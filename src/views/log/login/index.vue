<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import { deleteLoginLog, logsLoginListQuery } from "@/api/logLogin";
import AuditVerifyButton from "@/components/audit/AuditVerifyButton.vue";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { downloadExcel } from "@/utils/export";

defineOptions({ name: "SystemLoginLog" });

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
  ip: "",
  dateRange: [] as string[]
});

async function load() {
  loading.value = true;
  try {
    const res: any = await logsLoginListQuery({
      pageNum: pagination.currentPage,
      pageSize: pagination.pageSize,
      username: query.username || undefined,
      ip: query.ip || undefined,
      startTime: query.dateRange?.[0] || undefined,
      endTime: query.dateRange?.[1] || undefined
    });
    list.value = res?.data?.list ?? [];
    pagination.total = res?.data?.total ?? 0;
  } catch (error: any) {
    console.error("加载登录日志失败:", error);
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
  query.ip = "";
  query.dateRange = [];
  search();
}

function onSelectionChange(rows: any[]) {
  selected.value = rows;
}

async function handleBatchDelete() {
  if (!selected.value.length) return;
  try {
    await deleteLoginLog(selected.value.map(row => row.id));
    message("删除成功", { type: "success" });
    load();
  } catch (error) {
    console.error("删除登录日志失败:", error);
  }
}

const exporting = ref(false);

/** 按当前筛选条件导出（后端 keyword 同时匹配账号与 IP） */
async function handleExport() {
  exporting.value = true;
  try {
    await downloadExcel(
      "export/login-logs",
      {
        keyword: query.username || query.ip || undefined,
        startAt: query.dateRange?.[0] || undefined,
        endAt: query.dateRange?.[1] || undefined
      },
      "登录日志.xlsx"
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

const statusMap = {
  "1": { text: "成功", type: "success" as const, dot: true },
  "0": { text: "失败", type: "danger" as const, dot: true }
};

onMounted(load);
</script>

<template>
  <AppPage title="登录日志" description="记录账号登录时间、IP 与登录结果；开启哈希链后可校验记录是否被篡改">
    <template #actions>
      <AuditVerifyButton type="login" />
      <el-button
        v-if="hasAuth('system:login:export')"
        :loading="exporting"
        @click="handleExport"
      >
        <AppIcon icon="ep:download" :size="14" />
        导出 Excel
      </el-button>
    </template>

    <AppSearchBar :loading="loading" @search="search" @reset="resetQuery">
      <el-form-item label="账号">
        <el-input v-model="query.username" placeholder="请输入账号" clearable />
      </el-form-item>
      <el-form-item label="IP 地址">
        <el-input v-model="query.ip" placeholder="请输入 IP" clearable />
      </el-form-item>
      <el-form-item label="登录时间">
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
      :show-pagination="true"
      empty-text="暂无登录日志"
      @selection-change="onSelectionChange"
      @page-change="load"
    >
      <template #batch>
        <el-button
          v-if="hasAuth('system:login:delete')"
          type="danger"
          link
          @click="handleBatchDelete"
        >
          批量删除
        </el-button>
      </template>

      <el-table-column label="账号" prop="username" min-width="140">
        <template #default="{ row }">
          <span class="app-text--strong">{{ row.username || "-" }}</span>
        </template>
      </el-table-column>
      <el-table-column label="IP 地址" prop="ip" min-width="140" />
      <el-table-column label="登录地点" prop="address" min-width="160">
        <template #default="{ row }">
          {{ row.address || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="浏览器" prop="browser" min-width="140">
        <template #default="{ row }">
          {{ row.browser || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="操作系统" prop="os" min-width="130">
        <template #default="{ row }">
          {{ row.os || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <AppStatusTag
            :value="String(row.status ?? 1)"
            :map="statusMap"
            fallback="成功"
          />
        </template>
      </el-table-column>
      <el-table-column label="登录时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.createdAt ?? row.loginTime) }}
        </template>
      </el-table-column>
    </AppDataTable>
  </AppPage>
</template>
