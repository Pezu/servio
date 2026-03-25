# Servio Event Management System - Architecture

## High-Level Overview (Current - Gateway Architecture)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENTS                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐ │
│   │   Backoffice Web     │    │   Customer Web       │    │   Order Dashboard    │ │
│   │   (Admin Panel)      │    │   (Registration)     │    │   (Staff View)       │ │
│   └──────────┬───────────┘    └──────────┬───────────┘    └──────────┬───────────┘ │
│              │                           │                           │             │
│              └───────────────────────────┼───────────────────────────┘             │
│                                          │                                         │
│                           ┌──────────────▼──────────────┐                          │
│                           │    Angular 19 Frontend      │                          │
│                           │    (unified - port 4200)    │                          │
│                           └──────────────┬──────────────┘                          │
│                                          │                                         │
└──────────────────────────────────────────┼─────────────────────────────────────────┘
                                           │
                              HTTP REST + WebSocket
                                           │
┌──────────────────────────────────────────▼─────────────────────────────────────────┐
│                    API GATEWAY + WEBSOCKET SERVER (port 8080)                       │
│                        Spring Cloud Gateway + Redis + Kafka                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  • JWT Authentication (centralized)     • Rate Limiting (Redis-backed)             │
│  • Request Routing                      • Security Headers                          │
│  • CORS Handling                        • WebSocket STOMP/SockJS (/ws)             │
│  • Kafka Consumer (notifications)       • Redis Pub/Sub (WS scaling)               │
└───────────┬─────────────────────────────┬───────────────────────────────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐   ┌───────────────────────┐
│    EVENT API          │   │    ORDER SERVICE      │
│    (port 8081)        │   │    (port 8082)        │
│    Spring Boot        │   │    Spring Boot        │
├───────────────────────┤   ├───────────────────────┤
│ • Events, Locations   │   │ • Order CRUD          │
│ • Clients, Users      │   │ • Payment Processing  │
│ • Menu, Registration  │   │ • Netopia Integration │
│ • Internal APIs       │   │ • Kafka Producer      │
└───────────┬───────────┘   └───────────┬───────────┘
            │                           │
            ▼                           ▼
┌───────────────────────┐   ┌───────────────────────┐
│   PostgreSQL          │   │   PostgreSQL          │
│   (eventdb)           │   │   (orderdb)           │
└───────────────────────┘   └───────────────────────┘

         ┌─────────────────────────────────────────────────────────┐
         │                         REDIS                            │
         │              (Rate limiting, WS state, pub/sub)          │
         └─────────────────────────────────────────────────────────┘

         ┌─────────────────────────────────────────────────────────┐
         │                         KAFKA                            │
         │                   (Message Broker)                       │
         │  order.created, order.status.changed,                    │
         │  order.item.status.changed, payment.completed,           │
         │  registration.validated                                  │
         └─────────────────────────────────────────────────────────┘
