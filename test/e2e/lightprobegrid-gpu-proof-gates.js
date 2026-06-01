const MAX_PROOF_GATE_COUNT = 16;
const MAX_PROOF_SUMMARY_BYTES = 6000;

export function isMomentBackedVisibility( info ) {

	return !! info &&
		info.available === true &&
		info.mode === 'moments' &&
		info.texture !== null &&
		info.bytes > 0 &&
		info.stats &&
		info.stats.finiteSampleCount > 0 &&
		info.stats.hitSampleCount > 0;

}

export function deriveVisibilityProofStatus( info ) {

	const momentBacked = isMomentBackedVisibility( info );

	return {
		momentBacked,
		visibilityLabel: momentBacked ? 'visibility-moments' : 'visibility-scaffold-disabled',
		visibilityStatus: momentBacked ? 'SUPPORTED' : 'OPEN',
		ddgiStatus: momentBacked ?
			'IMPLEMENTED-PRIVATE-DDGI-LITE-MOMENTS' :
			'OPEN-VISIBILITY-MOMENTS-SCAFFOLD-DISABLED'
	};

}

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

const SEALED_WALL_GATE_DEFINITIONS = [
	{
		metric: 'wrongSideImprovement',
		threshold: 0.05,
		reason: 'Moment visibility should reduce sealed-wall wrong-side leakage before promotion.'
	},
	{
		metric: 'maskedWrongSideImprovement',
		threshold: 0.05,
		reason: 'Masked visible-pixel leak should improve before promotion.'
	},
	{
		metric: 'correctBouncePreservation',
		threshold: 0.9,
		reason: 'Leak reduction must not erase correct-side bounce.'
	},
	{
		metric: 'preToneMaskedWrongSideImprovement',
		threshold: 0.05,
		reason: 'Linear pre-tone masked leak improvement is the promotion metric, not tone-mapped storytelling.'
	},
	{
		metric: 'preToneMaskedCorrectBouncePreservation',
		threshold: 0.9,
		reason: 'Linear pre-tone leak gate must preserve correct bounce.'
	}
];

export function createLightProbeProofFacts( results ) {

	const initial = getResult( results, 'initial' ).metrics;
	const computeProjectionRuntimeParity = getResult( results, 'compute projection runtime parity' ).computeProjectionRuntimeParity;
	const visibilityMomentInspection = getResult( results, 'visibility moment inspection' ).visibilityMomentInspection;
	const sealedVisibilityWeightingDiagnostic = getResult( results, 'sealed visibility weighting diagnostic' ).sealedVisibilityWeightingDiagnostic;
	const leakProofFacts = getResult( results, 'leak proof facts' ).leakProofFacts;
	const sealedReceiverNormalDiagnostic = getResult( results, 'sealed receiver normal convention diagnostic' ).sealedReceiverNormalDiagnostic;
	const receiverSurfaceQuadratureDiagnostic = sealedVisibilityWeightingDiagnostic.receiverSurfaceQuadratureDiagnostic;
	const shContributionDiagnostic = sealedVisibilityWeightingDiagnostic.shContributionDiagnostic;
	const receiverNormalSummary = sealedReceiverNormalDiagnostic.summary ?? {};
	const sealedWall = leakProofFacts.sealedWall;
	const sealedVisibility = sealedWall.visibility;

	return {
		runtime: {
			status: initial.status,
			isLightProbeGrid: initial.isLightProbeGrid === true,
			hasTexture: initial.hasTexture === true,
			hasBoundingBox: initial.hasBoundingBox === true
		},
		projection: {
			coefficientMaxDelta: finiteOrNull( computeProjectionRuntimeParity.coefficientMaxDelta ),
			coefficientTolerance: computeProjectionRuntimeParity.coefficientTolerance,
			atlasMaxDelta: finiteOrNull( computeProjectionRuntimeParity.atlasMaxDelta ),
			atlasTolerance: computeProjectionRuntimeParity.atlasTolerance,
			tolerancePass: computeProjectionRuntimeParity.tolerancePass === true
		},
		visibilityMoments: {
			available: visibilityMomentInspection.available === true,
			mode: visibilityMomentInspection.mode,
			bytes: visibilityMomentInspection.bytes,
			finiteSampleCount: visibilityMomentInspection.stats.finiteSampleCount,
			hitSampleCount: visibilityMomentInspection.stats.hitSampleCount
		},
		visibilityWeighting: {
			diagnosticScope: sealedVisibilityWeightingDiagnostic.diagnosticScope,
			wrongSideEscapedCount: sealedVisibilityWeightingDiagnostic.escapeClassification.wrongSideEscapedCount,
			wrongMinusCorrectSuppression: finiteOrNull( sealedVisibilityWeightingDiagnostic.summary.wrongMinusCorrectSuppression ),
			directionalSuppressionSupported: sealedVisibilityWeightingDiagnostic.summary.directionalSuppressionSupported === true
		},
		shContribution: {
			correctSideMixedColorRowCount: shContributionDiagnostic.summary.correctSideMixedColorRowCount,
			visibilityWrongRatioMean: finiteOrNull( shContributionDiagnostic.summary.visibilityWrongRatioMean ),
			runtimeWrongRatioMean: finiteOrNull( shContributionDiagnostic.summary.runtimeWrongRatioMean )
		},
		receiverNormal: {
			available: sealedReceiverNormalDiagnostic.available === true,
			frontFaceAgreement: receiverNormalSummary.frontFaceAgreement === true,
			shaderNormalAgreement: receiverNormalSummary.shaderNormalAgreement === true
		},
		receiverSurface: {
			fixtureMode: receiverSurfaceQuadratureDiagnostic.fixtureMode,
			quadratureRule: receiverSurfaceQuadratureDiagnostic.quadratureRule,
			sampleCountPerReceiver: receiverSurfaceQuadratureDiagnostic.sampleCountPerReceiver,
			surfaceCpuRenderDelta: finiteOrNull( receiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDelta )
		},
		sealedWall: {
			wrongSideImprovement: sealedVisibility.wrongSide.improvement,
			maskedWrongSideImprovement: sealedVisibility.maskedWrongSide.improvement,
			preToneMaskedWrongSideImprovement: sealedVisibility.preToneMaskedWrongSide.improvement,
			correctBouncePreservation: sealedVisibility.correctBounce.preservation,
			preToneMaskedCorrectBouncePreservation: sealedVisibility.preToneMaskedCorrectBounce.preservation
		}
	};

}

