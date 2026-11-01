<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  archiveKbDoc,
  createKbDoc,
  deleteKbDoc,
  downloadKbDoc,
  kbCategoryListQuery,
  kbDocDetailQuery,
  kbDocListQuery,
  kbDocSearch,
  publishKbDoc,
  updateKbDoc,
  type KbCategory,
  type KbDoc
} from "@/api/kb";
import { uploadFile } from "@/api/common";
import { previewAttachment } from "@/composables/useFilePreview";
import { ElMessageBox } from "element-plus";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { KB_DOC_STATUS, KB_SCOPE } from "@/utils/dicts";
import { handleTree } from "@/utils/tree";
import { useTable } from "@/composables/useTable";

/**
 * 知识库 / 资料库
 * 左侧分类树 + 右侧文档列表；企业文档全员可见、个人文档仅本人可见。
 * 附件复用统一签名机制：业务侧只存 fileId，展示时由后端下发签名地址。
 */
defineOptions({ name: "KbDoc" });

/* ==================== 分类树 ==================== */
const categories = ref<KbCategory[]>([]);
const categoryTree = computed(() =>
  handleTree(
    categories.value.map(item => ({ ...item })),
    "id",
    "parentId",
    "children"
  )
);
const activeCategoryId = ref("");

async function loadCategories() {
  try {
    const res = await kbCategoryListQuery();
    categories.value = res?.data?.list ?? [];
  } catch (error) {
    console.error("加载分类失败:", error);
    categories.value = [];
  }
}

function selectCategory(node: KbCategory | null) {
  activeCategoryId.value = node?.id ?? "";
  search();
}

const categoryName = (id: string) =>
  categories.value.find(item => item.id === id)?.name || "未分类";

/* ==================== 列表 ==================== */
const query = reactive<{
  keyword: string;
  scope: "company" | "personal";
  /** 开启后走附件正文检索（而不是只比标题/标签） */
  searchContent: boolean;
}>({
  keyword: "",
  scope: "company",
  searchContent: false
});

/**
 * 本次检索后端给出的范围说明（扫描文档数上限等），直接展示不自己编文案
 */
const searchNote = ref("");

const { loading, list, pagination, search, refresh, reset, refreshAfterDelete } =
  useTable<KbDoc>({
    // 两种检索模式共用一条链路，否则分页/分类/排序会在两边漂移
    fetcher: (args: Record<string, any>) => {
      const { searchContent, ...params } = args;
      const scoped: Record<string, any> = {
        ...params,
        categoryId: activeCategoryId.value || undefined
      };
      const keyword = String(scoped.keyword || "").trim();
      const useContent = !!searchContent && !!keyword;
      const request = useContent
        ? kbDocSearch({ ...scoped, keyword })
        : kbDocListQuery({ ...scoped, keyword: keyword || undefined });
      return request.then((res: any) => {
        // 正文检索会回“本次只扫了多少篇”的范围说明；普通列表则清空该提示
        searchNote.value = useContent ? res?.data?.message || "" : "";
        return res;
      });
    },
    query
  });

function switchScope(scope: "company" | "personal") {
  query.scope = scope;
  search();
}

function resetQuery() {
  query.keyword = "";
  query.searchContent = false;
  activeCategoryId.value = "";
  searchNote.value = "";
  reset();
}

/**
 * 把命中片段拆成「普通文本 / 关键词」交替的片段列表。
 *
 * 不用 v-html 高亮：片段内容来自上传的文件正文，直接注入 HTML 等于把
 * 存储型 XSS 交给上传文件的人；渲染成节点序列就没这个口子。
 */
function snippetParts(snippet: string, needle: string) {
  const text = snippet || "";
  const keyword = (needle || "").trim();
  if (!keyword) return [{ text, hit: false }];

  const lowerText = text.toLowerCase();
  const lowerKey = keyword.toLowerCase();
  const parts: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const index = lowerText.indexOf(lowerKey, cursor);
    if (index < 0) {
      parts.push({ text: text.slice(cursor), hit: false });
      break;
    }
    if (index > cursor) {
      parts.push({ text: text.slice(cursor, index), hit: false });
    }
    parts.push({ text: text.slice(index, index + keyword.length), hit: true });
    cursor = index + keyword.length;
  }
  return parts.length ? parts : [{ text, hit: false }];
}

const snippetSegments = computed(() =>
  list.value.map(row => ({
    id: row.id,
    parts: snippetParts(row.snippet || "", query.keyword)
  }))
);

