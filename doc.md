# new-web 重构说明

`tcy-fronted/web` 的重构版本：剔除 pure-admin 脚手架，基于 **Element Plus 二次定制** 独立实现。
设计语言为「飞书交互质感 + 政企沉稳配色」，**业务逻辑与接口对接保持不变**。

## 运行

```bash
cd new-web
pnpm install
pnpm dev        # http://localhost:8849
pnpm typecheck  # vue-tsc 类型检查
pnpm build      # 类型检查 + 构建
```

开发代理（`vite.config.ts`，可用 `.env.development` 覆盖）：

| 前缀 | 用途 | 默认目标 |
| --- | --- | --- |
| `/api/v1` | 业务接口 | `http://xxx:6886` |
| `/ws` | WebSocket | `ws://127.0.0.1:8080` |
| `/files` | 附件 | `http://xxx:8080` |

端口与旧工程（8848）错开，可并行运行做视觉与功能对照。

## 硬约束（改动前必读）

1. `src/views/**` 目录与文件名必须与旧工程一致 —— 后端 `sys_menus.component` 存的是路径片段，通过 `import.meta.glob("/src/views/**/*.{vue,tsx}")` 匹配，路径变化会导致菜单白屏。
2. 每个视图的组件名必须与旧工程一致（如 `SystemUser`）—— keep-alive 通过后端菜单 `name` 匹配组件名。
3. `src/api/*` 的 URL、方法、入参、返回类型不得修改。
4. `src/utils/http/index.ts` 中 `code 50/51/52/53/54` 视为业务错误、其余视为成功；`baseURL` 固定 `/api/v1`。
5. 本地存储 key 保持 `authorized-token`、`multiple-tabs`、`user-info`，切换部署时用户态可平滑。

## 目录结构

```
src/
  api/                    接口层（自旧工程迁移，零改动）
  assets/icons/index.ts   本地图标注册表（替代旧 ReIcon/data.ts 全量图标）
  components/app/         基础组件：AppIcon/AppPage/AppSearchBar/AppDataTable
                          AppFormDialog/AppFormDrawer/AppStatusTag/AppUserAvatar
                          AppEmpty/AppDetailSection
  composables/            useTable / usePermission
  config/                 platform-config.json 读取
  directives/             v-auth / v-perms / v-copy
  layout/                 外壳：AppSidebar / AppNavbar / AppTagsView / AppMain
  router/                 静态路由 + 动态路由生成（迁移自旧工程）
  store/                  app / settings / user / permission / multiTags
  styles/                 设计系统（见下）
  utils/                  http / auth / websocket / helpers / storage 等
  views/                  业务页面（路径与旧工程 1:1）
```

## 设计系统

- `styles/tokens.scss`：唯一色彩与尺寸来源（`--app-*`）。品牌色 `#1F5AE0`，侧边栏深藏青 `#172029`，页面底色 `#F5F6F8`。
- `styles/element/vars.scss`：把设计令牌映射到 Element Plus CSS 变量，主题色 5 档色阶由 SCSS `color.mix` 精确生成。
- `styles/element/*.scss`：form / button / table / pagination / dialog / overlay / misc 组件级二次定制。
- `styles/layout/*.scss`：侧边栏、顶栏、标签页外壳样式。
- `styles/utilities.scss`：`.app-card`、`.app-toolbar`、`.app-text--*` 等语义类。

**样式纪律**：模板中禁止内联 `style` 与魔法色值；禁止 `!important`（Element 覆盖层除外）；Tailwind 仅用于布局工具类（flex/grid/gap/宽高/文本截断），不得用于颜色、阴影、圆角。

## 基础组件约定

- 列表页：`AppPage` + `AppSearchBar` + `AppDataTable`（内置批量栏与分页）+ `useTable`
- 表单页：`AppFormDialog` / `AppFormDrawer`，footer 按钮与 loading 由组件统一托管
- 状态展示：`AppStatusTag`（字典驱动），头像：`AppUserAvatar`（首字色块，颜色按姓名哈希稳定）
- 图标：`<AppIcon icon="ep:search" />`，新增图标需在 `assets/icons/index.ts` 注册

