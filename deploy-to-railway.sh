#!/bin/bash

# Roof HR - Railway Deployment Script
# This script helps deploy the Roof HR application to Railway

set -e  # Exit on error

echo "======================================"
echo "Roof HR - Railway Deployment"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}Error: Railway CLI is not installed${NC}"
    echo "Install it with: npm install -g @railway/cli"
    exit 1
fi

echo -e "${GREEN}✓${NC} Railway CLI found"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Are you in the project root?${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} In project directory"

# Check git status
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}Warning: You have uncommitted changes${NC}"
    echo "Uncommitted files:"
    git status --short
    echo ""
    read -p "Do you want to commit these changes before deploying? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Please enter a commit message:"
        read COMMIT_MSG
        git add .
        git commit -m "$COMMIT_MSG"
        echo -e "${GREEN}✓${NC} Changes committed"
    else
        echo -e "${YELLOW}⚠${NC} Proceeding without committing changes"
    fi
else
    echo -e "${GREEN}✓${NC} No uncommitted changes"
fi

# Build locally to check for errors
echo ""
echo "Building project locally to check for errors..."
if npm run build; then
    echo -e "${GREEN}✓${NC} Local build successful"
else
    echo -e "${RED}✗${NC} Local build failed"
    echo "Fix build errors before deploying"
    exit 1
fi

# Check Railway project status
echo ""
echo "Checking Railway project status..."
railway status

echo ""
echo -e "${YELLOW}Deployment Options:${NC}"
echo "1. Deploy current branch to Railway (git push)"
echo "2. Deploy via Railway CLI (railway up)"
echo "3. Just check Railway logs"
echo "4. Open Railway dashboard"
echo "5. Exit"
echo ""
read -p "Select option (1-5): " -n 1 -r
echo

case $REPLY in
    1)
        echo ""
        echo "Pushing to origin main..."
        git push origin main
        echo -e "${GREEN}✓${NC} Code pushed to GitHub"
        echo "Railway will auto-deploy from GitHub"
        echo ""
        echo "Monitoring deployment logs..."
        sleep 3
        railway logs
        ;;
    2)
        echo ""
        echo "Deploying via Railway CLI..."
        railway up
        echo -e "${GREEN}✓${NC} Deployment initiated"
        echo ""
        echo "Monitoring deployment logs..."
        sleep 3
        railway logs
        ;;
    3)
        echo ""
        echo "Fetching Railway logs..."
        railway logs
        ;;
    4)
        echo ""
        echo "Opening Railway dashboard..."
        open https://railway.app/dashboard
        ;;
    5)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo "======================================"
echo "Post-Deployment Checks"
echo "======================================"
echo ""

PROD_URL="https://roofhr.up.railway.app"

echo "Waiting 10 seconds for deployment to complete..."
sleep 10

echo ""
echo "1. Checking health endpoint..."
if curl -sf "$PROD_URL/api/health" > /dev/null; then
    echo -e "${GREEN}✓${NC} Health check passed"
    curl -s "$PROD_URL/api/health" | jq .
else
    echo -e "${RED}✗${NC} Health check failed"
    echo "Check Railway logs for errors"
fi

echo ""
echo "2. Checking homepage..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} Homepage returned 200"
else
    echo -e "${RED}✗${NC} Homepage returned $HTTP_CODE"
fi

echo ""
echo "3. Checking static assets..."
# Get the current asset hash from the homepage
ASSET_JS=$(curl -s "$PROD_URL/" | grep -oP 'src="/assets/index-\K[^.]+' | head -1)
if [ -n "$ASSET_JS" ]; then
    ASSET_URL="$PROD_URL/assets/index-$ASSET_JS.js"
    if curl -sf "$ASSET_URL" > /dev/null; then
        echo -e "${GREEN}✓${NC} JavaScript asset found: index-$ASSET_JS.js"
    else
        echo -e "${RED}✗${NC} JavaScript asset not found"
    fi
else
    echo -e "${YELLOW}⚠${NC} Could not detect asset hash"
fi

echo ""
echo "======================================"
echo "Deployment Complete!"
echo "======================================"
echo ""
echo "Production URL: $PROD_URL"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Visit $PROD_URL and verify the app loads"
echo "2. Open browser console (F12) and check for errors"
echo "3. Test login with admin credentials"
echo "4. If you see a blank page, try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)"
echo ""
echo "To view logs: railway logs"
echo "To open dashboard: open https://railway.app/dashboard"
echo ""
