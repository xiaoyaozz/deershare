let clientId = null;
let pollTimer = null;
let connected = false;
const connectCallbacks = [];
const messageHandlers = new Map();

function getApiBase() {
  if (window.DEERSHARE_CONFIG && window.DEERSHARE_CONFIG.apiBase) {
    return window.DEERSHARE_CONFIG.apiBase;
  }
  return '';
}

function registerMessageHandler(type, handler) {
  const handlers = messageHandlers.get(type) || [];
  handlers.push(handler);
  messageHandlers.set(type, handlers);
}

function removeMessageHandler(type, handler) {
  const handlers = messageHandlers.get(type) || [];
  const newHandlers = handlers.filter(h => h !== handler);
  if (newHandlers.length === 0) {
    messageHandlers.delete(type);
  } else {
    messageHandlers.set(type, newHandlers);
  }
}

function dispatch(type, payload) {
  const handlers = messageHandlers.get(type);
  if (!handlers) return;
  for (const handler of handlers) {
    try {
      handler(payload);
    } catch (err) {
      console.error('ws message handler error:', err);
    }
  }
}

async function apiPost(path, body) {
  const base = getApiBase();
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(path) {
  const base = getApiBase();
  const res = await fetch(base + path);
  return res.json();
}

async function pollLoop() {
  while (connected && clientId) {
    try {
      const data = await apiGet('/api/poll?clientId=' + encodeURIComponent(clientId));
      if (data.signals) {
        for (const signal of data.signals) {
          dispatch(signal.type, signal.payload);
        }
      }
    } catch (err) {
      console.error('poll error:', err);
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

function connect() {
  return new Promise(async (resolve, reject) => {
    if (connected && clientId) {
      return resolve();
    }
    try {
      const data = await apiPost('/api/connect', {});
      clientId = data.clientId;
      connected = true;
      dispatch('s2c_open', { id: clientId });
      pollLoop();
      resolve();
    } catch (err) {
      console.error('connect error:', err);
      reject(err);
    }
  });
}

async function sendJSON(obj) {
  if (!connected) {
    await connect();
  }

  const { type, payload } = obj;

  switch (type) {
    case 'c2s_prepare_send': {
      const data = await apiPost('/api/prepare-send', { clientId, ...payload });
      if (data.ok) {
        dispatch('s2c_prepare_send', { recvCode: data.recvCode });
      } else {
        dispatch('s2c_error', { message: '准备发送失败' });
      }
      break;
    }
    case 'c2s_prepare_recv': {
      const data = await apiPost('/api/prepare-recv', payload);
      if (data.ok) {
        dispatch('s2c_prepare_recv', data.payload);
      } else {
        dispatch('s2c_error', data.payload || { message: '收件码无效' });
      }
      break;
    }
    case 'c2s_signal': {
      await apiPost('/api/signal', { clientId, ...payload, type: payload.type });
      break;
    }
    case 'c2s_delete_recv_code': {
      await apiPost('/api/delete-code', payload);
      break;
    }
    case 'c2s_prepare_download': {
      const data = await apiPost('/api/prepare-download', payload);
      if (data.ok) {
        dispatch('s2c_prepare_download', data.payload);
      } else {
        dispatch('s2c_error', data.payload || { message: '下载码无效' });
      }
      break;
    }
    default:
      console.warn('unknown ws message type:', type);
  }
}

export default {
  sendJSON,
  registerMessageHandler,
  removeMessageHandler,
};
