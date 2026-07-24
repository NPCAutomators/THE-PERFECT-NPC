import { describe, expect, it } from "vitest";

import type { GatewayEvent } from "@/lib/gatewayClient";

import type { WebChatState } from "./types";
import {
  bytesToBase64,
  formatTranscript,
  isGatewayEventForSession,
  reduceWebChatGatewayEvent,
  transcriptMessages,
} from "./useWebChatController";

function state(overrides: Partial<WebChatState> = {}): WebChatState {
  return {
    connectionState: "open",
    phase: "ready",
    runtimeSessionId: "runtime-1",
    storedSessionId: "stored-1",
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
    info: {
      model: "",
      provider: "",
      reasoningEffort: "",
      serviceTier: "",
      cwd: "",
      branch: "",
      title: "",
    },
    prompt: null,
    attachments: [],
    ...overrides,
  };
}

function reducer() {
  let nextId = 0;
  return (current: WebChatState, type: string, payload: Record<string, unknown> = {}) =>
    reduceWebChatGatewayEvent(
      current,
      { type, session_id: "runtime-1", payload } as GatewayEvent,
      (prefix) => `${prefix}-${++nextId}`,
    );
}

describe("web chat gateway contract", () => {
  it("accepts only events explicitly scoped to the active runtime session", () => {
    expect(isGatewayEventForSession({ type: "message.start", session_id: "a" }, "a")).toBe(true);
    expect(isGatewayEventForSession({ type: "message.start", session_id: "b" }, "a")).toBe(false);
    expect(isGatewayEventForSession({ type: "message.start" }, "a")).toBe(false);
  });

  it("seals interim text and settles previewed completion onto that bubble", () => {
    const reduce = reducer();
    let current = state({ busy: true, phase: "working" });
    current = reduce(current, "message.start");
    current = reduce(current, "message.delta", { text: "partial" });
    current = reduce(current, "message.interim", { text: "partial" });
    current = reduce(current, "message.complete", {
      text: "partial answer complete",
      response_previewed: true,
    });

    expect(current.messages.map((message) => message.content)).toEqual(["partial answer complete"]);
    expect(current.busy).toBe(false);
    expect(current.interimMessageId).toBeNull();
  });

  it("ignores malformed interim and late turn events", () => {
    const reduce = reducer();
    const working = state({ busy: true, phase: "working" });
    expect(reduce(working, "message.interim", { text: "" })).toBe(working);

    const settled = state();
    expect(reduce(settled, "message.delta", { text: "late" })).toBe(settled);
    expect(reduce(settled, "tool.complete", { tool_id: "t", name: "terminal" })).toBe(settled);
  });

  it("correlates id-less progress with the running tool instead of duplicating it", () => {
    const reduce = reducer();
    let current = state({ busy: true, phase: "working" });
    current = reduce(current, "tool.start", { tool_id: "tool-1", name: "terminal", args_text: "pwd" });
    current = reduce(current, "tool.progress", { name: "terminal", preview: "running" });
    current = reduce(current, "tool.complete", { tool_id: "tool-1", name: "terminal", result_text: "/tmp" });

    expect(current.messages[0].toolCalls).toEqual([
      expect.objectContaining({ id: "tool-1", progress: "running", output: "/tmp", status: "complete" }),
    ]);
  });

  it("restores gateway tool results and assistant reasoning from history", () => {
    let nextId = 0;
    const messages = transcriptMessages([
      { role: "assistant", text: "answer", reasoning_content: "thought" },
      { role: "tool", name: "terminal", context: "pwd → /tmp" },
    ], (prefix) => `${prefix}-${++nextId}`);

    expect(messages[0]).toMatchObject({ content: "answer", reasoning: "thought" });
    expect(messages[1].toolCalls?.[0]).toMatchObject({ name: "terminal", output: "pwd → /tmp" });
    expect(formatTranscript(messages)).toContain("Reasoning:\nthought");
    expect(formatTranscript(messages)).toContain("Tool (terminal, complete): pwd → /tmp");
  });

  it("encodes browser attachment bytes for image.attach_bytes without mutation", () => {
    expect(bytesToBase64(new Uint8Array([0, 1, 2, 253, 254, 255]))).toBe("AAEC/f7/");
  });
});
