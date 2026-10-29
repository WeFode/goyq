import Axios, {
  type AxiosError,
  type AxiosResponse,
  type AxiosInstance,
  type AxiosRequestConfig,
  type CustomParamsSerializer
} from "axios";
import type {
  RequestMethods,
  AppHttpRequestConfig,
  AppHttpResponse
} from "./types.d";
import { stringify } from "qs";
import NProgress from "../progress";
import { getToken, formatToken } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";
import { message } from "../message";
import router from "@/router";

interface ResponseData<T = any> {
  code: number;
  message: string;
  data: T;
  errorCode?: string;
}

// 扩展 AxiosResponse 类型
interface CustomResponse<T = any> extends AxiosResponse {
  data: ResponseData<T>;
}

// 相关配置请参考：www.axios-js.com/zh-cn/docs/#axios-request-config-1
const defaultConfig: AxiosRequestConfig = {
  // 基础URL
  baseURL: "/api/v1",
  // 请求超时时间
  timeout: 10000,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  },
  // 数组格式参数序列化（https://github.com/axios/axios/issues/5142）
  paramsSerializer: {
    serialize: stringify as unknown as CustomParamsSerializer
  },
  // 跨域请求时是否需要使用凭证
  withCredentials: true
};

/** 业务错误码：命中后统一提示并 reject，交由调用方 catch */
const BIZ_ERROR_CODES = [50, 51, 52, 53, 54];

class AppHttp {
  constructor() {
    this.httpInterceptorsRequest();
    this.httpInterceptorsResponse();
  }

  /** `token`过期后，暂存待执行的请求 */
  private static requests = [];

  /** 防止重复刷新`token` */
  private static isRefreshing = false;

  /** 初始化配置对象 */
  private static initConfig: AppHttpRequestConfig = {};

  /** 保存当前`Axios`实例对象 */
  private static axiosInstance: AxiosInstance = Axios.create(defaultConfig);

  /** 重连原始请求 */
  private static retryOriginalRequest(config: AppHttpRequestConfig) {
    return new Promise(resolve => {
      AppHttp.requests.push((token: string) => {
        config.headers["Authorization"] = formatToken(token);
        resolve(config);
      });
    });
  }

  /** 请求拦截 */
  private httpInterceptorsRequest(): void {
    AppHttp.axiosInstance.interceptors.request.use(
      async (config: AppHttpRequestConfig): Promise<any> => {
        // 开启进度条动画
        NProgress.start();
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof config.beforeRequestCallback === "function") {
          config.beforeRequestCallback(config);
          return config;
        }
        if (AppHttp.initConfig.beforeRequestCallback) {
          AppHttp.initConfig.beforeRequestCallback(config);
          return config;
        }
        /** 请求白名单，放置一些不需要`token`的接口（仅限登录/刷新，避免误伤 /logs/login 等业务接口） */
        const whiteList = ["/auth/login", "/auth/refresh-token"];
        return whiteList.includes((config.url || "").split("?")[0])
          ? config
          : new Promise(resolve => {
              const data = getToken();
              if (data) {
                const now = new Date().getTime();
                // cookie/本地存储中为 `expires` 时间戳；缺失时不判定为过期
                const expires = Number((data as any).expires ?? 0);
                const expired = expires > 0 && expires - now <= 0;
                if (expired) {
                  if (!AppHttp.isRefreshing) {
                    AppHttp.isRefreshing = true;
                    // token过期刷新
                    useUserStoreHook()
                      .handRefreshToken({ refreshToken: data.refreshToken })
                      .then(res => {
                        const token = res.data.accessToken;
                        config.headers["Authorization"] = formatToken(token);
                        AppHttp.requests.forEach(cb => cb(token));
                        AppHttp.requests = [];
                      })
                      .finally(() => {
                        AppHttp.isRefreshing = false;
                      });
                  }
                  resolve(AppHttp.retryOriginalRequest(config));
                } else {
                  config.headers["Authorization"] = formatToken(
                    data.accessToken
                  );
                  resolve(config);
                }
              } else {
                resolve(config);
              }
            });
      },
      error => {
        return Promise.reject(error);
      }
    );
  }

  /** 响应拦截 */
  private httpInterceptorsResponse(): void {
    const instance = AppHttp.axiosInstance;
    instance.interceptors.response.use(
      (response: any): any => {
        // 关闭进度条动画
        NProgress.done();

        // 处理业务状态码
        const { message: msg, data, code } = response.data;

        if (response.status === 200 && !BIZ_ERROR_CODES.includes(code)) {
          return {
            code,
            success: true,
            message: msg,
            data
          };
        }

        if (response.status === 200 && BIZ_ERROR_CODES.includes(code)) {
          // 业务错误：提示后抛出异常，让调用方的 catch 块能够捕获
          message(msg || "操作失败", { type: "error" });
          return Promise.reject({
            code: 500,
            success: false,
            message: msg,
            data: null
          });
        }

        // 统一处理其他业务错误，抛出异常
        message(msg || "操作失败", { type: "error" });
        return Promise.reject({
          code: response.status,
          success: false,
          message: msg,
          data: null
        });
      },
      (error: AxiosError<ResponseData>): any => {
        const $error = error;
        // 关闭进度条动画
        NProgress.done();

        const response = error.response as AxiosResponse<ResponseData>;

        // 处理 HTTP 错误
        if (response) {
          switch (response.status) {
            case 401:
              message(
                response.data?.errorCode === "session_replaced"
                  ? response.data?.message || "账号已在其他设备登录，请重新登录"
                  : response.data?.message || "登录已过期，请重新登录",
                { type: "error" }
              );
              // 会话已失效，仅清理本地，避免再次请求 logout 形成循环
              useUserStoreHook().logOut({ skipServer: true });
              break;
            case 403:
              message(response.data?.message || "没有权限访问", {
                type: "error"
              });
              break;
            case 404:
              message(response.data?.message || "请求的资源不存在", {
                type: "error"
              });
              break;
            case 500:
              message(response.data?.message || "服务器错误", {
                type: "error"
              });
              break;
            default:
              message(response.data?.message || "请求失败", {
                type: "error"
              });
          }
        } else if (error.request) {
          // 请求已发出但未收到响应
          message("网络连接失败", { type: "error" });
        } else {
          // 请求配置发生错误
          message(error.message || "请求错误", { type: "error" });
        }

        return Promise.reject($error);
      }
    );
  }

  /** 通用请求工具函数 */
  public request<T>(
    method: RequestMethods,
    url: string,
    param?: AxiosRequestConfig,
    axiosConfig?: AppHttpRequestConfig
  ): Promise<T> {
    const config = {
      method,
      url,
      ...param,
      ...axiosConfig
    } as AppHttpRequestConfig;

    // 单独处理自定义请求/响应回调
    return new Promise((resolve, reject) => {
      AppHttp.axiosInstance
        .request(config)
        .then((response: undefined) => {
          resolve(response);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  /** 单独抽离的`post`工具函数 */
  public post<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: AppHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("post", url, params, config);
  }

  /** 单独抽离的`get`工具函数 */
  public get<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: AppHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("get", url, params, config);
  }
}

export const http = new AppHttp();
