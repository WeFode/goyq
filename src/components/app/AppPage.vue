<script setup lang="ts">
/**
 * 页面容器：统一标题区与内容间距
 * 用法：<AppPage title="账号管理" description="..."><template #actions>...</template>...</AppPage>
 */
interface Props {
  title?: string;
  description?: string;
  /** 是否无标题区（纯内容页） */
  plain?: boolean;
}

withDefaults(defineProps<Props>(), {
  title: "",
  description: "",
  plain: false
});
</script>

<template>
  <div class="app-page">
    <div v-if="!plain" class="app-page__header">
      <div class="app-page__heading">
        <h2 v-if="title" class="app-page__title">{{ title }}</h2>
        <p v-if="description" class="app-page__desc">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="app-page__actions">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </div>
</template>

<style scoped lang="scss">
.app-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;

  &__header {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
  }

  &__heading {
    min-width: 0;
  }

  &__title {
    font-size: var(--app-font-20);
    font-weight: 600;
    line-height: 28px;
    color: var(--app-text-1);
  }

  &__desc {
    margin-top: 4px;
    font-size: var(--app-font-13);
    color: var(--app-text-3);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
}
</style>
