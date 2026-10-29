import { defineStore } from "pinia";
import { type userType } from "../types";
import { store } from "@/store";
import { router, resetRouter } from "@/router";
import { routerArrays } from "@/layout/types";
import { storageLocal } from "@/utils/storage";
import {
  type LoginResult,
  type RefreshTokenResult,
  getLogin,
  logoutSession,
  refreshTokenApi
} from "@/api/user";
import { useMultiTagsStoreHook } from "./multiTags";
import { type DataInfo, setToken, removeToken, userKey } from "@/utils/auth";
import { getUserPermissionList } from "@/api/permission";

export const useUserStore = defineStore({
  id: "user",
  state: (): userType => ({
    // 用户ID
    id: storageLocal().getItem<any>(userKey)?.id ?? 0,
    // 头像
    avatar: storageLocal().getItem<any>(userKey)?.avatar ?? "",
    // 用户名
    username: storageLocal().getItem<any>(userKey)?.username ?? "",
    // 昵称
    nickname: storageLocal().getItem<any>(userKey)?.nickname ?? "",
    // 员工ID
    employeeId: storageLocal().getItem<any>(userKey)?.employeeId ?? "",
    // 页面级别权限
    roles: storageLocal().getItem<any>(userKey)?.roles ?? [],
    // 按钮级别权限
    permissions:
      storageLocal().getItem<any>(userKey)?.permissions ?? [],
    // 用户权限列表（新增）
    userPermissions: storageLocal().getItem<any>(userKey)?.userPermissions ?? [],
    // 部门列表
    departments: storageLocal().getItem<any>(userKey)?.departments ?? [],
    // 是否勾选了登录页的免登录
    isRemembered: false,
    // 登录页的免登录存储几天，默认7天
    loginDay: 7
  }),
  actions: {
    /** 存储用户ID */
    SET_ID(id: string) {
      this.id = id;
    },
    /** 存储头像 */
    SET_AVATAR(avatar: string) {
      this.avatar = avatar;
    },
    /** 存储用户名 */
    SET_USERNAME(username: string) {
      this.username = username;
    },
    /** 存储昵称 */
    SET_NICKNAME(nickname: string) {
      this.nickname = nickname;
    },
    /** 存储员工ID */
    SET_EMPLOYEE_ID(employeeId: string) {
      this.employeeId = employeeId;
    },
    /** 存储角色 */
    SET_ROLES(roles: Array<string>) {
      this.roles = roles;
    },
    /** 存储按钮级别权限 */
    SET_PERMS(permissions: Array<string>) {
      this.permissions = permissions;
    },
    /** 存储用户权限列表 */
    SET_USER_PERMISSIONS(userPermissions: Array<any>) {
      this.userPermissions = userPermissions;
    },
    /** 存储部门列表 */
    SET_DEPARTMENTS(departments: Array<any>) {
      this.departments = departments;
    },
    /** 存储是否勾选了登录页的免登录 */
    SET_ISREMEMBERED(bool: boolean) {
      this.isRemembered = bool;
    },
    /** 设置登录页的免登录存储几天 */
    SET_LOGINDAY(value: number) {
      this.loginDay = Number(value);
    },
    /** 登入 */
    async loginByUsername(data) {
      return new Promise<LoginResult>((resolve, reject) => {
        getLogin(data)
          .then(data => {
            if (data.success) {
              setToken(data.data);
              resolve(data);
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /** 登出（先作废服务端会话；401 场景传 skipServer 避免循环请求） */
    async logOut(options?: { skipServer?: boolean }) {
      if (!options?.skipServer) {
        try {
          await logoutSession();
        } catch (error) {
          // 会话可能已失效，继续清理本地状态
          console.warn("服务端退出登录失败，继续本地退出", error);
        }
      }
      this.username = "";
      this.roles = [];
      this.permissions = [];
      this.userPermissions = [];
      removeToken();
      useMultiTagsStoreHook().handleTags("equal", [...routerArrays]);
      resetRouter();
      router.push("/login");
      // 刷新浏览器
      window.location.reload();
    },
    /** 刷新`token` */
    async handRefreshToken(data) {
      return new Promise<RefreshTokenResult>((resolve, reject) => {
        refreshTokenApi(data)
          .then((data:any) => {
            if (data) {
              setToken(data.data);
              resolve(data);
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /** 获取用户权限列表 */
    async getUserPermissions() {
      return new Promise<any>((resolve, reject) => {
        getUserPermissionList()
          .then((data: any) => {
            if (data && data.success) {
              this.SET_USER_PERMISSIONS(data.data.permissions || []);
              resolve(data);
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    }
  }
});

export function useUserStoreHook() {
  return useUserStore(store);
}
