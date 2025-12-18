# MongoDB Deployment Guide for Render

## Overview

This guide will help you deploy the G.U.R.U POS Backend with MongoDB Atlas on Render.

## Prerequisites

- MongoDB Atlas account (free tier available)
- Render account (free tier available)
- Code pushed to GitHub repository

---

## Step 1: Set Up MongoDB Atlas

### 1.1 Create Atlas Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign in or create a free account
3. Create a new **FREE** M0 cluster
4. Choose your cloud provider and region (closest to your users)
5. Cluster Name: `pos-billing` (or any name you prefer)

### 1.2 Configure Database Access

1. In Atlas, go to **Database Access** (left sidebar)
2. Click **Add New Database User**
3. Authentication Method: **Password**
4. Username: `madhavmore23445_db_user` (or your preferred username)
5. Password: Create a strong password (save this securely!)
6. Database User Privileges: **Atlas Admin** or **Read and write to any database**
7. Click **Add User**

### 1.3 Configure Network Access

1. Go to **Network Access** (left sidebar)
2. Click **Add IP Address**
3. Select **Allow Access from Anywhere** (0.0.0.0/0)
   - This allows Render to connect to your database
4. Click **Confirm**

> [!WARNING]
> For production, restrict IP access to only Render's IP ranges after deployment.

### 1.4 Get Connection String

1. Go to **Database** (left sidebar)
2. Click **Connect** on your cluster
3. Choose **Connect your application**
4. Driver: **Node.js**, Version: **5.5 or later**
5. Copy the connection string, it looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` with your database username
7. Replace `<password>` with your database password
8. Add the database name before the `?`: `...mongodb.net/pos_billing?retryWrites=true&w=majority`

**Your final connection string:**
```
mongodb+srv://madhavmore23445_db_user:raghav123@cluster0.adw2jzh.mongodb.net/pos_billing?retryWrites=true&w=majority
```

---

## Step 2: Prepare Your Backend for Deployment

### 2.1 Environment Variables

Create a `.env` file locally (already in `.gitignore`):

```env
# MongoDB Configuration
MONGO_URI=mongodb+srv://madhavmore23445_db_user:raghav123@cluster0.adw2jzh.mongodb.net/pos_billing?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
NODE_ENV=production
```

> [!IMPORTANT]
> **NEVER commit `.env` to GitHub!** It's already in `.gitignore`.

### 2.2 Test Locally

Before deploying, test your backend locally:

```bash
cd backend
npm install
npm run dev
```

**Check health:**
```bash
curl http://localhost:3000/api/ping
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-18T...",
  "database": "MongoDB Atlas"
}
```

---

## Step 3: Deploy to Render

### 3.1 Push Code to GitHub

```bash
git add .
git commit -m "MongoDB migration complete"
git push origin main
```

### 3.2 Create Render Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Select your repository
5. Configure the service:

**Basic Settings:**
- **Name**: `guru-pos-backend` (or any name)
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Instance Type:**
- Select **Free** (for testing) or **Starter** (for production)

### 3.3 Configure Environment Variables

In Render, scroll down to **Environment Variables** section and add:

| Key | Value |
|-----|-------|
| `MONGO_URI` | `mongodb+srv://madhavmore23445_db_user:raghav123@cluster0.adw2jzh.mongodb.net/pos_billing?retryWrites=true&w=majority` |
| `JWT_SECRET` | Your secure JWT secret (generate a random string) |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |

> [!TIP]
> Generate a secure JWT secret:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 3.4 Deploy

1. Click **Create Web Service**
2. Render will automatically build and deploy your backend
3. Wait for deployment to complete (usually 2-3 minutes)

### 3.5 Verify Deployment

Once deployed, you'll get a URL like: `https://guru-pos-backend.onrender.com`

**Test health endpoint:**
```bash
curl https://guru-pos-backend.onrender.com/api/ping
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-18T...",
  "database": "MongoDB Atlas"
}
```

---

## Step 4: Test All Endpoints

### 4.1 Test Authentication

**Signup:**
```bash
curl -X POST https://guru-pos-backend.onrender.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "company": "Test Company"
  }'
```

