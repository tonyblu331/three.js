import {
	getLightProbeGridGPUProbeCoord
} from './LightProbeGridGPUAtlas.js';
import {
	MAX_PROBE_LAYER_MASK
} from './LightProbeGridGPUConstants.js';

const LOCAL_CELL_SUPPORT_SIZE = 8;

const DEFAULT_PLACEMENT_POLICY = Object.freeze( {
	policyId: 'local-cell-placement-policy',
	requiredTargetSupportSize: LOCAL_CELL_SUPPORT_SIZE,
	requiredSourceSupportSize: LOCAL_CELL_SUPPORT_SIZE,
	minReplacementSlotCount: 1,
	minOccupiedReplacementSlotCount: 1,
	maxSourceOccupiedSupportCount: 0
} );

const DEFAULT_SOURCE_SELECTION_POLICY = Object.freeze( {
	policyId: 'side-shell-local-cell-source-policy',
	ranking: 'side-shell-topology-then-receiver-distance'
} );

const DEFAULT_OCCUPANCY_POLICY = Object.freeze( {
	policyId: 'solid-occupancy-validity'
} );

const PLACEMENT_POLICY_KEYS = new Set( Object.keys( DEFAULT_PLACEMENT_POLICY ) );
const SOURCE_SELECTION_POLICY_KEYS = new Set( Object.keys( DEFAULT_SOURCE_SELECTION_POLICY ) );
const OCCUPANCY_POLICY_KEYS = new Set( Object.keys( DEFAULT_OCCUPANCY_POLICY ) );

const validateVectorLike = ( value, label ) => {

	if ( value === null || value === undefined ||
		Number.isFinite( value.x ) === false ||
		Number.isFinite( value.y ) === false ||
		Number.isFinite( value.z ) === false ) {

		throw new Error( `LightProbeGridGPU: ${ label } must contain finite x, y, and z values.` );

	}

};

const validateResolution = resolution => {

	if ( ! Number.isInteger( resolution ) || resolution < 2 ) {

		throw new Error( 'LightProbeGridGPU: placement authoring resolution must be an integer greater than or equal to 2.' );

	}

	return resolution;

};

const validateMask = ( value, label ) => {

	if ( ! Number.isInteger( value ) || value < 0 || value > MAX_PROBE_LAYER_MASK ) {

		throw new Error( `LightProbeGridGPU: ${ label } must be an integer mask between 0 and 0x${ MAX_PROBE_LAYER_MASK.toString( 16 ).padStart( 6, '0' ) }.` );

	}

	return value;

};

const validateArrayLength = ( value, totalProbes, label ) => {

	if ( value !== null && value !== undefined && value.length !== totalProbes ) {

		throw new Error( `LightProbeGridGPU: ${ label } length must equal resolution^3 (${ totalProbes }).` );

	}

};

const validatePolicyKeys = ( policy, allowedKeys, label ) => {

	if ( policy === null || policy === undefined ) return;

	for ( const key of Object.keys( policy ) ) {

		if ( allowedKeys.has( key ) === false ) {

			throw new Error( `LightProbeGridGPU: ${ label } contains an unsupported field "${ key }".` );

		}

	}

};

const validateBaseProbeValidity = ( value, totalProbes ) => {

	validateArrayLength( value, totalProbes, 'baseProbeValidity' );

	if ( value === null || value === undefined ) return;

	for ( let i = 0; i < value.length; i ++ ) {

		const validity = value[ i ];

		if ( Number.isFinite( validity ) === false || validity < 0 || validity > 1 ) {

			throw new Error( 'LightProbeGridGPU: baseProbeValidity values must be finite numbers between 0 and 1.' );

		}

	}

};

const validateBaseProbeLayerMasks = ( value, totalProbes ) => {

	validateArrayLength( value, totalProbes, 'baseProbeLayerMasks' );

	if ( value === null || value === undefined ) return;

	for ( let i = 0; i < value.length; i ++ ) {

		validateMask( value[ i ], `baseProbeLayerMasks[${ i }]` );

	}

};

const validateSide = ( side, label ) => {

	if ( side !== 'left' && side !== 'right' ) {

		throw new Error( `LightProbeGridGPU: ${ label } side must be "left" or "right".` );

	}

};

