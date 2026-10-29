<script setup lang="ts">
/**
 * 查询条：统一列表页的搜索区域
 * 用法：
 * <AppSearchBar :loading="loading" @search="onSearch" @reset="onReset">
 *   <template #default="{ expanded }">
 *     <el-form-item label="姓名"><el-input v-model="query.name" /></el-form-item>
 *     <el-form-item v-if="expanded" label="状态">...</el-form-item>
 *   </template>
 * </AppSearchBar>
 */
interface Props {
  /** 查询按钮 loading */
  loading?: boolean;
  /** 是否展示「展开/收起」 */
  expandable?: boolean;
  /** 展开状态 */
  expanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  expandable: false,
  expanded: false
});

const emit = defineEmits<{
  (e: "search"): void;
  (e: "reset"): void;
  (e: "update:expanded", value: boolean): void;
}>();

const onToggle = () => emit("update:expanded", !props.expanded);
</script>

<template>
  <div class="app-search-bar">
    <el-form class="app-search-bar__form" inline @submit.prevent>
      <slot :expanded="expanded" />
    </el-form>
    <div class="app-search-bar__actions">
      <el-button type="primary" :loading="loading" @click="emit('search')">
        查询
      </el-button>
      <el-button @click="emit('reset')">重置</el-button>
      <el-button v-if="expandable" link type="primary" @click="onToggle">
        {{ expanded ? "收起" : "展开" }}
        <AppIcon
          :icon="expanded ? 'ep:arrow-up' : 'ep:arrow-down'"
          :size="12"
        />
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-search-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 20px 0;
  background: var(--app-container);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);

  &__form {
    flex: 1;
    min-width: 0;

    :deep(.el-form-item) {
      margin-right: 16px;
      margin-bottom: 16px;
    }

    :deep(.el-form-item__label) {
      padding-right: 8px;
      font-size: var(--app-font-13);
      color: var(--app-text-3);
    }

    :deep(.el-input),
    :deep(.el-select) {
      width: 180px;
    }

    :deep(.el-date-editor) {
      width: 240px;
    }
  }

  &__actions {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
    margin-bottom: 16px;

    :deep(.el-button + .el-button) {
      margin-left: 0;
    }
  }
}
</style>
