import { fileInfoQuery } from "@/api/file";

/**
 * 附件签名地址的自愈层
 *
 * 背景：附件访问地址是「短时效 HMAC 签名」（默认 15 分钟，见后端 file.signTTLSeconds），
 * 而它在页面上的存活期由用户决定——审批详情开着半小时不动，数据里那个地址早就过期了，
 * 再去点就是「文件访问地址无效或已过期，请刷新页面重试」。
 * 让用户手动刷新是最差的答案：他不知道为什么要刷新，也无法判断是不是自己操作错了。
 *
 * 这里利用一个既有事实：签名地址本身形如
 *   /api/v1/common/file/{fileId}/raw?expire={unix秒}&sign={hmac}
 * 也就是**地址自带 fileId 和到期时间**，所以前端无需后端改造就能知道
 * 「这个地址还剩多久」以及「该找谁换一个新的」，续签走 GET /common/file/{fileId}
 * （该前缀属登录用户自助范围，不需要按钮权限）。
 *
 * 三条硬约束：
 * 1. 只在真的接近过期时才发请求，页面刚打开（地址新鲜）零额外开销；
 * 2. 任何失败都退回原地址，绝不让「自愈」把图片显示变成接口异常；
 * 3. 同一 fileId 的并发请求合并成一次，避免一个列表 20 张图同时过期打 20 次。
 */

/** 剩余时效不足这个秒数就提前换新地址（吸收客户端与服务器的时钟偏差） */
const RENEW_AHEAD_SECONDS = 120;

