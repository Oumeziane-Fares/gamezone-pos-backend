import db from '../db/knex';
import { Console, Session } from '../types';
import { ulid } from 'ulid';
import { getHourlyRateForMode } from './consoleService';

// Helper function to convert a DB result to a Session object with gaming mode support
const toCamelCase = (session: any): Session => {
  if (!session) return session;
  
  const gamingMode = session.gaming_mode || '1v1';
  const baseRate = parseFloat(session.hourlyRate || session.hourly_rate || '0');
  // Fix: Use same rate for 2v2 as requested (not 1.5x)
  const rate2v2 = parseFloat(session.hourly_rate_2v2 || baseRate);
  
  // Convert session items to proper format
  const inventoryItems = (session.items || []).map((item: any) => ({
    id: item.id,
    productId: item.product_id,
    productName: item.productName || item.product_name,
    productDescription: item.productDescription || item.product_description,
    productCategory: item.productCategory || item.product_category,
    quantity: item.quantity,
    unitPrice: parseFloat(item.unit_price || '0'),
    subtotal: parseFloat(item.subtotal || '0'),
    addedAt: item.created_at
  }));
  
  return {
    id: session.id,
    consoleId: session.console_id,
    startTime: session.start_time,
    endTime: session.end_time,
    status: session.status,
    gamingMode: gamingMode,
    totalPausedDuration: session.total_paused_duration,
    finalCost: session.final_cost,
    pausedAt: session.paused_at,
    consoleName: session.consoleName || session.console_name,
    consoleType: session.consoleType || session.console_type,
    hourlyRate: gamingMode === '2v2' ? rate2v2 : baseRate,
    baseHourlyRate: baseRate,
    hourlyRate2v2: rate2v2,
    games: [], // Legacy field, kept for compatibility
    inventoryItems: inventoryItems, // Now includes actual session items
  };
};

// Helper to find a single session by its ID with joined data including gaming mode
const findSessionById = async (id: string, trx?: import('knex').Knex.Transaction) => {
    const queryBuilder = trx || db;
    const session = await queryBuilder('sessions')
        .where('sessions.id', id)
        .join('consoles', 'sessions.console_id', 'consoles.id')
        .select(
            'sessions.*',
            'consoles.name as consoleName',
            'consoles.type as consoleType',
            'consoles.hourly_rate',
            'consoles.hourly_rate_2v2'
        )
        .first();

    if (!session) return null;

    // Fetch session items separately to avoid complex joins
    const items = await queryBuilder('session_items')
        .where('session_items.session_id', id)
        .join('products', 'session_items.product_id', 'products.id')
        .select(
            'session_items.*',
            'products.name as productName',
            'products.description as productDescription',
            'products.category as productCategory'
        )
        .orderBy('session_items.created_at', 'asc');

    return {
        ...session,
        items: items || []
    };
};


export const findActiveSessions = async (): Promise<Session[]> => {
  const sessions = await db('sessions')
    .join('consoles', 'sessions.console_id', 'consoles.id')
    .select(
      'sessions.*',
      'consoles.name as consoleName',
      'consoles.type as consoleType',
      'consoles.hourly_rate',
      'consoles.hourly_rate_2v2'
    )
    .whereIn('sessions.status', ['active', 'paused'])
    .orderBy('sessions.start_time', 'asc');
  
  return sessions.map(toCamelCase);
};

export const findSessionDetailsById = async (id: string): Promise<Session | null> => {
  const session = await findSessionById(id);
  if (!session) return null;
  return toCamelCase(session);
};

// Updated to include gaming mode when starting a session
export const startSession = async (consoleId: string, gamingMode: '1v1' | '2v2' = '1v1'): Promise<Session> => {
  return db.transaction(async (trx) => {
  const selectedConsole = await trx('consoles').where({ id: consoleId }).forUpdate().first();
if (!selectedConsole || selectedConsole.status !== 'available') {
    throw new Error('Console is not available.');
}


    // Validate that console supports the requested gaming mode
    const baseRate = parseFloat(selectedConsole.hourly_rate || '0');
    const rate2v2 = parseFloat(selectedConsole.hourly_rate_2v2 || '0');
    
    if (gamingMode === '2v2' && rate2v2 <= 0) {
      throw new Error('This console does not support 2v2 mode or has no 2v2 rate configured.');
    }

    if (baseRate <= 0) {
      throw new Error('Console has no valid hourly rate configured.');
    }

    console.log(`Starting ${gamingMode} session on console ${selectedConsole.name}`, {
      baseRate,
      rate2v2,
      selectedMode: gamingMode
    });

    await trx('consoles').where({ id: consoleId }).update({ status: 'in-use' });
    
    const newSessionData = {
      id: `ses_${ulid()}`,
      console_id: consoleId,
      start_time: new Date(),
      status: 'active' as const,
      gaming_mode: gamingMode, // NEW: Store gaming mode
    };
    
    const [inserted] = await trx('sessions').insert(newSessionData).returning('id');
    const newSession = await findSessionById(inserted.id, trx);
    
    const result = toCamelCase(newSession);
    
    
    return result;
  });
};

