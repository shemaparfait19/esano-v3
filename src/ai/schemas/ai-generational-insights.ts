import {z} from 'genkit';

export const GenerationalInsightsInputSchema = z.object({
  geneticMarkers: z
    .string()
    .describe(
      'A string containing genetic marker data (SNPs, Indels) in a standardized format.'
    ),
});
export type GenerationalInsightsInput = z.infer<typeof GenerationalInsightsInputSchema>;

export const GenerationalInsightsOutputSchema = z.object({
  healthInsights: z
    .string()
    .describe(
      'AI-generated insights into potential health predispositions based on the genetic markers, with clear disclaimers that this is not medical advice.'
    ),
  traitInsights: z
    .string()
    .describe(
      'AI-generated insights into phenotypic traits (e.g., eye color, hair type) based on the genetic markers.'
    ),
  ancestryInsights: z
    .string()
    .describe(
      'AI-generated insights into ancestral origins and potential historical group connections based on the genetic markers.'
    ),
});
export type GenerationalInsightsOutput = z.infer<typeof GenerationalInsightsOutputSchema>;
