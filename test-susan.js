const fetch = require('node-fetch');

async function testSusanAI() {
  try {
    // Test the chat endpoint
    const response = await fetch('http://localhost:5000/api/susan-ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'hi'
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.get('content-type'));
    
    const text = await response.text();
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      console.log('Susan AI Response:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Response is not JSON. First 500 chars:', text.substring(0, 500));
    }
  } catch (error) {
    console.error('Error testing Susan AI:', error);
  }
}

testSusanAI();
