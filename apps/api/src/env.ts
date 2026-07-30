import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  ENCRYPTION_SECRET: z.string().min(16).optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  DEMO_MODE: z.enum(['0', '1', 'true', 'false']).optional(),
  SKIP_ENV_VALIDATION: z.enum(['0', '1']).optional(),
  APP_BASE_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
});

function parseEnv(): z.infer<typeof envSchema> {
  if (process.env.SKIP_ENV_VALIDATION === '1') {
    return envSchema.parse({
      ...process.env,
      CLERK_PUBLISHABLE_KEY:
        process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    });
  }
  return envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_PUBLISHABLE_KEY:
      process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,
    PORT: process.env.PORT,
    DEMO_MODE: process.env.DEMO_MODE,
    SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
    APP_BASE_URL: process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  });
}

export const env = parseEnv();

export function isDemoMode(): boolean {
  return env.DEMO_MODE === '1' || env.DEMO_MODE === 'true';
}
