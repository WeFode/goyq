<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  addConfig,
  batchSaveConfig,
  configGroupsQuery,
  configListQuery,
  deleteConfig,
  type ConfigGroupInfo,
  type ConfigInfo
} from "@/api/config";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";

/**
 * 系统参数
 * 左侧分组，右侧表单；按 valueType 渲染不同控件，整组批量保存。
 * 内置参数（isSystem）只允许改值，不允许删除。
 */
defineOptions({ name: "SystemConfig" });

const groups = ref<ConfigGroupInfo[]>([]);
const activeGroup = ref("");
const configs = ref<ConfigInfo[]>([]);
const formValues = ref<Record<string, any>>({});
const loading = ref(false);
const saving = ref(false);

const dirty = ref(false);

const activeGroupName = computed(
  () => groups.value.find(item => item.code === activeGroup.value)?.name ?? ""
);

/* ==================== 加载 ==================== */
async function loadGroups() {
  const res = await configGroupsQuery();
  groups.value = res?.data?.groups ?? [];
  if (!activeGroup.value || !groups.value.some(g => g.code === activeGroup.value)) {
    activeGroup.value = groups.value[0]?.code ?? "";
  }
}

function normalizeValue(row: ConfigInfo) {
  if (row.valueType === "boolean") return row.configValue === "true";
  if (row.valueType === "number") {
    const num = Number(row.configValue);
    return Number.isNaN(num) ? 0 : num;
  }
  return row.configValue ?? "";
}

function stringifyValue(value: any, valueType: string): string {
  if (value === null || value === undefined) return "";
  if (valueType === "boolean") return value ? "true" : "false";
  return String(value);
}

async function loadConfigs() {
  if (!activeGroup.value) {
    configs.value = [];
    formValues.value = {};
    return;
  }
  loading.value = true;
  try {
    const res = await configListQuery({ group: activeGroup.value });
    configs.value = res?.data?.list ?? [];
    const next: Record<string, any> = {};
    configs.value.forEach(row => {
      next[row.configKey] = normalizeValue(row);
    });
    formValues.value = next;
    dirty.value = false;
  } catch (error) {
    console.error("加载系统参数失败:", error);
  } finally {
    loading.value = false;
  }
}

async function switchGroup(code: string) {
  if (code === activeGroup.value) return;
  activeGroup.value = code;
  await loadConfigs();
}

async function refreshAll() {
  await loadGroups();
  await loadConfigs();
}

/* ==================== 保存 ==================== */
async function save() {
  if (!activeGroup.value || !configs.value.length) return;
  saving.value = true;
  try {
    const items = configs.value.map(row => ({
      configKey: row.configKey,
      configValue: stringifyValue(formValues.value[row.configKey], row.valueType)
    }));
    const res = await batchSaveConfig({ group: activeGroup.value, items });
    message(`已保存 ${res?.data?.updated ?? items.length} 项参数`, {
      type: "success"
    });
    dirty.value = false;
    await refreshAll();
  } catch (error) {
    console.error("保存系统参数失败:", error);
  } finally {
    saving.value = false;
  }
}

function markDirty() {
  dirty.value = true;
}

/* ==================== 新增参数 ==================== */
const createVisible = ref(false);
const createSubmitting = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = reactive({
  configKey: "",
  configName: "",
  configValue: "",
  valueType: "string",
  isPublic: false,
  sort: 100,
  remark: ""
});

const createRules: FormRules = {
  configKey: [
    { required: true, message: "请填写参数键", trigger: "blur" },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_.]{1,127}$/,
      message: "以字母开头，可包含字母、数字、下划线与点",
      trigger: "blur"
    }
  ],
  configName: [{ required: true, message: "请填写参数名称", trigger: "blur" }]
};

function openCreate() {
  createForm.configKey = "";
  createForm.configName = "";
  createForm.configValue = "";
  createForm.valueType = "string";
  createForm.isPublic = false;
  createForm.sort = 100;
  createForm.remark = "";
  createVisible.value = true;
}

