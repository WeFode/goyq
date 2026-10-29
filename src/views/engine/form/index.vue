<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { addForm, deleteForm, getFormById, getFormList, updateForm } from "@/api/form";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import WorkflowFormRenderer from "@/components/workflow/WorkflowFormRenderer.vue";
import { useTable } from "@/composables/useTable";

defineOptions({ name: "EngineForm" });

/* ============ 列表 ============ */
const query = reactive<{ name: string }>({ name: "" });

const { loading, list, pagination, search, refresh, reset } = useTable({
  fetcher: params => getFormList(params),
  query
});

/* ============ 新增 / 重命名 ============ */
const metaVisible = ref(false);
const metaSubmitting = ref(false);
const metaEditId = ref<string | null>(null);
const metaRef = ref<FormInstance>();
const meta = reactive({ name: "", description: "" });

const metaRules: FormRules = {
  name: [{ required: true, message: "请填写表单名称", trigger: "blur" }]
};

function openCreate() {
  metaEditId.value = null;
  meta.name = "";
  meta.description = "";
  metaVisible.value = true;
}

function submitMeta() {
  const formEl = metaRef.value;
  if (!formEl) return;

  formEl.validate(async valid => {
    if (!valid) return;
    metaSubmitting.value = true;
    try {
      const payload: any = { name: meta.name, description: meta.description };
      if (metaEditId.value) {
        await updateForm({ ...payload, id: metaEditId.value });
        message("保存成功", { type: "success" });
        metaVisible.value = false;
        refresh();
      } else {
        // 新增后直接进入设计器
        await addForm({ ...payload, formConfig: JSON.stringify({ fields: [] }) });
        message("新增成功，请设计表单字段", { type: "success" });
        metaVisible.value = false;
        await refresh();
        const created = list.value?.[0];
        if (created?.id) openDesigner(created);
      }
    } catch (error) {
      console.error("保存表单失败:", error);
    } finally {
      metaSubmitting.value = false;
    }
  });
}

async function handleDelete(row: any) {
  try {
    await deleteForm(row.id);
    message("删除成功", { type: "success" });
    refresh();
  } catch (error) {
    console.error("删除表单失败:", error);
  }
}

/* ============ 设计器 ============ */
type FieldType =
  | "el-input"
  | "el-input-number"
  | "el-select"
  | "el-radio-group"
  | "el-checkbox-group"
  | "el-date-picker"
  | "el-switch"
  | "el-upload"
  | "el-table";

const PALETTE: Array<{ type: FieldType; label: string; icon: string }> = [
  { type: "el-input", label: "单行文本", icon: "ep:edit" },
  { type: "el-input-number", label: "数字金额", icon: "ep:data-line" },
  { type: "el-select", label: "下拉选择", icon: "ep:arrow-down" },
  { type: "el-radio-group", label: "单选", icon: "ep:select" },
  { type: "el-checkbox-group", label: "多选", icon: "ep:check" },
  { type: "el-date-picker", label: "日期时间", icon: "ep:calendar" },
  { type: "el-switch", label: "开关", icon: "ep:switch-button" },
  { type: "el-upload", label: "附件上传", icon: "ep:upload" },
  { type: "el-table", label: "子表格", icon: "ep:grid" }
];

const designerVisible = ref(false);
const designerSaving = ref(false);
const designerFormId = ref<string>("");
const designerName = ref("");
const fields = ref<any[]>([]);
const activeIndex = ref(-1);
const designerTab = ref<"design" | "preview">("design");
const previewData = ref<Record<string, any>>({});

const activeField = computed(() =>
  activeIndex.value >= 0 ? fields.value[activeIndex.value] : null
);

const DEFAULT_PROPS: Record<string, any> = {
  placeholder: "",
  options: [
    { label: "选项一", value: "option1" },
    { label: "选项二", value: "option2" }
  ],
  type: "date",
  format: "YYYY-MM-DD",
  limit: 5,
  unit: "",
  showUppercase: false,
  columns: [{ prop: "col1", label: "列一", width: 120 }]
};

let fieldSeq = 1;

