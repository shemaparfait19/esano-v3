"use server";

/**
 * @fileOverview An AI agent that analyzes genetic markers to provide insights into health predispositions, phenotypic traits, and ancestral origins.
 *
 * - getGenerationalInsights - A function that processes genetic data and returns AI-driven insights.
 */

import { ai } from "@/ai/genkit";
import { googleAI } from "@genkit-ai/googleai";
import {
  GenerationalInsightsInputSchema,
  GenerationalInsightsOutputSchema,
  type GenerationalInsightsInput,
  type GenerationalInsightsOutput,
} from "@/ai/schemas/ai-generational-insights";

export async function getGenerationalInsights(
  input: GenerationalInsightsInput
): Promise<GenerationalInsightsOutput> {
  return generationalInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: "generationalInsightsPrompt",
  input: { schema: GenerationalInsightsInputSchema },
  output: { schema: GenerationalInsightsOutputSchema },
  prompt: `You are an AI assistant specialized in analyzing genetic data to provide insights into health, traits, and ancestry.

  Analyze the provided genetic marker data and generate insights into the following areas:

  - Health Predispositions: Identify potential health risks and predispositions based on the genetic markers. Provide clear disclaimers that these insights are not medical diagnoses and users should consult healthcare professionals for medical advice.
  - Phenotypic Traits: Determine potential phenotypic traits (e.g., eye color, hair type) based on the genetic markers.
  - Ancestral Origins: Infer ancestral origins and potential historical group connections based on the genetic markers.

  Genetic Marker Data: {{{geneticMarkers}}}

  Format your response as follows:

  Health Insights: [AI-generated insights into potential health predispositions with disclaimers]
  Trait Insights: [AI-generated insights into phenotypic traits]
  Ancestry Insights: [AI-generated insights into ancestral origins]
  `,
});

const generationalInsightsFlow = ai.defineFlow(
  {
    name: "generationalInsightsFlow",
    inputSchema: GenerationalInsightsInputSchema,
    outputSchema: GenerationalInsightsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input, {
      model: googleAI.model("gemini-2.5-flash"),
    });
    return output!;
  }
);
