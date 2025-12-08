#!/bin/bash

# COI Duplicate Cleanup Utility
# Usage: ./scripts/coi-cleanup.sh [analyze|cleanup]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Change to project root
cd "$(dirname "$0")/.."

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create a .env file with DATABASE_URL"
    exit 1
fi

# Function to check if database is accessible
check_database() {
    echo -e "${BLUE}Checking database connection...${NC}"
    if ! npx tsx -e "
        import 'dotenv/config';
        import { db } from './server/db';
        import { testConnection } from './server/db';
        testConnection().then(ok => process.exit(ok ? 0 : 1));
    " 2>/dev/null; then
        echo -e "${RED}Error: Cannot connect to database${NC}"
        echo "Please ensure your database is running"
        exit 1
    fi
    echo -e "${GREEN}✓ Database connection successful${NC}"
    echo ""
}

# Show usage
show_usage() {
    echo -e "${BLUE}COI Duplicate Cleanup Utility${NC}"
    echo ""
    echo "Usage: ./scripts/coi-cleanup.sh [command]"
    echo ""
    echo "Commands:"
    echo "  analyze  - Analyze duplicates without making changes (DRY RUN)"
    echo "  cleanup  - Perform actual cleanup (DESTRUCTIVE)"
    echo "  help     - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/coi-cleanup.sh analyze"
    echo "  ./scripts/coi-cleanup.sh cleanup"
    echo ""
}

# Main logic
case "${1:-help}" in
    analyze)
        echo -e "${BLUE}======================================${NC}"
        echo -e "${BLUE}   COI DUPLICATE ANALYSIS (DRY RUN)${NC}"
        echo -e "${BLUE}======================================${NC}"
        echo ""
        check_database
        npx tsx server/scripts/analyze-coi-duplicates.ts
        ;;

    cleanup)
        echo -e "${YELLOW}======================================${NC}"
        echo -e "${YELLOW}   COI DUPLICATE CLEANUP${NC}"
        echo -e "${YELLOW}======================================${NC}"
        echo ""
        echo -e "${RED}WARNING: This will permanently delete duplicate COI records!${NC}"
        echo ""
        echo "Press Ctrl+C to cancel, or Enter to continue..."
        read -r

        check_database
        npx tsx server/scripts/cleanup-coi-duplicates.ts

        echo ""
        echo -e "${GREEN}======================================${NC}"
        echo -e "${GREEN}   Cleanup Complete!${NC}"
        echo -e "${GREEN}======================================${NC}"
        ;;

    help|--help|-h)
        show_usage
        ;;

    *)
        echo -e "${RED}Error: Unknown command '${1}'${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac
