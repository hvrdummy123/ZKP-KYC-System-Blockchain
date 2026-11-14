# Restart Guide

If you encounter the error: `could not decode result data (value="0x")`, it means the Hardhat local blockchain node is not running or the contracts are not deployed.

## Steps to Restart:

### 1. Start Hardhat Node
```bash
# In terminal 1 (from project root)
npx hardhat node
```

Keep this terminal running. You should see output like:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/
```

### 2. Deploy Contracts
```bash
# In terminal 2 (from project root)
npx hardhat run scripts/02-deploy-all-contracts.js --network localhost
```

This should output deployed contract addresses.

### 3. Update Frontend Deployment Files
```bash
# Copy the deployment info to frontend (from project root)
cp deployments.json frontend/public/deployments.json
```

### 4. (Optional) Issue Test Aadhaar Cards
```bash
# Issue Aadhaar to test accounts
npx hardhat run scripts/03-issue-aadhaar.js --network localhost
```

### 5. Start Frontend
```bash
# In terminal 3 (from frontend directory)
cd frontend
npm run dev
```

## Quick Fix Command (All at once - after starting hardhat node):
```bash
# From project root
npx hardhat run scripts/02-deploy-all-contracts.js --network localhost && \
cp deployments.json frontend/public/deployments.json && \
npx hardhat run scripts/03-issue-aadhaar.js --network localhost
```

Then refresh your browser!
