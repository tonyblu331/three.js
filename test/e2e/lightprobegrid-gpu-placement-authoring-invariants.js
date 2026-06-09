import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
	createLightProbeGridGPUPlacementAuthoring
} from '../../examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js';

const createSupport = ( start, occupiedStart = false ) => Array.from( { length: 8 }, ( _, offset ) => ( {
	probeIndex: start + offset,
	occupied: occupiedStart === true && offset < 4
} ) );

const createValidInput = () => ( {
	min: { x: -1, y: -1, z: -1 },
	max: { x: 1, y: 1, z: 1 },
	resolution: 4,
	defaultLayerMask: 1,
	layerRules: [
		{ id: 'left-boundary', side: 'left', boundaryLayerMask: 8 },
		{ id: 'right-boundary', side: 'right', boundaryLayerMask: 16 }
	],
	occupancyPolicy: {
		policyId: 'solid-occupancy-validity'
	},
	sourceSelectionPolicy: {
		policyId: 'side-shell-local-cell-source-policy'
	},
	receiverRegions: [
		{
			id: 'left-receiver-region',
			side: 'left',
			boundaryLayerMask: 8,
			targetSupport: createSupport( 0, true ),
			sourceSupport: createSupport( 8 )
		},
		{
			id: 'right-receiver-region',
			side: 'right',
			boundaryLayerMask: 16,
			targetSupport: createSupport( 16, true ),
			sourceSupport: createSupport( 24 )
		}
	]
} );

const PRODUCT_AUTHORING_MODULE = 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js';
const PRODUCT_LIGHTPROBEGRIDGPU_SOURCES = [
	'examples/jsm/lighting/LightProbeGridGPU.js',
	'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlas.js',
	'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUBake.js',
	'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUConstants.js',
	'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProjection.js',
	'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUVisibility.js',
	PRODUCT_AUTHORING_MODULE
];

const FORBIDDEN_PRODUCT_AUTHORING_PATTERNS = [
	{
		policy: 'no-test-helper-import-in-product-authoring',
		pattern: /\b(test\/e2e|LightProbeGridGPULocalCellPlacement)\b/
	},
	{
		policy: 'no-proof-boundary-product-authoring',
		pattern: /\b(proofBoundary|setup-helper-array-generation-only|product-shaped-setup-authoring-adapter)\b/
	},
	{
		policy: 'no-proof-input-product-authoring',
		pattern: /\b(cpu-l0-readback|proof-pixels|residual-ratios|scalar-webgl-truth)\b/
	}
];

const readExistingSource = file => existsSync( file ) ? readFileSync( file, 'utf8' ) : null;

const assertRejectsAuthoringInput = ( createAuthoring, mutate, expectedPattern ) => {

	const input = createValidInput();
	mutate( input );

	assert.throws(
		() => createAuthoring( input ),
		expectedPattern
	);

};

const assertPositiveAuthoringContract = ( createAuthoring, options = {} ) => {

	const result = createAuthoring( createValidInput() );

	assert.equal( result.probeValidity.length, 64 );
	assert.equal( result.probeLayerMasks.length, 64 );
	assert.equal( result.placementFacts.policyId, 'placement-authoring' );
	assert.equal( result.placementFacts.receiverRegionCount, 2 );
	assert.equal( result.placementFacts.layerRuleCount, 2 );
	assert.equal( result.placementFacts.occupancyPolicyId, 'solid-occupancy-validity' );
	assert.equal( result.placementFacts.acceptedSideCount, 2 );
	assert.equal( result.placementFacts.replacementSlotCount, 16 );
	assert.equal( result.placementFacts.occupiedReplacementSlotCount, 8 );
	assert.equal( result.placementFacts.sourceSelectionPolicyFacts.policyId, 'side-shell-local-cell-source-policy' );
	assert.equal( result.placementFacts.sourceSelectionPolicyFacts.ranking, 'side-shell-topology-then-receiver-distance' );

	if ( options.expectsProofSourcePolicyFacts === true ) {

		assert.deepEqual(
			result.placementFacts.sourceSelectionPolicyFacts.forbiddenInputs,
			[
				'cpu-l0-readback',
				'proof-pixels',
				'residual-ratios',
				'scalar-webgl-truth'
			]
		);

	} else {

		assert.equal( result.placementFacts.sourceSelectionPolicyFacts.forbiddenInputs, undefined );

	}

};

const assertProductAuthoringBaseArrayIntegration = () => {

	const input = createValidInput();
	const totalProbes = input.resolution * input.resolution * input.resolution;
	const baseProbeValidity = new Float32Array( totalProbes ).fill( 0.5 );
	const baseProbeLayerMasks = new Uint32Array( totalProbes ).fill( 4 );
	const result = createLightProbeGridGPUPlacementAuthoring( {
		...input,
		baseProbeValidity,
		baseProbeLayerMasks
	} );

	assert.equal( result.probeValidity[ 0 ], 1 );
	assert.equal( result.probeLayerMasks[ 0 ], 9 );
	assert.equal( result.probeValidity[ 8 ], 0 );
	assert.equal( result.probeLayerMasks[ 40 ], 4 );
	assert.equal( baseProbeValidity[ 0 ], 0.5 );
	assert.equal( baseProbeLayerMasks[ 0 ], 4 );

};

