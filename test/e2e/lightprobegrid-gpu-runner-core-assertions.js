const hasNoFields = ( object, ...fields ) => fields.every( field => object[ field ] === undefined );

const hasProjectionParityContractFacts = contract =>
	hasNoFields( contract,
		'status',
		'previousStatus',
		'runtimeStatusRequired',
		'runtimeParityReadbackStatus',
		'runtimePathIntroduced',
		'runtimeMarkersAllowed',
		'candidatePlanningAllowed',
		'publicApiChangeAllowed',
		'requiredGateCount',
		'requiredGates',
		'requiredPromotionEvidence',
		'currentCoefficientWritesPerProbe',
		'proposedCoefficientWritesPerProbe'
	) &&
	contract.currentPath === 'fragment-coefficient-projection' &&
	contract.proposedPath === 'compute-probe-reduction' &&
	contract.currentCubemapSweepsPerProbe === 9 &&
	contract.proposedCubemapSweepsPerProbe === 1 &&
	contract.fallbackPath === 'fragment-coefficient-projection' &&
	contract.tolerance === 0.0001;

const hasComputeProjectionCandidateFacts = oracle =>
	hasNoFields( oracle,
		'status',
		'runtimePathIntroduced',
		'baselinePath',
		'candidatePath',
		'fixtures',
		'fragmentCoefficientProjectionSweepsPerProbe',
		'computeProbeReductionSweepsPerProbe'
	) &&
	oracle.baselineCubemapSweepsPerProbe === 9 &&
	oracle.candidateCubemapSweepsPerProbe === 1 &&
	oracle.fixtureCount >= 3 &&
	oracle.failedFixtureCount === 0 &&
	oracle.maxCandidateToFragmentDelta <= oracle.tolerance;

const hasComputeProjectionAdapterFallbackFacts = oracle =>
	hasNoFields( oracle,
		'status',
		'runtimePathIntroduced',
		'publicApiChanged',
		'defaultPath',
		'candidatePath',
		'requiredCapabilities',
		'promotionEffect',
		'scenarios'
	) &&
	oracle.scenarioCount === 3 &&
	oracle.computeSelectedScenarioCount === 1 &&
	oracle.fallbackScenarioCount === 2 &&
	oracle.unsupportedComputeFallbackCount === 1 &&
	oracle.unsupportedStorageTextureFallbackCount === 1;

const hasComputeProjectionAtlasRepackFacts = ( oracle, atlasPacking ) =>
	hasNoFields( oracle,
		'status',
		'runtimePathIntroduced',
		'sourcePath',
		'repackPath',
		'adapterFallbackEvidenceRequired',
		'openEvidenceAfterPass',
		'promotionEffect',
		'checkedLayers'
	) &&
	oracle.maxReadbackDelta === atlasPacking.maxReadbackDelta &&
	oracle.maxReadbackDelta < oracle.readbackTolerance;

const hasComputeProjectionRuntimeParityFacts = parity =>
	hasNoFields( parity,
		'status',
		'statusTransition',
		'runtimePathIntroduced',
		'baselinePath',
		'candidatePath',
		'coefficientPass',
		'atlasPass',
		'tolerancePass',
		'atlasChecks',
		'staticWork',
		'fragmentTimings',
		'computeTimings'
	) &&
	parity.fragmentBackend === 'fragment-coefficient-projection' &&
	parity.computeFallbackReason !== 'Cannot read properties of null (reading \'environment\')';

const hasComputeProjectionRuntimeParitySupportFacts = parity =>
	parity.computeBackend === 'compute-probe-reduction' &&
	parity.computeFallbackReason === null &&
	parity.coefficientMaxDelta <= parity.coefficientTolerance &&
	parity.coefficientReadbackPixels === 9 * parity.totalProbes &&
	parity.atlasMaxDelta <= parity.atlasTolerance &&
	parity.atlasCheckCount >= 7 &&
	parity.atlasFailedCheckCount === 0;

