export { GET, POST, PUT, PATCH, DELETE, OPTIONS } from '@tim/api/vercel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Import commit pode processar milhares de linhas. */
export const maxDuration = 300;
