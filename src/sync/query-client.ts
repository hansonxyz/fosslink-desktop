/**
 * Query Client
 *
 * Desktop-side generic paginated query client. Sends fosslink.query requests
 * to the phone, collects fosslink.query.result pages, sends fosslink.query.ack
 * for each page, and resolves a Promise with the full concatenated result.
 *
 * Pagination is invisible to callers — they call query(resource, params) and
 * get back a Promise<unknown[]> with the complete result.
 *
 * One query at a time. If a query is in progress, subsequent calls are queued.
 * On disconnect, all pending and queued queries are rejected.
 */

import { randomUUID } from 'node:crypto';
import { debugConsole } from './debug-console.js';
import {
  MSG_QUERY,
  MSG_QUERY_ACK,
} from './query-types.js';
import type { QueryResultPage } from './query-types.js';
import type { ProtocolMessage } from '../network/packet.js';

interface PendingQuery {
  queryId: string;
  resource: string;
  resolve: (data: unknown[]) => void;
  reject: (err: Error) => void;
  pages: Map<number, unknown[]>;  // page number → data
  totalPages: number | null;      // null until first page arrives
  receivedCount: number;
  startTime: number;
  /** Optional callback invoked for each page as it arrives (streaming mode). */
  onPage?: (items: unknown[], page: number, totalPages: number) => void;
}

type SendFunction = (msg: ProtocolMessage) => void;

export class QueryClient {
  private sendMessage: SendFunction | null = null;
  private active: PendingQuery | null = null;
  private queue: Array<{
    resource: string;
    params: Record<string, unknown>;
    resolve: (data: unknown[]) => void;
    reject: (err: Error) => void;
  }> = [];

  /**
   * Set the function used to send messages to the phone.
   * Called when a device connection is established.
   */
  setSendFunction(fn: SendFunction): void {
    this.sendMessage = fn;
  }

  /**
   * Clear the send function and reject all pending/queued queries.
   * Called when the connection drops.
   */
  clearSendFunction(): void {
    this.sendMessage = null;

    if (this.active) {
      this.active.reject(new Error('Disconnected'));
      this.active = null;
    }

    for (const queued of this.queue) {
      queued.reject(new Error('Disconnected'));
    }
    this.queue.length = 0;
  }

  /**
   * Send a query to the phone and return the complete result.
   * Pagination is handled internally — the caller gets a flat array.
   */
  query(resource: string, params: Record<string, unknown> = {}): Promise<unknown[]> {
    return new Promise<unknown[]>((resolve, reject) => {
      if (!this.sendMessage) {
        reject(new Error('No device connected'));
        return;
      }

      if (this.active) {
        // Queue it — will be dispatched when current query completes
        this.queue.push({ resource, params, resolve, reject });
        debugConsole.log('transport', 'query', `Queued: ${resource} (${this.queue.length} in queue)`);
        return;
      }

      this.dispatch(resource, params, resolve, reject);
    });
  }

  /**
   * Send a streaming query — calls onPage for each page as it arrives.
   * Returns an abort function to cancel the query early.
   * The final Promise resolves with the full concatenated result.
   */
  queryStreaming(
    resource: string,
    params: Record<string, unknown>,
    onPage: (items: unknown[], page: number, totalPages: number) => void,
  ): { promise: Promise<unknown[]>; abort: () => void } {
    let abortFn: (() => void) | undefined;

    const promise = new Promise<unknown[]>((resolve, reject) => {
      if (!this.sendMessage) {
        reject(new Error('No device connected'));
        return;
      }

      abortFn = () => {
        if (this.active?.resource === resource) {
          this.active.reject(new Error('Aborted'));
          this.active = null;
          this.drainQueue();
        }
      };

      if (this.active) {
        this.queue.push({ resource, params, resolve, reject });
        return;
      }

      this.dispatch(resource, params, resolve, reject, onPage);
    });

    return { promise, abort: () => abortFn?.() };
  }

  /**
   * Handle an incoming fosslink.query.result page from the phone.
   * Called by the message router.
   */
  handleResultPage(page: QueryResultPage): void {
    if (!this.active || this.active.queryId !== page.queryId) {
      debugConsole.log('transport', 'query', `Received page for unknown query ${page.queryId}`);
      return;
    }

    const q = this.active;

    // Store total pages from first response
    if (q.totalPages === null) {
      q.totalPages = page.totalPages;
    }

    // Store page data
    q.pages.set(page.page, page.data);
    q.receivedCount++;

    // Streaming callback — deliver items to caller as they arrive
    if (q.onPage && page.totalPages !== undefined) {
      q.onPage(page.data, page.page, page.totalPages);
    }

    debugConsole.log('transport', 'query',
      `Page ${page.page}/${page.totalPages} received (${page.data.length} items), ACK sent`);

    // Send ACK
    if (this.sendMessage) {
      this.sendMessage({
        type: MSG_QUERY_ACK,
        body: { queryId: page.queryId, pageId: page.pageId },
      });
    }

    // Check if query is complete
    if (q.totalPages !== null && q.receivedCount >= q.totalPages) {
      this.completeQuery(q);
    }
  }

  /** Whether a query is currently in progress. */
  isBusy(): boolean {
    return this.active !== null;
  }

  // --- Internal ---

  private dispatch(
    resource: string,
    params: Record<string, unknown>,
    resolve: (data: unknown[]) => void,
    reject: (err: Error) => void,
    onPage?: (items: unknown[], page: number, totalPages: number) => void,
  ): void {
    const queryId = randomUUID();

    this.active = {
      queryId,
      resource,
      resolve,
      reject,
      pages: new Map(),
      totalPages: null,
      receivedCount: 0,
      startTime: Date.now(),
      onPage,
    };

    debugConsole.log('query', 'query', `→ query ${resource} ${JSON.stringify(params)}`);
    debugConsole.log('trace', 'query', `  queryId: ${queryId}`);

    this.sendMessage!({
      type: MSG_QUERY,
      body: { queryId, resource, params },
    });
  }

  private completeQuery(q: PendingQuery): void {
    // Concatenate pages in order
    const result: unknown[] = [];
    for (let i = 1; i <= (q.totalPages ?? 0); i++) {
      const pageData = q.pages.get(i);
      if (pageData) {
        result.push(...pageData);
      }
    }

    const elapsed = Date.now() - q.startTime;
    debugConsole.log('query', 'query',
      `← ${result.length} items in ${q.totalPages} page${q.totalPages === 1 ? '' : 's'} (${elapsed}ms)`);

    this.active = null;
    q.resolve(result);

    // Dispatch next queued query
    this.drainQueue();
  }

  private drainQueue(): void {
    if (this.active || this.queue.length === 0) return;

    const next = this.queue.shift()!;
    if (!this.sendMessage) {
      next.reject(new Error('Disconnected'));
      this.drainQueue();
      return;
    }

    this.dispatch(next.resource, next.params, next.resolve, next.reject);
  }
}
