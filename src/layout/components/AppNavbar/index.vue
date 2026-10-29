<script setup lang="ts">
import { computed } from "vue";
import { useFullscreen } from "@vueuse/core";
import Breadcrumb from "./Breadcrumb.vue";
import NotificationCenter from "./NotificationCenter.vue";
import SearchPalette from "./SearchPalette.vue";
import UserMenu from "./UserMenu.vue";
import { useAppStoreHook } from "@/store/modules/app";

const appStore = useAppStoreHook();
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

const collapsed = computed(() => !appStore.getSidebarStatus);
const isMobile = computed(() => appStore.getDevice === "mobile");
</script>

<template>
  <header class="app-navbar">
    <div class="app-navbar__left">
      <div
        class="app-navbar__action"
        :title="collapsed ? '展开菜单' : '收起菜单'"
        @click="appStore.toggleSideBar()"
      >
        <AppIcon :icon="collapsed ? 'ep:expand' : 'ep:fold'" :size="18" />
      </div>
      <Breadcrumb v-if="!isMobile" />
    </div>

    <div class="app-navbar__right">
      <SearchPalette />
      <NotificationCenter />

      <div
        class="app-navbar__action"
        :title="isFullscreen ? '退出全屏' : '全屏显示'"
        @click="toggleFullscreen"
      >
        <AppIcon
          :icon="isFullscreen ? 'ep:close' : 'ep:full-screen'"
          :size="17"
        />
      </div>

      <span class="app-navbar__divider" />
      <UserMenu />
    </div>
  </header>
</template>
