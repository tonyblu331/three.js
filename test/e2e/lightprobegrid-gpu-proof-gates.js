const MAX_PROOF_GATE_COUNT = 12;
const MAX_PROOF_SUMMARY_BYTES = 6000;

const getResult = ( results, step ) => {

	const result = results.find( row => row.step === step );
	if ( result === undefined ) throw new Error( `Missing smoke result step: ${ step }` );
	return result;

};

const finiteOrNull = value => Number.isFinite( value ) ? value : null;

const createGate = ( {
	id,
	subject,
	metric,
	actual,
	expected,
	pass,
	reason,
	evidenceRef
} ) => ( {
	id,
	subject,
	metric,
	actual,
	expected,
	status: pass === true ? 'SUPPORTED' : 'OPEN',
	reason,
	...( evidenceRef !== undefined ? { evidenceRef } : {} )
} );

export function createLightProbeProofFacts( results ) {

	const initial = getResult( results, 'initial' ).metrics;
	const computeProjectionRuntimeParity = getResult( results, 'compute projection runtime parity' ).computeProjectionRuntimeParity;
	const visibilityMomentInspection = getResult( results, 'visibility moment inspection' ).visibilityMomentInspection;
	const leakMatrix = getResult( results, 'leak matrix' ).leakMatrix;
	const sealedWall = leakMatrix.comparisons.sealedWall;
	const sealedVisibility = sealedWall.visibility;

	return {
		runtime: {
			status: initial.status,
			isLightProbeGrid: initial.isLightProbeGrid === true,
			hasTexture: initial.hasTexture === true,
			hasBoundingBox: initial.hasBoundingBox === true
		},
		projection: {
			status: computeProjectionRuntimeParity.status,
			coefficientMaxDelta: finiteOrNull( computeProjectionRuntimeParity.coefficientMaxDelta ),
			coefficientTolerance: computeProjectionRuntimeParity.coefficientTolerance,
			atlasMaxDelta: finiteOrNull( computeProjectionRuntimeParity.atlasMaxDelta ),
			atlasTolerance: computeProjectionRuntimeParity.atlasTolerance,
			tolerancePass: computeProjectionRuntimeParity.tolerancePass === true
		},
		visibilityMoments: {
			evidenceStatus: visibilityMomentInspection.evidenceStatus,
			mode: visibilityMomentInspection.mode,
			bytes: visibilityMomentInspection.bytes,
			finiteSampleCount: visibilityMomentInspection.stats.finiteSampleCount,
			hitSampleCount: visibilityMomentInspection.stats.hitSampleCount
		},
		sealedWall: {
			status: sealedWall.status,
			linearPromotionStatus: sealedWall.linearPromotionStatus,
			wrongSideImprovement: sealedVisibility.wrongSide.improvement,
			maskedWrongSideImprovement: sealedVisibility.maskedWrongSide.improvement,
			preToneMaskedWrongSideImprovement: sealedVisibility.preToneMaskedWrongSide.improvement,
			correctBouncePreservation: sealedVisibility.correctBounce.preservation,
			maskedCorrectBouncePreservation: sealedVisibility.maskedCorrectBounce.preservation,
			preToneMaskedCorrectBouncePreservation: sealedVisibility.preToneMaskedCorrectBounce.preservation
		}
	};

}

