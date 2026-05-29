import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import SockJS from 'sockjs-client';

export interface ValidationNotification {
  type: 'VALIDATION_REQUESTED' | 'REGISTRATION_APPROVED';
  registrationId: string;
  nickname?: string;
  orderPointId?: string;
  orderPointName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private client: Client | null = null;
  private connected$ = new BehaviorSubject<boolean>(false);
  private stompSubscriptions: Map<string, any> = new Map();
  // Shared subjects for each destination - allows multiple listeners
  private destinationSubjects: Map<string, Subject<any>> = new Map();
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private wakeListenersAttached = false;

  get isConnected$(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  connect(): void {
    this.attachWakeListenersOnce();

    // Already connected
    if (this.client?.connected) {
      console.log('[WS] Already connected');
      return;
    }

    // Already connecting (client exists but not connected)
    if (this.client?.active) {
      console.log('[WS] Already connecting...');
      return;
    }

    const wsUrl = environment.apiUrl.replace('/api', '/ws');
    console.log('[WS] Connecting to:', wsUrl);

    this.client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (str) => {
        console.log('[WS]', str);
      },
      onConnect: () => {
        console.log('[WS] Connected - resubscribing to', this.destinationSubjects.size, 'destinations');
        this.connected$.next(true);
        // Resubscribe to all destinations after reconnect
        this.resubscribeAll();
      },
      onDisconnect: () => {
        console.log('[WS] Disconnected');
        this.connected$.next(false);
        // Clear stale STOMP subscriptions so they can be recreated on reconnect
        // Keep destinationSubjects so we know what to resubscribe to
        this.stompSubscriptions.clear();
      },
      onWebSocketClose: () => {
        console.log('[WS] WebSocket closed');
        this.connected$.next(false);
        this.stompSubscriptions.clear();
      },
      onStompError: (frame) => {
        console.error('[WS] STOMP error', frame);
      }
    });

    this.client.activate();
  }

  /**
   * Force a reconnect — used when the device wakes from background or rejoins
   * the network. STOMP's built-in reconnectDelay only kicks in when the socket
   * was cleanly closed; mobile OSes often suspend the socket without firing a
   * close event, so we tear down explicitly and reactivate.
   */
  reconnect(): void {
    if (this.client?.connected) {
      console.log('[WS] Already connected, skipping reconnect');
      return;
    }
    console.log('[WS] Forcing reconnect');
    if (this.client) {
      try { this.client.deactivate(); } catch {}
      this.client = null;
    }
    this.stompSubscriptions.clear();
    this.connected$.next(false);
    this.connect();
  }

  private attachWakeListenersOnce(): void {
    if (this.wakeListenersAttached) return;
    this.wakeListenersAttached = true;

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('[WS] Page visible, checking connection');
        this.reconnect();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.onlineHandler = () => {
      console.log('[WS] Network online, reconnecting');
      this.reconnect();
    };
    window.addEventListener('online', this.onlineHandler);
  }

  private detachWakeListeners(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
    this.wakeListenersAttached = false;
  }

  disconnect(): void {
    this.stompSubscriptions.forEach((sub) => sub.unsubscribe());
    this.stompSubscriptions.clear();
    this.destinationSubjects.clear();

    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.connected$.next(false);
    this.detachWakeListeners();
  }

  private resubscribeAll(): void {
    // Resubscribe to all destinations that have active subjects
    console.log('[WS] Resubscribing to destinations:', Array.from(this.destinationSubjects.keys()));
    this.destinationSubjects.forEach((subject, destination) => {
      this.createStompSubscription(destination, subject);
    });
  }

  private createStompSubscription(destination: string, subject: Subject<any>): void {
    if (!this.client?.connected) {
      console.log('[WS] Cannot subscribe - not connected:', destination);
      return;
    }

    // Don't create duplicate STOMP subscriptions
    if (this.stompSubscriptions.has(destination)) {
      console.log('[WS] Already subscribed to:', destination);
      return;
    }

    console.log('[WS] Creating subscription to:', destination);
    const subscription = this.client.subscribe(destination, (message: IMessage) => {
      console.log('[WS] Message received on:', destination);
      try {
        const notification = JSON.parse(message.body);
        console.log('[WS] Parsed notification:', notification);
        subject.next(notification);
      } catch (e) {
        console.error('[WS] Failed to parse message', e);
      }
    });
    this.stompSubscriptions.set(destination, subscription);
    console.log('[WS] Subscription created successfully');
  }

  private getOrCreateSubject<T>(destination: string): Subject<T> {
    let subject = this.destinationSubjects.get(destination);
    if (!subject) {
      console.log('[WS] Creating new subject for:', destination);
      subject = new Subject<T>();
      this.destinationSubjects.set(destination, subject);

      // Create STOMP subscription if connected
      if (this.client?.connected) {
        this.createStompSubscription(destination, subject);
      } else {
        console.log('[WS] Client not connected yet, subscription will be created on connect');
      }
    }
    return subject;
  }

  subscribeToEventValidations(eventId: string): Observable<ValidationNotification> {
    const destination = `/topic/event/${eventId}/validation-requests`;
    return this.getOrCreateSubject<ValidationNotification>(destination).asObservable();
  }

  subscribeToEventRegistrations(eventId: string): Observable<ValidationNotification> {
    const destination = `/topic/event/${eventId}/registrations`;
    return this.getOrCreateSubject<ValidationNotification>(destination).asObservable();
  }

  subscribeToEventOrders(eventId: string): Observable<any> {
    const destination = `/topic/event/${eventId}/orders`;
    return this.getOrCreateSubject<any>(destination).asObservable();
  }

  subscribeToEventPayments(eventId: string): Observable<any> {
    const destination = `/topic/event/${eventId}/payments`;
    return this.getOrCreateSubject<any>(destination).asObservable();
  }

  unsubscribe(destination: string): void {
    const subscription = this.stompSubscriptions.get(destination);
    if (subscription) {
      subscription.unsubscribe();
      this.stompSubscriptions.delete(destination);
    }
    this.destinationSubjects.delete(destination);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}