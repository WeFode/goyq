import { defineStore } from "pinia";
import { type multiType, type positionType } from "../types";
import { store } from "@/store";
import { routerArrays } from "@/layout/types";
import { isBoolean, isEqual, isNumber, isUrl } from "@/utils/helpers";
import { storageLocal, namespacedKey } from "@/utils/storage";
import { usePermissionStoreHook } from "./permission";

const tagsCacheKey = () => namespacedKey("tags");

/** 固定标签（首页等）组成的初始标签集合 */
export const getDefaultTags = () => [
  ...routerArrays,
  ...usePermissionStoreHook().flatteningRoutes.filter(v => v?.meta?.fixedTag)
];

export const useMultiTagsStore = defineStore({
  id: "multiTags",
  state: () => ({
    // 存储标签页信息（路由信息），页面刷新后从本地缓存恢复
    multiTags:
      storageLocal().getItem<Array<any>>(tagsCacheKey()) ?? getDefaultTags()
  }),
  actions: {
    tagsCache(multiTags) {
      storageLocal().setItem(tagsCacheKey(), multiTags);
    },
    handleTags<T>(
      mode: string,
      value?: T | multiType,
      position?: positionType
    ): T {
      switch (mode) {
        case "equal":
          this.multiTags = value as Array<any>;
          this.tagsCache(this.multiTags);
          break;
        case "push": {
          const tagVal = value as multiType;
          // 不添加到标签页
          if (tagVal?.meta?.hiddenTag) return;
          // 如果是外链无需添加信息到标签页
          if (isUrl(tagVal?.name)) return;
          // 如果title为空拒绝添加空信息到标签页
          if (tagVal?.meta?.title?.length === 0) return;
          // showLink:false 不添加到标签页
          if (isBoolean(tagVal?.meta?.showLink) && !tagVal?.meta?.showLink)
            return;

          const tagPath = tagVal.path;
          // 判断tag是否已存在
          const tagHasExits = this.multiTags.some(tag => tag.path === tagPath);
          // 判断tag中的query键值是否相等
          const tagQueryHasExits = this.multiTags.some(tag =>
            isEqual(tag?.query, tagVal?.query)
          );
          // 判断tag中的params键值是否相等
          const tagParamsHasExits = this.multiTags.some(tag =>
            isEqual(tag?.params, tagVal?.params)
          );

          if (tagHasExits && tagQueryHasExits && tagParamsHasExits) return;

          // 动态路由可打开的最大数量
          const dynamicLevel = tagVal?.meta?.dynamicLevel ?? -1;
          if (dynamicLevel > 0) {
            if (
              this.multiTags.filter(e => e?.path === tagPath).length >=
              dynamicLevel
            ) {
              // 如果当前已打开的动态路由数大于dynamicLevel，替换第一个动态路由标签
              const index = this.multiTags.findIndex(
                item => item?.path === tagPath
              );
              index !== -1 && this.multiTags.splice(index, 1);
            }
          }
          this.multiTags.push(value as any);
          this.tagsCache(this.multiTags);
          break;
        }
        case "splice":
          if (!position) {
            const index = this.multiTags.findIndex(v => v.path === value);
            if (index === -1) return;
            this.multiTags.splice(index, 1);
          } else {
            this.multiTags.splice(position?.startIndex, position?.length);
          }
          this.tagsCache(this.multiTags);
          return this.multiTags as T;
        case "slice":
          return this.multiTags.slice(-1) as T;
      }
    },
    /** 清空缓存标签，仅保留固定标签 */
    resetTags() {
      this.multiTags = getDefaultTags();
      this.tagsCache(this.multiTags);
    }
  }
});

export function useMultiTagsStoreHook() {
  return useMultiTagsStore(store);
}

/** 标签页最大数量限制（超出后自动移除最早的非固定标签） */
export const MAX_TAGS = 20;
export const isMaxTagsReached = (list: Array<any>) =>
  isNumber(list.length) && list.length > MAX_TAGS;
