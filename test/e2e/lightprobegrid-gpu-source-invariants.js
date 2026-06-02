import { lightProbeWebGLReferenceLabel } from './lightprobegrid-gpu-smoke-config.js';
import { isMomentBackedVisibility } from './lightprobegrid-gpu-proof-gates.js';
import * as fs from 'fs/promises';

export async function checkSmokeSourceInvariants( file, smokeHarness ) {

	if ( file !== 'webgpu_lightprobes_cornell' ) return;

	const [
		example,
		source,
		guiSource,
		browserHarnessSource,
		visibilityStudySource,
		shDiagnosticsSource,
		receiverDiagnosticsSource,
		proofReadbackSource,
		gpuConstantsSource,
		gpuAtlasSource,
		cpuShMathSource,
		gpuProjectionSource,
		gpuVisibilitySource,
		gpuBakeSource,
		smokeRunnerSource,
		proofGatesSource,
		artifactSource,
		imageMetricsSource,
		proofValidationSource,
		configSource,
		sourceInvariantSource,
		runnerCoreAssertionsSource,
		runnerVisibilityAssertionsSource,
		runnerMatrixAssertionsSource,
		runnerRuntimeAssertionsSource,
		webglExample,
		lightProbeGridDocs,
		cubeTextureNodeSource,
		webgpuBuildSource
	] = await Promise.all( [
		fs.readFile( smokeHarness.example, 'utf8' ),
		fs.readFile( smokeHarness.source, 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/LightProbeGridGPUExampleGUI.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/LightProbeGridGPUTestHarness.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/LightProbeGridGPUVisibilityWeightingStudy.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/LightProbeGridGPUShDiagnostics.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/LightProbeGridGPUReceiverDiagnostics.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProofReadback.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUConstants.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlas.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUCpuShMath.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProjection.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUVisibility.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUBake.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-smoke.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-gates.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-artifacts.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-image-metrics.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-validation.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-smoke-config.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-source-invariants.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-runner-core-assertions.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-runner-visibility-assertions.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-runner-matrix-assertions.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-runner-runtime-assertions.js', 'utf8' ),
		fs.readFile( 'examples/webgl_lightprobes.html', 'utf8' ),
		fs.readFile( 'docs/pages/LightProbeGrid.html.md', 'utf8' ),
		fs.readFile( 'src/nodes/accessors/CubeTextureNode.js', 'utf8' ),
		fs.readFile( 'build/three.webgpu.js', 'utf8' )
	] );
	const exampleSource = `${ example }
${ guiSource }
${ browserHarnessSource }
${ visibilityStudySource }
${ shDiagnosticsSource }
${ receiverDiagnosticsSource }
${ cpuShMathSource }`;
	const e2eSource = `${ smokeRunnerSource }
${ proofGatesSource }
${ artifactSource }
${ imageMetricsSource }
${ proofValidationSource }
${ configSource }
${ sourceInvariantSource }
${ runnerCoreAssertionsSource }
${ runnerVisibilityAssertionsSource }
${ runnerMatrixAssertionsSource }
${ runnerRuntimeAssertionsSource }`;

	const requireSource = ( condition, message ) => {

		if ( condition === false ) throw new Error( `${ file }: ${ message }` );

	};

	const invalidMomentFixtures = [
		{ available: false, mode: 'moments', bytes: 128, stats: { finiteSampleCount: 1, hitSampleCount: 1 } },
		{ available: true, mode: 'scalar-validity', bytes: 128, stats: { finiteSampleCount: 1, hitSampleCount: 1 } },
		{ available: true, mode: 'moments', bytes: 0, stats: { finiteSampleCount: 1, hitSampleCount: 1 } },
		{ available: true, mode: 'moments', bytes: 128, stats: { finiteSampleCount: 0, hitSampleCount: 1 } },
		{ available: true, mode: 'moments', bytes: 128, stats: { finiteSampleCount: 1, hitSampleCount: 0 } }
	];

	requireSource(
		invalidMomentFixtures.every( fixture =>
			isMomentBackedVisibility( fixture ) === false
		),
		'Moment-backed visibility gate must reject unavailable, wrong-mode, empty-byte, and missing-readback evidence.'
	);

	const requireSourceContract = ( message, checks ) => {

		requireSource( checks.every( ( { sourceText, tokens = [] } ) =>
			tokens.every( token => sourceText.includes( token ) )
		), message );

	};

	requireSource(
		exampleSource.includes( 'searchParams.has( \'testHarness\' ) === false' ) &&
			exampleSource.includes( `window.${ smokeHarness.global }` ),
		'Smoke harness must stay gated behind ?testHarness.'
	);

	requireSource(
		webglExample.includes( 'window.__webglLightProbeGridCornell' ) &&
			webglExample.includes( 'applyReferenceSnapshot' ) &&
			webglExample.includes( 'params.lightingMode = mode' ) &&
			e2eSource.includes( lightProbeWebGLReferenceLabel ) &&
			e2eSource.includes( 'captureLightProbeWebGLReference' ),
		'WebGL LightProbeGrid reference capture must stay explicit, harness-gated, and secondary to the WebGPU proof.'
	);

	requireSource(
		smokeRunnerSource.includes( 'runLightProbeGridGpuProofGateAssertions' ) &&
			artifactSource.includes( 'proof-summary.json' ) &&
			artifactSource.includes( 'leak-proof-facts.json' ) &&
			artifactSource.includes( 'const createLeakProofArtifact = leakProofFacts =>' ) &&
			artifactSource.includes( 'validateLeakProofArtifact( file, leakProofArtifact )' ) &&
			artifactSource.includes( 'baseline.guardedVisibilityProofMode === \'off\'' ) &&
			artifactSource.includes( 'candidate.guardedVisibilityProofMode === \'guarded\'' ) &&
			artifactSource.includes( 'proofSettings.resolution === 4' ) &&
			artifactSource.includes( 'proofSettings.cubemapSize === 8' ) &&
			artifactSource.includes( 'proofSettings.band1Intensity === 1' ) &&
			artifactSource.includes( 'proofSettings.band2Intensity === 0.55' ) &&
			artifactSource.includes( 'proofSettings.normalBias === 0.5' ) &&
			artifactSource.includes( 'proofSettings.viewBias === 0' ) &&
			artifactSource.includes( 'proofSettings.lightingMode === \'probes only\'' ) &&
			artifactSource.includes( 'proofSettings.materialType === \'standard\'' ) &&
			artifactSource.includes( 'samplingKeys.length === 2' ) &&
			artifactSource.includes( 'sampling.weightedProbeSampling === true' ) &&
			artifactSource.includes( 'sampling.probeValidityMode === \'custom\'' ) &&
			artifactSource.includes( 'assertLightProbeProofSummary' ) &&
			artifactSource.includes( 'JSON.stringify( proofSummary )' ) &&
			artifactSource.includes( 'JSON.stringify( leakProofArtifact )' ) &&
			! artifactSource.includes( 'JSON.stringify( proofSummary, null' ) &&
			! artifactSource.includes( 'JSON.stringify( leakProofArtifact, null' ) &&
			proofGatesSource.includes( 'MAX_PROOF_SUMMARY_BYTES' ) &&
			proofGatesSource.includes( 'MAX_PROOF_GATE_COUNT' ) &&
			proofGatesSource.includes( 'const hasBoundedProofGateCount = summary =>' ) &&
			proofGatesSource.includes( 'hasBoundedProofGateCount( summary )' ) &&
			proofGatesSource.includes( 'const hasUniqueGateIds = ( summary, gateIds ) =>' ) &&
			proofGatesSource.includes( 'hasUniqueGateIds( summary, gateIds )' ) &&
			proofGatesSource.includes( 'const hasRequiredGateIds = ( gateIds, requiredGateIds ) =>' ) &&
			proofGatesSource.includes( 'hasRequiredGateIds( gateIds, requiredGateIds )' ) &&
			proofGatesSource.includes( 'const hasCompactGateShape = gate =>' ) &&
			proofGatesSource.includes( 'summary.gates.every( hasCompactGateShape )' ) &&
			proofGatesSource.includes( 'const hasSupportedRequiredGates = ( summary, requiredSupportedGateIds ) =>' ) &&
			proofGatesSource.includes( 'hasSupportedRequiredGates( summary, requiredSupportedGateIds )' ) &&
			proofGatesSource.includes( 'if ( facts.visibilityWeighting.wrongSideEscapedCount > 0 ) return true;' ) &&
			proofGatesSource.includes( 'const hasCompactProofSummarySize = summary =>' ) &&
			proofGatesSource.includes( 'hasCompactProofSummarySize( summary )' ) &&
			artifactSource.includes( 'createLightProbeProofReport' ) === false &&
			artifactSource.includes( 'proof-report.json' ) === false &&
			artifactSource.includes( 'proof-table.md' ) === false,
		'LightProbeGridGPU artifacts must default to compact proof-summary.json instead of writing the legacy giant proof report/table.'
	);

	requireSource(
		exampleSource.includes( 'MeshPhysicalNodeMaterial' ) &&
			exampleSource.includes( 'MeshLambertNodeMaterial' ) &&
			exampleSource.includes( 'MeshPhongNodeMaterial' ) &&
			exampleSource.includes( 'setMaterialType' ),
		'Smoke example must cover standard, physical, lambert, and phong node material families.'
	);

	requireSource(
		exampleSource.includes( 'const gridMin = new THREE.Vector3( - 2.6, 0.35, - 2.6 )' ) &&
			exampleSource.includes( 'const gridMax = new THREE.Vector3( 2.6, 4.35, 2.6 )' ),
		'Cornell probes must stay inset from the walls, floor, ceiling, and visible emitter to avoid near-field SH ringing.'
	);

	requireSource(
		/import[\s\S]*Object3D[\s\S]*from 'three\/webgpu'/.test( source ) &&
			/class LightProbeGridGPU extends Object3D/.test( source ) &&
			source.includes( 'this.isLightProbeGrid = true' ) &&
			source.includes( 'this.boundingBox' ) &&
			source.includes( 'this.texture' ),
		'LightProbeGridGPU must stay packaged as an Object3D-style probe grid.'
	);

	requireSource(
		source.includes( 'this._bakePromise' ) &&
			source.includes( 'if ( this._bakePromise !== null ) return this._bakePromise' ) &&
			/(^|\n)\s*bake\s*\(\s*renderer\s*,\s*scene\s*,\s*options\s*=\s*\{\s*\}\s*\)\s*\{/.test( source ) &&
			/(^|\n)\s*async\s+bake\s*\(/.test( source ) === false &&
			source.includes( 'async _bake' ),
		'LightProbeGridGPU bake() must coalesce overlapping bakes through an instance-owned promise identity.'
	);

	requireSource(
		source.includes( 'disposeLightProbeGridGPUFullscreenMesh' ) &&
			source.includes( 'mesh.geometry.dispose()' ) &&
			source.includes( 'helper.material.dispose()' ) &&
			source.includes( 'disposeLightProbeGridGPUResource( this.atlasTarget )' ) &&
			source.includes( 'this.texture = null' ),
		'LightProbeGridGPU dispose() must release instance-owned GPU resources and clear the public texture reference.'
	);

	requireSource(
		source.includes( 'createLightProbeGridGPUProjectionMaterial( this.cubeRenderTarget.texture, this.cubemapSize )' ) &&
			source.includes( 'createLightProbeGridGPUComputeProjectionNode(' ) &&
			source.includes( '_createProjectionMaterial()' ) === false &&
			source.includes( '_createComputeProjectionNode()' ) === false &&
			source.includes( 'Loop(' ) === false &&
			gpuProjectionSource.includes( 'forEachLightProbeGridGPUCubeTexel' ) &&
			gpuProjectionSource.includes( 'assignLightProbeGridGPUCubeDirection' ) &&
			gpuProjectionSource.includes( 'getLightProbeGridGPUSHBasisTerms' ) &&
			gpuProjectionSource.includes( 'createLightProbeGridGPUSHBasis' ) &&
			gpuProjectionSource.includes( 'addLightProbeGridGPUSH' ),
		'LightProbeGridGPU projection material/node construction must share cubemap traversal and SH projection helpers outside the runtime facade.'
	);

	requireSource(
		source.includes( 'createLightProbeGridGPUAtlasRepackMaterial(' ) &&
			source.includes( '_createRepackMaterial( coefficientTexture )' ) === false &&
			gpuAtlasSource.includes( 'PACKED_SH_COEFFICIENT_LAYOUT' ) &&
			gpuAtlasSource.includes( 'createLightProbeGridGPUPackedSHVector' ) &&
			gpuAtlasSource.includes( 'getLightProbeGridGPUPackedSource' ),
		'LightProbeGridGPU atlas repack material construction must use the shared packed SH coefficient layout outside the runtime facade.'
	);

	requireSource(
		source.includes( 'createLightProbeGridGPUVisibilityDistanceMaterial(' ) &&
			source.includes( 'createLightProbeGridGPUVisibilityRepackMaterial(' ) &&
			source.includes( 'getLightProbeGridGPUVisibilityLoadCoord(' ) &&
			source.includes( '_createVisibilityDistanceMaterial()' ) === false &&
			source.includes( '_createVisibilityRepackMaterial()' ) === false &&
			source.includes( 'sampleRadialDistance' ) === false &&
			gpuVisibilitySource.includes( 'getLightProbeGridGPUVisibilityLoadCoord' ) &&
			gpuVisibilitySource.includes( 'getLightProbeGridGPUOctahedralDirection' ) &&
			gpuVisibilitySource.includes( 'createLightProbeGridGPUVisibilityRepackMaterial' ) &&
			gpuVisibilitySource.includes( 'sampleRadialDistance' ),
		'LightProbeGridGPU visibility material construction and octahedral visibility lookup math must live outside the runtime facade.'
	);

	requireSource(
		source.includes( 'createLightProbeGridGPUHelper(' ) &&
			source.includes( 'applyLightProbeGridGPUHelperDepthMode(' ) &&
			source.includes( '_createHelper()' ) === false &&
			source.includes( 'new InstancedMesh' ) &&
			source.includes( 'new SphereGeometry' ) &&
			source.includes( 'instanceIndex' ),
		'LightProbeGridGPU helper mesh/material/debug construction is local because the helper seam is single-use and intentionally not a separate thin file.'
	);

	requireSource(
		source.includes( 'captureLightProbeGridGPUBakeState( renderer, scene, this )' ) &&
			source.includes( 'restoreLightProbeGridGPUBakeState( renderer, scene, this, bakeState )' ) &&
			source.includes( 'createLightProbeGridGPUBakeResult( this, renderer' ) &&
			source.includes( 'currentRenderTarget' ) === false &&
			source.includes( 'currentScissorTest' ) === false &&
			gpuBakeSource.includes( 'renderer.getViewport( _bakeViewport )' ) &&
			gpuBakeSource.includes( 'renderer.setViewport( _bakeViewport )' ) &&
			gpuBakeSource.includes( 'const timingBuckets = {' ) &&
			gpuBakeSource.includes( 'projectionTexelVisitReductionRatio' ),
		'LightProbeGridGPU bake state restoration and timing result construction must be owned by focused bake helpers, not inline runtime boilerplate.'
	);

	requireSource(
		source.includes( 'getMemoryInfo()' ) &&
			gpuConstantsSource.includes( 'projection: \'fragment\'' ) &&
			gpuConstantsSource.includes( 'atlas: \'render-pass\'' ) &&
			gpuConstantsSource.includes( 'update: \'full\'' ),
		'LightProbeGridGPU must expose benchmark memory metadata and current backend labels.'
	);

	requireSource(
		source.includes( 'new RenderTarget3D( this.resolution, this.resolution, this.atlasDepth' ) &&
			source.includes( 'this.texture = this.atlasTarget.texture' ) &&
			source.includes( 'Data3DTexture' ) === false &&
			source.includes( 'readRenderTargetPixels' ) === false &&
			source.includes( 'readPixels' ) === false,
		'LightProbeGridGPU bake atlas must stay GPU-resident with no CPU readback or Data3DTexture upload path.'
	);

	requireSource(
		source.includes( 'this.min = min.clone()' ) &&
			source.includes( 'this.max = max.clone()' ) &&
			source.includes( 'this.boundingBox = new Box3( this.min, this.max )' ) &&
			source.includes( 'this.resolution = this._validateResolution' ) &&
			source.includes( 'this.totalProbes = this.resolution * this.resolution * this.resolution' ),
		'LightProbeGridGPU must keep its explicit min/max box and cubic probe resolution contract documented against the WebGL baseline.'
	);

	requireSource(
		source.includes( 'L2 spherical harmonics' ) &&
			gpuConstantsSource.includes( 'export const SH_COEFFICIENTS = 9' ) &&
			gpuConstantsSource.includes( 'export const PACKED_SH_TEXTURES = 7' ) &&
			gpuConstantsSource.includes( 'export const PACKED_SH_COEFFICIENT_LAYOUT' ) &&
			source.includes( 'ceil( 27 / 4 ) = 7' ) &&
			source.includes( 'solid angle' ) &&
			source.includes( 'trilinear' ) &&
			source.includes( 'The WebGL LightProbeGrid baseline uses width/height/depth' ),
		'LightProbeGridGPU must document the SH projection, packing, padding, filtering math, and WebGL parity boundary.'
	);

	requireSource(
		/probesSH\.sample[\s\S]*_getPackedAtlasSampleZ/.test( source ) &&
			/packedLoad\.load[\s\S]*_getPackedAtlasLoadCoord/.test( source ) &&
			/setRenderTarget\( this\.atlasTarget, this\._getPackedAtlasLayer/.test( source ) &&
			(
				/atlasLoad\.load\( this\._getPackedAtlasLoadCoord/.test( source ) ||
				/atlasLoad\.load\( getPackedAtlasLoadCoord/.test( source )
			) &&
			gpuAtlasSource.includes( 'getLightProbeGridGPUPaddedAtlasSlices' ) &&
			gpuAtlasSource.includes( 'getLightProbeGridGPUAtlasDepth' ) &&
			gpuAtlasSource.includes( 'getLightProbeGridGPUPackedAtlasLayer' ) &&
			gpuAtlasSource.includes( 'getLightProbeGridGPUProbeIndex' ) &&
			source.includes( 'getLightProbeGridGPUAtlasDepth( this.resolution )' ) &&
			gpuAtlasSource.includes( 'viewportCoordinate' ) &&
			/const ix = int\( floor\( viewportCoordinate\.x \) \)/.test( gpuAtlasSource ) &&
			/const iy = int\( floor\( viewportCoordinate\.y \) \)/.test( gpuAtlasSource ),
		'Atlas sample/load/repack/helper paths must use centralized atlas address helpers and WebGPU-native viewport coordinates for repack.'
	);

	requireSource(
		/probeCoord\.x\.mul\( resolutionMinusOne \)\.add\( 0\.5 \)\.div\( resolution \)/.test( source ) &&
			/probeCoord\.y\.mul\( resolutionMinusOne \)\.add\( 0\.5 \)\.div\( resolution \)/.test( source ) &&
			/probeCoord\.z\.mul\( resolutionMinusOne \)\.add\( 0\.5 \)\.div\( resolution \)/.test( source ),
		'Hardware-filtered atlas sampling must center X/Y/Z coordinates on probe texels before blending.'
	);

	requireSource(
		source.includes( 'loadPackedSamples' ) &&
			source.includes( 'const weightedSamples = []' ) &&
			source.includes( 'weightedSamples[ i ].addAssign( sample[ i ].mul( weight ) )' ) &&
			source.includes( 'weightedSamples[ 0 ].div( safeWeight )' ),
		'Weighted manual atlas sampling must accumulate packed SH coefficients before SH evaluation/clamping without requiring removed runtime visibility-weighted sample buffers.'
	);

	requireSource(
		source.includes( 'this.band2Intensity = uniform' ) &&
			source.includes( 'this.band1Intensity = uniform' ) &&
			/const band1Intensity = this\.band1Intensity/.test( source ) &&
			/c1\.mul[\s\S]*band1Intensity/.test( source ) &&
			/c3\.mul[\s\S]*band1Intensity/.test( source ) &&
			/const band2Intensity = this\.band2Intensity/.test( source ) &&
			/c4\.mul[\s\S]*band2Intensity/.test( source ) &&
			/c8\.mul[\s\S]*band2Intensity/.test( source ) &&
			/probeHelperIntensity: 1,[\s\S]*band1Intensity: 1,\s+band2Intensity: 0\.55/.test( example ) &&
			exampleSource.includes( 'low-res-damped' ) &&
			exampleSource.includes( 'band1Intensity: 0.6' ) &&
			exampleSource.includes( 'const groundingParityLowResSnapshotBase' ) &&
			exampleSource.includes( 'const groundingParityDensitySnapshotBase' ) &&
			exampleSource.includes( '...groundingParityLowResSnapshotBase' ) &&
			exampleSource.includes( '...groundingParityDensitySnapshotBase' ) &&
			exampleSource.includes( 'const groundingParitySnapshotBand2Intensity = 0.55' ) &&
			exampleSource.includes( 'band2Intensity: groundingParitySnapshotBand2Intensity' ),
		'Probe irradiance must default to full first-band SH while keeping damped band diagnostics for ringing isolation.'
	);

	requireSource(
		exampleSource.includes( 'inspectProjectionParity' ) &&
			cpuShMathSource.includes( 'export const projectSyntheticCube' ) &&
			cpuShMathSource.includes( 'export const projectionConventionDirection' ) &&
			exampleSource.includes( 'shader-webgpu' ) &&
			exampleSource.includes( 'generator-render-target-webgpu' ) &&
			exampleSource.includes( 'webgl-light-probe-grid' ) &&
			exampleSource.includes( 'computeProjectionParityContract' ) &&
			exampleSource.includes( 'compute-probe-reduction' ) &&
			exampleSource.includes( 'fragment-coefficient-projection' ) &&
			! exampleSource.includes( 'runtimeMarkersAllowed:' ) &&
			! exampleSource.includes( 'runtimePathIntroduced:' ) &&
			! exampleSource.includes( 'runtimeGuardedImplementationPresent' ) &&
			exampleSource.includes( 'maxCandidateToFragmentDelta' ) &&
			exampleSource.includes( 'failedFixtureCount' ) &&
			exampleSource.includes( 'unsupportedComputeFallbackCount' ) &&
			exampleSource.includes( 'unsupportedStorageTextureFallbackCount' ) &&
			exampleSource.includes( 'readbackTolerance' ),
		'Cornell harness must include a synthetic cubemap projection parity fixture and a guarded runtime compute projection parity contract with fragment fallback.'
	);

	const computeProjectionRuntimeMarkersAllowed =
		source.includes( 'StorageTexture' ) &&
		source.includes( '_runComputeProjection' ) &&
		source.includes( '_runFragmentCoefficientProjection' ) &&
		source.includes( 'computeProjectionFallbackReason' ) &&
		source.includes( '_activeProjectionBackend' ) &&
		source.includes( 'renderer.compute( this.computeProjectionNode )' ) &&
		gpuProjectionSource.includes( 'textureStore( computeProjectionTexture' ) &&
		source.includes( 'fragment-coefficient-projection' );
	const computeProjectionRuntimeMarkers = [
		'_createComputeProjection',
		'computeProjectionPipeline',
		'computeProjectionMaterial',
		'computeProjectionNode',
		'computeProjectionPass',
		'projectionCompute',
		'computeProbeReduction',
		'compute-probe-reduction'
	];
	const hasComputeProjectionRuntime = computeProjectionRuntimeMarkers.some( marker => source.includes( marker ) );

	requireSource(
		computeProjectionRuntimeMarkersAllowed === true || hasComputeProjectionRuntime === false,
		'LightProbeGridGPU runtime compute projection markers remain forbidden until guarded runtime markers are explicitly allowed by the projection parity contract.'
	);

	requireSource(
		hasComputeProjectionRuntime === false ||
			source.includes( 'StorageTexture' ) &&
			source.includes( '_runComputeProjection' ) &&
			source.includes( '_runFragmentCoefficientProjection' ) &&
			source.includes( 'computeProjectionFallbackReason' ) &&
			source.includes( '_activeProjectionBackend' ) &&
			source.includes( 'renderer.compute( this.computeProjectionNode )' ) &&
			gpuProjectionSource.includes( 'textureStore( computeProjectionTexture' ) &&
			source.includes( 'fragment-coefficient-projection' ),
		'LightProbeGridGPU guarded compute projection runtime must include storage texture output, renderer.compute dispatch, explicit fragment fallback, and fallback reason telemetry.'
	);

	requireSource(
		exampleSource.includes( 'inspectSHMathContract' ) &&
			cpuShMathSource.includes( 'export const evaluateIrradianceContract' ) &&
			cpuShMathSource.includes( 'sphericalHarmonics3Basis' ) &&
			exampleSource.includes( 'THREE.SphericalHarmonics3' ) &&
			exampleSource.includes( 'constantRadiance' ) &&
			exampleSource.includes( 'axisDeltas' ) &&
			source.includes( '_evaluateCoefficients' ) &&
			source.includes( 'result = result.add( c8.mul( 0.429043 )' ) &&
			source.includes( 'return max( result, vec3( 0 ) );' ),
		'Cornell harness must include an executable SH math contract for projection normalization, irradiance convolution, axis signs, and runtime clamp order.'
	);

	requireSource(
		exampleSource.includes( 'inspectAtlasPacking' ) &&
			proofReadbackSource.includes( 'readLightProbeGridGPUDecodedPackedAtlasPixel' ) &&
			exampleSource.includes( 'packedCoefficientSlots' ) &&
			exampleSource.includes( 'validitySlot' ) &&
			exampleSource.includes( 'leading-padding-validity-t6' ) &&
			exampleSource.includes( 'nativeYOrientation' ) &&
			exampleSource.includes( 'addressMismatchCount' ) &&
			exampleSource.includes( 'centerSampleZOutOfRangeCount' ),
		'Cornell harness must include an executable atlas packing, padding, validity-channel, and Y-orientation verifier.'
	);

	requireSource(
		exampleSource.includes( 'inspectVisibilityDepthMoments' ) &&
			exampleSource.includes( 'readVisibilityDepthInfo()' ) &&
			exampleSource.includes( 'compactVisibilityDepthInfo( probeGrid.getVisibilityDepthInfo() )' ) &&
			exampleSource.includes( 'visibilityDepthTarget' ) &&
			exampleSource.includes( 'probeGrid.visibilityDepthResolution' ) &&
			exampleSource.includes( 'probeGrid.totalProbes' ) &&
			exampleSource.includes( 'available: info?.available === true' ) &&
			exampleSource.includes( 'mode: info?.mode ?? \'unavailable\'' ) &&
			exampleSource.includes( 'bytes: info?.bytes ?? 0' ) &&
			exampleSource.includes( 'available: info.available === true' ) &&
			exampleSource.includes( 'mode: info.mode ?? \'unavailable\'' ) &&
			exampleSource.includes( 'bytes: info.bytes ?? 0' ) &&
			exampleSource.includes( 'info.mode !== \'moments\'' ) &&
			exampleSource.includes( 'finiteSampleCount' ) &&
			exampleSource.includes( 'hitSampleCount' ) &&
			exampleSource.includes( 'hitConfidence' ) &&
			proofReadbackSource.includes( 'readLightProbeGridGPUVisibilityMomentPixel' ) &&
			proofReadbackSource.includes( 'decodeLightProbeGridGPUVisibilityMoment' ),
		'Cornell harness must directly inspect the private visibilityDepthTarget and call probeGrid.getVisibilityDepthInfo() for moment-backed proof gates.'
	);

	const visibilityDepthInfoStart = source.indexOf( '\n\tgetVisibilityDepthInfo() {' );
	const visibilityDepthInfoEnd = source.indexOf( '\n\t_setGuardedVisibilityProofMode', visibilityDepthInfoStart );
	const visibilityDepthInfoSource = source.slice( visibilityDepthInfoStart, visibilityDepthInfoEnd );

	requireSource(
		visibilityDepthInfoSource.includes( 'available' ) &&
			visibilityDepthInfoSource.includes( 'mode: this.visibilityDepthMode' ) &&
			visibilityDepthInfoSource.includes( 'bytes: available ? memory.visibilityDepthBytes : 0' ) &&
			visibilityDepthInfoSource.includes( 'encoding' ) === false &&
			visibilityDepthInfoSource.includes( 'resolution:' ) === false &&
			visibilityDepthInfoSource.includes( 'moments:' ) === false &&
			visibilityDepthInfoSource.includes( 'texture:' ) === false &&
			visibilityDepthInfoSource.includes( 'samples' ) === false &&
			visibilityDepthInfoSource.includes( 'stats' ) === false &&
			visibilityDepthInfoSource.includes( 'hitConfidenceChannel' ) === false &&
			visibilityDepthInfoSource.includes( 'backfaceConfidenceChannel' ) === false,
		'LightProbeGridGPU visibility-depth info must expose compact availability/mode/byte facts only; proof readback dimensions stay private.'
	);

	requireSource(
		browserHarnessSource.includes( 'readRenderTargetPixelsAsync' ) === false &&
			visibilityStudySource.includes( 'readRenderTargetPixelsAsync' ) === false &&
			receiverDiagnosticsSource.includes( 'readRenderTargetPixelsAsync' ) === false &&
			proofReadbackSource.includes( 'readRenderTargetPixelsAsync' ) &&
			proofReadbackSource.includes( 'readLightProbeGridGPURenderTargetRegion' ) &&
			proofReadbackSource.includes( 'readLightProbeGridGPURenderedTargetRegion' ) &&
			proofReadbackSource.includes( 'readLightProbeGridGPURenderTargetPixel' ),
		'LightProbeGridGPU proof, harness, and receiver diagnostics must centralize CPU readback behind the proof readback operations module.'
	);

	requireSource(
		proofGatesSource.includes( 'export function isMomentBackedVisibility( info )' ) &&
			proofGatesSource.includes( 'info.available === true' ) &&
			proofGatesSource.includes( 'info.mode === \'moments\'' ) &&
			proofGatesSource.includes( 'info.bytes > 0' ) &&
			proofGatesSource.includes( 'info.stats.finiteSampleCount > 0' ) &&
			proofGatesSource.includes( 'info.stats.hitSampleCount > 0' ) &&
			proofGatesSource.includes( 'const hasProjectionRuntimeParity = facts =>' ) &&
			proofGatesSource.includes( 'facts.projection.computeBackend === \'compute-probe-reduction\'' ) &&
			proofGatesSource.includes( 'const hasProjectionCoefficientDelta = facts =>' ) &&
			proofGatesSource.includes( 'const hasProjectionAtlasDelta = facts =>' ) &&
			proofGatesSource.includes( 'const isRuntimeReady = facts =>' ) &&
			proofGatesSource.includes( 'const hasRuntimeTexture = facts =>' ) &&
			proofGatesSource.includes( 'const hasRuntimeBounds = facts =>' ) &&
			proofGatesSource.includes( 'const hasReceiverNormalAgreement = facts =>' ) &&
			proofGatesSource.includes( 'const hasReceiverNormalProof = facts =>' ) &&
			proofGatesSource.includes( 'const hasVisibilityMomentReadback = facts =>' ) &&
			proofGatesSource.includes( 'const hasDirectionalSuppression = facts =>' ) &&
			proofGatesSource.includes( 'const hasReceiverSurfaceAgreement = ( facts, surfaceCpuRenderDelta ) =>' ) &&
			proofGatesSource.includes( 'const hasBakedShMixedColorRisk = facts =>' ) &&
			proofGatesSource.includes( 'const hasNoBakedShMixedColorRisk = facts =>' ) &&
			proofGatesSource.includes( 'const hasSealedWallThresholdSupport = ( actual, threshold ) =>' ) &&
			proofGatesSource.includes( 'const counts = gates.reduce( ( result, gate ) =>' ) &&
			! proofGatesSource.includes( 'gates.filter( gate => gate.status === \'SUPPORTED\' )' ) &&
			! proofGatesSource.includes( 'gates.filter( gate => gate.status === \'OPEN\' )' ) &&
			proofGatesSource.includes( '...( status === \'OPEN\' ? { actual, expected } : {} )' ) &&
			proofGatesSource.includes( '...( status === \'OPEN\' ? { reason } : {} )' ) &&
			proofGatesSource.includes( '...( status === \'OPEN\' && evidenceRef !== undefined ? { evidenceRef } : {} )' ) &&
			proofGatesSource.includes( 'gate.status === \'SUPPORTED\' || ( typeof gate.reason === \'string\' && gate.reason.length > 0 )' ) &&
			proofGatesSource.includes( 'gate.status === \'SUPPORTED\' || ( gate.actual !== undefined && gate.expected !== undefined )' ) &&
			! proofGatesSource.includes( 'tolerancePass:' ) &&
			! proofGatesSource.includes( 'frontFaceAgreement,' ) &&
			! proofGatesSource.includes( 'shaderNormalAgreement' ) &&
			proofGatesSource.includes( 'const visibilityMomentReadbackPass = hasVisibilityMomentReadback( facts )' ) &&
			proofGatesSource.includes( 'pass: visibilityMomentReadbackPass' ) &&
			proofGatesSource.includes( 'const receiverNormalAgreement = hasReceiverNormalAgreement( facts )' ) &&
			proofGatesSource.includes( 'const receiverNormalGatePass = hasReceiverNormalProof( facts )' ) &&
			proofGatesSource.includes( 'pass: receiverNormalGatePass' ) &&
			proofGatesSource.includes( 'const directionalSuppressionPass = hasDirectionalSuppression( facts )' ) &&
			proofGatesSource.includes( 'pass: directionalSuppressionPass' ) &&
			proofGatesSource.includes( 'const receiverSurfaceGatePass = hasReceiverSurfaceAgreement( facts, receiverSurfaceDelta )' ) &&
			proofGatesSource.includes( 'pass: receiverSurfaceGatePass' ) &&
			proofGatesSource.includes( 'const projectionCoefficientDeltaPass = hasProjectionCoefficientDelta( facts )' ) &&
			proofGatesSource.includes( 'pass: projectionCoefficientDeltaPass' ) &&
			proofGatesSource.includes( 'const projectionAtlasDeltaPass = hasProjectionAtlasDelta( facts )' ) &&
			proofGatesSource.includes( 'pass: projectionAtlasDeltaPass' ) &&
			proofGatesSource.includes( 'const runtimeReadyPass = isRuntimeReady( facts )' ) &&
			proofGatesSource.includes( 'pass: runtimeReadyPass' ) &&
			proofGatesSource.includes( 'const runtimeTexturePass = hasRuntimeTexture( facts )' ) &&
			proofGatesSource.includes( 'pass: runtimeTexturePass' ) &&
			proofGatesSource.includes( 'const runtimeBoundsPass = hasRuntimeBounds( facts )' ) &&
			proofGatesSource.includes( 'pass: runtimeBoundsPass' ) &&
			proofGatesSource.includes( 'const projectionRuntimeParityPass =' ) &&
			proofGatesSource.includes( 'pass: projectionRuntimeParityPass' ) &&
			proofGatesSource.includes( 'metric: \'runtimeParity\'' ) &&
			proofGatesSource.includes( 'const bakedShMixedColorRisk = hasBakedShMixedColorRisk( facts )' ) &&
			proofGatesSource.includes( 'const shMixedColorRiskPass = hasNoBakedShMixedColorRisk( facts )' ) &&
			proofGatesSource.includes( 'pass: shMixedColorRiskPass' ) &&
			proofGatesSource.includes( 'const sealedWallGatePass = hasSealedWallThresholdSupport( actual, threshold )' ) &&
			proofGatesSource.includes( 'pass: sealedWallGatePass' ) &&
			! proofGatesSource.includes( 'isLightProbeGrid:' ) &&
			! proofGatesSource.includes( 'visibilityLabel:' ) &&
			! proofGatesSource.includes( 'visibilityStatus:' ) &&
			! proofGatesSource.includes( 'ddgiStatus:' ) &&
			e2eSource.includes( 'buildExecuted: false' ) &&
			e2eSource.includes( 'OPEN-COLOR-MAPPING' ),
		'Proof helpers must gate visibility moments from strict raw readback evidence without keeping unused visibility/DDGI status payloads, and report open color mapping honestly.'
	);

	const atlasPathStart = source.indexOf( '\n\t_createAtlasIrradianceNode() {' );
	const atlasPathEnd = source.indexOf( '_createManualIrradianceNode()', atlasPathStart );
	const atlasPathSource = source.slice( atlasPathStart, atlasPathEnd );

	requireSource(
		atlasPathSource.includes( 'texture3D( this.atlasTarget.texture )' ) &&
			atlasPathSource.includes( 'probesSH.sample' ) &&
			atlasPathSource.includes( 'visibilityDepthTarget' ) === false &&
			atlasPathSource.includes( 'visibilityDepthWeighting' ) === false &&
			atlasPathSource.includes( '_createManualIrradianceDebugNode' ) === false,
		'Fast SH atlas path must remain hardware-filtered and must not reference visibility moments, weighting uniforms, or debug branches.'
	);

	requireSourceContract(
		'Cornell harness must include a receiver-level CPU mirror diagnostic before changing DDGI-lite visibility weighting heuristics.',
		[
			{
				sourceText: exampleSource,
				tokens: [
					'inspectVisibilityWeightingAtLeakReceivers',
					'runtimeVisibilityDistanceBias',
					'shContributionDiagnostic',
					'correctSideMixedColorRowCount',
					'readProbeCoefficients',
					'receiverSurfaceQuadratureDiagnostic',
					'surfaceRuntimeWrongRatioMax',
					'renderSurfaceWrongRatio',
					'_getPackedAtlasLayer',
					'comparableReceiverCount',
					'wrongMinusCorrectSuppression',
					'escapeClassification',
					'crossesDivider',
					'doesDividerSegmentIntersect',
					'front-edge-bypass',
					'inspectLeakReceiverNormalConvention',
					'normalWorld.normalize().mul( 0.5 ).add( 0.5 )',
					'frontFaceReceiverCount',
					'frontSideCpuNormalConventionCount'
				]
			},
			{
				sourceText: proofGatesSource,
				tokens: [
					'sealed visibility weighting diagnostic',
					'visibilityWeighting.directionalSuppression',
					'sealed receiver normal convention diagnostic',
					'receiverNormal.frontFaceShaderAgreement',
					'deriveReceiverSurfaceDelta',
					'receiverSurface.cpuRenderAgreement',
					'shContribution.noBakedMixedColorRisk'
				]
			}
		]
	);

	requireSource(
		! exampleSource.includes( 'OPEN-NORMAL-CONVENTION-MISMATCH' ) &&
			! exampleSource.includes( 'SUPPORTED-CPU-NORMAL-MATCHES-FRONT-FACE-SHADER' ) &&
			! exampleSource.includes( 'diagnosticConclusion' ) &&
			! exampleSource.includes( 'directionalSuppressionSupported' ) &&
			! exampleSource.includes( 'SUPPORTED-DIRECTIONAL-SUPPRESSION' ) &&
			! exampleSource.includes( 'OPEN-CORRECT-SIDE-SUPPRESSED' ) &&
			! exampleSource.includes( 'interrogationFinding' ) &&
			! exampleSource.includes( 'dominantEscapeReason' ) &&
			! exampleSource.includes( 'SUPPORTED-SURFACE-CPU-RENDER-AGREEMENT' ) &&
			! exampleSource.includes( 'OPEN-SURFACE-CPU-RENDER-MISMATCH' ) &&
			! exampleSource.includes( 'cpuRenderAgreementGate' ) &&
			! exampleSource.includes( 'OPEN-BAKED-SH-MIXED-COLOR-SUSPECTED' ) &&
			! exampleSource.includes( 'OPEN-CORRECT-PROBE-ROW-MIXED-COLOR-PRESSURE' ) &&
			! exampleSource.includes( 'OPEN-SH-CONTRIBUTION-NEEDS-MORE-EVIDENCE' ) &&
			! exampleSource.includes( 'BAKED-SH-MIXED-COLOR-CONTAMINATION' ) &&
			! exampleSource.includes( 'RUNTIME-SH-EVAL-OR-RENDER-METRIC' ) &&
			! exampleSource.includes( 'suspectedFailureDomain' ) &&
			! exampleSource.includes( 'OPEN-GPU-DEBUG-CPU-SURFACE-MISMATCH' ) &&
			! exampleSource.includes( 'linearIrradianceAgreementGate' ) &&
			! exampleSource.includes( 'weightTermAgreementGate' ) &&
			! exampleSource.includes( 'old proof-lab variant sweep' ) &&
			! exampleSource.includes( 'CAPTURED-RADIAL-MOMENT-READBACK' ) &&
			! exampleSource.includes( 'OPEN-NO-MOMENT-READBACK' ) &&
			! exampleSource.includes( 'readback-only verifier for private DDGI-lite visibility/depth moments' ) &&
			! exampleSource.includes( 'DIAGNOSTIC-PROJECTION-PROFILE-CAPTURED' ) &&
			! exampleSource.includes( 'OPEN-PROJECTION-PROFILE-BACKEND-FALLBACK' ) &&
			! exampleSource.includes( 'DIAGNOSTIC-PROJECTION-PHASE-NON-GATED' ) &&
			! exampleSource.includes( 'DIAGNOSTIC-WALL-CLOCK-NOT-GATED' ) &&
			! exampleSource.includes( 'CAPTURED-NON-DETERMINISTIC-PERFORMANCE-NOW' ) &&
			! exampleSource.includes( 'UNAVAILABLE-DETERMINISTIC-TIMER-ZERO' ) &&
			! exampleSource.includes( 'samples: finiteValues.map' ) &&
			! exampleSource.includes( 'min: roundTimingMetric' ) &&
			! exampleSource.includes( 'average: roundTimingMetric' ) &&
			! exampleSource.includes( 'p95: roundTimingMetric' ) &&
			! exampleSource.includes( 'max: roundTimingMetric' ) &&
			! exampleSource.includes( 'requestedBackend,' ) &&
			! exampleSource.includes( 'allRunsSelectedExpectedBackend' ) &&
			! exampleSource.includes( 'expectedBackendMismatchCount' ) &&
			! exampleSource.includes( 'fallbackReasons: Array.from' ) &&
			! exampleSource.includes( 'fallbackReasons = new Set' ) &&
			! exampleSource.includes( 'fallbackReasonCount' ) &&
			runnerCoreAssertionsSource.includes( 'const hasNoFields = ( object, ...fields )' ) &&
			runnerCoreAssertionsSource.includes( 'const hasComputeProjectionRuntimeParityFacts = parity =>' ) &&
			runnerCoreAssertionsSource.includes( 'hasComputeProjectionRuntimeParityFacts( computeProjectionRuntimeParity )' ) &&
			runnerCoreAssertionsSource.includes( 'const hasComputeProjectionRuntimeParitySupportFacts = parity =>' ) &&
			runnerCoreAssertionsSource.includes( 'hasComputeProjectionRuntimeParitySupportFacts( computeProjectionRuntimeParity )' ) &&
			runnerCoreAssertionsSource.includes( 'const hasComputeProjectionProfilingFacts = profiling =>' ) &&
			runnerCoreAssertionsSource.includes( 'hasComputeProjectionProfilingFacts( computeProjectionProfiling )' ) &&
			runnerCoreAssertionsSource.includes( 'const hasProjectionProfilingBackendFacts = profiling =>' ) &&
			runnerCoreAssertionsSource.includes( 'hasProjectionProfilingBackendFacts( computeProjectionProfiling )' ) &&
			runnerCoreAssertionsSource.includes( 'const hasCompactProjectionTimingFacts = profiling =>' ) &&
			runnerCoreAssertionsSource.includes( 'hasCompactProjectionTimingFacts( computeProjectionProfiling )' ) &&
			runnerCoreAssertionsSource.includes( '\'timingPolicy\'' ) &&
			runnerCoreAssertionsSource.includes( '\'gpuTimerQueryStatus\'' ) &&
			runnerCoreAssertionsSource.includes( '\'requestedBackend\'' ) &&
			runnerCoreAssertionsSource.includes( '\'allRunsSelectedExpectedBackend\'' ) &&
			runnerCoreAssertionsSource.includes( '\'expectedBackendMismatchCount\'' ) &&
			runnerCoreAssertionsSource.includes( '\'fallbackReasonCount\'' ) &&
			runnerCoreAssertionsSource.includes( 'fallbackRunCount === 0' ) &&
			! exampleSource.includes( 'RUNTIME-PARITY-READBACK-PASSING' ) &&
			! exampleSource.includes( 'OPEN-RUNTIME-PARITY-DELTA' ) &&
			! exampleSource.includes( 'OPEN-RUNTIME-COMPUTE-FALLBACK' ) &&
			! exampleSource.includes( 'fragmentTimings,' ) &&
			! exampleSource.includes( 'computeTimings,' ) &&
			! exampleSource.includes( 'candidatePath: \'compute-probe-reduction\',\n\t\t\t\tfragmentBackend' ) &&
			! exampleSource.includes( 'RUNTIME-GUARDED-ADAPTER-FALLBACK-SPEC-PASSING' ) &&
			! exampleSource.includes( 'OPEN-PROOF-ONLY-ADAPTER-FALLBACK-DELTA' ) &&
			! exampleSource.includes( 'PROOF-ONLY-MOCK-PARITY-PASSING' ) &&
			! exampleSource.includes( 'OPEN-PROOF-ONLY-MOCK-PARITY-DELTA' ) &&
			! exampleSource.includes( 'PROOF-ONLY-ATLAS-REPACK-PARITY-PASSING' ) &&
			! exampleSource.includes( 'OPEN-PROOF-ONLY-ATLAS-REPACK-PARITY-DELTA' ) &&
			! exampleSource.includes( 'REQUIRED-BEFORE-FULL-PARITY-PROMOTION' ) &&
			! exampleSource.includes( 'PARITY-CANDIDATE-NOT-RUNTIME' ) &&
			! exampleSource.includes( 'PENDING-BROWSER-E2E' ) &&
			! exampleSource.includes( 'evidenceStatus' ) &&
			! exampleSource.includes( 'status: maxBlackPixelRatio > 0.15' ) &&
			! imageMetricsSource.includes( 'status: maxBlackPixelRatio > 0.15' ) &&
			! proofValidationSource.includes( 'artifactPressure.status === \'PRESSURE\'' ) &&
			! proofValidationSource.includes( 'artifactPressure.status === \'bounded\'' ) &&
			! exampleSource.includes( 'chromaSpread' ) &&
			! exampleSource.includes( 'return { left, right, center }' ) &&
			! exampleSource.includes( 'colorSanity.center.r' ) &&
			runnerRuntimeAssertionsSource.includes( 'const hasBakeCoalescingFacts = bakeCoalescing =>' ) &&
			runnerRuntimeAssertionsSource.includes( 'hasBakeCoalescingFacts( bakeCoalescing )' ) &&
			runnerRuntimeAssertionsSource.includes( 'const hasBenchmarkBackendFacts = benchmark =>' ) &&
			runnerRuntimeAssertionsSource.includes( 'hasBenchmarkBackendFacts( benchmark )' ) &&
			runnerRuntimeAssertionsSource.includes( 'const hasBenchmarkMemoryFacts = benchmark =>' ) &&
			runnerRuntimeAssertionsSource.includes( 'hasBenchmarkMemoryFacts( benchmark )' ) &&
			runnerRuntimeAssertionsSource.includes( 'const hasBenchmarkVisibilityDepthFacts = benchmark =>' ) &&
			runnerRuntimeAssertionsSource.includes( 'hasBenchmarkVisibilityDepthFacts( benchmark )' ) &&
			runnerRuntimeAssertionsSource.includes( 'const hasBenchmarkTimingFacts = benchmark =>' ) &&
			runnerRuntimeAssertionsSource.includes( 'hasBenchmarkTimingFacts( benchmark )' ) &&
			runnerRuntimeAssertionsSource.includes( 'const hasColorSanityFacts = colorSanity =>' ) &&
			runnerRuntimeAssertionsSource.includes( 'hasColorSanityFacts( colorSanity )' ) &&
			! exampleSource.includes( 'basis: [ \'Y00\'' ) &&
			! exampleSource.includes( 'projectionNormalization:' ) &&
			! exampleSource.includes( 'irradianceConvolution:' ) &&
			! exampleSource.includes( 'samples: constantSamples' ) &&
			! exampleSource.includes( 'axisResponse,' ) &&
			! exampleSource.includes( 'axisDominance:' ) &&
			! visibilityStudySource.includes( 'reason: \'segment-intersects-divider\'' ) &&
			! visibilityStudySource.includes( 'reason: \'misses-divider-geometry\'' ) &&
			! visibilityStudySource.includes( 'reason: \'intersection-beyond-receiver\'' ) &&
			! browserHarnessSource.includes( 'timings: { ..._lightProbeContext.timings }' ) &&
			! exampleSource.includes( 'referenceBoundary' ) &&
			! artifactSource.includes( 'referenceBoundary' ) &&
			! exampleSource.includes( 'action:' ) &&
			! browserHarnessSource.includes( 'proofRole:' ) &&
			proofValidationSource.includes( 'snapshot.proofRole === undefined' ) &&
			! browserHarnessSource.includes( 'createBakeTexelBudget' ) &&
			! browserHarnessSource.includes( 'bakeTexelBudget:' ) &&
			proofValidationSource.includes( 'snapshot.bakeTexelBudget === undefined' ) &&
			! browserHarnessSource.includes( 'antiRingingPolicy' ) &&
			proofValidationSource.includes( 'snapshot.antiRingingPolicy === undefined' ) &&
			! browserHarnessSource.includes( 'bandPolicy:' ) &&
			! proofValidationSource.includes( '.antiRingingPolicy.bandPolicy' ) &&
			! browserHarnessSource.includes( 'runtimePath:' ) &&
			! proofValidationSource.includes( '.antiRingingPolicy.runtimePath' ) &&
			! browserHarnessSource.includes( 'shadowsDisabledDuringBake: snapshotCase.disableShadowsDuringBake === true' ) &&
			proofValidationSource.includes( 'snapshot.shadowsDisabledDuringBake === undefined' ) &&
			proofValidationSource.includes( 'hasDensityCrispShadowComparisonFacts( densityShadowCrisp, densityReference )' ) &&
			! browserHarnessSource.includes( 'default-bake-shadow-map' ) &&
			! browserHarnessSource.includes( 'shadow.mapSize.x' ) &&
			! browserHarnessSource.includes( 'custom-bake-shadow-map' ) &&
			proofValidationSource.includes( 'const hasCrispDirectShadowControl = snapshot =>' ) &&
			proofValidationSource.includes( 'hasCrispDirectShadowControl( snapshot )' ) &&
			proofValidationSource.includes( 'hasDensityCrispShadowComparisonFacts( densityShadowCrisp, densityReference )' ) &&
			proofValidationSource.includes( 'snapshot.directShadowControl.mode === undefined' ) &&
			proofValidationSource.includes( 'snapshot.directShadowControl === undefined' ) &&
			! browserHarnessSource.includes( 'probeHelperIntensity: _lightProbeContext.params.probeHelperIntensity' ) &&
			proofValidationSource.includes( 'snapshot.probeHelperIntensity === undefined' ) &&
			! browserHarnessSource.includes( 'metrics: getProbeHarnessMetrics()' ) &&
			browserHarnessSource.includes( 'metrics: getGroundingParitySnapshotMetrics()' ) &&
			proofValidationSource.includes( 'const hasNoFields = ( object, ...fields )' ) &&
			proofValidationSource.includes( 'hasNoFields( snapshot.metrics,' ) &&
			proofValidationSource.includes( 'hasNoFields( snapshot.metrics.timings,' ) &&
			proofValidationSource.includes( 'hasNoFields( snapshot.artifactSignature.center,' ) &&
			proofValidationSource.includes( 'const hasArtifactPressureFacts = ( artifactPressure, ...fields )' ) &&
			proofValidationSource.includes( 'hasArtifactPressureFacts(' ) &&
			proofValidationSource.includes( 'const assertRegionFacts = ( file, ownerLabel, region,' ) &&
			proofValidationSource.includes( 'assertRegionFacts( file, `grounding parity artifact ${ snapshot.label }/${ regionName }`, region,' ) &&
			proofValidationSource.includes( 'assertRegionFacts( file, `WebGL reference artifact ${ regionName }`, region );' ) &&
			proofValidationSource.includes( 'const hasSnapshotBudget = ( snapshot, resolution, cubemapSize )' ) &&
			proofValidationSource.includes( 'const hasDensitySnapshotBudget = snapshot =>' ) &&
			proofValidationSource.includes( 'const hasUnweightedSampling = snapshot =>' ) &&
			proofValidationSource.includes( 'const hasHardwareFilteredSampling = snapshot =>' ) &&
			proofValidationSource.includes( 'const hasHardwareFilteredDensitySnapshot = snapshot =>' ) &&
			proofValidationSource.includes( 'const hasSameDensityFixture = ( snapshot, reference ) =>' ) &&
			proofValidationSource.includes( 'const hasDensityReferenceFacts = snapshot =>' ) &&
			proofValidationSource.includes( 'hasDensityReferenceFacts( snapshot )' ) &&
			proofValidationSource.includes( 'const hasDensityShadowlessFacts = snapshot =>' ) &&
			proofValidationSource.includes( 'hasDensityShadowlessFacts( densityShadowless )' ) &&
			proofValidationSource.includes( 'const hasDensityCrispShadowRowFacts = snapshot =>' ) &&
			proofValidationSource.includes( 'hasDensityCrispShadowRowFacts( snapshot )' ) &&
			proofValidationSource.includes( 'const hasDensityCrispShadowComparisonFacts = ( snapshot, reference ) =>' ) &&
			proofValidationSource.includes( 'hasDensityCrispShadowComparisonFacts( densityShadowCrisp, densityReference )' ) &&
			proofValidationSource.includes( 'const hasDensityDampedFixtureFacts = ( snapshot, reference ) =>' ) &&
			proofValidationSource.includes( 'hasDensityDampedFixtureFacts( densityDamped, densityReference )' ) &&
			proofValidationSource.includes( 'const hasDensityDampedMathActionFacts = ( snapshot, reference ) =>' ) &&
			proofValidationSource.includes( 'hasDensityDampedMathActionFacts( densityDamped, densityReference )' ) &&
			proofValidationSource.includes( 'const hasLowResSharedProbeIntensity = ( damped, unweighted, weighted ) =>' ) &&
			proofValidationSource.includes( 'hasLowResSharedProbeIntensity( damped, unweighted, weighted )' ) &&
			proofValidationSource.includes( 'const hasLowResBandIsolation = ( damped, unweighted ) =>' ) &&
			proofValidationSource.includes( 'hasLowResBandIsolation( damped, unweighted )' ) &&
			proofValidationSource.includes( 'const hasLowResBounceFacts = unweighted =>' ) &&
			proofValidationSource.includes( 'hasLowResBounceFacts( unweighted )' ) &&
			proofValidationSource.includes( 'const hasLowResDampedComparisonFacts = ( damped, unweighted ) =>' ) &&
			proofValidationSource.includes( 'hasLowResDampedComparisonFacts( damped, unweighted )' ) &&
			proofValidationSource.includes( 'hasHardwareFilteredDensitySnapshot( densityReference )' ) &&
			! exampleSource.includes( '...window.__webgpuLightProbeGridCornell.getMetrics()' ) &&
			! browserHarnessSource.includes( 'receivers,' ) &&
			! browserHarnessSource.includes( 'shaderNormalSamples,' ) &&
			! runnerVisibilityAssertionsSource.includes( 'sealedReceiverNormalDiagnostic.receivers.length' ) &&
			! runnerVisibilityAssertionsSource.includes( 'sealedReceiverNormalDiagnostic.shaderNormalSamples.length' ) &&
			runnerVisibilityAssertionsSource.includes( 'const hasReceiverNormalFacts = diagnostic =>' ) &&
			runnerVisibilityAssertionsSource.includes( 'hasReceiverNormalFacts( sealedReceiverNormalDiagnostic )' ) &&
			runnerVisibilityAssertionsSource.includes( '\'receivers\', \'shaderNormalSamples\', \'summary\'' ) &&
			runnerVisibilityAssertionsSource.includes( 'const hasReceiverSurfaceFacts = surface =>' ) &&
			runnerVisibilityAssertionsSource.includes( 'hasReceiverSurfaceFacts( surface )' ) &&
			runnerVisibilityAssertionsSource.includes( '\'fixtureMode\'' ) &&
			runnerVisibilityAssertionsSource.includes( '\'quadratureRule\'' ) &&
			runnerVisibilityAssertionsSource.includes( 'sealedVisibilityWeightingDiagnostic.receiverGpuDebugDiagnostic === undefined' ) &&
			runnerVisibilityAssertionsSource.includes( 'const hasShContributionFacts = shContribution =>' ) &&
			runnerVisibilityAssertionsSource.includes( 'hasShContributionFacts( sealedVisibilityWeightingDiagnostic.shContributionDiagnostic )' ) &&
			runnerVisibilityAssertionsSource.includes( 'hasNoFields( sealedVisibilityWeightingDiagnostic, \'directionalSuppressionSupported\' )' ) &&
			! visibilityStudySource.includes( 'unavailable-proof-6-runtime-removed' ) &&
			runnerVisibilityAssertionsSource.includes( 'const hasNoFields = ( object, ...fields )' ) &&
			runnerVisibilityAssertionsSource.includes( 'hasNoFields( diagnostic, \'left\', \'right\' )' ) &&
			runnerVisibilityAssertionsSource.includes( 'const hasVisibilityMomentFacts = inspection =>' ) &&
			runnerVisibilityAssertionsSource.includes( 'hasVisibilityMomentFacts( visibilityMomentInspection )' ) &&
			runnerVisibilityAssertionsSource.includes( 'hasNoFields( inspection.stats,' ) &&
			runnerVisibilityAssertionsSource.includes( 'const hasVisibilityWeightingFacts = diagnostic =>' ) &&
			runnerVisibilityAssertionsSource.includes( 'hasVisibilityWeightingFacts( visibilityWeightingDiagnostic )' ) &&
			runnerVisibilityAssertionsSource.includes( '\'diagnosticScope\'' ) &&
			runnerVisibilityAssertionsSource.includes( 'hasVisibilityWeightingFacts( sealedVisibilityWeightingDiagnostic )' ) &&
			runnerVisibilityAssertionsSource.includes( 'const hasEscapeClassificationFacts = classification =>' ) &&
			runnerVisibilityAssertionsSource.includes( 'hasEscapeClassificationFacts( sealedVisibilityWeightingDiagnostic.escapeClassification )' ) &&
			runnerVisibilityAssertionsSource.includes( 'hasNoFields( classification, \'escapedProbes\', \'escapeReasons\' )' ) &&
			! visibilityStudySource.includes( 'diagnosticScope:' ) &&
			! visibilityStudySource.includes( 'escapeSummary:' ) &&
			! visibilityStudySource.includes( 'const combineEscapeSummary' ) &&
			! visibilityStudySource.includes( 'escapeSummary.escapedProbes' ) &&
			! visibilityStudySource.includes( 'receivers.reduce( ( total, receiver ) => total + receiver.escapeSummary' ) &&
			! visibilityStudySource.includes( 'const wrongSideRows = rows.filter' ) &&
			! visibilityStudySource.includes( 'const escapedRows = wrongSideRows.filter' ) &&
			! visibilityStudySource.includes( 'const countEscapes = reason' ) &&
			! visibilityStudySource.includes( 'const sum = ( relation, key ) => rows' ) &&
			! visibilityStudySource.includes( 'for ( const row of receiver.rows )' ) &&
			visibilityStudySource.includes( 'probeFacts: {' ) &&
			visibilityStudySource.includes( 'facts.probeCount += receiver.probeFacts.probeCount' ) &&
			visibilityStudySource.includes( 'const receiverProbeAggregate = summarizeReceiverProbeFacts( [ left, right ] )' ) &&
			visibilityStudySource.includes( 'wrongSideProbeCount: receiverProbeAggregate.weightedWrongSideProbeCount' ) &&
			! visibilityStudySource.includes( 'correctChannel:' ) &&
			! visibilityStudySource.includes( 'wrongChannel:' ) &&
			! visibilityStudySource.includes( 'correctValue:' ) &&
			! visibilityStudySource.includes( 'wrongValue:' ) &&
			! visibilityStudySource.includes( 'correctOverWrong:' ) &&
			! visibilityStudySource.includes( 'colorBias:' ) &&
			! visibilityStudySource.includes( 'currentHitConfidencePolicy' ) &&
			! visibilityStudySource.includes( 'hitConfidenceThreshold' ) &&
			! visibilityStudySource.includes( 'below-hit-threshold' ) &&
			! visibilityStudySource.includes( 'lowHitConfidenceEscapeCount' ) &&
			! visibilityStudySource.includes( 'predicate = () => true' ) &&
			! visibilityStudySource.includes( 'coefficientReader = readProbeCoefficients' ) &&
			! receiverDiagnosticsSource.includes( 'currentHitConfidencePolicy' ) &&
			! shDiagnosticsSource.includes( '.colorBias' ) &&
			! visibilityStudySource.includes( 'left: summarizeReceiverProbeFacts' ) &&
			! visibilityStudySource.includes( 'right: summarizeReceiverProbeFacts' ) &&
			! visibilityStudySource.includes( 'label: \'continuous\'' ) &&
			! visibilityStudySource.includes( 'label,' ) &&
			! visibilityStudySource.includes( 'label: receiver.label' ) &&
			! visibilityStudySource.includes( 'quadratureWeight:' ) &&
			! shDiagnosticsSource.includes( 'aggregates: {' ) &&
			! shDiagnosticsSource.includes( 'relationToReceiver: row.relationToReceiver' ) &&
			! shDiagnosticsSource.includes( 'visibilityWeight: row.visibilityWeight' ) &&
			! shDiagnosticsSource.includes( 'receiverDiagnostics = [' ) &&
			! shDiagnosticsSource.includes( 'receiverDiagnostics.reduce' ) &&
			! receiverDiagnosticsSource.includes( 'runtimeDebugUnavailable' ) &&
			! receiverDiagnosticsSource.includes( 'sampleKind:' ) &&
			! receiverDiagnosticsSource.includes( 'sampleLabel:' ) &&
			! receiverDiagnosticsSource.includes( 'uv: {' ) &&
			! receiverDiagnosticsSource.includes( 'createGaussLegendreReceiverSamples,' ) &&
			! receiverDiagnosticsSource.includes( 'fixtureMode,' ) &&
			! receiverDiagnosticsSource.includes( 'quadratureRule:' ) &&
			! receiverDiagnosticsSource.includes( 'renderAgreementCandidates' ) &&
			! receiverDiagnosticsSource.includes( 'surfaceCpuRenderDelta:' ) &&
			! receiverDiagnosticsSource.includes( 'surfaceRuntimeWrongRatioMean' ) &&
			receiverDiagnosticsSource.includes( 'surfaceRuntimeWrongRatioMax' ) &&
			receiverDiagnosticsSource.includes( 'renderSurfaceWrongRatio' ) &&
			proofGatesSource.includes( 'const deriveReceiverSurfaceDelta = receiverSurface =>' ) &&
			proofGatesSource.includes( 'deriveReceiverSurfaceDelta( facts.receiverSurface )' ) &&
			runnerVisibilityAssertionsSource.includes( '\'surfaceCpuRenderDelta\'' ) &&
			! receiverDiagnosticsSource.includes( 'renderMaskedWrongRatio' ) &&
			! receiverDiagnosticsSource.includes( 'maskedCpuRenderDelta' ) &&
			! receiverDiagnosticsSource.includes( '{ delta:' ) &&
			! receiverDiagnosticsSource.includes( 'runtimeWrongOverCorrect' ) &&
			! receiverDiagnosticsSource.includes( 'sampleCount ++' ) &&
			! visibilityStudySource.includes( 'receiverGpuDebugDiagnostic' ) &&
			! visibilityStudySource.includes( 'escapeReasons,' ) &&
			! visibilityStudySource.includes( 'compactVisibilityDepthInfo' ) &&
			runnerVisibilityAssertionsSource.includes( '\'visibilityDepth\'' ) &&
			runnerVisibilityAssertionsSource.includes( 'hasNoFields( sealedVisibilityWeightingDiagnostic,' ) &&
			! exampleSource.includes( 'missingReason:' ) &&
			! exampleSource.includes( 'cpuColorDistance:' ) &&
			! exampleSource.includes( 'invertedColorDistance:' ) &&
			! exampleSource.includes( 'closestNormalConvention:' ) &&
			! receiverDiagnosticsSource.includes( 'summary: {' ) &&
			! shDiagnosticsSource.includes( 'summary: {' ) &&
			! exampleSource.includes( 'threeJsIrradianceParity = { supported' ) &&
			runnerCoreAssertionsSource.includes( 'hasNoFields( shMathContract.threeJsIrradianceParity, \'supported\' )' ) &&
			! exampleSource.includes( 'reason: computeRuntimeAllowed' ),
		'Receiver normal, receiver-surface, visibility weighting, SH contribution, GPU-debug, moment, projection profiling, projection oracle, runtime parity, artifact pressure, and artifact snapshot diagnostics must emit raw facts; proof gates/assertions own their verdicts.'
	);

	requireSource(
			! exampleSource.includes( 'requiredCapabilities: [ \'compute projection implementation\'' ) &&
			! exampleSource.includes( 'promotionEffect:' ) &&
			! exampleSource.includes( 'requiredPromotionEvidence' ) &&
			! exampleSource.includes( 'requiredGateCount: 3' ) &&
			! exampleSource.includes( 'requiredGates: [' ) &&
			! exampleSource.includes( 'openEvidenceAfterPass' ) &&
			! exampleSource.includes( 'requiredLayout: \'coefficientTarget row order' ) &&
			! exampleSource.includes( 'checkedLayers: allReadbackChecks.map' ) &&
			! exampleSource.includes( 'coefficientPacking: PACKED_SH_COEFFICIENT_LAYOUT' ) &&
			! exampleSource.includes( 'readbackChecks,' ) &&
			! exampleSource.includes( 'paddingChecks,' ) &&
			! exampleSource.includes( 'actual: actual.map' ) &&
			! exampleSource.includes( 'expected: expected.map' ) &&
			! exampleSource.includes( 'deltas: deltas.map' ) &&
			! exampleSource.includes( 'gridProbeIndexFormula:' ) &&
			! exampleSource.includes( 'sourcePath: \'compute-written coefficientTarget-compatible rows\'' ) &&
			! exampleSource.includes( 'repackPath: \'_repackAtlas\'' ) &&
			! exampleSource.includes( 'adapterFallbackEvidenceRequired' ) &&
			runnerCoreAssertionsSource.includes( '\'adapterFallbackEvidenceRequired\'' ) &&
			! exampleSource.includes( 'coefficientPass,' ) &&
			! exampleSource.includes( 'atlasPass,' ) &&
			! exampleSource.includes( 'tolerancePass,' ) &&
			! exampleSource.includes( 'pass: maxDelta <= atlasTolerance' ) &&
			! exampleSource.includes( 'requiredParitySources' ) &&
			! exampleSource.includes( 'currentCoefficientWritesPerProbe' ) &&
			! exampleSource.includes( 'proposedCoefficientWritesPerProbe' ) &&
			! exampleSource.includes( 'fixtures: [ \'constant\', \'face-asymmetric\', \'axis-dominance\' ]' ) &&
			! exampleSource.includes( 'required: true' ) &&
			! exampleSource.includes( 'candidatePlanningAllowed' ) &&
			! exampleSource.includes( 'publicApiChangeAllowed' ) &&
			! exampleSource.includes( 'publicApiChanged' ) &&
			! exampleSource.includes( 'baselinePath:' ) &&
			! exampleSource.includes( 'candidatePath:' ) &&
			! exampleSource.includes( 'defaultPath:' ) &&
			! exampleSource.includes( 'selectedPath' ) &&
			! exampleSource.includes( 'computeRuntimeAllowed' ) &&
			! exampleSource.includes( 'fallbackUsed' ) &&
			! exampleSource.includes( 'resolveComputeProjectionFallbackDecision' ) &&
			! exampleSource.includes( 'runtime-implemented-adapter-supported' ) &&
			! exampleSource.includes( 'unsupported-compute-capability' ) &&
			! exampleSource.includes( 'unsupported-storage-texture-capability' ) &&
			runnerCoreAssertionsSource.includes( 'const hasProjectionParityContractFacts = contract =>' ) &&
			runnerCoreAssertionsSource.includes( 'hasProjectionParityContractFacts( computeProjectionParityContract )' ) &&
			runnerCoreAssertionsSource.includes( 'const hasComputeProjectionCandidateFacts = oracle =>' ) &&
			runnerCoreAssertionsSource.includes( 'hasComputeProjectionCandidateFacts( computeProjectionCandidateOracle )' ) &&
			runnerCoreAssertionsSource.includes( 'hasNoFields( oracle,' ) &&
			runnerCoreAssertionsSource.includes( '\'baselinePath\'' ) &&
			runnerCoreAssertionsSource.includes( 'const hasComputeProjectionAdapterFallbackFacts = oracle =>' ) &&
			runnerCoreAssertionsSource.includes( 'hasComputeProjectionAdapterFallbackFacts( computeProjectionAdapterFallbackOracle )' ) &&
			runnerCoreAssertionsSource.includes( '\'defaultPath\'' ) &&
			runnerCoreAssertionsSource.includes( 'const hasComputeProjectionAtlasRepackFacts = ( oracle, atlasPacking ) =>' ) &&
			runnerCoreAssertionsSource.includes( 'hasComputeProjectionAtlasRepackFacts( computeProjectionAtlasRepackOracle, atlasPacking )' ) &&
			! exampleSource.includes( 'promoted-supported-candidate' ) &&
			! exampleSource.includes( 'fragmentCoefficientProjectionSweepsPerProbe' ) &&
			! exampleSource.includes( 'computeProbeReductionSweepsPerProbe' ) &&
			! runnerCoreAssertionsSource.includes( 'computeProjectionCandidateOracle.fixtures.length' ) &&
			! runnerCoreAssertionsSource.includes( 'computeProjectionAdapterFallbackOracle.scenarios.some' ) &&
			runnerCoreAssertionsSource.includes( 'projectionParity.fixtures === undefined' ) &&
			runnerCoreAssertionsSource.includes( '\'fixtures\'' ) &&
			runnerCoreAssertionsSource.includes( '\'scenarios\'' ),
		'Projection and atlas diagnostics must keep promotion prose and unconsumed evidence narratives out of harness payloads.'
	);

	requireSource(
		exampleSource.includes( 'inspectProbeOccupancy' ) &&
			exampleSource.includes( 'solidProbeMeshes' ) &&
			exampleSource.includes( 'containsPoint' ) &&
			exampleSource.includes( 'probeIndex' ) &&
			browserHarnessSource.includes( 'occupiedProbeMeshHitCount' ) &&
			! browserHarnessSource.includes( '..._lightProbeContext.collectProbeOccupancy' ) &&
			runnerMatrixAssertionsSource.includes( 'const hasNoFields = ( object, ...fields )' ) &&
			runnerMatrixAssertionsSource.includes( 'hasNoFields( probeOccupancy, \'occupiedProbes\' )' ),
		'Cornell harness must diagnose probe centers that land inside solid scene geometry while exposing compact occupancy facts to the runner.'
	);

	requireSourceContract(
		'Cornell harness must expose compact sealed-wall leak proof facts without the old exploratory leak matrix lab.',
		[
			{
				sourceText: exampleSource,
				tokens: [
					'createLeakFixture',
					'setBaseCornellProbeMeshesVisible',
					'leakArtifactRegions',
					'createObjectCenterScreenRegion',
					'createObjectSurfaceScreenRegion',
					'captureLeakReceiverMaskedMetrics',
					'receiver-id-mask-visible-pixels',
					'maskedWrongSideColorRatio',
					'captureLeakRegionMetrics',
					'captureLeakProofFacts',
					'sealed-wall-validity-weighted',
					'sealed-wall-visibility-moments',
					'pre-tone-linear-output-masked-visible-pixels',
					'correctBounceRatio',
					'preToneMaskedWrongSideColorRatio',
					'preToneMaskedCorrectBounceRatio',
					'applyGroundingParitySnapshot',
					'restoreGroundingParitySnapshot'
				]
			},
			{
				sourceText: smokeRunnerSource,
				tokens: [
					'captureLeakProofFacts',
					'runLightProbeGridGpuProofGateAssertions'
				]
			},
			{
				sourceText: proofGatesSource,
				tokens: [
					'leak proof facts'
				]
			}
		]
	);

	requireSource(
		! exampleSource.includes( 'Compact sealed-wall leak proof facts for default verifier gates' ) &&
			! exampleSource.includes( 'SUPPORTED-BY-SEALED-FIXTURE' ) &&
			! exampleSource.includes( 'SUPPORTED-BY-PRE-TONE-MASKED-FIXTURE' ) &&
			! exampleSource.includes( 'presentationMetricMode:' ) &&
			! exampleSource.includes( 'linearPromotionMetricMode:' ) &&
			! browserHarnessSource.includes( 'receiverRegionMetricMode:' ) &&
			! browserHarnessSource.includes( 'preToneMetricMode:' ) &&
			! browserHarnessSource.includes( 'centerWrongSideColorRatio:' ) &&
			! browserHarnessSource.includes( 'centerCorrectBounceRatio:' ) &&
			! browserHarnessSource.includes( 'surfaceCorrectBounceRatio:' ) &&
			! browserHarnessSource.includes( 'maskedReceiverRegionMetricMode:' ) &&
			! browserHarnessSource.includes( 'sealedWall: {' ) &&
			! browserHarnessSource.includes( 'guardedVisibilityProofMode === \'guarded\' ? { visibilityDepth' ) &&
			! browserHarnessSource.includes( 'leakMetrics: createLeakProofMetricSnapshot' ) &&
			! browserHarnessSource.includes( 'preToneLeakMetrics: createLeakProofRendererMetricSnapshot' ) &&
			proofGatesSource.includes( 'const createSealedWallProofFacts = leakProofFacts =>' ) &&
			proofGatesSource.includes( 'baseline: createSealedWallRowFacts( rows.get( \'sealed-wall-validity-weighted\' ) )' ) &&
			proofGatesSource.includes( 'candidate: createSealedWallRowFacts( rows.get( \'sealed-wall-visibility-moments\' ) )' ) &&
			proofGatesSource.includes( 'const deriveSealedWallVisibilityFacts =' ) &&
			proofGatesSource.includes( 'const sealedWallVisibilityFacts = deriveSealedWallVisibilityFacts( facts.sealedWall )' ) &&
			proofGatesSource.includes( 'const actual = sealedWallVisibilityFacts[ metric ]' ) &&
			! proofGatesSource.includes( 'metric: \'wrongSideImprovement\'' ) &&
			! proofGatesSource.includes( 'metric: \'maskedWrongSideImprovement\'' ) &&
			! proofGatesSource.includes( 'wrongSideImprovement: improvementRatio' ) &&
			! proofGatesSource.includes( 'maskedWrongSideImprovement: improvementRatio' ) &&
			! proofGatesSource.includes( 'wrongSideImprovement: sealedWallVisibilityFacts.wrongSideImprovement' ) &&
			! proofGatesSource.includes( 'facts.sealedWall[ metric ]' ) &&
			runnerMatrixAssertionsSource.includes( 'const hasLeakProofFixtureFacts = leakProofFacts =>' ) &&
			runnerMatrixAssertionsSource.includes( 'hasLeakProofFixtureFacts( leakProofFacts )' ) &&
			runnerMatrixAssertionsSource.includes( 'hasNoFields( visibilityMoments, \'visibilityDepth\' )' ) &&
			runnerMatrixAssertionsSource.includes( '\'receiverRegionMetricMode\', \'preToneMetricMode\', \'proofBoundary\', \'sealedWall\'' ) &&
			runnerMatrixAssertionsSource.includes( 'const hasLeakProofRowFacts = row =>' ) &&
			runnerMatrixAssertionsSource.includes( 'hasLeakProofRowFacts( row )' ) &&
			runnerMatrixAssertionsSource.includes( '\'centerWrongSideColorRatio\'' ) &&
			runnerMatrixAssertionsSource.includes( '\'maskedReceiverRegionMetricMode\'' ) &&
			runnerMatrixAssertionsSource.includes( '\'leakMetrics\'' ) &&
			runnerMatrixAssertionsSource.includes( '\'preToneLeakMetrics\'' ) &&
			runnerMatrixAssertionsSource.includes( 'const hasLeakProofRestorationFacts = leakProofFacts =>' ) &&
			runnerMatrixAssertionsSource.includes( 'hasLeakProofRestorationFacts( leakProofFacts )' ),
		'Leak proof facts must keep promotion verdicts and nested metric snapshots out of the harness; sealed-wall gates own support thresholds.'
	);

	requireSource(
		! exampleSource.includes( 'runProbeLeakMatrix' ) &&
			! smokeRunnerSource.includes( 'runProbeLeakMatrix' ) &&
			! smokeRunnerSource.includes( 'captureLeakRegionMetrics' ),
		'Default smoke path must not expose the old leak matrix API or low-level leak metric sampler.'
	);





	requireSource(
		source.includes( 'scene.updateMatrixWorld( true )' ) &&
			source.includes( 'scene.matrixWorldAutoUpdate = false' ) &&
			source.includes( 'bakeState.shadowMap.autoUpdate = false' ) &&
			source.includes( 'bakeState.shadowMap.needsUpdate = true' ),
		'WebGPU probe baking must freeze scene transforms and shadow updates like the WebGL baseline.'
	);

	requireSource(
		source.includes( 'this.normalBias = uniform' ) &&
			source.includes( 'this.viewBias = uniform' ) &&
			source.includes( '_safeNormalize' ) &&
			source.includes( 'cameraPosition.sub( positionWorld )' ) &&
			source.includes( 'probePosition.sub( positionWorld )' ) &&
			source.includes( '.length().max( 0.0001 )' ) &&
			exampleSource.includes( 'normalBias: 0.5' ) &&
			exampleSource.includes( 'viewBias: 0' ),
		'Probe sampling must expose normal/view bias controls translated from DDGI/APV practice.'
	);

	requireSource(
		source.includes( 'this.leakReductionMode = this._validateLeakReductionMode' ) &&
			source.includes( 'this.probeValiditySource = this._validateProbeValidity' ) &&
			source.includes( 'this.probeValidityTexture' ) &&
			source.includes( '_createProbeValidityTexture()' ) &&
			source.includes( 'const recreateTexture = this.probeValidityTexture === null' ) &&
			source.includes( 'this.probeValidityTexture.image.data' ) &&
			source.includes( 'getSamplingInfo()' ) &&
			source.includes( '_usesWeightedProbeSampling()' ) &&
			source.includes( 'invalidProbeCount: this.invalidProbeCount' ) &&
			source.includes( 'probeValidityMode: this.probeValiditySource === null ? \'constant\' : \'custom\'' ) &&
			source.includes( 'wrapShading' ) &&
			source.includes( 'validityWeight' ) &&
			source.includes( 'textureLoad( this.probeValidityTexture' ) &&
			gpuAtlasSource.includes( 'PACKED_SH_COEFFICIENT_LAYOUT[ 6 ]' ) &&
			gpuAtlasSource.includes( 'validity.x' ) &&
			source.includes( 'c0Luminance' ) === false &&
			exampleSource.includes( 'createProbeValidityData' ) &&
			exampleSource.includes( 'leakReductionMode: \'off\'' ),
		'Probe sampling must expose scoped normal-weighted leak reduction with explicit validity metadata, without deriving validity from brightness.'
	);


	requireSource(
		lightProbeGridDocs.includes( 'WebGLRenderer](WebGLRenderer.html) baseline' ) &&
			lightProbeGridDocs.includes( '`LightProbeGridGPU` addon' ) &&
			lightProbeGridDocs.includes( 'proof-scoped' ) &&
			lightProbeGridDocs.includes( 'leak-audit diagnostics and literature lessons' ) &&
			lightProbeGridDocs.includes( 'production DDGI/APV parity' ) &&
			lightProbeGridDocs.includes( 'will be added at a later point' ) === false,
		'LightProbeGrid docs must stop claiming WebGPU support is purely future work while still marking the GPU addon proof-scoped.'
	);

	requireSource(
		source.includes( 'const nextLeakReductionMode = this._validateLeakReductionMode' ) &&
			source.includes( 'nextLeakReductionMode !== this.leakReductionMode' ),
		'Leak reduction mode must be treated as graph-shape state that recreates probe resources.'
	);

	requireSource(
		exampleSource.includes( 'const advancedFolder = gui.addFolder( \'Advanced\' )' ) &&
			exampleSource.includes( 'advancedFolder.close()' ) &&
			/advancedFolder\.add\( _lightProbeContext\.params, 'projectionPrecision', \[ 'auto', 'half float', 'float' \] \)/.test( exampleSource ) &&
			exampleSource.includes( '.name( \'helper exposure\' )' ) &&
			/gui\.add\( _lightProbeContext\.params, 'projectionPrecision', \[ 'half float', 'float', 'auto', 'float manual' \] \)/.test( exampleSource ) === false,
		'Cornell UI must keep debug precision and leak controls out of the primary probe workflow.'
	);

	requireSource(
		source.includes( 'this.activeProjectionPrecision = hasFloatFiltering ? \'float-linear\' : \'half-linear (fallback)\'' ) &&
			source.includes( 'requested === \'float manual\'' ) === false &&
			source.includes( 'this.projectionPrecision === \'float manual\'' ) === false,
		'Float precision must use hardware filtering when float32-filterable exists and half-float fallback otherwise, with no public float-manual precision mode.'
	);

	const addons = await fs.readFile( 'examples/jsm/Addons.js', 'utf8' );

	requireSource(
		addons.includes( 'lighting/LightProbeGridGPU.js' ),
		'LightProbeGridGPU must be exported from examples/jsm/Addons.js after the direct addon smoke path is stable.'
	);

}