function submitCreate() {
  createFormRef.value?.validate(async valid => {
    if (!valid || !activeGroup.value) return;
    createSubmitting.value = true;
    try {
      await addConfig({ ...createForm, configGroup: activeGroup.value });
      message("新增成功", { type: "success" });
      createVisible.value = false;
      await refreshAll();
    } catch (error) {
      console.error("新增参数失败:", error);
    } finally {
      createSubmitting.value = false;
    }
  });
}

async function removeConfig(row: ConfigInfo) {
  try {
    await deleteConfig(row.id);
    message("删除成功", { type: "success" });
    await refreshAll();
  } catch (error) {
    console.error("删除参数失败:", error);
  }
}

onMounted(async () => {
  await loadGroups();
  await loadConfigs();
});
</script>

<template>
  <AppPage
    title="系统参数"
    description="集中维护站点信息、安全策略、附件限制与审批规则"
  >
    <template #actions>
      <span v-if="dirty" class="cfg__dirty">有未保存的修改</span>
      <el-button v-if="hasAuth('sys:config:add')" @click="openCreate">
        <AppIcon icon="ep:plus" :size="14" />
        新增参数
      </el-button>
      <el-button
        v-if="hasAuth('sys:config:edit')"
        type="primary"
        :loading="saving"
        @click="save"
      >
        保存
      </el-button>
    </template>

    <div class="cfg">
      <!-- 分组 -->
      <aside class="cfg__aside">
        <button
          v-for="group in groups"
          :key="group.code"
          type="button"
          class="cfg__group"
          :class="{ 'is-active': activeGroup === group.code }"
          @click="switchGroup(group.code)"
        >
          <span class="cfg__group-name">{{ group.name }}</span>
          <em class="cfg__group-count">{{ group.count }}</em>
        </button>
      </aside>

      <!-- 参数表单 -->
      <section v-loading="loading" class="cfg__main">
        <header class="cfg__head">
          <h3 class="cfg__title">{{ activeGroupName || "系统参数" }}</h3>
          <span class="cfg__hint">
            共 {{ configs.length }} 项，内置参数只能修改取值
          </span>
        </header>

        <template v-if="configs.length">
          <div v-for="row in configs" :key="row.id" class="cfg__row">
            <div class="cfg__label">
              <span class="cfg__label-text">
                {{ row.configName }}
                <span v-if="row.isPublic" class="cfg__badge">公开</span>
              </span>
              <span class="cfg__label-desc">{{ row.remark || row.configKey }}</span>
            </div>

            <div class="cfg__control">
              <el-switch
                v-if="row.valueType === 'boolean'"
                v-model="formValues[row.configKey]"
                @change="markDirty"
              />
              <el-input-number
                v-else-if="row.valueType === 'number'"
                v-model="formValues[row.configKey]"
                :min="0"
                :max="999999"
                controls-position="right"
                class="cfg__number"
                @change="markDirty"
              />
              <el-input
                v-else-if="row.valueType === 'text'"
                v-model="formValues[row.configKey]"
                type="textarea"
                :rows="3"
                @input="markDirty"
              />
              <el-input
                v-else
                v-model="formValues[row.configKey]"
                @input="markDirty"
              />

              <div class="cfg__meta">
                <code class="cfg__key">{{ row.configKey }}</code>
                <el-popconfirm
                  v-if="!row.isSystem && hasAuth('sys:config:delete')"
                  :title="`确认删除参数「${row.configName}」？`"
                  width="240"
                  @confirm="removeConfig(row)"
                >
                  <template #reference>
                    <el-button link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </div>
            </div>
          </div>
        </template>

        <AppEmpty v-else description="该分组暂无参数" />
      </section>
    </div>

    <!-- 新增参数 -->
    <AppFormDialog
      v-model="createVisible"
      title="新增参数"
      :loading="createSubmitting"
      width="540px"
      @confirm="submitCreate"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="88px"
      >
        <el-form-item label="所属分组">
          <span class="cfg__label-desc">{{ activeGroupName }}（{{ activeGroup }}）</span>
        </el-form-item>
        <el-form-item label="参数键" prop="configKey">
          <el-input
            v-model="createForm.configKey"
            placeholder="如 site.servicePhone"
            clearable
          />
        </el-form-item>
        <el-form-item label="参数名称" prop="configName">
          <el-input
            v-model="createForm.configName"
            placeholder="如 客服电话"
            clearable
          />
        </el-form-item>
        <el-form-item label="值类型">
          <el-select v-model="createForm.valueType" class="cfg__select">
            <el-option label="文本" value="string" />
            <el-option label="数字" value="number" />
            <el-option label="开关" value="boolean" />
            <el-option label="多行文本" value="text" />
          </el-select>
        </el-form-item>
        <el-form-item label="参数值">
          <el-input v-model="createForm.configValue" placeholder="默认值" clearable />
        </el-form-item>
        <el-form-item label="公开读取">
          <el-switch v-model="createForm.isPublic" />
          <span class="cfg__label-desc cfg__inline-desc">
            开启后可通过公开接口读取（如站点名称、客服电话）
          </span>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number
            v-model="createForm.sort"
            :min="0"
            :max="9999"
            :step="10"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="createForm.remark"
            type="textarea"
            :rows="2"
            maxlength="255"
            show-word-limit
          />
        </el-form-item>
      </el-form>
    </AppFormDialog>
  </AppPage>
