import { computed } from "vue";
import { hasAuth, getAuths } from "@/router/utils";
import { useUserStoreHook } from "@/store/modules/user";

/**
 * 按钮级权限
 * 用法：const { can } = usePermission(); can("sys:user:add")
 */
export function usePermission() {
  const userStore = useUserStoreHook();

  /** 判断是否拥有权限（字符串或数组，数组需全部满足） */
  const can = (value: string | Array<string>) => hasAuth(value);

  /** 当前用户全部权限码 */
  const authList = computed(() => getAuths());

  /** 角色列表 */
  const roles = computed(() => userStore.roles ?? []);

  /** 是否超管（权限码包含 *:*:*） */
  const isSuperAdmin = computed(() =>
    (userStore.userPermissions ?? []).some(
      (item: any) => item.permission_code === "*:*:*"
    )
  );

  return { can, authList, roles, isSuperAdmin };
}
