<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  addDict,
  addDictItem,
  deleteDict,
  deleteDictItem,
  dictItemsQuery,
  dictListQuery,
  updateDict,
  updateDictItem,
  type Dict,
  type DictItem
} from "@/api/dict";
import { clearDictCache } from "@/utils/dictStore";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";

/**
 * 字典管理
 * 左侧为字典列表，右侧为选中字典的字典项。
 * 系统内置字典（isSystem）用于对齐引擎常量，禁止删除，但允许调整项与停用。
 */
defineOptions({ name: "EnginDict" });

const TONES = [
  { value: "primary", label: "主色" },
  { value: "success", label: "成功" },
  { value: "warning", label: "警告" },
  { value: "info", label: "信息" },
  { value: "danger", label: "危险" }
];

const STATUS_MAP = {
  1: { text: "启用", type: "success" as const, dot: true },
  2: { text: "停用", type: "info" as const, dot: true }
};

/* ==================== 字典列表 ==================== */
const keyword = ref("");
const dictLoading = ref(false);
const dicts = ref<Dict[]>([]);
const active = ref<Dict | null>(null);

async function loadDicts() {
  dictLoading.value = true;
  try {
    const res = await dictListQuery({
      page: 1,
      pageSize: 200,
      keyword: keyword.value.trim() || undefined
    });
    dicts.value = res?.data?.list ?? [];
    const keepId = active.value?.id;
    active.value =
      dicts.value.find(item => item.id === keepId) ?? dicts.value[0] ?? null;
    if (active.value) {
      await loadItems(active.value.dictCode);
    } else {
      items.value = [];
    }
  } catch (error) {
    console.error("加载字典列表失败:", error);
  } finally {
    dictLoading.value = false;
  }
}

/* ==================== 字典项列表 ==================== */
const itemLoading = ref(false);
const items = ref<DictItem[]>([]);

async function loadItems(dictCode: string) {
  itemLoading.value = true;
  try {
    const res = await dictItemsQuery({ dictCode });
    items.value = res?.data?.items ?? [];
  } catch (error) {
    console.error("加载字典项失败:", error);
    items.value = [];
  } finally {
    itemLoading.value = false;
  }
}

function selectDict(row: Dict) {
  if (active.value?.id === row.id) return;
  active.value = row;
  loadItems(row.dictCode);
}

/* ==================== 字典表单 ==================== */
const dictDialog = ref(false);
const dictEditId = ref<string | null>(null);
const dictSubmitting = ref(false);
const dictFormRef = ref<FormInstance>();
const dictForm = reactive({
  dictCode: "",
  dictName: "",
  category: "business",
  status: 1,
  remark: ""
});

const dictRules = computed<FormRules>(() => ({
  dictCode: [
    { required: true, message: "请填写字典编码", trigger: "blur" },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_]{1,63}$/,
      message: "编码以字母开头，可包含字母、数字与下划线",
      trigger: "blur"
    }
  ],
  dictName: [{ required: true, message: "请填写字典名称", trigger: "blur" }]
}));

function openDictCreate() {
  dictEditId.value = null;
  dictForm.dictCode = "";
  dictForm.dictName = "";
  dictForm.category = "business";
  dictForm.status = 1;
  dictForm.remark = "";
  dictDialog.value = true;
}

function openDictEdit(row: Dict) {
  dictEditId.value = row.id;
  dictForm.dictCode = row.dictCode;
  dictForm.dictName = row.dictName;
  dictForm.category = row.category;
  dictForm.status = row.status;
  dictForm.remark = row.remark ?? "";
  dictDialog.value = true;
}

function submitDict() {
  dictFormRef.value?.validate(async valid => {
    if (!valid) return;
    dictSubmitting.value = true;
    try {
      if (dictEditId.value) {
        await updateDict(dictEditId.value, {
          dictName: dictForm.dictName,
          status: dictForm.status,
          remark: dictForm.remark
        });
        message("保存成功", { type: "success" });
      } else {
        await addDict({ ...dictForm });
        message("新增成功", { type: "success" });
      }
      dictDialog.value = false;
      clearDictCache(dictForm.dictCode);
      await loadDicts();
    } catch (error) {
      console.error("保存字典失败:", error);
    } finally {
      dictSubmitting.value = false;
    }
  });
}

