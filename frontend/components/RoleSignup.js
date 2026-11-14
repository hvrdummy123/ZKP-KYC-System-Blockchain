'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getRoleRegistry, ROLE } from '@/lib/contracts';

const ROLE_LABEL = {
  [ROLE.None]: 'Not registered',
  [ROLE.User]: 'User (person)',
  [ROLE.Verifier]: 'Verifier (company)',
  attester: 'Attester (fixed issuer)',
};

export default function RoleSignup({ account }) {
  const [role, setRole] = useState(null);
  const [attester, setAttester] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!account) {
      setRole(null);
      return;
    }
    try {
      const registry = await getRoleRegistry();
      const att = await registry.attester();
      setAttester(att);
      if (account.toLowerCase() === att.toLowerCase()) {
        setRole('attester');
        return;
      }
      const r = Number(await registry.roleOf(account));
      setRole(r);
      setError('');
    } catch (e) {
      setError(e?.shortMessage || e?.message || 'RoleRegistry not available — redeploy contracts');
    }
  }, [account]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const register = async (asVerifier) => {
    setBusy(true);
    setError('');
    try {
      const registry = await getRoleRegistry();
      const tx = asVerifier
        ? await registry.registerAsVerifier()
        : await registry.registerAsUser();
      await tx.wait();
      await refresh();
    } catch (e) {
      setError(e?.shortMessage || e?.reason || e?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  if (!account) {
    return (
      <div className="border rounded-lg p-4 bg-white shadow text-sm text-gray-700">
        Connect a wallet, then choose <strong>User</strong> or <strong>Verifier</strong>. Attester is fixed at deploy (Account #0).
      </div>
    );
  }

  if (role === 'attester') {
    return (
      <div className="border rounded-lg p-4 bg-white shadow space-y-3">
        <p className="text-sm font-semibold text-blue-800">You are the Attester</p>
        <p className="text-sm text-gray-700">
          Fixed issuer for this deployment (<span className="font-mono text-xs">{attester?.slice(0, 10)}…</span>).
          You cannot register as User or Verifier.
        </p>
        <Link href="/attester" className="inline-block bg-blue-600 text-white px-4 py-2 rounded font-semibold text-sm">
          Open Attester portal →
        </Link>
      </div>
    );
  }

  if (role === ROLE.User) {
    return (
      <div className="border rounded-lg p-4 bg-white shadow space-y-3">
        <p className="text-sm font-semibold text-purple-800">Role locked: User (person)</p>
        <p className="text-sm text-gray-700">You cannot switch to Verifier with this wallet.</p>
        <Link href="/user" className="inline-block bg-purple-600 text-white px-4 py-2 rounded font-semibold text-sm">
          Open User portal →
        </Link>
      </div>
    );
  }

  if (role === ROLE.Verifier) {
    return (
      <div className="border rounded-lg p-4 bg-white shadow space-y-3">
        <p className="text-sm font-semibold text-green-800">Role locked: Verifier (company)</p>
        <p className="text-sm text-gray-700">You cannot identify as a User with this wallet.</p>
        <Link href="/verifier" className="inline-block bg-green-600 text-white px-4 py-2 rounded font-semibold text-sm">
          Open Verifier portal →
        </Link>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-white shadow space-y-3">
      <h3 className="font-semibold text-gray-900">Choose your path (once)</h3>
      <p className="text-sm text-gray-700">
        Pick <strong>User</strong> (person proving attributes) or <strong>Verifier</strong> (company requesting checks).
        This is permanent for this wallet — companies and people stay separate.
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => register(false)}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg"
        >
          {busy ? '…' : 'Sign up as User'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => register(true)}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg"
        >
          {busy ? '…' : 'Sign up as Verifier'}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Current status: {ROLE_LABEL[role] || '…'} · Attester: {attester ? `${attester.slice(0, 8)}…` : '—'}
      </p>
    </div>
  );
}
