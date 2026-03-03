import { GameState, ServerMessage } from '../types';

type MessageCallback = (data: ServerMessage) => void;

class SocketService {
  private socket: WebSocket | null = null;
  private callbacks: Set<MessageCallback> = new Set();

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.socket = new WebSocket(`${protocol}//${host}`);

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.callbacks.forEach(cb => cb(data));
    };

    this.socket.onclose = () => {
      setTimeout(() => this.connect(), 2000);
    };
  }

  subscribe(cb: MessageCallback) {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  send(message: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('Sending message:', message);
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('Socket not open. Current state:', this.socket?.readyState);
    }
  }
}

export const socketService = new SocketService();
