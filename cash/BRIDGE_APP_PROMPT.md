# Servio Cash Register Bridge — implementation prompt

You are building a standalone Java application (the **bridge**) that:

1. Runs at the event venue, on the same LAN as one or more **Datecs fiscal printers** (DP / FP / WP series).
2. Maintains a persistent **STOMP-over-SockJS WebSocket** connection to the Servio backend in GCP.
3. Receives `PRINT_RECEIPT` commands pushed to a private STOMP queue.
4. Drives the configured Datecs printer over TCP (or RS-232 / USB) using Datecs' proprietary protocol to print a fiscal receipt.
5. Sends a structured reply (OK + fiscal receipt number, or ERROR + reason) back to the backend.

The backend is **already implemented and live**. Your job is *only* the bridge app — do not modify the backend. Everything in this document is copied verbatim from the working backend code; no field shape is invented.

---

## 1. Connection

| Item | Value |
|---|---|
| Backend URL (prod) | `wss://servioapp.ro/ws` |
| Backend URL (direct, no nginx hop) | `wss://api.servioapp.ro/ws` |
| Protocol | STOMP 1.2 over **SockJS** (the backend uses Spring's `.withSockJS()`) |
| Broker destinations | `/topic`, `/queue` |
| App (inbound) prefix | `/app` |
| User (per-session) prefix | `/user` |
| Transport | TLS 1.2+; the cert is Google Trust Services |
| Outbound only | bridge needs HTTPS/WSS 443 outbound; no inbound ports |

The endpoint is registered with `.withSockJS()`, so a STOMP-over-SockJS client is the canonical choice (`@stomp/stompjs` in JS land; in Java use `WebSocketStompClient` + `SockJsClient` + `WebSocketTransport` + `RestTemplateXhrTransport`). A raw STOMP-over-WebSocket client (no SockJS) also works against `/ws/websocket` because SockJS exposes that subpath, but the SockJS path is the documented one.

---

## 2. Authentication

The bridge is identified by **two values**, both issued to you out-of-band by a Servio admin (currently provisioned manually with a SQL insert; see §9):

| Header | Value |
|---|---|
| `X-ECR-Device-Id` | UUID — the primary key of a row in `event.cash_registers` |
| `X-ECR-Token` | secret string — the `shared_token` column for the same row |

These go into the **STOMP CONNECT frame as native headers** (not HTTP headers — the SockJS HTTP handshake doesn't see them; they're in the STOMP payload that follows the handshake).

In Spring's `WebSocketStompClient`:

```java
StompHeaders headers = new StompHeaders();
headers.add("X-ECR-Device-Id", config.deviceId());
headers.add("X-ECR-Token", config.sharedToken());
stompClient.connectAsync(url, new WebSocketHttpHeaders(), headers, sessionHandler);
```

On valid credentials the backend attaches an internal `EcrPrincipal(deviceId)` to the session. On invalid credentials the CONNECT is rejected with `Invalid ECR credentials` — your client should log it and back off before retrying (don't hammer; the credential isn't going to become valid by retrying).

### How credentials are issued

Currently a Servio admin runs:

```sql
INSERT INTO event.cash_registers (event_id, name, ip, shared_token)
VALUES (
  '<event UUID>',
  'Bar central',                           -- human-readable
  '192.168.1.50',                          -- LAN IP of the Datecs printer
  '<long random string, ≥ 32 chars>'
)
RETURNING id;                              -- this id is the deviceId
```

The returned `id` is your `X-ECR-Device-Id`. The `shared_token` is your `X-ECR-Token`. Both are then handed to whoever runs the bridge machine (env vars, sealed file — never commit, never log the token in plaintext).

---

## 3. STOMP destinations

After CONNECT succeeds:

### Subscribe to (incoming print jobs):

```
/user/queue/ecr/print
```

Spring's user-destination routing rewrites the backend's `convertAndSendToUser(deviceId, "/queue/ecr/print", payload)` onto your specific session's `/user/queue/ecr/print`. You subscribe with the literal string `/user/queue/ecr/print` — the user-prefix is resolved server-side per session.

### Send to (your reply):

```
/app/ecr/result
```

Handled by `EcrAgentController.handleAgentResult`. The principal name on your session is your `deviceId`, so the backend logs the reply attributing it to you.

---

## 4. Inbound command payload (server → bridge)

**MIME type**: `application/json` (STOMP `content-type: application/json` header).

### Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `requestId` | string (UUID) | yes | **Echo verbatim in your reply.** Backend uses this to correlate. |
| `receiptType` | string | yes | Currently always `"PAY_LATER"`. Reserved for future variants. |
| `paymentMethod` | string | yes | `"CARD"` (Netopia or POS terminal), `"CASH"`, or other. |
| `operator` | string | yes | Who triggered the print. `"NETOPIA"` if auto-triggered by IPN, or a cashier's name for manual prints. |
| `issuedAt` | string (ISO-8601 LocalDateTime, e.g. `"2026-05-21T10:32:01.235"`) | yes | When the backend dispatched the command. NOT the fiscal timestamp — the printer issues its own. |
| `eventId` | string (UUID) | yes | Event the order belongs to. |
| `cashRegister.deviceId` | string (UUID) | yes | Same as your `X-ECR-Device-Id`. |
| `cashRegister.name` | string | yes | Human-readable device name (matches the `cash_registers.name` row). |
| `cashRegister.ip` | string | yes | **The Datecs printer's IP address — authoritative target for this print.** May be a hostname. |
| `table.orderPointId` | string (UUID) | yes | The order point (table) the order(s) belong to. |
| `table.orderPointName` | string | yes | Human-readable order point name (e.g. `"Masa 5"`). |
| `orders` | array | yes | One entry per order being printed on this receipt. ≥ 1 element. |
| `orders[].orderId` | string (UUID) | yes | |
| `orders[].orderNo` | integer | yes | Per-event sequential order number. |
| `orders[].nickname` | string \| null | no | Customer-supplied nickname for the order. |
| `orders[].registrationId` | string (UUID) | yes | Guest registration. |
| `orders[].groupId` | string (UUID) | yes | |
| `lines` | array | yes | Receipt lines (one per non-cancelled item across all orders). ≥ 1 element. |
| `lines[].orderId` | string (UUID) | yes | Which order this line came from. |
| `lines[].orderNo` | integer | yes | |
| `lines[].itemId` | string (UUID) | yes | |
| `lines[].name` | string | yes | Product name, ≤ 100 chars typically. **Print this exactly.** |
| `lines[].quantity` | integer | yes | |
| `lines[].unitPrice` | decimal (gross, VAT-included, RON) | yes | |
| `lines[].vatRate` | decimal | yes | Romanian VAT rates: `19`, `9`, `5`, or `0`. |
| `lines[].lineNet` | decimal | yes | VAT-exclusive subtotal for this line (server-computed). |
| `lines[].lineVat` | decimal | yes | VAT amount for this line. |
| `lines[].lineTotal` | decimal | yes | VAT-inclusive total for this line (= `unitPrice * quantity`). |
| `totals.net` | decimal | yes | Sum of `lines[].lineNet`. |
| `totals.vat` | decimal | yes | Sum of `lines[].lineVat`. |
| `totals.total` | decimal | yes | Sum of `lines[].lineTotal`. **The amount to charge.** |

Currency is always **RON**.

### Example

```json
{
  "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "receiptType": "PAY_LATER",
  "paymentMethod": "CARD",
  "operator": "NETOPIA",
  "issuedAt": "2026-05-21T10:32:01.235",
  "eventId": "f7c3b1a4-1e2d-4a3b-9c8d-7e6f5a4b3c2d",
  "cashRegister": {
    "deviceId": "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "name": "Bar central",
    "ip": "192.168.1.50"
  },
  "table": {
    "orderPointId": "00112233-4455-6677-8899-aabbccddeeff",
    "orderPointName": "Masa 5"
  },
  "orders": [
    {
      "orderId": "11223344-5566-7788-99aa-bbccddeeff00",
      "orderNo": 142,
      "nickname": "Radu",
      "registrationId": "22334455-6677-8899-aabb-ccddeeff0011",
      "groupId": "33445566-7788-99aa-bbcc-ddeeff001122"
    }
  ],
  "lines": [
    {
      "orderId": "11223344-5566-7788-99aa-bbccddeeff00",
      "orderNo": 142,
      "itemId": "44556677-8899-aabb-ccdd-eeff00112233",
      "name": "Coca-Cola 0.5L",
      "quantity": 2,
      "unitPrice": 5.00,
      "vatRate": 19,
      "lineNet": 8.40,
      "lineVat": 1.60,
      "lineTotal": 10.00
    },
    {
      "orderId": "11223344-5566-7788-99aa-bbccddeeff00",
      "orderNo": 142,
      "itemId": "55667788-99aa-bbcc-ddee-ff0011223344",
      "name": "Tort de ciocolată",
      "quantity": 1,
      "unitPrice": 20.00,
      "vatRate": 9,
      "lineNet": 18.35,
      "lineVat": 1.65,
      "lineTotal": 20.00
    }
  ],
  "totals": {
    "net": 26.75,
    "vat": 3.25,
    "total": 30.00
  }
}
```

---

## 5. Outbound reply (bridge → server)

**STOMP SEND** to `/app/ecr/result` with `content-type: application/json`.

The body is wrapped: top-level `requestId` (echo from the command) + nested `response` object (matches the backend's `CashRegisterReceiptResponse` DTO field-for-field).

### Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `requestId` | string (UUID) | yes | **Echo verbatim** from the command. |
| `response.status` | string | yes | `"OK"` on success, `"ERROR"` on failure. |
| `response.receiptNumber` | string | OK only | Datecs sequential receipt number, zero-padded e.g. `"00012345"`. |
| `response.fiscalReceiptId` | string | OK only | Datecs fiscal-memory id (the FM record number). |
| `response.cashRegisterSerial` | string | OK only | Device serial (read once at startup; e.g. `"DATECS-DP-25-12345678"`). |
| `response.issuedAt` | string (ISO-8601 LocalDateTime) | yes | When the printer issued the receipt. |
| `response.totalAmount` | decimal | OK only | Echo of `command.totals.total`. |
| `response.paymentMethod` | string | yes | Echo of `command.paymentMethod`. |
| `response.errorCode` | string | ERROR only | Short machine-readable code (see error codes below). |
| `response.errorMessage` | string | ERROR only | Human-readable, ≤ 500 chars. |

### Example — success

```json
{
  "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "response": {
    "status": "OK",
    "receiptNumber": "00012345",
    "fiscalReceiptId": "FIS-1779354185-3245",
    "cashRegisterSerial": "DATECS-DP-25-12345678",
    "issuedAt": "2026-05-21T10:32:04.123",
    "totalAmount": 30.00,
    "paymentMethod": "CARD"
  }
}
```

### Example — failure

```json
{
  "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "response": {
    "status": "ERROR",
    "errorCode": "PRINTER_OFFLINE",
    "errorMessage": "Datecs DP-25 at 192.168.1.50 did not respond within 10s",
    "issuedAt": "2026-05-21T10:32:04.123",
    "paymentMethod": "CARD"
  }
}
```

### Suggested error codes

| Code | Meaning |
|---|---|
| `PRINTER_OFFLINE` | TCP connect / serial open failed, or no response within timeout. |
| `PRINTER_REJECTED` | Printer reached but returned a fiscal/protocol error (include raw status word in `errorMessage`). |
| `BAD_PAYLOAD` | Command failed validation (missing field, unknown VAT rate, …). |
| `INTERNAL` | Catch-all for bridge-side bugs. |

After you send `/app/ecr/result` the backend resolves the matching `requestId`, then **rebroadcasts your reply** on `/topic/event/{eventId}/cash-register-reply` so the cashier dashboard updates in real time. You don't need to do anything else.

---

## 6. End-to-end flow

```
Bridge boot
   ├─► STOMP CONNECT to wss://servioapp.ro/ws
   │     headers:  X-ECR-Device-Id: <uuid>
   │               X-ECR-Token:     <secret>
   ├─► CONNECTED
   └─► SUBSCRIBE /user/queue/ecr/print

  ... server pushes a PRINT_RECEIPT to your queue ...

Bridge handler
   ├─► Parse JSON, validate
   ├─► Open TCP to cashRegister.ip:9100 (Datecs default)
   ├─► Send Datecs fiscal sequence:
   │     1) Open fiscal receipt (Op 30) + operator/password
   │     2) For each line: Sell article (Op 31) name, qty, price, taxGroup
   │     3) Subtotal (Op 33)
   │     4) Total (Op 35) — payment-mode 3 for CARD, 1 for CASH
   │     5) Close fiscal receipt (Op 38)  → response carries receipt # + FM id
   │     6) Optional paper cut
   ├─► Build reply (status OK + receipt#/FM id)
   ├─► SEND /app/ecr/result  { requestId, response }
   └─► Loop
```

Datecs operation codes above are illustrative — refer to your specific model's protocol manual (e.g. DP-25 ICAR has slightly different framing than FP-700 or WP-500). The framing wrapper is consistent: `01` `LEN` `SEQ` `CMD` `DATA` `05` `BCC` `03` with BCC = sum of bytes between `LEN..05` modulated.

---

## 7. VAT / tax group mapping

Romania uses these VAT rates:

| Rate | Datecs tax group (typical) | Notes |
|---|---|---|
| 19 | **A** | Standard (most goods) |
| 9 | **B** | Reduced (food, books) |
| 5 | **C** | Super-reduced (some real estate) |
| 0 | **D** | Exempt |

The **actual letter ↔ rate binding lives in the printer's fiscal memory** (set at fiscal commissioning by the service tech). It can be different in practice; double-check with the merchant before deployment. Make this mapping **configurable** in the bridge (see config below), not hard-coded.

---

## 8. Configuration (`application.yml`)

```yaml
servio:
  backend-url: wss://servioapp.ro/ws            # SockJS STOMP endpoint
  device-id: ${SERVIO_DEVICE_ID}                # X-ECR-Device-Id (UUID)
  shared-token: ${SERVIO_SHARED_TOKEN}          # X-ECR-Token (secret)
  reconnect-delay-ms: 5000
  reconnect-max-delay-ms: 60000                  # exponential backoff cap
  reconnect-max-attempts: 0                      # 0 = forever

datecs:
  default-host: 192.168.1.50                    # fallback if payload omits cashRegister.ip
  default-port: 9100
  connect-timeout-ms: 5000
  read-timeout-ms: 10000
  operator-code: "1"                             # Datecs operator slot
  operator-password: "0000"                      # Datecs operator password
  tax-mapping:                                   # vatRate -> tax group letter
    "19": "A"
    "9":  "B"
    "5":  "C"
    "0":  "D"
  payment-mapping:                               # paymentMethod -> Datecs payment mode
    CARD: 3
    CASH: 1
  cut-paper: true

logging:
  file:
    name: bridge.log
  level:
    root: INFO
    com.servio.bridge: INFO
    com.servio.bridge.protocol: DEBUG            # turn on for printer wire-level debugging
```

Provision `SERVIO_DEVICE_ID` and `SERVIO_SHARED_TOKEN` via environment variables or a sealed file (e.g. systemd `EnvironmentFile=` with mode `600`). **Never log the token; never commit it.**

---

## 9. Tech stack & components

- **Java 21**, Spring Boot 3.2+
- `spring-boot-starter-websocket` (provides `WebSocketStompClient` + SockJS client)
- `spring-boot-starter-actuator` (health/metrics; expose `/actuator/health` on the bridge for monitoring)
- **Datecs SDK** (vendor-provided JAR) — preferred over hand-rolling the protocol. If unavailable, implement the framing over `java.net.Socket` per the model's protocol manual.
- Build: Maven, runs as a single fat-jar (`java -jar bridge.jar`)
- Logging: SLF4J + logback, file + console
- Tests: at least one integration test against a fake STOMP server (Spring's embedded broker) and a fake Datecs printer (a `ServerSocket` that responds with canned acks)

### Components

- **`BridgeApplication`** — Spring Boot entry; on `ApplicationReadyEvent` triggers `StompClientService.connect()`.
- **`StompClientService`** — connection lifecycle: connect, subscribe `/user/queue/ecr/print`, reconnect with exponential backoff on disconnect. Handles the auth headers.
- **`ReceiptHandler` (StompFrameHandler)** — receives a parsed `PrintCommand` from the queue, hands to `PrinterService`, builds the reply, sends via STOMP. Wrap in try/catch so a printer failure becomes a `status=ERROR` reply rather than a swallowed exception.
- **`DatecsPrinterService`** — opens the TCP socket to `command.cashRegister.ip`, runs the fiscal sequence, returns a `PrintResult` (success: receipt# + FM id + serial; failure: errorCode + errorMessage).
- **DTOs** — `PrintCommand`, `PrintCommandLine`, `PrintCommandTotals`, `PrintReply`, `PrintResponse`. **Field names must match §4 and §5 exactly** (Jackson default mapping is fine; no `@JsonProperty` renames needed).

---

## 10. Reliability rules

- **Printer unreachable** → reply `status=ERROR errorCode=PRINTER_OFFLINE`. **Do not retry inside the bridge** — the backend will dispatch a new command if needed.
- **Printer returns a fiscal/protocol error** → reply `status=ERROR errorCode=PRINTER_REJECTED errorMessage="<verbatim error>"`. Include the raw status word in your logs for diagnosis.
- **Malformed payload** → reply `status=ERROR errorCode=BAD_PAYLOAD errorMessage="<reason>"`. Don't crash the connection.
- **STOMP disconnect while processing** → finish the print, buffer the reply in memory, send on reconnect. Drop buffered replies older than 10 min (the backend's correlation map drops eventually too).
- **Multiple commands in flight** — the queue is per-session; you'll get them in order. Print serially per printer (Datecs devices typically can't handle concurrent fiscal sequences). If you support multiple printers from one bridge, run a thread/queue per printer IP.

---

## 11. Operational notes

- Bridge runs at the venue on Windows or Linux on the same LAN as the printer. Outbound 443 only.
- Time sync: run NTP. The printer issues its own fiscal timestamp; bridge timestamps only frame STOMP messages. Clock skew shows in correlation logs but doesn't break correctness.
- Expose `GET /actuator/health` on a local port (`management.server.port: 9099`) so a monitoring tool / human can verify "is the bridge alive and connected to backend".
- Log every line of one print transaction with the `requestId` — grepping by `requestId` should give you the full transcript.

---

## 12. Acceptance checklist

- [ ] Connects to `wss://servioapp.ro/ws` with `X-ECR-Device-Id` + `X-ECR-Token`; bad credentials → connection refused, exponential backoff before retry.
- [ ] Reconnects automatically on disconnect, no manual intervention.
- [ ] Receives a `PRINT_RECEIPT` payload, prints a complete fiscal receipt on the Datecs printer at `command.cashRegister.ip`, and replies to `/app/ecr/result` with `status=OK` + `fiscalReceiptId` within 30s of receiving the command.
- [ ] VAT rate ↔ tax-group binding is configurable, not hard-coded.
- [ ] Failure paths produce a clear `ERROR` reply with the documented `errorCode` values.
- [ ] Logs include `requestId` on every line involved in a single print so you can grep one transaction end-to-end.
- [ ] `GET /actuator/health` returns `UP` only when both the STOMP session and the printer are reachable.

---

## 13. Reference (backend, do not modify)

- Repo: https://github.com/Pezu/servio
- Backend STOMP / WS config: `api/src/main/java/com/servio/event/config/WebSocketConfig.java`
- Auth interceptor (header validation): `api/src/main/java/com/servio/event/config/EcrChannelInterceptor.java`
- Outbound payload builder + dispatcher: `api/src/main/java/com/servio/event/service/CashRegisterService.java`
- Inbound reply handler: `api/src/main/java/com/servio/event/web/EcrAgentController.java`
- Reply DTO (must match field-for-field): `api/src/main/java/com/servio/event/dto/CashRegisterReceiptResponse.java`
- Auto-trigger from Netopia IPN: `api/src/main/java/com/servio/event/service/CashRegisterPaymentListener.java`
