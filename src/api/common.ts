import { http } from "@/utils/http";

/** 公共上传文件接口 */
export const uploadFile = (data: FormData) => {
    return http.request("post", "/common/file/upload", { 
        data,
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
};
