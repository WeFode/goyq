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
  /** 指定用户 */
  SPECIFIC_USER = "specificUser",
  /** 角色组 */
  ROLE_GROUP = "roleGroup",
  /** 部门组 */
  DEPT_GROUP = "deptGroup"
}

export interface AssignmentValue {
  id: string | number;
  name: string;
  [key: string]: any;
}

export interface AssignmentConfig {
  type: AssignmentType;
  value: AssignmentValue[];
}

export interface ApproversConfig {
  approveType: ApproveType;
  assignment: AssignmentConfig;
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
}

export interface ProcessConfig {
  nodes: ProcessNode[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    condition?: any;
  }>;
}
