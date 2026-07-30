import './load-env.js';
import { serve } from '@hono/node-server';
import { app } from './app.js';
import { env } from './env.js';

const port = env.PORT;

const hostname = process.env.HOST ?? '0.0.0.0';

serve(
  {
    fetch: app.fetch,
    port,
    hostname,
  },
  (info) => {
    console.log(`@tim/api listening on http://${hostname}:${info.port}`);
  },
);
