import { Request, Response, NextFunction } from 'express';
import * as consoleService from '../../../services/consoleService';

// ...existing code...
export const getAllConsoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const consoles = await consoleService.findAllConsoles();
    res.json({
      success: true,
      data: consoles
    });
  } catch (error) {
    next(error);
  }
};
// ...existing code...

export const getConsoleById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const console = await consoleService.findConsoleById(id);
    
    if (!console) {
      return res.status(404).json({
        success: false,
        message: 'Console not found'
      });
    }
    
    res.json({
      success: true,
      data: console
    });
  } catch (error) {
    next(error);
  }
};

// Create console with support for 1v1 and 2v2 hourly rates
export const createConsole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const consoleData = req.body;

    // Validate required fields
    if (!consoleData.name || !consoleData.type) {
      return res.status(400).json({
        success: false,
        message: 'Name and type are required'
      });
    }

    // Accept both camelCase and snake_case
    const hourlyRateRaw = consoleData.hourlyRate ?? consoleData.hourly_rate;
    const hourlyRate2v2Raw = consoleData.hourlyRate2v2 ?? consoleData.hourly_rate_2v2;

    // Validate base hourly rate
    if (hourlyRateRaw === undefined || hourlyRateRaw === null || isNaN(parseFloat(hourlyRateRaw))) {
      return res.status(400).json({
        success: false,
        message: 'Valid hourly rate is required'
      });
    }

    const hourlyRate = parseFloat(hourlyRateRaw);
    const hourlyRate2v2 = hourlyRate2v2Raw !== undefined && hourlyRate2v2Raw !== null
      ? parseFloat(hourlyRate2v2Raw)
      : undefined; // service will default to 1.5x if not provided

    const created = await consoleService.createConsole({
      name: consoleData.name,
      type: consoleData.type,
      hourlyRate,
      hourlyRate2v2,
      // keep snake_case too for service mapping compatibility
      hourly_rate: hourlyRate,
      hourly_rate_2v2: hourlyRate2v2
    } as any);

    res.status(201).json({
      success: true,
      data: created
    });
  } catch (error) {
    next(error);
  }
};

// Update console; supports updating both 1v1 and 2v2 rates
export const updateConsole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Normalize rates to snake_case for DB layer, remove camelCase keys
    if (updateData.hourlyRate !== undefined && updateData.hourlyRate !== null) {
      updateData.hourly_rate = parseFloat(updateData.hourlyRate);
      delete updateData.hourlyRate;
    }
    if (updateData.hourlyRate2v2 !== undefined && updateData.hourlyRate2v2 !== null) {
      updateData.hourly_rate_2v2 = parseFloat(updateData.hourlyRate2v2);
      delete updateData.hourlyRate2v2;
    }

    const console = await consoleService.updateConsole(id, updateData);
    
    if (!console) {
      return res.status(404).json({
        success: false,
        message: 'Console not found'
      });
    }
    
    res.json({
      success: true,
      data: console
    });
  } catch (error) {
    next(error);
  }
};

export const deleteConsole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = await consoleService.deleteConsole(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Console not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Console deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// NEW: Update only rates for a console
export const updateConsoleRates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { hourlyRate, hourlyRate2v2 } = req.body;

    const updated = await consoleService.updateConsoleRates(id, {
      hourlyRate: hourlyRate !== undefined ? parseFloat(hourlyRate) : undefined,
      hourlyRate2v2: hourlyRate2v2 !== undefined ? parseFloat(hourlyRate2v2) : undefined,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Console not found'
      });
    }

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

// NEW: Get available consoles for a specific gaming mode
export const getAvailableConsolesForMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mode = (req.query.mode as '1v1' | '2v2') || '1v1';
    if (!['1v1', '2v2'].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: 'mode must be "1v1" or "2v2"'
      });
    }

    const consoles = await consoleService.getAvailableConsolesForMode(mode);
    res.json({
      success: true,
      data: consoles
    });
  } catch (error) {
    next(error);
  }
};

// NEW: Get stats for a console with gaming mode breakdown
export const getConsoleStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const stats = await consoleService.getConsoleStats(id);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};