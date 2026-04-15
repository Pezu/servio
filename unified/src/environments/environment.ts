export const environment = {
  production: false,
  // Gateway URL - all API calls go through the gateway
  apiUrl: 'http://192.168.0.249:8080',
  // WebSocket URL - gateway proxies to WebSocket server
  wsUrl: 'ws://192.168.0.249:8080/ws'
};
