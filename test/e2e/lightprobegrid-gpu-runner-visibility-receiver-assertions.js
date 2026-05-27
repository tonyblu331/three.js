export function runLightProbeGridGpuVisibilityReceiverAssertions( context ) {

	const { assert, results, sealedVisibilityWeightingDiagnostic } = context;

	const sealedReceiverSurfaceQuadratureDiagnostic = sealedVisibilityWeightingDiagnostic.receiverSurfaceQuadratureDiagnostic;
	assert( [ 'SUPPORTED-SURFACE-CPU-RENDER-AGREEMENT', 'OPEN-SURFACE-CPU-RENDER-MISMATCH' ].includes( sealedReceiverSurfaceQuadratureDiagnostic.status ) &&
		sealedReceiverSurfaceQuadratureDiagnostic.fixtureMode === 'sealed-wall' &&
		sealedReceiverSurfaceQuadratureDiagnostic.proofBoundary.includes( 'receiver-surface quadrature' ) &&
		sealedReceiverSurfaceQuadratureDiagnostic.quadratureRule === 'tensor-product-gauss-legendre-3x3-over-receiver-plane' &&
		sealedReceiverSurfaceQuadratureDiagnostic.sampleCountPerReceiver === 9,
	'sealed visibility weighting diagnostic: expected proof-only receiver-surface quadrature diagnostic.' );
	assert( sealedReceiverSurfaceQuadratureDiagnostic.left.samples.length === 9 &&
		sealedReceiverSurfaceQuadratureDiagnostic.right.samples.length === 9 &&
		Number.isFinite( sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMean ) &&
		Number.isFinite( sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMax ) &&
		Number.isFinite( sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDelta ) &&
		Number.isFinite( sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDeltaMean ) &&
		Number.isFinite( sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDeltaMax ) &&
		Number.isFinite( sealedReceiverSurfaceQuadratureDiagnostic.summary.maskedCpuRenderDeltaMean ) &&
		Number.isFinite( sealedReceiverSurfaceQuadratureDiagnostic.summary.maskedCpuRenderDeltaMax ) &&
		[
			'surface-region-receiver-mean',
			'surface-region-receiver-max',
			'masked-visible-pixels-receiver-mean',
			'masked-visible-pixels-receiver-max'
		].includes( sealedReceiverSurfaceQuadratureDiagnostic.summary.cpuRenderAgreementAggregation ) &&
		[ 'SUPPORTED', 'OPEN' ].includes( sealedReceiverSurfaceQuadratureDiagnostic.summary.cpuRenderAgreementGate ) &&
		sealedReceiverSurfaceQuadratureDiagnostic.left.samples.every( sample =>
			Number.isFinite( sample.runtimeWrongOverCorrect ) &&
			sample.cpuLinearIrradianceTerms?.unit === 'linear-rgb-probe-irradiance' &&
			Number.isFinite( sample.cpuLinearIrradianceTerms.scalar.r ) &&
			Number.isFinite( sample.cpuLinearIrradianceTerms.visibility.g ) &&
			Number.isFinite( sample.cpuLinearIrradianceTerms.final.b ) &&
			Number.isFinite( sample.quadratureWeight ) &&
			Number.isFinite( sample.sampleUv.u ) &&
			Number.isFinite( sample.receiverPosition.x ) ) &&
		sealedReceiverSurfaceQuadratureDiagnostic.right.samples.every( sample =>
			Number.isFinite( sample.visibilityWrongOverCorrect ) &&
			sample.cpuLinearIrradianceTerms?.unit === 'linear-rgb-probe-irradiance' &&
			Number.isFinite( sample.cpuLinearIrradianceTerms.scalar.r ) &&
			Number.isFinite( sample.cpuLinearIrradianceTerms.visibility.g ) &&
			Number.isFinite( sample.cpuLinearIrradianceTerms.final.b ) &&
			Number.isFinite( sample.quadratureWeight ) &&
			Number.isFinite( sample.sampleUv.v ) &&
			Number.isFinite( sample.samplePosition.z ) ),
	'sealed visibility weighting diagnostic: expected finite CPU surface quadrature samples.' );

	const sealedReceiverGpuDebugDiagnostic = sealedVisibilityWeightingDiagnostic.receiverGpuDebugDiagnostic;

	if ( sealedReceiverGpuDebugDiagnostic.runtimeDebugUnavailable === true ) {

		assert( sealedReceiverGpuDebugDiagnostic.status === 'OPEN-GPU-DEBUG-CPU-SURFACE-MISMATCH' &&
			sealedReceiverGpuDebugDiagnostic.proofBoundary.includes( 'Proof-6 unavailable GPU debug diagnostic' ) &&
			Array.isArray( sealedReceiverGpuDebugDiagnostic.variants ) &&
			sealedReceiverGpuDebugDiagnostic.variants.length === 0 &&
			sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy?.summary?.offscreenSceneLinearContributionGate?.status === 'OPEN',
		'sealed visibility weighting diagnostic: unavailable runtime debug path must be explicit and proof-only.' );
		results.push( { step: 'sealed receiver gpu debug unavailable', sealedReceiverGpuDebugDiagnostic } );
		results.push( { step: 'sealed visibility weighting diagnostic', sealedVisibilityWeightingDiagnostic } );
		return;

	}

	const sealedReceiverGpuDebugVariantLabels = sealedReceiverGpuDebugDiagnostic.variants.map( variant => variant.label );
	const sealedReceiverGpuDebugIrradianceVariants = sealedReceiverGpuDebugDiagnostic.variants.filter( variant =>
		variant.debugRenderFamily === 'irradiance'
	);
	const sealedReceiverGpuDebugLinearIrradianceVariants = sealedReceiverGpuDebugDiagnostic.variants.filter( variant =>
		variant.debugRenderFamily === 'irradiance-linear-term'
	);
	const sealedReceiverGpuDebugWeightVariants = sealedReceiverGpuDebugDiagnostic.variants.filter( variant =>
		variant.debugRenderFamily === 'probe-weight'
	);
	assert( [ 'SUPPORTED-GPU-DEBUG-MATCHES-CPU-SURFACE', 'OPEN-GPU-DEBUG-CPU-SURFACE-MISMATCH' ].includes( sealedReceiverGpuDebugDiagnostic.status ) &&
		sealedReceiverGpuDebugDiagnostic.fixtureMode === 'sealed-wall' &&
		sealedReceiverGpuDebugDiagnostic.proofBoundary.includes( 'GPU debug material' ) &&
		Array.isArray( sealedReceiverGpuDebugDiagnostic.variants ) &&
		sealedReceiverGpuDebugDiagnostic.variants.length >= 19 &&
		sealedReceiverGpuDebugVariantLabels.includes( 'receiverWhiteCalibration' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'normalWorldReceiver' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'positionWorldGridReceiver' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'probeIrradianceScalar-scale-1' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'probeIrradianceVisibility-scale-1' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'probeScalarIrradianceTerm-scale-1' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'probeVisibilityIrradianceTerm-scale-1' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'probeFinalIrradianceTerm-scale-1' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'probeWeightScalarTotal-scale-1' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'probeWeightVisibilityTotal-scale-1' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'probeWeightVisibilityMix-scale-1' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'probeWeightVisibilityOverScalar-scale-1' ),
	'sealed visibility weighting diagnostic: expected proof-only GPU receiver debug render diagnostic.' );
	const offscreenContributionRows = sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy?.summary.offscreenSceneLinearContributionRows ?? [];
	const offscreenContributionLabels = offscreenContributionRows.map( row => row.label );
	const offscreenNeutralContributionRows = sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy?.summary.offscreenSceneLinearNeutralContributionRows ?? [];
	const offscreenNeutralContributionLabels = offscreenNeutralContributionRows.map( row => row.label );
	const offscreenRowsHaveFiniteDecomposition = rows => rows.every( row =>
		row.mode === 'offscreen-half-float-linear-target' &&
		typeof row.receiverAlbedoMode === 'string' &&
		Number.isFinite( row.lighting?.directIntensity ) &&
		Number.isFinite( row.lighting?.ambientIntensity ) &&
		Number.isFinite( row.lighting?.probeIntensity ) &&
		(
			row.status !== 'SUPPORTED' ||
			(
				Number.isFinite( row.maskedWrongSideColorRatio ) &&
				Number.isFinite( row.maskedCorrectBounceRatio ) &&
				Number.isFinite( row.chromaticityWrongSidePressure ) &&
				Number.isFinite( row.maxChannelWrongOverCorrect ) &&
				Number.isFinite( row.rgbChannelWrongOverCorrect.leftWrongGreenOverCorrectRed ) &&
				Number.isFinite( row.rgbChannelWrongOverCorrect.rightWrongRedOverCorrectGreen ) &&
				Number.isFinite( row.leftReceiverMasked.chromaticity.r ) &&
				Number.isFinite( row.rightReceiverMasked.chromaticity.g ) &&
				row.leftReceiverMasked.samples > 0 &&
				row.rightReceiverMasked.samples > 0
			)
		) );

	assert( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy !== undefined &&
		[ 'SUPPORTED-FINAL-VISIBLE-PATH-BOUNDED', 'OPEN-FINAL-VISIBLE-BSDF-PRESSURE', 'OPEN-FINAL-VISIBLE-COLOR-MAPPING-PRESSURE' ].includes( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.status ) &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.proofBoundary.includes( 'final visible receiver audit' ) &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.variants.length === 7 &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.variants.some( variant => variant.label === 'standard-material-current-renderer' ) &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.variants.some( variant => variant.label === 'standard-material-aces-exposure-0.5' ) &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.variants.some( variant => variant.label === 'standard-material-aces-exposure-2.0' ) &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.variants.some( variant => variant.label === 'standard-material-no-tone-mapping' ) &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.variants.some( variant => variant.label === 'standard-material-linear-output-no-tone-mapping' ) &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.variants.some( variant => variant.label === 'meshbasic-final-irradiance-linear-debug' ) &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.variants.some( variant => variant.label === 'meshbasic-final-lambert-debug' ) &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.variants.every( variant =>
			Number.isFinite( variant.leakMetrics.maskedWrongSideColorRatio ) &&
			Number.isFinite( variant.leakMetrics.maskedCorrectBounceRatio ) &&
			variant.leakMetrics.maskedReceiverRegionMetricMode === 'receiver-id-mask-visible-pixels' &&
			variant.pointMetrics.mode === 'projected-receiver-surface-3x3-point-samples' ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.standardVsDebugMaskedDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.toneMappingMaskedDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.outputColorSpaceMaskedDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.exposureMaskedDelta ) &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.exposureSweep.length === 3 &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.exposureSweep.every( row =>
			Number.isFinite( row.exposure ) &&
			Number.isFinite( row.maskedWrongSideColorRatio ) &&
			Number.isFinite( row.deltaFromCurrentMaskedWrongSide ) ) &&
		typeof sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearTarget.status === 'string' &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearTarget.mode === 'offscreen-half-float-linear-target' &&
		(
			sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearTarget.status !== 'SUPPORTED' ||
			(
				Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearTarget.maskedWrongSideColorRatio ) &&
				Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearTarget.maskedCorrectBounceRatio ) &&
				sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearTarget.leftReceiverMasked.samples > 0 &&
				sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearTarget.rightReceiverMasked.samples > 0
			)
		) &&
		Array.isArray( offscreenContributionRows ) &&
		offscreenContributionRows.length === 4 &&
		offscreenContributionLabels.includes( 'probes-only' ) &&
		offscreenContributionLabels.includes( 'direct-only' ) &&
		offscreenContributionLabels.includes( 'ambient-only' ) &&
		offscreenContributionLabels.includes( 'direct-plus-probes' ) &&
		offscreenRowsHaveFiniteDecomposition( offscreenContributionRows ) &&
		Array.isArray( offscreenNeutralContributionRows ) &&
		offscreenNeutralContributionRows.length === 4 &&
		offscreenNeutralContributionLabels.includes( 'neutral-probes-only' ) &&
		offscreenNeutralContributionLabels.includes( 'neutral-direct-only' ) &&
		offscreenNeutralContributionLabels.includes( 'neutral-ambient-only' ) &&
		offscreenNeutralContributionLabels.includes( 'neutral-direct-plus-probes' ) &&
		offscreenRowsHaveFiniteDecomposition( offscreenNeutralContributionRows ) &&
		typeof sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionSummary.status === 'string' &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionSummary.mode === 'offscreen-half-float-linear-target-contribution-isolation-original-receiver-albedo' &&
		Array.isArray( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionSummary.warnings ) &&
		typeof sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearNeutralContributionSummary.status === 'string' &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearNeutralContributionSummary.mode === 'offscreen-half-float-linear-target-contribution-isolation-neutral-receiver-albedo' &&
		Array.isArray( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearNeutralContributionSummary.warnings ) &&
		[ 'SUPPORTED', 'OPEN' ].includes( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionGate.status ) &&
		sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionGate.mode === 'proof-only-offscreen-scene-linear-contribution-gate' &&
		Array.isArray( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionGate.warnings ) &&
		(
			sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionGate.neutralVsOriginalProbeDelta === null ||
			Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionGate.neutralVsOriginalProbeDelta )
		) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionGate.thresholds.neutralProbesOnlyWrongSideMax ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionGate.thresholds.neutralProbesOnlyCorrectBounceMin ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionGate.thresholds.neutralChromaticityWrongSidePressureMax ) &&
		(
			sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionSummary.directAmbientMaskedDelta === null ||
			Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionSummary.directAmbientMaskedDelta )
		) &&
		(
			sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionSummary.probesDirectPlusMaskedDelta === null ||
			Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionSummary.probesDirectPlusMaskedDelta )
		) &&
		typeof sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.offscreenSceneLinearContributionSummary.diagnosticConclusion === 'string' &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.lambertVsStandardLinearMaskedDelta ) &&
		typeof sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.bsdfIntegrationSupported === 'boolean' &&
		typeof sealedReceiverGpuDebugDiagnostic.finalVisibleMaterialStudy.summary.diagnosticConclusion === 'string',
	'sealed visibility weighting diagnostic: expected final visible material/tone-mapping/color-space audit.' );

	assert( sealedReceiverGpuDebugDiagnostic.variants.every( variant =>
		typeof variant.label === 'string' &&
		typeof variant.debugRenderFamily === 'string' &&
		Number.isFinite( variant.visibilityDepthWeighting ) &&
		Number.isFinite( variant.leakMetrics.surfaceWrongSideColorRatio ) &&
		Number.isFinite( variant.leakMetrics.leftSurfaceColor.r ) &&
		Number.isFinite( variant.leakMetrics.rightSurfaceColor.g ) &&
		Number.isFinite( variant.leakMetrics.leftSurfaceLuminance.mean ) &&
		Number.isFinite( variant.leakMetrics.rightSurfaceLuminance.mean ) &&
		variant.pointMetrics.mode === 'projected-receiver-surface-3x3-point-samples' &&
		Number.isFinite( variant.pointMetrics.surfaceWrongRatioMean ) &&
		Number.isFinite( variant.pointMetrics.surfaceWrongRatioMax ) &&
		Number.isFinite( variant.pointMetrics.surfaceCpuDelta ) &&
		Number.isFinite( variant.pointMetrics.surfaceCpuDeltaMean ) &&
		Number.isFinite( variant.pointMetrics.surfaceCpuDeltaMax ) &&
		[ 'receiver-mean', 'receiver-max' ].includes( variant.pointMetrics.surfaceCpuAggregation ) &&
		Number.isFinite( variant.pointMetrics.left.wrongOverCorrect ) &&
		Number.isFinite( variant.pointMetrics.right.wrongOverCorrect ) &&
		variant.pointMetrics.left.pointSamples.length === 9 &&
		variant.pointMetrics.right.pointSamples.length === 9 &&
		variant.pointMetrics.left.pointSamples.every( sample =>
			Number.isFinite( sample.color.r ) &&
			Number.isFinite( sample.luminance ) &&
			Number.isFinite( sample.colorBias.wrongOverCorrect ) &&
			Number.isFinite( sample.screen.pixelX ) ) &&
		( variant.surfaceCpuDelta === null || Number.isFinite( variant.surfaceCpuDelta ) ) &&
		( variant.termCpuDeltaMean === null || Number.isFinite( variant.termCpuDeltaMean ) ) &&
		( variant.termCpuDeltaMax === null || Number.isFinite( variant.termCpuDeltaMax ) ) &&
		( variant.linearIrradianceCpuDeltaMean === null || Number.isFinite( variant.linearIrradianceCpuDeltaMean ) ) &&
		( variant.linearIrradianceCpuDeltaMax === null || Number.isFinite( variant.linearIrradianceCpuDeltaMax ) ) &&
		( variant.termMetrics === null || (
			variant.termMetrics.mode === 'projected-receiver-surface-3x3-gpu-term-samples' &&
			Number.isFinite( variant.termMetrics.termDeltaMean ) &&
			Number.isFinite( variant.termMetrics.termDeltaMax ) &&
			Number.isFinite( variant.termMetrics.left.gpuWeightedMean ) &&
			Number.isFinite( variant.termMetrics.left.cpuWeightedMean ) &&
			Number.isFinite( variant.termMetrics.right.weightedDelta ) &&
			variant.termMetrics.left.pointSamples.length === 9 &&
			variant.termMetrics.left.pointSamples.every( sample =>
				Number.isFinite( sample.cpuValue ) &&
				Number.isFinite( sample.gpuValue ) &&
				Number.isFinite( sample.absoluteDelta ) ) ) ) &&
		( variant.linearIrradianceMetrics === null || (
			variant.linearIrradianceMetrics.mode === 'projected-receiver-surface-3x3-gpu-linear-irradiance-samples' &&
			variant.linearIrradianceMetrics.linearUnit === 'linear-rgb-probe-irradiance' &&
			Number.isFinite( variant.linearIrradianceMetrics.linearRgbDeltaMean ) &&
			Number.isFinite( variant.linearIrradianceMetrics.linearRgbDeltaMax ) &&
			Number.isFinite( variant.linearIrradianceMetrics.clippedSampleCount ) &&
			Number.isFinite( variant.linearIrradianceMetrics.left.weightedDelta.max ) &&
			Number.isFinite( variant.linearIrradianceMetrics.right.weightedSampleDeltaMean ) &&
			variant.linearIrradianceMetrics.left.pointSamples.length === 9 &&
			variant.linearIrradianceMetrics.left.pointSamples.every( sample =>
				Number.isFinite( sample.cpuLinearRgb.r ) &&
				Number.isFinite( sample.gpuLinearRgb.g ) &&
				Number.isFinite( sample.linearRgbDelta.max ) &&
				typeof sample.clippedChannel === 'boolean' ) ) ) &&
		sealedReceiverGpuDebugIrradianceVariants.length >= 8 &&
		sealedReceiverGpuDebugIrradianceVariants.every( variant =>
			Number.isFinite( variant.debugScale ) &&
			Number.isFinite( variant.surfaceCpuDelta ) &&
			Number.isFinite( variant.surfaceCpuDeltaMean ) &&
			Number.isFinite( variant.surfaceCpuDeltaMax ) &&
			[ 'receiver-mean', 'receiver-max' ].includes( variant.surfaceCpuAggregation ) &&
			Number.isFinite( variant.pointMetrics.surfaceCpuDelta ) ) &&
		sealedReceiverGpuDebugLinearIrradianceVariants.length >= 12 &&
		sealedReceiverGpuDebugLinearIrradianceVariants.every( variant =>
			Number.isFinite( variant.debugScale ) &&
			[ 'scalarIrradiance', 'visibilityIrradiance', 'finalIrradiance' ].includes( variant.debugMode ) &&
			[ 'scalar', 'visibility', 'final' ].includes( variant.cpuIrradianceTermKey ) &&
			Number.isFinite( variant.linearIrradianceCpuDeltaMean ) &&
			Number.isFinite( variant.linearIrradianceCpuDeltaMax ) &&
			variant.linearIrradianceMetrics.left.pointSamples.every( sample =>
				Number.isFinite( sample.cpuLinearRgb.r ) &&
				Number.isFinite( sample.gpuLinearRgb.g ) &&
				Number.isFinite( sample.linearRgbDelta.mean ) ) ) &&
		sealedReceiverGpuDebugWeightVariants.length >= 8 &&
		sealedReceiverGpuDebugWeightVariants.every( variant =>
			Number.isFinite( variant.debugScale ) &&
			typeof variant.debugMode === 'string' &&
			typeof variant.cpuTermKey === 'string' &&
			Number.isFinite( variant.termCpuDeltaMean ) &&
			Number.isFinite( variant.termCpuDeltaMax ) &&
			variant.termMetrics.left.pointSamples.every( sample =>
				Number.isFinite( sample.cpuValue ) &&
				Number.isFinite( sample.gpuValue ) &&
				Number.isFinite( sample.absoluteDelta ) ) ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestSurfaceCpuDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestVariantScale ) &&
		typeof sealedReceiverGpuDebugDiagnostic.summary.bestVariantCpuAggregation === 'string' &&
		typeof sealedReceiverGpuDebugDiagnostic.summary.bestTightPointVariant === 'string' &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestTightPointVariantScale ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestTightPointSurfaceWrongRatio ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestTightPointSurfaceWrongRatioMax ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestTightPointSurfaceCpuDelta ) &&
		typeof sealedReceiverGpuDebugDiagnostic.summary.bestTightPointCpuAggregation === 'string' &&
		typeof sealedReceiverGpuDebugDiagnostic.summary.bestWeightTermVariant === 'string' &&
		typeof sealedReceiverGpuDebugDiagnostic.summary.bestWeightTerm === 'string' &&
		typeof sealedReceiverGpuDebugDiagnostic.summary.bestWeightTermCpuKey === 'string' &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestWeightTermScale ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestWeightTermDeltaMean ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestWeightTermDeltaMax ) &&
		typeof sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceTermVariant === 'string' &&
		[ 'scalarIrradiance', 'visibilityIrradiance', 'finalIrradiance' ].includes( sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceTerm ) &&
		[ 'scalar', 'visibility', 'final' ].includes( sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceCpuKey ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceTermScale ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceDeltaMean ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceDeltaMax ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceClippedSampleCount ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.linearIrradianceAgreementTolerance ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( sealedReceiverGpuDebugDiagnostic.summary.linearIrradianceAgreementGate ) &&
		typeof sealedReceiverGpuDebugDiagnostic.summary.linearIrradianceAgreementMode === 'string' &&
		[ 'OPEN', 'SUPPORTED' ].includes( sealedReceiverGpuDebugDiagnostic.summary.weightTermAgreementGate ) &&
		typeof sealedReceiverGpuDebugDiagnostic.summary.weightTermAgreementMode === 'string' &&
		typeof sealedReceiverGpuDebugDiagnostic.summary.agreementMode === 'string' &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.linearIrradianceTermVariantCount ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.weightTermVariantCount ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.summary.whiteCalibrationLuminanceMean ) &&
		typeof sealedReceiverGpuDebugDiagnostic.summary.whiteCalibrationVisible === 'boolean' ),
	'sealed visibility weighting diagnostic: expected finite GPU debug calibration, geometry, and irradiance surface ratios.' );

	assert( sealedVisibilityWeightingDiagnostic.currentProbePipelineStudy?.status === 'SUPPORTED-CURRENT-PIPELINE-DOCUMENTED' &&
		sealedVisibilityWeightingDiagnostic.currentProbePipelineStudy.coefficientStorage.rgbScalarCountPerProbe === 27 &&
		sealedVisibilityWeightingDiagnostic.currentProbePipelineStudy.runtimePaths.manualWeighted.includes( 'textureLoad' ) &&
		sealedVisibilityWeightingDiagnostic.currentProbePipelineStudy.validityVsDilation.includes( 'dilation changes' ) &&
		sealedVisibilityWeightingDiagnostic.currentProbePipelineStudy.shadowmaskDecision.includes( 'out-of-scope' ),
	'sealed visibility weighting diagnostic: expected current pipeline study to document SH storage, WebGPU paths, validity, and shadowmask boundary.' );
	assert( [ 'SUPPORTED-DILATION-ORACLE-REDUCES-LEAK', 'OPEN-DILATION-ORACLE-NOT-PROVEN' ].includes( sealedVisibilityWeightingDiagnostic.dilationOracleStudy?.status ) &&
		sealedVisibilityWeightingDiagnostic.dilationOracleStudy.proofBoundary.includes( 'CPU-only coefficient replacement' ) &&
		sealedVisibilityWeightingDiagnostic.dilationOracleStudy.sourceMap.totalProbes > 0 &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.dilationOracleStudy.summary.currentWrongOverCorrectMean ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.dilationOracleStudy.summary.dilationOnlyImprovement ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.dilationOracleStudy.summary.dilationPlusValidityImprovement ) &&
		sealedVisibilityWeightingDiagnostic.dilationOracleStudy.left.mappedRows.every( row =>
			Number.isFinite( row.probeIndex ) &&
			Number.isFinite( row.sourceProbeIndex ) ),
	'sealed visibility weighting diagnostic: expected CPU dilation oracle with source-map evidence.' );
	assert( sealedVisibilityWeightingDiagnostic.samplingBiasStudy?.status === 'SUPPORTED-SAMPLING-BIAS-STUDY' &&
		sealedVisibilityWeightingDiagnostic.samplingBiasStudy.rows.length === 4 &&
		sealedVisibilityWeightingDiagnostic.samplingBiasStudy.rows.some( row => row.label === 'surface-view-bias' ) &&
		sealedVisibilityWeightingDiagnostic.samplingBiasStudy.rows.every( row =>
			Number.isFinite( row.cpuWrongOverCorrectMean ) &&
			Number.isFinite( row.renderSurfaceWrongSideColorRatio ) &&
			row.left.samples.length > 0 &&
			row.left.samples.every( sample =>
				Array.isArray( sample.selectedProbeIndices ) &&
				Number.isFinite( sample.cpuLinearIrradiance.r ) ) ) &&
		typeof sealedVisibilityWeightingDiagnostic.samplingBiasStudy.summary.metricArtifactWarning === 'string',
	'sealed visibility weighting diagnostic: expected sampling-bias study with selected probes and linear CPU irradiance.' );
	assert( [ 'OPEN-SH-RINGING-NEGATIVE-ENERGY-PRESENT', 'SUPPORTED-SH-RINGING-NOT-DOMINANT' ].includes( sealedVisibilityWeightingDiagnostic.shDeringingStudy?.status ) &&
		sealedVisibilityWeightingDiagnostic.shDeringingStudy.proofBoundary.includes( 'ZH3 remains compression' ) &&
		Number.isFinite( sealedVisibilityWeightingDiagnostic.shDeringingStudy.summary.maxCurrentNegativeEnergy ) &&
		sealedVisibilityWeightingDiagnostic.shDeringingStudy.left.rows.some( row => row.label === 'l0-only' ) &&
		sealedVisibilityWeightingDiagnostic.shDeringingStudy.left.rows.every( row =>
			Number.isFinite( row.negativeEnergy ) &&
			Number.isFinite( row.clampEnergyLoss ) &&
			Number.isFinite( row.colorBias.wrongOverCorrect ) ),
	'sealed visibility weighting diagnostic: expected SH de-ringing study with negative-energy and band-window rows.' );
	results.push( { step: 'sealed visibility weighting diagnostic', sealedVisibilityWeightingDiagnostic } );

}
