<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  ensureSignedUrl,
  refreshSignedUrl,
  signedFileIdOf
} from "@/composables/useSignedFile";

/**
 * 会自愈的附件图片
 *
 * 附件地址是带时效的签名 URL（默认 15 分钟），而页面数据的存活期由用户决定：
 * 审批详情开着半小时再看缩略图，地址早就过期，浏览器只给一个碎图。
 * 这里做两层兜底，让用户不需要知道「刷新」这个动作存在：
 *   1) 渲染前预检——剩余时效不足就静默换一个新签名地址（多数情况一次就对，看不到异常）；
 *   2) 加载失败再强制换一次——覆盖服务器提前作废、本地时钟偏差等预检算不到的情况；
 * 两次都不成才走 #error 插槽，由调用方给占位，绝不显示浏览器破图。
 *
 * 续签会写回附件对象自身的 fileUrl/url 字段，因此依赖同一份数据的图片相册
 * preview-src-list、下载链接会随之一起刷新，不需要每个出口各修一遍。
 */

interface Props {
  /** 附件对象（含 id/fileId 与 fileUrl/url）；也可直接传签名地址字符串 */
  file?: any;
  fit?: string;
}

defineOptions({ name: "AppSignedImage" });

const props = withDefaults(defineProps<Props>(), {
  file: undefined,
  fit: "cover"
});

const sourceUrl = computed<string>(() =>
  typeof props.file === "string"
    ? props.file
    : String(props.file?.fileUrl || props.file?.url || "")
);

const url = ref(sourceUrl.value);
const failed = ref(false);
/** 每个地址只重试一次：换了地址仍失败就不是时效问题（文件丢失/无权限），再重试只会打转 */
let retried = false;

async function ensure() {
  if (!sourceUrl.value) return;
  const fresh = await ensureSignedUrl(props.file ?? sourceUrl.value);
  if (fresh) url.value = fresh;
}

onMounted(ensure);

watch(sourceUrl, next => {
  // 自己回写新地址引发的变化不重置状态，否则会与重试互相触发
  if (next === url.value) return;
  // 外部数据变化（如切换审批单）时以新地址为准，并重新给一次自愈机会
  url.value = next;
  failed.value = false;
  retried = false;
  void ensure();
});

async function onError() {
  if (!retried && signedFileIdOf(props.file ?? url.value)) {
    retried = true;
    const fresh = await refreshSignedUrl(props.file ?? url.value);
    if (fresh && fresh !== url.value) {
      url.value = fresh;
      return;
    }
  }
  failed.value = true;
}
</script>

<template>
  <el-image
    v-if="url && !failed"
    class="app-signed-image"
    :src="url"
    :fit="fit"
    @error="onError"
  >
    <template v-if="$slots.error" #error>
      <slot name="error" />
    </template>
  </el-image>
  <div v-else class="app-signed-image app-signed-image__fallback">
    <slot name="error">
      <AppIcon icon="ep:picture" :size="16" />
    </slot>
  </div>
</template>

<style scoped lang="scss">
.app-signed-image__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 24px;
  color: var(--app-text-secondary, #86909c);
  background: var(--app-fill-light, #f5f6f8);
}
</style>
