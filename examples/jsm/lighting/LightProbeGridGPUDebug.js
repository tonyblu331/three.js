import {
	FloatType,
	Vector3
} from 'three/webgpu';
import {
	clamp,
	float,
	Fn,
	floor,
	int,
	ivec2,
	max,
	normalWorld,
	positionWorld,
	texture3D,
	textureLoad,
	vec3,
	vec4
} from 'three/tsl';

import {
	PACKED_SH_TEXTURES,
	PROBE_VALIDITY_FLOOR
} from './lightprobegridgpu/LightProbeGridGPUConstants.js';
import {
	createLightProbeGridGPUVisibilitySamplingState,
	getLightProbeGridGPUMomentVisibility
} from './lightprobegridgpu/LightProbeGridGPUVisibility.js';

const _debugProbePosition = /*@__PURE__*/ new Vector3();

/**
 * Returns precision information for the probe grid.
 * @param {Object} grid - The probe grid instance.
 * @param {?Object} renderer - The renderer (optional).
 * @returns {Object} Precision information.
 */
export const getPrecisionInfo = ( grid, renderer = null ) => {

	return {
		requestedPrecision: grid.projectionPrecision,
		activePrecision: grid.activeProjectionPrecision,
		textureType: grid._getTextureType() === FloatType ? 'float' : 'half float',
		float32Filterable: renderer !== null ? renderer.hasFeature( 'float32-filterable' ) : null
	};

};

/**
 * Returns visibility depth information.
 * @param {Object} grid - The probe grid instance.
 * @returns {Object} Visibility depth information.
 */
export const getVisibilityDepthInfo = ( grid ) => {

	const memory = grid.getMemoryInfo();
	return grid.visibility.getDepthInfo( memory );

};

/**
 * Sets the guarded visibility mode.
 * @param {Object} grid - The probe grid instance.
 * @param {string} mode - The visibility mode ('off' or 'guarded').
 * @returns {string} The current guarded visibility mode.
 */
export const setGuardedVisibilityMode = ( grid, mode ) => {

	if ( mode !== 'off' && mode !== 'guarded' ) {

		throw new Error( 'LightProbeGridGPU: guarded visibility mode must be "off" or "guarded".' );

	}

	grid._guardedVisibilityMode = mode;
	return grid._guardedVisibilityMode;

};

/**
 * Sets probe kernel data for custom ellipsoid kernels.
 * @param {Object} grid - The probe grid instance.
 * @param {?Object} data - The kernel data (or null to clear).
 * @returns {?Object} The current probe kernel data.
 */
export const setProbeKernelData = ( grid, data ) => {

	grid._probeKernelData = data ?? null;
	return grid._probeKernelData;

};

/**
 * Evaluates packed spherical harmonics coefficients.
 * @param {Object} grid - The probe grid instance.
 * @param {Object} s0 - Packed SH coefficient 0.
 * @param {Object} s1 - Packed SH coefficient 1.
 * @param {Object} s2 - Packed SH coefficient 2.
 * @param {Object} s3 - Packed SH coefficient 3.
 * @param {Object} s4 - Packed SH coefficient 4.
 * @param {Object} s5 - Packed SH coefficient 5.
 * @param {Object} s6 - Packed SH coefficient 6.
 * @returns {Object} Evaluated SH result.
 */
export const evaluatePackedSH = ( grid, s0, s1, s2, s3, s4, s5, s6 ) => {

	const c0 = s0.xyz;
	const c1 = vec3( s0.w, s1.x, s1.y );
	const c2 = vec3( s1.z, s1.w, s2.x );
	const c3 = s2.yzw;
	const c4 = s3.xyz;
	const c5 = vec3( s3.w, s4.x, s4.y );
	const c6 = vec3( s4.z, s4.w, s5.x );
	const c7 = s5.yzw;
	const c8 = s6.xyz;

	return evaluateCoefficients( grid, c0, c1, c2, c3, c4, c5, c6, c7, c8 );

};

/**
 * Evaluates spherical harmonics coefficients with band intensity controls.
 * @param {Object} grid - The probe grid instance.
 * @param {Object} c0 - SH coefficient 0.
 * @param {Object} c1 - SH coefficient 1.
 * @param {Object} c2 - SH coefficient 2.
 * @param {Object} c3 - SH coefficient 3.
 * @param {Object} c4 - SH coefficient 4.
 * @param {Object} c5 - SH coefficient 5.
 * @param {Object} c6 - SH coefficient 6.
 * @param {Object} c7 - SH coefficient 7.
 * @param {Object} c8 - SH coefficient 8.
 * @returns {Object} Evaluated SH result.
 */