/* ==================== 新增 / 编辑 ==================== */
const dialogVisible = ref(false);
const dialogTitle = ref("上传文档");
const editingId = ref("");
const submitting = ref(false);
const formRef = ref<FormInstance>();
const form = reactive<{
  title: string;
  intro: string;
  categoryId: string;
  scope: "company" | "personal";
  tags: string;
}>({
  title: "",
  intro: "",
  categoryId: "",
  scope: "company",
  tags: ""
});

/** 已上传附件：只保留 fileId，url 仅用于即时预览 */
const attached = ref<Array<{ id: string; name: string; size?: number }>>([]);
const uploading = ref(false);

const canPublish = computed(() => hasAuth("kb:doc:publish"));

const rules: FormRules = {
  title: [
    { required: true, message: "请填写文档标题", trigger: "blur" },
    { max: 200, message: "标题不超过 200 字", trigger: "blur" }
  ],
  scope: [{ required: true, message: "请选择归属范围", trigger: "change" }]
};

function openCreate() {
  editingId.value = "";
  dialogTitle.value = "上传文档";
  form.title = "";
  form.intro = "";
  form.categoryId = activeCategoryId.value || "";
  form.scope = canPublish.value ? "company" : "personal";
  form.tags = "";
  attached.value = [];
  dialogVisible.value = true;
}

function openEdit(row: KbDoc) {
  editingId.value = row.id;
  dialogTitle.value = "编辑文档";
  form.title = row.title;
  form.intro = row.intro || "";
  form.categoryId = row.categoryId && row.categoryId !== "0" ? row.categoryId : "";
  form.scope = row.scope;
  form.tags = row.tags || "";
  attached.value = (row.attachments ?? []).map(item => ({
    id: item.id,
    name: item.name,
    size: item.size
  }));
  dialogVisible.value = true;
}

async function handleUpload(options: any) {
  const file = options.file;
  if (!file || !(file instanceof File)) {
    message("无效的文件对象", { type: "error" });
    return;
  }
  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("businessType", "kb_document");
    const res: any = await uploadFile(formData);
    const uploaded = res?.data?.file;
    if (!uploaded) throw new Error("上传失败：返回数据格式错误");
    if (!attached.value.some(item => item.id === uploaded.id)) {
      attached.value.push({
        id: uploaded.id,
        name: uploaded.fileName,
        size: uploaded.fileSize
      });
    }
    options.onSuccess?.(uploaded);
  } catch (error) {
    console.error("文件上传失败:", error);
    message("上传失败", { type: "error" });
    options.onError?.(error);
  } finally {
    uploading.value = false;
  }
}

function removeAttached(id: string) {
  attached.value = attached.value.filter(item => item.id !== id);
}

function submit() {
  formRef.value?.validate(async valid => {
    if (!valid) return;
    if (attached.value.length === 0) {
      message("请至少上传一个附件", { type: "warning" });
      return;
    }
    submitting.value = true;
    try {
      const fileIds = attached.value.map(item => item.id);
      const payload = {
        title: form.title,
        intro: form.intro,
        categoryId: form.categoryId || "0",
        tags: form.tags,
        fileIds
      };
      if (editingId.value) {
        await updateKbDoc(editingId.value, payload);
        message("保存成功", { type: "success" });
      } else {
        await createKbDoc({ ...payload, scope: form.scope });
        message("上传成功", { type: "success" });
      }
      dialogVisible.value = false;
      refresh();
    } catch (error) {
      console.error("保存文档失败:", error);
    } finally {
      submitting.value = false;
    }
  });
}

/* ==================== 详情 ==================== */
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<KbDoc | null>(null);

async function openDetail(row: KbDoc) {
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const res = await kbDocDetailQuery(row.id);
    detail.value = res?.data?.doc ?? null;
  } catch (error) {
    console.error("加载文档详情失败:", error);
    detail.value = null;
  } finally {
    detailLoading.value = false;
  }
}

async function handleDownload(attachmentId: string) {
  if (!detail.value) return;
  try {
    const res = await downloadKbDoc(detail.value.id, attachmentId);
    const items = res?.data?.attachments ?? [];
    const target = items[0];
    if (target?.url) {
      window.open(target.url, "_blank");
      detail.value.downloadCount = (detail.value.downloadCount ?? 0) + 1;
    } else {
      message("附件地址获取失败", { type: "error" });
    }
  } catch (error) {
    console.error("下载失败:", error);
  }
}

/* ==================== 发布 / 归档 / 删除 ==================== */
async function handlePublish(row: KbDoc) {
  try {
    await publishKbDoc(row.id);
    message("已发布到企业库", { type: "success" });
    refresh();
  } catch (error) {
    console.error("发布失败:", error);
  }
}

