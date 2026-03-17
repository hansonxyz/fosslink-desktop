/**
 * Message Router
 *
 * Routes incoming WebSocket messages to registered handlers by message type.
 * No buffering needed — WebSocket frames are self-delimiting.
 */

import { createLogger } from '../utils/logger.js';
import type { Logger } from '../utils/logger.js';
import type { ProtocolMessage } from '../network/packet.js';
import type { DeviceConnection } from '../network/ws-server.js';

type MessageHandler = (msg: ProtocolMessage, connection: DeviceConnection) => void;

export class MessageRouter {
  private handlers = new Map<string, MessageHandler>();
  private logger: Logger;

  constructor() {
    this.logger = createLogger('message-router');
  }

  /**
   * Register a handler for a specific message type.
   */
  registerHandler(messageType: string, handler: MessageHandler): void {
    this.handlers.set(messageType, handler);
  }

  /**
   * Route a parsed message to the appropriate handler.
   */
  route(msg: ProtocolMessage, connection: DeviceConnection): void {
    const handler = this.handlers.get(msg.type);
    if (handler) {
      handler(msg, connection);
    } else {
      this.logger.debug('protocol.router', 'No handler for message type', {
        type: msg.type,
        deviceId: connection.deviceId,
      });
    }
  }
}

// Legacy alias
export { MessageRouter as PacketRouter };
