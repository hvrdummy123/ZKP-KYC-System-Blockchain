// 'use client';

// import { useState, useEffect } from 'react';
// import { ethers } from 'ethers';
// import WalletConnect from '@/components/WalletConnect';

// const GENDER_MAP = {
//   1: 'Male',
//   2: 'Female',
//   3: 'Transgender'
// };

// const STATE_MAP = {
//   27: 'Maharashtra',
//   29: 'Karnataka',
//   7: 'Delhi'
// };

// export default function UserPage() {
//   const [loading, setLoading] = useState(false);
//   const [status, setStatus] = useState('');
//   const [userAddress, setUserAddress] = useState('');
//   const [userData, setUserData] = useState(null);
//   const [pendingRequests, setPendingRequests] = useState([]);
//   const [proofGenerating, setProofGenerating] = useState(null);

//   useEffect(() => {
//     loadUserData();
    
//     // Set up interval to check for new requests every 3 seconds
//     const interval = setInterval(() => {
//       loadPendingRequests();
//     }, 3000);
    
//     return () => clearInterval(interval);
//   }, []);

//   const loadPendingRequests = async () => {
//     try {
//       if (!userAddress) {
//         console.log('No userAddress yet');
//         return;
//       }
      
//       const requestsKey = `pending_${userAddress}`;
//       console.log('Loading requests for key:', requestsKey);
      
//       const storedRequests = localStorage.getItem(requestsKey);
//       console.log('Raw stored requests:', storedRequests);
      
//       const requests = JSON.parse(storedRequests || '[]');
//       console.log('Parsed requests:', requests);
      
//       const pendingOnly = requests.filter(r => r.status === 'pending' || !r.status);
//       console.log('Filtered pending requests:', pendingOnly);
      
//       setPendingRequests(pendingOnly);
//     } catch (error) {
//       console.error('Error loading pending requests:', error);
//     }
//   };

//   const loadUserData = async () => {
//     try {
//       const provider = new ethers.BrowserProvider(window.ethereum);
//       const signer = await provider.getSigner();
//       const address = await signer.getAddress();
      
//       console.log('User address:', address);
//       setUserAddress(address);

//       // Load user's Aadhaar data
//       const stored = localStorage.getItem(`user_${address}`);
//       console.log('User data:', stored);
//       if (stored) {
//         setUserData(JSON.parse(stored));
//       }

//       // Load pending requests
//       const requestsKey = `pending_${address}`;
//       console.log('Loading requests with key:', requestsKey);
      
//       const storedRequests = localStorage.getItem(requestsKey);
//       console.log('Stored requests:', storedRequests);
      
//       const requests = JSON.parse(storedRequests || '[]');
//       console.log('All requests:', requests);
      
//       const pending = requests.filter(r => r.status === 'pending' || !r.status);
//       console.log('Pending requests:', pending);
      
//       setPendingRequests(pending);

//     } catch (error) {
//       console.error('Error loading user data:', error);
//     }
//   };

//   const generateAndSubmitProof = async (request) => {
//     if (!userData) {
//       setStatus('❌ No Aadhaar data found for this address');
//       return;
//     }

//     setLoading(true);
//     setProofGenerating(request.requestId);
//     setStatus('Initializing proof generator...');

//     try {
//       // Dynamically import proof generator
//       const { ProofGenerator } = await import('@/lib/proofGenerator');
//       const proofGenerator = new ProofGenerator();

//       setStatus('Loading cryptographic libraries...');
//       await proofGenerator.init();

//       setStatus('Generating zero-knowledge proof... (this may take 10-30 seconds)');

//       let proofResult;
//       let verifierContract;
//       let verifierABI;
//       let deployments;

//       // Generate proof based on verification type
//       if (request.verificationType === 'age') {
//         // Calculate actual age for validation
//         const today = new Date();
//         const age = today.getFullYear() - parseInt(userData.birthYear);
//         const monthDiff = (today.getMonth() + 1) - parseInt(userData.birthMonth);
//         const dayDiff = today.getDate() - parseInt(userData.birthDay);
//         const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
//         const expectedIsOver18 = actualAge >= 18;

