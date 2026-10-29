import {
  type RouterHistory,
  type RouteRecordRaw,
  type RouteComponent,
  createWebHistory,
  createWebHashHistory
} from "vue-router";
import { router } from "./index";
import { isProxy, toRaw } from "vue";
import { useTimeoutFn } from "@vueuse/core";
import { cloneDeep } from "lodash-es";
import {
  isString,
  isAllEmpty,
  intersection,
  isIncludeAllChildren
} from "@/utils/helpers";
import { buildHierarchyTree } from "@/utils/tree";
import { userKey, type DataInfo } from "@/utils/auth";
import { type menuType } from "@/layout/types";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { usePermissionStoreHook } from "@/store/modules/permission";
const IFrame = () => import("@/layout/frame.vue");
/** 后端配置了菜单但前端缺少对应视图时，用提示页兜底，避免白屏 */
const MissingView = () => import("@/views/error/missing.vue");
// https://cn.vitejs.dev/guide/features.html#glob-import
const modulesRoutes = import.meta.glob("/src/views/**/*.{vue,tsx}");

// 动态路由
import { getAsyncRoutes } from "@/api/menu";
import { useUserStoreHook } from "@/store/modules/user";

/** 按照路由中meta下的rank等级升序来排序路由(包括子菜单) */
function ascending(arr: any[]) {
  arr.forEach((v, index) => {
    // 确保 meta 对象存在
    if (!v.meta) {
      v.meta = {};
    }

    // 当rank不存在时，根据顺序自动创建，首页路由永远在第一位
    if (handRank(v)) {
      v.meta.rank = index + 2;
    }

    // 如果有子菜单，则递归对子菜单进行排序
    if (v.children && v.children.length) {
      v.children = ascending(v.children);
    }
  });

  // 对当前层级的路由按rank排序，处理 meta 或 rank 不存在的情况
  return arr.sort((a, b) => {
    const rankA = a?.meta?.rank ?? 0;
    const rankB = b?.meta?.rank ?? 0;
    return rankA - rankB;
  });
}

// handRank 函数也需要相应修改，增加空值检查
function handRank(routeInfo: any) {
  const { name, path, parentId, meta } = routeInfo;
  return isAllEmpty(parentId)
    ? isAllEmpty(meta?.rank) ||
      (meta?.rank === 0 && name !== "Home" && path !== "/")
      ? true
      : false
    : false;
}

/** 过滤meta中showLink为false的菜单 */
function filterTree(data: RouteComponent[]) {
  const newTree = cloneDeep(data).filter(
    (v: { meta: { showLink: boolean } }) => v.meta?.showLink !== false
  );
  newTree.forEach(
    (v: { children }) => v.children && (v.children = filterTree(v.children))
  );
  return newTree;
}

/** 过滤children长度为0的的目录，当目录下没有菜单时，会过滤此目录，目录没有赋予roles权限，当目录下只要有一个菜单有显示权限，那么此目录就会显示 */
function filterChildrenTree(data: RouteComponent[]) {
  const newTree = cloneDeep(data).filter((v: any) => v?.children?.length !== 0);
  newTree.forEach(
    (v: { children }) => v.children && (v.children = filterTree(v.children))
  );
  return newTree;
}

/** 判断两个数组彼此是否存在相同值 */
function isOneOfArray(a: Array<string>, b: Array<string>) {
  return Array.isArray(a) && Array.isArray(b)
    ? intersection(a, b).length > 0
      ? true
      : false
    : true;
}

/** 通过指定 `key` 获取父级路径集合，默认 `key` 为 `path` */
function getParentPaths(value: string, routes: RouteRecordRaw[], key = "path") {
  // 深度遍历查找
  function dfs(routes: RouteRecordRaw[], value: string, parents: string[]) {
    for (let i = 0; i < routes.length; i++) {
      const item = routes[i];
      // 返回父级path
      if (item[key] === value) return parents;
      // children不存在或为空则不递归
      if (!item.children || !item.children.length) continue;
      // 往下查找时将当前path入栈
      parents.push(item.path);

      if (dfs(item.children, value, parents).length) return parents;
      // 深度遍历查找未找到时当前path 出栈
      parents.pop();
    }
    // 未找到时返回空数组
    return [];
  }

  return dfs(routes, value, []);
}

