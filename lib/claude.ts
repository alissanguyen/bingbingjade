import Anthropic from "@anthropic-ai/sdk";

// Server-only singleton — ANTHROPIC_API_KEY never reaches the client
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
