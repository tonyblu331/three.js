import * as THREE from 'three/webgpu';
import { Fn, normalWorld, uniform, uv, vec4 } from 'three/tsl';

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

		return { left, right, center };

	};

	const createArtifactColor = ( color ) => ( {
		r: color.r,
		g: color.g,
		b: color.b,
		luminance: color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722,
		chromaSpread: Math.max( color.r, color.g, color.b ) - Math.min( color.r, color.g, color.b )
	} );

	const roundMetric = ( value ) => Number( value.toFixed( 4 ) );
	const roundTimingMetric = ( value ) => Number( value.toFixed( 2 ) );
	const summarizeMetric = ( values ) => {

		const finiteValues = values.filter( value => Number.isFinite( value ) ).slice().sort( ( a, b ) => a - b );

		if ( finiteValues.length === 0 ) {

			return {
				samples: [],
				min: null,
				median: null,
				average: null,
				p95: null,
				max: null
			};

		}

		const middle = Math.floor( finiteValues.length / 2 );
		const median = finiteValues.length % 2 === 1 ?
			finiteValues[ middle ] :
			( finiteValues[ middle - 1 ] + finiteValues[ middle ] ) / 2;
		const p95 = finiteValues[ Math.min( finiteValues.length - 1, Math.ceil( finiteValues.length * 0.95 ) - 1 ) ];
		const average = finiteValues.reduce( ( sum, value ) => sum + value, 0 ) / finiteValues.length;

		return {
			samples: finiteValues.map( roundTimingMetric ),
			min: roundTimingMetric( finiteValues[ 0 ] ),
			median: roundTimingMetric( median ),
			average: roundTimingMetric( average ),
			p95: roundTimingMetric( p95 ),
			max: roundTimingMetric( finiteValues[ finiteValues.length - 1 ] )
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
		const constantSamples = Object.entries( normals ).map( ( [ name, normal ] ) => {

			const irradiance = evaluateIrradianceContract( constantCoefficients, normal, { clampNegative: true } );

			return {
				name,
				irradiance: {
					r: roundContractMetric( irradiance.r ),
					g: roundContractMetric( irradiance.g ),
					b: roundContractMetric( irradiance.b )
				},
				delta: roundContractMetric( colorMaxDelta( irradiance, expectedConstantIrradiance ) )
			};

		} );
		const axisResponse = Object.fromEntries( Object.entries( normals ).map( ( [ name, normal ] ) => {

			const irradiance = evaluateIrradianceContract( directionCoefficients, normal, { clampNegative: true } );

			return [ name, {
				r: roundContractMetric( irradiance.r ),
				g: roundContractMetric( irradiance.g ),
				b: roundContractMetric( irradiance.b )
			} ];

		} ) );
		let threeJsIrradianceParity = { supported: false, maxDelta: null };

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

			threeJsIrradianceParity = { supported: true, maxDelta: roundContractMetric( maxDelta ) };

		}

		return {
			basis: [ 'Y00', 'Y1-1:y', 'Y10:z', 'Y11:x', 'Y2-2:xy', 'Y2-1:yz', 'Y20:3z^2-1', 'Y21:xz', 'Y22:x^2-y^2' ],
			projectionNormalization: 'radianceCoefficients = sum( radiance * Y_lm(direction) * solidAngleWeight ) * ( 4pi / sumWeights )',
			irradianceConvolution: 'E(n) = L0 * 0.886227 + L1 * 2 * 0.511664 * n + L2 * {0.429043,0.743125,0.247708}; runtime clamps only after all bands are summed.',
			constantRadiance: {
				expected: {
					r: roundContractMetric( expectedConstantIrradiance.r ),
					g: roundContractMetric( expectedConstantIrradiance.g ),
					b: roundContractMetric( expectedConstantIrradiance.b )
				},
				samples: constantSamples,
				maxDelta: Math.max( ...constantSamples.map( sample => sample.delta ) )
			},
			axisResponse,
			axisDominance: {
				positiveXRedBeatsNegativeX: axisResponse.positiveX.r > axisResponse.negativeX.r,
				positiveYGreenBeatsNegativeY: axisResponse.positiveY.g > axisResponse.negativeY.g,
				positiveZBlueBeatsNegativeZ: axisResponse.positiveZ.b > axisResponse.negativeZ.b
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
		const computeCandidateFixtures = [ 'constant', 'face-asymmetric', 'axis-dominance' ].map( ( fixture ) => {

			const fragmentCoefficientProjection = projectSyntheticCubeFragmentCoefficientPath( 'shader-webgpu', fixture );
			const computeProbeReduction = projectSyntheticCube( 'shader-webgpu', fixture );

			return {
				fixture,
				fragmentCoefficientProjectionSweepsPerProbe: 9,
				computeProbeReductionSweepsPerProbe: 1,
				candidateToFragmentDelta: maxCoefficientDelta( computeProbeReduction, fragmentCoefficientProjection )
			};

		} );
		const computeCandidateMaxDelta = Math.max( ...computeCandidateFixtures.map( fixture => fixture.candidateToFragmentDelta ) );
		const resolveComputeProjectionFallbackDecision = ( {
			label,
			contractStatus,
			supportsComputeProjection,
			supportsStorageTexture
		} ) => {

			const computeRuntimeAllowed = [
				'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY',
				'IMPLEMENTED-WITH-PARITY-EVIDENCE'
			].includes( contractStatus ) &&
				supportsComputeProjection === true &&
				supportsStorageTexture === true;

			return {
				label,
				contractStatus,
				supportsComputeProjection,
				supportsStorageTexture,
				selectedPath: computeRuntimeAllowed ?
					'compute-probe-reduction' :
					'fragment-coefficient-projection',
				fallbackUsed: computeRuntimeAllowed === false,
				reason: computeRuntimeAllowed ?
					'guarded runtime implementation and adapter capabilities allow compute candidate path' :
					'fragment fallback remains active until guarded runtime implementation and required adapter capabilities are both available'
			};

		};

		const fallbackScenarios = [
			resolveComputeProjectionFallbackDecision( {
				label: 'runtime-implemented-adapter-supported',
				contractStatus: 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY',
				supportsComputeProjection: true,
				supportsStorageTexture: true
			} ),
			resolveComputeProjectionFallbackDecision( {
				label: 'unsupported-compute-capability',
				contractStatus: 'IMPLEMENTED-WITH-PARITY-EVIDENCE',
				supportsComputeProjection: false,
				supportsStorageTexture: true
			} ),
			resolveComputeProjectionFallbackDecision( {
				label: 'unsupported-storage-texture-capability',
				contractStatus: 'IMPLEMENTED-WITH-PARITY-EVIDENCE',
				supportsComputeProjection: true,
				supportsStorageTexture: false
			} ),
			resolveComputeProjectionFallbackDecision( {
				label: 'promoted-supported-candidate',
				contractStatus: 'IMPLEMENTED-WITH-PARITY-EVIDENCE',
				supportsComputeProjection: true,
				supportsStorageTexture: true
			} )
		];
		const fallbackRequiredScenarios = fallbackScenarios.filter( scenario =>
			scenario.label !== 'runtime-implemented-adapter-supported' &&
			scenario.label !== 'promoted-supported-candidate'
		);
		const computeProjectionAdapterFallbackOracle = {
			status: fallbackRequiredScenarios.every( scenario =>
				scenario.selectedPath === 'fragment-coefficient-projection' &&
				scenario.fallbackUsed === true
			) &&
			fallbackScenarios.find( scenario => scenario.label === 'runtime-implemented-adapter-supported' )?.selectedPath === 'compute-probe-reduction' &&
			fallbackScenarios.find( scenario => scenario.label === 'promoted-supported-candidate' )?.selectedPath === 'compute-probe-reduction' ?
				'RUNTIME-GUARDED-ADAPTER-FALLBACK-SPEC-PASSING' :
				'OPEN-PROOF-ONLY-ADAPTER-FALLBACK-DELTA',
			runtimePathIntroduced: true,
			publicApiChanged: false,
			defaultPath: 'fragment-coefficient-projection',
			candidatePath: 'compute-probe-reduction',
			requiredCapabilities: [ 'compute projection implementation', 'storage texture support' ],
			scenarios: fallbackScenarios,
			promotionEffect: 'runtime-path-introduced-full-parity-promotion-pending'
		};

		return {
			fixtures,
			maxShaderToGeneratorDelta: Math.max( ...fixtures.map( fixture => fixture.shaderToGeneratorDelta ) ),
			maxWebGLGridToGeneratorDelta: Math.max( ...fixtures.map( fixture => fixture.webglGridToGeneratorDelta ) ),
			maxShaderToCubeTextureDelta: Math.max( ...fixtures.map( fixture => fixture.shaderToCubeTextureDelta ) ),
			maxShaderToWebGLGridDelta: Math.max( ...fixtures.map( fixture => fixture.shaderToWebGLGridDelta ) ),
			computeProjectionCandidateOracle: {
				status: computeCandidateMaxDelta <= 0.0001 ?
					'PROOF-ONLY-MOCK-PARITY-PASSING' :
					'OPEN-PROOF-ONLY-MOCK-PARITY-DELTA',
				runtimePathIntroduced: false,
				baselinePath: 'fragment-coefficient-projection',
				candidatePath: 'compute-probe-reduction',
				baselineCubemapSweepsPerProbe: 9,
				candidateCubemapSweepsPerProbe: 1,
				promotionEffect: 'does-not-promote-runtime',
				fixtures: computeCandidateFixtures,
				maxCandidateToFragmentDelta: computeCandidateMaxDelta,
				tolerance: 0.0001
			},
			computeProjectionAdapterFallbackOracle,
			computeProjectionParityContract: {
				status: 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY',
				previousStatus: 'PARITY-CANDIDATE-NOT-RUNTIME',
				currentPath: 'fragment-coefficient-projection',
				proposedPath: 'compute-probe-reduction',
				candidatePlanningAllowed: true,
				runtimePathIntroduced: true,
				runtimeMarkersAllowed: true,
				publicApiChangeAllowed: false,
				runtimeStatusRequired: 'IMPLEMENTED-WITH-PARITY-EVIDENCE',
				runtimeParityReadbackStatus: 'PENDING-BROWSER-E2E',
				currentCubemapSweepsPerProbe: 9,
				proposedCubemapSweepsPerProbe: 1,
				currentCoefficientWritesPerProbe: 9,
				proposedCoefficientWritesPerProbe: 9,
				fallbackPath: 'fragment-coefficient-projection',
				requiredParitySources: [
					'shader-webgpu',
					'generator-render-target-webgpu',
					'cube-texture',
					'webgl-light-probe-grid'
				],
				requiredGates: [
					'compute c0..c8 must match fragment projection within tolerance for every synthetic fixture',
					'compute output must pack through the existing atlas repack contract before replacing the runtime path',
					'fragment coefficient projection remains fallback until compute parity is supported on target adapters'
				],
				requiredPromotionEvidence: {
					status: 'REQUIRED-BEFORE-FULL-PARITY-PROMOTION',
					syntheticFixtureParity: {
						baseline: 'fragment-coefficient-projection',
						candidate: 'compute-probe-reduction',
						fixtures: [ 'constant', 'face-asymmetric', 'axis-dominance' ],
						maxCoefficientDelta: 0.0001
					},
					atlasRepackParity: {
						baseline: 'inspectAtlasPacking',
						required: true,
						maxPackedReadbackDelta: 0.008
					},
					adapterFallbackEvidence: {
						unsupportedAdapterPath: 'fragment-coefficient-projection',
						required: true
					},
					statusTransition: {
						previous: 'PARITY-CANDIDATE-NOT-RUNTIME',
						current: 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY',
						candidate: 'PARITY-CANDIDATE-NOT-RUNTIME',
						promoted: 'IMPLEMENTED-WITH-PARITY-EVIDENCE'
					}
				},
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
		const staticWork = createProjectionStaticWork( resolution, cubemapSize );

		probeValidity[ totalProbes - 1 ] = 0;

		const createParityGrid = () => new LightProbeGridGPU(
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
						...sample,
						fragment,
						compute,
						maxDelta,
						pass: maxDelta <= atlasTolerance
					} );

				}

			}

			const atlasMaxDelta = computeSelected && atlasChecks.length > 0 ?
				roundMetric( Math.max( ...atlasChecks.map( check => check.maxDelta ) ) ) :
				Number.POSITIVE_INFINITY;
			const coefficientPass = coefficientMaxDelta <= coefficientTolerance;
			const atlasPass = atlasMaxDelta <= atlasTolerance &&
				atlasChecks.every( check => check.pass );
			const tolerancePass = computeSelected && coefficientPass && atlasPass;

			return {
				status: tolerancePass ?
					'RUNTIME-PARITY-READBACK-PASSING' :
					computeSelected ?
						'OPEN-RUNTIME-PARITY-DELTA' :
						'OPEN-RUNTIME-COMPUTE-FALLBACK',
				runtimePathIntroduced: true,
				baselinePath: 'fragment-coefficient-projection',
				candidatePath: 'compute-probe-reduction',
				fragmentBackend: fragmentTimings.projectionBackend,
				computeBackend: computeTimings.projectionBackend,
				computeFallbackReason: computeTimings.computeProjectionFallbackReason ?? null,
				resolution,
				totalProbes,
				cubemapSize,
				coefficientTolerance,
				atlasTolerance,
				staticWork,
				fragmentTimings,
				computeTimings,
				coefficientMaxDelta,
				atlasMaxDelta,
				coefficientPass,
				atlasPass,
				tolerancePass,
				coefficientReadbackPixels: coefficientWidth * coefficientHeight,
				atlasChecks,
				statusTransition: {
					previous: 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY',
					current: tolerancePass ?
						'IMPLEMENTED-WITH-PARITY-EVIDENCE' :
						'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY'
				}
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
		const getProfileNow = () => {

			const nonDeterministicNow = performance._now;
			return typeof nonDeterministicNow === 'function' ?
				nonDeterministicNow.call( performance ) :
				performance.now();

		};

		probeValidity[ probeValidity.length - 1 ] = 0;

		const createProfileGrid = () => new LightProbeGridGPU(
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

		const createRunRecord = ( timings, wallClockTotalMs, index, warmup, requestedBackend ) => ( {
			index,
			warmup,
			requestedBackend,
			selectedBackend: timings.projectionBackend,
			projectionBackendRequest: timings.projectionBackendRequest,
			sceneUpdateMs: timings.sceneUpdateMs,
			projectionMs: timings.projectionMs,
			computeShProjectionMs: timings.computeShProjectionMs ?? timings.projectionMs,
			cubemapMs: timings.cubemapMs,
			radianceCubemapCaptureMs: timings.radianceCubemapCaptureMs ?? timings.cubemapMs,
			copyMs: timings.copyMs,
			atlasRepackMs: timings.atlasRepackMs ?? timings.copyMs,
			distanceCubemapCaptureMs: timings.distanceCubemapCaptureMs ?? timings.visibilityCubemapMs ?? 0,
			visibilityRepackMs: timings.visibilityRepackMs ?? 0,
			verifierReadbackMs: timings.verifierReadbackMs ?? 0,
			totalBakeMs: timings.totalBakeMs,
			wallClockTotalMs,
			projectionCubemapSweepsPerProbe: timings.projectionCubemapSweepsPerProbe,
			projectionTexelVisits: timings.projectionTexelVisits,
			timingSource: timings.timingSource ?? 'unavailable',
			timingSourceKind: timings.timingSourceKind ?? 'unavailable',
			gpuTimestampStatus: timings.gpuTimestampStatus ?? 'unavailable',
			projectionTimingSource: timings.projectionTimingSource ?? timings.timingSource ?? 'unavailable',
			deterministicTimerDetected: timings.deterministicTimerDetected === true,
			timingBuckets: timings.timingBuckets ?? null,
			computeProjectionFallbackReason: timings.computeProjectionFallbackReason ?? null
		} );

		const profileBackend = async ( requestedBackend, expectedBackend ) => {

			const grid = createProfileGrid();
			const warmups = [];
			const runs = [];

			try {

				for ( let i = 0; i < warmupRuns + measuredRuns; i ++ ) {

					const warmup = i < warmupRuns;
					const wallClockStart = getProfileNow();
					const timings = await grid.bake( renderer, scene, { projectionBackendOverride: requestedBackend } );
					const wallClockTotalMs = roundTimingMetric( Math.max( getProfileNow() - wallClockStart, 0 ) );
					const record = createRunRecord( timings, wallClockTotalMs, warmup ? i : i - warmupRuns, warmup, requestedBackend );

					if ( warmup ) {

						warmups.push( record );

					} else {

						runs.push( record );

					}

				}

				return {
					requestedBackend,
					expectedBackend,
					selectedBackends: Array.from( new Set( runs.map( run => run.selectedBackend ) ) ),
					warmupRuns: warmups,
					measuredRuns: runs,
					sceneUpdateMs: summarizeMetric( runs.map( run => run.sceneUpdateMs ) ),
					projectionMs: summarizeMetric( runs.map( run => run.projectionMs ) ),
					computeShProjectionMs: summarizeMetric( runs.map( run => run.computeShProjectionMs ) ),
					cubemapMs: summarizeMetric( runs.map( run => run.cubemapMs ) ),
					radianceCubemapCaptureMs: summarizeMetric( runs.map( run => run.radianceCubemapCaptureMs ) ),
					copyMs: summarizeMetric( runs.map( run => run.copyMs ) ),
					atlasRepackMs: summarizeMetric( runs.map( run => run.atlasRepackMs ) ),
					distanceCubemapCaptureMs: summarizeMetric( runs.map( run => run.distanceCubemapCaptureMs ) ),
					visibilityRepackMs: summarizeMetric( runs.map( run => run.visibilityRepackMs ) ),
					verifierReadbackMs: summarizeMetric( runs.map( run => run.verifierReadbackMs ) ),
					totalBakeMs: summarizeMetric( runs.map( run => run.wallClockTotalMs ) ),
					probeGridTotalBakeMs: summarizeMetric( runs.map( run => run.totalBakeMs ) ),
					timingSources: Array.from( new Set( runs.map( run => run.timingSource ) ) ),
					timingSourceKinds: Array.from( new Set( runs.map( run => run.timingSourceKind ) ) ),
					gpuTimestampStatuses: Array.from( new Set( runs.map( run => run.gpuTimestampStatus ) ) ),
					projectionTimingSources: Array.from( new Set( runs.map( run => run.projectionTimingSource ) ) ),
					deterministicTimerDetected: runs.some( run => run.deterministicTimerDetected === true ),
					allRunsSelectedExpectedBackend: runs.every( run => run.selectedBackend === expectedBackend ),
					fallbackReasons: Array.from( new Set( runs.map( run => run.computeProjectionFallbackReason ).filter( Boolean ) ) )
				};

			} finally {

				grid.dispose();

			}

		};

		const fragment = await profileBackend( 'force-fragment', 'fragment-coefficient-projection' );
		const compute = await profileBackend( 'force-compute', 'compute-probe-reduction' );
		const hasProjectionTiming = fragment.projectionMs.median !== null &&
			compute.projectionMs.median !== null &&
			fragment.projectionMs.median > 0 &&
			compute.projectionMs.median > 0;
		const hasTotalTiming = fragment.totalBakeMs.median !== null &&
			compute.totalBakeMs.median !== null &&
			fragment.totalBakeMs.median > 0 &&
			compute.totalBakeMs.median > 0;
		const projectionMedianSpeedupRatio = hasProjectionTiming ?
			roundMetric( fragment.projectionMs.median / compute.projectionMs.median ) :
			null;
		const projectionMedianReductionPercent = hasProjectionTiming ?
			roundMetric( ( 1 - compute.projectionMs.median / fragment.projectionMs.median ) * 100 ) :
			null;
		const totalBakeMedianSpeedupRatio = hasTotalTiming ?
			roundMetric( fragment.totalBakeMs.median / compute.totalBakeMs.median ) :
			null;
		const totalBakeMedianReductionPercent = hasTotalTiming ?
			roundMetric( ( 1 - compute.totalBakeMs.median / fragment.totalBakeMs.median ) * 100 ) :
			null;
		const selectedExpectedBackends = fragment.allRunsSelectedExpectedBackend && compute.allRunsSelectedExpectedBackend;
		const projectionTimingSources = Array.from( new Set( [
			...( fragment.projectionTimingSources ?? [] ),
			...( compute.projectionTimingSources ?? [] )
		] ) );
		const usesNonDeterministicProjectionTiming = projectionTimingSources.includes( 'non-deterministic-performance-now' );

		return {
			status: selectedExpectedBackends ?
				'DIAGNOSTIC-PROJECTION-PROFILE-CAPTURED' :
				'OPEN-PROJECTION-PROFILE-BACKEND-FALLBACK',
			timingPolicy: hasProjectionTiming ?
				'DIAGNOSTIC-PROJECTION-PHASE-NON-GATED' :
				'DIAGNOSTIC-WALL-CLOCK-NOT-GATED',
			timingGated: false,
			gpuTimerQueryStatus: 'NOT-CAPTURED',
			projectionPhaseTimingStatus: hasProjectionTiming ?
				usesNonDeterministicProjectionTiming ?
					'CAPTURED-NON-DETERMINISTIC-PERFORMANCE-NOW' :
					'CAPTURED-PERFORMANCE-NOW' :
				'UNAVAILABLE-DETERMINISTIC-TIMER-ZERO',
			projectionTimingSources,
			deterministicTimerDetected: fragment.deterministicTimerDetected || compute.deterministicTimerDetected,
			claimBoundary: 'Static cubemap sweep reduction is evidence; wall-clock medians are diagnostic and must not be presented as guaranteed GPU speedup.',
			resolution,
			cubemapSize,
			warmupRuns,
			measuredRuns,
			staticWork,
			fragment,
			compute,
			projectionMedianSpeedupRatio,
			projectionMedianReductionPercent,
			totalBakeMedianSpeedupRatio,
			totalBakeMedianReductionPercent
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
		const testGrid = new LightProbeGridGPU(
			new THREE.Vector3( - 1, - 1, - 1 ),
			new THREE.Vector3( 1, 1, 1 ),
			{
				resolution,
				cubemapSize: 4,
				projectionPrecision: 'half float',
				probeValidity,
				renderer: _lightProbeContext.renderer
			}
		);

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
				textureIndex,
				layer,
				gridZ,
				sourceGridZ,
				x,
				y,
				probeIndex,
				actual: actual.map( roundMetric ),
				expected: expected.map( roundMetric ),
				deltas: deltas.map( roundMetric ),
				maxDelta: roundMetric( Math.max( ...deltas ) )
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

			for ( const textureIndex of [ 0, 1, 6 ] ) {

				for ( const gridZ of [ 0, resolution - 1 ] ) {

					const baseLayer = getLightProbeGridGPUPackedAtlasBaseLayer( textureIndex, paddedSlices );

					addressChecks.push( {
						textureIndex,
						gridZ,
						baseLayer,
						methodBaseLayer: testGrid._getPackedAtlasBaseLayer( textureIndex ),
						dataLayer: getLightProbeGridGPUPackedAtlasLayer( textureIndex, gridZ, paddedSlices ),
						methodDataLayer: testGrid._getPackedAtlasLayer( textureIndex, gridZ ),
						leadingPaddingLayer: getLightProbeGridGPUPackedAtlasLayer( textureIndex, - atlasPadding, paddedSlices ),
						methodLeadingPaddingLayer: testGrid._getPackedAtlasLayer( textureIndex, - atlasPadding ),
						trailingPaddingLayer: getLightProbeGridGPUPackedAtlasLayer( textureIndex, resolution, paddedSlices ),
						methodTrailingPaddingLayer: testGrid._getPackedAtlasLayer( textureIndex, resolution ),
						centerSampleZ: roundMetric( getLightProbeGridGPUPackedAtlasCenterSampleZ( textureIndex, gridZ, paddedSlices, atlasDepth ) )
					} );

				}

			}

			const readbackChecks = [
				await createReadbackCheck( { label: 'origin-y0-z0-t0', textureIndex: 0, gridZ: 0, x: 0, y: 0 } ),
				await createReadbackCheck( { label: 'native-y3-z0-t0', textureIndex: 0, gridZ: 0, x: 1, y: resolution - 1 } ),
				await createReadbackCheck( { label: 'middle-z1-t2', textureIndex: 2, gridZ: 1, x: 2, y: 1 } ),
				await createReadbackCheck( { label: 'validity-z3-t6', textureIndex: 6, gridZ: 3, x: 3, y: 2 } )
			];
			const paddingChecks = [
				await createReadbackCheck( { label: 'leading-padding-z0-t0', textureIndex: 0, gridZ: - atlasPadding, sourceGridZ: 0, x: 2, y: 1 } ),
				await createReadbackCheck( { label: 'trailing-padding-z3-t0', textureIndex: 0, gridZ: resolution, sourceGridZ: resolution - 1, x: 2, y: 1 } ),
				await createReadbackCheck( { label: 'leading-padding-validity-t6', textureIndex: 6, gridZ: - atlasPadding, sourceGridZ: 0, x: 1, y: 2 } )
			];
			const allReadbackChecks = [ ...readbackChecks, ...paddingChecks ];
			const maxReadbackDelta = roundMetric( Math.max( ...allReadbackChecks.map( check => check.maxDelta ) ) );
			const computeProjectionAtlasRepackOracle = {
				status: maxReadbackDelta < 0.008 ?
					'PROOF-ONLY-ATLAS-REPACK-PARITY-PASSING' :
					'OPEN-PROOF-ONLY-ATLAS-REPACK-PARITY-DELTA',
				runtimePathIntroduced: false,
				sourcePath: 'compute-written coefficientTarget-compatible rows',
				baselinePath: 'inspectAtlasPacking',
				repackPath: '_repackAtlas',
				requiredLayout: 'coefficientTarget row order c0..c8 plus PACKED_SH_TEXTURES atlas packing and padding layers',
				readbackTolerance: 0.008,
				maxReadbackDelta,
				checkedLayers: allReadbackChecks.map( check => check.label ),
				openEvidenceAfterPass: [ 'compute-adapter-fallback' ],
				promotionEffect: 'does-not-promote-runtime'
			};

			return {
				resolution,
				totalProbes,
				shCoefficientCount,
				packedAtlasTextureCount,
				atlasPadding,
				paddedSlices,
				atlasDepth,
				gridProbeIndexFormula: 'x + y * resolution + z * resolution^2',
				addressChecks,
				coefficientPacking: PACKED_SH_COEFFICIENT_LAYOUT,
				readbackChecks,
				paddingChecks,
				maxReadbackDelta,
				computeProjectionAtlasRepackOracle,
				validityProbeIndex: readbackChecks[ 3 ].probeIndex,
				validityExpected: readbackChecks[ 3 ].expected[ 3 ],
				validityActual: readbackChecks[ 3 ].actual[ 3 ]
			};

		} finally {

			testGrid.dispose();

		}

	};

	const inspectVisibilityDepthMoments = async () => {

		const info = readVisibilityDepthInfo();
		const target = _lightProbeContext.probeGrid.visibilityDepthTarget ?? null;
		const resolution = info.resolution ?? 0;
		const textureDepth = info.texture?.depth ?? _lightProbeContext.probeGrid.totalProbes ?? 0;
		const createMomentQualityProfile = ( stats = null ) => ( {
			status: stats !== null && stats.finiteSampleCount > 0 ? 'CAPTURED-RADIAL-MOMENT-READBACK' : 'OPEN-NO-MOMENT-READBACK',
			encoding: info.encoding ?? 'unavailable',
			activeResolution: resolution,
			activeRepackMode: 'five-tap-octa-neighborhood',
			samplePolicy: 'center-plus-four-neighbor octa texel averaging from radial distance cubemap',
			varianceMetric: 'radial-distance variance; do not label as log variance until encoding changes',
			sweepPlan: [
				{ visibilityDepthResolution: 4, repackMode: 'single-sample', status: 'DEFERRED' },
				{ visibilityDepthResolution: 8, repackMode: 'five-tap', status: resolution === 8 ? 'ACTIVE' : 'AVAILABLE-CURRENT-CODEPATH' },
				{ visibilityDepthResolution: 16, repackMode: 'future-multi-sample', status: 'DEFERRED' }
			],
			stats
		} );

		const unavailable = ( reason ) => {

			const stats = {
				sampleCount: 0,
				finiteSampleCount: 0,
				hitSampleCount: 0,
				minMeanDistance: null,
				maxMeanDistance: null,
				minVariance: null,
				maxVariance: null,
				meanVariance: null,
				minHitConfidence: null,
				maxHitConfidence: null,
				meanHitConfidence: null,
				bytes: info.bytes ?? 0,
				encoding: info.encoding ?? 'unavailable'
			};

			return {
				...info,
				proofBoundary: 'readback-only verifier for private DDGI-lite visibility/depth moments; not a public API contract.',
				samples: [],
				stats,
				momentQualityProfile: createMomentQualityProfile( stats ),
				evidenceStatus: 'OPEN',
				reason
			};

		};

		if ( target === null || info.available !== true || info.mode !== 'moments' || resolution <= 0 || textureDepth <= 0 ) {

			return unavailable( 'visibilityDepthTarget is not moment-backed yet.' );

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
		const samples = [];

		for ( const point of readbackPoints ) {

			const moment = await readLightProbeGridGPUVisibilityMomentPixel( _lightProbeContext.renderer, target, point );

			samples.push( {
				...point,
				meanDistance: roundMetric( moment.meanDistance ),
				meanSquaredDistance: roundMetric( moment.meanSquaredDistance ),
				variance: roundMetric( Math.max( moment.variance, 0 ) ),
				hitConfidence: roundMetric( moment.hitConfidence ),
				validity: roundMetric( moment.backfaceConfidence ),
				backfaceConfidence: roundMetric( moment.backfaceConfidence ),
				momentEncoding: info.encoding,
				finite: moment.finite
			} );

		}

		const finiteSamples = samples.filter( sample => sample.finite === true );
		const hitSamples = finiteSamples.filter( sample => sample.hitConfidence > 0 );
		const meanDistances = finiteSamples.map( sample => sample.meanDistance );
		const variances = finiteSamples.map( sample => sample.variance );
		const hitConfidences = finiteSamples.map( sample => sample.hitConfidence );

		const stats = {
			sampleCount: samples.length,
			finiteSampleCount: finiteSamples.length,
			hitSampleCount: hitSamples.length,
			minMeanDistance: meanDistances.length > 0 ? roundMetric( Math.min( ...meanDistances ) ) : null,
			maxMeanDistance: meanDistances.length > 0 ? roundMetric( Math.max( ...meanDistances ) ) : null,
			minVariance: variances.length > 0 ? roundMetric( Math.min( ...variances ) ) : null,
			maxVariance: variances.length > 0 ? roundMetric( Math.max( ...variances ) ) : null,
			meanVariance: variances.length > 0 ?
				roundMetric( variances.reduce( ( total, value ) => total + value, 0 ) / variances.length ) :
				null,
			minHitConfidence: hitConfidences.length > 0 ? roundMetric( Math.min( ...hitConfidences ) ) : null,
			maxHitConfidence: hitConfidences.length > 0 ? roundMetric( Math.max( ...hitConfidences ) ) : null,
			meanHitConfidence: hitConfidences.length > 0 ?
				roundMetric( hitConfidences.reduce( ( total, value ) => total + value, 0 ) / hitConfidences.length ) :
				null,
			bytes: info.bytes ?? 0,
			encoding: info.encoding ?? 'unavailable'
		};

		return {
			...info,
			proofBoundary: 'readback-only verifier for private DDGI-lite visibility/depth moments; not a public API contract.',
			samples,
			stats,
			momentQualityProfile: createMomentQualityProfile( stats ),
			evidenceStatus: finiteSamples.length === samples.length && hitSamples.length > 0 ? 'SUPPORTED' : 'OPEN'
		};

	};

	const inspectProbeOccupancy = () => {

		return {
			..._lightProbeContext.collectProbeOccupancy( _lightProbeContext.params.resolution ),
			sampling: _lightProbeContext.probeGrid.getSamplingInfo()
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
		let totalCellEdgeContrast = 0;
		let cellEdgeSamples = 0;

		for ( let cy = 0; cy < cellCount; cy ++ ) {

			for ( let cx = 0; cx < cellCount; cx ++ ) {

				if ( cx + 1 < cellCount ) {

					const contrast = Math.abs( cellMeans[ cy ][ cx ] - cellMeans[ cy ][ cx + 1 ] );
					maxCellEdgeContrast = Math.max( maxCellEdgeContrast, contrast );
					totalCellEdgeContrast += contrast;
					cellEdgeSamples ++;

				}

				if ( cy + 1 < cellCount ) {

					const contrast = Math.abs( cellMeans[ cy ][ cx ] - cellMeans[ cy + 1 ][ cx ] );
					maxCellEdgeContrast = Math.max( maxCellEdgeContrast, contrast );
					totalCellEdgeContrast += contrast;
					cellEdgeSamples ++;

				}

			}

		}

		return {
			region,
			samples: luminance.length,
			gridCells: cellCount,
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
				min: roundMetric( sorted[ 0 ] ),
				p01: roundMetric( percentile( 0.01 ) ),
				p05: roundMetric( percentile( 0.05 ) ),
				median: roundMetric( percentile( 0.5 ) ),
				p95: roundMetric( percentile( 0.95 ) ),
				max: roundMetric( sorted[ sorted.length - 1 ] ),
				mean: roundMetric( sum / Math.max( luminance.length, 1 ) )
			},
			darkThreshold: roundMetric( darkThreshold ),
			darkPixelRatio: roundMetric( darkSamples / Math.max( luminance.length, 1 ) ),
			blackThreshold,
			blackPixelRatio: roundMetric( blackSamples / Math.max( luminance.length, 1 ) ),
			cellEdgeContrast: roundMetric( maxCellEdgeContrast ),
			averageCellEdgeContrast: roundMetric( totalCellEdgeContrast / Math.max( cellEdgeSamples, 1 ) )
		};

	};

	const createMaskedReceiverMetric = ( colorCanvasSample, maskCanvasSample, maskSelector ) => {

		const width = colorCanvasSample.width;
		const height = colorCanvasSample.height;
		const colorImage = colorCanvasSample.context.getImageData( 0, 0, width, height );
		const maskImage = maskCanvasSample.context.getImageData( 0, 0, width, height );
		const luminance = [];
		const color = { r: 0, g: 0, b: 0 };
		const bounds = { x0: width, x1: 0, y0: height, y1: 0 };
		let sampleCount = 0;

		for ( let i = 0; i < maskImage.data.length; i += 4 ) {

			const maskRed = maskImage.data[ i ];
			const maskGreen = maskImage.data[ i + 1 ];
			const selected = maskSelector === 'left' ?
				maskRed > 128 && maskGreen < 64 :
				maskGreen > 128 && maskRed < 64;

			if ( selected === false ) continue;

			const pixelIndex = i / 4;
			const x = pixelIndex % width;
			const y = Math.floor( pixelIndex / width );
			const red = colorImage.data[ i ];
			const green = colorImage.data[ i + 1 ];
			const blue = colorImage.data[ i + 2 ];
			const value = red * 0.2126 + green * 0.7152 + blue * 0.0722;

			bounds.x0 = Math.min( bounds.x0, x );
			bounds.x1 = Math.max( bounds.x1, x );
			bounds.y0 = Math.min( bounds.y0, y );
			bounds.y1 = Math.max( bounds.y1, y );
			luminance.push( value );
			color.r += red;
			color.g += green;
			color.b += blue;
			sampleCount ++;

		}

		const safeSampleCount = Math.max( sampleCount, 1 );
		color.r /= safeSampleCount;
		color.g /= safeSampleCount;
		color.b /= safeSampleCount;
		const sorted = luminance.length > 0 ? [ ...luminance ].sort( ( a, b ) => a - b ) : [ 0 ];
		const percentile = ( value ) => sorted[ Math.min( sorted.length - 1, Math.max( 0, Math.floor( ( sorted.length - 1 ) * value ) ) ) ];
		const darkThreshold = Math.max( 16, percentile( 0.5 ) * 0.35 );
		const blackThreshold = 32;
		const darkSamples = luminance.filter( value => value <= darkThreshold ).length;
		const blackSamples = luminance.filter( value => value <= blackThreshold ).length;

		return {
			maskSelector,
			samples: sampleCount,
			coverageRatio: roundMetric( sampleCount / Math.max( width * height, 1 ) ),
			region: sampleCount > 0 ? {
				x0: roundMetric( bounds.x0 / width ),
				x1: roundMetric( ( bounds.x1 + 1 ) / width ),
				y0: roundMetric( bounds.y0 / height ),
				y1: roundMetric( ( bounds.y1 + 1 ) / height )
			} : null,
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
				min: roundMetric( sorted[ 0 ] ),
				p05: roundMetric( percentile( 0.05 ) ),
				median: roundMetric( percentile( 0.5 ) ),
				p95: roundMetric( percentile( 0.95 ) ),
				max: roundMetric( sorted[ sorted.length - 1 ] ),
				mean: roundMetric( luminance.reduce( ( sum, value ) => sum + value, 0 ) / safeSampleCount )
			},
			darkPixelRatio: roundMetric( darkSamples / safeSampleCount ),
			blackPixelRatio: roundMetric( blackSamples / safeSampleCount )
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
				occlusionMode: 'depth-preserved-full-scene-mask',
				maskOccluderPolicy: 'non-receiver meshes render black and keep depth so the mask samples the same visible pixels as the color pass',
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

	const createBakeTexelBudget = ( resolution = _lightProbeContext.params.resolution, cubemapSize = _lightProbeContext.params.cubemapSize ) => {

		const probes = resolution * resolution * resolution;
		const cubemapFaceTexels = cubemapSize * cubemapSize;
		const cubemapTexels = probes * 6 * cubemapFaceTexels;
		const lowResTexels = 4 * 4 * 4 * 6 * 8 * 8;

		return {
			resolution,
			cubemapSize,
			probes,
			cubemapFaceTexels,
			cubemapTexels,
			relativeToLowRes: roundMetric( cubemapTexels / lowResTexels )
		};

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
			cellEdgeContrast: roundMetric( maxCellEdgeContrast ),
			status: maxBlackPixelRatio > 0.15 || luminanceFloor < 24 ? 'PRESSURE' : 'bounded'
		};

	};

	const captureLeakRegionMetrics = () => {

		const regions = captureRegionArtifactMetrics( createLeakCaptureRegions() );
		const centerRegions = _lightProbeContext.leakFixture === null ? null : {
			leftReceiverCenter: createObjectCenterScreenRegion( _lightProbeContext.leakFixture.leftReceiver ) ?? leakArtifactRegions.leftReceiver,
			rightReceiverCenter: createObjectCenterScreenRegion( _lightProbeContext.leakFixture.rightReceiver ) ?? leakArtifactRegions.rightReceiver
		};
		const centerSamples = centerRegions === null ? null : captureRegionArtifactMetrics( centerRegions );
		const surfaceRegions = _lightProbeContext.leakFixture === null ? null : {
			leftReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.leftReceiver ) ?? centerRegions.leftReceiverCenter,
			rightReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.rightReceiver ) ?? centerRegions.rightReceiverCenter
		};
		const surfaceSamples = surfaceRegions === null ? null : captureRegionArtifactMetrics( surfaceRegions );
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
		const luminanceMean = ( leftReceiver.luminance.mean + rightReceiver.luminance.mean ) * 0.5;
		const darkPixelRatio = Math.max( leftReceiver.darkPixelRatio, rightReceiver.darkPixelRatio );
		const cellEdgeContrast = Math.max( leftReceiver.cellEdgeContrast, rightReceiver.cellEdgeContrast );
		const centerWrongSideColorRatio = centerSamples === null ? null : Math.max(
			centerSamples.leftReceiverCenter.colorBias.greenOverRed,
			centerSamples.rightReceiverCenter.colorBias.redOverGreen
		);
		const centerCorrectBounceRatio = centerSamples === null ? null : Math.min(
			centerSamples.leftReceiverCenter.colorBias.redOverGreen,
			centerSamples.rightReceiverCenter.colorBias.greenOverRed
		);
		const surfaceWrongSideColorRatio = surfaceSamples === null ? null : Math.max(
			surfaceSamples.leftReceiverSurface.colorBias.greenOverRed,
			surfaceSamples.rightReceiverSurface.colorBias.redOverGreen
		);
		const surfaceCorrectBounceRatio = surfaceSamples === null ? null : Math.min(
			surfaceSamples.leftReceiverSurface.colorBias.redOverGreen,
			surfaceSamples.rightReceiverSurface.colorBias.greenOverRed
		);
		const maskedWrongSideColorRatio = maskedSamples === null ? null : Math.max(
			maskedSamples.leftReceiverMasked.colorBias.greenOverRed,
			maskedSamples.rightReceiverMasked.colorBias.redOverGreen
		);
		const maskedCorrectBounceRatio = maskedSamples === null ? null : Math.min(
			maskedSamples.leftReceiverMasked.colorBias.redOverGreen,
			maskedSamples.rightReceiverMasked.colorBias.greenOverRed
		);

		return {
			regions,
			centerRegions: centerSamples,
			surfaceRegions: surfaceSamples,
			maskedRegions: maskedSamples,
			wrongSideColorRatio: roundMetric( wrongSideColorRatio ),
			centerWrongSideColorRatio: centerWrongSideColorRatio === null ? null : roundMetric( centerWrongSideColorRatio ),
			surfaceWrongSideColorRatio: surfaceWrongSideColorRatio === null ? null : roundMetric( surfaceWrongSideColorRatio ),
			maskedWrongSideColorRatio: maskedWrongSideColorRatio === null ? null : roundMetric( maskedWrongSideColorRatio ),
			correctBounceRatio: roundMetric( correctBounceRatio ),
			centerCorrectBounceRatio: centerCorrectBounceRatio === null ? null : roundMetric( centerCorrectBounceRatio ),
			surfaceCorrectBounceRatio: surfaceCorrectBounceRatio === null ? null : roundMetric( surfaceCorrectBounceRatio ),
			maskedCorrectBounceRatio: maskedCorrectBounceRatio === null ? null : roundMetric( maskedCorrectBounceRatio ),
			receiverRegionMetricMode: 'object-bounds-rect-with-center-and-surface-isolated-diagnostics',
			maskedReceiverRegionMetricMode: maskedSamples?.mode ?? 'not-captured',
			luminance: {
				mean: roundMetric( luminanceMean ),
				minP05: roundMetric( Math.min( leftReceiver.luminance.p05, rightReceiver.luminance.p05 ) ),
				maxP95: roundMetric( Math.max( leftReceiver.luminance.p95, rightReceiver.luminance.p95 ) )
			},
			darkPixelRatio: roundMetric( darkPixelRatio ),
			cellEdgeContrast: roundMetric( cellEdgeContrast )
		};

	};

	const captureArtifactSignature = () => {

		_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		const [ leftWall, rightWall, center, upperCenter, floorCenter ] = sampleCanvas( [
			{ x0: 0.08, x1: 0.24, y0: 0.32, y1: 0.68 },
			{ x0: 0.76, x1: 0.92, y0: 0.32, y1: 0.68 },
			{ x0: 0.42, x1: 0.58, y0: 0.38, y1: 0.62 },
			{ x0: 0.36, x1: 0.64, y0: 0.18, y1: 0.34 },
			{ x0: 0.34, x1: 0.66, y0: 0.68, y1: 0.88 }
		] );

		return {
			leftWall: createArtifactColor( leftWall ),
			rightWall: createArtifactColor( rightWall ),
			center: createArtifactColor( center ),
			upperCenter: createArtifactColor( upperCenter ),
			floorCenter: createArtifactColor( floorCenter )
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

	const readVisibilityDepthInfo = () => {

		const probeGrid = _lightProbeContext?.probeGrid;

		if ( typeof probeGrid?.getVisibilityDepthInfo === 'function' ) {

			return probeGrid.getVisibilityDepthInfo();

		}

		return {
			available: false,
			mode: 'unavailable',
			resolution: 0,
			moments: 0,
			bytes: 0,
			texture: null,
			samples: [],
			stats: {
				sampleCount: 0,
				finiteSampleCount: 0,
				hitSampleCount: 0,
				minMeanDistance: null,
				maxMeanDistance: null,
				minVariance: null,
				maxVariance: null,
				meanVariance: null,
				minHitConfidence: null,
				maxHitConfidence: null,
				meanHitConfidence: null
			}
		};

	};

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
		timings: { ..._lightProbeContext.timings }
	} );

	const groundingParitySnapshotCases = {
		'low-res-damped': {
			proofRole: 'baseline',
			referenceBoundary: 'Current damped WebGPU low-res diagnostic baseline.',
			resolution: 4,
			cubemapSize: 8,
			band1Intensity: 0.6,
			band2Intensity: 0.55,
			leakReductionMode: 'off',
			useProbeValidity: true
		},
		'low-res-unweighted': {
			proofRole: 'candidate',
			referenceBoundary: 'Full first-band WebGPU low-res candidate using hardware-filtered unweighted sampling.',
			resolution: 4,
			cubemapSize: 8,
			band1Intensity: 1,
			band2Intensity: 0.55,
			leakReductionMode: 'off',
			useProbeValidity: true
		},
		'low-res-validity-weighted': {
			proofRole: 'candidate-weighted',
			referenceBoundary: 'Full first-band WebGPU low-res candidate using scoped validity/normal-weighted sampling.',
			resolution: 4,
			cubemapSize: 8,
			band1Intensity: 1,
			band2Intensity: 0.55,
			leakReductionMode: 'normal',
			useProbeValidity: true
		},
		'webgpu-webgl-density-reference': {
			proofRole: 'same-budget-artifact-pressure',
			referenceBoundary: 'WebGPU row using the WebGL LightProbeGrid reference density/cubemap budget as an artifact pressure stress row, not a visual-quality win; higher bake detail can expose low-order / 9-coefficient SH representation dark-tail/ringing artifacts.',
			antiRingingPolicy: {
				mode: 'full-band-stress',
				bandPolicy: 'L0 preserved, L1=1.0, L2=0.55',
				runtimePath: 'hardware-filtered-unweighted',
				action: 'Expose the high-contrast low-order SH representation pressure case without claiming visual quality.'
			},
			resolution: 6,
			cubemapSize: 32,
			band1Intensity: 1,
			band2Intensity: 0.55,
			leakReductionMode: 'off',
			useProbeValidity: true
		},
		'webgpu-webgl-density-shadowless': {
			proofRole: 'same-budget-shadow-control',
			referenceBoundary: 'Same 6³ / 32px stress budget with bake-time shadows disabled to isolate whether black-tail pressure is dominated by baked direct-shadow detail.',
			antiRingingPolicy: {
				mode: 'shadowless-cause-control',
				bandPolicy: 'L0 preserved, L1=1.0, L2=0.55',
				runtimePath: 'hardware-filtered-unweighted',
				action: 'Hold the same SH band policy while removing bake-time shadow contrast.'
			},
			resolution: 6,
			cubemapSize: 32,
			band1Intensity: 1,
			band2Intensity: 0.55,
			leakReductionMode: 'off',
			useProbeValidity: true,
			disableShadowsDuringBake: true
		},
		'webgpu-webgl-density-shadow-crisp': {
			proofRole: 'same-budget-direct-shadow-control',
			referenceBoundary: 'Same 6³ / 32px stress budget with a higher-resolution, zero-radius direct shadow map during bake to separate shadow-map filtering dirt from low-order SH representation pressure.',
			antiRingingPolicy: {
				mode: 'direct-shadow-crisp-cause-control',
				bandPolicy: 'L0 preserved, L1=1.0, L2=0.55',
				runtimePath: 'hardware-filtered-unweighted',
				action: 'Hold SH bands and probe budget constant while changing only the direct shadow-map bake settings.'
			},
			resolution: 6,
			cubemapSize: 32,
			band1Intensity: 1,
			band2Intensity: 0.55,
			leakReductionMode: 'off',
			useProbeValidity: true,
			shadowMapSize: 1024,
			shadowRadius: 0,
			shadowNormalBias: 0.01
		},
		'webgpu-webgl-density-damped': {
			proofRole: 'same-budget-quality-candidate',
			referenceBoundary: 'Same 6³ / 32px stress budget with anti-ringing first-band damping promoted as the quality candidate for the muddy black-tail artifact.',
			antiRingingPolicy: {
				mode: 'band1-damped-quality',
				bandPolicy: 'L0 preserved, L1=0.6, L2=0.55',
				runtimePath: 'hardware-filtered-unweighted',
				action: 'Reduce first-band directional overshoot after high-detail bake compression while preserving probe intensity, bake budget, and the fast unweighted sample() path.'
			},
			resolution: 6,
			cubemapSize: 32,
			band1Intensity: 0.6,
			band2Intensity: 0.55,
			leakReductionMode: 'off',
			useProbeValidity: true
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

		_lightProbeContext.params.resolution = snapshotCase.resolution;
		_lightProbeContext.params.cubemapSize = snapshotCase.cubemapSize;
		_lightProbeContext.params.projectionPrecision = 'half float';
		_lightProbeContext.params.band1Intensity = snapshotCase.band1Intensity;
		_lightProbeContext.params.band2Intensity = snapshotCase.band2Intensity;
		_lightProbeContext.params.normalBias = 0.5;
		_lightProbeContext.params.viewBias = 0;
		_lightProbeContext.params.leakReductionMode = snapshotCase.leakReductionMode;
		_lightProbeContext.params.useProbeValidity = snapshotCase.useProbeValidity;
		_lightProbeContext.params.lightingMode = 'probes only';
		_lightProbeContext.params.probeHelper = false;
		_lightProbeContext.probeHelper.visible = false;

		if ( _lightProbeContext.params.materialType !== 'standard' ) {

			_lightProbeContext.params.materialType = 'standard';
			_lightProbeContext.updateMaterialType();

		}

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

		return {
			label,
			proofRole: snapshotCase.proofRole,
			referenceBoundary: snapshotCase.referenceBoundary,
			antiRingingPolicy: snapshotCase.antiRingingPolicy ?? {
				mode: 'not-applied',
				bandPolicy: 'demo default',
				runtimePath: _lightProbeContext.params.leakReductionMode === 'normal' ? 'manual-weighted-textureLoad' : 'hardware-filtered-unweighted',
				action: 'Not part of the same-budget density anti-ringing candidate family.'
			},
			probeIntensity: _lightProbeContext.params.probeIntensity,
			probeHelperIntensity: _lightProbeContext.params.probeHelperIntensity,
			band1Intensity: _lightProbeContext.params.band1Intensity,
			band2Intensity: _lightProbeContext.params.band2Intensity,
			normalBias: _lightProbeContext.params.normalBias,
			viewBias: _lightProbeContext.params.viewBias,
			shadowsDisabledDuringBake: snapshotCase.disableShadowsDuringBake === true,
			directShadowControl: {
				mapSize: snapshotCase.shadowMapSize ?? _lightProbeContext.directLight.shadow.mapSize.x,
				radius: snapshotCase.shadowRadius ?? _lightProbeContext.directLight.shadow.radius,
				normalBias: snapshotCase.shadowNormalBias ?? _lightProbeContext.directLight.shadow.normalBias,
				mode: snapshotCase.shadowMapSize !== undefined ||
					snapshotCase.shadowRadius !== undefined ||
					snapshotCase.shadowNormalBias !== undefined ?
					'custom-bake-shadow-map' : 'default-bake-shadow-map'
			},
			metrics: getProbeHarnessMetrics(),
			bakeTexelBudget: createBakeTexelBudget(),
			colorSanity: await captureColorSanity(),
			artifactSignature: captureArtifactSignature(),
			localArtifactMetric: createLocalArtifactMetric(),
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

	const createBenchmarkResult = ( nextTimings ) => ( {
		resolution: _lightProbeContext.params.resolution,
		probes: _lightProbeContext.probeGrid.totalProbes,
		cubemapSize: _lightProbeContext.params.cubemapSize,
		precision: _lightProbeContext.probeGrid.getPrecisionInfo( _lightProbeContext.renderer ),
		backend: _lightProbeContext.probeGrid.getMemoryInfo().backend,
		estimatedGpuBytes: _lightProbeContext.probeGrid.getMemoryInfo(),
		visibilityDepth: readVisibilityDepthInfo(),
		sceneUpdateMs: nextTimings.sceneUpdateMs,
		cubemapMs: nextTimings.cubemapMs,
		radianceCubemapCaptureMs: nextTimings.radianceCubemapCaptureMs,
		projectionMs: nextTimings.projectionMs,
		computeShProjectionMs: nextTimings.computeShProjectionMs,
		copyMs: nextTimings.copyMs,
		atlasRepackMs: nextTimings.atlasRepackMs,
		visibilityCubemapMs: nextTimings.visibilityCubemapMs,
		distanceCubemapCaptureMs: nextTimings.distanceCubemapCaptureMs,
		visibilityRepackMs: nextTimings.visibilityRepackMs,
		verifierReadbackMs: nextTimings.verifierReadbackMs,
		visibilityDepthMode: nextTimings.visibilityDepthMode,
		projectionBackendRequest: nextTimings.projectionBackendRequest,
		projectionBackend: nextTimings.projectionBackend,
		projectionBackendForced: nextTimings.projectionBackendForced,
		projectionCubemapSweepsPerProbe: nextTimings.projectionCubemapSweepsPerProbe,
		projectionTexelVisits: nextTimings.projectionTexelVisits,
		projectionTexelVisitReductionRatio: nextTimings.projectionTexelVisitReductionRatio,
		totalBakeMs: nextTimings.totalBakeMs,
		wallClockTotalBakeMs: nextTimings.wallClockTotalBakeMs,
		timingSource: nextTimings.timingSource,
		timingSourceKind: nextTimings.timingSourceKind,
		gpuTimestampStatus: nextTimings.gpuTimestampStatus,
		timingBuckets: nextTimings.timingBuckets,
		deterministicTimerDetected: nextTimings.deterministicTimerDetected,
		frameMs: _lightProbeContext.timings.frameMs
	} );

	const runProbeDiagnosticMatrix = async () => {

		const previousResolution = _lightProbeContext.params.resolution;
		const previousCubemapSize = _lightProbeContext.params.cubemapSize;
		const previousPrecision = _lightProbeContext.params.projectionPrecision;
		const previousBand1Intensity = _lightProbeContext.params.band1Intensity;
		const previousBand2Intensity = _lightProbeContext.params.band2Intensity;
		const previousNormalBias = _lightProbeContext.params.normalBias;
		const previousViewBias = _lightProbeContext.params.viewBias;
		const previousLeakReductionMode = _lightProbeContext.params.leakReductionMode;
		const previousUseProbeValidity = _lightProbeContext.params.useProbeValidity;
		const previousLightingMode = _lightProbeContext.params.lightingMode;
		const previousMaterialType = _lightProbeContext.params.materialType;
		const previousProbeHelper = _lightProbeContext.params.probeHelper;
		const rows = [];
		const cases = [
			{
				label: 'low-res-damped',
				resolution: 4,
				projectionPrecision: 'half float',
				cubemapSize: 8,
				band1Intensity: 0.6,
				band2Intensity: 0.55,
				leakReductionMode: 'off'
			},
			{
				label: 'low-res-unweighted',
				resolution: 4,
				projectionPrecision: 'half float',
				cubemapSize: 8,
				band1Intensity: 1,
				band2Intensity: 0.55,
				leakReductionMode: 'off'
			},
			{
				label: 'low-res-validity-weighted',
				resolution: 4,
				projectionPrecision: 'half float',
				cubemapSize: 8,
				band1Intensity: 1,
				band2Intensity: 0.55,
				leakReductionMode: 'normal',
				useProbeValidity: true
			},
			{
				label: 'l0-only',
				resolution: 4,
				projectionPrecision: 'half float',
				cubemapSize: 8,
				band1Intensity: 0,
				band2Intensity: 0,
				leakReductionMode: 'off'
			},
			{
				label: 'l0-l1',
				resolution: 4,
				projectionPrecision: 'half float',
				cubemapSize: 8,
				band1Intensity: 1,
				band2Intensity: 0,
				leakReductionMode: 'off'
			},
			{
				label: 'l0-l1-l2',
				resolution: 4,
				projectionPrecision: 'half float',
				cubemapSize: 8,
				band1Intensity: 1,
				band2Intensity: 0.55,
				leakReductionMode: 'off'
			},
			{
				label: 'float-linear',
				resolution: 4,
				projectionPrecision: 'float',
				cubemapSize: 8,
				band1Intensity: 1,
				band2Intensity: 0.55,
				leakReductionMode: 'off'
			},
			{
				label: 'leak-normal-constant-validity',
				resolution: 4,
				projectionPrecision: 'half float',
				cubemapSize: 8,
				band1Intensity: 1,
				band2Intensity: 0.55,
				leakReductionMode: 'normal',
				useProbeValidity: false
			},
			{
				label: 'leak-normal',
				resolution: 4,
				projectionPrecision: 'half float',
				cubemapSize: 8,
				band1Intensity: 1,
				band2Intensity: 0.55,
				leakReductionMode: 'normal',
				useProbeValidity: true
			},
			{
				label: 'resolution-6',
				resolution: 6,
				projectionPrecision: 'half float',
				cubemapSize: 8,
				band1Intensity: 1,
				band2Intensity: 0.55,
				leakReductionMode: 'off'
			},
			{
				label: 'cubemap-16',
				resolution: 4,
				projectionPrecision: 'half float',
				cubemapSize: 16,
				band1Intensity: 1,
				band2Intensity: 0.55,
				leakReductionMode: 'off'
			},
			{
				label: 'cubemap-32',
				resolution: 4,
				projectionPrecision: 'half float',
				cubemapSize: 32,
				band1Intensity: 1,
				band2Intensity: 0.55,
				leakReductionMode: 'off'
			}
		];

		const restoreState = async () => {

			_lightProbeContext.params.resolution = previousResolution;
			_lightProbeContext.params.cubemapSize = previousCubemapSize;
			_lightProbeContext.params.projectionPrecision = previousPrecision;
			_lightProbeContext.params.band1Intensity = previousBand1Intensity;
			_lightProbeContext.params.band2Intensity = previousBand2Intensity;
			_lightProbeContext.params.normalBias = previousNormalBias;
			_lightProbeContext.params.viewBias = previousViewBias;
			_lightProbeContext.params.leakReductionMode = previousLeakReductionMode;
			_lightProbeContext.params.useProbeValidity = previousUseProbeValidity;
			_lightProbeContext.params.lightingMode = previousLightingMode;
			_lightProbeContext.params.probeHelper = previousProbeHelper;
			_lightProbeContext.probeHelper.visible = previousProbeHelper;

			if ( _lightProbeContext.params.materialType !== previousMaterialType ) {

				_lightProbeContext.params.materialType = previousMaterialType;
				_lightProbeContext.updateMaterialType();

			}

			await _lightProbeContext.recreateAndBakeRequired( 'diagnostic matrix restore' );

		};

		const captureDiagnosticRow = async ( label, overrides = {} ) => {

			const colorSanity = await captureColorSanity();
			const artifactSignature = captureArtifactSignature();
			const localArtifactMetric = createLocalArtifactMetric();

			rows.push( {
				label,
				resolution: _lightProbeContext.params.resolution,
				probes: _lightProbeContext.probeGrid.totalProbes,
				cubemapSize: _lightProbeContext.params.cubemapSize,
				projectionPrecision: overrides.projectionPrecision ?? _lightProbeContext.params.projectionPrecision,
				band1Intensity: _lightProbeContext.params.band1Intensity,
				band2Intensity: _lightProbeContext.params.band2Intensity,
				probeIntensity: _lightProbeContext.params.probeIntensity,
				normalBias: _lightProbeContext.params.normalBias,
				viewBias: _lightProbeContext.params.viewBias,
				leakReductionMode: _lightProbeContext.params.leakReductionMode,
				lightingMode: _lightProbeContext.params.lightingMode,
				materialType: _lightProbeContext.params.materialType,
				precision: _lightProbeContext.probeGrid.getPrecisionInfo( _lightProbeContext.renderer ),
				sampling: _lightProbeContext.probeGrid.getSamplingInfo(),
				colorSanity,
				artifactSignature,
				localArtifactMetric,
				cubemapMs: _lightProbeContext.timings.cubemapMs,
				projectionMs: _lightProbeContext.timings.projectionMs,
				copyMs: _lightProbeContext.timings.copyMs,
				projectionBackend: _lightProbeContext.timings.projectionBackend,
				totalBakeMs: _lightProbeContext.timings.totalBakeMs,
				wallClockTotalBakeMs: _lightProbeContext.timings.wallClockTotalBakeMs,
				timingSource: _lightProbeContext.timings.timingSource,
				deterministicTimerDetected: _lightProbeContext.timings.deterministicTimerDetected,
				frameMs: _lightProbeContext.timings.frameMs
			} );

		};

		try {

			for ( const diagnosticCase of cases ) {

				_lightProbeContext.params.resolution = diagnosticCase.resolution;
				_lightProbeContext.params.cubemapSize = diagnosticCase.cubemapSize;
				_lightProbeContext.params.projectionPrecision = diagnosticCase.projectionPrecision;
				_lightProbeContext.params.band1Intensity = diagnosticCase.band1Intensity;
				_lightProbeContext.params.band2Intensity = diagnosticCase.band2Intensity;
				_lightProbeContext.params.normalBias = 0.5;
				_lightProbeContext.params.viewBias = 0;
				_lightProbeContext.params.leakReductionMode = diagnosticCase.leakReductionMode;
				_lightProbeContext.params.useProbeValidity = diagnosticCase.useProbeValidity ?? true;
				_lightProbeContext.params.lightingMode = 'probes only';
				_lightProbeContext.params.probeHelper = false;
				_lightProbeContext.probeHelper.visible = false;

				if ( _lightProbeContext.params.materialType !== 'standard' ) {

					_lightProbeContext.params.materialType = 'standard';
					_lightProbeContext.updateMaterialType();

				}

				await _lightProbeContext.recreateAndBakeRequired( `diagnostic matrix ${ diagnosticCase.label }` );

				await captureDiagnosticRow( diagnosticCase.label );

			}

		} finally {

			await restoreState();

		}

		const rowMap = new Map( rows.map( row => [ row.label, row ] ) );
		const delta = ( a, b, read ) => roundMetric( Math.abs( read( rowMap.get( a ) ) - read( rowMap.get( b ) ) ) );
		const centerLuminance = row => row.artifactSignature.center.luminance;
		const cellEdgeContrast = row => row.localArtifactMetric.cellEdgeContrast;
		const darkPixelRatio = row => row.localArtifactMetric.darkPixelRatio;

		return {
			rows,
			comparisons: {
				precision: {
					halfToFloatCenterLuminanceDelta: delta( 'l0-l1-l2', 'float-linear', centerLuminance ),
					halfToFloatCellEdgeDelta: delta( 'l0-l1-l2', 'float-linear', cellEdgeContrast )
				},
				band: {
					l0ToL1CellEdgeDelta: delta( 'l0-only', 'l0-l1', cellEdgeContrast ),
					l1ToL2CellEdgeDelta: delta( 'l0-l1', 'l0-l1-l2', cellEdgeContrast )
				},
				validity: {
					normalCustomToConstantDarkPixelRatioDelta: delta( 'leak-normal-constant-validity', 'leak-normal', darkPixelRatio ),
					normalCustomToConstantCellEdgeDelta: delta( 'leak-normal-constant-validity', 'leak-normal', cellEdgeContrast )
				},
				density: {
					resolution4To6CellEdgeDelta: delta( 'l0-l1-l2', 'resolution-6', cellEdgeContrast ),
					cubemap8To16CellEdgeDelta: delta( 'l0-l1-l2', 'cubemap-16', cellEdgeContrast ),
					cubemap16To32CellEdgeDelta: delta( 'cubemap-16', 'cubemap-32', cellEdgeContrast )
				}
			},
			restored: window.__webgpuLightProbeGridCornell.getMetrics()
		};

	};

	const runProbeArtifactRegionMatrix = async () => {

		const previousResolution = _lightProbeContext.params.resolution;
		const previousCubemapSize = _lightProbeContext.params.cubemapSize;
		const previousPrecision = _lightProbeContext.params.projectionPrecision;
		const previousBand1Intensity = _lightProbeContext.params.band1Intensity;
		const previousBand2Intensity = _lightProbeContext.params.band2Intensity;
		const previousNormalBias = _lightProbeContext.params.normalBias;
		const previousViewBias = _lightProbeContext.params.viewBias;
		const previousLeakReductionMode = _lightProbeContext.params.leakReductionMode;
		const previousUseProbeValidity = _lightProbeContext.params.useProbeValidity;
		const previousLightingMode = _lightProbeContext.params.lightingMode;
		const previousMaterialType = _lightProbeContext.params.materialType;
		const previousProbeHelper = _lightProbeContext.params.probeHelper;
		const rows = [];
		const cases = [
			{ label: 'low-res-damped', cubemapSize: 8, band1Intensity: 0.6, band2Intensity: 0.55, leakReductionMode: 'off', useProbeValidity: true },
			{ label: 'low-res-unweighted', cubemapSize: 8, band1Intensity: 1, band2Intensity: 0.55, leakReductionMode: 'off', useProbeValidity: true },
			{ label: 'low-res-validity-weighted', cubemapSize: 8, band1Intensity: 1, band2Intensity: 0.55, leakReductionMode: 'normal', useProbeValidity: true },
			{ label: 'cubemap-8-shadows-on', cubemapSize: 8, shadowsDisabledDuringBake: false },
			{ label: 'cubemap-16-shadows-on', cubemapSize: 16, shadowsDisabledDuringBake: false },
			{ label: 'cubemap-32-shadows-on', cubemapSize: 32, shadowsDisabledDuringBake: false },
			{ label: 'cubemap-8-shadows-off', cubemapSize: 8, shadowsDisabledDuringBake: true },
			{ label: 'cubemap-16-shadows-off', cubemapSize: 16, shadowsDisabledDuringBake: true },
			{ label: 'cubemap-32-shadows-off', cubemapSize: 32, shadowsDisabledDuringBake: true },
			{ label: 'cubemap-16-direct-off', cubemapSize: 16, directLightDisabledDuringBake: true },
			{ label: 'cubemap-16-panel-hidden', cubemapSize: 16, lightPanelHiddenDuringBake: true },
			{ label: 'cubemap-16-solids-hidden', cubemapSize: 16, solidGeometryHiddenDuringBake: true },
			{ label: 'cubemap-16-l0-only', cubemapSize: 16, band1Intensity: 0, band2Intensity: 0 },
			{ label: 'cubemap-16-l0-l1', cubemapSize: 16, band1Intensity: 1, band2Intensity: 0 },
			{ label: 'cubemap-32-l0-only', cubemapSize: 32, band1Intensity: 0, band2Intensity: 0 },
			{ label: 'cubemap-32-l0-l1', cubemapSize: 32, band1Intensity: 1, band2Intensity: 0 },
			{ label: 'cubemap-16-band1-0.6', cubemapSize: 16, band1Intensity: 0.6, band2Intensity: 0.55 },
			{ label: 'cubemap-32-band1-0.6', cubemapSize: 32, band1Intensity: 0.6, band2Intensity: 0.55 }
		];

		const restoreState = async () => {

			_lightProbeContext.params.resolution = previousResolution;
			_lightProbeContext.params.cubemapSize = previousCubemapSize;
			_lightProbeContext.params.projectionPrecision = previousPrecision;
			_lightProbeContext.params.band1Intensity = previousBand1Intensity;
			_lightProbeContext.params.band2Intensity = previousBand2Intensity;
			_lightProbeContext.params.normalBias = previousNormalBias;
			_lightProbeContext.params.viewBias = previousViewBias;
			_lightProbeContext.params.leakReductionMode = previousLeakReductionMode;
			_lightProbeContext.params.useProbeValidity = previousUseProbeValidity;
			_lightProbeContext.params.lightingMode = previousLightingMode;
			_lightProbeContext.params.probeHelper = previousProbeHelper;
			_lightProbeContext.probeHelper.visible = previousProbeHelper;

			if ( _lightProbeContext.params.materialType !== previousMaterialType ) {

				_lightProbeContext.params.materialType = previousMaterialType;
				_lightProbeContext.updateMaterialType();

			}

			await _lightProbeContext.recreateAndBakeRequired( 'region matrix restore' );

		};

		try {

			for ( const regionCase of cases ) {

				_lightProbeContext.params.resolution = 4;
				_lightProbeContext.params.cubemapSize = regionCase.cubemapSize;
				_lightProbeContext.params.projectionPrecision = 'half float';
				_lightProbeContext.params.band1Intensity = regionCase.band1Intensity ?? 1;
				_lightProbeContext.params.band2Intensity = regionCase.band2Intensity ?? 0.55;
				_lightProbeContext.params.normalBias = 0.5;
				_lightProbeContext.params.viewBias = 0;
				_lightProbeContext.params.leakReductionMode = regionCase.leakReductionMode ?? 'off';
				_lightProbeContext.params.useProbeValidity = regionCase.useProbeValidity ?? true;
				_lightProbeContext.params.lightingMode = 'probes only';
				_lightProbeContext.params.probeHelper = false;
				_lightProbeContext.probeHelper.visible = false;

				if ( _lightProbeContext.params.materialType !== 'standard' ) {

					_lightProbeContext.params.materialType = 'standard';
					_lightProbeContext.updateMaterialType();

				}

				await _lightProbeContext.recreateAndBakeRequired(
					`region matrix ${ regionCase.label }`,
					false,
					{
						disableShadowsDuringBake: regionCase.shadowsDisabledDuringBake,
						disableDirectLightDuringBake: regionCase.directLightDisabledDuringBake,
						hideLightPanelDuringBake: regionCase.lightPanelHiddenDuringBake,
						hideSolidGeometryDuringBake: regionCase.solidGeometryHiddenDuringBake
					}
				);

				const colorSanity = await captureColorSanity();
				const artifactSignature = captureArtifactSignature();
				const regions = captureRegionArtifactMetrics();
				const artifactPressure = createObjectArtifactPressure( regions );

				rows.push( {
					label: regionCase.label,
					resolution: _lightProbeContext.params.resolution,
					probes: _lightProbeContext.probeGrid.totalProbes,
					cubemapSize: _lightProbeContext.params.cubemapSize,
					projectionPrecision: _lightProbeContext.params.projectionPrecision,
					band1Intensity: _lightProbeContext.params.band1Intensity,
					band2Intensity: _lightProbeContext.params.band2Intensity,
					probeIntensity: _lightProbeContext.params.probeIntensity,
					normalBias: _lightProbeContext.params.normalBias,
					viewBias: _lightProbeContext.params.viewBias,
					leakReductionMode: _lightProbeContext.params.leakReductionMode,
					useProbeValidity: _lightProbeContext.params.useProbeValidity,
					shadowsDisabledDuringBake: regionCase.shadowsDisabledDuringBake === true,
					directLightDisabledDuringBake: regionCase.directLightDisabledDuringBake === true,
					lightPanelHiddenDuringBake: regionCase.lightPanelHiddenDuringBake === true,
					solidGeometryHiddenDuringBake: regionCase.solidGeometryHiddenDuringBake === true,
					lightingMode: _lightProbeContext.params.lightingMode,
					materialType: _lightProbeContext.params.materialType,
					precision: _lightProbeContext.probeGrid.getPrecisionInfo( _lightProbeContext.renderer ),
					sampling: _lightProbeContext.probeGrid.getSamplingInfo(),
					colorSanity,
					artifactSignature,
					regions,
					artifactPressure,
					bakeTexelBudget: createBakeTexelBudget(),
					sceneUpdateMs: _lightProbeContext.timings.sceneUpdateMs,
					cubemapMs: _lightProbeContext.timings.cubemapMs,
					radianceCubemapCaptureMs: _lightProbeContext.timings.radianceCubemapCaptureMs,
					projectionMs: _lightProbeContext.timings.projectionMs,
					computeShProjectionMs: _lightProbeContext.timings.computeShProjectionMs,
					copyMs: _lightProbeContext.timings.copyMs,
					atlasRepackMs: _lightProbeContext.timings.atlasRepackMs,
					visibilityCubemapMs: _lightProbeContext.timings.visibilityCubemapMs,
					distanceCubemapCaptureMs: _lightProbeContext.timings.distanceCubemapCaptureMs,
					visibilityRepackMs: _lightProbeContext.timings.visibilityRepackMs,
					verifierReadbackMs: _lightProbeContext.timings.verifierReadbackMs,
					visibilityDepthMode: _lightProbeContext.timings.visibilityDepthMode,
					projectionBackend: _lightProbeContext.timings.projectionBackend,
					totalBakeMs: _lightProbeContext.timings.totalBakeMs,
					wallClockTotalBakeMs: _lightProbeContext.timings.wallClockTotalBakeMs,
					timingSource: _lightProbeContext.timings.timingSource,
					timingSourceKind: _lightProbeContext.timings.timingSourceKind,
					gpuTimestampStatus: _lightProbeContext.timings.gpuTimestampStatus,
					timingBuckets: _lightProbeContext.timings.timingBuckets,
					deterministicTimerDetected: _lightProbeContext.timings.deterministicTimerDetected,
					frameMs: _lightProbeContext.timings.frameMs
				} );

			}

		} finally {

			await restoreState();

		}

		const rowMap = new Map( rows.map( row => [ row.label, row ] ) );
		const legacyRegionNames = [ 'leftWall', 'rightWall', 'backWall', 'ceilingEmitter', 'floorCenter', 'sphere', 'tallBox' ];
		const maxDarkPixelRatio = row => Math.max( ...legacyRegionNames.map( name => row.regions[ name ].darkPixelRatio ) );
		const minP05 = row => Math.min( ...legacyRegionNames.map( name => row.regions[ name ].luminance.p05 ) );
		const delta = ( a, b, read ) => roundMetric( Math.abs( read( rowMap.get( a ) ) - read( rowMap.get( b ) ) ) );
		const signedDelta = ( a, b, read ) => roundMetric( read( rowMap.get( b ) ) - read( rowMap.get( a ) ) );

		return {
			rows,
			comparisons: {
				lowRes: {
					tallBoxRedOverGreenGain: signedDelta(
						'low-res-damped',
						'low-res-unweighted',
						row => row.regions.tallBox.colorBias.redOverGreen
					),
					tallBoxDarkPixelRatioDelta: signedDelta(
						'low-res-damped',
						'low-res-unweighted',
						row => row.regions.tallBox.darkPixelRatio
					),
					tallBoxCellEdgeContrastDelta: signedDelta(
						'low-res-damped',
						'low-res-unweighted',
						row => row.regions.tallBox.cellEdgeContrast
					),
					sphereGreenOverRed: roundMetric( rowMap.get( 'low-res-unweighted' ).regions.sphere.colorBias.greenOverRed ),
					rightWallGreenOverRed: roundMetric( rowMap.get( 'low-res-unweighted' ).regions.rightWall.colorBias.greenOverRed )
				},
				cubemap: {
					darkPixelRatioDelta16: delta( 'cubemap-8-shadows-on', 'cubemap-16-shadows-on', maxDarkPixelRatio ),
					darkPixelRatioDelta32: delta( 'cubemap-8-shadows-on', 'cubemap-32-shadows-on', maxDarkPixelRatio ),
					minP05Delta16: delta( 'cubemap-8-shadows-on', 'cubemap-16-shadows-on', minP05 ),
					minP05Delta32: delta( 'cubemap-8-shadows-on', 'cubemap-32-shadows-on', minP05 )
				},
				shadow: {
					darkPixelRatioDelta8: delta( 'cubemap-8-shadows-on', 'cubemap-8-shadows-off', maxDarkPixelRatio ),
					darkPixelRatioDelta16: delta( 'cubemap-16-shadows-on', 'cubemap-16-shadows-off', maxDarkPixelRatio ),
					darkPixelRatioDelta32: delta( 'cubemap-32-shadows-on', 'cubemap-32-shadows-off', maxDarkPixelRatio ),
					minP05Delta16: delta( 'cubemap-16-shadows-on', 'cubemap-16-shadows-off', minP05 )
				},
				energy: {
					directOffDarkPixelRatioDelta16: delta( 'cubemap-16-shadows-on', 'cubemap-16-direct-off', maxDarkPixelRatio ),
					panelHiddenDarkPixelRatioDelta16: delta( 'cubemap-16-shadows-on', 'cubemap-16-panel-hidden', maxDarkPixelRatio ),
					directOffMinP05Delta16: delta( 'cubemap-16-shadows-on', 'cubemap-16-direct-off', minP05 ),
					panelHiddenMinP05Delta16: delta( 'cubemap-16-shadows-on', 'cubemap-16-panel-hidden', minP05 )
				},
				geometry: {
					solidsHiddenDarkPixelRatioDelta16: delta( 'cubemap-16-shadows-on', 'cubemap-16-solids-hidden', maxDarkPixelRatio ),
					solidsHiddenMinP05Delta16: delta( 'cubemap-16-shadows-on', 'cubemap-16-solids-hidden', minP05 )
				},
				band: {
					l0ToL1DarkPixelRatioDelta16: delta( 'cubemap-16-l0-only', 'cubemap-16-l0-l1', maxDarkPixelRatio ),
					l1ToL2DarkPixelRatioDelta16: delta( 'cubemap-16-l0-l1', 'cubemap-16-shadows-on', maxDarkPixelRatio ),
					l0ToL1DarkPixelRatioDelta32: delta( 'cubemap-32-l0-only', 'cubemap-32-l0-l1', maxDarkPixelRatio ),
					l1ToL2DarkPixelRatioDelta32: delta( 'cubemap-32-l0-l1', 'cubemap-32-shadows-on', maxDarkPixelRatio ),
					l0ToL1MinP05Delta16: delta( 'cubemap-16-l0-only', 'cubemap-16-l0-l1', minP05 ),
					l1ToL2MinP05Delta16: delta( 'cubemap-16-l0-l1', 'cubemap-16-shadows-on', minP05 )
				},
				damping: {
					band1DampedDarkPixelRatioDelta16: delta( 'cubemap-16-shadows-on', 'cubemap-16-band1-0.6', maxDarkPixelRatio ),
					band1DampedDarkPixelRatioDelta32: delta( 'cubemap-32-shadows-on', 'cubemap-32-band1-0.6', maxDarkPixelRatio ),
					band1DampedMinP05Delta16: delta( 'cubemap-16-shadows-on', 'cubemap-16-band1-0.6', minP05 ),
					band1DampedMinP05Delta32: delta( 'cubemap-32-shadows-on', 'cubemap-32-band1-0.6', minP05 )
				}
			},
			restored: window.__webgpuLightProbeGridCornell.getMetrics()
		};

	};

	const inspectVisibilityWeightingAtLeakReceivers = createLightProbeGridGPUVisibilityWeightingStudy( {
		_lightProbeContext,
		captureCanvasSample,
		captureLeakRegionMetrics,
		createHarnessStateSnapshot,
		createProbeVisibilitySnapshot,
		evaluateIrradianceContract,
		restoreHarnessState,
		restoreProbeVisibilitySnapshot,
		roundMetric,
		roundVector,
		setBaseCornellProbeMeshesVisible,
		setLeakFixtureMode
	} );

	const inspectLeakReceiverNormalConvention = async ( fixtureMode = 'sealed-wall' ) => {

		if ( _lightProbeContext.leakFixture === null ) {

			return {
				status: 'OPEN-NO-LEAK-FIXTURE',
				fixtureMode,
				proofBoundary: 'proof-only receiver normal convention diagnostic; no runtime constants changed.'
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
				color: {
					r: roundMetric( color.r ),
					g: roundMetric( color.g ),
					b: roundMetric( color.b )
				},
				expectedCpuColor: expectedCpu,
				expectedInvertedCpuColor: expectedInverted,
				cpuColorDistance: roundMetric( cpuDistance ),
				invertedColorDistance: roundMetric( invertedDistance ),
				closestNormalConvention: cpuDistance <= invertedDistance ? 'cpu-normal' : 'inverted-cpu-normal'
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
			let raycastFaceNormal = null;
			let rayDotFaceNormal = null;

			if ( intersections.length > 0 && intersections[ 0 ].face !== null ) {

				worldFaceNormal.copy( intersections[ 0 ].face.normal ).transformDirection( mesh.matrixWorld ).normalize();
				rayDotFaceNormal = raycaster.ray.direction.dot( worldFaceNormal );
				actualRenderedSide = rayDotFaceNormal < 0 ? 'front-face' : 'back-face';
				raycastFaceNormal = roundVector( worldFaceNormal );

			}

			return {
				label,
				materialSide: materialSideLabel( mesh.material.side ),
				receiverPosition: roundVector( receiverPosition ),
				cpuNormal: roundVector( cpuNormal ),
				invertedCpuNormal: roundVector( cpuNormal.clone().multiplyScalar( - 1 ) ),
				expectedShaderNormalWorld: roundVector( cpuNormal ),
				cameraDirection: roundVector( cameraDirection ),
				cameraDotCpuNormal: roundMetric( cameraDirection.dot( cpuNormal ) ),
				expectedVisibleFaceFromCpuNormal: cameraDirection.dot( cpuNormal ) >= 0 ? 'front-face' : 'back-face',
				actualRenderedSide,
				raycastHit: intersections.length > 0,
				raycastFaceNormal,
				rayDotFaceNormal: rayDotFaceNormal === null ? null : roundMetric( rayDotFaceNormal ),
				centerRegion: createObjectCenterScreenRegion( mesh ),
				surfaceRegion: createObjectSurfaceScreenRegion( mesh )
			};

		};

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
			const frontFaceAgreement = receivers.every( receiver =>
				receiver.expectedVisibleFaceFromCpuNormal === 'front-face' &&
				receiver.actualRenderedSide === 'front-face'
			);
			const shaderNormalAgreement = frontSideSample.leftReceiverSurface.visible === true &&
				frontSideSample.rightReceiverSurface.visible === true &&
				frontSideSample.leftReceiverSurface.closestNormalConvention === 'cpu-normal' &&
				frontSideSample.rightReceiverSurface.closestNormalConvention === 'cpu-normal';
			const backSideCulled = shaderNormalSamples
				.find( sample => sample.label === 'back-side-normalWorld' );
			const backSideCullSupported = backSideCulled.leftReceiverSurface.visible === false &&
				backSideCulled.rightReceiverSurface.visible === false;

			return {
				status: frontFaceAgreement === true && shaderNormalAgreement === true ?
					'SUPPORTED-CPU-NORMAL-MATCHES-FRONT-FACE-SHADER' :
					'OPEN-NORMAL-CONVENTION-MISMATCH',
				fixtureMode,
				proofBoundary: 'proof-only receiver normal convention diagnostic; compares CPU +Z, inverted +Z, normalWorld color sample, and actual front/back raycast side without changing runtime constants.',
				receivers,
				shaderNormalSamples,
				summary: {
					frontFaceAgreement,
					shaderNormalAgreement,
					backSideCullSupported,
					expectedShaderNormalWorldSource: 'flat PlaneGeometry local +Z transformed by world quaternion; no normal map in diagnostic receiver material',
					diagnosticConclusion: frontFaceAgreement === true && shaderNormalAgreement === true ?
						'CPU receiver normal convention matches the visible front face and normalWorld diagnostic sample; prefer investigating render-region contamination or baked SH/color contamination before runtime threshold tuning.' :
						'CPU receiver normal convention does not fully match the rendered front/back side or normalWorld sample; fix verifier/render normal convention before any DDGI-lite threshold tuning.'
				}
			};

		} finally {

			_lightProbeContext.leakFixture.leftReceiver.material = previousLeftMaterial;
			_lightProbeContext.leakFixture.rightReceiver.material = previousRightMaterial;
			restoreProbeVisibilitySnapshot( previousVisibility );
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		}

	};

	const runProbeLeakMatrix = async () => {

		const previousState = createHarnessStateSnapshot();
		const previousVisibility = createProbeVisibilitySnapshot();
		const rows = [];
		const cases = [
			{
				label: 'leak-thin-wall-unweighted',
				fixtureMode: 'thin-wall',
				leakReductionMode: 'off',
				useProbeValidity: true,
				proofRole: 'baseline'
			},
			{
				label: 'leak-thin-wall-normal-weighted',
				fixtureMode: 'thin-wall',
				leakReductionMode: 'normal',
				useProbeValidity: false,
				disableVisibilityDepth: true,
				proofRole: 'candidate-normal-weighted'
			},
			{
				label: 'leak-thin-wall-validity-weighted',
				fixtureMode: 'thin-wall',
				leakReductionMode: 'normal',
				useProbeValidity: true,
				disableVisibilityDepth: true,
				proofRole: 'candidate-validity-normal-weighted'
			},
			{
				label: 'leak-thin-wall-visibility-scaffold-disabled',
				fixtureMode: 'thin-wall',
				leakReductionMode: 'normal',
				useProbeValidity: true,
				proofRole: 'candidate-visibility-scaffold-disabled'
			},
			{
				label: 'visibility-disabled-control',
				fixtureMode: 'thin-wall',
				leakReductionMode: 'normal',
				useProbeValidity: true,
				disableVisibilityDepth: true,
				proofRole: 'visibility-disabled-control'
			},
			{
				label: 'leak-sealed-wall-unweighted',
				fixtureMode: 'sealed-wall',
				leakReductionMode: 'off',
				useProbeValidity: true,
				proofRole: 'sealed-promotion-baseline',
				promotionStatus: 'CANDIDATE-FIXTURE'
			},
			{
				label: 'leak-sealed-wall-validity-weighted',
				fixtureMode: 'sealed-wall',
				leakReductionMode: 'normal',
				useProbeValidity: true,
				disableVisibilityDepth: true,
				proofRole: 'sealed-promotion-scalar-validity-control',
				promotionStatus: 'CANDIDATE-FIXTURE'
			},
			{
				label: 'leak-sealed-wall-visibility-scaffold-disabled',
				fixtureMode: 'sealed-wall',
				leakReductionMode: 'normal',
				useProbeValidity: true,
				proofRole: 'sealed-promotion-visibility-scaffold-disabled',
				promotionStatus: 'CANDIDATE-FIXTURE'
			},
			{
				label: 'leak-zero-thickness-unweighted',
				fixtureMode: 'zero-thickness',
				leakReductionMode: 'off',
				useProbeValidity: true,
				proofRole: 'negative-control-baseline',
				negativeControlStatus: 'OPEN'
			},
			{
				label: 'leak-zero-thickness-validity-weighted',
				fixtureMode: 'zero-thickness',
				leakReductionMode: 'normal',
				useProbeValidity: true,
				disableVisibilityDepth: true,
				proofRole: 'negative-control-candidate',
				negativeControlStatus: 'OPEN'
			},
			{
				label: 'leak-zero-thickness-visibility-scaffold-disabled',
				fixtureMode: 'zero-thickness',
				leakReductionMode: 'normal',
				useProbeValidity: true,
				proofRole: 'negative-control-visibility-scaffold-disabled',
				negativeControlStatus: 'OPEN'
			}
		];

		const restoreState = async () => {

			restoreProbeVisibilitySnapshot( previousVisibility );
			await restoreHarnessState( previousState, 'leak matrix restore' );

		};

		try {

			for ( const leakCase of cases ) {

				setBaseCornellProbeMeshesVisible( false );
				setLeakFixtureMode( leakCase.fixtureMode );

				_lightProbeContext.params.resolution = 4;
				_lightProbeContext.params.cubemapSize = 8;
				_lightProbeContext.params.projectionPrecision = 'half float';
				_lightProbeContext.params.band1Intensity = 1;
				_lightProbeContext.params.band2Intensity = 0.55;
				_lightProbeContext.params.normalBias = 0.5;
				_lightProbeContext.params.viewBias = 0;
				_lightProbeContext.params.leakReductionMode = leakCase.leakReductionMode;
				_lightProbeContext.params.useProbeValidity = leakCase.useProbeValidity;
				_lightProbeContext.params.lightingMode = 'probes only';
				_lightProbeContext.params.probeHelper = false;
				_lightProbeContext.probeHelper.visible = false;

				if ( _lightProbeContext.params.materialType !== 'standard' ) {

					_lightProbeContext.params.materialType = 'standard';
					_lightProbeContext.updateMaterialType();

				}

				setLeakFixtureMode( leakCase.fixtureMode );

				await _lightProbeContext.recreateAndBakeRequired( `leak matrix ${ leakCase.label }` );

				const guardedVisibilityProofMode = leakCase.leakReductionMode === 'normal' && leakCase.disableVisibilityDepth !== true ?
					'guarded' :
					'off';

				if ( typeof _lightProbeContext.probeGrid._setGuardedVisibilityProofMode === 'function' ) {

					_lightProbeContext.probeGrid._setGuardedVisibilityProofMode( guardedVisibilityProofMode );
					_lightProbeContext.syncProbeGridBindings();

				}

				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				const leakMetrics = captureLeakRegionMetrics();
				const preToneLeakMetrics = captureLeakRegionMetricsWithRendererMapping( {
					mode: 'pre-tone-linear-output-masked-visible-pixels',
					toneMapping: THREE.NoToneMapping,
					toneMappingLabel: 'NoToneMapping',
					outputColorSpace: THREE.LinearSRGBColorSpace
				} );

				rows.push( {
					label: leakCase.label,
					proofRole: leakCase.proofRole,
					fixtureMode: leakCase.fixtureMode,
					negativeControlStatus: leakCase.negativeControlStatus ?? 'not-applicable',
					promotionStatus: leakCase.promotionStatus ?? 'not-applicable',
					resolution: _lightProbeContext.params.resolution,
					probes: _lightProbeContext.probeGrid.totalProbes,
					cubemapSize: _lightProbeContext.params.cubemapSize,
					projectionPrecision: _lightProbeContext.params.projectionPrecision,
					band1Intensity: _lightProbeContext.params.band1Intensity,
					band2Intensity: _lightProbeContext.params.band2Intensity,
					probeIntensity: _lightProbeContext.params.probeIntensity,
					normalBias: _lightProbeContext.params.normalBias,
					viewBias: _lightProbeContext.params.viewBias,
					leakReductionMode: _lightProbeContext.params.leakReductionMode,
					useProbeValidity: _lightProbeContext.params.useProbeValidity,
					visibilityDepthEnabled: guardedVisibilityProofMode === 'guarded',
					guardedVisibilityProofMode,
					lightingMode: _lightProbeContext.params.lightingMode,
					materialType: _lightProbeContext.params.materialType,
					precision: _lightProbeContext.probeGrid.getPrecisionInfo( _lightProbeContext.renderer ),
					sampling: _lightProbeContext.probeGrid.getSamplingInfo(),
					visibilityDepth: readVisibilityDepthInfo(),
					occupancy: _lightProbeContext.collectProbeOccupancy( _lightProbeContext.params.resolution ),
					leakMetrics,
					preToneLeakMetrics,
					sceneUpdateMs: _lightProbeContext.timings.sceneUpdateMs,
					cubemapMs: _lightProbeContext.timings.cubemapMs,
					radianceCubemapCaptureMs: _lightProbeContext.timings.radianceCubemapCaptureMs,
					projectionMs: _lightProbeContext.timings.projectionMs,
					computeShProjectionMs: _lightProbeContext.timings.computeShProjectionMs,
					copyMs: _lightProbeContext.timings.copyMs,
					atlasRepackMs: _lightProbeContext.timings.atlasRepackMs,
					visibilityCubemapMs: _lightProbeContext.timings.visibilityCubemapMs,
					distanceCubemapCaptureMs: _lightProbeContext.timings.distanceCubemapCaptureMs,
					visibilityRepackMs: _lightProbeContext.timings.visibilityRepackMs,
					verifierReadbackMs: _lightProbeContext.timings.verifierReadbackMs,
					visibilityDepthMode: _lightProbeContext.timings.visibilityDepthMode,
					projectionBackend: _lightProbeContext.timings.projectionBackend,
					totalBakeMs: _lightProbeContext.timings.totalBakeMs,
					wallClockTotalBakeMs: _lightProbeContext.timings.wallClockTotalBakeMs,
					timingSource: _lightProbeContext.timings.timingSource,
					timingSourceKind: _lightProbeContext.timings.timingSourceKind,
					gpuTimestampStatus: _lightProbeContext.timings.gpuTimestampStatus,
					timingBuckets: _lightProbeContext.timings.timingBuckets,
					deterministicTimerDetected: _lightProbeContext.timings.deterministicTimerDetected,
					frameMs: _lightProbeContext.timings.frameMs
				} );

			}

		} finally {

			await restoreState();

		}

		const rowMap = new Map( rows.map( row => [ row.label, row ] ) );
		const readWrongSide = row => row.leakMetrics.wrongSideColorRatio;
		const readCenterWrongSide = row => row.leakMetrics.centerWrongSideColorRatio ?? row.leakMetrics.wrongSideColorRatio;
		const readSurfaceWrongSide = row => row.leakMetrics.surfaceWrongSideColorRatio ?? readCenterWrongSide( row );
		const readMaskedWrongSide = row => row.leakMetrics.maskedWrongSideColorRatio ?? readSurfaceWrongSide( row );
		const readPreToneMaskedWrongSide = row => row.preToneLeakMetrics.metrics.maskedWrongSideColorRatio ?? readMaskedWrongSide( row );
		const readCorrectBounce = row => row.leakMetrics.correctBounceRatio;
		const readMaskedCorrectBounce = row => row.leakMetrics.maskedCorrectBounceRatio ?? readCorrectBounce( row );
		const readPreToneMaskedCorrectBounce = row => row.preToneLeakMetrics.metrics.maskedCorrectBounceRatio ?? readMaskedCorrectBounce( row );
		const readDarkPixelRatio = row => row.leakMetrics.darkPixelRatio;
		const readCellEdgeContrast = row => row.leakMetrics.cellEdgeContrast;
		const signedDelta = ( a, b, read ) => roundMetric( read( rowMap.get( b ) ) - read( rowMap.get( a ) ) );
		const ratio = ( a, b, read ) => roundMetric( read( rowMap.get( b ) ) / Math.max( read( rowMap.get( a ) ), 0.0001 ) );
		const improvementRatio = ( a, b, read ) => roundMetric( ( read( rowMap.get( a ) ) - read( rowMap.get( b ) ) ) / Math.max( read( rowMap.get( a ) ), 0.0001 ) );
		const sealedWrongSideImprovement = improvementRatio( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readWrongSide );
		const sealedCorrectBouncePreservation = ratio( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readCorrectBounce );
		const sealedPreToneMaskedWrongSideImprovement = improvementRatio( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readPreToneMaskedWrongSide );
		const sealedPreToneMaskedCorrectBouncePreservation = ratio( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readPreToneMaskedCorrectBounce );
		const sealedMaskedWrongSideImprovement = improvementRatio( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readMaskedWrongSide );
		const sealedPromotionStatus = sealedWrongSideImprovement >= 0.05 &&
			sealedMaskedWrongSideImprovement >= 0.05 &&
			sealedCorrectBouncePreservation >= 0.9 ?
			'SUPPORTED-BY-SEALED-FIXTURE' :
			'OPEN';
		const sealedLinearPromotionStatus = sealedPreToneMaskedWrongSideImprovement >= 0.05 && sealedPreToneMaskedCorrectBouncePreservation >= 0.9 ?
			'SUPPORTED-BY-PRE-TONE-MASKED-FIXTURE' :
			'OPEN';

		return {
			rows,
			comparisons: {
				thinWall: {
					normalWrongSideColorRatioDelta: signedDelta( 'leak-thin-wall-unweighted', 'leak-thin-wall-normal-weighted', readWrongSide ),
					validityWrongSideColorRatioDelta: signedDelta( 'leak-thin-wall-unweighted', 'leak-thin-wall-validity-weighted', readWrongSide ),
					normalCorrectBouncePreservation: ratio( 'leak-thin-wall-unweighted', 'leak-thin-wall-normal-weighted', readCorrectBounce ),
					validityCorrectBouncePreservation: ratio( 'leak-thin-wall-unweighted', 'leak-thin-wall-validity-weighted', readCorrectBounce ),
					validityDarkPixelRatioDelta: signedDelta( 'leak-thin-wall-unweighted', 'leak-thin-wall-validity-weighted', readDarkPixelRatio ),
					validityCellEdgeContrastDelta: signedDelta( 'leak-thin-wall-unweighted', 'leak-thin-wall-validity-weighted', readCellEdgeContrast ),
					visibility: {
						wrongSide: {
							delta: signedDelta( 'leak-thin-wall-validity-weighted', 'leak-thin-wall-visibility-scaffold-disabled', readWrongSide )
						},
						correctBounce: {
							preservation: ratio( 'leak-thin-wall-validity-weighted', 'leak-thin-wall-visibility-scaffold-disabled', readCorrectBounce )
						},
						disabledControl: {
							delta: signedDelta( 'leak-thin-wall-validity-weighted', 'visibility-disabled-control', readWrongSide )
						}
					}
				},
				sealedWall: {
					status: sealedPromotionStatus,
					linearPromotionStatus: sealedLinearPromotionStatus,
					presentationMetricMode: 'tone-mapped-canvas-ratio-legacy',
					linearPromotionMetricMode: 'pre-tone-linear-output-masked-visible-pixels',
					fixtureBoundary: 'Sealed divider spans the probe-grid depth so this row tests moment visibility without the known finite-wall front-edge bypass.',
					validityWrongSideColorRatioDelta: signedDelta( 'leak-sealed-wall-unweighted', 'leak-sealed-wall-validity-weighted', readWrongSide ),
					validityCorrectBouncePreservation: ratio( 'leak-sealed-wall-unweighted', 'leak-sealed-wall-validity-weighted', readCorrectBounce ),
					visibility: {
						wrongSide: {
							delta: signedDelta( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readWrongSide ),
							improvement: sealedWrongSideImprovement
						},
						centerWrongSide: {
							delta: signedDelta( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readCenterWrongSide ),
							improvement: improvementRatio( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readCenterWrongSide )
						},
						surfaceWrongSide: {
							delta: signedDelta( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readSurfaceWrongSide ),
							improvement: improvementRatio( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readSurfaceWrongSide )
						},
						maskedWrongSide: {
							delta: signedDelta( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readMaskedWrongSide ),
							improvement: sealedMaskedWrongSideImprovement
						},
						preToneMaskedWrongSide: {
							delta: signedDelta( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readPreToneMaskedWrongSide ),
							improvement: sealedPreToneMaskedWrongSideImprovement
						},
						correctBounce: {
							preservation: sealedCorrectBouncePreservation
						},
						maskedCorrectBounce: {
							preservation: ratio( 'leak-sealed-wall-validity-weighted', 'leak-sealed-wall-visibility-scaffold-disabled', readMaskedCorrectBounce )
						},
						preToneMaskedCorrectBounce: {
							preservation: sealedPreToneMaskedCorrectBouncePreservation
						}
					}
				},
				zeroThickness: {
					status: 'OPEN',
					validityWrongSideColorRatioDelta: signedDelta( 'leak-zero-thickness-unweighted', 'leak-zero-thickness-validity-weighted', readWrongSide ),
					validityCorrectBouncePreservation: ratio( 'leak-zero-thickness-unweighted', 'leak-zero-thickness-validity-weighted', readCorrectBounce ),
					visibility: {
						wrongSide: {
							delta: signedDelta( 'leak-zero-thickness-validity-weighted', 'leak-zero-thickness-visibility-scaffold-disabled', readWrongSide )
						},
						correctBounce: {
							preservation: ratio( 'leak-zero-thickness-validity-weighted', 'leak-zero-thickness-visibility-scaffold-disabled', readCorrectBounce )
						}
					}
				}
			},
			restored: {
				...window.__webgpuLightProbeGridCornell.getMetrics(),
				leakFixtureVisible: _lightProbeContext.leakFixture !== null && _lightProbeContext.leakFixture.group.visible === true
			}
		};

	};

	window.__webgpuLightProbeGridCornell = {
		getMetrics: getProbeHarnessMetrics,
		setResolution: async ( value ) => {

			_lightProbeContext.params.resolution = value;
			await _lightProbeContext.recreateAndBake();

		},
		setCubemapSize: async ( value ) => {

			_lightProbeContext.params.cubemapSize = value;
			await _lightProbeContext.recreateAndBake();

		},
		setPrecision: async ( value ) => {

			_lightProbeContext.params.projectionPrecision = value;
			await _lightProbeContext.recreateAndBake();

		},
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
		setLeakReductionMode: async ( value ) => {

			_lightProbeContext.params.leakReductionMode = value;
			await _lightProbeContext.recreateAndBake();

		},
		inspectAddonContract: () => {

			const contractGrid = new LightProbeGridGPU(
				new THREE.Vector3( - 1, - 2, - 3 ),
				new THREE.Vector3( 4, 5, 6 ),
				{
					resolution: 2,
					cubemapSize: 4,
					projectionPrecision: 'half float',
					renderer: _lightProbeContext.renderer
				}
			);
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

			const contractGrid = new LightProbeGridGPU(
				new THREE.Vector3( - 1, - 2, - 3 ),
				new THREE.Vector3( 4, 5, 6 ),
				{
					resolution: 2,
					cubemapSize: 4,
					projectionPrecision: 'half float',
					renderer: _lightProbeContext.renderer
				}
			);
			const first = new THREE.Vector3();
			const last = new THREE.Vector3();
			let invalidConstructorResolutionRejected = false;
			let invalidConstructorResolutionMessage = '';
			let invalidSetOptionsResolutionRejected = false;
			let invalidSetOptionsResolutionMessage = '';

			contractGrid.getProbePosition( 0, first );
			contractGrid.getProbePosition( contractGrid.totalProbes - 1, last );

			try {

				new LightProbeGridGPU(
					new THREE.Vector3( - 1, - 2, - 3 ),
					new THREE.Vector3( 4, 5, 6 ),
					{
						resolution: 1,
						cubemapSize: 4,
						projectionPrecision: 'half float',
						renderer: _lightProbeContext.renderer
					}
				);

			} catch ( error ) {

				invalidConstructorResolutionRejected = true;
				invalidConstructorResolutionMessage = error instanceof Error ? error.message : String( error );

			}

			try {

				contractGrid.setOptions( { resolution: 1 }, _lightProbeContext.renderer );

			} catch ( error ) {

				invalidSetOptionsResolutionRejected = true;
				invalidSetOptionsResolutionMessage = error instanceof Error ? error.message : String( error );

			}

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
				invalidConstructorResolutionRejected,
				invalidConstructorResolutionMessage,
				invalidSetOptionsResolutionRejected,
				invalidSetOptionsResolutionMessage
			};

		},
		inspectSamplingControls: () => {

			const defaultGrid = new LightProbeGridGPU(
				new THREE.Vector3( - 1, - 1, - 1 ),
				new THREE.Vector3( 1, 1, 1 ),
				{
					resolution: 2,
					cubemapSize: 4,
					projectionPrecision: 'half float',
					renderer: _lightProbeContext.renderer
				}
			);
			const configuredGrid = new LightProbeGridGPU(
				new THREE.Vector3( - 1, - 1, - 1 ),
				new THREE.Vector3( 1, 1, 1 ),
				{
					resolution: 2,
					cubemapSize: 4,
					projectionPrecision: 'half float',
					normalBias: 0.75,
					viewBias: 0.25,
					leakReductionMode: 'normal',
					probeValidity: new Float32Array( [ 1, 1, 1, 1, 1, 1, 1, 0 ] ),
					renderer: _lightProbeContext.renderer
				}
			);
			let invalidLeakReductionModeRejected = false;
			let invalidLeakReductionModeMessage = '';

			try {

				configuredGrid.setOptions( { leakReductionMode: 'distance' }, _lightProbeContext.renderer );

			} catch ( error ) {

				invalidLeakReductionModeRejected = true;
				invalidLeakReductionModeMessage = error instanceof Error ? error.message : String( error );

			}

			const result = {
				defaultSampling: defaultGrid.getSamplingInfo(),
				configuredSampling: configuredGrid.getSamplingInfo(),
				invalidLeakReductionModeRejected,
				invalidLeakReductionModeMessage
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

			try {

				_lightProbeContext.params.leakReductionMode = 'off';
				await _lightProbeContext.recreateAndBakeRequired( 'leak reduction off' );
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				offResult = {
					sampling: _lightProbeContext.probeGrid.getSamplingInfo(),
					colorSanity: await captureColorSanity()
				};

				_lightProbeContext.params.leakReductionMode = 'normal';
				await _lightProbeContext.recreateAndBakeRequired( 'leak reduction normal' );
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				normalResult = {
					sampling: _lightProbeContext.probeGrid.getSamplingInfo(),
					colorSanity: await captureColorSanity()
				};

			} finally {

				_lightProbeContext.params.leakReductionMode = previousLeakReductionMode;
				await _lightProbeContext.recreateAndBakeRequired( 'leak reduction restore' );

			}

			return {
				off: offResult,
				normal: normalResult
			};

		},
		runArtifactMatrix: runProbeDiagnosticMatrix,
		runProbeDiagnosticMatrix,
		runProbeArtifactRegionMatrix,
		captureLeakRegionMetrics,
		inspectVisibilityWeightingAtLeakReceivers,
		inspectLeakReceiverNormalConvention,
		runProbeLeakMatrix,
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
					timings: nextTimings,
					precision: _lightProbeContext.probeGrid.getPrecisionInfo( _lightProbeContext.renderer )
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