export const evaluateCoefficients = ( grid, c0, c1, c2, c3, c4, c5, c6, c7, c8 ) => {

	const normal = normalWorld.normalize();
	const x = normal.x;
	const y = normal.y;
	const z = normal.z;
	const band1Intensity = grid.band1Intensity;
	const band2Intensity = grid.band2Intensity;

	let result = c0.mul( 0.886227 );
	result = result.add( c1.mul( 2.0 * 0.511664 ).mul( y ).mul( band1Intensity ) );
	result = result.add( c2.mul( 2.0 * 0.511664 ).mul( z ).mul( band1Intensity ) );
	result = result.add( c3.mul( 2.0 * 0.511664 ).mul( x ).mul( band1Intensity ) );
	result = result.add( c4.mul( 2.0 * 0.429043 ).mul( x ).mul( y ).mul( band2Intensity ) );
	result = result.add( c5.mul( 2.0 * 0.429043 ).mul( y ).mul( z ).mul( band2Intensity ) );
	result = result.add( c6.mul( z.mul( z ).mul( 0.743125 ).sub( 0.247708 ) ).mul( band2Intensity ) );
	result = result.add( c7.mul( 2.0 * 0.429043 ).mul( x ).mul( z ).mul( band2Intensity ) );
	result = result.add( c8.mul( 0.429043 ).mul( x.mul( x ).sub( y.mul( y ) ) ).mul( band2Intensity ) );

	return max( result, vec3( 0 ) );

};

/**
 * Creates a debug irradiance node with visualization modes.
 * @param {Object} grid - The probe grid instance.
 * @param {string} debugMode - The debug visualization mode.
 * @param {Object} options - Sampling options.
 * @returns {Object} The debug irradiance node.
 */
