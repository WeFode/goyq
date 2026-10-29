<script setup lang="ts">
import { computed } from "vue";

type StatusType = "primary" | "success" | "warning" | "danger" | "info";

export interface StatusItem {
  text: string;
  type?: StatusType;
  /** 是否在文字前显示圆点 */
  dot?: boolean;
}

interface Props {
  value: string | number | boolean;
  /** 状态字典，key 为值 */
  map: Record<string | number, StatusItem>;
  /** 值不在字典中时的展示文案 */
  fallback?: string;
}

const props = withDefaults(defineProps<Props>(), {
  fallback: "-"
});

const current = computed<StatusItem | null>(() => {
  const key = String(props.value);
  return props.map?.[key] ?? null;
});

const dotColor = computed(() => {
  const type = current.value?.type ?? "info";
  return {
    primary: "var(--app-primary)",
    success: "var(--app-success)",
    warning: "var(--app-warning)",
    danger: "var(--app-danger)",
    info: "var(--app-text-4)"
  }[type];
});
</script>

<template>
  <span class="app-status" :class="`app-status--${current?.type ?? 'info'}`">
    <i v-if="current?.dot" class="app-status__dot" :style="{ background: dotColor }" />
    {{ current?.text ?? fallback }}
  </span>
</template>

<style scoped lang="scss">
.app-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--app-font-13);
  color: var(--app-text-2);

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  &--primary {
    color: var(--app-primary);
  }

  &--success {
    color: var(--app-success);
  }

  &--warning {
    color: var(--app-warning);
  }

  &--danger {
    color: var(--app-danger);
  }
}
</style>
