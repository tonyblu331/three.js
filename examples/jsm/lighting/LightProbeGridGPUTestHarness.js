import * as THREE from 'three/webgpu';
import { floor, Fn, normalWorld, uniform, uv, vec4 } from 'three/tsl';

import { LightProbeGridGPU } from './LightProbeGridGPU.js';
import { createLightProbeGridGPUVisibilityWeightingStudy } from './LightProbeGridGPUVisibilityWeightingStudy.js';
import {
	readLightProbeGridGPUCoefficientTarget,
	readLightProbeGridGPUComputeCoefficientTexture,
	readLightProbeGridGPUDecodedPackedAtlasPixel,
	readLightProbeGridGPUPackedAtlasPixel,
	readLightProbeGridGPUVisibilityMomentPixel
} from './lightprobegridgpu/LightProbeGridGPUProofReadback.js';
import {
	ATLAS_PADDING,
	PACKED_SH_COEFFICIENT_LAYOUT,
	PACKED_SH_TEXTURES,
	SH_COEFFICIENTS
} from './lightprobegridgpu/LightProbeGridGPUConstants.js';
import {
	getLightProbeGridGPUAtlasDepth,
	getLightProbeGridGPUPackedAtlasBaseLayer,
	getLightProbeGridGPUPackedAtlasCenterSampleZ,
	getLightProbeGridGPUPackedAtlasLayer,
	getLightProbeGridGPUPaddedAtlasSlices,
	getLightProbeGridGPUProbeIndex
} from './lightprobegridgpu/LightProbeGridGPUAtlas.js';
import {
	colorMaxDelta,
	evaluateIrradianceContract,
	maxCoefficientDelta,
	projectSyntheticCube,
	projectSyntheticCubeFragmentCoefficientPath
} from './lightprobegridgpu/LightProbeGridGPUCpuShMath.js';

