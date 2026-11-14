# System architecture & design

This document explains **how ZKP-KYC is built**, **why those choices were made**, **what problem it solves**, **where it wins**, and **how to improve it**.

---

## 1. Problem this design solves

Traditional KYC / age checks force a tradeoff:

| Usual approach | Problem |
|----------------|---------|
| Upload ID / DOB to every company | Data sprawl, leaks, oversharing |
| Company stores full identity | Breach = life-changing harm |
| “Trust us, we checked” | No cryptographic audit trail |
| Put full ID on a blockchain | Worse: permanent public PII |

**ZKP-KYC’s goal:** let a **company (Verifier)** learn only a **yes/no** answer (e.g. “over 18?”) while a **trusted issuer (Attester)** has already committed to the user’s credentials — without putting DOB or Aadhaar plaintext on-chain, and without the Verifier seeing those fields.

---

## 2. High-level architecture

```
┌─────────────┐         issue commitments          ┌──────────────────┐
│  Attester   │ ─────────────────────────────────► │ AttesterContract │
│ (1 wallet)  │     (hashes only, not PII)         │   + commitments  │
└─────────────┘                                    └────────┬─────────┘
                                                            │
┌─────────────┐  register once (User XOR Verifier)  ┌───────▼─────────┐
│ RoleRegistry│ ◄────────────────────────────────── │   MetaMask /    │
│ attester=   │                                     │   Next.js UI    │
│  immutable  │                                     └───────┬─────────┘
└─────────────┘                                             │
        ▲                                                   │
        │ enforce roles                                     │
        │                                                   │
┌───────┴────────┐   request check    ┌─────────────────────▼──────────┐
│ Over18Verifier │ ◄──────────────────│ Verifier portal (company)      │
│ GenderVerifier │                    └────────────────────────────────┘
│ StateVerifier  │
│ + Groth16      │   submit proof     ┌────────────────────────────────┐
│   precompiles  │ ◄──────────────────│ User portal (person)           │
└───────┬────────┘                    │ Circom wasm + snarkjs in browser│
        │                             └────────────────────────────────┘
        ▼
   nullifier used · yes/no stored · fee accounting
```

### Layers

| Layer | Tech | Responsibility |
|-------|------|----------------|
| **Circuits** | Circom + Poseidon | Prove attribute predicates (over-18, state, gender) |
| **Proving** | snarkjs Groth16 (browser / Node) | Build proofs from private witness |
| **On-chain verify** | Solidity + BN254 precompiles | Check proof + public signals |
| **Coordination** | Attester + request contracts | Issuance, requests, nullifiers, fees |
| **Roles** | `RoleRegistry` | Fixed Attester; User XOR Verifier |
| **UI** | Next.js + ethers | Portals + `/try` visitor sandbox |

---

## 3. Core design decisions (and why)

### 3.1 Commitments on-chain, plaintext off-chain

**Choice:** Attester stores Poseidon hashes / commitments (`aadhaarHash`, `secretHash`, state/gender commitments), not DOB or ID numbers.

**Why:** Chain is public and forever. Hashes let contracts later check “this proof matches the issued credential” without exposing PII.

**Tradeoff:** Attester (or user device) still holds plaintext somewhere to issue / prove. Compromise of the issuer vault is still critical — but *scraping the chain* does not dump IDs.

### 3.2 Groth16 (not Plonk / STARKs) for on-chain verify

**Choice:** Circom → snarkjs Groth16 → Solidity verifier using Ethereum pairing precompiles.

**Why:**

- Smallest proofs, cheapest EVM verification (~200k gas class)
- Mature Circom/snarkjs toolchain
- Fits a teaching + demo product that must verify **on-chain**

**Tradeoff:** Per-circuit trusted setup; circuit changes need new keys/verifier export.

### 3.3 Request / complete two-step flow

**Choice:** Verifier calls `request*`; User later calls `complete*` with a proof bound to `requestId` + verifier address.

**Why:**

- Separates **who asks** from **who proves**
- Public signals bind the proof to that company and request (anti-replay / anti-forwarding)
- Matches real KYC: company initiates, user consents by proving

### 3.4 Nullifiers

**Choice:** `nullifier = Poseidon(secret, requestId, verifierId)`; marked used on-chain.

**Why:** Same credential cannot answer the same request twice; proofs aren’t blindly reusable across companies without a new nullifier domain.

### 3.5 Fixed Attester + User XOR Verifier roles

