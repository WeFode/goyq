<script setup lang="ts">
import { computed } from "vue";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { useSettingStoreHook } from "@/store/modules/settings";

/** 内容区：路由视图 + 页面切换过渡 + keep-alive 缓存 */
const permissionStore = usePermissionStoreHook();
const settingStore = useSettingStoreHook();

const cachedViews = computed(() => permissionStore.cachePageList);
const keepAlive = computed(() => settingStore.getKeepAlive);
</script>

<template>
  <main class="app-main">
    <router-view v-slot="{ Component, route }">
      <transition name="fade-transform" mode="out-in">
        <keep-alive v-if="keepAlive" :include="cachedViews">
          <component :is="Component" :key="route.fullPath" class="app-main__view" />
        </keep-alive>
        <component
          :is="Component"
          v-else
          :key="route.fullPath"
          class="app-main__view"
        />
      </transition>
    </router-view>
  </main>
</template>

<style scoped lang="scss">
.app-main {
  flex: 1;
  min-height: 0;
  padding: var(--app-content-padding);
  overflow: hidden auto;
  background: var(--app-page-bg);

  &__view {
    min-height: 100%;
  }
}
</style>