/** 查找对应 `path` 的路由信息 */
function findRouteByPath(path: string, routes: RouteRecordRaw[]) {
  let res = routes.find((item: { path: string }) => item.path == path);
  if (res) {
    return isProxy(res) ? toRaw(res) : res;
  } else {
    for (let i = 0; i < routes.length; i++) {
      if (
        routes[i].children instanceof Array &&
        routes[i].children.length > 0
      ) {
        res = findRouteByPath(path, routes[i].children as RouteRecordRaw[]);
        if (res) {
          return isProxy(res) ? toRaw(res) : res;
        }
      }
    }
    return null;
  }
}

function addPathMatch() {
  if (!router.hasRoute("pathMatch")) {
    router.addRoute({
      path: "/:pathMatch(.*)",
      name: "pathMatch",
      redirect: "/error/404"
    });
  }
}

/** 处理动态路由（后端返回的路由） */
function handleAsyncRoutes(routeList) {
  if (routeList.length === 0) {
    usePermissionStoreHook().handleWholeMenus(routeList);
  } else {
    formatFlatteningRoutes(addAsyncRoutes(routeList)).map(
      (v: RouteRecordRaw) => {
        // 防止重复添加路由
        if (
          router.options.routes[0].children.findIndex(
            value => value.path === v.path
          ) !== -1
        ) {
          return;
        } else {
          // 切记将路由push到routes后还需要使用addRoute，这样路由才能正常跳转
          router.options.routes[0].children.push(v);
          // 最终路由进行升序
          ascending(router.options.routes[0].children);
          if (!router.hasRoute(v?.name)) router.addRoute(v);
          const flattenRouters: any = router
            .getRoutes()
            .find(n => n.path === "/");
          router.addRoute(flattenRouters);
        }
      }
    );
    usePermissionStoreHook().handleWholeMenus(routeList);
  }
  useMultiTagsStoreHook().resetTags();
  addPathMatch();
}

/** 初始化路由（`new Promise` 写法防止在异步请求中造成无限循环）*/
function initRouter() {
  return new Promise(resolve => {
    getAsyncRoutes().then((data: any) => {
      const routes = data?.data?.tree || [];
      handleAsyncRoutes(cloneDeep(routes));
      // 获取用户权限
      useUserStoreHook().getUserPermissions().catch(error => {
        console.error("获取用户权限失败:", error);
      });
      resolve(router);
    });
  });
}

/**
 * 将多级嵌套路由处理成一维数组
 * @param routesList 传入路由
 * @returns 返回处理后的一维路由
 */
function formatFlatteningRoutes(routesList: RouteRecordRaw[]) {
  if (routesList.length === 0) return routesList;
  let hierarchyList = buildHierarchyTree(routesList);
  for (let i = 0; i < hierarchyList.length; i++) {
    if (hierarchyList[i].children) {
      hierarchyList = hierarchyList
        .slice(0, i + 1)
        .concat(hierarchyList[i].children, hierarchyList.slice(i + 1));
    }
  }
  return hierarchyList;
}

/**
 * 一维数组处理成多级嵌套数组（三级及以上的路由全部拍成二级，keep-alive 只支持到二级缓存）
 * https://github.com/pure-admin/vue-pure-admin/issues/67
 * @param routesList 处理后的一维路由菜单数组
 * @returns 返回将一维数组重新处理成规定路由的格式
 */
function formatTwoStageRoutes(routesList: RouteRecordRaw[]) {
  if (routesList.length === 0) return routesList;
  const newRoutesList: RouteRecordRaw[] = [];
  routesList.forEach((v: RouteRecordRaw) => {
    if (v.path === "/") {
      newRoutesList.push({
        component: v.component,
        name: v.name,
        path: v.path,
        redirect: v.redirect,
        meta: v.meta,
        children: []
      });
    } else {
      newRoutesList[0]?.children.push({ ...v });
    }
  });
  return newRoutesList;
}

