<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { myPluginsQuery, type PluginInfo } from "@/api/plugin";
import { usePermissionStore } from "@/store/modules/permission";
import { message } from "@/utils/message";

/**
 * 应用中心
 * 展示当前租户可用的应用（插件）。开通状态由平台在「插件管理」里配置，
 * 这里只读：员工据此知道哪些功能可用、哪些要找管理员开通。
 */
defineOptions({ name: "AppCenter" });

const router = useRouter();
const permissionStore = usePermissionStore();

const loading = ref(false);
const list = ref<PluginInfo[]>([]);
const tenantName = ref("");

const enabledList = computed(() => list.value.filter(item => item.enabled));
const disabledList = computed(() => list.value.filter(item => !item.enabled));

/** 在已下发的菜单树里找该应用的入口路径；找不到就不显示「进入」 */
function findEntryPath(item: PluginInfo): string {
  const wanted = (item.menuNames || "")
    .split(",")
    .map(name => name.trim())
    .filter(Boolean);
  if (wanted.length === 0) return "";

  const walk = (nodes: any[]): string => {
    for (const node of nodes || []) {
      if (wanted.includes(node?.name) && node?.path) return node.path;
      const child = walk(node?.children || []);
      if (child) return child;
    }
    return "";
  };
  return walk(permissionStore.wholeMenus as any[]);
}

function openApp(item: PluginInfo) {
  const path = findEntryPath(item);
  if (!path) {
    message("该应用没有可跳转的页面入口", { type: "warning" });
    return;
  }
  router.push(path).catch(() => {
    message("打开失败，请确认拥有对应菜单权限", { type: "error" });
  });
}

async function load() {
  loading.value = true;
  try {
    const res: any = await myPluginsQuery();
    list.value = res?.data?.list || [];
    tenantName.value = res?.data?.tenantName || "";
  } catch (error: any) {
    message(error?.message || "加载应用列表失败", { type: "error" });
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <AppPage
    title="应用中心"
    :description="
      tenantName
        ? `${tenantName} 已开通 ${enabledList.length} 个应用，共 ${list.length} 个可选`
        : '查看当前组织可用的应用'
    "
  >
    <template #actions>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </template>

    <div v-loading="loading" class="appcenter">
      <section v-if="enabledList.length" class="appcenter__section">
        <h3 class="appcenter__title">已开通</h3>
        <div class="appcenter__grid">
          <article v-for="item in enabledList" :key="item.code" class="appcard">
            <div class="appcard__head">
              <span class="appcard__icon">
                <AppIcon :icon="item.icon || 'ep:menu'" :size="20" />
              </span>
              <div class="appcard__meta">
                <div class="appcard__name">{{ item.name }}</div>
                <div class="appcard__code">{{ item.code }} · v{{ item.version }}</div>
              </div>
              <el-tag v-if="item.core" size="small" type="info" effect="plain">基础</el-tag>
            </div>
            <p class="appcard__desc">{{ item.description || "暂无说明" }}</p>
            <div class="appcard__foot">
              <span v-if="item.expireAt" class="appcard__expire">
                有效期至 {{ item.expireAt }}
              </span>
              <el-button type="primary" link @click="openApp(item)">进入</el-button>
            </div>
          </article>
        </div>
      </section>

      <section v-if="disabledList.length" class="appcenter__section">
        <h3 class="appcenter__title">未开通</h3>
        <div class="appcenter__grid">
          <article
            v-for="item in disabledList"
            :key="item.code"
            class="appcard appcard--off"
          >
            <div class="appcard__head">
              <span class="appcard__icon">
                <AppIcon :icon="item.icon || 'ep:menu'" :size="20" />
              </span>
              <div class="appcard__meta">
                <div class="appcard__name">{{ item.name }}</div>
                <div class="appcard__code">{{ item.code }} · v{{ item.version }}</div>
              </div>
            </div>
            <p class="appcard__desc">{{ item.description || "暂无说明" }}</p>
            <div class="appcard__foot">
              <el-tag size="small" type="warning" effect="plain">未开通</el-tag>
              <span class="appcard__hint">如需使用请联系管理员在「插件管理」开通</span>
            </div>
          </article>
        </div>
      </section>

      <AppEmpty v-if="!loading && list.length === 0" description="暂无可展示的应用" />
    </div>
  </AppPage>
</template>

<style lang="scss" scoped>
.appcenter {
  &__section + &__section {
    margin-top: 24px;
  }

  &__title {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--app-text-2);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }
}

.appcard {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md, 8px);

  &--off {
    background: var(--app-bg-subtle, #fafbfc);
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    color: var(--app-primary);
    background: var(--app-primary-bg, #eef3ff);
    border-radius: var(--app-radius-sm, 6px);
  }

  &__meta {
    flex: 1;
    min-width: 0;
  }

  &__name {
    overflow: hidden;
    font-size: 14px;
    font-weight: 600;
    color: var(--app-text-1);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__code {
    font-size: 12px;
    color: var(--app-text-4);
  }

  &__desc {
    display: -webkit-box;
    min-height: 36px;
    margin: 0;
    overflow: hidden;
    font-size: 12px;
    line-height: 18px;
    color: var(--app-text-3);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__expire,
  &__hint {
    font-size: 12px;
    color: var(--app-text-4);
  }
}
</style>
