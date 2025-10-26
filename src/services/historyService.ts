import db from '../db/knex';
type ReceiptItemWithDetails = {
  subtotal: string | number;
  product_name: string;
  current_product_name: string;
  category: string;
  quantity: number;
  unit_price: string | number;
};
export const findAllTransactions = async () => {
  try {
    // QUERY 1: Get all receipts with their session and console data joined directly.
    const receiptsAndSessions = await db('receipts')
      .leftJoin('sessions', 'receipts.session_id', 'sessions.id')
      .leftJoin('consoles', 'sessions.console_id', 'consoles.id')
      .select(
        'receipts.*',
        'sessions.id as sessionId', // Alias to avoid clashes
        'sessions.start_time',
        'sessions.end_time',
        'sessions.final_cost',
        'sessions.total_paused_duration',
        'sessions.gaming_mode as session_gaming_mode',
        'consoles.name as consoleName',
        'consoles.type as consoleType',
        'consoles.hourly_rate as baseHourlyRate',
        'consoles.hourly_rate_2v2 as hourlyRate2v2'
      )
      .orderBy('receipts.created_at', 'desc');

    if (receiptsAndSessions.length === 0) {
      return [];
    }

    const receiptIds = receiptsAndSessions.map(r => r.id);

    // QUERY 2: Get all items for ONLY the receipts we found.
    const allItems = await db('receipt_items')
      .leftJoin('products', 'receipt_items.product_id', 'products.id')
      .select(
        'receipt_items.receipt_id',
        'receipt_items.quantity',
        'receipt_items.unit_price',
        'receipt_items.subtotal',
        'receipt_items.product_name',
        'products.name as current_product_name',
        'products.category'
      )
      .whereIn('receipt_items.receipt_id', receiptIds);

    // Group items by receipt_id for quick lookups in memory
    const itemsByReceiptId = allItems.reduce((acc, item) => {
      if (!acc[item.receipt_id]) {
        acc[item.receipt_id] = [];
      }
      acc[item.receipt_id].push(item);
      return acc;
    }, {} as Record<string, typeof allItems>);


    // Combine the data efficiently in JavaScript
    const transactions = receiptsAndSessions.map(receipt => {
      const relatedItems = itemsByReceiptId[receipt.id] || [];
      
      let consoleUsage = null;
      if (receipt.sessionId) {
        // All session and console data is already attached to the 'receipt' object from the join
        const startTime = new Date(receipt.start_time);
        const endTime = new Date(receipt.end_time);
        const totalDurationMs = endTime.getTime() - startTime.getTime();
        const pausedDurationMs = receipt.total_paused_duration || 0;
        const activeDurationMs = Math.max(0, totalDurationMs - pausedDurationMs);
        const durationMinutes = Math.round(activeDurationMs / (1000 * 60));

        const gamingMode = receipt.gaming_mode || receipt.session_gaming_mode || '1v1';
        const baseRate = parseFloat(receipt.base_hourly_rate || receipt.baseHourlyRate || '0');
        const rate2v2 = parseFloat(receipt.hourly_rate_2v2 || receipt.hourlyRate2v2 || (baseRate * 1.5).toString());
        const usedRate = gamingMode === '2v2' ? rate2v2 : baseRate;

        const hasManualPrice = receipt.manual_console_price !== null &&
                               receipt.calculated_console_price !== null &&
                               parseFloat(receipt.manual_console_price) !== parseFloat(receipt.calculated_console_price);

        const calculatedCost = parseFloat(receipt.calculated_console_price || receipt.final_cost || '0');
        const actualCost = receipt.manual_console_price ? parseFloat(receipt.manual_console_price) : calculatedCost;
        const discountGiven = hasManualPrice ? calculatedCost - actualCost : 0;

        consoleUsage = {
          consoleName: receipt.consoleName,
          consoleType: receipt.consoleType,
          gamingMode: gamingMode,
          duration: durationMinutes,
          hourlyRate: usedRate,
          baseHourlyRate: baseRate,
          hourlyRate2v2: rate2v2,
          usedHourlyRate: usedRate,
          calculatedCost: calculatedCost,
          actualCost: actualCost,
          discountGiven: discountGiven,
          hasManualPriceOverride: hasManualPrice,
          priceAdjustmentType: hasManualPrice ? (discountGiven > 0 ? 'discount' : 'surcharge') : 'none'
        };
      }
      
      // FIXED: Add types for the accumulator (sum) and the item
      const itemsSubtotal = relatedItems.reduce((sum: number, item: ReceiptItemWithDetails) => {
        return sum + parseFloat(String(item.subtotal));
      }, 0);
      
      return {
        id: receipt.id,
        timestamp: receipt.created_at,
        total: parseFloat(String(receipt.total)),
        subtotal: parseFloat(String(receipt.subtotal)),
        tax: parseFloat(String(receipt.tax || '0')),
        paymentMethod: receipt.payment_method,
        items: relatedItems.map((item: ReceiptItemWithDetails) => ({
          productName: item.product_name || item.current_product_name,
          currentProductName: item.current_product_name,
          category: item.category,
          quantity: item.quantity,
          unitPrice: parseFloat(String(item.unit_price)),
          subtotal: parseFloat(String(item.subtotal))
        })),
        consoleUsage,
        summary: {
          itemsSubtotal,
          consoleSubtotal: consoleUsage ? consoleUsage.actualCost : 0,
          originalConsoleSubtotal: consoleUsage ? consoleUsage.calculatedCost : 0,
          totalDiscount: consoleUsage ? consoleUsage.discountGiven : 0,
          itemCount: relatedItems.length,
          hasDiscounts: consoleUsage ? consoleUsage.hasManualPriceOverride : false,
          gamingMode: consoleUsage ? consoleUsage.gamingMode : null
        }
      };
    });

    return transactions;

  } catch (error) {
    console.error('Error in findAllTransactions:', error);
    throw new Error('Failed to fetch transaction history');
  }
};

