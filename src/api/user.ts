import { http } from "@/utils/http";

export interface UserInfo {
  /** 用户ID */
  id: string;
  /** 头像 */
  avatar: string;
  /** 用户名 */
  username: string;
  /** 员工ID */
  employeeId: string;
  /** 昵称 */
  nickname: string;
  departments: any[];
  /** 是否是超管 */
  is_super: boolean;
  /** 状态 */
  status: number;
}

export type LoginResult = {
  success: boolean;
  data: {
    user: UserInfo;
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expireAt: string;
    /** 登录会话ID（同账号并发设备控制） */
    sessionId?: string;
    /** 密码已过期或从未修改：前端需引导去改密 */
    mustChangePassword?: boolean;
    /** 密码是否已过期 */
    pwdExpired?: boolean;
    /** 密码剩余有效天数，0 表示不过期 */
    pwdExpireDays?: number;
  };
};

/** 登录验证码：是否需要填写由后端安全策略决定，前端不自行判断 */
export interface CaptchaResult {
  required: boolean;
  captchaId: string;
  /** SVG data URI，可直接用于 img.src */
  image: string;
  expireAt: string;
  /** 账号锁定剩余秒数 */
  lockRemainSeconds: number;
  /** 当前连续失败次数 */
  failCount: number;
}

/** 获取登录验证码（免鉴权） */
export const getCaptcha = (params?: {
  username?: string;
  tenantCode?: string;
}) => {
  return http.request<any>("get", "/auth/captcha", { params });
};

export type RefreshTokenResult = {
  success: boolean;
  data: {
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expireAt: string;
  };
};

/** 登录 */
export const getLogin = (data?: object) => {
  return http.request<LoginResult>("post", "/auth/login", {
    data: {
      platform: "web",
      ...(data || {})
    }
  });
};

/** 退出登录（作废当前服务端会话） */
export const logoutSession = () => {
  return http.request<any>("post", "/auth/logout");
};

/** 刷新`token` */
export const refreshTokenApi = (data?: object) => {
  return http.request<RefreshTokenResult>("post", "/auth/refresh-token", {
    data
  });
};

export const userListQuery = (params?: object) => {
  return http.get("/sys/user/list", { params });
};

export const addUser = (data?: object) => {
  return http.request<any>("post", "/sys/user", { data });
};

export const updateUser = (data?: any) => {
  return http.request<any>("put", `/sys/user/${data.id}`, { data });
};

export const deleteUser = (id: string) => {
  return http.request<any>("delete", `/sys/user/${id}`);
};

export const updateUserPassword = (id: string, password: string) => {
  return http.request<any>("put", `/sys/user/${id}/reset-password`, {
    data: { new_password: password }
  });
};

export const assignRoles = (userId: string, roleIds: string[]) => {
  return http.request<any>("post", `/sys/user/${userId}/roles`, {
    data: { roleIds }
  });
};

export function getUserSelector(params: any) {
  return http.request<any>("get", "/users/selector", { params });
}

/**
 * 用户使用邀请码注册
 * @param data invitationCode 邀请码
 * @param data mobile 手机号
 * @param data address 家庭地址
 * @param data nickname 真实姓名
 * @param data gender 性别
 * @returns 
 */
export const registerByInvitation = (data?: object) => {
  return http.request<any>("post", "/auth/register-by-invitation", { data });
};