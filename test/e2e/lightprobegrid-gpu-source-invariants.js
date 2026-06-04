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

}

if ( process.argv[ 1 ]?.replace( /\\/g, '/' ).endsWith( '/lightprobegrid-gpu-source-invariants.js' ) === true ) {

	runLightProbeGridGpuSourceInvariantAssertions( {
		assert: ( condition, message ) => {

			if ( condition === false ) throw new Error( message );

		}
	} );
	console.log( 'LightProbeGridGPU source invariants passed.' );

}
