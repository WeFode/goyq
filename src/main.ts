import { createApp, type Directive } from "vue";
import App from "./App.vue";
import router from "./router";
import { setupStore } from "@/store";
import { getPlatformConfig } from "./config";
import { useElementPlus } from "@/plugins/elementPlus";
import { setupIcons } from "@/assets/icons";
import { setupAppComponents } from "@/components/app";
import { setupWebSocketHandlers } from "@/utils/websocket/handlers";

// 样式加载顺序：Element Plus 基础样式 → 设计令牌与二次定制覆盖
import "element-plus/dist/index.css";
import "./styles/index.scss";
import "./styles/tailwind.css";

// 自定义指令（v-auth / v-perms / v-copy）
import * as directives from "@/directives";

const app = createApp(App);

Object.keys(directives).forEach(key => {
  app.directive(key, (directives as { [key: string]: Directive })[key]);
});

// 本地图标与基础组件
setupIcons();
setupAppComponents(app);

getPlatformConfig(app).then(async config => {
  setupStore(app);
  setupWebSocketHandlers();
  app.use(router);
  await router.isReady();
  app.use(useElementPlus);
  app.mount("#app");
  return config;
});
