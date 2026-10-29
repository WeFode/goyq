<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import AppSidebar from "./components/AppSidebar/index.vue";
import AppNavbar from "./components/AppNavbar/index.vue";
import AppTagsView from "./components/AppTagsView/index.vue";
import AppMain from "./components/AppMain.vue";
import { useAppStoreHook } from "@/store/modules/app";
import { useSettingStoreHook } from "@/store/modules/settings";

defineOptions({ name: "Layout" });

const appStore = useAppStoreHook();
const settingStore = useSettingStoreHook();

const collapsed = computed(() => !appStore.getSidebarStatus);
const isMobile = computed(() => appStore.getDevice === "mobile");
const hideTabs = computed(() => settingStore.getHideTabs);

/** 侧边栏折叠状态：随窗口宽度自适应 */
let lastWidth = 0;
function handleResize() {
  const width = document.documentElement.clientWidth;
  if (width === lastWidth) return;
  const prevWidth = lastWidth;
  lastWidth = width;

  if (width <= 768) {
    appStore.toggleDevice("mobile");
    appStore.toggleSideBar(false, "resize");
    return;
  }

  appStore.toggleDevice("desktop");
  // 仅在跨越阈值时自动切换，避免打断用户手动折叠
  if (width < 1100 && prevWidth >= 1100) appStore.toggleSideBar(false, "resize");
  if (width >= 1280 && prevWidth < 1280) appStore.toggleSideBar(true, "resize");
}

onMounted(() => {
  handleResize();
  window.addEventListener("resize", handleResize, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
});
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'is-collapsed': collapsed, 'is-mobile': isMobile }"
  >
    <!-- 移动端侧边栏遮罩 -->
    <div
      v-if="isMobile && !collapsed"
      class="app-shell__mask"
      @click="appStore.toggleSideBar(false)"
    />

    <aside class="app-shell__aside">
      <AppSidebar />
    </aside>

    <div class="app-shell__body">
      <AppNavbar />
      <AppTagsView v-if="!hideTabs" />
      <AppMain />
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--app-page-bg);

  &__aside {
    position: relative;
    z-index: 20;
    flex-shrink: 0;
    height: 100%;
    transition: width var(--app-duration-base) var(--app-ease);
  }

  &__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }

  &__mask {
    position: fixed;
    inset: 0;
    z-index: 19;
    background: rgb(29 33 41 / 40%);
  }

  /* 移动端：侧边栏改为浮层 */
  &.is-mobile {
    .app-shell__aside {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      z-index: 20;
      box-shadow: var(--app-shadow-lg);
    }

    &.is-collapsed .app-shell__aside {
      transform: translateX(-100%);
    }
  }
}
</style>
