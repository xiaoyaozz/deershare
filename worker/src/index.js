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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

async function handleConnect(request, env) {
  const clientId = generateId();
  await env.DB.prepare('INSERT INTO sessions (client_id) VALUES (?1)').bind(clientId).run();
  return jsonResponse({ clientId });
}

async function handlePrepareSend(request, env) {
  const { clientId, files, message } = await request.json();
  const recvCode = generateId(6);
  await env.DB.prepare(
    'INSERT INTO recv_codes (code, client_id, files, message) VALUES (?1, ?2, ?3, ?4)'
  ).bind(recvCode, clientId, JSON.stringify(files), message || '').run();
  return jsonResponse({ ok: true, recvCode, type: 's2c_prepare_send', payload: { recvCode } });
}

async function handlePrepareRecv(request, env) {
  const { recvCode } = await request.json();
  const row = await env.DB.prepare('SELECT client_id, files, message FROM recv_codes WHERE code = ?1').bind(recvCode).first();
  if (!row) {
    return jsonResponse({ ok: false, type: 's2c_error', payload: { message: '收件码无效' } });
  }
  return jsonResponse({
    ok: true,
    type: 's2c_prepare_recv',
    payload: { clientId: row.client_id, files: JSON.parse(row.files), message: row.message },
  });
}

async function handleSignal(request, env) {
  const { clientId, targetId, sdp, ice } = await request.json();
  const payload = {};
  if (sdp) payload.sdp = sdp;
  if (ice) payload.ice = ice;
  await env.DB.prepare(
    'INSERT INTO pending_signals (target_client_id, src_client_id, signal_payload) VALUES (?1, ?2, ?3)'
  ).bind(targetId, clientId, JSON.stringify(payload)).run();
  return jsonResponse({ ok: true });
}

async function handlePoll(request, env) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId');
  if (!clientId) return jsonResponse({ signals: [] });

  const rows = await env.DB.prepare(
    'SELECT id, src_client_id, signal_payload FROM pending_signals WHERE target_client_id = ?1 ORDER BY id ASC LIMIT 50'
  ).bind(clientId).all();

  const signals = [];
  for (const row of rows.results) {
    signals.push({
      type: 's2c_signal',
      payload: { srcId: row.src_client_id, ...JSON.parse(row.signal_payload) },
    });
    await env.DB.prepare('DELETE FROM pending_signals WHERE id = ?1').bind(row.id).run();
  }

  return jsonResponse({ signals });
}

async function handleDeleteRecvCode(request, env) {
  const { recvCode } = await request.json();
  await env.DB.prepare('DELETE FROM recv_codes WHERE code = ?1').bind(recvCode).run();
  return jsonResponse({ ok: true });
}

async function handleFileCode(request, env) {
  const code = generateId(8);
  const expireAt = new Date(Date.now() + 86400000).toISOString();
  await env.DB.prepare('INSERT INTO file_codes (code, expire_at) VALUES (?1, ?2)').bind(code, expireAt).run();
  return jsonResponse({ code });
}

async function handleFeedback(request, env) {
  const body = await request.json();
  await env.DB.prepare('INSERT INTO feedbacks (contact, content) VALUES (?1, ?2)').bind(body.contact, body.content).run();
  return new Response('OK', { status: 200, headers: corsHeaders() });
}

async function handlePrepareDownload(request, env) {
  const { downloadCode } = await request.json();
  const row = await env.DB.prepare('SELECT client_id, files, message FROM recv_codes WHERE code = ?1').bind(downloadCode).first();
  if (!row) {
    return jsonResponse({ ok: false, type: 's2c_error', payload: { message: '下载码无效' } });
  }
  return jsonResponse({
    ok: true,
    type: 's2c_prepare_download',
    payload: { clientId: row.client_id, files: JSON.parse(row.files), message: row.message },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/api/connect' && request.method === 'POST') {
        return await handleConnect(request, env);
      }
      if (path === '/api/prepare-send' && request.method === 'POST') {
        return await handlePrepareSend(request, env);
      }
      if (path === '/api/prepare-recv' && request.method === 'POST') {
        return await handlePrepareRecv(request, env);
      }
      if (path === '/api/signal' && request.method === 'POST') {
        return await handleSignal(request, env);
      }
      if (path === '/api/poll' && request.method === 'GET') {
        return await handlePoll(request, env);
      }
      if (path === '/api/delete-code' && request.method === 'POST') {
        return await handleDeleteRecvCode(request, env);
      }
      if (path === '/api/file/code' && request.method === 'POST') {
        return await handleFileCode(request, env);
      }
      if (path === '/api/feedback' && request.method === 'POST') {
        return await handleFeedback(request, env);
      }
      if (path === '/api/prepare-download' && request.method === 'POST') {
        return await handlePrepareDownload(request, env);
      }
    } catch (err) {
      return jsonResponse({ ok: false, error: err.message }, 500);
    }

    if (path === '/') {
      return jsonResponse({ status: 'ok', service: 'deershare-signaling', version: '1.0.0' });
    }

    return new Response('Not Found', { status: 404 });
  },
};
