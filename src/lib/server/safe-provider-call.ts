/**
 * Real external providers (Apify) can fail transiently — actor errors, rate
 * limits, timeouts on large accounts. Without this, any such failure threw
 * uncaught out of a Server Component and hit the generic error boundary
 * ("Something went wrong") instead of an honest, scoped empty state.
 */
export async function safeProviderCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error("Provider call failed:", error);
    return null;
  }
}
