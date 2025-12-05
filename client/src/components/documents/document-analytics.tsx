import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Eye, 
  Download, 
  Users, 
  TrendingUp,
  Calendar,
  User,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';

interface DocumentAnalyticsProps {
  documentId: string;
  onClose: () => void;
}

interface AccessLog {
  id: string;
  userId: string;
  action: 'VIEW' | 'DOWNLOAD' | 'SHARE' | 'DELETE';
  accessedAt: string;
  ipAddress?: string;
}

interface Analytics {
  totalViews: number;
  totalDownloads: number;
  uniqueViewers: number;
  acknowledgmentRate: number;
  recentActivity: AccessLog[];
}

export function DocumentAnalytics({ documentId }: DocumentAnalyticsProps) {
  const { data: analytics, isLoading } = useQuery<Analytics>({
    queryKey: [`/api/documents/${documentId}/analytics`],
    enabled: !!documentId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'VIEW':
        return <Eye className="h-3 w-3 text-blue-500" />;
      case 'DOWNLOAD':
        return <Download className="h-3 w-3 text-green-500" />;
      case 'SHARE':
        return <Users className="h-3 w-3 text-purple-500" />;
      case 'DELETE':
        return <Activity className="h-3 w-3 text-red-500" />;
      default:
        return <Activity className="h-3 w-3 text-gray-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'VIEW':
        return 'bg-blue-100 text-blue-800';
      case 'DOWNLOAD':
        return 'bg-green-100 text-green-800';
      case 'SHARE':
        return 'bg-purple-100 text-purple-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Total Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{analytics.totalViews}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Download className="h-4 w-4" />
              Total Downloads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{analytics.totalDownloads}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Unique Viewers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{analytics.uniqueViewers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Engagement Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {analytics.totalViews > 0 
                ? Math.round((analytics.totalDownloads / analytics.totalViews) * 100)
                : 0
              }%
            </div>
            <p className="text-xs text-gray-600 mt-1">Downloads per view</p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Engagement Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* View to Download Ratio */}
            <div className="space-y-3">
              <h4 className="font-medium">View to Download Ratio</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Views</span>
                  <span>{analytics.totalViews}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: '100%' }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Downloads</span>
                  <span>{analytics.totalDownloads}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: analytics.totalViews > 0 
                        ? `${(analytics.totalDownloads / analytics.totalViews) * 100}%` 
                        : '0%' 
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* User Engagement */}
            <div className="space-y-3">
              <h4 className="font-medium">User Engagement</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Unique Viewers:</span>
                  <span className="font-medium">{analytics.uniqueViewers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Acknowledgments:</span>
                  <span className="font-medium">{analytics.acknowledgmentRate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg. Views per User:</span>
                  <span className="font-medium">
                    {analytics.uniqueViewers > 0 
                      ? (analytics.totalViews / analytics.uniqueViewers).toFixed(1)
                      : '0'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.recentActivity.length === 0 ? (
            <div className="text-center py-6">
              <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getActionIcon(activity.action)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{activity.userId}</span>
                        <Badge className={getActionColor(activity.action)}>
                          {activity.action}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600">
                        {format(new Date(activity.accessedAt), 'PPp')}
                      </div>
                    </div>
                  </div>
                  {activity.ipAddress && (
                    <div className="text-xs text-gray-500 font-mono">
                      {activity.ipAddress}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Document Popularity</h4>
              <div className="flex items-center gap-2">
                {analytics.totalViews >= 50 ? (
                  <>
                    <Badge className="bg-green-100 text-green-800">High</Badge>
                    <span className="text-sm text-gray-600">Very popular document</span>
                  </>
                ) : analytics.totalViews >= 20 ? (
                  <>
                    <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
                    <span className="text-sm text-gray-600">Moderately popular</span>
                  </>
                ) : (
                  <>
                    <Badge className="bg-gray-100 text-gray-800">Low</Badge>
                    <span className="text-sm text-gray-600">Limited views</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm">Download Rate</h4>
              <div className="flex items-center gap-2">
                {((analytics.totalDownloads / analytics.totalViews) * 100) >= 30 ? (
                  <>
                    <Badge className="bg-green-100 text-green-800">High</Badge>
                    <span className="text-sm text-gray-600">Strong engagement</span>
                  </>
                ) : ((analytics.totalDownloads / analytics.totalViews) * 100) >= 15 ? (
                  <>
                    <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
                    <span className="text-sm text-gray-600">Good engagement</span>
                  </>
                ) : (
                  <>
                    <Badge className="bg-gray-100 text-gray-800">Low</Badge>
                    <span className="text-sm text-gray-600">Consider improving</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}