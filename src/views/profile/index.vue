<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { useUserStoreHook } from "@/store/modules/user";
import { getEmployee, updateEmployeeProfile } from "@/api/employee";
import { uploadFile } from "@/api/common";
import { message } from "@/utils/message";

defineOptions({ name: "ProfileIndex" });

const userStore = useUserStoreHook();

const nickname = computed(
  () => userStore.nickname || userStore.username || "用户"
);

const departments = computed<any[]>(() => employee.value?.departments ?? userStore.departments ?? []);

const primaryDepartmentName = computed(() => {
  const list = departments.value;
  const primary = list.find((item: any) => item.isPrimary) ?? list[0];
  return primary?.departmentName ?? "-";
});

/* ============ 员工详情 ============ */
const employee = ref<any>(null);
const loading = ref(false);

async function loadEmployee() {
  const employeeId = userStore.employeeId;
  if (!employeeId || employeeId === "0") return;
  loading.value = true;
  try {
    const { data } = await getEmployee(employeeId as string);
    // 详情接口返回 { employee: {...} }
    employee.value = data?.employee ?? data ?? null;
    syncForm();
  } catch (error: any) {
    // 无权限或档案不存在时降级为账号信息展示
    console.warn("[profile] 员工详情加载失败:", error?.message);
  } finally {
    loading.value = false;
  }
}

/* ============ 基本资料 ============ */
const infoFormRef = ref<FormInstance>();
const infoForm = reactive({
  employeeName: "",
  workMobile: "",
  address: "",
  gender: 1,
  avatar: ""
});
const infoSaving = ref(false);

/**
 * 头像：库内只存 fileId（后端会归一化），展示用后端下发的签名地址。
 * 这里分开两个状态，避免把带时效的签名地址又写回数据库。
 */
const avatarFileId = ref("");
const avatarPreview = ref("");
const avatarUploading = ref(false);

const infoRules: FormRules = {
  employeeName: [
    { required: true, message: "请填写姓名", trigger: "blur" },
    { min: 2, max: 20, message: "姓名长度为 2-20 个字符", trigger: "blur" }
  ],
  workMobile: [
    {
      pattern: /^1[3-9]\d{9}$/,
      message: "请输入正确的手机号",
      trigger: "blur"
    }
  ]
};

function syncForm() {
  const row = employee.value ?? {};
  infoForm.employeeName = row.employeeName ?? userStore.nickname ?? "";
  infoForm.workMobile = row.workMobile ?? "";
  infoForm.address = row.address ?? "";
  infoForm.gender = row.gender ?? 1;
  // 未重新上传时提交值留空（后端只在有值时才更新头像）
  avatarFileId.value = "";
  avatarPreview.value = row.avatar ?? userStore.avatar ?? "";
}

/** 选择本地图片 → 上传 → 记下 fileId，保存资料时一并提交 */
async function handleAvatarPick(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    message("请选择图片文件", { type: "warning" });
    input.value = "";
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    message("头像大小不能超过 2MB", { type: "warning" });
    input.value = "";
    return;
  }

  avatarUploading.value = true;
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("businessType", "avatar");
    const res: any = await uploadFile(formData);
    const info = res?.data?.file;
    if (info?.id) {
      avatarFileId.value = info.id;
      avatarPreview.value = info.fileUrl ?? "";
      message("头像已上传，点击保存资料后生效", { type: "success" });
    }
  } catch (error) {
    console.error("[profile] 头像上传失败:", error);
  } finally {
    avatarUploading.value = false;
    input.value = "";
  }
}

async function saveInfo() {
  const formEl = infoFormRef.value;
  if (!formEl) return;
  await formEl.validate(async valid => {
    if (!valid) return;
    infoSaving.value = true;
    try {
      await updateEmployeeProfile({
        employeeName: infoForm.employeeName,
        workMobile: infoForm.workMobile,
        address: infoForm.address,
        gender: infoForm.gender,
        // 仅在上传了新头像时提交 fileId；undefined 不会覆盖已有头像
        avatar: avatarFileId.value || undefined
      });
      message("资料已更新", { type: "success" });
      userStore.SET_NICKNAME(infoForm.employeeName);
      if (avatarFileId.value) {
        userStore.SET_AVATAR(avatarPreview.value);
      }
      loadEmployee();
    } catch (error: any) {
      // 错误提示由 http 层统一弹出，避免重复提示
      console.warn("[profile] 资料更新失败:", error?.message);
    } finally {
      infoSaving.value = false;
    }
  });
}

