import db from '../db/knex';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

interface DashboardStats {
  totalRevenue: number;
  todayRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  totalSessions: number;
  todaySessions: number;
  averageSessionTime: number;
  revenueGrowth: number;
  sessionGrowth: number;
  priceOverrideStats: {
    totalOverrides: number;
    totalDiscountGiven: number;
    averageDiscount: number;
  };
  topConsoles: Array<{
    name: string;
    sessions: number;
    revenue: number;
    calculatedRevenue: number;
    discountGiven: number;
  }>;
  peakHours: Array<{
    hour: number;
    sessions: number;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
    amount?: number;
    originalAmount?: number;
    discount?: number;
  }>;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = startOfDay(subDays(now, 1));
  const weekAgo = subDays(now, 7);
  const monthAgo = subDays(now, 30);

  try {
    console.log('Fetching dashboard stats...');

    // Get comprehensive revenue data from receipts with manual price tracking
    let totalRevenue = 0;
    let todayRevenue = 0;
    let yesterdayRevenue = 0;
    let weeklyRevenue = 0;
    let monthlyRevenue = 0;
    
    // Price override statistics
    let totalOverrides = 0;
    let totalDiscountGiven = 0;
    let totalCalculatedConsoleRevenue = 0;

    try {
      // Total revenue
      const totalRevenueResult = await db('receipts')
        .sum('total as totalRevenue')
        .first();
      totalRevenue = Number(totalRevenueResult?.totalRevenue) || 0;

      // Today's revenue
      const todayRevenueResult = await db('receipts')
        .whereBetween('created_at', [today, endOfDay(now)])
        .sum('total as todayRevenue')
        .first();
      todayRevenue = Number(todayRevenueResult?.todayRevenue) || 0;

      // Yesterday's revenue for comparison
      const yesterdayRevenueResult = await db('receipts')
        .whereBetween('created_at', [yesterday, today])
        .sum('total as yesterdayRevenue')
        .first();
      yesterdayRevenue = Number(yesterdayRevenueResult?.yesterdayRevenue) || 0;

      // Weekly revenue
      const weeklyRevenueResult = await db('receipts')
        .where('created_at', '>=', weekAgo)
        .sum('total as weeklyRevenue')
        .first();
      weeklyRevenue = Number(weeklyRevenueResult?.weeklyRevenue) || 0;

      // Monthly revenue
      const monthlyRevenueResult = await db('receipts')
        .where('created_at', '>=', monthAgo)
        .sum('total as monthlyRevenue')
        .first();
      monthlyRevenue = Number(monthlyRevenueResult?.monthlyRevenue) || 0;

      // Price override statistics
      const overrideStats = await db('receipts')
        .select(
          db.raw('COUNT(*) as total_overrides'),
          db.raw('SUM(calculated_console_price - manual_console_price) as total_discount'),
          db.raw('SUM(calculated_console_price) as total_calculated'),
          db.raw('SUM(manual_console_price) as total_manual')
        )
        .whereNotNull('manual_console_price')
        .whereNotNull('calculated_console_price')
        .where(db.raw('calculated_console_price != manual_console_price'))
        .first();

      totalOverrides = Number(overrideStats?.total_overrides) || 0;
      totalDiscountGiven = Number(overrideStats?.total_discount) || 0;
      totalCalculatedConsoleRevenue = Number(overrideStats?.total_calculated) || 0;

    } catch (error) {
      console.log('Error fetching receipt data:', error);
      // Fallback to session data if receipts table has issues
      try {
        const sessionRevenueResult = await db('sessions')
          .whereNotNull('final_cost')
          .sum('final_cost as totalRevenue')
          .first();
        totalRevenue = Number(sessionRevenueResult?.totalRevenue) || 0;
      } catch (sessionError) {
        console.log('Error fetching session revenue fallback:', sessionError);
      }
    }

    // Session statistics
    const totalSessionsResult = await db('sessions')
      .count('id as totalSessions')
      .first();
    const totalSessions = Number(totalSessionsResult?.totalSessions) || 0;

    const todaySessionsResult = await db('sessions')
      .whereBetween('created_at', [today, endOfDay(now)])
      .count('id as todaySessions')
      .first();
    const todaySessions = Number(todaySessionsResult?.todaySessions) || 0;

    const yesterdaySessionsResult = await db('sessions')
      .whereBetween('created_at', [yesterday, today])
      .count('id as yesterdaySessions')
      .first();
    const yesterdaySessions = Number(yesterdaySessionsResult?.yesterdaySessions) || 0;

    // Calculate average session time
    let averageSessionTime = 0;
    try {
      const avgSessionResult = await db('sessions')
        .whereNotNull('end_time')
        .whereNotNull('start_time')
        .select(
          db.raw(`
            AVG(
              CASE 
                WHEN total_paused_duration IS NOT NULL 
                THEN (julianday(end_time) - julianday(start_time)) * 24 * 60 - (total_paused_duration / 60000.0)
                ELSE (julianday(end_time) - julianday(start_time)) * 24 * 60
              END
            ) as avgTime
          `)
        )
        .first();
      averageSessionTime = Math.round(Number(avgSessionResult?.avgTime) || 0);
    } catch (error) {
      console.log('Error calculating average session time:', error);
      averageSessionTime = 0;
    }

    // Calculate growth rates
    const revenueGrowth = yesterdayRevenue > 0 
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 
      : 0;
    
    const sessionGrowth = yesterdaySessions > 0 
      ? ((todaySessions - yesterdaySessions) / yesterdaySessions) * 100 
      : 0;

    // Price override analytics
    const averageDiscount = totalOverrides > 0 ? totalDiscountGiven / totalOverrides : 0;

    const priceOverrideStats = {
      totalOverrides,
      totalDiscountGiven,
      averageDiscount
    };

    // Enhanced top consoles with manual pricing data
    let topConsoles: Array<{
      name: string, 
      sessions: number, 
      revenue: number,
      calculatedRevenue: number,
      discountGiven: number
    }> = [];

    try {
      // Get console stats with manual price tracking
      const topConsolesData = await db('sessions')
        .join('consoles', 'sessions.console_id', 'consoles.id')
        .leftJoin('receipts', 'sessions.id', 'receipts.session_id')
        .select('consoles.name')
        .count('sessions.id as sessions')
        .sum('sessions.final_cost as calculated_revenue')
        .select(
          db.raw(`
            SUM(CASE 
              WHEN receipts.manual_console_price IS NOT NULL 
              THEN receipts.manual_console_price 
              ELSE sessions.final_cost 
            END) as actual_revenue
          `),
          db.raw(`
            SUM(CASE 
              WHEN receipts.manual_console_price IS NOT NULL 
              THEN (receipts.calculated_console_price - receipts.manual_console_price)
              ELSE 0 
            END) as total_discount
          `)
        )
        .whereNotNull('sessions.final_cost')
        .groupBy('consoles.id', 'consoles.name')
        .orderBy('sessions', 'desc')
        .limit(5);

      topConsoles = topConsolesData.map(console => ({
        name: console.name,
        sessions: Number(console.sessions),
        revenue: Number(console.actual_revenue) || 0,
        calculatedRevenue: Number(console.calculated_revenue) || 0,
        discountGiven: Number(console.total_discount) || 0
      }));
    } catch (error) {
      console.log('Error fetching enhanced top consoles:', error);
      // Fallback to simple console stats
      try {
        const fallbackConsoles = await db('sessions')
          .join('consoles', 'sessions.console_id', 'consoles.id')
          .select('consoles.name')
          .count('sessions.id as sessions')
          .sum('sessions.final_cost as revenue')
          .groupBy('consoles.id', 'consoles.name')
          .orderBy('sessions', 'desc')
          .limit(5);

        topConsoles = fallbackConsoles.map(console => ({
          name: console.name,
          sessions: Number(console.sessions),
          revenue: Number(console.revenue) || 0,
          calculatedRevenue: Number(console.revenue) || 0,
          discountGiven: 0
        }));
      } catch (fallbackError) {
        console.log('Fallback console stats also failed:', fallbackError);
      }
    }

    // Peak hours analysis
    let peakHours: Array<{hour: number, sessions: number}> = [];
    try {
      const peakHoursResult = await db('sessions')
        .select(
          db.raw("CAST(strftime('%H', start_time) AS INTEGER) as hour")
        )
        .count('id as sessions')
        .where('start_time', '>=', weekAgo)
        .groupBy(db.raw("strftime('%H', start_time)"))
        .orderBy('sessions', 'desc')
        .limit(24);

      peakHours = peakHoursResult.map((hour: any) => ({
        hour: Number(hour.hour),
        sessions: Number(hour.sessions)
      }));
    } catch (error) {
      console.log('Error fetching peak hours:', error);
    }

    // Enhanced recent activity with price override information
    let recentActivity: Array<{
      type: string, 
      description: string, 
      timestamp: string, 
      amount?: number,
      originalAmount?: number,
      discount?: number
    }> = [];
    
    try {
      // Recent sessions with manual price information
      const recentSessions = await db('sessions')
        .join('consoles', 'sessions.console_id', 'consoles.id')
        .leftJoin('receipts', 'sessions.id', 'receipts.session_id')
        .select(
          db.raw("'session' as type"),
          db.raw(`
            CASE 
              WHEN receipts.manual_console_price IS NOT NULL AND receipts.manual_console_price != receipts.calculated_console_price
              THEN 'Session ended on ' || consoles.name || ' (price adjusted)'
              ELSE 'Session ended on ' || consoles.name
            END as description
          `),
          'sessions.end_time as timestamp',
          db.raw(`
            CASE 
              WHEN receipts.manual_console_price IS NOT NULL 
              THEN receipts.manual_console_price
              ELSE sessions.final_cost 
            END as amount
          `),
          'receipts.calculated_console_price as original_amount',
          db.raw(`
            CASE 
              WHEN receipts.manual_console_price IS NOT NULL AND receipts.calculated_console_price IS NOT NULL
              THEN (receipts.calculated_console_price - receipts.manual_console_price)
              ELSE NULL 
            END as discount
          `)
        )
        .whereNotNull('sessions.end_time')
        .orderBy('sessions.end_time', 'desc')
        .limit(10);

      // Recent product purchases
      let recentPurchases: any[] = [];
      try {
        recentPurchases = await db('receipts')
          .join('receipt_items', 'receipts.id', 'receipt_items.receipt_id')
          .select(
            db.raw("'purchase' as type"),
            db.raw("'Sold ' || receipt_items.quantity || 'x ' || receipt_items.product_name as description"),
            'receipts.created_at as timestamp',
            'receipts.total as amount'
          )
          .orderBy('receipts.created_at', 'desc')
          .limit(10);
      } catch (error) {
        console.log('Error fetching recent purchases:', error);
      }

      recentActivity = [...recentSessions, ...recentPurchases]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 15)
        .map(activity => {
          let formattedTimestamp = activity.timestamp;
          
          if (typeof activity.timestamp === 'number' || 
              (typeof activity.timestamp === 'string' && /^\d+$/.test(activity.timestamp))) {
            try {
              const timestamp = Number(activity.timestamp);
              if (timestamp > 10000000000) {
                formattedTimestamp = new Date(timestamp).toISOString();
              } else {
                formattedTimestamp = new Date(timestamp * 1000).toISOString();
              }
            } catch (error) {
              formattedTimestamp = new Date().toISOString();
            }
          }
          
          return {
            type: activity.type,
            description: activity.description,
            timestamp: formattedTimestamp,
            amount: activity.amount ? Number(activity.amount) : undefined,
            originalAmount: activity.original_amount ? Number(activity.original_amount) : undefined,
            discount: activity.discount ? Number(activity.discount) : undefined
          };
        });
    } catch (error) {
      console.log('Error fetching enhanced recent activity:', error);
    }

