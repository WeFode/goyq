<script setup lang="ts">
import { computed, ref } from "vue";

/**
 * 数据表格：统一 el-table 的样式、空状态、批量操作栏与分页
 * 分页对象由父组件以 reactive 传入并直接修改（与旧逻辑保持一致）
 */
interface Props {
  data: Array<any>;
  loading?: boolean;
  rowKey?: string;
  /** 是否显示多选列 */
  selection?: boolean;
  /** 已选数量，用于渲染批量操作栏 */
  selectedNum?: number;
  pagination?: {
    currentPage: number;
    pageSize: number;
    total: number;
    pageSizes?: number[];
  };
  emptyText?: string;
  /** 是否显示分页，默认 true */
  showPagination?: boolean;
  height?: string | number;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  rowKey: "id",
  selection: false,
  selectedNum: 0,
  pagination: null,
  emptyText: "暂无数据",
  showPagination: true,
  height: undefined
});

const emit = defineEmits<{
  (e: "selection-change", rows: Array<any>): void;
  (e: "page-change"): void;
}>();

const tableRef = ref();

const currentPage = computed({
  get: () => props.pagination?.currentPage ?? 1,
  set: value => {
    if (props.pagination) props.pagination.currentPage = value;
  }
});

const pageSize = computed({
  get: () => props.pagination?.pageSize ?? 10,
  set: value => {
    if (props.pagination) props.pagination.pageSize = value;
  }
});

const pageSizes = computed(() => props.pagination?.pageSizes ?? [10, 20, 50, 100]);

defineExpose({ tableRef });
</script>

<template>
  <div class="app-table">
    <!-- 批量操作栏 -->
    <div v-if="selectedNum > 0" class="app-table__batch">
      <span class="app-table__batch-text">
        已选 <b>{{ selectedNum }}</b> 项
      </span>
      <div class="app-table__batch-actions">
        <slot name="batch" :selected-num="selectedNum" />
        <el-button link type="primary" @click="$emit('selection-change', [])">
          取消选择
        </el-button>
      </div>
    </div>

    <div v-if="$slots.toolbar" class="app-table__toolbar">
      <slot name="toolbar" />
    </div>

    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="data"
      :row-key="rowKey"
      :height="height"
      stripe
      @selection-change="(rows: Array<any>) => emit('selection-change', rows)"
    >
      <el-table-column v-if="selection" type="selection" width="48" fixed="left" />
      <slot />
      <template #empty>
        <el-empty :image-size="96" :description="emptyText" />
      </template>
    </el-table>

    <div v-if="showPagination && pagination" class="app-table__pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="pageSizes"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="pagination.total"
        @size-change="emit('page-change')"
        @current-change="emit('page-change')"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-table {
  display: flex;
  flex-direction: column;
  padding: 16px 20px 8px;
  background: var(--app-container);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);

  &__batch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    padding: 0 12px;
    margin-bottom: 12px;
    background: var(--app-primary-bg);
    border: 1px solid var(--app-primary-border);
    border-radius: var(--app-radius-sm);
  }

  &__batch-text {
    font-size: var(--app-font-13);
    color: var(--app-text-2);

    b {
      font-weight: 500;
      color: var(--app-primary);
    }
  }

  &__batch-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  &__pagination {
    display: flex;
    justify-content: flex-end;
    padding: 12px 0 4px;
  }
}
</style>
