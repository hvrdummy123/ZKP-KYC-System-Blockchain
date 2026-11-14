# Threat model & data leaks

What is private, what still leaks, and how to harden.

## What stays off-chain (good)

- Raw Aadhaar number, DOB, name, gender plaintext, state plaintext  
- Circuit witness / salts / secrets (if the user keeps them only in browser / `userData.json`)

## What is still on-chain (linkable)

| Data | Who sees it | Risk |
|------|-------------|------|
| Wallet address ↔ role (User/Verifier/Attester) | Anyone | Role graph is public |
| `aadhaarHash`, `secretHash`, state/gender commitments | Anyone reading Attester storage | Same person across apps if hashes reused |
| Request: verifier → user, timestamps, fees | Anyone | Social graph: which company asked which wallet |
| Yes/No result + nullifier | Anyone | “This wallet proved over-18 for company X” |
| Revoked `secretHash` | Anyone | Revocation is visible |
| Demo `/try` pass (`hasPass`) | Anyone | Age flag tied to wallet |

**Important:** ZK hides *attributes*, not *that a verification happened*. Chain analysts can still map wallets ↔ companies ↔ outcomes.

## Frontend / off-chain leaks (this codebase)

1. **User portal localStorage** — may store name, Aadhaar, DOB in cleartext in the browser (`user_*` keys). XSS or shared PC = full leak.  
2. **Attester `userData.json` / scripts** — issuer machine holds plaintext used to build commitments. Compromise of attester = full identity store.  
3. **Verifier localStorage `verificationRequests`** — request history in the browser.  
4. **MetaMask account reuse** — same wallet for personal DeFi + KYC User role links KYC activity to other on-chain activity.  
5. **Console logs** in User portal print addresses and request payloads during demo.  
6. **Self-serve DemoAttester** — anyone can mint mock commitments; proves circuit math, not real-world identity.

## Attacker goals vs mitigations

| Goal | Today | Better |
|------|--------|--------|
| Learn DOB from chain | Hard (Poseidon commitment) | Keep salts offline; never reuse salts |
| Link wallet to company checks | Easy (public requests) | Relayers / ephemeral wallets / private mempools (advanced) |
| Replay a proof | Blocked by nullifier + requestId + verifierId | Keep binding; field-reduce IDs |
| Act as both company and person | Blocked by RoleRegistry | Done (this change) |
| Fake attester issue | Only `onlyOwner` attester | Multisig / HSM issuer; Merkle root instead of per-card |
| Steal browser secrets | localStorage XSS | Encrypted vault, never log secrets, HttpOnly session for hosted UI |
| Coerce re-identification | No viewing key | Escrowed viewing key with legal process (compliance) |

## Hardening checklist (priority)

1. **Separate wallets** — never use the Attester or Verifier key for personal funds.  
2. **Stop storing plaintext ID in localStorage** — keep only encrypted blobs or device keystore.  
3. **Issuer vault** — attester secrets in HSM / offline ceremony; publish Merkle root, not every card mapping.  
4. **Minimize request storage** — emit events; avoid fat structs (also saves gas).  
5. **Short-lived soulbound pass** — verify once; later reads don’t re-publish nullifiers.  
6. **Remove demo console logs** before any public deploy.  
7. **HTTPS + CSP** on hosted UI; treat `/try` as mock-only forever.

## Role model (implemented)

- **Attester** — single address fixed at `RoleRegistry` deploy.  
- **User XOR Verifier** — one-time on-chain registration; cannot switch.  
- Enforced in Over18 / Gender / State request & complete paths.  
- `/try` remains a sandbox without roles (mock only).
