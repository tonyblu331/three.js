export function runLightProbeGridGpuVisibilityReceiverAssertions( context ) {

	const { assert, results, sealedVisibilityWeightingDiagnostic } = context;

	const surface = sealedVisibilityWeightingDiagnostic.receiverSurfaceQuadratureDiagnostic;
	assert( [ 'SUPPORTED-SURFACE-CPU-RENDER-AGREEMENT', 'OPEN-SURFACE-CPU-RENDER-MISMATCH' ].includes( surface.status ) &&
		surface.fixtureMode === 'sealed-wall' &&
		surface.proofBoundary.includes( 'receiver-surface quadrature' ) &&
		surface.quadratureRule === 'tensor-product-gauss-legendre-3x3-over-receiver-plane' &&
		surface.sampleCountPerReceiver === 9 &&
		Number.isFinite( surface.summary.surfaceRuntimeWrongRatioMean ) &&
		Number.isFinite( surface.summary.surfaceRuntimeWrongRatioMax ) &&
		Number.isFinite( surface.summary.surfaceCpuRenderDelta ) &&
		Number.isFinite( surface.summary.surfaceCpuRenderDeltaMean ) &&
		Number.isFinite( surface.summary.surfaceCpuRenderDeltaMax ) &&
		[ 'surface-region-receiver-mean', 'surface-region-receiver-max', 'masked-visible-pixels-receiver-mean', 'masked-visible-pixels-receiver-max' ].includes( surface.summary.cpuRenderAgreementAggregation ) &&
		[ 'SUPPORTED', 'OPEN' ].includes( surface.summary.cpuRenderAgreementGate ),
	'sealed visibility weighting diagnostic: expected compact receiver-surface CPU/render agreement summary.' );

	const gpuDebug = sealedVisibilityWeightingDiagnostic.receiverGpuDebugDiagnostic;
	assert( [ 'SUPPORTED-GPU-DEBUG-MATCHES-CPU-SURFACE', 'OPEN-GPU-DEBUG-CPU-SURFACE-MISMATCH' ].includes( gpuDebug.status ) &&
		gpuDebug.fixtureMode === 'sealed-wall' &&
		gpuDebug.proofBoundary.includes( 'GPU debug' ) &&
		Number.isFinite( gpuDebug.summary.bestSurfaceCpuDelta ) &&
		Number.isFinite( gpuDebug.summary.bestTightPointSurfaceCpuDelta ) &&
		Number.isFinite( gpuDebug.summary.bestWeightTermDeltaMean ) &&
		Number.isFinite( gpuDebug.summary.bestWeightTermDeltaMax ) &&
		Number.isFinite( gpuDebug.summary.bestLinearIrradianceDeltaMean ) &&
		Number.isFinite( gpuDebug.summary.bestLinearIrradianceDeltaMax ) &&
		Number.isFinite( gpuDebug.summary.bestLinearIrradianceClippedSampleCount ) &&
		Number.isFinite( gpuDebug.summary.linearIrradianceAgreementTolerance ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( gpuDebug.summary.linearIrradianceAgreementGate ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( gpuDebug.summary.weightTermAgreementGate ) &&
		Number.isFinite( gpuDebug.summary.comparableVariantCount ) &&
		Number.isFinite( gpuDebug.summary.linearIrradianceTermVariantCount ) &&
		Number.isFinite( gpuDebug.summary.weightTermVariantCount ) &&
		Number.isFinite( gpuDebug.summary.whiteCalibrationLuminanceMean ) &&
		typeof gpuDebug.summary.whiteCalibrationVisible === 'boolean',
	'sealed visibility weighting diagnostic: expected compact GPU debug agreement summary.' );

	results.push( { step: 'sealed visibility weighting diagnostic', sealedVisibilityWeightingDiagnostic } );

}
