import {
  AlertCircle,
  Bell,
  Bot,
  Check,
  ChevronDown,
  Code2,
  Ellipsis,
  FileText,
  Home,
  ImageIcon,
  Languages,
  Library,
  LoaderCircle,
  Menu,
  MessageSquareText,
  Paperclip,
  Plus,
  Search,
  Send,
  Share2,
  Sparkles,
  Square,
  WandSparkles,
  Workflow,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import "./web-chat.css";

export interface WebChatModel {
  name: string;
  description?: string;
}

export interface WebChatSession {
  id: string;
  title: string;
  group?: string;
  pinned?: boolean;
}

export interface WebChatAttachment {
  id: string;
  name: string;
  detail?: string;
}

export interface WebChatMessageItem {
  kind: "message";
  id: string;
  role: "user" | "assistant" | "system";
  content: ReactNode;
  label?: string;
  pending?: boolean;
}

export interface WebChatToolItem {
  kind: "tool";
  id: string;
  name: string;
  detail?: ReactNode;
  status: "running" | "complete" | "error";
}

export interface WebChatPromptOption {
  id: string;
  label: string;
  value?: string;
  tone?: "default" | "primary" | "danger";
}

export interface WebChatPromptItem {
  kind: "prompt-request";
  id: string;
  title: string;
  description?: ReactNode;
  options: WebChatPromptOption[];
}

export type WebChatTranscriptItem =
  | WebChatMessageItem
  | WebChatToolItem
  | WebChatPromptItem;

export interface WebChatCapability {
  id: string;
  title: string;
  description: string;
  tone?: "blue" | "orange" | "purple" | "cyan";
  icon?: ReactNode;
}

export type WebChatSection = "home" | "chat" | "prompts" | "integrations";

export interface WebChatViewProps {
  className?: string;
  model?: WebChatModel;
  sessions?: WebChatSession[];
  activeSessionId?: string;
  activeSection?: WebChatSection;
  searchValue?: string;
  draft: string;
  transcript?: WebChatTranscriptItem[];
  attachments?: WebChatAttachment[];
  capabilities?: WebChatCapability[];
  suggestions?: string[];
  isStreaming?: boolean;
  disabled?: boolean;
  mobileDrawerOpen?: boolean;
  onOpenNavigation?: () => void;
  onOpenModel?: () => void;
  onExport?: () => void;
  onUpgrade?: () => void;
  onOpenNotifications?: () => void;
  onNewChat?: () => void;
  onSelectSession?: (sessionId: string) => void;
  onSelectSection?: (section: WebChatSection) => void;
  onSearchChange?: (value: string) => void;
  onDraftChange: (value: string) => void;
  onSubmit: (
    value: string,
    event: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLTextAreaElement>,
  ) => void;
  onInterrupt?: () => void;
  onAttachFiles?: (files: File[]) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onComposerPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onComposerDrop?: (event: DragEvent<HTMLFormElement>) => void;
  onComposerKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onOpenSavedPrompts?: () => void;
  onSelectSuggestion?: (suggestion: string) => void;
  onRespondToPrompt?: (promptId: string, value: string) => void;
  onOpenMobileDrawer?: () => void;
  onCloseMobileDrawer?: () => void;
}

const DEFAULT_CAPABILITIES: WebChatCapability[] = [
  {
    id: "automation",
    title: "Task Automation",
    description: "Schedule work, run tools, and finish repetitive tasks.",
    tone: "blue",
    icon: <Workflow aria-hidden="true" />,
  },
  {
    id: "language",
    title: "Multi-language Support",
    description: "Communicate fluently across languages and contexts.",
    tone: "orange",
    icon: <Languages aria-hidden="true" />,
  },
  {
    id: "images",
    title: "Image Generation",
    description: "Create and understand visuals from natural language.",
    tone: "purple",
    icon: <ImageIcon aria-hidden="true" />,
  },
  {
    id: "code",
    title: "Code snippets",
    description: "Build, inspect, and improve production-ready code.",
    tone: "cyan",
    icon: <Code2 aria-hidden="true" />,
  },
];

const DEFAULT_SUGGESTIONS = [
  "Plan my day",
  "Summarize a document",
  "Help me write code",
  "Research a topic",
];

const NAV_ITEMS: Array<{
  id: WebChatSection;
  label: string;
  icon: ReactNode;
}> = [
  { id: "home", label: "Home", icon: <Home aria-hidden="true" /> },
  { id: "chat", label: "Chat", icon: <Sparkles aria-hidden="true" /> },
  { id: "prompts", label: "Prompt Library", icon: <Library aria-hidden="true" /> },
  { id: "integrations", label: "Integrations", icon: <Workflow aria-hidden="true" /> },
];

function groupSessions(sessions: WebChatSession[]) {
  const groups = new Map<string, WebChatSession[]>();
  for (const session of sessions) {
    const group = session.pinned ? "Pinned" : session.group || "Recent";
    groups.set(group, [...(groups.get(group) || []), session]);
  }
  return [...groups.entries()];
}

interface SidebarProps
  extends Pick<
    WebChatViewProps,
    | "model"
    | "sessions"
    | "activeSessionId"
    | "activeSection"
    | "searchValue"
    | "onOpenModel"
    | "onNewChat"
    | "onSelectSession"
    | "onSelectSection"
    | "onSearchChange"
  > {
  drawer?: boolean;
  onClose?: () => void;
}

function Sidebar({
  model = { name: "Zorin", description: "Personal AI agent" },
  sessions = [],
  activeSessionId,
  activeSection = "chat",
  searchValue = "",
  onOpenModel,
  onNewChat,
  onSelectSession,
  onSelectSection,
  drawer,
  onClose,
  onSearchChange,
}: SidebarProps) {
  const searchId = useId();
  return (
    <aside className="zweb-sidebar" aria-label="Chat navigation">
      {drawer ? (
        <div className="zweb-drawer-head">
          <span className="zweb-kicker">Workspace</span>
          <button className="zweb-icon-button" type="button" onClick={onClose} aria-label="Close navigation" autoFocus>
            <X aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <button className="zweb-model" type="button" onClick={onOpenModel} aria-label={`Change model, current model ${model.name}`}>
        <span className="zweb-model-mark"><Bot aria-hidden="true" /></span>
        <span className="zweb-model-copy">
          <strong>{model.name}</strong>
          <small>{model.description || "Personal AI agent"}</small>
        </span>
        <ChevronDown aria-hidden="true" />
      </button>

      <div className="zweb-search">
        <label className="zweb-sr-only" htmlFor={searchId}>Search conversations</label>
        <Search aria-hidden="true" />
        <input
          id={searchId}
          type="search"
          value={searchValue}
          placeholder="Search"
          onChange={(event) => onSearchChange?.(event.target.value)}
        />
        <kbd>/</kbd>
      </div>

      <nav className="zweb-primary-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={activeSection === item.id ? "is-active" : undefined}
            type="button"
            aria-current={activeSection === item.id ? "page" : undefined}
            onClick={() => onSelectSection?.(item.id)}
          >
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="zweb-session-list" aria-label="Conversation history">
        {groupSessions(sessions).map(([group, entries]) => (
          <section className="zweb-session-group" key={group} aria-labelledby={`zweb-group-${group.replace(/\s/g, "-")}`}>
            <div className="zweb-session-heading">
              <span id={`zweb-group-${group.replace(/\s/g, "-")}`}>{group}</span>
              {group === "Pinned" || group === "Recent" ? (
                <button type="button" onClick={onNewChat} aria-label="Start a new chat"><Plus aria-hidden="true" /></button>
              ) : null}
            </div>
            {entries.map((session) => (
              <button
                key={session.id}
                className={activeSessionId === session.id ? "zweb-session is-active" : "zweb-session"}
                type="button"
                onClick={() => onSelectSession?.(session.id)}
                aria-current={activeSessionId === session.id ? "page" : undefined}
              >
                <MessageSquareText aria-hidden="true" />
                <span>{session.title}</span>
              </button>
            ))}
          </section>
        ))}
        {!sessions.length ? (
          <div className="zweb-no-sessions">
            <MessageSquareText aria-hidden="true" />
            <span>No conversations yet</span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function Transcript({
  items,
  onRespond,
}: {
  items: WebChatTranscriptItem[];
  onRespond?: (promptId: string, value: string) => void;
}) {
  return (
    <div className="zweb-transcript" role="log" aria-live="polite" aria-label="Conversation">
      {items.map((item) => {
        if (item.kind === "message") {
          return (
            <article className={`zweb-message is-${item.role}`} key={item.id}>
              <span className="zweb-message-avatar" aria-hidden="true">
                {item.role === "assistant" ? <Bot /> : item.role === "user" ? "Y" : <Sparkles />}
              </span>
              <div className="zweb-message-body">
                <span className="zweb-message-label">{item.label || (item.role === "user" ? "You" : "Zorin")}</span>
                <div className="zweb-message-content">{item.content}</div>
                {item.pending ? <span className="zweb-thinking"><LoaderCircle aria-hidden="true" /> Thinking</span> : null}
              </div>
            </article>
          );
        }
        if (item.kind === "tool") {
          const StatusIcon = item.status === "running" ? LoaderCircle : item.status === "complete" ? Check : AlertCircle;
          return (
            <article className={`zweb-tool is-${item.status}`} key={item.id}>
              <span className="zweb-tool-icon"><StatusIcon aria-hidden="true" /></span>
              <div><strong>{item.name}</strong>{item.detail ? <div>{item.detail}</div> : null}</div>
              <span className="zweb-tool-status">{item.status}</span>
            </article>
          );
        }
        return (
          <section className="zweb-request" key={item.id} aria-labelledby={`zweb-request-${item.id}`}>
            <span className="zweb-kicker">Action required</span>
            <h3 id={`zweb-request-${item.id}`}>{item.title}</h3>
            {item.description ? <div className="zweb-request-copy">{item.description}</div> : null}
            <div className="zweb-request-actions">
              {item.options.map((option) => (
                <button
                  className={`is-${option.tone || "default"}`}
                  type="button"
                  key={option.id}
                  onClick={() => onRespond?.(item.id, option.value ?? option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Composer({
  draft,
  attachments = [],
  isStreaming,
  disabled,
  onDraftChange,
  onSubmit,
  onInterrupt,
  onAttachFiles,
  onRemoveAttachment,
  onComposerPaste,
  onComposerDrop,
  onComposerKeyDown,
  onOpenSavedPrompts,
}: Pick<
  WebChatViewProps,
  | "draft"
  | "attachments"
  | "isStreaming"
  | "disabled"
  | "onDraftChange"
  | "onSubmit"
  | "onInterrupt"
  | "onAttachFiles"
  | "onRemoveAttachment"
  | "onComposerPaste"
  | "onComposerDrop"
  | "onComposerKeyDown"
  | "onOpenSavedPrompts"
>) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSend = Boolean(draft.trim() || attachments.length);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!disabled && canSend && !isStreaming) onSubmit(draft, event);
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onComposerKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && canSend && !isStreaming) onSubmit(draft, event);
    }
  };

  const paste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    onComposerPaste?.(event);
    if (event.defaultPrevented) return;
    const files = Array.from(event.clipboardData.files);
    if (files.length) onAttachFiles?.(files);
  };

  const drop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    onComposerDrop?.(event);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onAttachFiles?.(files);
  };

  return (
    <form className="zweb-composer" onSubmit={submit} onDragOver={(event) => event.preventDefault()} onDrop={drop}>
      {attachments.length ? (
        <div className="zweb-attachments" aria-label="Attached files">
          {attachments.map((attachment) => (
            <span className="zweb-attachment" key={attachment.id}>
              <FileText aria-hidden="true" />
              <span><strong>{attachment.name}</strong>{attachment.detail ? <small>{attachment.detail}</small> : null}</span>
              <button type="button" onClick={() => onRemoveAttachment?.(attachment.id)} aria-label={`Remove ${attachment.name}`}><X aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="zweb-compose-row">
        <label className="zweb-sr-only" htmlFor={inputId}>Message Zorin</label>
        <textarea
          id={inputId}
          value={draft}
          rows={1}
          disabled={disabled}
          placeholder="Ask me anything..."
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={keyDown}
          onPaste={paste}
        />
        {isStreaming ? (
          <button className="zweb-send is-stop" type="button" onClick={onInterrupt} aria-label="Stop response"><Square aria-hidden="true" /></button>
        ) : (
          <button className="zweb-send" type="submit" disabled={disabled || !canSend} aria-label="Send message"><Send aria-hidden="true" /></button>
        )}
      </div>
      <div className="zweb-compose-tools">
        <button type="button" onClick={onOpenSavedPrompts}><Sparkles aria-hidden="true" /> Saved prompts</button>
        <button type="button" onClick={() => fileInputRef.current?.click()}><Paperclip aria-hidden="true" /> Attach content</button>
        <input
          className="zweb-file-input"
          ref={fileInputRef}
          type="file"
          multiple
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files || []);
            if (files.length) onAttachFiles?.(files);
            event.currentTarget.value = "";
          }}
        />
      </div>
    </form>
  );
}

export function WebChatView({
  className,
  model,
  sessions,
  activeSessionId,
  activeSection,
  searchValue,
  draft,
  transcript = [],
  attachments,
  capabilities = DEFAULT_CAPABILITIES,
  suggestions = DEFAULT_SUGGESTIONS,
  isStreaming,
  disabled,
  mobileDrawerOpen = false,
  onOpenNavigation,
  onOpenModel,
  onExport,
  onUpgrade,
  onOpenNotifications,
  onNewChat,
  onSelectSession,
  onSelectSection,
  onSearchChange,
  onDraftChange,
  onSubmit,
  onInterrupt,
  onAttachFiles,
  onRemoveAttachment,
  onComposerPaste,
  onComposerDrop,
  onComposerKeyDown,
  onOpenSavedPrompts,
  onSelectSuggestion,
  onRespondToPrompt,
  onOpenMobileDrawer,
  onCloseMobileDrawer,
}: WebChatViewProps) {
  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCloseMobileDrawer?.();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileDrawerOpen, onCloseMobileDrawer]);

  const sidebarProps: SidebarProps = {
    model,
    sessions,
    activeSessionId,
    activeSection,
    searchValue,
    onOpenModel,
    onNewChat,
    onSelectSession,
    onSelectSection,
    onSearchChange,
  };

  const hasTranscript = transcript.length > 0;
  return (
    <section className={["zweb-chat", className].filter(Boolean).join(" ")}>
      <div className="zweb-desktop-sidebar"><Sidebar {...sidebarProps} /></div>

      {mobileDrawerOpen ? (
        <div className="zweb-drawer" role="presentation">
          <button className="zweb-drawer-scrim" type="button" aria-label="Close navigation" onClick={onCloseMobileDrawer} />
          <div className="zweb-drawer-panel" role="dialog" aria-modal="true" aria-label="Chat navigation">
            <Sidebar {...sidebarProps} drawer onClose={onCloseMobileDrawer} />
          </div>
        </div>
      ) : null}

      <main className="zweb-main">
        <header className="zweb-topbar">
          <button className="zweb-mobile-menu" type="button" onClick={onOpenMobileDrawer} aria-label="Open navigation"><Menu aria-hidden="true" /></button>
          <div className="zweb-topbar-brand"><span className="zweb-kicker">NPC Cyber</span><strong>Zorin chat</strong></div>
          <div className="zweb-top-actions">
            <button type="button" onClick={onExport}><Share2 aria-hidden="true" /><span>Export Chat</span></button>
            <button className="zweb-upgrade" type="button" onClick={onUpgrade}>Upgrade</button>
            <button className="zweb-icon-button" type="button" onClick={onOpenNotifications} aria-label="Notifications"><Bell aria-hidden="true" /></button>
            <button className="zweb-icon-button" type="button" onClick={onOpenNavigation} aria-label="Open Zorin navigation" aria-haspopup="menu"><Ellipsis aria-hidden="true" /></button>
          </div>
        </header>

        <section className={hasTranscript ? "zweb-canvas has-transcript" : "zweb-canvas"}>
          <div className="zweb-grid" aria-hidden="true" />
          {hasTranscript ? (
            <Transcript items={transcript} onRespond={onRespondToPrompt} />
          ) : (
            <div className="zweb-welcome">
              <div className="zweb-welcome-copy">
                <span className="zweb-kicker">Agent online</span>
                <h1>Welcome to <em>Zorin.</em></h1>
                <p>One intelligent workspace for questions, tools, files, and real work.</p>
              </div>
              <div className="zweb-capabilities">
                {capabilities.map((capability) => (
                  <article className={`zweb-capability is-${capability.tone || "blue"}`} key={capability.id}>
                    <span className="zweb-capability-icon">{capability.icon || <WandSparkles aria-hidden="true" />}</span>
                    <h2>{capability.title}</h2>
                    <p>{capability.description}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="zweb-input-zone">
            {!hasTranscript && suggestions.length ? (
              <div className="zweb-suggestions" aria-label="Suggested prompts">
                {suggestions.map((suggestion) => (
                  <button type="button" key={suggestion} onClick={() => onSelectSuggestion?.(suggestion)}>{suggestion}</button>
                ))}
              </div>
            ) : null}
            <Composer
              draft={draft}
              attachments={attachments}
              isStreaming={isStreaming}
              disabled={disabled}
              onDraftChange={onDraftChange}
              onSubmit={onSubmit}
              onInterrupt={onInterrupt}
              onAttachFiles={onAttachFiles}
              onRemoveAttachment={onRemoveAttachment}
              onComposerPaste={onComposerPaste}
              onComposerDrop={onComposerDrop}
              onComposerKeyDown={onComposerKeyDown}
              onOpenSavedPrompts={onOpenSavedPrompts}
            />
          </div>
        </section>
      </main>
    </section>
  );
}