/* ============ 修改密码 ============ */
const pwdFormRef = ref<FormInstance>();
const pwdForm = reactive({
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
});
const pwdSaving = ref(false);

const pwdRules: FormRules = {
  currentPassword: [
    { required: true, message: "请输入当前密码", trigger: "blur" }
  ],
  newPassword: [
    { required: true, message: "请输入新密码", trigger: "blur" },
    { min: 6, max: 32, message: "密码长度为 6-32 个字符", trigger: "blur" }
  ],
  confirmPassword: [
    { required: true, message: "请再次输入新密码", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        value !== pwdForm.newPassword
          ? callback(new Error("两次输入的密码不一致"))
          : callback();
      },
      trigger: "blur"
    }
  ]
};

async function savePassword() {
  const formEl = pwdFormRef.value;
  if (!formEl) return;
  await formEl.validate(async valid => {
    if (!valid) return;
    pwdSaving.value = true;
    try {
      await updateEmployeeProfile({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword
      });
      message("密码已更新，请牢记新密码", { type: "success" });
      pwdForm.currentPassword = "";
      pwdForm.newPassword = "";
      pwdForm.confirmPassword = "";
      formEl.clearValidate();
    } catch (error: any) {
      console.warn("[profile] 密码修改失败:", error?.message);
    } finally {
      pwdSaving.value = false;
    }
  });
}

/* ============ 账号信息 ============ */
const accountRows = computed(() => [
  { label: "登录账号", value: userStore.username || "-" },
  { label: "员工编号", value: employee.value?.employeeNumber || userStore.employeeId || "-" },
  { label: "所属部门", value: departments.value.map((item: any) => item.departmentName).join("、") || "-" },
  { label: "职位", value: employee.value?.positionName || "-" },
  { label: "角色", value: (userStore.roles ?? []).join("、") || "-" },
  {
    label: "账号类型",
    value: (userStore.roles ?? []).includes("超级管理员") ? "超级管理员" : "普通账号"
  }
]);

onMounted(loadEmployee);
</script>

