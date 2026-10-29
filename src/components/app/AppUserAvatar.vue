<script setup lang="ts">
import { computed, ref, watch } from "vue";

/**
 * 用户头像：有头像时展示图片，否则展示姓名首字色块
 * 同一姓名始终得到相同底色，避免列表中出现颜色跳变
 */
interface Props {
  name?: string;
  avatar?: string;
  size?: number;
  /** 是否圆形，默认圆形 */
  circle?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  name: "",
  avatar: "",
  size: 28,
  circle: true
});

const palette = [
  "#1f5ae0",
  "#0faf5f",
  "#e37318",
  "#7a5af8",
  "#0ea5c6",
  "#d9372b"
];

const text = computed(() => {
  const name = (props.name ?? "").trim();
  if (!name) return "?";
  // 中文取最后一个字，英文取首字母
  return /[\u4e00-\u9fa5]/.test(name)
    ? name.slice(-1)
    : name.slice(0, 1).toUpperCase();
});

const bgColor = computed(() => {
  const name = props.name ?? "";
  const hash = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
});

const sizeStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.42)}px`,
  borderRadius: props.circle ? "50%" : "var(--app-radius-sm)"
}));

/** 头像加载失败时回退为首字色块，避免列表出现破图 */
const imageFailed = ref(false);
watch(
  () => props.avatar,
  () => (imageFailed.value = false)
);
const showImage = computed(() => !!props.avatar && !imageFailed.value);
</script>

<template>
  <img
    v-if="showImage"
    :src="avatar"
    class="app-avatar"
    :style="sizeStyle"
    alt=""
    @error="imageFailed = true"
  />
  <span v-else class="app-avatar app-avatar--text" :style="sizeStyle">
    {{ text }}
  </span>
</template>

<style scoped>
.app-avatar {
  flex-shrink: 0;
  object-fit: cover;
}

.app-avatar--text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  color: #fff;
  background: v-bind(bgColor);
  user-select: none;
}
</style>
