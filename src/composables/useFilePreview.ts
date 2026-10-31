import { reactive } from "vue";
import { getAttachmentUrl } from "@/utils/workflow";

/**
 * 全局附件预览宿主状态
 *
 * 为什么是全局单例而不是每个页面各挂一个弹窗：
 * 附件出现在表单字段、审批时间轴、审批意见、知识库、公告等很多地方，
 * 逐页挂 <FilePreview> 会带来多份弹窗实例、各自维护状态、行为漂移
 * （上一轮就只接到了知识库，审批附件仍然跳新页面/跳外网 Office）。
 * 现在宿主只挂在布局根组件，任何地方调 previewAttachment 即可。
 */
const state = reactive({
  visible: false,
  fileId: "",
  name: ""
});

export function useFilePreviewState() {
  return state;
}

/** 附件标识：后端返回的附件对象在不同模块里叫 id 或 fileId */
export function getAttachmentFileId(file: any): string {
  return String(file?.id ?? file?.fileId ?? "").trim();
}

/**
 * 统一预览入口。
 *
 * 有 fileId 就交给离线预览器——能不能预览、用什么方式预览由后端判定；
 * 没有 fileId 的历史数据（例如只存了绝对地址的旧附件）退回直接打开地址，
 * 但绝不拼接外部在线预览服务：政务/内网环境没有外网出口，那种链接注定是死链。
 *
 * @returns 是否成功触发预览
 */
export function previewAttachment(file: any): boolean {
  const fileId = getAttachmentFileId(file);
  if (fileId) {
    state.fileId = fileId;
    state.name = file?.name || file?.fileName || "附件预览";
    state.visible = true;
    return true;
  }
  const url = getAttachmentUrl(file);
  if (url) {
    window.open(url, "_blank");
    return true;
  }
  return false;
}
