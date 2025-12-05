#!/bin/bash

# Test navigation by simulating clicking "View Candidate" from Bot Panel
echo "Testing navigation from Bot Panel to Recruiting page..."

# Get one real candidate ID
CANDIDATE_ID=$(curl -s http://localhost:5173/api/candidates \
  -H "Authorization: Bearer $(cat cookies.txt | grep -o 'token=[^;]*' | cut -d= -f2)" \
  | jq -r '.[0].id')

echo "Using candidate ID: $CANDIDATE_ID"

# The navigation URL that should work now
TEST_URL="http://localhost:5173/recruiting?candidateId=$CANDIDATE_ID"
echo "Navigation URL: $TEST_URL"

echo ""
echo "Expected behavior after clicking 'View Candidate' in Bot Panel:"
echo "1. Navigation to /recruiting page with candidateId parameter"
echo "2. React Router preserves app state (no full page reload)"
echo "3. Enhanced Recruiting page detects the URL parameter"
echo "4. Candidate details modal opens automatically"
echo "5. URL parameter is cleared after handling"
echo ""
echo "To manually test:"
echo "1. Go to Admin Control Hub"
echo "2. Look for Smart Recruitment Bot section"
echo "3. Click 'View Candidate' button on any notification"
echo "4. Check browser console for debug logs showing parameter detection"
