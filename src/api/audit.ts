import { http } from "@/utils/http";

/** 单张审计表的哈希链校验结果 */
export interface LogChainStatus {
  /** 日志表名 */
  table: string;
  /** 日志中文名 */
  label: string;
  /** 本次校验条数 */
  checked: number;
  /** 启用哈希链前写入、不参与判定的条数 */
  legacy: number;
  ok: boolean;
  /** 断点记录ID */
  breakId: number;
  reason: string;
}

export interface VerifyChainResult {
  /** 全部通过才为 true */
  ok: boolean;
  items: LogChainStatus[];
  /** 给审计人员看的结论 */
  message: string;
}

/**
 * 审计完整性校验：由后端重算哈希链，发现记录被改写、插入或删除。
 * 需要 sys:log:verify 权限（三员管理下由安全审计员持有）。
 */
export const verifyLogChain = (data?: {
  type?: "login" | "operation" | "all";
  limit?: number;
}) => {
  return http.request<any>("post", "/sys/log/verify", {
    data: { type: "all", ...(data || {}) }
  });
};
