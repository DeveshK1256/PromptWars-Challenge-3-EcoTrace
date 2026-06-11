/**
 * @module feed
 * Environmental news feed with Google Custom Search integration,
 * topic filtering, article-read tracking, and Web Share API support.
 */
import { ECO_CONFIG, hasSearchConfig } from "./config.js?v=firebase-config-36";
import { FEED_ARTICLES, NEWS_TOPICS } from "./data.js?v=firebase-config-36";
import { appState, onUserReady, setButtonBusy, showToast } from "./app.js?v=firebase-config-36";
import { ecoService } from "./firebase.js?v=firebase-config-36";

const tabs = document.querySelector("[data-feed-tabs]");
const grid = document.querySelector("[data-feed-grid]");
const status = document.querySelector("[data-feed-status]");
const refreshButton = document.querySelector("[data-refresh-feed]");
let activeTopic = "All";
let articles = FEED_ARTICLES;
const DISPLAY_COUNT = 10;

/**
 * Shuffles an array using the Fisher-Yates algorithm and returns a new array.
 * The original array is not mutated.
 * @param {Array<*>} arr - The array to shuffle.
 * @returns {Array<*>} A new array with elements in random order.
 */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Infers a news category from an article's title and snippet using keyword matching.
 * Falls back to "Climate Change" when no keywords match.
 * @param {string} [title=""] - The article title.
 * @param {string} [snippet=""] - The article snippet or description.
 * @returns {string} One of 'Renewable Energy', 'World Environment News', 'Sustainability Tips', or 'Climate Change'.
 */
function inferCategory(title = "", snippet = "") {
  const text = `${title} ${snippet}`.toLowerCase();
  if (text.includes("solar") || text.includes("renewable") || text.includes("energy")) return "Renewable Energy";
  if (text.includes("india") || text.includes("delhi") || text.includes("monsoon")) return "World Environment News";
  if (text.includes("tip") || text.includes("waste") || text.includes("compost")) return "Sustainability Tips";
  return "Climate Change";
}

/**
 * Fetches environmental news articles from the Google Custom Search API.
 * Returns the built-in curated articles when search credentials are not configured.
 * @returns {Promise<Array<{ id: string, category: string, title: string, source: string, url: string, summary: string, readMinutes: number }>>} An array of article objects.
 * @throws {Error} If the Custom Search API returns a non-OK HTTP status.
 */
async function fetchSearchArticles() {
  if (!hasSearchConfig()) return FEED_ARTICLES;
  const params = new URLSearchParams({
    key: ECO_CONFIG.google.customSearchApiKey,
    cx: ECO_CONFIG.google.customSearchCx,
    q: "climate change renewable energy sustainability India environment",
    num: "8",
    safe: "active",
  });
  const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
  if (!response.ok) throw new Error(`Custom Search returned ${response.status}`);
  const data = await response.json();
  return (data.items || []).map((item, index) => ({
    id: item.cacheId || item.link || `search-${index}`,
    category: inferCategory(item.title, item.snippet),
    title: item.title,
    source: item.displayLink || "Google Custom Search",
    url: item.link,
    summary: item.snippet || "Open the article to learn more.",
    readMinutes: 4 + (index % 3),
  }));
}

/**
 * Renders the topic filter tab buttons (e.g. All, Climate Change, Renewable Energy).
 * Highlights the currently active topic and re-renders articles on click.
 * @returns {void}
 */
function renderTabs() {
  if (!tabs) return;
  tabs.replaceChildren();
  NEWS_TOPICS.forEach((topic) => {
    const button = document.createElement("button");
    button.className = "filter-tab";
    button.type = "button";
    button.textContent = topic;
    button.setAttribute("aria-pressed", String(topic === activeTopic));
    button.addEventListener("click", () => {
      activeTopic = topic;
      renderTabs();
      renderArticles();
    });
    tabs.append(button);
  });
}