    const stats = {
      totalRevenue: Number(totalRevenue),
      todayRevenue: Number(todayRevenue),
      weeklyRevenue: Number(weeklyRevenue),
      monthlyRevenue: Number(monthlyRevenue),
      totalSessions,
      todaySessions,
      averageSessionTime,
      revenueGrowth: Number(revenueGrowth.toFixed(2)),
      sessionGrowth: Number(sessionGrowth.toFixed(2)),
      priceOverrideStats,
      topConsoles,
      peakHours,
      recentActivity
    };

    console.log('Enhanced dashboard stats fetched successfully:', stats);
    return stats;

  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    return {
      totalRevenue: 0,
      todayRevenue: 0,
      weeklyRevenue: 0,
      monthlyRevenue: 0,
      totalSessions: 0,
      todaySessions: 0,
      averageSessionTime: 0,
      revenueGrowth: 0,
      sessionGrowth: 0,
      priceOverrideStats: {
        totalOverrides: 0,
        totalDiscountGiven: 0,
        averageDiscount: 0
      },
      topConsoles: [],
      peakHours: [],
      recentActivity: []
    };
  }
};

export const getRevenueReport = async (startDate?: string, endDate?: string) => {
  const start = startDate ? new Date(startDate) : subDays(new Date(), 30);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    // Enhanced revenue report with manual pricing breakdown
    const revenueData = await db('receipts')
      .select(
        db.raw("DATE(created_at) as date"),
        db.raw("SUM(total) as revenue"),
        db.raw("COUNT(*) as transactions"),
        db.raw(`
          SUM(CASE 
            WHEN manual_console_price IS NOT NULL 
            THEN manual_console_price 
            ELSE calculated_console_price 
          END) as console_revenue
        `),
        db.raw(`
          SUM(CASE 
            WHEN manual_console_price IS NOT NULL AND calculated_console_price IS NOT NULL
            THEN (calculated_console_price - manual_console_price)
            ELSE 0 
          END) as total_discounts
        `),
        db.raw(`
          COUNT(CASE 
            WHEN manual_console_price IS NOT NULL AND manual_console_price != calculated_console_price
            THEN 1 
          END) as price_overrides
        `)
      )
      .whereBetween('created_at', [start, end])
      .groupBy(db.raw("DATE(created_at)"))
      .orderBy('date');

    const sessionRevenue = await db('sessions')
      .select(
        db.raw("DATE(end_time) as date"),
        db.raw("SUM(final_cost) as calculated_revenue"),
        db.raw("COUNT(*) as sessions")
      )
      .whereNotNull('end_time')
      .whereBetween('end_time', [start, end])
      .groupBy(db.raw("DATE(end_time)"))
      .orderBy('date');

    // Summary statistics for the period
    const summary = await db('receipts')
      .select(
        db.raw('SUM(total) as total_revenue'),
        db.raw('COUNT(*) as total_transactions'),
        db.raw(`
          SUM(CASE 
            WHEN manual_console_price IS NOT NULL AND calculated_console_price IS NOT NULL
            THEN (calculated_console_price - manual_console_price)
            ELSE 0 
          END) as total_discounts_given
        `),
        db.raw(`
          COUNT(CASE 
            WHEN manual_console_price IS NOT NULL AND manual_console_price != calculated_console_price
            THEN 1 
          END) as total_price_overrides
        `),
        db.raw(`
          AVG(CASE 
            WHEN manual_console_price IS NOT NULL AND calculated_console_price IS NOT NULL AND manual_console_price != calculated_console_price
            THEN (calculated_console_price - manual_console_price)
          END) as avg_discount_amount
        `)
      )
      .whereBetween('created_at', [start, end])
      .first();

    return {
      revenue: revenueData.map((row: any) => ({
        date: row.date,
        revenue: Number(row.revenue),
        transactions: Number(row.transactions),
        consoleRevenue: Number(row.console_revenue || 0),
        totalDiscounts: Number(row.total_discounts || 0),
        priceOverrides: Number(row.price_overrides || 0)
      })),
      sessions: sessionRevenue.map((row: any) => ({
        date: row.date,
        calculatedRevenue: Number(row.calculated_revenue),
        sessions: Number(row.sessions)
      })),
      summary: {
        totalRevenue: Number(summary?.total_revenue || 0),
        totalTransactions: Number(summary?.total_transactions || 0),
        totalDiscountsGiven: Number(summary?.total_discounts_given || 0),
        totalPriceOverrides: Number(summary?.total_price_overrides || 0),
        avgDiscountAmount: Number(summary?.avg_discount_amount || 0)
      },
      period: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd')
      }
    };
  } catch (error) {
    console.error('Error in enhanced getRevenueReport:', error);
    return {
      revenue: [],
      sessions: [],
      summary: {
        totalRevenue: 0,
        totalTransactions: 0,
        totalDiscountsGiven: 0,
        totalPriceOverrides: 0,
        avgDiscountAmount: 0
      },
      period: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd')
      }
    };
  }
};