const hasComputeProjectionProfilingFacts = profiling =>
	hasNoFields( profiling,
		'status',
		'timingPolicy',
		'timingGated',
		'gpuTimerQueryStatus',
		'projectionPhaseTimingStatus'
	) &&
	profiling.projectionTimingSources.includes( 'non-deterministic-performance-now' ) &&
	profiling.staticWork.fragmentCubemapSweepsPerProbe === 9 &&
	profiling.staticWork.computeCubemapSweepsPerProbe === 1 &&
	profiling.staticWork.fragmentTexelVisits === 6912 &&
	profiling.staticWork.computeTexelVisits === 768 &&
	profiling.staticWork.savedTexelVisits === 6144 &&
	profiling.staticWork.reductionPercent === 88.8889;

const hasProjectionProfilingBackendFacts = profiling =>
	hasNoFields( profiling.fragment,
		'requestedBackend',
		'allRunsSelectedExpectedBackend',
		'expectedBackendMismatchCount'
	) &&
	profiling.fragment.fragmentBackendCount === profiling.fragment.measuredRunCount &&
	profiling.fragment.computeBackendCount === 0 &&
	hasNoFields( profiling.compute,
		'requestedBackend',
		'allRunsSelectedExpectedBackend',
		'expectedBackendMismatchCount',
		'fallbackReasons',
		'fallbackReasonCount'
	) &&
	profiling.compute.computeBackendCount === profiling.compute.measuredRunCount &&
	profiling.compute.fragmentBackendCount === 0 &&
	profiling.compute.fallbackRunCount === 0;

const hasCompactProjectionTimingFacts = profiling => {

	const compactProjectionTimingFields = [ 'samples', 'min', 'average', 'p95', 'max' ];

	return Number.isFinite( profiling.fragment.projectionMs.median ) &&
		Number.isFinite( profiling.compute.projectionMs.median ) &&
		hasNoFields( profiling.fragment.projectionMs, ...compactProjectionTimingFields ) &&
		hasNoFields( profiling.compute.projectionMs, ...compactProjectionTimingFields ) &&
		profiling.fragment.measuredRunCount === profiling.measuredRuns &&
		profiling.compute.measuredRunCount === profiling.measuredRuns &&
		! ( 'measuredRuns' in profiling.fragment ) &&
		! ( 'measuredRuns' in profiling.compute );

};

