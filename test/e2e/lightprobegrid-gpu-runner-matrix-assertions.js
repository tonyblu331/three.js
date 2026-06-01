export async function runLightProbeGridGpuMatrixSmokeAssertions( context ) {

	const { call, assert, results } = context;

	const probeOccupancy = await call( 'inspectProbeOccupancy' );
	assert( probeOccupancy.totalProbes === 64,
		'probe occupancy: expected default resolution 4 probe count.' );
	assert( probeOccupancy.solidMeshCount >= 3,
		'probe occupancy: expected solid Cornell meshes to be inspected.' );
	assert( probeOccupancy.occupiedProbeCount > 0,
		'probe occupancy: expected current Cornell layout to expose probes inside solid geometry.' );
	assert( probeOccupancy.sampling.probeValidityMode === 'custom' &&
		probeOccupancy.sampling.invalidProbeCount === probeOccupancy.occupiedProbeCount,
	'probe occupancy: expected occupied probes to be uploaded as custom validity metadata.' );
	assert( Array.isArray( probeOccupancy.occupiedProbes ) &&
		probeOccupancy.occupiedProbes.every( probe => Number.isInteger( probe.probeIndex ) && probe.meshes.length > 0 ),
	'probe occupancy: expected occupied probe metadata.' );
	results.push( { step: 'probe occupancy', probeOccupancy } );

	const leakProofFacts = await call( 'captureLeakProofFacts' );
	assert( leakProofFacts.fixtureMode === 'sealed-wall',
		'leak proof facts: expected sealed-wall verifier fixture.' );
	assert( Array.isArray( leakProofFacts.rows ) && leakProofFacts.rows.length === 2,
		'leak proof facts: expected scalar validity control and moment visibility candidate rows.' );

	const leakRows = new Map( leakProofFacts.rows.map( row => [ row.label, row ] ) );
	const scalarValidity = leakRows.get( 'sealed-wall-validity-weighted' );
	const visibilityMoments = leakRows.get( 'sealed-wall-visibility-moments' );

	assert( scalarValidity !== undefined && visibilityMoments !== undefined,
		'leak proof facts: expected sealed-wall validity and visibility rows.' );
	assert( scalarValidity.guardedVisibilityProofMode === 'off' &&
		visibilityMoments.guardedVisibilityProofMode === 'guarded',
	'leak proof facts: expected moment visibility to be isolated against scalar validity control.' );
	assert( leakProofFacts.proofSettings.resolution === 4 &&
		leakProofFacts.proofSettings.cubemapSize === 8,
	'leak proof facts: expected low-res 4^3 / cubemap 8 sealed-wall fixture.' );
	assert( leakProofFacts.sampling.weightedProbeSampling === true &&
		leakProofFacts.sampling.probeValidityMode === 'custom' &&
		visibilityMoments.visibilityDepth.available === true &&
		visibilityMoments.visibilityDepth.mode === 'moments' &&
		visibilityMoments.visibilityDepth.bytes > 0,
	'leak proof facts: expected custom validity control and moment-backed visibility candidate.' );
	assert( scalarValidity.leakMetrics.receiverRegionMetricMode === 'object-bounds-with-compact-center-surface-mask-ratios' &&
		visibilityMoments.leakMetrics.receiverRegionMetricMode === 'object-bounds-with-compact-center-surface-mask-ratios',
	'leak proof facts: expected compact receiver center/surface/masked ratios.' );
	assert( scalarValidity.preToneLeakMetrics?.mode === 'pre-tone-linear-output-masked-visible-pixels' &&
		visibilityMoments.preToneLeakMetrics?.mode === 'pre-tone-linear-output-masked-visible-pixels',
	'leak proof facts: expected pre-tone linear masked visible-pixel metrics.' );
	assert( leakProofFacts.proofSettings.band1Intensity === 1 &&
		leakProofFacts.proofSettings.band2Intensity === 0.55 &&
		leakProofFacts.proofSettings.normalBias === 0.5 &&
		leakProofFacts.proofSettings.viewBias === 0 &&
		leakProofFacts.proofSettings.lightingMode === 'probes only' &&
		leakProofFacts.proofSettings.materialType === 'standard',
	'leak proof facts: expected frozen proof fixture controls.' );

	for ( const row of leakProofFacts.rows ) {

		assert( Number.isFinite( row.leakMetrics.wrongSideColorRatio ) &&
			Number.isFinite( row.leakMetrics.maskedWrongSideColorRatio ) &&
			Number.isFinite( row.leakMetrics.correctBounceRatio ) &&
			Number.isFinite( row.preToneLeakMetrics.metrics.maskedWrongSideColorRatio ) &&
			Number.isFinite( row.preToneLeakMetrics.metrics.maskedCorrectBounceRatio ),
		`leak proof facts ${ row.label }: expected finite leak and bounce metrics.` );
		assert( row.leakMetrics.correctBounceRatio > 0.75,
			`leak proof facts ${ row.label }: expected correct bounce to remain measurable.` );

	}

	assert( leakProofFacts.proofBoundary === undefined &&
		leakProofFacts.sealedWall.status === undefined &&
		leakProofFacts.sealedWall.linearPromotionStatus === undefined,
	'leak proof facts: expected raw sealed-wall metrics without promotion verdict payload.' );
	assert( Number.isFinite( leakProofFacts.sealedWall.visibility.wrongSide.improvement ) &&
		Number.isFinite( leakProofFacts.sealedWall.visibility.maskedWrongSide.improvement ) &&
		Number.isFinite( leakProofFacts.sealedWall.visibility.preToneMaskedWrongSide.improvement ) &&
		Number.isFinite( leakProofFacts.sealedWall.visibility.correctBounce.preservation ) &&
		Number.isFinite( leakProofFacts.sealedWall.visibility.preToneMaskedCorrectBounce.preservation ),
	'leak proof facts: expected finite sealed-wall compact gate metrics.' );
	assert( leakProofFacts.restored.lightingMode === 'direct + probes' &&
		leakProofFacts.restored.sampling.leakReductionMode === 'off' &&
		leakProofFacts.restored.leakFixtureVisible === false,
	'leak proof facts: expected demo state and hidden fixture restoration.' );
	results.push( { step: 'leak proof facts', leakProofFacts } );


}