## 与旧工程的差异（有意为之）

| 项 | 旧实现 | 新实现 |
| --- | --- | --- |
| 脚手架 | vue-pure-admin（@pureadmin/*） | 无纯前端脚手架依赖，工具函数自研 |
| 布局 | vertical / mix / horizontal 三套 | 仅保留垂直布局，侧边栏 232/64 可折叠 |
| 主题 | 系统设置面板、暗黑模式、主题色切换 | 移除，固定为政企配色单主题 |
| 图标 | `ReIcon/data.ts`（3869 行全量数据） | 按需注册的图标表（约 90 个） |
| 表格 | `el-table` 与 `PureTable` 混用 | 统一 `AppDataTable` |
| 标签页 | lay-tag（683 行 + 371 行 SCSS） | 重写为 `AppTagsView` + 右键菜单 |
| 设置面板 | `lay-setting`（636 行）、`useDataThemeChange` | 删除 |
| 动画 | animate.css + @vueuse/motion + 花哨 hover | 统一 160/200ms 过渡，去掉位移/缩放类特效 |

## 阶段进度

- **M1（已完成）**：工程基座、设计系统、Layout、10 个基础组件、`useTable`/`usePermission`、逻辑层迁移、样板页（登录 / 工作台 / 账号管理 / 个人资料 / 错误页）
- **M2（已完成）**：审批工作流
  - 审批中心 `views/engine/instance/index.vue`：6 个 Tab（我发起 / 待办 / 已办 / 抄送 / 已通过 / 已取消）、按 Tab 独立筛选与分页、卡片摘要、待办快捷同意/拒绝、路由 query 直达
  - 审批详情 `components/workflow/ApprovalDetail.vue`：左右分栏（申请信息 + 评论 / 流程进度）、同意、拒绝、撤销、重新发起、打印、抄送自动已读
  - 子组件：`ApprovalTimeline`（节点/审批人/转派链/审批附件）、`ApprovalComments`（评论 + 附件）、`FormFieldDisplay`（10 类字段只读展示）、`WorkflowFormRenderer`（表单填写）、`AttachmentUpload`、`UserSelectDialog`
  - 发起审批 `WorkflowLaunchDialog`：选流程 → 填表单 → 调整审批人/抄送人 → 本地草稿
  - 流程管理 `views/engine/workflow/index.vue`：CRUD、启用开关、复制、设计入口
  - 流程设计器 `views/engine/designer/index.vue`：vue-flow 画布、节点库、节点属性面板（审批方式/审批人/抄送人/条件）、保存 processConfig
  - 表单设计器 `views/engine/form/index.vue`：字段库、字段排序、属性面板（选项/列/单位/大写金额）、预览、保存 formConfig
- **M3（已完成）**：
  - 系统管理：`system/role`（含菜单授权、权限授权）、`system/menu`（树形菜单 + 表单）、`system/permission`
  - 人事：`hr/dept`（组织树）、`hr/position`、`hr/invite`（邀请码生成与复制）、`hr/employee`（档案 + 分配账号）、`hr/contacts`（通讯录）
  - 日志：`log/login`、`log/operation`（筛选 + 批量删除）
  - 权限演示：`permission/button`（v-auth 与 `usePermission`）、`permission/page`（菜单级权限说明）
- **M4（代码侧已完成，运维侧待执行）**：已提供 `new-web/nginx.conf`（SPA 回退、静态强缓存、接口/附件/WebSocket 代理、gzip）；待执行：接后端账号做全量回归、灰度切换与旧工程下线
- **M4 补充（本轮已完成）**：菜单图标补齐、表单必填校验、弹窗/抽屉关闭按钮几何修复、个人中心（资料 + 改密）完整实现
- **第四轮（已完成）**：后端补齐日志与看板接口；首页改为可视化看板；状态枚举全面中文化；演示公司数据
- **第五轮（已完成）**：流程/表单复杂度、附件与抄送、审批中心收件箱式重构、审批详情增强
- **第六轮（已完成）**：双栏导航重构（飞书式）、折叠图标常显、开源 README + 截图
- **第七轮（已完成）**：登录页按原型重做（主视觉 / 卡片 / 帮助弹窗 / 移动端）

## M1-M3 已验证

- `pnpm typecheck`、`pnpm build` 通过；构建产物已按页面拆分 chunk
- 登录页浏览器实测：渲染正常、控制台 0 报错 0 警告、账号/申请账号切换可用
- 未登录访问 `/engine/instance/index` 被守卫重定向到 `/login`，未知路由同样回到登录页
- 待后端联调验证：动态菜单渲染、多标签页增删与刷新、各页面 CRUD、审批全链路（发起 → 同意/拒绝 → 撤销 → 重新发起）、流程/表单设计器保存

## 已知取舍

1. 审批打印采用新窗口 + 结构化 HTML 直接调用 `window.print()`，替代旧 `WorkflowPrintDialog`（1171 行）与 `print-js` 依赖，打印内容涵盖标题、审批编号、表单字段与审批记录。
2. 公告详情未接入独立接口（旧代码引用的 `getAnnouncementDetail` 在 API 层并不存在），改为直接展示通知正文。
3. 密码强度改为按长度分 4 档提示，不再引入 `@zxcvbn-ts/core`。
4. 流程设计器为功能性重写：支持节点增删、连线、审批人/抄送人配置与保存；旧版的自动布局算法与条件表达式可视化编辑未移植。
5. 表单设计器采用「字段库 + 字段列表 + 属性面板」三栏结构，未移植旧版的画布拖拽与栅格布局。

## 权限码对照

按钮权限统一使用后端已配置的编码（与旧工程一致），新增页面务必对齐，否则非超管账号会看不到按钮：

| 模块 | 编码 |
| --- | --- |
| 账号 | `sys:user:add` / `edit` / `delete` / `resetPwd` / `assignRole` / `status` / `superSwitch` |
| 角色 | `sys:role:add` / `edit` / `delete` / `assignMenu` / `assignPermission` |
| 菜单 / 权限 | `sys:menu:*`、`sys:permission:*` |
| 流程 / 表单 | `engine:workflow:*`、`engine:form:*` |
| 部门 | `hr:dept:add` / `edit` / `delete` / `list` |
| 员工 | `hr:employee:add` / `edit` / `delete` / `list` |
| 职位 | `hr:position:add` / `edit` / `delete` |
| 邀请码 | `hr:invitation:add` / `edit` / `delete` |
| 日志 | `system:login:delete`、`system:operation:delete` |

超管拥有 `*:*:*` 时默认具备全部权限。

## 菜单名与组件名对照

keep-alive 通过「后端菜单 name」匹配「组件 name」，两者必须一致，否则页面不会被缓存：

| 路由路径 | 后端菜单 name | 组件 defineOptions |
| --- | --- | --- |
| `/system/user/index` | SystemUser | SystemUser |
| `/system/role/index` | SystemRole | SystemRole |
| `/system/menu/index` | SystemMenu | SystemMenu |
| `/system/dict/index` | EnginDict | EnginDict |
| `/system/permission/index` | SystemPermission | SystemPermission |
| `/engine/workflow/index` | EngineWorkFlow | EngineWorkFlow |
| `/engine/instance/index` | EngineInstance | EngineInstance |
| `/engine/designer/index` | EngineDesigner | EngineDesigner |
| `/engine/form/index` | EngineForm | EngineForm |
| `/hr/position/index` | POSITION | POSITION |
| `/hr/dept/index` | DEPT | DEPT |
| `/hr/invite/index` | INVITE | INVITE |
| `/hr/employee/index` | EMPLOYEE | EMPLOYEE |
| `/docs` | swaggerDocs | swaggerDocs |

新增菜单时请保持这套命名约定。

## 端到端验证结果（本地后端联调）

测试账号：`oa_tester` / `Oa@123456`（超级管理员，已在本地 oa_db 创建，并绑定员工档案与主部门）

环境：Postgres `127.0.0.1:5432/oa_db` + 后端 `:8000` + Vite dev `:8849`（`.env.development` 已指向本地后端）

已验证通过：

| 项 | 结果 |
| --- | --- |
| 登录 → 工作台 | 成功，展示真实统计与 11 个快捷流程 |
| 动态菜单 | 4 个根节点（系统/审批/人事/接口文档）正确渲染，图标与层级正常 |
| 审批中心 | 6 个 Tab、筛选、刷新、空态正常；标签页/面包屑随路由更新 |
| 账号管理 | 真实 15 条数据、分页、角色标签、状态开关、行内操作均正常 |
| 员工管理 | 多部门标签（主部门/兼任）、职位、手机号、在职状态均正常展示 |
| 流程管理 | 真实流程定义、分组、关联表单、节点数、启用开关均正常 |
| 审批详情（审批中） | 申请信息（六类字段）、流程进度（发起→审批→抄送）、评论编辑区、撤销/重新发起/打印按钮均正常 |
| 审批链路 | 发起 → 待办任务 → 同意 → 实例状态 `approved`；详情页状态变「已通过」，时间轴展示审批人与「已同意」及审批意见 |
| 接口冒烟 | 11 个列表接口（流程/表单/员工/部门/职位/邀请码/角色/菜单/权限/待办/我发起）全部 code=0 |
| 控制台 | 0 error / 0 warn |

验证截图：`shots/welcome.png`、`shots/approval.png`、`shots/approval-detail.png`、`shots/approval-approved.png`、`shots/hr-employee.png`、`shots/engine-workflow.png`、`shots/system-role.png`、`login-desktop.png`（已在 .gitignore 中忽略）。

尚未逐页验证（代码已实现、接口已通）：角色/菜单/权限的弹窗交互、员工/部门/职位/邀请码的增删改弹窗、流程与表单设计器保存、日志页渲染、设计器画布拖拽。
## 第二轮验收（puppeteer 真实点击）

用 `puppeteer-core` 驱动本机 Edge 完成真实点击验证（测试脚本为临时文件，验收后已删除）：

| 页面 / 场景 | 断言结果 |
| --- | --- |
| 登录（表单填写 + 点击） | 跳转 `/welcome`，工作台渲染 |
| 系统 / 用户管理 | 10 行数据；「新增账号」弹窗可打开、含输入项 |
| 系统 / 角色管理 | 2 行数据（备注列正确）；「菜单授权」弹窗渲染 17 个树节点 |
| 系统 / 菜单管理 | 17 行，树形层级与类型/路径/组件列均正确 |
| 系统 / 权限管理 | 10 行，权限名称/编码/状态/更新时间正确 |
| 人事 / 部门 / 职位 / 邀请码 / 员工 | 分别为 16 / 10 / 3 / 10 行，字段与多部门标签正常 |
| 通讯录 | 15 张人员卡片 |
| 日志 / 登录、操作 | 页面渲染正常；后端无 `/logs/*` 接口（404），页面显式提示 |
| 权限演示（按钮/页面） | 渲染正常，权限码核对列表可读 |
| 流程设计器 | 4 节点 / 3 连线加载；点选节点出属性面板；**保存成功**；回读 `processConfig` 4 节点均含 `position`，`startNodeConfig` 保留 `allowResubmit/allowWithdraw` |
| 表单设计器 | 打开抽屉；添加「单行文本」→ 保存；API 回读 `fields` 长度为 1，字段名/类型/标题正确 |
| 角色 CRUD | 新增 → 列表出现 → 删除 → 列表消失；toast 与接口均成功；0 控制台报错 |

构建产物对比（M4）：

| 维度 | 旧工程 web/dist | 新工程 new-web/dist |
| --- | --- | --- |
| 总大小 | 11.63 MB | 1.94 MB（-83%） |
| 文件数 | 154 | 70 |
| JS chunk 数 | 99 | 41 |

第二轮修复的缺陷：
1. **目录节点抢子页面组件** —— 父级（字典管理）挂上页面组件后吞掉子页面（权限管理）。已在 `router/utils.ts` 中改为：有子路由的节点不挂载页面组件，让子路由直接在 Layout 渲染；
2. **视图缺失白屏** —— 新增 `views/error/missing.vue` 兜底页，并在控制台告警缺失的视图路径；
3. **设计器 Uuid 被强转 Number** —— 导致 `/workflow/definition/NaN` 加载失败；改为字符串传参；
4. **设计器 schema 不匹配** —— 节点坐标需写入 `position` 对象，且要保留 `allowResubmit/allowWithdraw` 等未暴露字段；已改为「展开原始节点 + 覆盖编辑项」；
5. **菜单接口 snake_case** —— `parent_id / menu_type / show_link / keep_alive`，原实现用 camelCase 导致树形丢失，已重写菜单页；
6. **角色备注字段** —— 后端为 `remark`（非 description）；
7. **权限字段** —— 后端为 `permissionName / permissionKey`（非 name/code/description），已修正列表与表单，并同步修复角色「权限授权」树的取值；
8. **日志页无接口时静默空白** —— 新增 404 识别与顶部提示。

本地库演示数据（云启软件）：`sys_users` 中 29 个账号，统一密码 `123456`（`admin` 为超管），员工档案与部门关系由 `demo_seed_company.sql` 重建；该脚本会清空审批/通知/日志等演示数据，保留菜单、角色、权限与流程定义。

### 首轮修复的页面缺陷

1. 叶子菜单点击丢失自身 path（导致点「审批中心」实际打开「工作流管理」）——已修正 `MenuItem.vue` 的 `menuIndex` 计算；
2. 关闭当前标签页未回退——已在 `AppTagsView/index.vue` 中补充当前页判定与相邻标签回退；
3. 员工表单部门字段与后端契约不符（后端为 `departments[]` 多对多）——改为「主部门 + 兼任部门」提交 `departments` 数组；
4. 菜单中指向的「字典管理」「Swagger 接口文档」在旧工程也无对应页面——新增 `system/dict`（说明页）与 `docs`（内嵌 Swagger）避免白屏，并为 `/swagger`、`/api.json` 补充 Vite 与 Nginx 代理。

## 第三轮验收（图标 / 必填校验 / 弹窗几何 / 个人中心）

本轮针对反馈的四个问题做修复，并用 `puppeteer-core` 驱动本机 Edge（1440×900）真实点击验证：

| 问题 | 修复 | 验收证据 |
| --- | --- | --- |
| 菜单大量图标空白 | 核对后端菜单实际使用的 16 个图标，补齐 `ep:box / ep:chrome-filled / ep:flag / ep:wallet-filled`、`ri:account-pin-box-line / ri:codepen-fill / ri:flow-chart`、`fa-solid:book / church / pallet / paper-plane / qrcode`（新增依赖 `@iconify-icons/fa-solid`）；`AppIcon` 对未注册图标提供兜底 | 注册表 92 个图标、对菜单图标缺失 0；DOM 中 16 个菜单项 svg 均含 path；`shots/v2-01-menu-icons.png` |
| 必填项不填也能提交 | `WorkflowFormRenderer` 根据字段 `required` 生成校验规则（含多选/上传/子表的空数组判定），并补上 `el-form-item :prop`；发起审批、重新发起提交前调用 `validate()`，失败阻断 | 请假申请 6 字段 4 必填：点「提交审批」后 4 条行内错误、抽屉不关闭、提示「请先完善必填项」；`shots/v2-03-required-validation.png` |
| 弹窗关闭按钮偏离、元素偏移 | 原样式将 `el-dialog__headerbtn` 强制为 `top:50%`，且被 body 覆盖；改为绝对定位 `top/right:14px` + `z-index:3`，标题右侧留 52px；抽屉关闭按钮同规则 | 关闭按钮 28×28 @ (938,289)，位于 520px 弹窗右上角内 14px；`shots/v2-02-role-dialog.png` |
| 个人中心仅有只读占位 | 重写 `views/profile/index.vue`：资料卡 + 基本资料（姓名/工作手机/性别/住址/头像）+ 安全设置（当前密码/新密码/确认）+ 账号信息，对接自助接口 `PUT /hr/employee/profile` | 保存资料成功提示；错误当前密码返回「当前密码错误」且密码未被修改；`shots/v2-04-profile.png`、`v2-05-profile-security.png` |

同期修复：

1. 编辑用户时密码不再强制必填（`editRules` 改为计算属性，仅新增时必填）；
2. `message` 默认 `offset` 由 20 调至 68，避免提示压住 56px 导航栏；
3. 个人资料保存 / 改密失败不再二次弹提示（错误提示统一由 http 层处理）；
4. 本地新建超管 `admin / 123456`（`is_super=true`，已绑定员工档案 `ADMIN-001` 与主部门），可直接登录验收。

## 第四轮：后端补齐 + 首页看板 + 状态中文化

### 后端新增（tcy-backend）

| 能力 | 实现 |
| --- | --- |
| 登录日志 | 表 `sys_login_logs`；`POST/DELETE /logs/login`；登录成功与失败（用户不存在/禁用/未激活/密码错误）自动落库，记录 IP、浏览器、操作系统 |
| 操作日志 | 表 `sys_operation_logs`；`POST/DELETE /logs/operation`；`middleware.OperationLog` 拦截所有 POST/PUT/PATCH/DELETE（跳过 `/logs/*` 与登录），记录模块、动作、摘要、耗时、UA、结果 |
| 首页看板 | `GET /dashboard/overview?days=14`：在职人数、部门数、本月发起/完成、审批中、通过率、今日发起、未读通知 + 趋势/状态分布/部门人数/流程排行/最近 8 条审批 |
| 迁移脚本 | `manifest/sql/20261029_sys_logs.sql`（建表+索引）、`20261029_demo_menus.sql`（启用菜单、补日志与通讯录入口） |
| 演示数据 | `manifest/sql/demo_seed_company.sql`：云启软件 11 部门 / 19 职位 / 29 账号（密码 123456）/ 120 条审批（5 种状态）/ 120 任务 / 84 审批历史 / 102 抄送 / 50 通知 / 150 登录日志 / 240 操作日志 |

### 前端

- 新增 `api/dashboard.ts` 与 `components/charts/{TrendChart,DonutChart,BarList}.vue`（纯 SVG 手写，不引入 echarts，产物体积不膨胀）
- 首页重写为看板：KPI 指标条 + 审批趋势（双序列面积/折线 + 悬浮提示）+ 状态分布环形图 + 部门人数 + 流程排行 + 最近审批动态 + 快捷发起
- 新增 `utils/dicts.ts`：流程/任务/节点状态、审批动作与方式、节点类型、性别、在职状态、启停、通知类型、日志结果、菜单类型；`dictMeta`/`dictText` 未命中统一回退「未知状态」，**不再把英文码直接渲染给用户**
- 修复英文泄露点：`in_progress` 等缺失映射（审批中心列表、审批详情、审批时间线、打印页审批人状态）
- 修复 http 白名单 bug：原先 `config.url.endsWith("/login")` 会把 `/logs/login` 当成登录接口而不带 token，导致登录日志页 401 并触发全局登出；改为仅精确匹配 `/auth/login`、`/auth/refresh-token`，并修正过期判断字段为 `expires`
- 日志页对接真实接口，移除 404 占位提示；操作日志「操作模块」改为下拉筛选、「耗时」兼容 `duration`

### 验收（puppeteer 真实点击，1440×900）

| 页面 | 结果 |
| --- | --- |
| 首页看板 | KPI 29 / 117 / 78 / 85%；趋势 14 点双序列；状态分布 120 条 5 类；部门 8 行；流程 6 行；最近 8 条；快捷 8 个 |
| 审批中心（待办） | 11 条待办，状态标签均为中文 |
| 登录日志 | 10 行 / 共 152 条，分页正常，无 404 提示 |
| 操作日志 | 10 行 / 共 240 条，模块与内容均为中文 |
| 通讯录 | 29 张员工卡片 |
| 英文状态泄露扫描 | welcome / instance / loginLog / operationLog 四页均 0 命中 |
| 控制台 | 0 error |

## 第五轮：复杂流程、复杂表单与审批中心重构

### 后端

- 5 条流程定义改为多节点：串行（ORDER_SIGN）、会签（ALL_SIGN）、或签（ANY_SIGN）、条件分支（金额 ≥5000 走总经理审批）、抄送节点；请假 3 节点、报销 3 节点 + 条件分支，加班/用印/通用 2 节点
- 表单升级：请假 12 字段、报销 12、加班 9、用印 9、通用 8，覆盖单行/多行/数字/金额大写/日期/日期区间/单选/多选/下拉/开关/子表格/附件上传
- 120 条实例重建为 **384 条多节点任务、312 条审批历史、96 条抄送**；运行中状态统一为 `running`（与后端 consts 对齐），会签节点支持「1/2 已处理」的半完成态
- 实例/任务列表接口补充：流程分组、当前节点、当前待处理人、节点进度（completed/total）、附件数、抄送人、节点审批方式
- 时间轴按流程配置顺序输出（修复原先 map 遍历导致的乱序），并新增节点开始时间（用于耗时展示）

### 前端

- 审批中心重构为「收件箱」双栏：左侧按时间分组（今天/昨天/近7天/更早）的紧凑卡片（状态色条、流程/分组/发起人/时间、金额/会签/附件/进度 chips、当前节点与待处理人），右侧为内联预览（统计条、申请内容、附件、流程进度、同意/拒绝/查看详情），列表自动选中首条
- 审批详情抽屉：节点徽章（审批/抄送 + 会签/或签/顺序审批）、会签进度（x/y 已处理）、节点耗时、当前节点高亮、抄送人已读状态；「重新发起」仅对已驳回/已撤销可见
- 修复附件链路：开发环境 `VITE_FILE_BASE_URL` 置空、Vite `/files` 代理不再重写前缀，附件可预览/下载

### 验收（puppeteer 真实点击，1600×1000）

| 项 | 结果 |
| --- | --- |
| 待办收件箱 | 18 条待办，分 4 个时间组；激活卡片 chips：¥12,377 / 串行 / 1 个附件 / 节点 1/2 |
| 内联预览 | 3 节点时间轴（发起 → 部门负责人会签 2/2 → 分管领导审批），会签人状态、耗时 2.4 小时 / 1 天 |
| 详情抽屉 | 同意/拒绝/打印可用；徽章「审批·会签」「审批·顺序审批」；无英文泄露 |
| 快捷同意 | 待办 18→17，列表刷新并自动选中下一条 |
| 附件 | `GET /files/20251103/ddywy9t18ovwjnc5sd.xls` → 200，71,680 字节 |

## 第六轮：双栏导航与开源文档

### 导航重构

- 废弃 el-menu 递归渲染，改为「一级图标栏 + 二级菜单面板」：rail 72px（图标 + 两行短标题）、panel 208px（模块标题 + 圆形收起按钮 + 胶囊式二级项）
- 选中态：rail 与 panel 均为主色实心圆角块 + 白字；模块切换时自动高亮当前模块、子项按路由精确高亮
- 折叠：只保留 rail，panel 宽度置 0；直接使用 AppIcon 渲染图标，**不再依赖 el-menu collapse，根治折叠后图标丢失**；折叠态点击一级模块自动展开面板
- 模块匹配增加兜底：菜单树中隐藏的页面（如流程设计器）按一级路径段归属模块，避免高亮回到「首页」
- 删除 `AppSidebar/MenuItem.vue`、`AppSidebar/Logo.vue` 及旧 `--app-sidebar-*` 深色令牌，新增 `--app-nav-*` 令牌

### 开源文档

- 新增 `README.md`：功能特性、技术栈、快速开始、目录结构、后端接口契约（说明仅开源前端）、设计系统、工程约定、部署与 FAQ
- 新增 `LICENSE`（MIT）与 `docs/screenshots/`（9 张 1600×1000 实拍截图，不受 `shots/` 忽略规则影响）

### 验收

| 项 | 结果 |
| --- | --- |
| 展开态 | 侧边栏 280px（rail 72 + panel 207），5 个一级模块图标 20~25px |
| 折叠态 | 侧边栏 72px、panel 0px，**5 个图标均正常渲染** |
| 子菜单高亮 | 导航到 `/system/role/index` 后「系统管理」+「角色管理」双高亮 |
| 折叠后再点一级模块 | 自动展开面板并切到对应模块 |
| 控制台 | 0 error |

## 第七轮：登录页原型重做

### 视觉结构

- 左侧品牌区：以 `public/1.png` 为主视觉，叠加左深右透蓝色渐变；Logo + 「协同审批，让组织运转更高效」+ 三特性（流程进度/组织权限/消息通知，玻璃质感图标框）+ 浏览器建议
- 右侧登录区：顶部语言与帮助入口、白底圆角登录卡片、双 Tab（账号登录/申请账号）、带前缀图标的大尺寸输入框、记住密码/忘记密码、蓝色主按钮（含箭头）、协议提示与底部链接
- 弹窗：帮助中心 / 关于我们（内嵌 `public/2.png` 能力图）/ 隐私政策 / 使用条款 / 忘记密码，避免死链
- 响应式：≤1080px 隐藏品牌区并展示紧凑 Logo；≤560px 卡片去阴影、表单单列

### 功能保留

登录/申请账号全部原逻辑不变（校验、记住密码、会话初始化、WebSocket、失败提示）；额外补充账号必填校验，且隐藏必填星号以贴合原型。

### 验收

| 项 | 结果 |
| --- | --- |
| 1600×1000 | 品牌区 960px / 登录区 640px，卡片 460×555，三特性正常 |
| 背景 | `1.png` 正常加载（BASE_URL 拼接，生产子路径也可用） |
| 申请账号 Tab | 字段完整，输入框与下拉同高 |
| 忘记密码 | 弹窗正常，文案提示联系管理员重置 |
| 登录 | admin / 123456 → `/welcome` |
| 移动端 390×844 | 隐藏品牌区、卡片 358px、无横向溢出 |
| 控制台 | 0 error |

## 本地后端启动（可选）

后端仓库已准备一份本地配置（仅文件地址差异，未修改原有 `config.yaml`）：

```bash
# 1) 本地 Redis（若 6379 已被占用，用 6380）
docker run -d --name oa_redis_local -p 6380:6379 redis:7-alpine

# 2) 启动后端（使用 manifest/config/config.local.yaml）
cd tcy-backend
$env:GF_GCFG_FILE='config.local.yaml'   # Windows PowerShell
./main_local.exe
```

注：`main_local.exe` 为本地构建产物（`go build -o main_local.exe main.go`，因为 `build_docker.go` 与 `main.go` 同为 package main，不能直接 `go build .`），可随时删除后重新构建。

## 部署

1. `pnpm build` 产出 `dist/`；
2. 将 `dist` 上传到服务器目录（参考 `nginx.conf` 中的 `root` / `www/new-web`）；
3. 使用仓库内 `new-web/nginx.conf`：按环境调整 `listen` 端口与 `set $backend` 后端地址；
4. 关键点：`/api/v1` 与 WebSocket 需转发到同一后端；`index.html` 不缓存、`/static/` 强缓存；SPA 回退到 `index.html`。

灰度切换建议：新旧工程使用不同端口（旧 10085、新 10086），通过上游负载或域名分流逐步切流量，回滚只需切回旧端口。
