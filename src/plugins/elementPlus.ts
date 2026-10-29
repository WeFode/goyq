import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import type { App } from "vue";

/** Element Plus 全量注册（中文语言包） */
export function useElementPlus(app: App) {
  app.use(ElementPlus, { locale: zhCn });
}
