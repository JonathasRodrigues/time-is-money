import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { v1Routes } from './routes/v1.js';

export const app = new Hono();

app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*',
    credentials: true,
    allowHeaders: ['Authorization', 'Content-Type', 'Accept'],
    exposeHeaders: ['X-Tim-Api-Version'],
  }),
);

app.get('/health', (c) => c.json({ ok: true, service: '@tim/api' }));

app.route('/api/v1', v1Routes);