async function removeDict() {
  if (!active.value) return;
  try {
    await deleteDict(active.value.id);
    message("删除成功", { type: "success" });
    clearDictCache(active.value.dictCode);
    active.value = null;
    await loadDicts();
  } catch (error) {
    console.error("删除字典失败:", error);
  }
}

/* ==================== 字典项表单 ==================== */
const itemDialog = ref(false);
const itemEditId = ref<string | null>(null);
const itemSubmitting = ref(false);
const itemFormRef = ref<FormInstance>();
const itemForm = reactive({
  itemValue: "",
  itemLabel: "",
  tone: "info",
  sort: 10,
  status: 1,
  remark: ""
});

const itemRules = computed<FormRules>(() => ({
  itemValue: [
    { required: !itemEditId.value, message: "请填写字典项值", trigger: "blur" }
  ],
  itemLabel: [{ required: true, message: "请填写字典项标签", trigger: "blur" }]
}));

function openItemCreate() {
  if (!active.value) return;
  itemEditId.value = null;
  itemForm.itemValue = "";
  itemForm.itemLabel = "";
  itemForm.tone = "info";
  itemForm.sort = (items.value.at(-1)?.sort ?? 0) + 10;
  itemForm.status = 1;
  itemForm.remark = "";
  itemDialog.value = true;
}

function openItemEdit(row: DictItem) {
  itemEditId.value = row.id;
  itemForm.itemValue = row.itemValue;
  itemForm.itemLabel = row.itemLabel;
  itemForm.tone = row.tone || "info";
  itemForm.sort = row.sort ?? 0;
  itemForm.status = row.status ?? 1;
  itemForm.remark = row.remark ?? "";
  itemDialog.value = true;
}

function submitItem() {
  itemFormRef.value?.validate(async valid => {
    if (!valid || !active.value) return;
    itemSubmitting.value = true;
    try {
      if (itemEditId.value) {
        await updateDictItem(itemEditId.value, {
          itemLabel: itemForm.itemLabel,
          tone: itemForm.tone,
          sort: itemForm.sort,
          status: itemForm.status,
          remark: itemForm.remark
        });
        message("保存成功", { type: "success" });
      } else {
        await addDictItem({
          dictCode: active.value.dictCode,
          itemValue: itemForm.itemValue,
          itemLabel: itemForm.itemLabel,
          tone: itemForm.tone,
          sort: itemForm.sort,
          status: itemForm.status,
          remark: itemForm.remark
        });
        message("新增成功", { type: "success" });
      }
      itemDialog.value = false;
      clearDictCache(active.value.dictCode);
      await Promise.all([loadItems(active.value.dictCode), loadDicts()]);
    } catch (error) {
      console.error("保存字典项失败:", error);
    } finally {
      itemSubmitting.value = false;
    }
  });
}

async function removeItem(row: DictItem) {
  try {
    await deleteDictItem(row.id);
    message("删除成功", { type: "success" });
    if (active.value) clearDictCache(active.value.dictCode);
    await Promise.all([
      loadItems(active.value?.dictCode ?? ""),
      loadDicts()
    ]);
  } catch (error) {
    console.error("删除字典项失败:", error);
  }
}

onMounted(loadDicts);
</script>

