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
	assert( scalarValidity.resolution === 4 &&
		scalarValidity.cubemapSize === 8 &&
		visibilityMoments.resolution === 4 &&
		visibilityMoments.cubemapSize === 8,
	'leak proof facts: expected low-res 4^3 / cubemap 8 sealed-wall fixture.' );
	assert( scalarValidity.sampling.weightedProbeSampling === true &&
		scalarValidity.sampling.probeValidityMode === 'custom' &&
		visibilityMoments.sampling.weightedProbeSampling === true &&
		visibilityMoments.visibilityDepth.available === true &&
		visibilityMoments.visibilityDepth.mode === 'moments' &&
		visibilityMoments.visibilityDepth.bytes > 0,
	'leak proof facts: expected custom validity control and moment-backed visibility candidate.' );
	assert( scalarValidity.leakMetrics.receiverRegionMetricMode === 'object-bounds-rect-with-center-and-surface-isolated-diagnostics' &&
		visibilityMoments.leakMetrics.receiverRegionMetricMode === 'object-bounds-rect-with-center-and-surface-isolated-diagnostics',
	'leak proof facts: expected receiver center/surface/masked diagnostics.' );
	assert( scalarValidity.preToneLeakMetrics?.mode === 'pre-tone-linear-output-masked-visible-pixels' &&
		visibilityMoments.preToneLeakMetrics?.mode === 'pre-tone-linear-output-masked-visible-pixels',
	'leak proof facts: expected pre-tone linear masked visible-pixel metrics.' );

	for ( const row of leakProofFacts.rows ) {

		assert( row.band1Intensity === 1 &&
			row.band2Intensity === 0.55 &&
			row.normalBias === 0.5 &&
			row.viewBias === 0 &&
			row.lightingMode === 'probes only' &&
			row.materialType === 'standard',
		`leak proof facts ${ row.label }: expected frozen proof fixture controls.` );
		assert( Number.isFinite( row.leakMetrics.wrongSideColorRatio ) &&
			Number.isFinite( row.leakMetrics.maskedWrongSideColorRatio ) &&
			Number.isFinite( row.leakMetrics.correctBounceRatio ) &&
			Number.isFinite( row.preToneLeakMetrics.metrics.maskedWrongSideColorRatio ) &&
			Number.isFinite( row.preToneLeakMetrics.metrics.maskedCorrectBounceRatio ),
		`leak proof facts ${ row.label }: expected finite leak and bounce metrics.` );
		assert( row.leakMetrics.correctBounceRatio > 0.75,
			`leak proof facts ${ row.label }: expected correct bounce to remain measurable.` );

	}

	assert( [ 'OPEN', 'SUPPORTED-BY-SEALED-FIXTURE' ].includes( leakProofFacts.sealedWall.status ) &&
		[ 'OPEN', 'SUPPORTED-BY-PRE-TONE-MASKED-FIXTURE' ].includes( leakProofFacts.sealedWall.linearPromotionStatus ),
	'leak proof facts: expected explicit sealed-wall promotion statuses.' );
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