const assertRejectsInvalidAuthoringInputs = createAuthoring => {

	assertRejectsAuthoringInput(
		createAuthoring,
		input => input.sourceSelectionPolicy.policyId = 'cpu-l0-readback-source-policy',
		/sourceSelectionPolicy/
	);
	assertRejectsAuthoringInput(
		createAuthoring,
		input => input.sourceSelectionPolicy.ranking = 'proof-pixel-best-residual',
		/sourceSelectionPolicy/
	);
	assertRejectsAuthoringInput(
		createAuthoring,
		input => input.sourceSelectionPolicy.forbiddenInputs = [ 'cpu-l0-readback', 'proof-pixels' ],
		/sourceSelectionPolicy/
	);
	assertRejectsAuthoringInput(
		createAuthoring,
		input => input.placementPolicy = { proofOnlyField: true },
		/placementPolicy/
	);
	assertRejectsAuthoringInput(
		createAuthoring,
		input => input.placementPolicy = { policyId: 'proof-only-placement-policy' },
		/placementPolicy/
	);
	assertRejectsAuthoringInput(
		createAuthoring,
		input => input.occupancyPolicy = { proofOnlyField: true },
		/occupancyPolicy/
	);
	assertRejectsAuthoringInput(
		createAuthoring,
		input => input.occupancyPolicy = { policyId: 'cpu-l0-readback-occupancy-policy' },
		/occupancyPolicy/
	);
	assertRejectsAuthoringInput(
		createAuthoring,
		input => input.baseProbeValidity = new Float32Array( 64 ).fill( Number.NaN ),
		/baseProbeValidity/
	);
	assertRejectsAuthoringInput(
		createAuthoring,
		input => input.baseProbeLayerMasks = new Uint32Array( 64 ).fill( 0x1000000 ),
		/baseProbeLayerMasks/
	);
	assertRejectsAuthoringInput(
		createAuthoring,
		input => input.receiverRegions[ 0 ].boundaryLayerMask = 32,
		/match a layer rule/
	);
	assertRejectsAuthoringInput(
		createAuthoring,
		input => input.receiverRegions[ 0 ].targetSupport[ 0 ].probeIndex = 64,
		/valid probeIndex/
	);
	assertRejectsAuthoringInput(
		createAuthoring,
		input => delete input.receiverRegions[ 0 ].targetSupport[ 0 ].occupied,
		/occupied boolean/
	);
	assertRejectsAuthoringInput(
		createAuthoring,
		input => input.layerRules[ 0 ].side = 'center',
		/layer rule side/
	);

};

export const LIGHTPROBEGRIDGPU_PLACEMENT_AUTHORING_INVARIANT_POLICY = {
	policyId: 'lightprobegridgpu-placement-authoring-schema-invariants',
	proofBoundary: 'node-side-authoring-contract',
	positiveCaseCount: 1,
	productIntegrationCaseCount: 1,
	rejectedCaseCount: 13,
	migrationGuardPolicyId: 'lightprobegridgpu-placement-authoring-examples-jsm-migration-guard',
	productAuthoringModule: PRODUCT_AUTHORING_MODULE,
	forbiddenPolicies: [
		'no-cpu-l0-readback-source-policy',
		'no-proof-pixel-source-policy',
		'no-residual-ratio-source-policy',
		'no-scalar-webgl-truth-source-policy',
		'no-unmatched-receiver-region-layer-rule',
		'no-out-of-grid-support-probe',
		'no-implicit-occupancy-state',
		...FORBIDDEN_PRODUCT_AUTHORING_PATTERNS.map( invariant => invariant.policy )
	]
};

export function runLightProbeGridGpuPlacementAuthoringInvariantAssertions() {

	assertPositiveAuthoringContract( createLightProbeGridGPUPlacementAuthoring );
	assertProductAuthoringBaseArrayIntegration();
	assertRejectsInvalidAuthoringInputs( createLightProbeGridGPUPlacementAuthoring );

	for ( const file of PRODUCT_LIGHTPROBEGRIDGPU_SOURCES ) {

		const source = readExistingSource( file );

		if ( source === null ) continue;

		for ( const invariant of FORBIDDEN_PRODUCT_AUTHORING_PATTERNS ) {

			assert.equal(
				invariant.pattern.test( source ),
				false,
				`placement authoring migration guard ${ invariant.policy }: forbidden proof-scoped dependency in ${ file }.`
			);

		}

	}

}

if ( process.argv[ 1 ]?.replace( /\\/g, '/' ).endsWith( '/lightprobegrid-gpu-placement-authoring-invariants.js' ) === true ) {

	runLightProbeGridGpuPlacementAuthoringInvariantAssertions();
	console.log( 'LightProbeGridGPU placement authoring invariants passed.' );

}
