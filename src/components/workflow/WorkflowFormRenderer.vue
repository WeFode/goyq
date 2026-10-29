<script setup lang="ts">
import { computed, ref } from "vue";
import { numberToUppercase } from "@/utils/numberToUppercase";
import AttachmentUpload from "./AttachmentUpload.vue";

/**
 * 流程表单填写渲染器
 * 依据表单设计器的 fields 配置渲染可编辑控件，v-model 绑定到 formData
 */
interface Props {
  fields: any[] | string;
  modelValue: Record<string, any>;
  labelWidth?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  labelWidth: "120px",
  disabled: false
});

const emit = defineEmits<{
  (e: "update:modelValue", value: Record<string, any>): void;
}>();

const model = computed({
  get: () => props.modelValue ?? {},
  set: value => emit("update:modelValue", value)
});

const parsedFields = computed<any[]>(() => {
  const raw = props.fields;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed?.fields ?? parsed ?? [];
    } catch {
      return [];
    }
  }
  return [];
});

const fieldProps = (field: any): Record<string, any> => {
  const raw = field?.props;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) ?? {};
    } catch {
      return {};
    }
  }
  return raw ?? {};
};

const optionsOf = (field: any) => fieldProps(field).options ?? [];

const isTextarea = (field: any) => {
  const value = fieldProps(field).type;
  return value === "textarea" || String(field?.props ?? "").includes("textarea");
};

const uploadValue = (field: any) => model.value[field.name] ?? [];

const setUploadValue = (field: any, files: any[]) => {
  model.value[field.name] = files;
};

/** 子表格字段：可增删行 */
const tableRows = (field: any): any[] => {
  const value = model.value[field.name];
  return Array.isArray(value) ? value : [];
};

const addTableRow = (field: any) => {
  const columns = fieldProps(field).columns ?? [];
  const row: Record<string, any> = {};
  columns.forEach((column: any) => (row[column.prop] = ""));
  model.value[field.name] = [...tableRows(field), row];
};

const removeTableRow = (field: any, index: number) => {
  const rows = [...tableRows(field)];
  rows.splice(index, 1);
  model.value[field.name] = rows;
};

const showUppercase = (field: any) =>
  Boolean(fieldProps(field).showUppercase) && model.value[field.name];

/* ============ 校验 ============ */
const formRef = ref();

const CHANGE_TRIGGER_TYPES = [
  "el-select",
  "el-radio-group",
  "el-checkbox-group",
  "el-date-picker",
  "el-switch",
  "el-upload",
  "el-image-upload",
  "el-file-upload",
  "el-table"
];

/** 将字段的 required 转换为表单校验规则，必填项未填时阻断提交 */
const rules = computed<Record<string, any[]>>(() => {
  const result: Record<string, any[]> = {};

  parsedFields.value.forEach(field => {
    if (!field?.required) return;
    const label = field.label ?? "该字段";
    const isCollection = [
      "el-checkbox-group",
      "el-upload",
      "el-image-upload",
      "el-file-upload",
      "el-table"
    ].includes(field.type);

    result[field.name] = [
      {
        required: true,
        validator: (_rule: any, value: any, callback: (error?: Error) => void) => {
          const empty =
            value === undefined ||
            value === null ||
            value === "" ||
            (isCollection && Array.isArray(value) && value.length === 0);
          empty ? callback(new Error(`请填写${label}`)) : callback();
        },
        trigger: CHANGE_TRIGGER_TYPES.includes(field.type) ? "change" : "blur"
      }
    ];
  });

  return result;
});

/** 供父组件（发起/重新发起）在提交前调用 */
async function validate(): Promise<boolean> {
  if (!formRef.value) return true;
  try {
    await formRef.value.validate();
    return true;
  } catch {
    return false;
  }
}

defineExpose({ validate });
</script>

