# Servio Cash Register Bridge — implementation prompt

You are building a small Java application that runs at the event venue and acts as a bridge between the Servio backend (cloud) and one or more **Datecs fiscal printers** (DP / FP / WP series). It:

1. Connects via STOMP-over-WebSocket to `wss://servioapp.ro/ws` (or `wss://api.servioapp.ro/ws` — both reach the same backend).
2. Authenticates as a registered cash-register device using two values issued by the Servio backoffice: `deviceId` (UUID) and `sharedToken` (string).
3. Receives `PRINT_RECEIPT`-style commands pushed to its private STOMP queue.
4. Drives the configured Datecs printer over **TCP (or RS-232/USB)** using Datecs' proprietary protocol to print a fiscal receipt.
5. Sends the result (success + fiscal receipt number, or error) back to the backend via STOMP.

The backend is already implemented and waiting for you. Your job is *only* the bridge app.

---

## Backend contract (do not re-implement — just follow this)

### Connection

- URL: `wss://servioapp.ro/ws` (SockJS-compatible STOMP endpoint, Spring's default)
- STOMP CONNECT must include these native headers (sent in the CONNECT frame, not as HTTP query params):
  - `X-ECR-Device-Id: <UUID>`
  - `X-ECR-Token: <sharedToken>`
- On valid credentials the backend attaches an internal `EcrPrincipal(deviceId)` to the session. Bad credentials → connection rejected with `Invalid ECR credentials`.
- The backend uses SockJS; prefer a STOMP-over-SockJS client if you can. A raw WebSocket STOMP client also works as long as the backend is configured `withSockJS()` (it is).

### Subscriptions

- Subscribe to **`/user/queue/ecr/print`** to receive print commands. (This is Spring's user-destination routing — the backend pushes via `convertAndSendToUser(deviceId, "/queue/ecr/print", payload)` and SimpleBroker rewrites it onto your session's `/user/queue/ecr/print`.)

### Incoming command payload (server → bridge, JSON)

```json
{
  "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "receiptType": "PAY_LATER",
  "paymentMethod": "CARD",
  "operator": "NETOPIA",
  "issuedAt": "2026-05-21T10:32:01.235",
  "eventId": "f7c3b1a4-...",
  "cashRegister": {
    "deviceId": "f7c3b1a4-...",
    "name": "Bar central",
    "ip": "192.168.1.50"
  },
  "table": {
    "orderPointId": "...",
    "orderPointName": "Masa 5"
  },
  "orders": [
    {"orderId": "...", "orderNo": 142, "nickname": "Radu", "registrationId": "...", "groupId": "..."}
  ],
  "lines": [
    {
      "orderId": "...",
      "orderNo": 142,
      "itemId": "...",
      "name": "Coca-Cola 0.5L",
      "quantity": 2,
      "unitPrice": 5.00,
      "vatRate": 19,
      "lineNet": 8.40,
      "lineVat": 1.60,
      "lineTotal": 10.00
    }
  ],
  "totals": {
    "net": 8.40,
    "vat": 1.60,
    "total": 10.00
  }
}
```

Important fields:

- `requestId` — echo back exactly in your reply so the backend can correlate.
- `cashRegister.ip` — the target Datecs printer's IP. You may also have it preconfigured locally; the payload value is authoritative.
- `lines[].vatRate` — Romanian VAT rates (19, 9, 5, 0). Map each to a Datecs tax group (A/B/C/D — configured per merchant during printer setup).
- `lines[].unitPrice` — gross (VAT-included) unit price in RON.
- `paymentMethod` — `"CARD"` (most common for IPN-driven receipts), `"CASH"`, or other.

### Outgoing reply (bridge → server, STOMP SEND to `/app/ecr/result`)

Payload:

```json
{
  "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "response": {
    "status": "OK",
    "receiptNumber": "00012345",
    "fiscalReceiptId": "FIS-1779354185-3245",
    "cashRegisterSerial": "DATECS-DP-25-12345678",
    "issuedAt": "2026-05-21T10:32:04.123",
    "totalAmount": 10.00,
    "paymentMethod": "CARD"
  }
}
```

On failure:

```json
{
  "requestId": "...",
  "response": {
    "status": "ERROR",
    "errorCode": "PRINTER_OFFLINE",
    "errorMessage": "Datecs DP-25 at 192.168.1.50 did not respond within 10s"
  }
}
```

The matching DTOs already exist in the backend (`CashRegisterReceiptResponse`) — use the same field names exactly. Send via `stomp.send("/app/ecr/result", payload)`.

The backend rebroadcasts your reply onto `/topic/event/{eventId}/cash-register-reply` so the operator dashboard updates in real time.

---

## What to build

### Tech stack

- **Java 21**, Spring Boot 3.2+
- **Spring messaging** (`spring-boot-starter-websocket`) for STOMP client, or `org.springframework:spring-messaging` standalone
- **Datecs SDK** — they distribute one for Java (sometimes called *FPGate* or *DatecsLib*). If you can't get it, a thin protocol implementation over `java.net.Socket` works since the wire format is well-documented (LEN + SEQ + CMD + DATA + BCC + ETX).
- Build: Maven, runs as a standalone JAR (`java -jar bridge.jar`)
- Logging: SLF4J + logback, file + console, INFO default, DEBUG togglable for the printer wire protocol
- Config: Spring `application.yml`, env-var overrides

### Configuration (`application.yml`)

```yaml
servio:
  backend-url: wss://servioapp.ro/ws     # SockJS STOMP endpoint
  device-id: ${SERVIO_DEVICE_ID}          # UUID, issued by backoffice
  shared-token: ${SERVIO_SHARED_TOKEN}    # secret, issued by backoffice
  reconnect-delay-ms: 5000
  reconnect-max-attempts: 0               # 0 = retry forever

datecs:
  default-host: 192.168.1.50              # fallback if payload doesn't carry one
  default-port: 9100
  connect-timeout-ms: 5000
  read-timeout-ms: 10000
  tax-mapping:                            # vatRate -> Datecs tax group letter
    "19": "A"
    "9":  "B"
    "5":  "C"
    "0":  "D"

logging:
  file:
    name: bridge.log
  level:
    root: INFO
    com.servio.bridge: INFO
    com.servio.bridge.protocol: DEBUG     # enable for protocol-level debugging
```

### Components

- **`StompClientService`** — manages the connection lifecycle. Reconnects with exponential backoff on disconnect. Subscribes to `/user/queue/ecr/print` after CONNECT.
- **`ReceiptHandler`** — receives the JSON payload, hands it to the printer service, builds the reply, sends back via STOMP. Wrap the entire flow in a try/catch so a printer failure becomes an `ERROR` reply rather than a swallowed exception.
- **`DatecsPrinterService`** — opens a TCP connection to the printer's IP (from payload, fallback to config). Builds the Datecs command sequence:
  1. Open fiscal receipt (Op #30, with operator name + password)
  2. For each line: sell article (Op #31) with name, qty, unitPrice, tax group, optional VAT-on/off
  3. Total subtotal (Op #33)
  4. Payment (Op #35) — CARD goes to payment-mode 3, CASH to mode 1 (verify against your specific printer manual)
  5. Close fiscal receipt (Op #38), capture the fiscal receipt number from the response
  6. Cut paper if model supports it
- **`Application`** — Spring Boot entry; on `ApplicationReadyEvent`, kick off `StompClientService.connect()`.
- **Tests** — at least one integration test with a fake STOMP server (Spring's `WebSocketStompClient` against an embedded `WebSocketHandlerRegistry`) and a fake Datecs printer (a `ServerSocket` that responds with canned acks).

### Error handling rules

- **Printer unreachable** → reply `status=ERROR errorCode=PRINTER_OFFLINE`. Do *not* retry — the backend will resend if needed.
- **Printer returns fiscal error** (e.g. "tax group not configured") → reply `status=ERROR errorCode=PRINTER_REJECTED errorMessage="<verbatim error from device>"`. Include the raw status word in logs for diagnosis.
- **Malformed payload** → reply `status=ERROR errorCode=BAD_PAYLOAD errorMessage="<reason>"`.
- **STOMP disconnected during processing** → finish the print, then attempt to send the reply on reconnect (keep a small in-memory buffer of unsent replies, drop after 10 minutes).

### Operational notes

- The bridge runs at the event venue on a Windows or Linux machine on the same LAN as the printer. It needs only outbound HTTPS/WSS (443) to the cloud — no inbound ports.
- Identity provisioning: a Servio admin issues a `deviceId` + `sharedToken` per cash register via the backoffice. Store them in env vars or a sealed config file on the bridge machine; never log the token.
- Time sync: the bridge machine should run NTP. The printer issues its own timestamp on the receipt, but the bridge timestamps STOMP frames; clock skew on the bridge will show up in correlation logs.

---

## Acceptance checklist

- [ ] Bridge connects to `wss://servioapp.ro/ws` with `X-ECR-Device-Id` + `X-ECR-Token`; bad credentials → connection refused (log + retry).
- [ ] Bridge reconnects automatically on disconnect (exponential backoff up to 60s).
- [ ] Bridge receives a `PRINT_RECEIPT` payload, prints a complete fiscal receipt on the Datecs printer, and replies with `status=OK` + `fiscalReceiptId` within 30s of receipt.
- [ ] Tax groups (VAT rates) match the merchant's printer configuration.
- [ ] Failure paths produce a clear `ERROR` reply that the dashboard renders meaningfully.
- [ ] Logs include `requestId` on every line involved in a single print so you can grep one transaction end-to-end.

Backend repo for reference (read-only — do *not* modify): https://github.com/Pezu/servio (the relevant Spring code lives under `api/src/main/java/com/servio/event/service/CashRegisterService.java` and `api/src/main/java/com/servio/event/web/EcrAgentController.java`).
