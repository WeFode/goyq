/**
 * 头像工具函数
 * 用于生成头像文字和背景色
 */

/**
 * 获取头像显示文字（取名字首字符）
 * @param name 名字
 * @returns 首字符（大写）
 */
export function getAvatarText(name: string | null | undefined): string {
  if (!name) return '?';
  return name.substring(0, 1).toUpperCase();
}

/**
 * 根据名字生成头像背景色
 * @param name 名字
 * @returns 十六进制颜色值
 */
export function getAvatarColor(name: string | null | undefined): string {
  // 头像颜色方案
  const colors = [
    '#f56565', '#ed8936', '#ecc94b', '#48bb78', 
    '#38b2ac', '#4299e1', '#667eea', '#9f7aea',
    '#ed64a6', '#f093fb', '#a8edea', '#ffeaa7',
    '#0089FF', '#52C41A', '#FAAD14', '#F53F3F', 
    '#722ED1', '#FF6B9D', '#13C2C2', '#EB2F96'
  ];
  
  if (!name) return colors[0];
  
  // 根据名字生成哈希值，映射到颜色数组
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

