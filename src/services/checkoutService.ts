import db from '../db/knex';
import { ulid } from 'ulid';
import { getHourlyRateForMode } from './consoleService';

interface CartItem {
  productId: string;
  quantity: number;
}

interface Receipt {
  id: string;
  sessionId?: string;
  consoleUsage?: {
    consoleName: string;
    consoleType: string;
    gamingMode: '1v1' | '2v2'; // NEW
    duration: number;
    rate: number; // The actual rate used
    baseRate: number; // Console's base 1v1 rate
    rate2v2: number; // Console's 2v2 rate
    calculatedCost: number;
    finalCost: number;
    subtotal: number;
  };
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  timestamp: Date;
}

const TAX_RATE = 0; // 0% Tax

export const processCheckout = async (
  items: CartItem[],
  paymentMethod: string,
  sessionId?: string,
  manualConsolePrice?: number // Manual price override parameter
): Promise<Receipt> => {
  return db.transaction(async (trx) => {
    let subtotal = 0;
    const receiptItemsData = [];
    let consoleUsageData = null;
    let calculatedConsolePrice = 0;
    let finalConsolePrice = 0;
    let gamingMode: '1v1' | '2v2' = '1v1';
    let baseHourlyRate = 0;
    let hourlyRate2v2 = 0;
    let usedHourlyRate = 0;

    // Handle session checkout with gaming mode support
    if (sessionId) {
      const session = await trx('sessions').where({ id: sessionId }).first();

      if (!session) {
        throw new Error('Session not found.');
      }
      if (session.status !== 'ended') {
        throw new Error('Session has not been ended yet.');
      }
      
      const existingReceipt = await trx('receipts').where({ session_id: sessionId }).first();
      if (existingReceipt) {
        throw new Error('This session has already been paid for.');
      }

      // Ensure the final_cost exists and is a valid number
      if (session.final_cost === null || session.final_cost === undefined || isNaN(parseFloat(session.final_cost.toString()))) {
        throw new Error('Session cost has not been calculated. Cannot process checkout.');
      }

      // Get console details with both rates
      const console = await trx('consoles').where({ id: session.console_id }).first();
      if (!console) {
        throw new Error('Console not found for this session.');
      }

      // Extract gaming mode and rates
      gamingMode = session.gaming_mode || '1v1'; // Default to 1v1 if not set
      baseHourlyRate = parseFloat(console.hourly_rate || '0');
      hourlyRate2v2 = parseFloat(console.hourly_rate_2v2 || baseHourlyRate * 1.5);
      usedHourlyRate = gamingMode === '2v2' ? hourlyRate2v2 : baseHourlyRate;

      calculatedConsolePrice = parseFloat(session.final_cost.toString());
      
      // Use manual price if provided, otherwise use calculated price
      finalConsolePrice = manualConsolePrice !== undefined && manualConsolePrice !== null 
        ? parseFloat(manualConsolePrice.toString()) 
        : calculatedConsolePrice;

      // Validate manual price (optional: can't be negative)
      if (finalConsolePrice < 0) {
        throw new Error('Console price cannot be negative.');
      }

      subtotal += finalConsolePrice; // Use the final price (manual or calculated)

      // Calculate session duration
      const activeDurationMs =
        new Date(session.end_time).getTime() -
        new Date(session.start_time).getTime() -
        (session.total_paused_duration || 0);

      consoleUsageData = {
        consoleName: console?.name || 'Unknown Console',
        consoleType: console?.type || 'N/A',
        gamingMode: gamingMode, // NEW: Gaming mode used
        duration: Math.round(activeDurationMs / 60000), // Duration in minutes
        rate: usedHourlyRate, // NEW: The actual rate used
        baseRate: baseHourlyRate, // NEW: Console's base rate
        rate2v2: hourlyRate2v2, // NEW: Console's 2v2 rate
        calculatedCost: calculatedConsolePrice, // Store original calculated cost
        finalCost: finalConsolePrice, // Store what we actually charged
        subtotal: finalConsolePrice,
      };
    }

        // --- START NEW LOGIC ---
    // Fetch items from the session's "running tab"
    if (sessionId) {
      const sessionItems = await trx('session_items').where({ session_id: sessionId });
      
      for (const item of sessionItems) {
        subtotal += parseFloat(item.subtotal);
        receiptItemsData.push({
          product_id: item.product_id,
          // You might want to fetch the current product name here or store it on session_items
          product_name: 'Product Name from Tab', // Placeholder
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price),
          subtotal: parseFloat(item.subtotal),
        });
      }
    }
    // --- END NEW LOGIC ---

    // Process inventory items (unchanged)
    for (const item of items) {
      const product = await trx('products').where('id', item.productId).forUpdate().first();

      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found.`);
      }
      if (product.stock < item.quantity) {
        throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}`);
      }

      // Update product stock
      await trx('products').where('id', item.productId).decrement('stock', item.quantity);

      const itemSubtotal = parseFloat(product.price) * item.quantity;
      subtotal += itemSubtotal;

      receiptItemsData.push({
        product_id: item.productId,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: parseFloat(product.price),
        subtotal: itemSubtotal,
      });
    }

    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    // Create receipt with enhanced gaming mode tracking
    const newReceiptData = {
      id: `rec_${ulid()}`,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      payment_method: paymentMethod,
      session_id: sessionId || null,
      // Enhanced fields for gaming mode tracking
      manual_console_price: manualConsolePrice !== undefined && sessionId ? finalConsolePrice.toFixed(2) : null,
      calculated_console_price: sessionId ? calculatedConsolePrice.toFixed(2) : null,
      gaming_mode: sessionId ? gamingMode : null, // NEW
      base_hourly_rate: sessionId ? baseHourlyRate.toFixed(2) : null, // NEW
      hourly_rate_2v2: sessionId ? hourlyRate2v2.toFixed(2) : null, // NEW
    };
    
    console.log('Creating receipt with gaming mode data:', {
      id: newReceiptData.id,
      gamingMode,
      baseRate: baseHourlyRate,
      rate2v2: hourlyRate2v2,
      usedRate: usedHourlyRate,
      calculatedPrice: calculatedConsolePrice,
      finalPrice: finalConsolePrice
    });
    
    const [receipt] = await trx('receipts').insert(newReceiptData).returning('*');

    // Insert receipt items (unchanged)
    if (receiptItemsData.length > 0) {
      const itemsToInsert = receiptItemsData.map((item) => ({ 
        ...item, 
        receipt_id: receipt.id 
      }));
      await trx('receipt_items').insert(itemsToInsert);
    }

    // Return properly formatted receipt with gaming mode data
    return {
      id: receipt.id,
      sessionId: sessionId || undefined,
      consoleUsage: consoleUsageData,
      items: receiptItemsData.map(item => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal
      })),
      subtotal: parseFloat(receipt.subtotal),
      tax: parseFloat(receipt.tax),
      total: parseFloat(receipt.total),
      paymentMethod: receipt.payment_method,
      timestamp: new Date(receipt.created_at)
    } as Receipt;
  });
};

