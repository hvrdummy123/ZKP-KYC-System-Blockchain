# Quick Testing Guide - Multi-Verification Frontend

## 🚀 Getting Started

### 1. Start the Development Server
```bash
cd frontend
npm run dev
```

Visit: http://localhost:3000

### 2. Make Sure Hardhat Node is Running
```bash
# In another terminal
cd /Users/rajatb/Developer/Capstone/zkp-kyc-system
npx hardhat node
```

---

## 👥 Test Accounts

### Alice - 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
- 🎂 Age: **45 years old** (Over 18 ✅)
- ⚧ Gender: **Female** (2)
- 📍 State: **Maharashtra** (27)

### Bob - 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
- 🎂 Age: **12 years old** (Under 18 ❌)
- ⚧ Gender: **Male** (1)
- 📍 State: **Karnataka** (29)

### Charlie - 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
- 🎂 Age: **30 years old** (Over 18 ✅)
- ⚧ Gender: **Transgender** (3)
- 📍 State: **Delhi** (7)

---

## 🧪 Test Scenarios

### Scenario 1: Age Verification (Alice)
**Expected Result: ✅ PASS**

1. **Verifier Portal** (http://localhost:3000/verifier)
   - Select: "🎂 Age Verification (Over 18)"
   - Enter Alice's address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - Click "Request Verification"
   - Pay 0.001 ETH fee

2. **User Portal** (http://localhost:3000/user)
   - Connect as Alice
   - See pending request
   - Preview shows: "Your answer will be: YES (Over 18)"
   - Click "🔐 Generate & Submit ZK Proof"
   - Wait 10-30 seconds

3. **Verifier Portal** - Check Result
   - Auto-refreshes every 5 seconds
   - Result: **✅ Over 18**

---

### Scenario 2: Gender Verification - Match (Alice is Female)
**Expected Result: ✅ PASS**

1. **Verifier Portal**
   - Select: "⚧ Gender Verification"
   - Required Gender: **Female**
   - Enter Alice's address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - Click "Request Verification"

2. **User Portal** (Alice)
   - See pending gender request
   - Badge shows: "⚧ Gender"
   - Question: "Is this user Female?"
   - Preview: "Your answer will be: YES (Female)"
   - Click "🔐 Generate & Submit ZK Proof"

3. **Verifier Portal**
   - Result: **✅ Female**

---

### Scenario 3: Gender Verification - No Match (Alice is NOT Male)
**Expected Result: ❌ FAIL**

1. **Verifier Portal**
   - Select: "⚧ Gender Verification"
   - Required Gender: **Male**
   - Enter Alice's address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - Click "Request Verification"

2. **User Portal** (Alice)
   - Question: "Is this user Male?"
   - Preview: "Your answer will be: NO (Not Male)"
   - Click "🔐 Generate & Submit ZK Proof"

3. **Verifier Portal**
   - Result: **❌ Not Male**

---

### Scenario 4: State Verification - Match (Bob lives in Karnataka)
**Expected Result: ✅ PASS**

1. **Verifier Portal**
   - Select: "📍 State of Residence"
   - Required State: **Karnataka (29)**
   - Enter Bob's address: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`
   - Click "Request Verification"

2. **User Portal** (Bob)
   - Badge: "📍 State"
   - Question: "Does this user live in Karnataka?"
   - Preview: "Your answer will be: YES (Karnataka)"
   - Click "🔐 Generate & Submit ZK Proof"

3. **Verifier Portal**
   - Result: **✅ Karnataka**

---

### Scenario 5: State Verification - No Match (Bob does NOT live in Maharashtra)
**Expected Result: ❌ FAIL**

1. **Verifier Portal**
   - Select: "📍 State of Residence"
   - Required State: **Maharashtra (27)**
   - Enter Bob's address: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`
   - Click "Request Verification"

2. **User Portal** (Bob)
   - Question: "Does this user live in Maharashtra?"
   - Preview: "Your answer will be: NO (Not Maharashtra)"
   - Click "🔐 Generate & Submit ZK Proof"

3. **Verifier Portal**
   - Result: **❌ Not Maharashtra**

---

### Scenario 6: Age Verification - Under 18 (Bob)
**Expected Result: ❌ FAIL**

1. **Verifier Portal**
   - Select: "🎂 Age Verification (Over 18)"
   - Enter Bob's address: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`

2. **User Portal** (Bob)
   - Preview: "Your answer will be: NO (Under 18)"
   - Click "🔐 Generate & Submit ZK Proof"

3. **Verifier Portal**
   - Result: **❌ Under 18**

---

### Scenario 7: Transgender Verification (Charlie)
**Expected Result: ✅ PASS**

1. **Verifier Portal**
   - Select: "⚧ Gender Verification"
   - Required Gender: **Transgender**
   - Enter Charlie's address: `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65`

2. **User Portal** (Charlie)
   - Preview: "Your answer will be: YES (Transgender)"
   - Click "🔐 Generate & Submit ZK Proof"

3. **Verifier Portal**
   - Result: **✅ Transgender**

---

## 🎯 What to Observe

### User Portal Features
- ✅ Shows complete user profile (Age, Gender, State)
- ✅ Color-coded verification type badges
  - Blue = Age 🎂
  - Purple = Gender ⚧
  - Green = State 📍
- ✅ Preview of expected answer
- ✅ Privacy notice
- ✅ Auto-refresh pending requests every 3 seconds

### Verifier Portal Features
- ✅ Dropdown to select verification type
- ✅ Conditional form fields (gender selector, state selector)
- ✅ Test addresses with info
- ✅ Auto-refresh results every 5 seconds
- ✅ Color-coded result badges
- ✅ Request history with type labels

### Privacy Guarantees
- 🔒 Exact age never revealed (only "over 18" or "under 18")
- 🔒 Gender only revealed if it matches requested gender
- 🔒 State only revealed if it matches requested state
- 🔒 All proofs generated locally in browser
- 🔒 Nullifiers prevent proof reuse

---

## 🐛 Troubleshooting

### Issue: "No Aadhaar data found"
**Solution:** Make sure you've run:
```bash
npx hardhat run scripts/03-issue-aadhaar.js --network localhost
```

### Issue: Circuit files not found
**Solution:** Verify files exist:
```bash
ls -la frontend/public/circuits/
# Should show: Over18.wasm, GenderVerification.wasm, StateOfResidence.wasm
```

### Issue: Contract not found
**Solution:** Check deployments.json:
```bash
cat frontend/public/deployments.json
# Should show all 4 contract addresses
```

### Issue: Proof generation takes too long
**Expected:** 10-30 seconds is normal for ZK proof generation

### Issue: Auto-refresh not working
**Solution:** Check browser console for errors, refresh page

---

## 📊 Expected Console Output

### During Proof Generation (User)
```
🎂 AGE CALCULATION
Birth Date: 1/9/1979
Calculated Age: 45
Expected Result: ✅ OVER 18

Generating proof with inputs: {...}
✅ Proof generated successfully
Public signals: [...]
📤 SENDING TO CONTRACT:
  Public Signals: [1, ...]  // 1 = Over 18
✅ Transaction confirmed: 0x...
```

### During Result Check (Verifier)
```
🔍 Checking result for requestId: 1
📋 Contract returned:
  Completed: true
  Result: true
  Interpretation: OVER 18 ✅
```

---

## ✅ Success Criteria

All scenarios should:
1. ✅ Request creation successful
2. ✅ User sees pending request
3. ✅ Proof generates without errors
4. ✅ Transaction confirms
5. ✅ Result matches expected outcome
6. ✅ Verifier sees correct result
7. ✅ No actual data leaked (privacy preserved)

---

## 🎉 You're Ready!

The frontend is fully functional for all three verification types. Test away!
