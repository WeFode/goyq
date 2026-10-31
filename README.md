# GO云启 OA · 协同办公前端

面向政企/中小团队的协同办公前端，基于 **Vue 3 + Vite + Element Plus** 二次定制，覆盖工作台看板、审批工作流、流程/表单设计器、组织人事、系统权限、数据字典、系统参数、租户运营、公告管理、知识库与审计日志。

- 设计语言：飞书式交互 + 政企配色，双栏导航（一级图标栏 + 二级菜单面板）
- 多标签页、动态路由、按钮级权限、状态字典全量中文化
- 复杂审批：串行 / 会签 / 或签 / 条件分支 / 抄送 / 附件
- 知识库：企业文档与个人文件分类归档，图片缩略图网格与全屏预览，文档跳 Office 在线预览
- 面向 SaaS：租户用量与账号配额可视化，平台管理员可切换租户视角

> **说明**：本仓库**只包含前端**。后端服务不随仓库提供，前端只依赖稳定的 HTTP 契约，见 [后端对接](#后端对接)。截图数据来自本地演示环境。

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
- [权限码对照](#权限码对照)
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

| 知识库 · 文档库（封面缩略图） | 知识库 · 图片全屏预览 |
| --- | --- |
| ![知识库](docs/screenshots/10-kb-library.png) | ![图片预览](docs/screenshots/11-kb-preview.png) |

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
- 账号安全：登录会话控制、个人资料、头像上传、修改密码

**知识库 / 资料库**
- 左侧分类树 + 右侧文档列表，企业文档全员可见、个人文件仅本人可见
- 文档封面取首个图片附件，列表以方形缩略图展示；详情附件区图片为缩略图网格，点击调用 `el-image` 全屏预览（支持左右切换、缩放）
- 文档附件复用统一签名机制：长期只存 fileId，展示时按 fileId 换取签名地址；Office 文档跳在线预览、PDF 直开、其余走下载
- 分类管理：树形上级选择、按归属范围（企业 / 个人）划分，删除前校验无子分类与无文档
- 菜单 / 分类等图标字段统一使用 `AppIconPicker`（从已注册图标中搜索挑选，避免手输字符串导致图标不渲染）

**平台能力**
- 数据字典：左列表右字典项，内置枚举只读、业务字典可视化维护；`useDict(code)` 供页面按编码取用
- 系统参数：按分组维护站点信息、安全策略、附件限制与审批规则，支持整组批量保存
- 租户运营：租户列表 / 开通 / 编辑 / 切换租户视角，用量抽屉展示账号配额与存储占用
- 公告管理：部门树多选发布、送达与已读统计、撤回（联动清理已下发通知）、详情抽屉
- 数据导出：审批实例、登录日志、操作日志、员工花名册，按当前筛选条件导出 Excel

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
| `VITE_PROXY_TARGET` | 业务接口代理目标（含附件与导出） | `http://127.0.0.1:8000` |
| `VITE_FILE_PROXY_TARGET` | 附件代理目标（仅老后端仍用 `/files` 时保留） | `http://127.0.0.1:8000` |
| `VITE_WS_PROXY_TARGET` | WebSocket 代理目标 | `ws://127.0.0.1:8000` |
| `VITE_FILE_BASE_URL` | 附件额外域名前缀，**新后端建议留空**（附件与接口同源） | 空 |
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
│  │  ├─ app/                 # App* 基础组件（页面容器/表格/表单弹窗/状态标签/图标选择器…）
│  │  ├─ charts/              # SVG 图表（趋势/环形/条形）
│  │  └─ workflow/            # 审批领域组件（详情/时间轴/表单渲染/附件…）
│  ├─ composables/            # useTable（列表分页）/ usePermission
│  ├─ directives/             # v-auth / v-perms / v-copy
│  ├─ layout/                 # 布局：双栏导航、导航栏、多标签、主区域
│  ├─ router/                 # 静态路由 + 后端菜单转动态路由
│  ├─ store/                  # app / user / permission / multiTags / settings
│  ├─ styles/                 # 设计令牌、Element Plus 覆盖、布局与工具类
│  ├─ utils/                  # http、dicts/dictStore、export、workflow、storage…
│  └─ views/                  # 页面（路径与后端菜单 component 一一对应）
│     ├─ system/              # user / role / menu / permission / dict / config / tenant / announcement
│     ├─ engine/              # workflow / instance / designer / form
│     ├─ hr/                  # dept / position / employee / invite / contacts
│     ├─ kb/                  # 文档库 / 分类管理
│     └─ log/                 # login / operation
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

### 平台能力

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/sys/dict/list` | 字典列表（`data.{ list, total }`） |
| GET | `/sys/dict/items?dictCode=` | 按编码取字典项（`data.{ dictCode, dictName, items }`） |
| GET | `/sys/dict/options?codes=a,b` | 批量取多项（`data.dicts[code] = items`） |
| POST / PUT / DELETE | `/sys/dict`、`/sys/dict/{id}` | 字典增删改（内置字典不可删） |
| POST / PUT / DELETE | `/sys/dict/item`、`/sys/dict/item/{id}` | 字典项增删改 |
| GET | `/sys/config/groups` | 参数分组（`data.groups[].{ code, name, count }`） |
| GET | `/sys/config/list?group=` | 分组下的参数列表 |
| POST | `/sys/config/batch` | 批量保存：`{ group, items: [{ configKey, configValue }] }` |
| GET | `/sys/config/public` | 无需管理权限的公开参数（站点名称、客服电话等） |
| GET | `/announcement/list` | 公告列表（含 `deptNames`、`targetCount`、`readCount`） |
| POST | `/announcement` | 发布公告：`{ title, content, deptIds }`，后端递归下发子部门 |
| POST | `/announcement/{id}/withdraw` | 撤回并清理已下发通知 |
| DELETE | `/announcement/{id}` | 删除（仅已撤回） |
| GET | `/sys/tenant/current` | 当前租户 |
| GET | `/sys/tenant/list` | 租户列表（平台管理员） |
| POST | `/sys/tenant` | 开通租户：租户 + 根部门 + 管理员账号 |
| PUT | `/sys/tenant/{id}` | 编辑租户（停用会作废该租户会话） |
| POST | `/sys/tenant/{id}/switch` | 切换租户视角（返回新 token，前端需重新登录态） |
| GET | `/sys/tenant/usage` | 用量与配额（不传 `tenantId` 即当前租户） |

### 知识库

企业文档全员可见、个人文件仅本人可见；附件复用签名地址机制，业务侧只存 fileId。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/kb/category/list` | 分类列表（平铺，前端按 `parentId` 组树） |
| POST / PUT / DELETE | `/kb/category`、`/kb/category/{id}` | 分类增删改（仅管理员） |
| GET | `/kb/doc/list` | 文档列表（`page/pageSize/keyword/categoryId/scope/mine`，返回 `cover` 封面签名地址） |
| GET | `/kb/doc/{id}` | 文档详情（含 `attachments` 签名地址） |
| POST / PUT / DELETE | `/kb/doc`、`/kb/doc/{id}` | 文档增删改（`fileIds` 绑定已上传附件） |
| POST | `/kb/doc/{id}/publish` | 发布到企业库（需 `kb:doc:publish`） |
| POST | `/kb/doc/{id}/archive` | 归档 / 取消归档 |
| POST | `/kb/doc/{id}/view` / `download` | 浏览 / 下载计数（download 返回签名地址） |

### 数据导出

导出接口直接返回 `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` 文件流，
**经过统一 http 封装会被当成 JSON 解包**，因此 `utils/export.ts` 使用独立 axios 实例请求，
并从 `Content-Disposition` 解析文件名（优先 `filename*=UTF-8''`）。

| 路径 | 说明 |
| --- | --- |
| `GET /export/workflow-instances` | 审批实例（支持 `status / keyword / mine / startAt / endAt`） |
| `GET /export/operation-logs` | 操作日志 |
| `GET /export/login-logs` | 登录日志 |
| `GET /export/hr-employees` | 员工花名册 |

### 附件

上传 `POST /common/file/upload` 返回 `data.file.{ id, fileName, fileUrl, fileSize, fileType }`。

**访问约定（重要）**：

1. `fileUrl` 是**带时效的签名地址**，形如 `/api/v1/common/file/{fileId}/raw?expire=1700000000&sign=...`，
   有效期由后端配置（默认 15 分钟）。可以直接用于 `<img src>` 或新窗口打开，无需额外携带 token。
2. **不要把 `fileUrl` 写进业务数据**（头像、表单字段、评论附件等）。需要长期引用时保存 `fileId`，
   展示前调用 `GET /common/file/{id}` 换取新的签名地址；审批详情与各列表接口已由后端自动完成重写，
   前端通常拿到的就是可用的签名地址。
3. 旧版 `/files/日期/文件名` 静态路径已关闭，未签名访问会被拒绝（401/403）。
4. 签名地址可被验证但不可伪造：缺参数、篡改 `sign`、超出 `expire` 均会返回业务错误。

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
3. 接口统一走 `src/api/*`，不要在页面里裸写 axios 路径（导出例外，见 `utils/export.ts`）。
4. 状态/枚举统一在 `src/utils/dicts.ts` 维护，禁止把后端英文码直接渲染；业务枚举用 `useDict(code)`。
5. 新增页面优先复用 `AppPage`、`AppSearchBar`、`AppDataTable`、`AppFormDialog`、`AppFormDrawer`；图标字段用 `AppIconPicker`，不要手输图标字符串。
6. **树形选择必须设置 `node-key`**：`el-tree-select` 开启 `show-checkbox` 后，勾选值的收集依赖 `node-key`，
   缺失时 `v-model` 会拿到 `[null]`（表现为标签空白、提交后提示未选择）。同理 `el-tree` 取值也要设。
7. **文件类字段不落库访问地址**：头像、附件一律存 `fileId`，展示时用接口返回的签名地址，
   否则签名过期后图片/附件必然失效。
8. **权限码必须与后端权限目录一致**：`hasAuth('xxx')` 里的码写错不会报错，只会让按钮永远不显示，
   新增/改名时请同步核对（超管因 `*:*:*` 不受影响，容易漏测）。
9. 前端隐藏按钮不等于授权：高风险操作（改系统参数、删日志、批量导出、发公告）后端同样会校验权限码，
   前端只需保证体验一致，不要把权限当成安全边界。

---

## 权限码对照

按钮权限码由后端权限目录下发，前端仅做展示控制；**写错不会报错，只会让按钮永久隐藏**。
非超管账号的可见性完全取决于角色是否勾选了对应权限。

| 模块 | 编码 |
| --- | --- |
| 账号 | `sys:user:add` / `edit` / `delete` / `resetPwd` / `assignRole` / `status` / `superSwitch` |
| 角色 | `sys:role:add` / `edit` / `delete` / `assignMenu` / `assignPermission` |
| 菜单 / 权限 | `sys:menu:add` / `edit` / `delete`、`sys:permission:add` / `edit` / `delete` |
| 字典 | `sys:dict:add` / `edit` / `delete` |
| 系统参数 | `sys:config:add` / `edit` / `delete` |
| 租户 | `sys:tenant:add` / `edit` / `switch` |
| 公告 | `sys:announcement:publish` / `withdraw` / `delete` |
| 流程 / 表单 | `engine:workflow:add` / `edit` / `delete`、`engine:form:add` / `edit` / `delete` |
| 知识库 | `kb:category:add` / `edit` / `delete`、`kb:doc:add` / `edit` / `delete` / `publish` |
| 部门 | `hr:dept:add` / `edit` / `delete` |
| 职位 | `hr:post:add` / `edit` / `delete` |
| 员工 | `hr:employee:add` / `edit` / `delete` / `account`（分配账号） |
| 邀请码 | `hr:invite:add` / `edit` / `delete` |
| 日志 | `system:login:delete`、`system:operation:delete` |
| 导出 | `engine:instance:export`、`system:login:export`、`system:operation:export`、`hr:employee:export` |

超管拥有 `*:*:*` 时前端 `hasAuth` 直接放行，因此**用超管账号测不出权限码写错**，
排查非超管账号看不到按钮时，首先比对这里的编码与后端权限目录是否一致。

---

## 部署

```bash
pnpm build
# 将 dist/ 上传到服务器目录，参考 nginx.conf
```

`nginx.conf` 已包含：SPA 回退、`index.html` 不缓存、`/static` 强缓存、`/api/v1`、`/swagger`、`/api.json` 与 WebSocket 代理、gzip。

要点：附件与导出均走 `/api/v1`，**不再依赖 `/files` 静态目录**；若对接的是旧版后端，
才需要额外保留 `/files` 代理。静态资源缓存建议使用 `Cache-Control: private`，
避免共享缓存保留他人附件。

---

## 常见问题

**登录后菜单是空的？**
检查 `/sys/menu/user` 是否返回菜单树，以及菜单 `component` 是否能在 `src/views` 中找到对应文件；控制台会输出 `[router] 未找到视图组件` 的告警。

**多标签页切换后页面状态丢失？**
确认路由 `name` 与组件 `name` 一致；不一致时 keep-alive 无法命中。

**附件打不开？**
1. 确认使用的是接口下发的 `fileUrl`（签名地址 `/api/v1/common/file/{id}/raw?...`），而不是历史的 `/files/...` 路径；
   旧静态路径已关闭，未签名访问会被拒绝。
2. 签名默认 15 分钟过期，长时间停留在页面上再次点击附件可能失效，刷新页面即可重新获取。
3. 二次开发时不要把 `fileUrl` 存入数据库（包括头像、表单字段），应存 `fileId`，否则过期后必然破图。

**非超管账号看不到某个按钮？**
先比对 [权限码对照](#权限码对照) 里的编码与后端权限目录是否一致，再看角色是否勾选了该权限。
编码写错时接口与页面都不会报错，只是永远不显示。

**接口返回 401 后整页退出？**
http 层对 401 统一清理会话；检查 token 是否过期、后端会话是否被其他设备顶替（并发会话限制）。

---

## License

[MIT](LICENSE)

截图与演示数据仅用于展示界面能力，不含真实业务信息。
