<script setup lang="ts">
import { ref } from "vue";
import { verifyLogChain, type LogChainStatus } from "@/api/audit";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";

/**
 * 审计完整性校验按钮
 * 由后端重算哈希链，前端只展示结论：链路完整 / 第 N 条不符（并说明疑似原因）。
 * 没有 sys:log:verify 权限时不渲染，三员管理下这个入口只属于安全审计员。
 */
interface Props {
  /** 校验范围：当前页对应的日志类型 */
  type: "login" | "operation" | "all";
  /** 只校验最近 N 条，0 表示全量 */
  limit?: number;
}

const props = withDefaults(defineProps<Props>(), { limit: 0 });

const verifying = ref(false);
const visible = ref(false);
const ok = ref(true);
const summary = ref("");
const items = ref<LogChainStatus[]>([]);

async function handleVerify() {
  verifying.value = true;
  try {
    const res: any = await verifyLogChain({
      type: props.type,
      limit: props.limit || undefined
    });
    const data = res?.data || {};
    ok.value = !!data.ok;
    summary.value = data.message || "";
    items.value = data.items || [];
    visible.value = true;
  } catch (error: any) {
    message(error?.message || "校验失败", { type: "error" });
  } finally {
    verifying.value = false;
  }
}
</script>

<template>
  <el-button
    v-if="hasAuth('sys:log:verify')"
    :loading="verifying"
    @click="handleVerify"
  >
    <AppIcon icon="ep:circle-check" :size="14" />
    完整性校验
  </el-button>

  <el-dialog v-model="visible" title="审计日志完整性校验" width="560px">
    <el-alert
      :type="ok ? 'success' : 'error'"
      :closable="false"
      show-icon
      :title="ok ? '链路完整，未发现篡改痕迹' : '校验不通过，存在被改写或增删的痕迹'"
      :description="summary"
    />

    <div v-if="items.length" class="audit__items">
      <div v-for="item in items" :key="item.table" class="audit__item">
        <div class="audit__item-head">
          <span class="audit__item-name">{{ item.label }}</span>
          <el-tag :type="item.ok ? 'success' : 'danger'" size="small" effect="plain">
            {{ item.ok ? "完整" : "异常" }}
          </el-tag>
        </div>
        <div class="audit__item-meta">
          校验 {{ item.checked }} 条
          <template v-if="item.legacy">
            · 其中 {{ item.legacy }} 条为启用哈希链前的历史记录</template
          >
          <template v-if="!item.ok">
            · 断点记录 ID {{ item.breakId }}：{{ item.reason }}</template
          >
        </div>
      </div>
    </div>

    <p class="audit__tip">
      哈希链由后端在写入日志时逐条串接，算法可通过系统参数
      <code>security.audit.algorithm</code> 切换（当前支持 sha256，国密为信创预留位）。
    </p>

    <template #footer>
      <el-button type="primary" @click="visible = false">知道了</el-button>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
.audit {
  &__items {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 14px;
  }

  &__item {
    padding: 10px 12px;
    background: var(--app-bg-subtle, #fafbfc);
    border: 1px solid var(--app-border);
    border-radius: 6px;

    &-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    &-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--app-text-1);
    }

    &-meta {
      margin-top: 4px;
      font-size: 12px;
      line-height: 18px;
      color: var(--app-text-3);
    }
  }

  &__tip {
    margin: 14px 0 0;
    font-size: 12px;
    line-height: 18px;
    color: var(--app-text-4);

    code {
      padding: 1px 4px;
      font-family: Consolas, "JetBrains Mono", monospace;
      background: #f2f3f5;
      border-radius: 3px;
    }
  }
}
</style>
