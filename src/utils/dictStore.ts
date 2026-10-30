import { ref } from "vue";
import { dictOptionsQuery, type DictItem } from "@/api/dict";

/**
 * 远程字典缓存
 *
 * 说明：`utils/dicts.ts` 内置的系统枚举（流程状态、审批动作等）是引擎常量，
 * 直接映射为中文，保证页面在接口异常时也能正确渲染；
 * 这里的远程字典用于「业务字典」（请假类型、单据类别等），
 * 在组件内通过 useDict('hr_leave_type') 取用。
 */
const cache = new Map<string, DictItem[]>();
const inflight = new Map<string, Promise<void>>();

/** 拉取缺失的字典（同一批编码并发合并） */
async function fetchDicts(codes: string[]): Promise<void> {
  const missing = codes.filter(code => !cache.has(code));
  if (!missing.length) return;

  const key = missing.slice().sort().join(",");
  const running = inflight.get(key);
  if (running) return running;

  const task = (async () => {
    try {
      const res = await dictOptionsQuery(key);
      const dicts: Record<string, DictItem[]> = res?.data?.dicts ?? {};
      missing.forEach(code => cache.set(code, dicts[code] ?? []));
    } catch (error) {
      // 接口异常时写入空数组，避免每次渲染都重复请求
      console.error("加载远程字典失败:", key, error);
      missing.forEach(code => cache.set(code, []));
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

/** 主动清空缓存（字典管理页保存后调用） */
export function clearDictCache(...codes: string[]) {
  if (!codes.length) {
    cache.clear();
    return;
  }
  codes.forEach(code => cache.delete(code));
}

/**
 * 在组件内使用字典
 *
 * @example
 * const { options, label } = useDict("hr_leave_type");
 * options("hr_leave_type") // [{ itemValue, itemLabel, tone }]
 */
export function useDict(...codes: string[]) {
  const items = ref<Record<string, DictItem[]>>({});
  const loading = ref(false);

  async function load(force = false) {
    if (force) clearDictCache(...codes);
    loading.value = true;
    try {
      await fetchDicts(codes);
    } finally {
      const next: Record<string, DictItem[]> = {};
      codes.forEach(code => (next[code] = cache.get(code) ?? []));
      items.value = next;
      loading.value = false;
    }
  }

  function options(code: string): DictItem[] {
    return items.value[code] ?? [];
  }

  /** 取值对应的中文标签，未命中返回 fallback */
  function label(code: string, value: unknown, fallback = "-"): string {
    if (value === null || value === undefined || value === "") return fallback;
    const hit = options(code).find(item => item.itemValue === String(value));
    return hit?.itemLabel ?? fallback;
  }

  /** 取值对应的色调，未命中返回 info */
  function tone(code: string, value: unknown): string {
    const hit = options(code).find(item => item.itemValue === String(value));
    return hit?.tone ?? "info";
  }

  // setup 阶段立即加载，页面首帧后再补齐
  load();

  return { items, loading, load, options, label, tone };
}
