<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessageBox } from "element-plus";
import {
  createKbCategory,
  deleteKbCategory,
  kbCategoryListQuery,
  updateKbCategory,
  type KbCategory
} from "@/api/kb";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { KB_SCOPE } from "@/utils/dicts";
import { handleTree } from "@/utils/tree";

/**
 * 知识库分类管理：平铺列表 + 树形上级选择。
 * 分类按归属范围（企业/个人）划分，删除前校验无子分类、无文档。
 */
defineOptions({ name: "KbCategory" });

const loading = ref(false);
const list = ref<KbCategory[]>([]);

const nameOf = (id: string) =>
  id === "0" || !id ? "顶级" : list.value.find(item => item.id === id)?.name || "-";

const categoryTree = computed(() =>
  handleTree(list.value.map(item => ({ ...item })), "id", "parentId", "children")
);

async function load() {
  loading.value = true;
  try {
    const res = await kbCategoryListQuery();
    list.value = res?.data?.list ?? [];
  } catch (error) {
    console.error("加载分类失败:", error);
    list.value = [];
  } finally {
    loading.value = false;
  }
}

/* ==================== 新增 / 编辑 ==================== */
const dialogVisible = ref(false);
const dialogTitle = ref("新增分类");
const editingId = ref("");
const submitting = ref(false);
const formRef = ref<FormInstance>();
const form = reactive<{
  parentId: string;
  name: string;
  scope: "company" | "personal";
  sort: number;
  icon: string;
}>({
  parentId: "0",
  name: "",
  scope: "company",
  sort: 0,
  icon: ""
});

const rules: FormRules = {
  name: [
    { required: true, message: "请填写分类名称", trigger: "blur" },
    { max: 100, message: "名称不超过 100 字", trigger: "blur" }
  ],
  scope: [{ required: true, message: "请选择归属范围", trigger: "change" }]
};

function resetForm(parentId = "0") {
  form.parentId = parentId;
  form.name = "";
  form.scope = "company";
  form.sort = 0;
  form.icon = "";
}

function openCreate(parentId = "0") {
  editingId.value = "";
  dialogTitle.value = parentId === "0" ? "新增分类" : "新增子分类";
  resetForm(parentId);
  dialogVisible.value = true;
}

function openEdit(row: KbCategory) {
  editingId.value = row.id;
  dialogTitle.value = "编辑分类";
  form.parentId = row.parentId || "0";
  form.name = row.name;
  form.scope = row.scope;
  form.sort = row.sort;
  form.icon = row.icon || "";
  dialogVisible.value = true;
}

function submit() {
  formRef.value?.validate(async valid => {
    if (!valid) return;
    submitting.value = true;
    try {
      const payload = {
        parentId: form.parentId || "0",
        name: form.name,
        scope: form.scope,
        sort: form.sort,
        icon: form.icon
      };
      if (editingId.value) {
        await updateKbCategory(editingId.value, payload);
        message("保存成功", { type: "success" });
      } else {
        await createKbCategory(payload);
        message("新增成功", { type: "success" });
      }
      dialogVisible.value = false;
      load();
    } catch (error) {
      console.error("保存分类失败:", error);
    } finally {
      submitting.value = false;
    }
  });
}

async function handleDelete(row: KbCategory) {
  try {
    await ElMessageBox.confirm(`确认删除分类「${row.name}」？`, "删除确认", {
      type: "warning"
    });
  } catch {
    return;
  }
  try {
    await deleteKbCategory(row.id);
    message("删除成功", { type: "success" });
    load();
  } catch (error) {
    console.error("删除分类失败:", error);
  }
}

onMounted(load);
</script>

<template>
  <AppPage
    title="分类管理"
    description="维护知识库的分类目录，分类按企业 / 个人范围划分"
  >
    <template #actions>
      <el-button
        v-if="hasAuth('kb:category:add')"
        type="primary"
        @click="openCreate()"
      >
        <AppIcon icon="ep:plus" :size="14" />
        新增分类
      </el-button>
    </template>

    <AppDataTable :data="list" :loading="loading" :show-pagination="false" empty-text="暂无分类">
      <el-table-column label="分类名称" min-width="200">
        <template #default="{ row }">
          <span class="app-text--strong">{{ row.name }}</span>
          <AppIcon v-if="row.icon" :icon="row.icon" :size="14" class="kbc__icon" />
        </template>
      </el-table-column>
      <el-table-column label="上级分类" width="160">
        <template #default="{ row }">{{ nameOf(row.parentId) }}</template>
      </el-table-column>
      <el-table-column label="归属范围" width="120" align="center">
        <template #default="{ row }">
          <AppStatusTag :value="row.scope" :map="KB_SCOPE" />
        </template>
      </el-table-column>
      <el-table-column label="文档数" width="90" align="center" prop="docCount" />
      <el-table-column label="排序" width="80" align="center" prop="sort" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="hasAuth('kb:category:edit')"
            link
            type="primary"
            @click="openEdit(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="hasAuth('kb:category:add')"
            link
            type="primary"
            @click="openCreate(row.id)"
          >
            新增子分类
          </el-button>
          <el-button
            v-if="hasAuth('kb:category:delete')"
            link
            type="danger"
            @click="handleDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </AppDataTable>

    <AppFormDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :loading="submitting"
      width="520px"
      confirm-text="保存"
      @confirm="submit"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" placeholder="如 制度规范 / 技术资料" maxlength="100" clearable />
        </el-form-item>
        <el-form-item label="归属范围" prop="scope">
          <el-radio-group v-model="form.scope">
            <el-radio-button value="company">企业文档</el-radio-button>
            <el-radio-button value="personal">个人文件</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="上级分类">
          <el-tree-select
            v-model="form.parentId"
            :data="categoryTree"
            node-key="id"
            :props="{ label: 'name', children: 'children', value: 'id' }"
            placeholder="顶级分类"
            check-strictly
            clearable
            class="w-full"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="999" controls-position="right" />
        </el-form-item>
        <el-form-item label="图标">
          <AppIconPicker v-model="form.icon" />
        </el-form-item>
      </el-form>
    </AppFormDialog>
  </AppPage>
</template>

<style scoped lang="scss">
.kbc__icon {
  margin-left: 6px;
  color: var(--app-text-3);
}
</style>
