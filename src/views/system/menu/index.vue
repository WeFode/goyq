<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { addMenu, deleteMenu, menuListQuery, updateMenu } from "@/api/menu";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { handleTree } from "@/utils/tree";

defineOptions({ name: "SystemMenu" });

/**
 * 菜单管理
 * 后端接口字段为 snake_case（parent_id / menu_type / show_link / keep_alive），
 * 此处严格按接口契约读写，避免树形结构与开关丢失。
 */
const loading = ref(false);
const flatList = ref<any[]>([]);
const keyword = ref("");

const treeData = computed(() =>
  handleTree(flatList.value ?? [], "id", "parent_id")
);

async function load() {
  loading.value = true;
  try {
    const res: any = await menuListQuery({});
    flatList.value = res?.data?.list ?? res?.data ?? [];
  } catch (error) {
    console.error("加载菜单失败:", error);
  } finally {
    loading.value = false;
  }
}

const filteredTree = computed(() => {
  const key = keyword.value.trim();
  if (!key) return treeData.value;
  const filter = (nodes: any[]): any[] =>
    nodes
      .map(node => {
        const children = node.children ? filter(node.children) : [];
        const matched =
          String(node.title ?? "").includes(key) ||
          String(node.path ?? "").includes(key);
        return matched || children.length ? { ...node, children } : null;
      })
      .filter(Boolean);
  return filter(treeData.value);
});

/** 父级下拉：目录节点才能作为父级（menu_type=0 且非叶子使用） */
const parentOptions = computed(() => {
  const flatten = (nodes: any[], depth = 0): any[] =>
    nodes.flatMap(node => [
      {
        id: node.id,
        label: `${"— ".repeat(depth)}${node.title ?? node.name}`
      },
      ...(node.children ? flatten(node.children, depth + 1) : [])
    ]);
  return flatten(treeData.value);
});

/* ============ 新增 / 编辑 ============ */
const dialogVisible = ref(false);
const dialogTitle = ref("新增菜单");
const submitting = ref(false);
const editId = ref<number | null>(null);
const formRef = ref<FormInstance>();

const form = reactive({
  parent_id: 0,
  menu_type: 0,
  title: "",
  name: "",
  path: "",
  component: "",
  icon: "",
  rank: 1,
  show_link: true,
  keep_alive: true
});

const rules: FormRules = {
  title: [{ required: true, message: "请填写菜单标题", trigger: "blur" }],
  name: [{ required: true, message: "请填写路由名称", trigger: "blur" }],
  path: [{ required: true, message: "请填写路由路径", trigger: "blur" }]
};

const MENU_TYPE_HINT: Record<number, string> = {
  0: "菜单（内部页面）",
  1: "内嵌 iframe",
  2: "外链"
};

function resetForm() {
  form.parent_id = 0;
  form.menu_type = 0;
  form.title = "";
  form.name = "";
  form.path = "";
  form.component = "";
  form.icon = "";
  form.rank = 1;
  form.show_link = true;
  form.keep_alive = true;
}

function openCreate(parent?: any) {
  editId.value = null;
  dialogTitle.value = "新增菜单";
  resetForm();
  if (parent) form.parent_id = parent.id;
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editId.value = row.id;
  dialogTitle.value = "编辑菜单";
  form.parent_id = row.parent_id ?? 0;
  form.menu_type = row.menu_type ?? 0;
  form.title = row.title ?? "";
  form.name = row.name ?? "";
  form.path = row.path ?? "";
  form.component = row.component ?? "";
  form.icon = row.icon ?? "";
  form.rank = row.rank ?? 1;
  form.show_link = row.show_link ?? true;
  form.keep_alive = row.keep_alive ?? true;
  dialogVisible.value = true;
}

function submit() {
  const formEl = formRef.value;
  if (!formEl) return;

  formEl.validate(async valid => {
    if (!valid) return;
    submitting.value = true;
    try {
      const payload = { ...form, parent_id: form.parent_id || 0 };
      if (editId.value) {
        await updateMenu({ id: editId.value, ...payload });
        message("保存成功", { type: "success" });
      } else {
        await addMenu(payload);
        message("新增成功", { type: "success" });
      }
      dialogVisible.value = false;
      load();
    } catch (error) {
      console.error("保存菜单失败:", error);
    } finally {
      submitting.value = false;
    }
  });
}

