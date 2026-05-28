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
			Number.isFinite( sample.receiverPosition.x ) &&
			Number.isFinite( sample.receiverNormal.z ) &&
			Number.isFinite( sample.probeCoord.x ) &&
			Number.isFinite( sample.baseProbeCoord.y ) &&
			Number.isFinite( sample.trilinearBlend.z ) &&
			Array.isArray( sample.selectedProbeIndices ) &&
			sample.selectedProbeIndices.length === 8 &&
			Number.isFinite( sample.visibilityMass ) ) &&
		sealedReceiverSurfaceQuadratureDiagnostic.right.samples.every( sample =>
			Number.isFinite( sample.visibilityWrongOverCorrect ) &&
			sample.cpuLinearIrradianceTerms?.unit === 'linear-rgb-probe-irradiance' &&
			Number.isFinite( sample.cpuLinearIrradianceTerms.scalar.r ) &&
			Number.isFinite( sample.cpuLinearIrradianceTerms.visibility.g ) &&
			Number.isFinite( sample.cpuLinearIrradianceTerms.final.b ) &&
			Number.isFinite( sample.quadratureWeight ) &&
			Number.isFinite( sample.sampleUv.v ) &&
			Number.isFinite( sample.samplePosition.z ) &&
			Number.isFinite( sample.receiverNormal.x ) &&
			Number.isFinite( sample.probeCoord.y ) &&
			Number.isFinite( sample.baseProbeCoord.z ) &&
			Number.isFinite( sample.trilinearBlend.x ) &&
			Array.isArray( sample.selectedProbeIndices ) &&
			sample.selectedProbeIndices.length === 8 &&
			Number.isFinite( sample.baseWeightSum ) ),
	'sealed visibility weighting diagnostic: expected finite CPU surface quadrature samples.' );

	const sealedReceiverGpuDebugDiagnostic = sealedVisibilityWeightingDiagnostic.receiverGpuDebugDiagnostic;

	if ( sealedReceiverGpuDebugDiagnostic.runtimeDebugUnavailable === true ) {

		assert( sealedReceiverGpuDebugDiagnostic.status === 'OPEN-GPU-DEBUG-CPU-SURFACE-MISMATCH' &&
			sealedReceiverGpuDebugDiagnostic.proofBoundary.includes( 'Proof-6 unavailable GPU debug diagnostic' ) &&
			Array.isArray( sealedReceiverGpuDebugDiagnostic.variants ) &&
			sealedReceiverGpuDebugDiagnostic.variants.length === 0 &&
			sealedReceiverGpuDebugDiagnostic.presentationStudy?.summary?.offscreenSceneLinearContributionGate?.status === 'OPEN',
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
		sealedReceiverGpuDebugVariantLabels.includes( 'receiverPixelSamplePositionGrid' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'receiverPixelBaseProbeCoordGrid' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'receiverPixelTrilinearBlend' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'receiverPixelNeighbor0BaseWeight' ) &&
		sealedReceiverGpuDebugVariantLabels.includes( 'receiverPixelNeighbor7VisibilityWeight' ) &&
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
	const offscreenContributionRows = sealedReceiverGpuDebugDiagnostic.presentationStudy?.summary.offscreenSceneLinearContributionRows ?? [];
	const offscreenContributionLabels = offscreenContributionRows.map( row => row.label );
	const offscreenNeutralContributionRows = sealedReceiverGpuDebugDiagnostic.presentationStudy?.summary.offscreenSceneLinearNeutralContributionRows ?? [];
	const offscreenNeutralContributionLabels = offscreenNeutralContributionRows.map( row => row.label );
	const offscreenRowsHaveFiniteDecomposition = rows => rows.every( row =>
		row.mode === 'offscreen-half-float-linear-target' &&
		typeof row.receiverAlbedoMode === 'string' &&
		typeof row.receiverMaterialMode === 'string' &&
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
				row.maskOcclusionPolicy === 'depth-preserved-full-scene-mask' &&
				Number.isFinite( row.legacyReceiverOnlyMaskDiagnostic?.wrongSideRatioDelta ) &&
				row.leftReceiverMasked.samples > 0 &&
				row.rightReceiverMasked.samples > 0
			)
		) );

	assert( sealedReceiverGpuDebugDiagnostic.presentationStudy !== undefined &&
		[ 'SUPPORTED', 'OPEN-BSDF', 'OPEN-COLOR-MAPPING' ].includes( sealedReceiverGpuDebugDiagnostic.presentationStudy.status ) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.proofBoundary.includes( 'presentation receiver audit' ) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.variants.length === 7 &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.variants.some( variant => variant.label === 'standard-material-current-renderer' ) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.variants.some( variant => variant.label === 'standard-material-aces-exposure-0.5' ) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.variants.some( variant => variant.label === 'standard-material-aces-exposure-2.0' ) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.variants.some( variant => variant.label === 'standard-material-no-tone-mapping' ) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.variants.some( variant => variant.label === 'standard-material-linear-output-no-tone-mapping' ) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.variants.some( variant => variant.label === 'meshbasic-final-irradiance-linear-debug' ) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.variants.some( variant => variant.label === 'meshbasic-final-lambert-debug' ) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.variants.every( variant =>
			Number.isFinite( variant.leakMetrics.maskedWrongSideColorRatio ) &&
			Number.isFinite( variant.leakMetrics.maskedCorrectBounceRatio ) &&
			variant.leakMetrics.maskedReceiverRegionMetricMode === 'receiver-id-mask-visible-pixels' &&
			variant.pointMetrics.mode === 'projected-receiver-surface-3x3-point-samples' ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.standardVsDebugMaskedDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.toneMappingMaskedDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.outputColorSpaceMaskedDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.exposureMaskedDelta ) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.exposureSweep.length === 3 &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.exposureSweep.every( row =>
			Number.isFinite( row.exposure ) &&
			Number.isFinite( row.maskedWrongSideColorRatio ) &&
			Number.isFinite( row.deltaFromCurrentMaskedWrongSide ) ) &&
		typeof sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearTarget.status === 'string' &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearTarget.mode === 'offscreen-half-float-linear-target' &&
		(
			sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearTarget.status !== 'SUPPORTED' ||
			(
				Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearTarget.maskedWrongSideColorRatio ) &&
				Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearTarget.maskedCorrectBounceRatio ) &&
				sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearTarget.leftReceiverMasked.samples > 0 &&
				sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearTarget.rightReceiverMasked.samples > 0
			)
		) &&
		Array.isArray( offscreenContributionRows ) &&
		offscreenContributionRows.length === 7 &&
		offscreenContributionLabels.includes( 'runtime-probe-indirect-scene-linear' ) &&
		offscreenContributionLabels.includes( 'probe-indirect-after-albedo' ) &&
		offscreenContributionLabels.includes( 'probe-indirect-lambert-bsdf' ) &&
		offscreenContributionLabels.includes( 'probes-only' ) &&
		offscreenContributionLabels.includes( 'direct-only' ) &&
		offscreenContributionLabels.includes( 'ambient-only' ) &&
		offscreenContributionLabels.includes( 'direct-plus-probes' ) &&
		offscreenRowsHaveFiniteDecomposition( offscreenContributionRows ) &&
		Array.isArray( offscreenNeutralContributionRows ) &&
		offscreenNeutralContributionRows.length === 7 &&
		offscreenNeutralContributionLabels.includes( 'neutral-runtime-probe-indirect-scene-linear' ) &&
		offscreenNeutralContributionLabels.includes( 'neutral-probe-indirect-after-albedo' ) &&
		offscreenNeutralContributionLabels.includes( 'neutral-probe-indirect-lambert-bsdf' ) &&
		offscreenNeutralContributionLabels.includes( 'neutral-probes-only' ) &&
		offscreenNeutralContributionLabels.includes( 'neutral-direct-only' ) &&
		offscreenNeutralContributionLabels.includes( 'neutral-ambient-only' ) &&
		offscreenNeutralContributionLabels.includes( 'neutral-direct-plus-probes' ) &&
		offscreenRowsHaveFiniteDecomposition( offscreenNeutralContributionRows ) &&
		typeof sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionSummary.status === 'string' &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionSummary.mode === 'offscreen-half-float-linear-target-contribution-isolation-original-receiver-albedo' &&
		Array.isArray( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionSummary.warnings ) &&
		typeof sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearNeutralContributionSummary.status === 'string' &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearNeutralContributionSummary.mode === 'offscreen-half-float-linear-target-contribution-isolation-neutral-receiver-albedo' &&
		Array.isArray( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearNeutralContributionSummary.warnings ) &&
		(
			sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionGate.status === 'SUPPORTED' ||
			sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionGate.status.startsWith( 'OPEN-' )
		) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionGate.mode === 'proof-only-offscreen-scene-linear-contribution-gate' &&
		Array.isArray( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionGate.warnings ) &&
		Array.isArray( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionGate.blockers ) &&
		typeof sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionGate.dominantContributionSource === 'string' &&
		(
			sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionGate.neutralVsOriginalProbeDelta === null ||
			Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionGate.neutralVsOriginalProbeDelta )
		) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionGate.thresholds.neutralProbesOnlyWrongSideMax ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionGate.thresholds.neutralProbesOnlyCorrectBounceMin ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionGate.thresholds.neutralChromaticityWrongSidePressureMax ) &&
		(
			sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionSummary.directAmbientMaskedDelta === null ||
			Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionSummary.directAmbientMaskedDelta )
		) &&
		(
			sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionSummary.probesDirectPlusMaskedDelta === null ||
			Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionSummary.probesDirectPlusMaskedDelta )
		) &&
		typeof sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionSummary.diagnosticConclusion === 'string' &&
		[ 'OPEN-DEBUG-TARGET', 'OPEN-CPU-GPU', 'OPEN-BSDF', 'OPEN-COLOR-MAPPING', 'SUPPORTED' ].includes( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.sceneLinearMismatchClassifier.status ) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.sceneLinearMismatchClassifier.mode === 'receiver-mask-debug-runtime-albedo-lambert-bsdf-tone-map-classifier' &&
		typeof sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.sceneLinearMismatchClassifier.dominantMismatchSource === 'string' &&
		typeof sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.sceneLinearMismatchClassifier.diagnosticConclusion === 'string' &&
		(
			sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.runtimeProbeCpuDeltaMean === null ||
			Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.runtimeProbeCpuDeltaMean )
		) &&
		(
			sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.runtimeProbeCpuDeltaMax === null ||
			Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.runtimeProbeCpuDeltaMax )
		) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy !== undefined &&
		[ 'SUPPORTED-VISIBLE-PIXEL-CPU-GPU-SCENE-LINEAR-PARITY', 'OPEN-VISIBLE-PIXEL-CPU-GPU-SCENE-LINEAR-MISMATCH', 'OPEN-VISIBLE-PIXEL-CPU-GPU-SCENE-LINEAR-READBACK-FAILED' ].includes( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy.status ) &&
		sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy.mode === 'gpu-read-visible-receiver-pixel-position-cpu-mirror' &&
		typeof sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy.summary.dominantMismatchSource === 'string' &&
		typeof sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy.summary.exactPixelAgreementSupported === 'boolean' &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy.summary.sampleCount ) &&
		(
			sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy.summary.sampleCount === 0 ||
			(
				sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy.summary.leftSampleCount > 0 &&
				sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy.summary.rightSampleCount > 0 &&
				Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy.summary.cpuGpuWrongSideRatioDeltaMean ) &&
				Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy.summary.cpuGpuWrongSideRatioDeltaMax ) &&
				Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy.summary.finalIrradianceDeltaMax )
			)
		) &&
		(
			sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorDeltaMean === null ||
			Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorDeltaMean )
		) &&
		(
			sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorDeltaMax === null ||
			Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorDeltaMax )
		) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.lambertVsStandardLinearMaskedDelta ) &&
		typeof sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.bsdfIntegrationSupported === 'boolean' &&
		typeof sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.diagnosticConclusion === 'string',
	'sealed visibility weighting diagnostic: expected presentation material/tone-mapping/color-space audit.' );

	const visiblePixelCpuMirrorStudy = sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy;

	assert( visiblePixelCpuMirrorStudy !== undefined &&
		Array.isArray( visiblePixelCpuMirrorStudy.samples ) &&
		visiblePixelCpuMirrorStudy.samples.length === visiblePixelCpuMirrorStudy.summary.sampleCount &&
		visiblePixelCpuMirrorStudy.samples.every( sample =>
			sample.sampleKind === 'gpu-visible-receiver-pixel' &&
			Number.isFinite( sample.screen.pixelX ) &&
			Number.isFinite( sample.cpu.positionWorld.x ) &&
			Number.isFinite( sample.gpu.positionWorldGrid.x ) &&
			Number.isFinite( sample.cpu.samplePositionGrid.z ) &&
			Number.isFinite( sample.gpu.samplePositionGrid.z ) &&
			Number.isFinite( sample.deltas.samplePositionGrid.max ) &&
			Number.isFinite( sample.deltas.visibilityMass ) &&
			sample.neighborRows.length === 8 &&
			sample.irradianceTerms.length === 3 &&
			sample.irradianceTerms.some( term =>
				term.label === 'finalIrradiance' &&
				Number.isFinite( term.delta.max ) ) ),
	'sealed visibility weighting diagnostic: expected GPU-read visible pixel CPU mirror diagnostics.' );

	assert( sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy !== undefined &&
		[ 'SUPPORTED-RECEIVER-PIXEL-CPU-GPU-PARITY', 'OPEN-RECEIVER-PIXEL-CPU-GPU-MISMATCH' ].includes( sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.status ) &&
		sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.mode === 'projected-receiver-surface-same-pixel-cpu-gpu-debug-parity' &&
		typeof sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.summary.dominantMismatchSource === 'string' &&
		typeof sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.summary.pointParitySupported === 'boolean' &&
		typeof sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.summary.receiverMaskMismatch === 'boolean' &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.summary.maxSamplePositionGridDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.summary.maxNormalEncodedDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.summary.maxProbeCoordGridDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.summary.maxTrilinearBlendDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.summary.maxScalarWeightDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.summary.maxVisibilityWeightDelta ) &&
		Number.isFinite( sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.summary.maxLinearIrradianceDelta ) &&
		sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.samples.length === 18 &&
		sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy.samples.every( sample =>
			typeof sample.receiver === 'string' &&
			typeof sample.sampleLabel === 'string' &&
			Number.isFinite( sample.cpu.positionWorld.x ) &&
			Number.isFinite( sample.cpu.samplePositionGrid.z ) &&
			Number.isFinite( sample.gpu.samplePositionGrid.x ) &&
			Number.isFinite( sample.deltas.samplePositionGrid.max ) &&
			sample.neighborRows.length === 8 &&
			sample.irradianceTerms.length === 3 ),
	'sealed visibility weighting diagnostic: expected same-pixel CPU/GPU receiver parity diagnostics.' );

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

	results.push( { step: 'sealed visibility weighting diagnostic', sealedVisibilityWeightingDiagnostic } );

}
