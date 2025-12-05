#!/bin/bash

# Production Setup Script for HR Management System
# Run this script to prepare the system for production deployment

echo "🚀 HR Management System - Production Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Node.js is installed${NC}"
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
else
    echo -e "${GREEN}✅ npm is installed${NC}"
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from template...${NC}"
    if [ -f .env.production.example ]; then
        cp .env.production.example .env
        echo -e "${GREEN}✅ Created .env file from template${NC}"
        echo -e "${YELLOW}📝 Please edit .env and add your configuration values${NC}"
    else
        echo -e "${RED}❌ .env.production.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Dependencies are installed${NC}"
fi

# Check database connection
echo ""
echo "🗄️  Checking database connection..."
npm run db:push 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${YELLOW}⚠️  Database connection failed. Please check DATABASE_URL in .env${NC}"
fi

# Run pre-production checks
echo ""
echo "🔍 Running pre-production validation..."
if [ -f "scripts/pre-production-check.ts" ]; then
    npx tsx scripts/pre-production-check.ts
else
    echo -e "${YELLOW}⚠️  Pre-production check script not found${NC}"
fi

# Build production assets
echo ""
echo "🏗️  Building production assets..."
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Production build completed${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Create necessary directories
echo ""
echo "📁 Creating necessary directories..."
mkdir -p logs
mkdir -p uploads
mkdir -p backups
echo -e "${GREEN}✅ Directories created${NC}"

# Set proper permissions
echo ""
echo "🔒 Setting file permissions..."
if [ -f ".env" ]; then
    chmod 600 .env
    echo -e "${GREEN}✅ Set secure permissions for .env${NC}"
fi

if [ -f "agent-states.json" ]; then
    chmod 640 agent-states.json
    echo -e "${GREEN}✅ Set permissions for agent-states.json${NC}"
fi

# Generate summary
echo ""
echo "=========================================="
echo "📊 PRODUCTION SETUP SUMMARY"
echo "=========================================="
echo ""

# Check critical environment variables
echo "Environment Variables:"
if grep -q "OPENAI_API_KEY=" .env 2>/dev/null && ! grep -q "OPENAI_API_KEY=your-" .env 2>/dev/null; then
    echo -e "${GREEN}✅ OpenAI API key configured${NC}"
else
    echo -e "${YELLOW}⚠️  OpenAI API key not configured (AI features will be disabled)${NC}"
fi

if grep -q "SENDGRID_API_KEY=" .env 2>/dev/null && ! grep -q "SENDGRID_API_KEY=your-" .env 2>/dev/null; then
    echo -e "${GREEN}✅ SendGrid API key configured${NC}"
else
    echo -e "${YELLOW}⚠️  SendGrid API key not configured (Email notifications will be disabled)${NC}"
fi

echo ""
echo "Next Steps:"
echo "1. Review and update .env with production values"
echo "2. Set up SSL certificates for HTTPS"
echo "3. Configure your domain and DNS"
echo "4. Set up monitoring and alerting"
echo "5. Configure backup strategy"
echo "6. Review security settings"
echo ""

echo "To start the production server:"
echo "  npm start"
echo ""
echo "To deploy on Replit:"
echo "  Click the 'Deploy' button in Replit interface"
echo ""

echo -e "${GREEN}✅ Production setup complete!${NC}"
echo ""
echo "For detailed deployment instructions, see:"
echo "  - DEPLOYMENT_GUIDE_TEAM.md"
echo "  - PRODUCTION_CHECKLIST.md"