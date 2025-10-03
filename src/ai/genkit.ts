import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { openAI } from "@genkit-ai/openai";

const plugins: any[] = [];

// Google Gemini (preferred if key present)
if (process.env.GEMINI_API_KEY) {
  plugins.push(
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
  );
}

// OpenRouter via OpenAI-compatible plugin
if (process.env.OPENROUTER_API_KEY) {
  plugins.push(
    openAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        // Optional but recommended per OpenRouter guidelines
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost",
        "X-Title": "eSANO",
      },
    })
  );
}

export const ai = genkit({ plugins });