//         console.log('🎂 AGE CALCULATION');
//         console.log('Birth Date:', `${userData.birthDay}/${userData.birthMonth}/${userData.birthYear}`);
//         console.log('Calculated Age:', actualAge);
//         console.log('Expected Result:', expectedIsOver18 ? '✅ OVER 18' : '❌ UNDER 18');

//         proofResult = await proofGenerator.generateOver18Proof(
//           {
//             aadhaarNumber: userData.aadhaarNumber,
//             birthYear: userData.birthYear,
//             birthMonth: userData.birthMonth,
//             birthDay: userData.birthDay,
//             salt: userData.salt
//           },
//           userData.secret,
//           request.requestId,
//           request.requester
//         );

//         // Normalize isOver18 signal
//         if (proofResult.success) {
//           const rawIsOver18 = BigInt(proofResult.publicSignals[0]);
//           const normalizedIsOver18 = rawIsOver18 > 0n ? 1n : 0n;
//           proofResult.publicSignals[0] = normalizedIsOver18;
//         }

//         deployments = await fetch('/deployments.json').then(r => r.json());
//         verifierABI = await fetch('/contracts/Over18Verifier.json').then(r => r.json());
        
//         const provider = new ethers.BrowserProvider(window.ethereum);
//         const signer = await provider.getSigner();
//         verifierContract = new ethers.Contract(
//           deployments.over18Verifier,
//           verifierABI.abi,
//           signer
//         );

//       } else if (request.verificationType === 'gender') {
//         proofResult = await proofGenerator.generateGenderProof(
//           userData,
//           userData.secret,
//           request.requestId,
//           request.requester,
//           request.requiredGender
//         );

//         deployments = await fetch('/deployments.json').then(r => r.json());
//         verifierABI = await fetch('/contracts/GenderVerifier.json').then(r => r.json());
        
//         const provider = new ethers.BrowserProvider(window.ethereum);
//         const signer = await provider.getSigner();
//         verifierContract = new ethers.Contract(
//           deployments.genderVerifier,
//           verifierABI.abi,
//           signer
//         );

//       } else if (request.verificationType === 'state') {
//         proofResult = await proofGenerator.generateStateProof(
//           userData,
//           userData.secret,
//           request.requestId,
//           request.requester,
//           request.requiredState
//         );

//         deployments = await fetch('/deployments.json').then(r => r.json());
//         verifierABI = await fetch('/contracts/StateOfResidenceVerifier.json').then(r => r.json());
        
//         const provider = new ethers.BrowserProvider(window.ethereum);
//         const signer = await provider.getSigner();
//         verifierContract = new ethers.Contract(
//           deployments.stateOfResidenceVerifier,
//           verifierABI.abi,
//           signer
//         );
//       }

//       if (!proofResult.success) {
//         throw new Error(`Proof generation failed: ${proofResult.error}`);
//       }

//       setStatus('Proof generated! Formatting for blockchain...');

//       // Format proof for Solidity
//       const formatProofForSolidity = (proof) => ({
//         pA: [proof.pi_a[0], proof.pi_a[1]],
//         pB: [
//           [proof.pi_b[0][1], proof.pi_b[0][0]],
//           [proof.pi_b[1][1], proof.pi_b[1][0]]
//         ],
//         pC: [proof.pi_c[0], proof.pi_c[1]]
//       });

//       const formattedProof = formatProofForSolidity(proofResult.proof);
      
//       // Convert public signals to strings for Solidity
//       const publicSignals = proofResult.publicSignals.map(signal => {
//         const bigIntValue = typeof signal === 'bigint' ? signal : BigInt(signal);
//         return bigIntValue.toString();
//       });

//       console.log('📤 SENDING TO CONTRACT:');
//       console.log('  Public Signals:', publicSignals);
//       console.log('  Total signals:', publicSignals.length);

//       setStatus('Connecting to blockchain...');
//       setStatus('Submitting proof to smart contract...');

