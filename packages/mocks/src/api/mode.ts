/** UI/offline mock — sem API, banco ou Clerk. Ative com MOCK_API=1 / NEXT_PUBLIC_MOCK_API=1. */
export function isMockApiMode(): boolean {
  const values = [process.env.NEXT_PUBLIC_MOCK_API, process.env.MOCK_API];
  return values.some((v) => v === '1' || v === 'true');
}
