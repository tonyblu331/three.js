import {
	DataUtils,
	Mesh,
	NearestFilter,
	NodeMaterial,
	OrthographicCamera,
	PlaneGeometry,
	RenderTarget,
	RGBAFormat,
	Scene
} from 'three/webgpu';
import {
	Fn,
	floor,
	int,
	ivec2,
	textureLoad,
	viewportCoordinate
} from 'three/tsl';

import {
	PACKED_SH_COEFFICIENT_LAYOUT,
	PACKED_SH_TEXTURES,
	SH_COEFFICIENTS
} from '../../../examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUConstants.js';
import {
	getLightProbeGridGPUPackedAtlasLayer,
	getLightProbeGridGPUProbeCoord
} from '../../../examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlas.js';

const decodeLightProbeGridGPUReadbackValue = ( value, data ) => data instanceof Uint16Array ?
	DataUtils.fromHalfFloat( value ) :
	value;

const readLightProbeGridGPURenderTargetPixel = ( renderer, target, x, y, layer ) => renderer.readRenderTargetPixelsAsync( target, x, y, 1, 1, 0, layer );

const decodeLightProbeGridGPUReadbackPixel = ( data ) => [
	decodeLightProbeGridGPUReadbackValue( data[ 0 ], data ),
	decodeLightProbeGridGPUReadbackValue( data[ 1 ], data ),
	decodeLightProbeGridGPUReadbackValue( data[ 2 ], data ),
	decodeLightProbeGridGPUReadbackValue( data[ 3 ], data )
];

const decodeLightProbeGridGPUVisibilityMoment = ( data, varianceFloor ) => {

	const [
		meanDistance,
		meanSquaredDistance,
		hitConfidence,
		backfaceConfidence
	] = decodeLightProbeGridGPUReadbackPixel( data );
	const variance = meanSquaredDistance - meanDistance * meanDistance;

	return {
		meanDistance,
		meanSquaredDistance,
		variance: varianceFloor === undefined ? variance : Math.max( variance, varianceFloor ),
		hitConfidence,
		backfaceConfidence
	};

};

const isFiniteLightProbeGridGPUVisibilityMoment = ( moment ) => Number.isFinite( moment.meanDistance ) &&
	Number.isFinite( moment.meanSquaredDistance ) &&
	Number.isFinite( moment.hitConfidence ) &&
	Number.isFinite( moment.backfaceConfidence ) &&
	Number.isFinite( moment.variance );

export const readLightProbeGridGPURenderTargetRegion = ( renderer, target, width, height ) => renderer.readRenderTargetPixelsAsync(
	target,
	0,
	0,
	width,
	height
);

export async function readLightProbeGridGPURenderedTargetRegion( renderer, scene, camera, target, width, height ) {

	renderer.setRenderTarget( target );
	renderer.clear();
	renderer.render( scene, camera );

	return await readLightProbeGridGPURenderTargetRegion( renderer, target, width, height );

}

export const readLightProbeGridGPUCoefficientTarget = async ( renderer, grid, width, height ) => Array.from(
	await readLightProbeGridGPURenderTargetRegion( renderer, grid.coefficientTarget, width, height )
);

export async function readLightProbeGridGPUComputeCoefficientTexture( renderer, grid, width, height ) {

	const target = new RenderTarget( width, height, {
		format: RGBAFormat,
		type: grid.coefficientTarget.texture.type,
		minFilter: NearestFilter,
		magFilter: NearestFilter,
		depthBuffer: false
	} );
	const material = new NodeMaterial();
	const camera = new OrthographicCamera( - 1, 1, 1, - 1, - 1, 1 );
	const mesh = new Mesh( new PlaneGeometry( 2, 2 ), material );
	const readbackScene = new Scene();
	const previousRenderTarget = renderer.getRenderTarget();
	const previousAutoClear = renderer.autoClear;

	material.fragmentNode = Fn( () => {

		const ix = int( floor( viewportCoordinate.x ) );
		const iy = int( floor( viewportCoordinate.y ) );

		return textureLoad( grid.computeProjectionTexture, ivec2( ix, iy ) );

	} )();
	material.toneMapped = false;
	readbackScene.add( mesh );

	try {

		renderer.autoClear = false;
		renderer.setRenderTarget( target );
		renderer.render( readbackScene, camera );

		return Array.from( await readLightProbeGridGPURenderTargetRegion( renderer, target, width, height ) );

	} finally {

		renderer.setRenderTarget( previousRenderTarget );
		renderer.autoClear = previousAutoClear;
		mesh.geometry.dispose();
		material.dispose();
		target.dispose();

	}

}

export async function readLightProbeGridGPUPackedAtlasPixel( renderer, grid, address ) {

	const layer = getLightProbeGridGPUPackedAtlasLayer( address.textureIndex, address.gridZ, grid.paddedSlices );
	const data = await readLightProbeGridGPURenderTargetPixel( renderer, grid.atlasTarget, address.x, address.y, layer );

	return Array.from( data );

}

