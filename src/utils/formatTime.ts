/**
 * 格式化相对时间
 * @param time 时间字符串或 Date 对象
 * @returns 相对时间描述（如：刚刚、5分钟前、2小时前等）
 */
export function formatRelativeTime(time: string | Date): string {
  if (!time) return "";

  const now = new Date().getTime();
  const targetTime = new Date(time).getTime();
  
  if (isNaN(targetTime)) return String(time);

  const diff = now - targetTime;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) {
    return "刚刚";
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 30) {
    return `${days}天前`;
  } else if (months < 12) {
    return `${months}个月前`;
  } else {
    return `${years}年前`;
  }
}