//       let tx;
//       if (request.verificationType === 'age') {
//         tx = await verifierContract.completeVerification(
//           request.requestId,
//           formattedProof.pA,
//           formattedProof.pB,
//           formattedProof.pC,
//           publicSignals
//         );
//       } else if (request.verificationType === 'gender') {
//         tx = await verifierContract.completeGenderVerification(
//           request.requestId,
//           formattedProof.pA,
//           formattedProof.pB,
//           formattedProof.pC,
//           publicSignals
//         );
//       } else if (request.verificationType === 'state') {
//         tx = await verifierContract.completeStateVerification(
//           request.requestId,
//           formattedProof.pA,
//           formattedProof.pB,
//           formattedProof.pC,
//           publicSignals
//         );
//       }

//       setStatus('Waiting for transaction confirmation...');
//       const receipt = await tx.wait();
      
//       console.log('✅ Transaction confirmed:', receipt.hash);

//       setStatus('✅ Proof submitted successfully!');

//       // Update local storage - mark as completed
//       const userRequestsKey = `pending_${userAddress}`;
//       const allUserRequests = JSON.parse(localStorage.getItem(userRequestsKey) || '[]');
//       const updatedUserRequests = allUserRequests.map(r => 
//         r.requestId === request.requestId 
//           ? { ...r, status: 'completed' }
//           : r
//       );
//       localStorage.setItem(userRequestsKey, JSON.stringify(updatedUserRequests));

//       // Update component state - remove from pending
//       const updatedPendingRequests = pendingRequests.filter(r => r.requestId !== request.requestId);
//       setPendingRequests(updatedPendingRequests);

//       // Update verifier's list
//       const allRequests = JSON.parse(localStorage.getItem('verificationRequests') || '[]');
//       const updatedAllRequests = allRequests.map(r => 
//         r.requestId === request.requestId 
//           ? { ...r, status: 'completed' }
//           : r
//       );
//       localStorage.setItem('verificationRequests', JSON.stringify(updatedAllRequests));

//     } catch (error) {
//       console.error('❌ Error generating/submitting proof:', error);
//       setStatus(`❌ Error: ${error.message}`);
//     } finally {
//       setLoading(false);
//       setProofGenerating(null);
//     }
//   };

//   const getAge = () => {
//     if (!userData) return null;
//     return new Date().getFullYear() - parseInt(userData.birthYear);
//   };

//   const isOver18 = () => {
//     const age = getAge();
//     return age !== null && age >= 18;
//   };

//   const getRequestDescription = (request) => {
//     if (request.verificationType === 'age') {
//       return 'Is this user over 18 years old?';
//     } else if (request.verificationType === 'gender') {
//       const genderName = GENDER_MAP[request.requiredGender] || 'Unknown';
//       return `Is this user ${genderName}?`;
//     } else if (request.verificationType === 'state') {
//       const stateName = STATE_MAP[request.requiredState] || `State ${request.requiredState}`;
//       return `Does this user live in ${stateName}?`;
//     }
//     return 'Unknown verification type';
//   };

//   const getExpectedAnswer = (request) => {
//     if (!userData) return null;

//     if (request.verificationType === 'age') {
//       return isOver18() ? 'YES (Over 18)' : 'NO (Under 18)';
//     } else if (request.verificationType === 'gender') {
//       const matches = userData.userGender === request.requiredGender;
//       const genderName = GENDER_MAP[request.requiredGender] || 'Unknown';
//       return matches ? `YES (${genderName})` : `NO (Not ${genderName})`;
//     } else if (request.verificationType === 'state') {
//       const matches = userData.userState === request.requiredState;
//       const stateName = STATE_MAP[request.requiredState] || `State ${request.requiredState}`;
//       return matches ? `YES (${stateName})` : `NO (Not ${stateName})`;
//     }
//     return 'Unknown';
//   };

