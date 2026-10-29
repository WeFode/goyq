<script setup lang="ts">
import { useRouter } from "vue-router";

defineOptions({ name: "Error500" });

const router = useRouter();
</script>

<template>
  <div class="app-error">
    <div class="app-error__code">500</div>
    <h2 class="app-error__title">服务暂时不可用</h2>
    <p class="app-error__desc">
      服务器处理请求时出现异常，请稍后重试或联系系统管理员。
    </p>
    <div class="app-error__actions">
      <el-button type="primary" @click="router.replace('/')">返回首页</el-button>
      <el-button @click="router.back()">返回上一页</el-button>
    </div>
  </div>
</template>

<style scoped>
.app-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}

.app-error__code {
  font-size: 88px;
  font-weight: 700;
  line-height: 1;
  color: var(--app-danger);
  opacity: 0.24;
}

.app-error__title {
  margin-top: 16px;
  font-size: var(--app-font-20);
  font-weight: 600;
  color: var(--app-text-1);
}

.app-error__desc {
  max-width: 420px;
  margin-top: 8px;
  font-size: var(--app-font-13);
  line-height: 22px;
  color: var(--app-text-3);
}

.app-error__actions {
  display: flex;
  gap: 8px;
  margin-top: 24px;
}
</style>
