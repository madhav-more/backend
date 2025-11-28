# G.U.R.U POS Backend API (MySQL)

Node.js + Express REST API with MySQL database for the G.U.R.U POS application.

## Features

- **JWT Authentication**: Secure user signup/login with bcrypt password hashing
- **Two-way Delta Sync**: Conflict resolution based on `updatedAt` timestamps  
- **Inventory Management**: Automatic inventory deduction on transaction creation
- **Idempotent Operations**: Client-generated UUIDs prevent duplicate records
- **Comprehensive Reports**: Sales analytics with customer and item details
- **Local-first Compatible**: Designed to work with offline-first mobile app

## Prerequisites

- Node.js >= 18.0.0
- MySQL Server

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Update `.env` file with your MySQL credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Madhav@1234
DB_NAME=pos-billing
DB_DIALECT=mysql
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
```

**⚠️ IMPORTANT**: Change `JWT_SECRET` in production!

### 3. Seed Database (Optional)

```bash
npm run seed
```

Creates test user and sample data:
- **Email**: test@example.com
- **Password**: password123
- 4 customers
- 10 items with inventory

### 4. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000`

### 5. Test Connection

```bash
curl http://localhost:3000/api/ping
```

Expected response:
```json
{"status":"ok","timestamp":"..."}
```

## Database Schema

### users
- _id (UUID, PK)
- name, email (unique), password_hash
- company, location
- createdAt, updatedAt

### customers
- _id (String, PK)
- user_id (String)
- name, phone, email, address
- idempotency_key (String)
- createdAt, updatedAt

### items
- _id (String, PK)
- user_id (String)
- name, barcode, sku
- price (numeric), unit
- inventory_qty (numeric)
- category, recommended
- idempotency_key (String)
- createdAt, updatedAt

### transactions
- _id (String, PK)
- user_id (String)
- customer_id (String, nullable)
- date, subtotal, tax, discount, other_charges, grand_total
- item_count, unit_count
- payment_type (cash|card|upi|online|credit)
- status (draft|completed|saved_for_later)
- receipt_path
- voucher_number, provisional_voucher
- idempotency_key
- lines (JSON)
- createdAt, updatedAt

## Conflict Resolution

- **Items & Customers**: Last-write-wins based on `updatedAt` timestamp
- **Transactions**: Append-only, idempotent by UUID (duplicates rejected)
- Client receives conflicts in sync response to resolve locally

## Inventory Management

When transactions are created via `/api/transactions/batch`:
1. Transaction and lines inserted atomically (MySQL Transaction)
2. For each line with `item_id`, inventory decremented: `inventory_qty -= quantity`
3. Negative inventory allowed but warning returned
4. Rollback on any error

## License

Private - G.U.R.U POS System