<template>
  <AppPage
    title="字典管理"
    description="维护业务枚举与字典项；系统内置字典对齐引擎常量，禁止删除"
  >
    <template #actions>
      <el-button
        v-if="hasAuth('sys:dict:add')"
        type="primary"
        @click="openDictCreate"
      >
        <AppIcon icon="ep:plus" :size="14" />
        新增字典
      </el-button>
    </template>

    <div class="dict">
      <!-- 左：字典列表 -->
      <aside class="dict__aside">
        <el-input
          v-model="keyword"
          placeholder="搜索字典名称或编码"
          clearable
          @keyup.enter="loadDicts"
          @clear="loadDicts"
        >
          <template #prefix>
            <AppIcon icon="ep:search" :size="14" />
          </template>
        </el-input>

        <div v-loading="dictLoading" class="dict__list">
          <button
            v-for="row in dicts"
            :key="row.id"
            type="button"
            class="dict__item"
            :class="{ 'is-active': active?.id === row.id }"
            @click="selectDict(row)"
          >
            <span class="dict__item-top">
              <span class="dict__item-name">{{ row.dictName }}</span>
              <span v-if="row.isSystem" class="dict__badge">内置</span>
            </span>
            <span class="dict__item-meta">
              <code>{{ row.dictCode }}</code>
              <em>{{ row.itemCount }} 项</em>
            </span>
          </button>

          <AppEmpty
            v-if="!dictLoading && !dicts.length"
            description="暂无字典"
            :image-size="72"
          />
        </div>
      </aside>

      <!-- 右：字典项 -->
      <section class="dict__main">
        <template v-if="active">
          <header class="dict__head">
            <div class="dict__head-info">
              <h3 class="dict__title">
                {{ active.dictName }}
                <code class="dict__code">{{ active.dictCode }}</code>
              </h3>
              <p class="dict__desc">
                {{ active.remark || "暂无描述" }}
                <span class="dict__status">
                  状态：<AppStatusTag :value="active.status" :map="STATUS_MAP" />
                </span>
              </p>
            </div>
            <div class="dict__head-actions">
              <el-button
                v-if="hasAuth('sys:dict:edit')"
                @click="openDictEdit(active)"
              >
                编辑字典
              </el-button>
              <el-popconfirm
                v-if="!active.isSystem && hasAuth('sys:dict:delete')"
                :title="`确认删除字典「${active.dictName}」及其全部字典项？`"
                width="280"
                @confirm="removeDict"
              >
                <template #reference>
                  <el-button type="danger" plain>删除字典</el-button>
                </template>
              </el-popconfirm>
              <el-button
                v-if="hasAuth('sys:dict:add')"
                type="primary"
                @click="openItemCreate"
              >
                <AppIcon icon="ep:plus" :size="14" />
                新增字典项
              </el-button>
            </div>
          </header>

          <el-alert
            v-if="active.isSystem"
            class="dict__tip"
            type="info"
            :closable="false"
            show-icon
            title="系统内置字典"
            description="该字典与工作流引擎枚举保持一致，前端页面优先使用内置映射渲染；此处可用于核对取值与调整展示标签。"
          />

          <el-table
            v-loading="itemLoading"
            :data="items"
            border
            row-key="id"
            empty-text="暂无字典项"
          >
            <el-table-column label="值" min-width="140">
              <template #default="{ row }">
                <code class="dict__value">{{ row.itemValue }}</code>
              </template>
            </el-table-column>
            <el-table-column label="标签" min-width="140">
              <template #default="{ row }">
                <span class="app-text--strong">{{ row.itemLabel }}</span>
              </template>
            </el-table-column>
            <el-table-column label="色调" width="110" align="center">
              <template #default="{ row }">
                <AppStatusTag
                  :value="row.tone || 'info'"
                  :map="{
                    primary: { text: '主色', type: 'primary' },
                    success: { text: '成功', type: 'success' },
                    warning: { text: '警告', type: 'warning' },
                    info: { text: '信息', type: 'info' },
                    danger: { text: '危险', type: 'danger' }
                  }"
                />
              </template>
            </el-table-column>
            <el-table-column label="排序" prop="sort" width="80" align="center" />
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <AppStatusTag :value="row.status" :map="STATUS_MAP" />
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="150">
              <template #default="{ row }">
                <span class="dict__muted">{{ row.remark || "-" }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="130" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="hasAuth('sys:dict:edit')"
                  link
                  type="primary"
                  @click="openItemEdit(row)"
                >
                  编辑
                </el-button>
                <el-popconfirm
                  v-if="hasAuth('sys:dict:delete')"
                  :title="`确认删除字典项「${row.itemLabel}」？`"
                  width="240"
                  @confirm="removeItem(row)"
                >
                  <template #reference>
                    <el-button link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <AppEmpty v-else description="请选择左侧字典查看字典项" />
      </section>
    </div>

    <!-- 字典表单 -->
    <AppFormDialog
      v-model="dictDialog"
      :title="dictEditId ? '编辑字典' : '新增字典'"
      :loading="dictSubmitting"
      width="520px"
      @confirm="submitDict"
    >
      <el-form
        ref="dictFormRef"
        :model="dictForm"
        :rules="dictRules"
        label-width="88px"
      >
        <el-form-item label="字典编码" prop="dictCode">
          <el-input
            v-model="dictForm.dictCode"
            placeholder="如 hr_leave_type"
            :disabled="!!dictEditId"
            clearable
          />
        </el-form-item>
        <el-form-item label="字典名称" prop="dictName">
          <el-input
            v-model="dictForm.dictName"
            placeholder="如 请假类型"
            clearable
          />
        </el-form-item>
        <el-form-item label="分类">
          <el-radio-group v-model="dictForm.category" :disabled="!!dictEditId">
            <el-radio value="business">业务字典</el-radio>
            <el-radio value="system">系统字典</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="dictForm.status"
            :active-value="1"
            :inactive-value="2"
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="dictForm.remark"
            type="textarea"
            :rows="2"
            maxlength="255"
            show-word-limit
          />
        </el-form-item>
      </el-form>
    </AppFormDialog>

    <!-- 字典项表单 -->
    <AppFormDialog
      v-model="itemDialog"
      :title="itemEditId ? '编辑字典项' : '新增字典项'"
      :loading="itemSubmitting"
      width="520px"
      @confirm="submitItem"
    >
      <el-form
        ref="itemFormRef"
        :model="itemForm"
        :rules="itemRules"
        label-width="88px"
      >
        <el-form-item label="字典" v-if="active">
          <span class="dict__muted">
            {{ active.dictName }}（{{ active.dictCode }}）
          </span>
        </el-form-item>
        <el-form-item label="项值" prop="itemValue">
          <el-input
            v-model="itemForm.itemValue"
            placeholder="如 annual"
            :disabled="!!itemEditId"
            clearable
          />
        </el-form-item>
        <el-form-item label="项标签" prop="itemLabel">
          <el-input v-model="itemForm.itemLabel" placeholder="如 年假" clearable />
        </el-form-item>
        <el-form-item label="色调">
          <el-select v-model="itemForm.tone" class="dict__select">
            <el-option
              v-for="tone in TONES"
              :key="tone.value"
              :label="tone.label"
              :value="tone.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="itemForm.sort" :min="0" :max="9999" :step="10" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="itemForm.status"
            :active-value="1"
            :inactive-value="2"
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="itemForm.remark"
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
.dict {
  display: grid;
  grid-template-columns: 288px minmax(0, 1fr);
  gap: 16px;
  align-items: start;

  &__aside {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: calc(100vh - 300px);
    overflow-y: auto;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    padding: 10px 12px;
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
      background: var(--app-primary-bg);
      border-color: var(--app-primary);

      .dict__item-name {
        color: var(--app-primary);
      }
    }
  }

  &__item-top {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  &__item-name {
    overflow: hidden;
    font-size: var(--app-font-13);
    font-weight: 500;
    color: var(--app-text-1);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__badge {
    flex: none;
    padding: 0 6px;
    font-size: var(--app-font-12);
    line-height: 18px;
    color: var(--app-text-3);
    background: var(--app-info-bg);
    border-radius: var(--app-radius-xs);
  }

  &__item-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    font-size: var(--app-font-12);
    color: var(--app-text-4);

    code {
      overflow: hidden;
      font-family: "JetBrains Mono", Consolas, monospace;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    em {
      flex: none;
      font-style: normal;
    }
  }

  &__main {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    padding: 16px;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__head {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
  }

  &__head-info {
    min-width: 0;
  }

  &__title {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 0;
    font-size: var(--app-font-16);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__code {
    padding: 2px 6px;
    font-family: "JetBrains Mono", Consolas, monospace;
    font-size: var(--app-font-12);
    font-weight: 400;
    color: var(--app-text-3);
    background: var(--app-info-bg);
    border-radius: var(--app-radius-xs);
  }

  &__desc {
    display: flex;
    gap: 16px;
    align-items: center;
    margin: 6px 0 0;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__status {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  &__head-actions {
    display: flex;
    flex: none;
    gap: 8px;
  }

  &__value {
    font-family: "JetBrains Mono", Consolas, monospace;
    font-size: var(--app-font-12);
    color: var(--app-text-2);
  }

  &__muted {
    font-size: var(--app-font-13);
    color: var(--app-text-3);
  }

  &__select {
    width: 160px;
  }
}

@media (max-width: 1100px) {
  .dict {
    grid-template-columns: minmax(0, 1fr);
  }

  .dict__list {
    max-height: 240px;
  }
}
</style>