export const pauseSession = async (sessionId: string): Promise<Session> => {
  await db('sessions')
    .where({ id: sessionId, status: 'active' })
    .update({ status: 'paused', paused_at: new Date() });
    
  const updatedSession = await findSessionById(sessionId);
  if (!updatedSession) throw new Error('Active session not found or already paused.');
  
  console.log(`Paused session: ${sessionId} (${updatedSession.gaming_mode} mode)`);
  return toCamelCase(updatedSession);
};

export const resumeSession = async (sessionId: string): Promise<Session> => {
  const session = await db('sessions').where({ id: sessionId, status: 'paused' }).first();

  if (!session || !session.paused_at) {
    throw new Error('Paused session not found.');
  }

  const pausedDuration = new Date().getTime() - new Date(session.paused_at).getTime();
  const newTotalPausedDuration = (session.total_paused_duration || 0) + pausedDuration;

  await db('sessions')
    .where({ id: sessionId })
    .update({
      status: 'active',
      paused_at: null,
      total_paused_duration: newTotalPausedDuration,
    });
    
  const updatedSession = await findSessionById(sessionId);
  
  console.log(`Resumed session: ${sessionId} (${updatedSession?.gaming_mode} mode)`);
  return toCamelCase(updatedSession);
};

// Updated endSession with gaming mode-aware cost calculation
export const endSession = async (sessionId: string): Promise<Session> => {
    return db.transaction(async (trx) => {
        const session = await trx('sessions').where({ id: sessionId }).forUpdate().first();

        if (!session || session.status === 'ended') {
            throw new Error('Session not found or already ended.');
        }

        const selectedConsole = await trx('consoles').where({ id: session.console_id }).first();
        if (!selectedConsole) {
            throw new Error('Associated console not found.');
        }

        const endTime = new Date();
        const activeDuration = endTime.getTime() - new Date(session.start_time).getTime();
        
        let totalPausedMs = session.total_paused_duration || 0;

        if (session.status === 'paused' && session.paused_at) {
            totalPausedMs += endTime.getTime() - new Date(session.paused_at).getTime();
        }

        const finalActiveMs = activeDuration - totalPausedMs;
        const durationHours = Math.max(0, finalActiveMs) / (1000 * 60 * 60);

        // Calculate cost based on gaming mode
        const gamingMode = session.gaming_mode || '1v1';
        const baseRate = parseFloat(selectedConsole.hourly_rate || '0');
        // Fix: Default 2v2 to same as base rate
        const rate2v2 = parseFloat(selectedConsole.hourly_rate_2v2 || baseRate);
        const usedRate = gamingMode === '2v2' ? rate2v2 : baseRate;

        const finalCost = durationHours * usedRate;

        const [endedSessionData] = await trx('sessions')
            .where({ id: sessionId })
            .update({
                status: 'ended',
                end_time: endTime,
                final_cost: finalCost.toFixed(2),
                paused_at: null,
                total_paused_duration: totalPausedMs,
            })
            .returning('*');

        await trx('consoles').where({ id: session.console_id }).update({ status: 'available' });

        // Get the complete session with items using our updated helper
        const updatedSession = await findSessionById(sessionId, trx);
        
        console.log(`Session ${sessionId} ended. Items count: ${updatedSession?.items?.length || 0}`);
        
        return toCamelCase(updatedSession);
    });
};

export const getActiveSessions = async (): Promise<Session[]> => {
  try {
    const sessions = await db('sessions')
      .join('consoles', 'sessions.console_id', 'consoles.id')
      .select(
        'sessions.*',
        'consoles.name as consoleName',
        'consoles.type as consoleType',
        'consoles.hourly_rate',
        'consoles.hourly_rate_2v2'
      )
      .whereIn('sessions.status', ['active', 'paused'])
      .orderBy('sessions.start_time', 'desc');

    return sessions.map(toCamelCase);
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    throw error;
  }
};

// NEW: Update gaming mode for an active session (if allowed)
export const updateSessionGamingMode = async (sessionId: string, gamingMode: '1v1' | '2v2'): Promise<Session> => {
  return db.transaction(async (trx) => {
    const session = await trx('sessions')
      .join('consoles', 'sessions.console_id', 'consoles.id')
      .where('sessions.id', sessionId)
      .select('sessions.*', 'consoles.hourly_rate', 'consoles.hourly_rate_2v2')
      .first();

    if (!session) {
      throw new Error('Session not found.');
    }

    if (session.status === 'ended') {
      throw new Error('Cannot change gaming mode for an ended session.');
    }

    // Validate that console supports the new gaming mode
    const baseRate = parseFloat(session.hourly_rate || '0');
    const rate2v2 = parseFloat(session.hourly_rate_2v2 || '0');
    
    if (gamingMode === '2v2' && rate2v2 <= 0) {
      throw new Error('This console does not support 2v2 mode.');
    }

    await trx('sessions')
      .where({ id: sessionId })
      .update({ gaming_mode: gamingMode });

    console.log(`Updated session ${sessionId} gaming mode to: ${gamingMode}`);

    const updatedSession = await findSessionById(sessionId, trx);
    return toCamelCase(updatedSession);
  });
};

