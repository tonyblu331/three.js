import { lightProbeWebGLReferenceLabel } from './lightprobegrid-gpu-smoke-config.js';
import { deriveVisibilityProofStatus, isMomentBackedVisibility } from './lightprobegrid-gpu-proof-visibility.js';
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
		gpuResourcesSource,
		gpuProjectionSource,
		gpuVisibilitySource,
		gpuHelperSource,
		gpuBakeSource,
		smokeRunnerSource,
		proofGatesSource,
		proofVisibilitySource,
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
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUResources.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProjection.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUVisibility.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUHelper.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUBake.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-smoke.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-gates.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-visibility.js', 'utf8' ),
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
${ proofVisibilitySource }
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
		{ available: false, mode: 'moments', texture: {}, bytes: 128, stats: { finiteSampleCount: 1, hitSampleCount: 1 } },
		{ available: true, mode: 'moments', texture: {}, bytes: 0, stats: { finiteSampleCount: 1, hitSampleCount: 1 } },
		{ available: true, mode: 'moments', texture: null, bytes: 128, stats: { finiteSampleCount: 1, hitSampleCount: 1 } }
	];

	requireSource(
		invalidMomentFixtures.every( fixture =>
			isMomentBackedVisibility( fixture ) === false &&
			deriveVisibilityProofStatus( fixture, 'SUPPORTED' ).visibilityLabel !== 'visibility-moments' &&
			deriveVisibilityProofStatus( fixture, 'SUPPORTED' ).ddgiStatus !== 'IMPLEMENTED-PRIVATE-DDGI-LITE-MOMENTS'
		) &&
			deriveVisibilityProofStatus( {
				available: true,
				mode: 'moments',
				texture: {},
				bytes: 128,
				stats: { finiteSampleCount: 1, hitSampleCount: 1 }
			}, 'OPEN' ).ddgiStatus !== 'IMPLEMENTED-PRIVATE-DDGI-LITE-MOMENTS',
		'Moment-backed visibility gate must reject available=false, bytes=0, texture=null, and raw OPEN evidence.'
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
			artifactSource.includes( 'assertLightProbeProofSummary' ) &&
			proofGatesSource.includes( 'MAX_PROOF_SUMMARY_BYTES' ) &&
			proofGatesSource.includes( 'MAX_PROOF_GATE_COUNT' ) &&
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
		gpuResourcesSource.includes( 'disposeLightProbeGridGPUFullscreenMesh' ) &&
			gpuResourcesSource.includes( 'mesh.geometry.dispose()' ) &&
			gpuResourcesSource.includes( 'helper.material.dispose()' ) &&
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
			source.includes( 'new InstancedMesh' ) === false &&
			source.includes( 'new SphereGeometry' ) === false &&
			source.includes( 'instanceIndex' ) === false &&
			gpuHelperSource.includes( 'createLightProbeGridGPUHelper' ) &&
			gpuHelperSource.includes( 'applyLightProbeGridGPUHelperDepthMode' ) &&
			gpuHelperSource.includes( 'new InstancedMesh' ) &&
			gpuHelperSource.includes( 'instanceIndex' ),
		'LightProbeGridGPU helper mesh/material/debug construction must live outside the runtime facade while runtime keeps public helper controls.'
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
				/atlasLoad\.load\( getPackedAtlasLoadCoord/.test( gpuHelperSource )
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
			exampleSource.includes( 'band2Intensity: 0.55' ),
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
			exampleSource.includes( 'requiredPromotionEvidence' ) &&
			exampleSource.includes( 'REQUIRED-BEFORE-FULL-PARITY-PROMOTION' ) &&
			exampleSource.includes( 'status: \'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY\'' ) &&
			exampleSource.includes( 'previousStatus: \'PARITY-CANDIDATE-NOT-RUNTIME\'' ) &&
			exampleSource.includes( 'candidatePlanningAllowed: true' ) &&
			exampleSource.includes( 'runtimeMarkersAllowed: true' ) &&
			exampleSource.includes( 'PENDING-BROWSER-E2E' ) &&
			exampleSource.includes( 'PARITY-CANDIDATE-NOT-RUNTIME' ) &&
			exampleSource.includes( 'IMPLEMENTED-WITH-PARITY-EVIDENCE' ),
		'Cornell harness must include a synthetic cubemap projection parity fixture and a guarded runtime compute projection parity contract with fragment fallback.'
	);

	const computeProjectionRuntimeMarkersAllowed =
		exampleSource.includes( 'runtimeMarkersAllowed: true' ) &&
		exampleSource.includes( 'status: \'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY\'' );
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
			exampleSource.includes( 'axisDominance' ) &&
			exampleSource.includes( 'runtime clamps only after all bands are summed' ),
		'Cornell harness must include an executable SH math contract for projection normalization, irradiance convolution, axis signs, and runtime clamp order.'
	);

	requireSource(
		exampleSource.includes( 'inspectAtlasPacking' ) &&
			proofReadbackSource.includes( 'readLightProbeGridGPUDecodedPackedAtlasPixel' ) &&
			exampleSource.includes( 'coefficientPacking' ) &&
			exampleSource.includes( 'leading-padding-validity-t6' ) &&
			exampleSource.includes( 'gridProbeIndexFormula' ) &&
			exampleSource.includes( 'centerSampleZ' ),
		'Cornell harness must include an executable atlas packing, padding, validity-channel, and Y-orientation verifier.'
	);

	requireSource(
		exampleSource.includes( 'inspectVisibilityDepthMoments' ) &&
			exampleSource.includes( 'readVisibilityDepthInfo()' ) &&
			exampleSource.includes( 'return probeGrid.getVisibilityDepthInfo();' ) &&
			exampleSource.includes( 'visibilityDepthTarget' ) &&
			exampleSource.includes( 'info.mode !== \'moments\'' ) &&
			exampleSource.includes( 'meanDistance' ) &&
			exampleSource.includes( 'variance' ) &&
			proofReadbackSource.includes( 'readLightProbeGridGPUVisibilityMomentPixel' ) &&
			proofReadbackSource.includes( 'decodeLightProbeGridGPUVisibilityMoment' ) &&
			exampleSource.includes( 'readback-only verifier for private DDGI-lite visibility/depth moments' ),
		'Cornell harness must directly inspect the private visibilityDepthTarget and call probeGrid.getVisibilityDepthInfo() for moment-backed proof gates.'
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
		proofVisibilitySource.includes( 'export function isMomentBackedVisibility( info )' ) &&
			proofVisibilitySource.includes( 'info.available === true' ) &&
			proofVisibilitySource.includes( 'info.mode === \'moments\'' ) &&
			proofVisibilitySource.includes( 'info.texture !== null' ) &&
			proofVisibilitySource.includes( 'info.bytes > 0' ) &&
			proofVisibilitySource.includes( 'info.stats.finiteSampleCount > 0' ) &&
			proofVisibilitySource.includes( 'info.stats.hitSampleCount > 0' ) &&
			proofVisibilitySource.includes( 'visibilityLabel: momentBacked ? \'visibility-moments\' : \'visibility-scaffold-disabled\'' ) &&
			proofVisibilitySource.includes( 'ddgiStatus: momentBacked && rawOpen === false ?' ) &&
			e2eSource.includes( 'buildExecuted: false' ) &&
			e2eSource.includes( 'OPEN-COLOR-MAPPING' ),
		'Proof helpers must gate visibility-moments and IMPLEMENTED-PRIVATE-DDGI-LITE-MOMENTS on strict moment-backed evidence, and report open color mapping honestly.'
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
					'CPU mirror of current shader weighting for thin-wall receiver centers',
					'CPU mirror of current shader weighting for sealed-wall receiver centers',
					'currentVisibilityBiasScale = 1',
					'hitConfidenceThreshold = 0.5',
					'OPEN-CORRECT-SIDE-SUPPRESSED',
					'interrogationFinding',
					'dominantEscapeReason',
					'shContributionDiagnostic',
					'Readback-only packed SH atlas coefficient contribution mirror',
					'runtime-final-mixed-coefficients-inverted-normal',
					'BAKED-SH-MIXED-COLOR-CONTAMINATION',
					'readProbeCoefficients',
					'receiverSurfaceQuadratureDiagnostic',
					'tensor-product-gauss-legendre-3x3-over-receiver-plane',
					'Proof-only receiver-surface quadrature over PlaneGeometry samples',
					'receiverGpuDebugDiagnostic',
					'bestTightPointSurfaceCpuDelta',
					'bestLinearIrradianceDeltaMean',
					'linearIrradianceAgreementGate',
					'weightTermAgreementGate',
					'receiverWhiteCalibration',
					'surfaceRuntimeWrongRatioMax',
					'surfaceCpuRenderDeltaMax',
					'cpuRenderAgreementAggregation',
					'receiver-max',
					'_getPackedAtlasLayer',
					'comparableReceiverCount',
					'wrongMinusCorrectSuppression',
					'escapeClassification',
					'escapedProbes',
					'octaTexel',
					'crossesDivider',
					'auditDividerSegment',
					'surfaceSegmentDividerAudit',
					'front-edge-bypass',
					'inspectLeakReceiverNormalConvention',
					'normalWorld.normalize().mul( 0.5 ).add( 0.5 )',
					'OPEN-NORMAL-CONVENTION-MISMATCH'
				]
			}
		]
	);

	requireSource(
		exampleSource.includes( 'inspectProbeOccupancy' ) &&
			exampleSource.includes( 'solidProbeMeshes' ) &&
			exampleSource.includes( 'containsPoint' ) &&
			exampleSource.includes( 'probeIndex' ),
		'Cornell harness must diagnose probe centers that land inside solid scene geometry before adding DDGI-style validity.'
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
					'Compact sealed-wall leak proof facts for default verifier gates',
					'pre-tone-linear-output-masked-visible-pixels',
					'SUPPORTED-BY-PRE-TONE-MASKED-FIXTURE',
					'correctBounceRatio',
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
