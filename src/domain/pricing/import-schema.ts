import { z } from "zod";

// Decimal strings only — no floating-point values allowed
const DecimalStringSchema = z
  .string()
  .regex(/^\d+\.\d+$/, 'Must be a decimal string with fractional part (e.g. "1.250000000000")');

export const PricingImportEntrySchema = z.object({
  model: z.string().min(1),
  validFrom: z.string().datetime({ message: "validFrom must be ISO8601 UTC" }),
  validUntil: z
    .string()
    .datetime({ message: "validUntil must be ISO8601 UTC" })
    .optional(),
  inputPerMillion: DecimalStringSchema,
  cachedInputPerMillion: DecimalStringSchema,
  outputPerMillion: DecimalStringSchema,
});

export const PricingImportFileSchema = z.object({
  schemaVersion: z.literal(1, {
    errorMap: () => ({ message: "Unsupported schemaVersion. Only version 1 is supported." }),
  }),
  provider: z.string().min(1),
  source: z.string().optional(),
  prices: z.array(PricingImportEntrySchema).min(1, "prices must contain at least one entry"),
});

export type PricingImportFile = z.infer<typeof PricingImportFileSchema>;
export type PricingImportEntry = z.infer<typeof PricingImportEntrySchema>;

// Parse and validate raw JSON — safe to call on the client
export function parseImportFile(raw: unknown): PricingImportFile {
  const result = PricingImportFileSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid import file: ${issues}`);
  }
  return result.data;
}