export const getSessionReport = async (startDate?: string, endDate?: string) => {
  const start = startDate ? new Date(startDate) : subDays(new Date(), 30);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    // Enhanced session report with manual pricing data
    const sessions = await db('sessions')
      .join('consoles', 'sessions.console_id', 'consoles.id')
      .leftJoin('receipts', 'sessions.id', 'receipts.session_id')
      .select(
        'sessions.*',
        'consoles.name as console_name',
        'consoles.type as console_type',
        'receipts.manual_console_price',
        'receipts.calculated_console_price',
        db.raw(`
          CASE 
            WHEN receipts.manual_console_price IS NOT NULL 
            THEN receipts.manual_console_price
            ELSE sessions.final_cost 
          END as actual_revenue
        `),
        db.raw(`
          CASE 
            WHEN receipts.manual_console_price IS NOT NULL AND receipts.calculated_console_price IS NOT NULL
            THEN (receipts.calculated_console_price - receipts.manual_console_price)
            ELSE 0 
          END as discount_given
        `)
      )
      .whereBetween('sessions.created_at', [start, end])
      .orderBy('sessions.created_at', 'desc');

    const summary = await db('sessions')
      .leftJoin('receipts', 'sessions.id', 'receipts.session_id')
      .select(
        db.raw('COUNT(sessions.id) as total_sessions'),
        db.raw(`
          AVG(CASE 
            WHEN receipts.manual_console_price IS NOT NULL 
            THEN receipts.manual_console_price
            ELSE sessions.final_cost 
          END) as avg_actual_cost
        `),
        db.raw('AVG(sessions.final_cost) as avg_calculated_cost'),
        db.raw(`
          AVG(
            CASE 
              WHEN sessions.end_time IS NOT NULL AND sessions.total_paused_duration IS NOT NULL 
              THEN (julianday(sessions.end_time) - julianday(sessions.start_time)) * 24 * 60 - (sessions.total_paused_duration / 60000.0)
              WHEN sessions.end_time IS NOT NULL 
              THEN (julianday(sessions.end_time) - julianday(sessions.start_time)) * 24 * 60
              ELSE NULL
            END
          ) as avg_duration
        `),
        db.raw(`
          SUM(CASE 
            WHEN receipts.manual_console_price IS NOT NULL 
            THEN receipts.manual_console_price
            ELSE sessions.final_cost 
          END) as total_actual_revenue
        `),
        db.raw('SUM(sessions.final_cost) as total_calculated_revenue'),
        db.raw(`
          SUM(CASE 
            WHEN receipts.manual_console_price IS NOT NULL AND receipts.calculated_console_price IS NOT NULL
            THEN (receipts.calculated_console_price - receipts.manual_console_price)
            ELSE 0 
          END) as total_discounts_given
        `),
        db.raw(`
          COUNT(CASE 
            WHEN receipts.manual_console_price IS NOT NULL AND receipts.manual_console_price != receipts.calculated_console_price
            THEN 1 
          END) as total_price_overrides
        `)
      )
      .whereBetween('sessions.created_at', [start, end])
      .whereNotNull('sessions.end_time')
      .first();

    return {
      sessions: sessions.map(session => ({
        ...session,
        actual_revenue: Number(session.actual_revenue || 0),
        discount_given: Number(session.discount_given || 0),
        manual_console_price: session.manual_console_price ? Number(session.manual_console_price) : null,
        calculated_console_price: session.calculated_console_price ? Number(session.calculated_console_price) : null
      })),
      summary: {
        totalSessions: Number(summary?.total_sessions || 0),
        avgActualCost: Number(summary?.avg_actual_cost || 0),
        avgCalculatedCost: Number(summary?.avg_calculated_cost || 0),
        avgDuration: Number(summary?.avg_duration || 0),
        totalActualRevenue: Number(summary?.total_actual_revenue || 0),
        totalCalculatedRevenue: Number(summary?.total_calculated_revenue || 0),
        totalDiscountsGiven: Number(summary?.total_discounts_given || 0),
        totalPriceOverrides: Number(summary?.total_price_overrides || 0)
      },
      period: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd')
      }
    };
  } catch (error) {
    console.error('Error in enhanced getSessionReport:', error);
    return {
      sessions: [],
      summary: {
        totalSessions: 0,
        avgActualCost: 0,
        avgCalculatedCost: 0,
        avgDuration: 0,
        totalActualRevenue: 0,
        totalCalculatedRevenue: 0,
        totalDiscountsGiven: 0,
        totalPriceOverrides: 0
      },
      period: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd')
      }
    };
  }
};

