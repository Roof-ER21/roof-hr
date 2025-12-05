#!/bin/bash

TOKEN=$(cat token.txt)
CANDIDATE_ID="91c728ed-3205-4f39-9684-601cd8b3ee56"

echo "Testing AI Enhancement Features..."
echo "=================================="

# Test 1: Resume Parsing
echo -e "\n1. Testing Resume Parsing..."
curl -s -X POST http://localhost:5000/api/ai/parse-resume \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "candidateId": "'$CANDIDATE_ID'",
    "resumeText": "John Doe\nRoofer with 5 years experience\nSkills: Shingle installation, leak repair, safety protocols\nCertifications: OSHA 30-hour"
  }' | jq '.success'

# Test 2: Success Prediction
echo -e "\n2. Testing Success Prediction..."
curl -s -X POST http://localhost:5000/api/ai/predict-success \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "candidateId": "'$CANDIDATE_ID'",
    "jobRequirements": {
      "position": "Field Worker",
      "requiredSkills": ["Roofing", "Construction"],
      "experienceYears": 2,
      "educationLevel": "High School"
    }
  }' | jq '.success'

# Test 3: Salary Benchmarking
echo -e "\n3. Testing Salary Benchmarking..."
curl -s -X POST http://localhost:5000/api/ai/salary-benchmark \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "candidateId": "'$CANDIDATE_ID'",
    "position": "Roofer",
    "location": "Texas",
    "experienceLevel": "MID"
  }' | jq '.success'

# Test 4: Interview Questions
echo -e "\n4. Testing Interview Question Generation..."
curl -s -X POST http://localhost:5000/api/ai/generate-questions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "candidateId": "'$CANDIDATE_ID'",
    "interviewType": "technical",
    "questionCount": 3
  }' | jq '.success'

echo -e "\n=================================="
echo "All AI tests completed!"
