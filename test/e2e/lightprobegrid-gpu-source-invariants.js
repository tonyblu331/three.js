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
		oracleDiagnosticsSource,
		proofReadbackSource,
		gpuConstantsSource,
		gpuAtlasSource,
		cpuShMathSource,
		gpuResourcesSource,
		gpuProjectionSource,
		gpuAtlasRepackSource,
		gpuVisibilitySource,
		gpuHelperSource,
		gpuBakeSource,
		smokeRunnerSource,
		proofReportSource,
		proofVisibilitySource,
		proofResearchSectionsSource,
		proofMarkdownSource,
		proofDiagnosticsMarkdownSource,
		proofProgramMarkdownSource,
		proofProbeMarkdownSource,
		proofReceiverMarkdownSource,
		proofResearchMarkdownSource,
		artifactSource,
		artifactPerformanceAssertionsSource,
		imageMetricsSource,
		proofValidationSource,
		configSource,
		sourceInvariantSource,
		runnerCoreAssertionsSource,
		runnerVisibilityAssertionsSource,
		runnerVisibilityBaseAssertionsSource,
		runnerVisibilityProbeAssertionsSource,
		runnerVisibilityReceiverAssertionsSource,
		runnerVisibilityNormalAssertionsSource,
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
		fs.readFile( 'examples/jsm/lighting/LightProbeGridGPUOracleDiagnostics.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProofReadback.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUConstants.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlas.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUCpuShMath.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUResources.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProjection.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlasRepack.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUVisibility.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUHelper.js', 'utf8' ),
		fs.readFile( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUBake.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-smoke.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-report.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-visibility.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-research-sections.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-markdown.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-diagnostics-markdown.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-program-markdown.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-probe-markdown.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-receiver-markdown.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-research-markdown.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-artifacts.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-artifact-performance-assertions.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-image-metrics.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-proof-validation.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-smoke-config.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-source-invariants.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-runner-core-assertions.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-runner-visibility-assertions.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-runner-visibility-base-assertions.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-runner-visibility-probe-assertions.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-runner-visibility-receiver-assertions.js', 'utf8' ),
		fs.readFile( 'test/e2e/lightprobegrid-gpu-runner-visibility-normal-assertions.js', 'utf8' ),
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
${ oracleDiagnosticsSource }
${ cpuShMathSource }`;
	const e2eSource = `${ smokeRunnerSource }
${ proofReportSource }
${ proofVisibilitySource }
${ proofResearchSectionsSource }
${ proofMarkdownSource }
${ proofDiagnosticsMarkdownSource }
${ proofProgramMarkdownSource }
${ proofProbeMarkdownSource }
${ proofReceiverMarkdownSource }
${ proofResearchMarkdownSource }
${ artifactSource }
${ artifactPerformanceAssertionsSource }
${ imageMetricsSource }
${ proofValidationSource }
${ configSource }
${ sourceInvariantSource }
${ runnerCoreAssertionsSource }
${ runnerVisibilityAssertionsSource }
${ runnerVisibilityBaseAssertionsSource }
${ runnerVisibilityProbeAssertionsSource }
${ runnerVisibilityReceiverAssertionsSource }
${ runnerVisibilityNormalAssertionsSource }
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
			gpuAtlasRepackSource.includes( 'PACKED_SH_COEFFICIENT_LAYOUT' ) &&
			gpuAtlasRepackSource.includes( 'createLightProbeGridGPUPackedSHVector' ) &&
			gpuAtlasRepackSource.includes( 'getLightProbeGridGPUPackedSource' ),
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
			gpuAtlasRepackSource.includes( 'viewportCoordinate' ) &&
			/const ix = int\( floor\( viewportCoordinate\.x \) \)/.test( gpuAtlasRepackSource ) &&
			/const iy = int\( floor\( viewportCoordinate\.y \) \)/.test( gpuAtlasRepackSource ),
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

	requireSource(
		proofResearchSectionsSource.includes( 'computeProjectionDesignSketch' ) &&
			proofResearchSectionsSource.includes( 'DESIGN-SKETCH-IMPLEMENTED-AS-GUARDED-RUNTIME' ) &&
			proofResearchSectionsSource.includes( 'storageLayout' ) &&
			proofResearchSectionsSource.includes( 'reductionContract' ) &&
			proofResearchSectionsSource.includes( 'outputPackingContract' ) &&
			proofResearchSectionsSource.includes( 'parityTolerance' ) &&
			proofResearchSectionsSource.includes( 'fallbackBehavior' ) &&
			proofResearchSectionsSource.includes( 'architectureDiagram' ) &&
			proofMarkdownSource.includes( 'Compute Projection Design Sketch' ),
		'Proof report must include a guarded-runtime compute projection design sketch.'
	);

	requireSource(
		proofResearchSectionsSource.includes( 'computeProjectionParityEvidencePlan' ) &&
			proofResearchSectionsSource.includes( 'CAPTURED-RUNTIME-PARITY-EVIDENCE' ) &&
			proofResearchSectionsSource.includes( 'CAPTURED-PROOF-ONLY-RUNTIME-READBACK-PENDING' ) &&
			proofResearchSectionsSource.includes( 'compute-fixture-parity' ) &&
			proofResearchSectionsSource.includes( 'compute-atlas-repack-parity' ) &&
			proofResearchSectionsSource.includes( 'compute-adapter-fallback' ) &&
			proofResearchSectionsSource.includes( 'compute-runtime-readback-parity' ) &&
			proofMarkdownSource.includes( 'Compute Projection Parity Evidence Plan' ) &&
			artifactPerformanceAssertionsSource.includes( 'computeProjectionParityEvidencePlan' ),
		'Proof report must specify compute projection parity evidence shape including runtime readback before full promotion.'
	);

	requireSource(
		exampleSource.includes( 'projectSyntheticCubeFragmentCoefficientPath' ) &&
			exampleSource.includes( 'computeProjectionCandidateOracle' ) &&
			exampleSource.includes( 'PROOF-ONLY-MOCK-PARITY-PASSING' ) &&
			exampleSource.includes( 'does-not-promote-runtime' ) &&
			proofReportSource.includes( 'getSmokeStep( smokeResults, \'projection parity\' ).projectionParity' ) &&
			proofReportSource.includes( 'getSmokeStep( smokeResults, \'atlas packing\' ).atlasPacking' ) &&
			proofResearchSectionsSource.includes( 'computeProjectionCandidateOracle' ) &&
			proofMarkdownSource.includes( 'Compute Projection Candidate Oracle' ) &&
			artifactPerformanceAssertionsSource.includes( 'proof-only compute projection candidate oracle' ),
		'Proof harness must include an executable compute candidate oracle/mock before full runtime parity promotion.'
	);

	requireSource(
		exampleSource.includes( 'computeProjectionAtlasRepackOracle' ) &&
			exampleSource.includes( 'PROOF-ONLY-ATLAS-REPACK-PARITY-PASSING' ) &&
			exampleSource.includes( 'compute-written coefficientTarget-compatible rows' ) &&
			exampleSource.includes( 'openEvidenceAfterPass' ) &&
			proofResearchSectionsSource.includes( 'computeProjectionAtlasRepackOracle' ) &&
			proofResearchSectionsSource.includes( 'CAPTURED-PROOF-ONLY-ATLAS-REPACK-PASSING' ) &&
			proofMarkdownSource.includes( 'Compute Projection Atlas Repack Oracle' ) &&
			artifactPerformanceAssertionsSource.includes( 'proof-only compute atlas repack oracle' ),
		'Proof harness must capture compute atlas repack parity before adapter fallback is the only open compute projection evidence.'
	);

	requireSource(
		exampleSource.includes( 'inspectComputeProjectionRuntimeParity' ) &&
			exampleSource.includes( 'RUNTIME-PARITY-READBACK-PASSING' ) &&
			exampleSource.includes( 'coefficientMaxDelta' ) &&
			exampleSource.includes( 'atlasMaxDelta' ) &&
			exampleSource.includes( 'coefficientTolerance' ) &&
			exampleSource.includes( 'atlasTolerance' ) &&
			proofReportSource.includes( 'getSmokeStep( smokeResults, \'compute projection runtime parity\' ).computeProjectionRuntimeParity' ) &&
			proofResearchSectionsSource.includes( 'computeProjectionRuntimeParityEvidence' ) &&
			proofMarkdownSource.includes( 'Compute Projection Runtime Readback Parity' ) &&
			artifactPerformanceAssertionsSource.includes( 'computeProjectionRuntimeParityEvidence' ),
		'Proof harness must include browser/runtime compute-vs-fragment coefficient, atlas repack, and tolerance validation evidence.'
	);

	requireSource(
			source.includes( '_projectionBackendOverride' ) &&
			source.includes( '_setProjectionBackendOverrideForProfiling' ) &&
			source.includes( 'projectionBackendOverride' ) &&
			gpuBakeSource.includes( 'projectionTexelVisitReductionRatio' ) &&
			exampleSource.includes( 'inspectComputeProjectionProfiling' ) &&
			exampleSource.includes( 'DIAGNOSTIC-PROJECTION-PROFILE-CAPTURED' ) &&
			exampleSource.includes( 'DIAGNOSTIC-PROJECTION-PHASE-NON-GATED' ) &&
			exampleSource.includes( 'CAPTURED-NON-DETERMINISTIC-PERFORMANCE-NOW' ) &&
			source.includes( 'non-deterministic-performance-now' ) &&
			runnerCoreAssertionsSource.includes( 'call( \'inspectComputeProjectionProfiling\' )' ) &&
			proofReportSource.includes( 'getSmokeStep( smokeResults, \'compute projection profiling\' ).computeProjectionProfiling' ) &&
			proofResearchSectionsSource.includes( 'computeProjectionProfilingEvidence' ) &&
			proofMarkdownSource.includes( 'Compute Projection Diagnostic Profiling' ) &&
			artifactPerformanceAssertionsSource.includes( 'computeProjectionProfilingEvidence' ),
		'Compute projection profiling must expose a private force-fragment/force-compute diagnostic selector, static 9x work evidence, and non-gated timing artifacts.'
	);

	requireSource(
		cubeTextureNodeSource.includes( 'builder.shaderStage !== \'compute\'' ) &&
			cubeTextureNodeSource.includes( 'materialEnvRotation.mul( uvNode )' ) &&
			webgpuBuildSource.includes( 'builder.shaderStage !== \'compute\'' ) &&
			webgpuBuildSource.includes( 'materialEnvRotation.mul( uvNode )' ) &&
			runnerCoreAssertionsSource.includes( 'computeFallbackReason !== "Cannot read properties of null (reading \'environment\')"' ),
		'CubeTextureNode must keep explicit compute cubemap sampling from pulling scene/material environment rotation, and the runtime gate must reject null-environment fallback regressions.'
	);

	requireSource(
		exampleSource.includes( 'computeProjectionAdapterFallbackOracle' ) &&
			exampleSource.includes( 'RUNTIME-GUARDED-ADAPTER-FALLBACK-SPEC-PASSING' ) &&
			exampleSource.includes( 'runtime-implemented-adapter-supported' ) &&
			exampleSource.includes( 'unsupported-compute-capability' ) &&
			exampleSource.includes( 'unsupported-storage-texture-capability' ) &&
			exampleSource.includes( 'promoted-supported-candidate' ) &&
			proofResearchSectionsSource.includes( 'computeProjectionAdapterFallbackOracle' ) &&
			proofResearchSectionsSource.includes( 'CAPTURED-RUNTIME-GUARDED-ADAPTER-FALLBACK-PASSING' ) &&
			proofMarkdownSource.includes( 'Compute Projection Adapter Fallback Oracle' ) &&
			artifactPerformanceAssertionsSource.includes( 'guarded compute adapter fallback oracle' ),
		'Proof harness must capture guarded runtime adapter fallback evidence before full parity promotion.'
	);

	requireSource(
		proofResearchSectionsSource.includes( 'computeProjectionStatusTransitionGuard' ) &&
			proofResearchSectionsSource.includes( 'RUNTIME-PARITY-EVIDENCE-CAPTURED' ) &&
			proofResearchSectionsSource.includes( 'GUARDED-RUNTIME-IMPLEMENTED-PARITY-PENDING' ) &&
			proofResearchSectionsSource.includes( 'computeProjectionContractStatus' ) &&
			proofResearchSectionsSource.includes( 'allowedNextContractStatus' ) &&
			proofResearchSectionsSource.includes( 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY' ) &&
			proofResearchSectionsSource.includes( 'IMPLEMENTED-WITH-PARITY-EVIDENCE' ) &&
			proofResearchSectionsSource.includes( 'runtimeMarkersAllowed: computeProjectionContractStatus === \'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY\'' ) &&
			proofMarkdownSource.includes( 'Compute Projection Status Transition Guard' ) &&
			artifactPerformanceAssertionsSource.includes( 'computeProjectionStatusTransitionGuard' ),
		'Proof report must include a compute projection status transition guard for guarded runtime implementation and pending parity readback.'
	);

	requireSource(
		proofResearchSectionsSource.includes( 'computeProjectionCandidateImplementationDesign' ) &&
			proofResearchSectionsSource.includes( 'CANDIDATE-DESIGN-NOTE-PROOF-ONLY' ) &&
			proofResearchSectionsSource.includes( 'one logical dispatch group per probe' ) &&
			proofResearchSectionsSource.includes( 'per-probe workgroup/private accumulators' ) &&
			proofResearchSectionsSource.includes( 'compute-fixture-parity' ) &&
			proofResearchSectionsSource.includes( 'compute-atlas-repack-parity' ) &&
			proofResearchSectionsSource.includes( 'compute-adapter-fallback' ) &&
			proofMarkdownSource.includes( 'Compute Projection Candidate Implementation Design' ) &&
			artifactPerformanceAssertionsSource.includes( 'computeProjectionCandidateImplementationDesign' ),
		'Proof report must include a compute projection candidate implementation design note.'
	);

	requireSource(
		proofResearchSectionsSource.includes( 'computeProjectionImplementationReadinessChecklist' ) &&
			proofResearchSectionsSource.includes( 'RUNTIME-PARITY-READBACK-PASSING' ) &&
			proofResearchSectionsSource.includes( 'RUNTIME-IMPLEMENTED-PARITY-READBACK-PENDING' ) &&
			proofResearchSectionsSource.includes( 'proofOnlyDone' ) &&
			proofResearchSectionsSource.includes( 'runtimeDone: computeProjectionContractStatus === \'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY\'' ) &&
			proofResearchSectionsSource.includes( 'runtimeParityReadbackDone: computeProjectionRuntimeParityCaptured' ) &&
			proofResearchSectionsSource.includes( 'blockersBeforeRuntime' ) &&
			proofResearchSectionsSource.includes( 'wgsl-compute-entrypoint' ) &&
			proofResearchSectionsSource.includes( 'actual-runtime-parity-readback' ) &&
			proofResearchSectionsSource.includes( 'capability-guarded-runtime-branch' ) &&
			proofResearchSectionsSource.includes( 'public-api-compatibility' ) &&
			proofMarkdownSource.includes( 'Compute Projection Implementation Readiness Checklist' ) &&
			artifactPerformanceAssertionsSource.includes( 'computeProjectionImplementationReadinessChecklist' ),
		'Proof report must close compute projection implementation readiness with runtime code done and browser parity readback tracked.'
	);

	requireSource(
		proofResearchSectionsSource.includes( 'id: \'runtime-3\'' ) &&
			proofResearchSectionsSource.includes( 'IMPLEMENTED-WITH-PARITY-EVIDENCE' ) &&
			proofResearchSectionsSource.includes( 'RUNTIME-IMPLEMENTED-PARITY-READBACK-PENDING' ) &&
			proofResearchSectionsSource.includes( 'guarded TSL compute node now performs one cubemap sweep per probe' ) &&
			proofResearchSectionsSource.includes( 'passed browser readback against fragment coefficients plus atlas repack' ) &&
			proofResearchSectionsSource.includes( 'actual browser/runtime readback proves compute-probe-reduction' ),
		'Runtime-3 backlog must state guarded runtime code exists and full parity promotion is conditional on actual runtime readback.'
	);

	requireSource(
		proofResearchSectionsSource.includes( 'id: \'runtime-4\'' ) &&
			proofResearchSectionsSource.includes( 'RUNTIME-PARITY-READBACK-PASSING' ) &&
			proofResearchSectionsSource.includes( 'IMPLEMENTED-PARITY-READBACK-PENDING' ) &&
			proofResearchSectionsSource.includes( 'Candidate readiness now records completed proof-only phases, guarded runtime implementation' ) &&
			proofResearchSectionsSource.includes( 'passing actual runtime parity readback' ) &&
			proofResearchSectionsSource.includes( 'actual runtime parity readback passes' ),
		'Runtime-4 backlog must specify guarded implementation, passing runtime parity evidence, and retained fragment fallback.'
	);

	const computeProjectionRuntimeMarkersAllowed =
		proofResearchSectionsSource.includes( 'runtimeMarkersAllowed: computeProjectionContractStatus === \'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY\'' ) &&
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
		'LightProbeGridGPU runtime compute projection markers remain forbidden until computeProjectionStatusTransitionGuard allows guarded runtime markers under IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY.'
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
					'probeContentChromaStudy',
					'probeBakeContaminationMap',
					'Readback-only packed SH atlas coefficient contribution mirror',
					'Readback-only probe-content chroma audit',
					'Readback-only per-probe bake-content map',
					'createShBandDecomposition',
					'createShCoefficientContributionStudy',
					'dominantProbeCoefficientStudy',
					'raw SH coefficient/lobe contribution table',
					'createShDampingOracleStudy',
					'CPU-only SH damping oracle',
					'damp-dominant-coefficient-50',
					'createDominantProbePlacementStudy',
					'CPU-only dominant-probe placement/source oracle',
					'nearest-same-side-valid-away-from-divider',
					'L0/L1/L2 directional SH chroma',
					'runtime-final-mixed-coefficients-inverted-normal',
					'BAKED-SH-MIXED-COLOR-CONTAMINATION',
					'readProbeCoefficients',
					'receiverSurfaceQuadratureDiagnostic',
					'tensor-product-gauss-legendre-3x3-over-receiver-plane',
					'Proof-only receiver-surface quadrature over PlaneGeometry samples',
					'receiverGpuDebugDiagnostic',
					'receiverWhiteCalibration',
					'normalWorldReceiver',
					'positionWorldGridReceiver',
					'probeIrradianceScalar',
					'probeIrradianceVisibility',
					'probe${ debugMode.label }IrradianceTerm',
					'label: \'Scalar\'',
					'label: \'Visibility\'',
					'label: \'Final\'',
					'cpuLinearIrradianceTerms',
					'linear-rgb-probe-irradiance',
					'projected-receiver-surface-3x3-gpu-linear-irradiance-samples',
					'decodeCanvasColorToLinearIrradiance',
					'debugScales = [ 1, 0.25, 0.08, 0.02 ]',
					'projected-receiver-surface-3x3-point-samples',
					'createTightSurfacePointMetrics',
					'surfaceRuntimeWrongRatioMax',
					'surfaceCpuRenderDeltaMax',
					'cpuRenderAgreementAggregation',
					'receiver-max',
					'createCpuAggregationComparison',
					'LightProbeGridGPU.createIrradianceNode() * debugScale',
					'debugMode: \'finalIrradiance\'',
					'weightDebugScales = [ 1, 0.5 ]',
					'probeWeight${ debugMode.label }',
					'label: \'ScalarTotal\'',
					'label: \'VisibilityTotal\'',
					'label: \'VisibilityMix\'',
					'label: \'VisibilityOverScalar\'',
					'projected-receiver-surface-3x3-gpu-term-samples',
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
		'Cornell harness must expose precision, SH-band, validity, density, and local artifact diagnostics without adding primary UI knobs.',
		[
			{
				sourceText: exampleSource,
				tokens: [
					'createLocalArtifactMetric',
					'captureRegionArtifactMetrics',
					'runProbeArtifactRegionMatrix',
					'createLeakFixture',
					'isVisibleForProbeOccupancy',
					'setBaseCornellProbeMeshesVisible',
					'leakArtifactRegions',
					'createObjectCenterScreenRegion',
					'createObjectSurfaceScreenRegion',
					'captureLeakReceiverMaskedMetrics',
					'receiver-id-mask-visible-pixels',
					'maskedWrongSideColorRatio',
					'captureLeakRegionMetrics',
					'receiverRegionMetricMode',
					'centerWrongSideColorRatio',
					'surfaceWrongSideColorRatio',
					'runProbeLeakMatrix',
					'sealedDivider',
					'getActiveLeakDivider',
					'leak-thin-wall-unweighted',
					'leak-thin-wall-normal-weighted',
					'leak-thin-wall-validity-weighted',
					'leak-thin-wall-visibility-scaffold-disabled',
					'leak-sealed-wall-unweighted',
					'leak-sealed-wall-validity-weighted',
					'leak-sealed-wall-visibility-scaffold-disabled',
					'sealed-promotion-visibility-scaffold-disabled',
					'sealedWall',
					'improvement: sealedWrongSideImprovement',
					'leak-zero-thickness-visibility-scaffold-disabled',
					'visibility-disabled-control',
					'wrongSide: {',
					'delta: signedDelta',
					'readVisibilityDepthInfo()',
					'leak-zero-thickness-unweighted',
					'leak-zero-thickness-validity-weighted',
					'wrongSideColorRatio',
					'correctBounceRatio',
					'negativeControlStatus',
					'darkPixelRatio',
					'blackPixelRatio',
					'objectBlackTailRatio',
					'createBakeTexelBudget',
					'createObjectArtifactPressure',
					'antiRingingPolicy',
					'band1-damped-quality',
					'L0 preserved, L1=0.6, L2=0.55',
					'hardware-filtered-unweighted',
					'performance._now',
					'harness-wall-clock-fallback',
					'timingSource',
					'same-budget-artifact-pressure',
					'higher bake detail can expose low-order / 9-coefficient SH representation dark-tail/ringing artifacts',
					'redOverGreen',
					'greenOverRed',
					'low-res-damped',
					'low-res-unweighted',
					'low-res-validity-weighted',
					'groundingParitySnapshotCases',
					'webgpu-webgl-density-reference',
					'webgpu-webgl-density-shadowless',
					'webgpu-webgl-density-shadow-crisp',
					'webgpu-webgl-density-damped',
					'same-budget-shadow-control',
					'same-budget-direct-shadow-control',
					'same-budget-quality-candidate',
					'shadowMapSize: snapshotCase.shadowMapSize',
					'disableShadowsDuringBake: snapshotCase.disableShadowsDuringBake',
					'applyGroundingParitySnapshot',
					'restoreGroundingParitySnapshot',
					'shadows-off',
					'direct-off',
					'panel-hidden',
					'solids-hidden',
					'cubemap-16-l0-only',
					'cubemap-16-l0-l1',
					'cubemap-16-band1-0.6',
					'disableDirectLightDuringBake',
					'hideSolidGeometryDuringBake',
					'hideLightPanelDuringBake',
					'ceilingEmitter',
					'cellEdgeContrast',
					'runProbeDiagnosticMatrix',
					'l0-only',
					'l0-l1-l2',
					'leak-normal-constant-validity',
					'normalCustomToConstantDarkPixelRatioDelta',
					'resolution-6',
					'cubemap-32'
				]
			}
		]
	);

	requireSourceContract(
		'LightProbeGrid proof report must include research-proof claim/boundary/slices and proof-only attribution diagnostics.',
		[
			{
				sourceText: e2eSource,
				tokens: [
					'researchProofProgram',
					'wgpuLeakAuditStudy',
					'metricTaxonomyStudy',
					'webglLeakReferenceStudy',
					'researchRoadmapRevision',
					'WebGPU Leak Audit Study',
					'Metric Taxonomy Study',
					'Bounded WebGL Leak Reference',
					'Research / Literature Roadmap Revision',
					'Proof ledger decision',
					'Visibility weighting receiver diagnostic',
					'Sealed-wall receiver normal convention diagnostic',
					'Sealed-wall packed SH contribution interrogation',
					'Probe Content Chroma Study',
					'Probe Bake Contamination Map',
					'Dominant Probe Coefficient / Lobe Study',
					'SH Damping Oracle Study',
					'Dominant Probe Placement / Source Oracle',
					'Band responsibility counts',
					'render-metric mismatch',
					'CPU SH mirror must agree with at least one sealed receiver render metric within tolerance',
					'Escaped wrong-side probes',
				]
			}
		]
	);

	requireSourceContract(
		'LightProbeGrid proof report must spell out the SH math action and WebGPU pipeline boundary, not only screenshot metrics.',
		[
			{
				sourceText: e2eSource,
				tokens: [
					'mathAndPipelineDecision',
					'webgpuPipelineFlow',
					'GPU bake cubemaps -> GPU SH projection into packed atlas',
					'sampler-disabled manual loads / shader texture loads only for validity/normal-weighted rows',
					'same-budget band1-damped quality candidate',
					'same half-float atlas path'
				]
			}
		]
	);

	requireSourceContract(
		'LightProbeGrid proof report must include a candid labeled rating against SixteenStudio and the WebGL baseline.',
		[
			{
				sourceText: e2eSource,
				tokens: [
					'comparativeRating',
					'CANDID-EVIDENCE-RATING',
					'OURS-PROOF',
					'SIXTEEN-REF',
					'OPEN-DDGI-GAP',
					'best engineering proof candidate',
					'best visual/demo candidate',
					'neither wins on production DDGI/APV correctness'
				]
			}
		]
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
			gpuAtlasRepackSource.includes( 'PACKED_SH_COEFFICIENT_LAYOUT[ 6 ]' ) &&
			gpuAtlasRepackSource.includes( 'validity.x' ) &&
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
