<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { employeeListQuery } from "@/api/employee";
import { deptTreeQuery } from "@/api/dept";
import { message } from "@/utils/message";

defineOptions({ name: "HrContacts" });

/* ============ 数据 ============ */
const loading = ref(false);
const keyword = ref("");
const activeDept = ref<string>("");
const employees = ref<any[]>([]);
const deptTree = ref<any[]>([]);

async function loadData() {
  loading.value = true;
  try {
    const [empRes, deptRes]: any[] = await Promise.all([
      employeeListQuery({ page: 1, pageSize: 1000 }),
      deptTreeQuery()
    ]);
    employees.value = empRes?.data?.list ?? [];
    deptTree.value = deptRes?.data?.tree ?? deptRes?.data ?? [];
  } catch (error) {
    console.error("加载通讯录失败:", error);
    message("加载通讯录失败", { type: "error" });
  } finally {
    loading.value = false;
  }
}

/* ============ 部门树 ============ */
const deptOptions = computed(() => {
  const flatten = (nodes: any[], depth = 0): any[] =>
    nodes.flatMap(node => [
      {
        id: node.id,
        label: node.deptName,
        depth,
        count: employees.value.filter(
          (emp: any) => emp.departmentId === node.id
        ).length
      },
      ...(node.children ? flatten(node.children, depth + 1) : [])
    ]);
  return flatten(deptTree.value);
});

/* ============ 过滤 ============ */
const filteredEmployees = computed(() => {
  const key = keyword.value.trim().toLowerCase();
  return employees.value.filter(emp => {
    const matchDept = activeDept.value
      ? emp.departmentId === activeDept.value
      : true;
    if (!matchDept) return false;
    if (!key) return true;
    return (
      String(emp.employeeName ?? "").toLowerCase().includes(key) ||
      String(emp.employeeNumber ?? "").toLowerCase().includes(key) ||
      String(emp.workMobile ?? "").includes(key)
    );
  });
});

const groupedEmployees = computed(() => {
  const groups = new Map<string, any[]>();
  filteredEmployees.value.forEach(emp => {
    const key = emp.departmentId ?? "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(emp);
  });
  return [...groups.entries()].map(([deptId, items]) => ({
    deptId,
    deptName:
      deptOptions.value.find(item => item.id === deptId)?.label ?? "未分配部门",
    items
  }));
});

const formatMobile = (mobile: string) => mobile || "-";

function callMobile(mobile?: string) {
  if (!mobile) {
    message("该员工未填写手机号", { type: "warning" });
    return;
  }
  window.location.href = `tel:${mobile}`;
}

onMounted(loadData);
</script>

<template>
  <AppPage title="通讯录" description="按部门浏览员工联系方式">
    <div v-loading="loading" class="contacts">
      <!-- 左侧部门列表 -->
      <aside class="contacts__dept">
        <el-input
          v-model="keyword"
          placeholder="搜索姓名、编号、手机号"
          clearable
        >
          <template #prefix>
            <AppIcon icon="ep:search" :size="14" />
          </template>
        </el-input>

        <ul class="contacts__dept-list">
          <li
            class="contacts__dept-item"
            :class="{ 'is-active': activeDept === '' }"
            @click="activeDept = ''"
          >
            <span class="contacts__dept-name">全部员工</span>
            <span class="contacts__dept-count">{{ employees.length }}</span>
          </li>
          <li
            v-for="dept in deptOptions"
            :key="dept.id"
            class="contacts__dept-item"
            :class="{ 'is-active': activeDept === dept.id }"
            :style="{ paddingLeft: `${12 + dept.depth * 12}px` }"
            @click="activeDept = dept.id"
          >
            <span class="contacts__dept-name">{{ dept.label }}</span>
            <span class="contacts__dept-count">{{ dept.count }}</span>
          </li>
        </ul>
      </aside>

      <!-- 右侧员工卡片 -->
      <section class="contacts__main">
        <template v-if="groupedEmployees.length">
          <div
            v-for="group in groupedEmployees"
            :key="group.deptId"
            class="contacts__group"
          >
            <h3 class="contacts__group-title">
              {{ group.deptName }}
              <span class="contacts__group-count">{{ group.items.length }} 人</span>
            </h3>

            <div class="contacts__grid">
              <div
                v-for="emp in group.items"
                :key="emp.id"
                class="contacts__card"
              >
                <AppUserAvatar
                  :name="emp.employeeName"
                  :avatar="emp.avatar"
                  :size="40"
                />
                <div class="contacts__info">
                  <span class="contacts__name">{{ emp.employeeName }}</span>
                  <span class="contacts__meta">
                    {{ emp.positionName || emp.employeeNumber || "-" }}
                  </span>
                </div>
                <div class="contacts__actions">
                  <el-button link type="primary" @click="callMobile(emp.workMobile)">
                    <AppIcon icon="ep:message" :size="13" />
                    {{ formatMobile(emp.workMobile) }}
                  </el-button>
                  <span v-if="emp.workEmail" class="contacts__email">
                    {{ emp.workEmail }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <AppEmpty v-else description="没有匹配的员工" />
      </section>
    </div>
  </AppPage>
</template>

<style scoped lang="scss">
.contacts {
  display: flex;
  gap: 16px;
  align-items: flex-start;

  &__dept {
    display: flex;
    flex: 0 0 240px;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__dept-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: calc(100vh - 260px);
    overflow: hidden auto;
  }

  &__dept-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 34px;
    padding: 0 12px;
    font-size: var(--app-font-13);
    color: var(--app-text-2);
    cursor: pointer;
    border-radius: var(--app-radius-sm);
    transition: background-color var(--app-duration-fast) var(--app-ease);

    &:hover {
      background: var(--app-info-bg);
    }

    &.is-active {
      font-weight: 500;
      color: var(--app-primary);
      background: var(--app-primary-bg);
    }
  }

  &__dept-count {
    font-size: var(--app-font-12);
    color: var(--app-text-4);
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  &__group {
    padding: var(--app-card-padding);
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__group-title {
    display: flex;
    gap: 8px;
    align-items: baseline;
    margin-bottom: 12px;
    font-size: var(--app-font-14);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__group-count {
    font-size: var(--app-font-12);
    font-weight: 400;
    color: var(--app-text-3);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }

  &__card {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 12px;
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-sm);
    transition: border-color var(--app-duration-fast) var(--app-ease);

    &:hover {
      border-color: var(--app-primary-border);
    }
  }

  &__info {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    line-height: 1.4;
  }

  &__name {
    font-size: var(--app-font-14);
    font-weight: 500;
    color: var(--app-text-1);
  }

  &__meta {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: var(--app-font-12);
  }

  &__email {
    overflow: hidden;
    max-width: 140px;
    color: var(--app-text-4);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (width <= 900px) {
  .contacts {
    flex-direction: column;

    &__dept {
      flex-basis: auto;
      width: 100%;
    }
  }
}
</style>
