export async function runLightProbeGridGpuVisibilityBaseAssertions( context ) {

	const { call, assert, results } = context;

	const visibilityMomentInspection = await call( 'inspectVisibilityDepthMoments' );
	assert( visibilityMomentInspection.mode === 'unavailable-proof-6-runtime-removed' &&
		visibilityMomentInspection.available === false &&
		visibilityMomentInspection.bytes === 0 &&
		visibilityMomentInspection.evidenceStatus === 'OPEN',
	'visibility moment inspection: runtime visibility/depth target must be explicitly unavailable during proof-6.' );
	assert( Array.isArray( visibilityMomentInspection.samples ) &&
		visibilityMomentInspection.samples.length === 0 &&
		visibilityMomentInspection.stats.sampleCount === 0 &&
		visibilityMomentInspection.stats.finiteSampleCount === 0 &&
		visibilityMomentInspection.stats.hitSampleCount === 0,
	'visibility moment inspection: unavailable proof-6 visibility target must not fake readback samples.' );
	results.push( { step: 'visibility moment inspection', visibilityMomentInspection } );

	const visibilityWeightingDiagnostic = await call( 'inspectVisibilityWeightingAtLeakReceivers' );
	assert( [ 'SUPPORTED-DIRECTIONAL-SUPPRESSION', 'OPEN-CORRECT-SIDE-SUPPRESSED' ].includes( visibilityWeightingDiagnostic.status ),
		'visibility weighting diagnostic: expected explicit supported/open receiver-level status.' );
	assert( visibilityWeightingDiagnostic.visibilityDepth?.available === false &&
		visibilityWeightingDiagnostic.visibilityDepth?.mode === 'unavailable-proof-6-runtime-removed',
	'visibility weighting diagnostic: expected explicit proof-6 unavailable visibility target.' );
	assert( visibilityWeightingDiagnostic.left.rows.length === 8 &&
		visibilityWeightingDiagnostic.right.rows.length === 8,
	'visibility weighting diagnostic: expected eight trilinear neighbor probes per receiver.' );
	assert( visibilityWeightingDiagnostic.left.rows.every( row =>
		Number.isFinite( row.visibility ) &&
		Number.isFinite( row.scalarWeight ) &&
		Number.isFinite( row.visibilityWeight ) ) &&
		visibilityWeightingDiagnostic.right.rows.every( row =>
			Number.isFinite( row.visibility ) &&
			Number.isFinite( row.scalarWeight ) &&
			Number.isFinite( row.visibilityWeight ) ),
	'visibility weighting diagnostic: expected finite CPU-mirrored visibility weights.' );
	assert( visibilityWeightingDiagnostic.summary.comparableReceiverCount > 0 &&
		Number.isFinite( visibilityWeightingDiagnostic.summary.wrongMinusCorrectSuppression ),
	'visibility weighting diagnostic: expected bounded suppression summary.' );
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
	assert( sealedVisibilityWeightingDiagnostic.visibilityDepth?.available === false &&
		sealedVisibilityWeightingDiagnostic.visibilityDepth?.mode === 'unavailable-proof-6-runtime-removed',
	'sealed visibility weighting diagnostic: expected explicit proof-6 unavailable visibility target.' );
	assert( sealedVisibilityWeightingDiagnostic.left.rows.length === 8 &&
		sealedVisibilityWeightingDiagnostic.right.rows.length === 8 &&
		sealedVisibilityWeightingDiagnostic.summary.comparableReceiverCount > 0,
	'sealed visibility weighting diagnostic: expected eight trilinear neighbor probes per receiver.' );
	assert( typeof sealedVisibilityWeightingDiagnostic.interrogationFinding === 'string' &&
		typeof sealedVisibilityWeightingDiagnostic.dominantEscapeReason.reason === 'string' &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.dominantEscapeReason.count ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.summary.wrongMinusCorrectSuppression ),
	'sealed visibility weighting diagnostic: expected explicit failure hypothesis fields.' );
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