export function createLightProbeGridGPUTestHarness( readLightProbeContext ) {

	const getLightProbeContext = typeof readLightProbeContext === 'function' ? readLightProbeContext : () => readLightProbeContext;
	const _lightProbeContext = new Proxy( {}, {
		get( target, key ) {

			return getLightProbeContext()[ key ];

		}
	} );

	const searchParams = new URLSearchParams( window.location.search );

	if ( searchParams.has( 'testHarness' ) === false ) return;

	const waitUntilReady = async () => {

		for ( let i = 0; i < 240; i ++ ) {

			if ( _lightProbeContext.params.bakeStatus === 'ready' ) return;
			if ( _lightProbeContext.params.bakeStatus === 'failed' ) throw new Error( 'LightProbeGridGPU bake failed.' );

			await new Promise( resolve => setTimeout( resolve, 250 ) );

		}

		throw new Error( 'LightProbeGridGPU bake timed out.' );

	};

	const assert = ( condition, message ) => {

		if ( condition === false ) throw new Error( message );

	};

	const sampleCanvas = ( regions ) => {

		const source = _lightProbeContext.renderer.domElement;
		const canvas = document.createElement( 'canvas' );
		canvas.width = source.width;
		canvas.height = source.height;

		const context = canvas.getContext( '2d', { willReadFrequently: true } );
		context.drawImage( source, 0, 0 );

		return regions.map( ( region ) => {

			const x0 = Math.floor( canvas.width * region.x0 );
			const x1 = Math.floor( canvas.width * region.x1 );
			const y0 = Math.floor( canvas.height * region.y0 );
			const y1 = Math.floor( canvas.height * region.y1 );
			const image = context.getImageData( x0, y0, x1 - x0, y1 - y0 );
			const color = { r: 0, g: 0, b: 0 };
			const count = image.data.length / 4;

			for ( let i = 0; i < image.data.length; i += 4 ) {

				color.r += image.data[ i ];
				color.g += image.data[ i + 1 ];
				color.b += image.data[ i + 2 ];

			}

			color.r /= count;
			color.g /= count;
			color.b /= count;

			return color;

		} );

	};

	const captureColorSanity = async () => {

		_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		const [ left, right, center ] = sampleCanvas( [
			{ x0: 0.08, x1: 0.24, y0: 0.32, y1: 0.68 },
			{ x0: 0.76, x1: 0.92, y0: 0.32, y1: 0.68 },
			{ x0: 0.42, x1: 0.58, y0: 0.38, y1: 0.62 }
		] );

		assert( left.r > left.g * 1.25, 'probes only: expected red wall on the left side.' );
		assert( right.g > right.r * 1.25, 'probes only: expected green wall on the right side.' );
		assert( center.r + center.g + center.b > 18, 'probes only: expected visible probe-lit geometry.' );

		return {
			leftRedOverGreen: roundMetric( left.r / Math.max( left.g, 0.0001 ) ),
			rightGreenOverRed: roundMetric( right.g / Math.max( right.r, 0.0001 ) ),
			centerEnergy: roundMetric( center.r + center.g + center.b )
		};

	};

	const createArtifactColor = ( color ) => ( {
		luminance: color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
	} );

	const roundMetric = ( value ) => Number( value.toFixed( 4 ) );
	const roundTimingMetric = ( value ) => Number( value.toFixed( 2 ) );
	const summarizeMetric = ( values ) => {

		const finiteValues = values.filter( value => Number.isFinite( value ) ).slice().sort( ( a, b ) => a - b );

		if ( finiteValues.length === 0 ) {

			return {
				median: null
			};

		}

		const middle = Math.floor( finiteValues.length / 2 );
		const median = finiteValues.length % 2 === 1 ?
			finiteValues[ middle ] :
			( finiteValues[ middle - 1 ] + finiteValues[ middle ] ) / 2;

		return {
			median: roundTimingMetric( median )
		};

	};

	const createProjectionStaticWork = ( resolution, cubemapSize ) => {

		const totalProbes = resolution * resolution * resolution;
		const cubemapTexelsPerProbe = 6 * cubemapSize * cubemapSize;
		const fragmentCubemapSweepsPerProbe = 9;
		const computeCubemapSweepsPerProbe = 1;
		const fragmentTexelVisits = totalProbes * fragmentCubemapSweepsPerProbe * cubemapTexelsPerProbe;
		const computeTexelVisits = totalProbes * computeCubemapSweepsPerProbe * cubemapTexelsPerProbe;
		const savedTexelVisits = fragmentTexelVisits - computeTexelVisits;
		const reductionRatio = 1 - computeTexelVisits / fragmentTexelVisits;

		return {
			resolution,
			totalProbes,
			cubemapSize,
			cubemapTexelsPerProbe,
			fragmentCubemapSweepsPerProbe,
			computeCubemapSweepsPerProbe,
			fragmentTexelVisits,
			computeTexelVisits,
			savedTexelVisits,
			reductionRatio: roundMetric( reductionRatio ),
			reductionPercent: roundMetric( reductionRatio * 100 )
		};

	};

	const createProjectionFixtureGrid = ( resolution, cubemapSize, probeValidity, renderer ) => new LightProbeGridGPU(
		_lightProbeContext.gridMin,
		_lightProbeContext.gridMax,
		{
			resolution,
			cubemapSize,
			projectionPrecision: 'half float',
			probeValidity,
			renderer
		}
	);

	const createUnitProbeGrid = ( options = {} ) => new LightProbeGridGPU(
		new THREE.Vector3( - 1, - 1, - 1 ),
		new THREE.Vector3( 1, 1, 1 ),
		{
			resolution: 2,
			cubemapSize: 4,
			projectionPrecision: 'half float',
			renderer: _lightProbeContext.renderer,
			...options
		}
	);

	const captureSyncRejection = ( operation ) => {

		try {

			operation();

		} catch ( error ) {

			return {
				rejected: true,
				message: error instanceof Error ? error.message : String( error )
			};

		}

		return {
			rejected: false,
			message: ''
		};

	};

	const roundVector = ( vector ) => ( {
		x: roundMetric( vector.x ),
		y: roundMetric( vector.y ),
		z: roundMetric( vector.z )
	} );

	const materialSideLabel = ( side ) => {

		if ( side === THREE.FrontSide ) return 'FrontSide';
		if ( side === THREE.BackSide ) return 'BackSide';
		if ( side === THREE.DoubleSide ) return 'DoubleSide';

		return `side-${ side }`;

	};

	const artifactRegions = {
		leftWall: { x0: 0.10, x1: 0.20, y0: 0.42, y1: 0.62 },
		rightWall: { x0: 0.72, x1: 0.88, y0: 0.36, y1: 0.72 },
		backWall: { x0: 0.30, x1: 0.64, y0: 0.30, y1: 0.58 },
		ceilingEmitter: { x0: 0.34, x1: 0.66, y0: 0.12, y1: 0.34 },
		floorCenter: { x0: 0.30, x1: 0.66, y0: 0.68, y1: 0.9 },
		sphere: { x0: 0.54, x1: 0.74, y0: 0.42, y1: 0.64 },
		tallBox: { x0: 0.28, x1: 0.50, y0: 0.46, y1: 0.84 },
		shortBox: { x0: 0.48, x1: 0.68, y0: 0.58, y1: 0.88 }
	};

	const leakArtifactRegions = {
		leftReceiver: { x0: 0.34, x1: 0.47, y0: 0.44, y1: 0.69 },
		rightReceiver: { x0: 0.47, x1: 0.60, y0: 0.44, y1: 0.69 },
		divider: { x0: 0.42, x1: 0.52, y0: 0.22, y1: 0.78 }
	};

	const createObjectScreenRegion = ( object, margin = 0.015 ) => {

		if ( object === undefined || object === null ) return null;

		_lightProbeContext.scene.updateMatrixWorld( true );
		_lightProbeContext.camera.updateMatrixWorld( true );
		_lightProbeContext.camera.updateProjectionMatrix();

		if ( object.geometry.boundingBox === null ) object.geometry.computeBoundingBox();

		const box = object.geometry.boundingBox;
		const corners = [
			new THREE.Vector3( box.min.x, box.min.y, box.min.z ),
			new THREE.Vector3( box.min.x, box.min.y, box.max.z ),
			new THREE.Vector3( box.min.x, box.max.y, box.min.z ),
			new THREE.Vector3( box.min.x, box.max.y, box.max.z ),
			new THREE.Vector3( box.max.x, box.min.y, box.min.z ),
			new THREE.Vector3( box.max.x, box.min.y, box.max.z ),
			new THREE.Vector3( box.max.x, box.max.y, box.min.z ),
			new THREE.Vector3( box.max.x, box.max.y, box.max.z )
		];
		const projected = new THREE.Vector3();
		const region = {
			x0: 1,
			x1: 0,
			y0: 1,
			y1: 0
		};

		for ( const corner of corners ) {

			projected.copy( corner ).applyMatrix4( object.matrixWorld ).project( _lightProbeContext.camera );

			if ( Number.isFinite( projected.x ) === false ||
				Number.isFinite( projected.y ) === false ) {

				continue;

			}

			const x = projected.x * 0.5 + 0.5;
			const y = 1 - ( projected.y * 0.5 + 0.5 );

			region.x0 = Math.min( region.x0, x );
			region.x1 = Math.max( region.x1, x );
			region.y0 = Math.min( region.y0, y );
			region.y1 = Math.max( region.y1, y );

		}

		if ( region.x1 <= region.x0 || region.y1 <= region.y0 ) return null;

		return {
			x0: Math.max( 0, region.x0 - margin ),
			x1: Math.min( 1, region.x1 + margin ),
			y0: Math.max( 0, region.y0 - margin ),
			y1: Math.min( 1, region.y1 + margin )
		};

	};

	const createObjectCenterScreenRegion = ( object, radius = 0.012 ) => {

		if ( object === undefined || object === null ) return null;

		_lightProbeContext.scene.updateMatrixWorld( true );
		_lightProbeContext.camera.updateMatrixWorld( true );
		_lightProbeContext.camera.updateProjectionMatrix();

		const center = new THREE.Vector3();
		const projected = new THREE.Vector3();
		object.getWorldPosition( center );
		projected.copy( center ).project( _lightProbeContext.camera );

		if ( Number.isFinite( projected.x ) === false ||
			Number.isFinite( projected.y ) === false ) {

			return null;

		}

		const x = projected.x * 0.5 + 0.5;
		const y = 1 - ( projected.y * 0.5 + 0.5 );

		return {
			x0: Math.max( 0, x - radius ),
			x1: Math.min( 1, x + radius ),
			y0: Math.max( 0, y - radius ),
			y1: Math.min( 1, y + radius )
		};

	};

	const createObjectSurfaceScreenRegion = ( object, scale = 0.55, margin = 0.004 ) => {

		if ( object === undefined || object === null ) return null;

		_lightProbeContext.scene.updateMatrixWorld( true );
		_lightProbeContext.camera.updateMatrixWorld( true );
		_lightProbeContext.camera.updateProjectionMatrix();

		if ( object.geometry.boundingBox === null ) object.geometry.computeBoundingBox();

		const box = object.geometry.boundingBox;
		const center = new THREE.Vector3(
			( box.min.x + box.max.x ) * 0.5,
			( box.min.y + box.max.y ) * 0.5,
			( box.min.z + box.max.z ) * 0.5
		);
		const halfSize = new THREE.Vector3(
			( box.max.x - box.min.x ) * scale * 0.5,
			( box.max.y - box.min.y ) * scale * 0.5,
			( box.max.z - box.min.z ) * scale * 0.5
		);
		const thinZ = Math.abs( box.max.z - box.min.z ) < 0.0001;
		const localPoints = thinZ ? [
			new THREE.Vector3( center.x - halfSize.x, center.y - halfSize.y, center.z ),
			new THREE.Vector3( center.x + halfSize.x, center.y - halfSize.y, center.z ),
			new THREE.Vector3( center.x - halfSize.x, center.y + halfSize.y, center.z ),
			new THREE.Vector3( center.x + halfSize.x, center.y + halfSize.y, center.z )
		] : [
			new THREE.Vector3( center.x - halfSize.x, center.y - halfSize.y, center.z - halfSize.z ),
			new THREE.Vector3( center.x + halfSize.x, center.y - halfSize.y, center.z - halfSize.z ),
			new THREE.Vector3( center.x - halfSize.x, center.y + halfSize.y, center.z + halfSize.z ),
			new THREE.Vector3( center.x + halfSize.x, center.y + halfSize.y, center.z + halfSize.z )
		];
		const projected = new THREE.Vector3();
		const region = {
			x0: 1,
			x1: 0,
			y0: 1,
			y1: 0
		};

		for ( const point of localPoints ) {

			projected.copy( point ).applyMatrix4( object.matrixWorld ).project( _lightProbeContext.camera );

			if ( Number.isFinite( projected.x ) === false ||
				Number.isFinite( projected.y ) === false ) {

				continue;

			}

			const x = projected.x * 0.5 + 0.5;
			const y = 1 - ( projected.y * 0.5 + 0.5 );

			region.x0 = Math.min( region.x0, x );
			region.x1 = Math.max( region.x1, x );
			region.y0 = Math.min( region.y0, y );
			region.y1 = Math.max( region.y1, y );

		}

		if ( region.x1 <= region.x0 || region.y1 <= region.y0 ) return null;

		return {
			x0: Math.max( 0, region.x0 - margin ),
			x1: Math.min( 1, region.x1 + margin ),
			y0: Math.max( 0, region.y0 - margin ),
			y1: Math.min( 1, region.y1 + margin )
		};

	};

	const createLeakCaptureRegions = () => {

		if ( _lightProbeContext.leakFixture === null ) return leakArtifactRegions;

		const divider = _lightProbeContext.getActiveLeakDivider();

		return {
			leftReceiver: createObjectScreenRegion( _lightProbeContext.leakFixture.leftReceiver ) ?? leakArtifactRegions.leftReceiver,
			rightReceiver: createObjectScreenRegion( _lightProbeContext.leakFixture.rightReceiver ) ?? leakArtifactRegions.rightReceiver,
			divider: createObjectScreenRegion( divider, 0.02 ) ?? leakArtifactRegions.divider
		};

	};

	const captureCanvasSample = () => {

		_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		const source = _lightProbeContext.renderer.domElement;
		const canvas = document.createElement( 'canvas' );
		canvas.width = source.width;
		canvas.height = source.height;

		const context = canvas.getContext( '2d', { willReadFrequently: true } );
		context.drawImage( source, 0, 0 );

		return { context, width: canvas.width, height: canvas.height };

	};

	const roundContractMetric = ( value ) => Number( value.toFixed( 8 ) );

	const inspectSHMathContract = () => {

		const normals = {
			positiveX: new THREE.Vector3( 1, 0, 0 ),
			positiveY: new THREE.Vector3( 0, 1, 0 ),
			positiveZ: new THREE.Vector3( 0, 0, 1 ),
			negativeX: new THREE.Vector3( - 1, 0, 0 ),
			negativeY: new THREE.Vector3( 0, - 1, 0 ),
			negativeZ: new THREE.Vector3( 0, 0, - 1 )
		};
		const constantColor = { r: 0.7, g: 0.45, b: 0.25 };
		const expectedConstantIrradiance = {
			r: Math.PI * constantColor.r,
			g: Math.PI * constantColor.g,
			b: Math.PI * constantColor.b
		};
		const constantCoefficients = projectSyntheticCube( 'shader-webgpu', 'constant', 8 );
		const directionCoefficients = projectSyntheticCube( 'shader-webgpu', 'direction-rgb', 16 );
		let constantMaxDelta = 0;

		for ( const normal of Object.values( normals ) ) {

			const irradiance = evaluateIrradianceContract( constantCoefficients, normal, { clampNegative: true } );
			const delta = colorMaxDelta( irradiance, expectedConstantIrradiance );

			constantMaxDelta = Math.max( constantMaxDelta, delta );

		}

		const axisResponse = Object.fromEntries( Object.entries( normals ).map( ( [ name, normal ] ) => {

			const irradiance = evaluateIrradianceContract( directionCoefficients, normal, { clampNegative: true } );

			return [ name, {
				r: roundContractMetric( irradiance.r ),
				g: roundContractMetric( irradiance.g ),
				b: roundContractMetric( irradiance.b )
			} ];

		} ) );
		let threeJsIrradianceParity = { available: false, maxDelta: null };

		if ( typeof THREE.SphericalHarmonics3 === 'function' ) {

			const sh = new THREE.SphericalHarmonics3();
			for ( let i = 0; i < SH_COEFFICIENTS; i ++ ) {

				sh.coefficients[ i ].set(
					directionCoefficients[ i ].r,
					directionCoefficients[ i ].g,
					directionCoefficients[ i ].b
				);

			}

			const target = new THREE.Vector3();
			let maxDelta = 0;

			for ( const normal of Object.values( normals ) ) {

				sh.getIrradianceAt( normal, target );
				const contract = evaluateIrradianceContract( directionCoefficients, normal, { clampNegative: false } );
				maxDelta = Math.max( maxDelta, colorMaxDelta( contract, { r: target.x, g: target.y, b: target.z } ) );

			}

			threeJsIrradianceParity = { available: true, maxDelta: roundContractMetric( maxDelta ) };

		}

		return {
			constantRadiance: {
				maxDelta: roundContractMetric( constantMaxDelta )
			},
			axisDeltas: {
				positiveXRedMinusNegativeX: roundContractMetric( axisResponse.positiveX.r - axisResponse.negativeX.r ),
				positiveYGreenMinusNegativeY: roundContractMetric( axisResponse.positiveY.g - axisResponse.negativeY.g ),
				positiveZBlueMinusNegativeZ: roundContractMetric( axisResponse.positiveZ.b - axisResponse.negativeZ.b )
			},
			threeJsIrradianceParity
		};

	};

	const inspectProjectionParity = () => {

		const fixtures = [ 'constant', 'six-face-colors', 'direction-rgb', 'positive-axis-lobes' ].map( ( fixture ) => {

			const shaderWebGPU = projectSyntheticCube( 'shader-webgpu', fixture );
			const generatorWebGPU = projectSyntheticCube( 'generator-render-target-webgpu', fixture );
			const cubeTexture = projectSyntheticCube( 'cube-texture', fixture );
			const webglGrid = projectSyntheticCube( 'webgl-light-probe-grid', fixture );
			const generatorWebGL = projectSyntheticCube( 'generator-render-target-webgl', fixture );

			return {
				fixture,
				shaderToGeneratorDelta: maxCoefficientDelta( shaderWebGPU, generatorWebGPU ),
				webglGridToGeneratorDelta: maxCoefficientDelta( webglGrid, generatorWebGL ),
				shaderToCubeTextureDelta: maxCoefficientDelta( shaderWebGPU, cubeTexture ),
				shaderToWebGLGridDelta: maxCoefficientDelta( shaderWebGPU, webglGrid )
			};

		} );
		const projectionFixtureCount = fixtures.length;
		const computeCandidateFixtures = [ 'constant', 'face-asymmetric', 'axis-dominance' ].map( ( fixture ) => {

			const fragmentCoefficientProjection = projectSyntheticCubeFragmentCoefficientPath( 'shader-webgpu', fixture );
			const computeProbeReduction = projectSyntheticCube( 'shader-webgpu', fixture );

			return {
				candidateToFragmentDelta: maxCoefficientDelta( computeProbeReduction, fragmentCoefficientProjection )
			};

		} );
		const computeCandidateMaxDelta = Math.max( ...computeCandidateFixtures.map( fixture => fixture.candidateToFragmentDelta ) );
		const computeCandidateTolerance = 0.0001;
		const computeCandidateFailedFixtureCount = computeCandidateFixtures.filter( fixture =>
			fixture.candidateToFragmentDelta > computeCandidateTolerance
		).length;
		const fallbackScenarios = [
			{
				supportsComputeProjection: true,
				supportsStorageTexture: true
			},
			{
				supportsComputeProjection: false,
				supportsStorageTexture: true
			},
			{
				supportsComputeProjection: true,
				supportsStorageTexture: false
			}
		];
		const computeSelectedScenarioCount = fallbackScenarios.filter( scenario =>
			scenario.supportsComputeProjection === true &&
			scenario.supportsStorageTexture === true
		).length;
		const fallbackScenarioCount = fallbackScenarios.filter( scenario =>
			scenario.supportsComputeProjection === false ||
			scenario.supportsStorageTexture === false
		).length;
		const unsupportedComputeFallbackCount = fallbackScenarios.filter( scenario =>
			scenario.supportsComputeProjection === false
		).length;
		const unsupportedStorageTextureFallbackCount = fallbackScenarios.filter( scenario =>
			scenario.supportsStorageTexture === false
		).length;
		const computeProjectionAdapterFallbackOracle = {
			scenarioCount: fallbackScenarios.length,
			computeSelectedScenarioCount,
			fallbackScenarioCount,
			unsupportedComputeFallbackCount,
			unsupportedStorageTextureFallbackCount
		};

		return {
			fixtureCount: projectionFixtureCount,
			maxShaderToGeneratorDelta: Math.max( ...fixtures.map( fixture => fixture.shaderToGeneratorDelta ) ),
			maxWebGLGridToGeneratorDelta: Math.max( ...fixtures.map( fixture => fixture.webglGridToGeneratorDelta ) ),
			maxShaderToCubeTextureDelta: Math.max( ...fixtures.map( fixture => fixture.shaderToCubeTextureDelta ) ),
			maxShaderToWebGLGridDelta: Math.max( ...fixtures.map( fixture => fixture.shaderToWebGLGridDelta ) ),
			computeProjectionCandidateOracle: {
				baselineCubemapSweepsPerProbe: 9,
				candidateCubemapSweepsPerProbe: 1,
				fixtureCount: computeCandidateFixtures.length,
				failedFixtureCount: computeCandidateFailedFixtureCount,
				maxCandidateToFragmentDelta: computeCandidateMaxDelta,
				tolerance: computeCandidateTolerance
			},
			computeProjectionAdapterFallbackOracle,
			computeProjectionParityContract: {
				currentPath: 'fragment-coefficient-projection',
				proposedPath: 'compute-probe-reduction',
				currentCubemapSweepsPerProbe: 9,
				proposedCubemapSweepsPerProbe: 1,
				fallbackPath: 'fragment-coefficient-projection',
				tolerance: 0.0001
			}
		};

	};

	const inspectComputeProjectionRuntimeParity = async () => {

		const renderer = _lightProbeContext.renderer;
		const scene = _lightProbeContext.scene;
		const resolution = 2;
		const cubemapSize = 4;
		const totalProbes = resolution * resolution * resolution;
		const coefficientWidth = SH_COEFFICIENTS;
		const coefficientHeight = totalProbes;
		const coefficientTolerance = 0.035;
		const atlasTolerance = 0.035;
		const probeValidity = new Float32Array( totalProbes ).fill( 1 );

		probeValidity[ totalProbes - 1 ] = 0;

		const createParityGrid = () => createProjectionFixtureGrid( resolution, cubemapSize, probeValidity, renderer );

		const baselineGrid = createParityGrid();
		const computeGrid = createParityGrid();

		const maxRgbDelta = ( a, b ) => {

			let maxDelta = 0;

			for ( let i = 0; i < Math.min( a.length, b.length ); i += 4 ) {

				maxDelta = Math.max(
					maxDelta,
					Math.abs( a[ i ] - b[ i ] ),
					Math.abs( a[ i + 1 ] - b[ i + 1 ] ),
					Math.abs( a[ i + 2 ] - b[ i + 2 ] )
				);

			}

			return roundMetric( maxDelta );

		};

		const maxRgbaDelta = ( a, b ) => roundMetric( a.reduce( ( maxDelta, value, index ) =>
			Math.max( maxDelta, Math.abs( value - b[ index ] ) ), 0
		) );

		const atlasSamples = [
			{ label: 't0-z0-x0-y0', textureIndex: 0, gridZ: 0, x: 0, y: 0 },
			{ label: 't1-z1-x1-y0', textureIndex: 1, gridZ: 1, x: 1, y: 0 },
			{ label: 't2-z0-x0-y1', textureIndex: 2, gridZ: 0, x: 0, y: 1 },
			{ label: 't5-z1-x1-y1', textureIndex: 5, gridZ: 1, x: 1, y: 1 },
			{ label: 'validity-t6-z1-x1-y1', textureIndex: 6, gridZ: 1, x: 1, y: 1 },
			{ label: 'leading-padding-t0', textureIndex: 0, gridZ: - 1, x: 0, y: 0 },
			{ label: 'trailing-padding-t0', textureIndex: 0, gridZ: resolution, x: 0, y: 0 }
		];

		try {

			const fragmentTimings = await baselineGrid.bake( renderer, scene, { projectionBackendOverride: 'force-fragment' } );
			const fragmentCoefficients = await readLightProbeGridGPUCoefficientTarget( renderer, baselineGrid, coefficientWidth, coefficientHeight );
			const computeTimings = await computeGrid.bake( renderer, scene, { projectionBackendOverride: 'force-compute' } );
			const computeSelected = computeTimings.projectionBackend === 'compute-probe-reduction';
			const computeCoefficients = computeSelected ?
				await readLightProbeGridGPUComputeCoefficientTexture( renderer, computeGrid, coefficientWidth, coefficientHeight ) :
				[];
			const coefficientMaxDelta = computeSelected ?
				maxRgbDelta( fragmentCoefficients, computeCoefficients ) :
				Number.POSITIVE_INFINITY;
			const atlasChecks = [];

			if ( computeSelected ) {

				for ( const sample of atlasSamples ) {

					const fragment = await readLightProbeGridGPUPackedAtlasPixel( renderer, baselineGrid, sample );
					const compute = await readLightProbeGridGPUPackedAtlasPixel( renderer, computeGrid, sample );
					const maxDelta = maxRgbaDelta( fragment, compute );

					atlasChecks.push( {
						maxDelta
					} );

				}

			}

			const atlasMaxDelta = computeSelected && atlasChecks.length > 0 ?
				roundMetric( Math.max( ...atlasChecks.map( check => check.maxDelta ) ) ) :
				Number.POSITIVE_INFINITY;
			const atlasFailedCheckCount = atlasChecks.filter( check => check.maxDelta > atlasTolerance ).length;

			return {
				fragmentBackend: fragmentTimings.projectionBackend,
				computeBackend: computeTimings.projectionBackend,
				computeFallbackReason: computeTimings.computeProjectionFallbackReason ?? null,
				resolution,
				totalProbes,
				cubemapSize,
				coefficientTolerance,
				atlasTolerance,
				coefficientMaxDelta,
				atlasMaxDelta,
				coefficientReadbackPixels: coefficientWidth * coefficientHeight,
				atlasCheckCount: atlasChecks.length,
				atlasFailedCheckCount
			};

		} finally {

			baselineGrid.dispose();
			computeGrid.dispose();

		}

	};

	const inspectComputeProjectionProfiling = async () => {

		const renderer = _lightProbeContext.renderer;
		const scene = _lightProbeContext.scene;
		const resolution = 2;
		const cubemapSize = 4;
		const warmupRuns = 1;
		const measuredRuns = 3;
		const probeValidity = new Float32Array( resolution * resolution * resolution ).fill( 1 );
		const staticWork = createProjectionStaticWork( resolution, cubemapSize );

		probeValidity[ probeValidity.length - 1 ] = 0;

		const createProfileGrid = () => createProjectionFixtureGrid( resolution, cubemapSize, probeValidity, renderer );

		const profileBackend = async ( requestedBackend ) => {

			const grid = createProfileGrid();
			const projectionMsSamples = [];
			const projectionTimingSources = new Set();
			let fallbackRunCount = 0;
			let fragmentBackendCount = 0;
			let computeBackendCount = 0;

			try {

				for ( let i = 0; i < warmupRuns + measuredRuns; i ++ ) {

					const warmup = i < warmupRuns;
					const timings = await grid.bake( renderer, scene, { projectionBackendOverride: requestedBackend } );

					if ( warmup ) {

						continue;

					}

					projectionMsSamples.push( timings.projectionMs );
					projectionTimingSources.add( timings.projectionTimingSource ?? timings.timingSource ?? 'unavailable' );
					if ( timings.projectionBackend === 'fragment-coefficient-projection' ) fragmentBackendCount ++;
					if ( timings.projectionBackend === 'compute-probe-reduction' ) computeBackendCount ++;

					if ( timings.computeProjectionFallbackReason ) fallbackRunCount ++;

				}

				return {
					result: {
						measuredRunCount: projectionMsSamples.length,
						projectionMs: summarizeMetric( projectionMsSamples ),
						fragmentBackendCount,
						computeBackendCount,
						fallbackRunCount
					},
					projectionTimingSources: Array.from( projectionTimingSources )
				};

			} finally {

				grid.dispose();

			}

		};

		const fragmentProfile = await profileBackend( 'force-fragment' );
		const computeProfile = await profileBackend( 'force-compute' );
		const fragment = fragmentProfile.result;
		const compute = computeProfile.result;
		const projectionTimingSources = Array.from( new Set( [
			...fragmentProfile.projectionTimingSources,
			...computeProfile.projectionTimingSources
		] ) );

		return {
			projectionTimingSources,
			resolution,
			cubemapSize,
			measuredRuns,
			staticWork,
			fragment,
			compute
		};

	};

	const inspectAtlasPacking = async () => {

		const shCoefficientCount = SH_COEFFICIENTS;
		const packedAtlasTextureCount = PACKED_SH_TEXTURES;
		const atlasPadding = ATLAS_PADDING;
		const resolution = 4;
		const totalProbes = resolution * resolution * resolution;
		const paddedSlices = getLightProbeGridGPUPaddedAtlasSlices( resolution );
		const atlasDepth = getLightProbeGridGPUAtlasDepth( resolution );
		const syntheticProbeScale = 0.014;
		const syntheticCoefficientScale = 0.001;
		const syntheticChannelOffsets = {
			r: 0,
			g: 0.0015,
			b: 0.003,
			a: 0.0045
		};
		const probeValidity = Float32Array.from(
			{ length: totalProbes },
			( _, index ) => 0.25 + ( index % 7 ) * 0.1
		);
		const testGrid = createUnitProbeGrid( { resolution, probeValidity } );

		const encodeSyntheticCoefficient = ( probeIndex, coefficient, component ) =>
			( probeIndex + 1 ) * syntheticProbeScale +
			coefficient * syntheticCoefficientScale +
			syntheticChannelOffsets[ component ];

		const expectedPackedPixel = ( textureIndex, probeIndex ) => PACKED_SH_COEFFICIENT_LAYOUT[ textureIndex ].map( ( entry ) => {

			if ( entry.value === 'validity' ) return probeValidity[ probeIndex ];

			return encodeSyntheticCoefficient( probeIndex, entry.coefficient, entry.component );

		} );


		const createReadbackCheck = async ( { textureIndex, gridZ, x, y, label, sourceGridZ = gridZ } ) => {

			const layer = testGrid._getPackedAtlasLayer( textureIndex, gridZ );
			const probeIndex = getLightProbeGridGPUProbeIndex( x, y, sourceGridZ, resolution );
			const actual = await readLightProbeGridGPUDecodedPackedAtlasPixel( _lightProbeContext.renderer, testGrid, { textureIndex, gridZ, x, y } );
			const expected = expectedPackedPixel( textureIndex, probeIndex );
			const deltas = actual.map( ( value, index ) => Math.abs( value - expected[ index ] ) );

			return {
				label,
				x,
				y,
				probeIndex,
				maxDelta: roundMetric( Math.max( ...deltas ) ),
				validityDelta: roundMetric( Math.abs( actual[ 3 ] - expected[ 3 ] ) )
			};

		};

		const renderSyntheticCoefficientBatch = async () => {

			const previousRenderTarget = _lightProbeContext.renderer.getRenderTarget();
			const previousViewport = new THREE.Vector4();
			const previousScissor = new THREE.Vector4();
			const previousScissorTest = _lightProbeContext.renderer.getScissorTest();
			const previousAutoClear = _lightProbeContext.renderer.autoClear;
			const probeIndexUniform = uniform( 0 );
			const sentinelMaterial = new THREE.NodeMaterial();
			const sentinelScene = new THREE.Scene();
			const sentinelCamera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, - 1, 1 );
			const sentinelGeometry = new THREE.PlaneGeometry( 2, 2 );
			const sentinelMesh = new THREE.Mesh( sentinelGeometry, sentinelMaterial );
			const writeCoefficient = Fn( () => {

				const coefficient = floor( uv().x.mul( shCoefficientCount ) );
				const base = probeIndexUniform.add( 1 ).mul( syntheticProbeScale ).add( coefficient.mul( syntheticCoefficientScale ) );

				return vec4(
					base.add( syntheticChannelOffsets.r ),
					base.add( syntheticChannelOffsets.g ),
					base.add( syntheticChannelOffsets.b ),
					base.add( syntheticChannelOffsets.a )
				);

			} );

			_lightProbeContext.renderer.getViewport( previousViewport );
			_lightProbeContext.renderer.getScissor( previousScissor );

			sentinelMaterial.fragmentNode = writeCoefficient();
			sentinelMaterial.toneMapped = false;
			sentinelScene.add( sentinelMesh );

			try {

				testGrid.coefficientTarget.scissorTest = false;
				testGrid.coefficientTarget.viewport.set( 0, 0, shCoefficientCount, totalProbes );
				testGrid.coefficientTarget.scissor.set( 0, 0, shCoefficientCount, totalProbes );
				_lightProbeContext.renderer.setRenderTarget( testGrid.coefficientTarget );
				_lightProbeContext.renderer.clear();
				_lightProbeContext.renderer.autoClear = false;
				testGrid.coefficientTarget.scissorTest = true;

				for ( let probeIndex = 0; probeIndex < totalProbes; probeIndex ++ ) {

					probeIndexUniform.value = probeIndex;
					testGrid.coefficientTarget.viewport.set( 0, probeIndex, shCoefficientCount, 1 );
					testGrid.coefficientTarget.scissor.set( 0, probeIndex, shCoefficientCount, 1 );
					_lightProbeContext.renderer.setRenderTarget( testGrid.coefficientTarget );
					_lightProbeContext.renderer.render( sentinelScene, sentinelCamera );

				}

				await testGrid._repackAtlas( _lightProbeContext.renderer );

			} finally {

				_lightProbeContext.renderer.setRenderTarget( previousRenderTarget );
				_lightProbeContext.renderer.setViewport( previousViewport );
				_lightProbeContext.renderer.setScissor( previousScissor );
				_lightProbeContext.renderer.setScissorTest( previousScissorTest );
				_lightProbeContext.renderer.autoClear = previousAutoClear;

				sentinelMaterial.dispose();
				sentinelGeometry.dispose();

			}

		};

		try {

			await renderSyntheticCoefficientBatch();

			const addressChecks = [];
			let addressMismatchCount = 0;
			let centerSampleZOutOfRangeCount = 0;

			for ( const textureIndex of [ 0, 1, 6 ] ) {

				for ( const gridZ of [ 0, resolution - 1 ] ) {

					const baseLayer = getLightProbeGridGPUPackedAtlasBaseLayer( textureIndex, paddedSlices );
					const addressCheck = {
						baseLayer,
						methodBaseLayer: testGrid._getPackedAtlasBaseLayer( textureIndex ),
						dataLayer: getLightProbeGridGPUPackedAtlasLayer( textureIndex, gridZ, paddedSlices ),
						methodDataLayer: testGrid._getPackedAtlasLayer( textureIndex, gridZ ),
						leadingPaddingLayer: getLightProbeGridGPUPackedAtlasLayer( textureIndex, - atlasPadding, paddedSlices ),
						methodLeadingPaddingLayer: testGrid._getPackedAtlasLayer( textureIndex, - atlasPadding ),
						trailingPaddingLayer: getLightProbeGridGPUPackedAtlasLayer( textureIndex, resolution, paddedSlices ),
						methodTrailingPaddingLayer: testGrid._getPackedAtlasLayer( textureIndex, resolution ),
						centerSampleZ: roundMetric( getLightProbeGridGPUPackedAtlasCenterSampleZ( textureIndex, gridZ, paddedSlices, atlasDepth ) )
					};

					addressChecks.push( addressCheck );
					if (
						addressCheck.baseLayer !== addressCheck.methodBaseLayer ||
						addressCheck.dataLayer !== addressCheck.methodDataLayer ||
						addressCheck.leadingPaddingLayer !== addressCheck.methodLeadingPaddingLayer ||
						addressCheck.trailingPaddingLayer !== addressCheck.methodTrailingPaddingLayer
					) {

						addressMismatchCount ++;

					}
					if ( addressCheck.centerSampleZ <= 0 || addressCheck.centerSampleZ >= 1 ) centerSampleZOutOfRangeCount ++;

				}

			}

			const dataReadbackFacts = [
				await createReadbackCheck( { label: 'origin-y0-z0-t0', textureIndex: 0, gridZ: 0, x: 0, y: 0 } ),
				await createReadbackCheck( { label: 'native-y3-z0-t0', textureIndex: 0, gridZ: 0, x: 1, y: resolution - 1 } ),
				await createReadbackCheck( { label: 'middle-z1-t2', textureIndex: 2, gridZ: 1, x: 2, y: 1 } ),
				await createReadbackCheck( { label: 'validity-z3-t6', textureIndex: 6, gridZ: 3, x: 3, y: 2 } )
			];
			const paddingReadbackFacts = [
				await createReadbackCheck( { label: 'leading-padding-z0-t0', textureIndex: 0, gridZ: - atlasPadding, sourceGridZ: 0, x: 2, y: 1 } ),
				await createReadbackCheck( { label: 'trailing-padding-z3-t0', textureIndex: 0, gridZ: resolution, sourceGridZ: resolution - 1, x: 2, y: 1 } ),
				await createReadbackCheck( { label: 'leading-padding-validity-t6', textureIndex: 6, gridZ: - atlasPadding, sourceGridZ: 0, x: 1, y: 2 } )
			];
			const allReadbackFacts = [ ...dataReadbackFacts, ...paddingReadbackFacts ];
			const originReadback = dataReadbackFacts[ 0 ];
			const nativeY3Readback = dataReadbackFacts[ 1 ];
			const validityReadback = dataReadbackFacts[ 3 ];
			const maxReadbackDelta = roundMetric( Math.max( ...allReadbackFacts.map( check => check.maxDelta ) ) );
			let packedCoefficientSlots = 0;
			let validitySlot = null;

			for ( let textureIndex = 0; textureIndex < PACKED_SH_COEFFICIENT_LAYOUT.length; textureIndex ++ ) {

				const row = PACKED_SH_COEFFICIENT_LAYOUT[ textureIndex ];

				for ( let channelIndex = 0; channelIndex < row.length; channelIndex ++ ) {

					if ( row[ channelIndex ].value === 'validity' ) {

						validitySlot = { textureIndex, channelIndex };

					} else {

						packedCoefficientSlots ++;

					}

				}

			}

			const computeProjectionAtlasRepackOracle = {
				readbackTolerance: 0.008,
				maxReadbackDelta
			};

			return {
				resolution,
				totalProbes,
				shCoefficientCount,
				packedAtlasTextureCount,
				atlasPadding,
				paddedSlices,
				atlasDepth,
				addressCheckCount: addressChecks.length,
				addressMismatchCount,
				centerSampleZOutOfRangeCount,
				packedCoefficientSlots,
				validitySlot,
				readbackCheckCount: dataReadbackFacts.length,
				paddingCheckCount: paddingReadbackFacts.length,
				nativeYOrientation: {
					y0ProbeIndex: originReadback.probeIndex,
					y3ProbeIndex: nativeY3Readback.probeIndex
				},
				maxReadbackDelta,
				computeProjectionAtlasRepackOracle,
				validityProbeIndex: validityReadback.probeIndex,
				validityDelta: validityReadback.validityDelta
			};

		} finally {

			testGrid.dispose();

		}

	};

	const inspectVisibilityDepthMoments = async () => {

		const probeGrid = _lightProbeContext.probeGrid;
		const info = readVisibilityDepthInfo();
		const target = probeGrid.visibilityDepthTarget ?? null;
		const resolution = probeGrid.visibilityDepthResolution ?? 0;
		const textureDepth = probeGrid.totalProbes ?? 0;
		const createInspection = stats => ( {
			available: info.available === true,
			mode: info.mode ?? 'unavailable',
			bytes: info.bytes ?? 0,
			stats
		} );

		const unavailable = () => {

			const stats = {
				sampleCount: 0,
				finiteSampleCount: 0,
				hitSampleCount: 0
			};

			return createInspection( stats );

		};

		if ( target === null || info.available !== true || info.mode !== 'moments' || resolution <= 0 || textureDepth <= 0 ) {

			return unavailable();

		}

		const center = Math.floor( resolution / 2 );
		const edge = Math.max( 1, center - 2 );
		const oppositeEdge = Math.min( resolution - 2, center + 2 );
		const midProbe = Math.floor( textureDepth / 2 );
		const lastProbe = Math.max( 0, textureDepth - 1 );
		const readbackPoints = [
			{ label: 'probe-0-center', probeIndex: 0, x: center, y: center },
			{ label: 'probe-mid-center', probeIndex: midProbe, x: center, y: center },
			{ label: 'probe-last-center', probeIndex: lastProbe, x: center, y: center },
			{ label: 'probe-mid-left', probeIndex: midProbe, x: edge, y: center },
			{ label: 'probe-mid-right', probeIndex: midProbe, x: oppositeEdge, y: center },
			{ label: 'probe-mid-down', probeIndex: midProbe, x: center, y: edge },
			{ label: 'probe-mid-up', probeIndex: midProbe, x: center, y: oppositeEdge }
		];
		let finiteSampleCount = 0;
		let hitSampleCount = 0;

		for ( const point of readbackPoints ) {

			const moment = await readLightProbeGridGPUVisibilityMomentPixel( _lightProbeContext.renderer, target, point );

			if ( moment.finite === false ) continue;

			finiteSampleCount ++;
			if ( moment.hitConfidence > 0 ) hitSampleCount ++;

		}

		const stats = {
			sampleCount: readbackPoints.length,
			finiteSampleCount,
			hitSampleCount
		};

		return createInspection( stats );

	};

	const inspectProbeOccupancy = () => {

		const occupancy = _lightProbeContext.collectProbeOccupancy( _lightProbeContext.params.resolution );
		const occupiedProbeMeshHitCount = occupancy.occupiedProbes.reduce( ( sum, probe ) => sum + probe.meshes.length, 0 );
		const sampling = _lightProbeContext.probeGrid.getSamplingInfo();
		const validProbeCount = occupancy.totalProbes - occupancy.occupiedProbeCount;

		return {
			totalProbes: occupancy.totalProbes,
			solidMeshCount: occupancy.solidMeshCount,
			occupiedProbeCount: occupancy.occupiedProbeCount,
			occupiedProbeMeshHitCount,
			classification: {
				classificationPolicy: 'solid-occupancy-validity',
				relocationPolicy: 'none',
				validProbeCount,
				invalidProbeCount: sampling.invalidProbeCount,
				interiorProbeCount: occupancy.occupiedProbeCount,
				exteriorProbeCount: validProbeCount,
				occludingProbeCount: occupancy.occupiedProbeCount,
				relocatedProbeCount: 0
			},
			sampling
		};

	};

	const createLocalArtifactMetric = ( region = { x0: 0.24, x1: 0.82, y0: 0.2, y1: 0.9 }, canvasSample = captureCanvasSample() ) => {

		const x0 = Math.floor( canvasSample.width * region.x0 );
		const x1 = Math.floor( canvasSample.width * region.x1 );
		const y0 = Math.floor( canvasSample.height * region.y0 );
		const y1 = Math.floor( canvasSample.height * region.y1 );
		const width = Math.max( x1 - x0, 1 );
		const height = Math.max( y1 - y0, 1 );
		const image = canvasSample.context.getImageData( x0, y0, width, height );
		const luminance = [];
		let sum = 0;
		const color = { r: 0, g: 0, b: 0 };

		for ( let i = 0; i < image.data.length; i += 4 ) {

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

		const sorted = [ ...luminance ].sort( ( a, b ) => a - b );
		const percentile = ( value ) => sorted[ Math.min( sorted.length - 1, Math.max( 0, Math.floor( ( sorted.length - 1 ) * value ) ) ) ];
		const sampleCount = Math.max( luminance.length, 1 );
		color.r /= sampleCount;
		color.g /= sampleCount;
		color.b /= sampleCount;
		const darkThreshold = Math.max( 16, percentile( 0.5 ) * 0.35 );
		const blackThreshold = 32;
		const darkSamples = luminance.filter( value => value <= darkThreshold ).length;
		const blackSamples = luminance.filter( value => value <= blackThreshold ).length;
		const cellCount = Math.max( 2, Math.min( 8, _lightProbeContext.params.resolution ) );
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

					const contrast = Math.abs( cellMeans[ cy ][ cx ] - cellMeans[ cy ][ cx + 1 ] );
					maxCellEdgeContrast = Math.max( maxCellEdgeContrast, contrast );

				}

				if ( cy + 1 < cellCount ) {

					const contrast = Math.abs( cellMeans[ cy ][ cx ] - cellMeans[ cy + 1 ][ cx ] );
					maxCellEdgeContrast = Math.max( maxCellEdgeContrast, contrast );

				}

			}

		}

		return {
			color: {
				r: roundMetric( color.r ),
				g: roundMetric( color.g ),
				b: roundMetric( color.b )
			},
			colorBias: {
				redOverGreen: roundMetric( color.r / Math.max( color.g, 0.0001 ) ),
				greenOverRed: roundMetric( color.g / Math.max( color.r, 0.0001 ) )
			},
			luminance: {
				p01: roundMetric( percentile( 0.01 ) ),
				mean: roundMetric( sum / Math.max( luminance.length, 1 ) )
			},
			darkPixelRatio: roundMetric( darkSamples / Math.max( luminance.length, 1 ) ),
			blackPixelRatio: roundMetric( blackSamples / Math.max( luminance.length, 1 ) ),
			cellEdgeContrast: roundMetric( maxCellEdgeContrast )
		};

	};

	const createMaskedReceiverMetric = ( colorCanvasSample, maskCanvasSample, maskSelector ) => {

		const width = colorCanvasSample.width;
		const height = colorCanvasSample.height;
		const colorImage = colorCanvasSample.context.getImageData( 0, 0, width, height );
		const maskImage = maskCanvasSample.context.getImageData( 0, 0, width, height );
		const color = { r: 0, g: 0, b: 0 };
		let sampleCount = 0;

		for ( let i = 0; i < maskImage.data.length; i += 4 ) {

			const maskRed = maskImage.data[ i ];
			const maskGreen = maskImage.data[ i + 1 ];
			const selected = maskSelector === 'left' ?
				maskRed > 128 && maskGreen < 64 :
				maskGreen > 128 && maskRed < 64;

			if ( selected === false ) continue;

			color.r += colorImage.data[ i ];
			color.g += colorImage.data[ i + 1 ];
			color.b += colorImage.data[ i + 2 ];
			sampleCount ++;

		}

		const safeSampleCount = Math.max( sampleCount, 1 );
		color.r /= safeSampleCount;
		color.g /= safeSampleCount;
		color.b /= safeSampleCount;

		return {
			selectedPixelCount: sampleCount,
			selectedPixelRatio: roundMetric( sampleCount / Math.max( width * height, 1 ) ),
			colorBias: {
				redOverGreen: roundMetric( color.r / Math.max( color.g, 0.0001 ) ),
				greenOverRed: roundMetric( color.g / Math.max( color.r, 0.0001 ) )
			}
		};

	};

	const captureLeakReceiverMaskedMetrics = () => {

		if ( _lightProbeContext.leakFixture === null ) return null;

		const colorCanvasSample = captureCanvasSample();
		const previousBackground = _lightProbeContext.scene.background;
		const previousMaterials = [];
		const leftMaskMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, toneMapped: false } );
		const rightMaskMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00, toneMapped: false } );
		const occluderMaskMaterial = new THREE.MeshBasicMaterial( { color: 0x000000, toneMapped: false } );

		try {

			_lightProbeContext.scene.traverse( object => {

				if ( object.isMesh !== true ) return;

				previousMaterials.push( { object, material: object.material } );

				if ( object === _lightProbeContext.leakFixture.leftReceiver ) {

					object.material = leftMaskMaterial;

				} else if ( object === _lightProbeContext.leakFixture.rightReceiver ) {

					object.material = rightMaskMaterial;

				} else {

					object.material = occluderMaskMaterial;

				}

			} );

			_lightProbeContext.scene.background = new THREE.Color( 0x000000 );

			const maskCanvasSample = captureCanvasSample();
			const leftReceiverMasked = createMaskedReceiverMetric( colorCanvasSample, maskCanvasSample, 'left' );
			const rightReceiverMasked = createMaskedReceiverMetric( colorCanvasSample, maskCanvasSample, 'right' );

			return {
				mode: 'receiver-id-mask-visible-pixels',
				leftReceiverMasked,
				rightReceiverMasked
			};

		} finally {

			_lightProbeContext.scene.background = previousBackground;

			for ( const state of previousMaterials ) {

				state.object.material = state.material;

			}

			leftMaskMaterial.dispose();
			rightMaskMaterial.dispose();
			occluderMaskMaterial.dispose();

		}

	};

	const captureLeakRegionMetricsWithRendererMapping = ( options = {} ) => {

		const previousToneMapping = _lightProbeContext.renderer.toneMapping;
		const previousToneMappingExposure = _lightProbeContext.renderer.toneMappingExposure;
		const previousOutputColorSpace = _lightProbeContext.renderer.outputColorSpace;

		try {

			_lightProbeContext.renderer.toneMapping = options.toneMapping ?? previousToneMapping;
			_lightProbeContext.renderer.toneMappingExposure = options.toneMappingExposure ?? previousToneMappingExposure;
			_lightProbeContext.renderer.outputColorSpace = options.outputColorSpace ?? previousOutputColorSpace;
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			return {
				mode: options.mode ?? 'renderer-mapped-leak-metrics',
				toneMapping: options.toneMappingLabel ?? `${ _lightProbeContext.renderer.toneMapping }`,
				toneMappingExposure: _lightProbeContext.renderer.toneMappingExposure,
				outputColorSpace: _lightProbeContext.renderer.outputColorSpace,
				metrics: captureLeakRegionMetrics()
			};

		} finally {

			_lightProbeContext.renderer.toneMapping = previousToneMapping;
			_lightProbeContext.renderer.toneMappingExposure = previousToneMappingExposure;
			_lightProbeContext.renderer.outputColorSpace = previousOutputColorSpace;
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		}

	};

	const captureRegionArtifactMetrics = ( regionsToCapture = artifactRegions ) => {

		const canvasSample = captureCanvasSample();
		const regions = {};

		for ( const [ name, region ] of Object.entries( regionsToCapture ) ) {

			regions[ name ] = createLocalArtifactMetric( region, canvasSample );

		}

		return regions;

	};

	const createObjectArtifactPressure = ( regions ) => {

		const objectRegions = [ 'sphere', 'tallBox', 'shortBox' ].map( name => regions[ name ] ).filter( Boolean );
		const maxDarkPixelRatio = Math.max( ...objectRegions.map( region => region.darkPixelRatio ) );
		const maxBlackPixelRatio = Math.max( ...objectRegions.map( region => region.blackPixelRatio ) );
		const maxCellEdgeContrast = Math.max( ...objectRegions.map( region => region.cellEdgeContrast ) );
		const luminanceFloor = Math.min( ...objectRegions.map( region => region.luminance.p01 ) );

		return {
			sphereDarkPixelRatio: roundMetric( regions.sphere.darkPixelRatio ),
			tallBoxDarkPixelRatio: roundMetric( regions.tallBox.darkPixelRatio ),
			shortBoxDarkPixelRatio: roundMetric( regions.shortBox.darkPixelRatio ),
			objectDarkTailRatio: roundMetric( maxDarkPixelRatio ),
			objectBlackTailRatio: roundMetric( maxBlackPixelRatio ),
			luminanceFloor: roundMetric( luminanceFloor ),
			cellEdgeContrast: roundMetric( maxCellEdgeContrast )
		};

	};

	const captureLeakRegionMetrics = () => {

		const regions = captureRegionArtifactMetrics( createLeakCaptureRegions() );
		const surfaceRegions = _lightProbeContext.leakFixture === null ? null : {
			leftReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.leftReceiver ) ?? leakArtifactRegions.leftReceiver,
			rightReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.rightReceiver ) ?? leakArtifactRegions.rightReceiver
		};
		const createNearDividerEdgeRegion = ( region, side ) => {

			const width = region.x1 - region.x0;

			return side === 'left' ? {
				...region,
				x0: Math.max( region.x0, region.x1 - width * 0.35 )
			} : {
				...region,
				x1: Math.min( region.x1, region.x0 + width * 0.35 )
			};

		};
		const surfaceCenterRegions = _lightProbeContext.leakFixture === null ? null : {
			leftReceiverSurfaceCenter: createObjectCenterScreenRegion( _lightProbeContext.leakFixture.leftReceiver ) ?? leakArtifactRegions.leftReceiver,
			rightReceiverSurfaceCenter: createObjectCenterScreenRegion( _lightProbeContext.leakFixture.rightReceiver ) ?? leakArtifactRegions.rightReceiver
		};
		const surfaceSamples = surfaceRegions === null ? null : captureRegionArtifactMetrics( surfaceRegions );
		const nearDividerEdgeSamples = surfaceRegions === null ? null : captureRegionArtifactMetrics( {
			leftReceiverNearDividerEdge: createNearDividerEdgeRegion( surfaceRegions.leftReceiverSurface, 'left' ),
			rightReceiverNearDividerEdge: createNearDividerEdgeRegion( surfaceRegions.rightReceiverSurface, 'right' )
		} );
		const surfaceCenterSamples = surfaceCenterRegions === null ? null : captureRegionArtifactMetrics( surfaceCenterRegions );
		const maskedSamples = captureLeakReceiverMaskedMetrics();
		const leftReceiver = regions.leftReceiver;
		const rightReceiver = regions.rightReceiver;
		const wrongSideColorRatio = Math.max(
			leftReceiver.colorBias.greenOverRed,
			rightReceiver.colorBias.redOverGreen
		);
		const correctBounceRatio = Math.min(
			leftReceiver.colorBias.redOverGreen,
			rightReceiver.colorBias.greenOverRed
		);
		const surfaceWrongSideColorRatio = surfaceSamples === null ? null : Math.max(
			surfaceSamples.leftReceiverSurface.colorBias.greenOverRed,
			surfaceSamples.rightReceiverSurface.colorBias.redOverGreen
		);
		const surfaceCenterWrongSideColorRatio = surfaceCenterSamples === null ? null : Math.max(
			surfaceCenterSamples.leftReceiverSurfaceCenter.colorBias.greenOverRed,
			surfaceCenterSamples.rightReceiverSurfaceCenter.colorBias.redOverGreen
		);
		const nearDividerEdgeWrongSideColorRatio = nearDividerEdgeSamples === null ? null : Math.max(
			nearDividerEdgeSamples.leftReceiverNearDividerEdge.colorBias.greenOverRed,
			nearDividerEdgeSamples.rightReceiverNearDividerEdge.colorBias.redOverGreen
		);
		const maskedWrongSideColorRatio = maskedSamples === null ? null : Math.max(
			maskedSamples.leftReceiverMasked.colorBias.greenOverRed,
			maskedSamples.rightReceiverMasked.colorBias.redOverGreen
		);
		const maskedCorrectBounceRatio = maskedSamples === null ? null : Math.min(
			maskedSamples.leftReceiverMasked.colorBias.redOverGreen,
			maskedSamples.rightReceiverMasked.colorBias.greenOverRed
		);
		const maskedVisiblePixelCount = maskedSamples === null ? null :
			maskedSamples.leftReceiverMasked.selectedPixelCount + maskedSamples.rightReceiverMasked.selectedPixelCount;
		const maskedVisiblePixelRatio = maskedSamples === null ? null : roundMetric(
			maskedSamples.leftReceiverMasked.selectedPixelRatio + maskedSamples.rightReceiverMasked.selectedPixelRatio
		);

		return {
			wrongSideColorRatio: roundMetric( wrongSideColorRatio ),
			surfaceWrongSideColorRatio: surfaceWrongSideColorRatio === null ? null : roundMetric( surfaceWrongSideColorRatio ),
			surfaceCenterWrongSideColorRatio: surfaceCenterWrongSideColorRatio === null ? null : roundMetric( surfaceCenterWrongSideColorRatio ),
			nearDividerEdgeWrongSideColorRatio: nearDividerEdgeWrongSideColorRatio === null ? null : roundMetric( nearDividerEdgeWrongSideColorRatio ),
			maskedWrongSideColorRatio: maskedWrongSideColorRatio === null ? null : roundMetric( maskedWrongSideColorRatio ),
			maskedVisiblePixelCount,
			maskedVisiblePixelRatio,
			correctBounceRatio: roundMetric( correctBounceRatio ),
			maskedCorrectBounceRatio: maskedCorrectBounceRatio === null ? null : roundMetric( maskedCorrectBounceRatio )
		};

	};

	const createReceiverBoundaryDescriptor = receiverBoundaryLayerMask => ( {
		receiverBoundaryLayerMask,
		receiverBoundaryWeight: 1
	} );

	const captureReceiverIrradianceRenderMetrics = () => {

		if ( _lightProbeContext.leakFixture === null || _lightProbeContext.probeGrid === null ) return null;

		const previousLeftMaterial = _lightProbeContext.leakFixture.leftReceiver.material;
		const previousRightMaterial = _lightProbeContext.leakFixture.rightReceiver.material;
		const previousOutputColorSpace = _lightProbeContext.renderer.outputColorSpace;
		const leftMaterial = new THREE.MeshBasicNodeMaterial();
		const rightMaterial = new THREE.MeshBasicNodeMaterial();

		try {

			leftMaterial.colorNode = _lightProbeContext.probeGrid.createIrradianceNode( createReceiverBoundaryDescriptor( 2 ) );
			rightMaterial.colorNode = _lightProbeContext.probeGrid.createIrradianceNode( createReceiverBoundaryDescriptor( 4 ) );
			leftMaterial.toneMapped = false;
			rightMaterial.toneMapped = false;
			_lightProbeContext.leakFixture.leftReceiver.material = leftMaterial;
			_lightProbeContext.leakFixture.rightReceiver.material = rightMaterial;
			const captureIrradianceCenterWrongRatio = ( outputColorSpace ) => {

				_lightProbeContext.renderer.outputColorSpace = outputColorSpace;
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				const regions = {
					leftReceiverIrradianceCenter: createObjectCenterScreenRegion( _lightProbeContext.leakFixture.leftReceiver ) ?? leakArtifactRegions.leftReceiver,
					rightReceiverIrradianceCenter: createObjectCenterScreenRegion( _lightProbeContext.leakFixture.rightReceiver ) ?? leakArtifactRegions.rightReceiver
				};
				const samples = captureRegionArtifactMetrics( regions );

				return roundMetric( Math.max(
					samples.leftReceiverIrradianceCenter.colorBias.greenOverRed,
					samples.rightReceiverIrradianceCenter.colorBias.redOverGreen
				) );

			};
			const captureIrradianceMaskedWrongRatio = ( outputColorSpace ) => {

				_lightProbeContext.renderer.outputColorSpace = outputColorSpace;
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				const maskedSamples = captureLeakReceiverMaskedMetrics();

				return roundMetric( Math.max(
					maskedSamples.leftReceiverMasked.colorBias.greenOverRed,
					maskedSamples.rightReceiverMasked.colorBias.redOverGreen
				) );

			};

			return {
				renderIrradianceCenterWrongRatio: captureIrradianceCenterWrongRatio( previousOutputColorSpace ),
				renderLinearIrradianceCenterWrongRatio: captureIrradianceCenterWrongRatio( THREE.LinearSRGBColorSpace ),
				renderIrradianceMaskedWrongRatio: captureIrradianceMaskedWrongRatio( previousOutputColorSpace ),
				renderLinearIrradianceMaskedWrongRatio: captureIrradianceMaskedWrongRatio( THREE.LinearSRGBColorSpace )
			};

		} finally {

			_lightProbeContext.leakFixture.leftReceiver.material = previousLeftMaterial;
			_lightProbeContext.leakFixture.rightReceiver.material = previousRightMaterial;
			_lightProbeContext.renderer.outputColorSpace = previousOutputColorSpace;
			leftMaterial.dispose();
			rightMaterial.dispose();
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		}

	};

	const captureReceiverLambertMaterialResponseMetrics = () => {

		if ( _lightProbeContext.leakFixture === null || _lightProbeContext.probeGrid === null ) return null;

		const previousLeftMaterial = _lightProbeContext.leakFixture.leftReceiver.material;
		const previousRightMaterial = _lightProbeContext.leakFixture.rightReceiver.material;
		const previousOutputColorSpace = _lightProbeContext.renderer.outputColorSpace;
		const leftMaterial = new THREE.MeshLambertNodeMaterial( {
			color: previousLeftMaterial.color?.clone() ?? new THREE.Color( 0xffffff )
		} );
		const rightMaterial = new THREE.MeshLambertNodeMaterial( {
			color: previousRightMaterial.color?.clone() ?? new THREE.Color( 0xffffff )
		} );

		try {

			leftMaterial.lightsNode = _lightProbeContext.probeGrid.createLightsNode(
				[ _lightProbeContext.directLight, _lightProbeContext.ambientLight ],
				createReceiverBoundaryDescriptor( 2 )
			);
			rightMaterial.lightsNode = _lightProbeContext.probeGrid.createLightsNode(
				[ _lightProbeContext.directLight, _lightProbeContext.ambientLight ],
				createReceiverBoundaryDescriptor( 4 )
			);
			_lightProbeContext.leakFixture.leftReceiver.material = leftMaterial;
			_lightProbeContext.leakFixture.rightReceiver.material = rightMaterial;
			const captureMaskedWrongRatio = ( outputColorSpace ) => {

				_lightProbeContext.renderer.outputColorSpace = outputColorSpace;
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				const maskedSamples = captureLeakReceiverMaskedMetrics();

				return roundMetric( Math.max(
					maskedSamples.leftReceiverMasked.colorBias.greenOverRed,
					maskedSamples.rightReceiverMasked.colorBias.redOverGreen
				) );

			};

			return {
				renderLambertMaskedWrongRatio: captureMaskedWrongRatio( previousOutputColorSpace ),
				renderLinearLambertMaskedWrongRatio: captureMaskedWrongRatio( THREE.LinearSRGBColorSpace )
			};

		} finally {

			_lightProbeContext.leakFixture.leftReceiver.material = previousLeftMaterial;
			_lightProbeContext.leakFixture.rightReceiver.material = previousRightMaterial;
			_lightProbeContext.renderer.outputColorSpace = previousOutputColorSpace;
			leftMaterial.dispose();
			rightMaterial.dispose();
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		}

	};

	const applyLeakFixtureReceiverMasks = () => {

		if ( _lightProbeContext.leakFixture === null || _lightProbeContext.probeGrid === null ) return;

		const leftLightsNode = _lightProbeContext.probeGrid.createLightsNode(
			[ _lightProbeContext.directLight, _lightProbeContext.ambientLight ],
			createReceiverBoundaryDescriptor( 2 )
		);
		const rightLightsNode = _lightProbeContext.probeGrid.createLightsNode(
			[ _lightProbeContext.directLight, _lightProbeContext.ambientLight ],
			createReceiverBoundaryDescriptor( 4 )
		);

		_lightProbeContext.leakFixture.leftReceiver.material.lightsNode = leftLightsNode;
		_lightProbeContext.leakFixture.rightReceiver.material.lightsNode = rightLightsNode;
		_lightProbeContext.leakFixture.leftReceiver.material.needsUpdate = true;
		_lightProbeContext.leakFixture.rightReceiver.material.needsUpdate = true;

	};

	const captureArtifactSignature = () => {

		_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		const [ center ] = sampleCanvas( [
			{ x0: 0.42, x1: 0.58, y0: 0.38, y1: 0.62 }
		] );

		return {
			center: createArtifactColor( center )
		};

	};

	const createHarnessStateSnapshot = () => ( {
		resolution: _lightProbeContext.params.resolution,
		cubemapSize: _lightProbeContext.params.cubemapSize,
		projectionPrecision: _lightProbeContext.params.projectionPrecision,
		band1Intensity: _lightProbeContext.params.band1Intensity,
		band2Intensity: _lightProbeContext.params.band2Intensity,
		normalBias: _lightProbeContext.params.normalBias,
		viewBias: _lightProbeContext.params.viewBias,
		leakReductionMode: _lightProbeContext.params.leakReductionMode,
		useProbeValidity: _lightProbeContext.params.useProbeValidity,
		lightingMode: _lightProbeContext.params.lightingMode,
		materialType: _lightProbeContext.params.materialType,
		probeHelper: _lightProbeContext.params.probeHelper,
		probeHelperDebugMode: _lightProbeContext.params.probeHelperDebugMode,
		probeHelperDepthMode: _lightProbeContext.params.probeHelperDepthMode
	} );

	const restoreHarnessState = async ( previousState, reason ) => {

		_lightProbeContext.params.resolution = previousState.resolution;
		_lightProbeContext.params.cubemapSize = previousState.cubemapSize;
		_lightProbeContext.params.projectionPrecision = previousState.projectionPrecision;
		_lightProbeContext.params.band1Intensity = previousState.band1Intensity;
		_lightProbeContext.params.band2Intensity = previousState.band2Intensity;
		_lightProbeContext.params.normalBias = previousState.normalBias;
		_lightProbeContext.params.viewBias = previousState.viewBias;
		_lightProbeContext.params.leakReductionMode = previousState.leakReductionMode;
		_lightProbeContext.params.useProbeValidity = previousState.useProbeValidity;
		_lightProbeContext.params.lightingMode = previousState.lightingMode;
		_lightProbeContext.params.probeHelper = previousState.probeHelper;
		_lightProbeContext.params.probeHelperDebugMode = previousState.probeHelperDebugMode;
		_lightProbeContext.params.probeHelperDepthMode = previousState.probeHelperDepthMode;
		_lightProbeContext.probeHelper.visible = previousState.probeHelper;

		if ( _lightProbeContext.probeGrid !== null ) {

			_lightProbeContext.probeGrid.setHelperDebugMode( previousState.probeHelperDebugMode );
			_lightProbeContext.probeGrid.setHelperDepthMode( previousState.probeHelperDepthMode );

		}

		if ( _lightProbeContext.params.materialType !== previousState.materialType ) {

			_lightProbeContext.params.materialType = previousState.materialType;
			_lightProbeContext.updateMaterialType();

		}

		await _lightProbeContext.recreateAndBakeRequired( reason );
		_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

	};

	const createProbeVisibilitySnapshot = () => ( {
		leakFixtureGroupVisible: _lightProbeContext.leakFixture !== null ? _lightProbeContext.leakFixture.group.visible : false,
		meshes: _lightProbeContext.probeMeshes.map( mesh => mesh.visible )
	} );

	const restoreProbeVisibilitySnapshot = ( previousVisibility ) => {

		for ( let i = 0; i < _lightProbeContext.probeMeshes.length; i ++ ) {

			_lightProbeContext.probeMeshes[ i ].visible = previousVisibility.meshes[ i ];

		}

		if ( _lightProbeContext.leakFixture !== null ) _lightProbeContext.leakFixture.group.visible = previousVisibility.leakFixtureGroupVisible;

	};

	const setBaseCornellProbeMeshesVisible = ( visible ) => {

		for ( const mesh of _lightProbeContext.probeMeshes ) {

			if ( mesh.userData.leakFixture !== true ) mesh.visible = visible;

		}

	};

	const setLeakFixtureMode = ( mode ) => {

		if ( _lightProbeContext.leakFixture === null ) return;

		const enabled = mode !== 'off';
		_lightProbeContext.leakFixture.group.visible = enabled;

		for ( const mesh of _lightProbeContext.leakFixture.meshes ) {

			mesh.visible = enabled;

		}

		_lightProbeContext.leakFixture.thinDivider.visible = mode === 'thin-wall';
		_lightProbeContext.leakFixture.sealedDivider.visible = mode === 'sealed-wall';
		_lightProbeContext.leakFixture.zeroThicknessDivider.visible = mode === 'zero-thickness';
		_lightProbeContext.leakFixture.zeroThicknessDivider.material.side = THREE.DoubleSide;

	};

	const applyProofBakeSettings = ( options = {} ) => {

		if ( options.hideBaseCornell === true ) setBaseCornellProbeMeshesVisible( false );
		if ( options.fixtureMode !== undefined ) setLeakFixtureMode( options.fixtureMode );

		Object.assign( _lightProbeContext.params, {
			resolution: options.resolution ?? 4,
			cubemapSize: options.cubemapSize ?? 8,
			projectionPrecision: options.projectionPrecision ?? 'half float',
			band1Intensity: options.band1Intensity ?? 1,
			band2Intensity: options.band2Intensity ?? 0.55,
			normalBias: options.normalBias ?? 0.5,
			viewBias: options.viewBias ?? 0,
			leakReductionMode: options.leakReductionMode ?? 'normal',
			useProbeValidity: options.useProbeValidity ?? true,
			lightingMode: 'probes only',
			probeHelper: false
		} );
		_lightProbeContext.probeHelper.visible = false;

		if ( _lightProbeContext.params.materialType !== 'standard' ) {

			_lightProbeContext.params.materialType = 'standard';
			_lightProbeContext.updateMaterialType();

		}

	};

	const readVisibilityDepthInfo = () => {

		const probeGrid = _lightProbeContext?.probeGrid;
		const compactVisibilityDepthInfo = ( info ) => {

			return {
				available: info?.available === true,
				mode: info?.mode ?? 'unavailable',
				bytes: info?.bytes ?? 0
			};

		};

		if ( typeof probeGrid?.getVisibilityDepthInfo === 'function' ) {

			return compactVisibilityDepthInfo( probeGrid.getVisibilityDepthInfo() );

		}

		return {
			available: false,
			mode: 'unavailable',
			bytes: 0
		};

	};

	const readHarnessTimingFacts = () => ( {
		totalBakeMs: _lightProbeContext.timings.totalBakeMs,
		timingSource: _lightProbeContext.timings.timingSource
	} );

	const getProbeHarnessMetrics = () => ( {
		resolution: _lightProbeContext.params.resolution,
		cubemapSize: _lightProbeContext.params.cubemapSize,
		precision: _lightProbeContext.probeGrid.getPrecisionInfo( _lightProbeContext.renderer ),
		sampling: _lightProbeContext.probeGrid.getSamplingInfo(),
		memory: _lightProbeContext.probeGrid.getMemoryInfo(),
		visibilityDepth: readVisibilityDepthInfo(),
		isLightProbeGrid: _lightProbeContext.probeGrid.isLightProbeGrid,
		hasTexture: _lightProbeContext.probeGrid.texture !== null,
		hasBoundingBox: _lightProbeContext.probeGrid.boundingBox !== undefined,
		materialType: _lightProbeContext.params.materialType,
		lightingMode: _lightProbeContext.params.lightingMode,
		probeHelper: _lightProbeContext.params.probeHelper,
		probeHelperDebugMode: _lightProbeContext.params.probeHelperDebugMode,
		probeHelperDepthMode: _lightProbeContext.params.probeHelperDepthMode,
		status: _lightProbeContext.params.bakeStatus,
		timings: readHarnessTimingFacts()
	} );

	const getGroundingParitySnapshotMetrics = () => ( {
		resolution: _lightProbeContext.params.resolution,
		cubemapSize: _lightProbeContext.params.cubemapSize,
		precision: pickFields( _lightProbeContext.probeGrid.getPrecisionInfo( _lightProbeContext.renderer ), [ 'requestedPrecision' ] ),
		sampling: _lightProbeContext.probeGrid.getSamplingInfo(),
		materialType: _lightProbeContext.params.materialType,
		lightingMode: _lightProbeContext.params.lightingMode,
		status: _lightProbeContext.params.bakeStatus,
		timings: readHarnessTimingFacts()
	} );

	const groundingParitySnapshotBand2Intensity = 0.55;
	const groundingParitySnapshotBase = {
		leakReductionMode: 'off',
		useProbeValidity: true
	};
	const groundingParityLowResSnapshotBase = {
		...groundingParitySnapshotBase,
		resolution: 4,
		cubemapSize: 8
	};
	const groundingParityDensitySnapshotBase = {
		...groundingParitySnapshotBase,
		resolution: 6,
		cubemapSize: 32
	};
	const groundingParitySnapshotCases = {
		'low-res-damped': {
			...groundingParityLowResSnapshotBase,
			band1Intensity: 0.6
		},
		'low-res-unweighted': {
			...groundingParityLowResSnapshotBase,
			band1Intensity: 1
		},
		'low-res-validity-weighted': {
			...groundingParityLowResSnapshotBase,
			band1Intensity: 1,
			leakReductionMode: 'normal'
		},
		'webgpu-webgl-density-reference': {
			...groundingParityDensitySnapshotBase,
			band1Intensity: 1
		},
		'webgpu-webgl-density-shadowless': {
			...groundingParityDensitySnapshotBase,
			band1Intensity: 1,
			disableShadowsDuringBake: true
		},
		'webgpu-webgl-density-shadow-crisp': {
			...groundingParityDensitySnapshotBase,
			band1Intensity: 1,
			shadowMapSize: 1024,
			shadowRadius: 0,
			shadowNormalBias: 0.01
		},
		'webgpu-webgl-density-damped': {
			...groundingParityDensitySnapshotBase,
			band1Intensity: 0.6
		}
	};

	let groundingParitySnapshotRestoreState = null;

	const applyGroundingParitySnapshot = async ( label ) => {

		const snapshotCase = groundingParitySnapshotCases[ label ];

		if ( snapshotCase === undefined ) {

			throw new Error( `Unknown grounding parity snapshot case: ${ label }.` );

		}

		if ( groundingParitySnapshotRestoreState === null ) {

			groundingParitySnapshotRestoreState = createHarnessStateSnapshot();

		}

		applyProofBakeSettings( {
			band1Intensity: snapshotCase.band1Intensity,
			band2Intensity: groundingParitySnapshotBand2Intensity,
			cubemapSize: snapshotCase.cubemapSize,
			leakReductionMode: snapshotCase.leakReductionMode,
			resolution: snapshotCase.resolution,
			useProbeValidity: snapshotCase.useProbeValidity
		} );

		await _lightProbeContext.recreateAndBakeRequired(
			`grounding parity snapshot ${ label }`,
			false,
			{
				disableShadowsDuringBake: snapshotCase.disableShadowsDuringBake,
				shadowMapSize: snapshotCase.shadowMapSize,
				shadowRadius: snapshotCase.shadowRadius,
				shadowNormalBias: snapshotCase.shadowNormalBias
			}
		);
		_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );
		const regions = captureRegionArtifactMetrics();
		const customDirectShadowControl = snapshotCase.shadowMapSize !== undefined ||
			snapshotCase.shadowRadius !== undefined ||
			snapshotCase.shadowNormalBias !== undefined ? {
				mapSize: snapshotCase.shadowMapSize,
				radius: snapshotCase.shadowRadius,
				normalBias: snapshotCase.shadowNormalBias
			} : undefined;

		return {
			label,
			probeIntensity: _lightProbeContext.params.probeIntensity,
			band1Intensity: _lightProbeContext.params.band1Intensity,
			band2Intensity: _lightProbeContext.params.band2Intensity,
			normalBias: _lightProbeContext.params.normalBias,
			viewBias: _lightProbeContext.params.viewBias,
			...( snapshotCase.disableShadowsDuringBake === true ? { shadowsDisabledDuringBake: true } : {} ),
			directShadowControl: customDirectShadowControl,
			metrics: getGroundingParitySnapshotMetrics(),
			artifactSignature: captureArtifactSignature(),
			regions,
			artifactPressure: createObjectArtifactPressure( regions )
		};

	};

	const restoreGroundingParitySnapshot = async () => {

		if ( groundingParitySnapshotRestoreState === null ) {

			return getProbeHarnessMetrics();

		}

		const previousState = groundingParitySnapshotRestoreState;
		groundingParitySnapshotRestoreState = null;

		await restoreHarnessState( previousState, 'grounding parity snapshot restore' );

		return getProbeHarnessMetrics();

	};

	const pickFields = ( source, keys ) => Object.fromEntries( keys.map( key => [ key, source[ key ] ] ) );

	const createBenchmarkResult = ( nextTimings ) => {

		const memory = _lightProbeContext.probeGrid.getMemoryInfo();

		return {
			probes: _lightProbeContext.probeGrid.totalProbes,
			precision: pickFields( _lightProbeContext.probeGrid.getPrecisionInfo( _lightProbeContext.renderer ), [ 'requestedPrecision' ] ),
			backend: memory.backend,
			estimatedGpuBytes: pickFields( memory, [ 'total', 'cubemapBytes', 'coefficientBytes', 'atlasBytes', 'probeValidityBytes' ] ),
			visibilityDepth: readVisibilityDepthInfo(),
			cubemapMs: nextTimings.cubemapMs,
			projectionMs: nextTimings.projectionMs,
			copyMs: nextTimings.copyMs,
			projectionBackend: nextTimings.projectionBackend,
			totalBakeMs: nextTimings.totalBakeMs,
			timingSource: nextTimings.timingSource,
			timingSourceKind: nextTimings.timingSourceKind,
			gpuTimestampStatus: nextTimings.gpuTimestampStatus,
			timingBuckets: pickFields( nextTimings.timingBuckets, [
				'source',
				'sceneUpdateMs',
				'radianceCubemapCaptureMs',
				'distanceCubemapCaptureMs',
				'computeShProjectionMs',
				'visibilityRepackMs',
				'atlasRepackMs',
				'verifierReadbackTimingSource'
			] ),
			frameMs: _lightProbeContext.timings.frameMs
		};

	};

	const inspectVisibilityWeightingAtLeakReceivers = createLightProbeGridGPUVisibilityWeightingStudy( {
		_lightProbeContext,
		captureCanvasSample,
		captureLeakRegionMetrics,
		captureReceiverIrradianceRenderMetrics,
		createHarnessStateSnapshot,
		createProbeVisibilitySnapshot,
		evaluateIrradianceContract,
		restoreHarnessState,
		restoreProbeVisibilitySnapshot,
		roundMetric,
		roundVector,
		applyProofBakeSettings
	} );

	const inspectLeakReceiverNormalConvention = async ( fixtureMode = 'sealed-wall' ) => {

		if ( _lightProbeContext.leakFixture === null ) {

			return {
				available: false,
				fixtureMode
			};

		}

		const previousVisibility = createProbeVisibilitySnapshot();
		const previousLeftMaterial = _lightProbeContext.leakFixture.leftReceiver.material;
		const previousRightMaterial = _lightProbeContext.leakFixture.rightReceiver.material;
		const raycaster = new THREE.Raycaster();
		const receiverPosition = new THREE.Vector3();
		const receiverQuaternion = new THREE.Quaternion();
		const cpuNormal = new THREE.Vector3();
		const cameraDirection = new THREE.Vector3();
		const rayDirection = new THREE.Vector3();
		const worldFaceNormal = new THREE.Vector3();
		const linearToSrgbByte = value => {

			const clamped = Math.max( 0, Math.min( value, 1 ) );
			const srgb = clamped <= 0.0031308 ?
				clamped * 12.92 :
				1.055 * Math.pow( clamped, 1 / 2.4 ) - 0.055;

			return Math.round( srgb * 255 );

		};

		const encodeNormalColor = normal => ( {
			r: linearToSrgbByte( normal.x * 0.5 + 0.5 ),
			g: linearToSrgbByte( normal.y * 0.5 + 0.5 ),
			b: linearToSrgbByte( normal.z * 0.5 + 0.5 )
		} );
		const colorDistance = ( a, b ) => Math.sqrt(
			( a.r - b.r ) * ( a.r - b.r ) +
			( a.g - b.g ) * ( a.g - b.g ) +
			( a.b - b.b ) * ( a.b - b.b )
		);
		const analyzeNormalColor = ( metric, normal ) => {

			const color = metric.color;
			const expectedCpu = encodeNormalColor( normal );
			const expectedInverted = encodeNormalColor( normal.clone().multiplyScalar( - 1 ) );
			const cpuDistance = colorDistance( color, expectedCpu );
			const invertedDistance = colorDistance( color, expectedInverted );

			return {
				visible: metric.luminance.mean > 32,
				matchesCpuNormal: cpuDistance <= invertedDistance
			};

		};

		const createNormalMaterial = ( side ) => {

			const material = new THREE.MeshBasicNodeMaterial();
			material.colorNode = normalWorld.normalize().mul( 0.5 ).add( 0.5 );
			material.side = side;
			material.toneMapped = false;

			return material;

		};

		const createReceiverDiagnostic = ( label, mesh ) => {

			mesh.updateWorldMatrix( true, false );
			mesh.getWorldPosition( receiverPosition );
			mesh.getWorldQuaternion( receiverQuaternion );
			cpuNormal.set( 0, 0, 1 ).applyQuaternion( receiverQuaternion ).normalize();
			cameraDirection.subVectors( _lightProbeContext.camera.position, receiverPosition ).normalize();
			rayDirection.subVectors( receiverPosition, _lightProbeContext.camera.position ).normalize();
			raycaster.set( _lightProbeContext.camera.position, rayDirection );

			const intersections = raycaster.intersectObject( mesh, false );
			let actualRenderedSide = 'culled-or-missed';

			if ( intersections.length > 0 && intersections[ 0 ].face !== null ) {

				worldFaceNormal.copy( intersections[ 0 ].face.normal ).transformDirection( mesh.matrixWorld ).normalize();
				const rayDotFaceNormal = raycaster.ray.direction.dot( worldFaceNormal );
				actualRenderedSide = rayDotFaceNormal < 0 ? 'front-face' : 'back-face';

			}

			const cameraDotCpuNormal = cameraDirection.dot( cpuNormal );

			return {
				label,
				cpuNormal: roundVector( cpuNormal ),
				invertedCpuNormal: roundVector( cpuNormal.clone().multiplyScalar( - 1 ) ),
				cameraDotCpuNormal: roundMetric( cameraDotCpuNormal ),
				expectedVisibleFaceFromCpuNormal: cameraDotCpuNormal >= 0 ? 'front-face' : 'back-face',
				actualRenderedSide,
				surfaceRegion: createObjectSurfaceScreenRegion( mesh )
			};

		};

		const regionArea = region => region === null ? 0 : Math.max( region.x1 - region.x0, 0 ) * Math.max( region.y1 - region.y0, 0 );

		const captureShaderNormalVariant = ( side, label ) => {

			const material = createNormalMaterial( side );
			_lightProbeContext.leakFixture.leftReceiver.material = material;
			_lightProbeContext.leakFixture.rightReceiver.material = material;
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			const regions = {
				leftReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.leftReceiver ) ?? createObjectCenterScreenRegion( _lightProbeContext.leakFixture.leftReceiver ),
				rightReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.rightReceiver ) ?? createObjectCenterScreenRegion( _lightProbeContext.leakFixture.rightReceiver )
			};
			const metrics = captureRegionArtifactMetrics( regions );
			const leftNormal = new THREE.Vector3(
				receivers[ 0 ].cpuNormal.x,
				receivers[ 0 ].cpuNormal.y,
				receivers[ 0 ].cpuNormal.z
			);
			const rightNormal = new THREE.Vector3(
				receivers[ 1 ].cpuNormal.x,
				receivers[ 1 ].cpuNormal.y,
				receivers[ 1 ].cpuNormal.z
			);
			const variant = {
				label,
				materialSide: materialSideLabel( side ),
				leftReceiverSurface: analyzeNormalColor( metrics.leftReceiverSurface, leftNormal ),
				rightReceiverSurface: analyzeNormalColor( metrics.rightReceiverSurface, rightNormal )
			};

			material.dispose();

			return variant;

		};

		let receivers = null;

		try {

			setBaseCornellProbeMeshesVisible( false );
			setLeakFixtureMode( fixtureMode );

			for ( const mesh of _lightProbeContext.leakFixture.meshes ) {

				mesh.visible = false;

			}

			_lightProbeContext.leakFixture.group.visible = true;
			_lightProbeContext.leakFixture.leftReceiver.visible = true;
			_lightProbeContext.leakFixture.rightReceiver.visible = true;
			receivers = [
				createReceiverDiagnostic( 'leftReceiver', _lightProbeContext.leakFixture.leftReceiver ),
				createReceiverDiagnostic( 'rightReceiver', _lightProbeContext.leakFixture.rightReceiver )
			];

			const shaderNormalSamples = [
				captureShaderNormalVariant( THREE.FrontSide, 'front-side-normalWorld' ),
				captureShaderNormalVariant( THREE.BackSide, 'back-side-normalWorld' ),
				captureShaderNormalVariant( THREE.DoubleSide, 'double-side-normalWorld' )
			];
			const frontSideSample = shaderNormalSamples.find( sample => sample.label === 'front-side-normalWorld' );
			const frontFaceReceiverCount = receivers.filter( receiver =>
				receiver.expectedVisibleFaceFromCpuNormal === 'front-face' &&
				receiver.actualRenderedSide === 'front-face'
			).length;
			const frontSideVisibleReceiverCount = [
				frontSideSample.leftReceiverSurface,
				frontSideSample.rightReceiverSurface
			].filter( surface => surface.visible === true ).length;
			const frontSideCpuNormalConventionCount = [
				frontSideSample.leftReceiverSurface,
				frontSideSample.rightReceiverSurface
			].filter( surface => surface.matchesCpuNormal === true ).length;
			const receiverSurfaceRegionAreaRatio = roundMetric(
				receivers.reduce( ( sum, receiver ) => sum + regionArea( receiver.surfaceRegion ), 0 )
			);
			const minCameraDotCpuNormal = roundMetric( Math.min( ...receivers.map( receiver => receiver.cameraDotCpuNormal ) ) );

			return {
				available: true,
				fixtureMode,
				receiverCount: receivers.length,
				frontFaceReceiverCount,
				shaderNormalSampleCount: shaderNormalSamples.length,
				frontSideVisibleReceiverCount,
				frontSideCpuNormalConventionCount,
				minCameraDotCpuNormal,
				receiverSurfaceRegionAreaRatio
			};

		} finally {

			_lightProbeContext.leakFixture.leftReceiver.material = previousLeftMaterial;
			_lightProbeContext.leakFixture.rightReceiver.material = previousRightMaterial;
			restoreProbeVisibilitySnapshot( previousVisibility );
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		}

	};

	const createLeakProofRowMetrics = ( metrics, rendererMetrics ) => ( {
		wrongSideColorRatio: metrics.wrongSideColorRatio,
		maskedWrongSideColorRatio: metrics.maskedWrongSideColorRatio,
		correctBounceRatio: metrics.correctBounceRatio,
		preToneMaskedWrongSideColorRatio: rendererMetrics.metrics.maskedWrongSideColorRatio,
		preToneMaskedCorrectBounceRatio: rendererMetrics.metrics.maskedCorrectBounceRatio
	} );

	const createReceiverMaterialAttributionFacts = () => {

		const leftMaterial = _lightProbeContext.leakFixture?.leftReceiver?.material ?? null;
		const rightMaterial = _lightProbeContext.leakFixture?.rightReceiver?.material ?? null;
		const leftColor = leftMaterial?.color ?? null;
		const rightColor = rightMaterial?.color ?? null;
		const leftWrongSideRatio = leftColor !== null ? leftColor.g / Math.max( leftColor.r, 0.0001 ) : null;
		const rightWrongSideRatio = rightColor !== null ? rightColor.r / Math.max( rightColor.g, 0.0001 ) : null;

		return {
			receiverMaterialType: _lightProbeContext.params.materialType,
			receiverAlbedoWrongSideRatio: roundMetric( Math.max( leftWrongSideRatio ?? 0, rightWrongSideRatio ?? 0 ) ),
			receiverRoughness: Number.isFinite( leftMaterial?.roughness ) ? roundMetric( leftMaterial.roughness ) : null,
			receiverMetalness: Number.isFinite( leftMaterial?.metalness ) ? roundMetric( leftMaterial.metalness ) : null
		};

	};

	const createReceiverSurfaceSamplingFacts = () => {

		if ( _lightProbeContext.leakFixture === null ) {

			return {
				minCameraDotCpuNormal: null,
				receiverSurfaceRegionAreaRatio: null
			};

		}

		const receiverPosition = new THREE.Vector3();
		const receiverQuaternion = new THREE.Quaternion();
		const cpuNormal = new THREE.Vector3();
		const cameraDirection = new THREE.Vector3();
		const readCameraDotCpuNormal = mesh => {

			mesh.updateWorldMatrix( true, false );
			mesh.getWorldPosition( receiverPosition );
			mesh.getWorldQuaternion( receiverQuaternion );
			cpuNormal.set( 0, 0, 1 ).applyQuaternion( receiverQuaternion ).normalize();
			cameraDirection.subVectors( _lightProbeContext.camera.position, receiverPosition ).normalize();

			return cameraDirection.dot( cpuNormal );

		};
		const regionArea = region => region === null ? 0 : Math.max( region.x1 - region.x0, 0 ) * Math.max( region.y1 - region.y0, 0 );
		const receivers = [
			_lightProbeContext.leakFixture.leftReceiver,
			_lightProbeContext.leakFixture.rightReceiver
		];

		return {
			minCameraDotCpuNormal: roundMetric( Math.min( ...receivers.map( readCameraDotCpuNormal ) ) ),
			receiverSurfaceRegionAreaRatio: roundMetric( receivers.reduce( ( sum, mesh ) =>
				sum + regionArea( createObjectSurfaceScreenRegion( mesh ) ), 0 ) )
		};

	};

	const createResidualAttributionRow = ( label, metrics, rendererMetrics, irradianceMetrics = null, materialFacts = null, lambertMetrics = null, surfaceSamplingFacts = null ) => ( {
		label,
		screenRegionWrongSideColorRatio: metrics.wrongSideColorRatio,
		surfaceWrongSideColorRatio: metrics.surfaceWrongSideColorRatio,
		surfaceCenterWrongSideColorRatio: metrics.surfaceCenterWrongSideColorRatio,
		nearDividerEdgeWrongSideColorRatio: metrics.nearDividerEdgeWrongSideColorRatio,
		maskedWrongSideColorRatio: metrics.maskedWrongSideColorRatio,
		maskedVisiblePixelCount: metrics.maskedVisiblePixelCount,
		maskedVisiblePixelRatio: metrics.maskedVisiblePixelRatio,
		preToneMaskedWrongSideColorRatio: rendererMetrics.metrics.maskedWrongSideColorRatio,
		...( irradianceMetrics !== null ? {
			renderIrradianceCenterWrongRatio: irradianceMetrics.renderIrradianceCenterWrongRatio,
			renderLinearIrradianceCenterWrongRatio: irradianceMetrics.renderLinearIrradianceCenterWrongRatio,
			renderIrradianceMaskedWrongRatio: irradianceMetrics.renderIrradianceMaskedWrongRatio,
			renderLinearIrradianceMaskedWrongRatio: irradianceMetrics.renderLinearIrradianceMaskedWrongRatio
		} : {} ),
		...( materialFacts !== null ? {
			receiverMaterialType: materialFacts.receiverMaterialType,
			receiverAlbedoWrongSideRatio: materialFacts.receiverAlbedoWrongSideRatio,
			receiverRoughness: materialFacts.receiverRoughness,
			receiverMetalness: materialFacts.receiverMetalness
		} : {} ),
		...( lambertMetrics !== null ? {
			renderLambertMaskedWrongRatio: lambertMetrics.renderLambertMaskedWrongRatio,
			renderLinearLambertMaskedWrongRatio: lambertMetrics.renderLinearLambertMaskedWrongRatio
		} : {} ),
		...( surfaceSamplingFacts !== null ? {
			minCameraDotCpuNormal: surfaceSamplingFacts.minCameraDotCpuNormal,
			receiverSurfaceRegionAreaRatio: surfaceSamplingFacts.receiverSurfaceRegionAreaRatio
		} : {} )
	} );

	const createResidualAttributionFacts = ( rows ) => {

		const rowMap = new Map( rows.map( row => [ row.label, row ] ) );
		const baseline = rowMap.get( 'sealed-wall-validity-weighted' );
		const candidate = rowMap.get( 'sealed-wall-visibility-moments' );
		const ratio = key => roundMetric( candidate[ key ] / Math.max( baseline[ key ], 0.0001 ) );

		return {
			attributionPolicy: 'rendered-region-source-ratios',
			baselineLabel: baseline.label,
			candidateLabel: candidate.label,
			screenRegionResidualRatio: ratio( 'screenRegionWrongSideColorRatio' ),
			surfaceResidualRatio: ratio( 'surfaceWrongSideColorRatio' ),
			surfaceCenterResidualRatio: ratio( 'surfaceCenterWrongSideColorRatio' ),
			maskedVisibleResidualRatio: ratio( 'maskedWrongSideColorRatio' ),
			preToneMaskedResidualRatio: ratio( 'preToneMaskedWrongSideColorRatio' ),
			candidateRenderIrradianceCenterWrongRatio: candidate.renderIrradianceCenterWrongRatio,
			candidateRenderLinearIrradianceCenterWrongRatio: candidate.renderLinearIrradianceCenterWrongRatio,
			candidateLinearIrradianceToMaskedVisibleRatio: roundMetric(
				candidate.renderLinearIrradianceCenterWrongRatio / Math.max( candidate.maskedWrongSideColorRatio, 0.0001 )
			),
			candidateRenderIrradianceMaskedWrongRatio: candidate.renderIrradianceMaskedWrongRatio,
			candidateRenderLinearIrradianceMaskedWrongRatio: candidate.renderLinearIrradianceMaskedWrongRatio,
			candidateMaskedIrradianceToMaskedVisibleRatio: roundMetric(
				candidate.renderLinearIrradianceMaskedWrongRatio / Math.max( candidate.maskedWrongSideColorRatio, 0.0001 )
			),
			candidateReceiverMaterialType: candidate.receiverMaterialType,
			candidateReceiverAlbedoWrongSideRatio: candidate.receiverAlbedoWrongSideRatio,
			candidateReceiverRoughness: candidate.receiverRoughness,
			candidateReceiverMetalness: candidate.receiverMetalness,
			candidatePreToneMaskedToAlbedoRatio: roundMetric(
				candidate.preToneMaskedWrongSideColorRatio / Math.max( candidate.receiverAlbedoWrongSideRatio, 0.0001 )
			),
			candidateRenderLambertMaskedWrongRatio: candidate.renderLambertMaskedWrongRatio,
			candidateRenderLinearLambertMaskedWrongRatio: candidate.renderLinearLambertMaskedWrongRatio,
			candidateLinearLambertToLinearIrradianceRatio: roundMetric(
				candidate.renderLinearLambertMaskedWrongRatio / Math.max( candidate.renderLinearIrradianceMaskedWrongRatio, 0.0001 )
			),
			candidatePreToneMaskedToLinearLambertRatio: roundMetric(
				candidate.preToneMaskedWrongSideColorRatio / Math.max( candidate.renderLinearLambertMaskedWrongRatio, 0.0001 )
			),
			candidateNearDividerEdgeWrongSideColorRatio: candidate.nearDividerEdgeWrongSideColorRatio,
			candidateNearDividerEdgeToSurfaceCenterRatio: roundMetric(
				candidate.nearDividerEdgeWrongSideColorRatio / Math.max( candidate.surfaceCenterWrongSideColorRatio, 0.0001 )
			),
			candidateNearDividerEdgeToMaskedVisibleRatio: roundMetric(
				candidate.nearDividerEdgeWrongSideColorRatio / Math.max( candidate.maskedWrongSideColorRatio, 0.0001 )
			),
			candidateMaskedVisiblePixelCount: candidate.maskedVisiblePixelCount,
			candidateMaskedVisiblePixelRatio: candidate.maskedVisiblePixelRatio,
			candidateMaskedVisibleToSurfaceCenterRatio: roundMetric(
				candidate.maskedWrongSideColorRatio / Math.max( candidate.surfaceCenterWrongSideColorRatio, 0.0001 )
			),
			candidatePreToneMaskedToMaskedVisibleRatio: roundMetric(
				candidate.preToneMaskedWrongSideColorRatio / Math.max( candidate.maskedWrongSideColorRatio, 0.0001 )
			),
			minCameraDotCpuNormal: candidate.minCameraDotCpuNormal,
			receiverSurfaceRegionAreaRatio: candidate.receiverSurfaceRegionAreaRatio
		};

	};

	const createLeakProofSettingsSnapshot = () => ( {
		resolution: _lightProbeContext.params.resolution,
		cubemapSize: _lightProbeContext.params.cubemapSize,
		band1Intensity: _lightProbeContext.params.band1Intensity,
		band2Intensity: _lightProbeContext.params.band2Intensity,
		normalBias: _lightProbeContext.params.normalBias,
		viewBias: _lightProbeContext.params.viewBias,
		lightingMode: _lightProbeContext.params.lightingMode,
		materialType: _lightProbeContext.params.materialType
	} );

	const captureLeakProofFacts = async () => {

		const previousState = createHarnessStateSnapshot();
		const previousVisibility = createProbeVisibilitySnapshot();
		const rows = [];
		const residualAttributionRows = [];
		let proofSettings = null;
		let sampling = null;
		const cases = [
			{
				label: 'sealed-wall-validity-weighted',
				leakReductionMode: 'normal',
				useProbeValidity: true,
				disableVisibilityDepth: true
			},
			{
				label: 'sealed-wall-visibility-moments',
				leakReductionMode: 'normal',
				useProbeValidity: true,
				receiverScopedMask: true
			}
		];

		const restoreState = async () => {

			restoreProbeVisibilitySnapshot( previousVisibility );
			await restoreHarnessState( previousState, 'leak proof restore' );

		};

		try {

			for ( const proofCase of cases ) {

				applyProofBakeSettings( {
					fixtureMode: 'sealed-wall',
					hideBaseCornell: true,
					leakReductionMode: proofCase.leakReductionMode,
					useProbeValidity: proofCase.useProbeValidity
				} );

				await _lightProbeContext.recreateAndBakeRequired( `leak proof ${ proofCase.label }` );

				const guardedVisibilityProofMode = proofCase.disableVisibilityDepth === true ? 'off' : 'guarded';

				if ( typeof _lightProbeContext.probeGrid._setGuardedVisibilityProofMode === 'function' ) {

					_lightProbeContext.probeGrid._setGuardedVisibilityProofMode( guardedVisibilityProofMode );
					_lightProbeContext.syncProbeGridBindings();

				}

				if ( proofCase.receiverScopedMask === true ) applyLeakFixtureReceiverMasks();

				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				if ( proofSettings === null ) proofSettings = createLeakProofSettingsSnapshot();
				if ( sampling === null ) sampling = _lightProbeContext.probeGrid.getSamplingInfo();

				const leakMetrics = captureLeakRegionMetrics();
				const preToneLeakMetrics = captureLeakRegionMetricsWithRendererMapping( {
					mode: 'pre-tone-linear-output-masked-visible-pixels',
					toneMapping: THREE.NoToneMapping,
					toneMappingLabel: 'NoToneMapping',
					outputColorSpace: THREE.LinearSRGBColorSpace
				} );
				const irradianceMetrics = proofCase.receiverScopedMask === true ?
					captureReceiverIrradianceRenderMetrics() :
					null;
				const materialFacts = proofCase.receiverScopedMask === true ?
					createReceiverMaterialAttributionFacts() :
					null;
				const lambertMetrics = proofCase.receiverScopedMask === true ?
					captureReceiverLambertMaterialResponseMetrics() :
					null;
				const surfaceSamplingFacts = proofCase.receiverScopedMask === true ?
					createReceiverSurfaceSamplingFacts() :
					null;

				rows.push( {
					label: proofCase.label,
					guardedVisibilityProofMode,
					...createLeakProofRowMetrics( leakMetrics, preToneLeakMetrics )
				} );
				residualAttributionRows.push( createResidualAttributionRow(
					proofCase.label,
					leakMetrics,
					preToneLeakMetrics,
					irradianceMetrics,
					materialFacts,
					lambertMetrics,
					surfaceSamplingFacts
				) );

			}

		} finally {

			await restoreState();

		}

		return {
			fixtureMode: 'sealed-wall',
			proofSettings,
			sampling,
			rows,
			residualAttribution: createResidualAttributionFacts( residualAttributionRows ),
			restored: {
				lightingMode: _lightProbeContext.params.lightingMode,
				leakReductionMode: _lightProbeContext.params.leakReductionMode,
				leakFixtureVisible: _lightProbeContext.leakFixture !== null && _lightProbeContext.leakFixture.group.visible === true
			}
		};

	};

	const setBakeParameter = async ( key, value ) => {

		_lightProbeContext.params[ key ] = value;
		await _lightProbeContext.recreateAndBake();

	};

	const createContractProbeGrid = ( options = {} ) => new LightProbeGridGPU(
		new THREE.Vector3( - 1, - 2, - 3 ),
		new THREE.Vector3( 4, 5, 6 ),
		{
			resolution: 2,
			cubemapSize: 4,
			projectionPrecision: 'half float',
			renderer: _lightProbeContext.renderer,
			...options
		}
	);

	window.__webgpuLightProbeGridCornell = {
		getMetrics: getProbeHarnessMetrics,
		setResolution: value => setBakeParameter( 'resolution', value ),
		setCubemapSize: value => setBakeParameter( 'cubemapSize', value ),
		setPrecision: value => setBakeParameter( 'projectionPrecision', value ),
		setLightingMode: ( value ) => {

			_lightProbeContext.params.lightingMode = value;
			_lightProbeContext.updateLightingMode();

		},
		setProbeHelperVisible: ( value ) => {

			_lightProbeContext.params.probeHelper = value === true;
			_lightProbeContext.probeHelper.visible = _lightProbeContext.params.probeHelper;

			return window.__webgpuLightProbeGridCornell.getMetrics();

		},
		setProbeHelperDebugMode: ( value ) => {

			_lightProbeContext.params.probeHelperDebugMode = value;
			_lightProbeContext.probeGrid.setHelperDebugMode( value );

			return window.__webgpuLightProbeGridCornell.getMetrics();

		},
		setProbeHelperDepthMode: ( value ) => {

			_lightProbeContext.params.probeHelperDepthMode = value;
			_lightProbeContext.probeGrid.setHelperDepthMode( value );

			return window.__webgpuLightProbeGridCornell.getMetrics();

		},
		setMaterialType: ( value ) => {

			_lightProbeContext.params.materialType = value;
			_lightProbeContext.updateMaterialType();

		},
		setLeakReductionMode: value => setBakeParameter( 'leakReductionMode', value ),
		inspectAddonContract: () => {

			const contractGrid = createContractProbeGrid();
			const contractHelper = contractGrid.createHelper();
			const boundingBoxMin = contractGrid.boundingBox.min.toArray();
			const boundingBoxMax = contractGrid.boundingBox.max.toArray();
			const result = {
				isObject3D: contractGrid.isObject3D === true || contractGrid instanceof THREE.Object3D,
				isLightProbeGrid: contractGrid.isLightProbeGrid === true,
				type: contractGrid.type,
				hasTextureBeforeDispose: contractGrid.texture !== null,
				hasHelperBeforeDispose: contractHelper !== null,
				boundingBoxMin: {
					x: boundingBoxMin[ 0 ],
					y: boundingBoxMin[ 1 ],
					z: boundingBoxMin[ 2 ]
				},
				boundingBoxMax: {
					x: boundingBoxMax[ 0 ],
					y: boundingBoxMax[ 1 ],
					z: boundingBoxMax[ 2 ]
				}
			};

			contractGrid.dispose();

			result.hasTextureAfterDispose = contractGrid.texture !== null;
			result.hasHelperAfterDispose = contractGrid.helper !== null;
			result.hasAtlasTargetAfterDispose = contractGrid.atlasTarget !== null;

			return result;

		},
		inspectProbePositions: () => {

			const contractGrid = createContractProbeGrid();
			const first = new THREE.Vector3();
			const last = new THREE.Vector3();

			contractGrid.getProbePosition( 0, first );
			contractGrid.getProbePosition( contractGrid.totalProbes - 1, last );

			const invalidConstructorResolution = captureSyncRejection( () => createContractProbeGrid( { resolution: 1 } ) );
			const invalidSetOptionsResolution = captureSyncRejection( () => {

				contractGrid.setOptions( { resolution: 1 }, _lightProbeContext.renderer );

			} );

			contractGrid.dispose();

			return {
				first: {
					x: first.x,
					y: first.y,
					z: first.z
				},
				last: {
					x: last.x,
					y: last.y,
					z: last.z
				},
				invalidConstructorResolutionRejected: invalidConstructorResolution.rejected,
				invalidConstructorResolutionMessage: invalidConstructorResolution.message,
				invalidSetOptionsResolutionRejected: invalidSetOptionsResolution.rejected,
				invalidSetOptionsResolutionMessage: invalidSetOptionsResolution.message
			};

		},
		inspectSamplingControls: () => {

			const defaultGrid = createUnitProbeGrid();
			const configuredGrid = createUnitProbeGrid( {
				normalBias: 0.75,
				viewBias: 0.25,
				leakReductionMode: 'normal',
				probeValidity: new Float32Array( [ 1, 1, 1, 1, 1, 1, 1, 0 ] ),
				probeLayerMasks: new Uint32Array( [ 1, 3, 1, 3, 5, 1, 5, 1 ] )
			} );
			const invalidLeakReductionMode = captureSyncRejection( () => {

				configuredGrid.setOptions( { leakReductionMode: 'distance' }, _lightProbeContext.renderer );

			} );
			const invalidProbeLayerMasks = captureSyncRejection( () => {

				configuredGrid.setOptions( { probeLayerMasks: new Uint32Array( [ 1, 2 ] ) }, _lightProbeContext.renderer );

			} );

			const result = {
				defaultSampling: defaultGrid.getSamplingInfo(),
				configuredSampling: configuredGrid.getSamplingInfo(),
				invalidLeakReductionModeRejected: invalidLeakReductionMode.rejected,
				invalidLeakReductionModeMessage: invalidLeakReductionMode.message,
				invalidProbeLayerMasksRejected: invalidProbeLayerMasks.rejected,
				invalidProbeLayerMasksMessage: invalidProbeLayerMasks.message
			};

			defaultGrid.dispose();
			configuredGrid.dispose();

			return result;

		},
		inspectProjectionParity,
		inspectComputeProjectionRuntimeParity,
		inspectComputeProjectionProfiling,
		inspectSHMathContract,
		inspectAtlasPacking,
		inspectVisibilityDepthMoments,
		inspectProbeOccupancy,
		compareLeakReductionModes: async () => {

			const previousLeakReductionMode = _lightProbeContext.params.leakReductionMode;
			let offResult = null;
			let normalResult = null;
			const captureLeakModeComparison = async () => {

				const sampling = _lightProbeContext.probeGrid.getSamplingInfo();
				const colorSanity = await captureColorSanity();

				return {
					weightedProbeSampling: sampling.weightedProbeSampling,
					centerEnergy: colorSanity.centerEnergy
				};

			};

			try {

				_lightProbeContext.params.leakReductionMode = 'off';
				await _lightProbeContext.recreateAndBakeRequired( 'leak reduction off' );
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				offResult = await captureLeakModeComparison();

				_lightProbeContext.params.leakReductionMode = 'normal';
				await _lightProbeContext.recreateAndBakeRequired( 'leak reduction normal' );
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				normalResult = await captureLeakModeComparison();

			} finally {

				_lightProbeContext.params.leakReductionMode = previousLeakReductionMode;
				await _lightProbeContext.recreateAndBakeRequired( 'leak reduction restore' );

			}

			return {
				off: offResult,
				normal: normalResult
			};

		},
		inspectVisibilityWeightingAtLeakReceivers,
		inspectLeakReceiverNormalConvention,
		captureLeakProofFacts,
		applyGroundingParitySnapshot,
		restoreGroundingParitySnapshot,
		testBakeCoalescing: async () => {

			let result = null;

			await _lightProbeContext.runProbeGridBake( async () => {

				const firstBake = _lightProbeContext.probeGrid.bake( _lightProbeContext.renderer, _lightProbeContext.scene, { onResourcesChanged: _lightProbeContext.syncProbeGridBindings } );
				const secondBake = _lightProbeContext.probeGrid.bake( _lightProbeContext.renderer, _lightProbeContext.scene, { onResourcesChanged: _lightProbeContext.syncProbeGridBindings } );
				const samePromise = firstBake === secondBake;
				const nextTimings = await firstBake;

				result = {
					samePromise,
					totalBakeMs: nextTimings.totalBakeMs
				};

				return nextTimings;

			}, true );

			return result;

		},
		runBenchmarkCase: async ( options = {} ) => {

			const previousResolution = _lightProbeContext.params.resolution;
			const previousCubemapSize = _lightProbeContext.params.cubemapSize;
			const previousPrecision = _lightProbeContext.params.projectionPrecision;
			let result = null;

			try {

				_lightProbeContext.params.resolution = options.resolution ?? _lightProbeContext.params.resolution;
				_lightProbeContext.params.cubemapSize = options.cubemapSize ?? _lightProbeContext.params.cubemapSize;
				_lightProbeContext.params.projectionPrecision = options.projectionPrecision ?? _lightProbeContext.params.projectionPrecision;

				await _lightProbeContext.recreateAndBakeRequired( 'benchmark', options.simulateBenchmarkBakeFailure === true, {
					projectionBackendOverride: options.projectionBackendOverride
				} );
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				result = createBenchmarkResult( _lightProbeContext.timings );

			} finally {

				_lightProbeContext.params.resolution = previousResolution;
				_lightProbeContext.params.cubemapSize = previousCubemapSize;
				_lightProbeContext.params.projectionPrecision = previousPrecision;

				await _lightProbeContext.recreateAndBakeRequired( 'restore', options.simulateBenchmarkRestoreFailure === true );

			}

			return result;

		},
		runBenchmarkMatrix: async () => {

			const results = [];
			const resolutions = [ 2, 4, 6 ];
			const cubemapSizes = [ 8, 16, 32 ];
			const projectionPrecisions = [ 'half float', 'float' ];

			for ( const resolution of resolutions ) {

				for ( const cubemapSize of cubemapSizes ) {

					for ( const projectionPrecision of projectionPrecisions ) {

						results.push( await window.__webgpuLightProbeGridCornell.runBenchmarkCase( {
							resolution,
							cubemapSize,
							projectionPrecision
						} ) );

					}

				}

			}

			return results;

		},
		waitUntilReady,
		captureColorSanity,
		rebake: _lightProbeContext.bakeProbeGrid,
		runSelfTest: async () => {

			const results = [];
			const capture = ( step ) => {

				const metrics = window.__webgpuLightProbeGridCornell.getMetrics();

				assert( metrics.status === 'ready', `${step}: expected ready status.` );
				assert( Number.isFinite( metrics.timings.totalBakeMs ), `${step}: expected finite bake timing.` );

				results.push( { step, metrics } );

				return metrics;

			};

			await waitUntilReady();
			capture( 'initial' );

			await window.__webgpuLightProbeGridCornell.setPrecision( 'float' );

			const floatMetrics = capture( 'float' );
			assert( floatMetrics.precision.textureType === 'float' ||
				floatMetrics.precision.activePrecision === 'half-linear (fallback)',
			'float: expected float texture or explicit half fallback.' );

			if ( floatMetrics.precision.float32Filterable === true ) {

				assert( floatMetrics.precision.activePrecision === 'float-linear',
					'float: expected float-linear when float32-filterable is available.' );

			} else {

				assert( floatMetrics.precision.activePrecision === 'half-linear (fallback)',
					'float: expected half-linear fallback when float32-filterable is unavailable.' );

			}

			await window.__webgpuLightProbeGridCornell.setPrecision( 'auto' );

			const autoMetrics = capture( 'auto' );

			if ( autoMetrics.precision.float32Filterable === true ) {

				assert( autoMetrics.precision.activePrecision === 'float-linear',
					'auto: expected float-linear when float32-filterable is available.' );

			} else {

				assert( autoMetrics.precision.activePrecision === 'half-linear',
					'auto: expected half-linear when float32-filterable is unavailable.' );

			}

			await window.__webgpuLightProbeGridCornell.setPrecision( 'half float' );

			const halfMetrics = capture( 'half float' );
			assert( halfMetrics.precision.activePrecision === 'half-linear',
				'half float: expected half-linear.' );
			assert( halfMetrics.precision.textureType === 'half float',
				'half float: expected half float texture.' );

			window.__webgpuLightProbeGridCornell.setLightingMode( 'probes only' );

			const probesOnlyMetrics = capture( 'probes only' );
			assert( probesOnlyMetrics.lightingMode === 'probes only',
				'probes only: expected lighting mode to update.' );

			await window.__webgpuLightProbeGridCornell.rebake();
			const rebakeMetrics = capture( 'rebake probes only' );
			const colorSanity = await captureColorSanity();

			results.push( {
				step: 'probes only color sanity',
				metrics: rebakeMetrics,
				colorSanity
			} );

			return results;

		}
	};

}
