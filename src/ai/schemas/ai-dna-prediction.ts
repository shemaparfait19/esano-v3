import {z} from 'genkit';

export const AnalyzeDnaAndPredictRelativesInputSchema = z.object({
  dnaData: z.string().describe('The user DNA data in a standardized format.'),
  otherUsersDnaData: z
    .array(z.string())
    .describe('Array of other consented users DNA data in the database.'),
  userFamilyTreeData: z
    .string() // Assuming family tree data can be represented as a string (e.g., JSON or similar)
    .optional()
    .describe('User family tree data, if available, to help identify common ancestors.'),
});

export type AnalyzeDnaAndPredictRelativesInput = z.infer<
  typeof AnalyzeDnaAndPredictRelativesInputSchema
>;

const PredictedRelativeSchema = z.object({
  userId: z.string().describe('The ID of the potential relative.'),
  predictedRelationship: z
    .string()
    .describe('The predicted relationship to the user (e.g., 2nd cousin).'),
  relationshipProbability: z
    .number()
    .describe('The probability of the predicted relationship.'),
  commonAncestors: z
    .array(z.string())
    .optional()
    .describe('List of common ancestors, if identified.'),
  sharedCentimorgans: z
    .number()
    .optional()
    .describe('The amount of shared DNA in centimorgans.'),
});

export const AnalyzeDnaAndPredictRelativesOutputSchema = z.array(
  PredictedRelativeSchema
);

export type AnalyzeDnaAndPredictRelativesOutput = z.infer<
  typeof AnalyzeDnaAndPredictRelativesOutputSchema
>;
