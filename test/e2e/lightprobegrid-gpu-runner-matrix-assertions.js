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

	const leakMatrix = await call( 'runProbeLeakMatrix' );
	assert( Array.isArray( leakMatrix.rows ) && leakMatrix.rows.length === 11,
		'leak matrix: expected eleven DDGI-lite visibility/depth verifier rows with runtime dilation rows removed from proof-6.' );

	const leakRows = new Map( leakMatrix.rows.map( row => [ row.label, row ] ) );
	const leakThinUnweighted = leakRows.get( 'leak-thin-wall-unweighted' );
	const leakThinNormalWeighted = leakRows.get( 'leak-thin-wall-normal-weighted' );
	const leakThinValidityWeighted = leakRows.get( 'leak-thin-wall-validity-weighted' );
	const leakThinVisibilityMoments = leakRows.get( 'leak-thin-wall-visibility-scaffold-disabled' );
	const leakVisibilityDisabledControl = leakRows.get( 'visibility-disabled-control' );
	const leakSealedUnweighted = leakRows.get( 'leak-sealed-wall-unweighted' );
	const leakSealedValidityWeighted = leakRows.get( 'leak-sealed-wall-validity-weighted' );
	const leakSealedVisibilityMoments = leakRows.get( 'leak-sealed-wall-visibility-scaffold-disabled' );
	const leakZeroUnweighted = leakRows.get( 'leak-zero-thickness-unweighted' );
	const leakZeroValidityWeighted = leakRows.get( 'leak-zero-thickness-validity-weighted' );
	const leakZeroVisibilityMoments = leakRows.get( 'leak-zero-thickness-visibility-scaffold-disabled' );

	assert( leakThinUnweighted !== undefined &&
		leakThinNormalWeighted !== undefined &&
		leakThinValidityWeighted !== undefined &&
		leakThinVisibilityMoments !== undefined &&
		leakVisibilityDisabledControl !== undefined &&
		leakSealedUnweighted !== undefined &&
		leakSealedValidityWeighted !== undefined &&
		leakSealedVisibilityMoments !== undefined &&
		leakZeroUnweighted !== undefined &&
		leakZeroValidityWeighted !== undefined &&
		leakZeroVisibilityMoments !== undefined,
	'leak matrix: expected thin-wall stress, sealed-wall promotion, visibility-control, and zero-thickness proof rows.' );

	for ( const row of leakMatrix.rows ) {

		assert( row.resolution === 4 && row.cubemapSize === 8,
			`leak matrix ${ row.label }: expected low-res 4^3 / cubemap 8 fixture.` );
		assert( row.band1Intensity === 1 && row.band2Intensity === 0.55,
			`leak matrix ${ row.label }: expected full band-1 plus damped L2 anti-ringing fixture.` );
		assert( row.normalBias === 0.5 && row.viewBias === 0,
			`leak matrix ${ row.label }: expected frozen bias controls.` );
		assert( row.lightingMode === 'probes only' && row.materialType === 'standard',
			`leak matrix ${ row.label }: expected probes-only standard-material fixture.` );
		assert( Number.isFinite( row.totalBakeMs ) &&
			row.totalBakeMs > 0 &&
			row.timingSource !== 'unavailable' &&
			Number.isFinite( row.frameMs ),
		`leak matrix ${ row.label }: expected positive measured bake timing and finite frame timing.` );
		assert( row.leakMetrics.regions.leftReceiver !== undefined &&
			row.leakMetrics.regions.rightReceiver !== undefined &&
			row.leakMetrics.regions.divider !== undefined,
		`leak matrix ${ row.label }: expected named leak regions.` );
		assert( row.leakMetrics.centerRegions?.leftReceiverCenter !== undefined &&
			row.leakMetrics.centerRegions?.rightReceiverCenter !== undefined &&
			row.leakMetrics.surfaceRegions?.leftReceiverSurface !== undefined &&
			row.leakMetrics.surfaceRegions?.rightReceiverSurface !== undefined &&
			row.leakMetrics.maskedRegions?.leftReceiverMasked !== undefined &&
			row.leakMetrics.maskedRegions?.rightReceiverMasked !== undefined &&
			row.leakMetrics.receiverRegionMetricMode === 'object-bounds-rect-with-center-and-surface-isolated-diagnostics',
		`leak matrix ${ row.label }: expected receiver center, surface-isolated, and masked visible-pixel metric diagnostics.` );
		assert( row.preToneLeakMetrics?.mode === 'pre-tone-linear-output-masked-visible-pixels' &&
			row.preToneLeakMetrics?.toneMapping === 'NoToneMapping' &&
			row.preToneLeakMetrics?.outputColorSpace === 'srgb-linear' &&
			Number.isFinite( row.preToneLeakMetrics.metrics.maskedWrongSideColorRatio ) &&
			Number.isFinite( row.preToneLeakMetrics.metrics.maskedCorrectBounceRatio ),
		`leak matrix ${ row.label }: expected pre-tone linear-output masked visible-pixel metrics.` );
		assert( Number.isFinite( row.leakMetrics.wrongSideColorRatio ) &&
			Number.isFinite( row.leakMetrics.centerWrongSideColorRatio ) &&
			Number.isFinite( row.leakMetrics.surfaceWrongSideColorRatio ) &&
			Number.isFinite( row.leakMetrics.maskedWrongSideColorRatio ) &&
			Number.isFinite( row.leakMetrics.correctBounceRatio ) &&
			Number.isFinite( row.leakMetrics.centerCorrectBounceRatio ) &&
			Number.isFinite( row.leakMetrics.surfaceCorrectBounceRatio ) &&
			Number.isFinite( row.leakMetrics.maskedCorrectBounceRatio ) &&
			row.leakMetrics.maskedReceiverRegionMetricMode === 'receiver-id-mask-visible-pixels' &&
			Number.isFinite( row.leakMetrics.luminance.mean ) &&
			Number.isFinite( row.leakMetrics.darkPixelRatio ) &&
			Number.isFinite( row.leakMetrics.cellEdgeContrast ),
		`leak matrix ${ row.label }: expected finite leak metrics.` );
		assert( row.leakMetrics.luminance.mean > 8,
			`leak matrix ${ row.label }: expected visible leak receiver luminance.` );
		assert( row.leakMetrics.darkPixelRatio <= 0.95,
			`leak matrix ${ row.label }: expected bounded dark-pixel ratio.` );
		assert( row.leakMetrics.cellEdgeContrast <= 255,
			`leak matrix ${ row.label }: expected bounded cell-edge contrast.` );

	}

	assert( leakThinUnweighted.fixtureMode === 'thin-wall' &&
		leakThinNormalWeighted.fixtureMode === 'thin-wall' &&
		leakThinValidityWeighted.fixtureMode === 'thin-wall' &&
		leakThinVisibilityMoments.fixtureMode === 'thin-wall' &&
		leakVisibilityDisabledControl.fixtureMode === 'thin-wall' &&
		leakSealedUnweighted.fixtureMode === 'sealed-wall' &&
		leakSealedValidityWeighted.fixtureMode === 'sealed-wall' &&
		leakSealedVisibilityMoments.fixtureMode === 'sealed-wall' &&
		leakZeroUnweighted.fixtureMode === 'zero-thickness' &&
		leakZeroValidityWeighted.fixtureMode === 'zero-thickness' &&
		leakZeroVisibilityMoments.fixtureMode === 'zero-thickness',
	'leak matrix: expected fixture geometry to change only for explicit sealed-wall promotion and zero-thickness negative-control rows.' );
	assert( leakThinUnweighted.probeIntensity === leakThinNormalWeighted.probeIntensity &&
		leakThinUnweighted.probeIntensity === leakThinValidityWeighted.probeIntensity &&
		leakThinUnweighted.probeIntensity === leakThinVisibilityMoments.probeIntensity &&
		leakThinUnweighted.probeIntensity === leakVisibilityDisabledControl.probeIntensity &&
		leakThinUnweighted.probeIntensity === leakSealedUnweighted.probeIntensity &&
		leakThinUnweighted.probeIntensity === leakSealedValidityWeighted.probeIntensity &&
		leakThinUnweighted.probeIntensity === leakSealedVisibilityMoments.probeIntensity &&
		leakThinUnweighted.probeIntensity === leakZeroUnweighted.probeIntensity &&
		leakThinUnweighted.probeIntensity === leakZeroValidityWeighted.probeIntensity &&
		leakThinUnweighted.probeIntensity === leakZeroVisibilityMoments.probeIntensity,
	'leak matrix: leak comparison must not improve by changing global probe intensity.' );
	assert( leakThinUnweighted.sampling.weightedProbeSampling === false &&
		leakThinUnweighted.sampling.manualIrradianceSampling === false,
	'leak matrix: unweighted thin-wall baseline must remain hardware-filtered.' );
	assert( leakThinNormalWeighted.sampling.weightedProbeSampling === true &&
		leakThinNormalWeighted.sampling.probeValidityMode === 'constant',
	'leak matrix: normal-weighted thin-wall row must use manual weighted sampling with constant validity.' );
	assert( leakThinValidityWeighted.sampling.weightedProbeSampling === true &&
		leakThinValidityWeighted.sampling.probeValidityMode === 'custom' &&
		leakThinValidityWeighted.sampling.invalidProbeCount > 0 &&
		leakThinValidityWeighted.occupancy.occupiedProbeCount > 0,
	'leak matrix: validity-weighted thin-wall row must upload controlled wall occupancy metadata.' );
	assert( leakThinVisibilityMoments.visibilityDepth.available === true &&
		leakThinVisibilityMoments.visibilityDepth.mode === 'moments' &&
		leakThinVisibilityMoments.visibilityDepth.bytes > 0 &&
		leakThinVisibilityMoments.guardedVisibilityProofMode === 'guarded' &&
		leakSealedVisibilityMoments.visibilityDepth.available === true &&
		leakSealedVisibilityMoments.visibilityDepth.mode === 'moments' &&
		leakSealedVisibilityMoments.visibilityDepth.bytes > 0 &&
		leakSealedVisibilityMoments.guardedVisibilityProofMode === 'guarded',
	'leak matrix: visibility rows must use the private guarded moment-backed proof path.' );
	assert( leakZeroUnweighted.negativeControlStatus === 'OPEN' &&
		leakZeroValidityWeighted.negativeControlStatus === 'OPEN' &&
		leakZeroVisibilityMoments.negativeControlStatus === 'OPEN' &&
		leakMatrix.comparisons.zeroThickness.status === 'OPEN',
	'leak matrix: zero-thickness negative control must stay explicitly unresolved.' );
	assert( leakThinUnweighted.leakMetrics.correctBounceRatio > 0.95,
		'leak matrix: thin-wall baseline must preserve measurable correct-side bounce.' );
	assert( leakThinNormalWeighted.leakMetrics.correctBounceRatio >
		leakThinUnweighted.leakMetrics.correctBounceRatio * 0.75,
	'leak matrix: normal weighting must not erase correct bounce.' );
	assert( leakThinValidityWeighted.leakMetrics.correctBounceRatio >
		leakThinUnweighted.leakMetrics.correctBounceRatio * 0.75,
	'leak matrix: validity weighting must not erase correct bounce.' );
	assert( leakThinVisibilityMoments.leakMetrics.correctBounceRatio >
		leakThinValidityWeighted.leakMetrics.correctBounceRatio * 0.9,
	'leak matrix: disabled visibility scaffold row must preserve correct bounce relative to scalar validity.' );
	assert( leakSealedUnweighted.leakMetrics.correctBounceRatio > 0.95,
		'leak matrix: sealed-wall baseline must preserve measurable correct-side bounce.' );
	assert( leakSealedValidityWeighted.leakMetrics.correctBounceRatio >
		leakSealedUnweighted.leakMetrics.correctBounceRatio * 0.75,
	'leak matrix: sealed scalar-validity control must not erase correct bounce.' );
	assert( leakSealedVisibilityMoments.leakMetrics.correctBounceRatio >
		leakSealedValidityWeighted.leakMetrics.correctBounceRatio * 0.9,
	'leak matrix: sealed disabled visibility scaffold row must preserve correct bounce relative to scalar validity.' );
	assert( leakThinNormalWeighted.leakMetrics.wrongSideColorRatio <=
		leakThinUnweighted.leakMetrics.wrongSideColorRatio + 0.35,
	'leak matrix: normal weighting must bound wrong-side color leak versus unweighted.' );
	assert( leakThinValidityWeighted.leakMetrics.wrongSideColorRatio <=
		leakThinUnweighted.leakMetrics.wrongSideColorRatio + 0.35,
	'leak matrix: validity weighting must bound wrong-side color leak versus unweighted.' );
	assert( leakThinVisibilityMoments.leakMetrics.wrongSideColorRatio <=
		leakThinValidityWeighted.leakMetrics.wrongSideColorRatio + 0.05,
	`leak matrix: first disabled visibility scaffold row must stay bounded versus scalar validity while the future 5% moment-improvement gate remains proof-tracked (${ leakThinVisibilityMoments.leakMetrics.wrongSideColorRatio } vs ${ leakThinValidityWeighted.leakMetrics.wrongSideColorRatio }).` );
	assert( leakSealedVisibilityMoments.leakMetrics.wrongSideColorRatio <=
		leakSealedValidityWeighted.leakMetrics.wrongSideColorRatio + 0.05,
	`leak matrix: sealed disabled visibility scaffold row must stay bounded versus scalar validity while promotion remains proof-tracked (${ leakSealedVisibilityMoments.leakMetrics.wrongSideColorRatio } vs ${ leakSealedValidityWeighted.leakMetrics.wrongSideColorRatio }).` );
	assert( leakThinValidityWeighted.leakMetrics.darkPixelRatio <=
		leakThinUnweighted.leakMetrics.darkPixelRatio + 0.35,
	'leak matrix: validity weighting must keep dark tails bounded.' );
	assert( Math.abs( leakMatrix.comparisons.thinWall.validityCellEdgeContrastDelta ) <= 255 &&
		Number.isFinite( leakMatrix.comparisons.thinWall.normalWrongSideColorRatioDelta ) &&
		Number.isFinite( leakMatrix.comparisons.thinWall.validityWrongSideColorRatioDelta ) &&
		Number.isFinite( leakMatrix.comparisons.thinWall.visibility.wrongSide.delta ) &&
		Number.isFinite( leakMatrix.comparisons.thinWall.validityCorrectBouncePreservation ) &&
		Number.isFinite( leakMatrix.comparisons.thinWall.visibility.correctBounce.preservation ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.validityWrongSideColorRatioDelta ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.wrongSide.delta ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.centerWrongSide.delta ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.surfaceWrongSide.delta ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.maskedWrongSide.delta ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.preToneMaskedWrongSide.delta ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.wrongSide.improvement ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.centerWrongSide.improvement ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.surfaceWrongSide.improvement ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.maskedWrongSide.improvement ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.preToneMaskedWrongSide.improvement ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.correctBounce.preservation ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.maskedCorrectBounce.preservation ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibility.preToneMaskedCorrectBounce.preservation ) &&
		Number.isFinite( leakMatrix.comparisons.zeroThickness.validityWrongSideColorRatioDelta ),
	'leak matrix: expected finite bounded leak comparison deltas.' );
	assert( [ 'OPEN', 'SUPPORTED-BY-SEALED-FIXTURE' ].includes( leakMatrix.comparisons.sealedWall.status ) &&
		[ 'OPEN', 'SUPPORTED-BY-PRE-TONE-MASKED-FIXTURE' ].includes( leakMatrix.comparisons.sealedWall.linearPromotionStatus ) &&
		leakMatrix.comparisons.sealedWall.linearPromotionMetricMode === 'pre-tone-linear-output-masked-visible-pixels',
	'leak matrix: sealed-wall presentation and linear promotion statuses must remain explicit and gate-driven.' );
	assert( leakMatrix.restored.lightingMode === 'direct + probes' &&
		leakMatrix.restored.sampling.leakReductionMode === 'off' &&
		leakMatrix.restored.leakFixtureVisible === false,
	'leak matrix: expected demo state and hidden fixture restoration.' );
	results.push( { step: 'leak matrix', leakMatrix } );


}
