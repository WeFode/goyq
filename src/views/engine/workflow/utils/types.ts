/** 流程节点类型 */
export enum NodeType {
  /** 发起节点 */
  START = "start",
  /** 审批节点 */
  APPROVE = "approve",
  /** 抄送节点 */
  CC = "cc",
  /** 条件节点 */
  CONDITION = "condition",
  /** 结束节点 */
  END = "end"
}

/** 审批方式 */
export enum ApproveType {
  /** 任意一人审批 */
  ANY_SIGN = "ANY_SIGN",
  /** 所有人会签 */
  ALL_SIGN = "ALL_SIGN",
  /** 按顺序审批 */
  ORDER_SIGN = "ORDER_SIGN"
}

/** 审批人 / 抄送人分配类型 */
export enum AssignmentType {
  /** 静态：存的是具体对象 */
  SPECIFIC_USER = "specificUser",
  ROLE_GROUP = "roleGroup",
  DEPT_GROUP = "deptGroup",
  /** 动态：存的是规则，运行时才解析出人 */
  INITIATOR_LEADER = "initiatorLeader",
  DEPT_LEADER = "deptLeader",
  MULTI_LEVEL_LEADER = "multiLevelLeader",
  FORM_USER = "formUser",
  SPECIFIED_DEPT_LEADER = "specifiedDeptLeader"
}

/** 节点超时动作 */
export type TimeoutAction = "remind" | "autoApprove" | "autoReject" | "transfer";

/** 空审批人策略 */
export type EmptyApproverPolicy =
  | "error"
  | "autoPass"
  | "transferAdmin"
  | "transferTo";

/** 审批人去重策略 */
export type DedupPolicy = "none" | "autoPass" | "skipTask" | "transferInit";

/** 单个表单字段在本节点上的权限 */
export interface FieldPermission {
  field: string;
  visible: boolean;
  editable: boolean;
  required: boolean;
}

/**
 * 节点治理配置
 *
 * 全部可选：不配就是原有行为。超时与去重默认关闭，
 * 因为自动通过/自动跳过都会改变审批结果，不能让没配置的存量流程意外命中。
 */
export interface NodeGovernance {
  timeout?: {
    enabled: boolean;
    hours: number;
    action?: TimeoutAction;
    remindLimit?: number;
    transferTo?: AssignmentValue[];
  } | null;
  emptyApprovers?: {
    policy: EmptyApproverPolicy;
    fallback?: AssignmentValue[];
  } | null;
  dedup?: {
    policy: DedupPolicy;
    includeInitiator?: boolean;
  } | null;
  fieldPermissions?: FieldPermission[];
  /** 未显式配置的字段是否可见（默认 true） */
  defaultFieldVisible?: boolean;
  /** 未显式配置的字段是否可改（默认 false：审批人不默认获得改单权） */
  defaultFieldEditable?: boolean;
}

export interface AssignmentValue {
  id: string | number;
  name: string;
  [key: string]: any;
}

export interface AssignmentConfig {
  type: AssignmentType;
  value: AssignmentValue[];
  /** multiLevelLeader：连续几级上级 */
  level?: number;
  /** formUser：对应的人员字段名 */
  fieldName?: string;
}

export interface ApproversConfig {
  approveType: ApproveType;
  assignment: AssignmentConfig;
  /** 会签驳回策略，仅 ALL_SIGN 可配 continue */
  rejectPolicy?: string;
}

export interface CcUsersConfig {
  type: AssignmentType;
  value: AssignmentValue[];
}

export interface ProcessNode {
  id: string;
  type: NodeType;
  name: string;
  x?: number;
  y?: number;
  approvers?: ApproversConfig;
  ccUsers?: CcUsersConfig;
  /** 发起节点：是否允许修改审批人 */
  allowModifyApprovers?: boolean;
  /** 发起节点：是否允许修改抄送人 */
  allowModifyCcUsers?: boolean;
  /** 条件节点表达式 */
  condition?: any;
  /** 节点治理：超时 / 空审批人 / 去重 / 字段权限 */
  governance?: NodeGovernance;
}

export interface ProcessConfig {
  nodes: ProcessNode[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    condition?: any;
    isDefault?: boolean;
  }>;
}
