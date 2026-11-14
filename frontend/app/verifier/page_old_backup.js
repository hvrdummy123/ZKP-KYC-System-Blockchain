
'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import WalletConnect from '@/components/WalletConnect';

export default function VerifierPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [requests, setRequests] = useState([]);
  const [results, setResults] = useState({});
  const [currentAccount, setCurrentAccount] = useState(null);

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
      const over18ABI = await fetch('/contracts/Over18Verifier.json').then(r => r.json());
      const over18Verifier = new ethers.Contract(
        deployments.over18Verifier,
        over18ABI.abi,
        signer
      );

      for (const request of myPendingRequests) {
        try {
          const [completed, result] = await over18Verifier.getVerificationResult(request.requestId);
          
          if (completed) {
            console.log(`✅ Request ${request.requestId} completed:`, result ? 'OVER 18' : 'UNDER 18');
            
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
      const over18ABI = await fetch('/contracts/Over18Verifier.json').then(r => r.json());

      const over18Verifier = new ethers.Contract(
        deployments.over18Verifier,
        over18ABI.abi,
        signer
      );

      console.log('🔍 Checking result for requestId:', requestId);

      const [completed, result] = await over18Verifier.getVerificationResult(requestId);

      console.log('📋 Contract returned:');
      console.log('  Completed:', completed);
      console.log('  Result:', result);
      console.log('  Interpretation:', result ? 'OVER 18 ✅' : 'UNDER 18 ❌');

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

        setStatus(`✅ Result retrieved: ${result ? 'OVER 18' : 'UNDER 18'}`);
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
      const over18ABI = await fetch('/contracts/Over18Verifier.json').then(r => r.json());

      const over18Verifier = new ethers.Contract(
        deployments.over18Verifier,
        over18ABI.abi,
        signer
      );

      setStatus('Checking if user has valid Aadhaar card...');

      // Get attester contract to check validity
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
      const tx = await over18Verifier.requestVerification(userAddress, {
        value: verificationFee
      });

      setStatus('Waiting for transaction confirmation...');
      const receipt = await tx.wait();

      // Parse event to get request ID
      let requestId;
      const eventSignature = "VerificationRequested(uint256,address,address,uint256)";
      const expectedTopic = ethers.id(eventSignature);

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === deployments.over18Verifier.toLowerCase() && 
            log.topics[0] === expectedTopic) {
          const parsedLog = over18Verifier.interface.parseLog(log);
          requestId = parsedLog.args.requestId.toString();
          break;
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
        result: null
      };

      console.log('🔍 Saving new request:', newRequest);

      const newRequests = [...requests, newRequest];
      setRequests(newRequests);
      localStorage.setItem('verificationRequests', JSON.stringify(newRequests));

      // Save for the user - ALWAYS append to their pending list
      // IMPORTANT: Normalize address to lowercase for consistency
      const normalizedUserAddress = userAddress;
      const userRequestsKey = `pending_${normalizedUserAddress}`;
      console.log('🔍 User requests key:', userRequestsKey);
      console.log('🔍 Original address:', userAddress);
      console.log('🔍 Normalized address:', normalizedUserAddress);
      
      const existingUserRequests = JSON.parse(localStorage.getItem(userRequestsKey) || '[]');
      console.log('🔍 Existing user requests:', existingUserRequests);
      
      // Add new request to user's pending list
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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Verifier Portal</h1>
          <p className="text-gray-600">Request and check age verifications</p>
        </div>

        <div className="mb-6">
          <WalletConnect />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Request Verification</h2>
            
            <form onSubmit={requestVerification} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">User Wallet Address</label>
                <input
                  type="text"
                  value={userAddress}
                  onChange={(e) => setUserAddress(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="0x..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Fee: 0.001 ETH (refunded if user completes verification)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded"
              >
                {loading ? 'Processing...' : 'Request Verification'}
              </button>
            </form>

            {status && (
              <div className={`mt-4 p-3 rounded text-sm ${
                status.includes('✅') ? 'bg-green-100 text-green-800' : 
                status.includes('❌') ? 'bg-red-100 text-red-800' : 
                'bg-blue-100 text-blue-800'
              }`}>
                {status}
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 rounded">
              <h3 className="font-semibold text-sm mb-2">Quick Test Addresses:</h3>
              <div className="text-xs space-y-1 font-mono">
                <p>Alice (Account 1): 0x70997970C51812dc3A010C7d01b50e0d17dc79C8</p>
                <p>Bob (Account 2): 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC</p>
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                My Verification Requests ({requests.filter(r => r.requester.toLowerCase() === currentAccount).length})
              </h2>
              <button
                onClick={refreshAllResults}
                className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
              >
                
              Refresh All
              </button>
            </div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {requests.filter(r => r.requester.toLowerCase() === currentAccount).length === 0 ? (
                <p className="text-gray-500 text-center py-8">No requests from your account</p>
              ) : (
                [...requests].reverse().filter(r => r.requester.toLowerCase() === currentAccount).map((request, idx) => {
                  const result = results[request.requestId] || { 
                    completed: request.status === 'completed', 
                    result: request.result 
                  };
                  
                  return (
                    <div key={idx} className="border rounded p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="text-sm font-semibold">Request #{request.requestId}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            User: {request.userAddress.slice(0, 10)}...
                          </p>
                        </div>
                        <div className="text-right">
                          {result.completed ? (
                            <div>
                              <span className={`text-xs px-2 py-1 rounded ${
                                result.result 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {result.result ? '✅ Over 18' : '❌ Under 18'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                              ⏳ Pending
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
                          className="w-full text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 py-1 px-2 rounded"
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

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-2"> How it works:</h3>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Enter the user's wallet address and pay 0.001 ETH fee</li>
            <li>User receives notification to generate proof</li>
            <li>User submits ZK proof (off-chain generation)</li>
            <li>Smart contract verifies proof (on-chain)</li>
            <li>You get the result: Over 18 or Under 18 (without revealing exact age)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}