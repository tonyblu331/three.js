import {
	Box3,
	Vector3
} from 'three/webgpu';

import {
	DEFAULT_PROBE_LAYER_MASK
} from './LightProbeGridGPUConstants.js';
import {
	getLightProbeGridGPUProbeCoord
} from './LightProbeGridGPUAtlas.js';

const MAX_PROBE_LAYER_MASK = 0xFFFFFF;

const _probePosition = /*@__PURE__*/ new Vector3();
const _boxMin = /*@__PURE__*/ new Vector3();
const _boxMax = /*@__PURE__*/ new Vector3();

const validateProbeOwnershipMask = ( value, label ) => {

	if ( ! Number.isInteger( value ) || value < 0 || value > MAX_PROBE_LAYER_MASK ) {

		throw new Error( `LightProbeGridGPU: ${ label } must be an integer mask between 0 and 0xFFFFFF.` );

	}

	return value;

};

const createProbeOwnershipBox = ( box, label ) => {

	const source = box?.isBox3 === true ? box : new Box3(
		_boxMin.copy( box?.min ?? {} ),
		_boxMax.copy( box?.max ?? {} )
	);

	if (
		Number.isFinite( source.min.x ) === false ||
		Number.isFinite( source.min.y ) === false ||
		Number.isFinite( source.min.z ) === false ||
		Number.isFinite( source.max.x ) === false ||
		Number.isFinite( source.max.y ) === false ||
		Number.isFinite( source.max.z ) === false ||
		source.isEmpty()
	) {

		throw new Error( `LightProbeGridGPU: ${ label } must be a finite non-empty Box3 or min/max pair.` );

	}

	return source.clone();

};

const getProbeOwnershipPosition = ( index, resolution, min, max, target ) => {

	const coord = getLightProbeGridGPUProbeCoord( index, resolution );
	const denominator = resolution - 1;

	return target.set(
		min.x + coord.x * ( max.x - min.x ) / denominator,
		min.y + coord.y * ( max.y - min.y ) / denominator,
		min.z + coord.z * ( max.z - min.z ) / denominator
	);

};

const createProbeOwnershipRuleFacts = ( rules ) => rules.map( ( rule ) => ( {
	name: rule.name,
	assignedProbeCount: rule.assignedProbeCount
} ) );

