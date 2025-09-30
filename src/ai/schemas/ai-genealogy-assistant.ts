import { z } from "genkit";

export const GenealogyAssistantInputSchema = z.object({
  query: z.string().describe("The user query about genealogy or DNA analysis."),
  userContext: z
    .string()
    .optional()
    .describe(
      "Optional serialized context about the logged-in user (profile, tree, preferences)."
    ),
});
export type GenealogyAssistantInput = z.infer<
  typeof GenealogyAssistantInputSchema
>;

export const GenealogyAssistantOutputSchema = z.object({
  response: z
    .string()
    .describe("The AI assistant's response to the user query."),
});
export type GenealogyAssistantOutput = z.infer<
  typeof GenealogyAssistantOutputSchema
>;
