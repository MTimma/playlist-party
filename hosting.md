# Hosting Guide - Google Cloud Platform

This guide provides detailed instructions for hosting the music game application on Google Cloud Platform using Compute Engine, nginx, and Docker.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Overview](#project-overview)
3. [Google Cloud Setup](#google-cloud-setup)
4. [Frontend Deployment](#frontend-deployment)
5. [Backend Deployment](#backend-deployment)
6. [Nginx Configuration](#nginx-configuration)
7. [Environment Variables & Secrets](#environment-variables--secrets)
8. [SSL/TLS Configuration](#ssltls-configuration)
9. [Monitoring & Logging](#monitoring--logging)
10. [CI/CD Pipeline](#cicd-pipeline)
11. [Cost Optimization](#cost-optimization)
12. [Troubleshooting](#troubleshooting)

## Prerequisites

- Google Cloud Platform account with billing enabled
- Google Cloud CLI (`gcloud`) installed and configured
- Docker installed locally
- Domain name (optional but recommended)
- Firebase project already set up

## Project Overview

The application consists of:
- **Frontend**: React SPA built with Vite (served as static files)
- **Backend**: Express.js API server (Node.js/TypeScript)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth

## Google Cloud Setup

### 1. Enable Required APIs

```bash
# Enable required Google Cloud APIs
gcloud services enable compute.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
gcloud services enable iam.googleapis.com
gcloud services enable cloudkms.googleapis.com
```

### 2. Set Project Configuration

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Set default region and zone
gcloud config set compute/region us-central1
gcloud config set compute/zone us-central1-a
```

### 3. Create Service Account

```bash
# Create service account for deployment
gcloud iam service-accounts create music-game-deploy \
    --display-name="Music Game Deployment Account"

# Grant necessary roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:music-game-deploy@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/compute.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:music-game-deploy@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.admin"

# Create and download key
gcloud iam service-accounts keys create ~/music-game-key.json \
    --iam-account=music-game-deploy@$PROJECT_ID.iam.gserviceaccount.com
```

## Frontend Deployment

### 1. Build the Frontend

```bash
# Install dependencies and build
npm install
npm run build

# The build output will be in the `dist/` directory
```

### 2. Create Cloud Storage Bucket

```bash
# Create bucket for static files
gsutil mb -l us-central1 gs://music-game-static

# Make bucket publicly readable
gsutil iam ch allUsers:objectViewer gs://music-game-static

# Enable static website hosting
gsutil web set -m index.html -e index.html gs://music-game-static
```

### 3. Upload Frontend Files

```bash
# Upload built files to Cloud Storage
gsutil -m rsync -r -d dist/ gs://music-game-static/

# Set cache headers for better performance
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000" gs://music-game-static/assets/**
gsutil -m setmeta -h "Cache-Control:public, max-age=0" gs://music-game-static/index.html
```

## Backend Deployment

### 1. Create Dockerfile for Express Server

Create `server/Dockerfile`:

```dockerfile
# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm install -g typescript ts-node
RUN npx tsc

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/index.js"]
```

### 2. Create .dockerignore

Create `server/.dockerignore`:

```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.nyc_output
.coverage
*.log
.DS_Store
```

### 3. Build and Push Docker Image

```bash
# Build the Docker image
cd server
docker build -t gcr.io/$PROJECT_ID/music-game-api:v1 .

# Configure Docker to use gcloud as a credential helper
gcloud auth configure-docker

# Push the image to Google Container Registry
docker push gcr.io/$PROJECT_ID/music-game-api:v1
```

### 4. Create Compute Engine Instance

```bash
# Create instance template
gcloud compute instance-templates create music-game-template \
    --machine-type=e2-micro \
    --image-family=debian-11 \
    --image-project=debian-cloud \
    --boot-disk-size=10GB \
    --boot-disk-type=pd-standard \
    --tags=http-server,https-server \
    --metadata=startup-script='#! /bin/bash
# Install Docker
apt-get update
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io

# Install nginx
apt-get install -y nginx

# Configure nginx
cat > /etc/nginx/sites-available/music-game << "EOF"
server {
    listen 80;
    server_name _;
    
    # Frontend static files
    location / {
        proxy_pass http://storage.googleapis.com/music-game-static/;
        proxy_set_header Host storage.googleapis.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API routes
    location /api/ {
        proxy_pass http://localhost:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:8080/health;
        access_log off;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/music-game /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Start nginx
systemctl enable nginx
systemctl start nginx

# Pull and run the API container
docker pull gcr.io/PROJECT_ID/music-game-api:v1
docker run -d \
    --name music-game-api \
    --restart unless-stopped \
    -p 8080:8080 \
    --env-file /etc/music-game/.env \
    gcr.io/PROJECT_ID/music-game-api:v1
'

# Create instance from template
gcloud compute instances create music-game-instance \
    --source-instance-template=music-game-template \
    --zone=us-central1-a
```

## Nginx Configuration

### 1. Advanced Nginx Configuration

Create a more comprehensive nginx configuration file:

```nginx
# /etc/nginx/sites-available/music-game
upstream api_backend {
    server localhost:8080;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    
    # Frontend static files
    location / {
        proxy_pass http://storage.googleapis.com/music-game-static/;
        proxy_set_header Host storage.googleapis.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API routes
    location /api/ {
        proxy_pass http://api_backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
    
    # Health check
    location /health {
        proxy_pass http://api_backend/health;
        access_log off;
    }
    
    # Rate limiting for API
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://api_backend/;
        # ... other proxy settings
    }
}

# Rate limiting configuration
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
}
```

### 2. SSL/TLS Configuration with Let's Encrypt

```bash
# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Obtain SSL certificate
certbot --nginx -d your-domain.com -d www.your-domain.com

# Set up auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

## Environment Variables & Secrets

### 1. Store Secrets in Google Secret Manager

```bash
# Create secrets
echo -n "your-spotify-client-id" | gcloud secrets create spotify-client-id --data-file=-
echo -n "your-spotify-client-secret" | gcloud secrets create spotify-client-secret --data-file=-
echo -n "your-spotify-redirect-uri" | gcloud secrets create spotify-redirect-uri --data-file=-

# Firebase service account (store the entire JSON)
gcloud secrets create firebase-service-account --data-file=path/to/serviceAccountKey.json
```

### 2. Create Environment File

Create `/etc/music-game/.env` on the Compute Engine instance:

```bash
# Create directory and file
mkdir -p /etc/music-game
cat > /etc/music-game/.env << 'EOF'
# Spotify Configuration
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=https://your-domain.com/api/auth/callback

# Frontend URL
FRONTEND_URL=https://your-domain.com

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com

# Server Configuration
PORT=8080
NODE_ENV=production
EOF
```

### 3. Update Startup Script to Use Secrets

Modify the startup script to fetch secrets:

```bash
# Add to startup script
gcloud secrets versions access latest --secret="spotify-client-id" > /etc/music-game/spotify-client-id
gcloud secrets versions access latest --secret="spotify-client-secret" > /etc/music-game/spotify-client-secret
gcloud secrets versions access latest --secret="firebase-service-account" > /etc/music-game/firebase-key.json

# Update .env file with actual values
sed -i "s/your-spotify-client-id/$(cat /etc/music-game/spotify-client-id)/g" /etc/music-game/.env
sed -i "s/your-spotify-client-secret/$(cat /etc/music-game/spotify-client-secret)/g" /etc/music-game/.env
```

## Monitoring & Logging

### 1. Enable Cloud Logging

```bash
# Install Cloud Logging agent
curl -sSO https://dl.google.com/cloudagents/add-logging-agent-repo.sh
sudo bash add-logging-agent-repo.sh
sudo apt-get update
sudo apt-get install google-fluentd

# Configure logging
sudo google-fluentd-setup
```

### 2. Create Monitoring Dashboard

```bash
# Create uptime check
gcloud monitoring uptime-checks create http music-game-health \
    --display-name="Music Game Health Check" \
    --uri="https://your-domain.com/health" \
    --period=60s \
    --timeout=10s
```

### 3. Set Up Alerts

```bash
# Create alerting policy
gcloud alpha monitoring policies create \
    --policy-from-file=alert-policy.yaml
```

Create `alert-policy.yaml`:

```yaml
displayName: "Music Game API Errors"
conditions:
  - displayName: "API Error Rate > 5%"
    conditionThreshold:
      filter: 'resource.type="gce_instance" AND resource.labels.instance_name="music-game-instance"'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 0.05
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_MEAN
          groupByFields:
            - resource.labels.instance_name
```

## CI/CD Pipeline

### 1. Create Cloud Build Configuration

Create `cloudbuild.yaml` in the root directory:

```yaml
steps:
  # Build frontend
  - name: 'node:18'
    entrypoint: npm
    args: ['install']
    dir: '.'
    
  - name: 'node:18'
    entrypoint: npm
    args: ['run', 'build']
    dir: '.'

  # Upload frontend to Cloud Storage
  - name: 'gcr.io/cloud-builders/gsutil'
    args: ['-m', 'rsync', '-r', '-d', 'dist/', 'gs://music-game-static/']

  # Build backend Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/music-game-api:$COMMIT_SHA', './server']
    dir: 'server'

  # Push Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/music-game-api:$COMMIT_SHA']

  # Deploy to Compute Engine
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - compute
      - ssh
      - music-game-instance
      - --zone=us-central1-a
      - --command=sudo docker pull gcr.io/$PROJECT_ID/music-game-api:$COMMIT_SHA && sudo docker stop music-game-api || true && sudo docker rm music-game-api || true && sudo docker run -d --name music-game-api --restart unless-stopped -p 8080:8080 --env-file /etc/music-game/.env gcr.io/$PROJECT_ID/music-game-api:$COMMIT_SHA

images:
  - 'gcr.io/$PROJECT_ID/music-game-api:$COMMIT_SHA'
```

### 2. Set Up GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Google Cloud

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Google Cloud CLI
      uses: google-github-actions/setup-gcloud@v0
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ secrets.GCP_PROJECT_ID }}
    
    - name: Submit build to Cloud Build
      run: |
        gcloud builds submit --config cloudbuild.yaml .
```

## Cost Optimization

### 1. Instance Sizing

```bash
# Use e2-micro for development/testing (cheapest)
# Use e2-small for production (better performance)
gcloud compute instances set-machine-type music-game-instance \
    --machine-type=e2-small \
    --zone=us-central1-a
```

### 2. Reserved Instances

```bash
# Purchase reserved instances for cost savings
gcloud compute reservations create music-game-reservation \
    --machine-type=e2-small \
    --zone=us-central1-a \
    --vm-count=1 \
    --min-cpu-platform=INTEL_AVX2
```

### 3. Budget Alerts

```bash
# Create budget
gcloud billing budgets create \
    --billing-account=YOUR_BILLING_ACCOUNT \
    --display-name="Music Game Budget" \
    --budget-amount=50USD \
    --threshold-rule=percent=0.5 \
    --threshold-rule=percent=0.8 \
    --threshold-rule=percent=1.0
```

## Troubleshooting

### 1. Common Issues

**Issue**: Container fails to start
```bash
# Check container logs
docker logs music-game-api

# Check environment variables
docker exec music-game-api env

# Restart container
docker restart music-game-api
```

**Issue**: Nginx configuration errors
```bash
# Test nginx configuration
nginx -t

# Reload nginx
systemctl reload nginx

# Check nginx logs
tail -f /var/log/nginx/error.log
```

**Issue**: SSL certificate issues
```bash
# Check certificate status
certbot certificates

# Renew certificates manually
certbot renew --dry-run
```

### 2. Performance Monitoring

```bash
# Monitor system resources
htop

# Check disk usage
df -h

# Monitor network connections
netstat -tulpn

# Check Docker resource usage
docker stats
```

### 3. Backup Strategy

```bash
# Create snapshot of the instance
gcloud compute disks snapshot music-game-instance \
    --snapshot-names=music-game-backup-$(date +%Y%m%d) \
    --zone=us-central1-a

# Backup environment configuration
cp /etc/music-game/.env /etc/music-game/.env.backup
```

## Security Best Practices

1. **Firewall Rules**: Only allow HTTP/HTTPS traffic
2. **IAM**: Use least privilege principle
3. **Secrets**: Never commit secrets to version control
4. **Updates**: Regularly update system packages
5. **Monitoring**: Set up alerts for suspicious activity

## Estimated Costs

- **Compute Engine (e2-micro)**: ~$5-8/month
- **Cloud Storage**: ~$0.02/GB/month
- **Load Balancer**: ~$18/month (if using managed SSL)
- **Total**: ~$25-30/month

For cost optimization, consider using Cloud Run instead of Compute Engine for the API, which can reduce costs to ~$5-10/month total.

## Next Steps

1. Set up monitoring and alerting
2. Implement automated backups
3. Configure CDN for better performance
4. Set up staging environment
5. Implement blue-green deployments

---

**Note**: Replace all placeholder values (your-domain.com, your-project-id, etc.) with your actual values before running the commands.