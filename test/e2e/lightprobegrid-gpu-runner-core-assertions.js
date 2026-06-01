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
	assert( samplingControls.defaultSampling.leakReductionMode === 'off',
		'sampling controls: expected class default to preserve unweighted sampling.' );
	assert( samplingControls.configuredSampling.normalBias === 0.75 &&
		samplingControls.configuredSampling.viewBias === 0.25 &&
		samplingControls.configuredSampling.leakReductionMode === 'normal' &&
		samplingControls.configuredSampling.probeValidityMode === 'custom' &&
		samplingControls.configuredSampling.invalidProbeCount === 1 &&
		samplingControls.configuredSampling.weightedProbeSampling === true,
	'sampling controls: expected configured bias and leak reduction metadata.' );
	assert( samplingControls.invalidLeakReductionModeRejected === true,
		'sampling controls: expected invalid leak reduction mode to be rejected.' );
	assert( /leakReductionMode/.test( samplingControls.invalidLeakReductionModeMessage ),
		'sampling controls: expected leak reduction validation error message.' );
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
	assert( Array.isArray( projectionParity.fixtures ) && projectionParity.fixtures.length >= 3,
		'projection parity: expected synthetic cubemap fixtures.' );
	assert( projectionParity.maxShaderToGeneratorDelta < 1e-9,
		'projection parity: expected WebGPU shader mapping to match LightProbeGenerator WebGPU render-target convention.' );
	assert( projectionParity.maxWebGLGridToGeneratorDelta < 1e-9,
		'projection parity: expected WebGL LightProbeGrid mapping to match LightProbeGenerator WebGL render-target convention.' );
	assert( projectionParity.maxShaderToCubeTextureDelta < 1e-9,
		'projection parity: expected WebGPU shader mapping to match CubeTexture convention for synthetic face data.' );
	assert( projectionParity.maxShaderToWebGLGridDelta > 1e-3,
		'projection parity: expected asymmetric fixture to prove WebGPU and WebGL render-target conventions are not directly interchangeable.' );
	assert( projectionParity.computeProjectionParityContract?.status === undefined &&
		projectionParity.computeProjectionParityContract.previousStatus === undefined &&
		projectionParity.computeProjectionParityContract.runtimeStatusRequired === undefined &&
		projectionParity.computeProjectionParityContract.runtimeParityReadbackStatus === undefined &&
		projectionParity.computeProjectionParityContract.currentPath === 'fragment-coefficient-projection' &&
		projectionParity.computeProjectionParityContract.proposedPath === 'compute-probe-reduction' &&
		projectionParity.computeProjectionParityContract.candidatePlanningAllowed === true &&
		projectionParity.computeProjectionParityContract.runtimePathIntroduced === true &&
		projectionParity.computeProjectionParityContract.runtimeMarkersAllowed === true &&
		projectionParity.computeProjectionParityContract.publicApiChangeAllowed === false &&
		projectionParity.computeProjectionParityContract.currentCubemapSweepsPerProbe === 9 &&
		projectionParity.computeProjectionParityContract.proposedCubemapSweepsPerProbe === 1 &&
		projectionParity.computeProjectionParityContract.fallbackPath === 'fragment-coefficient-projection' &&
		projectionParity.computeProjectionParityContract.requiredGates.length >= 3 &&
		projectionParity.computeProjectionParityContract.requiredPromotionEvidence?.status === undefined &&
		projectionParity.computeProjectionParityContract.requiredPromotionEvidence.statusTransition === undefined &&
		projectionParity.computeProjectionParityContract.requiredPromotionEvidence.syntheticFixtureParity.baseline === 'fragment-coefficient-projection' &&
		projectionParity.computeProjectionParityContract.requiredPromotionEvidence.syntheticFixtureParity.candidate === 'compute-probe-reduction' &&
		projectionParity.computeProjectionParityContract.requiredPromotionEvidence.syntheticFixtureParity.maxCoefficientDelta === 0.0001 &&
		projectionParity.computeProjectionParityContract.requiredPromotionEvidence.atlasRepackParity.baseline === 'inspectAtlasPacking' &&
		projectionParity.computeProjectionParityContract.requiredPromotionEvidence.adapterFallbackEvidence.unsupportedAdapterPath === 'fragment-coefficient-projection',
	'projection parity: expected compute projection runtime contract to expose raw guard and promotion evidence without local status payload.' );
	assert( projectionParity.computeProjectionCandidateOracle?.status === undefined &&
		projectionParity.computeProjectionCandidateOracle.runtimePathIntroduced === false &&
		projectionParity.computeProjectionCandidateOracle.baselinePath === 'fragment-coefficient-projection' &&
		projectionParity.computeProjectionCandidateOracle.candidatePath === 'compute-probe-reduction' &&
		projectionParity.computeProjectionCandidateOracle.baselineCubemapSweepsPerProbe === 9 &&
		projectionParity.computeProjectionCandidateOracle.candidateCubemapSweepsPerProbe === 1 &&
		projectionParity.computeProjectionCandidateOracle.maxCandidateToFragmentDelta <= projectionParity.computeProjectionCandidateOracle.tolerance &&
		projectionParity.computeProjectionCandidateOracle.fixtures.length >= 3 &&
		projectionParity.computeProjectionCandidateOracle.fixtures.every( fixture => fixture.candidateToFragmentDelta <= projectionParity.computeProjectionCandidateOracle.tolerance ),
	'projection parity: expected proof-only compute candidate facts to match fragment coefficient projection without introducing runtime.' );
	assert( projectionParity.computeProjectionAdapterFallbackOracle?.status === undefined &&
		projectionParity.computeProjectionAdapterFallbackOracle.runtimePathIntroduced === true &&
		projectionParity.computeProjectionAdapterFallbackOracle.publicApiChanged === false &&
		projectionParity.computeProjectionAdapterFallbackOracle.defaultPath === 'fragment-coefficient-projection' &&
		projectionParity.computeProjectionAdapterFallbackOracle.candidatePath === 'compute-probe-reduction' &&
		projectionParity.computeProjectionAdapterFallbackOracle.scenarios.some( scenario =>
			scenario.label === 'runtime-implemented-adapter-supported' &&
			scenario.runtimeGuardedImplementationPresent === true &&
			scenario.selectedPath === 'compute-probe-reduction' &&
			scenario.fallbackUsed === false
		) &&
		projectionParity.computeProjectionAdapterFallbackOracle.scenarios.some( scenario =>
			scenario.label === 'unsupported-compute-capability' &&
			scenario.selectedPath === 'fragment-coefficient-projection' &&
			scenario.fallbackUsed === true
		) &&
		projectionParity.computeProjectionAdapterFallbackOracle.scenarios.some( scenario =>
			scenario.label === 'unsupported-storage-texture-capability' &&
			scenario.selectedPath === 'fragment-coefficient-projection' &&
			scenario.fallbackUsed === true
		) &&
		projectionParity.computeProjectionAdapterFallbackOracle.scenarios.some( scenario =>
			scenario.label === 'promoted-supported-candidate' &&
			scenario.selectedPath === 'compute-probe-reduction' &&
			scenario.fallbackUsed === false
		),
	'projection parity: expected adapter fallback facts to select compute only for implemented runtime with capabilities, otherwise fragment fallback.' );
	results.push( { step: 'projection parity', projectionParity } );

	const shMathContract = await call( 'inspectSHMathContract' );
	assert( shMathContract.constantRadiance.maxDelta < 0.0001,
		'sh math contract: expected constant radiance to evaluate to pi-scaled irradiance.' );
	assert( shMathContract.axisDominance.positiveXRedBeatsNegativeX === true &&
		shMathContract.axisDominance.positiveYGreenBeatsNegativeY === true &&
		shMathContract.axisDominance.positiveZBlueBeatsNegativeZ === true,
	'sh math contract: expected directional RGB fixture to preserve x/y/z coefficient signs.' );
	assert( shMathContract.threeJsIrradianceParity.supported === true &&
		shMathContract.threeJsIrradianceParity.maxDelta < 1e-9,
	'sh math contract: expected runtime irradiance constants/order to match THREE.SphericalHarmonics3.getIrradianceAt().' );
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
	assert( atlasPacking.gridProbeIndexFormula === 'x + y * resolution + z * resolution^2',
		'atlas packing: expected explicit probe index formula.' );
	assert( Array.isArray( atlasPacking.addressChecks ) &&
		atlasPacking.addressChecks.length === 6 &&
		atlasPacking.addressChecks.every( check =>
			check.baseLayer === check.methodBaseLayer &&
			check.dataLayer === check.methodDataLayer &&
			check.leadingPaddingLayer === check.methodLeadingPaddingLayer &&
			check.trailingPaddingLayer === check.methodTrailingPaddingLayer &&
			Number.isFinite( check.centerSampleZ ) &&
			check.centerSampleZ > 0 &&
			check.centerSampleZ < 1 ),
	'atlas packing: expected address helper formulas to match CPU atlas layout.' );
	assert( Array.isArray( atlasPacking.coefficientPacking ) &&
		atlasPacking.coefficientPacking.length === 7 &&
		atlasPacking.coefficientPacking.every( row => Array.isArray( row ) && row.length === 4 ) &&
		atlasPacking.coefficientPacking[ 6 ][ 3 ].value === 'validity',
	'atlas packing: expected 27 SH channels plus validity in the final packed atlas channel.' );
	assert( Array.isArray( atlasPacking.readbackChecks ) &&
		atlasPacking.readbackChecks.length === 4 &&
		Array.isArray( atlasPacking.paddingChecks ) &&
		atlasPacking.paddingChecks.length === 3,
	'atlas packing: expected render-path readbacks for data and padding layers.' );
	assert( atlasPacking.readbackChecks.some( check =>
		check.label === 'origin-y0-z0-t0' &&
		check.probeIndex === 0 &&
		check.x === 0 &&
		check.y === 0 ),
	'atlas packing: expected native texture y=0 to contain grid y=0, not an upside-down row.' );
	assert( atlasPacking.readbackChecks.some( check =>
		check.label === 'native-y3-z0-t0' &&
		check.probeIndex === 13 &&
		check.x === 1 &&
		check.y === 3 ),
	'atlas packing: expected native texture y=3 to contain grid y=3.' );
	assert( atlasPacking.maxReadbackDelta < 0.008,
		`atlas packing: expected synthetic render-path readback to match packed SH layout, got ${ atlasPacking.maxReadbackDelta }.` );
	assert( atlasPacking.computeProjectionAtlasRepackOracle?.status === undefined &&
		atlasPacking.computeProjectionAtlasRepackOracle.runtimePathIntroduced === false &&
		atlasPacking.computeProjectionAtlasRepackOracle.sourcePath === 'compute-written coefficientTarget-compatible rows' &&
		atlasPacking.computeProjectionAtlasRepackOracle.repackPath === '_repackAtlas' &&
		atlasPacking.computeProjectionAtlasRepackOracle.maxReadbackDelta === atlasPacking.maxReadbackDelta &&
		atlasPacking.computeProjectionAtlasRepackOracle.maxReadbackDelta < atlasPacking.computeProjectionAtlasRepackOracle.readbackTolerance &&
		atlasPacking.computeProjectionAtlasRepackOracle.openEvidenceAfterPass.includes( 'compute-adapter-fallback' ),
	'atlas packing: expected proof-only compute-written rows to survive existing atlas repack without runtime promotion.' );
	assert( Number.isFinite( atlasPacking.validityActual ) &&
		Math.abs( atlasPacking.validityActual - atlasPacking.validityExpected ) < 0.008,
	'atlas packing: expected custom probe validity to survive coefficient-atlas repack.' );
	results.push( { step: 'atlas packing', atlasPacking } );

	const computeProjectionRuntimeParity = await call( 'inspectComputeProjectionRuntimeParity' );
	assert( computeProjectionRuntimeParity.status === undefined &&
		computeProjectionRuntimeParity.statusTransition === undefined &&
		computeProjectionRuntimeParity.runtimePathIntroduced === true &&
		computeProjectionRuntimeParity.baselinePath === 'fragment-coefficient-projection' &&
		computeProjectionRuntimeParity.candidatePath === 'compute-probe-reduction' &&
		computeProjectionRuntimeParity.fragmentBackend === 'fragment-coefficient-projection',
	'compute projection runtime parity: expected raw guarded runtime parity evidence without local status payload.' );
	assert( computeProjectionRuntimeParity.computeFallbackReason !== "Cannot read properties of null (reading 'environment')",
	'compute projection runtime parity: compute candidate must not regress to the null scene/material environment fallback.' );
	if ( computeProjectionRuntimeParity.tolerancePass === true ) {

		assert( computeProjectionRuntimeParity.computeBackend === 'compute-probe-reduction' &&
			computeProjectionRuntimeParity.computeFallbackReason === null,
		'compute projection runtime parity: expected passing evidence to run the compute backend without fallback.' );
		assert( computeProjectionRuntimeParity.coefficientPass === true &&
			computeProjectionRuntimeParity.coefficientMaxDelta <= computeProjectionRuntimeParity.coefficientTolerance &&
			computeProjectionRuntimeParity.coefficientReadbackPixels === 9 * computeProjectionRuntimeParity.totalProbes,
		`compute projection runtime parity: expected compute coefficients to match fragment coefficients within tolerance, got ${ computeProjectionRuntimeParity.coefficientMaxDelta }.` );
		assert( computeProjectionRuntimeParity.atlasPass === true &&
			computeProjectionRuntimeParity.atlasMaxDelta <= computeProjectionRuntimeParity.atlasTolerance &&
			Array.isArray( computeProjectionRuntimeParity.atlasChecks ) &&
			computeProjectionRuntimeParity.atlasChecks.length >= 7 &&
			computeProjectionRuntimeParity.atlasChecks.every( check => check.pass === true ),
		`compute projection runtime parity: expected compute atlas repack to match fragment atlas within tolerance, got ${ computeProjectionRuntimeParity.atlasMaxDelta }.` );
		assert( computeProjectionRuntimeParity.tolerancePass === true,
		'compute projection runtime parity: expected tolerance validation to authorize gate support.' );

	} else {

		assert( computeProjectionRuntimeParity.computeBackend === 'fragment-coefficient-projection' ||
			computeProjectionRuntimeParity.tolerancePass === false,
		'compute projection runtime parity: expected open evidence to keep full parity promotion blocked.' );

	}
	results.push( { step: 'compute projection runtime parity', computeProjectionRuntimeParity } );

	const computeProjectionProfiling = await call( 'inspectComputeProjectionProfiling' );
	assert( computeProjectionProfiling.status === undefined &&
		computeProjectionProfiling.timingPolicy === undefined &&
		computeProjectionProfiling.timingGated === undefined &&
		computeProjectionProfiling.gpuTimerQueryStatus === undefined &&
		computeProjectionProfiling.projectionPhaseTimingStatus === undefined &&
		computeProjectionProfiling.projectionTimingSources.includes( 'non-deterministic-performance-now' ),
	'compute projection profiling: expected raw projection timing sources without diagnostic status/policy payload.' );
	assert( computeProjectionProfiling.staticWork.fragmentCubemapSweepsPerProbe === 9 &&
		computeProjectionProfiling.staticWork.computeCubemapSweepsPerProbe === 1 &&
		computeProjectionProfiling.staticWork.fragmentTexelVisits === 6912 &&
		computeProjectionProfiling.staticWork.computeTexelVisits === 768 &&
		computeProjectionProfiling.staticWork.savedTexelVisits === 6144 &&
		computeProjectionProfiling.staticWork.reductionPercent === 88.8889,
	'compute projection profiling: expected static work evidence to show 9 sweeps/probe to 1 sweep/probe for the bounded runtime profiling fixture.' );
	assert( computeProjectionProfiling.fragment.requestedBackend === 'force-fragment' &&
		computeProjectionProfiling.fragment.allRunsSelectedExpectedBackend === true &&
		computeProjectionProfiling.compute.requestedBackend === 'force-compute' &&
		computeProjectionProfiling.compute.allRunsSelectedExpectedBackend === true &&
		computeProjectionProfiling.compute.fallbackReasons.length === 0,
	'compute projection profiling: expected forced fragment/compute profiling selectors to choose the requested private backends without fallback.' );
	assert( Number.isFinite( computeProjectionProfiling.fragment.projectionMs.median ) &&
		Number.isFinite( computeProjectionProfiling.compute.projectionMs.median ) &&
		computeProjectionProfiling.fragment.measuredRunCount === computeProjectionProfiling.measuredRuns &&
		computeProjectionProfiling.compute.measuredRunCount === computeProjectionProfiling.measuredRuns &&
		!( 'measuredRuns' in computeProjectionProfiling.fragment ) &&
		!( 'measuredRuns' in computeProjectionProfiling.compute ),
	'compute projection profiling: expected finite projection timing medians and compact measured run counts for both backends.' );
	results.push( { step: 'compute projection profiling', computeProjectionProfiling } );


}
