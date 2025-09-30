import {z} from 'genkit';

export const AncestryEstimationInputSchema = z.object({
  snpData: z
    .string()
    .describe(
      'A string representing the user SNP data to be analyzed for ancestry estimation.'
    ),
});
export type AncestryEstimationInput = z.infer<typeof AncestryEstimationInputSchema>;

export const AncestryEstimationOutputSchema = z.object({
  ethnicityEstimates: z
    .string()
    .describe(
      'A detailed report of ethnicity estimates with confidence intervals.'
    ),
});
export type AncestryEstimationOutput = z.infer<typeof AncestryEstimationOutputSchema>;
