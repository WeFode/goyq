<script setup lang="ts">
/**
 * 详情分节：审批详情、个人中心等页面复用
 * 用法：<AppDetailSection title="基本信息"><el-descriptions /></AppDetailSection>
 */
interface Props {
  title?: string;
  /** 是否显示标题左侧主色竖条 */
  accent?: boolean;
}

withDefaults(defineProps<Props>(), {
  title: "",
  accent: true
});
</script>

<template>
  <section class="app-section">
    <header v-if="title || $slots.extra" class="app-section__header">
      <h3 class="app-section__title" :class="{ 'is-accent': accent }">
        {{ title }}
      </h3>
      <div class="app-section__extra">
        <slot name="extra" />
      </div>
    </header>
    <div class="app-section__body">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.app-section {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    position: relative;
    padding-left: 10px;
    font-size: var(--app-font-14);
    font-weight: 600;
    line-height: 22px;
    color: var(--app-text-1);

    &.is-accent::before {
      position: absolute;
      top: 50%;
      left: 0;
      width: 3px;
      height: 14px;
      content: "";
      background: var(--app-primary);
      border-radius: 2px;
      transform: translateY(-50%);
    }
  }

  &__extra {
    display: flex;
    gap: 8px;
    align-items: center;
  }
}
</style>
