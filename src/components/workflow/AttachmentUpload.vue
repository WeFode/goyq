<script setup lang="ts">
import { computed } from "vue";
import { uploadFile } from "@/api/common";
import { message } from "@/utils/message";
import { getAttachmentUrl, getFileExt } from "@/utils/workflow";

export interface AttachmentInfo {
  id?: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
}

interface Props {
  modelValue: AttachmentInfo[];
  limit?: number;
  maxSize?: number;
  accept?: string;
  buttonText?: string;
  tipText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  limit: 5,
  maxSize: 10,
  accept: ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar",
  buttonText: "上传附件",
  tipText: ""
});

const emit = defineEmits<{
  (e: "update:modelValue", value: AttachmentInfo[]): void;
}>();

const tip = computed(
  () =>
    props.tipText ||
    `支持常用办公格式，单个文件不超过 ${props.maxSize}MB，最多 ${props.limit} 个`
);

const fileList = computed(() =>
  (props.modelValue ?? []).map(file => ({
    name: file.name,
    url: getAttachmentUrl(file),
    status: "success" as const
  }))
);

function beforeUpload(file: File) {
  if (file.size / 1024 / 1024 >= props.maxSize) {
    message(`文件大小不能超过 ${props.maxSize}MB`, { type: "error" });
    return false;
  }
  return true;
}

async function handleUpload(options: any) {
  const { file } = options;
  if (!file || !(file instanceof File)) {
    message("无效的文件对象", { type: "error" });
    return;
  }

  try {
    const formData = new FormData();
    formData.append("file", file);

    const res: any = await uploadFile(formData);
    const uploaded = res?.data?.file;
    if (!uploaded) throw new Error("上传失败：返回数据格式错误");

    const info: AttachmentInfo = {
      id: uploaded.id,
      name: uploaded.fileName,
      url: uploaded.fileUrl,
      size: uploaded.fileSize,
      type: uploaded.fileType
    };

    const current = [...(props.modelValue ?? [])];
    if (!current.some(item => item.id === info.id)) {
      current.push(info);
      emit("update:modelValue", current);
    }
    message("上传成功", { type: "success" });
  } catch (error) {
    console.error("文件上传失败:", error);
    message("上传失败", { type: "error" });
  }
}

function handleRemove(uploadFileItem: any) {
  const current = [...(props.modelValue ?? [])];
  const index = current.findIndex(
    file =>
      file.name === uploadFileItem.name &&
      getAttachmentUrl(file) === uploadFileItem.url
  );
  if (index > -1) {
    current.splice(index, 1);
    emit("update:modelValue", current);
  }
}

/** 附件后缀，用于上传列表图标 */
const extOf = (name: string) => getFileExt(name);
</script>

<template>
  <div class="app-attachment">
    <el-upload
      :http-request="handleUpload"
      :file-list="fileList"
      :on-remove="handleRemove"
      :before-upload="beforeUpload"
      :limit="limit"
      :accept="accept"
      multiple
    >
      <el-button>
        <AppIcon icon="ep:upload" :size="14" />
        {{ buttonText }}
      </el-button>
      <template #tip>
        <div class="app-attachment__tip">{{ tip }}</div>
      </template>
      <template #file="{ file }">
        <span class="app-attachment__item">
          <AppIcon icon="ep:files" :size="14" />
          <span class="app-attachment__name">{{ file.name }}</span>
          <span class="app-attachment__ext">{{ extOf(file.name) }}</span>
        </span>
      </template>
    </el-upload>
  </div>
</template>

<style scoped lang="scss">
.app-attachment {
  width: 100%;

  &__tip {
    margin-top: 4px;
    font-size: var(--app-font-12);
    line-height: 18px;
    color: var(--app-text-3);
  }

  &__item {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__ext {
    font-size: var(--app-font-12);
    color: var(--app-text-4);
    text-transform: uppercase;
  }
}
</style>
