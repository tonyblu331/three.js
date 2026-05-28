import {
	NodeMaterial
} from 'three/webgpu';
import {
	cubeTexture,
	float,
	Fn,
	If,
	int,
	Loop,
	textureStore,
	uint,
	uvec2,
	uv,
	vec3,
	vec4
} from 'three/tsl';

import {
	SH_COEFFICIENTS
} from './LightProbeGridGPUConstants.js';

const assignLightProbeGridGPUCubeDirection = ( face, row, col, coord ) => {

	If( face.equal( int( 0 ) ), () => {

		coord.assign( vec3( - 1.0, row, col ) );

	} ).ElseIf( face.equal( int( 1 ) ), () => {

		coord.assign( vec3( 1.0, row, col.negate() ) );

	} ).ElseIf( face.equal( int( 2 ) ), () => {

		coord.assign( vec3( col, 1.0, row.negate() ) );

	} ).ElseIf( face.equal( int( 3 ) ), () => {

		coord.assign( vec3( col, - 1.0, row ) );

	} ).ElseIf( face.equal( int( 4 ) ), () => {

		coord.assign( vec3( col, row, 1.0 ) );

	} ).Else( () => {

		coord.assign( vec3( col.negate(), row, - 1.0 ) );

	} );

};

const forEachLightProbeGridGPUCubeTexel = ( cubemapSize, onTexel ) => {

	const pixelSize = 2 / cubemapSize;

	Loop( { start: int( 0 ), end: int( 6 ), type: 'int', condition: '<' }, ( { i: face } ) => {

		Loop( { start: int( 0 ), end: int( cubemapSize ), type: 'int', condition: '<' }, ( { i: iy } ) => {

			Loop( { start: int( 0 ), end: int( cubemapSize ), type: 'int', condition: '<' }, ( { i: ix } ) => {

				const col = float( 1.0 ).sub( float( ix ).add( 0.5 ).mul( pixelSize ) );
				const row = float( 1.0 ).sub( float( iy ).add( 0.5 ).mul( pixelSize ) );
				const coord = vec3( 0 ).toVar();

				assignLightProbeGridGPUCubeDirection( face, row, col, coord );

				const lengthSq = coord.dot( coord );
				const weight = float( 4.0 ).div( lengthSq.sqrt().mul( lengthSq ) );
				const dir = coord.normalize();

				onTexel( coord, dir, weight );

			} );

		} );

	} );

};

const getLightProbeGridGPUSHBasisTerms = ( dir ) => {

	const x = dir.x;
	const y = dir.y;
	const z = dir.z;

	return [
		0.282095,
		y.mul( 0.488603 ),
		z.mul( 0.488603 ),
		x.mul( 0.488603 ),
		x.mul( y ).mul( 1.092548 ),
		y.mul( z ).mul( 1.092548 ),
		z.mul( z ).mul( 3.0 ).sub( 1.0 ).mul( 0.315392 ),
		x.mul( z ).mul( 1.092548 ),
		x.mul( x ).sub( y.mul( y ) ).mul( 0.546274 )
	];

};

const createLightProbeGridGPUSHBasis = () => Fn( ( { coefficient, dir } ) => {

	const basis = float( 0 ).toVar();
	const basisTerms = getLightProbeGridGPUSHBasisTerms( dir );

	If( coefficient.equal( uint( 0 ) ), () => {

		basis.assign( basisTerms[ 0 ] );

	} ).ElseIf( coefficient.equal( uint( 1 ) ), () => {

		basis.assign( basisTerms[ 1 ] );

	} ).ElseIf( coefficient.equal( uint( 2 ) ), () => {

		basis.assign( basisTerms[ 2 ] );

	} ).ElseIf( coefficient.equal( uint( 3 ) ), () => {

		basis.assign( basisTerms[ 3 ] );

	} ).ElseIf( coefficient.equal( uint( 4 ) ), () => {

		basis.assign( basisTerms[ 4 ] );

	} ).ElseIf( coefficient.equal( uint( 5 ) ), () => {

		basis.assign( basisTerms[ 5 ] );

	} ).ElseIf( coefficient.equal( uint( 6 ) ), () => {

		basis.assign( basisTerms[ 6 ] );

	} ).ElseIf( coefficient.equal( uint( 7 ) ), () => {

		basis.assign( basisTerms[ 7 ] );

	} ).Else( () => {

		basis.assign( basisTerms[ 8 ] );

	} );

	return basis;

} );