```

## Service Port Allocation

| Service              | Port  | Description                              |
|----------------------|-------|------------------------------------------|
| API Gateway          | 8080  | Entry point - REST routing + WebSocket   |
| Event API            | 8081  | Core backend (events, users, menu)      |
| Order Service        | 8082  | Order processing, payments              |
| PostgreSQL (Event)   | 5432  | Event API database                      |
| PostgreSQL (Order)   | 5433  | Order Service database                  |
| Redis                | 6379  | Rate limiting, WS state, pub/sub        |
| Kafka                | 9092  | Event streaming                         |
| MinIO                | 9000  | Object storage (images)                 |
| Frontend             | 4200  | Angular application                     |

---

## Legacy Architecture (Before Gateway)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENTS                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐ │
│   │   Backoffice Web     │    │   Customer Web       │    │   Order Dashboard    │ │
│   │   (Admin Panel)      │    │   (Registration)     │    │   (Staff View)       │ │
│   └──────────┬───────────┘    └──────────┬───────────┘    └──────────┬───────────┘ │
│              │                           │                           │             │
│              └───────────────────────────┼───────────────────────────┘             │
│                                          │                                         │
│                           ┌──────────────▼──────────────┐                          │
│                           │    Angular 19 Frontend      │                          │
│                           │    (unified - port 4200)    │                          │
│                           └──────────────┬──────────────┘                          │
│                                          │                                         │
└──────────────────────────────────────────┼─────────────────────────────────────────┘
                                           │
                          HTTP REST + WebSocket (STOMP)
                                           │
┌──────────────────────────────────────────┼─────────────────────────────────────────┐
│                                  BACKEND SERVICES                                   │
├──────────────────────────────────────────┼─────────────────────────────────────────┤
│                                          │                                         │
│   ┌──────────────────────────────────────▼──────────────────────────────────────┐  │
│   │                         EVENT API (port 8080)                                │  │
│   │                         Spring Boot 3.2.1 / Java 21                          │  │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐ │  │
│   │  │  REST Controllers                                                       │ │  │
│   │  │  ├── LoginController (JWT Auth)      ├── OrderController               │ │  │
│   │  │  ├── EventController                 ├── PaymentController             │ │  │
│   │  │  ├── ClientController                ├── MenuController                │ │  │
│   │  │  ├── LocationController              ├── RegisterController            │ │  │
│   │  │  ├── OrderPointController            ├── InternalController (inter-svc)│ │  │
│   │  │  └── UserController, RoleController, AllergenController, VatTypeController│  │
│   │  └─────────────────────────────────────────────────────────────────────────┘ │  │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐ │  │
│   │  │  WebSocket (STOMP)                                                      │ │  │
│   │  │  └── /ws endpoint → /topic/event/{id}, /topic/orderpoint/{id},         │ │  │
│   │  │                     /topic/registration/{id}                            │ │  │
│   │  └─────────────────────────────────────────────────────────────────────────┘ │  │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐ │  │
│   │  │  Kafka Consumer (OrderEventConsumer)                                    │ │  │
│   │  │  └── Listens: order.created, order.status.changed, payment.completed   │ │  │
│   │  │  └── Converts events → WebSocket notifications                         │ │  │
│   │  └─────────────────────────────────────────────────────────────────────────┘ │  │
│   └──────────────────────────────────────┬──────────────────────────────────────┘  │
│                                          │                                         │
│              ┌───────────────────────────┼───────────────────────────┐             │
│              │                           │                           │             │
│              ▼                           ▼                           ▼             │
│   ┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐    │
│   │   PostgreSQL     │        │     Kafka        │        │      MinIO       │    │
│   │   (eventdb)      │        │   (port 9092)    │        │   (port 9000)    │    │
│   │   port 5432      │        │                  │        │   Image Storage  │    │
│   └──────────────────┘        └────────┬─────────┘        └──────────────────┘    │
│                                        │                                          │
│                                        │ Kafka Events                             │
│                                        │                                          │
│   ┌────────────────────────────────────▼────────────────────────────────────────┐ │
│   │                    ORDER MICROSERVICE (port 8081)                            │ │
│   │                    Spring Boot 3.2.1 / Java 21                               │ │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐│ │
│   │  │  REST Controllers                                                       ││ │
│   │  │  ├── OrderController (Order CRUD, status updates)                       ││ │
│   │  │  ├── PaymentController (Netopia integration, webhooks)                  ││ │
│   │  │  └── HealthController                                                   ││ │
│   │  └─────────────────────────────────────────────────────────────────────────┘│ │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐│ │
│   │  │  Kafka Producer (KafkaProducerService)                                  ││ │
│   │  │  └── Publishes: order.created, order.status.changed,                    ││ │
│   │  │                 order.item.status.changed, payment.completed            ││ │
│   │  └─────────────────────────────────────────────────────────────────────────┘│ │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐│ │
│   │  │  Feign Clients                                                          ││ │
│   │  │  ├── EventApiClient → Event API /api/internal/*                         ││ │
│   │  │  └── NetopiaClient → Netopia Payment Gateway                            ││ │
│   │  └─────────────────────────────────────────────────────────────────────────┘│ │
│   └──────────────────────────────────────┬──────────────────────────────────────┘ │
│                                          │                                        │
│                                          ▼                                        │
│                               ┌──────────────────┐                                │
│                               │   PostgreSQL     │                                │
│                               │   (orderdb)      │                                │
│                               │   port 5432      │                                │
│                               └──────────────────┘                                │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SERVICES                                     │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   ┌──────────────────────┐    ┌──────────────────────────────────────────────┐   │
│   │  Netopia Payment     │    │              ELK Stack                        │   │
│   │  Gateway             │    │  ┌────────────┬────────────┬────────────┐    │   │
│   │  (Card Payments)     │    │  │Elasticsearch│  Kibana   │  Logstash  │    │   │
│   │                      │    │  │  :9200     │  :5601    │  :5044     │    │   │
│   └──────────────────────┘    │  └────────────┴────────────┴────────────┘    │   │
│                               └──────────────────────────────────────────────┘   │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

## Communication Patterns

### 1. Synchronous (REST API)

```
┌─────────────┐         HTTP/REST          ┌─────────────┐
│   Frontend  │ ◄─────────────────────────► │  Event API  │
│  (Angular)  │    JWT Authentication       │  (8080)     │
└─────────────┘                             └──────┬──────┘
                                                   │
                                          Feign (Internal API)
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │   Order     │
                                            │   Service   │
                                            │   (8081)    │
                                            └─────────────┘