export const getTopProducts = async (limit: number = 10) => {
  try {
    const topProducts = await db('receipt_items')
      .join('receipts', 'receipt_items.receipt_id', 'receipts.id')
      .select(
        'receipt_items.product_name as name',
        db.raw('SUM(receipt_items.quantity) as total_sold'),
        db.raw('SUM(receipt_items.quantity * receipt_items.unit_price) as total_revenue'),
        db.raw('AVG(receipt_items.unit_price) as avg_price'),
        db.raw('COUNT(DISTINCT receipts.id) as total_orders')
      )
      .where('receipts.created_at', '>=', subDays(new Date(), 30))
      .groupBy('receipt_items.product_name')
      .orderBy('total_sold', 'desc')
      .limit(limit);

    return topProducts.map(product => ({
      name: product.name,
      totalSold: Number(product.total_sold),
      totalRevenue: Number(product.total_revenue),
      averagePrice: Number(product.avg_price),
      totalOrders: Number(product.total_orders)
    }));
  } catch (error) {
    console.error('Error in getTopProducts:', error);
    return [];
  }
};

// New function to get price override analytics
export const getPriceOverrideAnalytics = async (startDate?: string, endDate?: string) => {
  const start = startDate ? new Date(startDate) : subDays(new Date(), 30);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    const analytics = await db('receipts')
      .select(
        db.raw('COUNT(*) as total_receipts'),
        db.raw(`
          COUNT(CASE 
            WHEN manual_console_price IS NOT NULL AND manual_console_price != calculated_console_price
            THEN 1 
          END) as price_overrides
        `),
        db.raw(`
          SUM(CASE 
            WHEN manual_console_price IS NOT NULL AND calculated_console_price IS NOT NULL
            THEN (calculated_console_price - manual_console_price)
            ELSE 0 
          END) as total_discounts
        `),
        db.raw(`
          AVG(CASE 
            WHEN manual_console_price IS NOT NULL AND calculated_console_price IS NOT NULL AND manual_console_price != calculated_console_price
            THEN (calculated_console_price - manual_console_price)
          END) as avg_discount
        `),
        db.raw(`
          MAX(CASE 
            WHEN manual_console_price IS NOT NULL AND calculated_console_price IS NOT NULL
            THEN (calculated_console_price - manual_console_price)
            ELSE 0 
          END) as max_discount
        `),
        db.raw('SUM(calculated_console_price) as total_calculated_revenue'),
        db.raw('SUM(manual_console_price) as total_actual_revenue')
      )
      .whereBetween('created_at', [start, end])
      .whereNotNull('session_id')
      .first();

    return {
      totalReceipts: Number(analytics?.total_receipts || 0),
      priceOverrides: Number(analytics?.price_overrides || 0),
      totalDiscounts: Number(analytics?.total_discounts || 0),
      avgDiscount: Number(analytics?.avg_discount || 0),
      maxDiscount: Number(analytics?.max_discount || 0),
      totalCalculatedRevenue: Number(analytics?.total_calculated_revenue || 0),
      totalActualRevenue: Number(analytics?.total_actual_revenue || 0),
      overridePercentage: analytics?.total_receipts > 0 
        ? (Number(analytics.price_overrides) / Number(analytics.total_receipts)) * 100 
        : 0,
      period: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd')
      }
    };
  } catch (error) {
    console.error('Error in getPriceOverrideAnalytics:', error);
    return {
      totalReceipts: 0,
      priceOverrides: 0,
      totalDiscounts: 0,
      avgDiscount: 0,
      maxDiscount: 0,
      totalCalculatedRevenue: 0,
      totalActualRevenue: 0,
      overridePercentage: 0,
      period: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd')
      }
    };
  }
};