/**
 * 流程条件分支的共用模型
 *
 * 为什么单独成一个 util：条件的「可用操作符」必须与后端 evaluateRule 的实现严格对齐，
 * 否则设计器会让人配出一个永远评估失败的条件（例如给附件字段配「大于」）。
 * 放在组件里会散落多处，改后端操作符时必然漏改。
 *
 * 后端实现见 internal/logic/workflow_engine/condition_evaluator.go：
 * 大小比较先试数值、再试日期；contains/starts_with 走字符串化；in 要求值是数组。
 */

export interface ConditionRule {
  field: string;
  operator: string;
  value: any;
}

export interface ConditionConfig {
  logic: "AND" | "OR";
  conditions: ConditionRule[];
}

/** 操作符中文，摘要与下拉共用一份 */
export const OPERATOR_LABELS: Record<string, string> = {
  "==": "等于",
  "!=": "不等于",
  ">": "大于",
  ">=": "大于等于",
  "<": "小于",
  "<=": "小于等于",
  contains: "包含",
  not_contains: "不包含",
  starts_with: "开头是",
  ends_with: "结尾是",
  in: "属于",
  not_in: "不属于",
  is_empty: "为空",
  is_not_empty: "不为空"
};

/** 这两个操作符不需要填值 */
export const VALUELESS_OPERATORS = ["is_empty", "is_not_empty"];
/** 这两个操作符要求值是数组 */
export const MULTI_VALUE_OPERATORS = ["in", "not_in"];

/** 字段归类：决定可用操作符与值输入控件 */
export type FieldKind =
  | "number"
  | "date"
  | "option"
  | "boolean"
  | "text"
  | "array"
  | "opaque";

const KIND_OPERATORS: Record<FieldKind, string[]> = {
  number: ["==", "!=", ">", ">=", "<", "<=", "is_empty", "is_not_empty"],
  date: ["==", "!=", ">", ">=", "<", "<=", "is_empty", "is_not_empty"],
  option: ["==", "!=", "in", "not_in", "is_empty", "is_not_empty"],
  boolean: ["==", "!=", "is_empty", "is_not_empty"],
  text: [
    "==",
    "!=",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "in",
    "not_in",
    "is_empty",
    "is_not_empty"
  ],
  // 多选/子表格/附件的值是数组或对象，后端只有「空/非空」判断得准，
  // 与其暴露一个会静默失效的操作符，不如不给配。
  array: ["is_empty", "is_not_empty"],
  opaque: ["is_empty", "is_not_empty"]
};

/** props 在后端可能是 JSON 字符串（历史数据），统一解析后再用 */
export function fieldPropsOf(field: any): Record<string, any> {
  const raw = field?.props;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) ?? {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

export function fieldKindOf(field: any): FieldKind {
  const type = String(field?.type ?? "");
  if (type === "el-input-number") return "number";
  if (type === "el-date-picker") return "date";
  if (type === "el-select" || type === "el-radio-group") return "option";
  if (type === "el-switch") return "boolean";
  if (type === "el-checkbox-group") return "array";
  if (
    ["el-upload", "el-image-upload", "el-file-upload", "el-table"].includes(type)
  )
    return "opaque";
  return "text";
}

export function operatorsForField(field: any): string[] {
  return KIND_OPERATORS[fieldKindOf(field)] ?? KIND_OPERATORS.text;
}

/** 选项字段的候选值，用于把「值」输入框换成下拉（避免手打错字导致条件永不命中） */
export function optionsOf(field: any): Array<{ label: string; value: any }> {
  const raw = fieldPropsOf(field).options;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(item => item && (item.value !== undefined || item.label))
    .map(item => ({
      label: String(item.label ?? item.value),
      value: item.value ?? item.label
    }));
}

/** 从表单设计配置里取出字段列表 */
export function parseFormFields(formConfig: any): any[] {
  if (Array.isArray(formConfig)) return formConfig;
  if (typeof formConfig !== "string" || !formConfig.trim()) return [];
  try {
    const parsed = JSON.parse(formConfig);
    return Array.isArray(parsed?.fields) ? parsed.fields : [];
  } catch {
    return [];
  }
}

export function emptyRule(): ConditionRule {
  return { field: "", operator: "==", value: "" };
}

export function emptyCondition(): ConditionConfig {
  return { logic: "AND", conditions: [emptyRule()] };
}

/** 值是否需要留空（为空/不为空） */
export function valuelessOf(operator: string): boolean {
  return VALUELESS_OPERATORS.includes(operator);
}

/**
 * 条件是否可用：字段和操作符都选了、需要值的地方也填了。
 * 半填的条件比没条件更糟——它会永远不命中，却让人以为配好了。
 */
export function isConditionUsable(condition?: ConditionConfig | null): boolean {
  if (!condition?.conditions?.length) return false;
  return condition.conditions.every(
    rule =>
      !!String(rule.field ?? "").trim() &&
      !!String(rule.operator ?? "").trim() &&
      (valuelessOf(rule.operator) ||
        (Array.isArray(rule.value)
          ? rule.value.length > 0
          : String(rule.value ?? "").trim() !== ""))
  );
}

function labelOfField(fields: any[], name: string): string {
  const field = fields.find(item => item?.name === name);
  return field?.label ?? field?.name ?? name ?? "";
}

function valueLabel(fields: any[], fieldName: string, value: any): string {
  const field = fields.find(item => item?.name === fieldName);
  const matched = optionsOf(field).find(option => option.value === value);
  return String(matched?.label ?? value ?? "");
}

/**
 * 把条件翻译成一句人话，用于连线标签与只读展示。
 * 例：「金额 大于 10000 且 报销类型 等于 差旅」
 */
export function conditionSummary(
  condition: ConditionConfig | null | undefined,
  fields: any[]
): string {
  if (!condition?.conditions?.length) return "";
  const joiner = condition.logic === "OR" ? " 或 " : " 且 ";
  return condition.conditions
    .map(rule => {
      const fieldLabel = labelOfField(fields, rule.field);
      const operatorLabel = OPERATOR_LABELS[rule.operator] ?? rule.operator;
      if (valuelessOf(rule.operator)) return `${fieldLabel} ${operatorLabel}`;
      const rendered = MULTI_VALUE_OPERATORS.includes(rule.operator)
        ? `[${(Array.isArray(rule.value) ? rule.value : [rule.value])
            .map(item => valueLabel(fields, rule.field, item))
            .join("、")}]`
        : valueLabel(fields, rule.field, rule.value);
      return `${fieldLabel} ${operatorLabel} ${rendered}`;
    })
    .join(joiner);
}

/** 条件节点是否至少有一条能兜底的分支（与后端 validateConditionBranches 同规则） */
export function hasFallbackBranch(edges: any[]): boolean {
  return edges.some(
    edge =>
      edge?.data?.isDefault ||
      !edge?.data?.condition?.conditions?.length
  );
}
