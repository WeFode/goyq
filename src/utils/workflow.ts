/**
 * 将 UUID 格式化为钉钉风格的审批编号（仅展示用，不影响实际 ID）
 * 格式：YYYYMMDDHHmm + 9 位数字后缀，示例：202605181405000428762
 */
export function formatApprovalNo(instanceId: string, createdAt?: string | Date | null): string {
    if (!instanceId) return '-'

    const dateTimePart = formatDateTime(createdAt)
    const suffix = deriveSuffixFromUuid(instanceId)
    return `${dateTimePart}${suffix}`
}

/**
 * 格式化日期时间为 YYYYMMDDHHmm 格式
 */
function formatDateTime(dateStr?: string | Date | null): string {
    const date = dateStr ? new Date(dateStr) : new Date()

    // 验证日期是否有效
    if (isNaN(date.getTime())) {
        return formatDateTime(new Date())
    }

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${year}${month}${day}${hours}${minutes}`
}

function deriveSuffixFromUuid(uuid: string): string {
    const hex = uuid.replace(/-/g, '').toLowerCase()
    const source = /^[0-9a-f]{32}$/.test(hex) ? hex : uuid

    let hash = 0
    for (let i = 0; i < source.length; i++) {
        hash = (hash * 31 + source.charCodeAt(i)) >>> 0
    }
    return (hash % 1_000_000_000).toString().padStart(9, '0')
}

// 流程分组选项
export const groupOptions = [
    { label: '人事管理', value: '人事管理' },
    { label: '财务管理', value: '财务管理' },
    { label: '行政管理', value: '行政管理' },
    { label: '项目管理', value: '项目管理' },
    { label: '采购管理', value: '采购管理' },
    { label: '销售管理', value: '销售管理' },
    { label: '客户服务', value: '客户服务' },
    { label: '质量管理', value: '质量管理' },
    { label: '其他', value: '其他' }
];


// 状态配置（统一来自字典表，禁止在页面直接展示英文状态码）
export { WORKFLOW_STATUS as statusConfig } from './dicts'
const baseUrl = (import.meta.env.VITE_FILE_BASE_URL || '').replace(/\/$/, '')

export const getAttachmentUrl = (file: any) => {
    const rawUrl: string = file?.fileUrl || file?.url || ''
    if (!rawUrl) return ''
    if (/^(https?:)?\/\//.test(rawUrl) || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
        return rawUrl
    }
    const normalized = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl
    return baseUrl ? `${baseUrl}/${normalized}` : normalized
}

/** 取文件后缀（小写，不含点） */
export const getFileExt = (name = ''): string =>
    name.toLowerCase().split('.').pop() || ''

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg']

/** 是否为图片文件 */
export const isImageFile = (file: any): boolean => {
    const mime = file?.type || file?.fileType
    if (mime && String(mime).includes('image')) return true
    return IMAGE_EXTENSIONS.includes(getFileExt(file?.name || file?.fileName || ''))
}

/** 文件大小格式化 */
export const formatFileSize = (size?: number): string => {
    if (!size) return ''
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/** 文件图标（iconify 名称） */
export const getFileIcon = (name = ''): string => {
    const map: Record<string, string> = {
        pdf: 'ep:document',
        doc: 'ep:document',
        docx: 'ep:document',
        xls: 'ep:files',
        xlsx: 'ep:files',
        zip: 'ep:folder',
        rar: 'ep:folder',
        txt: 'ep:document'
    }
    return map[getFileExt(name)] || 'ep:files'
}

/** 是否支持在线预览 */
export const canPreviewFile = (file: any): boolean => {
    const ext = getFileExt(file?.name || file?.fileName || '')
    return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt', 'csv'].includes(ext)
}