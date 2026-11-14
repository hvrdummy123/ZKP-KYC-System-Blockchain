'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import WalletConnect from '@/components/WalletConnect';


const ALLOWED_ATTESTER_ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'.toLowerCase(); // <-- change if needed

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
    async function checkWallet() {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          const addr = accounts[0].address.toLowerCase();
          setAccount(addr);
          setIsAuthorized(addr === ALLOWED_ATTESTER_ADDRESS);
        }
      }
    }
    checkWallet();

    // Listen for wallet changes
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

  useEffect(() => {
    // Load issued cards from localStorage
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
      // Import ProofGenerator dynamically
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

      // Get contract
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

      // Save card data
      const cardData = {
        userAddress: formData.userAddress,
        name: formData.name,
        aadhaarNumber: formData.aadhaarNumber,
        birthYear: formData.birthYear,
        birthMonth: formData.birthMonth,
        birthDay: formData.birthDay,
        state: formData.state,
        stateCode: stateCode,
        userState: stateCode,
        gender: formData.gender,
        genderCode: genderCode,
        userGender: genderCode,
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
      
      // Also save individual user data for easy access
      localStorage.setItem(`user_${formData.userAddress}`, JSON.stringify(cardData));

      setStatus(`✅ Successfully issued Aadhaar card to ${formData.name}!`);
      
      // Reset form
      setFormData({
        userAddress: '',
        name: '',
        aadhaarNumber: '',
        birthYear: '',
        birthMonth: '',
        birthDay: '',
        state: 'Maharashtra'
      });

    } catch (error) {
      console.error('Error issuing card:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
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
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-red-700 mb-2">Access Denied</h1>
          <p className="text-gray-700">You are not the authorized Attester.</p>
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}