<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ContextMenu from "./ContextMenu.vue";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { handleAliveRoute } from "@/router/utils";
import { routerArrays } from "@/layout/types";

/**
 * 多标签页
 * 交互：点击切换、关闭、右键菜单（刷新/关闭/关闭其他/关闭全部）
 * 固定标签（首页等）不可关闭，逻辑与旧实现保持一致
 */
const route = useRoute();
const router = useRouter();
const multiTagsStore = useMultiTagsStoreHook();

const tags = computed(() => multiTagsStore.multiTags);
const scrollRef = ref<HTMLElement>();

const fixedPaths = routerArrays.map(item => item.path);

const isActive = (tag: any) => tag.path === route.path;

const isFixed = (tag: any) => fixedPaths.includes(tag.path);

const menuVisible = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const menuTag = ref<any>(null);

const canRefresh = computed(() => !!menuTag.value && !isFixed(menuTag.value));
const canClose = computed(() => !!menuTag.value && !isFixed(menuTag.value));

function handleClick(tag: any) {
  if (isActive(tag)) return;
  router.push({ path: tag.path, query: tag.query });
}

function handleClose(tag: any) {
  if (isFixed(tag)) return;

  const index = tags.value.findIndex(item => item.path === tag.path);
  if (index === -1) return;

  // 关闭前记录是否为当前页（标签 path 可能与当前路由不完全一致）
  const closingActive =
    isActive(tag) || route.meta?.activePath === tag.path || route.path === tag.path;

  multiTagsStore.handleTags("splice", tag.path);

  if (!closingActive) return;

  // 优先后退到左侧相邻标签，其次右侧，最后固定标签
  const next = tags.value[index - 1] ?? tags.value[index] ?? tags.value[0];
  router.push(next?.path ?? "/");
}

function refreshTag(tag: any) {
  handleAliveRoute({ name: tag.name, meta: tag.meta } as any, "refresh");
  router.replace(`/redirect${tag.path}`);
}

function closeOthers(tag: any) {
  const keep = tags.value.filter(
    item => isFixed(item) || item.path === tag.path
  );
  multiTagsStore.handleTags("equal", keep);
  if (!isActive(tag)) router.push(tag.path);
}

function closeAll() {
  const keep = tags.value.filter(item => isFixed(item));
  multiTagsStore.handleTags("equal", keep);
  const target = keep[keep.length - 1];
  if (target) router.push(target.path);
}

function onContextMenu(event: MouseEvent, tag: any) {
  if (isFixed(tag) && fixedPaths.length === 1) return;
  event.preventDefault();
  menuTag.value = tag;
  menuX.value = event.clientX;
  menuY.value = event.clientY;
  menuVisible.value = true;
}

function onMenuSelect(command: string) {
  const tag = menuTag.value;
  menuVisible.value = false;
  if (!tag) return;

  if (command === "refresh") refreshTag(tag);
  if (command === "close") handleClose(tag);
  if (command === "closeOthers") closeOthers(tag);
  if (command === "closeAll") closeAll();
}

/** 自动滚动到当前激活标签 */
watch(
  () => route.path,
  async () => {
    await nextTick();
    const active = scrollRef.value?.querySelector(".app-tags__item.is-active");
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  },
  { immediate: true }
);

/** 关闭浏览器/页面级缓存时清空标签，避免残留 */
const handleReset = () => multiTagsStore.resetTags();
defineExpose({ handleReset });
</script>

<template>
  <div class="app-tags">
    <div ref="scrollRef" class="app-tags__scroll">
      <div class="app-tags__list">
        <div
          v-for="tag in tags"
          :key="tag.path"
          class="app-tags__item"
          :class="{ 'is-active': isActive(tag) }"
          @click="handleClick(tag)"
          @contextmenu="onContextMenu($event, tag)"
        >
          <i v-if="isActive(tag)" class="app-tags__item-dot" />
          <span>{{ tag.meta?.title }}</span>
          <span
            v-if="!isFixed(tag)"
            class="app-tags__item-close"
            @click.stop="handleClose(tag)"
          >
            <AppIcon icon="ep:close" :size="10" />
          </span>
        </div>
      </div>
    </div>

    <div class="app-tags__actions">
      <el-dropdown trigger="click">
        <span class="app-navbar__action">
          <AppIcon icon="ep:arrow-down" :size="14" />
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="refreshTag(route)">
              刷新当前页
            </el-dropdown-item>
            <el-dropdown-item @click="closeOthers(route)">
              关闭其他页
            </el-dropdown-item>
            <el-dropdown-item divided @click="closeAll">关闭全部页</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <ContextMenu
      :visible="menuVisible"
      :x="menuX"
      :y="menuY"
      :can-refresh="canRefresh"
      :can-close="canClose"
      @select="onMenuSelect"
      @close="menuVisible = false"
    />
  </div>
</template>
