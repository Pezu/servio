import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { APP_CONFIG } from '../shared/constants';

export interface WebSocketMessage<T = unknown> {
  topic: string;
  body: T;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private stompClient: Client | null = null;
  private connected = false;
  private subscriptions = new Map<string, Subject<unknown>>();
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private connectionSubject = new Subject<boolean>();

  connection$ = this.connectionSubject.asObservable();

  connect(): void {
    if (this.stompClient?.active) {
      return;
    }

    this.setupWakeUpListeners();

    this.stompClient = new Client({
      webSocketFactory: () => new (SockJS as any)(`${environment.apiUrl}/ws`),
      heartbeatIncoming: APP_CONFIG.WEBSOCKET.HEARTBEAT_INCOMING,
      heartbeatOutgoing: APP_CONFIG.WEBSOCKET.HEARTBEAT_OUTGOING,
      reconnectDelay: APP_CONFIG.WEBSOCKET.RECONNECT_DELAY,
      onConnect: () => {
        this.connected = true;
        this.connectionSubject.next(true);
        console.log('[WebSocket] Connected');

        // Resubscribe to all topics
        this.subscriptions.forEach((subject, topic) => {
          this.subscribeInternal(topic, subject);
        });
      },
      onStompError: (error) => {
        console.error('[WebSocket] STOMP error:', error);
        this.connected = false;
        this.connectionSubject.next(false);
      },
      onDisconnect: () => {
        console.log('[WebSocket] Disconnected');
        this.connected = false;
        this.connectionSubject.next(false);
      },
      onWebSocketClose: () => {
        console.log('[WebSocket] Connection closed');
        this.connected = false;
        this.connectionSubject.next(false);
      }
    });

    this.stompClient.activate();
  }

  disconnect(): void {
    this.removeWakeUpListeners();
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
      this.connected = false;
    }
  }

  subscribe<T>(topic: string): Observable<T> {
    if (!this.subscriptions.has(topic)) {
      const subject = new Subject<T>();
      this.subscriptions.set(topic, subject as Subject<unknown>);

      if (this.connected && this.stompClient) {
        this.subscribeInternal(topic, subject as Subject<unknown>);
      }
    }

    return this.subscriptions.get(topic)!.asObservable() as Observable<T>;
  }

  unsubscribe(topic: string): void {
    const subject = this.subscriptions.get(topic);
    if (subject) {
      subject.complete();
      this.subscriptions.delete(topic);
    }
  }

  private subscribeInternal(topic: string, subject: Subject<unknown>): void {
    this.stompClient?.subscribe(topic, (message: IMessage) => {
      try {
        const body = JSON.parse(message.body);
        subject.next(body);
      } catch {
        subject.next(message.body);
      }
    });
  }

  private setupWakeUpListeners(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('[WebSocket] Page visible, checking connection...');
        this.reconnectIfNeeded();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.onlineHandler = () => {
      console.log('[WebSocket] Device online, reconnecting...');
      this.reconnectIfNeeded();
    };
    window.addEventListener('online', this.onlineHandler);
  }

  private removeWakeUpListeners(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
  }

  private reconnectIfNeeded(): void {
    if (this.stompClient) {
      console.log('[WebSocket] Forcing reconnection...');
      this.stompClient.deactivate();
      this.stompClient = null;
      this.connected = false;
    }
    setTimeout(() => {
      this.connect();
    }, 500);
  }

  isConnected(): boolean {
    return this.connected;
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.subscriptions.forEach(subject => subject.complete());
    this.subscriptions.clear();
    this.connectionSubject.complete();
  }
}