//   return (
//     <div className="min-h-screen bg-gray-50 p-8">
//       <div className="max-w-4xl mx-auto">
//         <div className="mb-8">
//           <h1 className="text-3xl font-bold text-gray-900 mb-2">User Portal</h1>
//           <p className="text-gray-700">Manage your Aadhaar and respond to verification requests</p>
//         </div>

//         <div className="mb-6">
//           <WalletConnect />
//         </div>

//         {/* User Info Card */}
//         <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
//           <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Aadhaar Information</h2>
          
//           {userData ? (
//             <div className="space-y-3">
//               <div className="flex justify-between items-center py-2 border-b border-gray-200">
//                 <span className="font-medium text-gray-700">Name:</span>
//                 <span className="text-gray-900">{userData.name}</span>
//               </div>
//               <div className="flex justify-between items-center py-2 border-b border-gray-200">
//                 <span className="font-medium text-gray-700">Aadhaar Number:</span>
//                 <span className="font-mono text-gray-900">{userData.aadhaarNumber}</span>
//               </div>
//               <div className="flex justify-between items-center py-2 border-b border-gray-200">
//                 <span className="font-medium text-gray-700">Date of Birth:</span>
//                 <span className="text-gray-900">{userData.birthDay}/{userData.birthMonth}/{userData.birthYear}</span>
//               </div>
//               <div className="flex justify-between items-center py-2 border-b border-gray-200">
//                 <span className="font-medium text-gray-700">Age:</span>
//                 <span className="font-semibold text-gray-900">{getAge()} years old</span>
//               </div>
//               <div className="flex justify-between items-center py-2 border-b border-gray-200">
//                 <span className="font-medium text-gray-700">Age Status:</span>
//                 <span className={`px-3 py-1 rounded font-medium ${
//                   isOver18() 
//                     ? 'bg-green-100 text-green-800 border border-green-300' 
//                     : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
//                 }`}>
//                   {isOver18() ? 'Over 18' : 'Under 18'}
//                 </span>
//               </div>
//               <div className="flex justify-between items-center py-2 border-b border-gray-200">
//                 <span className="font-medium text-gray-700">Gender:</span>
//                 <span className="text-gray-900">{GENDER_MAP[userData.userGender] || 'Unknown'}</span>
//               </div>
//               <div className="flex justify-between items-center py-2">
//                 <span className="font-medium text-gray-700">State of Residence:</span>
//                 <span className="text-gray-900">{STATE_MAP[userData.userState] || `State ${userData.userState}`}</span>
//               </div>

//               <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
//                 <p className="text-sm text-blue-900 font-medium">
//                   Privacy Protected: Your actual details are never revealed. Only zero-knowledge proofs are shared.
//                 </p>
//               </div>
//             </div>
//           ) : (
//             <div className="text-center py-8">
//               <p className="text-gray-700 mb-2 font-medium">No Aadhaar card found for this address</p>
//               <p className="text-sm text-gray-600">
//                 Please contact an Attester to issue you an Aadhaar card
//               </p>
//             </div>
//           )}
//         </div>

//         {/* Pending Requests */}
//         <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
//           <div className="flex justify-between items-center mb-4">
//             <h2 className="text-xl font-semibold text-gray-900">
//               Pending Verification Requests ({pendingRequests.length})
//             </h2>
//             <button
//               onClick={loadPendingRequests}
//               className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded font-medium transition-colors"
//               title="Refresh pending requests"
//             >
//               Refresh
//             </button>
//           </div>
          
//           {status && (
//             <div className={`mb-4 p-3 rounded text-sm ${
//               status.includes('✅') ? 'bg-green-100 text-green-800' : 
//               status.includes('❌') ? 'bg-red-100 text-red-800' : 
//               'bg-blue-100 text-blue-800'
//             }`}>
//               {status}
//             </div>
//           )}