// Get transaction statistics for a specific period with gaming mode breakdown
export const getTransactionStats = async (startDate?: string, endDate?: string) => {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    // Convert Date objects to ISO strings for SQLite comparison (fixed for TEXT field)
    const startStr = start.toISOString();
    const endStr = end.toISOString();

    console.log('=== TRANSACTION STATS DEBUG ===');
    console.log('Date range:', { startStr, endStr });

    // First, let's check what transactions exist in the date range
    const testCount = await db('receipts')
      .count('* as count')
      .where('created_at', '>=', startStr)
      .where('created_at', '<=', endStr)
      .first();

    console.log('Transactions in date range:', testCount?.count);

    // Main stats query with fixed date comparison
    const stats = await db('receipts')
      .select(
        db.raw('COUNT(*) as total_transactions'),
        db.raw('SUM(total) as total_revenue'),
        db.raw('AVG(total) as avg_transaction_value'),
        db.raw(`
          COUNT(CASE 
            WHEN manual_console_price IS NOT NULL AND manual_console_price != calculated_console_price
            THEN 1 
          END) as transactions_with_discounts
        `),
        db.raw(`
          SUM(CASE 
            WHEN manual_console_price IS NOT NULL AND calculated_console_price IS NOT NULL
            THEN (calculated_console_price - manual_console_price)
            ELSE 0 
          END) as total_discounts_given
        `),
        db.raw(`
          AVG(CASE 
            WHEN manual_console_price IS NOT NULL AND calculated_console_price IS NOT NULL AND manual_console_price != calculated_console_price
            THEN (calculated_console_price - manual_console_price)
          END) as avg_discount_amount
        `)
      )
      .where('created_at', '>=', startStr)
      .where('created_at', '<=', endStr)
      .first();

    console.log('Main stats result:', stats);

    // Payment methods stats with fixed date filtering
    const paymentMethods = await db('receipts')
      .select('payment_method')
      .count('* as count')
      .sum('total as revenue')
      .where('created_at', '>=', startStr)
      .where('created_at', '<=', endStr)
      .whereNotNull('payment_method')
      .groupBy('payment_method')
      .orderBy('revenue', 'desc');

    console.log('Payment methods:', paymentMethods);

    // Gaming modes stats - FIXED: Proper Knex syntax
    const gamingModes = await db('receipts')
      .select(
        'gaming_mode',
        db.raw('COUNT(*) as count'),
        db.raw('SUM(COALESCE(manual_console_price, calculated_console_price, 0)) as revenue')
      )
      .whereNotNull('gaming_mode')
      .where('created_at', '>=', startStr)
      .where('created_at', '<=', endStr)
      .groupBy('gaming_mode')
      .orderBy('revenue', 'desc');

    console.log('Gaming modes:', gamingModes);

    // Revenue breakdown - FIXED: Calculate based on your actual schema
    // Console revenue: actual console price paid
    // Items revenue: total minus console price (since total = console + items + tax)
    const revenueData = await db('receipts')
      .select(
        db.raw('SUM(COALESCE(manual_console_price, calculated_console_price, 0)) as console_revenue'),
        db.raw('SUM(subtotal) as total_subtotal'), // This is subtotal before tax
        db.raw('SUM(total) as total_revenue'),
        db.raw('SUM(tax) as total_tax')
      )
      .where('created_at', '>=', startStr)
      .where('created_at', '<=', endStr)
      .first();

    console.log('Revenue data:', revenueData);

    // Calculate items revenue: subtotal minus console cost
    const consoleRevenue = parseFloat(revenueData?.console_revenue) || 0;
    const totalSubtotal = parseFloat(revenueData?.total_subtotal) || 0;
    const itemsRevenue = Math.max(0, totalSubtotal - consoleRevenue); // Ensure non-negative

    const revenueBreakdown = {
      console_revenue: consoleRevenue,
      items_revenue: itemsRevenue
    };

    console.log('Revenue breakdown:', revenueBreakdown);
    console.log('=== END DEBUG ===');

    // Process and format results
    const totalTransactions = parseInt(stats?.total_transactions) || 0;
    const totalRevenue = parseFloat(stats?.total_revenue) || 0;
    const avgTransactionValue = parseFloat(stats?.avg_transaction_value) || 0;
    const transactionsWithDiscounts = parseInt(stats?.transactions_with_discounts) || 0;
    const totalDiscountsGiven = parseFloat(stats?.total_discounts_given) || 0;
    const avgDiscountAmount = parseFloat(stats?.avg_discount_amount) || 0;
    const discountPercentage = totalRevenue > 0 ? (totalDiscountsGiven / totalRevenue) * 100 : 0;

    // Format payment methods
    const formattedPaymentMethods = paymentMethods.map(pm => ({
      method: pm.payment_method || 'unknown',
      count: parseInt(pm.count) || 0,
      revenue: parseFloat(pm.revenue) || 0
    }));

    // Format gaming modes
    const formattedGamingModes = gamingModes.map(gm => ({
      mode: gm.gaming_mode || 'unknown',
      count: parseInt(String(gm.count)) || 0,
      revenue: parseFloat(String(gm.revenue)) || 0
    }));

    const result = {
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      totals: {
        transactions: totalTransactions,
        revenue: totalRevenue,
        avgTransactionValue: avgTransactionValue,
        transactionsWithDiscounts: transactionsWithDiscounts,
        totalDiscountsGiven: totalDiscountsGiven,
        avgDiscountAmount: avgDiscountAmount,
        discountPercentage: discountPercentage
      },
      paymentMethods: formattedPaymentMethods,
      gamingModes: formattedGamingModes,
      revenueBreakdown: {
        consoleRevenue: consoleRevenue,
        itemsRevenue: itemsRevenue
      }
    };

    console.log('Final result:', JSON.stringify(result, null, 2));
    return result;

  } catch (error) {
    console.error('Error in getTransactionStats:', error);
    throw new Error(`Failed to fetch transaction statistics: ${error}`);
  }
};
// Get transactions by session ID with gaming mode support
export const getTransactionsBySessionId = async (sessionId: string) => {
  try {
    const receipts = await db('receipts')
      .select(
        'receipts.*',
        'receipts.manual_console_price',
        'receipts.calculated_console_price',
        'receipts.gaming_mode',
        'receipts.base_hourly_rate',
        'receipts.hourly_rate_2v2'
      )
      .where('session_id', sessionId)
      .orderBy('created_at', 'desc');

    if (receipts.length === 0) {
      return [];
    }

    const receiptIds = receipts.map(r => r.id);

    const items = await db('receipt_items')
      .leftJoin('products', 'receipt_items.product_id', 'products.id')
      .select(
        'receipt_items.*',
        'receipt_items.product_name as stored_product_name',
        'products.name as current_product_name',
        'products.category'
      )
      .whereIn('receipt_id', receiptIds);

    const session = await db('sessions')
      .join('consoles', 'sessions.console_id', 'consoles.id')
      .select(
        'sessions.*',
        'consoles.name as consoleName',
        'consoles.type as consoleType',
        'consoles.hourly_rate as baseHourlyRate',
        'consoles.hourly_rate_2v2 as hourlyRate2v2'
      )
      .where('sessions.id', sessionId)
      .first();

    return receipts.map(receipt => {
      const relatedItems = items.filter(item => item.receipt_id === receipt.id);
      
      const hasManualPrice = receipt.manual_console_price !== null && 
                            receipt.calculated_console_price !== null &&
                            parseFloat(receipt.manual_console_price) !== parseFloat(receipt.calculated_console_price);

      const calculatedCost = parseFloat(receipt.calculated_console_price || session?.final_cost || '0');
      const actualCost = receipt.manual_console_price ? parseFloat(receipt.manual_console_price) : calculatedCost;

      // Get gaming mode and rates
      const gamingMode = receipt.gaming_mode || session?.gaming_mode || '1v1';
      const baseRate = parseFloat(receipt.base_hourly_rate || session?.baseHourlyRate || '0');
      const rate2v2 = parseFloat(receipt.hourly_rate_2v2 || session?.hourlyRate2v2 || baseRate * 1.5);
      const usedRate = gamingMode === '2v2' ? rate2v2 : baseRate;

      return {
        id: receipt.id,
        sessionId: sessionId,
        timestamp: receipt.created_at,
        total: parseFloat(receipt.total),
        subtotal: parseFloat(receipt.subtotal),
        tax: parseFloat(receipt.tax || '0'),
        paymentMethod: receipt.payment_method,
        
        items: relatedItems.map(item => ({
          productName: item.stored_product_name || item.current_product_name,
          category: item.category,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price),
          subtotal: parseFloat(item.subtotal)
        })),
        
        consoleUsage: session ? {
          consoleName: session.consoleName,
          consoleType: session.consoleType,
          gamingMode: gamingMode,
          hourlyRate: usedRate, // Rate that was used
          baseHourlyRate: baseRate,
          hourlyRate2v2: rate2v2,
          usedHourlyRate: usedRate, // Add for compatibility
          calculatedCost: calculatedCost,
          actualCost: actualCost,
          discountGiven: hasManualPrice ? calculatedCost - actualCost : 0,
          hasManualPriceOverride: hasManualPrice
        } : null
      };
    });

  } catch (error) {
    console.error('Error in getTransactionsBySessionId:', error);
    throw new Error('Failed to fetch transactions for session');
  }
};