const validateSupportProbe = ( probe, label, totalProbes ) => {

	if ( probe === null || probe === undefined ) {

		throw new Error( `LightProbeGridGPU: ${ label } entries must be objects.` );

	}

	if ( Number.isInteger( probe.probeIndex ) === false || probe.probeIndex < 0 || probe.probeIndex >= totalProbes ) {

		throw new Error( `LightProbeGridGPU: ${ label } entries must contain a valid probeIndex.` );

	}

	if ( typeof probe.occupied !== 'boolean' ) {

		throw new Error( `LightProbeGridGPU: ${ label } entries must contain an occupied boolean.` );

	}

};

const validateSupport = ( support, label, totalProbes ) => {

	for ( const probe of support ) {

		validateSupportProbe( probe, label, totalProbes );

	}

};

const validateLayerRule = rule => {

	if ( rule === null || rule === undefined ) {

		throw new Error( 'LightProbeGridGPU: layerRules entries must be objects.' );

	}

	if ( typeof rule.id !== 'string' || rule.id.length === 0 ) {

		throw new Error( 'LightProbeGridGPU: layer rule id must be a non-empty string.' );

	}

	validateSide( rule.side, 'layer rule' );
	validateMask( rule.boundaryLayerMask, 'layer rule boundaryLayerMask' );

};

const validateReceiverRegion = ( region, layerRules, totalProbes ) => {

	if ( region === null || region === undefined ) {

		throw new Error( 'LightProbeGridGPU: receiverRegions entries must be objects.' );

	}

	if ( typeof region.id !== 'string' || region.id.length === 0 ) {

		throw new Error( 'LightProbeGridGPU: receiver region id must be a non-empty string.' );

	}

	validateSide( region.side, 'receiver region' );
	validateMask( region.boundaryLayerMask, 'receiver region boundaryLayerMask' );

	if ( Array.isArray( region.targetSupport ) === false || Array.isArray( region.sourceSupport ) === false ) {

		throw new Error( 'LightProbeGridGPU: receiver region must provide targetSupport and sourceSupport arrays.' );

	}

	if ( layerRules.some( rule =>
		rule.side === region.side &&
		rule.boundaryLayerMask === region.boundaryLayerMask
	) === false ) {

		throw new Error( 'LightProbeGridGPU: receiver region must match a layer rule with the same side and boundaryLayerMask.' );

	}

	validateSupport( region.targetSupport, `${ region.id } targetSupport`, totalProbes );
	validateSupport( region.sourceSupport, `${ region.id } sourceSupport`, totalProbes );

};

const resolvePlacementPolicy = policy => {

	validatePolicyKeys( policy, PLACEMENT_POLICY_KEYS, 'placementPolicy' );

	const resolvedPolicy = {
		...DEFAULT_PLACEMENT_POLICY,
		...( policy ?? {} )
	};

	if ( resolvedPolicy.policyId !== DEFAULT_PLACEMENT_POLICY.policyId ) {

		throw new Error( 'LightProbeGridGPU: placementPolicy must match the supported local-cell placement policy facts.' );

	}

	if ( ! Number.isInteger( resolvedPolicy.requiredTargetSupportSize ) || resolvedPolicy.requiredTargetSupportSize < 1 ) {

		throw new Error( 'LightProbeGridGPU: requiredTargetSupportSize must be a positive integer.' );

	}

	if ( ! Number.isInteger( resolvedPolicy.requiredSourceSupportSize ) || resolvedPolicy.requiredSourceSupportSize < 1 ) {

		throw new Error( 'LightProbeGridGPU: requiredSourceSupportSize must be a positive integer.' );

	}

	if ( ! Number.isInteger( resolvedPolicy.minReplacementSlotCount ) || resolvedPolicy.minReplacementSlotCount < 0 ) {

		throw new Error( 'LightProbeGridGPU: minReplacementSlotCount must be a non-negative integer.' );

	}

	if ( ! Number.isInteger( resolvedPolicy.minOccupiedReplacementSlotCount ) || resolvedPolicy.minOccupiedReplacementSlotCount < 0 ) {

		throw new Error( 'LightProbeGridGPU: minOccupiedReplacementSlotCount must be a non-negative integer.' );

	}

	if ( ! Number.isInteger( resolvedPolicy.maxSourceOccupiedSupportCount ) || resolvedPolicy.maxSourceOccupiedSupportCount < 0 ) {

		throw new Error( 'LightProbeGridGPU: maxSourceOccupiedSupportCount must be a non-negative integer.' );

	}

	return resolvedPolicy;

};