/**
 * Renders article news cards into the feed grid, filtered by the active topic.
 * Each card includes a "Read & Earn" button that awards Green Points and a
 * share button using the Web Share API (falls back to clipboard copy).
 * @returns {void}
 */
function renderArticles() {
  if (!grid) return;
  const readArticles = new Set(appState.profile?.readArticles || []);
  const filtered = activeTopic === "All" ? articles : articles.filter((article) => article.category === activeTopic);
  const visible = filtered.slice(0, DISPLAY_COUNT);
  grid.replaceChildren();
  visible.forEach((article) => {
    const card = document.createElement("article");
    card.className = "news-card";
    const category = document.createElement("span");
    category.className = "eyebrow";
    category.textContent = article.category;
    const title = document.createElement("h3");
    title.textContent = article.title;
    const summary = document.createElement("p");
    summary.textContent = article.summary;
    const meta = document.createElement("p");
    meta.className = "muted";
    meta.textContent = `${article.source} • ${article.readMinutes} min read`;
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const read = document.createElement("button");
    read.className = "btn btn-small btn-primary";
    read.type = "button";
    read.textContent = readArticles.has(article.id) ? "Read + Earned" : "Read & Earn 5 Points";
    read.disabled = readArticles.has(article.id);
    read.addEventListener("click", async () => {
      setButtonBusy(read, true, "Saving...");
      try {
        window.open(article.url, "_blank", "noopener,noreferrer");
        const result = await ecoService.markArticleRead(appState.user, article);
        appState.profile = result.profile;
        showToast(result.awarded ? "Article logged. +5 Green Points!" : "You already earned points for this article.");
        renderArticles();
      } catch (error) {
        console.error(error);
        showToast("Could not award article points.", "error");
      } finally {
        setButtonBusy(read, false);
      }
    });
    const share = document.createElement("button");
    share.className = "btn btn-small btn-secondary";
    share.type = "button";
    share.textContent = "Share";
    share.addEventListener("click", async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: article.title, text: article.summary, url: article.url });
        } else {
          await navigator.clipboard.writeText(article.url);
          showToast("Article link copied.");
        }
      } catch (error) {
        console.warn(error);
      }
    });
    actions.append(read, share);
    card.append(category, title, summary, meta, actions);
    grid.append(card);
  });
}

/**
 * Loads the news feed from localStorage cache, Google Custom Search API, or
 * the built-in curated articles, then renders tabs and article cards.
 * @param {boolean} [force=false] - When true, bypasses the daily cache and fetches fresh results.
 * @returns {Promise<void>} Resolves when articles have been loaded and rendered.
 * @throws {Error} If the Custom Search API call fails (falls back to curated articles).
 */
async function loadFeed(force = false) {
  if (hasSearchConfig()) {
    const key = `ecotrace.feed.${new Date().toISOString().slice(0, 10)}`;
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (!force && cached?.length) {
      articles = cached;
      if (status) status.textContent = "Showing today's cached awareness feed.";
    } else {
      if (status) status.textContent = "Loading climate stories...";
      try {
        articles = await fetchSearchArticles();
        localStorage.setItem(key, JSON.stringify(articles));
        if (status) status.textContent = "Feed loaded from Google Custom Search.";
      } catch (error) {
        console.warn(error);
        articles = shuffleArray(FEED_ARTICLES);
        if (status) status.textContent = "Google Custom Search was unavailable, so curated stories are shown.";
      }
    }
  } else {
    articles = shuffleArray(FEED_ARTICLES);
    if (status) status.textContent = "Showing curated EcoTrace stories from around the world.";
  }
  renderTabs();
  renderArticles();
}

refreshButton?.addEventListener("click", async () => {
  setButtonBusy(refreshButton, true, "Refreshing...");
  try {
    await loadFeed(true);
    showToast("Awareness feed refreshed.");
  } finally {
    setButtonBusy(refreshButton, false);
  }
});

onUserReady(() => {
  loadFeed().catch((error) => {
    console.error(error);
    if (status) status.textContent = "Feed could not load right now.";
  });
});
