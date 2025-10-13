import { z } from 'zod';

export const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, { message: "Name is required" }),
  category: z.enum(['drinks', 'snacks', 'accessories']),
  price: z.number().positive(),
  cost: z.number().nonnegative(), // Allow 0 cost
  stock: z.number().int().nonnegative(),
  low_stock_threshold: z.number().int().nonnegative().default(10),
  barcode: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

// Partial schema for updates
export const partialProductSchema = productSchema.partial().omit({ id: true });