import type { Directive } from "vue";
import type { CopyEl } from "@/directives";

declare module "vue" {
  export interface ComponentCustomProperties {
    /** 加载动画指令 */
    vLoading: Directive<Element, boolean>;
    /** 按钮权限指令（按用户权限码判断） */
    vAuth: Directive<HTMLElement, string | Array<string>>;
    /** 按钮权限指令（按登录接口 permissions 判断） */
    vPerms: Directive<HTMLElement, string | Array<string>>;
    /** 文本复制指令（默认双击复制） */
    vCopy: Directive<CopyEl, string>;
  }
}
