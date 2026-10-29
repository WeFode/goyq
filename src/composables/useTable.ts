import { computed, reactive, ref } from "vue";

interface Pagination {
  currentPage: number;
  pageSize: number;
  total: number;
}

interface UseTableOptions<T = any> {
  /** 列表请求方法，入参为分页 + 查询条件 */
  fetcher: (params: Record<string, any>) => Promise<any>;
  /** 查询条件（响应式对象） */
  query?: Record<string, any>;
  pageSize?: number;
  /** 是否在初始化时自动加载，默认 true */
  immediate?: boolean;
  /** 自定义列表数据解析，默认取 res.data.list */
  pickList?: (res: any) => T[];
  /** 自定义总数解析，默认取 res.data.total */
  pickTotal?: (res: any) => number;
}

/**
 * 列表页通用逻辑：查询、分页、选择、刷新
 * 与旧实现保持一致：请求参数为 page / pageSize + 查询条件
 */
export function useTable<T = any>(options: UseTableOptions<T>) {
  const {
    fetcher,
    query = {},
    pageSize = 10,
    immediate = true,
    pickList = (res: any) => res?.data?.list ?? [],
    pickTotal = (res: any) => res?.data?.total ?? 0
  } = options;

  const loading = ref(false);
  const list = ref<T[]>([]);
  const pagination = reactive<Pagination>({
    currentPage: 1,
    pageSize,
    total: 0
  });
  const selectedRows = ref<T[]>([]);
  const selectedNum = computed(() => selectedRows.value.length);

  /** 按当前页码加载 */
  async function load() {
    loading.value = true;
    try {
      const res = await fetcher({
        page: pagination.currentPage,
        pageSize: pagination.pageSize,
        ...query
      });
      list.value = pickList(res);
      pagination.total = pickTotal(res);
    } catch (error) {
      console.error("加载列表失败:", error);
    } finally {
      loading.value = false;
    }
  }

  /** 条件查询：回到第一页 */
  function search() {
    pagination.currentPage = 1;
    return load();
  }

  /** 保持当前页刷新（新增/编辑/删除后调用） */
  function refresh() {
    return load();
  }

  /** 重置查询条件后重新加载 */
  function reset(defaultQuery: Record<string, any> = {}) {
    Object.keys(query).forEach(key => {
      query[key] = defaultQuery[key] ?? undefined;
    });
    return search();
  }

  function onSelectionChange(rows: T[]) {
    selectedRows.value = rows;
  }
  function clearSelection() {
    selectedRows.value = [];
  }

  /** 删除后若当前页为空则回退一页，避免停留在空白页 */
  function refreshAfterDelete() {
    const rest = pagination.total - 1;
    if (rest > 0 && (pagination.currentPage - 1) * pagination.pageSize >= rest) {
      pagination.currentPage = Math.max(1, pagination.currentPage - 1);
    }
    return load();
  }

  if (immediate) load();

  return {
    loading,
    list,
    pagination,
    query,
    selectedRows,
    selectedNum,
    load,
    search,
    refresh,
    reset,
    refreshAfterDelete,
    onSelectionChange,
    clearSelection
  };
}
