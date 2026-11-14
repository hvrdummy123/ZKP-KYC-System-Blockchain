'use client';

import { useState } from 'react';
import Link from 'next/link';
import WalletConnect from '@/components/WalletConnect';
import RoleSignup from '@/components/RoleSignup';

export default function Home() {
  const [account, setAccount] = useState(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 text-gray-900">
            ZKP-KYC System
          </h1>
          <p className="text-xl text-gray-800 max-w-2xl mx-auto">
            One fixed Attester issues credentials. Everyone else signs up once as a
            <strong> User</strong> (person) or <strong>Verifier</strong> (company) — roles cannot be switched.
          </p>
          <Link
            href="/try"
            className="inline-block mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg text-lg"
          >
            Quick visitor demo →
          </Link>
          <p className="text-sm text-gray-600 mt-2">/try sandbox needs no role · Hardhat Local</p>
        </div>

        <div className="max-w-md mx-auto mb-6 space-y-4">
          <WalletConnect onAccountChange={setAccount} />
          <RoleSignup account={account} />
        </div>

        <h2 className="text-center text-lg font-semibold text-gray-700 mb-4">Portals (role-gated)</h2>
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Link href="/attester">
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-t-4 border-blue-500">
              <div className="text-4xl mb-4">🏛️</div>
              <h2 className="text-2xl font-bold mb-2 text-gray-900">Attester</h2>
              <p className="text-gray-700 mb-4">
                Fixed issuer only (deployer / Account #0)
              </p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>✓ Issue credentials</li>
                <li>✓ Revoke cards</li>
                <li>✓ Not open for signup</li>
              </ul>
              <div className="mt-4 text-blue-600 font-semibold">Access Portal →</div>
            </div>
          </Link>

          <Link href="/verifier">
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-t-4 border-green-500">
              <div className="text-4xl mb-4">🏢</div>
              <h2 className="text-2xl font-bold mb-2 text-gray-900">Verifier</h2>
              <p className="text-gray-700 mb-4">
                Companies that registered as Verifier
              </p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>✓ Request verifications</li>
                <li>✓ Check yes/no results</li>
                <li>✓ Cannot act as User</li>
              </ul>
              <div className="mt-4 text-green-600 font-semibold">Access Portal →</div>
            </div>
          </Link>

          <Link href="/user">
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-t-4 border-purple-500">
              <div className="text-4xl mb-4">👤</div>
              <h2 className="text-2xl font-bold mb-2 text-gray-900">User</h2>
              <p className="text-gray-700 mb-4">
                People that registered as User
              </p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>✓ Answer verification requests</li>
                <li>✓ Generate ZK proofs</li>
                <li>✓ Cannot act as Verifier</li>
              </ul>
              <div className="mt-4 text-purple-600 font-semibold">Access Portal →</div>
            </div>
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-blue-700">1</span>
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Sign up</h3>
              <p className="text-sm text-gray-700">User or Verifier once per wallet</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-green-700">2</span>
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Issue</h3>
              <p className="text-sm text-gray-700">Attester posts commitments (not PII)</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-purple-700">3</span>
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Request</h3>
              <p className="text-sm text-gray-700">Verifier asks over-18 / state / gender</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-yellow-700">4</span>
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Prove</h3>
              <p className="text-sm text-gray-700">User submits ZK proof on-chain</p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-bold mb-3 text-gray-900">Setup:</h3>
          <ol className="space-y-2 text-sm list-decimal list-inside text-gray-800">
            <li><code className="bg-gray-200 px-2 py-1 rounded">npx hardhat node</code></li>
            <li><code className="bg-gray-200 px-2 py-1 rounded">npx hardhat run scripts/02-deploy-all-contracts.js --network localhost</code></li>
            <li>Import Hardhat keys from <code className="bg-gray-200 px-2 py-1 rounded">docs/HARDHAT_ACCOUNTS.md</code></li>
            <li>#0 = Attester · others Sign up as User or Verifier</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
