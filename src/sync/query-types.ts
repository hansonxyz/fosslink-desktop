/**
 * Query System Types
 *
 * Shared types for the generic paginated query system.
 * Desktop sends fosslink.query, phone responds with fosslink.query.result pages,
 * desktop ACKs each page with fosslink.query.ack.
 */

/** Packet type constants */
export const MSG_QUERY = 'fosslink.query' as const;
export const MSG_QUERY_RESULT = 'fosslink.query.result' as const;
export const MSG_QUERY_ACK = 'fosslink.query.ack' as const;
/** Desktop → Phone: cancel an active query so the phone stops walking
 *  storage / cursors after the desktop has given up (timeout, abort, or
 *  caller no longer cares). Body: { queryId }. */
export const MSG_QUERY_CANCEL = 'fosslink.query.cancel' as const;

/** Desktop → Phone: query request */
export interface QueryRequest {
  queryId: string;
  resource: string;
  params: Record<string, unknown>;
}

/** Phone → Desktop: one page of query results */
export interface QueryResultPage {
  queryId: string;
  pageId: string;
  page: number;
  totalPages: number;
  data: unknown[];
  /** Phone's timestamp (epoch ms) when the query was executed. */
  queryTimestamp?: number;
}

/** Desktop → Phone: acknowledge a processed page */
export interface QueryAck {
  queryId: string;
  pageId: string;
}