// NEW: Calculate session cost based on gaming mode
export const calculateSessionCost = async (sessionId: string, gamingMode: '1v1' | '2v2'): Promise<number> => {
  try {
    const session = await db('sessions')
      .join('consoles', 'sessions.console_id', 'consoles.id')
      .where('sessions.id', sessionId)
      .select(
        'sessions.*',
        'consoles.hourly_rate',
        'consoles.hourly_rate_2v2'
      )
      .first();

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'ended') {
      throw new Error('Session must be ended before calculating cost');
    }

    // Calculate active duration
    const endTime = new Date(session.end_time);
    const startTime = new Date(session.start_time);
    const totalDurationMs = endTime.getTime() - startTime.getTime();
    const pausedDurationMs = session.total_paused_duration || 0;
    const activeDurationMs = Math.max(0, totalDurationMs - pausedDurationMs);
    const durationHours = activeDurationMs / (1000 * 60 * 60);

    // Get the correct rate based on gaming mode
    const baseRate = parseFloat(session.hourly_rate || '0');
    const rate2v2 = parseFloat(session.hourly_rate_2v2 || baseRate * 1.5);
    const usedRate = gamingMode === '2v2' ? rate2v2 : baseRate;

    const cost = durationHours * usedRate;
    
    console.log('Session cost calculation:', {
      sessionId,
      gamingMode,
      durationHours: durationHours.toFixed(2),
      baseRate,
      rate2v2,
      usedRate,
      calculatedCost: cost.toFixed(2)
    });

    return parseFloat(cost.toFixed(2));
  } catch (error) {
    console.error('Error calculating session cost:', error);
    throw error;
  }
};

// NEW: Get checkout preview with gaming mode options
export const getCheckoutPreview = async (
  sessionId?: string,
  items: CartItem[] = [],
  gamingMode: '1v1' | '2v2' = '1v1'
) => {
  try {
    let consoleSubtotal = 0;
    let consoleDetails = null;

    // Calculate console cost with gaming mode
    if (sessionId) {
      const session = await db('sessions')
        .join('consoles', 'sessions.console_id', 'consoles.id')
        .where('sessions.id', sessionId)
        .select(
          'sessions.*',
          'consoles.name as consoleName',
          'consoles.type as consoleType',
          'consoles.hourly_rate',
          'consoles.hourly_rate_2v2'
        )
        .first();

      if (session && session.status === 'ended') {
        consoleSubtotal = await calculateSessionCost(sessionId, gamingMode);
        
        const baseRate = parseFloat(session.hourly_rate || '0');
        const rate2v2 = parseFloat(session.hourly_rate_2v2 || baseRate * 1.5);
        const usedRate = gamingMode === '2v2' ? rate2v2 : baseRate;

        consoleDetails = {
          consoleName: session.consoleName,
          consoleType: session.consoleType,
          gamingMode,
          baseRate,
          rate2v2,
          usedRate,
          calculatedCost: consoleSubtotal
        };
      }
    }

    // Calculate items subtotal
    let itemsSubtotal = 0;
    const itemDetails = [];

    for (const item of items) {
      const product = await db('products').where('id', item.productId).first();
      if (product) {
        const itemTotal = parseFloat(product.price) * item.quantity;
        itemsSubtotal += itemTotal;
        
        itemDetails.push({
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: parseFloat(product.price),
          subtotal: itemTotal
        });
      }
    }

    const subtotal = consoleSubtotal + itemsSubtotal;
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    return {
      consoleUsage: consoleDetails,
      items: itemDetails,
      subtotal,
      tax,
      total,
      breakdown: {
        consoleSubtotal,
        itemsSubtotal,
        tax
      }
    };
  } catch (error) {
    console.error('Error getting checkout preview:', error);
    throw error;
  }
};