function addField(type: FieldType) {
  const label =
    PALETTE.find(item => item.type === type)?.label ?? "字段";
  const field = {
    name: `field_${Date.now()}_${fieldSeq++}`,
    label,
    type,
    required: false,
    props: JSON.parse(JSON.stringify(DEFAULT_PROPS))
  };
  fields.value = [...fields.value, field];
  activeIndex.value = fields.value.length - 1;
}

function removeField(index: number) {
  const next = [...fields.value];
  next.splice(index, 1);
  fields.value = next;
  activeIndex.value = Math.min(index, next.length - 1);
}

function moveField(index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= fields.value.length) return;
  const next = [...fields.value];
  [next[index], next[target]] = [next[target], next[index]];
  fields.value = next;
  activeIndex.value = target;
}

function addOption() {
  if (!activeField.value) return;
  activeField.value.props.options = [
    ...(activeField.value.props.options ?? []),
    { label: "新选项", value: `option${Date.now()}` }
  ];
}

function removeOption(index: number) {
  if (!activeField.value) return;
  activeField.value.props.options.splice(index, 1);
}

function addColumn() {
  if (!activeField.value) return;
  activeField.value.props.columns = [
    ...(activeField.value.props.columns ?? []),
    { prop: `col${Date.now()}`, label: "新列", width: 120 }
  ];
}

function removeColumn(index: number) {
  if (!activeField.value) return;
  activeField.value.props.columns.splice(index, 1);
}

async function openDesigner(row: any) {
  designerFormId.value = row.id;
  designerName.value = row.name;
  fields.value = [];
  activeIndex.value = -1;
  designerTab.value = "design";
  previewData.value = {};
  designerVisible.value = true;

  try {
    const res: any = await getFormById(row.id);
    const detail = res?.data?.form ?? res?.data ?? row;
    designerName.value = detail.name ?? row.name;
    // formConfig 可能是 JSON 字符串，也可能已被后端解析为对象
    let config: any = {};
    const rawConfig = detail.formConfig ?? row.formConfig;
    if (typeof rawConfig === "string") {
      try {
        config = JSON.parse(rawConfig);
      } catch {
        config = {};
      }
    } else if (rawConfig && typeof rawConfig === "object") {
      config = rawConfig;
    }
    fields.value = Array.isArray(config?.fields) ? config.fields : [];
  } catch (error) {
    console.error("加载表单详情失败:", error);
  }
}

async function saveDesigner() {
  if (!designerFormId.value) return;
  designerSaving.value = true;
  try {
    await updateForm({
      id: designerFormId.value,
      name: designerName.value,
      formConfig: JSON.stringify({ fields: fields.value })
    });
    message("表单已保存", { type: "success" });
    designerVisible.value = false;
    refresh();
  } catch (error) {
    console.error("保存表单失败:", error);
  } finally {
    designerSaving.value = false;
  }
}

const fieldTypeLabel = (type: string) =>
  PALETTE.find(item => item.type === type)?.label ?? type;

const isOptionType = (type: string) =>
  ["el-select", "el-radio-group", "el-checkbox-group"].includes(type);

onMounted(() => search());
</script>

