'use client';

import { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';

const HARDHAT_CHAIN_ID = 31337n;
const HARDHAT_CHAIN_HEX = '0x7a69';
const HARDHAT_RPC = 'http://127.0.0.1:8545';

const ROLES = {
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266': 'Attester (Account #0)',
  '0x70997970c51812dc3a010c7d01b50e0d17dc79c8': 'Alice (Account #1)',
  '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc': 'Bob (Account #2)',
  '0x90f79bf6eb2c4f870365e785982e1f101e93b906': 'Verifier/Company (Account #3)',
  '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65': 'Charlie (Account #4)',
  '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc': 'Dana (Account #5)',
  '0x976ea74026e726554db657fa54763abd0c3a0aa9': 'Eve (Account #6)',
  '0x14dc79964da2c08b23698b3d3cc7ca32193d9955': 'Frank (Account #7)',
  '0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f': 'Grace (Account #8)',
  '0xa0ee7a142d267c1f36714e4a8f75612f20a79720': 'Hank (Account #9)',
};

async function ensureHardhatChain() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HARDHAT_CHAIN_HEX }],
    });
  } catch (err) {
    if (err?.code !== 4902) throw err;
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: HARDHAT_CHAIN_HEX,
        chainName: 'Hardhat Local',
        rpcUrls: [HARDHAT_RPC],
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      }],
    });
  }
}

export default function WalletConnect({ onAccountChange } = {}) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [status, setStatus] = useState('Checking wallet…');
  const [busy, setBusy] = useState(false);
  const hasProvider = typeof window !== 'undefined' && !!window.ethereum;

  const notifyAccount = useCallback((addr) => {
    if (typeof onAccountChange === 'function') onAccountChange(addr || null);
  }, [onAccountChange]);

  const refresh = useCallback(async (addr) => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    setChainId(network.chainId.toString());
    if (network.chainId !== HARDHAT_CHAIN_ID) {
      setBalance(null);
      setStatus('Wrong network — switch to Hardhat Local (31337). Hardhat node must be running on :8545.');
      return;
    }
    try {
      const bal = await provider.getBalance(addr);
      setBalance(ethers.formatEther(bal));
      setStatus('Connected to Hardhat Local. Pick a portal below (Attester / Verifier / User).');
    } catch {
      setBalance(null);
      setStatus('Hardhat RPC not reachable. Run: npx hardhat node (in zkp-kyc-system), then deploy.');
    }
  }, []);

  useEffect(() => {
    if (!hasProvider) {
      setStatus('No wallet found. Install MetaMask, then import a Hardhat test account.');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (cancelled || accounts.length === 0) {
          setStatus('Click Connect Wallet. MetaMask will ask to use Hardhat Local (chain 31337).');
          return;
        }
        setAccount(accounts[0].address);
        notifyAccount(accounts[0].address);
        await refresh(accounts[0].address);
      } catch {
        if (!cancelled) setStatus('Wallet error — is MetaMask unlocked?');
      }
    })();

    const onAccounts = (accs) => {
      if (!accs.length) {
        setAccount(null);
        setBalance(null);
        setChainId(null);
        setStatus('Logged out. Click Connect Wallet to continue.');
        notifyAccount(null);
        return;
      }
      setAccount(accs[0]);
      notifyAccount(accs[0]);
      refresh(accs[0]);
    };
    const onChain = () => window.location.reload();
    window.ethereum.on('accountsChanged', onAccounts);
    window.ethereum.on('chainChanged', onChain);
    return () => {
      cancelled = true;
      window.ethereum.removeListener('accountsChanged', onAccounts);
      window.ethereum.removeListener('chainChanged', onChain);
    };
  }, [hasProvider, refresh, notifyAccount]);

  const connect = async () => {
    if (!hasProvider) {
      setStatus('Install MetaMask from https://metamask.io then refresh this page.');
      window.open('https://metamask.io/download/', '_blank', 'noopener,noreferrer');
      return;
    }
    setBusy(true);
    try {
      await ensureHardhatChain();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      setAccount(accounts[0]);
      notifyAccount(accounts[0]);
      await refresh(accounts[0]);
    } catch (err) {
      const msg = err?.code === 4001
        ? 'Connection rejected in MetaMask.'
        : (err?.message || 'Failed to connect');
      setStatus(msg);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      // Revoke site permission in MetaMask when supported (true logout).
      if (window.ethereum?.request) {
        try {
          await window.ethereum.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }],
          });
        } catch {
          // Older wallets: clear app session only; user can also disconnect in MetaMask → Connected sites.
        }
      }
    } finally {
      setAccount(null);
      setBalance(null);
      setChainId(null);
      setStatus('Logged out. Click Connect Wallet to continue.');
      notifyAccount(null);
      setBusy(false);
    }
  };

  const role = account ? (ROLES[account.toLowerCase()] || 'Custom account') : null;
  const onHardhat = chainId === '31337';

  return (
    <div className="border rounded-lg p-4 bg-white shadow space-y-3">
      <p className="text-sm text-gray-700">{status}</p>

      {!account ? (
        <button
          type="button"
          onClick={connect}
          disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2 px-4 rounded"
        >
          {busy ? 'Connecting…' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="font-semibold">Account</span>
            <span className="font-mono">{account.slice(0, 6)}…{account.slice(-4)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="font-semibold">Role</span>
            <span className={role?.startsWith('Custom') ? 'text-amber-700' : 'text-green-700'}>{role}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="font-semibold">Network</span>
            <span>{onHardhat ? 'Hardhat Local (31337)' : `Chain ${chainId}`}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="font-semibold">Balance</span>
            <span>{balance !== null ? `${Number(balance).toFixed(4)} ETH` : '—'}</span>
          </div>
          {!onHardhat && (
            <button
              type="button"
              onClick={async () => {
                setBusy(true);
                try {
                  await ensureHardhatChain();
                  if (account) await refresh(account);
                } catch (err) {
                  setStatus(err?.message || 'Could not switch network');
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded"
            >
              Switch to Hardhat Local
            </button>
          )}
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="w-full mt-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-60 text-gray-800 font-semibold py-2 px-4 rounded"
          >
            {busy ? 'Logging out…' : 'Log out / Disconnect'}
          </button>
        </div>
      )}

      <details className="text-xs text-gray-600">
        <summary className="cursor-pointer font-semibold">How to demo locally</summary>
        <ol className="list-decimal ml-4 mt-2 space-y-1">
          <li>Terminal A: <code>cd zkp-kyc-system && npx hardhat node</code></li>
          <li>Terminal B: <code>npx hardhat run scripts/02-deploy-all-contracts.js --network localhost</code></li>
          <li>MetaMask → import keys from <code>docs/HARDHAT_ACCOUNTS.md</code> (#0 Attester, #3 Verifier, #1–2/#4–9 users). RPC <code>http://127.0.0.1:8545</code>, chain id 31337.</li>
          <li>Connect here, then open Attester / User / Verifier portals.</li>
        </ol>
      </details>
    </div>
  );
}
