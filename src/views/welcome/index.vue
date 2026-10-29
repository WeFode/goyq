<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import dayjs from "dayjs";
import { getDashboardOverview } from "@/api/dashboard";
import { getMyWorkCount, getWorkflowList } from "@/api/workflow";
import { useUserStoreHook } from "@/store/modules/user";
import { WORKFLOW_STATUS } from "@/utils/dicts";
import TrendChart from "@/components/charts/TrendChart.vue";
import DonutChart from "@/components/charts/DonutChart.vue";
import BarList from "@/components/charts/BarList.vue";

defineOptions({ name: "Welcome" });

const router = useRouter();
const userStore = useUserStoreHook();

const loading = ref(false);
const overview = ref<any>(null);
const workCount = ref<any>({});
const workflowList = ref<any[]>([]);

/* ============ 基础信息 ============ */
const nickname = computed(
  () => userStore.nickname || userStore.username || "用户"
);

const primaryDepartmentName = computed(() => {
  const list = userStore.departments ?? [];
  const primary = list.find((item: any) => item.isPrimary) ?? list[0];
  return primary?.departmentName ?? "";
});

const today = computed(() => dayjs().format("YYYY年M月D日 dddd"));

const greeting = computed(() => {
  const hour = dayjs().hour();
  if (hour < 6) return "夜深了";
  if (hour < 9) return "早上好";
  if (hour < 12) return "上午好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
});

/* ============ 看板数据 ============ */
const summary = computed(() => overview.value?.summary ?? {});

const trend = computed(() => overview.value?.trend ?? []);

const STATUS_COLOR: Record<string, string> = {
  approved: "var(--app-success)",
  rejected: "var(--app-danger)",
  pending: "var(--app-warning)",
  in_progress: "var(--app-primary)",
  cancelled: "var(--app-text-4)"
};

const statusItems = computed(() =>
  (overview.value?.statusDistribution ?? []).map((item: any) => ({
    label: WORKFLOW_STATUS[item.status]?.text ?? "未知状态",
    value: item.count,
    color: STATUS_COLOR[item.status] ?? "var(--app-text-4)"
  }))
);

const statusTotal = computed(() =>
  statusItems.value.reduce((sum: number, item: any) => sum + item.value, 0)
);

const deptItems = computed(() =>
  (overview.value?.departmentHeadcount ?? []).map((item: any) => ({
    name: item.name,
    value: item.count
  }))
);

const rankingItems = computed(() =>
  (overview.value?.workflowRanking ?? []).map((item: any) => ({
    name: item.name,
    value: item.count
  }))
);

const recentApprovals = computed(() => overview.value?.recentApprovals ?? []);

const kpis = computed(() => [
  {
    key: "employee",
    label: "在职员工",
    value: summary.value.employeeCount ?? 0,
    hint: `${summary.value.departmentCount ?? 0} 个部门`,
    icon: "ep:user"
  },
  {
    key: "submitted",
    label: "本月发起",
    value: summary.value.monthSubmitted ?? 0,
    hint: `今日 +${summary.value.todaySubmitted ?? 0}`,
    icon: "ep:document"
  },
  {
    key: "completed",
    label: "本月完成",
    value: summary.value.monthCompleted ?? 0,
    hint: `${summary.value.inProgressCount ?? 0} 条审批中`,
    icon: "ep:circle-check"
  },
  {
    key: "rate",
    label: "审批通过率",
    value: `${Math.round(summary.value.approvalRate ?? 0)}%`,
    hint: "近 30 天口径",
    icon: "ep:data-line"
  }
]);

const pendingTaskCount = computed(() => workCount.value.pendingTaskCount ?? 0);

const quickEntries = computed(() =>
  workflowList.value.filter((item: any) => item.isEnabled === true).slice(0, 8)
);

function statusMeta(status: string) {
  return WORKFLOW_STATUS[status] ?? { text: "未知状态", type: "info" };
}

function goTodo() {
  router.push({ path: "/engine/instance/index", query: { tab: "todo" } });
}

function goQuickEntry(workflow: any) {
  router.push({ path: "/engine/instance/index", query: { id: workflow.id } });
}

function openInstance(item: any) {
  router.push({
    path: "/engine/instance/index",
    query: { instanceId: item.id }
  });
}

async function loadOverview() {
  const res: any = await getDashboardOverview({ days: 14 });
  overview.value = res?.data ?? null;
}

async function loadWorkCount() {
  try {
    const res: any = await getMyWorkCount();
    workCount.value = res?.data?.workCount ?? {};
  } catch (error) {
    console.warn("加载待办统计失败:", error);
  }
}

