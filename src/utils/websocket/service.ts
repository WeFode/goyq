import {getToken} from "@/utils/auth";
import {ElMessage} from "element-plus";
import {emitter} from "@/utils/mitt";

export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private reconnectCount = 0;
  private readonly maxReconnectCount = 3;
  private readonly reconnectDelay = 30000; // 30秒重连间隔
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: any[] = [];
  private forceClose = false;
  private isReconnecting = false;

  private constructor() {
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange.bind(this)
    );
    window.addEventListener("online", this.handleOnline.bind(this));
    window.addEventListener("offline", this.handleOffline.bind(this));
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN || this.isReconnecting;
  }

  public connect(): void {
    if (this.isConnected()) return;

    try {
      const token = getToken();
      if (!token?.accessToken) {
        console.warn("[WebSocket] 未找到认证token，无法建立连接");
        return;
      }

      this.forceClose = false;
      
      // 自动根据当前页面协议和域名构建 WebSocket URL
      // 开发环境：使用 location.host (包含端口)
      // 生产环境：也使用 location.host 自动适配
      const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = location.host; // 例如: localhost:5173 或 example.com
      
      // 根据后端文档，WebSocket 需要 token 参数进行认证
      const wsURL = `${wsProtocol}//${wsHost}/api/v1/notification/ws?token=${encodeURIComponent(token.accessToken)}`;
      
      console.log("[WebSocket] 正在连接:", wsURL.replace(token.accessToken, "***"));
      
      this.ws = new WebSocket(wsURL);
      
      this.initEventHandlers();
    } catch (error) {
      console.error("[WebSocket] 创建连接失败:", error);
    }
  }

  private initEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("[WebSocket] ✓ 连接成功");
      this.reconnectCount = 0;
      this.isReconnecting = false;
      this.clearReconnectTimer();
      this.startHeartbeat();
      this.flushMessageQueue();
      // 发送连接成功事件
      emitter.emit("wsConnected", true);
    };

    this.ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "pong") return;

        // 使用专门的消息事件类型
        emitter.emit("wsMessage", message);
      } catch (error) {
        console.error("[WebSocket] 消息解析失败:", error);
      }
    };

    this.ws.onclose = event => {
      this.handleClose(event);
      emitter.emit("wsConnected", false);
    };

    this.ws.onerror = (error) => {
      console.error("错误详情:", error);
    };
  }

  private handleClose(event: CloseEvent): void {
    this.stopHeartbeat();

    if (event.wasClean) {
      console.log(`[WebSocket] 连接已关闭，代码: ${event.code}`);
    } else {
      console.log(`[WebSocket] 连接异常断开，代码: ${event.code}`);
    }
    
    // 无论是否正常关闭，都尝试重连（除非是强制关闭）
    if (!this.forceClose) {
      this.reconnect();
    }
  }

  private reconnect(): void {
    if (this.forceClose || this.isReconnecting) {
      return;
    }

    if (this.reconnectCount >= this.maxReconnectCount) {
      console.error(`[WebSocket] 已达到最大重连次数 ${this.maxReconnectCount}，停止重连`);
      ElMessage.error("WebSocket连接已断开，请刷新页面重试");
      return;
    }

    this.isReconnecting = true;
    this.reconnectCount++;
    
    console.log(
      `[WebSocket] 将在 ${this.reconnectDelay / 1000} 秒后进行第 ${this.reconnectCount} 次重连...`
    );

    this.reconnectTimer = setTimeout(() => {
      console.log(`[WebSocket] 开始第 ${this.reconnectCount} 次重连`);
      this.isReconnecting = false;
      this.connect();
    }, this.reconnectDelay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({type: "ping"});
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  public send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      this.messageQueue.push(data);
    }
  }

  public close(): void {
    this.forceClose = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === "visible") {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connect();
      }
    }
  }

  private handleOnline(): void {
    console.log("网络已连接");
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }
  }

  private handleOffline(): void {
    console.log("[WebSocket] 网络已断开");
    this.stopHeartbeat();
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public destroy(): void {
    this.close();
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
  }
}
