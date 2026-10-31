<script setup lang="ts">
import { computed, ref } from "vue";
import { iconNames } from "@/assets/icons";

/**
 * 菜单图标选择器
 * 从本地已注册的 iconify 图标（ep / ri / fa-solid）中挑选，避免手输字符串导致图标不渲染。
 * v-model 绑定图标名（如 `ep:setting`），空串表示无图标。
 */
interface Props {
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  placeholder: "点击选择图标",
  disabled: false,
  clearable: true
});

const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();

const keyword = ref("");
const visible = ref(false);

/** 按图标集前缀（ep / ri / fa-solid）分组展示 */
const grouped = computed(() => {
  const key = keyword.value.trim().toLowerCase();
  const matched = iconNames.filter(
    name => !key || name.toLowerCase().includes(key)
  );
  const buckets: Record<string, string[]> = {};
  for (const name of matched) {
    const prefix = name.slice(0, name.indexOf(":"));
    (buckets[prefix] ||= []).push(name);
  }
  return Object.entries(buckets)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([prefix, items]) => ({ prefix, items }));
});

const isEmpty = computed(() => grouped.value.length === 0);

function select(name: string) {
  emit("update:modelValue", name);
  visible.value = false;
}

function clear() {
  emit("update:modelValue", "");
  visible.value = false;
}
</script>

<template>
  <el-popover
    v-model:visible="visible"
    trigger="click"
    placement="bottom-start"
    :width="360"
    :disabled="disabled"
    popper-class="app-icon-picker__popper"
  >
    <template #reference>
      <div
        class="app-icon-picker__trigger"
        :class="{ 'is-disabled': disabled }"
      >
        <AppIcon v-if="modelValue" :icon="modelValue" :size="16" />
        <span v-else class="app-icon-picker__ph">{{ placeholder }}</span>
        <span class="app-icon-picker__name">{{ modelValue || "" }}</span>
        <span class="app-icon-picker__suffix">
          <AppIcon
            v-if="clearable && modelValue"
            icon="ep:circle-close"
            :size="14"
            class="app-icon-picker__clear"
            @click.stop="clear"
          />
          <AppIcon icon="ep:arrow-down" :size="12" class="app-icon-picker__arrow" />
        </span>
      </div>
    </template>

    <div class="app-icon-picker">
      <el-input
        v-model="keyword"
        size="small"
        placeholder="搜索图标名，如 folder / user"
        clearable
      >
        <template #prefix>
          <AppIcon icon="ep:search" :size="14" />
        </template>
      </el-input>

      <div class="app-icon-picker__body">
        <AppEmpty v-if="isEmpty" description="未找到匹配图标" :image-size="60" />
        <div v-else class="app-icon-picker__group" v-for="group in grouped" :key="group.prefix">
          <div class="app-icon-picker__prefix">{{ group.prefix }}</div>
          <div class="app-icon-picker__grid">
            <button
              v-for="name in group.items"
              :key="name"
              type="button"
              class="app-icon-picker__cell"
              :class="{ 'is-active': name === modelValue }"
              :title="name"
              @click="select(name)"
            >
              <AppIcon :icon="name" :size="20" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </el-popover>
</template>

<style scoped lang="scss">
.app-icon-picker {
  &__trigger {
    display: flex;
    gap: 6px;
    align-items: center;
    width: 100%;
    height: 32px;
    padding: 0 8px;
    color: var(--app-text-1);
    cursor: pointer;
    background: var(--app-card);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
    transition: border-color 0.16s;

    &:hover {
      border-color: var(--app-primary);
    }

    &.is-disabled {
      color: var(--app-text-4);
      cursor: not-allowed;
      background: var(--app-subtle);
    }
  }

  &__ph {
    color: var(--app-text-4);
  }

  &__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__suffix {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-left: auto;
  }

  &__clear {
    color: var(--app-text-4);

    &:hover {
      color: var(--app-danger);
    }
  }

  &__arrow {
    color: var(--app-text-4);
  }

  &__body {
    max-height: 260px;
    margin-top: 8px;
    overflow-y: auto;
  }

  &__group {
    margin-top: 8px;
  }

  &__prefix {
    margin-bottom: 4px;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    gap: 4px;
  }

  &__cell {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    color: var(--app-text-2);
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--app-radius-sm);

    &:hover {
      color: var(--app-primary);
      background: var(--app-primary-bg);
    }

    &.is-active {
      color: var(--app-primary);
      background: var(--app-primary-bg);
      border-color: var(--app-primary-border);
    }
  }
}
</style>
