# AWS Hosting Guide for Music Game

This guide provides step-by-step instructions for hosting the Music Game application on AWS using EC2, nginx, Docker, and AWS Secrets Manager.

## Architecture Overview

```
Internet → CloudFront → S3 (Static Files) + ALB → EC2 (Express API)
                    ↓
              Route 53 (DNS)
```

## Prerequisites

- AWS Account with appropriate permissions
- Domain name (optional but recommended)
- Spotify Developer Account
- Firebase Project
- Docker installed locally

## Part 1: Static Frontend Hosting (S3 + CloudFront)

### 1.1 Build the Frontend

```bash
# In the project root
npm install
npm run build
```

This creates a `dist/` folder with the built React SPA.

### 1.2 Create S3 Bucket for Static Hosting

```bash
# Replace with your domain name
aws s3 mb s3://your-music-game-domain.com

# Enable static website hosting
aws s3 website s3://your-music-game-domain.com \
  --index-document index.html \
  --error-document index.html
```

### 1.3 Configure S3 Bucket Policy

Create `s3-bucket-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-music-game-domain.com/*"
    }
  ]
}
```

Apply the policy:
```bash
aws s3api put-bucket-policy \
  --bucket your-music-game-domain.com \
  --policy file://s3-bucket-policy.json
```

### 1.4 Upload Frontend Files

```bash
# Upload with cache headers for hashed files
aws s3 sync dist/ s3://your-music-game-domain.com \
  --delete \
  --cache-control "max-age=31536000" \
  --exclude "*.html" \
  --exclude "*.json"

# Upload HTML files without cache
aws s3 sync dist/ s3://your-music-game-domain.com \
  --delete \
  --cache-control "no-cache" \
  --include "*.html" \
  --include "*.json"
```

### 1.5 Create CloudFront Distribution

1. Go to CloudFront console
2. Create distribution
3. Origin settings:
   - Origin domain: `your-music-game-domain.com.s3-website-us-east-1.amazonaws.com`
   - Origin path: (leave empty)
   - Origin access: "Public"
4. Default cache behavior:
   - Viewer protocol policy: "Redirect HTTP to HTTPS"
   - Cache policy: "CachingOptimized"
   - Origin request policy: "CORS-S3Origin"
5. Error pages:
   - HTTP error code: 403, 404
   - Response page path: `/index.html`
   - Response code: 200

## Part 2: Express API Containerization

### 2.1 Create Dockerfile

Create `server/Dockerfile`:
```dockerfile
# Use Node.js 18 Alpine for smaller image
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

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8888

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8888/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/index.js"]
```

### 2.2 Create .dockerignore

Create `server/.dockerignore`:
```
node_modules
npm-debug.log
.env
.env.*
*.log
.git
.gitignore
README.md
coverage
.nyc_output
tests
__tests__
*.test.js
*.test.ts
```

### 2.3 Build and Test Docker Image

```bash
cd server
docker build -t music-game-api .
docker run -p 8888:8888 --env-file .env music-game-api
```

## Part 3: AWS Secrets Manager Setup

### 3.1 Store Secrets

```bash
# Store Spotify credentials
aws secretsmanager create-secret \
  --name "music-game/spotify-credentials" \
  --description "Spotify API credentials for music game" \
  --secret-string '{
    "SPOTIFY_CLIENT_ID": "your_spotify_client_id",
    "SPOTIFY_CLIENT_SECRET": "your_spotify_client_secret",
    "SPOTIFY_REDIRECT_URI": "https://your-domain.com/callback"
  }'

# Store Firebase service account
aws secretsmanager create-secret \
  --name "music-game/firebase-service-account" \
  --description "Firebase service account JSON" \
  --secret-string '{
    "FIREBASE_PROJECT_ID": "your_project_id",
    "FIREBASE_CLIENT_EMAIL": "your_client_email",
    "FIREBASE_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    "FIREBASE_DATABASE_URL": "https://your-project.firebaseio.com"
  }'
```

## Part 4: EC2 Instance Setup

### 4.1 Launch EC2 Instance

1. Use Amazon Linux 2023 AMI
2. Instance type: t3.small (2 vCPU, 2 GB RAM)
3. Security group: Allow HTTP (80), HTTPS (443), SSH (22)
4. Key pair: Create or use existing

### 4.2 Install Docker and Docker Compose

```bash
# Connect to EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Update system
sudo yum update -y

# Install Docker
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for group changes
exit
```

### 4.3 Install nginx

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip

# Install nginx
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 4.4 Configure nginx

Create `/etc/nginx/conf.d/music-game.conf`:
```nginx
upstream api_backend {
    server 127.0.0.1:8888;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration (we'll set this up with Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # API routes
    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "https://your-domain.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        add_header Access-Control-Allow-Credentials "true" always;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://your-domain.com";
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization";
            add_header Access-Control-Allow-Credentials "true";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://api_backend/health;
        access_log off;
    }
    
    # All other requests go to CloudFront (static files)
    location / {
        return 301 https://your-cloudfront-domain.cloudfront.net$request_uri;
    }
}
```

### 4.5 Set up SSL with Let's Encrypt