<template>
  <AppPage title="表单管理" description="维护审批表单字段与展示规则">
    <template #actions>
      <el-button v-if="hasAuth('engine:form:add')" type="primary" @click="openCreate">
        <AppIcon icon="ep:plus" :size="14" />
        新增表单
      </el-button>
    </template>

    <AppSearchBar :loading="loading" @search="search" @reset="reset">
      <el-form-item label="表单名称">
        <el-input v-model="query.name" placeholder="请输入表单名称" clearable />
      </el-form-item>
    </AppSearchBar>

    <AppDataTable
      :data="list"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无表单"
      @page-change="refresh"
    >
      <el-table-column label="表单名称" prop="name" min-width="200">
        <template #default="{ row }">
          <span class="app-text--strong">{{ row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column label="描述" prop="description" min-width="200">
        <template #default="{ row }">
          <span class="app-text--secondary">{{ row.description || "-" }}</span>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" prop="updatedAt" width="180" />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDesigner(row)">
            设计表单
          </el-button>
          <el-popconfirm
            v-if="hasAuth('engine:form:delete')"
            :title="`确认删除表单「${row.name}」？`"
            width="220"
            @confirm="handleDelete(row)"
          >
            <template #reference>
              <el-button link type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </AppDataTable>

    <!-- 表单基础信息 -->
    <AppFormDialog
      v-model="metaVisible"
      title="新增表单"
      :loading="metaSubmitting"
      width="480px"
      @confirm="submitMeta"
    >
      <el-form ref="metaRef" :model="meta" :rules="metaRules" label-width="88px">
        <el-form-item label="表单名称" prop="name">
          <el-input v-model="meta.name" placeholder="请输入表单名称" clearable />
        </el-form-item>
        <el-form-item label="表单描述">
          <el-input
            v-model="meta.description"
            type="textarea"
            :rows="3"
            placeholder="请输入表单用途说明"
          />
        </el-form-item>
      </el-form>
    </AppFormDialog>

    <!-- 表单设计器 -->
    <el-drawer
      v-model="designerVisible"
      size="1080px"
      :show-close="false"
      destroy-on-close
      class="app-form-designer"
    >
      <template #header>
        <div class="designer-header">
          <div class="designer-header__title">
            设计表单 · {{ designerName }}
          </div>
          <div class="designer-header__actions">
            <el-segmented
              v-model="designerTab"
              :options="[
                { label: '设计', value: 'design' },
                { label: '预览', value: 'preview' }
              ]"
            />
            <el-button @click="designerVisible = false">取消</el-button>
            <el-button type="primary" :loading="designerSaving" @click="saveDesigner">
              保存表单
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="designerTab === 'design'" class="form-designer">
        <!-- 字段库 -->
        <aside class="form-designer__palette">
          <div class="form-designer__panel-title">字段类型</div>
          <button
            v-for="item in PALETTE"
            :key="item.type"
            type="button"
            class="form-designer__palette-item"
            @click="addField(item.type)"
          >
            <AppIcon :icon="item.icon" :size="14" />
            {{ item.label }}
          </button>
        </aside>

        <!-- 画布：字段列表 -->
        <section class="form-designer__canvas">
          <div
            v-for="(field, index) in fields"
            :key="field.name"
            class="form-designer__field"
            :class="{ 'is-active': index === activeIndex }"
            @click="activeIndex = index"
          >
            <div class="form-designer__field-main">
              <span class="form-designer__field-label">
                {{ field.label }}
                <i v-if="field.required">*</i>
              </span>
              <span class="form-designer__field-type">
                {{ fieldTypeLabel(field.type) }}
              </span>
            </div>
            <div class="form-designer__field-actions" @click.stop>
              <el-button link @click="moveField(index, -1)">
                <AppIcon icon="ep:arrow-up" :size="13" />
              </el-button>
              <el-button link @click="moveField(index, 1)">
                <AppIcon icon="ep:arrow-down" :size="13" />
              </el-button>
              <el-button link type="danger" @click="removeField(index)">
                删除
              </el-button>
            </div>
          </div>

          <AppEmpty
            v-if="fields.length === 0"
            description="从左侧选择字段类型开始设计"
          />
        </section>

        <!-- 属性面板 -->
        <aside class="form-designer__panel">
          <div class="form-designer__panel-title">字段属性</div>
          <el-form
            v-if="activeField"
            label-position="top"
            size="small"
            class="form-designer__props"
          >
            <el-form-item label="字段标题">
              <el-input v-model="activeField.label" />
            </el-form-item>
            <el-form-item label="字段标识">
              <el-input v-model="activeField.name" />
            </el-form-item>
            <el-form-item label="是否必填">
              <el-switch v-model="activeField.required" />
            </el-form-item>
            <el-form-item
              v-if="!['el-switch', 'el-upload', 'el-table', 'el-date-picker'].includes(activeField.type)"
              label="占位提示"
            >
              <el-input v-model="activeField.props.placeholder" />
            </el-form-item>

            <!-- 数字配置 -->
            <template v-if="activeField.type === 'el-input-number'">
              <el-form-item label="单位">
                <el-input v-model="activeField.props.unit" placeholder="如：元" />
              </el-form-item>
              <el-form-item label="显示大写金额">
                <el-switch v-model="activeField.props.showUppercase" />
              </el-form-item>
            </template>

            <!-- 日期配置 -->
            <template v-if="activeField.type === 'el-date-picker'">
              <el-form-item label="日期类型">
                <el-select v-model="activeField.props.type" class="w-full">
                  <el-option label="日期" value="date" />
                  <el-option label="日期时间" value="datetime" />
                  <el-option label="日期范围" value="daterange" />
                  <el-option label="月份" value="month" />
                </el-select>
              </el-form-item>
            </template>

            <!-- 上传配置 -->
            <template v-if="activeField.type === 'el-upload'">
              <el-form-item label="数量限制">
                <el-input-number v-model="activeField.props.limit" :min="1" :max="10" />
              </el-form-item>
            </template>

            <!-- 选项配置 -->
            <template v-if="isOptionType(activeField.type)">
              <el-form-item label="选项">
                <div class="form-designer__options">
                  <div
                    v-for="(option, index) in activeField.props.options"
                    :key="index"
                    class="form-designer__option"
                  >
                    <el-input v-model="option.label" placeholder="显示文字" />
                    <el-input v-model="option.value" placeholder="值" />
                    <el-button link type="danger" @click="removeOption(index)">
                      移除
                    </el-button>
                  </div>
                  <el-button link type="primary" @click="addOption">
                    新增选项
                  </el-button>
                </div>
              </el-form-item>
            </template>

            <!-- 子表格列 -->
            <template v-if="activeField.type === 'el-table'">
              <el-form-item label="表格列">
                <div class="form-designer__options">
                  <div
                    v-for="(column, index) in activeField.props.columns"
                    :key="index"
                    class="form-designer__option"
                  >
                    <el-input v-model="column.label" placeholder="列名" />
                    <el-input v-model="column.prop" placeholder="字段名" />
                    <el-button link type="danger" @click="removeColumn(index)">
                      移除
                    </el-button>
                  </div>
                  <el-button link type="primary" @click="addColumn">
                    新增列
                  </el-button>
                </div>
              </el-form-item>
            </template>
          </el-form>

          <p v-else class="form-designer__hint">选择中间字段后编辑属性</p>
        </aside>
      </div>

      <!-- 预览 -->
      <div v-else class="form-preview">
        <WorkflowFormRenderer
          :fields="fields"
          :model-value="previewData"
          @update:model-value="value => Object.assign(previewData, value)"
        />
      </div>
    </el-drawer>
  </AppPage>
</template>

<style scoped lang="scss">
.designer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  &__title {
    font-size: var(--app-font-16);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
}

.form-designer {
  display: flex;
  gap: 16px;
  height: 100%;

  &__palette {
    display: flex;
    flex: 0 0 150px;
    flex-direction: column;
    gap: 6px;
  }

  &__palette-item {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 10px;
    font-size: var(--app-font-13);
    color: var(--app-text-2);
    text-align: left;
    cursor: pointer;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
    transition: all var(--app-duration-fast) var(--app-ease);

    &:hover {
      color: var(--app-primary);
      border-color: var(--app-primary-border);
      background: var(--app-primary-bg);
    }
  }

  &__canvas {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    padding: 12px;
    overflow: hidden auto;
    background: var(--app-subtle);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__field {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    cursor: pointer;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);

    &.is-active {
      border-color: var(--app-primary);
      box-shadow: 0 0 0 2px var(--app-primary-bg);
    }
  }

  &__field-main {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__field-label {
    font-size: var(--app-font-14);
    color: var(--app-text-1);

    i {
      margin-left: 2px;
      font-style: normal;
      color: var(--app-danger);
    }
  }

  &__field-type {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__field-actions {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    align-items: center;
  }

  &__panel {
    flex: 0 0 280px;
    padding: 12px;
    overflow: hidden auto;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__panel-title {
    margin-bottom: 10px;
    font-size: var(--app-font-13);
    font-weight: 600;
    color: var(--app-text-2);
  }

  &__props {
    margin-top: 4px;
  }

  &__options {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  &__option {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  &__hint {
    font-size: var(--app-font-13);
    color: var(--app-text-3);
  }
}

.form-preview {
  max-width: 720px;
  padding: 20px;
  margin: 0 auto;
  background: var(--app-container);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
}
</style>

<style lang="scss">
.app-form-designer {
  .el-drawer__header {
    align-items: center;
    padding: 12px 20px;
  }

  .el-drawer__body {
    padding: 16px 20px;
    background: var(--app-page-bg);
  }
}
</style>