const createSourceSelectionPolicyFacts = sourceSelectionPolicy => {

	validatePolicyKeys( sourceSelectionPolicy, SOURCE_SELECTION_POLICY_KEYS, 'sourceSelectionPolicy' );

	const resolvedPolicy = {
		...DEFAULT_SOURCE_SELECTION_POLICY,
		...( sourceSelectionPolicy ?? {} )
	};

	if ( resolvedPolicy.policyId !== DEFAULT_SOURCE_SELECTION_POLICY.policyId ||
		resolvedPolicy.ranking !== DEFAULT_SOURCE_SELECTION_POLICY.ranking ) {

		throw new Error( 'LightProbeGridGPU: sourceSelectionPolicy must match the supported local-cell source policy facts.' );

	}

	return resolvedPolicy;

};

const resolveOccupancyPolicyId = occupancyPolicy => {

	validatePolicyKeys( occupancyPolicy, OCCUPANCY_POLICY_KEYS, 'occupancyPolicy' );

	const resolvedPolicy = {
		...DEFAULT_OCCUPANCY_POLICY,
		...( occupancyPolicy ?? {} )
	};

	if ( resolvedPolicy.policyId !== DEFAULT_OCCUPANCY_POLICY.policyId ) {

		throw new Error( 'LightProbeGridGPU: occupancyPolicy must match the supported solid occupancy policy facts.' );

	}

	return resolvedPolicy.policyId;

};

const createHash = values => {

	let hash = 0x811c9dc5;

	for ( const value of values ) {

		hash ^= value;
		hash = Math.imul( hash, 0x01000193 );

	}

	return `fnv1a32:${ ( hash >>> 0 ).toString( 16 ).padStart( 8, '0' ) }`;

};

const createSupportIdentityHash = support => createHash( support.map( probe => probe.probeIndex + 1 ) );

const createSupportGridCoordHash = ( support, resolution ) => createHash( support.map( probe => {

	const coord = getLightProbeGridGPUProbeCoord( probe.probeIndex, resolution );

	return ( coord.x + 1 ) ^ ( ( coord.y + 1 ) << 8 ) ^ ( ( coord.z + 1 ) << 16 );

} ) );

const createSidePlacementFacts = ( region, resolution, placementPolicy ) => {

	const sourceIndices = new Set( region.sourceSupport.map( probe => probe.probeIndex ) );
	const targetIndices = new Set( region.targetSupport.map( probe => probe.probeIndex ) );
	const overlapCount = region.targetSupport.filter( probe => sourceIndices.has( probe.probeIndex ) ).length;
	const replacementSlotCount = region.targetSupport.length - overlapCount;
	const occupiedReplacementSlotCount = region.targetSupport.filter( probe =>
		sourceIndices.has( probe.probeIndex ) === false && probe.occupied === true
	).length;
	const sourceOutsideLocalCellCount = region.sourceSupport.filter( probe =>
		targetIndices.has( probe.probeIndex ) === false
	).length;
	const targetOccupiedSupportCount = region.targetSupport.filter( probe => probe.occupied === true ).length;
	const sourceOccupiedSupportCount = region.sourceSupport.filter( probe => probe.occupied === true ).length;
	const passesPolicy =
		region.targetSupport.length === placementPolicy.requiredTargetSupportSize &&
		region.sourceSupport.length === placementPolicy.requiredSourceSupportSize &&
		replacementSlotCount >= placementPolicy.minReplacementSlotCount &&
		occupiedReplacementSlotCount >= placementPolicy.minOccupiedReplacementSlotCount &&
		sourceOccupiedSupportCount <= placementPolicy.maxSourceOccupiedSupportCount;

	return {
		side: region.side,
		boundaryLayerMask: region.boundaryLayerMask,
		placementPolicyId: placementPolicy.policyId,
		targetSupportIdentityHash: createSupportIdentityHash( region.targetSupport ),
		targetSupportGridCoordHash: createSupportGridCoordHash( region.targetSupport, resolution ),
		sourceSupportIdentityHash: createSupportIdentityHash( region.sourceSupport ),
		sourceSupportGridCoordHash: createSupportGridCoordHash( region.sourceSupport, resolution ),
		targetSupportSize: region.targetSupport.length,
		sourceSupportSize: region.sourceSupport.length,
		overlapCount,
		replacementSlotCount,
		occupiedReplacementSlotCount,
		sourceOutsideLocalCellCount,
		targetOccupiedSupportCount,
		sourceOccupiedSupportCount,
		placementPolicyVerdict: passesPolicy ?
			'side-passes-local-cell-placement-policy' :
			'side-fails-local-cell-placement-policy'
	};

};

