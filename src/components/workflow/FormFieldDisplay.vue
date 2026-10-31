<script setup lang="ts">
import { computed } from "vue";
import dayjs from "dayjs";
import { numberToUppercase } from "@/utils/numberToUppercase";
import {
  formatFileSize,
  getAttachmentUrl,
  getFileIcon,
  isImageFile
} from "@/utils/workflow";
import { previewAttachment } from "@/composables/useFilePreview";
import { message } from "@/utils/message";

/**
 * 表单字段只读展示：用于审批详情、列表卡片摘要
 * 字段结构：{ name, label, type, props }
 */
interface Props {
  field: any;
  value: any;
  showUppercase?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showUppercase: true
});

const fieldProps = computed<Record<string, any>>(() => {
  const raw = props.field?.props;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw ?? {};
});

const isEmpty = computed(
  () =>
    props.value === null ||
    props.value === undefined ||
    props.value === "" ||
    (Array.isArray(props.value) && props.value.length === 0)
);

/* ============ 选项类字段 ============ */
const getOptionLabel = (value: any) => {
  const options: any[] = fieldProps.value.options ?? [];
  const target = options.find(option => option.value === value);
  return target?.label ?? value ?? "-";
};

const checkboxLabels = computed(() =>
  Array.isArray(props.value) ? props.value.map(getOptionLabel) : []
);

/* ============ 数字 ============ */
const numberText = computed(() => {
  if (isEmpty.value) return "-";
  const unit = fieldProps.value.unit ?? "";
  return `${Number(props.value).toLocaleString()}${unit}`;
});

const uppercaseText = computed(() => {
  const fieldFlag = fieldProps.value.showUppercase;
  const enabled =
    fieldFlag === undefined ? props.showUppercase : Boolean(fieldFlag);
  if (!enabled || isEmpty.value) return "";
  return numberToUppercase(Number(props.value));
});

/* ============ 日期 ============ */
const DATE_FORMATS: Record<string, string> = {
  datetime: "YYYY-MM-DD HH:mm:ss",
  datetimerange: "YYYY-MM-DD HH:mm:ss",
  date: "YYYY-MM-DD",
  daterange: "YYYY-MM-DD",
  month: "YYYY-MM",
  monthrange: "YYYY-MM",
  year: "YYYY"
};

const dateText = computed(() => {
  if (isEmpty.value) return "-";
  const type = fieldProps.value.type ?? "date";
  const format =
    fieldProps.value.format ?? DATE_FORMATS[type] ?? "YYYY-MM-DD";

  if (Array.isArray(props.value)) {
    const [start, end] = props.value;
    const startText = dayjs(start).isValid() ? dayjs(start).format(format) : "-";
    const endText = dayjs(end).isValid() ? dayjs(end).format(format) : "-";
    return `${startText} ~ ${endText}`;
  }

  const date = dayjs(props.value);
  return date.isValid() ? date.format(format) : "-";
});

/* ============ 附件 ============ */
const files = computed<any[]>(() =>
  Array.isArray(props.value) ? props.value : []
);

const imagePreviewList = computed(() =>
  files.value
    .filter(file => isImageFile(file) && getAttachmentUrl(file))
    .map(file => getAttachmentUrl(file))
);

const fileUrl = (file: any) => getAttachmentUrl(file);

const fileName = (file: any) => file?.name || file?.fileName || "附件";

/**
 * 附件预览统一交给应用内的 FilePreview 宿主：
 * 能不能预览、用什么方式预览由后端 /common/file/{id}/preview 判定。
 * 原来的“pdf 跳新页 + Office 拼微软在线预览外链”已去掉：
 * 政务/内网环境没有外网出口，那个外链在客户现场注定是死链，
 * 而且会把带签名的附件地址交给第三方，本身也是数据外流。
 */
function previewFile(file: any) {
  if (previewAttachment(file)) return;
  message("文件地址无效", { type: "error" });
}

