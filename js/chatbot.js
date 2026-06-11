/**
 * @module chatbot
 * @description EcoBot — Gemini-powered AI chatbot for eco/sustainability questions.
 * Injects a floating chat widget into every page, provides suggested
 * questions, and falls back to a local answer bank when the Gemini API
 * is unavailable.
 */
import { ECO_CONFIG, hasGeminiConfig } from "./config.js";
import { logError } from "./logger.js";

/* ── Magic-number constants ─────────────────────────────────────── */

/** Gemini `temperature` parameter — controls response randomness. */
const GEMINI_TEMPERATURE = 0.7;

/** Maximum number of tokens Gemini may produce per response. */
const GEMINI_MAX_OUTPUT_TOKENS = 300;

/** Gemini `topP` nucleus-sampling parameter. */
const GEMINI_TOP_P = 0.9;

/** Delay (ms) before auto-focusing the chat input after opening the panel. */
const FOCUS_DELAY_MS = 200;

const BOT_NAME = "EcoBot";
const MAX_HISTORY = 12;

const SYSTEM_INSTRUCTION = `You are ${BOT_NAME}, the friendly AI assistant for EcoTrace — a carbon footprint awareness platform.
Your role:
- Help users understand their carbon footprint and how to reduce it.
- Answer climate science, sustainability, and environmental questions.
- Provide practical eco-friendly tips for daily life.
- Motivate and encourage sustainable living without guilt.
- Use data and facts when possible.

Rules:
- Keep responses concise (2-4 sentences). Use bullet points for lists.
- Use 1-2 relevant emoji per response, no more.
- If asked non-eco topics, briefly answer then gently connect it back to sustainability.
- Never make up statistics. Say "I'm not sure of the exact figure" if uncertain.
- Be warm, encouraging, and positive.`;

const SUGGESTED_QUESTIONS = [
  "🌱 How can I reduce my carbon footprint?",
  "🚗 Is an EV really better for the environment?",
  "🥩 How much CO₂ does eating meat produce?",
  "🏠 Best ways to save energy at home?",
  "♻️ What can and can't be recycled?",
  "🌍 What is the Paris Agreement?",
];

let chatHistory = [];
let isOpen = false;
let isTyping = false;

/**
 * Creates the floating action button (FAB) that opens the chat panel.
 * @returns {HTMLButtonElement} The fully assembled FAB element.
 */
function createChatFab() {
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

/**
 * Creates the chat panel header bar with bot info and close button.
 * @returns {HTMLDivElement} The header element.
 */
function createChatHeader() {
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

/**
 * Creates the messages container with the welcome banner and suggestions slot.
 * @returns {HTMLDivElement} The messages area element.
 */
function createChatMessages() {
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
    ", your AI eco assistant. Ask me anything about sustainability, climate, or how to reduce your carbon footprint!",
  );
  const suggestionsDiv = document.createElement("div");
  suggestionsDiv.className = "ecobot-suggestions";
  suggestionsDiv.id = "ecobot-suggestions";
  welcomeDiv.append(welcomeText, suggestionsDiv);
  messagesDiv.append(welcomeDiv);
  return messagesDiv;
}

/**
 * Creates the chat input form with a text field and send button.
 * @returns {HTMLFormElement} The input form element.
 */
function createChatInputForm() {
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

/**
 * Populates the suggestions container with clickable question chips.
 * @param {HTMLElement} container - The suggestions container element.
 */
function populateSuggestions(container) {
  SUGGESTED_QUESTIONS.forEach((q) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ecobot-chip";
    chip.textContent = q;
    chip.addEventListener("click", () => handleUserMessage(q));
    container.append(chip);
  });
}

/**
 * Attaches event listeners for opening/closing the chat and submitting
 * messages.
 * @param {HTMLButtonElement} fab - The floating action button element.
 */
function setupChatEvents(fab) {
  fab.addEventListener("click", toggleChat);
  document.getElementById("ecobot-close").addEventListener("click", toggleChat);
  document.getElementById("ecobot-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("ecobot-input");
    const text = input.value.trim();
    if (text && !isTyping) {
      handleUserMessage(text);
      input.value = "";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) toggleChat();
  });
}