```

### 2. Asynchronous (Kafka Events)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           KAFKA TOPICS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Order Service                              Event API                   │
│  (Producer)                                 (Consumer)                  │
│       │                                          ▲                      │
│       │  ┌──────────────────────────────────┐   │                      │
│       ├──► order.created                    ├───┤                      │
│       │  └──────────────────────────────────┘   │                      │
│       │  ┌──────────────────────────────────┐   │                      │
│       ├──► order.status.changed             ├───┤                      │
│       │  └──────────────────────────────────┘   │                      │
│       │  ┌──────────────────────────────────┐   │                      │
│       ├──► order.item.status.changed        ├───┤                      │
│       │  └──────────────────────────────────┘   │                      │
│       │  ┌──────────────────────────────────┐   │                      │
│       └──► payment.completed                ├───┘                      │
│          └──────────────────────────────────┘                          │
│                                                                         │
│  Event API                                  Order Service              │
│  (Producer)                                 (Consumer)                  │
│       │                                          ▲                      │
│       │  ┌──────────────────────────────────┐   │                      │
│       ├──► registration.validated           ├───┤                      │
│       │  └──────────────────────────────────┘   │                      │
│       │  ┌──────────────────────────────────┐   │                      │
│       └──► event.order.number               ├───┘                      │
│          └──────────────────────────────────┘                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. Real-Time (WebSocket/STOMP)

```
┌─────────────┐                              ┌─────────────────┐
│   Browser   │         WebSocket            │   API Gateway   │
│   Client    │ ◄───────────────────────────►│   (8080)        │
└──────┬──────┘         /ws (STOMP)          └──────┬──────────┘
       │                                            │
       │  Subscribe to:                             │  In-Memory Broker
       │  ┌───────────────────────────────────┐    │  + Redis Pub/Sub
       ├──► /topic/event/{eventId}/orders     │    │
       │  └───────────────────────────────────┘    │
       │  ┌───────────────────────────────────┐    │
       ├──► /topic/orderpoint/{id}/orders     │    │
       │  └───────────────────────────────────┘    │
       │  ┌───────────────────────────────────┐    │
       ├──► /topic/registration/{id}          │    │
       │  └───────────────────────────────────┘    │
       │  ┌───────────────────────────────────┐    │
       └──► /topic/event/{id}/payments        │    │
          └───────────────────────────────────┘    │
                                                   │
       Notification Types:                         │
       • ORDER_CREATED                             │
       • ORDER_TAKEN                               │
       • ORDER_READY                               │
       • ORDER_DELIVERED                           │
       • ORDER_CANCELLED                           │
       • ITEM_STARTED                              │
       • ITEM_CANCELLED                            │
       • PAYMENT_COMPLETE                          │
       • REGISTRATION_VALIDATED                    │
                                                   │
