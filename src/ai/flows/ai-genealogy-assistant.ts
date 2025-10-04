"use server";
/**
 * @fileOverview This file defines a Genkit flow for an AI-powered genealogy assistant.
 *
 * It includes:
 * - `askGenealogyAssistant`: An async function to get a response from the assistant.
 */

import { ai } from "@/ai/genkit";
import { googleAI } from "@genkit-ai/googleai";
import {
  GenealogyAssistantInputSchema,
  GenealogyAssistantOutputSchema,
  type GenealogyAssistantInput,
  type GenealogyAssistantOutput,
} from "@/ai/schemas/ai-genealogy-assistant";

export async function askGenealogyAssistant(
  input: GenealogyAssistantInput
): Promise<GenealogyAssistantOutput> {
  return genealogyAssistantFlow(input);
}

const genealogyAssistantPrompt = ai.definePrompt({
  name: "genealogyAssistantPrompt",
  input: { schema: GenealogyAssistantInputSchema },
  output: { schema: GenealogyAssistantOutputSchema },
  prompt: `You are a helpful AI assistant specialized in genealogy and DNA analysis.

  Your goal is to answer the user's questions accurately and provide guidance on using the application.
  You can also offer proactive suggestions related to genealogy and DNA analysis.

  When available, use the following user context to personalize your responses. Do not reveal the raw data; summarize and infer helpful next steps.
  User Context (JSON): {{{userContext}}}

  Here's the user's question:
  {{{query}}}`,
});

const genealogyAssistantFlow = ai.defineFlow(
  {
    name: "genealogyAssistantFlow",
    inputSchema: GenealogyAssistantInputSchema,
    outputSchema: GenealogyAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await genealogyAssistantPrompt(input, {
      model: googleAI.model("gemini-2.5-flash"),
    });
    return output!;
  }
);
