<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { updateEmployeeProfile } from "@/api/employee";
import { useUserStoreHook } from "@/store/modules/user";
import { userKey } from "@/utils/auth";
import { storageLocal } from "@/utils/storage";
import { emitter } from "@/utils/mitt";

const router = useRouter();
const userStore = useUserStoreHook();

const nickname = computed(
  () => userStore.nickname || userStore.username || "用户"
);

const departments = computed(() => userStore.departments ?? []);

const primaryDepartment = computed(() => {
  const list = departments.value;
  if (!list.length) return null;
  return list.find((item: any) => item.isPrimary) ?? list[0];
});

const primaryDepartmentName = computed(
  () => primaryDepartment.value?.departmentName ?? ""
);

const goProfile = () => router.push("/profile");

/** 切换主部门（逻辑与原实现一致） */
async function switchDepartment(departmentId: string) {
  if (primaryDepartment.value?.departmentId === departmentId) return;

  try {
    const response: any = await updateEmployeeProfile({
      primaryDeptId: departmentId
    });

    if (response?.code !== 0) {
      ElMessage.error(response?.msg || "切换主部门失败");
      return;
    }

    const updatedDepts = departments.value.map((dept: any) => ({
      ...dept,
      isPrimary: dept.departmentId === departmentId
    }));
    userStore.SET_DEPARTMENTS(updatedDepts);

    const userData = storageLocal().getItem<any>(userKey);
    if (userData) {
      userData.departments = updatedDepts;
      storageLocal().setItem(userKey, userData);
    }

    emitter.emit("primaryDeptChanged", {
      departmentId,
      departments: updatedDepts
    });
    ElMessage.success("主部门切换成功");
  } catch (error) {
    console.error("切换主部门失败:", error);
    ElMessage.error("切换主部门失败");
  }
}

const handleCommand = (command: string) => {
  if (command === "profile") goProfile();
  if (command === "logout") userStore.logOut();
};
</script>

<template>
  <el-dropdown trigger="click" @command="handleCommand">
    <div class="app-navbar__user">
      <AppUserAvatar
        :name="nickname"
        :avatar="userStore.avatar ?? ''"
        :size="30"
      />
      <div class="app-navbar__user-info">
        <span class="app-navbar__user-name">{{ nickname }}</span>
        <span v-if="primaryDepartmentName" class="app-navbar__user-dept">
          {{ primaryDepartmentName }}
        </span>
      </div>
      <AppIcon icon="ep:arrow-down" :size="12" color="var(--app-text-3)" />
    </div>

    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="profile">
          <AppIcon icon="ep:user" :size="15" />
          <span class="app-dropdown-text">个人资料</span>
        </el-dropdown-item>

        <el-dropdown-item
          v-for="dept in departments"
          :key="dept.departmentId"
          :disabled="dept.isPrimary"
          @click="switchDepartment(dept.departmentId)"
        >
          <AppIcon icon="ri:git-branch-line" :size="15" />
          <span class="app-dropdown-text">{{ dept.departmentName }}</span>
          <el-tag v-if="dept.isPrimary" size="small" class="app-dept-tag">
            当前
          </el-tag>
        </el-dropdown-item>

        <el-dropdown-item command="logout" divided>
          <AppIcon icon="ep:switch-button" :size="15" />
          <span class="app-dropdown-text">退出登录</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped lang="scss">
.app-dropdown-text {
  margin-left: 8px;
}

.app-dept-tag {
  margin-left: 8px;
}
</style>
