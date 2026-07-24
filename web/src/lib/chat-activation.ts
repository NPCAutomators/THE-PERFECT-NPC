/**
 * Persistent web-chat activation latch.
 *
 * The dashboard keeps `ChatPage` mounted (and hides it with CSS on other
 * routes) so an active JSON-RPC session and in-flight response survive tab
 * switches. Connecting before the user has ever opened `/chat` would still
 * allocate a gateway session and build an agent for every dashboard visit.
 *
 * Activate only after the chat route has been shown once, then keep that
 * activation sticky so the WebSocket session survives later navigation.
 */
export function latchChatActivation(
  previous: boolean,
  isActive: boolean,
): boolean {
  return previous || isActive;
}