//           <div className="space-y-4">
//             {pendingRequests.length === 0 ? (
//               <p className="text-gray-700 text-center py-8">No pending requests</p>
//             ) : (
//               pendingRequests.map((request, idx) => (
//                 <div key={idx} className="border border-gray-300 rounded-lg p-4 hover:shadow-md transition-shadow">
//                   <div className="flex justify-between items-start mb-3">
//                     <div>
//                       <div className="flex items-center gap-2">
//                         <p className="font-semibold text-gray-900">Verification Request #{request.requestId}</p>
//                         <span className={`text-xs px-2 py-1 rounded font-medium border ${
//                           request.verificationType === 'age' ? 'bg-blue-50 text-blue-800 border-blue-300' :
//                           request.verificationType === 'gender' ? 'bg-purple-50 text-purple-800 border-purple-300' :
//                           'bg-green-50 text-green-800 border-green-300'
//                         }`}>
//                           {request.verificationType === 'age' ? 'Age' :
//                            request.verificationType === 'gender' ? 'Gender' :
//                            'State'}
//                         </span>
//                       </div>
//                       <p className="text-sm text-gray-700 mt-1">
//                         From: {request.requester.slice(0, 10)}...{request.requester.slice(-8)}
//                       </p>
//                       <p className="text-xs text-gray-600">
//                         Requested: {new Date(request.timestamp).toLocaleString()}
//                       </p>
//                     </div>
//                     <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800 border border-yellow-300 font-medium">
//                       Pending
//                     </span>
//                   </div>

//                   <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
//                     <p className="text-sm font-medium text-gray-900 mb-1">Question:</p>
//                     <p className="text-sm text-gray-800">
//                       "{getRequestDescription(request)}"
//                     </p>
//                   </div>

//                   {userData && (
//                     <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
//                       <p className="text-sm text-gray-900">
//                         Your answer will be: <span className="font-semibold text-blue-900">
//                           {getExpectedAnswer(request)}
//                         </span>
//                       </p>
//                       <p className="text-xs text-gray-700 mt-1">
//                         Your exact details will remain private
//                       </p>
//                     </div>
//                   )}

//                   <button
//                     onClick={() => generateAndSubmitProof(request)}
//                     disabled={loading || !userData}
//                     className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-colors"
//                   >
//                     {proofGenerating === request.requestId 
//                       ? 'Generating Proof...' 
//                       : userData 
//                         ? 'Generate & Submit ZK Proof' 
//                         : 'No Aadhaar Data'
//                     }
//                   </button>
//                 </div>
//               ))
//             )}
//           </div>
//         </div>

//         {/* Info Box */}
//         <div className="mt-6 bg-green-50 border border-green-300 rounded-lg p-4">
//           <h3 className="font-semibold text-sm text-green-900 mb-2">Privacy Protected:</h3>
//           <ul className="text-sm space-y-1 list-disc list-inside text-green-900">
//             <li>Proof generation happens locally in your browser</li>
//             <li>Only YES/NO answer is revealed, not your actual data</li>
//             <li>Mathematical proof verifies authenticity without revealing details</li>
//             <li>Proof generation may take 10-30 seconds</li>
//           </ul>
//         </div>

//         {/* Debug Panel */}
//         <div className="mt-4 bg-gray-50 border border-gray-300 rounded-lg p-4">
//           <details>
//             <summary className="cursor-pointer text-sm font-semibold text-gray-900 mb-2">Debug Info (Click to expand)</summary>
//             <div className="mt-2 text-xs space-y-1 font-mono text-gray-800">
//               <p><strong className="text-gray-900">Your Address:</strong> {userAddress || 'Not connected'}</p>
//               <p><strong className="text-gray-900">LocalStorage Key:</strong> pending_{userAddress}</p>
//               <p><strong className="text-gray-900">Raw Data:</strong></p>
//               <pre className="bg-white p-2 rounded overflow-auto max-h-40 border border-gray-300 text-gray-900">
//                 {localStorage.getItem(`pending_${userAddress}`) || 'null'}
//               </pre>
//               <button
//                 onClick={() => {
//                   console.log('All localStorage keys:', Object.keys(localStorage));
//                   console.log('Your pending requests:', localStorage.getItem(`pending_${userAddress}`));
//                 }}
//                 className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors"
//               >
//                 Log to Console
//               </button>
//             </div>
//           </details>
//         </div>
//       </div>
//     </div>
//   );
// }
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Link from 'next/link';
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

