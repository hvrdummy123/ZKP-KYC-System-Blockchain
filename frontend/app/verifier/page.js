'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Link from 'next/link';
import WalletConnect from '@/components/WalletConnect';
import { getRoleRegistry, ROLE } from '@/lib/contracts';

const GENDER_MAP = {
  1: 'Male',
  2: 'Female',
  3: 'Transgender'
};

const STATE_MAP = {
  27: 'Maharashtra',
  29: 'Karnataka',
  7: 'Delhi'
};

export default function VerifierPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [requests, setRequests] = useState([]);
  const [results, setResults] = useState({});
  const [currentAccount, setCurrentAccount] = useState(null);
  const [roleOk, setRoleOk] = useState(false);
  const [roleMsg, setRoleMsg] = useState('Checking role…');
  
  // Form states
  const [verificationType, setVerificationType] = useState('age');
  const [selectedGender, setSelectedGender] = useState(1);
  const [selectedState, setSelectedState] = useState(27);

  useEffect(() => {
    // Load requests from localStorage
    const stored = localStorage.getItem('verificationRequests');
    if (stored) {
      setRequests(JSON.parse(stored));
    }

    // Get current account
    loadCurrentAccount();

    // ✅ Auto-refresh results every 5 seconds
    const interval = setInterval(() => {
      refreshAllResultsSilently();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Update when requests change
  useEffect(() => {
    if (currentAccount && requests.length > 0) {
      refreshAllResultsSilently();
    }
  }, [currentAccount, requests.length]);

  const loadCurrentAccount = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setCurrentAccount(address.toLowerCase());
        try {
          const registry = await getRoleRegistry();
          const r = Number(await registry.roleOf(address));
          if (r === ROLE.Verifier) {
            setRoleOk(true);
            setRoleMsg('');
          } else if (r === ROLE.User) {
            setRoleOk(false);
            setRoleMsg('This wallet is locked as User. Verifiers must use a company wallet.');
          } else if (await registry.isAttester(address)) {
            setRoleOk(false);
            setRoleMsg('Attester cannot use the Verifier portal.');
          } else {
            setRoleOk(false);
            setRoleMsg('Sign up as Verifier on the home page first.');
          }
        } catch (e) {
          setRoleOk(false);
          setRoleMsg(e?.message || 'RoleRegistry unavailable — redeploy.');
        }
      }
    } catch (error) {
      console.error('Error loading account:', error);
    }
  };

  const refreshAllResultsSilently = async () => {
    try {
      if (typeof window.ethereum === 'undefined' || !currentAccount) return;
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const currentAddress = await signer.getAddress();

      const myPendingRequests = requests.filter(
        req => req.requester.toLowerCase() === currentAddress.toLowerCase() && 
               (!results[req.requestId]?.completed)
      );

      if (myPendingRequests.length === 0) return;

      const deployments = await fetch('/deployments.json').then(r => r.json());

      for (const request of myPendingRequests) {
        try {
          let verifierContract;
          
          if (request.verificationType === 'age') {
            const over18ABI = await fetch('/contracts/Over18Verifier.json').then(r => r.json());
            verifierContract = new ethers.Contract(
              deployments.over18Verifier,
              over18ABI.abi,
              signer
            );
          } else if (request.verificationType === 'gender') {
            const genderABI = await fetch('/contracts/GenderVerifier.json').then(r => r.json());
            verifierContract = new ethers.Contract(
              deployments.genderVerifier,
              genderABI.abi,
              signer
            );
          } else if (request.verificationType === 'state') {
            const stateABI = await fetch('/contracts/StateOfResidenceVerifier.json').then(r => r.json());
            verifierContract = new ethers.Contract(
              deployments.stateOfResidenceVerifier,
              stateABI.abi,
              signer
            );
          }

          let completed, result;
          
          if (request.verificationType === 'age') {
            [completed, result] = await verifierContract.getVerificationResult(request.requestId);
          } else if (request.verificationType === 'gender') {
            const req = await verifierContract.genderVerificationRequests(request.requestId);
            completed = req.isCompleted;
            result = req.result;
          } else if (request.verificationType === 'state') {
            [completed, result] = await verifierContract.getStateVerificationResult(request.requestId);
          }
          
          if (completed) {
            console.log(`✅ Request ${request.requestId} (${request.verificationType}) completed:`, result);
            
            // Update results state
            setResults(prev => ({
              ...prev,
              [request.requestId]: { completed, result }
            }));

            // Update requests array
            setRequests(prev => prev.map(req => 
              req.requestId === request.requestId 
                ? { ...req, status: 'completed', result: result }
                : req
            ));
          }
        } catch (error) {
          // Silently fail for individual requests
        }
      }
    } catch (error) {
      // Silently fail for background refresh
    }
  };

  const checkResult = async (requestId) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const currentAddress = await signer.getAddress();

      const request = requests.find(r => r.requestId === requestId);
      if (!request) {
        console.error('Request not found');
        return;
      }

      if (request.requester.toLowerCase() !== currentAddress.toLowerCase()) {
        setStatus(`❌ Only the original requester (${request.requester.slice(0, 10)}...) can check this result`);
        return;
      }

      const deployments = await fetch('/deployments.json').then(r => r.json());
      let verifierContract;

      if (request.verificationType === 'age') {
        const over18ABI = await fetch('/contracts/Over18Verifier.json').then(r => r.json());
        verifierContract = new ethers.Contract(
          deployments.over18Verifier,
          over18ABI.abi,
          signer
        );
      } else if (request.verificationType === 'gender') {
        const genderABI = await fetch('/contracts/GenderVerifier.json').then(r => r.json());
        verifierContract = new ethers.Contract(
          deployments.genderVerifier,
          genderABI.abi,
          signer
        );
      } else if (request.verificationType === 'state') {
        const stateABI = await fetch('/contracts/StateOfResidenceVerifier.json').then(r => r.json());
        verifierContract = new ethers.Contract(
          deployments.stateOfResidenceVerifier,
          stateABI.abi,
          signer
        );
      }

      console.log('🔍 Checking result for requestId:', requestId);

      let completed, result;
      
      if (request.verificationType === 'age') {
        [completed, result] = await verifierContract.getVerificationResult(requestId);
      } else if (request.verificationType === 'gender') {
        const req = await verifierContract.genderVerificationRequests(requestId);
        completed = req.isCompleted;
        result = req.result;
      } else if (request.verificationType === 'state') {
        [completed, result] = await verifierContract.getStateVerificationResult(requestId);
      }

      console.log('📋 Contract returned:');
      console.log('  Completed:', completed);
      console.log('  Result:', result);

      setResults(prev => ({
        ...prev,
        [requestId]: { completed, result }
      }));

      if (completed) {
        const updatedRequests = requests.map(req => 
          req.requestId === requestId 
            ? { ...req, status: 'completed', result: result }
            : req
        );
        setRequests(updatedRequests);
        localStorage.setItem('verificationRequests', JSON.stringify(updatedRequests));

        let resultText = '';
        if (request.verificationType === 'age') {
          resultText = result ? 'OVER 18' : 'UNDER 18';
        } else if (request.verificationType === 'gender') {
          const genderName = GENDER_MAP[request.requiredGender];
          resultText = result ? `YES (${genderName})` : `NO (Not ${genderName})`;
        } else if (request.verificationType === 'state') {
          const stateName = STATE_MAP[request.requiredState];
          resultText = result ? `YES (${stateName})` : `NO (Not ${stateName})`;
        }

        setStatus(`✅ Result retrieved: ${resultText}`);
      } else {
        setStatus('⏳ Verification still pending');
      }
    } catch (error) {
      console.error('Error checking result:', error);
      if (error.message.includes('Not authorized')) {
        setStatus('❌ Only the original requester can check this result');
      } else {
        setStatus(`❌ Error checking result: ${error.message}`);
      }
    }
  };

  const refreshAllResults = async () => {
    setStatus('🔄 Refreshing all results from blockchain...');
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const currentAddress = await signer.getAddress();

    const myRequests = requests.filter(
      req => req.requester.toLowerCase() === currentAddress.toLowerCase()
    );

    console.log(`🔄 Refreshing ${myRequests.length} requests for ${currentAddress}`);

    let refreshedCount = 0;
    for (const request of myRequests) {
      try {
        await checkResult(request.requestId);
        refreshedCount++;
      } catch (error) {
        console.error(`Failed to refresh request ${request.requestId}:`, error);
      }
    }

    if (myRequests.length === 0) {
      setStatus('ℹ️ No pending requests from your account');
    } else {
      setStatus(`✅ Refreshed ${refreshedCount} of ${myRequests.length} requests`);
    }
  };

  const requestVerification = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Requesting verification...');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      const deployments = await fetch('/deployments.json').then(r => r.json());
      
      // Check if user has valid Aadhaar card
      setStatus('Checking if user has valid Aadhaar card...');
      const attesterABI = await fetch('/contracts/AttesterContract.json').then(r => r.json());
      const attesterContract = new ethers.Contract(
        deployments.attesterContract,
        attesterABI.abi,
        signer
      );

      const hasCard = await attesterContract.hasValidCard(userAddress);
      
      if (!hasCard) {
        setStatus('❌ User does not have a valid Aadhaar card!');
        setLoading(false);
        return;
      }

      setStatus('Sending verification request...');

      const verificationFee = ethers.parseEther("0.001");
      let tx, verifierContract, verifierABI;
      let requestId;

      if (verificationType === 'age') {
        verifierABI = await fetch('/contracts/Over18Verifier.json').then(r => r.json());
        verifierContract = new ethers.Contract(
          deployments.over18Verifier,
          verifierABI.abi,
          signer
        );

        tx = await verifierContract.requestVerification(userAddress, {
          value: verificationFee
        });

      } else if (verificationType === 'gender') {
        verifierABI = await fetch('/contracts/GenderVerifier.json').then(r => r.json());
        verifierContract = new ethers.Contract(
          deployments.genderVerifier,
          verifierABI.abi,
          signer
        );

        tx = await verifierContract.requestGenderVerification(userAddress, selectedGender, {
          value: verificationFee
        });

      } else if (verificationType === 'state') {
        verifierABI = await fetch('/contracts/StateOfResidenceVerifier.json').then(r => r.json());
        verifierContract = new ethers.Contract(
          deployments.stateOfResidenceVerifier,
          verifierABI.abi,
          signer
        );

        tx = await verifierContract.requestStateVerification(userAddress, selectedState, {
          value: verificationFee
        });
      }

      setStatus('Waiting for transaction confirmation...');
      const receipt = await tx.wait();

      // Parse event to get request ID
      for (const log of receipt.logs) {
        try {
          const parsedLog = verifierContract.interface.parseLog(log);
          if (parsedLog.name.includes('Requested')) {
            requestId = parsedLog.args.requestId.toString();
            break;
          }
        } catch (e) {
          // Not the right log
        }
      }

      if (!requestId) {
        throw new Error('Could not find request ID in transaction logs');
      }

      // Save request
      const newRequest = {
        requestId,
        userAddress,
        requester: signerAddress,
        timestamp: new Date().toISOString(),
        status: 'pending',
        result: null,
        verificationType,
        requiredGender: verificationType === 'gender' ? selectedGender : undefined,
        requiredState: verificationType === 'state' ? selectedState : undefined
      };

      console.log('🔍 Saving new request:', newRequest);

      const newRequests = [...requests, newRequest];
      setRequests(newRequests);
      localStorage.setItem('verificationRequests', JSON.stringify(newRequests));

      // Save for the user
      const normalizedUserAddress = userAddress;
      const userRequestsKey = `pending_${normalizedUserAddress}`;
      console.log('🔍 User requests key:', userRequestsKey);
      
      const existingUserRequests = JSON.parse(localStorage.getItem(userRequestsKey) || '[]');
      console.log('🔍 Existing user requests:', existingUserRequests);
      
      existingUserRequests.push(newRequest);
      console.log('🔍 Updated user requests:', existingUserRequests);
      
      localStorage.setItem(userRequestsKey, JSON.stringify(existingUserRequests));
      console.log('✅ Saved to localStorage with key:', userRequestsKey);

      setStatus(`✅ Verification requested! Request ID: ${requestId}`);
      setUserAddress('');

    } catch (error) {
      console.error('Error requesting verification:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getRequestTypeLabel = (request) => {
    if (request.verificationType === 'age') {
      return { text: 'Age', color: 'bg-blue-50 text-blue-800 border-blue-300' };
    } else if (request.verificationType === 'gender') {
      return { text: 'Gender', color: 'bg-purple-50 text-purple-800 border-purple-300' };
    } else if (request.verificationType === 'state') {
      return { text: 'State', color: 'bg-green-50 text-green-800 border-green-300' };
    }
    return { text: 'Unknown', color: 'bg-gray-100 text-gray-800 border-gray-300' };
  };

  const getResultText = (request, result) => {
    if (request.verificationType === 'age') {
      return result ? 'Over 18' : 'Under 18';
    } else if (request.verificationType === 'gender') {
      const genderName = GENDER_MAP[request.requiredGender] || 'Unknown';
      return result ? `Yes - ${genderName}` : `No - Not ${genderName}`;
    } else if (request.verificationType === 'state') {
      const stateName = STATE_MAP[request.requiredState] || `State ${request.requiredState}`;
      return result ? `Yes - ${stateName}` : `No - Not ${stateName}`;
    }
    return result ? 'Yes' : 'No';
  };

  if (!roleOk) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-md mx-auto space-y-4">
          <WalletConnect />
          <div className="text-center space-y-3 bg-white border rounded-lg p-6">
            <div className="text-5xl">🔒</div>
            <h1 className="text-xl font-bold text-red-700">Verifier access only</h1>
            <p className="text-gray-700 text-sm">{roleMsg}</p>
            <Link href="/" className="text-blue-700 underline text-sm">← Home to sign up</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Verifier Portal</h1>
          <p className="text-gray-700">Request and check verifications (Age, Gender, State)</p>
        </div>

        <div className="mb-6">
          <WalletConnect />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request Form */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Request Verification</h2>
            
            <form onSubmit={requestVerification} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Verification Type</label>
                <select
                  value={verificationType}
                  onChange={(e) => setVerificationType(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="age">Age Verification (Over 18)</option>
                  <option value="gender">Gender Verification</option>
                  <option value="state">State of Residence</option>
                </select>
              </div>

              {verificationType === 'gender' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Required Gender</label>
                  <select
                    value={selectedGender}
                    onChange={(e) => setSelectedGender(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={1}>Male</option>
                    <option value={2}>Female</option>
                    <option value={3}>Transgender</option>
                  </select>
                </div>
              )}

              {verificationType === 'state' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Required State</label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={27}>Maharashtra (27)</option>
                    <option value={29}>Karnataka (29)</option>
                    <option value={7}>Delhi (7)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">User Wallet Address</label>
                <input
                  type="text"
                  value={userAddress}
                  onChange={(e) => setUserAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0x..."
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  Fee: 0.001 ETH (refunded if user completes verification)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Processing...' : 'Request Verification'}
              </button>
            </form>

            {status && (
              <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
                status.includes('✅') ? 'bg-green-100 text-green-900 border border-green-300' : 
                status.includes('❌') ? 'bg-red-100 text-red-900 border border-red-300' : 
                'bg-blue-100 text-blue-900 border border-blue-300'
              }`}>
                {status}
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-sm text-blue-900 mb-2">Quick Test Addresses:</h3>
              <div className="text-xs space-y-2 text-blue-900">
                <div>
                  <p className="font-mono">Alice: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8</p>
                  <p className="text-blue-800 ml-4">Over 18, Female, Maharashtra</p>
                </div>
                <div>
                  <p className="font-mono">Bob: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC</p>
                  <p className="text-blue-800 ml-4">Under 18, Male, Karnataka</p>
                </div>
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                My Verification Requests ({requests.filter(r => r.requester.toLowerCase() === currentAccount).length})
              </h2>
              <button
                onClick={refreshAllResults}
                className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded font-medium transition-colors"
              >
                Refresh All
              </button>
            </div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {requests.filter(r => r.requester.toLowerCase() === currentAccount).length === 0 ? (
                <p className="text-gray-700 text-center py-8">No requests from your account</p>
              ) : (
                [...requests].reverse().filter(r => r.requester.toLowerCase() === currentAccount).map((request, idx) => {
                  const result = results[request.requestId] || { 
                    completed: request.status === 'completed', 
                    result: request.result 
                  };
                  
                  const typeLabel = getRequestTypeLabel(request);
                  
                  return (
                    <div key={idx} className="border border-gray-300 rounded-lg p-3 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900">Request #{request.requestId}</p>
                            <span className={`text-xs px-2 py-1 rounded font-medium border ${typeLabel.color}`}>
                              {typeLabel.text}
                            </span>
                          </div>
                          <p className="text-xs text-gray-700">
                            User: {request.userAddress.slice(0, 10)}...
                          </p>
                        </div>
                        <div className="text-right">
                          {result.completed ? (
                            <div>
                              <span className={`text-xs px-2 py-1 rounded font-medium border ${
                                result.result 
                                  ? 'bg-green-100 text-green-800 border-green-300' 
                                  : 'bg-red-100 text-red-800 border-red-300'
                              }`}>
                                {getResultText(request, result.result)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800 border border-yellow-300 font-medium">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-600 mb-2">
                        <p>Requested: {new Date(request.timestamp).toLocaleString()}</p>
                      </div>

                      {!result.completed && (
                        <button
                          onClick={() => checkResult(request.requestId)}
                          className="w-full text-xs bg-blue-100 hover:bg-blue-200 text-blue-900 py-2 px-2 rounded font-medium transition-colors"
                        >
                          Check Status
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <h3 className="font-semibold text-sm text-yellow-900 mb-2">How it works:</h3>
          <ol className="text-sm space-y-1 list-decimal list-inside text-yellow-900">
            <li>Choose verification type (Age, Gender, or State)</li>
            <li>Enter the user's wallet address and pay 0.001 ETH fee</li>
            <li>User receives notification to generate proof</li>
            <li>User submits ZK proof (off-chain generation)</li>
            <li>Smart contract verifies proof (on-chain)</li>
            <li>You get the result without learning the user's actual data</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
