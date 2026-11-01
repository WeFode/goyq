<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import type { FormInstance } from "element-plus";
import { message } from "@/utils/message";
import { createLoginRules, applyRules } from "./utils/rule";
import { useUserStoreHook } from "@/store/modules/user";
import { useSettingStoreHook } from "@/store/modules/settings";
import { initRouter, getTopMenu } from "@/router/utils";
import { WebSocketService } from "@/utils/websocket/service";
import { applyAccount } from "@/api/invitation";
import { getCaptcha } from "@/api/user";
import logoUrl from "@/assets/logo.svg";

defineOptions({ name: "Login" });

const router = useRouter();
const userStore = useUserStoreHook();
const settingStore = useSettingStoreHook();

const activeTab = ref<"login" | "apply">("login");
const loading = ref(false);
const applyLoading = ref(false);
const rememberPassword = ref(false);
const ruleFormRef = ref<FormInstance>();
const applyFormRef = ref<FormInstance>();

const REMEMBER_PASSWORD_KEY = "loginRememberPassword";
const TENANT_CODE_KEY = "loginTenantCode";

const ruleForm = reactive({
  tenantCode: "",
  username: "",
  password: "",
  captchaCode: ""
});

/* ============ 验证码（是否需要、何时要求均由后端安全策略决定） ============ */
const captcha = reactive({
  required: false,
  captchaId: "",
  image: "",
  lockRemainSeconds: 0
});

// 取码时的账号指纹。失败次数是按账号统计的，换了账号必须重新取码，
// 否则会出现「上一个账号还不需要验证码，当前这个已被锁定/需要验证码却看不见输入框」。
let captchaSubject = "";
const subjectOf = () => `${ruleForm.tenantCode}|${ruleForm.username}`;

async function refreshCaptcha(force = true) {
  if (!force && captchaSubject === subjectOf()) return;
  try {
    const res: any = await getCaptcha({
      username: ruleForm.username || undefined,
      tenantCode: ruleForm.tenantCode || undefined
    });
    const data = res?.data || {};
    captcha.required = !!data.required;
    captcha.captchaId = data.captchaId || "";
    captcha.image = data.image || "";
    captcha.lockRemainSeconds = data.lockRemainSeconds || 0;
    captchaSubject = subjectOf();
    if (!captcha.required) ruleForm.captchaCode = "";
  } catch {
    // 验证码接口异常不阻断登录页；提交时后端仍会按策略拦截
    captcha.required = false;
    captcha.image = "";
  }
}

/** 账号/企业编码变化后按需重新判定（已有验证码不重复刷新） */
function onAccountBlur() {
  refreshCaptcha(false);
}

/** 锁定提示：让用户在提交前就知道还要等多久，而不是反复试错 */
const lockHint = computed(() => {
  if (captcha.lockRemainSeconds <= 0) return "";
  return `账号已被临时锁定，请在约 ${Math.ceil(captcha.lockRemainSeconds / 60)} 分钟后重试`;
});

/** 验证码为空时本地先拦一道；是否需要填由 getter 在校验时实时取后端结论 */
const loginRules = createLoginRules(() => captcha.required);

const applyForm = reactive({
  inviteCode: "",
  employeeName: "",
  password: "",
  workMobile: "",
  gender: null as number | null,
  address: ""
});

const genderOptions = [
  { label: "男", value: 1 },
  { label: "女", value: 2 },
  { label: "未知", value: 3 }
];

const features = [
  {
    icon: "ep:data-line",
    title: "流程进度实时可视",
    desc: "审批进度一目了然\n提升组织协同效率"
  },
  {
    icon: "ep:user-filled",
    title: "组织与权限统一管理",
    desc: "组织架构清晰规范\n权限管控安全可靠"
  },
  {
    icon: "ep:bell",
    title: "消息通知及时触达",
    desc: "待办审批即时提醒\n重要信息不再遗漏"
  }
];