```

## Data Flow: Order Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ORDER LIFECYCLE                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

    Customer                Frontend               Order Service            Event API
       │                       │                        │                       │
       │  1. Place Order       │                        │                       │
       │──────────────────────►│                        │                       │
       │                       │  2. POST /api/orders   │                       │
       │                       │───────────────────────►│                       │
       │                       │                        │  3. Get Event ID      │
       │                       │                        │──────────────────────►│
       │                       │                        │◄──────────────────────│
       │                       │                        │  4. Increment OrderNo │
       │                       │                        │──────────────────────►│
       │                       │                        │◄──────────────────────│
       │                       │                        │                       │
       │                       │                        │  5. Save to DB        │
       │                       │                        │  (orderdb)            │
       │                       │                        │                       │
       │                       │                        │  6. Publish Kafka     │
       │                       │                        │  (order.created)      │
       │                       │                        │──────────────────────►│
       │                       │  7. Return Order       │                       │
       │                       │◄───────────────────────│                       │
       │                       │                        │                       │
       │                       │                        │  8. Receive Event     │
       │                       │                        │  (OrderEventConsumer) │
       │                       │◄───────────────────────┼───────────────────────│
       │                       │  9. WebSocket Push     │                       │
       │  10. Real-time Update │  (ORDER_CREATED)       │                       │
       │◄──────────────────────│                        │                       │
       │                       │                        │                       │


    Status Transitions:
    ┌───────┐    ┌────────┐    ┌─────────────┐    ┌───────┐    ┌───────────┐
    │ DRAFT │───►│ ACTIVE │───►│ IN_PROGRESS │───►│ READY │───►│ DELIVERED │
    └───────┘    └────────┘    └─────────────┘    └───────┘    └───────────┘
        │            │                │               │
        │            │                │               │
        ▼            ▼                ▼               ▼
    ┌───────────────────────────────────────────────────┐
    │                    CANCELLED                       │
    └───────────────────────────────────────────────────┘
```

## Data Flow: Payment Processing

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PAYMENT FLOW                                           │
└─────────────────────────────────────────────────────────────────────────────────┘

    Customer            Frontend           Order Service         Netopia Gateway
       │                   │                    │                       │
       │  1. Pay Order     │                    │                       │
       │──────────────────►│                    │                       │
       │                   │  2. Start Payment  │                       │
       │                   │───────────────────►│                       │
       │                   │                    │  3. Create Payment    │
       │                   │                    │──────────────────────►│
       │                   │                    │◄──────────────────────│
       │                   │                    │  4. Payment URL       │
       │                   │◄───────────────────│                       │
       │  5. Redirect      │                    │                       │
       │◄──────────────────│                    │                       │
       │                   │                    │                       │
       │  6. Card Details  │                    │                       │
       │──────────────────────────────────────────────────────────────►│
       │                   │                    │                       │
       │                   │                    │  7. IPN Callback      │
       │                   │                    │◄──────────────────────│
       │                   │                    │  (payment confirmed)  │
       │                   │                    │                       │
       │                   │                    │  8. Mark Items Paid   │
       │                   │                    │  9. Publish Kafka     │
       │                   │                    │  (payment.completed)  │
       │                   │                    │──────────────────────►│
       │                   │                    │                       │
       │                   │  10. WebSocket     │                 Event API
       │                   │◄───────────────────┼───────────────────────│
       │  11. Confirmation │  (PAYMENT_COMPLETE)│                       │
       │◄──────────────────│                    │                       │


    Payment Reference Formats:
    ┌─────────────────────────────────────────────────────────────────┐
    │  ORDER-{orderId}-{timestamp}       → Single order payment       │
    │  GUEST-{registrationId}-{timestamp} → All orders for a guest   │
    │  ORDERPOINT-{orderPointId}-{timestamp} → All orders at station │
    └─────────────────────────────────────────────────────────────────┘
