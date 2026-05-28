import { handleAPI } from './api';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      const id = env.SIGNALING_DO.idFromName('global');
      const stub = env.SIGNALING_DO.get(id);
      return stub.fetch(request);
    }

    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};

export { SignalingDO } from './signaling';
