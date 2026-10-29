/**
 * 全局注册组件的类型提示
 * element-plus 组件类型由 tsconfig 的 "element-plus/global" 提供
 */
declare module "vue" {
  export interface GlobalComponents {
    AppIcon: (typeof import("../src/components/app"))["AppIcon"];
    AppPage: (typeof import("../src/components/app"))["AppPage"];
    AppSearchBar: (typeof import("../src/components/app"))["AppSearchBar"];
    AppDataTable: (typeof import("../src/components/app"))["AppDataTable"];
    AppFormDialog: (typeof import("../src/components/app"))["AppFormDialog"];
    AppFormDrawer: (typeof import("../src/components/app"))["AppFormDrawer"];
    AppStatusTag: (typeof import("../src/components/app"))["AppStatusTag"];
    AppUserAvatar: (typeof import("../src/components/app"))["AppUserAvatar"];
    AppEmpty: (typeof import("../src/components/app"))["AppEmpty"];
    AppDetailSection: (typeof import("../src/components/app"))["AppDetailSection"];
  }
}

export {};
