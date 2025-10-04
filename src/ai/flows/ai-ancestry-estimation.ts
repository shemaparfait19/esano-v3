"use server";
/**
 * @fileOverview This file defines a Genkit flow for AI-powered ancestry estimation.
 *
 * It includes:
 * - analyzeAncestry: An async function to initiate ancestry analysis.
 */

import { ai } from "@/ai/genkit";
import { googleAI } from "@genkit-ai/googleai";
import {
  AncestryEstimationInputSchema,
  AncestryEstimationOutputSchema,
  type AncestryEstimationInput,
  type AncestryEstimationOutput,
} from "@/ai/schemas/ai-ancestry-estimation";

export async function analyzeAncestry(
  input: AncestryEstimationInput
): Promise<AncestryEstimationOutput> {
  return analyzeAncestryFlow(input);
}

const ancestryEstimationPrompt = ai.definePrompt({
  name: "ancestryEstimationPrompt",
  input: { schema: AncestryEstimationInputSchema },
  output: { schema: AncestryEstimationOutputSchema },
  prompt: `Analyze the following SNP data and generate a detailed ancestry report with ethnicity estimates and confidence intervals. Ensure that the ethnicity estimates are as accurate as possible and provide confidence intervals for each estimate.

SNP Data: {{{snpData}}}`,
});

const analyzeAncestryFlow = ai.defineFlow(
  {
    name: "analyzeAncestryFlow",
    inputSchema: AncestryEstimationInputSchema,
    outputSchema: AncestryEstimationOutputSchema,
  },
  async (input) => {
    const { output } = await ancestryEstimationPrompt(input, {
      model: googleAI.model("gemini-2.5-flash"),
    });
    return output!;
  }
);
