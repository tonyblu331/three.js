const hasNoFields = ( object, ...fields ) => fields.every( field => object[ field ] === undefined );

const hasBakeCoalescingFacts = bakeCoalescing =>
	bakeCoalescing.samePromise === true &&
	Number.isFinite( bakeCoalescing.totalBakeMs ) &&
	hasNoFields( bakeCoalescing, 'timings' );

const hasBenchmarkBackendFacts = benchmark =>
	benchmark.probes === 8 &&
	[ 'compute-probe-reduction', 'fragment-coefficient-projection' ].includes( benchmark.backend.projection ) &&
	[ 'compute-probe-reduction', 'fragment-coefficient-projection' ].includes( benchmark.projectionBackend ) &&
	benchmark.backend.atlas === 'render-pass' &&
	benchmark.backend.update === 'full';

const hasBenchmarkMemoryFacts = benchmark =>
	benchmark.estimatedGpuBytes.total > 0 &&
	benchmark.estimatedGpuBytes.cubemapBytes > 0 &&
	benchmark.estimatedGpuBytes.coefficientBytes > 0 &&
	benchmark.estimatedGpuBytes.atlasBytes > 0 &&
	benchmark.estimatedGpuBytes.probeValidityBytes > 0 &&
	hasNoFields( benchmark.estimatedGpuBytes, 'backend' );

const hasBenchmarkVisibilityDepthFacts = benchmark =>
	benchmark.visibilityDepth?.available === true &&
	benchmark.visibilityDepth?.active === true &&
	benchmark.visibilityDepth?.runtimeActive === true &&
	benchmark.visibilityDepth?.mode === 'moments' &&
	Number.isInteger( benchmark.visibilityDepth?.resolution ) &&
	benchmark.visibilityDepth?.resolution > 0 &&
	benchmark.visibilityDepth?.texturePresent === true &&
	benchmark.visibilityDepth?.bytes > 0 &&
	hasNoFields( benchmark.visibilityDepth,
		'encoding',
		'moments',
		'texture',
		'samples',
		'stats'
	);

const hasBenchmarkTimingFacts = benchmark =>
	Number.isFinite( benchmark.totalBakeMs ) &&
	benchmark.totalBakeMs > 0 &&
	benchmark.timingSource !== 'unavailable' &&
	[ 'gpu-timestamp', 'performance.now diagnostic', 'unavailable' ].includes( benchmark.timingSourceKind ) &&
	[ 'gpu-timestamp', 'unavailable' ].includes( benchmark.gpuTimestampStatus ) &&
	Number.isFinite( benchmark.cubemapMs ) &&
	Number.isFinite( benchmark.projectionMs ) &&
	Number.isFinite( benchmark.copyMs ) &&
	benchmark.timingBuckets !== undefined &&
	benchmark.timingBuckets.source === benchmark.timingSourceKind &&
	Number.isFinite( benchmark.timingBuckets.sceneUpdateMs ) &&
	Number.isFinite( benchmark.timingBuckets.radianceCubemapCaptureMs ) &&
	Number.isFinite( benchmark.timingBuckets.distanceCubemapCaptureMs ) &&
	Number.isFinite( benchmark.timingBuckets.computeShProjectionMs ) &&
	Number.isFinite( benchmark.timingBuckets.visibilityRepackMs ) &&
	Number.isFinite( benchmark.timingBuckets.atlasRepackMs ) &&
	benchmark.timingBuckets.verifierReadbackTimingSource === 'unavailable' &&
	Number.isFinite( benchmark.frameMs ) &&
	hasNoFields( benchmark, 'wallClockTotalBakeMs', 'deterministicTimerDetected' );

const hasColorSanityFacts = colorSanity =>
	colorSanity.leftRedOverGreen > 1.25 &&
	colorSanity.rightGreenOverRed > 1.25 &&
	colorSanity.centerEnergy > 18 &&
	hasNoFields( colorSanity, 'left', 'right', 'center' );

