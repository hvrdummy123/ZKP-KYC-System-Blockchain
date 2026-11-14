# Hardhat test accounts (import into MetaMask)

These are **fake local accounts**, not real IDs. Hardhat always creates the same 20 wallets. Each starts with **10,000 ETH** on chain `31337` only.

**Do not send real money to these addresses. Do not use these keys on mainnet.**

## Network in MetaMask

| Field | Value |
|--------|--------|
| Network name | Hardhat Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency | ETH |

Hardhat node must be running on your laptop (`npx hardhat node`).

**Phone MetaMask:** it usually cannot reach `127.0.0.1` on your computer. Use the **browser MetaMask extension** on the same machine that runs Hardhat.

## Import

MetaMask → Account menu → **Import account** → paste the **Private Key** (no `0x` prefix is also fine).

## Recommended roles (10 accounts)

| # | Role | Address | Private key |
|---|------|---------|-------------|
| 0 | **Attester** (issuer / deployer) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| 3 | **Verifier** (company requesting checks) | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| 1 | **User — Alice** (over 18 after `03-issue-aadhaar`) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| 2 | **User — Bob** (under 18 after issue script) | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| 4 | **User — Charlie** | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |
| 5 | **User — Dana** | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | `0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba` |
| 6 | **User — Eve** | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | `0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e` |
| 7 | **User — Frank** | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | `0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356` |
| 8 | **User — Grace** | `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` | `0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97` |
| 9 | **User — Hank** | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` | `0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6` |

## How to use them

1. Import **Attester (#0)** → already the fixed issuer after deploy (no signup). Open **Attester** portal.  
2. Import **Verifier (#3)** → on home page click **Sign up as Verifier** (once) → **Verifier** portal.  
3. Import any of the **eight users** → **Sign up as User** (once) → **User** portal.  
4. **/try** still works without roles (visitor sandbox).

Roles are permanent per wallet: a Verifier cannot later act as a User.

For pre-issued Alice/Bob/Charlie cards (after deploy):

```bash
npx hardhat run scripts/03-issue-aadhaar.js --network localhost
```

Then switch MetaMask to Alice (#1) or Bob (#2) and complete proofs in the User portal.

## `/try` shortcut

Any of these 10 accounts works on **http://127.0.0.1:3001/try** — self-issue a mock ID and claim an over-18 pass without using the Attester portal.
