import { readFileSync } from 'node:fs';

const RUNTIME_LEAK_CONTROL_SOURCES = [
	'examples/jsm/lighting/LightProbeGridGPU.js',
	'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUConstants.js',
	'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUVisibility.js',
	'src/nodes/accessors/MaterialProperties.js'
];

const FORBIDDEN_RUNTIME_PATTERNS = [
	{
		policy: 'no-cornell-divider-runtime-logic',
		pattern: /\b(Cornell|near-divider|dividerX|receiver-near-divider|0\.42|0\.52|-0\.8667)\b/i
	},
	{
		policy: 'no-proof-pixel-runtime-logic',
		pattern: /\b(proofPixel|proof pixels|visible-pixels|masked-visible-pixels|screen-region|leakArtifactRegions|createObjectScreenRegion)\b/i
	},
	{
		policy: 'no-scalar-webgl-truth-runtime-logic',
		pattern: /\b((scalar|WebGL)[^\n]{0,80}truth|truth[^\n]{0,80}(scalar|WebGL))\b/i
	},
	{
		policy: 'no-cpu-readback-runtime-leak-control',
		pattern: /\b(readback|readPixels|copyTextureToBuffer|mapAsync|GPUMapMode)\b/i
	}
];

const readRuntimeSource = file => readFileSync( file, 'utf8' );
const readLightProbeGridGPUSource = () => readRuntimeSource( 'examples/jsm/lighting/LightProbeGridGPU.js' );
const readLightProbeGridGPUVisibilitySource = () => readRuntimeSource( 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUVisibility.js' );
const readLightProbeGridGPUTestHarnessSource = () => readRuntimeSource( 'test/e2e/lightprobegridgpu/LightProbeGridGPUTestHarness.js' );
const readLightProbeGridGPUProofReceiverScaffoldSource = () => readRuntimeSource( 'test/e2e/lightprobegrid-gpu-proof-receiver-scaffold.js' );

const extractFunctionSource = ( source, functionName ) => {

	const start = source.indexOf( `export const ${ functionName }` );
	if ( start === - 1 ) return '';

	const end = source.indexOf( '\n};', start );
	return end === - 1 ? source.slice( start ) : source.slice( start, end + 3 );

};

const extractSourceBetween = ( source, startPattern, endPattern ) => {

	const start = source.indexOf( startPattern );
	if ( start === - 1 ) return '';

	const end = source.indexOf( endPattern, start );
	return end === - 1 ? source.slice( start ) : source.slice( start, end );

};

export const LIGHTPROBEGRIDGPU_SOURCE_INVARIANT_POLICY = {
	policyId: 'lightprobegridgpu-runtime-leak-control-source-invariants',
	proofBoundary: 'node-side-source-scan',
	scannedFileCount: RUNTIME_LEAK_CONTROL_SOURCES.length,
	forbiddenPolicyCount: FORBIDDEN_RUNTIME_PATTERNS.length,
	forbiddenPolicies: FORBIDDEN_RUNTIME_PATTERNS.map( invariant => invariant.policy )
};

export function runLightProbeGridGpuSourceInvariantAssertions( { assert } ) {

	for ( const file of RUNTIME_LEAK_CONTROL_SOURCES ) {

		const source = readRuntimeSource( file );

		for ( const invariant of FORBIDDEN_RUNTIME_PATTERNS ) {

			assert(
				invariant.pattern.test( source ) === false,
				`source invariant ${ invariant.policy }: forbidden runtime leak-control dependency in ${ file }.`
			);

		}

	}

	const visibilitySource = readLightProbeGridGPUVisibilitySource();
	const momentVisibilitySource = extractFunctionSource( visibilitySource, 'getLightProbeGridGPUMomentVisibility' );
	const samplingStateSource = extractFunctionSource( visibilitySource, 'createLightProbeGridGPUVisibilitySamplingState' );
	const gridSource = readLightProbeGridGPUSource();
	const harnessSource = readLightProbeGridGPUTestHarnessSource();
	const proofReceiverScaffoldSource = readLightProbeGridGPUProofReceiverScaffoldSource();

	assert(
		momentVisibilitySource.includes( 'visibilityDepthWeighting' ) === false,
		'source invariant moment-visibility-raw: moment visibility must not apply runtime visibilityDepthWeighting.'
	);
	assert(
		samplingStateSource.includes( 'visibilityActive' ) === true &&
		samplingStateSource.includes( 'visibility.depthMode === \'moments\'' ) === true,
		'source invariant visibility-active-derived: guarded sampling must derive from active moment-backed visibility.'
	);
	assert(
		gridSource.includes( '_isVisibilityRuntimeActive()' ) === true &&
		gridSource.includes( 'this.quality === \'guarded\'' ) === true &&
		gridSource.includes( 'visibilityRuntimeActive: this._isVisibilityRuntimeActive()' ) === true &&
		gridSource.includes( 'active: this._isVisibilityRuntimeActive()' ) === true &&
		gridSource.includes( 'runtimeActive: this._isVisibilityRuntimeActive()' ) === true,
		'source invariant visibility-runtime-active-report: reports must expose the single derived runtime visibility truth.'
	);
	assert(
		visibilitySource.includes( 'texturePresent' ) === true &&
		visibilitySource.includes( 'resolution: this.depthResolution' ) === true &&
		harnessSource.includes( 'isActiveMomentVisibilityDepthInfo' ) === true &&
		harnessSource.includes( 'resolveProofCaseLabel' ) === true &&
		harnessSource.includes( 'label.replace( \'visibility-moments\', \'visibility-inactive\' )' ) === true,
		'source invariant visibility-fact-label-gating: reports must carry compact visibility facts and demote visibility-moments labels when active moment visibility is false.'
	);
	assert(
		proofReceiverScaffoldSource.includes( 'struct Receiver {' ) === true &&
		proofReceiverScaffoldSource.includes( 'struct ReceiverResult {' ) === true &&
		proofReceiverScaffoldSource.includes( 'fastIndirect' ) === true &&
		proofReceiverScaffoldSource.includes( 'guardedIndirect' ) === true &&
		proofReceiverScaffoldSource.includes( 'visibilityMass' ) === true &&
		proofReceiverScaffoldSource.includes( 'invalidContribution' ) === true &&
		proofReceiverScaffoldSource.includes( 'layerRejectedContribution' ) === true &&
		proofReceiverScaffoldSource.includes( 'momentVsScalarDelta' ) === true &&
		proofReceiverScaffoldSource.includes( 'StorageBufferAttribute' ) === true &&
		proofReceiverScaffoldSource.includes( 'createLightProbeGridGPUProofReceiverBuffers' ) === true &&
		proofReceiverScaffoldSource.includes( 'LIGHTPROBEGRIDGPU_PROOF_RECEIVER_LANES = 16' ) === true &&
		proofReceiverScaffoldSource.includes( 'LIGHTPROBEGRIDGPU_PROOF_RECEIVER_RESULT_LANES = 16' ) === true &&
		proofReceiverScaffoldSource.includes( 'implemented: false' ) === true &&
		harnessSource.includes( 'createLightProbeGridGPUProofReceiverScaffoldFacts' ) === true &&
		gridSource.includes( 'ProofReceiver' ) === false &&
		gridSource.includes( 'ReceiverResult' ) === false,
		'source invariant proof-receiver-scaffold-test-only: GPU receiver proof contract must exist in test/e2e and stay out of production runtime until implemented.'
	);
	assert(
		gridSource.includes( '_resolveQualityOption' ) === true &&
		gridSource.includes( '_getLeakReductionModeForQuality' ) === true &&
		gridSource.includes( 'quality: this.quality' ) === true,
		'source invariant quality-mode-shim: runtime sampling must expose quality while keeping legacy leak reduction mapping explicit.'
	);

	const createIrradianceNodeSource = extractSourceBetween(
		gridSource,
		'createIrradianceNode( options = {} )',
		'_safeNormalize( vector )'
	);
	const atlasIrradianceNodeSource = extractSourceBetween(
		gridSource,
		'_createAtlasIrradianceNode()',
		'_createManualIrradianceNode( options = {} )'
	);
	const guardedIrradianceNodeSource = extractSourceBetween(
		gridSource,
		'_createGuardedIrradianceNode( options = {} )',
		'_createManualIrradianceDebugNode( debugMode = \'finalIrradiance\', options = {} )'
	);
	const debugIrradianceNodeSource = extractSourceBetween(
		gridSource,
		'_createManualIrradianceDebugNode( debugMode = \'finalIrradiance\', options = {} )',
		'_evaluatePackedSH( s0, s1, s2, s3, s4, s5, s6 )'
	);

	assert(
		createIrradianceNodeSource.includes( '_usesManualIrradianceSampling() ? this._createManualIrradianceNode( options ) : this._createAtlasIrradianceNode()' ) === true,
		'source invariant fast-guarded-path-selection: createIrradianceNode must select fast atlas sampling before guarded manual sampling.'
	);
	assert(
		atlasIrradianceNodeSource.includes( 'createLightProbeGridGPUVisibilitySamplingState' ) === false &&
		atlasIrradianceNodeSource.includes( 'visibilitySampling' ) === false &&
		atlasIrradianceNodeSource.includes( 'loadProbeMeta' ) === false &&
		atlasIrradianceNodeSource.includes( 'debugProbe' ) === false &&
		atlasIrradianceNodeSource.includes( '_evaluatePackedSHProduction' ) === true &&
		atlasIrradianceNodeSource.includes( 'band1Intensity' ) === false &&
		atlasIrradianceNodeSource.includes( 'band2Intensity' ) === false,
		'source invariant fast-atlas-is-clean: fast atlas sampling must not depend on visibility, metadata, debug attribution, or band controls.'
	);
	assert(
		guardedIrradianceNodeSource.includes( 'kernelOffset' ) === false &&
		guardedIrradianceNodeSource.includes( '.negate().exp2()' ) === false &&
		guardedIrradianceNodeSource.includes( '.mul( compatibleKernel )' ) === false &&
		gridSource.includes( 'probeKernelMode: this._probeKernelData === null ? \'disabled\' : \'custom-data-ignored\'' ) === true,
		'source invariant no-compatible-kernel-v1: guarded production sampling must not apply the removed compatible ellipsoid kernel.'
	);
	assert(
		gridSource.includes( 'return this._createGuardedIrradianceNode( options );' ) === true &&
		guardedIrradianceNodeSource.includes( 'scalarSamples' ) === false &&
		guardedIrradianceNodeSource.includes( 'scalarIrradiance' ) === false &&
		guardedIrradianceNodeSource.includes( 'visibilityDepthWeighting' ) === false &&
		guardedIrradianceNodeSource.includes( 'debugProbe' ) === false &&
		guardedIrradianceNodeSource.includes( '_evaluatePackedSHProduction' ) === true &&
		guardedIrradianceNodeSource.includes( 'band1Intensity' ) === false &&
		guardedIrradianceNodeSource.includes( 'band2Intensity' ) === false &&
		guardedIrradianceNodeSource.includes( 'this._getRuntimeSoftProbeValidityWeight( meta )' ) === true &&
		guardedIrradianceNodeSource.includes( 'validityPolicy' ) === false &&
		guardedIrradianceNodeSource.includes( 'visibleWeightSum' ) === true &&
		guardedIrradianceNodeSource.includes( 'baseWeightSum' ) === true &&
		guardedIrradianceNodeSource.includes( 'return visibilityIrradiance.mul( visibilityMass );' ) === true,
		'source invariant boring-guarded-production-math: production guarded sampling must contain only weighted SH, visible/base sums, mass, and final SH eval.'
	);
	assert(
		guardedIrradianceNodeSource.includes( 'receiverBoundaryMode: \'select\'' ) === true &&
		guardedIrradianceNodeSource.includes( 'receiverBoundaryMode: options.receiverBoundaryMode' ) === false &&
		debugIrradianceNodeSource.includes( 'receiverBoundaryMode: options.receiverBoundaryMode' ) === true &&
		gridSource.includes( 'productionReceiverBoundaryMode: \'select\'' ) === true &&
		gridSource.includes( 'debugReceiverBoundaryModes: [ \'select\', \'blend\' ]' ) === true,
		'source invariant receiver-boundary-blend-debug-only: production guarded sampling must force select-only boundary compatibility while debug/proof may request blend.'
	);
	assert(
		debugIrradianceNodeSource.includes( 'scalarSamples' ) === true &&
		debugIrradianceNodeSource.includes( 'debugProbe' ) === true &&
		debugIrradianceNodeSource.includes( 'validityPolicy' ) === true &&
		debugIrradianceNodeSource.includes( 'this._getProbeValidityWeight( meta, validityPolicy )' ) === true &&
		debugIrradianceNodeSource.includes( '_evaluatePackedSH(' ) === true &&
		gridSource.includes( '_evaluatePackedSHWithBands( s0, s1, s2, s3, s4, s5, s6, this.band1Intensity, this.band2Intensity )' ) === true &&
		gridSource.includes( '_evaluatePackedSHWithBands( s0, s1, s2, s3, s4, s5, s6, float( 1 ), float( 1 ) )' ) === true,
		'source invariant debug-attribution-stays-debug: scalar and neighbor attribution must stay in the debug-only builder.'
	);
	assert(
		gridSource.includes( '_validateProbeValidityPolicy( policy )' ) === true &&
		gridSource.includes( 'policy === \'runtime-soft\' || policy === \'proof-strict\'' ) === true &&
		gridSource.includes( '_getRuntimeSoftProbeValidityWeight( meta )' ) === true &&
		gridSource.includes( 'return meta.x.max( PROBE_VALIDITY_FLOOR );' ) === true &&
		gridSource.includes( 'return validityPolicy === \'proof-strict\' ? meta.x : this._getRuntimeSoftProbeValidityWeight( meta );' ) === true &&
		gridSource.includes( 'debugValidityPolicies: [ \'runtime-soft\', \'proof-strict\' ]' ) === true,
		'source invariant validity-policy-split: production validity must stay runtime-soft while debug/proof can request proof-strict validity.'
	);

}

if ( process.argv[ 1 ]?.replace( /\\/g, '/' ).endsWith( '/lightprobegrid-gpu-source-invariants.js' ) === true ) {

	runLightProbeGridGpuSourceInvariantAssertions( {
		assert: ( condition, message ) => {

			if ( condition === false ) throw new Error( message );

		}
	} );
	console.log( 'LightProbeGridGPU source invariants passed.' );

}
