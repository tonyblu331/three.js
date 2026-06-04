import {
	CubeCamera,
	CubeRenderTarget,
	DoubleSide,
	MeshBasicNodeMaterial,
	NearestFilter,
	NodeMaterial,
	RenderTarget3D,
	RGBAFormat,
	Vector3
} from 'three/webgpu';
import {
	clamp,
	cubeTexture,
	float,
	Fn,
	If,
	int,
	ivec3,
	max,
	nodeObject,
	positionWorld,
	texture3D,
	uniform,
	uv,
	uint,
	vec2,
	vec3,
	vec4,
	wgslFn
} from 'three/tsl';

import {
	VISIBILITY_DEPTH_MAX_DISTANCE,
	VISIBILITY_DEPTH_RESOLUTION,
	VISIBILITY_DISTANCE_BIAS,
	VISIBILITY_MIN_VARIANCE,
	VISIBILITY_MOMENT_FILTER_TAP_COUNT,
	VISIBILITY_OCTAHEDRAL_NORMALIZE_EPSILON,
	RECEIVER_BOUNDARY_SELECTION_THRESHOLD
} from './LightProbeGridGPUConstants.js';

const disposeLightProbeGridGPUVisibilityResource = ( resource ) => {

	if ( resource !== null ) resource.dispose();

};

const disposeLightProbeGridGPUVisibilityFullscreenMesh = ( mesh ) => {

	if ( mesh !== null ) mesh.geometry.dispose();

};

export const getLightProbeGridGPUVisibilityLoadCoord = ( coord, direction, resolution, visibilityDepthResolution ) => {

	const nx = resolution.x ?? resolution;
	const ny = resolution.y ?? resolution;
	const probeIndex = int( coord.x ).add( int( coord.y ).mul( nx ) ).add( int( coord.z ).mul( nx * ny ) );
	const denominator = direction.x.abs().add( direction.y.abs() ).add( direction.z.abs() ).max( VISIBILITY_OCTAHEDRAL_NORMALIZE_EPSILON );
	const octX = direction.x.div( denominator ).toVar();
	const octY = direction.y.div( denominator ).toVar();

	If( direction.z.lessThan( 0 ), () => {

		const oldX = octX.toVar();
		octX.assign( float( 1 ).sub( octY.abs() ).mul( oldX.greaterThanEqual( 0 ).select( float( 1 ), float( - 1 ) ) ) );
		octY.assign( float( 1 ).sub( oldX.abs() ).mul( octY.greaterThanEqual( 0 ).select( float( 1 ), float( - 1 ) ) ) );

	} );

	const ix = int( clamp( octX.mul( 0.5 ).add( 0.5 ).mul( visibilityDepthResolution ), 0, visibilityDepthResolution - 1 ) );
	const iy = int( clamp( octY.mul( 0.5 ).add( 0.5 ).mul( visibilityDepthResolution ), 0, visibilityDepthResolution - 1 ) );

	return ivec3( ix, iy, probeIndex );

};

export const getLightProbeGridGPUOctahedralDirection = Fn( ( { octUv } ) => {

	const p = octUv.clamp( 0, 1 ).mul( 2 ).sub( 1 );
	const x = p.x.toVar();
	const y = p.y.toVar();
	const z = float( 1 ).sub( x.abs() ).sub( y.abs() ).toVar();

	If( z.lessThan( 0 ), () => {

		const oldX = x.toVar();
		x.assign( float( 1 ).sub( y.abs() ).mul( oldX.greaterThanEqual( 0 ).select( float( 1 ), float( - 1 ) ) ) );
		y.assign( float( 1 ).sub( oldX.abs() ).mul( y.greaterThanEqual( 0 ).select( float( 1 ), float( - 1 ) ) ) );

	} );

	return vec3( x, y, z ).normalize();

} );

export const createLightProbeGridGPUVisibilityDistanceMaterial = ( visibilityProbePosition, visibilityMaxDistance ) => {

	const material = new MeshBasicNodeMaterial();
	const distance = positionWorld.sub( visibilityProbePosition ).length();
	const normalizedDistance = distance.div( visibilityMaxDistance ).clamp( 0, 1 );

	material.colorNode = vec3( normalizedDistance );
	material.side = DoubleSide;
	material.toneMapped = false;

	return material;

};

const resolveReceiverLayerMaskNode = ( receiverLayerMask, defaultReceiverLayerMask ) => {

	if ( receiverLayerMask === undefined || receiverLayerMask === null ) return defaultReceiverLayerMask;
	if ( typeof receiverLayerMask === 'number' ) return uint( receiverLayerMask );

	return nodeObject( receiverLayerMask ).toUint();

};