/* ============ 素材与静态说明 ============ */
const assetBase = import.meta.env.BASE_URL;
const heroImage = `${assetBase}1.png`;
const capabilitiesImage = `${assetBase}2.png`;

type InfoType = "help" | "about" | "privacy" | "terms" | "forgot";

const INFO_TITLES: Record<InfoType, string> = {
  help: "帮助中心",
  about: "关于我们",
  privacy: "隐私政策",
  terms: "使用条款",
  forgot: "忘记密码"
};

const infoVisible = ref(false);
const infoType = ref<InfoType>("help");
const infoTitle = computed(() => INFO_TITLES[infoType.value]);

function openInfo(type: InfoType) {
  infoType.value = type;
  infoVisible.value = true;
}

function handleLanguage(command: string | number | object) {
  if (command === "en") {
    message("英文界面正在建设中，敬请期待", { type: "info" });
  }
}

/* ============ 记住密码 ============ */
function loadRememberedPassword() {
  try {
    const remembered = localStorage.getItem(REMEMBER_PASSWORD_KEY);
    if (!remembered) return;
    const data = JSON.parse(remembered);
    if (data?.remember) {
      ruleForm.username = data.username ?? "";
      ruleForm.password = data.password ?? "";
      rememberPassword.value = true;
    }
  } catch {
    localStorage.removeItem(REMEMBER_PASSWORD_KEY);
  }
}

function saveRememberedPassword() {
  if (rememberPassword.value) {
    localStorage.setItem(
      REMEMBER_PASSWORD_KEY,
      JSON.stringify({
        remember: true,
        username: ruleForm.username,
        password: ruleForm.password
      })
    );
  } else {
    localStorage.removeItem(REMEMBER_PASSWORD_KEY);
  }
}

/* ============ 登录 ============ */
let loginTimer: ReturnType<typeof setTimeout> | null = null;

async function onLogin(formEl?: FormInstance) {
  if (!formEl || loginTimer) return;

  await formEl.validate(valid => {
    if (!valid) return;

    loading.value = true;
    loginTimer = setTimeout(() => (loginTimer = null), 2000);

    userStore
      .loginByUsername({
        tenantCode: ruleForm.tenantCode || undefined,
        username: ruleForm.username,
        password: ruleForm.password,
        captchaId: captcha.captchaId || undefined,
        captchaCode: ruleForm.captchaCode || undefined
      })
      .then((res: any) => {
        if (!res?.success) {
          message("登录失败", { type: "error" });
          refreshCaptcha();
          return;
        }

        saveRememberedPassword();
        localStorage.setItem(TENANT_CODE_KEY, ruleForm.tenantCode || "");

        // 密码策略（有效期/首次强制改密）由后端判定，这里只负责把用户带到改密入口
        const mustChange = !!res?.data?.mustChangePassword;
        const expired = !!res?.data?.pwdExpired;

        return initRouter()
          .then(() => new Promise(resolve => setTimeout(resolve, 200)))
          .then(async () => {
            // 登录成功后建立 WebSocket 连接，保证消息实时推送
            setTimeout(() => WebSocketService.getInstance().connect(), 500);
            if (mustChange) {
              await router.push("/profile");
              message(
                expired
                  ? "密码已超过有效期，请先修改密码后再继续使用"
                  : "为了账号安全，请先修改初始密码",
                { type: "warning" }
              );
              return;
            }
            await redirectToHome();
          })
          .catch(error => {
            console.error("路由初始化失败:", error);
            return redirectToHome("登录成功，但路由初始化失败");
          });
      })
      .catch((error: any) => {
        // 失败原因可能包含「请输入验证码 / 账号已锁定」，必须回显并重新取码
        message(error?.message || "用户名或密码错误", { type: "error" });
        refreshCaptcha();
      })
      .finally(() => {
        loading.value = false;
      });
  });
}

async function redirectToHome(warning?: string) {
  try {
    const topMenu = getTopMenu(true);
    await router.push(topMenu?.path || "/welcome");
  } catch {
    await router.push("/welcome");
  }
  message("登录成功", { type: warning ? "warning" : "success" });
}

