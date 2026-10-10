/**
 * Reports the state of the server-side data sources. Makes no outbound calls.
 *
 * The probe that used to request a public Instagram endpoint was removed with
 * that endpoint, because it was an undocumented source. What is left reads the
 * Apify quota breaker's in-memory state, so a diagnostic never spends a billed
 * run.
 */
import { isApifyQuotaBreakerOpen } from "../providers/apify/client";

export interface SourceDiagnostics {
  apify: { quotaBreakerOpen: boolean };
}

export async function probeSources(): Promise<SourceDiagnostics> {
  return {
    apify: { quotaBreakerOpen: isApifyQuotaBreakerOpen() },
  };
}
