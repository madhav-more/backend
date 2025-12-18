# Quick Test Script for MongoDB Backend

# Test health endpoint
echo "Testing health endpoint..."
curl -s http://localhost:3000/api/ping | jq '.'

# Note: For authenticated endpoints, you need a token first
# Get token by signing up/logging in:
# curl -X POST http://localhost:3000/api/auth/signup \
#   -H "Content-Type: application/json" \
#   -d '{"name":"Test","email":"test@test.com","password":"test123","company":"Test Co"}'