export function evaluateLightProbeProofGates( facts ) {

	return [
		createGate( {
			id: 'runtime.ready',
			subject: 'runtime',
			metric: 'status',
			actual: facts.runtime.status,
			expected: 'ready',
			pass: facts.runtime.status === 'ready',
			reason: 'LightProbeGridGPU bake must finish before proof facts are trusted.'
		} ),
		createGate( {
			id: 'runtime.texture',
			subject: 'runtime',
			metric: 'hasTexture',
			actual: facts.runtime.hasTexture,
			expected: true,
			pass: facts.runtime.hasTexture === true,
			reason: 'Runtime must expose the packed SH atlas texture.'
		} ),
		createGate( {
			id: 'runtime.boundingBox',
			subject: 'runtime',
			metric: 'hasBoundingBox',
			actual: facts.runtime.hasBoundingBox,
			expected: true,
			pass: facts.runtime.hasBoundingBox === true,
			reason: 'Runtime must expose probe-grid bounds for sampling.'
		} ),
		createGate( {
			id: 'projection.runtimeParity',
			subject: 'projection',
			metric: 'status',
			actual: facts.projection.status,
			expected: 'RUNTIME-PARITY-READBACK-PASSING',
			pass: facts.projection.tolerancePass === true,
			reason: 'Compute projection remains an explicit gate instead of a narrative status string.',
			evidenceRef: 'compute projection runtime parity'
		} ),
		createGate( {
			id: 'projection.coefficientDelta',
			subject: 'projection',
			metric: 'coefficientMaxDelta',
			actual: facts.projection.coefficientMaxDelta,
			expected: `<= ${ facts.projection.coefficientTolerance }`,
			pass: facts.projection.coefficientMaxDelta !== null &&
				facts.projection.coefficientMaxDelta <= facts.projection.coefficientTolerance,
			reason: 'Compute and fragment coefficient targets should agree within readback tolerance.',
			evidenceRef: 'compute projection runtime parity'
		} ),
		createGate( {
			id: 'projection.atlasDelta',
			subject: 'projection',
			metric: 'atlasMaxDelta',
			actual: facts.projection.atlasMaxDelta,
			expected: `<= ${ facts.projection.atlasTolerance }`,
			pass: facts.projection.atlasMaxDelta !== null &&
				facts.projection.atlasMaxDelta <= facts.projection.atlasTolerance,
			reason: 'Compute and fragment packed-atlas samples should agree within readback tolerance.',
			evidenceRef: 'compute projection runtime parity'
		} ),
		createGate( {
			id: 'visibility.momentReadback',
			subject: 'visibility',
			metric: 'evidenceStatus',
			actual: facts.visibilityMoments.evidenceStatus,
			expected: 'SUPPORTED',
			pass: facts.visibilityMoments.evidenceStatus === 'SUPPORTED' &&
				facts.visibilityMoments.mode === 'moments' &&
				facts.visibilityMoments.bytes > 0 &&
				facts.visibilityMoments.finiteSampleCount > 0 &&
				facts.visibilityMoments.hitSampleCount > 0,
			reason: 'Private visibility moments must have direct readback evidence before leak gates are interpreted.',
			evidenceRef: 'visibility moment inspection'
		} ),
		createGate( {
			id: 'sealedWall.wrongSideImprovement',
			subject: 'sealedWall',
			metric: 'wrongSideImprovement',
			actual: facts.sealedWall.wrongSideImprovement,
			expected: '>= 0.05',
			pass: facts.sealedWall.wrongSideImprovement >= 0.05,
			reason: 'Moment visibility should reduce sealed-wall wrong-side leakage before promotion.',
			evidenceRef: 'leak matrix'
		} ),
		createGate( {
			id: 'sealedWall.maskedWrongSideImprovement',
			subject: 'sealedWall',
			metric: 'maskedWrongSideImprovement',
			actual: facts.sealedWall.maskedWrongSideImprovement,
			expected: '>= 0.05',
			pass: facts.sealedWall.maskedWrongSideImprovement >= 0.05,
			reason: 'Masked visible-pixel leak should improve before promotion.',
			evidenceRef: 'leak matrix'
		} ),
		createGate( {
			id: 'sealedWall.correctBouncePreservation',
			subject: 'sealedWall',
			metric: 'correctBouncePreservation',
			actual: facts.sealedWall.correctBouncePreservation,
			expected: '>= 0.9',
			pass: facts.sealedWall.correctBouncePreservation >= 0.9,
			reason: 'Leak reduction must not erase correct-side bounce.',
			evidenceRef: 'leak matrix'
		} ),
		createGate( {
			id: 'sealedWall.preToneMaskedWrongSideImprovement',
			subject: 'sealedWall',
			metric: 'preToneMaskedWrongSideImprovement',
			actual: facts.sealedWall.preToneMaskedWrongSideImprovement,
			expected: '>= 0.05',
			pass: facts.sealedWall.preToneMaskedWrongSideImprovement >= 0.05,
			reason: 'Linear pre-tone masked leak improvement is the promotion metric, not tone-mapped storytelling.',
			evidenceRef: 'leak matrix'
		} ),
		createGate( {
			id: 'sealedWall.preToneMaskedCorrectBouncePreservation',
			subject: 'sealedWall',
			metric: 'preToneMaskedCorrectBouncePreservation',
			actual: facts.sealedWall.preToneMaskedCorrectBouncePreservation,
			expected: '>= 0.9',
			pass: facts.sealedWall.preToneMaskedCorrectBouncePreservation >= 0.9,
			reason: 'Linear pre-tone leak gate must preserve correct bounce.',
			evidenceRef: 'leak matrix'
		} )
	];

}

