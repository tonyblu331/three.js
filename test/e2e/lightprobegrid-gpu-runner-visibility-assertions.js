export async function runLightProbeGridGpuVisibilitySmokeAssertions( context ) {

	const { call, assert, results } = context;
	const sealedVisibilityWeightingDiagnostic = await runLightProbeGridGpuVisibilityBaseAssertions( {
		call,
		assert,
		results
	} );

	runLightProbeGridGpuVisibilityReceiverAssertions( {
		assert,
		results,
		sealedVisibilityWeightingDiagnostic
	} );
	await runLightProbeGridGpuVisibilityNormalAssertions( {
		call,
		assert,
		results
	} );

}

async function runLightProbeGridGpuVisibilityBaseAssertions( context ) {

	const { call, assert, results } = context;

	const visibilityMomentInspection = await call( 'inspectVisibilityDepthMoments' );
	assert( visibilityMomentInspection.mode === 'moments' &&
		visibilityMomentInspection.available === true &&
		visibilityMomentInspection.bytes > 0 &&
		visibilityMomentInspection.evidenceStatus === 'SUPPORTED',
	'visibility moment inspection: expected private moment-backed visibilityDepthTarget with non-zero memory.' );
	assert( visibilityMomentInspection.samples === undefined &&
		visibilityMomentInspection.stats.sampleCount > 0 &&
		visibilityMomentInspection.stats.finiteSampleCount > 0 &&
		visibilityMomentInspection.stats.hitSampleCount > 0,
	'visibility moment inspection: expected compact finite direct readback counters with at least one hit-confidence sample.' );
	assert( visibilityMomentInspection.encoding === 'radial-distance' &&
		visibilityMomentInspection.stats.encoding === visibilityMomentInspection.encoding &&
		visibilityMomentInspection.stats.bytes === visibilityMomentInspection.bytes &&
		Number.isFinite( visibilityMomentInspection.stats.meanDistanceRange.min ) &&
		Number.isFinite( visibilityMomentInspection.stats.meanDistanceRange.max ) &&
		Number.isFinite( visibilityMomentInspection.stats.varianceRange.min ) &&
		Number.isFinite( visibilityMomentInspection.stats.varianceRange.max ) &&
		Number.isFinite( visibilityMomentInspection.stats.hitConfidenceRange.min ) &&
		Number.isFinite( visibilityMomentInspection.stats.hitConfidenceRange.max ),
	'visibility moment inspection: expected compact radial moment ranges and byte accounting.' );
	assert( visibilityMomentInspection.momentQualityProfile?.varianceMetric?.includes( 'radial-distance variance' ) &&
		visibilityMomentInspection.momentQualityProfile?.activeRepackMode === 'five-tap-octa-neighborhood',
	'visibility moment inspection: expected honest private moment-quality profile.' );
	results.push( { step: 'visibility moment inspection', visibilityMomentInspection } );

	const visibilityWeightingDiagnostic = await call( 'inspectVisibilityWeightingAtLeakReceivers' );
	assert( [ 'SUPPORTED-DIRECTIONAL-SUPPRESSION', 'OPEN-CORRECT-SIDE-SUPPRESSED' ].includes( visibilityWeightingDiagnostic.status ),
		'visibility weighting diagnostic: expected explicit supported/open receiver-level status.' );
	assert( visibilityWeightingDiagnostic.visibilityDepth?.available === true &&
		visibilityWeightingDiagnostic.visibilityDepth?.mode === 'moments' &&
		visibilityWeightingDiagnostic.visibilityDepth?.bytes > 0,
	'visibility weighting diagnostic: expected moment-backed private visibility target.' );
	assert( visibilityWeightingDiagnostic.left.rows.length === 8 &&
		visibilityWeightingDiagnostic.right.rows.length === 8,
	'visibility weighting diagnostic: expected eight trilinear neighbor probes per receiver.' );
	assert( visibilityWeightingDiagnostic.left.rows.every( row =>
		Number.isFinite( row.visibility ) &&
			Number.isFinite( row.scalarWeight ) &&
			Number.isFinite( row.baseWeight ) &&
			Number.isFinite( row.compatibleKernel ) &&
			Number.isFinite( row.visibilityWeight ) ) &&
		visibilityWeightingDiagnostic.right.rows.every( row =>
			Number.isFinite( row.visibility ) &&
			Number.isFinite( row.scalarWeight ) &&
			Number.isFinite( row.baseWeight ) &&
			Number.isFinite( row.compatibleKernel ) &&
			Number.isFinite( row.visibilityWeight ) ),
	'visibility weighting diagnostic: expected finite CPU-mirrored visibility weights.' );
	assert( visibilityWeightingDiagnostic.summary.comparableReceiverCount > 0 &&
		Number.isFinite( visibilityWeightingDiagnostic.summary.wrongMinusCorrectSuppression ) &&
		Number.isFinite( visibilityWeightingDiagnostic.summary.visibilityMassMean ) &&
		Number.isFinite( visibilityWeightingDiagnostic.summary.baseSumMean ) &&
		Number.isFinite( visibilityWeightingDiagnostic.summary.visibleSumMean ) &&
		Number.isFinite( visibilityWeightingDiagnostic.summary.wrongContributionRatioDelta ),
	'visibility weighting diagnostic: expected bounded suppression summary, visibilityMass, base/visible sums, and wrong-side contribution ratios.' );
	assert( visibilityWeightingDiagnostic.left.rows.every( row =>
		typeof row.crossesDivider === 'boolean' &&
		typeof row.escaped === 'boolean' &&
		typeof row.escapeReason === 'string' ) &&
		visibilityWeightingDiagnostic.right.rows.every( row =>
			typeof row.crossesDivider === 'boolean' &&
			typeof row.escaped === 'boolean' &&
			typeof row.escapeReason === 'string' ),
	'visibility weighting diagnostic: expected CPU/report-only escape classification fields without requiring moment readback terms.' );
	assert( visibilityWeightingDiagnostic.escapeClassification !== undefined &&
		visibilityWeightingDiagnostic.escapeClassification.wrongSideProbeCount > 0 &&
		visibilityWeightingDiagnostic.escapeClassification.wrongSideEscapedCount >= 0 &&
		Array.isArray( visibilityWeightingDiagnostic.escapeClassification.escapedProbes ) &&
		visibilityWeightingDiagnostic.escapeClassification.escapedProbes.every( probe =>
			Number.isInteger( probe.probeIndex ) &&
			typeof probe.escapeReason === 'string' ),
	'visibility weighting diagnostic: expected aggregate wrong-side escape classification.' );
	results.push( { step: 'visibility weighting diagnostic', visibilityWeightingDiagnostic } );

	const sealedVisibilityWeightingDiagnostic = await call( 'inspectVisibilityWeightingAtLeakReceivers', 'sealed-wall' );
	assert( [ 'SUPPORTED-DIRECTIONAL-SUPPRESSION', 'OPEN-CORRECT-SIDE-SUPPRESSED' ].includes( sealedVisibilityWeightingDiagnostic.status ) &&
		sealedVisibilityWeightingDiagnostic.fixtureMode === 'sealed-wall' &&
		sealedVisibilityWeightingDiagnostic.proofBoundary.includes( 'sealed-wall receiver centers' ),
	'sealed visibility weighting diagnostic: expected explicit sealed-wall receiver-level status.' );
	assert( sealedVisibilityWeightingDiagnostic.visibilityDepth?.available === true &&
		sealedVisibilityWeightingDiagnostic.visibilityDepth?.mode === 'moments' &&
		sealedVisibilityWeightingDiagnostic.visibilityDepth?.bytes > 0,
	'sealed visibility weighting diagnostic: expected moment-backed private visibility target.' );
	assert( sealedVisibilityWeightingDiagnostic.left.rows.length === 8 &&
		sealedVisibilityWeightingDiagnostic.right.rows.length === 8 &&
		sealedVisibilityWeightingDiagnostic.summary.comparableReceiverCount > 0,
	'sealed visibility weighting diagnostic: expected eight trilinear neighbor probes per receiver.' );
	assert( typeof sealedVisibilityWeightingDiagnostic.interrogationFinding === 'string' &&
		typeof sealedVisibilityWeightingDiagnostic.dominantEscapeReason.reason === 'string' &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.dominantEscapeReason.count ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.summary.wrongMinusCorrectSuppression ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.summary.visibilityMassMean ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.summary.visibleWrongContributionRatioMean ),
	'sealed visibility weighting diagnostic: expected explicit failure hypothesis fields and visibilityMass contribution ratios.' );
	assert( sealedVisibilityWeightingDiagnostic.escapeClassification.frontEdgeBypassEscapeCount === 0,
		'sealed visibility weighting diagnostic: sealed wall must remove the finite-wall front-edge bypass from this diagnostic.' );
	assert( sealedVisibilityWeightingDiagnostic.escapeClassification.wrongSideProbeCount > 0 &&
		Array.isArray( sealedVisibilityWeightingDiagnostic.escapeClassification.escapedProbes ),
	'sealed visibility weighting diagnostic: expected aggregate wrong-side escape classification.' );
	assert( sealedVisibilityWeightingDiagnostic.shContributionDiagnostic !== undefined &&
		sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.proofBoundary.includes( 'packed SH atlas coefficient contribution mirror' ) &&
		typeof sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.suspectedFailureDomain === 'string' &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.summary.scalarWrongRatioMean ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.summary.visibilityWrongRatioMean ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.summary.runtimeWrongRatioMean ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.summary.invertedNormalRuntimeWrongRatioMean ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.summary.maxCorrectSideChromaPressure ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.summary.maxRuntimeFinalChromaPressure ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.summary.weightedCorrectSideChromaPressureMean ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.summary.weightedCorrectSideWrongOverCorrectMean ),
	'sealed visibility weighting diagnostic: expected packed SH contribution failure-domain interrogation.' );

	return sealedVisibilityWeightingDiagnostic;

}

