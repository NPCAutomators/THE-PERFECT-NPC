import type { ConnectionState } from "@/lib/gatewayClient";

export type WebChatMessageRole = "assistant" | "system" | "tool" | "user";
export type WebChatMessageStatus = "complete" | "error" | "streaming";

export interface WebChatToolCall {
  id: string;
  name: string;
  status: "complete" | "running";
  input?: string;
  progress?: string;
  output?: string;
  error?: string;
  durationSeconds?: number;
}

export interface WebChatMessage {
  id: string;
  role: WebChatMessageRole;
  content: string;
  reasoning?: string;
  toolCalls?: WebChatToolCall[];
  status: WebChatMessageStatus;
  createdAt: number;
}

export interface WebChatSession {
  id: string;
  title: string;
  preview: string;
  source: string;
  model: string;
  startedAt: number;
  lastActive: number;
  messageCount: number;
}

export interface WebChatRuntimeInfo {
  model: string;
  provider: string;
  reasoningEffort: string;
  serviceTier: string;
  cwd: string;
  branch: string;
  title: string;
}

export type WebChatPrompt =
  | {
      kind: "clarify";
      requestId: string;
      question: string;
      choices: string[] | null;
    }
  | {
      kind: "approval";
      command: string;
      description: string;
      choices?: string[];
      allowPermanent: boolean;
      smartDenied: boolean;
    }
  | { kind: "sudo"; requestId: string }
  | {
      kind: "secret";
      requestId: string;
      envVar: string;
      prompt: string;
    };

export interface WebChatImageAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  path?: string;
  status: "error" | "ready" | "uploading";
  error?: string;
}

export type WebChatPhase =
  | "disabled"
  | "connecting"
  | "creating"
  | "resuming"
  | "ready"
  | "working"
  | "interrupting"
  | "error";

export interface WebChatState {
  connectionState: ConnectionState;
  phase: WebChatPhase;
  runtimeSessionId: string | null;
  storedSessionId: string | null;
  messages: WebChatMessage[];
  streamingMessageId: string | null;
  /** Most recently sealed interim assistant bubble in the active turn. */
  interimMessageId: string | null;
  sessions: WebChatSession[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  sessionSearch: string;
  busy: boolean;
  /** Ephemeral gateway activity such as thinking, compacting, or tool status. */
  activity: string | null;
  error: string | null;
  info: WebChatRuntimeInfo;
  prompt: WebChatPrompt | null;
  attachments: WebChatImageAttachment[];
}

export interface UseWebChatControllerOptions {
  /** The persistently-mounted chat stays completely dormant until enabled. */
  enabled: boolean;
  /** Stored session id from the route's `?resume=` value. */
  resumeSessionId?: string | null;
  profile?: string;
  cols?: number;
  sessionLimit?: number;
}

export interface WebChatController extends WebChatState {
  filteredSessions: WebChatSession[];
  canSend: boolean;
  send(text: string): Promise<void>;
  interrupt(): Promise<void>;
  newChat(): Promise<void>;
  selectSession(sessionId: string): Promise<void>;
  refreshSessions(): Promise<void>;
  setSessionSearch(value: string): void;
  attachImage(file: File): Promise<WebChatImageAttachment>;
  retryAttachment(id: string): Promise<WebChatImageAttachment>;
  removeAttachment(id: string): Promise<void>;
  respondToClarify(answer: string): Promise<void>;
  respondToApproval(choice: string, all?: boolean): Promise<void>;
  respondToSudo(password: string): Promise<void>;
  respondToSecret(value: string): Promise<void>;
  exportTranscript(): string;
  retry(): Promise<void>;
  retryLastPrompt(): Promise<void>;
  clearError(): void;
}
