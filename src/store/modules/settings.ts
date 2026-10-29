import { defineStore } from "pinia";
import { type setType } from "../types";
import { store } from "@/store";
import { getConfig } from "@/config";

export const useSettingStore = defineStore({
  id: "setting",
  state: (): setType => ({
    title: getConfig().Title,
    fixedHeader: getConfig().FixedHeader ?? true,
    hideTabs: getConfig().HideTabs ?? false,
    keepAlive: getConfig().KeepAlive ?? true
  }),
  getters: {
    getTitle(state) {
      return state.title;
    },
    getFixedHeader(state) {
      return state.fixedHeader;
    },
    getHideTabs(state) {
      return state.hideTabs;
    },
    getKeepAlive(state) {
      return state.keepAlive;
    }
  }
});

export function useSettingStoreHook() {
  return useSettingStore(store);
}