function runLightProbeGridGpuVisibilityReceiverAssertions( context ) {

	const { assert, results, sealedVisibilityWeightingDiagnostic } = context;

	const surface = sealedVisibilityWeightingDiagnostic.receiverSurfaceQuadratureDiagnostic;
	assert( [ 'SUPPORTED-SURFACE-CPU-RENDER-AGREEMENT', 'OPEN-SURFACE-CPU-RENDER-MISMATCH' ].includes( surface.status ) &&
		surface.fixtureMode === 'sealed-wall' &&
		surface.proofBoundary.includes( 'receiver-surface quadrature' ) &&
		surface.quadratureRule === 'tensor-product-gauss-legendre-3x3-over-receiver-plane' &&
		surface.sampleCountPerReceiver === 9 &&
		Number.isFinite( surface.summary.surfaceRuntimeWrongRatioMean ) &&
		Number.isFinite( surface.summary.surfaceRuntimeWrongRatioMax ) &&
		Number.isFinite( surface.summary.surfaceCpuRenderDelta ) &&
		Number.isFinite( surface.summary.surfaceCpuRenderDeltaMean ) &&
		Number.isFinite( surface.summary.surfaceCpuRenderDeltaMax ) &&
		[ 'surface-region-receiver-mean', 'surface-region-receiver-max', 'masked-visible-pixels-receiver-mean', 'masked-visible-pixels-receiver-max' ].includes( surface.summary.cpuRenderAgreementAggregation ) &&
		[ 'SUPPORTED', 'OPEN' ].includes( surface.summary.cpuRenderAgreementGate ),
	'sealed visibility weighting diagnostic: expected compact receiver-surface CPU/render agreement summary.' );

	const gpuDebug = sealedVisibilityWeightingDiagnostic.receiverGpuDebugDiagnostic;
	assert( gpuDebug.status === 'OPEN-GPU-DEBUG-CPU-SURFACE-MISMATCH' &&
		gpuDebug.fixtureMode === 'sealed-wall' &&
		gpuDebug.proofBoundary.includes( 'GPU debug' ) &&
		gpuDebug.runtimeDebugUnavailable === true &&
		Number.isFinite( gpuDebug.summary.surfaceCpuRatioMax ) &&
		Number.isFinite( gpuDebug.summary.surfaceCpuRenderDelta ) &&
		gpuDebug.summary.gpuDebugSweepExecuted === false &&
		gpuDebug.summary.agreementMode === 'surface-quadrature-summary-only' &&
		gpuDebug.summary.linearIrradianceAgreementGate === 'OPEN' &&
		gpuDebug.summary.weightTermAgreementGate === 'OPEN',
	'sealed visibility weighting diagnostic: expected compact GPU debug agreement summary.' );

	results.push( { step: 'sealed visibility weighting diagnostic', sealedVisibilityWeightingDiagnostic } );

}