const addLightProbeGridGPUSH = ( coefficients, weightedRadiance, dir ) => {

	const basisTerms = getLightProbeGridGPUSHBasisTerms( dir );

	coefficients[ 0 ].addAssign( weightedRadiance.mul( basisTerms[ 0 ] ) );
	coefficients[ 1 ].addAssign( weightedRadiance.mul( basisTerms[ 1 ] ) );
	coefficients[ 2 ].addAssign( weightedRadiance.mul( basisTerms[ 2 ] ) );
	coefficients[ 3 ].addAssign( weightedRadiance.mul( basisTerms[ 3 ] ) );
	coefficients[ 4 ].addAssign( weightedRadiance.mul( basisTerms[ 4 ] ) );
	coefficients[ 5 ].addAssign( weightedRadiance.mul( basisTerms[ 5 ] ) );
	coefficients[ 6 ].addAssign( weightedRadiance.mul( basisTerms[ 6 ] ) );
	coefficients[ 7 ].addAssign( weightedRadiance.mul( basisTerms[ 7 ] ) );
	coefficients[ 8 ].addAssign( weightedRadiance.mul( basisTerms[ 8 ] ) );

};

export const createLightProbeGridGPUProjectionMaterial = ( cubeRenderTargetTexture, cubemapSize ) => {

	const shBasis = createLightProbeGridGPUSHBasis();

	const projectCube = Fn( () => {

		const coefficient = uint( uv().x.mul( SH_COEFFICIENTS ).floor() );
		const accum = vec3( 0 ).toVar();
		const totalWeight = float( 0 ).toVar();

		forEachLightProbeGridGPUCubeTexel( cubemapSize, ( coord, dir, weight ) => {

			const radiance = cubeTexture( cubeRenderTargetTexture, coord, 0 ).rgb;

			totalWeight.addAssign( weight );
			accum.addAssign( radiance.mul( weight ).mul( shBasis( { coefficient, dir } ) ) );

		} );

		const norm = float( 4 * Math.PI ).div( totalWeight );
		return accum.mul( norm );

	} );

	const material = new NodeMaterial();
	material.fragmentNode = projectCube();
	material.toneMapped = false;

	return material;

};

export const createLightProbeGridGPUComputeProjectionNode = ( cubeRenderTargetTexture, computeProjectionTexture, computeProjectionProbeIndex, cubemapSize ) => {

	const computeProjection = Fn( () => {

		const probeIndex = uint( computeProjectionProbeIndex );
		const coefficients = [
			vec3( 0 ).toVar(),
			vec3( 0 ).toVar(),
			vec3( 0 ).toVar(),
			vec3( 0 ).toVar(),
			vec3( 0 ).toVar(),
			vec3( 0 ).toVar(),
			vec3( 0 ).toVar(),
			vec3( 0 ).toVar(),
			vec3( 0 ).toVar()
		];
		const totalWeight = float( 0 ).toVar();

		forEachLightProbeGridGPUCubeTexel( cubemapSize, ( coord, dir, weight ) => {

			const radiance = cubeTexture( cubeRenderTargetTexture, coord, 0 ).rgb;
			const weightedRadiance = radiance.mul( weight );

			totalWeight.addAssign( weight );
			addLightProbeGridGPUSH( coefficients, weightedRadiance, dir );

		} );

		const norm = float( 4 * Math.PI ).div( totalWeight );

		textureStore( computeProjectionTexture, uvec2( uint( 0 ), probeIndex ), vec4( coefficients[ 0 ].mul( norm ), 1 ) ).toWriteOnly();
		textureStore( computeProjectionTexture, uvec2( uint( 1 ), probeIndex ), vec4( coefficients[ 1 ].mul( norm ), 1 ) ).toWriteOnly();
		textureStore( computeProjectionTexture, uvec2( uint( 2 ), probeIndex ), vec4( coefficients[ 2 ].mul( norm ), 1 ) ).toWriteOnly();
		textureStore( computeProjectionTexture, uvec2( uint( 3 ), probeIndex ), vec4( coefficients[ 3 ].mul( norm ), 1 ) ).toWriteOnly();
		textureStore( computeProjectionTexture, uvec2( uint( 4 ), probeIndex ), vec4( coefficients[ 4 ].mul( norm ), 1 ) ).toWriteOnly();
		textureStore( computeProjectionTexture, uvec2( uint( 5 ), probeIndex ), vec4( coefficients[ 5 ].mul( norm ), 1 ) ).toWriteOnly();
		textureStore( computeProjectionTexture, uvec2( uint( 6 ), probeIndex ), vec4( coefficients[ 6 ].mul( norm ), 1 ) ).toWriteOnly();
		textureStore( computeProjectionTexture, uvec2( uint( 7 ), probeIndex ), vec4( coefficients[ 7 ].mul( norm ), 1 ) ).toWriteOnly();
		textureStore( computeProjectionTexture, uvec2( uint( 8 ), probeIndex ), vec4( coefficients[ 8 ].mul( norm ), 1 ) ).toWriteOnly();

	} );

	return computeProjection().compute( 1 ).setName( 'LightProbeGridGPU compute projection' );

};
