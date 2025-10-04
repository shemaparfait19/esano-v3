"use server";

/**
 * @fileOverview This file defines a Genkit flow for AI-powered DNA analysis and relative matching.
 *
 * It includes:
 * - `analyzeDnaAndPredictRelatives`: An async function to initiate DNA analysis and predict relatives.
 */

import { ai } from "@/ai/genkit";
import { googleAI } from "@genkit-ai/googleai";
import {
  AnalyzeDnaAndPredictRelativesInputSchema,
  AnalyzeDnaAndPredictRelativesOutputSchema,
  type AnalyzeDnaAndPredictRelativesInput,
  type AnalyzeDnaAndPredictRelativesOutput,
} from "@/ai/schemas/ai-dna-prediction";

export async function analyzeDnaAndPredictRelatives(
  input: AnalyzeDnaAndPredictRelativesInput
): Promise<AnalyzeDnaAndPredictRelativesOutput> {
  return analyzeDnaAndPredictRelativesFlow(input);
}

const analyzeDnaAndPredictRelativesPrompt = ai.definePrompt({
  name: "analyzeDnaAndPredictRelativesPrompt",
  input: { schema: AnalyzeDnaAndPredictRelativesInputSchema },
  output: { schema: AnalyzeDnaAndPredictRelativesOutputSchema },
  prompt: `You are an expert in genetic analysis and genealogy. Given a user's DNA data and a list of other users, identify potential relatives, estimate relationship probabilities, and identify possible common ancestors.

User DNA Data:
{{{dnaData}}}

Other Users (each item contains an exact UserID and DNA):
{{#each otherUsersDnaData}}{{{this}}}
{{/each}}

CRITICAL INSTRUCTIONS:
- When you predict a relative, the \"userId\" MUST be one of the exact UserID values provided in the Other Users list. Do NOT invent or fabricate IDs.
- If no strong matches exist, return an empty array.
- Keep relationship probabilities between 0 and 1.

Return a JSON array conforming to AnalyzeDnaAndPredictRelativesOutputSchema.`,
});

const analyzeDnaAndPredictRelativesFlow = ai.defineFlow(
  {
    name: "analyzeDnaAndPredictRelativesFlow",
    inputSchema: AnalyzeDnaAndPredictRelativesInputSchema,
    outputSchema: AnalyzeDnaAndPredictRelativesOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeDnaAndPredictRelativesPrompt(input, {
      model: googleAI.model("gemini-2.5-flash"),
    });
    return output!;
  }
);