async function runLightProbeGridGpuVisibilityNormalAssertions( context ) {

	const { call, assert, results } = context;

	const sealedReceiverNormalDiagnostic = await call( 'inspectLeakReceiverNormalConvention', 'sealed-wall' );
	assert( [ 'SUPPORTED-CPU-NORMAL-MATCHES-FRONT-FACE-SHADER', 'OPEN-NORMAL-CONVENTION-MISMATCH' ].includes( sealedReceiverNormalDiagnostic.status ) &&
		sealedReceiverNormalDiagnostic.fixtureMode === 'sealed-wall' &&
		sealedReceiverNormalDiagnostic.proofBoundary.includes( 'normal convention diagnostic' ),
	'sealed receiver normal diagnostic: expected explicit proof-only normal convention status.' );
	assert( Array.isArray( sealedReceiverNormalDiagnostic.receivers ) &&
		sealedReceiverNormalDiagnostic.receivers.length === 2 &&
		sealedReceiverNormalDiagnostic.receivers.every( receiver =>
			Number.isFinite( receiver.cpuNormal.x ) &&
			Number.isFinite( receiver.cpuNormal.y ) &&
			Number.isFinite( receiver.cpuNormal.z ) &&
			Number.isFinite( receiver.invertedCpuNormal.x ) &&
			Number.isFinite( receiver.cameraDotCpuNormal ) &&
			typeof receiver.expectedVisibleFaceFromCpuNormal === 'string' &&
			typeof receiver.actualRenderedSide === 'string' &&
			receiver.surfaceRegion !== null ),
	'sealed receiver normal diagnostic: expected CPU normal, inverted normal, and rendered side fields.' );
	assert( Array.isArray( sealedReceiverNormalDiagnostic.shaderNormalSamples ) &&
		sealedReceiverNormalDiagnostic.shaderNormalSamples.length === 3 &&
		sealedReceiverNormalDiagnostic.shaderNormalSamples.every( sample =>
			typeof sample.materialSide === 'string' &&
			typeof sample.leftReceiverSurface.visible === 'boolean' &&
			typeof sample.rightReceiverSurface.visible === 'boolean' &&
			typeof sample.leftReceiverSurface.closestNormalConvention === 'string' &&
			Number.isFinite( sample.leftReceiverSurface.cpuColorDistance ) &&
			Number.isFinite( sample.rightReceiverSurface.invertedColorDistance ) ),
	'sealed receiver normal diagnostic: expected shader normalWorld front/back/double-side samples.' );
	assert( typeof sealedReceiverNormalDiagnostic.summary.frontFaceAgreement === 'boolean' &&
		typeof sealedReceiverNormalDiagnostic.summary.shaderNormalAgreement === 'boolean' &&
		typeof sealedReceiverNormalDiagnostic.summary.diagnosticConclusion === 'string',
	'sealed receiver normal diagnostic: expected summary agreement fields.' );
	results.push( { step: 'sealed receiver normal convention diagnostic', sealedReceiverNormalDiagnostic } );

}