export const createLightProbeGridGPUPlacementAuthoring = ( {
	min,
	max,
	resolution,
	defaultLayerMask,
	receiverRegions = [],
	layerRules = [],
	occupancyPolicy = null,
	placementPolicy = null,
	sourceSelectionPolicy = null,
	baseProbeValidity = null,
	baseProbeLayerMasks = null
} = {} ) => {

	validateVectorLike( min, 'min' );
	validateVectorLike( max, 'max' );
	const resolvedResolution = validateResolution( resolution );
	const resolvedDefaultLayerMask = validateMask( defaultLayerMask, 'defaultLayerMask' );
	const totalProbes = resolvedResolution * resolvedResolution * resolvedResolution;
	const resolvedPlacementPolicy = resolvePlacementPolicy( placementPolicy );
	const resolvedOccupancyPolicyId = resolveOccupancyPolicyId( occupancyPolicy );

	if ( Array.isArray( receiverRegions ) === false ) {

		throw new Error( 'LightProbeGridGPU: receiverRegions must be an array.' );

	}

	if ( Array.isArray( layerRules ) === false ) {

		throw new Error( 'LightProbeGridGPU: layerRules must be an array.' );

	}

	validateBaseProbeValidity( baseProbeValidity, totalProbes );
	validateBaseProbeLayerMasks( baseProbeLayerMasks, totalProbes );

	for ( const rule of layerRules ) validateLayerRule( rule );
	for ( const region of receiverRegions ) validateReceiverRegion( region, layerRules, totalProbes );

	const probeValidity = baseProbeValidity === null || baseProbeValidity === undefined ?
		new Float32Array( totalProbes ).fill( 1 ) :
		Float32Array.from( baseProbeValidity );
	const probeLayerMasks = baseProbeLayerMasks === null || baseProbeLayerMasks === undefined ?
		new Uint32Array( totalProbes ).fill( resolvedDefaultLayerMask ) :
		Uint32Array.from( baseProbeLayerMasks );

	for ( const region of receiverRegions ) {

		for ( const probe of region.targetSupport ) {

			probeValidity[ probe.probeIndex ] = 1;
			probeLayerMasks[ probe.probeIndex ] = resolvedDefaultLayerMask | region.boundaryLayerMask;

		}

		const targetIndices = new Set( region.targetSupport.map( probe => probe.probeIndex ) );

		for ( const probe of region.sourceSupport ) {

			if ( targetIndices.has( probe.probeIndex ) === false ) probeValidity[ probe.probeIndex ] = 0;

		}

	}

	const sideFacts = receiverRegions.map( region =>
		createSidePlacementFacts( region, resolvedResolution, resolvedPlacementPolicy )
	);
	const replacementSlotCount = sideFacts.reduce( ( sum, side ) => sum + side.replacementSlotCount, 0 );
	const occupiedReplacementSlotCount = sideFacts.reduce( ( sum, side ) => sum + side.occupiedReplacementSlotCount, 0 );
	const acceptedSideCount = sideFacts.filter( side =>
		side.placementPolicyVerdict === 'side-passes-local-cell-placement-policy'
	).length;

	return {
		probeValidity,
		probeLayerMasks,
		placementFacts: {
			policyId: 'placement-authoring',
			placementPolicyFacts: resolvedPlacementPolicy,
			sourceSelectionPolicyFacts: createSourceSelectionPolicyFacts( sourceSelectionPolicy ),
			totalProbes,
			receiverRegionCount: receiverRegions.length,
			layerRuleCount: layerRules.length,
			sideCount: sideFacts.length,
			occupancyPolicyId: resolvedOccupancyPolicyId,
			acceptedSideCount,
			replacementSlotCount,
			occupiedReplacementSlotCount,
			sideFacts,
			placementVerdict: sideFacts.length > 0 && acceptedSideCount === sideFacts.length ?
				'placement-authoring-emits-arrays' :
				'placement-authoring-has-no-work'
		}
	};

};
