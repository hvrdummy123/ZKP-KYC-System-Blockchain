# Loading Aadhaar Data for Alice (and other users)

## Problem
When you issue Aadhaar cards using the backend script (`npm run issue-aadhaar`), the data is saved to `userData.json` on the server and registered on the blockchain, but it's NOT automatically available in the browser's localStorage where the frontend looks for it.

## Solution
We've added a "Load from Backend" button to the User Portal that fetches the data from `userData.json` and saves it to your browser's localStorage.

## Steps to Load Alice's Aadhaar Data:

### 1. Make sure you've issued the Aadhaar cards
```bash
npm run issue-aadhaar
```

### 2. Make sure the frontend has the latest userData.json
The userData.json file has been copied to `frontend/public/userData.json`.

You can also run the sync script to ensure all files are up to date:
```bash
node scripts/sync-all-frontend.js
```

### 3. Open the User Portal in your browser
Navigate to: http://localhost:3000/user

### 4. Connect Alice's wallet in MetaMask
- Open MetaMask
- Select Account #2 (Alice's account: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8)
  - This is the second Hardhat test account

### 5. Click "Load from Backend" button
- You'll see a button labeled "📥 Load from Backend" in the Aadhaar Information card
- Click it
- The app will fetch the userData.json file and match your connected wallet address with the data
- If successful, you'll see "✅ Successfully loaded data for Alice!"

### 6. Alice's Aadhaar data should now be displayed
You should now see:
- Name: Alice
- Aadhaar Number: 862652237497
- Date of Birth: 23/12/1984
- Age: 40 years old
- State: Maharashtra
- Gender: Female
- Age Status: ✅ Over 18

## For Other Users (Bob, Charlie)

The same process works for other users:

**Bob (Account #3):**
- Address: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
- Connect this wallet in MetaMask and click "Load from Backend"

**Charlie (Account #5):**
- Address: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
- Connect this wallet in MetaMask and click "Load from Backend"

## Technical Details

The "Load from Backend" feature:
1. Fetches `/userData.json` from the frontend's public folder
2. Matches your connected wallet address with the data in the file
3. Saves the matched user data to localStorage with key `user_${address}`
4. Updates the UI to display the Aadhaar information

## Alternative: Issue via Frontend Attester Portal

You can also issue new Aadhaar cards directly through the frontend:
1. Go to http://localhost:3000/attester
2. Connect the Attester wallet (Account #1 - the deployer)
3. Fill in the form with user details
4. Click "Issue Aadhaar Card"

Cards issued this way are automatically saved to localStorage.
