'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import WalletConnect from '@/components/WalletConnect';
import { getRoleRegistry, ROLE } from '@/lib/contracts';

/**
 * Gate a portal by on-chain role.
 * @param {'attester'|'user'|'verifier'} need
 */
export default function RequireRole({ need, children }) {
  const [account, setAccount] = useState(null);
  const [ok, setOk] = useState(false);
  const [label, setLabel] = useState('Checking role…');
  const [ready, setReady] = useState(false);

  const check = useCallback(async (addr) => {
    if (!addr) {
      setOk(false);
      setReady(true);
      setLabel('Connect your wallet.');
      return;
    }
    try {
      const registry = await getRoleRegistry();
      const attester = (await registry.attester()).toLowerCase();
      const a = addr.toLowerCase();
      if (need === 'attester') {
        const pass = a === attester;
        setOk(pass);
        setLabel(pass ? '' : 'Only the fixed Attester wallet can open this portal.');
        setReady(true);
        return;
      }
      if (a === attester) {
        setOk(false);
        setLabel('You are the Attester — use the Attester portal, not User/Verifier.');
        setReady(true);
        return;
      }
      const r = Number(await registry.roleOf(addr));
      if (need === 'user') {
        setOk(r === ROLE.User);
        setLabel(r === ROLE.User ? '' : r === ROLE.Verifier
          ? 'This wallet is locked as Verifier (company). Use a User wallet.'
          : 'Sign up as User on the home page first.');
      } else if (need === 'verifier') {
        setOk(r === ROLE.Verifier);
        setLabel(r === ROLE.Verifier ? '' : r === ROLE.User
          ? 'This wallet is locked as User (person). Use a Verifier wallet.'
          : 'Sign up as Verifier on the home page first.');
      }
    } catch (e) {
      setOk(false);
      setLabel(e?.message || 'RoleRegistry unavailable — redeploy.');
    }
    setReady(true);
  }, [need]);

  useEffect(() => {
    check(account);
  }, [account, check]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto p-4">
        <WalletConnect onAccountChange={setAccount} />
      </div>
      {ready && !ok && (
        <div className="max-w-lg mx-auto mt-8 text-center space-y-4 p-6">
          <div className="text-5xl">🔒</div>
          <h1 className="text-2xl font-bold text-red-700">Access Denied</h1>
          <p className="text-gray-700">{label}</p>
          <Link href="/" className="text-blue-700 underline">← Back home to sign up</Link>
        </div>
      )}
      {ok && children}
    </div>
  );
}