async function loadWorkflowList() {
  try {
    const res: any = await getWorkflowList({ page: 1, pageSize: 50 });
    if (res?.data?.list) workflowList.value = res.data.list;
  } catch (error) {
    console.warn("加载流程列表失败:", error);
  }
}

onMounted(async () => {
  loading.value = true;
  await Promise.all([loadOverview(), loadWorkCount(), loadWorkflowList()]);
  loading.value = false;
});
</script>

<template>
  <div v-loading="loading" class="welcome">
    <!-- 欢迎条 -->
    <section class="welcome__hero">
      <div class="welcome__hero-text">
        <h1 class="welcome__greeting">{{ greeting }}，{{ nickname }}</h1>
        <p class="welcome__meta">
          <span>{{ today }}</span>
          <span v-if="primaryDepartmentName" class="welcome__meta-dept">
            {{ primaryDepartmentName }}
          </span>
        </p>
      </div>
      <div class="welcome__hero-actions">
        <el-button type="primary" @click="goTodo">
          <AppIcon icon="ep:timer" :size="14" />
          去处理待办
          <span v-if="pendingTaskCount" class="welcome__badge">
            {{ pendingTaskCount }}
          </span>
        </el-button>
      </div>
    </section>

    <!-- KPI 指标条 -->
    <section class="welcome__kpis">
      <div v-for="item in kpis" :key="item.key" class="welcome__kpi">
        <span class="welcome__kpi-label">
          <AppIcon :icon="item.icon" :size="13" />
          {{ item.label }}
        </span>
        <span class="welcome__kpi-value">{{ item.value }}</span>
        <span class="welcome__kpi-hint">{{ item.hint }}</span>
      </div>
    </section>

    <!-- 趋势 + 状态分布 -->
    <section class="welcome__grid welcome__grid--main">
      <article class="welcome__panel">
        <header class="welcome__panel-header">
          <div>
            <h2 class="welcome__panel-title">审批趋势</h2>
            <p class="welcome__panel-desc">近 14 天发起与完成数量</p>
          </div>
          <div class="welcome__legend">
            <span><i class="is-primary" />发起</span>
            <span><i class="is-success" />完成</span>
          </div>
        </header>
        <TrendChart v-if="trend.length" :data="trend" :height="236" />
        <AppEmpty v-else description="暂无审批数据" :image-size="88" />
      </article>

      <article class="welcome__panel">
        <header class="welcome__panel-header">
          <div>
            <h2 class="welcome__panel-title">审批状态分布</h2>
            <p class="welcome__panel-desc">累计 {{ statusTotal }} 条流程</p>
          </div>
        </header>
        <DonutChart
          v-if="statusItems.length"
          :items="statusItems"
          :size="164"
          center-label="流程数"
        />
        <AppEmpty v-else description="暂无流程" :image-size="88" />
      </article>
    </section>

    <!-- 部门 / 流程排行 / 最近动态 -->
    <section class="welcome__grid welcome__grid--sub">
      <article class="welcome__panel">
        <header class="welcome__panel-header">
          <div>
            <h2 class="welcome__panel-title">部门人数</h2>
            <p class="welcome__panel-desc">主部门口径 · 在职</p>
          </div>
        </header>
        <BarList v-if="deptItems.length" :items="deptItems" />
        <AppEmpty v-else description="暂无部门数据" :image-size="72" />
      </article>

      <article class="welcome__panel">
        <header class="welcome__panel-header">
          <div>
            <h2 class="welcome__panel-title">流程使用排行</h2>
            <p class="welcome__panel-desc">按累计发起量</p>
          </div>
        </header>
        <BarList v-if="rankingItems.length" :items="rankingItems" tone="success" />
        <AppEmpty v-else description="暂无流程数据" :image-size="72" />
      </article>

      <article class="welcome__panel">
        <header class="welcome__panel-header">
          <div>
            <h2 class="welcome__panel-title">最近审批动态</h2>
            <p class="welcome__panel-desc">点击查看详情</p>
          </div>
        </header>
        <div v-if="recentApprovals.length" class="welcome__recent-list">
          <button
            v-for="item in recentApprovals"
            :key="item.id"
            type="button"
            class="welcome__recent"
            @click="openInstance(item)"
          >
            <span class="welcome__recent-main">
              <span class="welcome__recent-title">{{ item.title }}</span>
              <span class="welcome__recent-meta">
                {{ item.definitionName }} · {{ item.initiatorName }} · {{ item.createdAt }}
              </span>
            </span>
            <el-tag :type="statusMeta(item.status).type as any" size="small" effect="light">
              {{ statusMeta(item.status).text }}
            </el-tag>
          </button>
        </div>
        <AppEmpty v-else description="暂无审批记录" :image-size="72" />
      </article>
    </section>

    <!-- 快捷入口 -->
    <section class="welcome__panel">
      <header class="welcome__panel-header">
        <div>
          <h2 class="welcome__panel-title">快捷发起</h2>
          <p class="welcome__panel-desc">常用流程一键发起</p>
        </div>
      </header>
      <div v-if="quickEntries.length" class="welcome__entries">
        <button
          v-for="entry in quickEntries"
          :key="entry.id"
          type="button"
          class="welcome__entry"
          @click="goQuickEntry(entry)"
        >
          <span class="welcome__entry-icon">
            <AppIcon icon="ep:document" :size="16" />
          </span>
          <span class="welcome__entry-name">{{ entry.name }}</span>
          <AppIcon icon="ep:right" :size="13" color="var(--app-text-4)" />
        </button>
      </div>
      <AppEmpty v-else description="暂无可用流程" :image-size="88" />
    </section>
  </div>
