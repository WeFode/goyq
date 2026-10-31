<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  announcementDetailQuery,
  announcementListQuery,
  deleteAnnouncement,
  publishAnnouncement,
  withdrawAnnouncement,
  type Announcement
} from "@/api/announcement";
import { deptTreeQuery } from "@/api/dept";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { useTable } from "@/composables/useTable";

/**
 * 公告管理
 * 发布时选择目标部门，后端递归包含子部门，逐人下发站内信；
 * 撤回会同步删除已下发的通知，仅已撤回的公告允许删除。
 */
defineOptions({ name: "SystemAnnouncement" });

const STATUS_MAP = {
  1: { text: "已发布", type: "success" as const, dot: true },
  2: { text: "已撤回", type: "info" as const, dot: true }
};

const query = reactive<{ keyword: string; status?: number }>({
  keyword: "",
  status: undefined
});

const { loading, list, pagination, search, refresh, reset, refreshAfterDelete } =
  useTable({
    fetcher: params => announcementListQuery(params),
    query
  });

/* ==================== 部门树 ==================== */
const deptTree = ref<any[]>([]);

/**
 * 归一化部门树数据。
 *
 * /hr/department/tree 返回的是 `{ tree: [] }` 对象，而 el-tree-select 的 data 必须是数组；
 * 直接把对象传进去会渲染出 null 子节点，并在抽屉/弹窗销毁（destroy-on-close）时
 * 抛 Cannot destructure property 'type' of 'vnode' as it is null 导致整页假死。
 */
function normalizeTree(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.tree)) return payload.tree;
  return [];
}

async function loadDeptTree() {
  try {
    const res = await deptTreeQuery();
    deptTree.value = normalizeTree(res?.data);
  } catch (error) {
    console.error("加载部门树失败:", error);
    deptTree.value = [];
  }
}

/* ==================== 发布 ==================== */
const dialogVisible = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();
const form = reactive({ title: "", content: "", deptIds: [] as string[] });

const rules: FormRules = {
  title: [
    { required: true, message: "请填写公告标题", trigger: "blur" },
    { min: 2, max: 200, message: "长度 2-200 字", trigger: "blur" }
  ],
  content: [
    { required: true, message: "请填写公告正文", trigger: "blur" },
    { min: 2, max: 5000, message: "长度 2-5000 字", trigger: "blur" }
  ],
  deptIds: [
    {
      validator: (_rule, value, callback) => {
        if (!Array.isArray(value) || value.length === 0) {
          callback(new Error("请至少选择一个目标部门"));
          return;
        }
        callback();
      },
      trigger: "change"
    }
  ]
};

function openPublish() {
  form.title = "";
  form.content = "";
  form.deptIds = [];
  dialogVisible.value = true;
}

function submit() {
  formRef.value?.validate(async valid => {
    if (!valid) return;
    submitting.value = true;
    try {
      const res = await publishAnnouncement({
        title: form.title,
        content: form.content,
        deptIds: form.deptIds
      });
      message(res?.data?.message || "公告发布成功", { type: "success" });
      dialogVisible.value = false;
      refresh();
    } catch (error) {
      console.error("发布公告失败:", error);
    } finally {
      submitting.value = false;
    }
  });
}

/* ==================== 详情 ==================== */
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<Announcement | null>(null);

async function openDetail(row: Announcement) {
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const res = await announcementDetailQuery(row.id);
    detail.value = res?.data?.announcement ?? null;
  } catch (error) {
    console.error("加载公告详情失败:", error);
  } finally {
    detailLoading.value = false;
  }
}

/* ==================== 撤回 / 删除 ==================== */
async function handleWithdraw(row: Announcement) {
  try {
    const res = await withdrawAnnouncement(row.id);
    message(`公告已撤回，同步清理 ${res?.data?.removedNotifications ?? 0} 条通知`, {
      type: "success"
    });
    refresh();
  } catch (error) {
    console.error("撤回公告失败:", error);
  }
}

async function handleDelete(row: Announcement) {
  try {
    await deleteAnnouncement(row.id);
    message("删除成功", { type: "success" });
    refreshAfterDelete();
  } catch (error) {
    console.error("删除公告失败:", error);
  }
}

function resetQuery() {
  query.keyword = "";
  query.status = undefined;
  reset();
}

onMounted(() => {
  loadDeptTree();
  search();
});
</script>