export function evaluateLightProbeProofGates( facts ) {

	const shWrongRatioMax = Math.max(
		facts.shContribution.visibilityWrongRatioMean ?? 0,
		facts.shContribution.runtimeWrongRatioMean ?? 0
	);
	const bakedShMixedColorRisk = facts.visibilityWeighting.wrongSideEscapedCount === 0 &&
		facts.visibilityWeighting.directionalSuppressionSupported === true &&
		facts.shContribution.correctSideMixedColorRowCount > 0 &&
		shWrongRatioMax >= 0.25;

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
			metric: 'tolerancePass',
			actual: facts.projection.tolerancePass,
			expected: true,
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
			metric: 'finiteHitReadback',
			actual: facts.visibilityMoments.available === true &&
				facts.visibilityMoments.mode === 'moments' &&
				facts.visibilityMoments.bytes > 0 &&
				facts.visibilityMoments.finiteSampleCount > 0 &&
				facts.visibilityMoments.hitSampleCount > 0,
			expected: true,
			pass: facts.visibilityMoments.available === true &&
				facts.visibilityMoments.mode === 'moments' &&
				facts.visibilityMoments.bytes > 0 &&
				facts.visibilityMoments.finiteSampleCount > 0 &&
				facts.visibilityMoments.hitSampleCount > 0,
			reason: 'Private visibility moments must have direct readback evidence before leak gates are interpreted.',
			evidenceRef: 'visibility moment inspection'
		} ),
		createGate( {
			id: 'receiverNormal.frontFaceShaderAgreement',
			subject: 'receiverNormal',
			metric: 'frontFaceShaderAgreement',
			actual: facts.receiverNormal.frontFaceAgreement === true &&
				facts.receiverNormal.shaderNormalAgreement === true,
			expected: true,
			pass: facts.receiverNormal.available === true &&
				facts.receiverNormal.frontFaceAgreement === true &&
				facts.receiverNormal.shaderNormalAgreement === true,
			reason: 'Receiver CPU normals must match rendered front faces and front-side normalWorld samples before visibility thresholds are trusted.',
			evidenceRef: 'sealed receiver normal convention diagnostic'
		} ),
		createGate( {
			id: 'visibilityWeighting.directionalSuppression',
			subject: 'visibilityWeighting',
			metric: 'wrongMinusCorrectSuppression',
			actual: facts.visibilityWeighting.wrongMinusCorrectSuppression,
			expected: '<= 0',
			pass: facts.visibilityWeighting.diagnosticScope === 'sealed-wall-receiver-centers' &&
				facts.visibilityWeighting.directionalSuppressionSupported === true,
			reason: 'Sealed-wall CPU visibility weighting must not suppress correct-side contribution more than wrong-side contribution.',
			evidenceRef: 'sealed visibility weighting diagnostic'
		} ),
		createGate( {
			id: 'receiverSurface.cpuRenderAgreement',
			subject: 'receiverSurface',
			metric: 'surfaceCpuRenderDelta',
			actual: facts.receiverSurface.surfaceCpuRenderDelta,
			expected: '<= 0.15',
			pass: facts.receiverSurface.fixtureMode === 'sealed-wall' &&
				facts.receiverSurface.quadratureRule === 'tensor-product-gauss-legendre-3x3-over-receiver-plane' &&
				facts.receiverSurface.sampleCountPerReceiver === 9 &&
				facts.receiverSurface.surfaceCpuRenderDelta !== null &&
				facts.receiverSurface.surfaceCpuRenderDelta <= 0.15,
			reason: 'Receiver-surface CPU quadrature should agree with rendered sealed-wall surface color within diagnostic tolerance.',
			evidenceRef: 'sealed visibility weighting diagnostic'
		} ),
		createGate( {
			id: 'shContribution.noBakedMixedColorRisk',
			subject: 'shContribution',
			metric: 'bakedShMixedColorRisk',
			actual: bakedShMixedColorRisk,
			expected: false,
			pass: bakedShMixedColorRisk === false,
			reason: 'Packed SH contribution evidence must not indicate mixed-color risk after escape and directional-suppression gates pass.',
			evidenceRef: 'sealed visibility weighting diagnostic'
		} ),
		...SEALED_WALL_GATE_DEFINITIONS.map( ( { metric, threshold, reason } ) => createGate( {
			id: `sealedWall.${ metric }`,
			subject: 'sealedWall',
			metric,
			actual: facts.sealedWall[ metric ],
			expected: `>= ${ threshold }`,
			pass: facts.sealedWall[ metric ] >= threshold,
			reason,
			evidenceRef: 'leak proof facts'
		} ) )
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
		'visibilityWeighting.directionalSuppression',
		'receiverNormal.frontFaceShaderAgreement',
		'receiverSurface.cpuRenderAgreement',
		'shContribution.noBakedMixedColorRisk',
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
		'compact proof gates: expected required runtime, projection, visibility, receiver-normal, and sealed-wall gate ids.' );
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
