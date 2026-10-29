import type {
  Method,
  AxiosError,
  AxiosResponse,
  AxiosRequestConfig
} from "axios";

export type resultType = {
  accessToken?: string;
};

export type RequestMethods = Extract<
  Method,
  "get" | "post" | "put" | "delete" | "patch" | "option" | "head"
>;

export interface AppHttpError extends AxiosError {
  isCancelRequest?: boolean;
}

export interface AppHttpResponse extends AxiosResponse {
  config: AppHttpRequestConfig;
}

export interface AppHttpRequestConfig extends AxiosRequestConfig {
  beforeRequestCallback?: (request: AppHttpRequestConfig) => void;
  beforeResponseCallback?: (response: AppHttpResponse) => void;
}

export type RequestConfig = AppHttpRequestConfig;
