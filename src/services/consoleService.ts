import db from '../db/knex';
import { Console } from '../types';
import { ulid } from 'ulid';

// Helper function to convert frontend Console object to database format
const toDatabaseFormat = (console: Partial<Console>) => {
  const dbConsole: any = {};
  
  // Map all fields, prioritizing snake_case for database
  if (console.id) dbConsole.id = console.id;
  if (console.name) dbConsole.name = console.name;
  if (console.type) dbConsole.type = console.type;
  if (console.status) dbConsole.status = console.status;
  
  // Handle 1v1 hourly rate - use the database column name
  if (console.hourlyRate !== undefined) {
    dbConsole.hourly_rate = console.hourlyRate;
  } else if (console.hourly_rate !== undefined) {
    dbConsole.hourly_rate = console.hourly_rate;
  }
  
  // Handle 2v2 hourly rate - NEW
  if (console.hourlyRate2v2 !== undefined) {
    dbConsole.hourly_rate_2v2 = console.hourlyRate2v2;
  } else if (console.hourly_rate_2v2 !== undefined) {
    dbConsole.hourly_rate_2v2 = console.hourly_rate_2v2;
  }
  
  // Handle timestamps
  if (console.createdAt) dbConsole.created_at = console.createdAt;
  if (console.updatedAt) dbConsole.updated_at = console.updatedAt;
  if (console.created_at) dbConsole.created_at = console.created_at;
  if (console.updated_at) dbConsole.updated_at = console.updated_at;
  
  return dbConsole;
};

// Helper function to convert database result to frontend format
const toFrontendFormat = (dbConsole: any): Console => {
  return {
    id: dbConsole.id,
    name: dbConsole.name,
    type: dbConsole.type,
    status: dbConsole.status,
    hourlyRate: parseFloat(dbConsole.hourly_rate || 0),
    hourlyRate2v2: parseFloat(dbConsole.hourly_rate_2v2 || 0),
    // Keep both formats for compatibility
    hourly_rate: parseFloat(dbConsole.hourly_rate || 0),
    hourly_rate_2v2: parseFloat(dbConsole.hourly_rate_2v2 || 0),
    createdAt: dbConsole.created_at,
    updatedAt: dbConsole.updated_at,
    created_at: dbConsole.created_at,
    updated_at: dbConsole.updated_at,
  };
};

// Helper function to get the correct hourly rate based on gaming mode
export const getHourlyRateForMode = (console: Console, gamingMode: '1v1' | '2v2'): number => {
  return gamingMode === '2v2' ? console.hourlyRate2v2 : console.hourlyRate;
};

// Helper function to validate console data
const validateConsoleData = (consoleData: Partial<Console>) => {
  const errors: string[] = [];
  
  if (consoleData.name && consoleData.name.trim().length === 0) {
    errors.push('Console name cannot be empty');
  }
  
  if (consoleData.hourlyRate !== undefined && consoleData.hourlyRate < 0) {
    errors.push('1v1 hourly rate cannot be negative');
  }
  
  if (consoleData.hourlyRate2v2 !== undefined && consoleData.hourlyRate2v2 < 0) {
    errors.push('2v2 hourly rate cannot be negative');
  }
  
  if (consoleData.type && !['PS4', 'PS5'].includes(consoleData.type)) {
    errors.push('Console type must be PS4 or PS5');
  }
  
  if (consoleData.status && !['available', 'in-use', 'maintenance', 'reserved'].includes(consoleData.status)) {
    errors.push('Invalid console status');
  }
  
  return errors;
};

export const findAllConsoles = async (): Promise<Console[]> => {
  try {
    const consoles = await db('consoles')
      .select('*')
      .orderBy('name');
    
    console.log(`Found ${consoles.length} consoles`);
    return consoles.map(toFrontendFormat);
  } catch (error) {
    console.error('Error fetching consoles:', error);
    throw new Error('Failed to fetch consoles');
  }
};

