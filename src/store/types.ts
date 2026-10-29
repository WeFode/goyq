import type { RouteRecordName } from "vue-router";

export type cacheType = {
  mode: string;
  name?: RouteRecordName;
};

export type positionType = {
  startIndex?: number;
  length?: number;
};

export type appType = {
  sidebar: {
    opened: boolean;
    withoutAnimation: boolean;
    /** 判断是否手动点击 Collapse */
    isClickCollapse: boolean;
  };
  device: string;
};

export type multiType = {
  path: string;
  name: string;
  meta: any;
  query?: object;
  params?: object;
};

export type setType = {
  title: string;
  fixedHeader: boolean;
  hideTabs: boolean;
  keepAlive: boolean;
};

export type userType = {
  id?: number;
  avatar?: string;
  username?: string;
  nickname?: string;
  employeeId?: string;
  roles?: Array<string>;
  permissions?: Array<string>;
  userPermissions?: Array<any>;
  departments?: Array<any>;
  isRemembered?: boolean;
  loginDay?: number;
};