**Login:**
```bash
curl -X POST https://guru-pos-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the `token` from the response for subsequent requests.

### 4.2 Test Items API

```bash
curl -X POST https://guru-pos-backend.onrender.com/api/items/batch \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "id": "item-1",
      "name": "Test Item",
      "price": 100,
      "category": "Electronics",
      "unit": "pcs",
      "inventory_qty": 10,
      "idempotency_key": "test-item-1"
    }]
  }'
```

### 4.3 Test Transactions API

```bash
curl -X POST https://guru-pos-backend.onrender.com/api/transactions/batch \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [{
      "id": "tx-1",
      "date": "2025-12-18T14:00:00Z",
      "subtotal": 100,
      "tax": 10,
      "grand_total": 110,
      "item_count": 1,
      "payment_type": "Cash",
      "status": "completed",
      "lines": [{"item_id": "item-1", "quantity": 1, "price": 100, "total": 100}]
    }]
  }'
```

---

## Step 5: Update Frontend Configuration

In your React Native frontend, update the API base URL:

**File: `frontend/src/config/api.js`**

```javascript
export const API_CONFIG = {
  BASE_URL: 'https://guru-pos-backend.onrender.com/api',
  TIMEOUT: 30000,
  HEADERS: {
    'Content-Type': 'application/json',
  }
};
```

---

## Step 6: Monitor and Maintain

### 6.1 Monitor Logs

In Render:
1. Go to your service
2. Click **Logs** tab
3. Monitor real-time logs for errors

### 6.2 Monitor MongoDB

In MongoDB Atlas:
1. Go to **Database** → **Collections**
2. View your data in `pos_billing` database
3. Check **Metrics** for performance insights

### 6.3 Automatic Indexes

MongoDB Atlas will create indexes automatically based on your Mongoose schemas. To verify:

```bash
# In MongoDB Atlas shell or Compass
use pos_billing
db.users.getIndexes()
db.items.getIndexes()
db.customers.getIndexes()
db.transactions.getIndexes()
```

---

## Troubleshooting

### Issue: "MongoServerError: bad auth"

**Solution**: Check your MongoDB Atlas credentials. Ensure the password in `MONGO_URI` is URL-encoded if it contains special characters.

### Issue: "ECONNREFUSED" or "connection timeout"

**Solution**: 
1. Check MongoDB Atlas Network Access (allow 0.0.0.0/0)
2. Ensure `MONGO_URI` is correct in Render environment variables
3. Check Atlas cluster is running

### Issue: "Invalid token" errors

**Solution**: Ensure `JWT_SECRET` is the same on frontend and backend (if using static secret). For production, backend should generate tokens.

### Issue: Slow response times

**Solution**:
1. Upgrade from Free tier to Starter on Render
2. Check MongoDB Atlas performance metrics
3. Ensure indexes are created properly

---

## Production Best Practices

1. **Security**:
   - Use strong `JWT_SECRET` (32+ characters random)
   - Restrict MongoDB Network Access to Render IPs only
   - Enable MongoDB Atlas encryption at rest

2. **Performance**:
   - Use Render Starter tier or higher for production
   - Enable MongoDB Atlas M10+ cluster for better performance
   - Implement caching for frequently accessed data

3. **Monitoring**:
   - Set up Render health checks
   - Enable MongoDB Atlas Performance Advisor
   - Implement error tracking (Sentry, etc.)

4. **Backups**:
   - Enable MongoDB Atlas automatic backups
   - Configure backup retention policy
   - Test restore procedures regularly

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret for JWT token signing | `your-secret-key` |
| `JWT_EXPIRES_IN` | JWT token expiration time | `7d` |
| `PORT` | Server port (auto-set by Render) | `3000` |
| `NODE_ENV` | Node environment | `production` |

---

## Additional Resources

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Render Documentation](https://render.com/docs)
- [Mongoose Documentation](https://mongoosejs.com/docs/)

---

## Support

If you encounter issues:
1. Check Render logs for backend errors
2. Check MongoDB Atlas metrics for database issues
3. Verify all environment variables are set correctly
4. Test endpoints using the examples above

**Your backend is now running on MongoDB Atlas with Render!** 🎉