// Get recent transactions with enhanced details
export const getRecentTransactions = async (limit: number = 50) => {
  try {
    const transactions = await findAllTransactions();
    return transactions.slice(0, limit);
  } catch (error) {
    console.error('Error in getRecentTransactions:', error);
    throw new Error('Failed to fetch recent transactions');
  }
};

// Search transactions by various criteria including gaming mode
export const searchTransactions = async (searchTerm: string, filters?: {
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  gamingMode?: '1v1' | '2v2';
  hasDiscounts?: boolean;
  minAmount?: number;
  maxAmount?: number;
}) => {
  try {
    let query = db('receipts')
      .select(
        'receipts.*',
        'receipts.manual_console_price',
        'receipts.calculated_console_price',
        'receipts.gaming_mode',
        'receipts.base_hourly_rate',
        'receipts.hourly_rate_2v2'
      );

    // Apply date filters with fixed string comparison
    if (filters?.startDate) {
      const startStr = new Date(filters.startDate).toISOString();
      query = query.where('receipts.created_at', '>=', startStr);
    }
    if (filters?.endDate) {
      const endStr = new Date(filters.endDate).toISOString();
      query = query.where('receipts.created_at', '<=', endStr);
    }

    // Apply payment method filter
    if (filters?.paymentMethod) {
      query = query.where('receipts.payment_method', filters.paymentMethod);
    }

    // Apply gaming mode filter
    if (filters?.gamingMode) {
      query = query.where('receipts.gaming_mode', filters.gamingMode);
    }

    // Apply amount filters
    if (filters?.minAmount) {
      query = query.where('receipts.total', '>=', filters.minAmount);
    }
    if (filters?.maxAmount) {
      query = query.where('receipts.total', '<=', filters.maxAmount);
    }

    // Apply discount filter
    if (filters?.hasDiscounts === true) {
      query = query.whereNotNull('receipts.manual_console_price')
        .whereRaw('receipts.manual_console_price != receipts.calculated_console_price');
    } else if (filters?.hasDiscounts === false) {
      query = query.where(function() {
        this.whereNull('receipts.manual_console_price')
          .orWhereRaw('receipts.manual_console_price = receipts.calculated_console_price');
      });
    }

    const receipts = await query.orderBy('created_at', 'desc');

    // If there's a search term, filter by receipt ID or related data
    let filteredReceipts = receipts;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredReceipts = receipts.filter(receipt => 
        receipt.id.toLowerCase().includes(term) ||
        receipt.payment_method.toLowerCase().includes(term) ||
        (receipt.gaming_mode && receipt.gaming_mode.toLowerCase().includes(term))
      );
    }

    // Get related data for filtered receipts
    const receiptIds = filteredReceipts.map(r => r.id);
    
    const items = await db('receipt_items')
      .leftJoin('products', 'receipt_items.product_id', 'products.id')
      .select(
        'receipt_items.*',
        'receipt_items.product_name as stored_product_name',
        'products.name as current_product_name',
        'products.category'
      )
      .whereIn('receipt_id', receiptIds);

    const sessions = await db('sessions')
      .join('consoles', 'sessions.console_id', 'consoles.id')
      .select(
        'sessions.id',
        'sessions.gaming_mode',
        'sessions.final_cost',
        'consoles.name as consoleName',
        'consoles.hourly_rate as baseHourlyRate',
        'consoles.hourly_rate_2v2 as hourlyRate2v2'
      )
      .whereIn('sessions.id', filteredReceipts.map(r => r.session_id).filter(Boolean));

    return filteredReceipts.map(receipt => {
      const relatedItems = items.filter(item => item.receipt_id === receipt.id);
      const relatedSession = sessions.find(session => session.id === receipt.session_id);

      const hasManualPrice = receipt.manual_console_price !== null && 
                            receipt.calculated_console_price !== null &&
                            parseFloat(receipt.manual_console_price) !== parseFloat(receipt.calculated_console_price);

      // Get gaming mode and rates
      const gamingMode = receipt.gaming_mode || relatedSession?.gaming_mode || '1v1';
      const baseRate = parseFloat(receipt.base_hourly_rate || relatedSession?.baseHourlyRate || '0');
      const rate2v2 = parseFloat(receipt.hourly_rate_2v2 || relatedSession?.hourlyRate2v2 || baseRate * 1.5);
      const usedRate = gamingMode === '2v2' ? rate2v2 : baseRate;

      return {
        id: receipt.id,
        timestamp: receipt.created_at,
        total: parseFloat(receipt.total),
        paymentMethod: receipt.payment_method,
        gamingMode: gamingMode,
        hasDiscounts: hasManualPrice,
        discountAmount: hasManualPrice ? 
          parseFloat(receipt.calculated_console_price) - parseFloat(receipt.manual_console_price) : 0,
        
        items: relatedItems.map(item => ({
          productName: item.stored_product_name || item.current_product_name,
          category: item.category,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price)
        })),
        
        consoleUsage: relatedSession ? {
          consoleName: relatedSession.consoleName,
          gamingMode: gamingMode,
          hourlyRate: usedRate,
          baseHourlyRate: baseRate,
          hourlyRate2v2: rate2v2,
          usedHourlyRate: usedRate, // Add for compatibility
          calculatedCost: parseFloat(receipt.calculated_console_price || relatedSession.final_cost || '0'),
          actualCost: receipt.manual_console_price ? parseFloat(receipt.manual_console_price) : parseFloat(receipt.calculated_console_price || relatedSession.final_cost || '0'),
          hasManualPriceOverride: hasManualPrice
        } : null
      };
    });

  } catch (error) {
    console.error('Error in searchTransactions:', error);
    throw new Error('Failed to search transactions');
  }
};

// Get gaming mode statistics with fixed date filtering
export const getGamingModeStats = async (startDate?: string, endDate?: string) => {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    // Convert to ISO strings for SQLite TEXT comparison
    const startStr = start.toISOString();
    const endStr = end.toISOString();

    const gamingModeStats = await db('receipts')
      .select('gaming_mode')
      .count('* as sessions')
      .sum('calculated_console_price as total_revenue')
      .avg('calculated_console_price as avg_revenue')
      .where('created_at', '>=', startStr)
      .where('created_at', '<=', endStr)
      .whereNotNull('gaming_mode')
      .groupBy('gaming_mode');

    return {
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      gamingModes: gamingModeStats.map(stat => ({
        mode: stat.gaming_mode,
        sessions: Number(stat.sessions),
        totalRevenue: Number(stat.total_revenue || 0),
        averageRevenue: Number(stat.avg_revenue || 0)
      }))
    };
  } catch (error) {
    console.error('Error in getGamingModeStats:', error);
    throw new Error('Failed to fetch gaming mode statistics');
  }
};