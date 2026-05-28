import {
	MeshBasicNodeMaterial,
	NodeMaterial
} from 'three/webgpu';
import {
	clamp,
	cubeTexture,
	float,
	Fn,
	If,
	int,
	ivec3,
	positionWorld,
	uv,
	vec2,
	vec3,
	vec4
} from 'three/tsl';

export const getLightProbeGridGPUVisibilityLoadCoord = ( coord, direction, resolution, visibilityDepthResolution ) => {

	const probeIndex = int( coord.x ).add( int( coord.y ).mul( resolution ) ).add( int( coord.z ).mul( resolution * resolution ) );
	const denominator = direction.x.abs().add( direction.y.abs() ).add( direction.z.abs() ).max( 0.0001 );
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
	material.toneMapped = false;

	return material;

};

export const createLightProbeGridGPUVisibilityRepackMaterial = (
	visibilityDistanceTexture,
	visibilityMaxDistance,
	visibilityDepthResolution,
	visibilityMinVariance
) => {

	const pixelSize = float( 1 ).div( visibilityDepthResolution );
	const halfPixel = pixelSize.mul( 0.5 );
	const negativeHalfPixel = float( 0 ).sub( halfPixel );

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
		const hitSum = sampleCenter.z
			.add( samplePositiveX.z )
			.add( sampleNegativeX.z )
			.add( samplePositiveY.z )
			.add( sampleNegativeY.z );
		const safeHitSum = hitSum.max( 1 );
		const meanDistance = sampleCenter.x.mul( sampleCenter.z )
			.add( samplePositiveX.x.mul( samplePositiveX.z ) )
			.add( sampleNegativeX.x.mul( sampleNegativeX.z ) )
			.add( samplePositiveY.x.mul( samplePositiveY.z ) )
			.add( sampleNegativeY.x.mul( sampleNegativeY.z ) )
			.div( safeHitSum );
		const meanSquaredDistance = sampleCenter.y.mul( sampleCenter.z )
			.add( samplePositiveX.y.mul( samplePositiveX.z ) )
			.add( sampleNegativeX.y.mul( sampleNegativeX.z ) )
			.add( samplePositiveY.y.mul( samplePositiveY.z ) )
			.add( sampleNegativeY.y.mul( sampleNegativeY.z ) )
			.div( safeHitSum )
			.add( visibilityMinVariance );
		const hitConfidence = hitSum.div( 5 ).clamp( 0, 1 );

		return vec4( meanDistance, meanSquaredDistance, hitConfidence, float( 0 ) );

	} );

	const material = new NodeMaterial();
	material.fragmentNode = repack();
	material.toneMapped = false;

	return material;

};