export default function UserPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [userData, setUserData] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [proofGenerating, setProofGenerating] = useState(null);
  const [roleOk, setRoleOk] = useState(false);
  const [roleMsg, setRoleMsg] = useState('Checking role…');

  useEffect(() => {
    loadUserData();
    
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

      try {
        const registry = await getRoleRegistry();
        const r = Number(await registry.roleOf(address));
        if (r === ROLE.User) {
          setRoleOk(true);
          setRoleMsg('');
        } else if (r === ROLE.Verifier) {
          setRoleOk(false);
          setRoleMsg('This wallet is locked as Verifier (company). Use a User wallet.');
        } else if (await registry.isAttester(address)) {
          setRoleOk(false);
          setRoleMsg('Attester cannot use the User portal.');
        } else {
          setRoleOk(false);
          setRoleMsg('Sign up as User on the home page first.');
        }
      } catch (e) {
        setRoleOk(false);
        setRoleMsg(e?.message || 'RoleRegistry unavailable — redeploy.');
      }

      const stored = localStorage.getItem(`user_${address}`);
      console.log('User data:', stored);
      if (stored) {
        setUserData(JSON.parse(stored));
      }

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
      const { ProofGenerator } = await import('@/lib/proofGenerator');
      const proofGenerator = new ProofGenerator();

      setStatus('Loading cryptographic libraries...');
      await proofGenerator.init();

      setStatus('Generating zero-knowledge proof... (this may take 10-30 seconds)');

      let proofResult;
      let verifierContract;
      let verifierABI;
      let deployments;

      if (request.verificationType === 'age') {
        const today = new Date();
        const age = today.getFullYear() - parseInt(userData.birthYear);
        const monthDiff = (today.getMonth() + 1) - parseInt(userData.birthMonth);
        const dayDiff = today.getDate() - parseInt(userData.birthDay);
        const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
        const expectedIsOver18 = actualAge >= 18;

        console.log('🎂 AGE CALCULATION');
        console.log('Birth Date:', `${userData.birthDay}/${userData.birthMonth}/${userData.birthYear}`);
        console.log('Calculated Age:', actualAge);
        console.log('Expected Result:', expectedIsOver18 ? '✅ OVER 18' : '❌ UNDER 18');

        proofResult = await proofGenerator.generateOver18Proof(
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

        // CRITICAL FIX: Don't normalize! Use the raw value from the circuit
        // The circuit outputs sum (which can be 0, 1, 2, or 3) but the contract
        // just needs to check if publicSignals[0] > 0 for "over 18"
        console.log('📊 RAW PROOF OUTPUT:');
        console.log('  isOver18 signal:', proofResult.publicSignals[0]);
        console.log('  Type:', typeof proofResult.publicSignals[0]);

        deployments = await fetch('/deployments.json').then(r => r.json());
        verifierABI = await fetch('/contracts/Over18Verifier.json').then(r => r.json());
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        verifierContract = new ethers.Contract(
          deployments.over18Verifier,
          verifierABI.abi,
          signer
        );

      } else if (request.verificationType === 'gender') {
        proofResult = await proofGenerator.generateGenderProof(
          userData,
          userData.secret,
          request.requestId,
          request.requester,
          request.requiredGender
        );

        deployments = await fetch('/deployments.json').then(r => r.json());
        verifierABI = await fetch('/contracts/GenderVerifier.json').then(r => r.json());
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        verifierContract = new ethers.Contract(
          deployments.genderVerifier,
          verifierABI.abi,
          signer
        );

      } else if (request.verificationType === 'state') {
        proofResult = await proofGenerator.generateStateProof(
          userData,
          userData.secret,
          request.requestId,
          request.requester,
          request.requiredState
        );

        deployments = await fetch('/deployments.json').then(r => r.json());
        verifierABI = await fetch('/contracts/StateOfResidenceVerifier.json').then(r => r.json());
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        verifierContract = new ethers.Contract(
          deployments.stateOfResidenceVerifier,
          verifierABI.abi,
          signer
        );
      }

      if (!proofResult.success) {
        throw new Error(`Proof generation failed: ${proofResult.error}`);
      }

      setStatus('Proof generated! Formatting for blockchain...');

      const formatProofForSolidity = (proof) => ({
        pA: [proof.pi_a[0], proof.pi_a[1]],
        pB: [
          [proof.pi_b[0][1], proof.pi_b[0][0]],
          [proof.pi_b[1][1], proof.pi_b[1][0]]
        ],
        pC: [proof.pi_c[0], proof.pi_c[1]]
      });

      const formattedProof = formatProofForSolidity(proofResult.proof);
      
      // Convert public signals to strings for Solidity - keep them as-is!
      const publicSignals = proofResult.publicSignals.map(signal => {
        const bigIntValue = typeof signal === 'bigint' ? signal : BigInt(signal);
        return bigIntValue.toString();
      });

      console.log('📤 SENDING TO CONTRACT:');
      console.log('  Public Signals:', publicSignals);
      console.log('  Signal[0] (isOver18):', publicSignals[0]);
      console.log('  Total signals:', publicSignals.length);

      setStatus('Connecting to blockchain...');
      setStatus('Submitting proof to smart contract...');

      let tx;
      if (request.verificationType === 'age') {
        tx = await verifierContract.completeVerification(
          request.requestId,
          formattedProof.pA,
          formattedProof.pB,
          formattedProof.pC,
          publicSignals
        );
      } else if (request.verificationType === 'gender') {
        tx = await verifierContract.completeGenderVerification(
          request.requestId,
          formattedProof.pA,
          formattedProof.pB,
          formattedProof.pC,
          publicSignals
        );
      } else if (request.verificationType === 'state') {
        tx = await verifierContract.completeStateVerification(
          request.requestId,
          formattedProof.pA,
          formattedProof.pB,
          formattedProof.pC,
          publicSignals
        );
      }

      setStatus('Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      
      console.log('✅ Transaction confirmed:', receipt.hash);

      setStatus('✅ Proof submitted successfully!');

      const userRequestsKey = `pending_${userAddress}`;
      const allUserRequests = JSON.parse(localStorage.getItem(userRequestsKey) || '[]');
      const updatedUserRequests = allUserRequests.map(r => 
        r.requestId === request.requestId 
          ? { ...r, status: 'completed' }
          : r
      );
      localStorage.setItem(userRequestsKey, JSON.stringify(updatedUserRequests));

      const updatedPendingRequests = pendingRequests.filter(r => r.requestId !== request.requestId);
      setPendingRequests(updatedPendingRequests);

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

  const getRequestDescription = (request) => {
    if (request.verificationType === 'age') {
      return 'Is this user over 18 years old?';
    } else if (request.verificationType === 'gender') {
      const genderName = GENDER_MAP[request.requiredGender] || 'Unknown';
      return `Is this user ${genderName}?`;
    } else if (request.verificationType === 'state') {
      const stateName = STATE_MAP[request.requiredState] || `State ${request.requiredState}`;
      return `Does this user live in ${stateName}?`;
    }
    return 'Unknown verification type';
  };

  const getExpectedAnswer = (request) => {
    if (!userData) return null;

    if (request.verificationType === 'age') {
      return isOver18() ? 'YES (Over 18)' : 'NO (Under 18)';
    } else if (request.verificationType === 'gender') {
      const matches = userData.userGender === request.requiredGender;
      const genderName = GENDER_MAP[request.requiredGender] || 'Unknown';
      return matches ? `YES (${genderName})` : `NO (Not ${genderName})`;
    } else if (request.verificationType === 'state') {
      const matches = userData.userState === request.requiredState;
      const stateName = STATE_MAP[request.requiredState] || `State ${request.requiredState}`;
      return matches ? `YES (${stateName})` : `NO (Not ${stateName})`;
    }
    return 'Unknown';
  };

  if (!roleOk) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-md mx-auto text-center space-y-3 bg-white border rounded-lg p-6">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold text-red-700">User access only</h1>
          <p className="text-gray-700 text-sm">{roleMsg}</p>
          <Link href="/" className="text-blue-700 underline text-sm">← Home to sign up</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Portal</h1>
          <p className="text-gray-700">Manage your Aadhaar and respond to verification requests</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Aadhaar Information</h2>
          
          {userData ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="font-medium text-gray-700">Name:</span>
                <span className="text-gray-900">{userData.name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="font-medium text-gray-700">Aadhaar Number:</span>
                <span className="font-mono text-gray-900">{userData.aadhaarNumber}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="font-medium text-gray-700">Date of Birth:</span>
                <span className="text-gray-900">{userData.birthDay}/{userData.birthMonth}/{userData.birthYear}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="font-medium text-gray-700">Age:</span>
                <span className="font-semibold text-gray-900">{getAge()} years old</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="font-medium text-gray-700">Age Status:</span>
                <span className={`px-3 py-1 rounded font-medium ${
                  isOver18() 
                    ? 'bg-green-100 text-green-800 border border-green-300' 
                    : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                }`}>
                  {isOver18() ? 'Over 18' : 'Under 18'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="font-medium text-gray-700">Gender:</span>
                <span className="text-gray-900">{GENDER_MAP[userData.userGender] || 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-medium text-gray-700">State of Residence:</span>
                <span className="text-gray-900">{STATE_MAP[userData.userState] || `State ${userData.userState}`}</span>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 font-medium">
                  Privacy Protected: Your actual details are never revealed. Only zero-knowledge proofs are shared.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-700 mb-2 font-medium">No Aadhaar card found for this address</p>
              <p className="text-sm text-gray-600">
                Please contact an Attester to issue you an Aadhaar card
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Pending Verification Requests ({pendingRequests.length})
            </h2>
            <button
              onClick={loadPendingRequests}
              className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded font-medium transition-colors"
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
              <p className="text-gray-700 text-center py-8">No pending requests</p>
            ) : (
              pendingRequests.map((request, idx) => (
                <div key={idx} className="border border-gray-300 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">Verification Request #{request.requestId}</p>
                        <span className={`text-xs px-2 py-1 rounded font-medium border ${
                          request.verificationType === 'age' ? 'bg-blue-50 text-blue-800 border-blue-300' :
                          request.verificationType === 'gender' ? 'bg-purple-50 text-purple-800 border-purple-300' :
                          'bg-green-50 text-green-800 border-green-300'
                        }`}>
                          {request.verificationType === 'age' ? 'Age' :
                           request.verificationType === 'gender' ? 'Gender' :
                           'State'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">
                        From: {request.requester.slice(0, 10)}...{request.requester.slice(-8)}
                      </p>
                      <p className="text-xs text-gray-600">
                        Requested: {new Date(request.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800 border border-yellow-300 font-medium">
                      Pending
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
                    <p className="text-sm font-medium text-gray-900 mb-1">Question:</p>
                    <p className="text-sm text-gray-800">
                      "{getRequestDescription(request)}"
                    </p>
                  </div>

                  {userData && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-900">
                        Your answer will be: <span className="font-semibold text-blue-900">
                          {getExpectedAnswer(request)}
                        </span>
                      </p>
                      <p className="text-xs text-gray-700 mt-1">
                        Your exact details will remain private
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => generateAndSubmitProof(request)}
                    disabled={loading || !userData}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-colors"
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

        <div className="mt-6 bg-green-50 border border-green-300 rounded-lg p-4">
          <h3 className="font-semibold text-sm text-green-900 mb-2">Privacy Protected:</h3>
          <ul className="text-sm space-y-1 list-disc list-inside text-green-900">
            <li>Proof generation happens locally in your browser</li>
            <li>Only YES/NO answer is revealed, not your actual data</li>
            <li>Mathematical proof verifies authenticity without revealing details</li>
            <li>Proof generation may take 10-30 seconds</li>
          </ul>
        </div>
      </div>
    </div>
  );
}