/* ============ 申请账号 ============ */
let applyTimer: ReturnType<typeof setTimeout> | null = null;

async function onApply(formEl?: FormInstance) {
  if (!formEl || applyTimer) return;

  await formEl.validate(async valid => {
    if (!valid) return;

    applyLoading.value = true;
    applyTimer = setTimeout(() => (applyTimer = null), 2000);

    try {
      const res: any = await applyAccount({
        inviteCode: applyForm.inviteCode,
        employeeName: applyForm.employeeName,
        password: applyForm.password,
        workMobile: applyForm.workMobile,
        gender: applyForm.gender,
        address: applyForm.address
      });

      if (res?.success) {
        message("申请成功，请等待管理员分配账号", { type: "success" });
        formEl.resetFields();
        setTimeout(() => (activeTab.value = "login"), 1200);
      } else {
        message(res?.message || "申请失败", { type: "error" });
      }
    } catch (error: any) {
      message(error?.message || "申请失败", { type: "error" });
    } finally {
      applyLoading.value = false;
    }
  });
}

/** 回车提交 */
function onkeypress(event: KeyboardEvent) {
  if (!["Enter", "NumpadEnter"].includes(event.code)) return;
  activeTab.value === "login"
    ? onLogin(ruleFormRef.value)
    : onApply(applyFormRef.value);
}

onMounted(() => {
  ruleForm.tenantCode = localStorage.getItem(TENANT_CODE_KEY) || "";
  loadRememberedPassword();
  window.document.addEventListener("keypress", onkeypress);
  refreshCaptcha();
});

onBeforeUnmount(() => {
  window.document.removeEventListener("keypress", onkeypress);
});
</script>

