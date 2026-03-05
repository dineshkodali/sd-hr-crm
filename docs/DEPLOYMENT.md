# Deployment Guide - SD HR CRM

This guide covers deploying the SD HR CRM application to AWS Amplify (frontend) and AWS services (backend).

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Frontend Deployment (AWS Amplify)](#frontend-deployment-aws-amplify)
- [Backend Deployment Options](#backend-deployment-options)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│   GitHub    │─────▶│  AWS Amplify     │─────▶│  CloudFront │
│ Repository  │      │  (Frontend)      │      │     CDN     │
└─────────────┘      └──────────────────┘      └─────────────┘
                              │
                              │ API Calls
                              ▼
                     ┌──────────────────┐      ┌─────────────┐
                     │  Backend Server  │─────▶│ PostgreSQL  │
                     │ (EB/ECS/EC2)     │      │     RDS     │
                     └──────────────────┘      └─────────────┘
```

---

## Prerequisites

### Required Accounts
- ✅ AWS Account with billing enabled
- ✅ GitHub account with repository access
- ✅ Domain name (optional, for custom domain)

### Required Tools
- ✅ Git installed locally
- ✅ Node.js 18+ installed
- ✅ AWS CLI installed (optional, for backend deployment)

### Repository Setup
1. Ensure your code is pushed to GitHub
2. Verify `.gitignore` excludes `.env` files
3. ✅ **All dependencies are properly listed in `package.json` files**
   - Frontend: Includes all runtime and dev dependencies (including `gh-pages` for deployment)
   - Backend: All npm packages properly listed (local file references removed)
   - Root: Monorepo scripts and shared dependencies configured


---

## Frontend Deployment (AWS Amplify)

### Step 1: Prepare Your Repository

1. **Verify Build Configuration**
   ```bash
   cd frontend
   npm run build
   ```
   - Should create a `dist` folder
   - Check for any build errors

2. **Commit Configuration Files**
   ```bash
   git add amplify.yml frontend/.env.example
   git commit -m "Add AWS Amplify configuration"
   git push origin main
   ```

### Step 2: Create Amplify App

1. **Go to AWS Amplify Console**
   - Navigate to: https://console.aws.amazon.com/amplify/
   - Click "New app" → "Host web app"

2. **Connect GitHub Repository**
   - Select "GitHub" as source
   - Authorize AWS Amplify to access your GitHub
   - Select your repository: `sd-hr-crm`
   - Select branch: `main` (or your default branch)

3. **Configure Build Settings**
   - Amplify should auto-detect `amplify.yml`
   - Verify the build configuration:
     ```yaml
     version: 1
     frontend:
       phases:
         preBuild:
           commands:
             - cd frontend
             - npm ci
         build:
           commands:
             - npm run build
       artifacts:
         baseDirectory: frontend/dist
         files:
           - '**/*'
     ```

4. **Configure App Name**
   - App name: `sd-hr-crm` (or your preferred name)
   - Environment: `production`

### Step 3: Set Environment Variables

In Amplify Console → App Settings → Environment variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | `https://your-backend-url.com` | Your backend API URL |

**Important:** Don't add a trailing slash to `VITE_API_URL`

### Step 4: Deploy

1. Click "Save and deploy"
2. Wait for build to complete (5-10 minutes)
3. Access your app at: `https://[app-id].amplifyapp.com`

### Step 5: Custom Domain (Optional)

1. Go to App Settings → Domain management
2. Click "Add domain"
3. Enter your domain name
4. Follow DNS configuration instructions
5. Wait for SSL certificate provisioning

---

## Backend Deployment Options

Choose one of these options for deploying your Node.js backend:

### Option A: AWS Elastic Beanstalk (Recommended - Easiest)

#### 1. Install EB CLI
```bash
pip install awsebcli
```

#### 2. Initialize Elastic Beanstalk
```bash
cd Backend
eb init -p node.js-18 sd-hr-crm-backend --region us-east-1
```

#### 3. Create Environment
```bash
eb create production-env
```

#### 4. Set Environment Variables
```bash
eb setenv \
  DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
  JWT_SECRET="your-secret-key" \
  NODE_ENV="production" \
  CORS_ORIGINS="https://your-amplify-app.amplifyapp.com" \
  EMAIL_SERVICE="outlook" \
  EMAIL_USER="your-email@outlook.com" \
  EMAIL_PASS="your-password" \
  EMAIL_FROM="your-email@outlook.com"
```

#### 5. Deploy
```bash
eb deploy
```

#### 6. Get Backend URL
```bash
eb status
```
- Copy the CNAME (e.g., `production-env.us-east-1.elasticbeanstalk.com`)
- Use this as your `VITE_API_URL` in Amplify

### Option B: AWS ECS (Container-based)

#### 1. Create Dockerfile (Backend)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
```

#### 2. Build and Push to ECR
```bash
aws ecr create-repository --repository-name sd-hr-crm-backend
docker build -t sd-hr-crm-backend .
docker tag sd-hr-crm-backend:latest [ECR-URL]/sd-hr-crm-backend:latest
docker push [ECR-URL]/sd-hr-crm-backend:latest
```

#### 3. Create ECS Service
- Use AWS Console or CLI to create ECS cluster
- Create task definition with environment variables
- Create service with load balancer

### Option C: AWS EC2 (Traditional Server)

#### 1. Launch EC2 Instance
- AMI: Ubuntu 22.04 LTS
- Instance type: t3.small or larger
- Security group: Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS), 4000 (API)

#### 2. Connect and Setup
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone repository
git clone https://github.com/your-username/sd-hr-crm.git
cd sd-hr-crm/Backend

# Install dependencies
npm install

# Create .env file
nano .env
# (Paste your environment variables)

# Start with PM2
pm2 start server.js --name sd-hr-crm-api
pm2 save
pm2 startup
```

#### 3. Setup Nginx Reverse Proxy
```bash
sudo apt install nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/sd-hr-crm
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sd-hr-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Database Setup

### Option 1: AWS RDS PostgreSQL (Recommended)

1. **Create RDS Instance**
   - Go to AWS RDS Console
   - Click "Create database"
   - Engine: PostgreSQL 15+
   - Template: Production or Dev/Test
   - Instance size: db.t3.micro (free tier) or larger
   - Storage: 20GB minimum
   - Enable automatic backups

2. **Configure Security Group**
   - Allow inbound PostgreSQL (port 5432) from:
     - Your backend server security group
     - Your local IP (for setup)

3. **Get Connection String**
   ```
   postgresql://username:password@endpoint:5432/database_name
   ```

4. **Run Database Migrations**
   - Connect using your preferred PostgreSQL client
   - Run your schema creation scripts
   - Import initial data if needed

### Option 2: Supabase (Managed PostgreSQL)

1. Create account at https://supabase.com
2. Create new project
3. Copy connection string from Settings → Database
4. Use as `DATABASE_URL`

---

## Environment Variables

### Frontend (AWS Amplify)

Set in Amplify Console → Environment variables:

```
VITE_API_URL=https://your-backend-url.com
```

### Backend (Elastic Beanstalk/ECS/EC2)

Required variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Server
PORT=4000
NODE_ENV=production

# CORS - Add your Amplify URL
CORS_ORIGINS=https://main.d1234567890.amplifyapp.com,https://your-custom-domain.com

# Email (Outlook)
EMAIL_SERVICE=outlook
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
EMAIL_FROM=your-email@outlook.com
```

**Security Tips:**
- Generate JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Never commit `.env` files to Git
- Use AWS Secrets Manager for production secrets

---

## Post-Deployment

### 1. Test Frontend
- ✅ Visit your Amplify URL
- ✅ Verify pages load correctly
- ✅ Check browser console for errors

### 2. Test Backend API
```bash
curl https://your-backend-url.com/api/health
# Should return: {"ok":true,"ts":1234567890}
```

### 3. Test Full Integration
- ✅ Try logging in
- ✅ Test OTP email delivery
- ✅ Verify database operations
- ✅ Check file uploads work

### 4. Monitor Logs

**Amplify Logs:**
- Amplify Console → App → Build logs

**Backend Logs:**
- Elastic Beanstalk: EB Console → Logs
- ECS: CloudWatch Logs
- EC2: `pm2 logs` or `/var/log/nginx/`

### 5. Setup Monitoring

**CloudWatch Alarms:**
- CPU usage > 80%
- Memory usage > 80%
- Error rate > 5%
- Response time > 2s

---

## Troubleshooting

### Frontend Build Fails

**Error: "Module not found"**
```bash
# Solution: Ensure all dependencies are in package.json
cd frontend
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

**Error: "Build timeout"**
```yaml
# Solution: Increase build timeout in amplify.yml
version: 1
frontend:
  phases:
    build:
      commands:
        - npm run build
  buildTimeout: 30  # minutes
```

### Backend Connection Issues

**Error: "CORS policy"**
```javascript
// Solution: Add Amplify URL to CORS_ORIGINS
CORS_ORIGINS=https://main.d1234567890.amplifyapp.com
```

**Error: "Database connection failed"**
```bash
# Solution: Check security group allows connection
# Test connection:
psql "postgresql://user:pass@host:5432/dbname"
```

### Email Not Sending

**Check email configuration:**
```bash
# Verify environment variables are set
echo $EMAIL_USER
echo $EMAIL_SERVICE

# Test email from backend
curl -X POST https://your-backend/api/email-config/test \
  -H "Content-Type: application/json" \
  -d '{"type":"otp","recipientEmail":"test@example.com"}'
```

---

## Rollback Procedure

### Amplify Rollback
1. Go to Amplify Console → App
2. Click on previous successful build
3. Click "Redeploy this version"

### Backend Rollback

**Elastic Beanstalk:**
```bash
eb deploy --version previous-version-label
```

**EC2:**
```bash
git checkout previous-commit
pm2 restart sd-hr-crm-api
```

---

## Cost Estimation

### AWS Amplify (Frontend)
- Build minutes: ~$0.01/minute
- Hosting: ~$0.15/GB stored + $0.15/GB served
- Estimated: **$5-20/month** for small-medium traffic

### Elastic Beanstalk (Backend)
- t3.small instance: ~$15/month
- Load balancer: ~$20/month
- Estimated: **$35-50/month**

### RDS PostgreSQL
- db.t3.micro: ~$15/month (free tier eligible)
- Storage: ~$2.30/month for 20GB
- Estimated: **$15-20/month**

**Total Estimated Cost: $55-90/month**

---

## Support & Resources

- AWS Amplify Docs: https://docs.amplify.aws/
- AWS Elastic Beanstalk: https://docs.aws.amazon.com/elasticbeanstalk/
- PostgreSQL on RDS: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/

---

## Quick Reference Commands

```bash
# Build frontend locally
cd frontend && npm run build

# Test backend locally
cd Backend && npm start

# Deploy to Amplify (automatic on git push)
git push origin main

# Deploy backend to EB
cd Backend && eb deploy

# View backend logs
eb logs

# Check backend status
curl https://your-backend/api/health
```
