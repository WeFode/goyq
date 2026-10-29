<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import {
  addInvitation,
  deleteInvitation,
  invitationListQuery
} from "@/api/invitation";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { useTable } from "@/composables/useTable";

defineOptions({ name: "INVITE" });

/* ============ 列表 ============ */
const query = reactive<{ keyword: string }>({ keyword: "" });

const { loading, list, pagination, search, refresh, reset } = useTable({
  fetcher: params => invitationListQuery(params),
  query
});

/* ============ 生成邀请码 ============ */
const dialogVisible = ref(false);
const submitting = ref(false);
const expireDays = ref(7);
const createdCode = ref("");

function openCreate() {
  expireDays.value = 7;
  createdCode.value = "";
  dialogVisible.value = true;
}

async function submit() {
  submitting.value = true;
  try {
    const expiredAt = dayjs()
      .add(expireDays.value, "day")
      .format("YYYY-MM-DD HH:mm:ss");
    const res: any = await addInvitation({ expiredAt });
    createdCode.value = res?.data?.code ?? "";
    message("邀请码已生成", { type: "success" });
    refresh();
  } catch (error) {
    console.error("生成邀请码失败:", error);
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: any) {
  try {
    await deleteInvitation(row.id);
    message("删除成功", { type: "success" });
    refresh();
  } catch (error) {
    console.error("删除邀请码失败:", error);
  }
}

/* ============ 状态 ============ */
const isExpired = (row: any) => {
  if (!row.expiredAt) return false;
  return dayjs(row.expiredAt).isBefore(dayjs());
};

const formatTime = (value: any) => {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD HH:mm") : String(value);
};

function resetQuery() {
  query.keyword = "";
  reset();
}

onMounted(() => search());
</script>

<template>
  <AppPage title="邀请码管理" description="生成邀请码供新员工自助注册账号">
    <template #actions>
      <el-button
        v-if="hasAuth('hr:invitation:add')"
        type="primary"
        @click="openCreate"
      >
        <AppIcon icon="ep:plus" :size="14" />
        生成邀请码
      </el-button>
    </template>

    <AppSearchBar :loading="loading" @search="search" @reset="resetQuery">
      <el-form-item label="邀请码">
        <el-input v-model="query.keyword" placeholder="请输入邀请码" clearable />
      </el-form-item>
    </AppSearchBar>

    <AppDataTable
      :data="list"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无邀请码"
      @page-change="refresh"
    >
      <el-table-column label="邀请码" width="160">
        <template #default="{ row }">
          <span v-copy="row.code" class="invite-code" title="双击复制">
            {{ row.code }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="过期时间" width="200">
        <template #default="{ row }">
          {{ formatTime(row.expiredAt) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }">
          <AppStatusTag
            :value="isExpired(row) ? 0 : 1"
            :map="{
              1: { text: '可使用', type: 'success', dot: true },
              0: { text: '已过期', type: 'info', dot: true }
            }"
          />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="200">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button v-copy="row.code" link type="primary">复制</el-button>
          <el-popconfirm
            v-if="hasAuth('hr:invitation:delete')"
            :title="`确认删除邀请码「${row.code}」？`"
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
      title="生成邀请码"
      :loading="submitting"
      :confirm-text="createdCode ? '关闭' : '生成'"
      width="440px"
      @confirm="createdCode ? (dialogVisible = false) : submit()"
    >
      <el-form v-if="!createdCode" label-width="96px">
        <el-form-item label="有效期">
          <el-input-number v-model="expireDays" :min="1" :max="90" />
          <span class="invite-unit">天</span>
        </el-form-item>
      </el-form>

      <div v-else class="invite-result">
        <p class="invite-result__tip">邀请码已生成，请复制发送给新员工</p>
        <div v-copy="createdCode" class="invite-result__code" title="双击复制">
          {{ createdCode }}
        </div>
        <p class="invite-result__hint">双击即可复制</p>
      </div>
    </AppFormDialog>
  </AppPage>
</template>

<style scoped lang="scss">
.invite-code {
  display: inline-block;
  padding: 2px 8px;
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: var(--app-font-13);
  font-weight: 500;
  color: var(--app-primary);
  letter-spacing: 1px;
  cursor: pointer;
  background: var(--app-primary-bg);
  border-radius: var(--app-radius-xs);
  user-select: all;
}

.invite-unit {
  margin-left: 8px;
  font-size: var(--app-font-13);
  color: var(--app-text-3);
}

.invite-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding: 8px 0 4px;

  &__tip {
    font-size: var(--app-font-13);
    color: var(--app-text-3);
  }

  &__code {
    padding: 12px 24px;
    font-family: "JetBrains Mono", Consolas, monospace;
    font-size: 24px;
    font-weight: 600;
    color: var(--app-primary);
    letter-spacing: 4px;
    cursor: pointer;
    background: var(--app-primary-bg);
    border: 1px dashed var(--app-primary-border);
    border-radius: var(--app-radius-sm);
    user-select: all;
  }

  &__hint {
    font-size: var(--app-font-12);
    color: var(--app-text-4);
  }
}
</style>
