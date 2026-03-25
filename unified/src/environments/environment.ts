export const environment = {
  production: false,
  // Gateway URL - all API calls go through the gateway
  apiUrl: 'http://localhost:8080',
  // WebSocket URL - gateway proxies to WebSocket server
  wsUrl: 'ws://localhost:8080/ws'
};