/** 处理缓存路由（添加、删除、刷新） */
function handleAliveRoute({ name }: ToRouteType, mode?: string) {
  switch (mode) {
    case "add":
      usePermissionStoreHook().cacheOperate({
        mode: "add",
        name
      });
      break;
    case "delete":
      usePermissionStoreHook().cacheOperate({
        mode: "delete",
        name
      });
      break;
    case "refresh":
      usePermissionStoreHook().cacheOperate({
        mode: "refresh",
        name
      });
      break;
    default:
      usePermissionStoreHook().cacheOperate({
        mode: "delete",
        name
      });
      useTimeoutFn(() => {
        usePermissionStoreHook().cacheOperate({
          mode: "add",
          name
        });
      }, 100);
  }
}

/** 过滤后端传来的动态路由 重新生成规范路由 */
function addAsyncRoutes(arrRoutes: Array<RouteRecordRaw>) {
  if (!arrRoutes || !arrRoutes.length) return;
  const modulesRoutesKeys = Object.keys(modulesRoutes);

  // 过滤掉按钮类型的菜单
  const filterMenus = (menus: any[]) => {
    return menus.filter(item => {
      // 递归处理子菜单
      if (item.children && item.children.length) {
        item.children = filterMenus(item.children);
      }

      return true;
    });
  };

  // 先过滤掉按钮类型的菜单
  const filteredRoutes = filterMenus(arrRoutes);

  filteredRoutes.forEach((v: any) => {
    // 构建 meta，兼容后端字段为 snake_case 的情况
    v.meta = v.meta || {};
    v.meta.title = v.meta.title ?? v.title;
    v.meta.icon = v.meta.icon ?? v.icon;
    v.meta.rank = v.meta.rank ?? v.rank;
    v.meta.keepAlive = v.meta.keepAlive ?? v.keep_alive;
    v.meta.showLink = v.meta.showLink ?? v.show_link;
    v.meta.showParent = v.meta.showParent ?? v.show_parent;
    v.meta.enterTransition = v.meta.enterTransition ?? v.enter_transition;
    v.meta.leaveTransition = v.meta.leaveTransition ?? v.leave_transition;
    v.meta.activePath = v.meta.activePath ?? v.active_path;
    v.meta.frameSrc = v.meta.frameSrc ?? v.frame_src;
    v.meta.frameLoading = v.meta.frameLoading ?? v.frame_loading;
    v.meta.hiddenTag = v.meta.hiddenTag ?? v.hidden_tag;
    v.meta.fixedTag = v.meta.fixedTag ?? v.fixed_tag;

    // 将backstage属性加入meta，标识此路由为后端返回路由
    v.meta.backstage = true;

    // 兼容父子关系字段
    if (v.parent_id !== undefined && v.parentId === undefined)
      v.parentId = v.parent_id;

    // 父级的redirect属性取值：如果子级存在且父级的redirect属性不存在，默认取第一个子级的path；如果子级存在且父级的redirect属性存在，取存在的redirect属性，会覆盖默认值
    if (v?.children && v.children.length && !v.redirect)
      v.redirect = v.children[0].path;
    // 父级的name属性取值：如果子级存在且父级的name属性不存在，默认取第一个子级的name；如果子级存在且父级的name属性存在，取存在的name属性，会覆盖默认值（注意：测试中发现父级的name不能和子级name重复，如果重复会造成重定向无效（跳转404），所以这里给父级的name起名的时候后面会自动加上`Parent`，避免重复）
    if (v?.children && v.children.length && !v.name)
      v.name = (v.children[0].name as string) + "Parent";
    const hasChildren = !!(v?.children && v.children.length);

    if (v.meta?.frameSrc) {
      v.component = IFrame;
    } else if (hasChildren) {
      // 目录节点：不挂载页面组件，让子路由直接在 Layout 的 router-view 中渲染。
      // 否则父级页面（如占位的“字典管理”）会把子页面（如“权限管理”）吞掉。
      v.component = undefined;
    } else {
      // 对后端传component组件路径和不传做兼容（如果后端传component组件路径，那么path可以随便写，如果不传，component组件路径会跟path保持一致）
      const index = v?.component
        ? modulesRoutesKeys.findIndex(ev => ev.includes(v.component as any))
        : modulesRoutesKeys.findIndex(ev => ev.includes(v.path));
      v.component = index === -1 ? MissingView : modulesRoutes[modulesRoutesKeys[index]];
      if (index === -1) {
        console.warn(`[router] 未找到视图组件，已使用缺失提示页: path=${v.path}, component=${v.component}`);
      }
    }
    if (hasChildren) {
      addAsyncRoutes(v.children as any);
    }
  });
  return filteredRoutes;
}

