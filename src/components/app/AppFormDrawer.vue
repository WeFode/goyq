<script setup lang="ts">
/**
 * 表单抽屉容器：用于字段较多的新增/编辑场景
 */
interface Props {
  modelValue: boolean;
  title?: string;
  size?: string | number;
  loading?: boolean;
  confirmText?: string;
  cancelText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: "",
  size: "560px",
  loading: false,
  confirmText: "保存",
  cancelText: "取消"
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "confirm"): void;
  (e: "cancel"): void;
  (e: "closed"): void;
}>();

const onCancel = () => {
  emit("update:modelValue", false);
  emit("cancel");
};
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    :size="size"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
    @closed="emit('closed')"
  >
    <slot />
    <template #footer>
      <div class="app-drawer-footer">
        <el-button @click="onCancel">{{ cancelText }}</el-button>
        <el-button type="primary" :loading="props.loading" @click="emit('confirm')">
          {{ confirmText }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.app-drawer-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
