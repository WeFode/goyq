<script setup lang="ts">
import { computed } from "vue";
import { Icon } from "@iconify/vue/dist/offline";
import { hasIcon } from "@/assets/icons";

interface Props {
  /** 图标名（如 `ep:search`），也支持直接传入 iconify 图标对象 */
  icon: string | Record<string, any>;
  /** 图标尺寸，默认 16 */
  size?: number | string;
  /** 图标颜色，默认继承父级 */
  color?: string;
  /** 图标未注册时的兜底图标，默认 `ep:menu`，避免出现空白 */
  fallback?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 16,
  color: "",
  fallback: "ep:menu"
});

/** 字符串图标未在本地注册时回退到兜底图标 */
const iconName = computed(() => {
  const value = props.icon;
  if (typeof value === "string" && value.includes(":") && !hasIcon(value)) {
    return props.fallback;
  }
  return value as any;
});

const iconStyle = computed(() => ({
  fontSize: typeof props.size === "number" ? `${props.size}px` : props.size,
  color: props.color || undefined
}));
</script>

<template>
  <Icon :icon="iconName" class="app-icon" :style="iconStyle" />
</template>

<style scoped>
.app-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  line-height: 1;
  vertical-align: -0.15em;
}
</style>
