function generateCode(len) {
  const chars = '123456789';
  const array = new Uint8Array(len);
  crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

export async function handleAPI(request, env) {
  const url = new URL(request.url);
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (url.pathname === '/api/file/code' && request.method === 'POST') {
    const code = generateCode(8);
    const expireAt = new Date(Date.now() + 86400000).toISOString();
    await env.DB.prepare(
      'INSERT INTO file_codes (code, expire_at) VALUES (?1, ?2)'
    ).bind(code, expireAt).run();
    return new Response(JSON.stringify({ code }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (url.pathname === '/api/feedback' && request.method === 'POST') {
    const body = await request.json();
    await env.DB.prepare(
      'INSERT INTO feedbacks (contact, content) VALUES (?1, ?2)'
    ).bind(body.contact, body.content).run();
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  return new Response('Not Found', { status: 404 });
}
