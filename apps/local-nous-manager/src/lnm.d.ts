/** Typings for the preload bridge (window.lnm). */
export interface Settings {
  brainDir: string;
  pythonPath: string;
  configPath: string;
  httpPort: number;
  httpSecret: string;
  extraEnv: Record<string, string>;
}

export interface ApiResult {
  ok: boolean;
  status: number;
  data?: any;
  error?: string;
}

export interface LnmBridge {
  settingsGet(): Promise<Settings>;
  settingsSave(s: Partial<Settings>): Promise<Settings>;
  brainStart(): Promise<{ ok: boolean; pid?: number; error?: string }>;
  brainStop(): Promise<{ ok: boolean; error?: string }>;
  brainStatus(): Promise<{ running: boolean; pid: number | null }>;
  brainLogs(): Promise<string[]>;
  apiGet(key: 'state' | 'memory' | 'wiki' | 'aiStatus' | 'aiModels'): Promise<ApiResult>;
  configRead(): Promise<{ ok: boolean; path?: string; text?: string; error?: string }>;
  configWrite(text: string): Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    lnm?: LnmBridge;
  }
}
