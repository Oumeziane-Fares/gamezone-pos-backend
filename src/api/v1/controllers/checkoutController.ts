import { Request, Response, NextFunction } from 'express';
import * as checkoutService from '../../../services/checkoutService';
import { z } from 'zod';

const checkoutSchema = z.object({
  paymentMethod: z.string(),
  sessionId: z.string().optional(),
  manualConsolePrice: z.number().min(0).optional(), // New field for manual console price
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  })).default([]),
});

export const handleCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, paymentMethod, sessionId, manualConsolePrice } = checkoutSchema.parse(req.body);

    const receipt = await checkoutService.processCheckout(
      items, 
      paymentMethod, 
      sessionId, 
      manualConsolePrice // Pass the manual price
    );
    
    res.status(201).json({
      success: true,
      data: receipt
    });
  } catch (error) {
    console.error('Checkout error:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};