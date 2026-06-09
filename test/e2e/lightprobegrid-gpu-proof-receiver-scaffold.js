import {
	StorageBufferAttribute
} from 'three/webgpu';

export const LIGHTPROBEGRIDGPU_PROOF_RECEIVER_LANES = 16;
export const LIGHTPROBEGRIDGPU_PROOF_RECEIVER_RESULT_LANES = 16;

export const LIGHTPROBEGRIDGPU_PROOF_RECEIVER_STRUCTS = `
struct Receiver {
  position: vec3f,
  normal: vec3f,
  layerMask: u32,
  expectedRegion: u32,
  referenceIndirect: vec3f,
};

struct ReceiverResult {
  fastIndirect: vec3f,
  guardedIndirect: vec3f,
  visibilityMass: f32,
  weightSum: f32,
  leakScore: f32,
  correctBounceScore: f32,
  invalidContribution: f32,
  layerRejectedContribution: f32,
  momentVsScalarDelta: f32,
  flags: u32,
};
`;

export const LIGHTPROBEGRIDGPU_PROOF_RECEIVER_REQUIRED_RESULT_FIELDS = [
	'fastIndirect',
	'guardedIndirect',
	'visibilityMass',
	'weightSum',
	'leakScore',
	'correctBounceScore',
	'invalidContribution',
	'layerRejectedContribution',
	'momentVsScalarDelta',
	'flags'
];

export const LIGHTPROBEGRIDGPU_PROOF_RECEIVER_REQUIRED_SUMMARY_FIELDS = [
	'sceneLinearIndirectAgreement',
	'wrongSideLeakRatio',
	'correctBouncePreservation',
	'momentVsScalarDelta',
	'visibilityMassMin',
	'visibilityMassMean',
	'visibilityMassMax',
	'invalidProbeContribution',
	'layerRejectedContribution',
	'negativeLobePressure'
];

export const LIGHTPROBEGRIDGPU_PROOF_RECEIVER_SCAFFOLD_POLICY = {
	policyId: 'lightprobegridgpu-proof-receiver-same-estimator-scaffold',
	moduleScope: 'test/e2e',
	productionRuntimeScope: false,
	estimatorContract: 'production-guarded-or-shared-proof-equivalent',
	cpuReadbackRole: 'io-only-not-truth',
	receiverStrideLanes: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_LANES,
	resultStrideLanes: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_RESULT_LANES,
	structs: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_STRUCTS,
	requiredResultFields: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_REQUIRED_RESULT_FIELDS,
	requiredSummaryFields: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_REQUIRED_SUMMARY_FIELDS
};

const requireFiniteVec3 = ( value, label ) => {

	if ( Array.isArray( value ) === false || value.length !== 3 || value.every( Number.isFinite ) === false ) {

		throw new Error( `LightProbeGridGPU proof receiver: ${ label } must be a finite vec3 array.` );

	}

};

const requireUint = ( value, label ) => {

	if ( Number.isInteger( value ) === false || value < 0 ) {

		throw new Error( `LightProbeGridGPU proof receiver: ${ label } must be an unsigned integer.` );

	}

};

export function createLightProbeGridGPUProofReceiverArray( receivers ) {

	if ( Array.isArray( receivers ) === false ) {

		throw new Error( 'LightProbeGridGPU proof receiver: receivers must be an array.' );

	}

	const buffer = new ArrayBuffer( receivers.length * LIGHTPROBEGRIDGPU_PROOF_RECEIVER_LANES * 4 );
	const floats = new Float32Array( buffer );
	const uints = new Uint32Array( buffer );

	for ( let i = 0; i < receivers.length; i ++ ) {

		const receiver = receivers[ i ];
		const offset = i * LIGHTPROBEGRIDGPU_PROOF_RECEIVER_LANES;

		requireFiniteVec3( receiver.position, 'position' );
		requireFiniteVec3( receiver.normal, 'normal' );
		requireUint( receiver.layerMask, 'layerMask' );
		requireUint( receiver.expectedRegion, 'expectedRegion' );
		requireFiniteVec3( receiver.referenceIndirect, 'referenceIndirect' );

		floats.set( receiver.position, offset );
		floats.set( receiver.normal, offset + 4 );
		uints[ offset + 8 ] = receiver.layerMask;
		uints[ offset + 9 ] = receiver.expectedRegion;
		floats.set( receiver.referenceIndirect, offset + 12 );

	}

	return floats;

}

export function createLightProbeGridGPUProofReceiverBuffers( receivers ) {

	const receiverArray = createLightProbeGridGPUProofReceiverArray( receivers );
	const resultArray = new Float32Array( receivers.length * LIGHTPROBEGRIDGPU_PROOF_RECEIVER_RESULT_LANES );

	return {
		receiverAttribute: new StorageBufferAttribute( receiverArray, LIGHTPROBEGRIDGPU_PROOF_RECEIVER_LANES ),
		resultAttribute: new StorageBufferAttribute( resultArray, LIGHTPROBEGRIDGPU_PROOF_RECEIVER_RESULT_LANES ),
		receiverArray,
		resultArray,
		receiverCount: receivers.length,
		receiverStrideLanes: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_LANES,
		resultStrideLanes: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_RESULT_LANES,
		receiverBytes: receiverArray.byteLength,
		resultBytes: resultArray.byteLength
	};

}

export function createLightProbeGridGPUProofReceiverScaffoldFacts() {

	return {
		policyId: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_SCAFFOLD_POLICY.policyId,
		moduleScope: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_SCAFFOLD_POLICY.moduleScope,
		productionRuntimeScope: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_SCAFFOLD_POLICY.productionRuntimeScope,
		estimatorContract: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_SCAFFOLD_POLICY.estimatorContract,
		cpuReadbackRole: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_SCAFFOLD_POLICY.cpuReadbackRole,
		receiverStrideLanes: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_SCAFFOLD_POLICY.receiverStrideLanes,
		resultStrideLanes: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_SCAFFOLD_POLICY.resultStrideLanes,
		receiverStructPresent: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_STRUCTS.includes( 'struct Receiver {' ),
		receiverResultStructPresent: LIGHTPROBEGRIDGPU_PROOF_RECEIVER_STRUCTS.includes( 'struct ReceiverResult {' ),
		requiredResultFields: [ ...LIGHTPROBEGRIDGPU_PROOF_RECEIVER_REQUIRED_RESULT_FIELDS ],
		requiredSummaryFields: [ ...LIGHTPROBEGRIDGPU_PROOF_RECEIVER_REQUIRED_SUMMARY_FIELDS ],
		bufferFactoryPresent: true,
		implemented: false
	};

}
