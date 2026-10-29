import { addIcon } from "@iconify/vue/dist/offline";

/**
 * 本地图标注册表
 * 说明：
 * 1. 后端 sys_menus.icon 返回的图标字符串必须在此注册，否则菜单图标不渲染；
 * 2. 组件/页面中通过 <AppIcon icon="ep:search" /> 使用，保持离线可用；
 * 3. 新增图标时按「图标集:名称」的 key 注册即可，替代原 pure-admin 的全量 data.ts 方案。
 */

/* ========== 菜单图标（后端返回） ========== */
import EpMenu from "@iconify-icons/ep/menu";
import EpEdit from "@iconify-icons/ep/edit";
import EpSetUp from "@iconify-icons/ep/set-up";
import EpGuide from "@iconify-icons/ep/guide";
import EpMonitor from "@iconify-icons/ep/monitor";
import EpLollipop from "@iconify-icons/ep/lollipop";
import EpHistogram from "@iconify-icons/ep/histogram";
import EpHomeFilled from "@iconify-icons/ep/home-filled";
import RiBookmark from "@iconify-icons/ri/bookmark-2-line";
import RiFilePpt from "@iconify-icons/ri/file-ppt-2-line";
import RiBankCard from "@iconify-icons/ri/bank-card-line";
import RiAdminFill from "@iconify-icons/ri/admin-fill";
import RiFileInfo from "@iconify-icons/ri/file-info-line";
import RiGitBranch from "@iconify-icons/ri/git-branch-line";
import RiLinks from "@iconify-icons/ri/links-fill";
import RiTable from "@iconify-icons/ri/table-line";
import RiSearchLine from "@iconify-icons/ri/search-line";
import RiAdmin from "@iconify-icons/ri/admin-line";
import RiSettings3 from "@iconify-icons/ri/settings-3-line";
import RiMindMap from "@iconify-icons/ri/mind-map";
import RiBarChart from "@iconify-icons/ri/bar-chart-horizontal-line";
import RiWindow from "@iconify-icons/ri/window-line";
import RiFileSearch from "@iconify-icons/ri/file-search-line";
import RiArtboard from "@iconify-icons/ri/artboard-line";
import RiListCheck from "@iconify-icons/ri/list-check";
import RiUbuntu from "@iconify-icons/ri/ubuntu-fill";
import RiUserVoice from "@iconify-icons/ri/user-voice-line";
import RiEditBox from "@iconify-icons/ri/edit-box-line";
import RiHistory from "@iconify-icons/ri/history-fill";
import RiInformation from "@iconify-icons/ri/information-line";
import RiTerminal from "@iconify-icons/ri/terminal-window-line";
import RiCheckboxCircle from "@iconify-icons/ri/checkbox-circle-line";

/* ========== 通用操作图标 ========== */
import EpSearch from "@iconify-icons/ep/search";
import EpRefresh from "@iconify-icons/ep/refresh";
import EpPlus from "@iconify-icons/ep/plus";
import EpClose from "@iconify-icons/ep/close";
import EpCircleClose from "@iconify-icons/ep/circle-close";
import EpCircleCheck from "@iconify-icons/ep/circle-check";
import EpCheck from "@iconify-icons/ep/check";
import EpDelete from "@iconify-icons/ep/delete";
import EpEditPen from "@iconify-icons/ep/edit-pen";
import EpView from "@iconify-icons/ep/view";
import EpHide from "@iconify-icons/ep/hide";
import EpUpload from "@iconify-icons/ep/upload";
import EpDownload from "@iconify-icons/ep/download";
import EpPrinter from "@iconify-icons/ep/printer";
import EpCopyDocument from "@iconify-icons/ep/copy-document";
import EpMoreFilled from "@iconify-icons/ep/more-filled";
import EpTools from "@iconify-icons/ep/tools";

/* ========== 布局与导航图标 ========== */
import EpFold from "@iconify-icons/ep/fold";
import EpExpand from "@iconify-icons/ep/expand";
import EpArrowDown from "@iconify-icons/ep/arrow-down";
import EpArrowUp from "@iconify-icons/ep/arrow-up";
import EpArrowLeft from "@iconify-icons/ep/arrow-left";
import EpArrowRight from "@iconify-icons/ep/arrow-right";
import EpFullScreen from "@iconify-icons/ep/full-screen";
import EpBell from "@iconify-icons/ep/bell";
import EpSetting from "@iconify-icons/ep/setting";
import EpSwitchButton from "@iconify-icons/ep/switch-button";
import EpBack from "@iconify-icons/ep/back";
import EpRight from "@iconify-icons/ep/right";

/* ========== 业务与用户图标 ========== */
import EpUser from "@iconify-icons/ep/user";
import EpUserFilled from "@iconify-icons/ep/user-filled";
import EpAvatar from "@iconify-icons/ep/avatar";
import EpLock from "@iconify-icons/ep/lock";
import EpKey from "@iconify-icons/ep/key";
import EpUnlock from "@iconify-icons/ep/unlock";
import EpTimer from "@iconify-icons/ep/timer";
import EpDocument from "@iconify-icons/ep/document";
import EpFiles from "@iconify-icons/ep/files";
import EpFolder from "@iconify-icons/ep/folder";
import EpMessage from "@iconify-icons/ep/message";
import EpSelect from "@iconify-icons/ep/select";
import EpWarning from "@iconify-icons/ep/warning";
import EpInfoFilled from "@iconify-icons/ep/info-filled";
import EpCalendar from "@iconify-icons/ep/calendar";
import EpLink from "@iconify-icons/ep/link";
import EpGrid from "@iconify-icons/ep/grid";
import EpList from "@iconify-icons/ep/list";
import EpDataLine from "@iconify-icons/ep/data-line";

