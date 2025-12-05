const fetch = require('node-fetch');

async function testToolsAPI() {
  try {
    // First login
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'ben.kosa@theroofdocs.com',
        password: 'test123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login successful:', loginData.user.email);
    
    // Now fetch tools with the token
    const toolsResponse = await fetch('http://localhost:5000/api/tools/inventory', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        'Cookie': loginResponse.headers.get('set-cookie')
      }
    });
    
    const tools = await toolsResponse.json();
    console.log('Tools fetched:', tools.length);
    console.log('First 3 tools:', tools.slice(0, 3).map(t => ({ name: t.name, category: t.category, quantity: t.quantity })));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testToolsAPI();
