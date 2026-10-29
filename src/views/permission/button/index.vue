<script setup lang="ts">
import { computed } from "vue";
import { usePermission } from "@/composables/usePermission";

/** 按钮级权限演示：对比不同权限控制方式的生效结果 */
defineOptions({ name: "PermissionButtonRouter" });

const { can, authList, isSuperAdmin } = usePermission();

/** 演示用编码，实际项目请替换为后端配置的权限码 */
const demos = [
  {
    code: "sys:user:add",
    label: "新增账号",
    desc: "对应账号管理页面的新增按钮"
  },
  {
    code: "sys:user:delete",
    label: "删除账号",
    desc: "对应账号管理页面的删除按钮"
  },
  {
    code: "sys:role:edit",
    label: "编辑角色",
    desc: "对应角色管理页面的编辑按钮"
  }
];

const owned = computed(() => demos.filter(item => can(item.code)));
</script>

<template>
  <AppPage
    title="按钮权限"
    description="通过 v-auth 指令或 usePermission 判断按钮是否展示"
  >
    <div class="perm-demo">
      <AppDetailSection title="当前账号权限">
        <div class="perm-demo__tags">
          <el-tag v-if="isSuperAdmin" type="danger" effect="light">
            超级管理员（拥有全部权限）
          </el-tag>
          <el-tag v-for="code in authList" :key="code" size="small" effect="plain">
            {{ code }}
          </el-tag>
          <span v-if="!isSuperAdmin && authList.length === 0" class="app-text--tertiary">
            暂无按钮权限，请联系管理员分配
          </span>
        </div>
      </AppDetailSection>

      <AppDetailSection title="方式一：v-auth 指令">
        <p class="perm-demo__desc">
          在模板中使用 <code>v-auth="'sys:user:add'"</code>，无权限时元素会被移除。
        </p>
        <div class="perm-demo__row">
          <el-button v-auth="'sys:user:add'" type="primary">新增账号（v-auth）</el-button>
          <el-button v-auth="'sys:user:delete'" type="danger" plain>
            删除账号（v-auth）
          </el-button>
        </div>
      </AppDetailSection>

      <AppDetailSection title="方式二：usePermission 判断">
        <p class="perm-demo__desc">
          在脚本中调用 <code>can(code)</code>，适合需要控制逻辑或非按钮元素的场景。
        </p>
        <div class="perm-demo__row">
          <el-button
            v-for="item in demos"
            :key="item.code"
            :type="can(item.code) ? 'primary' : 'info'"
            :plain="!can(item.code)"
            :disabled="!can(item.code)"
          >
            {{ item.label }}：{{ can(item.code) ? "有权限" : "无权限" }}
          </el-button>
        </div>
      </AppDetailSection>

      <AppDetailSection title="当前账号可执行的演示操作">
        <div v-if="owned.length" class="perm-demo__list">
          <div v-for="item in owned" :key="item.code" class="perm-demo__item">
            <span class="app-text--strong">{{ item.label }}</span>
            <code>{{ item.code }}</code>
            <span class="app-text--tertiary">{{ item.desc }}</span>
          </div>
        </div>
        <AppEmpty v-else description="当前账号没有演示所需的权限" />
      </AppDetailSection>
    </div>
  </AppPage>
</template>

<style scoped lang="scss">
.perm-demo {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: var(--app-card-padding);
  background: var(--app-container);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  &__desc {
    font-size: var(--app-font-13);
    line-height: 22px;
    color: var(--app-text-3);

    code {
      padding: 1px 5px;
      font-size: var(--app-font-12);
      color: var(--app-text-2);
      background: var(--app-info-bg);
      border-radius: var(--app-radius-xs);
    }
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__item {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    font-size: var(--app-font-13);
    background: var(--app-subtle);
    border-radius: var(--app-radius-sm);

    code {
      font-size: var(--app-font-12);
      color: var(--app-text-2);
    }
  }
}
</style>
