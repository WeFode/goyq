export default [
  {
    path: "/error/404",
    name: "404",
    component: () => import("@/views/error/404.vue"),
    meta: {
      title: "404",
      showLink: false
    }
  },
  {
    path: "/error/403", 
    name: "403",
    component: () => import("@/views/error/403.vue"),
    meta: {
      title: "403",
      showLink: false
    }
  }
] satisfies Array<RouteConfigsTable>; 