export const createLightProbeGridGPUProbeOwnershipAssignment = ( {
	min,
	max,
	resolution,
	defaultMask = DEFAULT_PROBE_LAYER_MASK,
	layerRules = [],
	regionRules = []
} = {} ) => {

	if ( min === undefined || max === undefined ) {

		throw new Error( 'LightProbeGridGPU: probe ownership assignment requires min and max grid bounds.' );

	}

	if ( ! Number.isInteger( resolution ) || resolution < 2 ) {

		throw new Error( 'LightProbeGridGPU: probe ownership assignment resolution must be an integer greater than or equal to 2.' );

	}

	validateProbeOwnershipMask( defaultMask, 'defaultMask' );

	const layerRuleMap = new Map();
	const ruleNames = new Set();
	const normalizedLayerRules = layerRules.map( ( rule, index ) => {

		const name = rule?.name;

		if ( typeof name !== 'string' || name.length === 0 ) {

			throw new Error( `LightProbeGridGPU: layerRules[${ index }].name must be a non-empty string.` );

		}

		if ( ruleNames.has( name ) ) {

			throw new Error( `LightProbeGridGPU: duplicate ownership rule name "${ name }".` );

		}

		ruleNames.add( name );

		validateProbeOwnershipMask(
			rule.layerMask,
			`layerRules[${ index }].layerMask`
		);
		const ownershipMask = validateProbeOwnershipMask(
			rule.ownershipMask,
			`layerRules[${ index }].ownershipMask`
		);
		const resolvedMask = rule.defaultCompatible === true ? ownershipMask | defaultMask : ownershipMask;
		const normalizedRule = {
			name,
			ownershipMask,
			resolvedMask,
			assignedProbeCount: 0,
			bound: false
		};

		layerRuleMap.set( name, normalizedRule );

		return normalizedRule;

	} );

	const normalizedRegionRules = regionRules.map( ( rule, index ) => {

		const name = rule?.name;

		if ( typeof name !== 'string' || name.length === 0 ) {

			throw new Error( `LightProbeGridGPU: regionRules[${ index }].name must be a non-empty string.` );

		}

		if ( ruleNames.has( name ) ) {

			throw new Error( `LightProbeGridGPU: duplicate ownership rule name "${ name }".` );

		}

		ruleNames.add( name );

		const boundLayerRule = rule.layerRuleName !== undefined ? layerRuleMap.get( rule.layerRuleName ) : null;

		if ( rule.layerRuleName !== undefined && boundLayerRule === undefined ) {

			throw new Error( `LightProbeGridGPU: regionRules[${ index }].layerRuleName must reference a layer rule.` );

		}

		const directOwnershipMask = rule.ownershipMask !== undefined ?
			validateProbeOwnershipMask( rule.ownershipMask, `regionRules[${ index }].ownershipMask` ) :
			null;

		if ( boundLayerRule === null && directOwnershipMask === null ) {

			throw new Error( `LightProbeGridGPU: regionRules[${ index }] must define ownershipMask or layerRuleName.` );

		}

		const resolvedDirectMask = directOwnershipMask !== null && rule.defaultCompatible === true ?
			directOwnershipMask | defaultMask :
			directOwnershipMask;
		const resolvedMask = boundLayerRule !== null ? boundLayerRule.resolvedMask : resolvedDirectMask;

		if ( boundLayerRule !== null ) {

			boundLayerRule.bound = true;

			if ( directOwnershipMask !== null && resolvedDirectMask !== boundLayerRule.resolvedMask ) {

				throw new Error( `LightProbeGridGPU: regionRules[${ index }] ownershipMask must agree with layerRuleName after default compatibility is applied.` );

			}

		}

		return {
			name,
			box: createProbeOwnershipBox( rule.box, `regionRules[${ index }].box` ),
			resolvedMask,
			layerRuleName: rule.layerRuleName ?? null,
			assignedProbeCount: 0
		};

	} );

	const totalProbes = resolution * resolution * resolution;
	const probeLayerMasks = new Uint32Array( totalProbes );
	let defaultProbeCount = 0;
	let assignedProbeCount = 0;
	let compatibleOverlapCount = 0;

	for ( let i = 0; i < totalProbes; i ++ ) {

		getProbeOwnershipPosition( i, resolution, min, max, _probePosition );

		let layerMask = defaultMask;
		let assigned = false;

		for ( const rule of normalizedRegionRules ) {

			if ( rule.box.containsPoint( _probePosition ) === false ) continue;

			if ( assigned ) compatibleOverlapCount ++;

			layerMask |= rule.resolvedMask;
			rule.assignedProbeCount ++;
			if ( rule.layerRuleName !== null ) layerRuleMap.get( rule.layerRuleName ).assignedProbeCount ++;
			assigned = true;

		}

		if ( assigned ) {

			assignedProbeCount ++;

		} else {

			defaultProbeCount ++;

		}

		probeLayerMasks[ i ] = layerMask;

	}

	const boundLayerRuleCount = normalizedLayerRules.filter( rule => rule.bound ).length;

	return {
		probeLayerMasks,
		assignmentFacts: {
			policyId: 'layer-region-probe-ownership',
			probeOwnershipMaskMode: 'probeMeta.b authored bitfield',
			layerRuleCount: normalizedLayerRules.length,
			boundLayerRuleCount,
			unboundLayerRuleCount: normalizedLayerRules.length - boundLayerRuleCount,
			regionRuleCount: normalizedRegionRules.length,
			defaultProbeCount,
			assignedProbeCount,
			compatibleOverlapCount,
			incompatibleOverlapCount: 0,
			maskMin: 0,
			maskMax: MAX_PROBE_LAYER_MASK,
			layerRuleAssignedCounts: createProbeOwnershipRuleFacts( normalizedLayerRules ),
			regionRuleAssignedCounts: createProbeOwnershipRuleFacts( normalizedRegionRules )
		}
	};

};
