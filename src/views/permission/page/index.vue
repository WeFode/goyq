<script setup lang="ts">
import { computed } from "vue";
import { usePermission } from "@/composables/usePermission";

/** 页面级权限演示：说明路由 meta.roles 与权限码的关系 */
defineOptions({ name: "PermissionPage" });

const { roles, authList, isSuperAdmin, can } = usePermission();

const checks = computed(() => [
  {
    code: "sys:user:add",
    text: "账号管理 · 新增"
  },
  {
    code: "sys:role:edit",
    text: "角色管理 · 编辑"
  },
  {
    code: "engine:workflow:edit",
    text: "流程管理 · 编辑"
  },
  {
    code: "hr:employee:edit",
    text: "员工管理 · 编辑"
  }
]);
</script>

<template>
  <AppPage title="页面权限" description="页面可见性由后端菜单授权控制，按钮由权限码控制">
    <div class="page-perm">
      <AppDetailSection title="角色与页面">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="当前角色">
            {{ roles.length ? roles.join("、") : "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="是否超管">
            {{ isSuperAdmin ? "是" : "否" }}
          </el-descriptions-item>
          <el-descriptions-item label="可见页面">
            由菜单授权决定（后端返回的路由列表）
          </el-descriptions-item>
          <el-descriptions-item label="按钮权限数量">
            {{ authList.length }}
          </el-descriptions-item>
        </el-descriptions>
      </AppDetailSection>

      <AppDetailSection title="权限码核对">
        <div class="page-perm__list">
          <div v-for="item in checks" :key="item.code" class="page-perm__item">
            <span class="page-perm__text">{{ item.text }}</span>
            <code class="page-perm__code">{{ item.code }}</code>
            <AppStatusTag
              :value="can(item.code) ? 1 : 0"
              :map="{
                1: { text: '已授权', type: 'success', dot: true },
                0: { text: '未授权', type: 'info', dot: true }
              }"
            />
          </div>
        </div>
      </AppDetailSection>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="页面级权限说明"
        description="页面能否进入取决于后端菜单授权结果；若直接访问未授权页面，路由守卫会跳转到 403。"
      />
    </div>
  </AppPage>
</template>

<style scoped lang="scss">
.page-perm {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: var(--app-card-padding);
  background: var(--app-container);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__item {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    background: var(--app-subtle);
    border-radius: var(--app-radius-sm);
  }

  &__text {
    min-width: 180px;
    font-size: var(--app-font-13);
    color: var(--app-text-1);
  }

  &__code {
    flex: 1;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }
}
</style>
