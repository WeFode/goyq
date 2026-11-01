import type { App } from "vue";

import AppIcon from "./AppIcon.vue";
import AppIconPicker from "./AppIconPicker.vue";
import AppPage from "./AppPage.vue";
import AppSearchBar from "./AppSearchBar.vue";
import AppDataTable from "./AppDataTable.vue";
import AppFormDialog from "./AppFormDialog.vue";
import AppFormDrawer from "./AppFormDrawer.vue";
import AppStatusTag from "./AppStatusTag.vue";
import AppUserAvatar from "./AppUserAvatar.vue";
import AppSignedImage from "./AppSignedImage.vue";
import AppEmpty from "./AppEmpty.vue";
import AppDetailSection from "./AppDetailSection.vue";

/**
 * 基础组件全局注册
 * 这些组件在几乎所有页面都会用到，全局注册可省去重复 import
 */
const components = {
  AppIcon,
  AppIconPicker,
  AppPage,
  AppSearchBar,
  AppDataTable,
  AppFormDialog,
  AppFormDrawer,
  AppStatusTag,
  AppUserAvatar,
  AppSignedImage,
  AppEmpty,
  AppDetailSection
};

export function setupAppComponents(app: App) {
  Object.keys(components).forEach(name => {
    app.component(name, components[name]);
  });
}

export {
  AppIcon,
  AppIconPicker,
  AppPage,
  AppSearchBar,
  AppDataTable,
  AppFormDialog,
  AppFormDrawer,
  AppStatusTag,
  AppUserAvatar,
  AppSignedImage,
  AppEmpty,
  AppDetailSection
};
