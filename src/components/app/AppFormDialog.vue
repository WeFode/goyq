<script setup lang="ts">
/**
 * 表单弹窗容器：统一 header / footer / 提交 loading
 * 用法：<AppFormDialog v-model="visible" title="新增账号" :loading="submitting" @confirm="submit">...</AppFormDialog>
 *
 * 只读型弹窗（选流程、看详情等）用 :show-cancel="false" 或 :show-confirm="false"，
 * 不要把文案改成空白来“藏”按钮——那样剩下来的按钮行为不变，用户会看到两个关闭。
 */
interface Props {
  modelValue: boolean;
  title?: string;
  width?: string | number;
  /** 提交中状态，作用于确认按钮 */
  loading?: boolean;
  confirmText?: string;
  cancelText?: string;
  /** 是否展示底部操作区；两个按钮都关掉时也应置 false（或改用 footer 插槽） */
  showFooter?: boolean;
  /** 是否展示确认按钮（只读弹窗可关掉，仅留关闭/取消） */
  showConfirm?: boolean;
  /** 是否展示取消按钮（例如“选择流程”弹窗只要一个关闭） */
  showCancel?: boolean;
  closeOnClickModal?: boolean;
  appendToBody?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: "",
  width: "560px",
  loading: false,
  confirmText: "确定",
  cancelText: "取消",
  showFooter: true,
  showConfirm: true,
  showCancel: true,
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
    <template v-if="showFooter" #footer>
      <!-- 需要更复杂的操作区时整体接管；否则用下面两个开关控制 -->
      <slot name="footer">
        <el-button v-if="showCancel" @click="onCancel">{{ cancelText }}</el-button>
        <el-button
          v-if="showConfirm"
          type="primary"
          :loading="props.loading"
          @click="emit('confirm')"
        >
          {{ confirmText }}
        </el-button>
      </slot>
    </template>
  </el-dialog>
</template>
