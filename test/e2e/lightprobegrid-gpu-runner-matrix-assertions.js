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

	const artifactMatrix = await call( 'runProbeDiagnosticMatrix' );
	assert( Array.isArray( artifactMatrix.rows ) && artifactMatrix.rows.length === 12,
		'artifact matrix: expected twelve bounded diagnostic rows.' );

	const artifactRows = new Map( artifactMatrix.rows.map( row => [ row.label, row ] ) );
	const lowResDampedArtifact = artifactRows.get( 'low-res-damped' );
	const lowResUnweightedArtifact = artifactRows.get( 'low-res-unweighted' );
	const lowResValidityWeightedArtifact = artifactRows.get( 'low-res-validity-weighted' );
	const l0L1L2Artifact = artifactRows.get( 'l0-l1-l2' );
	const l0OnlyArtifact = artifactRows.get( 'l0-only' );
	const l0L1Artifact = artifactRows.get( 'l0-l1' );
	const floatLinearArtifact = artifactRows.get( 'float-linear' );
	const leakNormalConstantValidityArtifact = artifactRows.get( 'leak-normal-constant-validity' );
	const leakNormalArtifact = artifactRows.get( 'leak-normal' );
	const resolution6Artifact = artifactRows.get( 'resolution-6' );
	const cubemap16Artifact = artifactRows.get( 'cubemap-16' );
	const cubemap32Artifact = artifactRows.get( 'cubemap-32' );

	assert( lowResDampedArtifact !== undefined &&
		lowResUnweightedArtifact !== undefined &&
		lowResValidityWeightedArtifact !== undefined &&
		l0L1L2Artifact !== undefined &&
		l0OnlyArtifact !== undefined &&
		l0L1Artifact !== undefined &&
		floatLinearArtifact !== undefined &&
		leakNormalConstantValidityArtifact !== undefined &&
		leakNormalArtifact !== undefined &&
		resolution6Artifact !== undefined &&
		cubemap16Artifact !== undefined &&
		cubemap32Artifact !== undefined,
	'artifact matrix: expected low-res, SH-band, precision, leak, resolution, and cubemap labels.' );
	assert( lowResDampedArtifact.band1Intensity === 0.6 && lowResDampedArtifact.band2Intensity === 0.55,
		'artifact matrix: expected damped low-res diagnostic row.' );
	assert( lowResUnweightedArtifact.band1Intensity === 1 &&
		lowResUnweightedArtifact.band2Intensity === 0.55 &&
		lowResUnweightedArtifact.sampling.weightedProbeSampling === false,
	'artifact matrix: expected full band-1 low-res row to keep hardware-filtered unweighted sampling.' );
	assert( lowResDampedArtifact.probeIntensity === lowResUnweightedArtifact.probeIntensity,
		'artifact matrix: low-res bounce improvement must not come from global probe intensity changes.' );
	assert( lowResValidityWeightedArtifact.band1Intensity === 1 &&
		lowResValidityWeightedArtifact.band2Intensity === 0.55 &&
		lowResValidityWeightedArtifact.sampling.weightedProbeSampling === true &&
		lowResValidityWeightedArtifact.sampling.probeValidityMode === 'custom',
	'artifact matrix: expected low-res validity-weighted diagnostic row.' );
	assert( lowResUnweightedArtifact.colorSanity.center.r +
		lowResUnweightedArtifact.colorSanity.center.g +
		lowResUnweightedArtifact.colorSanity.center.b > 18,
	'artifact matrix: expected full band-1 low-res probes to keep center geometry visible.' );
	assert( l0L1L2Artifact.band1Intensity === 1 && l0L1L2Artifact.band2Intensity === 0.55 && l0L1L2Artifact.sampling.weightedProbeSampling === false,
		'artifact matrix: expected L0+L1+L2 row to capture unweighted band-2 probe lighting.' );
	assert( l0OnlyArtifact.band1Intensity === 0 && l0OnlyArtifact.band2Intensity === 0,
		'artifact matrix: expected L0 row to disable first and second SH bands.' );
	assert( l0L1Artifact.band1Intensity === 1 && l0L1Artifact.band2Intensity === 0,
		'artifact matrix: expected L0+L1 row to disable only second-band SH.' );
	assert( floatLinearArtifact.precision.requestedPrecision === 'float',
		'artifact matrix: expected float-linear precision row.' );
	assert( leakNormalConstantValidityArtifact.sampling.weightedProbeSampling === true &&
		leakNormalConstantValidityArtifact.sampling.probeValidityMode === 'constant',
	'artifact matrix: expected isolated normal-weighted constant-validity row.' );
	assert( leakNormalArtifact.sampling.weightedProbeSampling === true,
		'artifact matrix: expected normal leak reduction row to use weighted sampling.' );
	assert( leakNormalArtifact.sampling.probeValidityMode === 'custom' &&
		leakNormalArtifact.sampling.invalidProbeCount > 0,
	'artifact matrix: expected normal leak reduction row to use custom probe validity.' );
	assert( resolution6Artifact.resolution === 6,
		'artifact matrix: expected density row to increase probe resolution.' );
	assert( cubemap16Artifact.cubemapSize === 16,
		'artifact matrix: expected cubemap-16 sampling row.' );
	assert( cubemap32Artifact.cubemapSize === 32,
		'artifact matrix: expected cubemap-32 sampling row.' );

	for ( const row of artifactMatrix.rows ) {

		assert( row.lightingMode === 'probes only', `artifact matrix ${ row.label }: expected probes-only capture.` );
		assert( Number.isFinite( row.totalBakeMs ) &&
			row.totalBakeMs > 0 &&
			row.timingSource !== 'unavailable',
		`artifact matrix ${ row.label }: expected positive measured bake timing with a known timing source.` );
		assert( Number.isFinite( row.artifactSignature.center.luminance ), `artifact matrix ${ row.label }: expected finite center luminance.` );
		assert( Number.isFinite( row.localArtifactMetric.luminance.min ), `artifact matrix ${ row.label }: expected finite luminance minimum.` );
		assert( Number.isFinite( row.localArtifactMetric.luminance.p05 ), `artifact matrix ${ row.label }: expected finite luminance p05.` );
		assert( Number.isFinite( row.localArtifactMetric.luminance.median ), `artifact matrix ${ row.label }: expected finite luminance median.` );
		assert( Number.isFinite( row.localArtifactMetric.luminance.p95 ), `artifact matrix ${ row.label }: expected finite luminance p95.` );
		assert( Number.isFinite( row.localArtifactMetric.cellEdgeContrast ), `artifact matrix ${ row.label }: expected finite cell-edge contrast.` );
		assert( row.colorSanity.center.r + row.colorSanity.center.g + row.colorSanity.center.b > 18,
			`artifact matrix ${ row.label }: expected visible probe-lit center geometry.` );

	}

	assert( Number.isFinite( artifactMatrix.comparisons.precision.halfToFloatCenterLuminanceDelta ) &&
		Number.isFinite( artifactMatrix.comparisons.precision.halfToFloatCellEdgeDelta ),
	'artifact matrix: expected finite half/float precision diagnostic deltas.' );
	assert( Number.isFinite( artifactMatrix.comparisons.band.l0ToL1CellEdgeDelta ),
		'artifact matrix: expected finite SH band diagnostic delta.' );
	assert( Number.isFinite( artifactMatrix.comparisons.validity.normalCustomToConstantDarkPixelRatioDelta ) &&
		Number.isFinite( artifactMatrix.comparisons.validity.normalCustomToConstantCellEdgeDelta ),
	'artifact matrix: expected finite isolated validity diagnostic deltas.' );
	assert( Number.isFinite( artifactMatrix.comparisons.density.resolution4To6CellEdgeDelta ),
		'artifact matrix: expected finite density diagnostic delta.' );

	assert( artifactMatrix.restored.lightingMode === 'direct + probes',
		'artifact matrix: expected lighting mode restoration.' );
	assert( artifactMatrix.restored.sampling.leakReductionMode === 'off',
		'artifact matrix: expected leak reduction restoration.' );
	results.push( { step: 'artifact matrix', artifactMatrix } );

	const regionMatrix = await call( 'runProbeArtifactRegionMatrix' );
	assert( Array.isArray( regionMatrix.rows ) && regionMatrix.rows.length === 18,
		'region matrix: expected bounded low-res, cubemap, shadow, direct-light, and panel diagnostic rows.' );

	const regionRows = new Map( regionMatrix.rows.map( row => [ row.label, row ] ) );
	const regionLowResDamped = regionRows.get( 'low-res-damped' );
	const regionLowResUnweighted = regionRows.get( 'low-res-unweighted' );
	const regionLowResValidityWeighted = regionRows.get( 'low-res-validity-weighted' );
	const regionBaseline = regionRows.get( 'cubemap-8-shadows-on' );
	const regionCubemap16 = regionRows.get( 'cubemap-16-shadows-on' );
	const regionCubemap32 = regionRows.get( 'cubemap-32-shadows-on' );
	const regionShadowless8 = regionRows.get( 'cubemap-8-shadows-off' );
	const regionShadowless16 = regionRows.get( 'cubemap-16-shadows-off' );
	const regionShadowless32 = regionRows.get( 'cubemap-32-shadows-off' );
	const regionDirectOff16 = regionRows.get( 'cubemap-16-direct-off' );
	const regionPanelHidden16 = regionRows.get( 'cubemap-16-panel-hidden' );
	const regionSolidsHidden16 = regionRows.get( 'cubemap-16-solids-hidden' );
	const regionL016 = regionRows.get( 'cubemap-16-l0-only' );
	const regionL0L116 = regionRows.get( 'cubemap-16-l0-l1' );
	const regionL032 = regionRows.get( 'cubemap-32-l0-only' );
	const regionL0L132 = regionRows.get( 'cubemap-32-l0-l1' );
	const regionBand1Damped16 = regionRows.get( 'cubemap-16-band1-0.6' );
	const regionBand1Damped32 = regionRows.get( 'cubemap-32-band1-0.6' );

	assert( regionLowResDamped !== undefined &&
		regionLowResUnweighted !== undefined &&
		regionLowResValidityWeighted !== undefined &&
		regionBaseline !== undefined &&
		regionCubemap16 !== undefined &&
		regionCubemap32 !== undefined &&
		regionShadowless8 !== undefined &&
		regionShadowless16 !== undefined &&
		regionShadowless32 !== undefined &&
		regionDirectOff16 !== undefined &&
		regionPanelHidden16 !== undefined &&
		regionSolidsHidden16 !== undefined &&
		regionL016 !== undefined &&
		regionL0L116 !== undefined &&
		regionL032 !== undefined &&
		regionL0L132 !== undefined &&
		regionBand1Damped16 !== undefined &&
		regionBand1Damped32 !== undefined,
	'region matrix: expected low-res, cubemap, shadow, direct-light, panel, and regional SH-band diagnostic rows.' );

	for ( const row of regionMatrix.rows ) {

		assert( row.lightingMode === 'probes only', `region matrix ${ row.label }: expected probes-only capture.` );
		assert( Number.isFinite( row.totalBakeMs ) &&
			row.totalBakeMs > 0 &&
			row.timingSource !== 'unavailable',
		`region matrix ${ row.label }: expected positive measured bake timing with a known timing source.` );
		assert( row.regions.leftWall !== undefined &&
			row.regions.rightWall !== undefined &&
			row.regions.backWall !== undefined &&
			row.regions.ceilingEmitter !== undefined &&
			row.regions.floorCenter !== undefined &&
			row.regions.sphere !== undefined &&
			row.regions.tallBox !== undefined &&
			row.regions.shortBox !== undefined,
		`region matrix ${ row.label }: expected named artifact regions.` );

		for ( const region of Object.values( row.regions ) ) {

			assert( Number.isFinite( region.luminance.p01 ), `region matrix ${ row.label }: expected finite p01.` );
			assert( Number.isFinite( region.luminance.p05 ), `region matrix ${ row.label }: expected finite p05.` );
			assert( Number.isFinite( region.darkPixelRatio ), `region matrix ${ row.label }: expected finite dark-pixel ratio.` );
			assert( Number.isFinite( region.blackPixelRatio ), `region matrix ${ row.label }: expected finite black-tail ratio.` );
			assert( Number.isFinite( region.cellEdgeContrast ), `region matrix ${ row.label }: expected finite regional edge contrast.` );
			assert( Number.isFinite( region.color.r ) &&
				Number.isFinite( region.color.g ) &&
				Number.isFinite( region.color.b ),
			`region matrix ${ row.label }: expected finite regional RGB averages.` );
			assert( Number.isFinite( region.colorBias.redOverGreen ) &&
				Number.isFinite( region.colorBias.greenOverRed ),
			`region matrix ${ row.label }: expected finite regional color-bias ratios.` );

		}

		assert( row.artifactPressure !== undefined &&
			Number.isFinite( row.artifactPressure.objectBlackTailRatio ) &&
			Number.isFinite( row.artifactPressure.objectDarkTailRatio ) &&
			Number.isFinite( row.artifactPressure.luminanceFloor ),
		`region matrix ${ row.label }: expected object-level artifact pressure metrics.` );
		assert( row.bakeTexelBudget !== undefined &&
			Number.isFinite( row.bakeTexelBudget.cubemapTexels ) &&
			Number.isFinite( row.bakeTexelBudget.relativeToLowRes ),
		`region matrix ${ row.label }: expected bake texel budget accounting.` );

	}

	assert( regionLowResDamped.band1Intensity === 0.6 &&
		regionLowResDamped.band2Intensity === 0.55,
	'region matrix: expected damped low-res regional row.' );
	assert( regionLowResUnweighted.band1Intensity === 1 &&
		regionLowResUnweighted.band2Intensity === 0.55 &&
		regionLowResUnweighted.sampling.weightedProbeSampling === false,
	'region matrix: expected full band-1 low-res row to use hardware-filtered unweighted sampling.' );
	assert( regionLowResDamped.probeIntensity === regionLowResUnweighted.probeIntensity,
		'region matrix: low-res bounce improvement must not come from global probe intensity changes.' );
	assert( regionLowResValidityWeighted.sampling.weightedProbeSampling === true &&
		regionLowResValidityWeighted.sampling.probeValidityMode === 'custom',
	'region matrix: expected low-res validity-weighted row to use custom validity metadata.' );
	assert( regionLowResUnweighted.regions.tallBox.colorBias.redOverGreen >
		regionLowResDamped.regions.tallBox.colorBias.redOverGreen,
	'region matrix: expected full band-1 low-res row to strengthen tall-box red bounce over damped baseline.' );
	assert( regionLowResUnweighted.regions.sphere.colorBias.greenOverRed > 1,
		'region matrix: expected full band-1 low-res row to preserve green bounce on the sphere.' );
	assert( regionLowResUnweighted.regions.rightWall.colorBias.greenOverRed > 1.25,
		'region matrix: expected full band-1 low-res row to preserve green wall bounce.' );
	assert( regionLowResUnweighted.regions.tallBox.darkPixelRatio <=
		regionLowResDamped.regions.tallBox.darkPixelRatio + 0.35,
	'region matrix: expected full band-1 low-res row to keep tall-box dark tail bounded.' );
	assert( Math.abs( regionMatrix.comparisons.lowRes.tallBoxCellEdgeContrastDelta ) <= 255,
		'region matrix: expected full band-1 low-res cell-edge drift to remain bounded.' );
	assert( regionShadowless8.shadowsDisabledDuringBake === true &&
		regionShadowless16.shadowsDisabledDuringBake === true &&
		regionShadowless32.shadowsDisabledDuringBake === true,
	'region matrix: expected shadowless rows to mark bake-time shadow suppression.' );
	assert( regionDirectOff16.directLightDisabledDuringBake === true,
		'region matrix: expected direct-light suppression row.' );
	assert( regionPanelHidden16.lightPanelHiddenDuringBake === true,
		'region matrix: expected visible panel suppression row.' );
	assert( regionSolidsHidden16.solidGeometryHiddenDuringBake === true,
		'region matrix: expected solid geometry suppression row.' );
	assert( regionL016.band1Intensity === 0 && regionL016.band2Intensity === 0,
		'region matrix: expected cubemap-16 L0-only row.' );
	assert( regionL0L116.band1Intensity === 1 && regionL0L116.band2Intensity === 0,
		'region matrix: expected cubemap-16 L0+L1 row.' );
	assert( regionBand1Damped16.band1Intensity === 0.6 && regionBand1Damped16.band2Intensity === 0.55,
		'region matrix: expected cubemap-16 damped-band1 row.' );
	assert( regionMatrix.restored.lightingMode === 'direct + probes',
		'region matrix: expected lighting mode restoration.' );
	assert( regionMatrix.restored.sampling.leakReductionMode === 'off',
		'region matrix: expected leak reduction restoration.' );
	assert( Number.isFinite( regionMatrix.comparisons.cubemap.darkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.lowRes.tallBoxRedOverGreenGain ) &&
		Number.isFinite( regionMatrix.comparisons.lowRes.sphereGreenOverRed ) &&
		Number.isFinite( regionMatrix.comparisons.shadow.darkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.energy.directOffDarkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.energy.panelHiddenDarkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.geometry.solidsHiddenDarkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.band.l0ToL1DarkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.band.l1ToL2DarkPixelRatioDelta16 ),
	'region matrix: expected finite cubemap, shadow, energy-source, and regional SH-band deltas.' );
	assert( Number.isFinite( regionMatrix.comparisons.damping.band1DampedDarkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.damping.band1DampedDarkPixelRatioDelta32 ),
	'region matrix: expected finite damped-band1 deltas.' );
	assert( regionMatrix.comparisons.lowRes.tallBoxRedOverGreenGain > 0,
		'region matrix: expected low-res full band-1 row to improve tall-box red/green bias.' );
	assert( regionMatrix.comparisons.band.l0ToL1DarkPixelRatioDelta16 >
		regionMatrix.comparisons.band.l1ToL2DarkPixelRatioDelta16 * 4,
	'region matrix: expected first-band SH to dominate the cubemap-16 dark-tail regression.' );
	assert( regionMatrix.comparisons.damping.band1DampedDarkPixelRatioDelta16 > 0.05,
		'region matrix: expected damped band-1 row to materially reduce cubemap-16 dark-tail artifacts.' );
	assert( regionMatrix.comparisons.energy.directOffDarkPixelRatioDelta16 < 0.02 &&
		regionMatrix.comparisons.energy.panelHiddenDarkPixelRatioDelta16 < 0.02 &&
		regionMatrix.comparisons.geometry.solidsHiddenDarkPixelRatioDelta16 < 0.02,
	'region matrix: expected energy-source and solid-visibility toggles not to dominate the current dark-tail artifact.' );
	results.push( { step: 'region artifact matrix', regionMatrix } );

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
	assert( leakThinVisibilityMoments.visibilityDepth.available === false &&
		leakSealedVisibilityMoments.visibilityDepth.available === false,
	'leak matrix: runtime visibility/depth rows must report unavailable during proof-6 instead of claiming moment-backed runtime behavior.' );
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
		Number.isFinite( leakMatrix.comparisons.thinWall.visibilityWrongSideColorRatioDelta ) &&
		Number.isFinite( leakMatrix.comparisons.thinWall.validityCorrectBouncePreservation ) &&
		Number.isFinite( leakMatrix.comparisons.thinWall.visibilityCorrectBouncePreservation ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.validityWrongSideColorRatioDelta ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilityWrongSideColorRatioDelta ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilityCenterWrongSideColorRatioDelta ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilitySurfaceWrongSideColorRatioDelta ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilityMaskedWrongSideColorRatioDelta ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilityPreToneMaskedWrongSideColorRatioDelta ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilityWrongSideImprovementRatio ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilityCenterWrongSideImprovementRatio ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilitySurfaceWrongSideImprovementRatio ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilityMaskedWrongSideImprovementRatio ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilityPreToneMaskedWrongSideImprovementRatio ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilityCorrectBouncePreservation ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilityMaskedCorrectBouncePreservation ) &&
		Number.isFinite( leakMatrix.comparisons.sealedWall.visibilityPreToneMaskedCorrectBouncePreservation ) &&
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
