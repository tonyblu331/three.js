import {
	getLightProbeGridGPUProbeCoord
} from '../../../examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlas.js';

const MAX_PROBE_LAYER_MASK = 0xFFFFFF;
const LOCAL_CELL_SUPPORT_SIZE = 8;

const DEFAULT_LOCAL_CELL_PLACEMENT_POLICY = Object.freeze( {
	policyId: 'local-cell-placement-policy',
	requiredTargetSupportSize: LOCAL_CELL_SUPPORT_SIZE,
	requiredSourceSupportSize: LOCAL_CELL_SUPPORT_SIZE,
	minReplacementSlotCount: 1,
	minOccupiedReplacementSlotCount: 1,
	maxSourceOccupiedSupportCount: 0
} );

const validateResolution = resolution => {

	if ( ! Number.isInteger( resolution ) || resolution < 2 ) {

		throw new Error( 'LightProbeGridGPU: local-cell placement resolution must be an integer greater than or equal to 2.' );

	}

	return resolution;

};

const validateMask = ( value, label ) => {

	if ( ! Number.isInteger( value ) || value < 0 || value > MAX_PROBE_LAYER_MASK ) {

		throw new Error( `LightProbeGridGPU: ${ label } must be an integer mask between 0 and 0xFFFFFF.` );

	}

	return value;

};

const validateArrayLength = ( value, totalProbes, label ) => {

	if ( value !== null && value !== undefined && value.length !== totalProbes ) {

		throw new Error( `LightProbeGridGPU: ${ label } length must equal resolution^3 (${ totalProbes }).` );

	}

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

const resolvePlacementPolicy = policy => {

	const resolvedPolicy = {
		...DEFAULT_LOCAL_CELL_PLACEMENT_POLICY,
		...( policy ?? {} )
	};

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

const createSidePlacementFacts = ( placement, resolution, placementPolicy ) => {

	const targetSupport = placement.targetSupport ?? [];
	const sourceSupport = placement.sourceSupport ?? [];
	const sourceIndices = new Set( sourceSupport.map( probe => probe.probeIndex ) );
	const targetIndices = new Set( targetSupport.map( probe => probe.probeIndex ) );
	const overlapCount = targetSupport.filter( probe => sourceIndices.has( probe.probeIndex ) ).length;
	const replacementSlotCount = targetSupport.length - overlapCount;
	const occupiedReplacementSlotCount = targetSupport.filter( probe =>
		sourceIndices.has( probe.probeIndex ) === false && probe.occupied === true
	).length;
	const sourceOutsideLocalCellCount = sourceSupport.filter( probe =>
		targetIndices.has( probe.probeIndex ) === false
	).length;
	const targetOccupiedSupportCount = targetSupport.filter( probe => probe.occupied === true ).length;
	const sourceOccupiedSupportCount = sourceSupport.filter( probe => probe.occupied === true ).length;
	const passesPolicy =
		targetSupport.length === placementPolicy.requiredTargetSupportSize &&
		sourceSupport.length === placementPolicy.requiredSourceSupportSize &&
		replacementSlotCount >= placementPolicy.minReplacementSlotCount &&
		occupiedReplacementSlotCount >= placementPolicy.minOccupiedReplacementSlotCount &&
		sourceOccupiedSupportCount <= placementPolicy.maxSourceOccupiedSupportCount;

	return {
		side: placement.side,
		boundaryLayerMask: placement.boundaryLayerMask,
		placementPolicyId: placementPolicy.policyId,
		targetSupportIdentityHash: createSupportIdentityHash( targetSupport ),
		targetSupportGridCoordHash: createSupportGridCoordHash( targetSupport, resolution ),
		sourceSupportIdentityHash: createSupportIdentityHash( sourceSupport ),
		sourceSupportGridCoordHash: createSupportGridCoordHash( sourceSupport, resolution ),
		targetSupportSize: targetSupport.length,
		sourceSupportSize: sourceSupport.length,
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

export const createLightProbeGridGPULocalCellPlacement = ( {
	resolution,
	defaultMask,
	baseProbeValidity = null,
	baseProbeLayerMasks = null,
	placementPolicy = null,
	placements = []
} = {} ) => {

	const resolvedResolution = validateResolution( resolution );
	const resolvedDefaultMask = validateMask( defaultMask, 'defaultMask' );
	const resolvedPlacementPolicy = resolvePlacementPolicy( placementPolicy );
	const totalProbes = resolvedResolution * resolvedResolution * resolvedResolution;

	validateArrayLength( baseProbeValidity, totalProbes, 'baseProbeValidity' );
	validateArrayLength( baseProbeLayerMasks, totalProbes, 'baseProbeLayerMasks' );

	const probeValidity = baseProbeValidity === null || baseProbeValidity === undefined ?
		new Float32Array( totalProbes ).fill( 1 ) :
		Float32Array.from( baseProbeValidity );
	const probeLayerMasks = baseProbeLayerMasks === null || baseProbeLayerMasks === undefined ?
		new Uint32Array( totalProbes ).fill( resolvedDefaultMask ) :
		Uint32Array.from( baseProbeLayerMasks );
	const sideFacts = [];

	for ( const placement of placements ) {

		validateMask( placement.boundaryLayerMask, `${ placement.side } boundaryLayerMask` );

		for ( const probe of placement.targetSupport ?? [] ) {

			probeValidity[ probe.probeIndex ] = 1;
			probeLayerMasks[ probe.probeIndex ] = resolvedDefaultMask | placement.boundaryLayerMask;

		}

		for ( const probe of placement.sourceSupport ?? [] ) {

			if ( ( placement.targetSupport ?? [] ).some( target => target.probeIndex === probe.probeIndex ) === false ) {

				probeValidity[ probe.probeIndex ] = 0;

			}

		}

		sideFacts.push( createSidePlacementFacts( placement, resolvedResolution, resolvedPlacementPolicy ) );

	}

	const replacementSlotCount = sideFacts.reduce( ( sum, side ) => sum + side.replacementSlotCount, 0 );
	const occupiedReplacementSlotCount = sideFacts.reduce( ( sum, side ) => sum + side.occupiedReplacementSlotCount, 0 );
	const acceptedSideCount = sideFacts.filter( side =>
		side.placementPolicyVerdict === 'side-passes-local-cell-placement-policy'
	).length;

	return {
		probeValidity,
		probeLayerMasks,
		placementFacts: {
			policyId: 'local-cell-placement',
			proofBoundary: 'setup-helper-array-generation-only',
			placementPolicyFacts: resolvedPlacementPolicy,
			totalProbes,
			sideCount: sideFacts.length,
			acceptedSideCount,
			replacementSlotCount,
			occupiedReplacementSlotCount,
			sideFacts,
			placementVerdict: sideFacts.length > 0 && acceptedSideCount === sideFacts.length ?
				'helper-emits-local-cell-placement-arrays' :
				'helper-has-no-local-cell-placement-work'
		}
	};

};