export function createLightProbeProofSummary( gates ) {

	const supported = gates.filter( gate => gate.status === 'SUPPORTED' ).length;
	const open = gates.filter( gate => gate.status === 'OPEN' ).length;

	return {
		status: open === 0 ? 'SUPPORTED' : 'OPEN',
		supported,
		open,
		gates
	};

}

export function assertLightProbeProofSummary( summary, assert ) {

	const gateIds = new Set( summary.gates.map( gate => gate.id ) );
	const requiredSupportedGateIds = [
		'runtime.ready',
		'runtime.texture',
		'runtime.boundingBox',
		'visibility.momentReadback',
		'sealedWall.correctBouncePreservation',
		'sealedWall.preToneMaskedCorrectBouncePreservation'
	];
	const requiredGateIds = [
		...requiredSupportedGateIds,
		'projection.runtimeParity',
		'projection.coefficientDelta',
		'projection.atlasDelta',
		'sealedWall.wrongSideImprovement',
		'sealedWall.maskedWrongSideImprovement',
		'sealedWall.preToneMaskedWrongSideImprovement'
	];

	assert( summary.gates.length > 0 &&
		summary.gates.length <= MAX_PROOF_GATE_COUNT,
	`compact proof gates: expected 1-${ MAX_PROOF_GATE_COUNT } bounded gates.` );
	assert( gateIds.size === summary.gates.length,
		'compact proof gates: expected unique gate ids.' );
	assert( requiredGateIds.every( id => gateIds.has( id ) ),
		'compact proof gates: expected required runtime, projection, visibility, and sealed-wall gate ids.' );
	assert( summary.gates.every( gate =>
		typeof gate.id === 'string' &&
		typeof gate.subject === 'string' &&
		typeof gate.metric === 'string' &&
		[ 'SUPPORTED', 'OPEN' ].includes( gate.status ) &&
		typeof gate.reason === 'string' &&
		gate.reason.length > 0 &&
		gate.actual !== undefined &&
		gate.expected !== undefined ),
	'compact proof gates: expected every gate to have id, subject, metric, status, reason, actual, and expected.' );
	assert( requiredSupportedGateIds.every( id =>
		summary.gates.find( gate => gate.id === id )?.status === 'SUPPORTED' ),
	'compact proof gates: expected product-readiness gates to be supported.' );
	assert( JSON.stringify( summary ).length <= MAX_PROOF_SUMMARY_BYTES,
	`compact proof gates: summary exceeded ${ MAX_PROOF_SUMMARY_BYTES } bytes.` );

}

export function runLightProbeGridGpuProofGateAssertions( context ) {

	const { assert, results } = context;
	const facts = createLightProbeProofFacts( results );
	const gates = evaluateLightProbeProofGates( facts );
	const proofSummary = createLightProbeProofSummary( gates );

	assertLightProbeProofSummary( proofSummary, assert );
	results.push( { step: 'compact proof gates', proofSummary } );

	return proofSummary;

}
