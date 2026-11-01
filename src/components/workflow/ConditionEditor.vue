<script setup lang="ts">
import { computed } from "vue";
import {
  MULTI_VALUE_OPERATORS,
  OPERATOR_LABELS,
  emptyRule,
  fieldKindOf,
  operatorsForField,
  optionsOf,
  valuelessOf,
  type ConditionConfig,
  type ConditionRule
} from "@/utils/condition";

/**
 * 结构化条件编辑器
 *
 * 只在「值怎么填」上做了收敛，不做花活：
 * 选项字段给下拉而不是手打文本（手打错一个字，条件就永远不命中且没有任何提示），
 * 数字给数字框、日期给日期框，「为空/不为空」直接不显示值输入。
 */

interface Props {
  modelValue?: ConditionConfig | null;
  /** 可选字段：来自关联表单设计的 fields */
  fields?: any[];
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  fields: () => []
});

const emit = defineEmits<{
  (e: "update:modelValue", value: ConditionConfig): void;
}>();

const logic = computed(() => props.modelValue?.logic ?? "AND");
const rules = computed<ConditionRule[]>(() =>
  props.modelValue?.conditions?.length ? props.modelValue.conditions : [emptyRule()]
);

/** 可参与判断的字段：附件与子表格只支持空/非空，仍然列出但不给复杂操作符 */
const fieldOptions = computed(() =>
  (props.fields ?? [])
    .filter(field => field?.name)
    .map(field => ({ label: field.label || field.name, value: field.name }))
);

function emitRules(nextLogic: string, nextRules: ConditionRule[]) {
  emit("update:modelValue", {
    logic: nextLogic === "OR" ? "OR" : "AND",
    conditions: nextRules
  });
}

function setLogic(next: string | number | boolean | undefined) {
  emitRules(String(next), rules.value);
}

function patchRule(index: number, patch: Partial<ConditionRule>) {
  const next = rules.value.map((rule, current) =>
    current === index ? { ...rule, ...patch } : rule
  );
  emitRules(logic.value, next);
}

/**
 * 换字段时把操作符与值一起收敛：
 * 从「金额 大于 10000」改选成「是否加急」，如果继续留着 `>` 就是必然失效的条件。
 */
function onFieldChange(index: number, fieldName: string) {
  const field = (props.fields ?? []).find(item => item?.name === fieldName);
  const allowed = operatorsForField(field);
  const current = rules.value[index];
  const operator = allowed.includes(current.operator) ? current.operator : allowed[0];
  patchRule(index, { field: fieldName, operator, value: multiValueOf(operator) ? [] : "" });
}

function onOperatorChange(index: number, operator: string) {
  const current = rules.value[index];
  patchRule(index, {
    operator,
    value: multiValueOf(operator)
      ? Array.isArray(current.value)
        ? current.value
        : []
      : valuelessOf(operator) || multiValueOf(operator)
        ? ""
        : current.value
  });
}

function multiValueOf(operator: string) {
  return MULTI_VALUE_OPERATORS.includes(operator);
}

function addRule() {
  emitRules(logic.value, [...rules.value, emptyRule()]);
}

function removeRule(index: number) {
  const next = rules.value.filter((_, current) => current !== index);
  emitRules(logic.value, next.length ? next : [emptyRule()]);
}

/** 值输入控件类型 */
function valueKind(rule: ConditionRule): "none" | "options" | "number" | "date" | "tags" | "text" {
  if (valuelessOf(rule.operator)) return "none";
  const field = (props.fields ?? []).find(item => item?.name === rule.field);
  const kind = fieldKindOf(field);
  const options = optionsOf(field);

  if (multiValueOf(rule.operator)) return options.length ? "options" : "tags";
  if (kind === "number") return "number";
  if (kind === "date") return "date";
  if (options.length) return "options";
  if (kind === "boolean") return "options";
  return "text";
}

