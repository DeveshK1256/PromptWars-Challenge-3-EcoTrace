/**
 * @module chatbot-ui
 * @description DOM creation helpers for the EcoBot chat widget.
 * Builds the floating-action-button, panel chrome (header, messages,
 * input form), message bubbles, suggestion chips, and the typing
 * indicator — all via safe DOM APIs (no innerHTML).
 */

/* ── DOM-related constants ──────────────────────────────────────── */

/** Display name rendered in the header and welcome message. */
export const BOT_NAME = "EcoBot";

/** CSS class applied to every message bubble. */
const MSG_BASE_CLASS = "ecobot-msg";

/** Number of animated dots rendered inside the typing indicator. */
const TYPING_DOT_COUNT = 3;

/* ── FAB ────────────────────────────────────────────────────────── */

/**
 * Creates the floating action button (FAB) that opens the chat panel.
 * @returns {HTMLButtonElement} The fully assembled FAB element.
 */
export function createChatFab() {
  const fab = document.createElement("button");
  fab.className = "ecobot-fab";
  fab.id = "ecobot-fab";
  fab.setAttribute("aria-label", "Open EcoBot AI assistant");
  const fabIcon = document.createElement("span");
  fabIcon.className = "ecobot-fab-icon";
  fabIcon.setAttribute("aria-hidden", "true");
  fabIcon.textContent = "🤖";
  const fabPulse = document.createElement("span");
  fabPulse.className = "ecobot-fab-pulse";
  fabPulse.setAttribute("aria-hidden", "true");
  fab.append(fabIcon, fabPulse);
  return fab;
}

/* ── Header ─────────────────────────────────────────────────────── */

/**
 * Creates the chat panel header bar with bot info and close button.
 * @returns {HTMLDivElement} The header element.
 */
export function createChatHeader() {
  const header = document.createElement("div");
  header.className = "ecobot-header";

  const headerInfo = document.createElement("div");
  headerInfo.className = "ecobot-header-info";
  const avatar = document.createElement("span");
  avatar.className = "ecobot-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "🤖";
  const headerTextWrap = document.createElement("div");
  const titleEl = document.createElement("h3");
  titleEl.className = "ecobot-title";
  titleEl.textContent = BOT_NAME;
  const subtitleEl = document.createElement("p");
  subtitleEl.className = "ecobot-subtitle";
  subtitleEl.textContent = "AI Eco Assistant";
  headerTextWrap.append(titleEl, subtitleEl);
  headerInfo.append(avatar, headerTextWrap);

  const closeBtn = document.createElement("button");
  closeBtn.className = "ecobot-close";
  closeBtn.id = "ecobot-close";
  closeBtn.setAttribute("aria-label", "Close chat");
  const closeIcon = document.createElement("i");
  closeIcon.className = "fa-solid fa-xmark";
  closeIcon.setAttribute("aria-hidden", "true");
  closeBtn.append(closeIcon);

  header.append(headerInfo, closeBtn);
  return header;
}

/* ── Messages container ─────────────────────────────────────────── */

/**
 * Creates the messages container with the welcome banner and suggestions slot.
 * @returns {HTMLDivElement} The messages area element.
 */
export function createChatMessages() {
  const messagesDiv = document.createElement("div");
  messagesDiv.className = "ecobot-messages";
  messagesDiv.id = "ecobot-messages";
  messagesDiv.setAttribute("aria-live", "polite");

  const welcomeDiv = document.createElement("div");
  welcomeDiv.className = "ecobot-welcome";
  const welcomeText = document.createElement("p");
  welcomeText.className = "ecobot-welcome-text";
  welcomeText.append(
    "\uD83D\uDC4B Hi! I'm ",
    Object.assign(document.createElement("strong"), { textContent: BOT_NAME }),
    ", your AI eco assistant. Ask me anything about sustainability,"
      + " climate, or how to reduce your carbon footprint!",
  );
  const suggestionsDiv = document.createElement("div");
  suggestionsDiv.className = "ecobot-suggestions";
  suggestionsDiv.id = "ecobot-suggestions";
  welcomeDiv.append(welcomeText, suggestionsDiv);
  messagesDiv.append(welcomeDiv);
  return messagesDiv;
}

/* ── Input form ─────────────────────────────────────────────────── */