const resolveReceiverBoundaryWeightNode = ( receiverBoundaryWeight ) => {

	if ( receiverBoundaryWeight === undefined || receiverBoundaryWeight === null ) return float( 0 );
	if ( typeof receiverBoundaryWeight === 'number' ) return float( receiverBoundaryWeight ).clamp( 0, 1 );

	return nodeObject( receiverBoundaryWeight ).toFloat().clamp( 0, 1 );

};

const selectReceiverLayerMaskWGSL = wgslFn( `
	fn selectReceiverLayerMask(
		receiverLayerMask: u32,
		receiverBoundaryLayerMask: u32,
		receiverBoundaryWeight: f32
	) -> u32 {

		return select( receiverLayerMask, receiverBoundaryLayerMask, receiverBoundaryWeight >= ${ RECEIVER_BOUNDARY_SELECTION_THRESHOLD.toFixed( 1 ) } );

	}
` );

export const lightProbeGridGPUReceiverLayerCompatibility = wgslFn( `
	fn lightProbeGridGPUReceiverLayerCompatibility(
		probeLayerMask: u32,
		receiverLayerMask: u32
	) -> f32 {

		return select( 0.0, 1.0, ( probeLayerMask & receiverLayerMask ) != 0u );

	}
` );

export const createLightProbeGridGPUVisibilitySamplingState = ( {
	visibility,
	guardedVisibilityMode,
	resolution,
	receiverLayerMask: receiverLayerMaskOption,
	receiverBoundaryLayerMask: receiverBoundaryLayerMaskOption,
	receiverBoundaryWeight: receiverBoundaryWeightOption,
	receiverBoundaryMode: receiverBoundaryModeOption,
	defaultReceiverLayerMask,
	safeNormalize
} ) => {

	const useGuardedVisibility = guardedVisibilityMode === 'guarded' && visibility.depthTarget !== null;
	const visibilityLoad = useGuardedVisibility ? texture3D( visibility.depthTarget.texture ).setSampler( false ) : null;
	const receiverLayerMask = resolveReceiverLayerMaskNode( receiverLayerMaskOption, defaultReceiverLayerMask );
	const receiverBoundaryLayerMask = resolveReceiverLayerMaskNode( receiverBoundaryLayerMaskOption, receiverLayerMask );
	const receiverBoundaryWeight = resolveReceiverBoundaryWeightNode( receiverBoundaryWeightOption );
	const receiverBoundaryMode = receiverBoundaryModeOption === 'blend' ? 'blend' : 'select';
	const effectiveReceiverLayerMask = selectReceiverLayerMaskWGSL( {
		receiverLayerMask,
		receiverBoundaryLayerMask,
		receiverBoundaryWeight
	} );
	const getReceiverLayerCompatibility = probeLayerMask => {

		if ( receiverBoundaryMode === 'blend' ) {

			const defaultCompatibility = lightProbeGridGPUReceiverLayerCompatibility( {
				probeLayerMask,
				receiverLayerMask
			} );
			const boundaryCompatibility = lightProbeGridGPUReceiverLayerCompatibility( {
				probeLayerMask,
				receiverLayerMask: receiverBoundaryLayerMask
			} );

			return defaultCompatibility.mul( float( 1 ).sub( receiverBoundaryWeight ) ).add( boundaryCompatibility.mul( receiverBoundaryWeight ) );

		}

		return lightProbeGridGPUReceiverLayerCompatibility( {
			probeLayerMask,
			receiverLayerMask: effectiveReceiverLayerMask
		} );

	};
	const loadVisibilityMoment = useGuardedVisibility ? ( coord, direction ) => {

		const dir = safeNormalize( direction );
		return visibilityLoad.load( getLightProbeGridGPUVisibilityLoadCoord( coord, dir, resolution, visibility.depthResolution ) );

	} : null;

	return {
		useGuardedVisibility,
		effectiveReceiverLayerMask,
		receiverBoundaryMode,
		getReceiverLayerCompatibility,
		loadVisibilityMoment
	};

};

export const getLightProbeGridGPUMomentVisibility = ( {
	moment,
	receiverDistance,
	visibilityBias,
	visibilityDepthWeighting
} ) => {

	const variance = max( moment.y.sub( moment.x.mul( moment.x ) ), VISIBILITY_MIN_VARIANCE );
	const delta = max( receiverDistance.sub( moment.x ).sub( visibilityBias ), 0 );
	const chebyshev = variance.div( variance.add( delta.mul( delta ) ) );
	const hitConfidence = moment.z.clamp( 0, 1 );
	const momentVisibility = float( 1 ).sub( hitConfidence ).add( chebyshev.mul( hitConfidence ) ).clamp( 0, 1 );
	const visibilityMix = visibilityDepthWeighting.clamp( 0, 1 );

	return float( 1 ).sub( visibilityMix ).add( momentVisibility.mul( visibilityMix ) ).clamp( 0, 1 );

};