function downloadFile(file: any) {
  const url = fileUrl(file);
  if (!url) {
    message("文件地址无效", { type: "error" });
    return;
  }
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName(file);
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ============ 表格字段 ============ */
const tableColumns = computed<any[]>(() => fieldProps.value.columns ?? []);

const isUploadType = computed(() =>
  ["el-upload", "el-image-upload", "el-file-upload"].includes(
    props.field?.type
  )
);
</script>

<template>
  <div class="app-field-display">
    <!-- 多行文本 -->
    <div v-if="field.type === 'el-textarea'" class="app-field-display__pre">
      {{ isEmpty ? "-" : value }}
    </div>

    <!-- 数字 -->
    <span v-else-if="field.type === 'el-input-number'">
      <span class="app-field-display__number">{{ numberText }}</span>
      <span v-if="uppercaseText" class="app-field-display__uppercase">
        （{{ uppercaseText }}）
      </span>
    </span>

    <!-- 单选 / 下拉 -->
    <el-tag
      v-else-if="field.type === 'el-select' || field.type === 'el-radio-group'"
      effect="light"
      type="primary"
    >
      {{ isEmpty ? "-" : getOptionLabel(value) }}
    </el-tag>

    <!-- 多选 -->
    <span v-else-if="field.type === 'el-checkbox-group'">
      <template v-if="checkboxLabels.length">
        <el-tag
          v-for="label in checkboxLabels"
          :key="label"
          class="app-field-display__tag"
          effect="light"
          type="primary"
        >
          {{ label }}
        </el-tag>
      </template>
      <span v-else>-</span>
    </span>

    <!-- 日期 -->
    <span v-else-if="field.type === 'el-date-picker'">{{ dateText }}</span>

    <!-- 开关 -->
    <AppStatusTag
      v-else-if="field.type === 'el-switch'"
      :value="value ? 1 : 0"
      :map="{
        1: { text: '是', type: 'success' },
        0: { text: '否', type: 'info' }
      }"
    />

    <!-- 附件 / 图片 -->
    <div v-else-if="isUploadType && files.length" class="app-field-display__files">
      <div v-for="file in files" :key="fileUrl(file) || fileName(file)" class="app-field-display__file">
        <el-image
          v-if="isImageFile(file) && fileUrl(file)"
          class="app-field-display__thumb"
          :src="fileUrl(file)"
          :preview-src-list="imagePreviewList"
          :initial-index="
            imagePreviewList.findIndex(src => src === fileUrl(file))
          "
          fit="cover"
          lazy
        />
        <AppIcon v-else :icon="getFileIcon(fileName(file))" :size="16" />

        <div class="app-field-display__file-meta">
          <span class="app-field-display__file-name">{{ fileName(file) }}</span>
          <span v-if="formatFileSize(file.size)" class="app-field-display__file-size">
            {{ formatFileSize(file.size) }}
          </span>
        </div>

        <div class="app-field-display__file-actions">
          <el-button
            v-if="!isImageFile(file)"
            link
            type="primary"
            @click="previewFile(file)"
          >
            预览
          </el-button>
          <el-button link type="primary" @click="downloadFile(file)">
            下载
          </el-button>
        </div>
      </div>
    </div>

    <!-- 子表格 -->
    <el-table
      v-else-if="field.type === 'el-table' && Array.isArray(value) && value.length"
      :data="value"
      size="small"
      border
    >
      <el-table-column
        v-for="column in tableColumns"
        :key="column.prop"
        :prop="column.prop"
        :label="column.label"
        :width="column.width"
      />
    </el-table>

    <!-- 默认文本 -->
    <span v-else>{{ isEmpty ? "-" : value }}</span>
  </div>
</template>

<style scoped lang="scss">
.app-field-display {
  font-size: var(--app-font-14);
  line-height: var(--app-line-height);
  color: var(--app-text-1);

  &__pre {
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__number {
    font-family: "JetBrains Mono", Consolas, monospace;
  }

  &__uppercase {
    margin-left: 4px;
    color: var(--app-text-3);
  }

  &__tag + &__tag {
    margin-left: 4px;
  }

  &__files {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__file {
    display: flex;
    gap: 10px;
    align-items: center;
    // 单元格变窄时卡片必须能跟着缩，否则会把整张申请信息表撑宽
    min-width: 0;
    max-width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
  }

  &__thumb {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    border-radius: var(--app-radius-xs);
  }

  &__file-meta {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    font-size: var(--app-font-13);
  }

  &__file-name {
    overflow: hidden;
    color: var(--app-text-1);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__file-size {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__file-actions {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    align-items: center;
  }
}
</style>
