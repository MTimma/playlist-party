#!/bin/bash

# AWS Deployment Script for Music Game
# Usage: ./deploy-aws.sh [domain-name]

set -e

# Configuration
DOMAIN_NAME=${1:-"your-domain.com"}
AWS_REGION="us-east-1"
S3_BUCKET="$DOMAIN_NAME"
ECR_REPO="music-game-api"

echo "🚀 Starting AWS deployment for domain: $DOMAIN_NAME"

# Check prerequisites
echo "📋 Checking prerequisites..."
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }

# Build frontend
echo "🏗️ Building frontend..."
npm install
npm run build

# Create S3 bucket for static hosting
echo "📦 Creating S3 bucket for static hosting..."
aws s3 mb "s3://$S3_BUCKET" --region $AWS_REGION || echo "Bucket already exists"

# Configure S3 bucket for static website hosting
echo "⚙️ Configuring S3 bucket for static website hosting..."
aws s3 website "s3://$S3_BUCKET" \
  --index-document index.html \
  --error-document index.html

# Create S3 bucket policy
echo "🔐 Creating S3 bucket policy..."
cat > s3-bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$S3_BUCKET/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket "$S3_BUCKET" \
  --policy file://s3-bucket-policy.json

# Upload frontend files
echo "📤 Uploading frontend files to S3..."
aws s3 sync dist/ "s3://$S3_BUCKET" \
  --delete \
  --cache-control "max-age=31536000" \
  --exclude "*.html" \
  --exclude "*.json"

aws s3 sync dist/ "s3://$S3_BUCKET" \
  --delete \
  --cache-control "no-cache" \
  --include "*.html" \
  --include "*.json"

# Create ECR repository
echo "🐳 Creating ECR repository..."
aws ecr create-repository --repository-name $ECR_REPO --region $AWS_REGION || echo "Repository already exists"

# Get ECR login token
echo "🔑 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push Docker image
echo "🏗️ Building and pushing Docker image..."
cd server
docker build -t $ECR_REPO .
docker tag $ECR_REPO:latest $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest
docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest
cd ..

# Create CloudFront distribution
echo "☁️ Creating CloudFront distribution..."
cat > cloudfront-config.json << EOF
{
  "CallerReference": "$(date +%s)",
  "Comment": "Music Game Static Files",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-$S3_BUCKET",
        "DomainName": "$S3_BUCKET.s3-website-$AWS_REGION.amazonaws.com",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only"
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-$S3_BUCKET",
    "ViewerProtocolPolicy": "redirect-to-https",
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  },
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      {
        "ErrorCode": 403,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200"
      },
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200"
      }
    ]
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF

DISTRIBUTION_ID=$(aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json \
  --query 'Distribution.Id' \
  --output text)

echo "✅ CloudFront distribution created with ID: $DISTRIBUTION_ID"

# Create Route 53 hosted zone (if domain is provided)
if [ "$DOMAIN_NAME" != "your-domain.com" ]; then
  echo "🌐 Creating Route 53 hosted zone..."
  HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
    --name $DOMAIN_NAME \
    --caller-reference $(date +%s) \
    --query 'HostedZone.Id' \
    --output text | sed 's/\/hostedzone\///')
  
  echo "✅ Hosted zone created with ID: $HOSTED_ZONE_ID"
  echo "📝 Please update your domain's nameservers to:"
  aws route53 get-hosted-zone --id $HOSTED_ZONE_ID --query 'DelegationSet.NameServers' --output text
fi

# Clean up temporary files
echo "🧹 Cleaning up temporary files..."
rm -f s3-bucket-policy.json cloudfront-config.json

echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Set up your EC2 instance with the provided configuration"
echo "2. Configure nginx and SSL certificates"
echo "3. Deploy the Docker container to your EC2 instance"
echo "4. Update DNS records to point to your CloudFront distribution"
echo ""
echo "🔗 CloudFront URL: https://$DISTRIBUTION_ID.cloudfront.net"
echo "📦 S3 Bucket: $S3_BUCKET"
echo "🐳 ECR Repository: $ECR_REPO"