export const findConsoleById = async (id: string): Promise<Console | undefined> => {
  try {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid console ID is required');
    }
    
    const consoleRecord  = await db('consoles').where({ id }).first();
    console.log(`Console ${id} ${consoleRecord  ? 'found' : 'not found'}`);
    
    return consoleRecord  ? toFrontendFormat(consoleRecord ) : undefined;
  } catch (error) {
    console.error('Error fetching console by ID:', error);
    throw error;
  }
};

export const createConsole = async (consoleData: Omit<Console, 'id' | 'status'>): Promise<Console> => {
  try {
    // Validate input data
    const errors = validateConsoleData(consoleData);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    const dbFormat = toDatabaseFormat({
      ...consoleData,
      status: 'available' as const,
    });
    
    // Set default 2v2 rate if not provided (1.5x the 1v1 rate)
    if (!dbFormat.hourly_rate_2v2 && dbFormat.hourly_rate) {
      dbFormat.hourly_rate_2v2 = parseFloat((dbFormat.hourly_rate * 1.5).toFixed(2));
    }
    
    const newConsole = {
      id: `con_${ulid()}`,
      ...dbFormat,
      status: 'available',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    console.log('Creating console:', {
      id: newConsole.id,
      name: newConsole.name,
      type: newConsole.type,
      hourly_rate: newConsole.hourly_rate,
      hourly_rate_2v2: newConsole.hourly_rate_2v2
    });
    
    const [result] = await db('consoles').insert(newConsole).returning('*');
    
    console.log(`Console created successfully: ${result.id}`);
    return toFrontendFormat(result);
  } catch (error) {
    console.error('Error creating console:', error);
    throw error;
  }
};

export const updateConsole = async (id: string, consoleData: Partial<Omit<Console, 'id'>>): Promise<Console | undefined> => {
  try {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid console ID is required');
    }
    
    // Validate input data
    const errors = validateConsoleData(consoleData);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    // Check if console exists
    const existingConsole = await findConsoleById(id);
    if (!existingConsole) {
      throw new Error(`Console with ID ${id} not found`);
    }
    
    // Convert to database format, excluding fields that shouldn't change during update
    const dbFormat = toDatabaseFormat(consoleData);
    
    // Remove fields that shouldn't be updated
    delete dbFormat.id;
    delete dbFormat.created_at;
    
    // Always update the updated_at timestamp
    dbFormat.updated_at = new Date().toISOString();
    
    console.log('Updating console:', {
      id,
      updates: dbFormat
    });
    
    const [updatedConsole] = await db('consoles')
      .where({ id })
      .update(dbFormat)
      .returning('*');
    
    if (updatedConsole) {
      console.log(`Console updated successfully: ${id}`);
      return toFrontendFormat(updatedConsole);
    } else {
      console.log(`No console found to update: ${id}`);
      return undefined;
    }
  } catch (error) {
    console.error('Error updating console:', error);
    throw error;
  }
};

export const deleteConsole = async (id: string): Promise<boolean> => {
  try {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid console ID is required');
    }
    
    // Check if console exists
    const existingConsole = await findConsoleById(id);
    if (!existingConsole) {
      throw new Error(`Console with ID ${id} not found`);
    }
    
    // Check if console is currently in use
    if (existingConsole.status === 'in-use') {
      throw new Error('Cannot delete console that is currently in use');
    }
    
    console.log(`Deleting console: ${id}`);
    
    const deletedCount = await db('consoles').where({ id }).del();
    const success = deletedCount > 0;
    
    console.log(`Console ${id} ${success ? 'deleted' : 'not found for deletion'}`);
    return success;
  } catch (error) {
    console.error('Error deleting console:', error);
    throw error;
  }
};

