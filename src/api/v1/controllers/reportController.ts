import { Request, Response, NextFunction } from 'express';
import * as reportService from '../../../services/reportService';


export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const stats = await reportService.getDashboardStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
};

export const getRevenueReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await reportService.getRevenueReport(
      startDate as string,
      endDate as string
    );
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching revenue report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue report'
    });
  }
};

export const getSessionReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await reportService.getSessionReport(
      startDate as string,
      endDate as string
    );
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching session report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session report'
    });
  }
};

export const getTopProducts = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;
    const products = await reportService.getTopProducts(Number(limit));
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top products'
    });
  }
};