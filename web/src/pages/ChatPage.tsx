import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Markdown } from "@/components/Markdown";
import {
  WebChatView,
  type WebChatAttachment,
  type WebChatPromptItem,
  type WebChatSession as ViewSession,
  type WebChatTranscriptItem,
} from "@/components/web-chat/WebChatView";
import { useProfileScope } from "@/contexts/useProfileScope";
import { useWebChatController } from "@/chat/useWebChatController";
import type { WebChatPrompt } from "@/chat/types";
import { latchChatActivation } from "@/lib/chat-activation";
import { imageFilesFromTransfer } from "@/lib/chatImagePaste";
import { PluginSlot } from "@/plugins";

interface ChatPageProps {
  isActive?: boolean;
  onOpenNavigation?: () => void;
}

type ResponseDialog = {
  kind: "clarify" | "secret" | "sudo";
  title: string;
  description: string;
} | null;

const APPROVAL_LABELS: Record<string, string> = {
  always: "Always allow",
  deny: "Deny",
  once: "Allow once",
  session: "Allow this session",
};

function sessionGroup(lastActive: number): string {
  const value = lastActive < 10_000_000_000 ? lastActive * 1000 : lastActive;
  const date = new Date(value);
  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const startDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const days = Math.floor((startToday - startDate) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  return "Older";
}

function attachmentDetail(status: string, size: number, error?: string): string {
  if (error) return error;
  if (status === "uploading") return "Uploading…";
  if (status === "error") return "Upload failed";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function promptItem(prompt: WebChatPrompt): WebChatPromptItem {
  if (prompt.kind === "clarify") {
    const choices = prompt.choices?.length
      ? prompt.choices.map((choice, index) => ({
          id: `clarify-${index}`,
          label: choice,
          value: choice,
          tone: index === 0 ? "primary" as const : "default" as const,
        }))
      : [{ id: "clarify-custom", label: "Type an answer", value: "__custom__", tone: "primary" as const }];
    return {
      kind: "prompt-request",
      id: `clarify-${prompt.requestId}`,
      title: prompt.question,
      description: "Zorin needs a little more information before continuing.",
      options: choices,
    };
  }

  if (prompt.kind === "approval") {
    const choices = prompt.choices?.length
      ? prompt.choices
      : ["once", "session", ...(prompt.allowPermanent ? ["always"] : []), "deny"];
    return {
      kind: "prompt-request",
      id: "approval-request",
      title: prompt.description || "Approval required",
      description: prompt.command ? <code>{prompt.command}</code> : undefined,
      options: choices.map((choice) => ({
        id: `approval-${choice}`,
        label: APPROVAL_LABELS[choice] ?? choice,
        value: choice,
        tone: choice === "deny" ? "danger" : choice === "once" ? "primary" : "default",
      })),
    };
  }

  if (prompt.kind === "sudo") {
    return {
      kind: "prompt-request",
      id: `sudo-${prompt.requestId}`,
      title: "Administrator password required",
      description: "Enter it securely to let Zorin continue this command.",
      options: [{ id: "sudo-enter", label: "Enter password", value: "__secure__", tone: "primary" }],
    };
  }

  return {
    kind: "prompt-request",
    id: `secret-${prompt.requestId}`,
    title: prompt.prompt || `Enter ${prompt.envVar}`,
    description: prompt.envVar ? `This value is used for ${prompt.envVar} and is not added to the transcript.` : undefined,
    options: [{ id: "secret-enter", label: "Enter secret", value: "__secure__", tone: "primary" }],
  };
}

function downloadTranscript(content: string) {
  const blob = new Blob([content || "No messages yet."], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `zorin-chat-${new Date().toISOString().slice(0, 10)}.md`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ChatPage({
  isActive = true,
  onOpenNavigation,
}: ChatPageProps) {
  const navigate = useNavigate();
  const { profile } = useProfileScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeSessionId = searchParams.get("resume");
  const [activated, setActivated] = useState(isActive);
  const [draft, setDraft] = useState("");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [responseDialog, setResponseDialog] = useState<ResponseDialog>(null);
  const [responseValue, setResponseValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!latchChatActivation(activated, isActive)) return;
    // Sticky activation keeps the Gateway session alive across dashboard tabs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivated(true);
  }, [activated, isActive]);

  const chat = useWebChatController({
    enabled: activated,
    resumeSessionId,
    profile,
  });

  const sessions = useMemo<ViewSession[]>(
    () => chat.filteredSessions.map((session) => ({
      id: session.id,
      title: session.title,
      group: sessionGroup(session.lastActive),
    })),
    [chat.filteredSessions],
  );

  const attachments = useMemo<WebChatAttachment[]>(
    () => chat.attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      detail: attachmentDetail(
        attachment.status,
        attachment.size,
        attachment.error,
      ),
    })),
    [chat.attachments],
  );

  const transcript = useMemo<WebChatTranscriptItem[]>(() => {
    const items: WebChatTranscriptItem[] = [];
    for (const message of chat.messages) {
      const role = message.role === "user"
        ? "user"
        : message.role === "assistant"
          ? "assistant"
          : "system";
      if (message.content || message.reasoning || message.role === "user" || message.role === "system") {
        items.push({
          kind: "message",
          id: message.id,
          role,
          label: message.role === "tool" ? "Tool result" : undefined,
          pending: message.status === "streaming",
          content: (
            <>
              <Markdown
                content={message.content}
                streaming={message.status === "streaming"}
              />
              {message.reasoning ? (
                <details className="mt-3 text-left text-xs text-[var(--chat-muted)]">
                  <summary className="cursor-pointer text-[#c5ff4a]">Reasoning</summary>
                  <div className="mt-2 whitespace-pre-wrap">{message.reasoning}</div>
                </details>
              ) : null}
            </>
          ),
        });
      }
      for (const tool of message.toolCalls ?? []) {
        items.push({
          kind: "tool",
          id: `${message.id}-${tool.id}`,
          name: tool.name,
          status: tool.error
            ? "error"
            : tool.status === "running"
              ? "running"
              : "complete",
          detail: tool.error || tool.output || tool.progress || tool.input,
        });
      }
    }
    if (chat.activity && !chat.prompt) {
      items.push({
        kind: "message",
        id: "chat-activity",
        role: "system",
        label: "Activity",
        pending: chat.busy,
        content: chat.activity,
      });
    }
    for (const attachment of chat.attachments) {
      if (attachment.status !== "error") continue;
      items.push({
        kind: "prompt-request",
        id: `attachment-error:${attachment.id}`,
        title: `Attachment failed: ${attachment.name}`,
        description: attachment.error || "The image could not be attached.",
        options: [
          { id: `retry-${attachment.id}`, label: "Retry", value: "retry", tone: "primary" },
          { id: `remove-${attachment.id}`, label: "Remove", value: "remove" },
        ],
      });
    }
    if (chat.prompt) items.push(promptItem(chat.prompt));
    if (chat.error) {
      items.push({
        kind: "prompt-request",
        id: "chat-runtime-error",
        title: "Chat connection issue",
        description: chat.error,
        options: [
          { id: "retry", label: "Retry", value: "retry", tone: "primary" },
          { id: "dismiss", label: "Dismiss", value: "dismiss" },
        ],
      });
    }
    return items;
  }, [chat.activity, chat.attachments, chat.busy, chat.error, chat.messages, chat.prompt]);

  const updateResumeParam = useCallback(
    (sessionId: string | null) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (sessionId) next.set("resume", sessionId);
        else next.delete("resume");
        return next;
      });
    },
    [setSearchParams],
  );

  const startNewChat = useCallback(() => {
    void chat.newChat()
      .then(() => {
        updateResumeParam(null);
        setDraft("");
        setMobileDrawerOpen(false);
      })
      .catch(() => undefined);
  }, [chat, updateResumeParam]);

  const selectSession = useCallback((sessionId: string) => {
    void chat.selectSession(sessionId)
      .then(() => {
        updateResumeParam(sessionId);
        setMobileDrawerOpen(false);
      })
      .catch(() => undefined);
  }, [chat, updateResumeParam]);

  const submitDraft = useCallback((value: string) => {
    const text = value.trim() || (chat.attachments.length ? "Please review the attached image." : "");
    if (!text) return;
    void chat.send(text)
      .then(() => setDraft(""))
      .catch(() => undefined);
  }, [chat]);

  const attachFiles = useCallback((files: File[]) => {
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setNotice("Basic phase currently supports image attachments only.");
        continue;
      }
      void chat.attachImage(file).catch(() => undefined);
    }
  }, [chat]);

  const respondToPrompt = useCallback((promptId: string, value: string) => {
    if (promptId.startsWith("attachment-error:")) {
      const id = promptId.slice("attachment-error:".length);
      const request = value === "retry"
        ? chat.retryAttachment(id)
        : chat.removeAttachment(id);
      void request.catch(() => undefined);
      return;
    }
    if (promptId === "chat-runtime-error") {
      if (value === "retry") void chat.retry().catch(() => undefined);
      else chat.clearError();
      return;
    }
    const prompt = chat.prompt;
    if (!prompt) return;
    if (prompt.kind === "approval") {
      void chat.respondToApproval(value).catch(() => undefined);
      return;
    }
    if (prompt.kind === "clarify" && value !== "__custom__") {
      void chat.respondToClarify(value).catch(() => undefined);
      return;
    }
    setResponseValue("");
    setResponseDialog({
      kind: prompt.kind,
      title: prompt.kind === "clarify"
        ? prompt.question
        : prompt.kind === "sudo"
          ? "Administrator password"
          : prompt.prompt || `Enter ${prompt.envVar}`,
      description: prompt.kind === "clarify"
        ? "Type the information Zorin requested."
        : "The value is sent directly to the active request.",
    });
  }, [chat]);

  const submitResponse = useCallback(() => {
    const clean = responseValue.trim();
    if (!responseDialog || !clean) return;
    const request = responseDialog.kind === "clarify"
      ? chat.respondToClarify(clean)
      : responseDialog.kind === "sudo"
        ? chat.respondToSudo(responseValue)
        : chat.respondToSecret(responseValue);
    void request.then(() => {
      setResponseDialog(null);
      setResponseValue("");
    }).catch(() => undefined);
  }, [chat, responseDialog, responseValue]);

  return (
    <div className="zorin-chat-shell flex min-h-0 flex-1 flex-col overflow-hidden">
      <PluginSlot name="chat:top" />
      <div className="min-h-0 flex-1 overflow-hidden">
        <WebChatView
          model={{
            name: chat.info.model || "Zorin",
            description: [chat.info.provider || "NPC Automators", chat.phase]
              .filter(Boolean)
              .join(" · "),
          }}
          sessions={sessions}
          activeSessionId={chat.storedSessionId ?? undefined}
          searchValue={chat.sessionSearch}
          draft={draft}
          transcript={transcript}
          attachments={attachments}
          isStreaming={chat.busy && !chat.prompt}
          disabled={!activated || chat.connectionState !== "open" || Boolean(chat.prompt) ||
            chat.attachments.some((attachment) => attachment.status !== "ready")}
          mobileDrawerOpen={mobileDrawerOpen}
          onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
          onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
          onOpenNavigation={onOpenNavigation}
          onOpenModel={() => navigate("/models")}
          onExport={() => downloadTranscript(chat.exportTranscript())}
          onUpgrade={() => window.open("https://www.npcautomators.com/#booking", "_blank", "noopener,noreferrer")}
          onOpenNotifications={() => setNotice("No new notifications.")}
          onNewChat={startNewChat}
          onSelectSession={selectSession}
          onSelectSection={(section) => {
            if (section === "home") startNewChat();
            else if (section === "prompts") setDraft("/help");
            else if (section === "integrations") onOpenNavigation?.();
          }}
          onSearchChange={chat.setSessionSearch}
          onDraftChange={setDraft}
          onSubmit={(value) => submitDraft(value)}
          onInterrupt={() => void chat.interrupt().catch(() => undefined)}
          onAttachFiles={attachFiles}
          onRemoveAttachment={(id) => void chat.removeAttachment(id).catch(() => undefined)}
          onComposerPaste={(event) => {
            const files = imageFilesFromTransfer(event.clipboardData);
            if (!files.length) return;
            event.preventDefault();
            attachFiles(files);
          }}
          onOpenSavedPrompts={() => setDraft("/help")}
          onSelectSuggestion={setDraft}
          onRespondToPrompt={respondToPrompt}
        />
      </div>
      <PluginSlot name="chat:bottom" />

      {notice ? (
        <button
          type="button"
          className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border border-[rgb(197_255_74_/_0.2)] bg-[var(--chat-surface)] px-4 py-3 text-left text-sm text-[var(--chat-text)] shadow-2xl"
          onClick={() => setNotice(null)}
          aria-label="Dismiss notification"
        >
          {notice}
        </button>
      ) : null}

      {responseDialog
        ? createPortal(
            <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" role="presentation">
              <form
                className="w-full max-w-md rounded-3xl border border-[rgb(197_255_74_/_0.2)] bg-[var(--chat-surface)] p-5 text-[var(--chat-text)] shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="chat-response-title"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitResponse();
                }}
              >
                <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-[#c5ff4a]">
                  Action required
                </div>
                <h2 id="chat-response-title" className="mt-2 text-xl font-semibold">
                  {responseDialog.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--chat-muted)]">{responseDialog.description}</p>
                <label className="mt-5 block text-sm">
                  <span className="sr-only">Response</span>
                  <input
                    autoFocus
                    type={responseDialog.kind === "clarify" ? "text" : "password"}
                    autoComplete="off"
                    value={responseValue}
                    onChange={(event) => setResponseValue(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-[rgb(197_255_74_/_0.18)] bg-[var(--chat-canvas)] px-3 text-base text-[var(--chat-text)] outline-none focus:border-[var(--chat-accent)] focus:shadow-[0_0_0_3px_rgb(197_255_74_/_0.12)]"
                  />
                </label>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setResponseDialog(null)}
                    className="min-h-11 rounded-xl border border-[#303030] px-4 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!responseValue.trim()}
                    className="min-h-11 rounded-xl bg-[var(--chat-accent)] px-4 text-sm font-semibold text-[var(--chat-canvas)] shadow-[0_5px_18px_rgb(197_255_74_/_0.25)] disabled:opacity-40"
                  >
                    Continue
                  </button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
