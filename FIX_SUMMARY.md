# Fix for "Aadhaar Hash Mismatch" Error

## Root Causes Identified

### 1. Hash Generation Method Mismatch ✅ FIXED
**Problem:** The frontend's `proofGenerator.js` was using `F.toString()` instead of `F.toObject()` for hash generation.

**Impact:** 
- Backend (scripts/03-issue-aadhaar.js) used `F.toObject()` → returns BigInt
- Frontend used `F.toString()` → returns string
- Different hash values caused verification to fail

**Solution:** Updated `/frontend/lib/proofGenerator.js`:
```javascript
// Before (WRONG):
return F.toString(hash);

// After (CORRECT):
return F.toObject(hash);
```

**Files Changed:**
- `frontend/lib/proofGenerator.js` - Fixed `generateAadhaarHash()`, `generateSecretHash()`, and `generateStateCommitment()`

### 2. User Data Not Available in Frontend ✅ FIXED
**Problem:** When Aadhaar cards are issued via backend scripts, the data is stored in `userData.json` but not automatically available to the frontend.

**Impact:** Users couldn't generate proofs because their Aadhaar data wasn't in localStorage.

**Solution:**
1. Created sync script to copy `userData.json` to `frontend/public/`
2. Added auto-load functionality in User page to fetch backend-issued data
3. Added manual "Load Backend Data" button for troubleshooting

**Files Changed:**
- `scripts/sync-userdata-to-frontend.js` - NEW: Syncs userData.json to frontend
- `frontend/app/user/page.js` - Added `loadBackendUserData()` function and UI button

## Testing Instructions

### Step 1: Sync User Data to Frontend
```bash
cd /Users/rajatb/Developer/Capstone/zkp-kyc-system
node scripts/sync-userdata-to-frontend.js
```

Expected output:
```
✅ User data synced to frontend/public/userData.json

Users:
- Alice: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
- Bob: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
- Charlie: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
```

### Step 2: Verify Frontend is Running
```bash
cd frontend
npm run dev
```

### Step 3: Test with Alice's Account
1. Open browser to `http://localhost:3000/user`
2. Connect wallet with Alice's address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
3. The page should auto-load Alice's data from `/userData.json`
4. You should see:
   - Name: Alice
   - Aadhaar Number: 256542727357
   - Age: 22 years old (born 2003)
   - Status: ✅ Over 18

### Step 4: Request Verification
1. Go to `/verifier` page
2. Connect as Company account: `0x90F79bf6EB2c4f870365E785982E1f101E93b906`
3. Request verification for Alice's address
4. Go back to `/user` page (as Alice)
5. Click "Generate Proof" on the pending request

### Step 5: Verify Success
Check console logs for:
```
📋 USER DATA BEING USED FOR PROOF
aadhaarNumber: 256542727357
birthYear: 2003
...
salt: 981409227

🔐 EXPECTED HASH COMPUTATION:
Computed hash: 21342848441225785858116990120826297899003464946968678851088647493549321009322
```

The hash should match the on-chain value: `21342848441225785858116990120826297899003464946968678851088647493549321009322`

## Verification Checklist

- [ ] Run sync script: `node scripts/sync-userdata-to-frontend.js`
- [ ] Clear browser localStorage (F12 → Application → Local Storage → Clear All)
- [ ] Connect wallet as Alice
- [ ] Verify userData loads automatically
- [ ] Check console for correct hash computation
- [ ] Generate proof successfully
- [ ] Transaction completes without "Aadhaar hash mismatch" error

## Common Issues & Solutions

### Issue: "No Aadhaar data found"
**Solution:** Click "Load Backend Data" button or run sync script again

### Issue: Hash still doesn't match
**Possible Causes:**
1. Frontend using cached old code - Hard refresh (Cmd+Shift+R)
2. Different data in localStorage vs blockchain - Clear localStorage and reload
3. Wrong wallet address - Verify you're using the address from userData.json

### Issue: Proof generation fails
**Check:**
1. Are circuit files in `/frontend/public/circuits/`?
2. Is hardhat node running?
3. Are contracts deployed?
4. Is the wallet unlocked in MetaMask?

## Technical Details

### Hash Computation Flow
1. **Issuance (Backend):**
   ```
   Poseidon([aadhaarNumber, birthYear, birthMonth, birthDay, salt])
   → F.toObject() → BigInt → ethers.js → uint256 on-chain
   ```

2. **Proof Generation (Frontend):**
   ```
   Poseidon([aadhaarNumber, birthYear, birthMonth, birthDay, salt])
   → F.toObject() → BigInt → .toString() → Circuit Input
   → Circuit computes hash → Public Signal[5]
   ```

3. **Verification (Contract):**
   ```solidity
   require(publicSignals[5] == userAadhaarHash, "Aadhaar hash mismatch");
   ```

### Why F.toObject() vs F.toString()
- `F.toObject(hash)` → Returns native BigInt: `123...n`
- `F.toString(hash)` → Returns string: `"123..."`
- Smart contracts store uint256, which matches BigInt semantics
- Circuit field elements also match BigInt representation
- Conversion to string happens at the circuit input stage

## Files Modified

1. ✅ `frontend/lib/proofGenerator.js` - Hash generation methods
2. ✅ `frontend/app/user/page.js` - Auto-load backend data
3. ✅ `scripts/sync-userdata-to-frontend.js` - NEW sync script
4. ✅ `frontend/public/userData.json` - Synced user data

## Next Steps

Once verification works:
1. Test with Bob (under 18) - should work but return "NO"
2. Test with Charlie (over 18) - should work and return "YES"
3. Test state verification
4. Test gender verification

## Debugging Commands

```bash
# Check on-chain hash for Alice
npx hardhat console --network localhost
> const deployments = require('./deployments.json')
> const attester = await ethers.getContractAt('AttesterContract', deployments.attesterContract)
> const alice = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
> await attester.getPublicCommitments(alice)

# Compute hash with backend method
node -e "
const pg = require('./src/ProofGenerator.js');
const gen = new pg();
(async () => {
  await gen.init();
  console.log(gen.generateAadhaarHash('256542727357', 2003, 3, 6, 981409227));
})();
"
```
