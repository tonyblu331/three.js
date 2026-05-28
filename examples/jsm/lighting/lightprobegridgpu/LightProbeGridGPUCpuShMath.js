import { Vector3 } from 'three/webgpu';

import { SH_COEFFICIENTS } from './LightProbeGridGPUConstants.js';

const createCoefficientSet = () => Array.from( { length: SH_COEFFICIENTS }, () => ( { r: 0, g: 0, b: 0 } ) );

export const sphericalHarmonics3Basis = ( dir ) => {

	const x = dir.x;
	const y = dir.y;
	const z = dir.z;

	return [
		0.282095,
		0.488603 * y,
		0.488603 * z,
		0.488603 * x,
		1.092548 * x * y,
		1.092548 * y * z,
		0.315392 * ( 3 * z * z - 1 ),
		1.092548 * x * z,
		0.546274 * ( x * x - y * y )
	];

};

export const projectionConventionDirection = ( convention, faceIndex, ix, iy, imageWidth ) => {

	const pixelSize = 2 / imageWidth;
	const textureCol = - 1 + ( ix + 0.5 ) * pixelSize;
	const shaderCol = 1 - ( ix + 0.5 ) * pixelSize;
	const row = 1 - ( iy + 0.5 ) * pixelSize;

	if ( convention === 'shader-webgpu' ||
		convention === 'generator-render-target-webgpu' ||
		convention === 'cube-texture' ) {

		switch ( faceIndex ) {

			case 0: return new Vector3( - 1, row, shaderCol );
			case 1: return new Vector3( 1, row, - shaderCol );
			case 2: return new Vector3( shaderCol, 1, - row );
			case 3: return new Vector3( shaderCol, - 1, row );
			case 4: return new Vector3( shaderCol, row, 1 );
			default: return new Vector3( - shaderCol, row, - 1 );

		}

	}

	if ( convention === 'webgl-light-probe-grid' ||
		convention === 'generator-render-target-webgl' ) {

		switch ( faceIndex ) {

			case 0: return new Vector3( 1, row, - textureCol );
			case 1: return new Vector3( - 1, row, textureCol );
			case 2: return new Vector3( textureCol, 1, - row );
			case 3: return new Vector3( textureCol, - 1, row );
			case 4: return new Vector3( textureCol, row, 1 );
			default: return new Vector3( - textureCol, row, - 1 );

		}

	}

	throw new Error( `Unknown projection convention ${ convention }.` );

};

export const projectionFixtureColor = ( fixture, faceIndex, dir ) => {

	const resolvedFixture = fixture === 'axis-dominance' ? 'positive-axis-lobes' : fixture;

	if ( resolvedFixture === 'constant' ) return { r: 0.7, g: 0.45, b: 0.25 };

	if ( resolvedFixture === 'direction-rgb' ) {

		return {
			r: dir.x * 0.5 + 0.5,
			g: dir.y * 0.5 + 0.5,
			b: dir.z * 0.5 + 0.5
		};

	}

	if ( resolvedFixture === 'positive-axis-lobes' ) {

		return {
			r: Math.max( dir.x, 0 ),
			g: Math.max( dir.y, 0 ),
			b: Math.max( dir.z, 0 )
		};

	}

	const faceColors = [
		{ r: 1.0, g: 0.15, b: 0.05 },
		{ r: 0.05, g: 0.9, b: 0.2 },
		{ r: 0.15, g: 0.2, b: 1.0 },
		{ r: 0.95, g: 0.8, b: 0.1 },
		{ r: 0.2, g: 0.85, b: 0.85 },
		{ r: 0.85, g: 0.25, b: 0.9 }
	];

	return faceColors[ faceIndex ];

};

export const projectSyntheticCubeFragmentCoefficientPath = ( convention, fixture, imageWidth = 8 ) => {

	const coefficients = createCoefficientSet();

	for ( let coefficientIndex = 0; coefficientIndex < SH_COEFFICIENTS; coefficientIndex ++ ) {

		let totalWeight = 0;

		for ( let faceIndex = 0; faceIndex < 6; faceIndex ++ ) {

			for ( let iy = 0; iy < imageWidth; iy ++ ) {

				for ( let ix = 0; ix < imageWidth; ix ++ ) {

					const coord = projectionConventionDirection( convention, faceIndex, ix, iy, imageWidth );
					const lengthSq = coord.lengthSq();
					const weight = 4 / ( Math.sqrt( lengthSq ) * lengthSq );
					const dir = coord.clone().normalize();
					const color = projectionFixtureColor( fixture, faceIndex, dir );
					const basis = sphericalHarmonics3Basis( dir )[ coefficientIndex ];

					totalWeight += weight;
					coefficients[ coefficientIndex ].r += basis * color.r * weight;
					coefficients[ coefficientIndex ].g += basis * color.g * weight;
					coefficients[ coefficientIndex ].b += basis * color.b * weight;

				}

			}

		}

		const norm = 4 * Math.PI / totalWeight;
		coefficients[ coefficientIndex ].r *= norm;
		coefficients[ coefficientIndex ].g *= norm;
		coefficients[ coefficientIndex ].b *= norm;

	}

	return coefficients;

};

