<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
// worker 以本地资源形式打包：政务/涉密内网没有外网出口，
// 任何指向 CDN 的 workerSrc 都会让 PDF 预览整体失效
//
// 必须用 legacy 构建：pdf.js 6.x 主构建用了 2025 年才进标准草案的
// Map.prototype.getOrInsertComputed / getOrInsert，政企内网常见的
// Chrome 120 及以下没有这两个 API，会直接报
// “this._requestsByChunk.getOrInsertComputed is not a function”导致整份 PDF 打不开。
// legacy 构建自带这两个 API 的 shim（主包和 worker 都有），是官方支持的旧内核方案。
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import { filePreviewQuery, type FilePreviewInfo } from "@/api/file";
import { message } from "@/utils/message";

/**
 * 统一附件预览入口
 *
 * 只吃 fileId：由后端 /common/file/{id}/preview 决定「能不能看、用什么方式看」，
 * 组件不自己按扩展名猜。这样知识库、审批附件、公告与未来的公文包共用一套行为，
 * 也保证「不能预览」是一个明确的说明，而不是点了没反应或者跳外网死链。
 */
defineOptions({ name: "FilePreview" });

interface Props {
  modelValue: boolean;
  fileId: string;
  /** 展示用文件名，缺省取预览元信息里的名字 */
  name?: string;
}

const props = withDefaults(defineProps<Props>(), { name: "" });
const emit = defineEmits<{ (e: "update:modelValue", value: boolean): void }>();

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const loading = ref(false);
const errorMessage = ref("");
const meta = ref<FilePreviewInfo | null>(null);

/**
 * pdf.js 的文档对象必须用 shallowRef。
 *
 * 写成 ref() 会把 PDFDocumentProxy 包成深度响应式 Proxy，而 pdf.js 6.x 内部使用
 * class private fields（#xxx）；Proxy 转发属性时 private 字段访问失败，
 * 报 TypeError: Cannot read from private field，表现为“文档加载好了但页面全空白”。
 */
const pdfDoc = shallowRef<PDFDocumentProxy | null>(null);
const pageNum = ref(1);
const pageCount = ref(0);
const scale = ref(1.4);
const rotation = ref(0);
const rendering = ref(false);
const renderStalled = ref(false);
const zoomPreset = ref<"width" | "custom">("width");

const pageWrap = ref<HTMLDivElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const textLayerEl = ref<HTMLDivElement | null>(null);

const keyword = ref("");
const searched = ref(false);
const matchPages = ref<number[]>([]);
const activeMatch = ref(0);
/** 每页文本，避免重复向 worker 取 */
const pageTexts = new Map<number, string>();

let renderTask: ReturnType<PDFPageProxy["render"]> | null = null;
/**
 * 保留 loadingTask：pdf.js 中文档本身只有 cleanup()，
 * 真正要释放 worker 与内存的是 loadingTask.destroy()。
 */
let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

