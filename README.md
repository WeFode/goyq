# GO云启 OA · 协同办公前端

面向政企/中小团队的协同办公前端，基于 **Vue 3 + Vite + Element Plus** 二次定制，覆盖工作台看板、审批工作流、流程/表单设计器、组织人事、系统权限与审计日志。

- 设计语言：飞书式交互 + 政企配色，双栏导航（一级图标栏 + 二级菜单面板）
- 多标签页、动态路由、按钮级权限、状态字典全量中文化
- 复杂审批：串行 / 会签 / 或签 / 条件分支 / 抄送 / 附件

> **说明**：本仓库**只包含前端**。后端服务（GoFrame + PostgreSQL）不随仓库提供，接口契约见 [后端对接](#后端对接)。截图数据来自本地演示环境。

![工作台](docs/screenshots/01-dashboard.png)

---

## 目录

- [界面预览](#界面预览)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [目录结构](#目录结构)
- [后端对接](#后端对接)
- [设计系统](#设计系统)
- [工程约定](#工程约定)
- [部署](#部署)
- [常见问题](#常见问题)
- [License](#license)

---

## 界面预览

| 审批中心 · 收件箱 | 审批详情 · 会签进度 |
| --- | --- |
| ![审批中心](docs/screenshots/02-approval-inbox.png) | ![审批详情](docs/screenshots/03-approval-detail.png) |

| 流程设计器（vue-flow） | 表单设计器 |
| --- | --- |
| ![流程设计器](docs/screenshots/04-workflow-designer.png) | ![表单设计器](docs/screenshots/05-form-designer.png) |

| 角色与权限 | 登录日志 |
| --- | --- |
| ![角色管理](docs/screenshots/06-system-role.png) | ![登录日志](docs/screenshots/07-login-logs.png) |

| 个人中心 | 登录页 |
| --- | --- |
| ![个人中心](docs/screenshots/08-profile.png) | ![登录页](docs/screenshots/09-login.png) |

---

## 功能特性

**工作台**
- 可视化看板：审批趋势（双序列折线）、状态分布环形图、部门人数、流程使用排行、最近审批动态、快捷发起
- 图表使用手写 SVG 组件，不依赖 ECharts

**登录与账号**
- 品牌主视觉登录页：左侧能力展示 + 右侧账号卡片，账号登录 / 申请账号双 Tab
- 记住密码、忘记密码说明、帮助中心/隐私政策/使用条款弹窗，移动端自适应

**审批工作流**
- 审批中心采用「收件箱」布局：左侧按时间分组卡片 + 右侧内联预览，支持不打开弹窗直接审批
- 六类视图：我发起的 / 我待办的 / 我已办的 / 抄送给我的 / 已通过 / 已取消
- 审批详情抽屉：流程时间轴（节点类型、会签/或签/串行、审批人与状态、节点耗时）、评论与附件、打印、撤销、重新发起
- 发起审批：表单填写 + 审批人/抄送人调整 + 本地草稿

**流程与表单设计**
- 流程设计器：基于 `@vue-flow/core`，节点库（审批/抄送/条件/结束）、条件分支、节点属性面板
- 表单设计器：三栏布局（字段库 / 画布 / 属性），支持 12+ 字段类型，含子表格与附件上传

**系统与组织**
- 系统管理：用户、角色（菜单授权 / 权限授权）、菜单（树形）、权限、日志（登录 / 操作）
- 人事：部门组织树、职位、邀请码、员工档案、通讯录
- 账号安全：登录会话控制、个人资料、修改密码

**交互与工程**
- 动态路由（后端菜单驱动）、多标签页（右键菜单）、面包屑、全局搜索（Ctrl K）、消息中心
- 按钮级权限指令 `v-auth` 与 `usePermission`
- 统一字典层：状态/枚举全部映射中文，未收录值回退「未知状态」，不会把英文码暴露给用户

---

## 技术栈

| 分类 | 选型 |
| --- | --- |
| 框架 | Vue 3.5（`<script setup>`）、TypeScript |
| 构建 | Vite 6 |
| UI | Element Plus 2.9（全量引入 + SCSS 覆盖层） |
| 状态 | Pinia |
| 路由 | Vue Router 4（动态路由 + 多标签） |
| 请求 | Axios 封装（业务码处理、无感刷新 token） |
| 流程图 | @vue-flow/core + background + controls + minimap |
| 样式 | SCSS + CSS 变量设计令牌 + Tailwind 3（少量工具类） |
| 图标 | @iconify/vue 离线注册表（ep / ri / fa-solid） |
| 工具 | dayjs、lodash-es、qs、js-cookie、nprogress、@vueuse/core |

---

## 快速开始

要求：Node.js ≥ 18、pnpm ≥ 8。

```bash
pnpm install
pnpm dev        # http://localhost:8849
pnpm typecheck  # vue-tsc 类型检查
pnpm build      # 产物输出 dist/
pnpm preview    # 预览构建产物
```

### 环境变量

复制并按需修改 `.env.development`：

| 变量 | 说明 | 本地示例 |
| --- | --- | --- |
| `VITE_PORT` | 开发端口 | `8849` |
| `VITE_PROXY_TARGET` | 业务接口代理目标 | `http://127.0.0.1:8000` |
| `VITE_FILE_PROXY_TARGET` | 附件代理目标（`/files`） | `http://127.0.0.1:8000` |
| `VITE_WS_PROXY_TARGET` | WebSocket 代理目标 | `ws://127.0.0.1:8000` |
| `VITE_FILE_BASE_URL` | 附件域名前缀，留空表示同源 | 空 |
| `VITE_ROUTER_HISTORY` | 路由模式（`h5` / `hash`） | `h5` |
| `VITE_PUBLIC_PATH` | 部署公共路径 | `/` |

> 没有后端时页面可以打开，但登录与数据依赖后端接口；仓库不内置 mock 服务。

---

## 目录结构

```
new-web
├─ docs/screenshots/          # README 截图
├─ public/                    # 静态资源（favicon、logo）
├─ src
│  ├─ api/                    # 接口层（按业务域拆分，路径与后端一一对应）
│  ├─ assets/icons/           # iconify 离线图标注册表
│  ├─ components
│  │  ├─ app/                 # App* 基础组件（页面容器/表格/表单弹窗/状态标签…）
│  │  ├─ charts/              # SVG 图表（趋势/环形/条形）
│  │  └─ workflow/            # 审批领域组件（详情/时间轴/表单渲染/附件…）
│  ├─ directives/             # v-auth / v-perms / v-copy
│  ├─ layout/                 # 布局：双栏导航、导航栏、多标签、主区域
│  ├─ router/                 # 静态路由 + 后端菜单转动态路由
│  ├─ store/                  # app / user / permission / multiTags / settings
│  ├─ styles/                 # 设计令牌、Element Plus 覆盖、布局与工具类
│  ├─ utils/                  # http、字典、存储、workflow、helpers…
│  └─ views/                  # 页面（路径与后端菜单 component 一一对应）
├─ nginx.conf                 # 生产部署参考
├─ doc.md                     # 开发记录与验收说明
└─ vite.config.ts
```

---

## 后端对接

仓库不包含后端，前端只依赖稳定的 HTTP 契约。默认前缀 `/api/v1`，除登录外均需 `Authorization: Bearer <accessToken>`。

### 鉴权与用户

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/auth/login` | 入参 `{ username, password, platform }`，返回 `data.{ accessToken, refreshToken, expireAt, user }` |
| POST | `/auth/logout` | 注销当前会话 |
| POST | `/auth/refresh-token` | 刷新 token |
| GET | `/sys/menu/user` | 当前用户菜单树（`data.tree`） |
| GET | `/sys/user/permissions` | 当前用户按钮权限 |

`user` 至少包含：`id、username、nickname、employeeId、avatar、departments、is_super`。

菜单节点字段：`path、component、name、meta.{ title, icon, showLink, keepAlive, rank, frameSrc }、children`。
前端按 **component 路径匹配 `/src/views/**` 文件**，并依赖 **name 与组件 `defineOptions({ name })` 一致**实现 keep-alive。

### 工作流

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/workflow/definition/list` | 流程定义列表 |
| GET | `/workflow/form-design/list` / `/{id}` | 表单列表 / 详情 |
| POST | `/workflow/instance/initiate` | 发起审批 |
| GET | `/workflow/instance/my-initiated` | 我发起的 |
| GET | `/workflow/task/my-pending` / `my-completed` | 待办 / 已办 |
| GET | `/workflow/cc/my-list` | 抄送给我的 |
| GET | `/workflow/instance/{id}` | 实例详情（含 `processTimeline`） |
| GET | `/workflow/instance/{id}/permission` | 当前用户对该单的权限（`canApprove` 等） |
| POST | `/workflow/task/{taskId}/approve` / `reject` | 同意 / 拒绝 |
| POST | `/workflow/instance/cancel` | 撤销 |

审批节点约定：
- `approveType`：`ORDER_SIGN`（串行）/ `ALL_SIGN`（会签）/ `ANY_SIGN`（或签）
- 实例状态仅 `running / approved / rejected / cancelled`
- 节点级"部分完成"由任务状态表达，不要新增实例状态

### 附件

上传接口返回 `{ fileUrl }`，形如 `/files/20251103/xxx.pdf`；前端统一经 `VITE_FILE_BASE_URL + fileUrl` 访问。生产环境需保证 `/files` 与 `/api/v1` 指向同一后端。

---

## 设计系统

- `src/styles/tokens.scss` 是唯一设计令牌来源：主色 `#1F5AE0`、页面底 `#F5F6F8`、圆角 4/6/8/12、动效 160/200ms
- `src/styles/element/vars.scss` 用 SCSS `color.mix` 生成 Element Plus 五档色阶，只需改主色即可整体换肤
- 布局：`app-nav-rail`（72px 一级图标栏）+ `app-nav-panel`（208px 二级面板），折叠时仅保留图标栏且图标常显
- 领域组件统一 `App*` 前缀：`AppPage / AppDataTable / AppFormDialog / AppStatusTag / AppEmpty / AppUserAvatar …`

---

## 工程约定

1. `views/` 路径与后端菜单 `component` 保持 1:1，避免动态路由失效。
2. 路由 `name` 与页面组件 `name` 必须一致，否则多标签缓存（keep-alive）失效。
3. 接口统一走 `src/api/*`，不要在页面里裸写 axios 路径。
4. 状态/枚举统一在 `src/utils/dicts.ts` 维护，禁止把后端英文码直接渲染。
5. 新增页面优先复用 `AppPage`、`AppSearchBar`、`AppDataTable`、`AppFormDialog`。

---

## 部署

```bash
pnpm build
# 将 dist/ 上传到服务器目录，参考 nginx.conf
```

`nginx.conf` 已包含：SPA 回退、`index.html` 不缓存、`/static` 强缓存、`/api/v1`、`/files`、`/swagger`、`/api.json` 与 WebSocket 代理、gzip。

---

## 常见问题

**登录后菜单是空的？**
检查 `/sys/menu/user` 是否返回菜单树，以及菜单 `component` 是否能在 `src/views` 中找到对应文件；控制台会输出 `[router] 未找到视图组件` 的告警。

**多标签页切换后页面状态丢失？**
确认路由 `name` 与组件 `name` 一致；不一致时 keep-alive 无法命中。

**附件打不开？**
确认 `VITE_FILE_BASE_URL` 为空（同源）或指向附件服务域名，并确保反向代理未重写 `/files` 前缀。

**接口返回 401 后整页退出？**
http 层对 401 统一清理会话；检查 token 是否过期、后端会话是否被其他设备顶替（并发会话限制）。

---

## License

[MIT](LICENSE)

截图与演示数据仅用于展示界面能力，不含真实业务信息。
