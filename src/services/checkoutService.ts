import db from '../db/knex';
import { ulid } from 'ulid';

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
  manualConsolePrice?: number
): Promise<Receipt> => {
  return db.transaction(async (trx) => {
    let subtotal = 0;
    const receiptItemsData: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }> = [];

    let calculatedConsolePrice = 0;
    let finalConsolePrice = 0;
    let gamingMode: '1v1' | '2v2' = '1v1';
    let baseHourlyRate = 0;
    let hourlyRate2v2 = 0;
    let usedHourlyRate = 0;

    // Handle session-based console charge
    let consoleUsageData: Receipt['consoleUsage'] | null = null;
    if (sessionId) {
      const session = await trx('sessions').where({ id: sessionId }).first();

      if (!session) throw new Error('Session not found.');
      if (session.status !== 'ended') throw new Error('Session has not been ended yet.');

      const existingReceipt = await trx('receipts').where({ session_id: sessionId }).first();
      if (existingReceipt) throw new Error('This session has already been paid for.');

      if (session.final_cost == null || isNaN(Number(session.final_cost))) {
        throw new Error('Session cost has not been calculated. Cannot process checkout.');
      }

      const console = await trx('consoles').where({ id: session.console_id }).first();
      if (!console) throw new Error('Console not found for this session.');

      gamingMode = session.gaming_mode || '1v1';
      baseHourlyRate = Number(console.hourly_rate || 0);
      hourlyRate2v2 = Number(console.hourly_rate_2v2 || baseHourlyRate * 1.5);
      usedHourlyRate = gamingMode === '2v2' ? hourlyRate2v2 : baseHourlyRate;

      calculatedConsolePrice = Number(session.final_cost);
      // If manualConsolePrice is provided, use it; else use calculated
      finalConsolePrice =
        manualConsolePrice != null ? Number(manualConsolePrice) : calculatedConsolePrice;

      if (finalConsolePrice < 0) throw new Error('Console price cannot be negative.');

      subtotal += finalConsolePrice;

      const activeDurationMs =
        new Date(session.end_time).getTime() -
        new Date(session.start_time).getTime() -
        (session.total_paused_duration || 0);

      consoleUsageData = {
        consoleName: console?.name || 'Unknown Console',
        consoleType: console?.type || 'N/A',
        gamingMode,
        duration: Math.round(activeDurationMs / 60000),
        rate: usedHourlyRate,
        baseRate: baseHourlyRate,
        rate2v2: hourlyRate2v2,
        calculatedCost: calculatedConsolePrice,
        finalCost: finalConsolePrice,
        subtotal: finalConsolePrice,
      };
    }

    // IMPORTANT: Do NOT also add session_items if the client already sent items.
    // The CheckoutPage loads session items into its cart and sends them.
    // So we rely solely on `items` from the client to avoid double counting.

    // Process items from client cart
    for (const item of items) {
      const product = await trx('products').where('id', item.productId).forUpdate().first();
      if (!product) throw new Error(`Product with ID ${item.productId} not found.`);
      if (product.stock < item.quantity) {
        throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}`);
      }

      await trx('products').where('id', item.productId).decrement('stock', item.quantity);

      const unitPrice = Number(product.price);
      const itemSubtotal = unitPrice * item.quantity;
      subtotal += itemSubtotal;

      receiptItemsData.push({
        product_id: item.productId,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: itemSubtotal,
      });
    }

    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    const newReceiptData = {
      id: `rec_${ulid()}`,
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2)),
      payment_method: paymentMethod,
      session_id: sessionId || null,
      // Save manual/ calculated console price if this is a session checkout
      manual_console_price:
        sessionId && manualConsolePrice != null ? Number(finalConsolePrice.toFixed(2)) : null,
      calculated_console_price:
        sessionId ? Number(calculatedConsolePrice.toFixed(2)) : null,
      gaming_mode: sessionId ? gamingMode : null,
      base_hourly_rate: sessionId ? Number(baseHourlyRate.toFixed(2)) : null,
      hourly_rate_2v2: sessionId ? Number(hourlyRate2v2.toFixed(2)) : null,
    };

    console.log('Creating receipt with gaming mode data:', {
      id: newReceiptData.id,
      gamingMode,
      baseRate: baseHourlyRate,
      rate2v2: hourlyRate2v2,
      usedRate: usedHourlyRate,
      calculatedPrice: calculatedConsolePrice,
      finalPrice: finalConsolePrice,
      manualProvided: manualConsolePrice != null,
    });

    // Insert receipt
    let insertedReceipt: any;
    try {
      [insertedReceipt] = await trx('receipts').insert(newReceiptData).returning('*');
    } catch {
      await trx('receipts').insert(newReceiptData);
      insertedReceipt = await trx('receipts').where({ id: newReceiptData.id }).first();
    }

    // Insert receipt items
    if (receiptItemsData.length > 0) {
      const itemsToInsert = receiptItemsData.map((it) => ({
        ...it,
        receipt_id: insertedReceipt.id,
      }));
      await trx('receipt_items').insert(itemsToInsert);
    }

    return {
      id: insertedReceipt.id,
      sessionId: sessionId || undefined,
      consoleUsage: consoleUsageData || undefined,
      items: receiptItemsData.map(item => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal
      })),
      subtotal: Number(insertedReceipt.subtotal),
      tax: Number(insertedReceipt.tax),
      total: Number(insertedReceipt.total),
      paymentMethod: insertedReceipt.payment_method,
      timestamp: new Date(insertedReceipt.created_at),
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