<template>
  <AppPage title="个人资料" description="维护个人资料、登录密码与账号信息">
    <div class="profile" v-loading="loading">
      <aside class="profile__card">
        <AppUserAvatar
          :name="nickname"
          :avatar="avatarPreview"
          :size="72"
        />
        <h3 class="profile__name">{{ nickname }}</h3>
        <p class="profile__dept">{{ primaryDepartmentName }}</p>
        <div class="profile__meta">
          <div class="profile__meta-item">
            <span class="profile__meta-label">员工编号</span>
            <span>{{ employee?.employeeNumber || "-" }}</span>
          </div>
          <div class="profile__meta-item">
            <span class="profile__meta-label">账号</span>
            <span>{{ userStore.username || "-" }}</span>
          </div>
        </div>
        <div class="profile__roles">
          <el-tag
            v-for="role in userStore.roles ?? []"
            :key="role"
            size="small"
            type="info"
          >
            {{ role }}
          </el-tag>
        </div>
      </aside>

      <section class="profile__panel">
        <el-tabs>
          <el-tab-pane label="基本资料">
            <el-form
              ref="infoFormRef"
              :model="infoForm"
              :rules="infoRules"
              label-width="88px"
              class="profile__form"
            >
              <el-form-item label="姓名" prop="employeeName">
                <el-input v-model="infoForm.employeeName" placeholder="请输入姓名" clearable />
              </el-form-item>
              <el-form-item label="工作手机" prop="workMobile">
                <el-input v-model="infoForm.workMobile" placeholder="请输入手机号" clearable />
              </el-form-item>
              <el-form-item label="性别" prop="gender">
                <el-radio-group v-model="infoForm.gender">
                  <el-radio :value="1">男</el-radio>
                  <el-radio :value="2">女</el-radio>
                  <el-radio :value="3">未知</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="家庭住址" prop="address">
                <el-input
                  v-model="infoForm.address"
                  type="textarea"
                  :rows="2"
                  placeholder="请输入家庭住址"
                />
              </el-form-item>
              <el-form-item label="头像">
                <div class="profile__avatar-edit">
                  <AppUserAvatar
                    :name="infoForm.employeeName || nickname"
                    :avatar="avatarPreview"
                    :size="52"
                  />
                  <label class="profile__avatar-pick">
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      @change="handleAvatarPick"
                    />
                    {{ avatarUploading ? "上传中…" : "更换头像" }}
                  </label>
                  <span class="profile__avatar-hint">
                    jpg/png，不超过 2MB；未上传时使用姓名首字
                  </span>
                </div>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="infoSaving" @click="saveInfo">
                  保存资料
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="安全设置">
            <el-form
              ref="pwdFormRef"
              :model="pwdForm"
              :rules="pwdRules"
              label-width="88px"
              class="profile__form"
            >
              <el-form-item label="当前密码" prop="currentPassword">
                <el-input
                  v-model="pwdForm.currentPassword"
                  type="password"
                  show-password
                  placeholder="请输入当前密码"
                />
              </el-form-item>
              <el-form-item label="新密码" prop="newPassword">
                <el-input
                  v-model="pwdForm.newPassword"
                  type="password"
                  show-password
                  placeholder="6-32 位字符"
                />
              </el-form-item>
              <el-form-item label="确认密码" prop="confirmPassword">
                <el-input
                  v-model="pwdForm.confirmPassword"
                  type="password"
                  show-password
                  placeholder="请再次输入新密码"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="pwdSaving" @click="savePassword">
                  更新密码
                </el-button>
                <span class="profile__hint">修改后请使用新密码重新登录其他设备</span>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="账号信息">
            <el-descriptions :column="2" border>
              <el-descriptions-item
                v-for="row in accountRows"
                :key="row.label"
                :label="row.label"
              >
                {{ row.value }}
              </el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>
        </el-tabs>
      </section>
    </div>
  </AppPage>
</template>

<style scoped lang="scss">
.profile {
  display: flex;
  gap: 16px;
  align-items: flex-start;

  &__avatar-edit {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }

  &__avatar-pick {
    padding: 0 12px;
    font-size: var(--app-font-13);
    line-height: 30px;
    color: var(--app-primary);
    cursor: pointer;
    background: var(--app-primary-bg);
    border: 1px solid var(--app-primary-border);
    border-radius: var(--app-radius-sm);
    transition: background 160ms ease, color 160ms ease;

    &:hover {
      color: #fff;
      background: var(--app-primary);
    }
  }

  &__avatar-hint {
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }

  &__card {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    align-items: center;
    width: 240px;
    padding: 28px 20px;
    text-align: center;
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__name {
    margin-top: 12px;
    font-size: var(--app-font-16);
    font-weight: 600;
    color: var(--app-text-1);
  }

  &__dept {
    margin-top: 4px;
    font-size: var(--app-font-13);
    color: var(--app-text-3);
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    padding-top: 16px;
    margin-top: 16px;
    font-size: var(--app-font-13);
    border-top: 1px solid var(--app-border);
  }

  &__meta-item {
    display: flex;
    justify-content: space-between;
    color: var(--app-text-2);
  }

  &__meta-label {
    color: var(--app-text-3);
  }

  &__roles {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    margin-top: 16px;
  }

  &__panel {
    flex: 1;
    min-width: 0;
    padding: var(--app-card-padding);
    background: var(--app-container);
    border: 1px solid var(--app-border);
    border-radius: var(--app-radius-md);
  }

  &__form {
    max-width: 520px;
    padding-top: 4px;
  }

  &__hint {
    margin-left: 12px;
    font-size: var(--app-font-12);
    color: var(--app-text-3);
  }
}

@media (width <= 768px) {
  .profile {
    flex-direction: column;

    &__card {
      width: 100%;
    }
  }
}
</style>