/* ========== 后端菜单实际使用、但早期未注册的图标 ========== */
import EpBox from "@iconify-icons/ep/box";
import EpChromeFilled from "@iconify-icons/ep/chrome-filled";
import EpFlag from "@iconify-icons/ep/flag";
import EpWalletFilled from "@iconify-icons/ep/wallet-filled";
import RiAccountPinBox from "@iconify-icons/ri/account-pin-box-line";
import RiCodepen from "@iconify-icons/ri/codepen-fill";
import RiFlowChart from "@iconify-icons/ri/flow-chart";
import FaBook from "@iconify-icons/fa-solid/book";
import FaChurch from "@iconify-icons/fa-solid/church";
import FaPallet from "@iconify-icons/fa-solid/pallet";
import FaPaperPlane from "@iconify-icons/fa-solid/paper-plane";
import FaQrcode from "@iconify-icons/fa-solid/qrcode";

const icons: Record<string, any> = {
  /* 菜单 */
  "ep:menu": EpMenu,
  "ep:edit": EpEdit,
  "ep:set-up": EpSetUp,
  "ep:guide": EpGuide,
  "ep:monitor": EpMonitor,
  "ep:lollipop": EpLollipop,
  "ep:histogram": EpHistogram,
  "ep:home-filled": EpHomeFilled,
  "ri:bookmark-2-line": RiBookmark,
  "ri:file-ppt-2-line": RiFilePpt,
  "ri:bank-card-line": RiBankCard,
  "ri:admin-fill": RiAdminFill,
  "ri:file-info-line": RiFileInfo,
  "ri:git-branch-line": RiGitBranch,
  "ri:links-fill": RiLinks,
  "ri:table-line": RiTable,
  "ri:search-line": RiSearchLine,
  "ri:admin-line": RiAdmin,
  "ri:settings-3-line": RiSettings3,
  "ri:mind-map": RiMindMap,
  "ri:bar-chart-horizontal-line": RiBarChart,
  "ri:window-line": RiWindow,
  "ri:file-search-line": RiFileSearch,
  "ri:artboard-line": RiArtboard,
  "ri:list-check": RiListCheck,
  "ri:ubuntu-fill": RiUbuntu,
  "ri:user-voice-line": RiUserVoice,
  "ri:edit-box-line": RiEditBox,
  "ri:history-fill": RiHistory,
  "ri:information-line": RiInformation,
  "ri:terminal-window-line": RiTerminal,
  "ri:checkbox-circle-line": RiCheckboxCircle,

  /* 通用操作 */
  "ep:search": EpSearch,
  "ep:refresh": EpRefresh,
  "ep:plus": EpPlus,
  "ep:close": EpClose,
  "ep:circle-close": EpCircleClose,
  "ep:circle-check": EpCircleCheck,
  "ep:check": EpCheck,
  "ep:delete": EpDelete,
  "ep:edit-pen": EpEditPen,
  "ep:view": EpView,
  "ep:hide": EpHide,
  "ep:upload": EpUpload,
  "ep:download": EpDownload,
  "ep:printer": EpPrinter,
  "ep:copy-document": EpCopyDocument,
  "ep:more-filled": EpMoreFilled,
  "ep:tools": EpTools,

  /* 布局导航 */
  "ep:fold": EpFold,
  "ep:expand": EpExpand,
  "ep:arrow-down": EpArrowDown,
  "ep:arrow-up": EpArrowUp,
  "ep:arrow-left": EpArrowLeft,
  "ep:arrow-right": EpArrowRight,
  "ep:full-screen": EpFullScreen,
  "ep:bell": EpBell,
  "ep:setting": EpSetting,
  "ep:switch-button": EpSwitchButton,
  "ep:back": EpBack,
  "ep:right": EpRight,

  /* 业务与用户 */
  "ep:user": EpUser,
  "ep:user-filled": EpUserFilled,
  "ep:avatar": EpAvatar,
  "ep:lock": EpLock,
  "ep:key": EpKey,
  "ep:unlock": EpUnlock,
  "ep:timer": EpTimer,
  "ep:document": EpDocument,
  "ep:files": EpFiles,
  "ep:folder": EpFolder,
  "ep:message": EpMessage,
  "ep:select": EpSelect,
  "ep:warning": EpWarning,
  "ep:info-filled": EpInfoFilled,
  "ep:calendar": EpCalendar,
  "ep:link": EpLink,
  "ep:grid": EpGrid,
  "ep:list": EpList,
  "ep:data-line": EpDataLine,

  /* 菜单实际使用的补充图标（ep / ri / fa-solid） */
  "ep:box": EpBox,
  "ep:chrome-filled": EpChromeFilled,
  "ep:flag": EpFlag,
  "ep:wallet-filled": EpWalletFilled,
  "ri:account-pin-box-line": RiAccountPinBox,
  "ri:codepen-fill": RiCodepen,
  "ri:flow-chart": RiFlowChart,
  "fa-solid:book": FaBook,
  "fa-solid:church": FaChurch,
  "fa-solid:pallet": FaPallet,
  "fa-solid:paper-plane": FaPaperPlane,
  "fa-solid:qrcode": FaQrcode
};

let registered = false;

/** 注册全部本地图标，应用启动时调用一次 */
export function setupIcons() {
  if (registered) return;
  Object.keys(icons).forEach(name => addIcon(name, icons[name]));
  registered = true;
}

/** 判断图标是否已注册 */
export const hasIcon = (name: string) => Object.keys(icons).includes(name);
