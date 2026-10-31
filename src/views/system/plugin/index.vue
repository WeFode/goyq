<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  pluginListQuery,
  setPluginConfig,
  setPluginStatus,
  type PluginInfo
} from "@/api/plugin";
import { tenantListQuery, type TenantInfo } from "@/api/tenant";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";

/**
 * 插件管理（平台运营）
 * 一个应用的可用性由三处同时生效：菜单是否下发、接口闸门、应用中心展示，
 * 三处都读同一份「注册表 × 租户开通记录」的结果，所以这里只需改一个开关。
 */
defineOptions({ name: "SystemPlugin" });

const loading = ref(false);
const list = ref<PluginInfo[]>([]);
const tenants = ref<TenantInfo[]>([]);
const query = reactive({ tenantId: "", keyword: "" });

/** 租户下拉的分页拉取参数（对齐后端 pageSize 上限 100） */
const TENANT_PAGE_SIZE = 100;
const TENANT_MAX_PAGES = 10;

/** 只有平台管理员能配置别的租户 */
const canManage = computed(() => hasAuth("sys:plugin:enable"));

async function load() {
  loading.value = true;
  try {
    const res: any = await pluginListQuery({
      tenantId: query.tenantId || undefined,
      keyword: query.keyword || undefined
    });
    list.value = res?.data?.list || [];
  } catch (error: any) {
    message(error?.message || "加载应用目录失败", { type: "error" });
  } finally {
    loading.value = false;
  }
}

/**
 * 拉全部租户供下拉选择。
 * 后端 `/sys/tenant/list` 的 pageSize 上限是 100（传 200 会直接被判无效并静默返回空列表），
 * 所以逐页拉取而不是 once 大页；上限 10 页防止失控。
 */
async function loadTenants() {
  try {
    const collected: TenantInfo[] = [];
    let page = 1;
    let total = 0;
    do {
      const res: any = await tenantListQuery({ page, pageSize: TENANT_PAGE_SIZE });
      const rows: TenantInfo[] = res?.data?.list || [];
      collected.push(...rows);
      total = res?.data?.total ?? collected.length;
      page += 1;
    } while (collected.length < total && page <= TENANT_MAX_PAGES);
    tenants.value = collected;
  } catch {
    // 非平台管理员拿不到租户列表：此时只配置当前租户，静默降级
    tenants.value = [];
  }
}

async function toggle(item: PluginInfo, status: boolean) {
  const previous = item.enabled;
  item.enabled = status;
  try {
    await setPluginStatus({
      code: item.code,
      tenantId: query.tenantId || undefined,
      status,
      remark: status ? "" : "平台运营停用"
    });
    // 接口闸门是立即生效的，但菜单在登录时拉取，因而不刷新页面看上去“还在”：
    // 提示里必须说清这一点，否则运营会以为开关没用
    message(
      status
        ? `已开通「${item.name}」，接口立即可用；成员重新进入系统后即可看到入口`
        : `已停用「${item.name}」，接口立即拒绝访问；已登录成员的菜单在下次进入系统时移除`,
      { type: "success" }
    );
  } catch (error: any) {
    item.enabled = previous;
    message(error?.message || "操作失败", { type: "error" });
  }
}

// ---------- 应用配置 ----------
const configVisible = ref(false);
const configSaving = ref(false);
const configForm = reactive({ code: "", name: "", configJson: "" });

function openConfig(item: PluginInfo) {
  configForm.code = item.code;
  configForm.name = item.name;
  configForm.configJson = item.configJson || "";
  configVisible.value = true;
}

async function saveConfig() {
  const value = configForm.configJson.trim();
  if (value) {
    try {
      JSON.parse(value);
    } catch {
      message("配置必须是合法 JSON", { type: "warning" });
      return;
    }
  }
  configSaving.value = true;
  try {
    await setPluginConfig({
      code: configForm.code,
      tenantId: query.tenantId || undefined,
      configJson: value
    });
    message("配置已保存", { type: "success" });
    configVisible.value = false;
    load();
  } catch (error: any) {
    message(error?.message || "保存配置失败", { type: "error" });
  } finally {
    configSaving.value = false;
  }
}

onMounted(() => {
  loadTenants();
  load();
});
</script>

