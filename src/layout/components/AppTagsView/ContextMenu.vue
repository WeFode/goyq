<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

/** 标签页右键菜单 */
const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
  /** 是否允许刷新（固定标签不允许） */
  canRefresh: boolean;
  /** 是否允许关闭（固定标签不允许） */
  canClose: boolean;
}>();

const emit = defineEmits<{
  (e: "select", command: string): void;
  (e: "close"): void;
}>();

const menuRef = ref<HTMLElement>();

const items = [
  { command: "refresh", label: "刷新当前页" },
  { command: "close", label: "关闭当前页" },
  { command: "closeOthers", label: "关闭其他页" },
  { command: "closeAll", label: "关闭全部页" }
];

const isDisabled = (command: string) => {
  if (command === "refresh") return !props.canRefresh;
  if (command === "close") return !props.canClose;
  return false;
};

function handleClick(command: string) {
  if (isDisabled(command)) return;
  emit("select", command);
}

function onDocumentClick(event: MouseEvent) {
  if (!props.visible) return;
  if (menuRef.value?.contains(event.target as Node)) return;
  emit("close");
}

onMounted(() => document.addEventListener("click", onDocumentClick, true));
onBeforeUnmount(() => document.removeEventListener("click", onDocumentClick, true));
</script>

<template>
  <Teleport to="body">
    <transition name="fade-transform">
      <ul
        v-if="visible"
        ref="menuRef"
        class="app-tags-context"
        :style="{ left: `${x}px`, top: `${y}px` }"
      >
        <li
          v-for="item in items"
          :key="item.command"
          class="app-tags-context__item"
          :class="{ 'is-disabled': isDisabled(item.command) }"
          @click.stop="handleClick(item.command)"
        >
          {{ item.label }}
        </li>
      </ul>
    </transition>
  </Teleport>
</template>

<style scoped lang="scss">
.app-tags-context {
  position: fixed;
  z-index: 3000;
  min-width: 140px;
  padding: 4px;
  background: var(--app-container);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  box-shadow: var(--app-shadow-lg);

  &__item {
    height: 32px;
    padding: 0 10px;
    font-size: var(--app-font-13);
    line-height: 32px;
    color: var(--app-text-2);
    cursor: pointer;
    border-radius: var(--app-radius-xs);

    &:hover {
      color: var(--app-primary);
      background: var(--app-primary-bg);
    }

    &.is-disabled {
      color: var(--app-text-4);
      cursor: not-allowed;
      background: transparent;
    }
  }
}
</style>
