import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().optional(),
    CLERK_SECRET_KEY: z.string().min(1).optional(),
    ENCRYPTION_SECRET: z.string().min(16).optional(),
    CRON_SECRET: z.string().min(8).optional(),
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === '1',
  emptyStringAsUndefined: true,
});