<template>
  <div class="login">
    <!-- 品牌区 -->
    <section
      class="login__brand"
      :style="{
        backgroundImage: `linear-gradient(90deg, rgba(6, 23, 56, 0.95) 0%, rgba(9, 38, 92, 0.8) 48%, rgba(12, 48, 112, 0.48) 100%), url(${heroImage})`
      }"
    >
      <div class="login__brand-inner">
        <div class="login__brand-logo">
          <img :src="logoUrl" alt="logo" />
          <span>{{ settingStore.getTitle }}</span>
        </div>

        <h1 class="login__brand-title">
          协同审批，<span>让组织运转更高效</span>
        </h1>
        <p class="login__brand-desc">
          统一入口、统一权限、统一流程，打造安全、高效、透明的数字化办公体验。
        </p>

        <ul class="login__features">
          <li v-for="item in features" :key="item.title">
            <span class="login__feature-icon">
              <AppIcon :icon="item.icon" :size="22" />
            </span>
            <strong class="login__feature-title">{{ item.title }}</strong>
            <span class="login__feature-desc">{{ item.desc }}</span>
          </li>
        </ul>
      </div>

      <footer class="login__brand-footer">
        建议使用 Chrome / Edge 浏览器以获得最佳体验
      </footer>
    </section>

    <!-- 登录区 -->
    <section class="login__panel">
      <header class="login__topbar">
        <el-dropdown trigger="click" @command="handleLanguage">
          <button type="button" class="login__topbar-btn">
            简体中文
            <AppIcon icon="ep:arrow-down" :size="12" />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="zh">简体中文</el-dropdown-item>
              <el-dropdown-item command="en">English</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <span class="login__topbar-divider" />
        <button type="button" class="login__topbar-btn" @click="openInfo('help')">
          帮助中心
        </button>
      </header>

      <div class="login__mobile-brand">
        <img :src="logoUrl" alt="logo" />
        <span>{{ settingStore.getTitle }}</span>
      </div>

      <div class="login__card">
        <header class="login__card-header">
          <h2 class="login__card-title">
            {{ activeTab === "login" ? "账号登录" : "申请账号" }}
          </h2>
          <p class="login__card-desc">
            {{
              activeTab === "login"
                ? `欢迎使用 ${settingStore.getTitle}平台`
                : "填写邀请码信息提交申请，审核后开通账号"
            }}
          </p>
        </header>

        <div class="login__tabs">
          <button
            type="button"
            :class="{ 'is-active': activeTab === 'login' }"
            @click="activeTab = 'login'"
          >
            <AppIcon icon="ep:user-filled" :size="16" />
            账号登录
          </button>
          <button
            type="button"
            :class="{ 'is-active': activeTab === 'apply' }"
            @click="activeTab = 'apply'"
          >
            <AppIcon icon="ep:user" :size="16" />
            申请账号
          </button>
        </div>

        <!-- 登录表单 -->
        <el-form
          v-if="activeTab === 'login'"
          ref="ruleFormRef"
          class="login__form"
          :model="ruleForm"
          :rules="loginRules"
          label-position="top"
          size="large"
          hide-required-asterisk
          @submit.prevent="onLogin(ruleFormRef)"
        >
          <el-form-item label="企业编码" prop="tenantCode">
            <el-input
              v-model="ruleForm.tenantCode"
              placeholder="默认 default，可留空"
              clearable
              @blur="onAccountBlur"
            >
              <template #prefix>
                <AppIcon icon="ep:office-building" :size="15" />
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="账号" prop="username">
            <el-input
              v-model="ruleForm.username"
              placeholder="请输入账号"
              clearable
              @blur="onAccountBlur"
            >
              <template #prefix>
                <AppIcon icon="ep:user" :size="15" />
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="ruleForm.password"
              type="password"
              placeholder="请输入密码"
              show-password
            >
              <template #prefix>
                <AppIcon icon="ep:lock" :size="15" />
              </template>
            </el-input>
          </el-form-item>

          <!-- 验证码仅在安全策略要求时出现（失败次数达阈值或策略设为始终要求） -->
          <el-form-item v-if="captcha.required" label="验证码" prop="captchaCode">
            <div class="login__captcha">
              <el-input
                v-model="ruleForm.captchaCode"
                placeholder="请输入计算结果"
                clearable
              >
                <template #prefix>
                  <AppIcon icon="ep:key" :size="15" />
                </template>
              </el-input>
              <img
                v-if="captcha.image"
                :src="captcha.image"
                alt="图形验证码，点击重新获取"
                class="login__captcha-img"
                title="看不清？点击换一张"
                @click="refreshCaptcha(true)"
              />
              <button
                v-else
                type="button"
                class="login__captcha-get"
                @click="refreshCaptcha(true)"
              >
                获取验证码
              </button>
            </div>
          </el-form-item>

          <div v-if="lockHint" class="login__hint">
            <AppIcon icon="ep:warning-filled" :size="14" />
            {{ lockHint }}
          </div>

          <div class="login__options">
            <el-checkbox v-model="rememberPassword">记住密码</el-checkbox>
            <button
              type="button"
              class="login__link"
              @click="openInfo('forgot')"
            >
              忘记密码？
            </button>
          </div>

          <el-button
            class="login__submit"
            type="primary"
            size="large"
            :loading="loading"
            @click="onLogin(ruleFormRef)"
          >
            <span class="login__submit-inner">
              登录
              <AppIcon icon="ep:right" :size="16" />
            </span>
          </el-button>
        </el-form>

        <!-- 申请表单 -->
        <el-form
          v-else
          ref="applyFormRef"
          class="login__form"
          :model="applyForm"
          :rules="applyRules"
          label-position="top"
          hide-required-asterisk
          @submit.prevent="onApply(applyFormRef)"
        >
          <el-form-item label="邀请码" prop="inviteCode">
            <el-input
              v-model="applyForm.inviteCode"
              placeholder="请输入邀请码"
              clearable
            />
          </el-form-item>

          <div class="login__row">
            <el-form-item label="真实姓名" prop="employeeName">
              <el-input
                v-model="applyForm.employeeName"
                placeholder="请输入真实姓名"
                clearable
              />
            </el-form-item>
            <el-form-item label="性别" prop="gender">
              <el-select v-model="applyForm.gender" placeholder="请选择">
                <el-option
                  v-for="item in genderOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </div>

          <div class="login__row">
            <el-form-item label="手机号" prop="workMobile">
              <el-input
                v-model="applyForm.workMobile"
                placeholder="请输入手机号"
                clearable
              />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="applyForm.password"
                type="password"
                placeholder="请设置密码"
                show-password
              />
            </el-form-item>
          </div>

          <el-form-item label="详细地址" prop="address">
            <el-input
              v-model="applyForm.address"
              placeholder="请输入详细地址"
              clearable
            />
          </el-form-item>

          <el-button
            class="login__submit"
            type="primary"
            :loading="applyLoading"
            @click="onApply(applyFormRef)"
          >
            <span class="login__submit-inner">
              提交申请
              <AppIcon icon="ep:right" :size="16" />
            </span>
          </el-button>
        </el-form>

        <footer class="login__agreement">
          <span class="login__agreement-line" />
          <AppIcon icon="ep:lock" :size="13" />
          <span>登录即表示同意平台使用规范与信息安全要求</span>
          <span class="login__agreement-line" />
        </footer>
      </div>

      <footer class="login__links">
        <button type="button" @click="openInfo('about')">关于我们</button>
        <span>|</span>
        <button type="button" @click="openInfo('privacy')">隐私政策</button>
        <span>|</span>
        <button type="button" @click="openInfo('terms')">使用条款</button>
      </footer>
    </section>

    <el-dialog
      v-model="infoVisible"
      :title="infoTitle"
      width="540px"
      align-center
      append-to-body
    >
      <div class="login__info">
        <img
          v-if="infoType === 'about'"
          :src="capabilitiesImage"
          class="login__info-img"
          alt="平台能力"
        />

        <template v-if="infoType === 'help'">
          <p>账号由管理员在「系统管理 - 用户管理」中创建，请使用分配到的账号登录。</p>
          <ul>
            <li>登录异常时，请先确认账号状态是否为「启用」。</li>
            <li>如提示会话失效，可能是账号在其他设备登录导致。</li>
            <li>忘记密码请联系管理员重置，平台暂不提供自助找回。</li>
          </ul>
        </template>

        <template v-else-if="infoType === 'about'">
          <p>
            OA 协同办公平台面向政企与中小团队，提供审批流转、组织人事、权限管控与安全审计的一体化能力。
          </p>
          <p>
            本开源仓库为前端工程，包含界面与交互实现；后端服务需自行对接，接口契约见 README。
          </p>
        </template>

        <template v-else-if="infoType === 'privacy'">
          <p>我们仅收集维持账号登录与协同办公所必需的信息：</p>
          <ul>
            <li>账号信息：用户名、姓名、部门、联系方式。</li>
            <li>业务数据：审批表单内容、附件与审批意见。</li>
            <li>审计信息：登录 IP、浏览器类型、操作记录。</li>
          </ul>
          <p>上述信息仅用于业务流转与安全审计，不会用于其他用途。</p>
        </template>

        <template v-else-if="infoType === 'terms'">
          <p>使用本平台即表示你同意：</p>
          <ul>
            <li>妥善保管账号与密码，不转借他人使用。</li>
            <li>不利用平台上传违法违规内容。</li>
            <li>审批操作真实有效，审批意见可作为审计依据。</li>
          </ul>
        </template>

        <template v-else>
          <p>为保障账号安全，本平台暂不提供自助找回密码。</p>
          <p>请联系系统管理员，在「系统管理 - 用户管理」中为你重置密码。</p>
        </template>
      </div>

      <template #footer>
        <el-button type="primary" @click="infoVisible = false">
          我知道了
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.login {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #fff;

  /* ============ 左侧品牌区 ============ */
  &__brand {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    padding: 40px 56px 30px;
    background-color: #06173a;
    background-repeat: no-repeat;
    background-position: 76% center;
    background-size: cover;
  }

  &__brand-inner {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    max-width: 780px;
    padding: 24px 0 40px;
  }

  &__brand-logo {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: clamp(28px, 6vh, 60px);

    img {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      box-shadow: 0 8px 20px rgb(31 90 224 / 45%);
    }

    span {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: #fff;
    }
  }

  &__brand-title {
    font-size: clamp(30px, 2.8vw, 46px);
    font-weight: 700;
    line-height: 1.32;
    letter-spacing: 1px;
    color: #fff;

    span {
      color: #9cc8ff;
    }
  }

  &__brand-desc {
    max-width: 660px;
    margin-top: 18px;
    font-size: clamp(14px, 1.05vw, 17px);
    line-height: 1.75;
    color: rgb(255 255 255 / 78%);
  }

  &__features {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(20px, 2.4vw, 44px);
    max-width: 780px;
    padding: 0;
    margin: clamp(26px, 5vh, 50px) 0 0;
    list-style: none;

    li {
      display: flex;
      flex-direction: column;
    }
  }

  &__feature-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    color: #fff;
    background: rgb(255 255 255 / 10%);
    border: 1px solid rgb(255 255 255 / 22%);
    border-radius: 14px;
    backdrop-filter: blur(6px);
  }

  &__feature-title {
    margin-top: 16px;
    font-size: 17px;
    font-weight: 600;
    color: #fff;
  }

  &__feature-desc {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.85;
    color: rgb(255 255 255 / 62%);
    white-space: pre-line;
  }

  &__brand-footer {
    font-size: 12px;
    color: rgb(255 255 255 / 45%);
  }

  /* ============ 右侧登录区 ============ */
  &__panel {
    position: relative;
    display: flex;
    flex: 0 0 clamp(500px, 40vw, 680px);
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 72px 48px;
    overflow-y: auto;
    background: radial-gradient(circle at 82% -10%, #eef4ff 0%, #fff 46%);
  }

  &__topbar {
    position: absolute;
    top: 26px;
    right: 44px;
    display: flex;
    gap: 14px;
    align-items: center;
  }

  &__topbar-btn {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-size: 13px;
    color: #7b8496;
    cursor: pointer;
    background: none;
    border: 0;

    &:hover {
      color: var(--app-primary);
    }
  }

  &__topbar-divider {
    width: 1px;
    height: 14px;
    background: #e5e9f0;
  }

  &__mobile-brand {
    display: none;
    gap: 10px;
    align-items: center;
    margin-bottom: 22px;

    img {
      width: 34px;
      height: 34px;
      border-radius: 8px;
    }

    span {
      font-size: 18px;
      font-weight: 600;
      color: #1d2129;
    }
  }

  &__card {
    width: min(460px, 100%);
    padding: 36px 40px 24px;
    background: #fff;
    border: 1px solid #eef1f6;
    border-radius: 18px;
    box-shadow:
      0 22px 60px rgb(16 42 92 / 8%),
      0 2px 6px rgb(16 42 92 / 4%);
  }

  &__card-header {
    text-align: center;
  }

  &__card-title {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #1d2129;
  }

  &__card-desc {
    margin-top: 8px;
    font-size: 13px;
    color: #8a94a6;
  }

  &__tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-top: 24px;
    border-bottom: 1px solid #eef1f6;

    button {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: center;
      padding: 12px 0;
      font-size: 15px;
      color: #7b8496;
      cursor: pointer;
      background: none;
      border: 0;
      border-bottom: 2px solid transparent;
      transition:
        color var(--app-duration-fast) var(--app-ease),
        border-color var(--app-duration-fast) var(--app-ease);

      &:hover {
        color: #1d2129;
      }

      &.is-active {
        font-weight: 600;
        color: var(--app-primary);
        border-bottom-color: var(--app-primary);
      }
    }
  }

  &__form {
    padding-top: 22px;

    :deep(.el-form-item) {
      margin-bottom: 18px;
    }

    :deep(.el-form-item__label) {
      padding-bottom: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
    }

    :deep(.el-input__wrapper) {
      min-height: 46px;
      padding: 1px 14px;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 0 0 1px #e5e9f0 inset;
      transition: box-shadow var(--app-duration-fast) var(--app-ease);

      &.is-focus {
        box-shadow:
          0 0 0 1px var(--app-primary) inset,
          0 0 0 4px rgb(31 90 224 / 8%);
      }
    }

    :deep(.el-input__prefix) {
      color: #9aa4b2;
    }

    :deep(.el-select) {
      width: 100%;
    }

    :deep(.el-select__wrapper) {
      min-height: 46px;
      border-radius: 10px;
      box-shadow: 0 0 0 1px #e5e9f0 inset;
    }
  }

  &__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  &__options {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: -2px 0 18px;

    :deep(.el-checkbox__label) {
      font-size: 13px;
      color: #4e5969;
    }
  }

  &__captcha {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;

    .el-input {
      flex: 1;
    }
  }

  &__captcha-img {
    flex-shrink: 0;
    height: 40px;
    padding: 0 6px;
    cursor: pointer;
    background: #f2f5fb;
    border: 1px solid var(--app-border);
    border-radius: 6px;
  }

  // 取码失败时的兜底入口：不能让输入框孤立地停在页面上
  &__captcha-get {
    flex-shrink: 0;
    height: 40px;
    padding: 0 12px;
    font-size: 13px;
    color: var(--app-primary);
    cursor: pointer;
    background: #f2f5fb;
    border: 1px dashed var(--app-border);
    border-radius: 6px;
  }

  // 锁定提示：预留出验证码行错字（绝对定位）的高度，避免两行文字重叠
  &__hint {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 18px 0 10px;
    font-size: 12px;
    color: #b45309;
  }

  &__link {
    padding: 0;
    font-size: 13px;
    color: var(--app-primary);
    cursor: pointer;
    background: none;
    border: 0;

    &:hover {
      text-decoration: underline;
    }
  }

  &__submit {
    width: 100%;
    height: 48px;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 2px;
    border-radius: 10px;
  }

  &__submit-inner {
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }

  &__agreement {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    margin-top: 22px;
    font-size: 12px;
    color: #9aa4b2;
  }

  &__agreement-line {
    flex: 0 0 28px;
    height: 1px;
    background: #e5e9f0;
  }

  &__links {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-top: 28px;
    font-size: 13px;

    button {
      padding: 0;
      font-size: 13px;
      color: #9aa4b2;
      cursor: pointer;
      background: none;
      border: 0;

      &:hover {
        color: var(--app-primary);
      }
    }

    span {
      color: #dfe4ec;
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
    line-height: 1.85;
    color: #4e5969;

    p {
      margin: 0;
    }

    ul {
      padding-left: 18px;
      margin: 0;
    }
  }

  &__info-img {
    width: 100%;
    margin-bottom: 6px;
    border: 1px solid #eef1f6;
    border-radius: 10px;
  }
}

@media (width <= 1280px) {
  .login__brand {
    padding: 36px 40px 26px;
  }

  .login__features {
    gap: 20px;
  }
}

@media (width <= 1080px) {
  .login__brand {
    display: none;
  }

  .login__panel {
    flex: 1;
    padding: 56px 24px;
  }

  .login__mobile-brand {
    display: flex;
  }

  .login__topbar {
    top: 20px;
    right: 24px;
  }
}

@media (width <= 560px) {
  .login__panel {
    justify-content: flex-start;
    padding: 24px 16px 40px;
  }

  .login__topbar {
    position: static;
    justify-content: flex-end;
    margin-bottom: 18px;
  }

  .login__card {
    padding: 28px 20px 20px;
    border-color: transparent;
    border-radius: 14px;
    box-shadow: none;
  }

  .login__row {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .login__agreement {
    gap: 6px;
    font-size: 11px;
  }

  .login__agreement-line {
    display: none;
  }
}
</style>
