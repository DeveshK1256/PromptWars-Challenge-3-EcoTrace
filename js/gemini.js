import { ECO_CONFIG, hasGeminiConfig } from "./config.js?v=firebase-config-32";
import { FALLBACK_TIPS } from "./data.js?v=firebase-config-32";

function buildPrompt(profile) {
  return `You are EcoTrace, a carbon footprint coach for users in India.
Return JSON only with this exact shape:
{
  "tips": [
    {
      "id": "short-kebab-id",
      "category": "Transport|Food|Energy|Shopping",
      "title": "specific action title",
      "savingKg": 120,
      "difficulty": "Easy|Medium|Hard",
      "body": "one sentence practical explanation"
    }
  ]
}
Create exactly 5 personalized tips. Prioritize the highest footprint categories and avoid guilt-heavy language.
User profile:
${JSON.stringify(profile, null, 2)}`;
}

function normalizeTip(tip, index) {
  const fallback = FALLBACK_TIPS[index % FALLBACK_TIPS.length];
  const category = ["Transport", "Food", "Energy", "Shopping"].includes(tip?.category)
    ? tip.category
    : fallback.category;
  const difficulty = ["Easy", "Medium", "Hard"].includes(tip?.difficulty) ? tip.difficulty : fallback.difficulty;
  return {
    id: String(tip?.id || fallback.id || `ai-tip-${index}`).slice(0, 80),
    category,
    title: String(tip?.title || fallback.title).slice(0, 100),
    savingKg: Math.max(5, Math.round(Number(tip?.savingKg || fallback.savingKg || 25))),
    difficulty,
    body: String(tip?.body || fallback.body).slice(0, 240),
  };
}

function parseGeminiResponse(data) {
  const rawText = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed?.tips) ? parsed.tips.map(normalizeTip).slice(0, 5) : FALLBACK_TIPS;
}

export function getFallbackTips() {
  return FALLBACK_TIPS.map(normalizeTip).slice(0, 5);
}

export async function getPersonalizedTips(profile) {
  if (!hasGeminiConfig()) {
    return {
      source: "fallback",
      tips: getFallbackTips(),
      message: "Gemini is not configured yet, so EcoTrace is showing curated starter tips.",
    };
  }

  const prompt = buildPrompt(profile);
  try {
    if (ECO_CONFIG.gemini.proxyEndpoint) {
      const response = await fetch(ECO_CONFIG.gemini.proxyEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, prompt }),
      });
      if (!response.ok) throw new Error(`Gemini proxy returned ${response.status}`);
      const data = await response.json();
      const tips = Array.isArray(data.tips) ? data.tips.map(normalizeTip).slice(0, 5) : parseGeminiResponse(data);
      return { source: "gemini-proxy", tips };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      ECO_CONFIG.gemini.model,
    )}:generateContent?key=${encodeURIComponent(ECO_CONFIG.gemini.apiKey)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
    const data = await response.json();
    return { source: "gemini-api", tips: parseGeminiResponse(data) };
  } catch (error) {
    console.warn("EcoTrace Gemini fallback used", error);
    return {
      source: "fallback",
      tips: getFallbackTips(),
      message: "Gemini tips could not load right now, so EcoTrace used static fallback tips.",
    };
  }
}