async function handleArchive(row: KbDoc) {
  const target = row.status === 1 ? 2 : 1;
  try {
    await archiveKbDoc(row.id, target);
    message(target === 2 ? "已归档" : "已恢复", { type: "success" });
    refresh();
  } catch (error) {
    console.error("归档操作失败:", error);
  }
}

async function handleDelete(row: KbDoc) {
  try {
    await ElMessageBox.confirm(
      `确认删除文档「${row.title}」？其附件将一并回收。`,
      "删除确认",
      { type: "warning" }
    );
  } catch {
    return;
  }
  try {
    await deleteKbDoc(row.id);
    message("删除成功", { type: "success" });
    refreshAfterDelete();
  } catch (error) {
    console.error("删除文档失败:", error);
  }
}

function formatSize(size?: number) {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "bmp", "webp"];

/** 按 MIME 或扩展名判断是否图片 */
function isImage(att: { type?: string; fileExt?: string; name?: string }) {
  if (att.type && att.type.startsWith("image/")) return true;
  const ext = (att.fileExt || att.name || "").split(".").pop()!.toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

const imageAttachments = computed(() =>
  (detail.value?.attachments ?? []).filter(item => isImage(item))
);
const fileAttachments = computed(() =>
  (detail.value?.attachments ?? []).filter(item => !isImage(item))
);
const imagePreviewList = computed(() =>
  imageAttachments.value.map(item => item.url)
);

/**
 * 附件预览统一交给布局根上的 FilePreview 宿主（见 composables/useFilePreview）：
 * 它能不能预览、用什么方式预览由后端 `/common/file/{id}/preview` 判定。
 * 原来的“拼微软在线预览外链”已去掉：政务/内网环境没有外网出口，
 * 那个链接在客户现场注定是死链，比“说不能预览”更伤信任。
 * 不在本页再挂一个弹窗实例，否则知识库和审批的行为会逐轮漂移。
 */
function openPreview(att: { id?: string; name?: string; fileName?: string }) {
  if (!previewAttachment(att)) {
    message("附件标识不可用", { type: "warning" });
  }
}

onMounted(() => {
  loadCategories();
  search();
});
</script>

<template>
  <AppPage
    title="知识库"
    description="沉淀企业与个人的文档、图片等资料，支持分类归档、范围隔离与签名下载"
  >
    <template #actions>
      <el-button
        v-if="hasAuth('kb:doc:add')"
        type="primary"
        @click="openCreate"
      >
        <AppIcon icon="ep:upload" :size="14" />
        上传文档
      </el-button>
    </template>

    <div class="kb">
      <!-- 左侧分类树 -->
      <aside class="kb__aside">
        <div class="kb__aside-head">
          <span>分类目录</span>
          <el-button link type="primary" @click="selectCategory(null)">全部</el-button>
        </div>
        <el-tree
          :data="categoryTree"
          node-key="id"
          :props="{ label: 'name', children: 'children' }"
          highlight-current
          :expand-on-click-node="false"
          default-expand-all
          @node-click="selectCategory"
        >
          <template #default="{ data }">
            <span class="kb__tree-node">
              <span>{{ data.name }}</span>
              <span class="kb__tree-count">{{ data.docCount || 0 }}</span>
            </span>
          </template>
        </el-tree>
        <AppEmpty v-if="!categoryTree.length" description="暂无分类" />
      </aside>

      <!-- 右侧内容 -->
      <section class="kb__main">
        <div class="kb__scope">
          <el-radio-group :model-value="query.scope" @change="switchScope($event as any)">
            <el-radio-button value="company">企业文档</el-radio-button>
            <el-radio-button value="personal">我的文件</el-radio-button>
          </el-radio-group>
        </div>

        <AppSearchBar :loading="loading" @search="search" @reset="resetQuery">
          <el-form-item label="关键词">
            <el-input
              v-model="query.keyword"
              placeholder="标题或标签"
              clearable
            />
          </el-form-item>
          <el-form-item label="范围">
            <el-checkbox v-model="query.searchContent" @change="search">
              搜附件正文
            </el-checkbox>
          </el-form-item>
        </AppSearchBar>

        <el-alert
          v-if="searchNote"
          class="kb__note"
          type="info"
          show-icon
          :closable="false"
          :title="searchNote"
        />

        <AppDataTable
          :data="list"
          :loading="loading"
          :pagination="pagination"
          empty-text="暂无文档"
          @page-change="refresh"
        >
          <el-table-column label="封面" width="72" align="center">
            <template #default="{ row }">
              <AppSignedImage
                v-if="row.cover"
                :file="row.cover"
                fit="cover"
                class="kb__cover"
                @click="openDetail(row)"
              />
              <AppIcon v-else icon="ep:document" :size="22" class="kb__cover--none" />
            </template>
          </el-table-column>
          <el-table-column label="标题" min-width="220">
            <template #default="{ row }">
              <div class="kb__cell">
                <span class="app-text--strong">{{ row.title }}</span>
                <span v-if="row.tags" class="kb__muted">{{ row.tags }}</span>
                <span v-if="row.snippet" class="kb__snippet">
                  <template v-if="!row.snippetIsHit"
                    >命中位置靠后，以下为文档开头：</template
                  >
                  <template
                    v-for="(part, index) in (snippetSegments.find(s => s.id === row.id)?.parts ?? [])"
                    :key="index"
                  >
                    <mark v-if="part.hit" class="kb__snippet-hit">{{ part.text }}</mark>
                    <template v-else>{{ part.text }}</template>
                  </template>
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="分类" width="140">
            <template #default="{ row }">{{ categoryName(row.categoryId) }}</template>
          </el-table-column>
          <el-table-column label="范围" width="110" align="center">
            <template #default="{ row }">
              <AppStatusTag :value="row.scope" :map="KB_SCOPE" />
            </template>
          </el-table-column>
          <el-table-column label="归属人" prop="ownerName" width="110" />
          <el-table-column label="附件" width="80" align="center" prop="fileCount" />
          <el-table-column label="浏览 / 下载" width="120" align="center">
            <template #default="{ row }">
              {{ row.viewCount }} / {{ row.downloadCount }}
            </template>
          </el-table-column>
          <el-table-column label="上传时间" prop="createdAt" width="170" />
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openDetail(row)">查看</el-button>
              <el-button
                v-if="hasAuth('kb:doc:edit')"
                link
                type="primary"
                @click="openEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                v-if="row.scope === 'personal' && hasAuth('kb:doc:publish')"
                link
                type="success"
                @click="handlePublish(row)"
              >
                发布
              </el-button>
              <el-button
                v-if="hasAuth('kb:doc:edit')"
                link
                type="warning"
                @click="handleArchive(row)"
              >
                {{ row.status === 1 ? "归档" : "恢复" }}
              </el-button>
              <el-button
                v-if="hasAuth('kb:doc:delete')"
                link
                type="danger"
                @click="handleDelete(row)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </AppDataTable>
      </section>
    </div>

    <!-- 上传 / 编辑 -->
    <AppFormDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :loading="submitting"
      width="640px"
      confirm-text="保存"
      @confirm="submit"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="文档标题" maxlength="200" show-word-limit clearable />
        </el-form-item>
        <el-form-item v-if="!editingId" label="归属范围" prop="scope">
          <el-radio-group v-model="form.scope">
            <el-radio-button v-if="canPublish" value="company">企业文档</el-radio-button>
            <el-radio-button value="personal">我的文件</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="分类">
          <el-tree-select
            v-model="form.categoryId"
            :data="categoryTree"
            node-key="id"
            :props="{ label: 'name', children: 'children', value: 'id' }"
            placeholder="选择分类（可不选）"
            check-strictly
            clearable
            class="w-full"
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tags" placeholder="多个标签用逗号分隔" clearable />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.intro" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="附件">
          <div class="kb__upload">
            <el-upload :http-request="handleUpload" :show-file-list="false" multiple>
              <el-button :loading="uploading">
                <AppIcon icon="ep:paperclip" :size="14" />
                选择文件
              </el-button>
            </el-upload>
            <ul v-if="attached.length" class="kb__upload-list">
              <li v-for="item in attached" :key="item.id" class="kb__upload-item">
                <AppIcon icon="ep:document" :size="14" />
                <span class="kb__upload-name">{{ item.name }}</span>
                <span class="kb__muted">{{ formatSize(item.size) }}</span>
                <el-button link type="danger" @click="removeAttached(item.id)">移除</el-button>
              </li>
            </ul>
          </div>
        </el-form-item>
      </el-form>
    </AppFormDialog>

    <!-- 详情 -->
    <AppFormDrawer
      v-model="detailVisible"
      title="文档详情"
      size="520px"
      :loading="detailLoading"
      confirm-text="关闭"
      @confirm="detailVisible = false"
    >
      <template v-if="detail">
        <AppDetailSection title="基本信息">
          <div class="kb__field">
            <span class="kb__label">标题</span>
            <span class="kb__value">{{ detail.title }}</span>
          </div>
          <div class="kb__field">
            <span class="kb__label">分类</span>
            <span class="kb__value">{{ categoryName(detail.categoryId) }}</span>
          </div>
          <div class="kb__field">
            <span class="kb__label">范围</span>
            <AppStatusTag :value="detail.scope" :map="KB_SCOPE" />
          </div>
          <div class="kb__field">
            <span class="kb__label">状态</span>
            <AppStatusTag :value="detail.status" :map="KB_DOC_STATUS" />
          </div>
          <div class="kb__field">
            <span class="kb__label">归属人</span>
            <span class="kb__value">{{ detail.ownerName || "-" }}</span>
          </div>
          <div class="kb__field">
            <span class="kb__label">上传时间</span>
            <span class="kb__value">{{ detail.createdAt || "-" }}</span>
          </div>
          <div v-if="detail.tags" class="kb__field">
            <span class="kb__label">标签</span>
            <span class="kb__value">{{ detail.tags }}</span>
          </div>
          <div v-if="detail.intro" class="kb__field">
            <span class="kb__label">简介</span>
            <span class="kb__value">{{ detail.intro }}</span>
          </div>
        </AppDetailSection>

        <AppDetailSection title="附件">
          <div v-if="detail.attachments?.length" class="kb__attachments">
            <!-- 图片：缩略图网格，点击全屏预览 -->
            <div v-if="imageAttachments.length" class="kb__thumbs">
              <AppSignedImage
                v-for="(att, index) in imageAttachments"
                :key="att.id"
                :file="att"
                :preview-src-list="imagePreviewList"
                :initial-index="index"
                fit="cover"
                preview-teleported
                class="kb__thumb"
              />
            </div>
            <!-- 文档：统一预览入口（PDF 本地渲染，不可预览时明说并给下载） -->
            <div v-if="fileAttachments.length" class="kb__files">
              <div
                v-for="att in fileAttachments"
                :key="att.id"
                class="kb__attach-row"
              >
                <AppIcon icon="ep:document" :size="14" />
                <span class="kb__attach-name">{{ att.name }}</span>
                <span class="kb__muted">{{ formatSize(att.size) }}</span>
                <el-button link type="primary" @click="openPreview(att)">
                  预览
                </el-button>
                <el-button link type="primary" @click="handleDownload(att.id)">
                  下载
                </el-button>
              </div>
            </div>
          </div>
          <AppEmpty v-else description="无附件" />
        </AppDetailSection>
      </template>

      <AppEmpty v-else-if="!detailLoading" description="未找到文档" />
    </AppFormDrawer>
  </AppPage>
</template>

<style scoped lang="scss">
.kb {
  display: flex;
  gap: 16px;
  align-items: flex-start;

  &__aside {
    flex: none;
    width: 220px;
    padding: 12px;
    background: var(--app-card);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__aside-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: var(--app-font-13);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__tree-node {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding-right: 8px;
  }

  &__tree-count {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__scope {
    margin-bottom: 12px;
  }

  &__cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__muted {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  /* 正文检索命中片段：多行取前几行，不能把表格撑高 */
  &__snippet {
    display: -webkit-box;
    overflow: hidden;
    font-size: var(--app-font-12);
    line-height: 18px;
    color: var(--app-text-3);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  &__note {
    margin-bottom: 8px;
  }

  &__snippet-hit {
    padding: 0 1px;
    color: var(--app-text-1);
    background: var(--app-warning-bg, #fef3e6);
    border-radius: 2px;
  }

  &__upload {
    width: 100%;
  }

  &__upload-list {
    padding-left: 0;
    margin: 8px 0 0;
    list-style: none;
  }

  &__upload-item {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 4px 0;
    font-size: var(--app-font-13);
  }

  &__upload-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__field {
    display: flex;
    gap: 12px;
    align-items: baseline;
    padding: 6px 0;
  }

  &__label {
    flex: none;
    width: 76px;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__value {
    min-width: 0;
    font-size: var(--app-font-13);
    color: var(--app-text-1);
  }

  &__attach {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__attachments {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__thumbs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  &__thumb {
    width: 100%;
    height: 76px;
    overflow: hidden;
    cursor: zoom-in;
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
  }

  &__cover {
    width: 44px;
    height: 44px;
    overflow: hidden;
    cursor: pointer;
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
  }

  &__cover--none {
    color: var(--app-text-4);
  }

  &__files {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__attach-row {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 10px;
    background: var(--app-subtle);
    border-radius: var(--app-radius-sm);
  }

  &__attach-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--app-font-13);
  }
}
</style>
