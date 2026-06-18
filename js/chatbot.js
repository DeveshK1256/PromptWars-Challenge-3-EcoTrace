/**
 * @module chatbot
 * @description EcoBot — Gemini-powered AI chatbot for eco/sustainability questions.
 * Injects a floating chat widget into every page, provides suggested
 * questions, and falls back to a local answer bank when the Gemini API
 * is unavailable.
 *
 * DOM creation helpers live in {@link module:chatbot-ui chatbot-ui.js};
 * this module handles state, API calls, and event wiring.
 */
import { ECO_CONFIG, hasGeminiConfig } from "./config.js";
import { logError } from "./logger.js";
import {
  BOT_NAME,
  createChatFab,
  createChatHeader,
  createChatMessages,
  createChatInputForm,
  populateSuggestions,
  addMessage,
  showTypingIndicator,
  removeTypingIndicator,
} from "./chatbot-ui.js";

/* ── Magic-number constants ─────────────────────────────────────── */

/** Delay (ms) before auto-focusing the chat input after opening the panel. */
const FOCUS_DELAY_MS = 200;

/** Maximum number of conversation turns kept in memory. */
const MAX_HISTORY = 12;

/** @private System instruction sent to the Gemini proxy for context. */
const _SYSTEM_INSTRUCTION = `You are ${BOT_NAME}, the friendly AI assistant for EcoTrace — a carbon footprint awareness platform.
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
- Be warm, encouraging, and positive.

When the user asks for tips or advice, reference their specific carbon breakdown if available. Focus recommendations on their highest-emission category.`;

/**
 * Builds a context-aware system instruction that includes the user's
 * actual footprint data for personalized advice.
 * @returns {string}
 */
function buildSystemInstruction() {
  let instruction = _SYSTEM_INSTRUCTION;
  try {
    const profileRaw = sessionStorage.getItem('ecotrace.latestProfile')
      || localStorage.getItem('ecotrace.profile');
    if (profileRaw) {
      const profile = JSON.parse(profileRaw);
      const total = Math.round(profile.totalKg || 0);
      const bd = profile.breakdown || {};
      if (total > 0) {
        instruction += `\n\nUser's current footprint: ${total} kg CO₂/year.`;
        instruction += `\nBreakdown: Transport ${Math.round(bd.transport || 0)} kg`;
        instruction += `, Food ${Math.round(bd.food || 0)} kg`;
        instruction += `, Energy ${Math.round(bd.energy || 0)} kg`;
        instruction += `, Shopping ${Math.round(bd.shopping || 0)} kg.`;
        const categories = [
          { name: 'Transport', kg: bd.transport || 0 },
          { name: 'Food', kg: bd.food || 0 },
          { name: 'Energy', kg: bd.energy || 0 },
          { name: 'Shopping', kg: bd.shopping || 0 },
        ].sort((a, b) => b.kg - a.kg);
        instruction += `\nHighest category: ${categories[0].name} (${Math.round((categories[0].kg / total) * 100)}%).`;
        instruction += '\nUse this data to give personalized, specific advice.';
      }
    }
  } catch { /* ignore — use base instruction */ }
  return instruction;
}



const SUGGESTED_QUESTIONS = [
  "🌱 How can I reduce my carbon footprint?",
  "📊 Analyze my footprint and suggest top 3 actions",
  "🚗 Is an EV really better for the environment?",
  "🥩 How much CO₂ does eating meat produce?",
  "🎯 How can I reduce my footprint by 20%?",
  "🏠 Best ways to save energy at home?",
  "♻️ What can and can't be recycled?",
  "🌍 What is the Paris Agreement?",
];

let chatHistory = [];
let isOpen = false;
let isTyping = false;

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
  populateSuggestions(suggestionsContainer, SUGGESTED_QUESTIONS, handleUserMessage);

  setupChatEvents(fab);
}

/**
 * Traps keyboard focus within the given container.
 * @param {KeyboardEvent} e
 * @param {HTMLElement} container
 */
function trapFocus(e, container) {
  if (e.key !== 'Tab') return;
  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** @type {((e: KeyboardEvent) => void) | null} */
let _trapListener = null;

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
    _trapListener = (e) => trapFocus(e, panel);
    panel.addEventListener('keydown', _trapListener);
    const input = document.getElementById("ecobot-input");
    setTimeout(() => input?.focus(), FOCUS_DELAY_MS);
  } else if (_trapListener) {
    panel.removeEventListener('keydown', _trapListener);
    _trapListener = null;
  }
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
 * Calls the Gemini AI via a server-side proxy to produce a response.
 * The API key is kept server-side — the client never sees it.
 * Falls back to a local answer bank when no proxy is configured.
 * @param {string} userMessage - The latest user message.
 * @returns {Promise<string>} The model's reply text.
 * @throws {Error} If the proxy returns a non-OK status or an empty response.
 */
async function callGemini(userMessage) {
  if (!hasGeminiConfig()) {
    return getFallbackResponse(userMessage);
  }

  // Build Gemini-compatible contents array from chat history
  const contents = chatHistory.map((turn) => ({
    role: turn.role === "bot" ? "model" : "user",
    parts: [{ text: turn.text }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const response = await fetch(ECO_CONFIG.gemini.proxyEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: buildSystemInstruction() }] },
      generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
    }),
  });

  if (!response.ok) throw new Error(`Gemini proxy returned ${response.status}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("") || "";
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
    return "🌍 Your carbon footprint is the total greenhouse gases you produce."
      + " The average person emits about 4 tonnes of CO₂ per year globally."
      + " Use our **Calculator** to measure yours and find ways to reduce it!";
  }
  if (q.includes("recycle") || q.includes("recycling")) {
    return "♻️ Most paper, cardboard, glass, and metal cans can be recycled."
      + " Avoid recycling contaminated food containers, plastic bags, and styrofoam."
      + " Check your local guidelines — they vary by area!";
  }
  if (q.includes("ev") || q.includes("electric vehicle") || q.includes("electric car")) {
    return "🚗 EVs produce significantly fewer lifetime emissions than petrol cars,"
      + " even accounting for battery manufacturing."
      + " The savings grow as the electricity grid gets cleaner!";
  }
  if (q.includes("tree") || q.includes("plant")) {
    return "🌳 A single mature tree absorbs about 22 kg of CO₂ per year."
      + " Planting trees is great, but reducing emissions at the source is even"
      + " more impactful. Try our **Challenges** page for action ideas!";
  }
  if (q.includes("meat") || q.includes("vegan") || q.includes("diet") || q.includes("food")) {
    return "🥗 Food accounts for ~25% of global emissions."
      + " Beef has the highest footprint (~27 kg CO₂ per kg)."
      + " Even switching 2-3 meals per week to plant-based can save 500+ kg CO₂ per year!";
  }
  if (q.includes("energy") || q.includes("electricity") || q.includes("solar")) {
    return "⚡ Home energy is a big part of your footprint."
      + " Switch to LED bulbs, use natural ventilation, and consider rooftop solar."
      + " Even raising your AC by 1°C saves ~120 kg CO₂ per year!";
  }
  return "🌱 That's a great question! I'm here to help with anything related to"
    + " sustainability, climate change, and reducing your environmental impact."
    + " Try asking about carbon footprints, recycling, EVs, or eco-friendly lifestyle tips!";
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
