

'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import WalletConnect from '@/components/WalletConnect';

export default function UserPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [userData, setUserData] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [proofGenerating, setProofGenerating] = useState(null);

  useEffect(() => {
    loadUserData();
    
    // Set up interval to check for new requests every 3 seconds
    const interval = setInterval(() => {
      loadPendingRequests();
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const loadPendingRequests = async () => {
    try {
      if (!userAddress) {
        console.log('No userAddress yet');
        return;
      }
      
      const requestsKey = `pending_${userAddress}`;
      console.log('Loading requests for key:', requestsKey);
      
      // Load pending requests
      const storedRequests = localStorage.getItem(requestsKey);
      console.log('Raw stored requests:', storedRequests);
      
      const requests = JSON.parse(storedRequests || '[]');
      console.log('Parsed requests:', requests);
      
      const pendingOnly = requests.filter(r => r.status === 'pending' || !r.status);
      console.log('Filtered pending requests:', pendingOnly);
      
      setPendingRequests(pendingOnly);
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      console.log('User address:', address);
      setUserAddress(address);

      // Load user's Aadhaar data
      const stored = localStorage.getItem(`user_${address}`);
      console.log('User data:', stored);
      if (stored) {
        setUserData(JSON.parse(stored));
      }

      // Load pending requests
      const requestsKey = `pending_${address}`;
      console.log('Loading requests with key:', requestsKey);
      
      const storedRequests = localStorage.getItem(requestsKey);
      console.log('Stored requests:', storedRequests);
      
      const requests = JSON.parse(storedRequests || '[]');
      console.log('All requests:', requests);
      
      const pending = requests.filter(r => r.status === 'pending' || !r.status);
      console.log('Pending requests:', pending);
      
      setPendingRequests(pending);

    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const generateAndSubmitProof = async (request) => {
  if (!userData) {
    setStatus('❌ No Aadhaar data found for this address');
    return;
  }

  setLoading(true);
  setProofGenerating(request.requestId);
  setStatus('Initializing proof generator...');

  try {
    // Calculate actual age FIRST for validation
    const today = new Date();
    const age = today.getFullYear() - parseInt(userData.birthYear);
    const monthDiff = (today.getMonth() + 1) - parseInt(userData.birthMonth);
    const dayDiff = today.getDate() - parseInt(userData.birthDay);
    const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
    const expectedIsOver18 = actualAge >= 18;

    console.log('═══════════════════════════════════════════════════════');
    console.log('🎂 AGE CALCULATION (Before Proof Generation)');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Birth Date:', `${userData.birthDay}/${userData.birthMonth}/${userData.birthYear}`);
    console.log('Today:', `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`);
    console.log('Calculated Age:', actualAge);
    console.log('Expected Result:', expectedIsOver18 ? '✅ OVER 18' : '❌ UNDER 18');
    console.log('═══════════════════════════════════════════════════════\n');

    // Dynamically import proof generator
    const { ProofGenerator } = await import('@/lib/proofGenerator');
    const proofGenerator = new ProofGenerator();

    setStatus('Loading cryptographic libraries...');
    await proofGenerator.init();

    setStatus('Generating zero-knowledge proof... (this may take 10-30 seconds)');

    // Generate proof
    const proofResult = await proofGenerator.generateOver18Proof(
      {
        aadhaarNumber: userData.aadhaarNumber,
        birthYear: userData.birthYear,
        birthMonth: userData.birthMonth,
        birthDay: userData.birthDay,
        salt: userData.salt
      },
      userData.secret,
      request.requestId,
      request.requester
    );

    if (!proofResult.success) {
      throw new Error(`Proof generation failed: ${proofResult.error}`);
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔬 PROOF ANALYSIS');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Raw Public Signals:', proofResult.publicSignals);
    console.log('Number of signals:', proofResult.publicSignals.length);
    console.log('\nSignal Breakdown:');
    
    const signalNames = [
      'isOver18',
      'nullifierHash', 
      'currentYear',
      'currentMonth',
      'currentDay',
      'aadhaarHash',
      'secretHash',
      'requestIdentifier',
      'verifierIdentifier'
    ];
    
    proofResult.publicSignals.forEach((signal, idx) => {
      console.log(`  [${idx}] ${signalNames[idx] || 'unknown'}:`, signal, `(BigInt: ${BigInt(signal).toString()})`);
    });

    // ✅ CRITICAL ANALYSIS
    const rawIsOver18 = BigInt(proofResult.publicSignals[0]);
    console.log('\n🔍 CRITICAL SIGNAL [0] - isOver18:');
    console.log('  Raw value:', rawIsOver18.toString());
    console.log('  Type:', typeof proofResult.publicSignals[0]);
    console.log('  Is exactly 0?', rawIsOver18 === 0n);
    console.log('  Is exactly 1?', rawIsOver18 === 1n);
    console.log('  Is > 1?', rawIsOver18 > 1n, rawIsOver18 > 1n ? '← CIRCUIT BUG: Sum not normalized!' : '');

    // ✅ CRITICAL FIX: Normalize to BigInt 0n or 1n (NOT strings!)
    // Keep as BigInt for proper ethers.js conversion to uint256
    const normalizedIsOver18 = rawIsOver18 > 0n ? 1n : 0n;
    
    console.log('\n🔧 NORMALIZATION:');
    console.log('  Before:', rawIsOver18.toString(), `(type: ${typeof rawIsOver18})`);
    console.log('  After:', normalizedIsOver18.toString(), `(type: ${typeof normalizedIsOver18})`);
    console.log('  Interpretation:', normalizedIsOver18 === 1n ? 'OVER 18' : 'UNDER 18');

    // ✅ VALIDATION
    const expectedSignal = expectedIsOver18 ? 1n : 0n;
    const isCorrect = normalizedIsOver18 === expectedSignal;
    
    console.log('\n✅ VALIDATION:');
    console.log('  Expected (from age):', expectedSignal.toString(), expectedIsOver18 ? '(OVER 18)' : '(UNDER 18)');
    console.log('  Got (from circuit):', normalizedIsOver18.toString(), normalizedIsOver18 === 1n ? '(OVER 18)' : '(UNDER 18)');
    console.log('  Match:', isCorrect ? '✅ CORRECT!' : '❌ CIRCUIT BUG - OUTPUT WRONG!');
    
    if (!isCorrect) {
      console.error('\n⚠️⚠️⚠️ CRITICAL ERROR ⚠️⚠️⚠️');
      console.error('The circuit is calculating the WRONG result!');
      console.error('Frontend normalization CANNOT fix incorrect circuit logic.');
      console.error('You MUST fix the circuit itself.');
      console.error('═══════════════════════════════════════════════════════\n');
    }
    console.log('═══════════════════════════════════════════════════════\n');

    // ✅ REPLACE signal[0] with normalized BigInt value
    proofResult.publicSignals[0] = normalizedIsOver18;

    setStatus('Proof generated! Formatting for blockchain...');

    // Format proof for Solidity
    const formatProofForSolidity = (proof) => ({
      pA: [proof.pi_a[0], proof.pi_a[1]],
      pB: [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]]
      ],
      pC: [proof.pi_c[0], proof.pi_c[1]]
    });

    const formattedProof = formatProofForSolidity(proofResult.proof);
    
    // ✅ CRITICAL: Keep as BigInt/numbers, DON'T convert to strings!
    // ethers.js will automatically convert BigInt to uint256 for Solidity
    const publicSignals = proofResult.publicSignals.map(signal => {
  // Ensure we convert everything to string
  const bigIntValue = typeof signal === 'bigint' ? signal : BigInt(signal);
  return bigIntValue.toString();
});

console.log('📤 SENDING TO CONTRACT:');
console.log('  Public Signals (all):', publicSignals);
publicSignals.forEach((signal, idx) => {
  const names = ['isOver18', 'nullifierHash', 'currentYear', 'currentMonth', 'currentDay', 'aadhaarHash', 'secretHash', 'requestIdentifier', 'verifierIdentifier'];
  console.log(`    [${idx}] ${names[idx]}: ${signal} (type: ${typeof signal})`);
});
console.log('  publicSignals[0] (isOver18):', publicSignals[0]);
console.log('  publicSignals[0] type:', typeof publicSignals[0]);  // Should show "string"
console.log('  Contract will interpret as:', publicSignals[0] === '1' ? 'OVER 18 ✅' : 'UNDER 18 ❌');
console.log('  Total signals:', publicSignals.length, '(Contract expects 9)');

    if (publicSignals.length !== 9) {
      console.error('⚠️  WARNING: Signal count mismatch!');
      console.error('  Contract expects 9 signals');
      console.error('  We are sending', publicSignals.length, 'signals');
      throw new Error(`Signal count mismatch: expected 9, got ${publicSignals.length}`);
    }

    setStatus('Connecting to blockchain...');

    // Get contract
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const deployments = await fetch('/deployments.json').then(r => r.json());
    const over18ABI = await fetch('/contracts/Over18Verifier.json').then(r => r.json());

    const over18Verifier = new ethers.Contract(
      deployments.over18Verifier,
      over18ABI.abi,
      signer
    );

    setStatus('Submitting proof to smart contract...');

    console.log('📡 Calling completeVerification with:');
    console.log('  requestId:', request.requestId);
    console.log('  isOver18 signal:', publicSignals[0].toString());
    console.log('  pA:', formattedProof.pA);
    console.log('  pB:', formattedProof.pB);
    console.log('  pC:', formattedProof.pC);

    // ✅ Send BigInt values directly - ethers.js handles conversion
    const tx = await over18Verifier.completeVerification(
      request.requestId,
      formattedProof.pA,
      formattedProof.pB,
      formattedProof.pC,
      publicSignals  // ← Keep as BigInt array, no .toString()!
    );

    setStatus('Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    
    console.log('✅ Transaction confirmed:', receipt.hash);
    
    // Parse events to see what the contract stored
    try {
      const completedEvent = receipt.logs.find(log => {
        try {
          const parsed = over18Verifier.interface.parseLog(log);
          return parsed.name === 'VerificationCompleted';
        } catch {
          return false;
        }
      });

      if (completedEvent) {
        const parsed = over18Verifier.interface.parseLog(completedEvent);
        console.log('\n📋 Contract Event - VerificationCompleted:');
        console.log('  requestId:', parsed.args.requestId.toString());
        console.log('  user:', parsed.args.user);
        console.log('  result:', parsed.args.result ? 'OVER 18 ✅' : 'UNDER 18 ❌');
        console.log('  Expected:', expectedIsOver18 ? 'OVER 18 ✅' : 'UNDER 18 ❌');
        console.log('  Match:', parsed.args.result === expectedIsOver18 ? '✅ CORRECT!' : '❌ MISMATCH!');
      }
    } catch (error) {
      console.log('Could not parse event:', error.message);
    }

    setStatus('✅ Proof submitted successfully!');

    // Update local storage - mark as completed
    const userRequestsKey = `pending_${userAddress}`;
    const allUserRequests = JSON.parse(localStorage.getItem(userRequestsKey) || '[]');
    const updatedUserRequests = allUserRequests.map(r => 
      r.requestId === request.requestId 
        ? { ...r, status: 'completed' }
        : r
    );
    localStorage.setItem(userRequestsKey, JSON.stringify(updatedUserRequests));

    // Update component state - remove from pending
    const updatedPendingRequests = pendingRequests.filter(r => r.requestId !== request.requestId);
    setPendingRequests(updatedPendingRequests);

    // Update verifier's list
    const allRequests = JSON.parse(localStorage.getItem('verificationRequests') || '[]');
    const updatedAllRequests = allRequests.map(r => 
      r.requestId === request.requestId 
        ? { ...r, status: 'completed' }
        : r
    );
    localStorage.setItem('verificationRequests', JSON.stringify(updatedAllRequests));

  } catch (error) {
    console.error('❌ Error generating/submitting proof:', error);
    setStatus(`❌ Error: ${error.message}`);
  } finally {
    setLoading(false);
    setProofGenerating(null);
  }
};
  const getAge = () => {
    if (!userData) return null;
    return new Date().getFullYear() - parseInt(userData.birthYear);
  };

  const isOver18 = () => {
    const age = getAge();
    return age !== null && age >= 18;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2"> User Portal</h1>
          <p className="text-gray-600">Manage your Aadhaar and respond to verification requests</p>
        </div>

        <div className="mb-6">
          <WalletConnect />
        </div>

        {/* User Info Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Aadhaar Information</h2>
          
          {userData ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="font-medium">Name:</span>
                <span>{userData.name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="font-medium">Aadhaar Number:</span>
                <span className="font-mono">{userData.aadhaarNumber}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="font-medium">Date of Birth:</span>
                <span>{userData.birthDay}/{userData.birthMonth}/{userData.birthYear}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="font-medium">Age:</span>
                <span className="font-semibold">{getAge()} years old</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-medium">Age Status:</span>
                <span className={`px-3 py-1 rounded ${
                  isOver18() 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {isOver18() ? '✅ Over 18' : '⚠️ Under 18'}
                </span>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded">
                <p className="text-sm text-blue-800">
                  Your actual age and details are never revealed. 
                  Only zero-knowledge proofs are shared.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">No Aadhaar card found for this address</p>
              <p className="text-sm text-gray-400">
                Please contact an Attester to issue you an Aadhaar card
              </p>
            </div>
          )}
        </div>

        {/* Pending Requests */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Pending Verification Requests ({pendingRequests.length})
            </h2>
            <button
              onClick={loadPendingRequests}
              className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
              title="Refresh pending requests"
            >
              Refresh
            </button>
          </div>
          
          {status && (
            <div className={`mb-4 p-3 rounded text-sm ${
              status.includes('✅') ? 'bg-green-100 text-green-800' : 
              status.includes('❌') ? 'bg-red-100 text-red-800' : 
              'bg-blue-100 text-blue-800'
            }`}>
              {status}
            </div>
          )}

          <div className="space-y-4">
            {pendingRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No pending requests</p>
            ) : (
              pendingRequests.map((request, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold">Verification Request #{request.requestId}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        From: {request.requester.slice(0, 10)}...{request.requester.slice(-8)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Requested: {new Date(request.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                      Pending Response
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded p-3 mb-3">
                    <p className="text-sm font-medium mb-1">Question:</p>
                    <p className="text-sm text-gray-700">
                      "Is this user over 18 years old?"
                    </p>
                  </div>

                  {userData && (
                    <div className="mb-3 p-2 bg-blue-50 rounded">
                      <p className="text-sm">
                        Your answer will be: <span className="font-semibold">
                          {isOver18() ? 'YES (Over 18)' : 'NO (Under 18)'}
                        </span>
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Your exact age will remain private
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => generateAndSubmitProof(request)}
                    disabled={loading || !userData}
                    className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded font-medium"
                  >
                    {proofGenerating === request.requestId 
                      ? 'Generating Proof...' 
                      : userData 
                        ? 'Generate & Submit ZK Proof' 
                        : 'No Aadhaar Data'
                    }
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-2">Privacy Protected:</h3>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Proof generation happens locally in your browser</li>
            <li>Only YES/NO answer is revealed, not your actual age</li>
            <li>Mathematical proof verifies authenticity without revealing data</li>
            <li>Proof generation may take 10-30 seconds</li>
          </ul>
        </div>

        {/* Debug Panel */}
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <details>
            <summary className="cursor-pointer text-sm font-semibold mb-2">Debug Info (Click to expand)</summary>
            <div className="mt-2 text-xs space-y-1 font-mono">
              <p><strong>Your Address:</strong> {userAddress || 'Not connected'}</p>
              <p><strong>LocalStorage Key:</strong> pending_{userAddress}</p>
              <p><strong>Raw Data:</strong></p>
              <pre className="bg-white p-2 rounded overflow-auto max-h-40">
                {localStorage.getItem(`pending_${userAddress}`) || 'null'}
              </pre>
              <button
                onClick={() => {
                  console.log('All localStorage keys:', Object.keys(localStorage));
                  console.log('Your pending requests:', localStorage.getItem(`pending_${userAddress}`));
                }}
                className="mt-2 bg-blue-500 text-white px-2 py-1 rounded text-xs"
              >
                Log to Console
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}