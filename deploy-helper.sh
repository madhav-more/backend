#!/bin/bash

# Quick Deploy to Render - Interactive Helper Script

echo "🚀 G.U.R.U POS - Deploy to Render"
echo "=================================="
echo ""

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    exit 1
fi

echo "✅ Backend directory confirmed"
echo ""

echo "📋 Deployment Checklist:"
echo "1. Have you created a Render account? (https://render.com)"
echo "2. Do you have the PostgreSQL credentials from Render?"
echo "3. Is your backend code ready?"
echo ""

read -p "Press Enter to continue..."

echo ""
echo "🔧 Next Steps:"
echo ""
echo "Option A: Deploy via GitHub (Recommended)"
echo "  1. Push this code to GitHub"
echo "  2. Go to Render Dashboard"
echo "  3. New+ → Web Service"
echo "  4. Connect GitHub repo"
echo "  5. Configure as per RENDER_DEPLOYMENT.md"
echo ""

echo "Option B: Deploy via Render CLI"
echo "  1. Install: npm install -g render-cli"
echo "  2. Login: render login"
echo "  3. Deploy: render deploy"
echo ""

echo "Option C: Manual Upload"
echo "  1. Zip backend folder"
echo "  2. Go to Render Dashboard"
echo "  3. New+ → Web Service → Upload"
echo ""

echo "📚 Full guide: backend/RENDER_DEPLOYMENT.md"
echo ""

echo "After deployment:"
echo "  Backend URL: https://guru-pos-backend.onrender.com"
echo "  Test: curl https://guru-pos-backend.onrender.com/api/ping"
echo ""

echo "Then build APK:"
echo "  cd ../frontend"
echo "  eas login"
echo "  eas build --platform android --profile preview"
echo ""

echo "✨ Good luck!"