async function handleDelete(row: any) {
  try {
    await deleteMenu(row.id);
    message("删除成功", { type: "success" });
    load();
  } catch (error) {
    console.error("删除菜单失败:", error);
  }
}

onMounted(load);
</script>

<template>
  <AppPage title="菜单管理" description="维护系统菜单结构、路由与显示规则">
    <template #actions>
      <el-input
        v-model="keyword"
        placeholder="搜索菜单标题或路径"
        clearable
        class="menu-search"
      />
      <el-button v-if="hasAuth('sys:menu:add')" type="primary" @click="openCreate()">
        <AppIcon icon="ep:plus" :size="14" />
        新增菜单
      </el-button>
    </template>

    <AppDataTable
      :data="filteredTree"
      :loading="loading"
      row-key="id"
      :show-pagination="false"
      empty-text="暂无菜单"
    >
      <el-table-column label="菜单标题" min-width="200">
        <template #default="{ row }">
          <div class="menu-title">
            <AppIcon
              v-if="row.icon"
              :icon="row.icon"
              :size="14"
              color="var(--app-text-3)"
            />
            <span class="app-text--strong">{{ row.title }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="120" align="center">
        <template #default="{ row }">
          <el-tag size="small" effect="plain">
            {{ MENU_TYPE_HINT[row.menu_type] ?? "菜单" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="路由名称" prop="name" min-width="140" />
      <el-table-column label="路由路径" prop="path" min-width="180" />
      <el-table-column label="组件路径" min-width="200">
        <template #default="{ row }">
          <span class="app-text--secondary">{{ row.component || "-" }}</span>
        </template>
      </el-table-column>
      <el-table-column label="排序" prop="rank" width="80" align="center" />
      <el-table-column label="显示" width="90" align="center">
        <template #default="{ row }">
          <AppStatusTag
            :value="row.show_link ? 1 : 0"
            :map="{
              1: { text: '显示', type: 'success', dot: true },
              0: { text: '隐藏', type: 'info', dot: true }
            }"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="hasAuth('sys:menu:add')"
            link
            type="primary"
            @click="openCreate(row)"
          >
            新增子项
          </el-button>
          <el-button
            v-if="hasAuth('sys:menu:edit')"
            link
            type="primary"
            @click="openEdit(row)"
          >
            编辑
          </el-button>
          <el-popconfirm
            v-if="hasAuth('sys:menu:delete')"
            :title="`确认删除菜单「${row.title}」？`"
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

    <AppFormDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :loading="submitting"
      width="640px"
      @confirm="submit"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="上级菜单">
              <el-select v-model="form.parent_id" placeholder="顶级菜单" class="w-full">
                <el-option label="顶级菜单" :value="0" />
                <el-option
                  v-for="item in parentOptions"
                  :key="item.id"
                  :label="item.label"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="菜单类型">
              <el-select v-model="form.menu_type" class="w-full">
                <el-option label="菜单" :value="0" />
                <el-option label="内嵌 iframe" :value="1" />
                <el-option label="外链" :value="2" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="菜单标题" prop="title">
              <el-input v-model="form.title" placeholder="显示名称" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="路由名称" prop="name">
              <el-input v-model="form.name" placeholder="需与组件 name 一致" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="路由路径" prop="path">
              <el-input v-model="form.path" placeholder="/system/user/index" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="组件路径">
              <el-input v-model="form.component" placeholder="system/user" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="菜单图标">
              <el-input v-model="form.icon" placeholder="如 ep:setting" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序">
              <el-input-number v-model="form.rank" :min="0" :max="999" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="菜单显示">
              <el-switch v-model="form.show_link" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="页面缓存">
              <el-switch v-model="form.keep_alive" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </AppFormDialog>
  </AppPage>
</template>

<style scoped lang="scss">
.menu-search {
  width: 220px;
}

.menu-title {
  display: flex;
  gap: 6px;
  align-items: center;
}
</style>
