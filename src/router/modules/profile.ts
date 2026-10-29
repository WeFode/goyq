export default {
  path: "/profile",
  name: "ProfileIndex",
  component: () => import("@/views/profile/index.vue"),
  meta: {
    icon: "ri:user-settings-line",
    title: "个人资料",
    rank: 999,
    showLink: false // 不在菜单中显示
  }
} satisfies RouteConfigsTable;

