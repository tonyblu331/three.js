export async function runLightProbeGridGpuRuntimeSmokeAssertions( context ) {

	const { call, callRejects, capture, startOperation, waitUntilReady, assert, results } = context;

	await startOperation( 'setLeakReductionMode', 'off' );
	await waitUntilReady( 'leak reduction off' );
	const leakOffMetrics = await capture( 'leak reduction off' );
	assert( leakOffMetrics.sampling.leakReductionMode === 'off',
		'leak setter: expected off sampling mode.' );
	assert( leakOffMetrics.sampling.weightedProbeSampling === false,
		'leak setter: expected off mode to disable weighted sampling.' );

	await startOperation( 'setLeakReductionMode', 'normal' );
	await waitUntilReady( 'leak reduction normal' );
	const leakNormalMetrics = await capture( 'leak reduction normal' );
	assert( leakNormalMetrics.sampling.leakReductionMode === 'normal',
		'leak setter: expected normal sampling mode.' );
	assert( leakNormalMetrics.sampling.weightedProbeSampling === true,
		'leak setter: expected normal mode to enable weighted sampling.' );

	const bakeCoalescing = await call( 'testBakeCoalescing' );
	assert( bakeCoalescing.samePromise === true, 'bake contract: expected overlapping bake calls to share the same promise.' );
	assert( Number.isFinite( bakeCoalescing.timings.totalBakeMs ), 'bake contract: expected finite coalesced bake timing.' );
	results.push( { step: 'bake coalescing', bakeCoalescing } );

	const benchmark = await call( 'runBenchmarkCase', {
		resolution: 2,
		cubemapSize: 8,
		projectionPrecision: 'half float'
	} );
	assert( benchmark.probes === 8, 'benchmark: expected probe count metadata.' );
	assert( [ 'compute-probe-reduction', 'fragment-coefficient-projection' ].includes( benchmark.backend.projection ),
		'benchmark: expected guarded compute projection backend or fragment fallback label.' );
	assert( [ 'compute-probe-reduction', 'fragment-coefficient-projection' ].includes( benchmark.projectionBackend ),
		'benchmark: expected timing metadata to report guarded compute projection backend or fragment fallback.' );
	assert( benchmark.backend.atlas === 'render-pass', 'benchmark: expected render-pass atlas backend label.' );
	assert( benchmark.backend.update === 'full', 'benchmark: expected full update backend label.' );
	assert( benchmark.estimatedGpuBytes.total > 0, 'benchmark: expected positive GPU memory estimate.' );
	assert( benchmark.estimatedGpuBytes.cubemapBytes > 0, 'benchmark: expected cubemap memory estimate.' );
	assert( benchmark.estimatedGpuBytes.coefficientBytes > 0, 'benchmark: expected coefficient memory estimate.' );
	assert( benchmark.estimatedGpuBytes.atlasBytes > 0, 'benchmark: expected atlas memory estimate.' );
	assert( benchmark.estimatedGpuBytes.probeValidityBytes > 0, 'benchmark: expected probe validity memory estimate.' );
	assert( benchmark.visibilityDepth?.available === true &&
		benchmark.visibilityDepth?.mode === 'moments' &&
		benchmark.visibilityDepth?.bytes > 0,
	'benchmark: expected private moment-backed visibility/depth metadata.' );
	assert( benchmark.precision.requestedPrecision === 'half float', 'benchmark: expected requested precision metadata.' );
	assert( Number.isFinite( benchmark.totalBakeMs ) &&
		benchmark.totalBakeMs > 0 &&
		benchmark.timingSource !== 'unavailable',
	'benchmark: expected positive total bake timing with a known timing source.' );
	assert( [ 'gpu-timestamp', 'performance.now diagnostic', 'unavailable' ].includes( benchmark.timingSourceKind ),
		'benchmark: expected explicit timing source kind.' );
	assert( [ 'gpu-timestamp', 'unavailable' ].includes( benchmark.gpuTimestampStatus ),
		'benchmark: expected explicit GPU timestamp status.' );
	assert( Number.isFinite( benchmark.cubemapMs ), 'benchmark: expected finite cubemap timing.' );
	assert( Number.isFinite( benchmark.projectionMs ), 'benchmark: expected finite projection timing.' );
	assert( Number.isFinite( benchmark.copyMs ), 'benchmark: expected finite copy timing.' );
	assert( benchmark.timingBuckets !== undefined &&
		benchmark.timingBuckets.source === benchmark.timingSourceKind &&
		Number.isFinite( benchmark.timingBuckets.sceneUpdateMs ) &&
		Number.isFinite( benchmark.timingBuckets.radianceCubemapCaptureMs ) &&
		Number.isFinite( benchmark.timingBuckets.distanceCubemapCaptureMs ) &&
		Number.isFinite( benchmark.timingBuckets.computeShProjectionMs ) &&
		Number.isFinite( benchmark.timingBuckets.visibilityRepackMs ) &&
		Number.isFinite( benchmark.timingBuckets.atlasRepackMs ) &&
		benchmark.timingBuckets.verifierReadbackTimingSource === 'unavailable',
	'benchmark: expected honest proof-only timing buckets with readback/runtime timing marked unavailable.' );
	assert( Number.isFinite( benchmark.frameMs ), 'benchmark: expected finite frame timing.' );
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

	results.push( {
		step: 'probes only color sanity',
		metrics: rebakeMetrics,
		colorSanity
	} );

	return results;

}
