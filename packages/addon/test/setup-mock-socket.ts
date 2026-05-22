import { WebSocket as MockWebSocket } from 'mock-socket'

// Replace global WebSocket with the mock for tests.
;

(globalThis as any).WebSocket = MockWebSocket