/** 布尔字段没有 options 配置，这里补两个固定选项 */
const booleanOptions = [
  { label: "是", value: true },
  { label: "否", value: false }
];

function selectOptions(rule: ConditionRule) {
  const field = (props.fields ?? []).find(item => item?.name === rule.field);
  const options = optionsOf(field);
  if (options.length) return options;
  if (fieldKindOf(field) === "boolean") return booleanOptions;
  return [];
}

const operatorsOf = (rule: ConditionRule) => {
  const field = (props.fields ?? []).find(item => item?.name === rule.field);
  return (field ? operatorsForField(field) : operatorsForField({ type: "el-input" })).map(
    operator => ({ label: OPERATOR_LABELS[operator] ?? operator, value: operator })
  );
};
</script>

<template>
  <div class="condition-editor">
    <el-radio-group :model-value="logic" size="small" @change="setLogic">
      <el-radio-button value="AND">满足以下全部</el-radio-button>
      <el-radio-button value="OR">满足以下任一</el-radio-button>
    </el-radio-group>

    <div v-for="(rule, index) in rules" :key="index" class="condition-editor__rule">
      <div class="condition-editor__row">
        <el-select
          :model-value="rule.field"
          placeholder="选择字段"
          filterable
          class="condition-editor__field"
          @update:model-value="value => onFieldChange(index, value)"
        >
          <el-option
            v-for="option in fieldOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <el-select
          v-if="rule.field"
          :model-value="rule.operator"
          class="condition-editor__operator"
          @update:model-value="value => onOperatorChange(index, value)"
        >
          <el-option
            v-for="option in operatorsOf(rule)"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <el-button
          link
          type="danger"
          :disabled="rules.length <= 1"
          @click="removeRule(index)"
        >
          删除
        </el-button>
      </div>

      <div v-if="valueKind(rule) !== 'none'" class="condition-editor__row">
        <el-select
          v-if="valueKind(rule) === 'options'"
          :model-value="rule.value"
          :multiple="multiValueOf(rule.operator)"
          filterable
          placeholder="选择值"
          class="condition-editor__value"
          @update:model-value="value => patchRule(index, { value })"
        >
          <el-option
            v-for="option in selectOptions(rule)"
            :key="String(option.value)"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <el-input-number
          v-else-if="valueKind(rule) === 'number'"
          :model-value="rule.value"
          :controls="false"
          placeholder="数值"
          class="condition-editor__value"
          @update:model-value="value => patchRule(index, { value })"
        />

        <el-date-picker
          v-else-if="valueKind(rule) === 'date'"
          :model-value="rule.value"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          class="condition-editor__value"
          @update:model-value="value => patchRule(index, { value })"
        />

        <el-select
          v-else-if="valueKind(rule) === 'tags'"
          :model-value="Array.isArray(rule.value) ? rule.value : []"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="输入后可回车加多个值"
          class="condition-editor__value"
          @update:model-value="value => patchRule(index, { value })"
        />

        <el-input
          v-else
          :model-value="rule.value"
          placeholder="比较值"
          class="condition-editor__value"
          @update:model-value="value => patchRule(index, { value })"
        />
      </div>
    </div>

    <el-button link type="primary" @click="addRule">
      <AppIcon icon="ep:plus" :size="13" />
      添加条件
    </el-button>

    <p v-if="!fields.length" class="condition-editor__tip">
      请先在「基础信息」里选择关联表单，条件只能引用该表单的字段。
    </p>
  </div>
</template>

<style scoped lang="scss">
.condition-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__rule {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: var(--app-fill-light, #f7f8fa);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
  }

  &__row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__field {
    flex: 1;
    min-width: 0;
  }

  &__operator {
    flex: 0 0 116px;
  }

  &__value {
    flex: 1;
    width: 100%;
  }

  &__tip {
    margin: 0;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }
}

:deep(.el-input-number .el-input__inner) {
  text-align: left;
}
</style>