/**
 * Creates the chat input form with a text field and send button.
 * @returns {HTMLFormElement} The input form element.
 */
export function createChatInputForm() {
  const form = document.createElement("form");
  form.className = "ecobot-input-area";
  form.id = "ecobot-form";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "ecobot-input";
  input.id = "ecobot-input";
  input.placeholder = "Ask me anything about eco...";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Type your message");
  const sendBtn = document.createElement("button");
  sendBtn.type = "submit";
  sendBtn.className = "ecobot-send";
  sendBtn.id = "ecobot-send";
  sendBtn.setAttribute("aria-label", "Send message");
  const sendIcon = document.createElement("i");
  sendIcon.className = "fa-solid fa-paper-plane";
  sendIcon.setAttribute("aria-hidden", "true");
  sendBtn.append(sendIcon);
  form.append(input, sendBtn);
  return form;
}

/* ── Suggestion chips ───────────────────────────────────────────── */

/**
 * Populates the suggestions container with clickable question chips.
 * @param {HTMLElement}   container     - The suggestions container element.
 * @param {string[]}      questions     - Array of suggested-question strings.
 * @param {Function}      onChipClick   - Callback invoked with the question
 *                                        text when a chip is clicked.
 */
export function populateSuggestions(container, questions, onChipClick) {
  questions.forEach((q) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ecobot-chip";
    chip.textContent = q;
    chip.addEventListener("click", () => onChipClick(q));
    container.append(chip);
  });
}

/* ── Message bubbles ────────────────────────────────────────────── */

/**
 * Appends a chat bubble to the messages pane and auto-scrolls to the bottom.
 * @param {"user"|"bot"} role - Who sent the message.
 * @param {string}       text - Message content (may contain markdown-like formatting).
 */
export function addMessage(role, text) {
  const messagesEl = document.getElementById("ecobot-messages");
  const bubble = document.createElement("div");
  bubble.className = `${MSG_BASE_CLASS} ${MSG_BASE_CLASS}-${role}`;

  const content = document.createElement("div");
  content.className = "ecobot-msg-content";
  content.append(formatMessage(text));

  const time = document.createElement("span");
  time.className = "ecobot-msg-time";
  time.textContent = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  bubble.append(content, time);
  messagesEl.append(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Converts lightweight markdown-like syntax (bold, bullets, code) into a
 * DOM DocumentFragment using safe DOM API methods.
 * @param {string} text - Raw message text.
 * @returns {DocumentFragment} Fragment containing formatted DOM nodes.
 */
export function formatMessage(text) {
  const fragment = document.createDocumentFragment();
  // Replace bullet-style lines before splitting
  const prepared = text.replace(/\n- /g, "\n• ");
  const lines = prepared.split("\n");
  lines.forEach((line, index) => {
    // Process inline formatting: **bold** and `code`
    const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
    parts.forEach((part) => {
      const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
      const codeMatch = part.match(/^`(.*?)`$/);
      if (boldMatch) {
        const strong = document.createElement("strong");
        strong.textContent = boldMatch[1];
        fragment.append(strong);
      } else if (codeMatch) {
        const code = document.createElement("code");
        code.textContent = codeMatch[1];
        fragment.append(code);
      } else {
        fragment.append(part);
      }
    });
    if (index < lines.length - 1) {
      fragment.append(document.createElement("br"));
    }
  });
  return fragment;
}

/* ── Typing indicator ───────────────────────────────────────────── */

/**
 * Inserts an animated "typing…" indicator into the chat messages area.
 */
export function showTypingIndicator() {
  const messagesEl = document.getElementById("ecobot-messages");
  const typing = document.createElement("div");
  typing.className = `${MSG_BASE_CLASS} ${MSG_BASE_CLASS}-bot ecobot-typing`;
  typing.id = "ecobot-typing";
  const typingContent = document.createElement("div");
  typingContent.className = "ecobot-msg-content";
  for (let i = 0; i < TYPING_DOT_COUNT; i++) {
    const dot = document.createElement("span");
    dot.className = "ecobot-dot";
    typingContent.append(dot);
  }
  typing.append(typingContent);
  messagesEl.append(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Removes the typing indicator bubble (if present) from the chat.
 */
export function removeTypingIndicator() {
  document.getElementById("ecobot-typing")?.remove();
}
