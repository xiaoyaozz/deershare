function generateId(len) {
  const chars = '123456789';
  const array = new Uint8Array(len || 8);
  crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < (len || 8); i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

export class SignalingDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map();
    this.clientIdToRecvCodes = new Map();
    this.recvCodeToFiles = new Map();
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    const clientId = generateId();
    this.clients.set(clientId, { socket: server, peerId: null });

    server.send(JSON.stringify({
      type: 's2c_open',
      payload: { id: clientId },
    }));

    server.addEventListener('message', (event) => {
      try {
        this.handleMessage(clientId, event.data);
      } catch (err) {
        console.error('handleMessage error:', err);
      }
    });

    server.addEventListener('close', () => {
      this.handleClose(clientId);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  handleMessage(clientId, raw) {
    const msg = JSON.parse(raw);
    const { type, payload } = msg;

    switch (type) {
      case 'c2s_signal': {
        const { targetId, ...others } = payload;
        const target = this.clients.get(targetId);
        if (!target) {
          const client = this.clients.get(clientId);
          if (client) {
            client.socket.send(JSON.stringify({
              type: 's2c_error',
              payload: { message: '连接失败，对方可能已离线' },
            }));
          }
          return;
        }
        target.socket.send(JSON.stringify({
          type: 's2c_signal',
          payload: { srcId: clientId, ...others },
        }));
        break;
      }
      default:
        this.handleClientMessage(clientId, type, payload);
    }
  }

  handleClientMessage(clientId, type, payload) {
    switch (type) {
      case 'c2s_open':
        break;
      case 'c2s_prepare_send': {
        const { files, message } = (payload || {});
        const recvCode = generateId(6);
        this.recvCodeToFiles.set(recvCode, { clientId, message, files });
        this.clientIdToRecvCodes.set(clientId, recvCode);

        const client = this.clients.get(clientId);
        if (client) {
          client.socket.send(JSON.stringify({
            type: 's2c_prepare_send',
            payload: { recvCode },
          }));
        }
        break;
      }
      case 'c2s_delete_recv_code': {
        const { recvCode } = (payload || {});
        this.recvCodeToFiles.delete(recvCode);
        break;
      }
      case 'c2s_prepare_recv': {
        const { recvCode } = (payload || {});
        const info = this.recvCodeToFiles.get(recvCode);
        const client = this.clients.get(clientId);
        if (!client) return;

        if (info) {
          client.socket.send(JSON.stringify({
            type: 's2c_prepare_recv',
            payload: {
              message: info.message,
              files: info.files,
              clientId: info.clientId,
            },
          }));
        } else {
          client.socket.send(JSON.stringify({
            type: 's2c_error',
            payload: { message: '收件码无效' },
          }));
        }
        break;
      }
    }
  }

  handleClose(clientId) {
    this.clients.delete(clientId);
    const recvCode = this.clientIdToRecvCodes.get(clientId);
    this.clientIdToRecvCodes.delete(clientId);
    if (recvCode) {
      this.recvCodeToFiles.delete(recvCode);
    }
  }
}