```bash
# Install certbot
sudo yum install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Set up auto-renewal
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## Part 5: Application Deployment

### 5.1 Create Docker Compose File

Create `docker-compose.yml` on EC2:
```yaml
version: '3.8'

services:
  api:
    image: your-ecr-repo/music-game-api:latest
    container_name: music-game-api
    restart: unless-stopped
    ports:
      - "127.0.0.1:8888:8888"
    environment:
      - NODE_ENV=production
      - PORT=8888
      - FRONTEND_URL=https://your-domain.com
      - WATCHER_MAX_CONCURRENCY=500
      - WATCHER_POLL_MS=1000
      - WATCHER_DEFAULT_BACKOFF_MS=15000
    secrets:
      - spotify_credentials
      - firebase_service_account
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8888/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

secrets:
  spotify_credentials:
    external: true
  firebase_service_account:
    external: true
```

### 5.2 Create Docker Secrets

```bash
# Create secrets from AWS Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id "music-game/spotify-credentials" \
  --query SecretString \
  --output text | docker secret create spotify_credentials -

aws secretsmanager get-secret-value \
  --secret-id "music-game/firebase-service-account" \
  --query SecretString \
  --output text | docker secret create firebase_service_account -
```

### 5.3 Deploy Application

```bash
# Pull latest image
docker-compose pull

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f api
```

## Part 6: DNS and Final Configuration

### 6.1 Configure Route 53

1. Create hosted zone for your domain
2. Add A record pointing to your EC2 instance
3. Add CNAME record for www pointing to your CloudFront distribution

### 6.2 Update Environment Variables

Update your frontend environment variables in the build process:

```bash
# In your CI/CD pipeline or build script
export VITE_API_URL=https://your-domain.com
export VITE_FIREBASE_API_KEY=your_firebase_api_key
export VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
export VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
export VITE_FIREBASE_PROJECT_ID=your_project_id
export VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
export VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
export VITE_FIREBASE_APP_ID=your_app_id

npm run build
```

## Part 7: Monitoring and Maintenance

### 7.1 Set up CloudWatch Logs

```bash
# Install CloudWatch agent
sudo yum install -y amazon-cloudwatch-agent

# Configure CloudWatch agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

### 7.2 Set up Alarms

Create CloudWatch alarms for:
- CPU utilization > 80%
- Memory utilization > 80%
- HTTP 4xx/5xx error rate > 5%
- Application health check failures

### 7.3 Backup Strategy

- S3 bucket versioning enabled
- Automated EBS snapshots
- Database backups (Firestore export)

## Part 8: Security Considerations

### 8.1 Security Groups

```bash
# Update security group to be more restrictive
aws ec2 create-security-group \
  --group-name music-game-api-sg \
  --description "Security group for music game API"

# Allow only necessary ports
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

### 8.2 IAM Roles

Create IAM role for EC2 instance with minimal permissions:
- SecretsManagerReadWrite
- CloudWatchLogsFullAccess
- S3ReadOnlyAccess (for logs)

## Part 9: CI/CD Pipeline (Optional)

### 9.1 GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v1
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Build and push Docker image
      run: |
        aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}
        docker build -t music-game-api ./server
        docker tag music-game-api:latest ${{ secrets.ECR_REGISTRY }}/music-game-api:latest
        docker push ${{ secrets.ECR_REGISTRY }}/music-game-api:latest
    
    - name: Deploy to EC2
      run: |
        ssh -o StrictHostKeyChecking=no ${{ secrets.EC2_USER }}@${{ secrets.EC2_HOST }} '
          docker-compose pull
          docker-compose up -d
        '
```

## Cost Estimation

Monthly costs (us-east-1, low traffic):
- EC2 t3.small: ~$15
- CloudFront: ~$5
- S3: ~$1
- Secrets Manager: ~$1
- Route 53: ~$1
- **Total: ~$23/month**

## Troubleshooting

### Common Issues

1. **CORS errors**: Check nginx configuration and ensure proper headers
2. **SSL certificate issues**: Verify Let's Encrypt renewal cron job
3. **Docker container not starting**: Check logs with `docker-compose logs api`
4. **Secrets not loading**: Verify IAM permissions for Secrets Manager

### Useful Commands

```bash
# Check application status
docker-compose ps

# View logs
docker-compose logs -f api

# Restart application
docker-compose restart api

# Check nginx status
sudo systemctl status nginx

# Test SSL certificate
sudo certbot certificates
```

## Extra Features Analysis

Based on the existing hosting_todo.md, here are the extra features mentioned and their necessity:

### Necessary Features:
1. **HTTPS/TLS enforcement** - Critical for security
2. **CORS configuration** - Required for frontend-backend communication
3. **Rate limiting** - Already implemented in Express server
4. **Health checks** - Important for monitoring
5. **Secrets management** - Critical for security

### Optional but Recommended:
1. **CloudWatch monitoring** - Good for production monitoring
2. **Auto-scaling** - Useful for traffic spikes
3. **CDN caching** - Improves performance
4. **Backup strategy** - Important for data protection

### Not Necessary for MVP:
1. **WAF (Web Application Firewall)** - Can be added later
2. **Advanced monitoring** - Basic CloudWatch is sufficient
3. **Multi-region deployment** - Single region is fine for most use cases

This setup provides a production-ready, scalable, and secure hosting solution for your music game application.