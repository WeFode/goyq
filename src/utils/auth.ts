import Cookies from "js-cookie";
import { useUserStoreHook } from "@/store/modules/user";
import { storageLocal } from "./storage";
import { isString, isIncludeAllChildren } from "./helpers";
import { UserInfo } from "@/api/user";

export interface DataInfo<T> {
  /** token */
  accessToken: string;
  /** `accessToken`的过期时间（时间戳） */
  expireAt: T;
  /** 用于调用刷新accessToken的接口时所需的token */
  refreshToken: string;
  /** 用户信息 */
  user: UserInfo;
}

export const userKey = "user-info";
export const TokenKey = "authorized-token";
/**
 * 通过`multiple-tabs`是否在`cookie`中，判断用户是否已经登录系统，
 * 从而支持多标签页打开已经登录的系统后无需再登录。
 * 浏览器完全关闭后`multiple-tabs`将自动从`cookie`中销毁，
 * 再次打开浏览器需要重新登录系统
 * */
export const multipleTabsKey = "multiple-tabs";

/** 获取`token` */
export function getToken(): DataInfo<any> {
  // 此处与`TokenKey`相同，此写法解决初始化时`Cookies`中不存在`TokenKey`报错
  return Cookies.get(TokenKey)
    ? JSON.parse(Cookies.get(TokenKey))
    : storageLocal().getItem(userKey);
}

/**
 * @description 设置`token`以及一些必要信息并采用无感刷新`token`方案
 * 无感刷新：后端返回`accessToken`（访问接口使用的`token`）、`refreshToken`（用于调用刷新`accessToken`的接口时所需的`token`，`refreshToken`的过期时间（比如30天）应大于`accessToken`的过期时间（比如2小时））、`expires`（`accessToken`的过期时间）
 * 将`accessToken`、`expires`、`refreshToken`这三条信息放在key值为authorized-token的cookie里（过期自动销毁）
 * 将`avatar`、`username`、`nickname`、`roles`、`permissions`、`refreshToken`、`expires`这七条信息放在key值为`user-info`的localStorage里（利用`multipleTabsKey`当浏览器完全关闭后自动销毁）
 */
export function setToken(data: {
  user: UserInfo;
  accessToken: string;
  refreshToken: string;
  expireAt: string;
}) {
  const { accessToken, refreshToken, user, expireAt } = data;
  const expires = new Date(expireAt).getTime();
  const { isRemembered, loginDay } = useUserStoreHook();

  const cookieString = JSON.stringify({ accessToken, expires, refreshToken });

  expires > 0
    ? Cookies.set(TokenKey, cookieString, {
        expires: (expires - Date.now()) / 86400000
      })
    : Cookies.set(TokenKey, cookieString);

  Cookies.set(
    multipleTabsKey,
    "true",
    isRemembered
      ? {
          expires: loginDay
        }
      : {}
  );

  useUserStoreHook().SET_ID(user.id);
  useUserStoreHook().SET_AVATAR(user.avatar);
  useUserStoreHook().SET_USERNAME(user.username);
  useUserStoreHook().SET_NICKNAME(user.nickname);
  useUserStoreHook().SET_EMPLOYEE_ID(user.employeeId);
  useUserStoreHook().SET_DEPARTMENTS(user.departments);

  storageLocal().setItem(userKey, {
    id: user.id,
    refreshToken,
    expires,
    avatar: user.avatar,
    username: user.username,
    nickname: user.nickname,
    employeeId: user.employeeId,
    departments: user.departments
  });
}

/** 删除`token`以及key值为`user-info`的localStorage信息 */
export function removeToken() {
  Cookies.remove(TokenKey);
  Cookies.remove(multipleTabsKey);
  storageLocal().removeItem(userKey);
}

/** 格式化token（jwt格式） */
export const formatToken = (token: string): string => {
  return "Bearer " + token;
};

/** 是否有按钮级别的权限（根据登录接口返回的`permissions`字段进行判断）*/
export const hasPerms = (value: string | Array<string>): boolean => {
  if (!value) return false;
  const allPerms = "*:*:*";
  const { userPermissions } = useUserStoreHook();
  if (!userPermissions || userPermissions.length === 0) return false;
  
  // 检查是否有万能权限
  const hasAllPerms = userPermissions.some(perm => perm.permission_code === allPerms);
  if (hasAllPerms) return true;
  
  // 提取权限代码数组
  const permissionCodes = userPermissions.map(perm => perm.permission_code);
  
  const isAuths = isString(value)
    ? permissionCodes.includes(value)
    : isIncludeAllChildren(value, permissionCodes);
  return isAuths ? true : false;
};
