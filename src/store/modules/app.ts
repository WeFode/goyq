import { defineStore } from "pinia";
import { type appType } from "../types";
import { store } from "@/store";
import { getConfig } from "@/config";
import { deviceDetection } from "@/utils/helpers";
import { storageLocal, namespacedKey } from "@/utils/storage";

const layoutCacheKey = () => namespacedKey("layout");

export const useAppStore = defineStore({
  id: "app",
  state: (): appType => ({
    sidebar: {
      opened:
        storageLocal().getItem<StorageConfigs>(layoutCacheKey())
          ?.sidebarStatus ?? true,
      withoutAnimation: false,
      isClickCollapse: false
    },
    device: deviceDetection() ? "mobile" : "desktop"
  }),
  getters: {
    getSidebarStatus(state) {
      return state.sidebar.opened;
    },
    getDevice(state) {
      return state.device;
    }
  },
  actions: {
    TOGGLE_SIDEBAR(opened?: boolean, resize?: string) {
      const layout = storageLocal().getItem<StorageConfigs>(layoutCacheKey()) ?? {};

      if (resize) {
        // 窗口尺寸变化引起的自动折叠，不记录为用户手动点击
        this.sidebar.withoutAnimation = true;
        this.sidebar.opened = !!opened;
      } else {
        this.sidebar.withoutAnimation = false;
        this.sidebar.opened =
          typeof opened === "boolean" ? opened : !this.sidebar.opened;
        this.sidebar.isClickCollapse = !this.sidebar.opened;
      }

      layout.sidebarStatus = this.sidebar.opened;
      storageLocal().setItem(layoutCacheKey(), layout);
    },
    toggleSideBar(opened?: boolean, resize?: string) {
      this.TOGGLE_SIDEBAR(opened, resize);
    },
    toggleDevice(device: string) {
      this.device = device;
    }
  }
});

export function useAppStoreHook() {
  return useAppStore(store);
}

/** 侧边栏宽度常量（一级图标栏 72 + 二级面板 208），供布局与样式共用 */
export const SIDEBAR_WIDTH = 280;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

/** 平台标题 */
export const getAppTitle = () => getConfig()?.Title ?? "OA 协同办公";