/** 获取路由历史模式 https://next.router.vuejs.org/zh/guide/essentials/history-mode.html */
function getHistoryMode(routerHistory): RouterHistory {
  // len为1 代表只有历史模式 为2 代表历史模式中存在base参数 https://next.router.vuejs.org/zh/api/#%E5%8F%82%E6%95%B0-1
  const historyMode = routerHistory.split(",");
  const leftMode = historyMode[0];
  const rightMode = historyMode[1];
  // no param
  if (historyMode.length === 1) {
    if (leftMode === "hash") {
      return createWebHashHistory("");
    } else if (leftMode === "h5") {
      return createWebHistory("");
    }
  } //has param
  else if (historyMode.length === 2) {
    if (leftMode === "hash") {
      return createWebHashHistory(rightMode);
    } else if (leftMode === "h5") {
      return createWebHistory(rightMode);
    }
  }
}

/** 获取当前页面按钮级别的权限 */
function getAuths(): Array<string> {
  const { userPermissions } = useUserStoreHook();
  if (!userPermissions || userPermissions.length === 0) return [];
  
  // 从用户权限列表中提取权限代码
  return userPermissions.map(perm => perm.permission_code);
}

/** 是否有按钮级别的权限（根据用户权限数据进行判断）*/
function hasAuth(value: string | Array<string>): boolean {
  if (!value) return false;

  /** 从用户权限数据中获取所有权限代码 */
  const { userPermissions } = useUserStoreHook();
  if (!userPermissions || userPermissions.length === 0) return false;

  /**
   * 判断用户是否拥有万能权限
   * 如果用户权限中包含 "*:*:*"，则视为拥有全部按钮级别权限
   */
  const ALL_PERMS = "*:*:*";
  const hasAllPerms = userPermissions.some(perm => perm.permission_code === ALL_PERMS);
  if (hasAllPerms) {
    return true;
  }

  // 提取权限代码数组
  const permissionCodes = userPermissions.map(perm => perm.permission_code);
  
  const isAuths = isString(value)
    ? permissionCodes.includes(value)
    : isIncludeAllChildren(value, permissionCodes);
  return isAuths ? true : false;
}

function handleTopMenu(route) {
  if (route?.children && route.children.length > 1) {
    if (route.redirect) {
      return route.children.filter(cur => cur.path === route.redirect)[0];
    } else {
      return route.children[0];
    }
  } else {
    return route;
  }
}

/** 获取所有菜单中的第一个菜单（顶级菜单）*/
function getTopMenu(tag = false): menuType {
  const topMenu = handleTopMenu(
    usePermissionStoreHook().wholeMenus[0]?.children[0]
  );
  tag && useMultiTagsStoreHook().handleTags("push", topMenu);
  return topMenu;
}

export {
  hasAuth,
  getAuths,
  ascending,
  filterTree,
  initRouter,
  getTopMenu,
  addPathMatch,
  isOneOfArray,
  getHistoryMode,
  addAsyncRoutes,
  getParentPaths,
  findRouteByPath,
  handleAliveRoute,
  formatTwoStageRoutes,
  formatFlatteningRoutes,
};