export class LightProbeGridGPUVisibilityRuntime {

	constructor( enabled = false ) {

		this.enabled = enabled === true;
		this.depthResolution = VISIBILITY_DEPTH_RESOLUTION;
		this.depthTarget = null;
		this.distanceTarget = null;
		this.distanceCamera = null;
		this.distanceMaterial = null;
		this.repackScene = null;
		this.repackCamera = null;
		this.repackMesh = null;
		this.repackMaterial = null;
		this.repackProbeIndex = uniform( 0 );
		this.probePosition = uniform( new Vector3() );
		this.probeSpacing = uniform( 1 );
		this.maxDistance = uniform( VISIBILITY_DEPTH_MAX_DISTANCE );
		this.bias = uniform( VISIBILITY_DISTANCE_BIAS );
		this.depthWeighting = uniform( 1 );
		this.depthMode = 'not-baked';
		this.cubemapMs = 0;
		this.repackMs = 0;

	}

	setEnabled( enabled ) {

		this.enabled = enabled === true;

	}

	dispose() {

		disposeLightProbeGridGPUVisibilityFullscreenMesh( this.repackMesh );
		disposeLightProbeGridGPUVisibilityResource( this.depthTarget );
		disposeLightProbeGridGPUVisibilityResource( this.distanceTarget );
		disposeLightProbeGridGPUVisibilityResource( this.distanceMaterial );
		disposeLightProbeGridGPUVisibilityResource( this.repackMaterial );

		this.depthTarget = null;
		this.distanceTarget = null;
		this.distanceCamera = null;
		this.distanceMaterial = null;
		this.repackScene = null;
		this.repackCamera = null;
		this.repackMesh = null;
		this.repackMaterial = null;
		this.depthMode = 'not-baked';
		this.cubemapMs = 0;
		this.repackMs = 0;

	}

	createResources( {
		cubemapSize,
		textureType,
		totalProbes,
		createFullscreenPass
	} ) {

		if ( this.enabled === false ) return;

		this.distanceTarget = new CubeRenderTarget( cubemapSize, {
			type: textureType,
			generateMipmaps: false
		} );
		this.distanceCamera = new CubeCamera( 0.05, VISIBILITY_DEPTH_MAX_DISTANCE, this.distanceTarget );
		this.depthTarget = new RenderTarget3D(
			this.depthResolution,
			this.depthResolution,
			totalProbes,
			{
				format: RGBAFormat,
				type: textureType,
				minFilter: NearestFilter,
				magFilter: NearestFilter,
				generateMipmaps: false,
				depthBuffer: false
			}
		);
		this.distanceMaterial = createLightProbeGridGPUVisibilityDistanceMaterial(
			this.probePosition,
			this.maxDistance
		);
		this.repackMaterial = createLightProbeGridGPUVisibilityRepackMaterial(
			this.distanceTarget.texture,
			this.maxDistance,
			this.depthResolution,
			VISIBILITY_MIN_VARIANCE
		);

		const pass = createFullscreenPass( this.repackMaterial );
		this.repackCamera = pass.camera;
		this.repackMesh = pass.mesh;
		this.repackScene = pass.scene;

	}

	beginProbeCapture( probePosition, probeSpacing ) {

		if ( this.enabled === false ) return;

		this.distanceCamera.position.copy( probePosition );
		this.probePosition.value.copy( probePosition );
		this.probeSpacing.value = probeSpacing;

	}

	renderDistanceCapture( renderer, scene, restoreMaterial ) {

		const autoClear = renderer.autoClear;

		renderer.autoClear = true;
		scene.overrideMaterial = this.distanceMaterial;
		this.distanceCamera.update( renderer, scene );
		scene.overrideMaterial = restoreMaterial;
		renderer.autoClear = autoClear;

	}

	repackDepth( renderer, probeIndex ) {

		this.depthTarget.viewport.set( 0, 0, this.depthResolution, this.depthResolution );
		this.depthTarget.scissor.set( 0, 0, this.depthResolution, this.depthResolution );
		this.depthTarget.scissorTest = false;
		this.repackProbeIndex.value = probeIndex;

		renderer.autoClear = false;
		renderer.setRenderTarget( this.depthTarget, probeIndex );
		renderer.render( this.repackScene, this.repackCamera );
		this.depthMode = 'moments';

	}

	getMemoryInfo( rgbaBytes, cubemapBytes, totalProbes ) {

		return {
			visibilityDepthBytes: this.depthTarget !== null ?
				this.depthResolution * this.depthResolution * totalProbes * rgbaBytes :
				0,
			visibilityDistanceBytes: this.distanceTarget !== null ? cubemapBytes : 0
		};

	}

	getDepthInfo( memory ) {

		const available = this.depthTarget !== null && this.depthMode === 'moments';

		return {
			available,
			mode: this.depthMode,
			bytes: available ? memory.visibilityDepthBytes : 0
		};

	}

}