export async function runLightProbeGridGpuCoreSmokeAssertions( context ) {

	const { call, assert, results } = context;

	const contract = await call( 'inspectAddonContract' );
	assert( contract.isObject3D === true, 'contract: expected Object3D instance flag.' );
	assert( contract.isLightProbeGrid === true, 'contract: expected light probe grid flag.' );
	assert( contract.type === 'LightProbeGridGPU', 'contract: expected LightProbeGridGPU type.' );
	assert( contract.hasTextureBeforeDispose === true, 'contract: expected texture before dispose.' );
	assert( contract.hasHelperBeforeDispose === true, 'contract: expected helper before dispose.' );
	assert( contract.hasTextureAfterDispose === false, 'contract: expected texture to clear after dispose.' );
	assert( contract.hasHelperAfterDispose === false, 'contract: expected helper to clear after dispose.' );
	assert( contract.hasAtlasTargetAfterDispose === false, 'contract: expected atlas target to clear after dispose.' );
	assert( contract.boundingBoxMin.x === - 1 &&
		contract.boundingBoxMin.y === - 2 &&
		contract.boundingBoxMin.z === - 3 &&
		contract.boundingBoxMax.x === 4 &&
		contract.boundingBoxMax.y === 5 &&
		contract.boundingBoxMax.z === 6,
	'contract: expected constructor min/max to define bounding box.' );
	results.push( { step: 'addon contract', contract } );

	const probePositions = await call( 'inspectProbePositions' );
	assert( probePositions.first.x === - 1 &&
		probePositions.first.y === - 2 &&
		probePositions.first.z === - 3,
	'probe positions: expected first probe to map to min.' );
	assert( probePositions.last.x === 4 &&
		probePositions.last.y === 5 &&
		probePositions.last.z === 6,
	'probe positions: expected final probe to map to max.' );
	assert( probePositions.invalidConstructorResolutionRejected === true, 'probe positions: expected constructor resolution below 2 to be rejected.' );
	assert( /resolution/.test( probePositions.invalidConstructorResolutionMessage ), 'probe positions: expected constructor resolution validation error message.' );
	assert( probePositions.invalidSetOptionsResolutionRejected === true, 'probe positions: expected setOptions resolution below 2 to be rejected.' );
	assert( /resolution/.test( probePositions.invalidSetOptionsResolutionMessage ), 'probe positions: expected setOptions resolution validation error message.' );
	results.push( { step: 'probe positions', probePositions } );

	const samplingControls = await call( 'inspectSamplingControls' );
	assert( samplingControls.defaultSampling.quality === 'fast' &&
		samplingControls.defaultSampling.leakReductionMode === 'off',
	'sampling controls: expected class default to preserve fast unweighted sampling.' );
	assert( samplingControls.defaultSampling.probeMeta.receiverBoundaryLayerMaskDefault === 'receiverLayerMask' &&
		samplingControls.defaultSampling.probeMeta.receiverBoundaryWeightDefault === 0 &&
		samplingControls.defaultSampling.probeMeta.receiverBoundarySelector === 'receiverBoundaryWeight >= 0.5',
	'sampling controls: expected absent receiver-boundary metadata to preserve the receiver mask path.' );
	assert( samplingControls.configuredSampling.normalBias === 0.75 &&
		samplingControls.configuredSampling.viewBias === 0.25 &&
		samplingControls.configuredSampling.quality === 'guarded' &&
		samplingControls.configuredSampling.leakReductionMode === 'normal' &&
		samplingControls.configuredSampling.probeValidityMode === 'custom' &&
		samplingControls.configuredSampling.probeMeta.probeLayerMaskMode === 'custom' &&
		samplingControls.configuredSampling.invalidProbeCount === 1 &&
		samplingControls.configuredSampling.weightedProbeSampling === true,
	'sampling controls: expected configured bias and leak reduction metadata.' );
	assert( samplingControls.invalidLeakReductionModeRejected === true,
		'sampling controls: expected invalid leak reduction mode to be rejected.' );
	assert( /leakReductionMode/.test( samplingControls.invalidLeakReductionModeMessage ),
		'sampling controls: expected leak reduction validation error message.' );
	assert( samplingControls.invalidProbeLayerMasksRejected === true,
		'sampling controls: expected invalid probe layer masks to be rejected.' );
	assert( /probeLayerMasks/.test( samplingControls.invalidProbeLayerMasksMessage ),
		'sampling controls: expected probe layer mask validation error message.' );
	results.push( { step: 'sampling controls', samplingControls } );

	const leakReductionComparison = await call( 'compareLeakReductionModes' );
	assert( leakReductionComparison.off.weightedProbeSampling === false,
		'leak comparison: expected off mode to use unweighted sampling.' );
	assert( leakReductionComparison.normal.weightedProbeSampling === true,
		'leak comparison: expected normal mode to use weighted sampling.' );
	assert( leakReductionComparison.off.centerEnergy > 18,
		'leak comparison: expected off mode to remain visible.' );
	assert( leakReductionComparison.normal.centerEnergy > 18,
		'leak comparison: expected normal mode to remain visible.' );
	results.push( { step: 'leak reduction comparison', leakReductionComparison } );

	const projectionParity = await call( 'inspectProjectionParity' );
	assert( projectionParity.fixtureCount >= 3 && projectionParity.fixtures === undefined,
		'projection parity: expected compact synthetic cubemap fixture count.' );
	assert( projectionParity.maxShaderToGeneratorDelta < 1e-9,
		'projection parity: expected WebGPU shader mapping to match LightProbeGenerator WebGPU render-target convention.' );
	assert( projectionParity.maxWebGLGridToGeneratorDelta < 1e-9,
		'projection parity: expected WebGL LightProbeGrid mapping to match LightProbeGenerator WebGL render-target convention.' );
	assert( projectionParity.maxShaderToCubeTextureDelta < 1e-9,
		'projection parity: expected WebGPU shader mapping to match CubeTexture convention for synthetic face data.' );
	assert( projectionParity.maxShaderToWebGLGridDelta > 1e-3,
		'projection parity: expected asymmetric fixture to prove WebGPU and WebGL render-target conventions are not directly interchangeable.' );
	const computeProjectionParityContract = projectionParity.computeProjectionParityContract;
	assert( hasProjectionParityContractFacts( computeProjectionParityContract ),
		'projection parity: expected compute projection runtime contract to expose raw guard facts without promotion policy payload.' );
	const computeProjectionCandidateOracle = projectionParity.computeProjectionCandidateOracle;
	assert( hasComputeProjectionCandidateFacts( computeProjectionCandidateOracle ),
		'projection parity: expected proof-only compute candidate facts to match fragment coefficient projection without introducing runtime.' );
	const computeProjectionAdapterFallbackOracle = projectionParity.computeProjectionAdapterFallbackOracle;
	assert( computeProjectionCandidateOracle.promotionEffect === undefined &&
		hasComputeProjectionAdapterFallbackFacts( computeProjectionAdapterFallbackOracle ),
	'projection parity: expected adapter fallback facts to select compute only for implemented runtime with capabilities, otherwise fragment fallback.' );
	results.push( { step: 'projection parity', projectionParity } );

	const shMathContract = await call( 'inspectSHMathContract' );
	assert( hasNoFields( shMathContract, 'basis', 'projectionNormalization', 'irradianceConvolution' ) &&
		hasNoFields( shMathContract.constantRadiance, 'expected', 'samples' ) &&
		shMathContract.constantRadiance.maxDelta < 0.0001,
	'sh math contract: expected compact constant-radiance facts to prove pi-scaled irradiance.' );
	assert( hasNoFields( shMathContract, 'axisResponse', 'axisDominance' ) &&
		shMathContract.axisDeltas.positiveXRedMinusNegativeX > 0 &&
		shMathContract.axisDeltas.positiveYGreenMinusNegativeY > 0 &&
		shMathContract.axisDeltas.positiveZBlueMinusNegativeZ > 0,
	'sh math contract: expected compact directional RGB deltas to preserve x/y/z coefficient signs.' );
	assert( shMathContract.threeJsIrradianceParity.available === true &&
		hasNoFields( shMathContract.threeJsIrradianceParity, 'supported' ) &&
		shMathContract.threeJsIrradianceParity.maxDelta < 1e-9,
	'sh math contract: expected runtime irradiance constants/order to match THREE.SphericalHarmonics3.getIrradianceAt() without local support verdict echoes.' );
	results.push( { step: 'sh math contract', shMathContract } );

	const atlasPacking = await call( 'inspectAtlasPacking' );
	assert( atlasPacking.resolution === 4 &&
		atlasPacking.totalProbes === 64 &&
		atlasPacking.shCoefficientCount === 9,
	'atlas packing: expected bounded synthetic 4x4x4 probe fixture.' );
	assert( atlasPacking.packedAtlasTextureCount === 7 &&
		atlasPacking.paddedSlices === 6 &&
		atlasPacking.atlasPadding === 1 &&
		atlasPacking.atlasDepth === 42,
	'atlas packing: expected seven SH sub-volumes with one padding slice on each side.' );
	assert( hasNoFields( atlasPacking, 'gridProbeIndexFormula' ),
		'atlas packing: expected probe index formula prose to stay out of the harness payload.' );
	assert( hasNoFields( atlasPacking, 'addressChecks' ) &&
		atlasPacking.addressCheckCount === 6 &&
		atlasPacking.addressMismatchCount === 0 &&
		atlasPacking.centerSampleZOutOfRangeCount === 0,
	'atlas packing: expected address helper formulas to match CPU atlas layout.' );
	assert( hasNoFields( atlasPacking, 'coefficientPacking' ) &&
		atlasPacking.packedCoefficientSlots === 27 &&
		atlasPacking.validitySlot.textureIndex === 6 &&
		atlasPacking.validitySlot.channelIndex === 3,
	'atlas packing: expected 27 SH channels plus validity in the final packed atlas channel.' );
	assert( hasNoFields( atlasPacking, 'readbackChecks', 'paddingChecks' ) &&
		atlasPacking.readbackCheckCount === 4 &&
		atlasPacking.paddingCheckCount === 3,
	'atlas packing: expected render-path readbacks for data and padding layers.' );
	assert( atlasPacking.nativeYOrientation.y0ProbeIndex === 0,
		'atlas packing: expected native texture y=0 to contain grid y=0, not an upside-down row.' );
	assert( atlasPacking.nativeYOrientation.y3ProbeIndex === 13,
		'atlas packing: expected native texture y=3 to contain grid y=3.' );
	assert( atlasPacking.maxReadbackDelta < 0.008,
		`atlas packing: expected synthetic render-path readback to match packed SH layout, got ${ atlasPacking.maxReadbackDelta }.` );
	const computeProjectionAtlasRepackOracle = atlasPacking.computeProjectionAtlasRepackOracle;
	assert( hasComputeProjectionAtlasRepackFacts( computeProjectionAtlasRepackOracle, atlasPacking ),
		'atlas packing: expected proof-only compute-written rows to expose raw atlas repack facts without runtime promotion policy payload.' );
	assert( Number.isFinite( atlasPacking.validityDelta ) &&
		hasNoFields( atlasPacking, 'validityExpected', 'validityActual' ) &&
		atlasPacking.validityDelta < 0.008,
	'atlas packing: expected custom probe validity to survive coefficient-atlas repack.' );
	results.push( { step: 'atlas packing', atlasPacking } );

	const computeProjectionRuntimeParity = await call( 'inspectComputeProjectionRuntimeParity' );
	assert( hasComputeProjectionRuntimeParityFacts( computeProjectionRuntimeParity ),
		'compute projection runtime parity: expected raw guarded runtime parity evidence without local status payload.' );
	const runtimeParityPass = hasComputeProjectionRuntimeParitySupportFacts( computeProjectionRuntimeParity );

	if ( runtimeParityPass === true ) {

		assert( runtimeParityPass === true,
			'compute projection runtime parity: expected runner-derived tolerance validation to authorize gate support.' );

	} else {

		assert( computeProjectionRuntimeParity.computeBackend === 'fragment-coefficient-projection' ||
			runtimeParityPass === false,
		'compute projection runtime parity: expected open evidence to keep full parity promotion blocked.' );

	}

	results.push( { step: 'compute projection runtime parity', computeProjectionRuntimeParity } );

	const computeProjectionProfiling = await call( 'inspectComputeProjectionProfiling' );
	assert( hasComputeProjectionProfilingFacts( computeProjectionProfiling ),
		'compute projection profiling: expected raw projection timing sources without diagnostic status/policy payload.' );
	assert( hasProjectionProfilingBackendFacts( computeProjectionProfiling ),
		'compute projection profiling: expected forced fragment/compute profiling selectors to choose the requested private backends without fallback.' );
	assert( hasCompactProjectionTimingFacts( computeProjectionProfiling ),
		'compute projection profiling: expected finite projection timing medians without timing sample/range payloads and compact measured run counts for both backends.' );
	results.push( { step: 'compute projection profiling', computeProjectionProfiling } );


}
