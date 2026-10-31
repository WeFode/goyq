import { http } from "@/utils/http";

/** 获取工作流列表 */
export const getWorkflowList = (data?: object) => {
  return http.request<any>("get", "/workflow/definition/list", { params: data });
};

// 获取工作流详情
export const getWorkflowDetail = (id: number) =>
  http.request<any>("get", `/workflow/definition/${id}`);

/** 创建工作流 */
export const addWorkflow = (data?: object) => {
  return http.request("post", "/workflow/definition", { data });
};

/** 更新工作流 */
export const updateWorkflow = (id: number, data?: object) => {
  return http.request("put", `/workflow/definition/${id}`, { data });
};

/** 删除工作流 */
export const deleteWorkflow = (id: number) => {
  return http.request("delete", `/workflow/definition/${id}`);
};

/** 更新工作流状态 */
export const updateWorkflowStatus = (id: number, status: number) => {
  return http.request("put", `/workflow/definition/${id}/status`, { data: { status } });
};

/** 发起审批 */
export const initiateWorkflow = (data?: object) => {
  return http.request("post", "/workflow/instance/initiate", { data });
};

/** 获取我发起的列表 */
export const getMyInitiatedList = (data?: object) => {
  return http.request("get", "/workflow/instance/my-initiated", { params: data });
};

/** 获取我的待办列表 */
export const getMyTodoList = (data?: object) => {
  return http.request("get", "/workflow/task/my-pending", { params: data });
};

/** 获取我的已办列表 */
export const getMyDoneList = (data?: object) => {
  return http.request("get", "/workflow/task/my-completed", { params: data });
};

/** 获取抄送给我的列表 */
export const getMyCcList = (data?: object) => {
  return http.request("get", "/workflow/cc/my-list", { params: data });
};

/** 获取流程详情 */
export const getWorkflowInstanceDetail = (instanceId: string) => {
  return http.request<any>("get", `/workflow/instance/${instanceId}`);
}

/** 检查流程实例权限 */
export const checkInstancePermission = (instanceId: string) => {
  return http.request<any>("get", `/workflow/instance/${instanceId}/permission`);
}

/** 撤销我的审批 */
export const cancelMyApproval = (instanceId: string, reason: string) => {
  return http.request<any>("post", `/workflow/instance/cancel`, { data: { instanceId, reason } });
}

/** 审批通过 */
export const approveInstance = (id: string, data: any) => {
  return http.request<any>("post", `/workflow/task/${id}/approve`, { data });
}

/** 审批拒绝 */
export const rejectInstance = (id: string, data: any) => {
  return http.request<any>("post", `/workflow/task/${id}/reject`, { data });
}

/** 转派任务 */
export const delegateTask = (taskId: string, data: any) => {
  return http.request<any>("post", `/workflow/task/${taskId}/delegate`, { data });
}

/** 加签（before 前加签 / after 后加签） */
export const addSignTask = (taskId: string, data: any) => {
  return http.request<any>("post", `/workflow/task/${taskId}/add-sign`, { data });
}

/** 退回（initiator 发起人 / previous 上一步 / specified 指定节点） */
export const returnTask = (taskId: string, data: any) => {
  return http.request<any>("post", `/workflow/task/${taskId}/return`, { data });
}

/** 退回后重新提交（复用同一个实例） */
export const resubmitInstance = (instanceId: string, formData: any) => {
  return http.request<any>("post", `/workflow/instance/${instanceId}/resubmit`, {
    data: { instanceId, formData }
  });
}

/** 已读抄送消息  ccId */
export const readCcMessage = (data: any) => {
  return http.request<any>("post", `/workflow/cc/read`, { data });
}

/** 获取我的待办和抄送未读角标数量 */
export const getMyWorkCount = () => {
  return http.request<any>("get", `/workflow/task/my-work-count`);
}

/** 给流程添加评论 */
export const addInstanceComment = (data: any) => {
  return http.request<any>("post", `/workflow/instance/comment`, { data });
}

/** 增加打印次数 */
export const incrementPrintCount = (instanceId: string) => {
  return http.request<any>("post", `/workflow/instance/increment-print-count`, { data: { instanceId } });
}