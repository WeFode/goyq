<script setup lang="ts">
import { ref } from "vue";

/** 接口文档：内嵌后端 Swagger UI（/swagger 已在 vite / nginx 代理到后端） */
defineOptions({ name: "swaggerDocs" });

const loading = ref(true);

function onLoad() {
  loading.value = false;
}

function openInNewTab() {
  window.open("/swagger/", "_blank");
}
</script>

<template>
  <AppPage
    title="接口文档"
    description="后端 OpenAPI 文档，由 Swagger UI 渲染，可在线调试接口"
  >
    <template #actions>
      <el-button @click="openInNewTab">
        <AppIcon icon="ep:link" :size="14" />
        新窗口打开
      </el-button>
    </template>

    <div class="api-docs">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="文档来源：后端 /swagger/ 与 /api.json"
        description="开发环境由 Vite 代理、生产环境由 Nginx 转发到同一后端地址；若页面空白，请确认后端已启动并可访问 /api.json。"
      />

      <div v-loading="loading" class="api-docs__frame-wrap">
        <iframe
          src="/swagger/"
          class="api-docs__frame"
          title="Swagger 接口文档"
          @load="onLoad"
        />
      </div>
    </div>
  </AppPage>
</template>

<style scoped lang="scss">
.api-docs {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: var(--app-card-padding);
  background: var(--app-container);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);

  &__frame-wrap {
    height: calc(100vh - 300px);
    min-height: 480px;
    overflow: hidden;
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
  }

  &__frame {
    width: 100%;
    height: 100%;
    border: 0;
  }
}
</style>
