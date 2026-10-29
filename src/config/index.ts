import axios from "axios";
import type { App } from "vue";

let config: PlatformConfigs = {};

const { VITE_PUBLIC_PATH } = import.meta.env;

const setConfig = (cfg?: unknown) => {
  config = Object.assign(config, cfg);
};

/** 读取平台配置，支持 `a.b` 形式的路径读取 */
const getConfig = (key?: string): PlatformConfigs => {
  if (typeof key === "string") {
    const arr = key.split(".");
    if (arr.length) {
      let data: any = config;
      arr.forEach(part => {
        data = data ? data[part] : null;
      });
      return data;
    }
  }
  return config;
};

/** 获取项目动态全局配置（public/platform-config.json） */
export const getPlatformConfig = async (app: App): Promise<any> => {
  app.config.globalProperties.$config = getConfig();

  return axios({
    method: "get",
    url: `${VITE_PUBLIC_PATH}platform-config.json`
  })
    .then(({ data }) => {
      let $config = app.config.globalProperties.$config;
      if (app && $config && typeof data === "object") {
        $config = Object.assign($config, data);
        app.config.globalProperties.$config = $config;
        setConfig($config);
      }
      return $config;
    })
    .catch(() => {
      throw new Error("请在 public 文件夹下添加 platform-config.json 配置文件");
    });
};

/** 本地存储命名空间前缀 */
const responsiveStorageNameSpace = () =>
  getConfig().ResponsiveStorageNameSpace ?? "";

export { getConfig, setConfig, responsiveStorageNameSpace };
