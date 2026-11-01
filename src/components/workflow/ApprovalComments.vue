<script setup lang="ts">
import { computed, ref } from "vue";
import dayjs from "dayjs";
import { addInstanceComment } from "@/api/workflow";
import { message } from "@/utils/message";
import { getAttachmentUrl, isImageFile } from "@/utils/workflow";
import { previewAttachment } from "@/composables/useFilePreview";
import { openSignedFile } from "@/composables/useSignedFile";
import AttachmentUpload, { type AttachmentInfo } from "./AttachmentUpload.vue";

/** 审批评论面板：评论列表 + 新增评论（支持附件） */
interface Props {
  instanceId: string;
  history?: any[];
}

const props = withDefaults(defineProps<Props>(), {
  history: () => []
});

const emit = defineEmits<{ (e: "success"): void }>();

const submitting = ref(false);
const content = ref("");
const files = ref<AttachmentInfo[]>([]);

const commentList = computed(() =>
  (props.history ?? [])
    .filter(item => item.action === "comment")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    // 后端把评论附件存在 extraData.attachments，而不是顶层 attachments；
    // 之前模板直接读 item.attachments，导致评论附件胶囊永远不渲染
    .map(item => ({
      ...item,
      attachments: item.attachments ?? item.extraData?.attachments ?? []
    }))
);

const formatTime = (value: any) => {
  if (!value) return "";
  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD HH:mm") : String(value);
};

const fileUrl = (file: any) => getAttachmentUrl(file);
const fileName = (file: any) => file?.fileName || file?.name || "附件";

/** 附件点击走应用内离线预览（能预览与否、用哪种方式由后端判定） */
function onPreview(file: any) {
  if (previewAttachment(file)) return;
  message("附件地址不可用", { type: "error" });
}

/** 下载：点击那一刻先确认签名地址可用，过期则静默续签 */
function downloadAttachment(file: any) {
  void openSignedFile(file, { mode: "download", fileName: fileName(file) });
}

async function submit() {
  if (!content.value.trim()) {
    message("请输入评论内容", { type: "warning" });
    return;
  }

  submitting.value = true;
  try {
    await addInstanceComment({
      instanceId: props.instanceId,
      comment: content.value.trim(),
      fileIds: files.value.map(file => file.id)
    });
    content.value = "";
    files.value = [];
    message("评论已发布", { type: "success" });
    emit("success");
  } catch (error) {
    console.error("提交评论失败:", error);
    message("提交评论失败", { type: "error" });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="app-comments">
    <!-- 新增评论 -->
    <div class="app-comments__editor">
      <el-input
        v-model="content"
        type="textarea"
        :rows="3"
        maxlength="500"
        show-word-limit
        placeholder="填写评论，支持上传附件"
      />
      <div class="app-comments__editor-footer">
        <AttachmentUpload v-model="files" :limit="5" button-text="添加附件" />
        <el-button type="primary" :loading="submitting" @click="submit">
          发布评论
        </el-button>
      </div>
    </div>

    <!-- 评论列表 -->
    <ul v-if="commentList.length" class="app-comments__list">
      <li
        v-for="item in commentList"
        :key="item.id"
        class="app-comments__item"
      >
        <header class="app-comments__header">
          <AppUserAvatar
            :name="item.operatorName"
            :avatar="item.operatorAvatar"
            :size="28"
          />
          <div class="app-comments__meta">
            <span class="app-comments__author">{{ item.operatorName }}</span>
            <span class="app-comments__time">
              {{ formatTime(item.createdAt) }}
            </span>
          </div>
        </header>
        <p class="app-comments__content">{{ item.comment }}</p>

        <div v-if="item.attachments?.length" class="app-comments__files">
          <div
            v-for="file in item.attachments"
            :key="file.fileId || file.fileName"
            class="app-comments__file"
            role="button"
            tabindex="0"
            title="点击预览"
            @click="onPreview(file)"
            @keydown.enter.prevent="onPreview(file)"
          >
            <AppSignedImage
              v-if="isImageFile(file)"
              class="app-comments__thumb"
              :file="file"
              fit="cover"
            />
            <AppIcon v-else icon="ep:files" :size="14" />
            <span class="app-comments__file-name">{{ fileName(file) }}</span>
            <a
              class="app-comments__file-dl"
              :href="fileUrl(file)"
              target="_blank"
              rel="noopener"
              title="下载"
              @click.prevent.stop="downloadAttachment(file)"
            >
              <AppIcon icon="ep:download" :size="13" />
            </a>
          </div>
        </div>
      </li>
    </ul>

    <AppEmpty v-else description="暂无评论" :image-size="72" />
  </div>
</template>

<style scoped lang="scss">
.app-comments {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__editor-footer {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__item {
    padding: 12px;
    background: var(--app-subtle);
    border-radius: var(--app-radius-sm);
  }

  &__header {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }

  &__author {
    font-size: var(--app-font-13);
    font-weight: 500;
    color: var(--app-text-1);
  }

  &__time {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__content {
    font-size: var(--app-font-14);
    line-height: 22px;
    color: var(--app-text-2);
    white-space: pre-wrap;
  }

  &__files {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  &__file {
    display: flex;
    gap: 6px;
    align-items: center;
    max-width: 220px;
    padding: 4px 8px;
    font-size: var(--app-font-12);
    color: var(--app-text-2);
    cursor: pointer;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-xs);
    transition:
      color var(--app-duration-fast),
      border-color var(--app-duration-fast);

    &:hover {
      color: var(--app-primary);
      border-color: var(--app-primary);
    }
  }

  &__file-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 预览与下载分离：默认在应用内离线预览，下载仍是直链 */
  &__file-dl {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    color: var(--app-text-4);

    &:hover {
      color: var(--app-primary);
    }
  }

  &__thumb {
    width: 18px;
    height: 18px;
    border-radius: 2px;
  }
}
</style>
