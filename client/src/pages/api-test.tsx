import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ApiTest() {
  const [results, setResults] = useState<string[]>([]);

  const addResult = (result: string) => {
    setResults(prev => [...prev, `${new Date().toISOString()}: ${result}`]);
  };

  const testHealth = async () => {
    try {
      addResult('Testing /api/health...');
      const response = await fetch('/api/health');
      const data = await response.json();
      addResult(`Health check: ${JSON.stringify(data)}`);
    } catch (error: any) {
      addResult(`Health check failed: ${error.message}`);
    }
  };

  const testLogin = async () => {
    try {
      addResult('Testing /api/auth/login...');
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'ahmed.mahmoud@roof-hr.com',
          password: 'ChangeMe123!'
        }),
      });
      
      addResult(`Login response status: ${response.status}`);
      const data = await response.json();
      addResult(`Login response: ${JSON.stringify(data)}`);
    } catch (error: any) {
      addResult(`Login test failed: ${error.message}`);
    }
  };

  const testWindowLocation = () => {
    addResult(`Window location: ${JSON.stringify({
      href: window.location.href,
      protocol: window.location.protocol,
      host: window.location.host,
      pathname: window.location.pathname,
      origin: window.location.origin
    }, null, 2)}`);
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>API Connection Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={testWindowLocation}>Test Window Location</Button>
              <Button onClick={testHealth}>Test Health Endpoint</Button>
              <Button onClick={testLogin}>Test Login</Button>
              <Button variant="outline" onClick={() => setResults([])}>Clear</Button>
            </div>
            
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Results:</h3>
              <div className="space-y-1 font-mono text-sm">
                {results.length === 0 ? (
                  <p className="text-gray-500">No tests run yet</p>
                ) : (
                  results.map((result, index) => (
                    <div key={index} className="text-wrap break-all">
                      {result}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}