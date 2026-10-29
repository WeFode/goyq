<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import logoUrl from "@/assets/logo.svg";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { useAppStoreHook } from "@/store/modules/app";

defineOptions({ name: "AppSidebar" });

const route = useRoute();
const router = useRouter();
const appStore = useAppStoreHook();
const permissionStore = usePermissionStoreHook();

/** 折叠：仅保留左侧一级图标栏 */
const collapsed = computed(() => !appStore.getSidebarStatus);

function isVisible(item: any) {
  return item?.meta?.showLink !== false && Boolean(item?.meta?.title);
}

const modules = computed<any[]>(() =>
  (permissionStore.wholeMenus ?? []).filter(isVisible)
);

const isExternal = (path: string) => /^https?:\/\//.test(path || "");

function resolvePath(parentPath: string, childPath: string): string {
  if (!childPath) return parentPath;
  if (isExternal(childPath)) return childPath;
  if (childPath.startsWith("/")) return childPath;
  return `${(parentPath || "").replace(/\/+$/, "")}/${childPath.replace(
    /^\/+/,
    ""
  )}`;
}

/** 当前激活路径（支持 meta.activePath 指定高亮项） */
const currentPath = computed(() =>
  String(route.meta?.activePath || route.path || "")
);

function moduleMatches(module: any, path: string): boolean {
  if (!path || !module?.path) return false;
  if (path === module.path || path.startsWith(`${module.path}/`)) return true;

  const children = module.children ?? [];
  const directHit = children.some((child: any) => {
    const childPath = resolvePath(module.path, child.path);
    return (
      path === childPath ||
      path.startsWith(`${childPath}/`) ||
      child?.meta?.activePath === path
    );
  });
  if (directHit) return true;

  // 兜底：菜单树中隐藏的页面（如流程设计器）不在 children 里，
  // 按一级路径段匹配（/engine/designer/index -> 审批管理）
  const segment = path.split("/").filter(Boolean)[0] ?? "";
  if (!segment) return false;
  return children.some((child: any) => {
    const childSegment =
      resolvePath(module.path, child.path).split("/").filter(Boolean)[0] ?? "";
    return childSegment !== "" && childSegment === segment;
  });
}

const activeModulePath = ref("");

watch(
  [modules, currentPath],
  () => {
    const hit = modules.value.find(item =>
      moduleMatches(item, currentPath.value)
    );
    if (hit) {
      activeModulePath.value = hit.path;
      return;
    }
    if (!activeModulePath.value && modules.value.length) {
      activeModulePath.value = modules.value[0].path;
    }
  },
  { immediate: true }
);

const activeModule = computed(
  () =>
    modules.value.find(item => item.path === activeModulePath.value) ?? null
);

/** 二级菜单项（补全绝对路径，过滤隐藏项） */
const panelItems = computed<any[]>(() => {
  const module = activeModule.value;
  if (!module) return [];
  return (module.children ?? []).filter(isVisible).map((child: any) => ({
    ...child,
    fullPath: resolvePath(module.path, child.path)
  }));
});

function navigate(path: string) {
  if (!path) return;
  if (isExternal(path)) {
    window.open(path, "_blank");
    return;
  }
  if (path === route.path) return;
  router.push(path);
}

function handleModuleClick(module: any) {
  activeModulePath.value = module.path;
  const children = (module.children ?? []).filter(isVisible);

  if (!children.length) {
    navigate(module.path);
    return;
  }
  // 折叠态下点击一级模块：先展开二级面板
  if (collapsed.value) appStore.toggleSideBar(true);
  // 只有一个子菜单时直接进入，减少一次点击
  if (children.length === 1) {
    navigate(resolvePath(module.path, children[0].path));
  }
}

const isModuleActive = (module: any) => module.path === activeModulePath.value;

const isItemActive = (item: any) =>
  currentPath.value === item.fullPath ||
  currentPath.value.startsWith(`${item.fullPath}/`);
</script>

<template>
  <div class="app-sidebar" :class="{ 'is-collapsed': collapsed }">
    <!-- 一级：图标栏 -->
    <nav class="app-nav-rail" aria-label="主导航">
      <div class="app-nav-rail__logo" title="OA 协同办公">
        <img :src="logoUrl" alt="logo" />
      </div>

      <el-scrollbar class="app-nav-rail__scroll">
        <button
          v-for="module in modules"
          :key="module.path"
          type="button"
          class="app-nav-rail__item"
          :class="{ 'is-active': isModuleActive(module) }"
          :title="module.meta?.title"
          @click="handleModuleClick(module)"
        >
          <span class="app-nav-rail__icon">
            <AppIcon
              v-if="module.meta?.icon"
              :icon="module.meta.icon"
              :size="20"
            />
            <span v-else class="app-nav-rail__initial">
              {{ (module.meta?.title ?? "").slice(0, 1) }}
            </span>
          </span>
          <span class="app-nav-rail__label">{{ module.meta?.title }}</span>
        </button>
      </el-scrollbar>

      <button
        type="button"
        class="app-nav-rail__collapse"
        :title="collapsed ? '展开导航' : '收起导航'"
        @click="appStore.toggleSideBar()"
      >
        <AppIcon :icon="collapsed ? 'ep:expand' : 'ep:fold'" :size="16" />
      </button>
    </nav>

    <!-- 二级：菜单面板 -->
    <section class="app-nav-panel" :aria-hidden="collapsed">
      <header class="app-nav-panel__head">
        <div class="app-nav-panel__title">
          <AppIcon
            v-if="activeModule?.meta?.icon"
            :icon="activeModule.meta.icon"
            :size="16"
          />
          <span>{{ activeModule?.meta?.title ?? "导航" }}</span>
        </div>
        <button
          type="button"
          class="app-nav-panel__collapse"
          title="收起导航"
          @click="appStore.toggleSideBar(false)"
        >
          «
        </button>
      </header>

      <el-scrollbar class="app-nav-panel__scroll">
        <div v-if="panelItems.length" class="app-nav-panel__list">
          <button
            v-for="item in panelItems"
            :key="item.fullPath"
            type="button"
            class="app-nav-panel__item"
            :class="{ 'is-active': isItemActive(item) }"
            @click="navigate(item.fullPath)"
          >
            <AppIcon
              v-if="item.meta?.icon"
              :icon="item.meta.icon"
              :size="16"
            />
            <span>{{ item.meta?.title }}</span>
          </button>
        </div>

        <div v-else class="app-nav-panel__empty">
          该模块暂无子菜单，点击左侧图标直接进入
        </div>
      </el-scrollbar>
    </section>
  </div>
</template>
