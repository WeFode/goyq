import { reactive } from "vue";
import type { FormRules } from "element-plus";

/** 密码正则（密码长度至少6位） */
export const REGEXP_PWD = /^.{6,}$/;

/** 手机号正则 */
export const REGEXP_PHONE = /^1[3-9]\d{9}$/;

/** 登录校验 */
const loginRules = reactive(<FormRules>{
  username: [
    { required: true, message: "请输入账号", trigger: "blur" }
  ],
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

export { loginRules, applyRules };
