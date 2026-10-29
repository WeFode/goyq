<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

interface Crumb {
  title: string;
  path: string;
  clickable: boolean;
}

/** 依据 route.matched 生成面包屑，仅保留有标题的层级 */
const crumbs = computed<Crumb[]>(() => {
  const matched = route.matched.filter(item => item.meta?.title);
  return matched.map((item, index) => ({
    title: String(item.meta.title),
    path: item.path,
    clickable: index !== matched.length - 1 && !item.meta?.hiddenTag
  }));
});

function handleClick(crumb: Crumb) {
  if (!crumb.clickable) return;
  router.push(crumb.path);
}
</script>

<template>
  <div class="app-breadcrumb">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item v-for="crumb in crumbs" :key="crumb.path">
        <span
          :class="{ 'is-link': crumb.clickable }"
          @click="handleClick(crumb)"
        >
          {{ crumb.title }}
        </span>
      </el-breadcrumb-item>
    </el-breadcrumb>
  </div>
</template>

<style scoped>
.is-link {
  cursor: pointer;
}
</style>
