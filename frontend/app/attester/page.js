'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Link from 'next/link';
import WalletConnect from '@/components/WalletConnect';
import { getRoleRegistry } from '@/lib/contracts';

const stateMapping = { 
  "Maharashtra": 27, 
  "Karnataka": 29, 
  "Delhi": 7,
  "Tamil Nadu": 33,
  "Gujarat": 24
};

const genderMapping = { 
  "Male": 1, 
  "Female": 2, 
  "Other": 3
};

export default function AttesterPage() {
  const [account, setAccount] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    async function checkWallet(addr) {
      if (!addr) {
        setAccount(null);
        setIsAuthorized(false);
        return;
      }
      setAccount(addr.toLowerCase());
      try {
        const registry = await getRoleRegistry();
        setIsAuthorized(await registry.isAttester(addr));
      } catch {
        setIsAuthorized(false);
      }
    }
    (async () => {
      if (!window.ethereum) return;
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();
      if (accounts.length) await checkWallet(accounts[0].address);
    })();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', () => window.location.reload());
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [formData, setFormData] = useState({
    userAddress: '',
    name: '',
    aadhaarNumber: '',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    state: 'Maharashtra',
    gender: 'Male'
  });
  const [issuedCards, setIssuedCards] = useState([]);

  // Revocation states
  const [revokeModal, setRevokeModal] = useState({ isOpen: false, card: null });
  const [revokeConfirmation, setRevokeConfirmation] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeStatus, setRevokeStatus] = useState('');

  // Card details modal
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, card: null });

  useEffect(() => {
    const stored = localStorage.getItem('issuedCards');
    if (stored) {
      setIssuedCards(JSON.parse(stored));
    }
  }, []);

  const generateRandomData = () => {
    const currentYear = new Date().getFullYear();
    const isOver18 = Math.random() > 0.5;
    const age = isOver18 ? Math.floor(Math.random() * 50) + 18 : Math.floor(Math.random() * 18);
    const birthYear = currentYear - age;

    setFormData({
      ...formData,
      aadhaarNumber: Math.floor(Math.random() * 900000000000 + 100000000000).toString(),
      birthYear: birthYear.toString(),
      birthMonth: Math.floor(Math.random() * 12 + 1).toString(),
      birthDay: Math.floor(Math.random() * 28 + 1).toString()
    });
  };

  const issueCard = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Initializing proof generator...');

    try {
      const { ProofGenerator } = await import('@/lib/proofGenerator');
      const proofGenerator = new ProofGenerator();
      await proofGenerator.init();

      setStatus('Generating hashes...');

      const salt = proofGenerator.generateSalt();
      const secret = proofGenerator.generateSecret();
      const stateSalt = proofGenerator.generateSalt();
      const genderSalt = proofGenerator.generateSalt();

      const aadhaarHash = proofGenerator.generateAadhaarHash(
        formData.aadhaarNumber,
        formData.birthYear,
        formData.birthMonth,
        formData.birthDay,
        salt
      );

      const secretHash = proofGenerator.generateSecretHash(secret);
      const stateCode = stateMapping[formData.state];
      const stateCommitment = proofGenerator.generateStateCommitment(stateCode, stateSalt);
      const genderCode = genderMapping[formData.gender];
      const genderCommitment = proofGenerator.generateGenderCommitment(genderCode, genderSalt);

      setStatus('Connecting to contract...');

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
           const deploymentsResponse = await fetch('/deployments.json');
      if (!deploymentsResponse.ok) {
        throw new Error('Failed to load deployments.json');
      }
      const deployments = await deploymentsResponse.json();
      
      const attesterABIResponse = await fetch('/contracts/AttesterContract.json');
      if (!attesterABIResponse.ok) {
        throw new Error('Failed to load AttesterContract.json');
      }
      const attesterABI = await attesterABIResponse.json();
      
      console.log('Deployments:', deployments);
      console.log('Contract address:', deployments.attesterContract);
      console.log('ABI loaded:', attesterABI.abi ? 'Yes' : 'No');
      
      const attesterContract = new ethers.Contract(
        deployments.attesterContract,
        attesterABI.abi,
        signer
      );

      setStatus('Issuing Aadhaar card on blockchain...');

      const tx = await attesterContract.issueAadhaarCard(
        formData.userAddress,
        `AADHAAR_${formData.aadhaarNumber}`,
        aadhaarHash,
        secretHash,
        stateCommitment,
        genderCommitment
      );

      setStatus('Waiting for transaction confirmation...');
      await tx.wait();

      const cardData = {
        userAddress: formData.userAddress,
        name: formData.name,
        aadhaarNumber: formData.aadhaarNumber,
        birthYear: formData.birthYear,
        birthMonth: formData.birthMonth,
        birthDay: formData.birthDay,
        state: formData.state,
        stateCode: stateCode,
        userState: stateCode, // For user page compatibility
        gender: formData.gender,
        genderCode: genderCode,
        userGender: genderCode, // For user page compatibility
        salt: salt.toString(),
        secret: secret.toString(),
        stateSalt: stateSalt.toString(),
        genderSalt: genderSalt.toString(),
        aadhaarHash: aadhaarHash,
        secretHash: secretHash,
        stateCommitment: stateCommitment,
        genderCommitment: genderCommitment,
        issuedAt: new Date().toISOString()
      };

      const newIssuedCards = [...issuedCards, cardData];
      setIssuedCards(newIssuedCards);
      localStorage.setItem('issuedCards', JSON.stringify(newIssuedCards));
      localStorage.setItem(`user_${formData.userAddress}`, JSON.stringify(cardData));

      setStatus(`✅ Successfully issued Aadhaar card to ${formData.name}!`);
      
      setFormData({
        userAddress: '',
        name: '',
        aadhaarNumber: '',
        birthYear: '',
        birthMonth: '',
        birthDay: '',
        state: 'Maharashtra',
        gender: 'Male'
      });

    } catch (error) {
      console.error('Error issuing card:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (revokeConfirmation !== revokeModal.card.aadhaarNumber) {
      setRevokeStatus('❌ Aadhaar number does not match!');
      return;
    }

    setRevokeLoading(true);
    setRevokeStatus('Connecting to contract...');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const deployments = await fetch('/deployments.json').then(r => r.json());
      const attesterABI = await fetch('/contracts/AttesterContract.json').then(r => r.json());
      
      const attesterContract = new ethers.Contract(
        deployments.attesterContract,
        attesterABI.abi,
        signer
      );

      setRevokeStatus('Revoking Aadhaar card on blockchain...');
      const tx = await attesterContract.revokeAadhaarCard(revokeModal.card.userAddress);

      setRevokeStatus('Waiting for transaction confirmation...');
      await tx.wait();

      const updatedCards = issuedCards.filter(
        card => card.userAddress.toLowerCase() !== revokeModal.card.userAddress.toLowerCase()
      );
      setIssuedCards(updatedCards);
      localStorage.setItem('issuedCards', JSON.stringify(updatedCards));
      localStorage.removeItem(`user_${revokeModal.card.userAddress}`);

      setRevokeStatus(`✅ Successfully revoked Aadhaar card for ${revokeModal.card.name}!`);

      setTimeout(() => {
        setRevokeModal({ isOpen: false, card: null });
        setRevokeConfirmation('');
        setRevokeStatus('');
      }, 2000);

    } catch (error) {
      console.error('Error revoking card:', error);
      setRevokeStatus(`❌ Error: ${error.message}`);
    } finally {
      setRevokeLoading(false);
    }
  };

  const openRevokeModal = (card) => {
    setRevokeModal({ isOpen: true, card });
    setRevokeConfirmation('');
    setRevokeStatus('');
  };

  const closeRevokeModal = () => {
    setRevokeModal({ isOpen: false, card: null });
    setRevokeConfirmation('');
    setRevokeStatus('');
  };

  const openDetailsModal = (card) => {
    setDetailsModal({ isOpen: true, card });
  };

  const closeDetailsModal = () => {
    setDetailsModal({ isOpen: false, card: null });
  };

  const getAge = (birthYear) => {
    return new Date().getFullYear() - parseInt(birthYear);
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <WalletConnect />
        <p className="mt-4 text-sm">Please connect your wallet.</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-red-700 mb-2">Access Denied</h1>
          <p className="text-gray-700">Only the fixed Attester wallet (set at deploy) can open this portal.</p>
          <Link href="/" className="text-blue-700 underline">← Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Attester Portal</h1>
          <p className="text-gray-700">Issue Aadhaar cards with zero-knowledge proofs</p>
        </div>

        <div className="mb-6">
          <WalletConnect />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Issue Card Form */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Issue New Aadhaar Card</h2>
            
            <form onSubmit={issueCard} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">User Wallet Address</label>
                <input
                  type="text"
                  value={formData.userAddress}
                  onChange={(e) => setFormData({...formData, userAddress: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0x..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Full Name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Aadhaar Number</label>
                <input
                  type="text"
                  value={formData.aadhaarNumber}
                  onChange={(e) => setFormData({...formData, aadhaarNumber: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="12-digit number"
                  maxLength={12}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Year</label>
                  <input
                    type="number"
                    value={formData.birthYear}
                    onChange={(e) => setFormData({...formData, birthYear: e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="YYYY"
                    min="1900"
                    max={new Date().getFullYear()}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Month</label>
                  <input
                    type="number"
                    value={formData.birthMonth}
                    onChange={(e) => setFormData({...formData, birthMonth: e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="MM"
                    min="1"
                    max="12"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Day</label>
                  <input
                    type="number"
                    value={formData.birthDay}
                    onChange={(e) => setFormData({...formData, birthDay: e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="DD"
                    min="1"
                    max="31"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">State</label>
                <select
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.keys(stateMapping).map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.keys(genderMapping).map(gender => (
                    <option key={gender} value={gender}>{gender}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={generateRandomData}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Generate Random
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Processing...' : 'Issue Card'}
                </button>
              </div>
            </form>

            {status && (
              <div className={`mt-4 p-3 rounded-lg font-medium border ${
                status.includes('✅') ? 'bg-green-100 text-green-900 border-green-300' : 
                status.includes('❌') ? 'bg-red-100 text-red-900 border-red-300' : 
                'bg-blue-100 text-blue-900 border-blue-300'
              }`}>
                {status}
              </div>
            )}
          </div>

          {/* Issued Cards List */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Issued Cards ({issuedCards.length})</h2>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {issuedCards.length === 0 ? (
                <p className="text-gray-700 text-center py-8">No cards issued yet</p>
              ) : (
                issuedCards.map((card, idx) => (
                  <div key={idx} className="border border-gray-300 rounded-lg p-3 hover:shadow-md transition-shadow">
                    <div onClick={() => openDetailsModal(card)} className="cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{card.name}</p>
                          <p className="text-xs text-gray-600">{card.userAddress.slice(0, 10)}...</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded font-medium border ${
                          getAge(card.birthYear) >= 18 
                            ? 'bg-green-100 text-green-800 border-green-300' 
                            : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                        }`}>
                          {getAge(card.birthYear) >= 18 ? 'Over 18' : 'Under 18'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-700 space-y-1">
                        <p>Aadhaar: {card.aadhaarNumber}</p>
                        <p>DOB: {card.birthDay}/{card.birthMonth}/{card.birthYear} (Age: {getAge(card.birthYear)})</p>
                        <p>State: {card.state}</p>
                        <p className="text-gray-600">Issued: {new Date(card.issuedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openRevokeModal(card)}
                        className="w-full text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                      >
                        Revoke Card
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Revocation Modal */}
        {revokeModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4 text-red-600">⚠️ Revoke Aadhaar Card</h3>
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-600 mb-2">You are about to revoke the card for:</p>
                <p className="font-semibold">{revokeModal.card?.name}</p>
                <p className="text-xs text-gray-500">{revokeModal.card?.userAddress}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-red-600">
                  Enter Aadhaar Number to confirm revocation:
                </label>
                <input
                  type="text"
                  value={revokeConfirmation}
                  onChange={(e) => setRevokeConfirmation(e.target.value)}
                  className="w-full border-2 border-red-300 rounded px-3 py-2 focus:outline-none focus:border-red-500"
                  placeholder="Enter 12-digit Aadhaar number"
                  maxLength={12}
                  disabled={revokeLoading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Expected: {revokeModal.card?.aadhaarNumber}
                </p>
              </div>
              {revokeStatus && (
                <div className={`mb-4 p-3 rounded text-sm ${
                  revokeStatus.includes('✅') ? 'bg-green-100 text-green-800' : 
                  revokeStatus.includes('❌') ? 'bg-red-100 text-red-800' : 
                  'bg-blue-100 text-blue-800'
                }`}>
                  {revokeStatus}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={closeRevokeModal}
                  disabled={revokeLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={revokeLoading || revokeConfirmation !== revokeModal.card?.aadhaarNumber}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {revokeLoading ? 'Revoking...' : 'Confirm Revoke'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Card Details Modal */}
        {detailsModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold text-blue-600">📋 Aadhaar Card Details</h3>
                <button
                  onClick={closeDetailsModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="space-y-6">
                {/* Personal Information */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <span>👤</span> Personal Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-600">Full Name</p>
                      <p className="font-medium">{detailsModal.card?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Gender</p>
                      <p className="font-medium">{detailsModal.card?.gender || 'Male'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Date of Birth</p>
                      <p className="font-medium">
                        {detailsModal.card?.birthDay}/{detailsModal.card?.birthMonth}/{detailsModal.card?.birthYear}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Age</p>
                      <p className="font-medium">{getAge(detailsModal.card?.birthYear)} years</p>
                    </div>
                  </div>
                </div>

                {/* Aadhaar Information */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <span>🆔</span> Aadhaar Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-600">Aadhaar Number</p>
                      <p className="font-medium font-mono">{detailsModal.card?.aadhaarNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Card ID</p>
                      <p className="font-medium text-xs">AADHAAR_{detailsModal.card?.aadhaarNumber}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-600">State</p>
                      <p className="font-medium">{detailsModal.card?.state} (Code: {detailsModal.card?.stateCode})</p>
                    </div>
                  </div>
                </div>

                {/* Blockchain Information */}
                <div className="bg-purple-50 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <span>🔗</span> Blockchain Information
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-600">User Wallet Address</p>
                      <p className="font-medium text-xs font-mono break-all">{detailsModal.card?.userAddress}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Aadhaar Hash</p>
                      <p className="font-medium text-xs font-mono break-all">{detailsModal.card?.aadhaarHash}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Secret Hash</p>
                      <p className="font-medium text-xs font-mono break-all">{detailsModal.card?.secretHash}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">State Commitment</p>
                      <p className="font-medium text-xs font-mono break-all">{detailsModal.card?.stateCommitment}</p>
                    </div>
                  </div>
                </div>

                {/* Zero-Knowledge Proof Data */}
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                    <span>🔐</span> Zero-Knowledge Proof Data
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-600">Salt</p>
                      <p className="font-medium text-xs font-mono break-all">{detailsModal.card?.salt}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Secret</p>
                      <p className="font-medium text-xs font-mono break-all">{detailsModal.card?.secret}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">State Salt</p>
                      <p className="font-medium text-xs font-mono break-all">{detailsModal.card?.stateSalt}</p>
                    </div>
                  </div>
                </div>

                {/* Issuance Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span>📅</span> Issuance Information
                  </h4>
                  <div>
                    <p className="text-xs text-gray-600">Issued At</p>
                    <p className="font-medium">{new Date(detailsModal.card?.issuedAt).toLocaleString()}</p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex justify-center">
                  <div className={`px-4 py-2 rounded-full ${
                    getAge(detailsModal.card?.birthYear) >= 18 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    <span className="font-semibold">
                      {getAge(detailsModal.card?.birthYear) >= 18 ? '✓ Over 18 Years Old' : '⚠ Under 18 Years Old'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={closeDetailsModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    closeDetailsModal();
                    openRevokeModal(detailsModal.card);
                  }}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Revoke This Card
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}