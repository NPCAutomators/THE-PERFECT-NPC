import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  api,
  type SessionInfo as ApiSessionInfo,
} from "@/lib/api";
import {
  GatewayClient,
  type ConnectionState,
  type GatewayEvent,
} from "@/lib/gatewayClient";
import { executeSlash } from "@/lib/slashExec";

import type {
  UseWebChatControllerOptions,
  WebChatController,
  WebChatImageAttachment,
  WebChatMessage,
  WebChatRuntimeInfo,
  WebChatSession,
  WebChatState,
  WebChatToolCall,
} from "./types";

interface TranscriptMessage {
  role: "assistant" | "system" | "tool" | "user";
  text?: string;
  content?: unknown;
  tool_calls?: Array<{
    id?: string;
    function?: { name?: string; arguments?: string };
  }>;
  name?: string;
  context?: string;
  tool_name?: string;
  reasoning?: unknown;
  reasoning_content?: unknown;
  reasoning_details?: unknown;
  codex_reasoning_items?: unknown;
  timestamp?: number;
}

interface SessionCreateResponse {
  session_id: string;
  stored_session_id?: string;
  info?: Record<string, unknown>;
}

interface SessionResumeResponse {
  session_id: string;
  resumed?: string;
  stored_session_id?: string;
  messages?: TranscriptMessage[];
  running?: boolean;
  status?: string;
  info?: Record<string, unknown>;
}

interface SessionHistoryResponse {
  messages?: TranscriptMessage[];
}

interface GatewaySessionListResponse {
  sessions?: Array<{
    id?: string;
    title?: string;
    preview?: string;
    source?: string;
    started_at?: number;
    last_active?: number;
    message_count?: number;
  }>;
}

