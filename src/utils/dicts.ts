/**
 * 统一字典表：后端返回的英文枚举/状态码必须在这里映射为中文。
 * 约定：任何页面禁止把 status、action、type 等原始码直接渲染给用户，
 *      遇到未收录的值统一回退为「未知状态」而不是英文原文。
 */

export type DictTone = "primary" | "success" | "warning" | "info" | "danger";

export interface DictMeta {
  text: string;
  type?: DictTone;
  dot?: boolean;
  icon?: string;
}

/** 流程实例状态 */
export const WORKFLOW_STATUS: Record<string, DictMeta> = {
  draft: { text: "草稿", type: "info", icon: "ep:document" },
  running: { text: "审批中", type: "primary", icon: "ep:timer" },
  in_progress: { text: "审批中", type: "primary", icon: "ep:timer" },
  processing: { text: "审批中", type: "primary", icon: "ep:timer" },
  pending: { text: "待审批", type: "warning", icon: "ep:timer" },
  approved: { text: "已通过", type: "success", icon: "ep:circle-check" },
  completed: { text: "已完成", type: "success", icon: "ep:circle-check" },
  rejected: { text: "已驳回", type: "danger", icon: "ep:circle-close" },
  returned: { text: "已退回", type: "warning", icon: "ep:back" },
  cancelled: { text: "已撤销", type: "info", icon: "ep:circle-close" },
  canceled: { text: "已撤销", type: "info", icon: "ep:circle-close" }
};

/** 审批任务/审批人状态 */
export const TASK_STATUS: Record<string, DictMeta> = {
  pending: { text: "待处理", type: "warning" },
  running: { text: "处理中", type: "primary" },
  approved: { text: "已同意", type: "success" },
  rejected: { text: "已驳回", type: "danger" },
  cancelled: { text: "已取消", type: "info" },
  canceled: { text: "已取消", type: "info" },
  transferred: { text: "已转交", type: "info" },
  returned: { text: "已退回", type: "warning" },
  skipped: { text: "已跳过", type: "info" },
  completed: { text: "已完成", type: "success" }
};

/** 流程节点状态 */
export const NODE_STATUS: Record<string, DictMeta> = {
  completed: { text: "已完成", type: "success" },
  approved: { text: "已完成", type: "success" },
  running: { text: "审批中", type: "primary" },
  in_progress: { text: "审批中", type: "primary" },
  processing: { text: "审批中", type: "primary" },
  pending: { text: "待审批", type: "warning" },
  rejected: { text: "已驳回", type: "danger" },
  cancelled: { text: "已取消", type: "info" },
  canceled: { text: "已取消", type: "info" },
  skipped: { text: "已跳过", type: "info" }
};

/** 审批动作 */
export const APPROVAL_ACTION: Record<string, string> = {
  approve: "同意",
  reject: "驳回",
  return: "退回",
  cancel: "撤销",
  transfer: "转交",
  delegate: "转派",
  add: "加签",
  addsign: "加签",
  cc: "抄送",
  submit: "提交",
  reinitiate: "重新发起",
  complete: "结束",
  start: "发起"
};

/** 审批方式 */
export const APPROVE_TYPE: Record<string, string> = {
  ANY_SIGN: "或签",
  ALL_SIGN: "会签",
  ORDER_SIGN: "顺序审批",
  any: "或签",
  all: "会签",
  sequence: "顺序审批"
};

/** 节点类型 */
export const NODE_TYPE: Record<string, string> = {
  start: "开始",
  end: "结束",
  approve: "审批",
  approval: "审批",
  cc: "抄送",
  condition: "条件分支"
};

/** 性别 */
export const GENDER: Record<string, string> = { "1": "男", "2": "女", "3": "未知" };

/** 在职状态 */
export const EMPLOYMENT_STATUS: Record<string, DictMeta> = {
  "1": { text: "在职", type: "success" },
  "2": { text: "离职", type: "info" },
  "3": { text: "休假", type: "warning" }
};

/** 启用/停用 */
export const ENABLE_STATUS: Record<string, DictMeta> = {
  "1": { text: "启用", type: "success" },
  "0": { text: "停用", type: "info" },
  true: { text: "启用", type: "success" },
  false: { text: "停用", type: "info" }
};

/** 通知类型 */
export const NOTIFICATION_TYPE: Record<string, string> = {
  workflow: "审批提醒",
  system: "系统通知",
  announcement: "公告通知"
};

/** 日志结果 */
export const LOG_STATUS: Record<string, DictMeta> = {
  "1": { text: "成功", type: "success", dot: true },
  "0": { text: "失败", type: "danger", dot: true }
};

/** 菜单类型 */
export const MENU_TYPE: Record<string, string> = {
  "1": "目录",
  "2": "菜单",
  "3": "按钮"
};

/** 知识库归属范围 */
export const KB_SCOPE: Record<string, DictMeta> = {
  company: { text: "企业文档", type: "primary", dot: true },
  personal: { text: "个人文件", type: "info", dot: true }
};

/** 知识库文档状态 */
export const KB_DOC_STATUS: Record<string, DictMeta> = {
  "1": { text: "正常", type: "success", dot: true },
  "2": { text: "已归档", type: "info", dot: true }
};

export const UNKNOWN_TEXT = "未知状态";

/** 取字典元信息，未命中时返回兜底元信息（不展示英文原文） */
export function dictMeta(
  map: Record<string, DictMeta>,
  value: unknown,
  fallback: DictMeta = { text: UNKNOWN_TEXT, type: "info" }
): DictMeta {
  if (value === null || value === undefined || value === "") return fallback;
  return map[String(value)] ?? fallback;
}

/** 取字典中文文案，未命中时返回兜底文案（不展示英文原文） */
export function dictText(
  map: Record<string, string | DictMeta>,
  value: unknown,
  fallback = UNKNOWN_TEXT
): string {
  if (value === null || value === undefined || value === "") return "-";
  const hit = map[String(value)];
  if (!hit) return fallback;
  return typeof hit === "string" ? hit : hit.text;
}
