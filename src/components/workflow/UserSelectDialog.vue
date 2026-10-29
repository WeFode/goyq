<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { employeeSelectorListQuery } from "@/api/employee";

/** 员工选择弹窗：用于指定审批人 / 抄送人 */
interface Props {
  modelValue: boolean;
  title?: string;
  multiple?: boolean;
  selectedIds?: Array<string | number>;
}

const props = withDefaults(defineProps<Props>(), {
  title: "选择人员",
  multiple: true,
  selectedIds: () => []
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "confirm", users: Array<any>): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: value => emit("update:modelValue", value)
});

const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const keyword = ref("");
const page = ref(1);
const pageSize = ref(10);
const selected = ref<any[]>([]);

const selectedIdSet = computed(
  () => new Set(props.selectedIds.map(id => String(id)))
);

async function load() {
  loading.value = true;
  try {
    const res: any = await employeeSelectorListQuery({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined
    });
    list.value = res?.data?.list ?? [];
    total.value = res?.data?.total ?? 0;
  } catch (error) {
    console.error("加载员工列表失败:", error);
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = 1;
  load();
}

function handleReset() {
  keyword.value = "";
  page.value = 1;
  load();
}

function onSelectionChange(rows: any[]) {
  selected.value = rows;
}

function onRowClick(row: any) {
  if (props.multiple) return;
  selected.value = [row];
}

function confirm() {
  visible.value = false;
  emit("confirm", [...selected.value]);
}

watch(visible, value => {
  if (!value) return;
  selected.value = [];
  page.value = 1;
  keyword.value = "";
  load();
});
</script>

<template>
  <AppFormDialog
    v-model="visible"
    :title="title"
    width="720px"
    confirm-text="确定"
    @confirm="confirm"
  >
    <div class="app-user-select">
      <div class="app-user-select__search">
        <el-input
          v-model="keyword"
          placeholder="搜索员工姓名或编号"
          clearable
          @keyup.enter="handleSearch"
          @clear="handleReset"
        >
          <template #prefix>
            <AppIcon icon="ep:search" :size="14" />
          </template>
        </el-input>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="list"
        height="360"
        row-key="id"
        :highlight-current-row="!multiple"
        @selection-change="onSelectionChange"
        @row-click="onRowClick"
      >
        <el-table-column v-if="multiple" type="selection" width="46" />
        <el-table-column label="姓名" min-width="160">
          <template #default="{ row }">
            <div class="app-user-select__cell">
              <AppUserAvatar :name="row.employeeName" :avatar="row.avatar" :size="26" />
              <span>{{ row.employeeName }}</span>
              <el-tag
                v-if="selectedIdSet.has(String(row.id))"
                size="small"
                type="primary"
                effect="plain"
              >
                已选
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="员工编号" prop="employeeNumber" min-width="120" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <AppStatusTag
              :value="row.employmentStatus"
              :map="{
                1: { text: '在职', type: 'success' },
                2: { text: '离职', type: 'info' }
              }"
              fallback="在职"
            />
          </template>
        </el-table-column>
      </el-table>

      <div class="app-user-select__pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          background
          layout="total, prev, pager, next"
          :total="total"
          @current-change="load"
        />
      </div>
    </div>
  </AppFormDialog>
</template>

<style scoped lang="scss">
.app-user-select {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__search {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__cell {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__pagination {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
