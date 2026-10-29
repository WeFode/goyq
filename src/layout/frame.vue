<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

/**
 * iframe 容器：用于嵌入外部系统页面
 * 数据来源为路由 meta.frameSrc，由动态路由生成时写入
 */
defineOptions({ name: "Frame" });

const route = useRoute();
const loading = ref(true);
const frameRef = ref<HTMLIFrameElement>();

const frameSrc = computed(() => (route.meta?.frameSrc as string) ?? "");

function hideLoading() {
  loading.value = false;
}

function bindLoad() {
  nextTick(() => {
    if (frameRef.value) frameRef.value.onload = hideLoading;
  });
}

watch(frameSrc, () => {
  if (!frameSrc.value) return;
  loading.value = true;
  bindLoad();
});

onMounted(bindLoad);
</script>

<template>
  <div v-loading="loading" class="app-frame" element-loading-text="加载中...">
    <iframe ref="frameRef" :src="frameSrc" class="app-frame__iframe" />
  </div>
</template>

<style scoped>
.app-frame {
  position: relative;
  width: 100%;
  height: calc(100vh - var(--app-navbar-height) - var(--app-tags-height) - 32px);
}

.app-frame__iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
