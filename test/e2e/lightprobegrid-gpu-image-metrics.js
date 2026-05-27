const lightProbeReferenceRegions = {
	leftWall: { x0: 0.10, x1: 0.20, y0: 0.42, y1: 0.62 },
	rightWall: { x0: 0.72, x1: 0.88, y0: 0.36, y1: 0.72 },
	backWall: { x0: 0.30, x1: 0.64, y0: 0.30, y1: 0.58 },
	floorCenter: { x0: 0.30, x1: 0.66, y0: 0.68, y1: 0.9 },
	sphere: { x0: 0.54, x1: 0.74, y0: 0.42, y1: 0.64 },
	tallBox: { x0: 0.28, x1: 0.50, y0: 0.46, y1: 0.84 },
	shortBox: { x0: 0.48, x1: 0.68, y0: 0.58, y1: 0.88 }
};

const roundLightProbeMetric = value => Number( value.toFixed( 4 ) );

function createLightProbeImageRegionMetric( image, region, gridCells = 6 ) {

	const x0 = Math.floor( image.width * region.x0 );
	const x1 = Math.floor( image.width * region.x1 );
	const y0 = Math.floor( image.height * region.y0 );
	const y1 = Math.floor( image.height * region.y1 );
	const width = Math.max( x1 - x0, 1 );
	const height = Math.max( y1 - y0, 1 );
	const luminance = [];
	const color = { r: 0, g: 0, b: 0 };
	let sum = 0;

	for ( let y = y0; y < y1; y ++ ) {

		for ( let x = x0; x < x1; x ++ ) {

			const i = ( y * image.width + x ) * 4;
			const red = image.data[ i ];
			const green = image.data[ i + 1 ];
			const blue = image.data[ i + 2 ];
			const value = red * 0.2126 + green * 0.7152 + blue * 0.0722;

			luminance.push( value );
			sum += value;
			color.r += red;
			color.g += green;
			color.b += blue;

		}

	}

	const sorted = [ ...luminance ].sort( ( a, b ) => a - b );
	const percentile = value => sorted[ Math.min( sorted.length - 1, Math.max( 0, Math.floor( ( sorted.length - 1 ) * value ) ) ) ];
	const sampleCount = Math.max( luminance.length, 1 );
	color.r /= sampleCount;
	color.g /= sampleCount;
	color.b /= sampleCount;
	const darkThreshold = Math.max( 16, percentile( 0.5 ) * 0.35 );
	const blackThreshold = 32;
	const darkSamples = luminance.filter( value => value <= darkThreshold ).length;
	const blackSamples = luminance.filter( value => value <= blackThreshold ).length;
	const cellCount = Math.max( 2, Math.min( 8, gridCells ) );
	const cellMeans = [];

	for ( let cy = 0; cy < cellCount; cy ++ ) {

		cellMeans[ cy ] = [];

		for ( let cx = 0; cx < cellCount; cx ++ ) {

			const cellX0 = Math.floor( cx * width / cellCount );
			const cellX1 = Math.max( cellX0 + 1, Math.floor( ( cx + 1 ) * width / cellCount ) );
			const cellY0 = Math.floor( cy * height / cellCount );
			const cellY1 = Math.max( cellY0 + 1, Math.floor( ( cy + 1 ) * height / cellCount ) );
			let cellSum = 0;
			let cellSamples = 0;

			for ( let y = cellY0; y < cellY1; y ++ ) {

				for ( let x = cellX0; x < cellX1; x ++ ) {

					cellSum += luminance[ y * width + x ];
					cellSamples ++;

				}

			}

			cellMeans[ cy ][ cx ] = cellSum / Math.max( cellSamples, 1 );

		}

	}

	let maxCellEdgeContrast = 0;

	for ( let cy = 0; cy < cellCount; cy ++ ) {

		for ( let cx = 0; cx < cellCount; cx ++ ) {

			if ( cx + 1 < cellCount ) {

				maxCellEdgeContrast = Math.max( maxCellEdgeContrast, Math.abs( cellMeans[ cy ][ cx ] - cellMeans[ cy ][ cx + 1 ] ) );

			}

			if ( cy + 1 < cellCount ) {

				maxCellEdgeContrast = Math.max( maxCellEdgeContrast, Math.abs( cellMeans[ cy ][ cx ] - cellMeans[ cy + 1 ][ cx ] ) );

			}

		}

	}

	return {
		region,
		samples: luminance.length,
		gridCells: cellCount,
		color: {
			r: roundLightProbeMetric( color.r ),
			g: roundLightProbeMetric( color.g ),
			b: roundLightProbeMetric( color.b )
		},
		colorBias: {
			redOverGreen: roundLightProbeMetric( color.r / Math.max( color.g, 0.0001 ) ),
			greenOverRed: roundLightProbeMetric( color.g / Math.max( color.r, 0.0001 ) )
		},
		luminance: {
			min: roundLightProbeMetric( sorted[ 0 ] ),
			p01: roundLightProbeMetric( percentile( 0.01 ) ),
			p05: roundLightProbeMetric( percentile( 0.05 ) ),
			median: roundLightProbeMetric( percentile( 0.5 ) ),
			p95: roundLightProbeMetric( percentile( 0.95 ) ),
			max: roundLightProbeMetric( sorted[ sorted.length - 1 ] ),
			mean: roundLightProbeMetric( sum / sampleCount )
		},
		darkThreshold: roundLightProbeMetric( darkThreshold ),
		darkPixelRatio: roundLightProbeMetric( darkSamples / sampleCount ),
		blackThreshold,
		blackPixelRatio: roundLightProbeMetric( blackSamples / sampleCount ),
		cellEdgeContrast: roundLightProbeMetric( maxCellEdgeContrast )
	};

}

export function captureLightProbeImageRegions( image ) {

	const regions = {};

	for ( const [ name, region ] of Object.entries( lightProbeReferenceRegions ) ) {

		regions[ name ] = createLightProbeImageRegionMetric( image, region );

	}

	return regions;

}

export function createLightProbeImageArtifactPressure( regions ) {

	const objectRegions = [ 'sphere', 'tallBox', 'shortBox' ].map( name => regions[ name ] ).filter( Boolean );
	const maxDarkPixelRatio = Math.max( ...objectRegions.map( region => region.darkPixelRatio ) );
	const maxBlackPixelRatio = Math.max( ...objectRegions.map( region => region.blackPixelRatio ) );
	const maxCellEdgeContrast = Math.max( ...objectRegions.map( region => region.cellEdgeContrast ) );
	const luminanceFloor = Math.min( ...objectRegions.map( region => region.luminance.p01 ) );

	return {
		sphereDarkPixelRatio: roundLightProbeMetric( regions.sphere.darkPixelRatio ),
		tallBoxDarkPixelRatio: roundLightProbeMetric( regions.tallBox.darkPixelRatio ),
		shortBoxDarkPixelRatio: roundLightProbeMetric( regions.shortBox.darkPixelRatio ),
		objectDarkTailRatio: roundLightProbeMetric( maxDarkPixelRatio ),
		objectBlackTailRatio: roundLightProbeMetric( maxBlackPixelRatio ),
		luminanceFloor: roundLightProbeMetric( luminanceFloor ),
		cellEdgeContrast: roundLightProbeMetric( maxCellEdgeContrast ),
		status: maxBlackPixelRatio > 0.15 || luminanceFloor < 24 ? 'PRESSURE' : 'bounded'
	};

}

