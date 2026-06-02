const hasNoFields = ( object, ...fields ) => fields.every( field => object[ field ] === undefined );

const hasProbeOccupancyFacts = probeOccupancy =>
	probeOccupancy.totalProbes === 64 &&
	probeOccupancy.solidMeshCount >= 3 &&
	probeOccupancy.occupiedProbeCount > 0 &&
	probeOccupancy.sampling.probeValidityMode === 'custom' &&
	probeOccupancy.sampling.invalidProbeCount === probeOccupancy.occupiedProbeCount &&
	Number.isInteger( probeOccupancy.occupiedProbeMeshHitCount ) &&
	probeOccupancy.occupiedProbeMeshHitCount >= probeOccupancy.occupiedProbeCount &&
	hasNoFields( probeOccupancy, 'occupiedProbes' );

const hasLeakProofFixtureFacts = leakProofFacts =>
	leakProofFacts.fixtureMode === 'sealed-wall' &&
	Array.isArray( leakProofFacts.rows ) &&
	leakProofFacts.rows.length === 2 &&
	leakProofFacts.proofSettings.resolution === 4 &&
	leakProofFacts.proofSettings.cubemapSize === 8 &&
	leakProofFacts.sampling.weightedProbeSampling === true &&
	leakProofFacts.sampling.probeValidityMode === 'custom' &&
	leakProofFacts.proofSettings.band1Intensity === 1 &&
	leakProofFacts.proofSettings.band2Intensity === 0.55 &&
	leakProofFacts.proofSettings.normalBias === 0.5 &&
	leakProofFacts.proofSettings.viewBias === 0 &&
	leakProofFacts.proofSettings.lightingMode === 'probes only' &&
	leakProofFacts.proofSettings.materialType === 'standard' &&
	hasNoFields( leakProofFacts, 'receiverRegionMetricMode', 'preToneMetricMode', 'proofBoundary', 'sealedWall' );

const hasLeakProofRowFacts = row =>
	Number.isFinite( row.wrongSideColorRatio ) &&
	Number.isFinite( row.maskedWrongSideColorRatio ) &&
	Number.isFinite( row.correctBounceRatio ) &&
	Number.isFinite( row.preToneMaskedWrongSideColorRatio ) &&
	Number.isFinite( row.preToneMaskedCorrectBounceRatio ) &&
	row.correctBounceRatio > 0.75 &&
	hasNoFields( row,
		'centerWrongSideColorRatio',
		'centerCorrectBounceRatio',
		'surfaceCorrectBounceRatio',
		'receiverRegionMetricMode',
		'maskedReceiverRegionMetricMode',
		'leakMetrics',
		'preToneLeakMetrics'
	);

const hasLeakProofRestorationFacts = leakProofFacts =>
	leakProofFacts.restored.lightingMode === 'direct + probes' &&
	leakProofFacts.restored.leakReductionMode === 'off' &&
	leakProofFacts.restored.leakFixtureVisible === false &&
	hasNoFields( leakProofFacts.restored, 'sampling', 'timings', 'visibilityDepth' );

export async function runLightProbeGridGpuMatrixSmokeAssertions( context ) {

	const { call, assert, results } = context;

	const probeOccupancy = await call( 'inspectProbeOccupancy' );
	assert( hasProbeOccupancyFacts( probeOccupancy ),
	'probe occupancy: expected compact occupied probe mesh-hit facts without per-probe metadata.' );
	results.push( { step: 'probe occupancy', probeOccupancy } );

	const leakProofFacts = await call( 'captureLeakProofFacts' );
	assert( hasLeakProofFixtureFacts( leakProofFacts ),
	'leak proof facts: expected compact sealed-wall fixture, sampling, and proof-setting facts.' );

	const leakRows = new Map( leakProofFacts.rows.map( row => [ row.label, row ] ) );
	const scalarValidity = leakRows.get( 'sealed-wall-validity-weighted' );
	const visibilityMoments = leakRows.get( 'sealed-wall-visibility-moments' );

	assert( scalarValidity !== undefined && visibilityMoments !== undefined,
		'leak proof facts: expected sealed-wall validity and visibility rows.' );
	assert( scalarValidity.guardedVisibilityProofMode === 'off' &&
		visibilityMoments.guardedVisibilityProofMode === 'guarded',
	'leak proof facts: expected moment visibility to be isolated against scalar validity control.' );
	assert( hasNoFields( visibilityMoments, 'visibilityDepth' ),
	'leak proof facts: expected custom validity control without duplicating moment-readback facts owned by visibility diagnostics.' );

	for ( const row of leakProofFacts.rows ) {

		assert( hasLeakProofRowFacts( row ),
		`leak proof facts ${ row.label }: expected finite leak and bounce metrics.` );

	}

	assert( hasLeakProofRestorationFacts( leakProofFacts ),
	'leak proof facts: expected demo state and hidden fixture restoration.' );
	results.push( { step: 'leak proof facts', leakProofFacts } );


}