</template>

<style scoped lang="scss">
.welcome {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__hero {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding: 24px;
    background:
      radial-gradient(circle at 92% 10%, rgb(31 90 224 / 10%), transparent 42%),
      var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__greeting {
    font-size: var(--app-font-20);
    font-weight: 600;
    line-height: 28px;
    color: var(--app-text-1);
  }

  &__meta {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: 6px;
    font-size: var(--app-font-13);
    color: var(--app-text-3);
  }

  &__meta-dept {
    padding-left: 12px;
    border-left: 1px solid var(--app-border);
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    margin-left: 4px;
    font-size: var(--app-font-12);
    font-weight: 600;
    color: var(--app-primary);
    background: var(--app-container);
    border-radius: 9px;
  }

  /* ============ KPI ============ */
  &__kpis {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__kpi {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 18px 20px;

    & + & {
      border-left: 1px solid var(--app-border);
    }
  }

  &__kpi-label {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__kpi-value {
    font-size: 26px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--app-text-1);
    font-variant-numeric: tabular-nums;
  }

  &__kpi-hint {
    font-size: var(--app-font-12);
    color: var(--app-text-4);
  }

  /* ============ 面板 ============ */
  &__grid {
    display: grid;
    gap: 16px;

    &--main {
      grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr);
    }

    &--sub {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  &__panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: var(--app-card-padding);
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__panel-header {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  &__panel-title {
    font-size: var(--app-font-15);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__panel-desc {
    margin-top: 2px;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__legend {
    display: flex;
    gap: 14px;
    font-size: var(--app-font-12);
    color: var(--app-text-3);

    span {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    i {
      width: 8px;
      height: 8px;
      border-radius: 50%;

      &.is-primary {
        background: var(--app-primary);
      }

      &.is-success {
        background: var(--app-success);
      }
    }
  }

  /* ============ 最近动态 ============ */
  &__recent-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 -8px;
  }

  &__recent {
    display: flex;
    gap: 12px;
    align-items: center;
    width: 100%;
    padding: 8px;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: var(--app-radius-sm);
    transition: background-color var(--app-duration-fast) var(--app-ease);

    &:hover {
      background: var(--app-subtle);
    }
  }

  &__recent-main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__recent-title {
    overflow: hidden;
    font-size: var(--app-font-13);
    color: var(--app-text-1);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__recent-meta {
    overflow: hidden;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ============ 快捷入口 ============ */
  &__entries {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 12px;
  }

  &__entry {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
    transition:
      border-color var(--app-duration-fast) var(--app-ease),
      background-color var(--app-duration-fast) var(--app-ease);

    &:hover {
      background: var(--app-subtle);
      border-color: var(--app-primary-border);
    }
  }

  &__entry-icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: var(--app-primary);
    background: var(--app-primary-bg);
    border-radius: var(--app-radius-xs);
  }

  &__entry-name {
    flex: 1;
    overflow: hidden;
    font-size: var(--app-font-13);
    color: var(--app-text-1);
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (width <= 1280px) {
  .welcome__grid--sub {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 1100px) {
  .welcome__grid--main,
  .welcome__grid--sub {
    grid-template-columns: minmax(0, 1fr);
  }

  .welcome__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .welcome__kpi:nth-child(3) {
    border-left: 0;
    border-top: 1px solid var(--app-border);
  }

  .welcome__kpi:nth-child(4) {
    border-top: 1px solid var(--app-border);
  }
}
</style>
