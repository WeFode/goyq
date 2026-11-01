import { reactive } from "vue";
import type { FormRules } from "element-plus";

/** 密码正则（密码长度至少6位） */
export const REGEXP_PWD = /^.{6,}$/;

/** 手机号正则 */
export const REGEXP_PHONE = /^1[3-9]\d{9}$/;

/**
 * 登录校验
 *
 * 验证码是否需要填由后端安全策略决定，因此这里接收一个 getter 在校验时实时判断，
 * 而不是整体替换 rules 对象——替换会让 el-form 对未输入的字段重跑校验，
 * 表现为登录页刚打开就出现「请输入账号 / 请输入密码」的红字。
 */
const createLoginRules = (captchaRequired: () => boolean) =>
  reactive(<FormRules>{
    tenantCode: [
      {
        validator: (_rule, value, callback) => {
          if (value && !/^[a-zA-Z0-9-]{0,32}$/.test(value)) {
            callback(new Error("企业编码格式不正确"));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ],
    username: [{ required: true, message: "请输入账号", trigger: "blur" }],
    password: [
      {
        validator: (_rule, value, callback) => {
          if (value === "") {
            callback(new Error("请输入密码"));
          } else if (!REGEXP_PWD.test(value)) {
            callback(new Error("密码长度至少6位"));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ],
    captchaCode: [
      {
        validator: (_rule, value, callback) => {
          if (captchaRequired() && !String(value ?? "").trim()) {
            callback(new Error("请输入验证码"));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ]
  });

/** 申请账号校验 */
const applyRules = reactive(<FormRules>{
  inviteCode: [{ required: true, message: "请输入邀请码", trigger: "blur" }],
  employeeName: [
    { required: true, message: "请输入真实姓名", trigger: "blur" },
    {
      min: 2,
      max: 20,
      message: "姓名长度在2到20个字符之间",
      trigger: "blur"
    }
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    {
      min: 6,
      max: 32,
      message: "密码长度在6到32个字符之间",
      trigger: "blur"
    }
  ],
  workMobile: [
    { required: true, message: "请输入手机号", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        if (!REGEXP_PHONE.test(value)) {
          callback(new Error("请输入正确的手机号"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  gender: [{ required: true, message: "请选择性别", trigger: "change" }],
  address: [{ required: true, message: "请输入详细地址", trigger: "blur" }]
});

export { createLoginRules, applyRules };