export const createManualIrradianceDebugNode = ( grid, debugMode = 'finalIrradiance', options = {} ) => {

	const resolution = grid.resolution;
	const resolutionMinusOne = vec3( resolution.x - 1, resolution.y - 1, resolution.z - 1 );
	const gridMinNode = vec3( grid.min.x, grid.min.y, grid.min.z );
	const gridExtentNode = vec3(
		grid.max.x - grid.min.x,
		grid.max.y - grid.min.y,
		grid.max.z - grid.min.z
	);
	const packedLoad = texture3D( grid.atlasTarget.texture ).setSampler( false );
	const probeMetaTextureWidth = grid.probeValidityTextureWidth;
	const visibilitySampling = createLightProbeGridGPUVisibilitySamplingState( {
		visibility: grid.visibility,
		guardedVisibilityMode: grid._guardedVisibilityMode,
		resolution,
		receiverLayerMask: options.receiverLayerMask,
		receiverBoundaryLayerMask: options.receiverBoundaryLayerMask,
		receiverBoundaryWeight: options.receiverBoundaryWeight,
		receiverBoundaryMode: options.receiverBoundaryMode,
		defaultReceiverLayerMask: grid.receiverLayerMask,
		safeNormalize: ( vector ) => grid._safeNormalize( vector )
	} );

	const loadPackedSamples = ( coord ) => {

		const x = int( coord.x );
		const y = int( coord.y );
		const z = int( coord.z );

		return [
			packedLoad.load( grid._getPackedAtlasLoadCoord( x, y, z, 0 ) ),
			packedLoad.load( grid._getPackedAtlasLoadCoord( x, y, z, 1 ) ),
			packedLoad.load( grid._getPackedAtlasLoadCoord( x, y, z, 2 ) ),
			packedLoad.load( grid._getPackedAtlasLoadCoord( x, y, z, 3 ) ),
			packedLoad.load( grid._getPackedAtlasLoadCoord( x, y, z, 4 ) ),
			packedLoad.load( grid._getPackedAtlasLoadCoord( x, y, z, 5 ) ),
			packedLoad.load( grid._getPackedAtlasLoadCoord( x, y, z, 6 ) )
		];

	};

	const loadProbeMeta = ( probeIndex ) => textureLoad( grid.probeValidityTexture, ivec2(
		probeIndex.mod( probeMetaTextureWidth ),
		probeIndex.div( probeMetaTextureWidth )
	) );

	const sampleManual = Fn( () => {

		const probeSpacing = gridExtentNode.div( resolutionMinusOne );
		const samplePosition = grid._getBiasedSamplePosition( probeSpacing );
		const probeCoord = clamp( samplePosition.sub( gridMinNode ).div( gridExtentNode ), 0, 1 ).mul( resolutionMinusOne );
		const base = floor( probeCoord ).toVar();
		const blend = probeCoord.sub( base );

		const x0 = int( base.x );
		const y0 = int( base.y );
		const z0 = int( base.z );
		const x1 = int( clamp( base.x.add( 1 ), 0, resolutionMinusOne.x ) );
		const y1 = int( clamp( base.y.add( 1 ), 0, resolutionMinusOne.y ) );
		const z1 = int( clamp( base.z.add( 1 ), 0, resolutionMinusOne.z ) );

		const weightedSamples = [];
		const scalarSamples = [];
		const debugProbeTrilinearWeights = [];
		const debugProbeNormalWeights = [];
		const debugProbeValidityWeights = [];
		const debugProbeConfidenceWeights = [];
		const debugProbeLayerCompatibility = [];
		const debugProbeCompatibleKernels = [];
		const debugProbeDirections = [];
		const debugProbeBaseWeights = [];
		const debugProbeVisibilityWeights = [];
		const debugProbeVisibilities = [];
		const debugProbeIrradiance = [];
		const debugProbeIndices = [];
		const totalWeight = float( 0 ).toVar();
		const baseWeight = float( 0 ).toVar();
		const normal = normalWorld.normalize();
		const wx0 = blend.x.oneMinus();
		const wy0 = blend.y.oneMinus();
		const wz0 = blend.z.oneMinus();

		for ( let i = 0; i < PACKED_SH_TEXTURES; i ++ ) {

			weightedSamples.push( vec4( 0 ).toVar() );
			scalarSamples.push( vec4( 0 ).toVar() );

		}

		for ( let i = 0; i < 8; i ++ ) {

			debugProbeTrilinearWeights.push( float( 0 ).toVar() );
			debugProbeNormalWeights.push( float( 0 ).toVar() );
			debugProbeValidityWeights.push( float( 0 ).toVar() );
			debugProbeConfidenceWeights.push( float( 0 ).toVar() );
			debugProbeLayerCompatibility.push( float( 0 ).toVar() );
			debugProbeCompatibleKernels.push( float( 0 ).toVar() );
			debugProbeDirections.push( vec3( 0.5 ).toVar() );
			debugProbeBaseWeights.push( float( 0 ).toVar() );
			debugProbeVisibilityWeights.push( float( 0 ).toVar() );
			debugProbeVisibilities.push( float( 0 ).toVar() );
			debugProbeIrradiance.push( vec3( 0 ).toVar() );
			debugProbeIndices.push( float( 0 ).toVar() );

		}

		const addProbe = ( coord, trilinearWeight, debugSlot ) => {

			const sample = loadPackedSamples( coord );
			const probeIndex = int( coord.x ).add( int( coord.y ).mul( resolution.x ) ).add( int( coord.z ).mul( resolution.x * resolution.y ) );
			const meta = loadProbeMeta( probeIndex );
			const coordFloat = vec3( coord.x.toFloat(), coord.y.toFloat(), coord.z.toFloat() );
			const probePosition = gridMinNode.add( coordFloat.div( resolutionMinusOne ).mul( gridExtentNode ) ).toVar();
			const probeDirection = grid._safeNormalize( probePosition.sub( positionWorld ) );
			const wrapShading = normal.dot( probeDirection ).add( 1 ).mul( 0.5 );
			const normalWeight = wrapShading.mul( 0.5 ).add( 0.5 );
			const validityWeight = meta.x.max( PROBE_VALIDITY_FLOOR );
			const confidenceWeight = meta.y.clamp( 0, 1 );
			const sameLayer = visibilitySampling.getReceiverLayerCompatibility( meta.z.toUint() );
			const kernelOffset = positionWorld.sub( probePosition ).div( probeSpacing.max( vec3( 0.0001 ) ) );
			const compatibleKernel = visibilitySampling.useGuardedVisibility ? kernelOffset.dot( kernelOffset ).negate().exp2() : float( 1 );
			const layerCompatibility = visibilitySampling.useGuardedVisibility ? sameLayer : float( 1 );
			const base = trilinearWeight.mul( normalWeight ).mul( validityWeight ).mul( confidenceWeight ).mul( layerCompatibility ).mul( compatibleKernel );
			const probeIrradiance = evaluatePackedSH(
				grid,
				sample[ 0 ],
				sample[ 1 ],
				sample[ 2 ],
				sample[ 3 ],
				sample[ 4 ],
				sample[ 5 ],
				sample[ 6 ]
			).mul( grid.intensity );
			const visibility = float( 1 ).toVar();

			if ( visibilitySampling.useGuardedVisibility ) {

				const receiverDirection = positionWorld.sub( probePosition );
				const receiverDistance = receiverDirection.length();
				const moment = visibilitySampling.loadVisibilityMoment( coord, receiverDirection );

				visibility.assign( getLightProbeGridGPUMomentVisibility( {
					moment,
					receiverDistance,
					selfShadowBias: grid.selfShadowBias,
					visibilityDepthWeighting: grid.visibilityDepthWeighting
				} ) );

			}

			const weight = base.mul( visibility );

			debugProbeTrilinearWeights[ debugSlot ].assign( trilinearWeight );
			debugProbeNormalWeights[ debugSlot ].assign( normalWeight );
			debugProbeValidityWeights[ debugSlot ].assign( validityWeight );
			debugProbeConfidenceWeights[ debugSlot ].assign( confidenceWeight );
			debugProbeLayerCompatibility[ debugSlot ].assign( layerCompatibility );
			debugProbeCompatibleKernels[ debugSlot ].assign( compatibleKernel );
			debugProbeDirections[ debugSlot ].assign( probeDirection.mul( 0.5 ).add( 0.5 ) );
			debugProbeBaseWeights[ debugSlot ].assign( base );
			debugProbeVisibilityWeights[ debugSlot ].assign( weight );
			debugProbeVisibilities[ debugSlot ].assign( visibility );
			debugProbeIrradiance[ debugSlot ].assign( probeIrradiance );
			debugProbeIndices[ debugSlot ].assign( probeIndex.toFloat() );

			for ( let i = 0; i < PACKED_SH_TEXTURES; i ++ ) {

				// Accumulate packed SH coefficients. `evaluateCoefficients()` clamps
				// negative ringing, so evaluating each probe first would break hardware
				// filtering equivalence.
				weightedSamples[ i ].addAssign( sample[ i ].mul( weight ) );
				scalarSamples[ i ].addAssign( sample[ i ].mul( base ) );

			}

			totalWeight.addAssign( weight );
			baseWeight.addAssign( base );

		};

		addProbe( vec3( x0, y0, z0 ), wx0.mul( wy0 ).mul( wz0 ), 0 );
		addProbe( vec3( x1, y0, z0 ), blend.x.mul( wy0 ).mul( wz0 ), 1 );
		addProbe( vec3( x0, y1, z0 ), wx0.mul( blend.y ).mul( wz0 ), 2 );
		addProbe( vec3( x1, y1, z0 ), blend.x.mul( blend.y ).mul( wz0 ), 3 );
		addProbe( vec3( x0, y0, z1 ), wx0.mul( wy0 ).mul( blend.z ), 4 );
		addProbe( vec3( x1, y0, z1 ), blend.x.mul( wy0 ).mul( blend.z ), 5 );
		addProbe( vec3( x0, y1, z1 ), wx0.mul( blend.y ).mul( blend.z ), 6 );
		addProbe( vec3( x1, y1, z1 ), blend.x.mul( blend.y ).mul( blend.z ), 7 );

		const safeWeight = totalWeight.max( 0.0001 );
		const safeBaseWeight = baseWeight.max( 0.0001 );
		const visibilityMass = visibilitySampling.useGuardedVisibility ? totalWeight.div( baseWeight.max( 0.0001 ) ).clamp( 0, 1 ) : float( 1 );
		const scalarCoefficientAccumulator = evaluatePackedSH(
			grid,
			scalarSamples[ 0 ],
			scalarSamples[ 1 ],
			scalarSamples[ 2 ],
			scalarSamples[ 3 ],
			scalarSamples[ 4 ],
			scalarSamples[ 5 ],
			scalarSamples[ 6 ]
		).mul( grid.intensity );
		const visibilityCoefficientAccumulator = evaluatePackedSH(
			grid,
			weightedSamples[ 0 ],
			weightedSamples[ 1 ],
			weightedSamples[ 2 ],
			weightedSamples[ 3 ],
			weightedSamples[ 4 ],
			weightedSamples[ 5 ],
			weightedSamples[ 6 ]
		).mul( grid.intensity );
		const scalarIrradiance = evaluatePackedSH(
			grid,
			scalarSamples[ 0 ].div( safeBaseWeight ),
			scalarSamples[ 1 ].div( safeBaseWeight ),
			scalarSamples[ 2 ].div( safeBaseWeight ),
			scalarSamples[ 3 ].div( safeBaseWeight ),
			scalarSamples[ 4 ].div( safeBaseWeight ),
			scalarSamples[ 5 ].div( safeBaseWeight ),
			scalarSamples[ 6 ].div( safeBaseWeight )
		).mul( grid.intensity );
		const visibilityIrradiance = evaluatePackedSH(
			grid,
			weightedSamples[ 0 ].div( safeWeight ),
			weightedSamples[ 1 ].div( safeWeight ),
			weightedSamples[ 2 ].div( safeWeight ),
			weightedSamples[ 3 ].div( safeWeight ),
			weightedSamples[ 4 ].div( safeWeight ),
			weightedSamples[ 5 ].div( safeWeight ),
			weightedSamples[ 6 ].div( safeWeight )
		).mul( grid.intensity );
		const finalVisibilityIrradiance = visibilityIrradiance.mul( visibilityMass );
		const visibilityBlend = grid.visibilityDepthWeighting.clamp( 0, 1 );
		const finalIrradiance = scalarIrradiance.mul( float( 1 ).sub( visibilityBlend ) ).add( finalVisibilityIrradiance.mul( visibilityBlend ) );
		const probeIndexScale = float( resolution.x * resolution.y * resolution.z - 1 ).max( 1 );

		if ( debugMode === 'samplePositionGrid' ) return clamp( samplePosition.sub( gridMinNode ).div( gridExtentNode ), 0, 1 );
		if ( debugMode === 'manualNormalWorld' ) return normal.mul( 0.5 ).add( 0.5 );
		if ( debugMode === 'baseProbeCoordGrid' ) return base.div( resolutionMinusOne );
		if ( debugMode === 'trilinearBlend' ) return blend;
		if ( debugMode === 'probeCoordGrid' ) return probeCoord.div( resolutionMinusOne );

		for ( let i = 0; i < 8; i ++ ) {

			if ( debugMode === `neighbor${ i }TrilinearWeight` ) return vec3( debugProbeTrilinearWeights[ i ] );
			if ( debugMode === `neighbor${ i }NormalWeight` ) return vec3( debugProbeNormalWeights[ i ] );
			if ( debugMode === `neighbor${ i }ValidityWeight` ) return vec3( debugProbeValidityWeights[ i ] );
			if ( debugMode === `neighbor${ i }ConfidenceWeight` ) return vec3( debugProbeConfidenceWeights[ i ] );
			if ( debugMode === `neighbor${ i }LayerCompatibility` ) return vec3( debugProbeLayerCompatibility[ i ] );
			if ( debugMode === `neighbor${ i }CompatibleKernel` ) return vec3( debugProbeCompatibleKernels[ i ] );
			if ( debugMode === `neighbor${ i }ProbeDirectionEncoded` ) return debugProbeDirections[ i ];
			if ( debugMode === `neighbor${ i }BaseWeight` ) return vec3( debugProbeBaseWeights[ i ] );
			if ( debugMode === `neighbor${ i }VisibilityWeight` ) return vec3( debugProbeVisibilityWeights[ i ] );
			if ( debugMode === `neighbor${ i }Visibility` ) return vec3( debugProbeVisibilities[ i ] );
			if ( debugMode === `neighbor${ i }Irradiance` ) return debugProbeIrradiance[ i ];
			if ( debugMode === `neighbor${ i }ProbeIndex` ) return vec3( debugProbeIndices[ i ].div( probeIndexScale ) );

		}

		if ( debugMode === 'scalarWeight' ) return vec3( baseWeight );
		if ( debugMode === 'visibilityWeight' ) return vec3( totalWeight );
		if ( debugMode === 'visibilityMix' || debugMode === 'visibilityOverScalar' ) return vec3( visibilityMass );
		if ( debugMode === 'scalarCoefficientAccumulator' ) return scalarCoefficientAccumulator;
		if ( debugMode === 'visibilityCoefficientAccumulator' ) return visibilityCoefficientAccumulator;
		if ( debugMode === 'scalarIrradiance' ) return scalarIrradiance;
		if ( debugMode === 'visibilityIrradiance' ) return visibilityIrradiance;

		return finalIrradiance;

	} );

	return sampleManual();

};