<template>
  <el-form
    ref="formRef"
    :model="model"
    :rules="rules"
    :label-width="labelWidth"
    :disabled="disabled"
  >
    <el-form-item
      v-for="field in parsedFields"
      :key="field.name"
      :prop="field.name"
      :label="field.label"
      :required="field.required"
    >
      <!-- 多行文本 -->
      <el-input
        v-if="field.type === 'el-input' && isTextarea(field)"
        v-model="model[field.name]"
        type="textarea"
        :rows="3"
        :placeholder="fieldProps(field).placeholder || `请输入${field.label}`"
        :maxlength="fieldProps(field).maxlength"
      />

      <!-- 单行文本 -->
      <el-input
        v-else-if="field.type === 'el-input'"
        v-model="model[field.name]"
        :placeholder="fieldProps(field).placeholder || `请输入${field.label}`"
        :maxlength="fieldProps(field).maxlength"
        clearable
      />

      <!-- 数字 -->
      <div v-else-if="field.type === 'el-input-number'" class="app-renderer__number">
        <el-input-number
          v-model="model[field.name]"
          :min="fieldProps(field).min"
          :max="fieldProps(field).max"
          :precision="fieldProps(field).precision"
          :step="fieldProps(field).step || 1"
          controls-position="right"
          class="w-full"
        />
        <span v-if="showUppercase(field)" class="app-renderer__uppercase">
          大写：{{ numberToUppercase(Number(model[field.name])) }}
        </span>
      </div>

      <!-- 下拉 -->
      <el-select
        v-else-if="field.type === 'el-select'"
        v-model="model[field.name]"
        :placeholder="fieldProps(field).placeholder || `请选择${field.label}`"
        clearable
        class="w-full"
      >
        <el-option
          v-for="option in optionsOf(field)"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>

      <!-- 单选 -->
      <el-radio-group
        v-else-if="field.type === 'el-radio-group'"
        v-model="model[field.name]"
      >
        <el-radio
          v-for="option in optionsOf(field)"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </el-radio>
      </el-radio-group>

      <!-- 多选 -->
      <el-checkbox-group
        v-else-if="field.type === 'el-checkbox-group'"
        v-model="model[field.name]"
      >
        <el-checkbox
          v-for="option in optionsOf(field)"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </el-checkbox>
      </el-checkbox-group>

      <!-- 日期 -->
      <el-date-picker
        v-else-if="field.type === 'el-date-picker'"
        v-model="model[field.name]"
        :type="fieldProps(field).type || 'date'"
        :value-format="fieldProps(field).valueFormat || 'YYYY-MM-DD HH:mm:ss'"
        :placeholder="fieldProps(field).placeholder || `请选择${field.label}`"
        class="w-full"
      />

      <!-- 开关 -->
      <el-switch
        v-else-if="field.type === 'el-switch'"
        v-model="model[field.name]"
        :active-value="fieldProps(field).activeValue ?? true"
        :inactive-value="fieldProps(field).inactiveValue ?? false"
      />

      <!-- 附件 / 图片 -->
      <AttachmentUpload
        v-else-if="
          ['el-upload', 'el-image-upload', 'el-file-upload'].includes(field.type)
        "
        :model-value="uploadValue(field)"
        :limit="fieldProps(field).limit || 5"
        @update:model-value="files => setUploadValue(field, files)"
      />

      <!-- 子表格 -->
      <div v-else-if="field.type === 'el-table'" class="app-renderer__table">
        <el-table :data="tableRows(field)" size="small" border>
          <el-table-column
            v-for="column in fieldProps(field).columns ?? []"
            :key="column.prop"
            :label="column.label"
            :width="column.width"
          >
            <template #default="{ row }">
              <el-input v-model="row[column.prop]" size="small" />
            </template>
          </el-table-column>
          <el-table-column width="72" align="center">
            <template #default="{ $index }">
              <el-button
                link
                type="danger"
                @click="removeTableRow(field, $index)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button class="mt-2" link type="primary" @click="addTableRow(field)">
          <AppIcon icon="ep:plus" :size="12" />
          添加一行
        </el-button>
      </div>

      <!-- 兜底 -->
      <el-input
        v-else
        v-model="model[field.name]"
        :placeholder="`请输入${field.label}`"
      />
    </el-form-item>
  </el-form>
</template>

<style scoped lang="scss">
.app-renderer {
  &__number {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  &__uppercase {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__table {
    width: 100%;
  }
}
</style>
