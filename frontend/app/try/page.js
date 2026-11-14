'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ethers } from 'ethers';
import WalletConnect from '@/components/WalletConnect';
import { ProofGenerator } from '@/lib/proofGenerator';
import { deployments, getDemoAttester, getDemoAgeGate } from '@/lib/contracts';

const STEPS = ['Connect', 'Mock ID', 'Prove age', 'Result'];

function randomMockId() {
  const year = new Date().getFullYear() - (18 + Math.floor(Math.random() * 40));
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  const aadhaar = String(100000000000 + Math.floor(Math.random() * 899999999999));
  return { aadhaarNumber: aadhaar, birthYear: year, birthMonth: month, birthDay: day, name: 'Demo Visitor' };
}

function formatProof(proof) {
  return {
    pA: [proof.pi_a[0], proof.pi_a[1]],
    pB: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    pC: [proof.pi_c[0], proof.pi_c[1]],
  };
}

export default function TryPage() {
  const [step, setStep] = useState(0);
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState('Connect a wallet on Hardhat Local (31337) to begin.');
  const [busy, setBusy] = useState(false);
  const [cred, setCred] = useState(null);
  const [result, setResult] = useState(null);
  const [pg] = useState(() => new ProofGenerator());

  const onWalletAccount = useCallback((addr) => {
    if (!addr) {
      setAccount(null);
      setCred(null);
      setResult(null);
      setStep(0);
      sessionStorage.removeItem('demoCred');
      setStatus('Logged out. Connect a wallet on Hardhat Local (31337) to begin.');
      return;
    }
    setAccount(addr);
    setStep((s) => Math.max(s, 1));
    setStatus('Connected. Create a mock Government ID (demo only — not a real ID).');
  }, []);

  useEffect(() => {
    if (!window.ethereum) return undefined;
    (async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length) onWalletAccount(accounts[0].address);
      } catch {
        /* ignore */
      }
    })();
    return undefined;
  }, [onWalletAccount]);

  const issueMock = async () => {
    setBusy(true);
    setStatus('Issuing mock credential on-chain…');
    try {
      await pg.init();
      const mock = randomMockId();
      const salt = pg.generateSalt();
      const secret = pg.generateSecret();
      const stateSalt = pg.generateSalt();
      const genderSalt = pg.generateSalt();
      const aadhaarHash = pg.generateAadhaarHash(
        mock.aadhaarNumber, mock.birthYear, mock.birthMonth, mock.birthDay, salt
      );
      const secretHash = pg.generateSecretHash(secret);
      const stateCommitment = pg.generateStateCommitment(27, stateSalt);
      const genderCommitment = pg.generateGenderCommitment(1, genderSalt);
      const cardId = `DEMO_${mock.aadhaarNumber}_${Date.now()}`;

      const attester = await getDemoAttester();
      // revoke previous demo card if any
      try {
        if (await attester.hasValidCard(account)) {
          const txR = await attester.selfRevoke();
          await txR.wait();
        }
      } catch {
        /* no card */
      }

      const tx = await attester.selfIssue(
        cardId,
        aadhaarHash,
        secretHash,
        stateCommitment,
        genderCommitment
      );
      await tx.wait();

      const privateCred = {
        ...mock,
        salt: salt.toString(),
        secret: secret.toString(),
        cardId,
        aadhaarHash: aadhaarHash.toString(),
        secretHash: secretHash.toString(),
      };
      sessionStorage.setItem('demoCred', JSON.stringify(privateCred));
      setCred(privateCred);
      setStep(2);
      setStatus('Mock ID issued. Only commitments went on-chain — DOB stays in this browser tab.');
    } catch (e) {
      setStatus(e?.shortMessage || e?.message || 'Issue failed');
    } finally {
      setBusy(false);
    }
  };

  const proveAndClaim = async () => {
    setBusy(true);
    setStatus('Generating zero-knowledge proof in your browser (can take ~30–60s)…');
    try {
      const stored = cred || JSON.parse(sessionStorage.getItem('demoCred') || 'null');
      if (!stored) throw new Error('No mock credential — go back a step');

      const gate = await getDemoAgeGate();
      const requestId = await gate.requestIdFor(account);
      const proofRes = await pg.generateOver18Proof(
        {
          aadhaarNumber: stored.aadhaarNumber,
          birthYear: stored.birthYear,
          birthMonth: stored.birthMonth,
          birthDay: stored.birthDay,
          salt: stored.salt,
        },
        stored.secret,
        requestId.toString(),
        account
      );
      if (!proofRes.success) throw new Error(proofRes.error || 'proof failed');

      const { pA, pB, pC } = formatProof(proofRes.proof);
      const pubs = proofRes.publicSignals.map((x) => BigInt(x));
      setStatus('Submitting proof on-chain…');
      const tx = await gate.claimPass(pA, pB, pC, pubs);
      const receipt = await tx.wait();
      const over18 = pubs[0] === 1n;
      const pass = await gate.hasPass(account);
      setResult({ over18, pass, tx: receipt.hash, publicSignals: proofRes.publicSignals });
      setStep(3);
      setStatus(over18
        ? 'Pass claimed. The chain only learned “over 18: yes” + a nullifier — not your DOB.'
        : 'Proof valid but under 18 — no pass minted.');
    } catch (e) {
      setStatus(e?.shortMessage || e?.message || 'Prove/claim failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 p-6 md:p-10">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex justify-between items-center text-sm">
          <Link href="/" className="text-blue-700 underline">← Home</Link>
          <span className="text-gray-600">Visitor demo · mock data only</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900">Try a private age check</h1>
        <p className="text-gray-700">
          One wallet, four steps. You issue yourself a <strong>mock</strong> Government ID,
          prove you are over 18 without revealing your date of birth, and claim a demo pass on Hardhat.
        </p>

        <ol className="flex flex-wrap gap-2 text-sm">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`px-3 py-1 rounded-full border ${
                i === step ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'
              }`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <WalletConnect onAccountChange={onWalletAccount} />

        <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm">
          <p className="text-sm text-gray-800" aria-live="polite">{status}</p>

          {step === 1 && (
            <button
              type="button"
              disabled={busy || !account}
              onClick={issueMock}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg"
            >
              {busy ? 'Issuing…' : 'Generate & issue mock ID'}
            </button>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {cred && (
                <div className="text-xs font-mono bg-slate-50 p-3 rounded border overflow-x-auto">
                  <div>Mock DOB: {cred.birthYear}-{cred.birthMonth}-{cred.birthDay} (stays local)</div>
                  <div>On-chain: aadhaarHash={cred.aadhaarHash.slice(0, 18)}…</div>
                  <div>DemoAttester: {deployments.demoAttester}</div>
                </div>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={proveAndClaim}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg"
              >
                {busy ? 'Working…' : 'Prove I’m over 18 & claim pass'}
              </button>
            </div>
          )}

          {step === 3 && result && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-green-800">
                {result.pass ? 'Soulbound demo pass: YES' : 'No pass (not over 18)'}
              </p>
              <p>isOver18 public output: {result.over18 ? '1' : '0'}</p>
              <p className="font-mono text-xs break-all">tx: {result.tx}</p>
              <p className="text-gray-600">
                Anyone else can replay this flow with their own MetaMask account on the same local chain.
              </p>
              <button
                type="button"
                className="w-full border py-2 rounded-lg"
                onClick={() => {
                  setStep(1);
                  setResult(null);
                  setCred(null);
                  sessionStorage.removeItem('demoCred');
                  setStatus('Create another mock ID to try again.');
                }}
              >
                Start over
              </button>
            </div>
          )}
        </div>

        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer font-semibold">What a visitor needs</summary>
          <ul className="list-disc ml-4 mt-2 space-y-1">
            <li>MetaMask + Hardhat Local (RPC http://127.0.0.1:8545, chain id 31337)</li>
            <li>Any funded account (import a Hardhat test key, or use your own on the local node)</li>
            <li>This page — no special “Attester” role required</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
