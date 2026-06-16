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
- Be warm, encouraging, and positive.`;
void _SYSTEM_INSTRUCTION; // Available for proxy payloads


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

  const response = await fetch(ECO_CONFIG.gemini.proxyEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userMessage, history: chatHistory }),
  });

  if (!response.ok) throw new Error(`Gemini proxy returned ${response.status}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("") || data?.reply || "";
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
