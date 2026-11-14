import { ethers } from 'ethers';
import deployments from '../deployments.json';
import AttesterABI from '../contracts/AttesterContract.json';
import Over18VerifierABI from '../contracts/Over18Verifier.json';
import GenderVerifierABI from '../contracts/GenderVerifier.json';
import StateOfResidenceVerifierABI from '../contracts/StateOfResidenceVerifier.json';
import DemoAttesterABI from '../contracts/DemoAttester.json';
import DemoAgeGateABI from '../contracts/DemoAgeGate.json';
import RoleRegistryABI from '../contracts/RoleRegistry.json';

export { deployments };

/** Mirrors RoleRegistry.Role */
export const ROLE = { None: 0, User: 1, Verifier: 2 };

export const getProvider = () => new ethers.BrowserProvider(window.ethereum);

async function withSigner(address, abi) {
  const provider = getProvider();
  const signer = await provider.getSigner();
  return new ethers.Contract(address, abi, signer);
}

export const getAttesterContract = () =>
  withSigner(deployments.attesterContract, AttesterABI.abi);

export const getOver18Verifier = () =>
  withSigner(deployments.over18Verifier, Over18VerifierABI.abi);

export const getGenderVerifier = () =>
  withSigner(deployments.genderVerifier, GenderVerifierABI.abi);

export const getStateOfResidenceVerifier = () =>
  withSigner(deployments.stateOfResidenceVerifier, StateOfResidenceVerifierABI.abi);

export const getRoleRegistry = () => {
  if (!deployments.roleRegistry) throw new Error('RoleRegistry not deployed — run deploy script');
  return withSigner(deployments.roleRegistry, RoleRegistryABI.abi);
};

export const getDemoAttester = () => {
  if (!deployments.demoAttester) throw new Error('DemoAttester not deployed — run deploy script');
  return withSigner(deployments.demoAttester, DemoAttesterABI.abi);
};

export const getDemoAgeGate = () => {
  if (!deployments.demoAgeGate) throw new Error('DemoAgeGate not deployed — run deploy script');
  return withSigner(deployments.demoAgeGate, DemoAgeGateABI.abi);
};