/**
 * Builds the floating chat widget DOM (FAB button + slide-out panel),
 * populates suggested-question chips, and wires up event listeners.
 */
function createChatWidget() {
  const fab = createChatFab();

  const panel = document.createElement("div");
  panel.className = "ecobot-panel";
  panel.id = "ecobot-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "EcoBot AI Chat");

  panel.append(createChatHeader(), createChatMessages(), createChatInputForm());

  document.body.append(fab, panel);

  const suggestionsContainer = document.getElementById("ecobot-suggestions");
  populateSuggestions(suggestionsContainer);

  setupChatEvents(fab);
}

/**
 * Toggles the chat panel open/closed and updates ARIA attributes on the FAB.
 */
function toggleChat() {
  isOpen = !isOpen;
  const panel = document.getElementById("ecobot-panel");
  const fab = document.getElementById("ecobot-fab");
  panel.classList.toggle("is-open", isOpen);
  fab.classList.toggle("is-active", isOpen);
  fab.setAttribute("aria-expanded", String(isOpen));

  if (isOpen) {
    const input = document.getElementById("ecobot-input");
    setTimeout(() => input?.focus(), FOCUS_DELAY_MS);
  }
}

/**
 * Appends a chat bubble to the messages pane and auto-scrolls to the bottom.
 * @param {"user"|"bot"} role - Who sent the message.
 * @param {string}       text - Message content (may contain markdown-like formatting).
 */
function addMessage(role, text) {
  const messagesEl = document.getElementById("ecobot-messages");
  const bubble = document.createElement("div");
  bubble.className = `ecobot-msg ecobot-msg-${role}`;

  const content = document.createElement("div");
  content.className = "ecobot-msg-content";
  // Safe: formatMessage() escapes all HTML entities before applying formatting
  content.innerHTML = formatMessage(text);

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
 * Converts lightweight markdown-like syntax (bold, bullets, code) to HTML.
 * @param {string} text - Raw message text.
 * @returns {string} HTML string.
 */
function formatMessage(text) {
  // Convert markdown-like formatting to HTML
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n- /g, "\n• ")
    .replace(/\n/g, "<br>")
    .replace(/`(.*?)`/g, "<code>$1</code>");
}

/**
 * Inserts an animated "typing…" indicator into the chat messages area.
 */