interface ImageAttachResponse {
  attached?: boolean;
  path?: string;
}

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function attachmentFileKey(file: File): string {
  return `${file.name}\0${file.type}\0${file.size}\0${file.lastModified}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(chunks.join(""));
}

const EMPTY_INFO: WebChatRuntimeInfo = {
  model: "",
  provider: "",
  reasoningEffort: "",
  serviceTier: "",
  cwd: "",
  branch: "",
  title: "",
};

const INITIAL_STATE: WebChatState = {
  connectionState: "idle",
  phase: "disabled",
  runtimeSessionId: null,
  storedSessionId: null,
  messages: [],
  streamingMessageId: null,
  interimMessageId: null,
  sessions: [],
  sessionsLoading: false,
  sessionsError: null,
  sessionSearch: "",
  busy: false,
  activity: null,
  error: null,
  info: EMPTY_INFO,
  prompt: null,
  attachments: [],
};

const INTERRUPTED_STALE_EVENT_TYPES = new Set([
  "approval.request",
  "clarify.request",
  "message.delta",
  "message.interim",
  "message.start",
  "reasoning.available",
  "reasoning.delta",
  "status.update",
  "thinking.delta",
  "secret.request",
  "sudo.request",
  "tool.complete",
  "tool.generating",
  "tool.progress",
  "tool.start",
]);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(textValue).join("");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nested = record.text ?? record.output_text ?? record.content;
    if (nested !== undefined) return textValue(nested);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function infoPatch(payload: Record<string, unknown>): Partial<WebChatRuntimeInfo> {
  const patch: Partial<WebChatRuntimeInfo> = {};
  const keys = [
    ["model", "model"],
    ["provider", "provider"],
    ["reasoning_effort", "reasoningEffort"],
    ["service_tier", "serviceTier"],
    ["cwd", "cwd"],
    ["branch", "branch"],
    ["title", "title"],
  ] as const;
  for (const [wireKey, stateKey] of keys) {
    if (typeof payload[wireKey] === "string") {
      patch[stateKey] = payload[wireKey];
    }
  }
  return patch;
}

function sessionFromApi(session: ApiSessionInfo): WebChatSession {
  return {
    id: session.id,
    title: session.title?.trim() || session.preview?.trim() || "Untitled chat",
    preview: session.preview?.trim() || "",
    source: session.source || "",
    model: session.model || "",
    startedAt: session.started_at,
    lastActive: session.last_active,
    messageCount: session.message_count,
  };
}

export function transcriptMessages(
  messages: readonly TranscriptMessage[],
  makeId: (prefix: string) => string,
): WebChatMessage[] {
  return messages.map((message) => {
    const content = textValue(message.content ?? message.text);
    let toolCalls = message.tool_calls?.map((call, index): WebChatToolCall => ({
      id: call.id || makeId(`history-tool-${index}`),
      name: call.function?.name || "tool",
      input: call.function?.arguments,
      status: "complete",
    }));
    if (message.role === "tool") {
      toolCalls = [{
        id: makeId("history-tool-result"),
        name: message.name || message.tool_name || "tool",
        output: textValue(message.context ?? message.content ?? message.text),
        status: "complete",
      }];
    }
    const reasoning = textValue(
      message.reasoning
        ?? message.reasoning_content
        ?? message.reasoning_details
        ?? message.codex_reasoning_items,
    );
    return {
      id: makeId("history"),
      role: message.role,
      content: message.role === "tool" ? "" : content,
      ...(reasoning ? { reasoning } : {}),
      ...(toolCalls?.length ? { toolCalls } : {}),
      status: "complete",
      createdAt: typeof message.timestamp === "number"
        ? message.timestamp * (message.timestamp < 10_000_000_000 ? 1000 : 1)
        : Date.now(),
    };
  });
}

export function formatTranscript(messages: readonly WebChatMessage[]): string {
  return messages
    .map((message) => {
      const label = message.role.charAt(0).toUpperCase() + message.role.slice(1);
      const sections = [`${label}:`, message.content];
      if (message.reasoning) sections.push(`Reasoning:\n${message.reasoning}`);
      for (const tool of message.toolCalls ?? []) {
        sections.push(
          `Tool (${tool.name}, ${tool.status}): ${tool.output || tool.progress || tool.input || ""}`,
        );
      }
      return sections.filter(Boolean).join("\n");
    })
    .join("\n\n");
}

export function isGatewayEventForSession(
  event: GatewayEvent,
  activeSessionId: string | null,
): boolean {
  return Boolean(activeSessionId && event.session_id === activeSessionId);
}

function ensureStreamingMessage(
  current: WebChatState,
  makeId: (prefix: string) => string,
): { messages: WebChatMessage[]; streamingMessageId: string } {
  if (current.streamingMessageId) {
    return {
      messages: current.messages,
      streamingMessageId: current.streamingMessageId,
    };
  }
  const id = makeId("assistant");
  return {
    messages: [
      ...current.messages,
      {
        id,
        role: "assistant",
        content: "",
        status: "streaming",
        createdAt: Date.now(),
      },
    ],
    streamingMessageId: id,
  };
}

function settleStreamingMessage(
  messages: readonly WebChatMessage[],
  streamingMessageId: string | null,
): WebChatMessage[] {
  if (!streamingMessageId) return [...messages];
  return messages.map((message) => message.id === streamingMessageId
    ? { ...message, status: "complete" }
    : message);
}

/**
 * Pure event reducer for the active browser chat session. Keeping protocol
 * semantics out of the hook makes late-event, interim, and prompt invariants
 * directly testable without a DOM or mocked React runtime.
 */
export function reduceWebChatGatewayEvent(
  current: WebChatState,
  event: GatewayEvent,
  makeId: (prefix: string) => string,
): WebChatState {
  const payload = event.payload && typeof event.payload === "object"
    ? event.payload as Record<string, unknown>
    : {};

  if (event.type === "session.info") {
    const running = typeof payload.running === "boolean" ? payload.running : null;
    const messages = running === false
      ? settleStreamingMessage(current.messages, current.streamingMessageId)
      : current.messages;
    return {
      ...current,
      messages,
      info: { ...current.info, ...infoPatch(payload) },
      ...(running === null
        ? {}
        : {
            busy: running,
            phase: running ? "working" as const : "ready" as const,
            activity: running ? current.activity : null,
            streamingMessageId: running ? current.streamingMessageId : null,
            interimMessageId: running ? current.interimMessageId : null,
          }),
      storedSessionId: typeof payload.stored_session_id === "string"
        ? payload.stored_session_id
        : current.storedSessionId,
    };
  }

  if (event.type === "session.title") {
    const storedId = textValue(payload.session_id);
    const title = textValue(payload.title).trim();
    if (!storedId || !title) return current;
    return {
      ...current,
      sessions: current.sessions.map((session) => session.id === storedId
        ? { ...session, title }
        : session),
      info: current.storedSessionId === storedId
        ? { ...current.info, title }
        : current.info,
    };
  }

  if (event.type === "thinking.delta" || event.type === "status.update") {
    const activity = textValue(payload.text).trim();
    if (!activity) return current;
    return { ...current, activity };
  }

  if (event.type === "message.start") {
    const stream = ensureStreamingMessage(current, makeId);
    return {
      ...current,
      ...stream,
      busy: true,
      phase: "working",
      activity: "Thinking",
      error: null,
      interimMessageId: null,
    };
  }

  if (event.type === "message.delta") {
    if (!current.busy) return current;
    const delta = textValue(payload.text ?? payload.rendered);
    if (!delta) return current;
    const stream = ensureStreamingMessage(current, makeId);
    return {
      ...current,
      ...stream,
      phase: "working",
      messages: stream.messages.map((message) =>
        message.id === stream.streamingMessageId
          ? { ...message, content: message.content + delta }
          : message,
      ),
    };
  }

  if (event.type === "reasoning.delta" || event.type === "reasoning.available") {
    if (!current.busy) return current;
    const reasoning = textValue(payload.text);
    if (!reasoning) return current;
    const stream = ensureStreamingMessage(current, makeId);
    return {
      ...current,
      ...stream,
      messages: stream.messages.map((message) =>
        message.id === stream.streamingMessageId
          ? {
              ...message,
              reasoning: event.type === "reasoning.available"
                ? reasoning
                : (message.reasoning ?? "") + reasoning,
            }
          : message,
      ),
    };
  }

  if (event.type === "message.interim") {
    if (!current.busy) return current;
    const text = textValue(payload.text);
    if (!text.trim()) return current;
    const stream = ensureStreamingMessage(current, makeId);
    return {
      ...current,
      messages: stream.messages.map((message) =>
        message.id === stream.streamingMessageId
          ? { ...message, content: text, status: "complete" }
          : message,
      ),
      streamingMessageId: null,
      interimMessageId: stream.streamingMessageId,
    };
  }

  if (
    event.type === "tool.start" ||
    event.type === "tool.progress" ||
    event.type === "tool.generating" ||
    event.type === "tool.complete"
  ) {
    if (!current.busy) return current;
    const stream = ensureStreamingMessage(current, makeId);
    const complete = event.type === "tool.complete";
    const name = textValue(payload.name) || "tool";
    return {
      ...current,
      ...stream,
      phase: "working",
      activity: complete ? current.activity : textValue(payload.preview ?? payload.message) || `Running ${name}`,
      messages: stream.messages.map((message) => {
        if (message.id !== stream.streamingMessageId) return message;
        const previous = message.toolCalls ?? [];
        const explicitId = textValue(
          payload.tool_id ?? payload.tool_call_id ?? payload.id,
        );
        const matchingRunning = [...previous].reverse().find((tool) =>
          tool.status === "running" && tool.name === name,
        );
        const toolId = explicitId || matchingRunning?.id || makeId("tool");
        const existing = previous.find((tool) => tool.id === toolId);
        const tool: WebChatToolCall = {
          id: toolId,
          name: textValue(payload.name) || existing?.name || name,
          status: complete ? "complete" : "running",
          input: textValue(
            payload.args_text ?? payload.args ?? payload.arguments ?? payload.context,
          ) || existing?.input,
          progress: textValue(payload.preview ?? payload.message) || existing?.progress,
          output: textValue(
            payload.result_text ?? payload.result ?? payload.summary ?? payload.inline_diff,
          ) || existing?.output,
          error: textValue(payload.error) || existing?.error,
          durationSeconds: typeof payload.duration_s === "number"
            ? payload.duration_s
            : existing?.durationSeconds,
        };
        return {
          ...message,
          toolCalls: existing
            ? previous.map((item) => item.id === toolId ? tool : item)
            : [...previous, tool],
        };
      }),
    };
  }

  if (event.type === "message.complete") {
    if (!current.busy && !current.streamingMessageId && !current.interimMessageId) {
      return current;
    }
    const finalText = textValue(payload.text ?? payload.rendered);
    const finalReasoning = textValue(payload.reasoning);
    const responsePreviewed = payload.response_previewed === true;
    let messages = [...current.messages];
    const interim = current.interimMessageId
      ? messages.find((message) => message.id === current.interimMessageId)
      : undefined;

    if (responsePreviewed && interim) {
      messages = messages.map((message) => {
        if (message.id === interim.id) {
          return {
            ...message,
            content: finalText || message.content,
            reasoning: finalReasoning || message.reasoning,
            status: "complete" as const,
          };
        }
        if (message.id === current.streamingMessageId) {
          return { ...message, content: "", status: "complete" as const };
        }
        return message;
      }).filter((message) =>
        message.id !== current.streamingMessageId ||
        Boolean(message.content || message.reasoning || message.toolCalls?.length),
      );
    } else if (current.streamingMessageId) {
      messages = messages.map((message) =>
        message.id === current.streamingMessageId
          ? {
              ...message,
              content: finalText || message.content,
              reasoning: finalReasoning || message.reasoning,
              status: "complete",
            }
          : message,
      );
    } else if (finalText) {
      messages.push({
        id: makeId("assistant"),
        role: "assistant",
        content: finalText,
        ...(finalReasoning ? { reasoning: finalReasoning } : {}),
        status: "complete",
        createdAt: Date.now(),
      });
    }

    return {
      ...current,
      messages,
      streamingMessageId: null,
      interimMessageId: null,
      busy: false,
      phase: "ready",
      activity: null,
      prompt: null,
    };
  }

  if (event.type === "clarify.request") {
    const requestId = textValue(payload.request_id);
    const question = textValue(payload.question);
    if (!requestId || !question) return current;
    return {
      ...current,
      activity: "Waiting for input",
      prompt: {
        kind: "clarify",
        requestId,
        question,
        choices: Array.isArray(payload.choices)
          ? payload.choices.filter((choice): choice is string => typeof choice === "string")
          : null,
      },
    };
  }

  if (event.type === "approval.request") {
    const explicitChoices = Array.isArray(payload.choices)
      ? payload.choices.filter((choice): choice is string => typeof choice === "string")
      : [];
    const smartDenied = payload.smart_denied === true;
    return {
      ...current,
      activity: "Approval required",
      prompt: {
        kind: "approval",
        command: textValue(payload.command),
        description: textValue(payload.description) || "Approval required",
        choices: smartDenied
          ? ["once", "deny"]
          : explicitChoices.length
            ? explicitChoices
            : undefined,
        allowPermanent: payload.allow_permanent !== false,
        smartDenied,
      },
    };
  }

  if (event.type === "sudo.request") {
    const requestId = textValue(payload.request_id);
    return requestId
      ? { ...current, activity: "Password required", prompt: { kind: "sudo", requestId } }
      : current;
  }

  if (event.type === "secret.request") {
    const requestId = textValue(payload.request_id);
    return requestId
      ? {
          ...current,
          activity: "Secret required",
          prompt: {
            kind: "secret",
            requestId,
            envVar: textValue(payload.env_var),
            prompt: textValue(payload.prompt),
          },
        }
      : current;
  }

  if (event.type === "sudo.expire" || event.type === "secret.expire") {
    const requestId = textValue(payload.request_id);
    const matches = current.prompt && "requestId" in current.prompt &&
      current.prompt.requestId === requestId;
    return matches
      ? { ...current, activity: current.busy ? "Working" : null, prompt: null }
      : current;
  }

  if (event.type === "error") {
    const message = textValue(payload.message) || "Zorin reported an error";
    let messages = current.messages;
    if (current.streamingMessageId) {
      messages = messages.map((item) => item.id === current.streamingMessageId
        ? { ...item, status: "error", content: item.content || message }
        : item);
    } else {
      messages = [
        ...messages,
        {
          id: makeId("error"),
          role: "system",
          content: message,
          status: "error",
          createdAt: Date.now(),
        },
      ];
    }
    return {
      ...current,
      messages,
      streamingMessageId: null,
      interimMessageId: null,
      busy: false,
      phase: "error",
      activity: null,
      error: message,
      prompt: null,
    };
  }

  return current;
}

export function reduceWebChatConnectionState(
  current: WebChatState,
  connectionState: ConnectionState,
): WebChatState {
  if (connectionState === "connecting") {
    return { ...current, connectionState, phase: "connecting", error: null };
  }
  if (connectionState === "closed" || connectionState === "error") {
    const message = connectionState === "closed"
      ? "Chat connection closed. Retry to reconnect."
      : "Chat connection failed. Retry to reconnect.";
    return {
      ...current,
      connectionState,
      messages: current.streamingMessageId
        ? current.messages.map((item) => item.id === current.streamingMessageId
            ? { ...item, status: "error" }
            : item)
        : current.messages,
      streamingMessageId: null,
      interimMessageId: null,
      busy: false,
      phase: "error",
      activity: null,
      error: message,
      prompt: null,
    };
  }
  return { ...current, connectionState };
}

export function useWebChatController({
  enabled,
  resumeSessionId = null,
  profile = "",
  cols = 96,
  sessionLimit = 50,
}: UseWebChatControllerOptions): WebChatController {
  const [state, setState] = useState<WebChatState>(INITIAL_STATE);
  const stateRef = useRef(state);
  const gatewayRef = useRef<GatewayClient | null>(null);
  const runtimeSessionIdRef = useRef<string | null>(null);
  const interruptedSessionIdRef = useRef<string | null>(null);
  const resumeSessionIdRef = useRef(resumeSessionId);
  const handledResumeRef = useRef<string | null>(resumeSessionId);
  const lastPromptRef = useRef("");
  const idRef = useRef(0);
  const lifecycleRef = useRef(0);
  const sessionListRequestRef = useRef(0);
  const sessionTransitionRef = useRef(0);
  const attachmentFilesRef = useRef(new Map<string, File>());
  const attachmentKeysRef = useRef(new Map<string, string>());
  const removedAttachmentIdsRef = useRef(new Set<string>());

  stateRef.current = state;
  resumeSessionIdRef.current = resumeSessionId;

  const makeId = useCallback((prefix: string) => {
    idRef.current += 1;
    return `${prefix}-${Date.now().toString(36)}-${idRef.current.toString(36)}`;
  }, []);

  const update = useCallback((updater: (current: WebChatState) => WebChatState) => {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  const appendSystem = useCallback((content: string, status: "complete" | "error" = "complete") => {
    const message: WebChatMessage = {
      id: makeId("system"),
      role: "system",
      content,
      status,
      createdAt: Date.now(),
    };
    update((current) => ({ ...current, messages: [...current.messages, message] }));
  }, [makeId, update]);

  const refreshSessions = useCallback(async () => {
    const request = ++sessionListRequestRef.current;
    update((current) => ({
      ...current,
      sessionsLoading: true,
      sessionsError: null,
    }));
    try {
      let sessions: WebChatSession[];
      const gateway = gatewayRef.current;
      if (!profile && gateway && stateRef.current.connectionState === "open") {
        try {
          const result = await gateway.request<GatewaySessionListResponse>("session.list", {
            limit: sessionLimit,
          });
          sessions = (result.sessions ?? []).flatMap((session) => {
            if (!session.id) return [];
            const startedAt = session.started_at ?? 0;
            return [{
              id: session.id,
              title: session.title?.trim() || session.preview?.trim() || "Untitled chat",
              preview: session.preview?.trim() || "",
              source: session.source || "",
              model: "",
              startedAt,
              lastActive: session.last_active ?? startedAt,
              messageCount: session.message_count ?? 0,
            }];
          });
        } catch {
          const result = await api.getSessions(sessionLimit, 0, profile, "recent");
          sessions = result.sessions.map(sessionFromApi);
        }
      } else {
        const result = await api.getSessions(sessionLimit, 0, profile, "recent");
        sessions = result.sessions.map(sessionFromApi);
      }
      if (request !== sessionListRequestRef.current) return;
      update((current) => ({
        ...current,
        sessions,
        sessionsLoading: false,
      }));
    } catch (error) {
      if (request !== sessionListRequestRef.current) return;
      update((current) => ({
        ...current,
        sessionsLoading: false,
        sessionsError: errorMessage(error),
      }));
    }
  }, [profile, sessionLimit, update]);

  const closePreviousSession = useCallback(
    async (gateway: GatewayClient, previousSessionId: string | null, nextSessionId: string) => {
      if (!previousSessionId || previousSessionId === nextSessionId) return;
      await gateway.request("session.close", { session_id: previousSessionId }).catch(() => undefined);
    },
    [],
  );

  const createSession = useCallback(async (gateway: GatewayClient) => {
    const transition = ++sessionTransitionRef.current;
    const previous = runtimeSessionIdRef.current ?? stateRef.current.runtimeSessionId;
    runtimeSessionIdRef.current = null;
    interruptedSessionIdRef.current = null;
    attachmentFilesRef.current.clear();
    attachmentKeysRef.current.clear();
    removedAttachmentIdsRef.current.clear();
    update((current) => ({
      ...current,
      phase: "creating",
      busy: false,
      error: null,
      prompt: null,
      attachments: [],
      activity: null,
    }));
    try {
      const created = await gateway.request<SessionCreateResponse>("session.create", {
        cols,
        source: "desktop",
        ...(profile ? { profile } : {}),
      });
      if (!created?.session_id) throw new Error("session.create returned no session id");
      if (transition !== sessionTransitionRef.current) {
        if (created.session_id !== runtimeSessionIdRef.current) {
          void gateway.request("session.close", { session_id: created.session_id }).catch(() => undefined);
        }
        throw new Error("Session change superseded");
      }
      runtimeSessionIdRef.current = created.session_id;
      update((current) => ({
        ...current,
        phase: "ready",
        runtimeSessionId: created.session_id,
        storedSessionId: created.stored_session_id ?? null,
        messages: [],
        streamingMessageId: null,
        interimMessageId: null,
        busy: false,
        activity: null,
        error: null,
        info: { ...EMPTY_INFO, ...infoPatch(created.info ?? {}) },
      }));
      await closePreviousSession(gateway, previous, created.session_id);
    } catch (error) {
      if (transition !== sessionTransitionRef.current) throw error;
      runtimeSessionIdRef.current = previous;
      update((current) => ({
        ...current,
        phase: "error",
        runtimeSessionId: previous,
        error: errorMessage(error),
      }));
      throw error;
    }
  }, [closePreviousSession, cols, profile, update]);

  const resumeSession = useCallback(async (gateway: GatewayClient, storedId: string) => {
    const target = storedId.trim();
    if (!target) return;
    const transition = ++sessionTransitionRef.current;
    const previous = runtimeSessionIdRef.current ?? stateRef.current.runtimeSessionId;
    runtimeSessionIdRef.current = null;
    interruptedSessionIdRef.current = null;
    attachmentFilesRef.current.clear();
    attachmentKeysRef.current.clear();
    removedAttachmentIdsRef.current.clear();
    update((current) => ({
      ...current,
      phase: "resuming",
      busy: false,
      error: null,
      prompt: null,
      attachments: [],
      activity: null,
    }));
    try {
      const resumed = await gateway.request<SessionResumeResponse>("session.resume", {
        cols,
        session_id: target,
        source: "desktop",
        ...(profile ? { profile } : {}),
      });
      if (!resumed?.session_id) throw new Error("session.resume returned no session id");
      if (transition !== sessionTransitionRef.current) {
        if (resumed.session_id !== runtimeSessionIdRef.current) {
          void gateway.request("session.close", { session_id: resumed.session_id }).catch(() => undefined);
        }
        throw new Error("Session change superseded");
      }
      runtimeSessionIdRef.current = resumed.session_id;
      const history = Array.isArray(resumed.messages)
        ? resumed.messages
        : (await gateway.request<SessionHistoryResponse>("session.history", {
            session_id: resumed.session_id,
          })).messages ?? [];
      if (transition !== sessionTransitionRef.current) {
        throw new Error("Session change superseded");
      }
      const running = Boolean(
        resumed.running || resumed.status === "working" || resumed.status === "waiting",
      );
      update((current) => ({
        ...current,
        phase: running ? "working" : "ready",
        runtimeSessionId: resumed.session_id,
        storedSessionId: resumed.resumed ?? resumed.stored_session_id ?? target,
        messages: transcriptMessages(history, makeId),
        streamingMessageId: null,
        interimMessageId: null,
        busy: running,
        activity: running ? "Working" : null,
        error: null,
        info: { ...EMPTY_INFO, ...infoPatch(resumed.info ?? {}) },
      }));
      await closePreviousSession(gateway, previous, resumed.session_id);
    } catch (error) {
      if (transition !== sessionTransitionRef.current) throw error;
      runtimeSessionIdRef.current = previous;
      update((current) => ({
        ...current,
        phase: "error",
        runtimeSessionId: previous,
        error: errorMessage(error),
      }));
      throw error;
    }
  }, [closePreviousSession, cols, makeId, profile, update]);

  const handleGatewayEvent = useCallback((event: GatewayEvent) => {
    const activeSessionId = runtimeSessionIdRef.current;
    if (!isGatewayEventForSession(event, activeSessionId)) return;
    const payload = event.payload && typeof event.payload === "object"
      ? event.payload as Record<string, unknown>
      : {};

    if (interruptedSessionIdRef.current === activeSessionId) {
      if (event.type === "session.info") {
        if (payload.running === false) {
          interruptedSessionIdRef.current = null;
        } else {
          // A heartbeat queued before the cooperative cancel reached the
          // backend must not re-arm the composer after the user clicked Stop.
          update((current) => ({
            ...current,
            info: { ...current.info, ...infoPatch(payload) },
          }));
          return;
        }
      } else if (event.type === "message.complete" || event.type === "error") {
        interruptedSessionIdRef.current = null;
        update((current) => ({
          ...current,
          messages: current.streamingMessageId
            ? current.messages.map((message) => message.id === current.streamingMessageId
                ? { ...message, status: "complete" }
                : message)
            : current.messages,
          busy: false,
          phase: "ready",
          activity: null,
          prompt: null,
          streamingMessageId: null,
          interimMessageId: null,
        }));
        void refreshSessions();
        return;
      } else if (INTERRUPTED_STALE_EVENT_TYPES.has(event.type)) {
        return;
      }
    }
    update((current) => reduceWebChatGatewayEvent(current, event, makeId));
    if (event.type === "message.complete") void refreshSessions();
  }, [makeId, refreshSessions, update]);

  useEffect(() => {
    if (!enabled) {
      update((current) => current.phase === "disabled"
        ? current
        : { ...current, phase: "disabled" });
      return;
    }

    const lifecycle = ++lifecycleRef.current;
    const gateway = new GatewayClient();
    gatewayRef.current = gateway;
    const offState = gateway.onState((connectionState) => {
      if (lifecycle !== lifecycleRef.current) return;
      update((current) => reduceWebChatConnectionState(current, connectionState));
    });
    const offEvent = gateway.onAny(handleGatewayEvent);

    void (async () => {
      try {
        await gateway.connect();
        if (lifecycle !== lifecycleRef.current) return;
        void refreshSessions();
        const target = resumeSessionIdRef.current?.trim() || null;
        handledResumeRef.current = target;
        if (target) await resumeSession(gateway, target);
        else await createSession(gateway);
      } catch (error) {
        if (lifecycle !== lifecycleRef.current) return;
        update((current) => ({
          ...current,
          phase: "error",
          error: errorMessage(error),
        }));
      }
    })();

    return () => {
      lifecycleRef.current += 1;
      offState();
      offEvent();
      if (gatewayRef.current === gateway) gatewayRef.current = null;
      if (runtimeSessionIdRef.current === stateRef.current.runtimeSessionId) {
        runtimeSessionIdRef.current = null;
      }
      gateway.close();
    };
  }, [createSession, enabled, handleGatewayEvent, refreshSessions, resumeSession, update]);

  useEffect(() => {
    if (!enabled) return;
    const target = resumeSessionId?.trim() || null;
    if (target === handledResumeRef.current) return;
    const gateway = gatewayRef.current;
    if (!gateway || stateRef.current.connectionState !== "open") return;
    if (stateRef.current.busy) {
      update((current) => ({
        ...current,
        error: "Stop the current response before switching chats.",
      }));
      return;
    }
    handledResumeRef.current = target;
    void (target ? resumeSession(gateway, target) : createSession(gateway)).catch(() => undefined);
  }, [
    createSession,
    enabled,
    resumeSession,
    resumeSessionId,
    state.busy,
    state.connectionState,
    update,
  ]);

  const submitPrompt = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const gateway = gatewayRef.current;
    const sessionId = runtimeSessionIdRef.current;
    if (!gateway || !sessionId || stateRef.current.connectionState !== "open") {
      throw new Error("Chat is not connected yet");
    }
    if (stateRef.current.busy) throw new Error("Zorin is already responding");
    const unfinishedAttachment = stateRef.current.attachments.find(
      (attachment) => attachment.status !== "ready",
    );
    if (unfinishedAttachment) {
      throw new Error(
        unfinishedAttachment.status === "uploading"
          ? `Wait for ${unfinishedAttachment.name} to finish uploading`
          : `Retry or remove the failed attachment ${unfinishedAttachment.name}`,
      );
    }

    const messageId = makeId("user");
    interruptedSessionIdRef.current = null;
    lastPromptRef.current = clean;
    update((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: messageId,
          role: "user",
          content: clean,
          status: "complete",
          createdAt: Date.now(),
        },
      ],
      busy: true,
      phase: "working",
      activity: "Sending",
      error: null,
    }));
    try {
      await gateway.request("prompt.submit", { session_id: sessionId, text: clean });
      update((current) => ({ ...current, attachments: [] }));
      attachmentFilesRef.current.clear();
      attachmentKeysRef.current.clear();
      removedAttachmentIdsRef.current.clear();
    } catch (error) {
      const message = errorMessage(error);
      update((current) => ({
        ...current,
        messages: current.messages.map((item) => item.id === messageId
          ? { ...item, status: "error" }
          : item),
        busy: false,
        phase: "error",
        activity: null,
        error: message,
      }));
      throw error;
    }
  }, [makeId, update]);

  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const gateway = gatewayRef.current;
    const sessionId = runtimeSessionIdRef.current;
    if (!gateway || !sessionId || stateRef.current.connectionState !== "open") {
      throw new Error("Chat is not connected yet");
    }
    if (stateRef.current.busy) throw new Error("Zorin is already responding");
    if (clean.startsWith("/")) {
      await executeSlash({
        command: clean,
        sessionId,
        gw: gateway,
        callbacks: {
          sys: appendSystem,
          send: submitPrompt,
        },
      });
      return;
    }
    await submitPrompt(clean);
  }, [appendSystem, submitPrompt]);

  const interrupt = useCallback(async () => {
    const gateway = gatewayRef.current;
    const sessionId = runtimeSessionIdRef.current;
    if (!gateway || !sessionId || !stateRef.current.busy) return;
    interruptedSessionIdRef.current = sessionId;
    update((current) => ({ ...current, phase: "interrupting", activity: "Stopping" }));
    try {
      await gateway.request("session.interrupt", { session_id: sessionId });
      update((current) => ({
        ...current,
        messages: current.streamingMessageId
          ? current.messages.map((message) => message.id === current.streamingMessageId
              ? { ...message, status: "complete" }
              : message)
          : current.messages,
        streamingMessageId: null,
        interimMessageId: null,
        busy: false,
        phase: "ready",
        activity: null,
        prompt: null,
      }));
    } catch (error) {
      interruptedSessionIdRef.current = null;
      update((current) => ({ ...current, phase: "error", error: errorMessage(error) }));
      throw error;
    }
  }, [update]);

  const newChat = useCallback(async () => {
    const gateway = gatewayRef.current;
    if (!gateway || stateRef.current.connectionState !== "open") {
      throw new Error("Chat is not connected yet");
    }
    if (stateRef.current.busy) throw new Error("Stop the current response before starting a new chat");
    handledResumeRef.current = null;
    await createSession(gateway);
  }, [createSession]);

  const selectSession = useCallback(async (sessionId: string) => {
    const gateway = gatewayRef.current;
    if (!gateway || stateRef.current.connectionState !== "open") {
      throw new Error("Chat is not connected yet");
    }
    if (stateRef.current.busy) throw new Error("Stop the current response before switching chats");
    handledResumeRef.current = sessionId;
    await resumeSession(gateway, sessionId);
  }, [resumeSession]);

  const setSessionSearch = useCallback((sessionSearch: string) => {
    update((current) => ({ ...current, sessionSearch }));
  }, [update]);

  const uploadAttachment = useCallback(async (
    file: File,
    existingId?: string,
  ): Promise<WebChatImageAttachment> => {
    const gateway = gatewayRef.current;
    const sessionId = runtimeSessionIdRef.current;
    if (!gateway || !sessionId || stateRef.current.connectionState !== "open") {
      throw new Error("Chat is not connected yet");
    }
    if (!file.type.startsWith("image/")) throw new Error("Only image attachments are supported here");
    if (!file.size) throw new Error("Image is empty");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is too large (max 25 MB)");
    const attachment: WebChatImageAttachment = {
      id: existingId ?? makeId("image"),
      name: file.name || "image",
      mimeType: file.type || "image/png",
      size: file.size,
      status: "uploading",
    };
    const key = attachmentFileKey(file);
    attachmentFilesRef.current.set(attachment.id, file);
    attachmentKeysRef.current.set(key, attachment.id);
    removedAttachmentIdsRef.current.delete(attachment.id);
    update((current) => ({
      ...current,
      error: current.attachments.some((item) => item.id === attachment.id)
        ? null
        : current.error,
      attachments: current.attachments.some((item) => item.id === attachment.id)
        ? current.attachments.map((item) => item.id === attachment.id ? attachment : item)
        : [...current.attachments, attachment],
    }));
    let attachedPath: string | undefined;
    try {
      const contentBase64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
      const attached = await gateway.request<ImageAttachResponse>("image.attach_bytes", {
        session_id: sessionId,
        content_base64: contentBase64,
        filename: file.name,
      });
      if (!attached?.attached || !attached.path) {
        throw new Error("Gateway did not attach the image");
      }
      attachedPath = attached.path;
      const ready: WebChatImageAttachment = {
        ...attachment,
        path: attached.path,
        status: "ready",
      };
      if (removedAttachmentIdsRef.current.has(attachment.id)) {
        try {
          await gateway.request("image.detach", {
            session_id: sessionId,
            path: ready.path,
          });
          attachmentFilesRef.current.delete(attachment.id);
          attachmentKeysRef.current.delete(key);
          removedAttachmentIdsRef.current.delete(attachment.id);
          return ready;
        } catch (error) {
          removedAttachmentIdsRef.current.delete(attachment.id);
          throw new Error(`Could not remove attachment: ${errorMessage(error)}`);
        }
      }
      update((current) => ({
        ...current,
        attachments: current.attachments.map((item) => item.id === ready.id ? ready : item),
      }));
      return ready;
    } catch (error) {
      const wasRemoved = removedAttachmentIdsRef.current.has(attachment.id);
      if (wasRemoved && !attachedPath) {
        attachmentFilesRef.current.delete(attachment.id);
        attachmentKeysRef.current.delete(key);
        removedAttachmentIdsRef.current.delete(attachment.id);
        throw error;
      }
      const failed: WebChatImageAttachment = {
        ...attachment,
        ...(attachedPath ? { path: attachedPath } : {}),
        status: "error",
        error: errorMessage(error),
      };
      removedAttachmentIdsRef.current.delete(attachment.id);
      update((current) => ({
        ...current,
        attachments: current.attachments.some((item) => item.id === failed.id)
          ? current.attachments.map((item) => item.id === failed.id ? failed : item)
          : [...current.attachments, failed],
        error: failed.error ?? null,
      }));
      throw error;
    }
  }, [makeId, update]);

  const attachImage = useCallback(async (file: File): Promise<WebChatImageAttachment> => {
    const key = attachmentFileKey(file);
    const existingId = attachmentKeysRef.current.get(key);
    if (existingId) {
      const existing = stateRef.current.attachments.find((item) => item.id === existingId);
      if (existing) return existing;
      if (attachmentFilesRef.current.has(existingId)) {
        return {
          id: existingId,
          name: file.name || "image",
          mimeType: file.type || "image/png",
          size: file.size,
          status: "uploading",
        };
      }
      attachmentKeysRef.current.delete(key);
    }
    return uploadAttachment(file);
  }, [uploadAttachment]);

  const retryAttachment = useCallback(async (id: string): Promise<WebChatImageAttachment> => {
    const file = attachmentFilesRef.current.get(id);
    if (!file) throw new Error("The original attachment is no longer available");
    return uploadAttachment(file, id);
  }, [uploadAttachment]);

  const removeAttachment = useCallback(async (id: string) => {
    const attachment = stateRef.current.attachments.find((item) => item.id === id);
    if (!attachment) return;
    const gateway = gatewayRef.current;
    const sessionId = runtimeSessionIdRef.current;
    removedAttachmentIdsRef.current.add(id);
    if (attachment.path) {
      if (!gateway || !sessionId || stateRef.current.connectionState !== "open") {
        removedAttachmentIdsRef.current.delete(id);
        throw new Error("Chat is not connected yet");
      }
      try {
        await gateway.request("image.detach", {
          session_id: sessionId,
          path: attachment.path,
        });
      } catch (error) {
        const message = `Could not remove attachment: ${errorMessage(error)}`;
        removedAttachmentIdsRef.current.delete(id);
        update((current) => ({
          ...current,
          error: message,
          attachments: current.attachments.map((item) => item.id === id
            ? { ...item, status: "error", error: message }
            : item),
        }));
        throw error;
      }
    }
    update((current) => ({
      ...current,
      error: current.error === attachment.error ? null : current.error,
      attachments: current.attachments.filter((item) => item.id !== id),
    }));
    if (attachment.status !== "uploading") {
      const file = attachmentFilesRef.current.get(id);
      if (file) attachmentKeysRef.current.delete(attachmentFileKey(file));
      attachmentFilesRef.current.delete(id);
      removedAttachmentIdsRef.current.delete(id);
    }
  }, [update]);

  const respond = useCallback(async (
    method: string,
    params: Record<string, unknown>,
  ) => {
    const gateway = gatewayRef.current;
    if (!gateway) throw new Error("Chat is not connected yet");
    try {
      await gateway.request(method, params);
      update((current) => ({
        ...current,
        prompt: null,
        activity: current.busy ? "Working" : null,
        error: null,
      }));
    } catch (error) {
      update((current) => ({ ...current, error: errorMessage(error) }));
      throw error;
    }
  }, [update]);

  const respondToClarify = useCallback(async (answer: string) => {
    const prompt = stateRef.current.prompt;
    if (prompt?.kind !== "clarify") return;
    await respond("clarify.respond", { answer, request_id: prompt.requestId });
  }, [respond]);

  const respondToApproval = useCallback(async (choice: string, all = false) => {
    if (stateRef.current.prompt?.kind !== "approval") return;
    const sessionId = runtimeSessionIdRef.current;
    if (!sessionId) throw new Error("Chat is not connected yet");
    await respond("approval.respond", { choice, all, session_id: sessionId });
  }, [respond]);

  const respondToSudo = useCallback(async (password: string) => {
    const prompt = stateRef.current.prompt;
    if (prompt?.kind !== "sudo") return;
    await respond("sudo.respond", { password, request_id: prompt.requestId });
  }, [respond]);

  const respondToSecret = useCallback(async (value: string) => {
    const prompt = stateRef.current.prompt;
    if (prompt?.kind !== "secret") return;
    await respond("secret.respond", { request_id: prompt.requestId, value });
  }, [respond]);

  const exportTranscript = useCallback(
    () => formatTranscript(stateRef.current.messages),
    [],
  );

  const retry = useCallback(async () => {
    const gateway = gatewayRef.current;
    if (!gateway) throw new Error("Chat is not enabled");
    if (stateRef.current.connectionState !== "open") await gateway.connect();
    const target = stateRef.current.storedSessionId || resumeSessionIdRef.current;
    if (target) await resumeSession(gateway, target);
    else await createSession(gateway);
    void refreshSessions();
  }, [createSession, refreshSessions, resumeSession]);

  const retryLastPrompt = useCallback(async () => {
    if (!lastPromptRef.current) return;
    await submitPrompt(lastPromptRef.current);
  }, [submitPrompt]);

  const clearError = useCallback(() => {
    update((current) => ({
      ...current,
      error: null,
      phase: current.connectionState !== "open"
        ? current.phase
        : current.runtimeSessionId
          ? (current.busy ? "working" : "ready")
          : current.phase,
    }));
  }, [update]);

  const filteredSessions = useMemo(() => {
    const needle = state.sessionSearch.trim().toLocaleLowerCase();
    if (!needle) return state.sessions;
    return state.sessions.filter((session) =>
      `${session.title}\n${session.preview}`.toLocaleLowerCase().includes(needle),
    );
  }, [state.sessionSearch, state.sessions]);

  return {
    ...state,
    filteredSessions,
    canSend: enabled && state.connectionState === "open" && !!state.runtimeSessionId &&
      !state.busy && !state.prompt && state.attachments.every((attachment) => attachment.status === "ready"),
    send,
    interrupt,
    newChat,
    selectSession,
    refreshSessions,
    setSessionSearch,
    attachImage,
    retryAttachment,
    removeAttachment,
    respondToClarify,
    respondToApproval,
    respondToSudo,
    respondToSecret,
    exportTranscript,
    retry,
    retryLastPrompt,
    clearError,
  };
}