export const updateConsoleStatus = async (id: string, status: string): Promise<Console | undefined> => {
  try {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid console ID is required');
    }
    
    if (!['available', 'in-use', 'maintenance', 'reserved'].includes(status)) {
      throw new Error('Invalid console status');
    }
    
    // Check if console exists
    const existingConsole = await findConsoleById(id);
    if (!existingConsole) {
      throw new Error(`Console with ID ${id} not found`);
    }
    
    console.log(`Updating console status: ${id} -> ${status}`);
    
    const [updatedConsole] = await db('consoles')
      .where({ id })
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .returning('*');
    
    if (updatedConsole) {
      console.log(`Console status updated: ${id} -> ${status}`);
      return toFrontendFormat(updatedConsole);
    } else {
      console.log(`Console not found for status update: ${id}`);
      return undefined;
    }
  } catch (error) {
    console.error('Error updating console status:', error);
    throw error;
  }
};

// NEW: Get all available consoles for a specific gaming mode
export const getAvailableConsolesForMode = async (gamingMode: '1v1' | '2v2'): Promise<Console[]> => {
  try {
    const consoles = await db('consoles')
      .where({ status: 'available' })
      .select('*')
      .orderBy('name');
    
    const availableConsoles = consoles
      .map(toFrontendFormat)
      .filter(console => {
        // Check if console supports the requested gaming mode (has a rate > 0)
        const rate = getHourlyRateForMode(console, gamingMode);
        return rate > 0;
      });
    
    console.log(`Found ${availableConsoles.length} available consoles for ${gamingMode} mode`);
    return availableConsoles;
  } catch (error) {
    console.error('Error fetching available consoles for mode:', error);
    throw new Error('Failed to fetch available consoles');
  }
};

// NEW: Update both hourly rates for a console
export const updateConsoleRates = async (
  id: string, 
  rates: { hourlyRate?: number; hourlyRate2v2?: number }
): Promise<Console | undefined> => {
  try {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid console ID is required');
    }
    
    if (rates.hourlyRate !== undefined && rates.hourlyRate < 0) {
      throw new Error('1v1 hourly rate cannot be negative');
    }
    
    if (rates.hourlyRate2v2 !== undefined && rates.hourlyRate2v2 < 0) {
      throw new Error('2v2 hourly rate cannot be negative');
    }
    
    const updateData: any = { updated_at: new Date().toISOString() };
    
    if (rates.hourlyRate !== undefined) {
      updateData.hourly_rate = rates.hourlyRate;
    }
    
    if (rates.hourlyRate2v2 !== undefined) {
      updateData.hourly_rate_2v2 = rates.hourlyRate2v2;
    }
    
    console.log(`Updating console rates: ${id}`, rates);
    
    const [updatedConsole] = await db('consoles')
      .where({ id })
      .update(updateData)
      .returning('*');
    
    if (updatedConsole) {
      console.log(`Console rates updated: ${id}`);
      return toFrontendFormat(updatedConsole);
    } else {
      console.log(`Console not found for rate update: ${id}`);
      return undefined;
    }
  } catch (error) {
    console.error('Error updating console rates:', error);
    throw error;
  }
};

// NEW: Get console statistics including gaming mode usage
export const getConsoleStats = async (id: string) => {
  try {
    const console = await findConsoleById(id);
    if (!console) {
      throw new Error(`Console with ID ${id} not found`);
    }
    
    // Get session statistics for this console
    const sessionStats = await db('sessions')
      .where({ console_id: id })
      .select('gaming_mode')
      .count('* as total')
      .sum('final_cost as revenue')
      .avg('final_cost as avg_cost')
      .groupBy('gaming_mode');
    
    // Get total sessions
    const totalSessions = await db('sessions')
      .where({ console_id: id })
      .count('* as total')
      .first();
    
    return {
      console,
      stats: {
        totalSessions: parseInt(String(totalSessions?.total || '0')),
        gamingModeBreakdown: sessionStats.map(stat => ({
          gamingMode: stat.gaming_mode,
          sessions: parseInt(String(stat.total || '0')),
          revenue: parseFloat(String(stat.revenue || '0')),
          averageCost: parseFloat(String(stat.avg_cost || '0'))
        }))
      }
    };
  } catch (error) {
    console.error('Error fetching console stats:', error);
    throw error;
  }
};