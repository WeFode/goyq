<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  ensureSignedUrl,
  refreshSignedUrl,
  signedFileIdOf
} from "@/composables/useSignedFile";

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

/**
 * 头像地址也是带时效的签名地址（登录时签发，可能已在本地存了几十分钟）。
 * 这里不直接用它渲染：先预检、不足时效就静默续签，加载失败再强制换一次，
 * 两次都不成才回退首字色块——既不会破图，也不会因为一个过期地址丢掉头像。
 */
const url = ref(props.avatar);
const imageFailed = ref(false);
let retried = false;

async function ensure() {
  url.value = props.avatar;
  imageFailed.value = false;
  retried = false;
  if (!props.avatar) return;
  url.value = await ensureSignedUrl(props.avatar);
}

async function onError() {
  if (!retried && signedFileIdOf(url.value)) {
    retried = true;
    const fresh = await refreshSignedUrl(url.value);
    if (fresh && fresh !== url.value) {
      url.value = fresh;
      return;
    }
  }
  imageFailed.value = true;
}

onMounted(ensure);
watch(() => props.avatar, ensure);

const showImage = computed(() => !!url.value && !imageFailed.value);
</script>

<template>
  <img
    v-if="showImage"
    :src="url"
    class="app-avatar"
    :style="sizeStyle"
    alt=""
    @error="onError"
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