<template>
  <AppPage
    title="公告管理"
    description="面向部门发布站内公告，支持递归下发、撤回与阅读情况跟踪"
  >
    <template #actions>
      <el-button
        v-if="hasAuth('sys:announcement:publish')"
        type="primary"
        @click="openPublish"
      >
        <AppIcon icon="ep:promotion" :size="14" />
        发布公告
      </el-button>
    </template>

    <AppSearchBar :loading="loading" @search="search" @reset="resetQuery">
      <el-form-item label="标题">
        <el-input v-model="query.keyword" placeholder="公告标题关键词" clearable />
      </el-form-item>
      <el-form-item label="状态">
        <el-select
          v-model="query.status"
          placeholder="全部"
          clearable
          class="announce__select"
        >
          <el-option label="已发布" :value="1" />
          <el-option label="已撤回" :value="2" />
        </el-select>
      </el-form-item>
    </AppSearchBar>

    <AppDataTable
      :data="list"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无公告"
      @page-change="refresh"
    >
      <el-table-column label="标题" min-width="220">
        <template #default="{ row }">
          <div class="announce__cell">
            <span class="app-text--strong">{{ row.title }}</span>
            <span class="announce__muted">
              {{ row.content ? row.content.slice(0, 40) : "" }}
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="目标部门" min-width="180">
        <template #default="{ row }">
          <span v-if="row.deptNames?.length">
            {{ row.deptNames.slice(0, 2).join("、") }}
            <span v-if="row.deptNames.length > 2" class="announce__muted">
              等 {{ row.deptNames.length }} 个
            </span>
          </span>
          <span v-else class="announce__muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <AppStatusTag :value="row.status" :map="STATUS_MAP" />
        </template>
      </el-table-column>
      <el-table-column label="送达 / 已读" width="130" align="center">
        <template #default="{ row }">
          <div class="announce__cell">
            <span>{{ row.successCount }} / {{ row.targetCount }}</span>
            <span class="announce__muted">已读 {{ row.readCount }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="发布人" prop="publisherName" width="120" />
      <el-table-column label="发布时间" prop="createdAt" width="170" />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">查看</el-button>
          <el-popconfirm
            v-if="row.status === 1 && hasAuth('sys:announcement:withdraw')"
            title="撤回后已下发的通知将一并删除，确认撤回？"
            width="260"
            @confirm="handleWithdraw(row)"
          >
            <template #reference>
              <el-button link type="warning">撤回</el-button>
            </template>
          </el-popconfirm>
          <el-popconfirm
            v-if="row.status === 2 && hasAuth('sys:announcement:delete')"
            title="确认删除该公告记录？"
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

    <!-- 发布公告 -->
    <AppFormDialog
      v-model="dialogVisible"
      title="发布公告"
      :loading="submitting"
      width="640px"
      confirm-text="发布"
      @confirm="submit"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-form-item label="公告标题" prop="title">
          <el-input
            v-model="form.title"
            placeholder="如 关于调整考勤规则的通知"
            maxlength="200"
            show-word-limit
            clearable
          />
        </el-form-item>
        <el-form-item label="目标部门" prop="deptIds">
          <el-tree-select
            v-model="form.deptIds"
            :data="deptTree"
            node-key="id"
            :props="{ label: 'deptName', children: 'children', value: 'id' }"
            placeholder="可多选，自动包含下级部门"
            multiple
            show-checkbox
            check-strictly
            collapse-tags
            collapse-tags-tooltip
            class="w-full"
          />
        </el-form-item>
        <el-form-item label="公告正文" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
            maxlength="5000"
            show-word-limit
            placeholder="支持换行，将以纯文本形式展示在通知与详情页"
          />
        </el-form-item>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="发送方式"
          description="公告会为选中部门（含下级）的每位在职员工生成一条站内信，并通过 WebSocket 实时推送。"
        />
      </el-form>
    </AppFormDialog>

    <!-- 公告详情 -->
    <AppFormDrawer
      v-model="detailVisible"
      title="公告详情"
      size="520px"
      :loading="detailLoading"
    >
      <template v-if="detail">
        <AppDetailSection title="基本信息">
          <div class="announce__field">
            <span class="announce__label">标题</span>
            <span class="announce__value">{{ detail.title }}</span>
          </div>
          <div class="announce__field">
            <span class="announce__label">状态</span>
            <AppStatusTag :value="detail.status" :map="STATUS_MAP" />
          </div>
          <div class="announce__field">
            <span class="announce__label">发布人</span>
            <span class="announce__value">{{ detail.publisherName || "-" }}</span>
          </div>
          <div class="announce__field">
            <span class="announce__label">发布时间</span>
            <span class="announce__value">{{ detail.createdAt || "-" }}</span>
          </div>
          <div class="announce__field">
            <span class="announce__label">送达情况</span>
            <span class="announce__value">
              {{ detail.successCount }} / {{ detail.targetCount }} 人送达，已读
              {{ detail.readCount }} 人
            </span>
          </div>
        </AppDetailSection>

        <AppDetailSection title="目标部门">
          <div class="announce__tags">
            <el-tag
              v-for="name in detail.deptNames"
              :key="name"
              type="info"
              effect="plain"
            >
              {{ name }}
            </el-tag>
            <span v-if="!detail.deptNames?.length" class="announce__muted">
              未记录部门
            </span>
          </div>
        </AppDetailSection>

        <AppDetailSection title="公告正文">
          <div class="announce__content">{{ detail.content }}</div>
        </AppDetailSection>
      </template>

      <AppEmpty v-else-if="!detailLoading" description="未找到公告" />
    </AppFormDrawer>
  </AppPage>
</template>

<style scoped lang="scss">
.announce {
  &__select {
    width: 160px;
  }

  &__cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__muted {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__field {
    display: flex;
    gap: 12px;
    align-items: baseline;
    padding: 6px 0;
  }

  &__label {
    flex: none;
    width: 76px;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__value {
    min-width: 0;
    font-size: var(--app-font-13);
    color: var(--app-text-1);
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__content {
    padding: 12px;
    font-size: var(--app-font-13);
    line-height: 22px;
    color: var(--app-text-2);
    white-space: pre-wrap;
    background: var(--app-subtle);
    border-radius: var(--app-radius-sm);
  }
}
</style>
