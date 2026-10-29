<script setup lang="ts">
import { unref } from "vue";
import { useRouter } from "vue-router";

/** 标签页刷新中转：跳到 /redirect/xxx 后立刻回跳原页面，用于重建组件 */
defineOptions({ name: "Redirect" });

const { currentRoute, replace } = useRouter();

const { params, query } = unref(currentRoute);
const { path } = params;

const _path = Array.isArray(path) ? path.join("/") : path;

replace({ path: `/${_path}`, query });
</script>

<template>
  <div />
</template>