</template>

<style scoped lang="scss">
.cfg {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  align-items: start;

  &__dirty {
    display: inline-flex;
    align-items: center;
    padding: 0 10px;
    font-size: var(--app-font-12);
    line-height: 26px;
    color: var(--app-warning);
    background: var(--app-warning-bg);
    border-radius: var(--app-radius-round);
  }

  &__aside {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__group {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    font-size: var(--app-font-13);
    color: var(--app-text-2);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--app-radius-sm);
    transition: background 160ms ease;

    &:hover {
      background: var(--app-subtle);
    }

    &.is-active {
      font-weight: 500;
      color: var(--app-primary);
      background: var(--app-primary-bg);
      border-color: var(--app-primary);
    }
  }

  &__group-count {
    flex: none;
    padding: 0 6px;
    font-size: var(--app-font-12);
    font-style: normal;
    color: var(--app-text-3);
    background: var(--app-info-bg);
    border-radius: var(--app-radius-round);
  }

  &__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 20px;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: baseline;
    justify-content: space-between;
    padding-bottom: 12px;
    margin-bottom: 4px;
    border-bottom: 1px solid var(--app-border);
  }

  &__title {
    margin: 0;
    font-size: var(--app-font-16);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__hint {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__row {
    display: grid;
    grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
    gap: 16px;
    padding: 16px 0;
    border-bottom: 1px dashed var(--app-border);

    &:last-child {
      border-bottom: none;
    }
  }

  &__label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  &__label-text {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: var(--app-font-13);
    font-weight: 500;
    color: var(--app-text-1);
  }

  &__label-desc {
    font-size: var(--app-font-12);
    line-height: 18px;
    color: var(--app-text-3);
  }

  &__inline-desc {
    margin-left: 12px;
  }

  &__badge {
    padding: 0 6px;
    font-size: var(--app-font-12);
    font-weight: 400;
    line-height: 18px;
    color: var(--app-success);
    background: var(--app-success-bg);
    border-radius: var(--app-radius-xs);
  }

  &__control {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  &__meta {
    display: flex;
    gap: 12px;
    align-items: center;
    min-height: 20px;
  }

  &__key {
    font-family: "JetBrains Mono", Consolas, monospace;
    font-size: var(--app-font-12);
    color: var(--app-text-4);
  }

  &__number {
    width: 180px;
  }

  &__select {
    width: 160px;
  }
}

@media (max-width: 1100px) {
  .cfg {
    grid-template-columns: minmax(0, 1fr);
  }

  .cfg__row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
}
</style>
