const hasNoFields = ( object, ...fields ) => fields.every( field => object[ field ] === undefined );

const hasProbeClassificationFacts = probeOccupancy => {

	const classification = probeOccupancy.classification;

	return classification !== undefined &&
		classification.classificationPolicy === 'solid-occupancy-validity' &&
		classification.relocationPolicy === 'none' &&
		classification.validProbeCount + classification.invalidProbeCount === probeOccupancy.totalProbes &&
		classification.invalidProbeCount === probeOccupancy.occupiedProbeCount &&
		classification.interiorProbeCount === probeOccupancy.occupiedProbeCount &&
		classification.exteriorProbeCount === classification.validProbeCount &&
		classification.occludingProbeCount === probeOccupancy.occupiedProbeCount &&
		classification.relocatedProbeCount === 0 &&
		hasNoFields( classification, 'probes', 'rows', 'occupiedProbes', 'relocatedProbes', 'brightnessDerivedValidity' );

};

const hasProbeOccupancyFacts = probeOccupancy =>
	probeOccupancy.totalProbes === 64 &&
	probeOccupancy.solidMeshCount >= 3 &&
	probeOccupancy.occupiedProbeCount > 0 &&
	probeOccupancy.sampling.probeValidityMode === 'custom' &&
	probeOccupancy.sampling.invalidProbeCount === probeOccupancy.occupiedProbeCount &&
	Number.isInteger( probeOccupancy.occupiedProbeMeshHitCount ) &&
	probeOccupancy.occupiedProbeMeshHitCount >= probeOccupancy.occupiedProbeCount &&
	hasProbeClassificationFacts( probeOccupancy ) &&
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

const hasResidualAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.residualAttribution;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'rendered-region-source-ratios' &&
		attribution.baselineLabel === 'sealed-wall-validity-weighted' &&
		attribution.candidateLabel === 'sealed-wall-visibility-moments' &&
		Number.isFinite( attribution.screenRegionResidualRatio ) &&
		Number.isFinite( attribution.surfaceResidualRatio ) &&
		Number.isFinite( attribution.surfaceCenterResidualRatio ) &&
		Number.isFinite( attribution.maskedVisibleResidualRatio ) &&
		Number.isFinite( attribution.preToneMaskedResidualRatio ) &&
		Number.isFinite( attribution.candidateRenderIrradianceCenterWrongRatio ) &&
		Number.isFinite( attribution.candidateRenderLinearIrradianceCenterWrongRatio ) &&
		Number.isFinite( attribution.candidateLinearIrradianceToMaskedVisibleRatio ) &&
		Number.isFinite( attribution.candidateRenderIrradianceMaskedWrongRatio ) &&
		Number.isFinite( attribution.candidateRenderLinearIrradianceMaskedWrongRatio ) &&
		Number.isFinite( attribution.candidateMaskedIrradianceToMaskedVisibleRatio ) &&
		attribution.candidateReceiverMaterialType === 'standard' &&
		Number.isFinite( attribution.candidateReceiverAlbedoWrongSideRatio ) &&
		Number.isFinite( attribution.candidateReceiverRoughness ) &&
		Number.isFinite( attribution.candidateReceiverMetalness ) &&
		Number.isFinite( attribution.candidatePreToneMaskedToAlbedoRatio ) &&
		Number.isFinite( attribution.candidateRenderLambertMaskedWrongRatio ) &&
		Number.isFinite( attribution.candidateRenderLinearLambertMaskedWrongRatio ) &&
		Number.isFinite( attribution.candidateLinearLambertToLinearIrradianceRatio ) &&
		Number.isFinite( attribution.candidatePreToneMaskedToLinearLambertRatio ) &&
		Number.isFinite( attribution.candidateNearDividerEdgeWrongSideColorRatio ) &&
		Number.isFinite( attribution.candidateNearDividerEdgeToSurfaceCenterRatio ) &&
		Number.isFinite( attribution.candidateNearDividerEdgeToMaskedVisibleRatio ) &&
		Number.isInteger( attribution.candidateMaskedVisiblePixelCount ) &&
		Number.isFinite( attribution.candidateMaskedVisiblePixelRatio ) &&
		Number.isFinite( attribution.candidateMaskedVisibleToSurfaceCenterRatio ) &&
		Number.isFinite( attribution.candidatePreToneMaskedToMaskedVisibleRatio ) &&
		Number.isFinite( attribution.minCameraDotCpuNormal ) &&
		Number.isFinite( attribution.receiverSurfaceRegionAreaRatio ) &&
		hasNoFields( attribution, 'rows', 'samples', 'verdict', 'supported' );

};

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

	assert( hasResidualAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact residual attribution ratios without verdict payloads.' );

	assert( hasLeakProofRestorationFacts( leakProofFacts ),
		'leak proof facts: expected demo state and hidden fixture restoration.' );
	results.push( { step: 'leak proof facts', leakProofFacts } );


}
