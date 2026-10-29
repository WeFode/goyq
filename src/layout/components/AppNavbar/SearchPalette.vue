<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { usePermissionStoreHook } from "@/store/modules/permission";

/** 菜单搜索：仿飞书全局搜索，Ctrl/⌘ + K 唤起 */
const router = useRouter();
const permissionStore = usePermissionStoreHook();

const visible = ref(false);
const keyword = ref("");
const activeIndex = ref(0);
const inputRef = ref();

interface MenuEntry {
  title: string;
  path: string;
  icon?: string;
  parentTitle?: string;
}

/** 扁平化菜单，用于搜索 */
function flatten(menus: Array<any>, parentTitle = ""): MenuEntry[] {
  const result: MenuEntry[] = [];
  (menus ?? []).forEach(item => {
    const title = item.meta?.title;
    if (!title) return;
    if (item.children?.length) {
      result.push(...flatten(item.children, title));
    } else {
      result.push({
        title,
        path: item.path,
        icon: item.meta?.icon,
        parentTitle
      });
    }
  });
  return result;
}

const entries = computed(() => flatten(permissionStore.wholeMenus));

const results = computed(() => {
  const key = keyword.value.trim().toLowerCase();
  if (!key) return entries.value.slice(0, 12);
  return entries.value
    .filter(
      item =>
        item.title.toLowerCase().includes(key) ||
        item.path.toLowerCase().includes(key)
    )
    .slice(0, 20);
});

function open() {
  visible.value = true;
  keyword.value = "";
  activeIndex.value = 0;
  nextTick(() => inputRef.value?.focus());
}

function select(entry: MenuEntry) {
  visible.value = false;
  router.push(entry.path);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    visible.value = false;
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, 0);
    return;
  }
  if (event.key === "Enter" && results.value[activeIndex.value]) {
    select(results.value[activeIndex.value]);
  }
}

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    open();
  }
}

onMounted(() => document.addEventListener("keydown", onGlobalKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onGlobalKeydown));
</script>

<template>
  <div class="app-navbar__search" @click="open">
    <AppIcon icon="ep:search" :size="14" />
    <span class="app-navbar__search-text">搜索菜单</span>
    <span class="app-navbar__search-kbd">Ctrl K</span>
  </div>

  <el-dialog
    v-model="visible"
    width="560px"
    :show-close="false"
    append-to-body
    class="app-search-palette"
  >
    <div class="app-palette">
      <el-input
        ref="inputRef"
        v-model="keyword"
        placeholder="搜索菜单名称或路径"
        clearable
        @keydown="onKeydown"
      >
        <template #prefix>
          <AppIcon icon="ep:search" :size="15" />
        </template>
      </el-input>

      <ul class="app-palette__list">
        <li
          v-for="(item, index) in results"
          :key="item.path"
          class="app-palette__item"
          :class="{ 'is-active': index === activeIndex }"
          @mouseenter="activeIndex = index"
          @click="select(item)"
        >
          <AppIcon :icon="item.icon || 'ep:document'" :size="16" />
          <span class="app-palette__title">{{ item.title }}</span>
          <span v-if="item.parentTitle" class="app-palette__parent">
            {{ item.parentTitle }}
          </span>
        </li>
        <li v-if="results.length === 0" class="app-palette__empty">
          没有匹配的菜单
        </li>
      </ul>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.app-palette {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__list {
    max-height: 340px;
    padding: 4px 0;
    overflow: hidden auto;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 10px;
    font-size: var(--app-font-14);
    color: var(--app-text-2);
    cursor: pointer;
    border-radius: var(--app-radius-sm);

    &.is-active {
      color: var(--app-primary);
      background: var(--app-primary-bg);
    }
  }

  &__title {
    flex: 1;
  }

  &__parent {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__empty {
    padding: 24px 0;
    font-size: var(--app-font-13);
    color: var(--app-text-3);
    text-align: center;
  }
}
</style>

<style lang="scss">
/* 搜索面板：去掉默认 header 留白 */
.app-search-palette {
  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 16px;
  }
}
</style>