const isPdf = computed(() => meta.value?.kind === "pdf");
const isImage = computed(() => meta.value?.kind === "image");
const canNavigate = computed(() => matchPages.value.length > 0);
const matchLabel = computed(() =>
  matchPages.value.length
    ? `第 ${activeMatch.value} / ${matchPages.value.length} 处`
    : searched.value
      ? "无匹配"
      : ""
);
const title = computed(() => props.name || meta.value?.fileName || "附件预览");
const sizeLabel = computed(() => {
  const size = meta.value?.fileSize ?? 0;
  if (!size) return "";
  return size < 1024 * 1024
    ? `${(size / 1024).toFixed(1)} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;
});

/** 降级提示里的明细行：用数组拼接，避免模板里手动加 “ · ” 导致多余空格 */
const metaSummary = computed(() => {
  const info = meta.value;
  if (!info) return "";
  const parts = [`类型 ${info.fileExt || info.mimeType || "未知"}`];
  if (info.fileSize) parts.push(sizeLabel.value);
  if (info.textStatus === 3) parts.push("该格式暂不支持正文抽取");
  else if (info.textStatus === 2) parts.push("正文抽取失败，无法按内容检索");
  else if (info.textStatus === 0) parts.push("正文抽取排队中");
  return parts.join(" · ");
});

/** 已加载的附件标识：避开同一次打开里重复拉取（见下方 watch） */
let loadedFileId = "";

async function load(fileId: string) {
  resetViewer();
  if (!fileId) return;
  loadedFileId = fileId;

  loading.value = true;
  try {
    const res: any = await filePreviewQuery(fileId);
    const data: FilePreviewInfo = res?.data;
    if (!data) {
      errorMessage.value = res?.message || "获取附件信息失败";
      return;
    }
    meta.value = data;
    if (!data.previewable) {
      // 后端已经说明原因（格式不支持或超出大小），这里不再自行编造提示
      errorMessage.value = data.message || "该附件暂不支持在线预览";
      return;
    }
    if (data.kind === "pdf") {
      try {
        await openPdf(data.previewUrl);
      } catch (error: any) {
        // 文件损坏、加密等情况：必须说清楚并给出下载入口，
        // 不能让用户面对一片空白画布和“/ 0 页”
        errorMessage.value =
          `PDF 加载失败：${error?.message || "文件可能已损坏或加密"}`;
      }
    }
  } catch (error: any) {
    errorMessage.value = error?.message || "附件加载失败，请稍后重试";
  } finally {
    loading.value = false;
  }
}

function resetViewer() {
  meta.value = null;
  errorMessage.value = "";
  keyword.value = "";
  searched.value = false;
  matchPages.value = [];
  activeMatch.value = 0;
  pageTexts.clear();
  pageNum.value = 1;
  pageCount.value = 0;
  scale.value = 1.4;
  rotation.value = 0;
  void disposePdf();
}

async function openPdf(url: string) {
  // 整文件加载而非 Range 分段：实现稳定、不受静态服务是否支持 Range 影响；
  // 大小由后端参数 file.preview.maxPreviewMb 兜住，超大文件走“只下载”分支
  loadingTask = pdfjsLib.getDocument({ url });
  const doc = await loadingTask.promise;
  pdfDoc.value = doc;
  pageCount.value = doc.numPages;
  await nextTick();
  await renderPage();
}

/** 释放预览占用的 worker 与页面缓存；反复开关预览时不至于越用越卡 */
async function disposePdf() {
  const task = loadingTask;
  loadingTask = null;
  pdfDoc.value = null;
  try {
    renderTask?.cancel();
  } catch {
    /* 已完成的任务取消失败无需处理 */
  }
  renderTask = null;
  try {
    await task?.destroy();
  } catch (error) {
    console.warn("释放 PDF 预览资源失败", error);
  }
}

/** 渲染看门狗：极端情况下（后台标签被节流、解码卡住）不能让用户面对无限转圈 */
let renderWatchdog: ReturnType<typeof setTimeout> | null = null;

function armRenderWatchdog() {
  clearRenderWatchdog();
  renderWatchdog = setTimeout(() => {
    if (rendering.value) renderStalled.value = true;
  }, 15_000);
}

function clearRenderWatchdog() {
  if (renderWatchdog) {
    clearTimeout(renderWatchdog);
    renderWatchdog = null;
  }
  renderStalled.value = false;
}

async function renderPage() {
  const doc = pdfDoc.value;
  if (!doc) return;
  const wrap = pageWrap.value;
  const canvas = canvasEl.value;
  const layer = textLayerEl.value;
  if (!wrap || !canvas || !layer) return;

  rendering.value = true;
  armRenderWatchdog();
  try {
    if (renderTask) {
      renderTask.cancel();
      renderTask = null;
    }
    const page = await doc.getPage(pageNum.value);
    const viewport = page.getViewport({
      scale: scale.value,
      rotation: (rotation.value + page.rotate) % 360
    });

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建绘图上下文");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    renderTask = page.render({ canvasContext: ctx, viewport, canvas });
    await renderTask.promise;
    renderTask = null;

    // 文本层：既用于选中复制，也是检索高亮的位置来源
    const textContent = await page.getTextContent();
    layer.replaceChildren();
    await new pdfjsLib.TextLayer({
      textContentSource: textContent,
      container: layer,
      viewport
    }).render();

    // 给文本层定尺寸：pdf.js 写的是 width: round(down, var(--total-scale-factor) * 595px, var(--scale-round-x))，
    // 这几个 CSS 变量必须宿主提供；没定义时整层算出 0×0，
    // 而层内 span 用的是百分比定位，百分比乘以 0 就是 0 —— 高亮会全部堆到左上角。
    layer.style.setProperty("--total-scale-factor", String(scale.value));
    layer.style.setProperty("--scale-round-x", "1px");
    layer.style.setProperty("--scale-round-y", "1px");
    layer.style.width = `${Math.floor(viewport.width)}px`;
    layer.style.height = `${Math.floor(viewport.height)}px`;

    await highlightOnPage();
  } catch (error: any) {
    if (error?.name !== "RenderingCancelledException") {
      console.error("PDF 渲染失败:", error);
      message("PDF 渲染失败，可尝试下载后本地打开", { type: "error" });
    }
  } finally {
    clearRenderWatchdog();
    rendering.value = false;
  }
}

function matchesInText(text: string, needle: string): number[] {
  if (!needle) return [];
  const haystack = text.toLowerCase();
  const orders: number[] = [];
  let from = 0;
  while (from <= haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) break;
    orders.push(index);
    // 允许相邻命中：至少前进 1 个字符
    from = index + Math.max(needle.length, 1);
  }
  return orders;
}

/** 全文检索：逐页取文本建立命中列表（页数上限保护，避免超大文档长时间占用） */
async function searchDocument() {
  const doc = pdfDoc.value;
  const needle = keyword.value.trim().toLowerCase();
  searched.value = true;
  matchPages.value = [];
  activeMatch.value = 0;
  if (!doc) return;
  if (!needle) {
    await renderPage();
    return;
  }

  // 异常不能静默逃逸：否则会被当成“无匹配”，把系统故障说成“文档里没这个词”
  try {
    const limit = Math.min(doc.numPages, 500);
    for (let page = 1; page <= limit; page++) {
      let text = pageTexts.get(page);
      if (text === undefined) {
        const content = await (await doc.getPage(page)).getTextContent();
        text = content.items.map(item => ("str" in item ? item.str : "")).join(" ");
        pageTexts.set(page, text);
      }
      for (let i = 0; i < matchesInText(text, needle).length; i++) {
        matchPages.value.push(page);
      }
    }
    if (doc.numPages > limit) {
      message(`文档共 ${doc.numPages} 页，本次只在最近 ${limit} 页内检索`, {
        type: "info"
      });
    }
  } catch (error) {
    console.error("正文检索失败:", error);
    searched.value = false;
    message("正文检索失败，可重试或下载后本地查看", { type: "error" });
    return;
  }

  if (matchPages.value.length) {
    // 命中在其他页时先跳过去，否则停在当前页只做高亮
    const firstPage = matchPages.value[0];
    activeMatch.value = 1;
    if (firstPage !== pageNum.value) {
      await goPage(firstPage);
    } else {
      await renderPage();
    }
  } else {
    await renderPage();
  }
}

/**
 * 在当前页的文本层上高亮命中。
 *
 * 两个要点：
 *  1. 只给整个 span 上色会把整行都涂成高亮，所以拆分节点的文本子串，只包住真正匹配的那一段；
 *  2. 命中序号要跟全局列表对齐，否则“下一处”会跳到错的位置。
 */
async function highlightOnPage() {
  const layer = textLayerEl.value;
  if (!layer) return;
  const needle = keyword.value.trim().toLowerCase();
  if (!needle) return;

  // 本页在全局命中列表中的起始下标，以及当前选中项在本页内的序号
  let firstOnPage = -1;
  for (let i = 0; i < matchPages.value.length; i++) {
    if (matchPages.value[i] === pageNum.value) {
      if (firstOnPage < 0) firstOnPage = i;
    } else if (firstOnPage >= 0) {
      break;
    }
  }
  const activeOnPage =
    activeMatch.value > 0 && matchPages.value[activeMatch.value - 1] === pageNum.value
      ? activeMatch.value - 1 - firstOnPage
      : -1;

  const spans = Array.from(layer.querySelectorAll("span")) as HTMLSpanElement[];
  let order = 0;
  let activeEl: HTMLElement | null = null;

  for (const span of spans) {
    const text = span.textContent || "";
    if (!text) continue;
    const lower = text.toLowerCase();
    if (!lower.includes(needle)) continue;

    const fragments: (Text | HTMLElement)[] = [];
    let cursor = 0;
    while (cursor < text.length) {
      const index = lower.indexOf(needle, cursor);
      if (index < 0) {
        fragments.push(document.createTextNode(text.slice(cursor)));
        break;
      }
      if (index > cursor) {
        fragments.push(document.createTextNode(text.slice(cursor, index)));
      }
      const mark = document.createElement("mark");
      mark.className = "fp__hit";
      mark.dataset.order = String(order);
      if (order === activeOnPage) mark.classList.add("fp__hit--active");
      mark.textContent = text.slice(index, index + needle.length);
      fragments.push(mark);
      if (order === activeOnPage) activeEl = mark;
      order++;
      cursor = index + needle.length;
    }
    span.replaceChildren(...fragments);
  }

  activeEl?.scrollIntoView({ block: "center", behavior: "smooth" });
}

async function goPage(target: number) {
  const doc = pdfDoc.value;
  if (!doc) return;
  pageNum.value = Math.min(Math.max(1, target), doc.numPages);
  await renderPage();
}

async function stepMatch(delta: number) {
  if (!matchPages.value.length) return;
  const next = activeMatch.value + delta;
  if (next < 1 || next > matchPages.value.length) return;
  activeMatch.value = next;
  const targetPage = matchPages.value[next - 1];
  if (targetPage !== pageNum.value) {
    await goPage(targetPage);
  } else {
    await highlightOnPage();
  }
}

function zoom(factor: number) {
  zoomPreset.value = "custom";
  scale.value = Math.min(4, Math.max(0.6, Number((scale.value * factor).toFixed(2))));
  void renderPage();
}

async function fitWidth() {
  zoomPreset.value = "width";
  const doc = pdfDoc.value;
  const wrap = pageWrap.value;
  if (!doc || !wrap) return;
  const page = await doc.getPage(pageNum.value);
  const base = page.getViewport({ scale: 1 });
  const available = wrap.clientWidth - 32;
  if (available > 0) {
    scale.value = Number(Math.min(4, Math.max(0.6, available / base.width)).toFixed(2));
    await renderPage();
  }
}

function rotate() {
  rotation.value = (rotation.value + 90) % 360;
  void renderPage();
}

function download() {
  const url = meta.value?.downloadUrl || meta.value?.previewUrl;
  if (!url) {
    message("下载地址不可用", { type: "warning" });
    return;
  }
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = meta.value?.fileName || "attachment";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * 打印：把签名地址放进隐藏 iframe，用浏览器自带的 PDF 查看器打印。
 * 预览地址与站点同源（/api/v1 前缀），因此可直接调用 print；
 * 若被改到独立附件域名（跨域），这里退化为新窗口打开，不假装打印成功。
 */
function print() {
  const url = meta.value?.previewUrl;
  if (!url) {
    message("预览地址不可用", { type: "warning" });
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;";
  iframe.src = url;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
    window.setTimeout(() => iframe.remove(), 60_000);
  };
  document.body.appendChild(iframe);
}

function openExternally() {
  const url = meta.value?.previewUrl || meta.value?.downloadUrl;
  if (url) window.open(url, "_blank");
}

function close() {
  emit("update:modelValue", false);
}

watch(
  () => [props.modelValue, props.fileId] as const,
  ([visible, fileId]) => {
    // 同一文件不重复加载：弹窗开关与 fileId 变更可能落在同一个 flush 里，
    // 极端情况下会触发两轮“取元信息 + 拉文件 + 起 worker”
    if (visible && fileId && fileId !== loadedFileId) void load(fileId);
    if (!visible) {
      loadedFileId = "";
      resetViewer();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  void disposePdf();
});
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="920px"
    top="6vh"
    destroy-on-close
    append-to-body
    class="fp"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
    @closed="resetViewer"
  >
    <div v-loading="loading" class="fp__body">
      <div v-if="errorMessage" class="fp__notice">
        <AppIcon icon="ep:warning-filled" :size="18" />
        <div class="fp__notice-text">
          <div>{{ errorMessage }}</div>
          <div v-if="meta" class="fp__notice-sub">{{ metaSummary }}</div>
        </div>
        <el-button type="primary" @click="download">下载附件</el-button>
      </div>

      <!-- 图片：交给浏览器原生渲染，缩放与拖拽由容器承担 -->
      <div v-else-if="isImage" class="fp__stage">
        <img :src="meta?.previewUrl" :alt="title" class="fp__image" />
      </div>

      <!-- PDF：canvas 渲染 + 文本层（可复制、可高亮） -->
      <template v-else-if="isPdf">
        <div class="fp__toolbar">
          <el-button-group size="small">
            <el-button :disabled="pageNum <= 1" @click="goPage(pageNum - 1)">
              上一页
            </el-button>
            <el-button :disabled="pageNum >= pageCount" @click="goPage(pageNum + 1)">
              下一页
            </el-button>
          </el-button-group>
          <span class="fp__pager">
            <el-input-number
              v-model="pageNum"
              :min="1"
              :max="pageCount || 1"
              size="small"
              controls-position="right"
              @change="goPage(pageNum)"
            />
            <span class="fp__muted">/ {{ pageCount }} 页</span>
          </span>
          <el-button-group size="small">
            <el-button @click="zoom(0.85)">缩小</el-button>
            <el-button @click="zoom(1.18)">放大</el-button>
            <el-button @click="fitWidth">适应宽度</el-button>
            <el-button @click="rotate">旋转</el-button>
          </el-button-group>
          <div class="fp__find">
            <el-input
              v-model="keyword"
              size="small"
              placeholder="在正文中查找"
              clearable
              @keyup.enter="searchDocument"
              @clear="((searched = false), (matchPages = []), renderPage())"
            />
            <el-button size="small" type="primary" @click="searchDocument">查找</el-button>
            <el-button
              size="small"
              :disabled="!canNavigate"
              @click="stepMatch(-1)"
            >
              上一处
            </el-button>
            <el-button
              size="small"
              :disabled="!canNavigate"
              @click="stepMatch(1)"
            >
              下一处
            </el-button>
            <span v-if="matchLabel" class="fp__muted">{{ matchLabel }}</span>
          </div>
          <div class="fp__actions">
            <el-button size="small" @click="print">打印</el-button>
            <el-button size="small" @click="openExternally">新窗口</el-button>
            <el-button size="small" type="primary" @click="download">下载</el-button>
          </div>
        </div>

        <div ref="pageWrap" class="fp__stage fp__stage--pdf">
          <div v-if="rendering" class="fp__rendering">
            正在渲染本页…
            <span v-if="renderStalled" class="fp__stalled">
              渲染长时间未完成（页面可能被浏览器后台限流），可切回本标签重试，或直接
              <button type="button" class="fp__link" @click="download">下载后本地打开</button>
            </span>
          </div>
          <div class="fp__page">
            <canvas ref="canvasEl" class="fp__canvas" />
            <div ref="textLayerEl" class="fp__text textLayer" />
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <el-button @click="close">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.fp {
  &__body {
    min-height: 320px;
  }

  &__notice {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 16px;
    color: var(--app-text-1);
    background: var(--app-warning-bg, #fef3e6);
    border-radius: 6px;
  }

  &__notice-text {
    flex: 1;
    font-size: 13px;
    line-height: 20px;
  }

  &__notice-sub {
    margin-top: 4px;
    font-size: 12px;
    color: var(--app-text-3);
  }

  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding-bottom: 8px;
  }

  &__pager,
  &__find,
  &__actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  &__find {
    flex: 1;
    min-width: 320px;

    :deep(.el-input) {
      width: 160px;
    }
  }

  &__actions {
    margin-left: auto;
  }

  &__muted {
    font-size: 12px;
    color: var(--app-text-3);
  }

  &__stage {
    position: relative;
    height: 62vh;
    overflow: auto;
    background: #eef0f3;
    border-radius: 6px;
  }

  &__page {
    position: relative;
    /* 必须收缩贴合 canvas 宽度：否则 canvas 的 margin:0 auto 会把它居中，
     * 而绝对定位的文本层从容器左边算起，高亮就会整体左偏半个居中量 */
    width: fit-content;
    margin: 16px auto;
  }

  &__canvas {
    display: block;
    box-shadow: 0 2px 12px rgb(0 0 0 / 12%);
  }

  &__image {
    display: block;
    max-width: 100%;
    margin: 16px auto;
  }

  &__rendering {
    position: sticky;
    top: 8px;
    left: 8px;
    display: inline-block;
    padding: 2px 8px;
    margin: 8px;
    font-size: 12px;
    color: var(--app-text-2);
    background: #fff;
    border-radius: 4px;
  }

  &__stalled {
    margin-left: 8px;
    color: var(--app-danger, #d9372b);
  }

  &__link {
    padding: 0;
    color: inherit;
    text-decoration: underline;
    background: none;
    border: 0;
    cursor: pointer;
  }
}

/*
 * 文本层样式：必须跟 pdf.js 官方 pdf_viewer.css 的 .textLayer 语义一致。
 *
 * 上一轮只自己写了 position/color，没带 --text-scale-factor 与 transform: scaleX(--scale-x)，
 * 导致 span 的 font-size 固定 14px、宽度也不做校正，高亮框从行首往右逐渐偏离墨迹（实测 30~68px）。
 * 这里只拿定位必需的部分，不引入整个 pdf_viewer.css（它附带工具条/缩略图样式，会与 Element Plus 打架）。
 */
.fp__text {
  position: absolute;
  top: 0;
  left: 0;
  overflow: clip;
  line-height: 1;
  letter-spacing: normal;
  word-spacing: normal;
  text-size-adjust: none;
  transform-origin: 0 0;
  user-select: text;

  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));

  :deep(span),
  :deep(br) {
    color: transparent;
    position: absolute;
    white-space: pre;
    cursor: text;
    transform-origin: 0% 0%;
    user-select: text;
  }

  /* pdf.js 把 --font-height / --scale-x 写在 span 的行内样式上，尺寸与校正靠这两条规则生效 */
  :deep(span) {
    z-index: 1;
    --font-height: 0;
    font-size: calc(var(--text-scale-factor) * var(--font-height));

    --scale-x: 1;
    --rotate: 0deg;
    transform: rotate(var(--rotate)) scaleX(var(--scale-x))
      scale(var(--min-font-size-inv));
  }

  /*
   * 字体族必须贴住 Helvetica/Arial 度量。
   *
   * pdf.js 对标准字体只给一个整行 item 与统一 scaleX，span 里实际由浏览器按 font-family 排字；
   * 默认 sans-serif（本机常解析为较窄的西文无衬线）与 PDF 的 Helvetica 度量逐字不同，
   * 行首行尾能对齐、行中会累积到 6~11px 偏差。--scale-x 只能整体拉伸，救不了逐字误差。
   * pdf.js 写的是行内样式，这里必须用 !important 才能覆盖。
   */
  :deep(span) {
    /* stylelint-disable-next-line font-family-no-missing-generic-family-keyword */
    font-family: Helvetica, Arial, sans-serif !important;
  }

  :deep(.fp__hit) {
    color: transparent;
    background: rgb(255 214 89 / 45%);
    border-radius: 2px;
  }

  :deep(.fp__hit--active) {
    color: transparent;
    background: rgb(255 145 40 / 65%);
  }
}
</style>
