import { describe, expect, it } from "vitest";

import { latchChatActivation } from "./chat-activation";

describe("latchChatActivation", () => {
  it("stays inactive while the chat tab has never been active", () => {
    // A dashboard sitting on /sessions, /system, … must not flip the latch,
    // so the persistently mounted ChatPage does not allocate Gateway session
    // state for visitors who never open chat.
    expect(latchChatActivation(false, false)).toBe(false);
  });

  it("activates when the chat tab becomes active", () => {
    expect(latchChatActivation(false, true)).toBe(true);
  });

  it("stays activated after the chat tab is left (sticky / persistence)", () => {
    // Once the user has opened /chat, its Gateway connection and streaming
    // turn must survive navigation to another dashboard page.
    expect(latchChatActivation(true, false)).toBe(true);
  });

  it("stays activated while the chat tab remains active", () => {
    expect(latchChatActivation(true, true)).toBe(true);
  });
});
