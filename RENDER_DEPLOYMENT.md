# Backend Deployment Guide for Render

## Step 1: Push Code to GitHub (if not already done)

```bash
cd /Users/madhavmore/Documents/pos-final-project-main/pos-billing-phase-2/pos-billing-part-6/backend
git init
git add .
git commit -m "Backend ready for Render deployment with PostgreSQL"
# Push to your GitHub repository
```

## Step 2: Deploy to Render

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `guru-pos-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

## Step 3: Configure Environment Variables

In Render dashboard, add these environment variables:

```
DATABASE_URL = postgresql://posbilling_pemx_user:X0tLB5dXibSAkDPnMQArbCFF7fhI42bX@dpg-d4ks5ku3jp1c7391l7lg-a.oregon-postgres.render.com/posbilling_pemx
PORT = 10000
JWT_SECRET = your-super-secret-jwt-key-change-in-production-2024
JWT_EXPIRES_IN = 7d
NODE_ENV = production
```

## Step 4: Run Database Migration

After deployment succeeds, run migration via Render Shell:

```bash
npm run migrate
```

## Step 5: Get Your Backend URL

Your backend URL will be: `https://guru-pos-backend.onrender.com`

**Note**: Render free tier services spin down after inactivity. First request may take 30-60 seconds.

## Alternative: Manual Deployment (Without Git)

If you don't want to use Git:

1. Create a new Web Service on Render
2. Choose "Deploy from uploaded file"
3. Zip your backend folder
4. Upload and configure as above

## Testing Your Backend

Once deployed, test with:

```bash
curl https://guru-pos-backend.onrender.com/api/ping
```

Expected response:
```json
{"status":"ok","timestamp":"2024-..."}
```

## Troubleshooting

- **Database connection fails**: Verify DATABASE_URL is correct
- **Build fails**: Check Node version (should be >= 18)
- **Migration fails**: Run it manually via Render Shell
- **Service times out**: Free tier has cold starts, wait 30-60 seconds