export const createLightProbeGridGPUVisibilityRepackMaterial = (
	visibilityDistanceTexture,
	visibilityMaxDistance,
	visibilityDepthResolution,
	visibilityMinVariance
) => {

	const pixelSize = float( 1 ).div( visibilityDepthResolution );
	const halfPixel = pixelSize.mul( 0.5 );
	const negativeHalfPixel = float( 0 ).sub( halfPixel );
	const negativePixel = float( 0 ).sub( pixelSize );

	const sampleRadialDistance = Fn( ( { octUv } ) => {

		const dir = getLightProbeGridGPUOctahedralDirection( { octUv } );
		const normalizedDistance = cubeTexture( visibilityDistanceTexture, dir, 0 ).r.clamp( 0, 1 );
		const receiverDistance = normalizedDistance.mul( visibilityMaxDistance );
		const hitConfidence = normalizedDistance.greaterThan( pixelSize.mul( 0.5 ) ).select( float( 1 ), float( 0 ) );

		return vec4( receiverDistance, receiverDistance.mul( receiverDistance ), hitConfidence, float( 0 ) );

	} );

	const repack = Fn( () => {

		const center = uv();
		const sampleCenter = sampleRadialDistance( { octUv: center } );
		const samplePositiveX = sampleRadialDistance( { octUv: center.add( vec2( halfPixel, 0 ) ) } );
		const sampleNegativeX = sampleRadialDistance( { octUv: center.add( vec2( negativeHalfPixel, 0 ) ) } );
		const samplePositiveY = sampleRadialDistance( { octUv: center.add( vec2( 0, halfPixel ) ) } );
		const sampleNegativeY = sampleRadialDistance( { octUv: center.add( vec2( 0, negativeHalfPixel ) ) } );
		const sampleFullPositiveX = sampleRadialDistance( { octUv: center.add( vec2( pixelSize, 0 ) ) } );
		const sampleFullNegativeX = sampleRadialDistance( { octUv: center.add( vec2( negativePixel, 0 ) ) } );
		const sampleFullPositiveY = sampleRadialDistance( { octUv: center.add( vec2( 0, pixelSize ) ) } );
		const sampleFullNegativeY = sampleRadialDistance( { octUv: center.add( vec2( 0, negativePixel ) ) } );
		const hitSum = sampleCenter.z
			.add( samplePositiveX.z )
			.add( sampleNegativeX.z )
			.add( samplePositiveY.z )
			.add( sampleNegativeY.z )
			.add( sampleFullPositiveX.z )
			.add( sampleFullNegativeX.z )
			.add( sampleFullPositiveY.z )
			.add( sampleFullNegativeY.z );
		const safeHitSum = hitSum.max( 1 );
		const meanDistance = sampleCenter.x.mul( sampleCenter.z )
			.add( samplePositiveX.x.mul( samplePositiveX.z ) )
			.add( sampleNegativeX.x.mul( sampleNegativeX.z ) )
			.add( samplePositiveY.x.mul( samplePositiveY.z ) )
			.add( sampleNegativeY.x.mul( sampleNegativeY.z ) )
			.add( sampleFullPositiveX.x.mul( sampleFullPositiveX.z ) )
			.add( sampleFullNegativeX.x.mul( sampleFullNegativeX.z ) )
			.add( sampleFullPositiveY.x.mul( sampleFullPositiveY.z ) )
			.add( sampleFullNegativeY.x.mul( sampleFullNegativeY.z ) )
			.div( safeHitSum );
		const meanSquaredDistance = sampleCenter.y.mul( sampleCenter.z )
			.add( samplePositiveX.y.mul( samplePositiveX.z ) )
			.add( sampleNegativeX.y.mul( sampleNegativeX.z ) )
			.add( samplePositiveY.y.mul( samplePositiveY.z ) )
			.add( sampleNegativeY.y.mul( sampleNegativeY.z ) )
			.add( sampleFullPositiveX.y.mul( sampleFullPositiveX.z ) )
			.add( sampleFullNegativeX.y.mul( sampleFullNegativeX.z ) )
			.add( sampleFullPositiveY.y.mul( sampleFullPositiveY.z ) )
			.add( sampleFullNegativeY.y.mul( sampleFullNegativeY.z ) )
			.div( safeHitSum )
			.add( visibilityMinVariance );
		const hitConfidence = hitSum.div( VISIBILITY_MOMENT_FILTER_TAP_COUNT ).clamp( 0, 1 );

		return vec4( meanDistance, meanSquaredDistance, hitConfidence, float( 0 ) );

	} );

	const material = new NodeMaterial();
	material.fragmentNode = repack();
	material.toneMapped = false;

	return material;

};
