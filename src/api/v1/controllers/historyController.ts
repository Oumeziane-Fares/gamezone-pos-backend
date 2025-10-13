import { Request, Response, NextFunction } from 'express';
import * as historyService from '../../../services/historyService';

/**
 * GET /api/v1/history
 * Get all transaction history with enhanced details
 */
export const getTransactionHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Fetching transaction history...');
    
    const transactions = await historyService.findAllTransactions();
    
    // Calculate some summary stats for the response
    const totalTransactions = transactions.length;
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.total, 0);
    const transactionsWithDiscounts = transactions.filter(tx => tx.summary.hasDiscounts).length;
    const totalDiscounts = transactions.reduce((sum, tx) => sum + tx.summary.totalDiscount, 0);
    
    console.log(`Successfully fetched ${totalTransactions} transactions`);
    
    res.status(200).json({
      success: true,
      data: transactions,
      meta: {
        total: totalTransactions,
        totalRevenue: totalRevenue,
        transactionsWithDiscounts: transactionsWithDiscounts,
        totalDiscountsGiven: totalDiscounts,
        discountPercentage: totalTransactions > 0 ? (transactionsWithDiscounts / totalTransactions) * 100 : 0
      }
    });
  } catch (error) {
    console.error('Error in getTransactionHistory:', error);
    
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
    
    next(error);
  }
};

/**
 * GET /api/v1/history/stats
 * Get transaction statistics for a specific period
 */
export const getTransactionStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    
    console.log('Fetching transaction stats:', { startDate, endDate });
    
    // Validate date parameters if provided
    if (startDate && isNaN(Date.parse(startDate as string))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startDate format. Please use ISO 8601 format.'
      });
    }
    
    if (endDate && isNaN(Date.parse(endDate as string))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid endDate format. Please use ISO 8601 format.'
      });
    }
    
    const stats = await historyService.getTransactionStats(
      startDate as string,
      endDate as string
    );
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error in getTransactionStats:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
    
    next(error);
  }
};

/**
 * GET /api/v1/history/session/:sessionId
 * Get all transactions for a specific session
 */
export const getTransactionsBySession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    console.log('Fetching transactions for session:', sessionId);
    
    const transactions = await historyService.getTransactionsBySessionId(sessionId);
    
    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No transactions found for this session',
        data: []
      });
    }
    
    console.log(`Found ${transactions.length} transactions for session ${sessionId}`);
    
    res.status(200).json({
      success: true,
      data: transactions,
      meta: {
        sessionId,
        count: transactions.length,
        totalAmount: transactions.reduce((sum, tx) => sum + tx.total, 0)
      }
    });
  } catch (error) {
    console.error('Error in getTransactionsBySession:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
    
    next(error);
  }
};

/**
 * GET /api/v1/history/search
 * Search transactions with advanced filters
 */
export const searchTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      searchTerm = '', 
      startDate, 
      endDate, 
      paymentMethod, 
      hasDiscounts, 
      minAmount, 
      maxAmount 
    } = req.query;
    
    console.log('Searching transactions with filters:', req.query);
    
    // Validate date parameters
    if (startDate && isNaN(Date.parse(startDate as string))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startDate format. Please use ISO 8601 format.'
      });
    }
    
    if (endDate && isNaN(Date.parse(endDate as string))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid endDate format. Please use ISO 8601 format.'
      });
    }
    
    // Validate amount parameters
    if (minAmount && (isNaN(Number(minAmount)) || Number(minAmount) < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid minAmount. Must be a positive number.'
      });
    }
    
    if (maxAmount && (isNaN(Number(maxAmount)) || Number(maxAmount) < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid maxAmount. Must be a positive number.'
      });
    }
    
    if (minAmount && maxAmount && Number(minAmount) > Number(maxAmount)) {
      return res.status(400).json({
        success: false,
        message: 'minAmount cannot be greater than maxAmount.'
      });
    }
    
    // Build filters object
    const filters = {
      startDate: startDate as string,
      endDate: endDate as string,
      paymentMethod: paymentMethod as string,
      hasDiscounts: hasDiscounts === 'true' ? true : hasDiscounts === 'false' ? false : undefined,
      minAmount: minAmount ? parseFloat(minAmount as string) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount as string) : undefined
    };
    
    const transactions = await historyService.searchTransactions(
      searchTerm as string, 
      filters
    );
    
    console.log(`Found ${transactions.length} transactions matching search criteria`);
    
    // Calculate search result statistics
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.total, 0);
    const transactionsWithDiscounts = transactions.filter(tx => tx.hasDiscounts).length;
    const totalDiscounts = transactions.reduce((sum, tx) => sum + tx.discountAmount, 0);
    
    res.status(200).json({
      success: true,
      data: transactions,
      meta: {
        searchTerm: searchTerm as string,
        filters,
        results: {
          count: transactions.length,
          totalAmount,
          transactionsWithDiscounts,
          totalDiscounts,
          discountPercentage: transactions.length > 0 ? (transactionsWithDiscounts / transactions.length) * 100 : 0
        }
      }
    });
  } catch (error) {
    console.error('Error in searchTransactions:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
    
    next(error);
  }
};

/**
 * GET /api/v1/history/recent
 * Get recent transactions with enhanced details (optional endpoint)
 */
export const getRecentTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (limit < 1 || limit > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 1000'
      });
    }
    
    console.log(`Fetching ${limit} recent transactions...`);
    
    const transactions = await historyService.getRecentTransactions(limit);
    
    console.log(`Successfully fetched ${transactions.length} recent transactions`);
    
    res.status(200).json({
      success: true,
      data: transactions,
      meta: {
        limit,
        count: transactions.length
      }
    });
  } catch (error) {
    console.error('Error in getRecentTransactions:', error);
    
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
    
    next(error);
  }
};