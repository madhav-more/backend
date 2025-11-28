import sequelize from '../config/database.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';

dotenv.config();

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('🌱 Seeding database...');

    // Sync database (force: true drops tables if they exist)
    await sequelize.sync({ force: true });

    // Create test user
    const password_hash = await bcrypt.hash('password123', 10);
    const [user] = await User.upsert({
      email: 'test@example.com',
      name: 'Test User',
      password_hash,
      company: 'G.U.R.U Store',
      location: 'Mumbai, India'
    });

    // Fetch the user to get the ID (upsert might not return the instance with ID in all dialects/versions correctly if not created)
    const userRecord = await User.findOne({ where: { email: 'test@example.com' } });

    console.log(`✅ Created user: test@example.com (password: password123)`);

    // Create customers
    const customers = [
      { _id: uuidv4(), name: 'Rajesh Kumar', phone: '+91 98765 43210', email: 'rajesh@example.com', address: 'Andheri, Mumbai' },
      { _id: uuidv4(), name: 'Priya Sharma', phone: '+91 98765 43211', email: 'priya@example.com', address: 'Bandra, Mumbai' },
      { _id: uuidv4(), name: 'Amit Patel', phone: '+91 98765 43212', email: 'amit@example.com', address: 'Powai, Mumbai' },
      { _id: uuidv4(), name: 'Sneha Desai', phone: '+91 98765 43213', address: 'Dadar, Mumbai' }
    ];

    for (const customer of customers) {
      await Customer.upsert({
        ...customer,
        user_id: userRecord._id
      });
    }
    console.log(`✅ Created ${customers.length} customers`);

    // Create items
    const items = [
      { _id: uuidv4(), name: 'Rice (1kg)', barcode: '8901234567891', sku: 'RICE-1KG', price: 60.00, unit: 'kg', category: 'Groceries', inventory_qty: 100 },
      { _id: uuidv4(), name: 'Milk (1L)', barcode: '8901234567892', sku: 'MILK-1L', price: 65.00, unit: 'ltr', category: 'Dairy', inventory_qty: 50 },
      { _id: uuidv4(), name: 'Bread', barcode: '8901234567893', sku: 'BREAD-01', price: 40.00, unit: 'pc', category: 'Bakery', inventory_qty: 30 },
      { _id: uuidv4(), name: 'Sugar (1kg)', barcode: '8901234567894', sku: 'SUGAR-1KG', price: 50.00, unit: 'kg', category: 'Groceries', inventory_qty: 75 },
      { _id: uuidv4(), name: 'Tea Powder (250g)', barcode: '8901234567895', sku: 'TEA-250G', price: 180.00, unit: 'gm', category: 'Beverages', inventory_qty: 40, recommended: true },
      { _id: uuidv4(), name: 'Eggs (12pc)', barcode: '8901234567896', sku: 'EGGS-12', price: 72.00, unit: 'dz', category: 'Dairy', inventory_qty: 25 },
      { _id: uuidv4(), name: 'Potato (1kg)', barcode: '8901234567897', sku: 'POTATO-1KG', price: 30.00, unit: 'kg', category: 'Vegetables', inventory_qty: 80 },
      { _id: uuidv4(), name: 'Onion (1kg)', barcode: '8901234567898', sku: 'ONION-1KG', price: 40.00, unit: 'kg', category: 'Vegetables', inventory_qty: 60 },
      { _id: uuidv4(), name: 'Tomato (1kg)', barcode: '8901234567899', sku: 'TOMATO-1KG', price: 50.00, unit: 'kg', category: 'Vegetables', inventory_qty: 45 },
      { _id: uuidv4(), name: 'Cooking Oil (1L)', barcode: '8901234567800', sku: 'OIL-1L', price: 150.00, unit: 'ltr', category: 'Groceries', inventory_qty: 35, recommended: true }
    ];

    for (const item of items) {
      await Item.upsert({
        ...item,
        user_id: userRecord._id
      });
    }
    console.log(`✅ Created ${items.length} items`);

    console.log('🎉 Database seeded successfully!');
    console.log('\n📝 Login credentials:');
    console.log('   Email: test@example.com');
    console.log('   Password: password123');

    await sequelize.close();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
