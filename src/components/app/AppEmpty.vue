<script setup lang="ts">
/** 统一空状态 */
interface Props {
  description?: string;
  imageSize?: number;
}

withDefaults(defineProps<Props>(), {
  description: "暂无数据",
  imageSize: 96
});
</script>

<template>
  <div class="app-empty">
    <el-empty :image-size="imageSize" :description="description">
      <slot />
    </el-empty>
  </div>
</template>

<style scoped>
.app-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
}
</style>
