import {
	DataTexture,
	FloatType,
	NearestFilter,
	RGBAFormat
} from 'three/webgpu';

import {
	DEFAULT_PROBE_LAYER_MASK,
	MAX_PROBE_LAYER_MASK
} from './LightProbeGridGPUConstants.js';

/**
 * Validates probe validity array.
 * @param {?ArrayLike<number>} probeValidity - Probe validity values.
 * @param {number} totalProbes - Expected number of probes.
 * @returns {?ArrayLike<number>} Validated probe validity or null.
 */
export const validateProbeValidity = ( probeValidity, totalProbes ) => {

	if ( probeValidity === null || probeValidity === undefined ) return null;

	if ( typeof probeValidity.length !== 'number' ) {

		throw new Error( 'LightProbeGridGPU: probeValidity must be an array-like object.' );

	}

	if ( probeValidity.length !== totalProbes ) {

		throw new Error( `LightProbeGridGPU: probeValidity length must equal resolution^3 (${ totalProbes }).` );

	}

	for ( let i = 0; i < probeValidity.length; i ++ ) {

		const value = probeValidity[ i ];

		if ( Number.isFinite( value ) === false || value < 0 || value > 1 ) {

			throw new Error( 'LightProbeGridGPU: probeValidity values must be finite numbers between 0 and 1.' );

		}

	}

	return probeValidity;

};

/**
 * Validates probe layer masks array.
 * @param {?ArrayLike<number>} probeLayerMasks - Probe layer mask values.
 * @param {number} totalProbes - Expected number of probes.
 * @returns {?ArrayLike<number>} Validated probe layer masks or null.
 */
export const validateProbeLayerMasks = ( probeLayerMasks, totalProbes ) => {

	if ( probeLayerMasks === null || probeLayerMasks === undefined ) return null;

	if ( typeof probeLayerMasks.length !== 'number' ) {

		throw new Error( 'LightProbeGridGPU: probeLayerMasks must be an array-like object.' );

	}

	if ( probeLayerMasks.length !== totalProbes ) {

		throw new Error( `LightProbeGridGPU: probeLayerMasks length must equal resolution^3 (${ totalProbes }).` );

	}

	for ( let i = 0; i < probeLayerMasks.length; i ++ ) {

		const value = probeLayerMasks[ i ];

		if ( Number.isInteger( value ) === false || value < 0 || value > MAX_PROBE_LAYER_MASK ) {

			throw new Error( `LightProbeGridGPU: probeLayerMasks values must be integer masks between 0 and 0x${ MAX_PROBE_LAYER_MASK.toString( 16 ).padStart( 6, '0' ) }.` );

		}

	}

	return probeLayerMasks;

};

/**
 * Creates or updates the probe validity texture.
 * @param {Object} grid - The probe grid instance.
 */
export const createProbeValidityTexture = ( grid ) => {

	const textureWidth = Math.ceil( Math.sqrt( grid.totalProbes ) );
	const textureHeight = Math.ceil( grid.totalProbes / textureWidth );
	const recreateTexture = grid.probeValidityTexture === null ||
		grid.probeValidityTextureWidth !== textureWidth ||
		grid.probeValidityTextureHeight !== textureHeight;

	if ( recreateTexture && grid.probeValidityTexture !== null ) grid.probeValidityTexture.dispose();

	grid.probeValidityTextureWidth = textureWidth;
	grid.probeValidityTextureHeight = textureHeight;
	grid.invalidProbeCount = 0;

	const data = recreateTexture ?
		new Float32Array( grid.probeValidityTextureWidth * grid.probeValidityTextureHeight * 4 ) :
		grid.probeValidityTexture.image.data;

	data.fill( 0 );

	for ( let i = 0; i < grid.totalProbes; i ++ ) {

		const validity = grid.probeValiditySource === null ? 1 : grid.probeValiditySource[ i ];
		const layerMask = grid.probeLayerMaskSource === null ? DEFAULT_PROBE_LAYER_MASK : grid.probeLayerMaskSource[ i ];
		const offset = i * 4;

		data[ offset ] = validity;
		data[ offset + 1 ] = validity;
		data[ offset + 2 ] = layerMask;
		data[ offset + 3 ] = 1;

		if ( validity < 1 ) grid.invalidProbeCount ++;

	}

	if ( recreateTexture ) {

		grid.probeValidityTexture = new DataTexture(
			data,
			grid.probeValidityTextureWidth,
			grid.probeValidityTextureHeight,
			RGBAFormat,
			FloatType
		);
		grid.probeValidityTexture.minFilter = NearestFilter;
		grid.probeValidityTexture.magFilter = NearestFilter;
		grid.probeValidityTexture.generateMipmaps = false;

	}

	grid.probeValidityTexture.needsUpdate = true;

};
