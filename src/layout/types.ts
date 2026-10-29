import type { IconifyIcon } from "@iconify/vue";

const { VITE_HIDE_HOME } = import.meta.env;

/** 固定的首页标签 */
export const routerArrays: Array<RouteConfigs> =
  VITE_HIDE_HOME === "false"
    ? [
        {
          path: "/welcome",
          meta: {
            title: "首页",
            icon: "ep:home-filled"
          }
        }
      ]
    : [];

export type routeMetaType = {
  title?: string;
  icon?: string | IconifyIcon;
  showLink?: boolean;
  savedPosition?: boolean;
  auths?: Array<string>;
};

export type RouteConfigs = {
  path?: string;
  query?: object;
  params?: object;
  meta?: routeMetaType;
  children?: RouteConfigs[];
  name?: string;
};

export type menuType = {
  id?: number;
  name?: string;
  path?: string;
  noShowingChildren?: boolean;
  children?: menuType[];
  value: unknown;
  meta?: {
    icon?: string;
    title?: string;
    rank?: number;
    showParent?: boolean;
    showLink?: boolean;
  };
  showTooltip?: boolean;
  parentId?: number;
  pathList?: number[];
  redirect?: string;
};