<template>
  <AppPage
    title="插件管理"
    description="管理平台应用目录与各租户的开通状态；停用后该应用的菜单不再下发，接口也会直接拒绝"
  >
    <template #actions>
      <el-select
        v-model="query.tenantId"
        clearable
        placeholder="全部租户（默认当前）"
        style="width: 220px"
        @change="load"
      >
        <el-option
          v-for="item in tenants"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
      <el-input
        v-model="query.keyword"
        clearable
        placeholder="搜索应用名称或编码"
        style="width: 200px"
        @keyup.enter="load"
      />
      <el-button type="primary" @click="load">查询</el-button>
    </template>

    <el-alert
      class="plugin__tip"
      type="info"
      show-icon
      :closable="false"
      title="应用清单来自代码注册表，新增应用包后会自动出现在这里；核心应用（组织、审批、系统管理）不可停用。"
    />

    <AppDataTable
      :data="list"
      :loading="loading"
      row-key="code"
      :show-pagination="false"
      empty-text="暂无应用（确认后端已启动并同步应用目录）"
    >
      <el-table-column label="应用" min-width="220">
        <template #default="{ row }">
          <div class="plugin__app">
            <span class="plugin__app-icon">
              <AppIcon :icon="row.icon || 'ep:menu'" :size="18" />
            </span>
            <div>
              <div class="plugin__app-name">{{ row.name }}</div>
              <div class="plugin__app-code">{{ row.code }} · v{{ row.version }}</div>
            </div>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="类型" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.core" size="small" type="info" effect="plain">基础</el-tag>
          <el-tag v-else size="small" type="primary" effect="plain">可插拔</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="说明" min-width="240">
        <template #default="{ row }">
          <span class="plugin__desc">{{ row.description || "暂无说明" }}</span>
        </template>
      </el-table-column>

      <el-table-column label="归属菜单" min-width="180">
        <template #default="{ row }">
          <span class="plugin__mono">{{ row.menuNames || "-" }}</span>
        </template>
      </el-table-column>

      <el-table-column label="接口前缀" min-width="180">
        <template #default="{ row }">
          <span class="plugin__mono">{{ row.pathPrefixes || "-" }}</span>
        </template>
      </el-table-column>

      <el-table-column label="配置" width="80" align="center">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            :disabled="!hasAuth('sys:plugin:config')"
            @click="openConfig(row)"
          >
            {{ row.configJson ? "已配置" : "配置" }}
          </el-button>
        </template>
      </el-table-column>

      <el-table-column label="开通" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-tooltip
            :disabled="!row.core"
            content="核心应用不可停用"
            placement="top"
          >
            <el-switch
              v-model="row.enabled"
              :disabled="row.core || !canManage"
              @change="(value: boolean) => toggle(row, value)"
            />
          </el-tooltip>
        </template>
      </el-table-column>
    </AppDataTable>

    <AppFormDrawer
      v-model="configVisible"
      title="应用配置"
      size="560px"
      :loading="configSaving"
      @confirm="saveConfig"
    >
      <el-form label-position="top">
        <el-form-item label="配置内容（JSON）">
          <el-input
            v-model="configForm.configJson"
            type="textarea"
            :rows="12"
            placeholder='例如 {"redHeadTemplate": "default"}'
          />
          <div class="plugin__form-tip">
            为「{{ configForm.name }}」保存应用级参数，由应用包自行读取；
            这样新增应用的能力开关时不必再改系统参数表结构。
          </div>
        </el-form-item>
      </el-form>
    </AppFormDrawer>
  </AppPage>
</template>

<style lang="scss" scoped>
.plugin {
  &__tip {
    margin-bottom: 4px;
  }

  &__app {
    display: flex;
    gap: 10px;
    align-items: center;

    &-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      color: var(--app-primary);
      background: var(--app-primary-bg, #eef3ff);
      border-radius: var(--app-radius-sm, 6px);
    }

    &-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--app-text-1);
    }

    &-code {
      font-size: 12px;
      color: var(--app-text-4);
    }
  }

  &__desc {
    font-size: 12px;
    color: var(--app-text-3);
  }

  &__mono {
    font-family: Consolas, "JetBrains Mono", monospace;
    font-size: 12px;
    color: var(--app-text-3);
  }

  &__form-tip {
    margin-top: 8px;
    font-size: 12px;
    line-height: 18px;
    color: var(--app-text-4);
  }
}
</style>