function showTypingIndicator() {
  const messagesEl = document.getElementById("ecobot-messages");
  const typing = document.createElement("div");
  typing.className = "ecobot-msg ecobot-msg-bot ecobot-typing";
  typing.id = "ecobot-typing";
  const typingContent = document.createElement("div");
  typingContent.className = "ecobot-msg-content";
  for (let i = 0; i < 3; i++) {
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
function removeTypingIndicator() {
  document.getElementById("ecobot-typing")?.remove();
}

/**
 * Handles a user's chat message: shows it in the UI, sends it to Gemini
 * (or the fallback responder), and appends the reply.
 * @param {string} text - The user's message text.
 */
async function handleUserMessage(text) {
  if (isTyping) return;

  // Hide suggestions after first message
  const suggestions = document.getElementById("ecobot-suggestions");
  if (suggestions) suggestions.style.display = "none";

  addMessage("user", text);
  chatHistory.push({ role: "user", parts: [{ text }] });

  // Trim history
  if (chatHistory.length > MAX_HISTORY) {
    chatHistory = chatHistory.slice(-MAX_HISTORY);
  }

  isTyping = true;
  showTypingIndicator();
  document.getElementById("ecobot-send").disabled = true;

  try {
    const reply = await callGemini(text);
    removeTypingIndicator();
    addMessage("bot", reply);
    chatHistory.push({ role: "model", parts: [{ text: reply }] });
  } catch (error) {
    removeTypingIndicator();
    logError('chatbot', "EcoBot error:", error);
    const fallback = getFallbackResponse(text);
    addMessage("bot", fallback);
  } finally {
    isTyping = false;
    document.getElementById("ecobot-send").disabled = false;
  }
}

/**
 * Calls the Gemini generative-AI API (or a configured proxy) to produce a
 * response for the user's message.
 * @param {string} userMessage - The latest user message.
 * @returns {Promise<string>} The model's reply text.
 * @throws {Error} If the API returns a non-OK status or an empty response.
 */
async function callGemini(userMessage) {
  if (!hasGeminiConfig()) {
    return getFallbackResponse(userMessage);
  }

  const endpoint = ECO_CONFIG.gemini.proxyEndpoint
    ? ECO_CONFIG.gemini.proxyEndpoint
    : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        ECO_CONFIG.gemini.model,
      )}:generateContent?key=${encodeURIComponent(ECO_CONFIG.gemini.apiKey)}`;

  const body = {
    contents: chatHistory,
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature: GEMINI_TEMPERATURE,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      topP: GEMINI_TOP_P,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ECO_CONFIG.gemini.proxyEndpoint ? { message: userMessage, history: chatHistory } : body),
  });

  if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text) throw new Error("Empty response");
  return text.trim();
}

/**
 * Returns a pre-written answer when the Gemini API is not available.
 * Matches keywords in the question to pick the most relevant response.
 * @param {string} question - The user's question text.
 * @returns {string} A static eco-related answer.
 */
function getFallbackResponse(question) {
  const q = question.toLowerCase();
  if (q.includes("carbon footprint") || q.includes("co2")) {
    return "🌍 Your carbon footprint is the total greenhouse gases you produce. The average person emits about 4 tonnes of CO₂ per year globally. Use our **Calculator** to measure yours and find ways to reduce it!";
  }
  if (q.includes("recycle") || q.includes("recycling")) {
    return "♻️ Most paper, cardboard, glass, and metal cans can be recycled. Avoid recycling contaminated food containers, plastic bags, and styrofoam. Check your local guidelines — they vary by area!";
  }
  if (q.includes("ev") || q.includes("electric vehicle") || q.includes("electric car")) {
    return "🚗 EVs produce significantly fewer lifetime emissions than petrol cars, even accounting for battery manufacturing. The savings grow as the electricity grid gets cleaner!";
  }
  if (q.includes("tree") || q.includes("plant")) {
    return "🌳 A single mature tree absorbs about 22 kg of CO₂ per year. Planting trees is great, but reducing emissions at the source is even more impactful. Try our **Challenges** page for action ideas!";
  }
  if (q.includes("meat") || q.includes("vegan") || q.includes("diet") || q.includes("food")) {
    return "🥗 Food accounts for ~25% of global emissions. Beef has the highest footprint (~27 kg CO₂ per kg). Even switching 2-3 meals per week to plant-based can save 500+ kg CO₂ per year!";
  }
  if (q.includes("energy") || q.includes("electricity") || q.includes("solar")) {
    return "⚡ Home energy is a big part of your footprint. Switch to LED bulbs, use natural ventilation, and consider rooftop solar. Even raising your AC by 1°C saves ~120 kg CO₂ per year!";
  }
  return "🌱 That's a great question! I'm here to help with anything related to sustainability, climate change, and reducing your environmental impact. Try asking about carbon footprints, recycling, EVs, or eco-friendly lifestyle tips!";
}

// ── Initialize ──
/**
 * Initialises the EcoBot chat widget on the current page.
 * Skipped on pages that include a `[data-no-chatbot]` element.
 */
export function initEcoBot() {
  // Don't show on pages that are too small (like modals)
  if (document.querySelector("[data-no-chatbot]")) return;
  createChatWidget();
}
