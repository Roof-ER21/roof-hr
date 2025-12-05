#!/bin/bash

# ROOF-ER HR System Deployment Script
# This script handles the deployment of the HR system to production

set -e

echo "🚀 Starting ROOF-ER HR System Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root is not recommended for security reasons"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check Node.js version
print_status "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="20.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    print_error "Node.js version $NODE_VERSION is too old. Requires $REQUIRED_VERSION or higher"
    exit 1
fi

print_success "Node.js version $NODE_VERSION is compatible"

# Check for required environment variables
print_status "Checking environment configuration..."
if [ ! -f ".env" ]; then
    print_warning ".env file not found"
    if [ -f ".env.example" ]; then
        print_status "Copying .env.example to .env"
        cp .env.example .env
        print_warning "Please edit .env file with your actual configuration before proceeding"
        exit 1
    else
        print_error "No .env.example file found"
        exit 1
    fi
fi

# Source environment variables
source .env

# Check required environment variables
REQUIRED_VARS=("DATABASE_URL" "SESSION_SECRET")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        print_error "Required environment variable $var is not set"
        exit 1
    fi
done

print_success "Environment configuration is valid"

# Install dependencies
print_status "Installing dependencies..."
if [ -f "package-lock.json" ]; then
    npm ci --production=false
else
    npm install
fi
print_success "Dependencies installed"

# Run type checking
print_status "Running type checks..."
npm run typecheck
print_success "Type checking passed"

# Run linting
print_status "Running linter..."
npm run lint
print_success "Linting passed"

# Run tests
print_status "Running tests..."
if command -v jest &> /dev/null; then
    npm run test
    print_success "Tests passed"
else
    print_warning "Jest not found, skipping tests"
fi

# Database setup
print_status "Setting up database..."
npm run db:push
print_success "Database schema updated"

# Build the application
print_status "Building application..."
npm run build
print_success "Build completed"

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p uploads
mkdir -p backups
print_success "Directories created"

# Set proper permissions
print_status "Setting file permissions..."
chmod -R 755 dist/
chmod -R 755 logs/
chmod -R 755 uploads/
chmod 600 .env
print_success "Permissions set"

# Create systemd service file (optional)
if command -v systemctl &> /dev/null; then
    print_status "Creating systemd service file..."
    
    # Get current user and working directory
    CURRENT_USER=$(whoami)
    WORKING_DIR=$(pwd)
    
    cat > /tmp/roof-er-hr.service << EOF
[Unit]
Description=ROOF-ER HR Management System
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$WORKING_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node $WORKING_DIR/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=roof-er-hr

[Install]
WantedBy=multi-user.target
EOF

    if [ -w "/etc/systemd/system/" ]; then
        sudo mv /tmp/roof-er-hr.service /etc/systemd/system/
        sudo systemctl daemon-reload
        print_success "Systemd service file created"
        print_status "To enable the service: sudo systemctl enable roof-er-hr"
        print_status "To start the service: sudo systemctl start roof-er-hr"
    else
        print_warning "Cannot write to /etc/systemd/system/. Service file saved to /tmp/roof-er-hr.service"
    fi
fi

# Create backup script
print_status "Creating backup script..."
cat > scripts/backup.sh << 'EOF'
#!/bin/bash

# ROOF-ER HR System Backup Script

BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/hr_backup_$DATE.sql"

echo "Creating backup at $BACKUP_FILE"

# Extract database connection details from DATABASE_URL
source .env
DB_URL_PARSED=$(echo $DATABASE_URL | sed 's/postgresql:\/\/\([^:]*\):\([^@]*\)@\([^:]*\):\([^\/]*\)\/\(.*\)/\1 \2 \3 \4 \5/')
read -r DB_USER DB_PASS DB_HOST DB_PORT DB_NAME <<< "$DB_URL_PARSED"

# Create backup
PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "Backup created successfully: $BACKUP_FILE"
    
    # Compress the backup
    gzip $BACKUP_FILE
    echo "Backup compressed: $BACKUP_FILE.gz"
    
    # Remove backups older than 30 days
    find $BACKUP_DIR -name "hr_backup_*.sql.gz" -mtime +30 -delete
    echo "Old backups cleaned up"
else
    echo "Backup failed"
    exit 1
fi
EOF

chmod +x scripts/backup.sh
print_success "Backup script created"

# Health check script
print_status "Creating health check script..."
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

# ROOF-ER HR System Health Check Script

source .env
PORT=${PORT:-5000}
HOST=${HOST:-localhost}

echo "Checking HR system health..."

# Check if the service is responding
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$HOST:$PORT/api/health)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Service is healthy"
    exit 0
else
    echo "❌ Service is unhealthy (HTTP $HTTP_STATUS)"
    exit 1
fi
EOF

chmod +x scripts/health-check.sh
print_success "Health check script created"

# Create log rotation configuration
print_status "Setting up log rotation..."
cat > /tmp/roof-er-hr-logs << EOF
$PWD/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        # Restart the service if it's running
        if systemctl is-active --quiet roof-er-hr; then
            systemctl reload roof-er-hr
        fi
    endscript
}
EOF

if [ -w "/etc/logrotate.d/" ]; then
    sudo mv /tmp/roof-er-hr-logs /etc/logrotate.d/roof-er-hr
    print_success "Log rotation configured"
else
    print_warning "Cannot write to /etc/logrotate.d/. Log rotation config saved to /tmp/roof-er-hr-logs"
fi

# Final deployment verification
print_status "Running deployment verification..."

# Start the application in background for testing
NODE_ENV=production node dist/index.js &
APP_PID=$!

# Wait for application to start
sleep 5

# Test health endpoint
if curl -s http://localhost:${PORT:-5000}/api/health > /dev/null; then
    print_success "Deployment verification passed"
else
    print_error "Deployment verification failed"
    kill $APP_PID 2>/dev/null
    exit 1
fi

# Stop the test instance
kill $APP_PID 2>/dev/null

print_success "🎉 Deployment completed successfully!"
echo
print_status "Next steps:"
echo "  1. Review and update .env file with production values"
echo "  2. Set up SSL/TLS certificates"
echo "  3. Configure reverse proxy (nginx/apache)"
echo "  4. Enable and start the systemd service"
echo "  5. Set up monitoring and alerting"
echo "  6. Schedule regular backups"
echo
print_status "To start the application:"
echo "  npm start"
echo
print_status "To start with systemd:"
echo "  sudo systemctl enable roof-er-hr"
echo "  sudo systemctl start roof-er-hr"
EOF