```

## Database Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EVENT API DATABASE (eventdb)                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   clients    │────►│  locations   │────►│    events    │────►│ order_points │
│              │     │              │     │              │     │              │
│ id (UUID)    │     │ id (UUID)    │     │ id (UUID)    │     │ id (UUID)    │
│ name         │     │ name         │     │ name         │     │ name         │
│ logo_path    │     │ client_id    │     │ location_id  │     │ event_id     │
│ client_type  │     │ parent_id    │     │ start_date   │     │ pay_later    │
└──────────────┘     │ logo_path    │     │ end_date     │     └──────┬───────┘
                     └──────────────┘     │ last_order_no│            │
                                          └──────┬───────┘            │
                                                 │                    │
┌──────────────┐     ┌──────────────┐            │                    │
│    users     │────►│ event_users  │◄───────────┘                    │
│              │     │   (M:M)      │                                 │
│ id (UUID)    │     └──────────────┘                                 │
│ username     │                                                      │
│ password     │     ┌──────────────┐                                 │
│ client_id    │────►│    roles     │                                 │
│ role_id      │     │              │                                 │
└──────────────┘     │ id (UUID)    │                                 │
                     │ name         │                                 │
                     │ active       │                                 │
                     └──────────────┘                                 │
                                                                      │
┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│ menu_items   │────►│event_menu_   │◄────│              │            │
│              │     │items (M:M)   │     │              │            │
│ id (UUID)    │     └──────────────┘     │              │            │
│ name         │                          │              │            │
│ price        │     ┌──────────────┐     │              │            │
│ parent_id    │────►│menu_item_    │     │              │            │
│ location_id  │     │allergens     │     │              │            │
│ vat_type_id  │     └──────────────┘     │              │            │
└──────────────┘                          │              │            │
                                          │              │            │
┌──────────────┐     ┌──────────────┐     │              │            │
│  allergens   │     │  vat_types   │     │              │            │
│              │     │              │     │              │            │
│ id (UUID)    │     │ id (UUID)    │     │              │            │
│ number (1-14)│     │ percentage   │     │              │            │
│ name         │     │ name         │     │              │            │
└──────────────┘     └──────────────┘     │              │            │
                                          │              │            │
┌──────────────┐     ┌──────────────┐     │              │            │
│payment_types │────►│event_payment_│◄────┘              │            │
│              │     │types (M:M)   │                    │            │
│ id (UUID)    │     └──────────────┘                    │            │
│ name         │                                         │            │
│ active       │                                         │            │
└──────────────┘                                         │            │
                                                         │            │
                     ┌──────────────┐                    │            │
                     │registrations │◄───────────────────┼────────────┘
                     │              │                    │
                     │ id (UUID)    │                    │
                     │ event_id     │                    │
                     │ order_point  │────────────────────┘
                     │ nickname     │
                     │ status       │
                     │ approved_by  │
                     └──────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ORDER SERVICE DATABASE (orderdb)                          │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│       orders         │         │     order_items      │
│                      │         │                      │
│ id (UUID) PK         │────────►│ id (UUID) PK         │
│ created_at           │         │ order_id FK          │
│ registration_id      │         │ name                 │
│ event_id             │         │ price                │
│ order_point_id       │         │ quantity             │
│ order_no             │         │ status (enum)        │
│ status (enum)        │         │ note                 │
│ assigned_user        │         │ paid (boolean)       │
│ note                 │         └──────────────────────┘
│ needs_payment        │
│ nickname             │         Status: ORDERED → PREPARING → DONE
└──────────────────────┘                              ↓
                                               CANCELLED
Status: DRAFT → ACTIVE → IN_PROGRESS → READY → DELIVERED
                  ↓                              ↓
              CANCELLED ◄────────────────────────┘
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TECHNOLOGY STACK                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  FRONTEND                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Angular 19          │  Modern SPA framework                                    │
│  Angular Material    │  UI component library                                    │
│  RxJS                │  Reactive programming                                    │
│  STOMP.js + SockJS   │  WebSocket client                                        │
│  i18n                │  Internationalization (EN, RO)                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  BACKEND                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Spring Boot 3.2.1   │  Application framework                                   │
│  Java 21             │  Runtime                                                 │
│  Spring Security     │  JWT authentication, RBAC                                │
│  Spring Data JPA     │  ORM / Data access                                       │
│  Spring Kafka        │  Message broker integration                              │
│  Spring WebSocket    │  Real-time STOMP messaging                               │
│  OpenFeign           │  Declarative HTTP clients                                │
│  MapStruct           │  DTO mapping                                             │
│  Flyway              │  Database migrations                                     │
│  Lombok              │  Boilerplate reduction                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                               INFRASTRUCTURE                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL          │  Relational database                                     │
│  Apache Kafka        │  Event streaming / Message broker                        │
│  Zookeeper           │  Kafka coordination                                      │
│  MinIO               │  S3-compatible object storage                            │
│  Docker              │  Containerization                                        │
│  Docker Compose      │  Multi-container orchestration                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                               MONITORING                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Elasticsearch       │  Log storage and search                                  │
│  Kibana              │  Log visualization                                       │
│  Logstash            │  Log aggregation pipeline                                │
│  Logback             │  Application logging                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL SERVICES                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Netopia Payments    │  Romanian payment gateway (card processing)              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Port Allocation

| Service           | Port  | Protocol      |
|-------------------|-------|---------------|
| Angular Frontend  | 4200  | HTTP          |
| Event API         | 8080  | HTTP/WS       |
| Order Service     | 8081  | HTTP          |
| PostgreSQL        | 5432  | TCP           |
| Kafka             | 9092  | TCP           |
| Zookeeper         | 2181  | TCP           |
| MinIO             | 9000  | HTTP          |
| MinIO Console     | 9001  | HTTP          |
| Elasticsearch     | 9200  | HTTP          |
| Kibana            | 5601  | HTTP          |
| Logstash          | 5044  | TCP           |

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY LAYERS                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  1. AUTHENTICATION (JWT)                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  • POST /api/auth/login → Returns JWT token                                 ││
│  │  • Token contains: username, roles, clientId, expiration                    ││
│  │  • JwtAuthenticationFilter validates on every request                       ││
│  │  • Stateless session management                                             ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  2. AUTHORIZATION (RBAC)                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  Roles:                                                                     ││
│  │  • SUPER  - Full system access, all clients                                 ││
│  │  • ADMIN  - Client-specific administration                                  ││
│  │  • SERVICE - Order management only                                          ││
│  │                                                                             ││
│  │  Enforcement:                                                               ││
│  │  • @PreAuthorize annotations on controllers                                 ││
│  │  • Client-scoped access checks                                              ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  3. PUBLIC ENDPOINTS (No Auth Required)                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  • /api/auth/login          - Authentication                                ││
│  │  • /api/register/**         - Customer registration                         ││
│  │  • /api/payments/**         - Payment webhooks                              ││
│  │  • /api/images/**           - Public images                                 ││
│  │  • /api/events/{id}         - Event details (GET)                           ││
│  │  • /api/events/{id}/menu    - Event menu (GET)                              ││
│  │  • /api/orders (POST)       - Place orders                                  ││
│  │  • /api/internal/**         - Inter-service communication                   ││
│  │  • /ws/**                   - WebSocket connections                         ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  4. SECURITY HEADERS                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  • X-XSS-Protection: 1; mode=block                                          ││
│  │  • X-Content-Type-Options: nosniff                                          ││
│  │  • X-Frame-Options: DENY                                                    ││
│  │  • Content-Security-Policy: default-src 'self'; frame-ancestors 'none'      ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Scaling Considerations

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SCALING ARCHITECTURE                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

Current Architecture supports horizontal scaling:

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Event API #1   │  │  Event API #2   │  │  Event API #N   │
│   (8080)        │  │   (8080)        │  │   (8080)        │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Load Balancer   │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│  Order Svc #1   │  │  Order Svc #2   │  │  Order Svc #N   │
│   (8081)        │  │   (8081)        │  │   (8081)        │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Kafka Cluster   │  (Partitioned topics)
                    │   (3+ brokers)    │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │    PostgreSQL     │  (Read replicas)
                    │    (Primary +     │
                    │     Replicas)     │
                    └───────────────────┘


For WebSocket Scaling (100K+ connections):
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Option 1: Redis Pub/Sub for WebSocket state                                    │
│  Option 2: Centrifugo (dedicated WebSocket server)                              │
│  Option 3: Sticky sessions with session affinity                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```
