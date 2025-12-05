/**
 * Susan AI Analytics Engine
 * Provides advanced analytics, insights, and predictive capabilities
 */

import { db } from '../../db';
import { 
  users, 
  ptoRequests, 
  candidates,
  territories 
} from '@shared/schema';
import { sql, eq, and, gte, lte, count, avg } from 'drizzle-orm';

export interface AnalyticsInsight {
  type: 'trend' | 'prediction' | 'alert' | 'recommendation';
  title: string;
  description: string;
  data: any;
  severity: 'low' | 'medium' | 'high';
  actionItems?: string[];
}

export interface TrendAnalysis {
  period: string;
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  change: number;
  projectedValue?: number;
}

export class AnalyticsEngine {
  /**
   * Helper function to safely convert to ISO string
   */
  private safeToISOString(date: any): string {
    try {
      if (date instanceof Date) {
        return date.toISOString();
      }
      if (typeof date === 'string' || typeof date === 'number') {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString();
        }
      }
      // Default to current time if invalid
      return new Date().toISOString();
    } catch (error) {
      console.error('[ANALYTICS] Error converting date to ISO string:', error);
      return new Date().toISOString();
    }
  }

  /**
   * Get quick overview stats
   */
  private async getQuickStatsInsight(): Promise<AnalyticsInsight | null> {
    console.log('[ANALYTICS] Getting quick stats insight...');
    try {
      const [employeeCount] = await db.select({ count: count() })
        .from(users)
        .where(eq(users.isActive, true));
      
      const [candidateCount] = await db.select({ count: count() })
        .from(candidates);
      
      const [pendingPtoCount] = await db.select({ count: count() })
        .from(ptoRequests)
        .where(eq(ptoRequests.status, 'PENDING'));
      
      return {
        type: 'trend',
        title: 'HR Dashboard Overview',
        description: 'Current system metrics at a glance',
        data: {
          activeEmployees: employeeCount?.count || 0,
          totalCandidates: candidateCount?.count || 0,
          pendingPTORequests: pendingPtoCount?.count || 0,
          lastUpdated: this.safeToISOString(new Date())
        },
        severity: 'low',
        actionItems: pendingPtoCount?.count > 5 ? 
          ['Review pending PTO requests'] : []
      };
    } catch (error) {
      console.error('[ANALYTICS] Error generating quick stats:', error);
      return null;
    }
  }
  /**
   * Generate comprehensive HR analytics insights
   */
  async generateInsights(userRole: string, userId?: string): Promise<AnalyticsInsight[]> {
    console.log('[ANALYTICS] generateInsights called with:', { userRole, userId });
    const insights: AnalyticsInsight[] = [];

    // Generate role-specific insights
    try {
      console.log('[ANALYTICS] Checking role for insights, userRole:', userRole);
      if (userRole === 'ADMIN' || userRole === 'MANAGER') {
        console.log('[ANALYTICS] User is ADMIN or MANAGER, generating insights...');
        // Add quick stats insight
        try {
          const quickStats = await this.getQuickStatsInsight();
          if (quickStats) {
            insights.push(quickStats);
            console.log('[ANALYTICS] Added quick stats insight');
          }
        } catch (error) {
          console.error('[ANALYTICS] Error in quick stats:', error);
        }
        
        try {
          const executiveInsights = await this.getExecutiveInsights();
          console.log('[ANALYTICS] Executive insights count:', executiveInsights.length);
          insights.push(...executiveInsights);
        } catch (error) {
          console.error('[ANALYTICS] Error in executive insights:', error);
        }
        
        try {
          const teamInsights = await this.getTeamPerformanceInsights();
          console.log('[ANALYTICS] Team insights count:', teamInsights.length);
          insights.push(...teamInsights);
        } catch (error) {
          console.error('[ANALYTICS] Error in team insights:', error);
        }
        
        try {
          const recruitmentInsights = await this.getRecruitmentInsights();
          console.log('[ANALYTICS] Recruitment insights count:', recruitmentInsights.length);
          insights.push(...recruitmentInsights);
        } catch (error) {
          console.error('[ANALYTICS] Error in recruitment insights:', error);
        }
        
        try {
          const ptoInsights = await this.getPTOTrendInsights();
          console.log('[ANALYTICS] PTO insights count:', ptoInsights.length);
          insights.push(...ptoInsights);
        } catch (error) {
          console.error('[ANALYTICS] Error in PTO insights:', error);
        }
      }

      if (userRole === 'EMPLOYEE' && userId) {
        const personalInsights = await this.getPersonalInsights(userId);
        console.log('[ANALYTICS] Personal insights count:', personalInsights.length);
        insights.push(...personalInsights);
      }
    } catch (error) {
      console.error('[ANALYTICS] Error generating insights:', error);
      insights.push({
        type: 'alert',
        title: 'Limited Analytics Available',
        description: 'Some analytics are still processing. Core metrics are available.',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'low',
        actionItems: []
      });
    }

    // If no insights were generated, add a default one
    if (insights.length === 0) {
      insights.push({
        type: 'trend',
        title: 'Analytics Active',
        description: 'Susan AI analytics engine is monitoring your HR data',
        data: { timestamp: this.safeToISOString(new Date()) },
        severity: 'low',
        actionItems: []
      });
    }

    console.log('[ANALYTICS] Total insights generated:', insights.length);
    return insights;
  }

  /**
   * Executive-level insights for leadership
   */
  private async getExecutiveInsights(): Promise<AnalyticsInsight[]> {
    console.log('[ANALYTICS] Getting executive insights...');
    const insights: AnalyticsInsight[] = [];

    try {
      // Employee growth trend
      const currentMonth = new Date();
      const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      const currentEmployeeCount = await db.select({ count: count() })
        .from(users)
        .where(eq(users.isActive, true));

      const lastMonthEmployeeCount = await db.select({ count: count() })
        .from(users)
        .where(and(
          eq(users.isActive, true),
          lte(users.hireDate, lastMonth.toISOString().split('T')[0])
        ));

      // Handle division by zero
      const currentCount = currentEmployeeCount[0]?.count || 0;
      const lastMonthCount = lastMonthEmployeeCount[0]?.count || 1;
      const growthRate = ((currentCount - lastMonthCount) / lastMonthCount * 100);

      insights.push({
        type: 'trend',
        title: 'Employee Growth Trend',
        description: `Company has ${growthRate > 0 ? 'grown' : 'declined'} by ${Math.abs(growthRate).toFixed(1)}% this month`,
        data: {
          current: currentEmployeeCount[0].count,
          previous: lastMonthEmployeeCount[0].count,
          growth: growthRate
        },
        severity: growthRate < -5 ? 'high' : growthRate > 10 ? 'medium' : 'low',
        actionItems: growthRate < 0 ? [
          'Review retention strategies',
          'Analyze exit interview feedback',
          'Consider employee satisfaction survey'
        ] : [
          'Ensure onboarding capacity',
          'Review compensation benchmarks',
          'Plan for team integration'
        ]
      });

      // Territory distribution analysis
      const territoryStats = await db.select({
        territory: users.territoryId,
        count: count()
      })
      .from(users)
      .where(eq(users.isActive, true))
      .groupBy(users.territoryId);

      const avgEmployeesPerTerritory = territoryStats.reduce((sum, t) => sum + t.count, 0) / territoryStats.length;
      const imbalancedTerritories = territoryStats.filter(t => 
        Math.abs(t.count - avgEmployeesPerTerritory) > avgEmployeesPerTerritory * 0.3
      );

      if (imbalancedTerritories.length > 0) {
        insights.push({
          type: 'alert',
          title: 'Territory Staffing Imbalance',
          description: `${imbalancedTerritories.length} territories have significant staffing variations`,
          data: { territories: territoryStats, imbalanced: imbalancedTerritories },
          severity: 'medium',
          actionItems: [
            'Review territory workload distribution',
            'Consider staff rebalancing',
            'Analyze territory performance metrics'
          ]
        });
      }

    } catch (error) {
      console.error('[ANALYTICS] Error generating executive insights:', error);
    }

    return insights;
  }

  /**
   * Team performance insights
   */
  private async getTeamPerformanceInsights(): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    try {
      // PTO utilization analysis
      const ptoStats = await db.select({
        department: users.department,
        avgPtoUsed: avg(sql`COALESCE((SELECT SUM(days) FROM pto_requests WHERE employee_id = users.id AND status = 'APPROVED'), 0)`)
      })
      .from(users)
      .where(eq(users.isActive, true))
      .groupBy(users.department);

      const overallAvg = ptoStats.reduce((sum, dept) => sum + Number(dept.avgPtoUsed || 0), 0) / ptoStats.length;
      const lowUtilizationDepts = ptoStats.filter(dept => Number(dept.avgPtoUsed || 0) < overallAvg * 0.6);

      if (lowUtilizationDepts.length > 0) {
        insights.push({
          type: 'recommendation',
          title: 'Low PTO Utilization Alert',
          description: `${lowUtilizationDepts.length} departments show below-average PTO usage`,
          data: { departments: ptoStats, lowUtilization: lowUtilizationDepts },
          severity: 'medium',
          actionItems: [
            'Encourage work-life balance',
            'Review workload distribution',
            'Consider wellness initiatives'
          ]
        });
      }

    } catch (error) {
      console.error('[ANALYTICS] Error generating team performance insights:', error);
    }

    return insights;
  }

  /**
   * Recruitment pipeline insights
   */
  private async getRecruitmentInsights(): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    try {
      // Candidate pipeline health
      const pipelineStats = await db.select({
        status: candidates.status,
        count: count()
      })
      .from(candidates)
      .groupBy(candidates.status);

      const totalCandidates = pipelineStats.reduce((sum, stage) => sum + stage.count, 0);
      const interviewStage = pipelineStats.find(s => s.status === 'INTERVIEW')?.count || 0;
      const applicationStage = pipelineStats.find(s => s.status === 'APPLIED')?.count || 0;

      if (totalCandidates > 0) {
        const interviewRatio = interviewStage / totalCandidates;
        
        if (interviewRatio < 0.2) {
          insights.push({
            type: 'alert',
            title: 'Low Interview Conversion',
            description: `Only ${(interviewRatio * 100).toFixed(1)}% of candidates reach interview stage`,
            data: { pipeline: pipelineStats, conversionRate: interviewRatio },
            severity: 'high',
            actionItems: [
              'Review screening criteria',
              'Improve candidate qualification process',
              'Analyze application requirements'
            ]
          });
        }

        const applicationStageActual = pipelineStats.find(s => s.status === 'APPLIED')?.count || 0;
        if (applicationStageActual > totalCandidates * 0.6) {
          insights.push({
            type: 'recommendation',
            title: 'Application Backlog',
            description: `${applicationStageActual} candidates waiting for initial screening`,
            data: { pending: applicationStageActual, total: totalCandidates },
            severity: 'medium',
            actionItems: [
              'Accelerate initial screening process',
              'Consider automated pre-screening',
              'Allocate more recruiter time'
            ]
          });
        }
      }

    } catch (error) {
      console.error('[ANALYTICS] Error generating recruitment insights:', error);
    }

    return insights;
  }

  /**
   * PTO trend analysis
   */
  private async getPTOTrendInsights(): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    try {
      const currentDate = new Date();
      const sixMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 6, 1);

      // PTO request volume trends
      const monthlyPtoRequests = await db.select({
        month: sql`DATE_TRUNC('month', created_at)`,
        count: count()
      })
      .from(ptoRequests)
      .where(gte(ptoRequests.createdAt, sixMonthsAgo))
      .groupBy(sql`DATE_TRUNC('month', created_at)`)
      .orderBy(sql`DATE_TRUNC('month', created_at)`);

      if (monthlyPtoRequests.length >= 3) {
        const trend = this.calculateTrend(monthlyPtoRequests.map(m => m.count));
        
        insights.push({
          type: 'trend',
          title: 'PTO Request Trends',
          description: `PTO requests are ${trend.trend} by ${Math.abs(trend.change).toFixed(1)}% over 6 months`,
          data: { monthlyData: monthlyPtoRequests, trend },
          severity: trend.change > 50 ? 'medium' : 'low',
          actionItems: trend.change > 30 ? [
            'Review PTO policies',
            'Assess team workload',
            'Plan for coverage needs'
          ] : [
            'Monitor seasonal patterns',
            'Maintain current policies'
          ]
        });
      }

    } catch (error) {
      console.error('[ANALYTICS] Error generating PTO insights:', error);
    }

    return insights;
  }

  /**
   * Personal insights for individual employees
   */
  private async getPersonalInsights(userId: string): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    try {
      // Personal PTO usage pattern
      const userPtoHistory = await db.select()
        .from(ptoRequests)
        .where(and(
          eq(ptoRequests.employeeId, userId),
          eq(ptoRequests.status, 'APPROVED')
        ));

      const totalDaysUsed = userPtoHistory.reduce((sum, req) => sum + req.days, 0);
      const avgDaysPerRequest = totalDaysUsed / (userPtoHistory.length || 1);

      insights.push({
        type: 'recommendation',
        title: 'PTO Usage Pattern',
        description: `You typically take ${avgDaysPerRequest.toFixed(1)} days per request`,
        data: { 
          totalUsed: totalDaysUsed, 
          requests: userPtoHistory.length,
          avgPerRequest: avgDaysPerRequest
        },
        severity: 'low',
        actionItems: avgDaysPerRequest < 2 ? [
          'Consider longer breaks for better rest',
          'Plan extended vacations for recharge'
        ] : [
          'Great work-life balance',
          'Continue current PTO planning'
        ]
      });

    } catch (error) {
      console.error('[ANALYTICS] Error generating personal insights:', error);
    }

    return insights;
  }

  /**
   * Calculate trend from time series data
   */
  private calculateTrend(values: number[]): TrendAnalysis {
    if (values.length < 2) {
      return { period: 'insufficient-data', metric: 'count', trend: 'stable', change: 0 };
    }

    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;

    return {
      period: `${values.length} months`,
      metric: 'count',
      trend: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
      change,
      projectedValue: Math.round(last + (change / 100 * last))
    };
  }

  /**
   * Generate predictive insights using historical data
   */
  async generatePredictions(userRole: string): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      return insights;
    }

    try {
      // Predict peak PTO periods
      const ptoByMonth = await db.select({
        month: sql`EXTRACT(MONTH FROM created_at)`,
        count: count()
      })
      .from(ptoRequests)
      .where(eq(ptoRequests.status, 'APPROVED'))
      .groupBy(sql`EXTRACT(MONTH FROM created_at)`)
      .orderBy(sql`EXTRACT(MONTH FROM created_at)`);

      if (ptoByMonth.length > 0) {
        const peakMonth = ptoByMonth.reduce((max, month) => 
          month.count > max.count ? month : max
        );

        const monthNames = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        insights.push({
          type: 'prediction',
          title: 'Peak PTO Period Forecast',
          description: `${monthNames[Number(peakMonth.month) - 1]} typically sees highest PTO usage (${peakMonth.count} requests)`,
          data: { peakMonth: peakMonth.month, monthlyData: ptoByMonth },
          severity: 'low',
          actionItems: [
            'Plan for reduced staffing during peak periods',
            'Consider coverage arrangements',
            'Review project timelines accordingly'
          ]
        });
      }

    } catch (error) {
      console.error('[ANALYTICS] Error generating predictions:', error);
    }

    return insights;
  }
}