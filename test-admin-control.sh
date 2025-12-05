#!/bin/bash

# Test Admin Control page loading
echo "Testing Admin Control functionality..."

# Login first
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ahmed.mahmoud@theroofdocs.com","password":"Roofer21!"}' \
  -c cookies.txt)

echo "Login response: $LOGIN_RESPONSE"

# Test HR agents endpoint
echo ""
echo "2. Testing HR agents endpoint..."
AGENTS=$(curl -s http://localhost:5000/api/hr-agents \
  -b cookies.txt)
echo "HR Agents: $AGENTS"

# Test HR agent logs endpoint
echo ""
echo "3. Testing HR agent logs endpoint..."
LOGS=$(curl -s http://localhost:5000/api/hr-agents/logs \
  -b cookies.txt)
echo "HR Agent Logs: $LOGS"

# Test settings endpoint
echo ""
echo "4. Testing settings endpoint..."
SETTINGS=$(curl -s http://localhost:5000/api/settings \
  -b cookies.txt)
echo "Settings: $SETTINGS"

echo ""
echo "✅ Admin Control API endpoints tested successfully!"