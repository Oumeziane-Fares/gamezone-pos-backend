import { Request, Response, NextFunction } from 'express';
import * as sessionService from '../../../services/sessionService';

// Create session with optional gamingMode (defaults to 1v1)
export const createSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { consoleId, gamingMode } = req.body;
    if (!consoleId) {
      return res.status(400).json({ 
        success: false,
        message: 'consoleId is required' 
      });
    }

    let mode: '1v1' | '2v2' = '1v1';
    if (gamingMode !== undefined) {
      if (!['1v1', '2v2'].includes(gamingMode)) {
        return res.status(400).json({
          success: false,
          message: 'gamingMode must be "1v1" or "2v2"'
        });
      }
      mode = gamingMode;
    }
    
    const session = await sessionService.startSession(consoleId, mode);
    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

export const pauseSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        message: 'Session ID is required' 
      });
    }

    const session = await sessionService.pauseSession(sessionId);
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

export const resumeSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        message: 'Session ID is required' 
      });
    }

    const session = await sessionService.resumeSession(sessionId);
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

export const endSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        message: 'Session ID is required' 
      });
    }

    const session = await sessionService.endSession(sessionId);
    
    res.status(200).json({
      success: true,
      data: {
        ...session,
        id: sessionId,
        message: 'Session ended successfully'
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await sessionService.getActiveSessions();
    res.status(200).json({
      success: true,
      data: sessions
    });
  } catch (error) {
    next(error);
  }
};

export const getSessionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        message: 'Session ID is required' 
      });
    }

    const session = await sessionService.findSessionDetailsById(sessionId);
    if (!session) {
      return res.status(404).json({ 
        success: false,
        message: 'Session not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// NEW: Update gaming mode for an active session
export const updateGamingMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const { gamingMode } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    if (!['1v1', '2v2'].includes(gamingMode)) {
      return res.status(400).json({
        success: false,
        message: 'gamingMode must be "1v1" or "2v2"'
      });
    }

    const session = await sessionService.updateSessionGamingMode(sessionId, gamingMode);
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// NEW: Get a live cost preview for a session (shows both 1v1 and 2v2)
export const getSessionCostPreview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const preview = await sessionService.getSessionCostPreview(sessionId);
    res.status(200).json({
      success: true,
      data: preview
    });
  } catch (error) {
    next(error);
  }
};

export const addItemToSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: sessionId } = req.params;
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'productId and quantity are required'
      });
    }

    const newItem = await sessionService.addItemToSession(sessionId, productId, quantity);
    
    res.status(201).json({
      success: true,
      data: newItem
    });
  } catch (error) {
    next(error);
  }
};