**Choice:** `RoleRegistry` sets one immutable attester at deploy. Everyone else registers **once** as User or Verifier.

**Why:**

- Real world: issuer ≠ consumer company ≠ citizen
- Stops one wallet “being both” company and person in the demo story
- Enforced in contracts (`verifiers only` / `users only`), not only in the UI

### 3.6 Visitor `/try` sandbox (DemoAttester + DemoAgeGate)

**Choice:** Separate self-issue path with no role gate.

**Why:** Strangers can experience ZK age-check without Attester privilege. Production issuance stays on the real Attester path.

### 3.7 Local Hardhat-first

**Choice:** Develop and demo on chain id `31337` with funded test accounts.

**Why:** Zero gas cost, reproducible keys, full stack (UI + contracts + proofs) on one laptop. Public L2 deploy is an upgrade path, not a blocker for learning.

---

## 4. Data flow (happy path — over 18)

1. **Deploy** — Attester = Account #0; RoleRegistry + verifiers live.
2. **Signup** — Alice → User; Company → Verifier.
3. **Issue** — Attester writes Alice’s commitments to `AttesterContract`.
4. **Request** — Company pays fee, `requestVerification(Alice)`.
5. **Prove** — Alice’s browser builds Groth16 proof; DOB never sent to company or chain.
6. **Complete** — Contract checks role, card, public signals, nullifier, then Groth16 verify → stores **yes/no**.
7. **Read** — Company sees result only.

What the Verifier learns: `isOver18 ∈ {0,1}` (plus that a valid proof existed).  
What they do **not** learn: DOB, exact age, Aadhaar number.

---

## 5. Where this design is advantageous

| Advantage | How the design delivers it |
|-----------|----------------------------|
| **Minimal disclosure** | ZK predicates; only yes/no on result |
| **No PII on-chain** | Commitments + nullifiers, not documents |
| **Auditable verification** | On-chain proof verify + events |
| **Role clarity** | Attester / User / Verifier cannot blur |
| **Anti-replay** | Nullifier + request + verifier binding |
| **Cheap relative to other ZK** | Groth16 + precompiles |
| **Teachable end-to-end** | Circom → snarkjs → Solidity → Next.js |
| **Try without privilege** | `/try` sandbox |

---

## 6. Limits of this design (honest)

- **Activity is still public** — who asked whom, and yes/no, are visible on-chain (see [THREAT_MODEL.md](THREAT_MODEL.md)).
- **Issuer trust** — Attester can issue false commitments; ZK only proves consistency with those commitments.
- **Browser secrets** — Demo UX may keep sensitive fields in localStorage; not production-safe.
- **Gas & storage** — Full request structs + nullifier mappings grow cost at scale.
- **Local demo** — Not a hosted multi-user SaaS until deployed to a public network.

---

## 7. How we can improve

Ordered by impact:

1. **Merkle-root issuance** — Attester publishes one root; users prove inclusion (far less storage than per-wallet cards).
2. **Soulbound short-lived pass** — Verify once; later apps read a cheap SBT / `hasPass` instead of re-running Groth16.
3. **Trim on-chain request state** — Prefer events + minimal status over fat structs.
4. **Deploy on L2** (Base / Arbitrum / Sepolia) — Same design, cents instead of dollars.
5. **Hardening UX secrets** — Encrypted vault; no plaintext ID in localStorage; strip console logs.
6. **Revocation root + expiry** — Proper credential lifecycle.
7. **Compliance viewing key** (optional) — Lawful re-identification without putting PII on-chain.
8. **Proof aggregation** — Batch many users into one recursive on-chain verify (advanced).

---

## 8. Repository map

| Path | Role |
|------|------|
| `circuits/` | Over18, State, Gender Circom sources + artifacts |
| `contracts/` | Attester, RoleRegistry, request verifiers, Groth16, Demo* |
| `frontend/` | Next.js portals + `/try` |
| `scripts/` | Deploy, issue, demo flows |
| `test/` | Hardhat tests including roles + visitor demo |
| `docs/` | TRY_IT, HARDHAT_ACCOUNTS, THREAT_MODEL, this architecture, demo.gif |

---

## 9. Related docs

- [TRY_IT.md](TRY_IT.md) — run & participate  
- [HARDHAT_ACCOUNTS.md](HARDHAT_ACCOUNTS.md) — test wallets  
- [THREAT_MODEL.md](THREAT_MODEL.md) — leaks & hardening  
- [../README.md](../README.md) — product overview & quick start  