/** 从签名地址里取 fileId：/common/file/{fileId}/raw?... */
const FILE_ID_IN_URL = /\/common\/file\/([^/?#]+)/;
/** 从签名地址里取到期时间：?expire=1793400000 */
const EXPIRE_IN_URL = /[?&]expire=(\d+)/;

/** fileId -> 已签地址，跨组件共享，避免同一附件反复换取 */
const urlCache = new Map<string, { url: string; expireAt: number }>();
/** 同一 fileId 的在途请求，用于并发合并 */
const inflight = new Map<string, Promise<string>>();

/**
 * 取附件的 fileId：优先业务对象上的 id / fileId 字段，
 * 退化时从签名地址反解——这样头像、知识库封面这类「只有 url」的字段也能自愈。
 */
export function signedFileIdOf(target: any): string {
  if (!target) return "";
  if (typeof target === "string") {
    const matched = FILE_ID_IN_URL.exec(target);
    return matched ? decodeURIComponent(matched[1]) : "";
  }
  const direct = String(target.id ?? target.fileId ?? "").trim();
  if (direct) return direct;
  return signedFileIdOf(target.fileUrl || target.url || "");
}

/** 取签名地址的到期时间（unix 秒）；非签名地址返回 0 */
export function signedExpireAt(url: string): number {
  const matched = EXPIRE_IN_URL.exec(url || "");
  return matched ? Number(matched[1]) : 0;
}

/**
 * 地址是否还够用。
 * 没有 expire 参数的一律视为可用（外部 CDN 头像、历史绝对地址等，不归签名体系管）。
 */
export function isSignedUrlFresh(url: string, ahead = RENEW_AHEAD_SECONDS): boolean {
  const expireAt = signedExpireAt(url);
  if (!expireAt) return true;
  return expireAt - Date.now() / 1000 > ahead;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 地址是否已确定过期（不含提前量）。
 * 用于「点击时才发现地址已经作废」的分支：已过期必须先续签再跳转。
 */
export function isSignedUrlExpired(url: string): boolean {
  const expireAt = signedExpireAt(url);
  if (!expireAt) return false;
  return expireAt - nowSeconds() <= 0;
}

async function requestSignedUrl(fileId: string, force = false): Promise<string> {
  const cached = urlCache.get(fileId);
  // 缓存里还有充足时效就直接复用；force 表示浏览器已经加载失败，缓存地址不可信
  if (!force && cached?.url && isSignedUrlFresh(cached.url)) return cached.url;

  const pending = inflight.get(fileId);
  if (pending) return pending;

  const task = fileInfoQuery(fileId)
    .then((res: any) => {
      const url = String(res?.data?.file?.fileUrl || "");
      if (url) urlCache.set(fileId, { url, expireAt: signedExpireAt(url) });
      return url;
    })
    .finally(() => inflight.delete(fileId));

  inflight.set(fileId, task);
  return task;
}

function urlOf(target: any): string {
  return typeof target === "string"
    ? target
    : String(target?.fileUrl || target?.url || "");
}

async function resolve(target: any, force: boolean): Promise<string> {
  const current = urlOf(target);
  if (!force && current && isSignedUrlFresh(current)) return current;

  const fileId = signedFileIdOf(target);
  if (!fileId) return current;

  try {
    const fresh = await requestSignedUrl(fileId, force);
    if (!fresh) return current;
    if (target && typeof target === "object") {
      // 只回写它原本使用的那个字段，避免给数据对象凭空加键
      if (target.fileUrl) target.fileUrl = fresh;
      else if (target.url) target.url = fresh;
    }
    return fresh;
  } catch {
    // 网络或会话异常时不打断渲染：仍返回旧地址，最坏退化成一次加载失败
    return current;
  }
}

/**
 * 拿到一个「现在就能用」的附件地址。
 *
 * 地址仍新鲜就原样返回（零请求）；接近或已经过期则静默续签。
 * 续签成功时会把新地址**写回原对象**，因此依赖同一份数据的缩略图、
 * 图片相册、下载链接会一起刷新，不会各修各的。
 *
 * @param target 附件对象（含 id/fileId/fileUrl）或签名字符串地址
 * @returns 可用地址；续签失败时退回原地址，由调用方或浏览器自行处理
 */
export function ensureSignedUrl(target: any): Promise<string> {
  return resolve(target, false);
}

/**
 * 强制续签，跳过一切「地址还新鲜」的判断。
 * 用于浏览器已经报加载失败的场景：那时地址确定不可用，
 * 再拿提前量去判断只会把重试挡回去。仍带并发合并，不会形成重试风暴。
 */
export function refreshSignedUrl(target: any): Promise<string> {
  return resolve(target, true);
}

/**
 * 批量确保一组附件地址可用（图片相册、封面网格这类一次渲染多张的场景）。
 *
 * 并发合并后，同一附件只会发一次请求；返回新地址数组，同时也会回写原对象，
 * 因此依赖同一份数据的 computed（如相册的 preview-src-list）会自然拿到新地址。
 */
export async function ensureSignedUrls(targets: any[]): Promise<string[]> {
  if (!Array.isArray(targets) || targets.length === 0) return [];
  const list = await Promise.all(targets.map(item => ensureSignedUrl(item)));
  return list.filter(Boolean);
}

/**
 * 以「当前可用」的地址打开或下载附件。
 *
 * 页面数据里的签名地址可能早已过期，直接放在 `<a href>` 上就会让用户看到
 * 「地址无效或已过期」；这里在点击那一刻先续签再跳转。
 * 保留 href 作为无 JS 时的降级路径，所以调用方用 @click.prevent 接管。
 *
 * @returns 是否已触发跳转（地址完全不可用时返回 false，由调用方提示）
 */
export async function openSignedFile(
  target: any,
  options: { mode?: "blank" | "download"; fileName?: string } = {}
): Promise<boolean> {
  const url = await ensureSignedUrl(target);
  if (!url) return false;

  if (options.mode === "download") {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    if (options.fileName) anchor.download = options.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return true;
  }

  window.open(url, "_blank");
  return true;
}

/**
 * 关于缓存清理：这里故意不提供手动清空入口。
 * 签名地址不绑定用户且最长 15 分钟自然失效，跨账号复用不会造成越权；
 * 而退出与切租户都会整页 reload（见 user store），内存缓存随之清空。
 * 为了“干净”去引入 session → 本模块 → api → http → session 的循环依赖不值得。
 */