export const projectSyntheticCube = ( convention, fixture, imageWidth = 8 ) => {

	let totalWeight = 0;
	const coefficients = createCoefficientSet();

	for ( let faceIndex = 0; faceIndex < 6; faceIndex ++ ) {

		for ( let iy = 0; iy < imageWidth; iy ++ ) {

			for ( let ix = 0; ix < imageWidth; ix ++ ) {

				const coord = projectionConventionDirection( convention, faceIndex, ix, iy, imageWidth );
				const lengthSq = coord.lengthSq();
				const weight = 4 / ( Math.sqrt( lengthSq ) * lengthSq );
				const dir = coord.clone().normalize();
				const color = projectionFixtureColor( fixture, faceIndex, dir );
				const basis = sphericalHarmonics3Basis( dir );

				totalWeight += weight;

				for ( let coefficientIndex = 0; coefficientIndex < SH_COEFFICIENTS; coefficientIndex ++ ) {

					coefficients[ coefficientIndex ].r += basis[ coefficientIndex ] * color.r * weight;
					coefficients[ coefficientIndex ].g += basis[ coefficientIndex ] * color.g * weight;
					coefficients[ coefficientIndex ].b += basis[ coefficientIndex ] * color.b * weight;

				}

			}

		}

	}

	const norm = 4 * Math.PI / totalWeight;

	for ( const coefficient of coefficients ) {

		coefficient.r *= norm;
		coefficient.g *= norm;
		coefficient.b *= norm;

	}

	return coefficients;

};

export const maxCoefficientDelta = ( a, b ) => {

	let maxDelta = 0;

	for ( let i = 0; i < a.length; i ++ ) {

		maxDelta = Math.max(
			maxDelta,
			Math.abs( a[ i ].r - b[ i ].r ),
			Math.abs( a[ i ].g - b[ i ].g ),
			Math.abs( a[ i ].b - b[ i ].b )
		);

	}

	return maxDelta;

};

export const evaluateIrradianceContract = ( coefficients, normal, options = {} ) => {

	const band1Intensity = options.band1Intensity ?? 1;
	const band2Intensity = options.band2Intensity ?? 1;
	const clampNegative = options.clampNegative === true;
	const x = normal.x;
	const y = normal.y;
	const z = normal.z;
	const result = { r: 0, g: 0, b: 0 };
	const add = ( coefficient, scale ) => {

		result.r += coefficient.r * scale;
		result.g += coefficient.g * scale;
		result.b += coefficient.b * scale;

	};

	add( coefficients[ 0 ], 0.886227 );
	add( coefficients[ 1 ], 2.0 * 0.511664 * y * band1Intensity );
	add( coefficients[ 2 ], 2.0 * 0.511664 * z * band1Intensity );
	add( coefficients[ 3 ], 2.0 * 0.511664 * x * band1Intensity );
	add( coefficients[ 4 ], 2.0 * 0.429043 * x * y * band2Intensity );
	add( coefficients[ 5 ], 2.0 * 0.429043 * y * z * band2Intensity );
	add( coefficients[ 6 ], ( 0.743125 * z * z - 0.247708 ) * band2Intensity );
	add( coefficients[ 7 ], 2.0 * 0.429043 * x * z * band2Intensity );
	add( coefficients[ 8 ], 0.429043 * ( x * x - y * y ) * band2Intensity );

	if ( clampNegative ) {

		result.r = Math.max( result.r, 0 );
		result.g = Math.max( result.g, 0 );
		result.b = Math.max( result.b, 0 );

	}

	return result;

};

export const colorMaxDelta = ( a, b ) => Math.max(
	Math.abs( a.r - b.r ),
	Math.abs( a.g - b.g ),
	Math.abs( a.b - b.b )
);