export async function readLightProbeGridGPUDecodedPackedAtlasPixel( renderer, grid, address ) {

	const layer = getLightProbeGridGPUPackedAtlasLayer( address.textureIndex, address.gridZ, grid.paddedSlices );
	const data = await readLightProbeGridGPURenderTargetPixel( renderer, grid.atlasTarget, address.x, address.y, layer );

	return decodeLightProbeGridGPUReadbackPixel( data );

}

export async function readLightProbeGridGPUProbeCoefficients( renderer, grid, probeIndex, resolution ) {

	const { x, y, z } = getLightProbeGridGPUProbeCoord( probeIndex, resolution );
	const samples = [];

	for ( let textureIndex = 0; textureIndex < PACKED_SH_TEXTURES; textureIndex ++ ) {

		samples.push( await readLightProbeGridGPUDecodedPackedAtlasPixel(
			renderer,
			grid,
			{ textureIndex, gridZ: z, x, y }
		) );

	}

	const coefficients = Array.from( { length: SH_COEFFICIENTS }, () => ( { r: 0, g: 0, b: 0 } ) );

	for ( let textureIndex = 0; textureIndex < PACKED_SH_COEFFICIENT_LAYOUT.length; textureIndex ++ ) {

		const layout = PACKED_SH_COEFFICIENT_LAYOUT[ textureIndex ];

		for ( let channelIndex = 0; channelIndex < layout.length; channelIndex ++ ) {

			const entry = layout[ channelIndex ];

			if ( entry.value === 'validity' ) continue;

			coefficients[ entry.coefficient ][ entry.component ] = samples[ textureIndex ][ channelIndex ];

		}

	}

	return {
		probeIndex,
		coord: { x, y, z },
		coefficients,
		validity: samples[ PACKED_SH_TEXTURES - 1 ][ 3 ],
		l0Irradiance: {
			r: coefficients[ 0 ].r * 0.886227,
			g: coefficients[ 0 ].g * 0.886227,
			b: coefficients[ 0 ].b * 0.886227
		}
	};

}

const octahedralUvFromDirection = ( direction ) => {

	const denominator = Math.max(
		Math.abs( direction.x ) + Math.abs( direction.y ) + Math.abs( direction.z ),
		0.0001
	);
	let x = direction.x / denominator;
	let y = direction.y / denominator;

	if ( direction.z < 0 ) {

		const foldedX = ( 1 - Math.abs( y ) ) * ( x >= 0 ? 1 : - 1 );
		const foldedY = ( 1 - Math.abs( x ) ) * ( y >= 0 ? 1 : - 1 );
		x = foldedX;
		y = foldedY;

	}

	return {
		x: x * 0.5 + 0.5,
		y: y * 0.5 + 0.5
	};

};

export async function readLightProbeGridGPUVisibilityMoment( renderer, grid, direction, probeIndex, minVariance ) {

	const octUv = octahedralUvFromDirection( direction );
	const visibilityResolution = grid.visibilityDepthResolution ?? 0;
	const target = grid.visibilityDepthTarget ?? null;
	const x = visibilityResolution > 0 ?
		Math.max( 0, Math.min( visibilityResolution - 1, Math.floor( octUv.x * visibilityResolution ) ) ) :
		0;
	const y = visibilityResolution > 0 ?
		Math.max( 0, Math.min( visibilityResolution - 1, Math.floor( octUv.y * visibilityResolution ) ) ) :
		0;

	if ( target === null || visibilityResolution <= 0 ) {

		return {
			x,
			y,
			meanDistance: Number.POSITIVE_INFINITY,
			meanSquaredDistance: Number.POSITIVE_INFINITY,
			variance: minVariance,
			hitConfidence: 0,
			validity: 1,
			backfaceConfidence: 0,
			momentEncoding: 'unavailable'
		};

	}

	const data = await readLightProbeGridGPURenderTargetPixel( renderer, target, x, y, probeIndex );
	const moment = decodeLightProbeGridGPUVisibilityMoment( data, minVariance );

	return {
		x,
		y,
		meanDistance: moment.meanDistance,
		meanSquaredDistance: moment.meanSquaredDistance,
		variance: moment.variance,
		hitConfidence: moment.hitConfidence,
		validity: 1,
		backfaceConfidence: moment.backfaceConfidence,
		momentEncoding: 'radial-distance'
	};

}

export async function readLightProbeGridGPUVisibilityMomentPixel( renderer, target, point ) {

	const data = await readLightProbeGridGPURenderTargetPixel( renderer, target, point.x, point.y, point.probeIndex );
	const moment = decodeLightProbeGridGPUVisibilityMoment( data );

	return {
		...point,
		...moment,
		finite: isFiniteLightProbeGridGPUVisibilityMoment( moment )
	};

}
