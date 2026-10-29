<script setup lang="ts">
import { useRouter } from "vue-router";

/**
 * 字典管理占位页
 * 后端当前未提供字典接口（sys_dicts / sys_dict_items 表亦未落地），
 * 菜单保留该入口时给出说明与跳转，避免直接出现空白页。
 */
defineOptions({ name: "EnginDict" });

const router = useRouter();
</script>

<template>
  <AppPage title="字典管理" description="维护系统枚举字典与字典项">
    <div class="dict">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="该功能尚未开放"
        description="后端暂未提供字典管理接口（sys_dicts / sys_dict_items），因此本页仅保留入口说明。若不需要该菜单，可在「菜单管理」中停用。"
      />

      <div class="dict__actions">
        <el-button type="primary" @click="router.push('/system/permission/index')">
          前往权限管理
        </el-button>
        <el-button @click="router.push('/system/menu/index')">前往菜单管理</el-button>
      </div>
    </div>
  </AppPage>
</template>

<style scoped lang="scss">
.dict {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: var(--app-card-padding);
  background: var(--app-container);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);

  &__actions {
    display: flex;
    gap: 8px;
  }
}
</style>
