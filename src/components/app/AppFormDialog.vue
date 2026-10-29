<script setup lang="ts">
/**
 * 表单弹窗容器：统一 header / footer / 提交 loading
 * 用法：<AppFormDialog v-model="visible" title="新增账号" :loading="submitting" @confirm="submit">...</AppFormDialog>
 */
interface Props {
  modelValue: boolean;
  title?: string;
  width?: string | number;
  /** 提交中状态，作用于确认按钮 */
  loading?: boolean;
  confirmText?: string;
  cancelText?: string;
  closeOnClickModal?: boolean;
  appendToBody?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: "",
  width: "560px",
  loading: false,
  confirmText: "确定",
  cancelText: "取消",
  closeOnClickModal: false,
  appendToBody: false
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
  <el-dialog
    :model-value="modelValue"
    :title="title"
    :width="width"
    :close-on-click-modal="closeOnClickModal"
    :append-to-body="appendToBody"
    align-center
    destroy-on-close
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
    @closed="emit('closed')"
  >
    <slot />
    <template #footer>
      <el-button @click="onCancel">{{ cancelText }}</el-button>
      <el-button type="primary" :loading="props.loading" @click="emit('confirm')">
        {{ confirmText }}
      </el-button>
    </template>
  </el-dialog>
</template>
