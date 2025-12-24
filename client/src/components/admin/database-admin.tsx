/**
 * Database Admin Component - Super Admin Dashboard
 * Table browser, SQL console, and data export
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Database,
  Play,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Table2,
  History,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TableInfo {
  tableName: string;
  rowCount: number;
}

interface TableData {
  rows: any[];
  total: number;
}

interface QueryResult {
  rows: any[];
  rowCount: number;
  executionTime: number;
}

interface SqlHistoryEntry {
  id: string;
  query: string;
  queryType: string;
  executedByEmail: string;
  executionTime: number;
  rowsAffected: number;
  success: boolean;
  errorMessage: string | null;
  tableName: string | null;
  createdAt: string;
}

export function DatabaseAdmin() {
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users LIMIT 10;');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Fetch table list
  const { data: tables, isLoading: tablesLoading, refetch: refetchTables } = useQuery<TableInfo[]>({
    queryKey: ['/api/super-admin/database/tables'],
    queryFn: async () => {
      const res = await fetch('/api/super-admin/database/tables');
      if (!res.ok) throw new Error('Failed to fetch tables');
      return res.json();
    }
  });

  // Fetch table data
  const { data: tableData, isLoading: tableDataLoading } = useQuery<TableData>({
    queryKey: ['/api/super-admin/database/tables', selectedTable, page, pageSize],
    queryFn: async () => {
      if (!selectedTable) return { rows: [], total: 0 };
      const res = await fetch(
        `/api/super-admin/database/tables/${selectedTable}?limit=${pageSize}&offset=${page * pageSize}`
      );
      if (!res.ok) throw new Error('Failed to fetch table data');
      return res.json();
    },
    enabled: !!selectedTable
  });

  // Fetch SQL history
  const { data: sqlHistory } = useQuery<SqlHistoryEntry[]>({
    queryKey: ['/api/super-admin/sql-history'],
    queryFn: async () => {
      const res = await fetch('/api/super-admin/sql-history?limit=50');
      if (!res.ok) throw new Error('Failed to fetch SQL history');
      return res.json();
    }
  });

  // Execute SQL mutation
  const executeSqlMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch('/api/super-admin/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Query failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setQueryResult(data);
      setQueryError(null);
      toast({
        title: 'Query executed',
        description: `${data.rowCount} rows affected in ${data.executionTime}ms`
      });
    },
    onError: (error: Error) => {
      setQueryError(error.message);
      setQueryResult(null);
      toast({
        title: 'Query failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Export table mutation
  const exportTableMutation = useMutation({
    mutationFn: async ({ table, format }: { table: string; format: 'csv' | 'json' }) => {
      const res = await fetch(`/api/super-admin/database/export/${table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format })
      });
      if (!res.ok) throw new Error('Export failed');

      if (format === 'csv') {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${table}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${table}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    },
    onSuccess: () => {
      toast({ title: 'Export complete' });
    },
    onError: () => {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  });

  const filteredTables = tables?.filter(t =>
    t.tableName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalPages = tableData ? Math.ceil(tableData.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6" />
            Database Admin
          </h2>
          <p className="text-muted-foreground">Browse tables, execute SQL, and export data</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchTables()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="tables">
        <TabsList>
          <TabsTrigger value="tables">
            <Table2 className="w-4 h-4 mr-2" />
            Tables ({tables?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="sql">
            <Play className="w-4 h-4 mr-2" />
            SQL Console
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            Query History
          </TabsTrigger>
        </TabsList>

        {/* Tables Tab */}
        <TabsContent value="tables">
          <div className="grid grid-cols-12 gap-4">
            {/* Table List Sidebar */}
            <Card className="col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tables</CardTitle>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tables..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {filteredTables.map((table) => (
                    <div
                      key={table.tableName}
                      className={`px-4 py-2 cursor-pointer hover:bg-muted flex items-center justify-between ${
                        selectedTable === table.tableName ? 'bg-muted' : ''
                      }`}
                      onClick={() => {
                        setSelectedTable(table.tableName);
                        setPage(0);
                      }}
                    >
                      <span className="font-mono text-sm truncate">{table.tableName}</span>
                      <Badge variant="outline" className="ml-2">
                        {table.rowCount.toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Table Data Viewer */}
            <Card className="col-span-9">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="font-mono">
                    {selectedTable || 'Select a table'}
                  </CardTitle>
                  {tableData && (
                    <CardDescription>
                      {tableData.total.toLocaleString()} rows total
                    </CardDescription>
                  )}
                </div>
                {selectedTable && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportTableMutation.mutate({ table: selectedTable, format: 'csv' })}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportTableMutation.mutate({ table: selectedTable, format: 'json' })}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      JSON
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {selectedTable ? (
                  <>
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {tableData?.rows[0] &&
                              Object.keys(tableData.rows[0]).map((col) => (
                                <TableHead key={col} className="font-mono text-xs">
                                  {col}
                                </TableHead>
                              ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tableData?.rows.map((row, i) => (
                            <TableRow key={i}>
                              {Object.values(row).map((val: any, j) => (
                                <TableCell key={j} className="font-mono text-xs max-w-xs truncate">
                                  {val === null ? (
                                    <span className="text-muted-foreground">NULL</span>
                                  ) : typeof val === 'object' ? (
                                    JSON.stringify(val).slice(0, 50)
                                  ) : (
                                    String(val).slice(0, 100)
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rows per page:</span>
                        <Select
                          value={String(pageSize)}
                          onValueChange={(v) => {
                            setPageSize(Number(v));
                            setPage(0);
                          }}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Page {page + 1} of {totalPages || 1}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(0, p - 1))}
                          disabled={page === 0}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => p + 1)}
                          disabled={page >= totalPages - 1}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Select a table from the list
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SQL Console Tab */}
        <TabsContent value="sql">
          <Card>
            <CardHeader>
              <CardTitle>SQL Console</CardTitle>
              <CardDescription>
                Execute SQL queries directly. All queries are logged for audit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <Textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    placeholder="SELECT * FROM users LIMIT 10;"
                    className="font-mono text-sm h-32"
                  />
                </div>
                <Button
                  onClick={() => executeSqlMutation.mutate(sqlQuery)}
                  disabled={executeSqlMutation.isPending || !sqlQuery.trim()}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Execute
                </Button>
              </div>

              {/* Warning */}
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <span className="text-sm">
                  Write operations (INSERT, UPDATE, DELETE) are logged and audited. Use with caution.
                </span>
              </div>

              {/* Query Error */}
              {queryError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded">
                  <p className="text-red-500 font-mono text-sm">{queryError}</p>
                </div>
              )}

              {/* Query Result */}
              {queryResult && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      {queryResult.rowCount} rows returned in {queryResult.executionTime}ms
                    </span>
                  </div>
                  <ScrollArea className="h-[300px] border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {queryResult.rows[0] &&
                            Object.keys(queryResult.rows[0]).map((col) => (
                              <TableHead key={col} className="font-mono text-xs">
                                {col}
                              </TableHead>
                            ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queryResult.rows.map((row, i) => (
                          <TableRow key={i}>
                            {Object.values(row).map((val: any, j) => (
                              <TableCell key={j} className="font-mono text-xs">
                                {val === null ? (
                                  <span className="text-muted-foreground">NULL</span>
                                ) : typeof val === 'object' ? (
                                  JSON.stringify(val)
                                ) : (
                                  String(val)
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Query History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Query History</CardTitle>
              <CardDescription>Recent SQL queries executed through the admin console</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Query</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sqlHistory?.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm">
                        {new Date(entry.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-md truncate">
                        <button
                          className="text-left hover:underline"
                          onClick={() => setSqlQuery(entry.query)}
                        >
                          {entry.query.slice(0, 80)}...
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.queryType}</Badge>
                      </TableCell>
                      <TableCell>{entry.rowsAffected}</TableCell>
                      <TableCell>{entry.executionTime}ms</TableCell>
                      <TableCell>
                        {entry.success ? (
                          <Badge className="bg-green-500">Success</Badge>
                        ) : (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!sqlHistory || sqlHistory.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No queries executed yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DatabaseAdmin;
