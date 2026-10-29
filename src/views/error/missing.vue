<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

/** 视图缺失提示页：后端菜单配置的 component 在前端不存在时展示 */
defineOptions({ name: "ErrorMissing" });

const route = useRoute();
const router = useRouter();

const currentPath = computed(() => route.fullPath);
</script>

<template>
  <AppPage title="页面未找到" description="后端菜单已配置，但前端缺少对应的视图组件">
    <div class="missing">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="该菜单指向的页面组件不存在"
        :description="`当前路径：${currentPath}。请检查「菜单管理」中的组件路径是否正确，或在前端补充对应视图文件。`"
      />
      <div class="missing__actions">
        <el-button type="primary" @click="router.push('/system/menu/index')">
          前往菜单管理
        </el-button>
        <el-button @click="router.push('/welcome')">返回首页</el-button>
      </div>
    </div>
  </AppPage>
</template>

<style scoped lang="scss">
.missing {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: var(--app-card-padding);
  background: var(--app-container);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);

  &__actions {
    display: flex;
    gap: 8px;
  }
}
</style>