export async function runLightProbeGridGpuRuntimeSmokeAssertions( context ) {

	const { call, callRejects, capture, startOperation, waitUntilReady, assert, results } = context;

	await startOperation( 'setLeakReductionMode', 'off' );
	await waitUntilReady( 'leak reduction off' );
	const leakOffMetrics = await capture( 'leak reduction off' );
	assert( leakOffMetrics.sampling.quality === 'fast' &&
		leakOffMetrics.sampling.leakReductionMode === 'off',
	'leak setter: expected off sampling mode to map to fast quality.' );
	assert( leakOffMetrics.sampling.weightedProbeSampling === false,
		'leak setter: expected off mode to disable weighted sampling.' );

	await startOperation( 'setLeakReductionMode', 'normal' );
	await waitUntilReady( 'leak reduction normal' );
	const leakNormalMetrics = await capture( 'leak reduction normal' );
	assert( leakNormalMetrics.sampling.quality === 'guarded' &&
		leakNormalMetrics.sampling.leakReductionMode === 'normal',
	'leak setter: expected normal sampling mode to map to guarded quality.' );
	assert( leakNormalMetrics.sampling.weightedProbeSampling === true,
		'leak setter: expected normal mode to enable weighted sampling.' );

	const bakeCoalescing = await call( 'testBakeCoalescing' );
	assert( hasBakeCoalescingFacts( bakeCoalescing ),
		'bake contract: expected compact bake coalescing facts.' );
	results.push( { step: 'bake coalescing', bakeCoalescing } );

	const benchmark = await call( 'runBenchmarkCase', {
		resolution: 2,
		cubemapSize: 8,
		projectionPrecision: 'half float'
	} );
	assert( hasBenchmarkBackendFacts( benchmark ),
		'benchmark: expected compact backend facts.' );
	assert( hasBenchmarkMemoryFacts( benchmark ),
		'benchmark: expected compact GPU memory facts without duplicated backend metadata.' );
	assert( hasBenchmarkVisibilityDepthFacts( benchmark ),
		'benchmark: expected compact private moment-backed visibility/depth facts.' );
	assert( benchmark.precision.requestedPrecision === 'half float', 'benchmark: expected requested precision metadata.' );
	assert( hasBenchmarkTimingFacts( benchmark ),
		'benchmark: expected compact timing payload without exploratory runtime timing fields.' );
	results.push( { step: 'benchmark case', benchmark } );

	const failedBenchmarkBake = await callRejects( 'runBenchmarkCase', {
		resolution: 2,
		cubemapSize: 8,
		projectionPrecision: 'half float',
		simulateBenchmarkBakeFailure: true
	} );
	assert( failedBenchmarkBake.rejected === true, 'benchmark: expected failed benchmark bake to reject.' );
	assert( /benchmark bake/.test( failedBenchmarkBake.message ), 'benchmark: expected failed benchmark bake error message.' );
	results.push( { step: 'benchmark bake failure contract', failedBenchmarkBake } );

	const failedRestoreBake = await callRejects( 'runBenchmarkCase', {
		resolution: 2,
		cubemapSize: 8,
		projectionPrecision: 'half float',
		simulateBenchmarkRestoreFailure: true
	} );
	assert( failedRestoreBake.rejected === true, 'benchmark: expected failed restore bake to reject.' );
	assert( /restore bake/.test( failedRestoreBake.message ), 'benchmark: expected failed restore bake error message.' );
	results.push( { step: 'benchmark restore failure contract', failedRestoreBake } );

	await startOperation( 'setPrecision', 'float' );
	await waitUntilReady( 'float' );

	const floatMetrics = await capture( 'float' );
	assert( floatMetrics.precision.textureType === 'float' ||
		floatMetrics.precision.activePrecision === 'half-linear (fallback)',
	'float: expected float texture or explicit half fallback.' );

	if ( floatMetrics.precision.float32Filterable === true ) {

		assert( floatMetrics.precision.activePrecision === 'float-linear',
			'float: expected float-linear when float32-filterable is available.' );

	} else {

		assert( floatMetrics.precision.activePrecision === 'half-linear (fallback)',
			'float: expected half-linear fallback when float32-filterable is unavailable.' );

	}

	await startOperation( 'setPrecision', 'auto' );
	await waitUntilReady( 'auto' );

	const autoMetrics = await capture( 'auto' );

	if ( autoMetrics.precision.float32Filterable === true ) {

		assert( autoMetrics.precision.activePrecision === 'float-linear',
			'auto: expected float-linear when float32-filterable is available.' );

	} else {

		assert( autoMetrics.precision.activePrecision === 'half-linear',
			'auto: expected half-linear when float32-filterable is unavailable.' );

	}

	await startOperation( 'setPrecision', 'half float' );
	await waitUntilReady( 'half float' );

	const halfMetrics = await capture( 'half float' );
	assert( halfMetrics.precision.activePrecision === 'half-linear',
		'half float: expected half-linear.' );
	assert( halfMetrics.precision.textureType === 'half float',
		'half float: expected half float texture.' );

	await call( 'setLightingMode', 'probes only' );

	const probesOnlyMetrics = await capture( 'probes only' );
	assert( probesOnlyMetrics.lightingMode === 'probes only',
		'probes only: expected lighting mode to update.' );

	for ( const materialType of [ 'standard', 'physical', 'lambert', 'phong' ] ) {

		await call( 'setMaterialType', materialType );
		const materialMetrics = await capture( `material ${ materialType }` );
		assert( materialMetrics.materialType === materialType,
			`material ${ materialType }: expected material mode to update.` );

	}

	await startOperation( 'rebake' );
	await waitUntilReady( 'rebake probes only' );
	const rebakeMetrics = await capture( 'rebake probes only' );
	const colorSanity = await call( 'captureColorSanity' );
	assert( hasColorSanityFacts( colorSanity ),
		'probes only color sanity: expected compact wall-dominance and center-energy facts without raw RGB regions.' );

	results.push( {
		step: 'probes only color sanity',
		metrics: rebakeMetrics,
		colorSanity
	} );

	return results;

}
