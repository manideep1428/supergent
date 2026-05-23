/**
 * Model registry for the Emergent chat.
 *
 * Selector display IDs (the `id` field that the UI sends to /api/chat) are
 * mapped to:
 *   - `chef`     - the brand of the model (used to pick a direct SDK key).
 *   - `gatewayId`- the model identifier expected by the Vercel AI Gateway,
 *                  always in `<provider>/<model>` form. Source of truth:
 *                  https://vercel.com/ai-gateway/models
 *   - `directId` - optional. The id used by the matching @ai-sdk/* provider
 *                  package when the user has supplied a direct key for that
 *                  chef. If omitted, the model is gateway-only.
 *
 * Direct SDK packages used here (per https://ai-sdk.dev/providers):
 *   - @ai-sdk/openai      - OpenAI native models
 *   - @ai-sdk/anthropic   - Anthropic native models
 *   - @ai-sdk/google      - Google Generative AI (Gemini)
 *   - @ai-sdk/deepseek    - DeepSeek native API
 *   - @ai-sdk/mistral     - Mistral La Plateforme
 *   - @ai-sdk/groq        - Groq (hosts Meta Llama 4)
 *   - @ai-sdk/moonshotai  - Moonshot AI native API (Kimi)
 *
 * Z.ai (GLM) does not yet have a first-party @ai-sdk provider and stays
 * gateway-only.
 */

export type ModelChef =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "meta"
  | "mistral"
  | "moonshotai"
  | "zhipuai";

export type ModelEntry = {
  id: string;
  name: string;
  chef: ModelChef;
  gatewayId: string;
  directId?: string;
};

export const MODEL_REGISTRY: ModelEntry[] = [
  // OpenAI -- direct via @ai-sdk/openai
  {
    id: "gpt-5.5-pro",
    name: "GPT-5.5 Pro",
    chef: "openai",
    gatewayId: "openai/gpt-5.5-pro",
    directId: "gpt-5.5-pro",
  },
  {
    id: "gpt-5.5",
    name: "GPT-5.5",
    chef: "openai",
    gatewayId: "openai/gpt-5.5",
    directId: "gpt-5.5",
  },
  {
    id: "gpt-5.5-instant",
    name: "GPT-5.5 Instant",
    chef: "openai",
    gatewayId: "openai/gpt-5.5-instant",
    directId: "gpt-5.5-instant",
  },

  // Anthropic -- direct via @ai-sdk/anthropic
  {
    id: "claude-opus-4.7",
    name: "Claude 4.7 Opus",
    chef: "anthropic",
    gatewayId: "anthropic/claude-opus-4.7",
    directId: "claude-opus-4-7",
  },
  {
    id: "claude-sonnet-4.6",
    name: "Claude 4.6 Sonnet",
    chef: "anthropic",
    gatewayId: "anthropic/claude-sonnet-4.6",
    directId: "claude-sonnet-4-6",
  },
  {
    id: "claude-haiku-4.5",
    name: "Claude 4.5 Haiku",
    chef: "anthropic",
    gatewayId: "anthropic/claude-haiku-4.5",
    directId: "claude-haiku-4-5",
  },

  // Google -- direct via @ai-sdk/google
  {
    id: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    chef: "google",
    gatewayId: "google/gemini-3.1-pro",
    directId: "gemini-3.1-pro",
  },
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash",
    chef: "google",
    gatewayId: "google/gemini-3-flash",
    directId: "gemini-3-flash",
  },
  {
    id: "gemini-3-deep-think",
    name: "Gemini 3 Deep Think",
    chef: "google",
    gatewayId: "google/gemini-3-deep-think",
    directId: "gemini-3-deep-think",
  },

  // DeepSeek -- direct via @ai-sdk/deepseek
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    chef: "deepseek",
    gatewayId: "deepseek/deepseek-v4-pro",
    directId: "deepseek-v4-pro",
  },
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    chef: "deepseek",
    gatewayId: "deepseek/deepseek-v4-flash",
    directId: "deepseek-v4-flash",
  },

  // Meta Llama -- direct via @ai-sdk/groq (Groq hosts Llama 4 Maverick/Scout)
  {
    id: "llama-4-maverick",
    name: "Llama 4 Maverick (400B)",
    chef: "meta",
    gatewayId: "meta/llama-4-maverick",
    directId: "meta-llama/llama-4-maverick-17b-128e-instruct",
  },
  {
    id: "llama-4-scout",
    name: "Llama 4 Scout (109B)",
    chef: "meta",
    gatewayId: "meta/llama-4-scout",
    directId: "meta-llama/llama-4-scout-17b-16e-instruct",
  },

  // Mistral -- direct via @ai-sdk/mistral
  {
    id: "mistral-medium-3.5",
    name: "Mistral Medium 3.5",
    chef: "mistral",
    gatewayId: "mistral/mistral-medium-3.5",
    directId: "mistral-medium-3.5",
  },
  {
    id: "mistral-small-4",
    name: "Mistral Small 4",
    chef: "mistral",
    gatewayId: "mistral/mistral-small-4",
    directId: "mistral-small-latest",
  },

  // Moonshot AI -- direct via @ai-sdk/moonshotai
  {
    id: "kimi-k2.6",
    name: "Kimi K2.6",
    chef: "moonshotai",
    gatewayId: "moonshotai/kimi-k2.6",
    directId: "kimi-k2.6",
  },

  // Z.ai (GLM) -- gateway only (no first-party @ai-sdk provider yet)
  {
    id: "glm-5",
    name: "GLM-5",
    chef: "zhipuai",
    gatewayId: "zai/glm-5",
  },
];

const DEFAULT_ENTRY = MODEL_REGISTRY[0]!;

export function getModelEntry(id: string | null | undefined): ModelEntry {
  if (!id) {
    return DEFAULT_ENTRY;
  }
  return MODEL_REGISTRY.find((model) => model.id === id) ?? DEFAULT_ENTRY;
}
