export async function runLightProbeGridGpuVisibilityBaseAssertions( context ) {

	const { call, assert, results } = context;

	const visibilityMomentInspection = await call( 'inspectVisibilityDepthMoments' );
	assert( visibilityMomentInspection.mode === 'moments' &&
		visibilityMomentInspection.available === true &&
		visibilityMomentInspection.bytes > 0 &&
		visibilityMomentInspection.evidenceStatus === 'SUPPORTED',
	'visibility moment inspection: expected private moment-backed visibilityDepthTarget with non-zero memory.' );
	assert( Array.isArray( visibilityMomentInspection.samples ) &&
		visibilityMomentInspection.samples.length > 0 &&
		visibilityMomentInspection.stats.sampleCount === visibilityMomentInspection.samples.length &&
		visibilityMomentInspection.stats.finiteSampleCount > 0 &&
		visibilityMomentInspection.stats.hitSampleCount > 0,
	'visibility moment inspection: expected finite direct readback samples with at least one hit-confidence sample.' );
	assert( visibilityMomentInspection.encoding === 'radial-distance' &&
		visibilityMomentInspection.stats.encoding === visibilityMomentInspection.encoding &&
		visibilityMomentInspection.stats.bytes === visibilityMomentInspection.bytes &&
		Number.isFinite( visibilityMomentInspection.stats.minMeanDistance ) &&
		Number.isFinite( visibilityMomentInspection.stats.maxMeanDistance ) &&
		Number.isFinite( visibilityMomentInspection.stats.minVariance ) &&
		Number.isFinite( visibilityMomentInspection.stats.maxVariance ) &&
		Number.isFinite( visibilityMomentInspection.stats.meanVariance ) &&
		Number.isFinite( visibilityMomentInspection.stats.minHitConfidence ) &&
		Number.isFinite( visibilityMomentInspection.stats.maxHitConfidence ) &&
		Number.isFinite( visibilityMomentInspection.stats.meanHitConfidence ),
	'visibility moment inspection: expected radial moment stats, variance distribution, hit confidence distribution, and byte accounting.' );
	assert( visibilityMomentInspection.momentQualityProfile?.varianceMetric?.includes( 'radial-distance variance' ) &&
		visibilityMomentInspection.momentQualityProfile?.activeRepackMode === 'five-tap-octa-neighborhood' &&
		Array.isArray( visibilityMomentInspection.momentQualityProfile?.sweepPlan ),
	'visibility moment inspection: expected honest private moment-quality profile and deferred sweep plan.' );
	assert( visibilityMomentInspection.samples.every( sample =>
		sample.finite === true &&
			sample.momentEncoding === visibilityMomentInspection.encoding &&
			Number.isFinite( sample.meanDistance ) &&
			Number.isFinite( sample.meanSquaredDistance ) &&
			Number.isFinite( sample.variance ) &&
			Number.isFinite( sample.backfaceConfidence ) ),
	'visibility moment inspection: expected every proof sample to expose finite radial-moment fields.' );
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
