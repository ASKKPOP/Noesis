/**
 * JSON-RPC client — connects to Python brain via Unix socket.
 *
 * Uses newline-delimited JSON over a Unix domain socket.
 * Each request is a single line, each response is a single line.
 */

import { createConnection, Socket } from 'net';
import type { RPCRequest, RPCResponse, RPCError } from './types.js';

export interface RPCClientConfig {
    socketPath: string;
    timeoutMs?: number;  // Default: 30000
    reconnectMs?: number; // Default: 1000
}

export class RPCClient {
    private socket: Socket | null = null;
    private readonly socketPath: string;
    private readonly timeoutMs: number;
    private readonly reconnectMs: number;
    private requestId = 0;
    private pending = new Map<number, {
        resolve: (value: unknown) => void;
        reject: (reason: Error) => void;
        timer: ReturnType<typeof setTimeout>;
    }>();
    private buffer = '';

    constructor(config: RPCClientConfig) {
        this.socketPath = config.socketPath;
        this.timeoutMs = config.timeoutMs ?? 30000;
        this.reconnectMs = config.reconnectMs ?? 1000;
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket = createConnection(this.socketPath);

            this.socket.on('connect', () => {
                resolve();
            });

            this.socket.on('data', (data) => {
                this.buffer += data.toString();
                this.processBuffer();
            });

            this.socket.on('error', (err) => {
                reject(err);
            });

            this.socket.on('close', () => {
                // Reject all pending requests
                for (const [id, entry] of this.pending) {
                    clearTimeout(entry.timer);
                    entry.reject(new Error('Connection closed'));
                }
                this.pending.clear();
                this.socket = null;
            });
        });
    }

    async call(method: string, params?: Record<string, unknown>): Promise<unknown> {
        if (!this.socket) {
            throw new Error('Not connected to brain');
        }

        const id = ++this.requestId;
        const request: RPCRequest = {
            jsonrpc: '2.0',
            method,
            params,
            id,
        };

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`RPC timeout: ${method} (${this.timeoutMs}ms)`));
            }, this.timeoutMs);

            this.pending.set(id, { resolve, reject, timer });

            const line = JSON.stringify(request) + '\n';
            this.socket!.write(line);
        });
    }

    notify(method: string, params?: Record<string, unknown>): void {
        if (!this.socket) return;

        const request: RPCRequest = {
            jsonrpc: '2.0',
            method,
            params,
        };
        // No id = notification (fire-and-forget)
        this.socket.write(JSON.stringify(request) + '\n');
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.end();
            this.socket = null;
        }
    }

    get connected(): boolean {
        return this.socket !== null && !this.socket.destroyed;
    }

    private processBuffer(): void {
        const lines = this.buffer.split('\n');
        // Keep the last incomplete line in the buffer
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const response: RPCResponse = JSON.parse(line);
                this.handleResponse(response);
            } catch (e) {
                // Ignore malformed responses
            }
        }
    }

    private handleResponse(response: RPCResponse): void {
        if (response.id == null) return; // Notification response, ignore

        const id = typeof response.id === 'string' ? parseInt(response.id) : response.id;
        const entry = this.pending.get(id);
        if (!entry) return;

        clearTimeout(entry.timer);
        this.pending.delete(id);

        if (response.error) {
            entry.reject(new Error(`[${response.error.code}] ${response.error.message}`));
        } else {
            entry.resolve(response.result);
        }
    }
}
