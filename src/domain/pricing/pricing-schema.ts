import { z } from "zod";

export const CreatePricingSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  inputPricePerMillion: z.string().regex(/^\d+(\.\d+)?$/, "must be a non-negative decimal"),
  cachedInputPricePerMillion: z.string().regex(/^\d+(\.\d+)?$/, "must be a non-negative decimal"),
  outputPricePerMillion: z.string().regex(/^\d+(\.\d+)?$/, "must be a non-negative decimal"),
  validFrom: z.string().datetime({ message: "validFrom must be ISO8601 UTC" }),
  validUntil: z.string().datetime({ message: "validUntil must be ISO8601 UTC" }).nullable().optional(),
  source: z.string().optional(),
});

export type CreatePricing = z.infer<typeof CreatePricingSchema>;

export const UpdatePricingSchema = CreatePricingSchema.partial().extend({
  id: z.string().uuid(),
});

export type UpdatePricing = z.infer<typeof UpdatePricingSchema>;

export interface PricingRecord {
  id: string;
  provider: string;
  model: string;
  inputPricePerMillion: string;
  cachedInputPricePerMillion: string;
  outputPricePerMillion: string;
  validFrom: string;
  validUntil: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}