// NEW: Get session statistics by gaming mode
export const getSessionStatsByGamingMode = async (startDate?: string, endDate?: string) => {
  try {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await db('sessions')
      .select('gaming_mode')
      .count('* as session_count')
      .sum('final_cost as total_revenue')
      .avg('final_cost as avg_revenue')
      .whereBetween('start_time', [start, end])
      .where('status', 'ended')
      .groupBy('gaming_mode');

    return {
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      gamingModes: stats.map(stat => ({
        mode: stat.gaming_mode || '1v1',
        sessionCount: Number(stat.session_count),
        totalRevenue: Number(stat.total_revenue || 0),
        averageRevenue: Number(stat.avg_revenue || 0)
      }))
    };
  } catch (error) {
    console.error('Error fetching session stats by gaming mode:', error);
    throw error;
  }
};

// NEW: Get current session cost preview
export const getSessionCostPreview = async (sessionId: string): Promise<{
  currentCost1v1: number;
  currentCost2v2: number;
  duration: number;
  rates: {
    base: number;
    rate2v2: number;
  };
}> => {
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

    if (session.status === 'ended') {
      throw new Error('Session has already ended');
    }

    // Calculate current duration
    const currentTime = new Date();
    const startTime = new Date(session.start_time);
    let totalDurationMs = currentTime.getTime() - startTime.getTime();
    
    // Account for paused time
    const totalPausedMs = session.total_paused_duration || 0;
    if (session.status === 'paused' && session.paused_at) {
      // Don't add current pause time to duration
      totalDurationMs = new Date(session.paused_at).getTime() - startTime.getTime();
    }
    
    const activeDurationMs = Math.max(0, totalDurationMs - totalPausedMs);
    const durationHours = activeDurationMs / (1000 * 60 * 60);

    // Calculate costs for both modes
    const baseRate = parseFloat(session.hourly_rate || '0');
    const rate2v2 = parseFloat(session.hourly_rate_2v2 || baseRate * 1.5);
    
    const currentCost1v1 = durationHours * baseRate;
    const currentCost2v2 = durationHours * rate2v2;

    return {
      currentCost1v1: parseFloat(currentCost1v1.toFixed(2)),
      currentCost2v2: parseFloat(currentCost2v2.toFixed(2)),
      duration: Math.round(activeDurationMs / 60000), // Duration in minutes
      rates: {
        base: baseRate,
        rate2v2: rate2v2
      }
    };
  } catch (error) {
    console.error('Error getting session cost preview:', error);
    throw error;
  }
};

export const addItemToSession = async (sessionId: string, productId: string, quantity: number) => {
  return db.transaction(async (trx) => {
    // 1. Validate the session and product
    const session = await trx('sessions').where({ id: sessionId }).first();
    if (!session || session.status === 'ended') {
      throw new Error('Session is not active or not found.');
    }

    const product = await trx('products').where({ id: productId }).first();
    if (!product) {
      throw new Error('Product not found.');
    }
    if (product.stock < quantity) {
      throw new Error(`Not enough stock for ${product.name}.`);
    }

    // 2. Decrement product stock
    await trx('products').where({ id: productId }).decrement('stock', quantity);

    // 3. Add the item to the session_items table (the "running tab")
    const itemSubtotal = parseFloat(product.price) * quantity;
    const [newItem] = await trx('session_items')
      .insert({
        session_id: sessionId,
        product_id: productId,
        quantity: quantity,
        unit_price: parseFloat(product.price), // Store price at time of sale
        subtotal: itemSubtotal,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    console.log(`Added item to session ${sessionId}: ${product.name} x${quantity}`);

    return {
      id: newItem.id,
      productId: productId,
      productName: product.name,
      quantity: quantity,
      unitPrice: parseFloat(product.price),
      subtotal: itemSubtotal,
      addedAt: newItem.created_at
    };
  });
};

// NEW: Get session items with product details
export const getSessionItems = async (sessionId: string) => {
  try {
    const items = await db('session_items')
      .where('session_items.session_id', sessionId)
      .join('products', 'session_items.product_id', 'products.id')
      .select(
        'session_items.id',
        'session_items.product_id as productId',
        'session_items.quantity',
        'session_items.unit_price as unitPrice',
        'session_items.subtotal',
        'session_items.created_at as addedAt',
        'products.name as productName',
        'products.description as productDescription',
        'products.category as productCategory'
      )
      .orderBy('session_items.created_at', 'asc');

    return items.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productDescription: item.productDescription,
      productCategory: item.productCategory,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice || '0'),
      subtotal: parseFloat(item.subtotal || '0'),
      addedAt: item.addedAt
    }));
  } catch (error) {
    console.error('Error fetching session items:', error);
    throw error;
  }
};