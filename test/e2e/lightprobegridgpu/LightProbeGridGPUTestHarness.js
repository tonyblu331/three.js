import * as THREE from 'three/webgpu';
import { attribute, float, floor, Fn, normalWorld, uniform, uv, vec4 } from 'three/tsl';

import { LightProbeGridGPU } from '../../../examples/jsm/lighting/LightProbeGridGPU.js';
import { createLightProbeGridGPUVisibilityWeightingStudy } from './LightProbeGridGPUVisibilityWeightingStudy.js';
import {
	readLightProbeGridGPUCoefficientTarget,
	readLightProbeGridGPUComputeCoefficientTexture,
	readLightProbeGridGPUDecodedPackedAtlasPixel,
	readLightProbeGridGPUPackedAtlasPixel,
	readLightProbeGridGPUProbeCoefficients,
	readLightProbeGridGPUVisibilityMoment,
	readLightProbeGridGPUVisibilityMomentPixel
} from './LightProbeGridGPUReadback.js';
import {
	ATLAS_PADDING,
	PACKED_SH_COEFFICIENT_LAYOUT,
	PACKED_SH_TEXTURES,
	RECEIVER_BOUNDARY_SELECTION_THRESHOLD,
	SH_COEFFICIENTS,
	VISIBILITY_MIN_VARIANCE
} from '../../../examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUConstants.js';
import {
	getLightProbeGridGPUAtlasDepth,
	getLightProbeGridGPUPackedAtlasBaseLayer,
	getLightProbeGridGPUPackedAtlasCenterSampleZ,
	getLightProbeGridGPUPackedAtlasLayer,
	getLightProbeGridGPUPaddedAtlasSlices,
	getLightProbeGridGPUProbeCoord,
	getLightProbeGridGPUProbeIndex
} from '../../../examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlas.js';
import {
	colorMaxDelta,
	evaluateIrradianceContract,
	maxCoefficientDelta,
	projectSyntheticCube,
	projectSyntheticCubeFragmentCoefficientPath
} from './LightProbeGridGPUCpuShMath.js';
import {
	createLightProbeGridGPUProbeOwnershipAssignment
} from './LightProbeGridGPUProbeOwnership.js';
import {
	createLightProbeGridGPULocalCellPlacement
} from './LightProbeGridGPULocalCellPlacement.js';
import {
	createLightProbeGridGPUPlacementAuthoring
} from '../../../examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js';
import {
	createLightProbeGridGPUProofReceiverBuffers,
	createLightProbeGridGPUProofReceiverScaffoldFacts
} from '../lightprobegrid-gpu-proof-receiver-scaffold.js';

const PROOF_RATIO_DENOMINATOR_EPSILON = 0.0001;
const PROOF_GEOMETRY_THIN_AXIS_EPSILON = 0.0001;
const PROOF_GEOMETRY_RANGE_EPSILON_FACTOR = 0.0001;
const PROOF_GEOMETRY_RANGE_MIN_EPSILON = 0.0001;
const PROOF_COMPUTE_CANDIDATE_DELTA_TOLERANCE = 0.0001;
const PROOF_COMPUTE_PARITY_CONTRACT_TOLERANCE = 0.0001;
const PROOF_LAYER_COMPATIBILITY_DELTA_EPSILON = 0.001;
const PROOF_DEBUG_RATIO_DELTA_EPSILON = 0.001;

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

	const createProofReceiverBufferScaffoldFacts = () => {

		const buffers = createLightProbeGridGPUProofReceiverBuffers( [ {
			position: [ 0, 0, 0 ],
			normal: [ 0, 1, 0 ],
			layerMask: 1,
			expectedRegion: 0,
			referenceIndirect: [ 0, 0, 0 ]
		} ] );

		return {
			receiverCount: buffers.receiverCount,
			receiverStrideLanes: buffers.receiverStrideLanes,
			resultStrideLanes: buffers.resultStrideLanes,
			receiverBytes: buffers.receiverBytes,
			resultBytes: buffers.resultBytes,
			receiverStorageBuffer: buffers.receiverAttribute.isStorageBufferAttribute === true,
			resultStorageBuffer: buffers.resultAttribute.isStorageBufferAttribute === true
		};

	};

	const createProofPolicyFacts = () => {

		const proofReceiverScaffold = createLightProbeGridGPUProofReceiverScaffoldFacts();

		return {
			policyId: 'lightprobegridgpu-proof-harness-semantic-epsilons',
			ratioDenominatorEpsilon: PROOF_RATIO_DENOMINATOR_EPSILON,
			geometryThinAxisEpsilon: PROOF_GEOMETRY_THIN_AXIS_EPSILON,
			geometryRangeEpsilonFactor: PROOF_GEOMETRY_RANGE_EPSILON_FACTOR,
			geometryRangeMinEpsilon: PROOF_GEOMETRY_RANGE_MIN_EPSILON,
			computeCandidateDeltaTolerance: PROOF_COMPUTE_CANDIDATE_DELTA_TOLERANCE,
			computeParityContractTolerance: PROOF_COMPUTE_PARITY_CONTRACT_TOLERANCE,
			layerCompatibilityDeltaEpsilon: PROOF_LAYER_COMPATIBILITY_DELTA_EPSILON,
			debugRatioDeltaEpsilon: PROOF_DEBUG_RATIO_DELTA_EPSILON,
			proofReceiverScaffold: {
				...proofReceiverScaffold,
				bufferScaffold: createProofReceiverBufferScaffoldFacts()
			}
		};

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
			leftRedOverGreen: roundMetric( left.r / Math.max( left.g, PROOF_RATIO_DENOMINATOR_EPSILON ) ),
			rightGreenOverRed: roundMetric( right.g / Math.max( right.r, PROOF_RATIO_DENOMINATOR_EPSILON ) ),
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
		const thinZ = Math.abs( box.max.z - box.min.z ) < PROOF_GEOMETRY_THIN_AXIS_EPSILON;
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
		const computeCandidateTolerance = PROOF_COMPUTE_CANDIDATE_DELTA_TOLERANCE;
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
				tolerance: PROOF_COMPUTE_PARITY_CONTRACT_TOLERANCE
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
			active: info.active === true,
			runtimeActive: info.runtimeActive === true,
			mode: info.mode ?? 'unavailable',
			resolution: info.resolution ?? 0,
			texturePresent: info.texturePresent === true,
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

		if ( target === null || isActiveMomentVisibilityDepthInfo( info ) === false || resolution <= 0 || textureDepth <= 0 ) {

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
				redOverGreen: roundMetric( color.r / Math.max( color.g, PROOF_RATIO_DENOMINATOR_EPSILON ) ),
				greenOverRed: roundMetric( color.g / Math.max( color.r, PROOF_RATIO_DENOMINATOR_EPSILON ) )
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
				redOverGreen: roundMetric( color.r / Math.max( color.g, PROOF_RATIO_DENOMINATOR_EPSILON ) ),
				greenOverRed: roundMetric( color.g / Math.max( color.r, PROOF_RATIO_DENOMINATOR_EPSILON ) )
			}
		};

	};

	const captureLeakReceiverMaskedMetrics = () => {

		if ( _lightProbeContext.leakFixture === null ) return null;

		const colorCanvasSample = captureCanvasSample();
		const previousBackground = _lightProbeContext.scene.background;
		const previousMaterials = [];
		const leftMaskMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, side: THREE.DoubleSide, toneMapped: false } );
		const rightMaskMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00, side: THREE.DoubleSide, toneMapped: false } );
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
		const leftMaskedCorrectBounceRatio = maskedSamples === null ? null :
			maskedSamples.leftReceiverMasked.colorBias.redOverGreen;
		const rightMaskedCorrectBounceRatio = maskedSamples === null ? null :
			maskedSamples.rightReceiverMasked.colorBias.greenOverRed;

		return {
			wrongSideColorRatio: roundMetric( wrongSideColorRatio ),
			surfaceWrongSideColorRatio: surfaceWrongSideColorRatio === null ? null : roundMetric( surfaceWrongSideColorRatio ),
			surfaceCenterWrongSideColorRatio: surfaceCenterWrongSideColorRatio === null ? null : roundMetric( surfaceCenterWrongSideColorRatio ),
			nearDividerEdgeWrongSideColorRatio: nearDividerEdgeWrongSideColorRatio === null ? null : roundMetric( nearDividerEdgeWrongSideColorRatio ),
			maskedWrongSideColorRatio: maskedWrongSideColorRatio === null ? null : roundMetric( maskedWrongSideColorRatio ),
			maskedVisiblePixelCount,
			maskedVisiblePixelRatio,
			maskedLeftVisiblePixelCount: maskedSamples === null ? null : maskedSamples.leftReceiverMasked.selectedPixelCount,
			maskedRightVisiblePixelCount: maskedSamples === null ? null : maskedSamples.rightReceiverMasked.selectedPixelCount,
			maskedLeftVisiblePixelRatio: maskedSamples === null ? null : maskedSamples.leftReceiverMasked.selectedPixelRatio,
			maskedRightVisiblePixelRatio: maskedSamples === null ? null : maskedSamples.rightReceiverMasked.selectedPixelRatio,
			maskedLeftCorrectBounceRatio: leftMaskedCorrectBounceRatio === null ? null : roundMetric( leftMaskedCorrectBounceRatio ),
			maskedRightCorrectBounceRatio: rightMaskedCorrectBounceRatio === null ? null : roundMetric( rightMaskedCorrectBounceRatio ),
			correctBounceRatio: roundMetric( correctBounceRatio ),
			maskedCorrectBounceRatio: maskedCorrectBounceRatio === null ? null : roundMetric( maskedCorrectBounceRatio )
		};

	};

	const RECEIVER_BOUNDARY_CLASS_ATTRIBUTE = 'boundaryClass';

	const createReceiverBoundaryDescriptor = ( receiverBoundaryLayerMask, options = {} ) => ( {
		receiverBoundaryLayerMask,
		receiverBoundaryWeight: options.rawBoundaryWeight === true ?
			createAuthoredReceiverBoundaryBlendWeightNode() :
			createAuthoredReceiverBoundaryWeightNode(),
		receiverBoundaryMode: options.receiverBoundaryMode
	} );

	const AUTHORED_RECEIVER_BOUNDARY_SOURCE = Object.freeze( {
		policyId: 'authored-receiver-boundary-source',
		sourceType: 'tsl-geometry-attribute-node',
		classifier: 'saturated-binary-class',
		attributeName: RECEIVER_BOUNDARY_CLASS_ATTRIBUTE,
		attributeItemSize: 1,
		defaultWeight: 0,
		activeWeight: 1,
		selectionThreshold: RECEIVER_BOUNDARY_SELECTION_THRESHOLD,
		sampleScope: 'receiver-surface-authored-attribute',
		interpolationPolicy: 'vertex-authored-varying',
		usesIrradianceAttenuation: false,
		proofBoundary: 'source-facts-only'
	} );

	const createAuthoredReceiverBoundaryWeightNode = () => attribute( RECEIVER_BOUNDARY_CLASS_ATTRIBUTE, 'float' ).greaterThan( RECEIVER_BOUNDARY_SELECTION_THRESHOLD ).select(
		float( AUTHORED_RECEIVER_BOUNDARY_SOURCE.activeWeight ),
		float( AUTHORED_RECEIVER_BOUNDARY_SOURCE.defaultWeight )
	);

	const createAuthoredReceiverBoundaryBlendWeightNode = () => attribute( RECEIVER_BOUNDARY_CLASS_ATTRIBUTE, 'float' ).clamp( 0, 1 );

	const applyAuthoredReceiverBoundaryClassAttribute = ( receiver, receiverSide, activeValue = AUTHORED_RECEIVER_BOUNDARY_SOURCE.activeWeight ) => {

		if ( receiver === undefined || receiver.geometry === undefined ) return;

		const geometry = receiver.geometry;
		const position = geometry.getAttribute( 'position' );
		if ( position === undefined ) return;

		const values = new Float32Array( position.count );
		let minX = Infinity;
		let maxX = - Infinity;

		for ( let i = 0; i < position.count; i ++ ) {

			const x = position.getX( i );
			minX = Math.min( minX, x );
			maxX = Math.max( maxX, x );

		}

		for ( let i = 0; i < position.count; i ++ ) {

			const x = position.getX( i );
			values[ i ] = ( receiverSide === 'right' ? x <= minX : x >= maxX ) ? activeValue : AUTHORED_RECEIVER_BOUNDARY_SOURCE.defaultWeight;

		}

		geometry.setAttribute( RECEIVER_BOUNDARY_CLASS_ATTRIBUTE, new THREE.Float32BufferAttribute( values, AUTHORED_RECEIVER_BOUNDARY_SOURCE.attributeItemSize ) );

	};

	const clearAuthoredReceiverBoundaryClassAttribute = receiver => {

		const position = receiver?.geometry?.getAttribute( 'position' );
		if ( position === undefined ) return;

		receiver.geometry.setAttribute(
			RECEIVER_BOUNDARY_CLASS_ATTRIBUTE,
			new THREE.Float32BufferAttribute( new Float32Array( position.count ), AUTHORED_RECEIVER_BOUNDARY_SOURCE.attributeItemSize )
		);

	};

	const ensureAuthoredReceiverBoundaryClassAttributes = () => {

		if ( _lightProbeContext.leakFixture === null ) return;

		applyAuthoredReceiverBoundaryClassAttribute( _lightProbeContext.leakFixture.leftReceiver, 'left' );
		applyAuthoredReceiverBoundaryClassAttribute( _lightProbeContext.leakFixture.rightReceiver, 'right' );

	};

	const withAuthoredReceiverBoundaryClassVariant = ( variant, callback ) => {

		if ( _lightProbeContext.leakFixture === null ) return callback();

		ensureAuthoredReceiverBoundaryClassAttributes();

		if ( variant === 'left-only' ) {

			clearAuthoredReceiverBoundaryClassAttribute( _lightProbeContext.leakFixture.rightReceiver );

		} else if ( variant === 'right-only' ) {

			clearAuthoredReceiverBoundaryClassAttribute( _lightProbeContext.leakFixture.leftReceiver );

		}

		try {

			return callback();

		} finally {

			ensureAuthoredReceiverBoundaryClassAttributes();

		}

	};

	const withAuthoredReceiverBoundaryClassStrength = ( activeValue, callback ) => {

		if ( _lightProbeContext.leakFixture === null ) return callback();

		applyAuthoredReceiverBoundaryClassAttribute( _lightProbeContext.leakFixture.leftReceiver, 'left', activeValue );
		applyAuthoredReceiverBoundaryClassAttribute( _lightProbeContext.leakFixture.rightReceiver, 'right', activeValue );

		try {

			return callback();

		} finally {

			ensureAuthoredReceiverBoundaryClassAttributes();

		}

	};

	const createReceiverBoundaryClassAttributeFacts = receiver => {

		const boundaryClass = receiver?.geometry?.getAttribute( RECEIVER_BOUNDARY_CLASS_ATTRIBUTE );
		if ( boundaryClass === undefined ) return null;

		let activeVertexCount = 0;

		for ( let i = 0; i < boundaryClass.count; i ++ ) {

			if ( boundaryClass.getX( i ) >= AUTHORED_RECEIVER_BOUNDARY_SOURCE.selectionThreshold ) activeVertexCount ++;

		}

		return {
			vertexCount: boundaryClass.count,
			activeVertexCount,
			activeVertexRatio: roundMetric( activeVertexCount / boundaryClass.count )
		};

	};

	const createAuthoredReceiverBoundarySourceFacts = () => {

		ensureAuthoredReceiverBoundaryClassAttributes();

		return {
			...AUTHORED_RECEIVER_BOUNDARY_SOURCE,
			geometryAttributeCoverage: {
				leftReceiver: createReceiverBoundaryClassAttributeFacts( _lightProbeContext.leakFixture?.leftReceiver ),
				rightReceiver: createReceiverBoundaryClassAttributeFacts( _lightProbeContext.leakFixture?.rightReceiver )
			}
		};

	};

	const createProbeMaskAttributionFacts = () => {

		const probeLayerMasks = _lightProbeContext.probeGrid?.probeLayerMaskSource ?? null;
		const resolution = _lightProbeContext.params.resolution;
		const totalProbes = resolution * resolution * resolution;
		const defaultMask = 1;
		const leftBoundaryMask = 2;
		const rightBoundaryMask = 4;
		const probePosition = new THREE.Vector3();
		const receiverPosition = new THREE.Vector3();
		const getProbePosition = ( index, target ) => {

			const ix = index % resolution;
			const iy = Math.floor( index / resolution ) % resolution;
			const iz = Math.floor( index / ( resolution * resolution ) );

			target.set(
				_lightProbeContext.gridMin.x + ix * ( _lightProbeContext.gridMax.x - _lightProbeContext.gridMin.x ) / ( resolution - 1 ),
				_lightProbeContext.gridMin.y + iy * ( _lightProbeContext.gridMax.y - _lightProbeContext.gridMin.y ) / ( resolution - 1 ),
				_lightProbeContext.gridMin.z + iz * ( _lightProbeContext.gridMax.z - _lightProbeContext.gridMin.z ) / ( resolution - 1 )
			);

		};
		const countOverlap = mask => {

			let count = 0;

			for ( let i = 0; i < totalProbes; i ++ ) {

				const layerMask = probeLayerMasks === null ? defaultMask : probeLayerMasks[ i ];
				if ( ( layerMask & mask ) !== 0 ) count ++;

			}

			return count;

		};
		const createNearestReceiverSummary = ( receiver, receiverMask ) => {

			receiver.getWorldPosition( receiverPosition );
			const probes = [];

			for ( let i = 0; i < totalProbes; i ++ ) {

				getProbePosition( i, probePosition );
				probes.push( {
					index: i,
					distanceSq: probePosition.distanceToSquared( receiverPosition ),
					layerMask: probeLayerMasks === null ? defaultMask : probeLayerMasks[ i ]
				} );

			}

			const nearest = probes.sort( ( a, b ) => a.distanceSq - b.distanceSq ).slice( 0, 8 );
			const defaultOverlapCount = nearest.filter( probe => ( probe.layerMask & defaultMask ) !== 0 ).length;
			const boundaryOverlapCount = nearest.filter( probe => ( probe.layerMask & receiverMask ) !== 0 ).length;

			return {
				sampleCount: nearest.length,
				defaultOverlapCount,
				boundaryOverlapCount,
				boundaryToDefaultOverlapRatio: roundMetric( boundaryOverlapCount / Math.max( defaultOverlapCount, 1 ) ),
				uniqueMasks: [ ...new Set( nearest.map( probe => probe.layerMask ) ) ].sort( ( a, b ) => a - b )
			};

		};

		if ( _lightProbeContext.leakFixture === null ) return null;

		return {
			attributionPolicy: 'cpu-probe-layer-mask-overlap',
			source: probeLayerMasks === null ? 'default-mask' : 'probeLayerMaskSource',
			defaultMask,
			leftBoundaryMask,
			rightBoundaryMask,
			totalProbes,
			defaultOverlapCount: countOverlap( defaultMask ),
			leftBoundaryOverlapCount: countOverlap( leftBoundaryMask ),
			rightBoundaryOverlapCount: countOverlap( rightBoundaryMask ),
			leftReceiverNearest: createNearestReceiverSummary( _lightProbeContext.leakFixture.leftReceiver, leftBoundaryMask ),
			rightReceiverNearest: createNearestReceiverSummary( _lightProbeContext.leakFixture.rightReceiver, rightBoundaryMask )
		};

	};

	const createExclusiveProbeOwnershipAssignment = () => {

		const divider = _lightProbeContext.getActiveLeakDivider();
		const dividerX = divider !== null && divider !== undefined ? divider.position.x : - 0.8667;
		const defaultLayer = 1;
		const leftLayer = 2;
		const rightLayer = 4;

		return createLightProbeGridGPUProbeOwnershipAssignment( {
			min: _lightProbeContext.gridMin,
			max: _lightProbeContext.gridMax,
			resolution: _lightProbeContext.params.resolution,
			defaultMask: defaultLayer,
			layerRules: [
				{ name: 'cornell-left-exclusive', layerMask: leftLayer, ownershipMask: leftLayer, defaultCompatible: false },
				{ name: 'cornell-right-exclusive', layerMask: rightLayer, ownershipMask: rightLayer, defaultCompatible: false }
			],
			regionRules: [
				{
					name: 'cornell-left-exclusive-region',
					layerRuleName: 'cornell-left-exclusive',
					box: {
						min: new THREE.Vector3( _lightProbeContext.gridMin.x, _lightProbeContext.gridMin.y, _lightProbeContext.gridMin.z ),
						max: new THREE.Vector3( dividerX, _lightProbeContext.gridMax.y, _lightProbeContext.gridMax.z )
					}
				},
				{
					name: 'cornell-right-exclusive-region',
					layerRuleName: 'cornell-right-exclusive',
					box: {
						min: new THREE.Vector3( dividerX, _lightProbeContext.gridMin.y, _lightProbeContext.gridMin.z ),
						max: new THREE.Vector3( _lightProbeContext.gridMax.x, _lightProbeContext.gridMax.y, _lightProbeContext.gridMax.z )
					}
				}
			]
		} );

	};

	const createMultiClassBoundaryProbeOwnershipAssignment = ( options = {} ) => {

		const divider = _lightProbeContext.getActiveLeakDivider();
		const dividerX = divider !== null && divider !== undefined ? divider.position.x : - 0.8667;
		const resolution = _lightProbeContext.params.resolution;
		const spacingX = ( _lightProbeContext.gridMax.x - _lightProbeContext.gridMin.x ) / Math.max( resolution - 1, 1 );
		const overlapBoundarySublayers = options.overlapBoundarySublayers === true;
		const boundaryHalfWidth = spacingX * ( overlapBoundarySublayers ? 1.1 : 0.25 );
		const minX = _lightProbeContext.gridMin.x;
		const maxX = _lightProbeContext.gridMax.x;
		const epsilonX = Math.max(
			( maxX - minX ) * PROOF_GEOMETRY_RANGE_EPSILON_FACTOR,
			PROOF_GEOMETRY_RANGE_MIN_EPSILON
		);
		const clampX = value => Math.min( maxX, Math.max( minX, value ) );
		const createNonEmptyXRange = ( minValue, maxValue ) => {

			let rangeMin = clampX( minValue );
			let rangeMax = clampX( maxValue );

			if ( rangeMax > rangeMin ) return { min: rangeMin, max: rangeMax };

			if ( rangeMin <= minX + epsilonX ) {

				rangeMin = minX;
				rangeMax = Math.min( maxX, minX + epsilonX );

			} else if ( rangeMax >= maxX - epsilonX ) {

				rangeMin = Math.max( minX, maxX - epsilonX );
				rangeMax = maxX;

			} else {

				rangeMax = Math.min( maxX, rangeMin + epsilonX );

			}

			return { min: rangeMin, max: rangeMax };

		};
		const leftInteriorRange = createNonEmptyXRange( minX, overlapBoundarySublayers ? dividerX : dividerX - boundaryHalfWidth );
		const leftBoundaryRange = createNonEmptyXRange( dividerX - boundaryHalfWidth, dividerX );
		const rightBoundaryRange = createNonEmptyXRange( dividerX, dividerX + boundaryHalfWidth );
		const rightInteriorRange = createNonEmptyXRange( overlapBoundarySublayers ? dividerX : dividerX + boundaryHalfWidth, maxX );
		const defaultLayer = 1;
		const leftInteriorLayer = 2;
		const rightInteriorLayer = 4;
		const leftBoundaryLayer = 8;
		const rightBoundaryLayer = 16;
		const rulePrefix = overlapBoundarySublayers ? 'cornell-overlap' : 'cornell';

		return createLightProbeGridGPUProbeOwnershipAssignment( {
			min: _lightProbeContext.gridMin,
			max: _lightProbeContext.gridMax,
			resolution,
			defaultMask: defaultLayer,
			layerRules: [
				{ name: `${ rulePrefix }-left-interior`, layerMask: leftInteriorLayer, ownershipMask: leftInteriorLayer, defaultCompatible: true },
				{ name: `${ rulePrefix }-right-interior`, layerMask: rightInteriorLayer, ownershipMask: rightInteriorLayer, defaultCompatible: true },
				{ name: `${ rulePrefix }-left-boundary`, layerMask: leftBoundaryLayer, ownershipMask: leftBoundaryLayer, defaultCompatible: true },
				{ name: `${ rulePrefix }-right-boundary`, layerMask: rightBoundaryLayer, ownershipMask: rightBoundaryLayer, defaultCompatible: true }
			],
			regionRules: [
				{
					name: `${ rulePrefix }-left-interior-region`,
					layerRuleName: `${ rulePrefix }-left-interior`,
					box: {
						min: new THREE.Vector3( leftInteriorRange.min, _lightProbeContext.gridMin.y, _lightProbeContext.gridMin.z ),
						max: new THREE.Vector3( leftInteriorRange.max, _lightProbeContext.gridMax.y, _lightProbeContext.gridMax.z )
					}
				},
				{
					name: `${ rulePrefix }-left-boundary-region`,
					layerRuleName: `${ rulePrefix }-left-boundary`,
					box: {
						min: new THREE.Vector3( leftBoundaryRange.min, _lightProbeContext.gridMin.y, _lightProbeContext.gridMin.z ),
						max: new THREE.Vector3( leftBoundaryRange.max, _lightProbeContext.gridMax.y, _lightProbeContext.gridMax.z )
					}
				},
				{
					name: `${ rulePrefix }-right-boundary-region`,
					layerRuleName: `${ rulePrefix }-right-boundary`,
					box: {
						min: new THREE.Vector3( rightBoundaryRange.min, _lightProbeContext.gridMin.y, _lightProbeContext.gridMin.z ),
						max: new THREE.Vector3( rightBoundaryRange.max, _lightProbeContext.gridMax.y, _lightProbeContext.gridMax.z )
					}
				},
				{
					name: `${ rulePrefix }-right-interior-region`,
					layerRuleName: `${ rulePrefix }-right-interior`,
					box: {
						min: new THREE.Vector3( rightInteriorRange.min, _lightProbeContext.gridMin.y, _lightProbeContext.gridMin.z ),
						max: new THREE.Vector3( rightInteriorRange.max, _lightProbeContext.gridMax.y, _lightProbeContext.gridMax.z )
					}
				}
			]
		} );

	};

	const captureReceiverOwnershipShapeCandidateFacts = () => {

		if ( _lightProbeContext.leakFixture === null || _lightProbeContext.probeGrid === null ) return null;

		const originalProbeLayerMasks = _lightProbeContext.probeGrid.probeLayerMaskSource;
		const exclusiveAssignment = createExclusiveProbeOwnershipAssignment();
		const summarizeMassFacts = massFacts => ( {
			leftCompatibilityChangedSlotCount: massFacts.neighborAttribution.leftCompatibilityChangedSlotCount,
			leftCompatibilityChangedContributingSlotCount: massFacts.neighborAttribution.leftCompatibilityChangedContributingSlotCount,
			rightCompatibilityChangedSlotCount: massFacts.neighborAttribution.rightCompatibilityChangedSlotCount,
			rightCompatibilityChangedContributingSlotCount: massFacts.neighborAttribution.rightCompatibilityChangedContributingSlotCount,
			scalarLeftBoundaryToDefaultRatio: massFacts.scalarWeight.leftBoundaryToDefaultRatio,
			scalarRightBoundaryToDefaultRatio: massFacts.scalarWeight.rightBoundaryToDefaultRatio,
			visibilityLeftBoundaryToDefaultRatio: massFacts.visibilityWeight.leftBoundaryToDefaultRatio,
			visibilityRightBoundaryToDefaultRatio: massFacts.visibilityWeight.rightBoundaryToDefaultRatio
		} );

		try {

			_lightProbeContext.probeGrid.setOptions( {
				probeLayerMasks: exclusiveAssignment.probeLayerMasks
			}, _lightProbeContext.renderer );

			return {
				attributionPolicy: 'exclusive-region-probe-ownership-candidate',
				proofBoundary: 'probe-meta-mask-attribution-only',
				assignmentFacts: exclusiveAssignment.assignmentFacts,
				...summarizeMassFacts( captureReceiverSamplingMassAttributionFacts() )
			};

		} finally {

			_lightProbeContext.probeGrid.setOptions( {
				probeLayerMasks: originalProbeLayerMasks
			}, _lightProbeContext.renderer );

		}

	};

	const captureReceiverMultiClassOwnershipCandidateFacts = () => {

		if ( _lightProbeContext.leakFixture === null || _lightProbeContext.probeGrid === null ) return null;

		const originalProbeLayerMasks = _lightProbeContext.probeGrid.probeLayerMaskSource;
		const summarizeCandidate = ( label, massFacts ) => ( {
			label,
			...summarizeBoundaryMaskMassFacts( massFacts ),
			scalarCombinedBoundaryToDefaultRatio: massFacts.scalarWeight.boundaryToDefaultRatio,
			visibilityCombinedBoundaryToDefaultRatio: massFacts.visibilityWeight.boundaryToDefaultRatio,
			finalIrradianceBoundaryToDefaultRatio: massFacts.finalIrradiance.boundaryToDefaultRatio,
			leftCoefficientContrast: createCoefficientContrastSideFacts( massFacts, 'left' ),
			rightCoefficientContrast: createCoefficientContrastSideFacts( massFacts, 'right' ),
			candidateVerdict: massFacts.finalIrradiance.boundaryToDefaultRatio > 0 ?
				'candidate-preserves-boundary-irradiance' :
				'rejected-overpruned-boundary-irradiance'
		} );
		const captureVariant = ( variantLabel, assignmentOptions ) => {

			const assignment = createMultiClassBoundaryProbeOwnershipAssignment( assignmentOptions );

			_lightProbeContext.probeGrid.setOptions( {
				probeLayerMasks: assignment.probeLayerMasks
			}, _lightProbeContext.renderer );

			const sameSideFacts = captureReceiverSamplingMassAttributionFacts( {
				leftBoundaryLayerMask: 8,
				rightBoundaryLayerMask: 16,
				includeIrradianceDebug: true,
				includeNeighborIrradianceDebug: true
			} );
			const crossSideFacts = captureReceiverSamplingMassAttributionFacts( {
				leftBoundaryLayerMask: 16,
				rightBoundaryLayerMask: 8,
				includeIrradianceDebug: true,
				includeNeighborIrradianceDebug: true
			} );

			return {
				variantLabel,
				assignmentFacts: assignment.assignmentFacts,
				candidates: [
					summarizeCandidate( `${ variantLabel }-same-side-boundary-sublayers`, sameSideFacts ),
					summarizeCandidate( `${ variantLabel }-cross-side-boundary-sublayers`, crossSideFacts )
				]
			};

		};

		try {

			return {
				attributionPolicy: 'multi-class-boundary-probe-ownership-candidate',
				proofBoundary: 'probe-meta-mask-and-neighbor-sh-attribution-only',
				defaultEquivalencePolicy: 'all-assigned-probes-keep-default-layer-bit',
				candidateShape: 'default-compatible-side-boundary-sublayers',
				variants: [
					captureVariant( 'strict', { overlapBoundarySublayers: false } ),
					captureVariant( 'overlap', { overlapBoundarySublayers: true } )
				]
			};

		} finally {

			_lightProbeContext.probeGrid.setOptions( {
				probeLayerMasks: originalProbeLayerMasks
			}, _lightProbeContext.renderer );

		}

	};

	const summarizeBoundaryMaskMassFacts = massFacts => ( {
		leftBoundaryLayerMask: massFacts.leftBoundaryLayerMask,
		rightBoundaryLayerMask: massFacts.rightBoundaryLayerMask,
		leftCompatibilityChangedSlotCount: massFacts.neighborAttribution.leftCompatibilityChangedSlotCount,
		leftCompatibilityChangedContributingSlotCount: massFacts.neighborAttribution.leftCompatibilityChangedContributingSlotCount,
		rightCompatibilityChangedSlotCount: massFacts.neighborAttribution.rightCompatibilityChangedSlotCount,
		rightCompatibilityChangedContributingSlotCount: massFacts.neighborAttribution.rightCompatibilityChangedContributingSlotCount,
		scalarLeftBoundaryToDefaultRatio: massFacts.scalarWeight.leftBoundaryToDefaultRatio,
		scalarRightBoundaryToDefaultRatio: massFacts.scalarWeight.rightBoundaryToDefaultRatio,
		visibilityLeftBoundaryToDefaultRatio: massFacts.visibilityWeight.leftBoundaryToDefaultRatio,
		visibilityRightBoundaryToDefaultRatio: massFacts.visibilityWeight.rightBoundaryToDefaultRatio
	} );

	const summarizeCoefficientSideNeighborContrast = ( massFacts, side ) => {

		const neighbors = massFacts.neighborAttribution.neighbors;
		const hasChangedCompatibility = neighbor =>
			Math.abs( neighbor.layerCompatibility[ `${ side }Delta` ] ) > PROOF_LAYER_COMPATIBILITY_DELTA_EPSILON;
		const hasContributingWeight = neighbor =>
			neighbor.baseWeight[ `${ side }Default` ] > PROOF_RATIO_DENOMINATOR_EPSILON ||
			neighbor.baseWeight[ `${ side }Boundary` ] > PROOF_RATIO_DENOMINATOR_EPSILON;
		const irradianceMean = selected => roundMetric( selected.reduce( ( sum, neighbor ) =>
			sum + neighbor.irradiance[ `${ side }Default` ], 0 ) / Math.max( selected.length, 1 ) );
		const contributing = neighbors.filter( hasContributingWeight );
		const changed = contributing.filter( hasChangedCompatibility );
		const stable = contributing.filter( neighbor => hasChangedCompatibility( neighbor ) === false );
		const changedMean = irradianceMean( changed );
		const stableMean = irradianceMean( stable );

		return {
			changedSlotCount: changed.length,
			stableSlotCount: stable.length,
			changedMean,
			stableMean,
			changedToStableRatio: stable.length > 0 ?
				roundMetric( changedMean / Math.max( stableMean, PROOF_RATIO_DENOMINATOR_EPSILON ) ) :
				null
		};

	};

	const createCoefficientContrastSideFacts = ( massFacts, side ) => {

		const contrast = summarizeCoefficientSideNeighborContrast( massFacts, side );

		return {
			changedContributingSlotCount: contrast.changedSlotCount,
			stableContributingSlotCount: contrast.stableSlotCount,
			changedCoefficientIrradianceMean: contrast.changedMean,
			stableCoefficientIrradianceMean: contrast.stableMean,
			changedToStableCoefficientIrradianceRatio: contrast.changedToStableRatio,
			coefficientMaskingVerdict: contrast.stableSlotCount > 0 ?
				'candidate-has-stable-coefficient-comparator' :
				'rejected-no-stable-coefficient-comparator'
		};

	};

	const createSupportSetSideFacts = ( massFacts, side ) => {

		const weightEpsilon = PROOF_RATIO_DENOMINATOR_EPSILON;
		const neighbors = massFacts.neighborAttribution.neighbors;
		const probeLayerMasks = _lightProbeContext.probeGrid.probeLayerMaskSource;
		const readMetric = ( neighbor, metric, variant ) => neighbor[ metric ][ `${ side }${ variant }` ];
		const hasChangedCompatibility = neighbor =>
			Math.abs( neighbor.layerCompatibility[ `${ side }Delta` ] ) > PROOF_LAYER_COMPATIBILITY_DELTA_EPSILON;
		const sumMetric = ( selected, metric, variant ) => roundMetric( selected.reduce( ( sum, neighbor ) =>
			sum + readMetric( neighbor, metric, variant ), 0 ) );
		const readProbeMask = ( neighbor, variant ) => {

			const probeIndex = neighbor[ `${ side }${ variant }ProbeIndex` ];
			return probeLayerMasks?.[ probeIndex ] ?? 0;

		};
		const hasSameProbeIndex = neighbor =>
			neighbor[ `${ side }DefaultProbeIndex` ] === neighbor[ `${ side }BoundaryProbeIndex` ];
		const createProbeMaskSummary = ( selected, variant ) => {

			const masks = selected.map( neighbor => readProbeMask( neighbor, variant ) );
			const uniqueMasks = new Set( masks );

			return {
				uniqueMaskCount: uniqueMasks.size,
				maskMin: masks.length > 0 ? Math.min( ...masks ) : null,
				maskMax: masks.length > 0 ? Math.max( ...masks ) : null
			};

		};

		const changed = neighbors.filter( hasChangedCompatibility );
		const stable = neighbors.filter( neighbor => hasChangedCompatibility( neighbor ) === false );
		const contributing = neighbors.filter( neighbor =>
			readMetric( neighbor, 'baseWeight', 'Default' ) > weightEpsilon ||
			readMetric( neighbor, 'baseWeight', 'Boundary' ) > weightEpsilon );
		const changedContributing = changed.filter( neighbor =>
			readMetric( neighbor, 'baseWeight', 'Default' ) > weightEpsilon ||
			readMetric( neighbor, 'baseWeight', 'Boundary' ) > weightEpsilon );
		const zeroBaseChanged = changed.filter( neighbor =>
			readMetric( neighbor, 'baseWeight', 'Default' ) <= weightEpsilon &&
			readMetric( neighbor, 'baseWeight', 'Boundary' ) <= weightEpsilon );
		const overprunedChanged = changed.filter( neighbor =>
			(
				readMetric( neighbor, 'baseWeight', 'Default' ) > weightEpsilon ||
				readMetric( neighbor, 'visibilityWeight', 'Default' ) > weightEpsilon
			) &&
			readMetric( neighbor, 'baseWeight', 'Boundary' ) <= weightEpsilon &&
			readMetric( neighbor, 'visibilityWeight', 'Boundary' ) <= weightEpsilon );
		const defaultBaseTotal = sumMetric( neighbors, 'baseWeight', 'Default' );
		const boundaryBaseTotal = sumMetric( neighbors, 'baseWeight', 'Boundary' );
		const defaultVisibilityTotal = sumMetric( neighbors, 'visibilityWeight', 'Default' );
		const boundaryVisibilityTotal = sumMetric( neighbors, 'visibilityWeight', 'Boundary' );
		const changedDefaultBase = sumMetric( changed, 'baseWeight', 'Default' );
		const changedBoundaryBase = sumMetric( changed, 'baseWeight', 'Boundary' );
		const changedDefaultVisibility = sumMetric( changed, 'visibilityWeight', 'Default' );
		const changedBoundaryVisibility = sumMetric( changed, 'visibilityWeight', 'Boundary' );

		return {
			changedSlotCount: changed.length,
			stableSlotCount: stable.length,
			contributingSlotCount: contributing.length,
			changedContributingSlotCount: changedContributing.length,
			zeroBaseChangedSlotCount: zeroBaseChanged.length,
			overprunedChangedSlotCount: overprunedChanged.length,
			sameProbeIndexSlotCount: neighbors.filter( hasSameProbeIndex ).length,
			changedProbeIndexSlotCount: neighbors.filter( neighbor => hasSameProbeIndex( neighbor ) === false ).length,
			changedContributingSameProbeIndexSlotCount: changedContributing.filter( hasSameProbeIndex ).length,
			changedContributingChangedProbeIndexSlotCount: changedContributing.filter( neighbor => hasSameProbeIndex( neighbor ) === false ).length,
			defaultBaseTotal,
			boundaryBaseTotal,
			defaultVisibilityTotal,
			boundaryVisibilityTotal,
			changedDefaultBaseShare: roundMetric( changedDefaultBase / Math.max( defaultBaseTotal, weightEpsilon ) ),
			changedBoundaryBaseShare: roundMetric( changedBoundaryBase / Math.max( boundaryBaseTotal, weightEpsilon ) ),
			changedDefaultVisibilityShare: roundMetric( changedDefaultVisibility / Math.max( defaultVisibilityTotal, weightEpsilon ) ),
			changedBoundaryVisibilityShare: roundMetric( changedBoundaryVisibility / Math.max( boundaryVisibilityTotal, weightEpsilon ) ),
			defaultProbeMasks: createProbeMaskSummary( changed, 'Default' ),
			boundaryProbeMasks: createProbeMaskSummary( changed, 'Boundary' )
		};

	};

	const captureReceiverCoefficientContrastCandidateFacts = () => {

		const massFacts = captureReceiverSamplingMassAttributionFacts( {
			leftBoundaryLayerMask: 4,
			rightBoundaryLayerMask: 2,
			rawBoundaryWeight: true,
			receiverBoundaryMode: 'blend',
			includeNeighborIrradianceDebug: true
		} );

		if ( massFacts === null ) return null;

		const left = createCoefficientContrastSideFacts( massFacts, 'left' );
		const right = createCoefficientContrastSideFacts( massFacts, 'right' );
		const crossSideChangedCoefficientIrradianceRatio = roundMetric(
			right.changedCoefficientIrradianceMean / Math.max(
				left.changedCoefficientIrradianceMean,
				PROOF_RATIO_DENOMINATOR_EPSILON
			)
		);

		return {
			attributionPolicy: 'coefficient-side-contrast-availability-candidate',
			proofBoundary: 'neighbor-sh-coefficient-attribution-only',
			candidateShape: 'stable-contributing-coefficient-mask',
			nextCandidateShape: 'multi-class-ownership-or-relocation',
			leftBoundaryLayerMask: 4,
			rightBoundaryLayerMask: 2,
			receiverBoundaryMode: 'blend',
			rawBoundaryWeight: true,
			left,
			right,
			multiClassOwnershipFeasibility: {
				contrastPolicy: 'cross-side-changed-coefficient-irradiance',
				leftChangedCoefficientIrradianceMean: left.changedCoefficientIrradianceMean,
				rightChangedCoefficientIrradianceMean: right.changedCoefficientIrradianceMean,
				crossSideChangedCoefficientIrradianceRatio,
				crossSideChangedCoefficientIrradianceDelta: roundMetric(
					right.changedCoefficientIrradianceMean - left.changedCoefficientIrradianceMean
				),
				candidateVerdict: left.changedContributingSlotCount > 0 &&
					right.changedContributingSlotCount > 0 &&
					Math.abs( crossSideChangedCoefficientIrradianceRatio - 1 ) > 0.01 ?
					'candidate-has-cross-side-coefficient-contrast' :
					'rejected-no-cross-side-coefficient-contrast'
			}
		};

	};

	const captureReceiverBoundaryMaskAlignmentCandidateFacts = () => {

		const massFacts = captureReceiverSamplingMassAttributionFacts( {
			leftBoundaryLayerMask: 4,
			rightBoundaryLayerMask: 2
		} );

		if ( massFacts === null ) return null;

		return {
			attributionPolicy: 'swapped-boundary-mask-alignment-candidate',
			proofBoundary: 'receiver-mask-attribution-only',
			...summarizeBoundaryMaskMassFacts( massFacts )
		};

	};

	const captureReceiverBoundaryMaskAlignmentRenderFacts = ( options = {} ) => {

		if ( _lightProbeContext.leakFixture === null || _lightProbeContext.probeGrid === null ) return null;

		const leftBoundaryLayerMask = options.leftBoundaryLayerMask ?? 4;
		const rightBoundaryLayerMask = options.rightBoundaryLayerMask ?? 2;
		const boundaryDescriptorOptions = {
			rawBoundaryWeight: options.rawBoundaryWeight === true,
			receiverBoundaryMode: options.receiverBoundaryMode
		};
		const leftMaterial = _lightProbeContext.leakFixture.leftReceiver.material;
		const rightMaterial = _lightProbeContext.leakFixture.rightReceiver.material;
		const previousLeftLightsNode = leftMaterial.lightsNode;
		const previousRightLightsNode = rightMaterial.lightsNode;

		try {

			ensureAuthoredReceiverBoundaryClassAttributes();

			leftMaterial.lightsNode = _lightProbeContext.probeGrid.createLightsNode(
				[ _lightProbeContext.directLight, _lightProbeContext.ambientLight ],
				createReceiverBoundaryDescriptor( leftBoundaryLayerMask, boundaryDescriptorOptions )
			);
			rightMaterial.lightsNode = _lightProbeContext.probeGrid.createLightsNode(
				[ _lightProbeContext.directLight, _lightProbeContext.ambientLight ],
				createReceiverBoundaryDescriptor( rightBoundaryLayerMask, boundaryDescriptorOptions )
			);
			leftMaterial.needsUpdate = true;
			rightMaterial.needsUpdate = true;
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			const leakMetrics = captureLeakRegionMetrics();
			const maskedSamples = captureLeakReceiverMaskedMetrics();
			const preToneLeakMetrics = captureLeakRegionMetricsWithRendererMapping( {
				mode: 'pre-tone-linear-output-masked-visible-pixels',
				toneMapping: THREE.NoToneMapping,
				toneMappingLabel: 'NoToneMapping',
				outputColorSpace: THREE.LinearSRGBColorSpace
			} );
			const leftMaskedWrongSideColorRatio = maskedSamples === null ? null :
				maskedSamples.leftReceiverMasked.colorBias.greenOverRed;
			const rightMaskedWrongSideColorRatio = maskedSamples === null ? null :
				maskedSamples.rightReceiverMasked.colorBias.redOverGreen;
			const leftMaskedCorrectBounceRatio = maskedSamples === null ? null :
				maskedSamples.leftReceiverMasked.colorBias.redOverGreen;
			const rightMaskedCorrectBounceRatio = maskedSamples === null ? null :
				maskedSamples.rightReceiverMasked.colorBias.greenOverRed;

			return {
				attributionPolicy: options.attributionPolicy ?? 'swapped-boundary-mask-render-candidate',
				proofBoundary: 'rendered-ratio-attribution-only',
				...( options.fixtureId !== undefined ? { fixtureId: options.fixtureId } : {} ),
				...( options.fixtureFamily !== undefined ? { fixtureFamily: options.fixtureFamily } : {} ),
				leftBoundaryLayerMask,
				rightBoundaryLayerMask,
				receiverBoundaryMode: options.receiverBoundaryMode ?? 'select',
				rawBoundaryWeight: options.rawBoundaryWeight === true,
				maskedWrongSideColorRatio: leakMetrics.maskedWrongSideColorRatio,
				maskedVisiblePixelCount: leakMetrics.maskedVisiblePixelCount,
				maskedVisiblePixelRatio: leakMetrics.maskedVisiblePixelRatio,
				maskedLeftVisiblePixelCount: leakMetrics.maskedLeftVisiblePixelCount,
				maskedRightVisiblePixelCount: leakMetrics.maskedRightVisiblePixelCount,
				leftMaskedWrongSideColorRatio,
				rightMaskedWrongSideColorRatio,
				preToneMaskedWrongSideColorRatio: preToneLeakMetrics.metrics.maskedWrongSideColorRatio,
				preToneMaskedVisiblePixelCount: preToneLeakMetrics.metrics.maskedVisiblePixelCount,
				preToneMaskedVisiblePixelRatio: preToneLeakMetrics.metrics.maskedVisiblePixelRatio,
				preToneMaskedLeftVisiblePixelCount: preToneLeakMetrics.metrics.maskedLeftVisiblePixelCount,
				preToneMaskedRightVisiblePixelCount: preToneLeakMetrics.metrics.maskedRightVisiblePixelCount,
				preToneMaskedCorrectBounceRatio: preToneLeakMetrics.metrics.maskedCorrectBounceRatio,
				leftMaskedCorrectBounceRatio,
				rightMaskedCorrectBounceRatio,
				correctBounceRatio: leakMetrics.correctBounceRatio
			};

		} finally {

			leftMaterial.lightsNode = previousLeftLightsNode;
			rightMaterial.lightsNode = previousRightLightsNode;
			leftMaterial.needsUpdate = true;
			rightMaterial.needsUpdate = true;
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		}

	};

	const captureReceiverLocalizedBoundaryMaskCandidateFacts = () => {

		const candidates = [
			{ label: 'left-boundary-swapped', leftBoundaryLayerMask: 4, rightBoundaryLayerMask: 4 },
			{ label: 'right-boundary-swapped', leftBoundaryLayerMask: 2, rightBoundaryLayerMask: 2 }
		];

		return {
			attributionPolicy: 'localized-boundary-mask-candidates',
			proofBoundary: 'receiver-mask-attribution-only',
			candidates: candidates.map( candidate => {

				const massFacts = captureReceiverSamplingMassAttributionFacts( {
					leftBoundaryLayerMask: candidate.leftBoundaryLayerMask,
					rightBoundaryLayerMask: candidate.rightBoundaryLayerMask
				} );
				const renderFacts = captureReceiverBoundaryMaskAlignmentRenderFacts( {
					attributionPolicy: 'localized-boundary-mask-render-candidate',
					leftBoundaryLayerMask: candidate.leftBoundaryLayerMask,
					rightBoundaryLayerMask: candidate.rightBoundaryLayerMask
				} );

				return {
					label: candidate.label,
					...summarizeBoundaryMaskMassFacts( massFacts ),
					renderMaskedWrongSideColorRatio: renderFacts.maskedWrongSideColorRatio,
					renderPreToneMaskedWrongSideColorRatio: renderFacts.preToneMaskedWrongSideColorRatio,
					renderPreToneMaskedCorrectBounceRatio: renderFacts.preToneMaskedCorrectBounceRatio,
					renderCorrectBounceRatio: renderFacts.correctBounceRatio
				};

			} )
		};

	};

	const captureReceiverBoundaryClassPrecisionCandidateFacts = () => {

		const candidates = [
			{ label: 'left-boundary-class-only', classVariant: 'left-only' },
			{ label: 'right-boundary-class-only', classVariant: 'right-only' }
		];

		return {
			attributionPolicy: 'localized-boundary-class-candidates',
			proofBoundary: 'receiver-class-attribution-only',
			candidates: candidates.map( candidate => withAuthoredReceiverBoundaryClassVariant( candidate.classVariant, () => {

				const massFacts = captureReceiverSamplingMassAttributionFacts();
				const renderFacts = captureReceiverBoundaryMaskAlignmentRenderFacts( {
					attributionPolicy: 'localized-boundary-class-render-candidate',
					leftBoundaryLayerMask: 2,
					rightBoundaryLayerMask: 4
				} );

				return {
					label: candidate.label,
					classVariant: candidate.classVariant,
					...summarizeBoundaryMaskMassFacts( massFacts ),
					renderMaskedWrongSideColorRatio: renderFacts.maskedWrongSideColorRatio,
					renderPreToneMaskedWrongSideColorRatio: renderFacts.preToneMaskedWrongSideColorRatio,
					renderPreToneMaskedCorrectBounceRatio: renderFacts.preToneMaskedCorrectBounceRatio,
					renderCorrectBounceRatio: renderFacts.correctBounceRatio
				};

			} ) )
		};

	};

	const captureReceiverBoundaryClassStrengthCandidateFacts = () => {

		const candidates = [ 0.6, 0.75 ];

		return {
			attributionPolicy: 'partial-boundary-class-strength-candidates',
			proofBoundary: 'receiver-class-attribution-only',
			candidates: candidates.map( activeValue => withAuthoredReceiverBoundaryClassStrength( activeValue, () => {

				const massFacts = captureReceiverSamplingMassAttributionFacts();
				const renderFacts = captureReceiverBoundaryMaskAlignmentRenderFacts( {
					attributionPolicy: 'partial-boundary-class-strength-render-candidate',
					leftBoundaryLayerMask: 2,
					rightBoundaryLayerMask: 4
				} );

				return {
					label: `boundary-class-active-${ activeValue }`,
					activeValue,
					...summarizeBoundaryMaskMassFacts( massFacts ),
					renderMaskedWrongSideColorRatio: renderFacts.maskedWrongSideColorRatio,
					renderPreToneMaskedWrongSideColorRatio: renderFacts.preToneMaskedWrongSideColorRatio,
					renderPreToneMaskedCorrectBounceRatio: renderFacts.preToneMaskedCorrectBounceRatio,
					renderCorrectBounceRatio: renderFacts.correctBounceRatio
				};

			} ) )
		};

	};

	const captureReceiverBoundaryBlendCandidateFacts = () => {

		const candidates = [ 0.5 ];

		return {
			attributionPolicy: 'partial-boundary-compatibility-blend-candidates',
			proofBoundary: 'receiver-compatibility-blend-attribution-only',
			candidates: candidates.map( activeValue => withAuthoredReceiverBoundaryClassStrength( activeValue, () => {

				const massFacts = captureReceiverSamplingMassAttributionFacts( {
					leftBoundaryLayerMask: 4,
					rightBoundaryLayerMask: 2,
					rawBoundaryWeight: true,
					receiverBoundaryMode: 'blend',
					includeIrradianceDebug: true,
					includeNeighborIrradianceDebug: true
				} );
				const leftCoefficientContrast = summarizeCoefficientSideNeighborContrast( massFacts, 'left' );
				const rightCoefficientContrast = summarizeCoefficientSideNeighborContrast( massFacts, 'right' );
				const renderFacts = captureReceiverBoundaryMaskAlignmentRenderFacts( {
					attributionPolicy: 'partial-boundary-compatibility-blend-render-candidate',
					leftBoundaryLayerMask: 4,
					rightBoundaryLayerMask: 2,
					rawBoundaryWeight: true,
					receiverBoundaryMode: 'blend'
				} );

				return {
					label: `boundary-blend-active-${ activeValue }`,
					activeValue,
					...summarizeBoundaryMaskMassFacts( massFacts ),
					scalarCombinedBoundaryToDefaultRatio: massFacts.scalarWeight.boundaryToDefaultRatio,
					visibilityCombinedBoundaryToDefaultRatio: massFacts.visibilityWeight.boundaryToDefaultRatio,
					scalarIrradianceBoundaryToDefaultRatio: massFacts.scalarIrradiance.boundaryToDefaultRatio,
					visibilityIrradianceBoundaryToDefaultRatio: massFacts.visibilityIrradiance.boundaryToDefaultRatio,
					finalIrradianceBoundaryToDefaultRatio: massFacts.finalIrradiance.boundaryToDefaultRatio,
					scalarIrradianceLeftBoundaryToDefaultRatio: massFacts.scalarIrradiance.leftBoundaryToDefaultRatio,
					scalarIrradianceRightBoundaryToDefaultRatio: massFacts.scalarIrradiance.rightBoundaryToDefaultRatio,
					visibilityIrradianceLeftBoundaryToDefaultRatio: massFacts.visibilityIrradiance.leftBoundaryToDefaultRatio,
					visibilityIrradianceRightBoundaryToDefaultRatio: massFacts.visibilityIrradiance.rightBoundaryToDefaultRatio,
					finalIrradianceLeftBoundaryToDefaultRatio: massFacts.finalIrradiance.leftBoundaryToDefaultRatio,
					finalIrradianceRightBoundaryToDefaultRatio: massFacts.finalIrradiance.rightBoundaryToDefaultRatio,
					coefficientSidePolicy: 'neighbor-sh-coefficient-contrast',
					leftChangedCoefficientSlotCount: leftCoefficientContrast.changedSlotCount,
					leftStableCoefficientSlotCount: leftCoefficientContrast.stableSlotCount,
					leftChangedCoefficientIrradianceMean: leftCoefficientContrast.changedMean,
					leftStableCoefficientIrradianceMean: leftCoefficientContrast.stableMean,
					leftChangedCoefficientIrradianceToStableRatio: leftCoefficientContrast.changedToStableRatio,
					rightChangedCoefficientSlotCount: rightCoefficientContrast.changedSlotCount,
					rightStableCoefficientSlotCount: rightCoefficientContrast.stableSlotCount,
					rightChangedCoefficientIrradianceMean: rightCoefficientContrast.changedMean,
					rightStableCoefficientIrradianceMean: rightCoefficientContrast.stableMean,
					rightChangedCoefficientIrradianceToStableRatio: rightCoefficientContrast.changedToStableRatio,
					renderMaskedWrongSideColorRatio: renderFacts.maskedWrongSideColorRatio,
					renderPreToneMaskedWrongSideColorRatio: renderFacts.preToneMaskedWrongSideColorRatio,
					renderPreToneMaskedCorrectBounceRatio: renderFacts.preToneMaskedCorrectBounceRatio,
					renderCorrectBounceRatio: renderFacts.correctBounceRatio
				};

			} ) )
		};

	};

	const captureReceiverSoftBoundaryOverlapCandidateFacts = () => {

		if ( _lightProbeContext.leakFixture === null || _lightProbeContext.probeGrid === null ) return null;

		const originalProbeLayerMasks = _lightProbeContext.probeGrid.probeLayerMaskSource;
		const assignment = createMultiClassBoundaryProbeOwnershipAssignment( {
			overlapBoundarySublayers: true
		} );
		const candidates = [ 0.5 ];

		try {

			_lightProbeContext.probeGrid.setOptions( {
				probeLayerMasks: assignment.probeLayerMasks
			}, _lightProbeContext.renderer );

			return {
				attributionPolicy: 'soft-boundary-overlap-classification-candidate',
				proofBoundary: 'probe-meta-mask-and-receiver-blend-attribution-only',
				assignmentFacts: assignment.assignmentFacts,
				candidates: candidates.map( activeValue => withAuthoredReceiverBoundaryClassStrength( activeValue, () => {

					const massFacts = captureReceiverSamplingMassAttributionFacts( {
						leftBoundaryLayerMask: 16,
						rightBoundaryLayerMask: 8,
						rawBoundaryWeight: true,
						receiverBoundaryMode: 'blend',
						includeIrradianceDebug: true,
						includeNeighborIrradianceDebug: true
					} );

					return {
						label: `soft-overlap-cross-side-active-${ activeValue }`,
						activeValue,
						...summarizeBoundaryMaskMassFacts( massFacts ),
						scalarCombinedBoundaryToDefaultRatio: massFacts.scalarWeight.boundaryToDefaultRatio,
						visibilityCombinedBoundaryToDefaultRatio: massFacts.visibilityWeight.boundaryToDefaultRatio,
						finalIrradianceBoundaryToDefaultRatio: massFacts.finalIrradiance.boundaryToDefaultRatio,
						leftCoefficientContrast: createCoefficientContrastSideFacts( massFacts, 'left' ),
						rightCoefficientContrast: createCoefficientContrastSideFacts( massFacts, 'right' ),
						candidateVerdict: massFacts.finalIrradiance.boundaryToDefaultRatio <= 0 ?
							'rejected-overpruned-boundary-irradiance' :
							massFacts.finalIrradiance.boundaryToDefaultRatio === 1 ?
								'rejected-normalization-cancelled-boundary-irradiance' :
								'candidate-changes-boundary-irradiance'
					};

				} ) )
			};

		} finally {

			_lightProbeContext.probeGrid.setOptions( {
				probeLayerMasks: originalProbeLayerMasks
			}, _lightProbeContext.renderer );

		}

	};

	const captureReceiverCoefficientSideWeightingCandidateFacts = () => {

		if ( _lightProbeContext.leakFixture === null || _lightProbeContext.probeGrid === null ) return null;

		const originalProbeLayerMasks = _lightProbeContext.probeGrid.probeLayerMaskSource;
		const assignment = createMultiClassBoundaryProbeOwnershipAssignment( {
			overlapBoundarySublayers: true
		} );
		const candidates = [ 0.25, 0.5 ];

		try {

			_lightProbeContext.probeGrid.setOptions( {
				probeLayerMasks: assignment.probeLayerMasks
			}, _lightProbeContext.renderer );

			return {
				attributionPolicy: 'coefficient-side-weighting-candidate',
				proofBoundary: 'coefficient-accumulator-attribution-only',
				assignmentFacts: assignment.assignmentFacts,
				candidates: candidates.map( activeValue => withAuthoredReceiverBoundaryClassStrength( activeValue, () => {

					const massFacts = captureReceiverSamplingMassAttributionFacts( {
						leftBoundaryLayerMask: 16,
						rightBoundaryLayerMask: 8,
						rawBoundaryWeight: true,
						receiverBoundaryMode: 'blend',
						includeIrradianceDebug: true,
						includeCoefficientAccumulatorDebug: true,
						includeNeighborIrradianceDebug: true
					} );

					return {
						label: `coefficient-weighting-cross-side-active-${ activeValue }`,
						activeValue,
						...summarizeBoundaryMaskMassFacts( massFacts ),
						scalarCombinedBoundaryToDefaultRatio: massFacts.scalarWeight.boundaryToDefaultRatio,
						visibilityCombinedBoundaryToDefaultRatio: massFacts.visibilityWeight.boundaryToDefaultRatio,
						finalIrradianceBoundaryToDefaultRatio: massFacts.finalIrradiance.boundaryToDefaultRatio,
						scalarCoefficientAccumulatorBoundaryToDefaultRatio: massFacts.scalarCoefficientAccumulator.boundaryToDefaultRatio,
						visibilityCoefficientAccumulatorBoundaryToDefaultRatio: massFacts.visibilityCoefficientAccumulator.boundaryToDefaultRatio,
						candidateVerdict: massFacts.finalIrradiance.boundaryToDefaultRatio === 1 &&
							massFacts.scalarCoefficientAccumulator.boundaryToDefaultRatio < 1 ?
							'rejected-mass-attenuation-before-normalization' :
							'candidate-needs-render-ratio-promotion'
					};

				} ) )
			};

		} finally {

			_lightProbeContext.probeGrid.setOptions( {
				probeLayerMasks: originalProbeLayerMasks
			}, _lightProbeContext.renderer );

		}

	};

	const captureReceiverSupportSetAttributionFacts = () => {

		if ( _lightProbeContext.leakFixture === null || _lightProbeContext.probeGrid === null ) return null;

		const originalProbeLayerMasks = _lightProbeContext.probeGrid.probeLayerMaskSource;
		const assignment = createMultiClassBoundaryProbeOwnershipAssignment( {
			overlapBoundarySublayers: true
		} );
		const candidates = [ 0.25, 0.5 ];

		try {

			_lightProbeContext.probeGrid.setOptions( {
				probeLayerMasks: assignment.probeLayerMasks
			}, _lightProbeContext.renderer );
			const candidateFacts = candidates.map( activeValue => withAuthoredReceiverBoundaryClassStrength( activeValue, () => {

				const massFacts = captureReceiverSamplingMassAttributionFacts( {
					leftBoundaryLayerMask: 16,
					rightBoundaryLayerMask: 8,
					rawBoundaryWeight: true,
					receiverBoundaryMode: 'blend',
					includeIrradianceDebug: true,
					includeNeighborIrradianceDebug: false
				} );
				const left = createSupportSetSideFacts( massFacts, 'left' );
				const right = createSupportSetSideFacts( massFacts, 'right' );
				const normalizedAway =
					massFacts.finalIrradiance.boundaryToDefaultRatio === 1 &&
					massFacts.scalarWeight.boundaryToDefaultRatio < 1;
				const sameProbeSupportOnly =
					left.changedProbeIndexSlotCount === 0 &&
					right.changedProbeIndexSlotCount === 0;

				return {
					label: `support-set-cross-side-active-${ activeValue }`,
					activeValue,
					leftBoundaryLayerMask: massFacts.leftBoundaryLayerMask,
					rightBoundaryLayerMask: massFacts.rightBoundaryLayerMask,
					receiverBoundaryMode: massFacts.receiverBoundaryMode,
					rawBoundaryWeight: massFacts.rawBoundaryWeight,
					scalarCombinedBoundaryToDefaultRatio: massFacts.scalarWeight.boundaryToDefaultRatio,
					visibilityCombinedBoundaryToDefaultRatio: massFacts.visibilityWeight.boundaryToDefaultRatio,
					finalIrradianceBoundaryToDefaultRatio: massFacts.finalIrradiance.boundaryToDefaultRatio,
					left,
					right,
					relocationFeasibility: {
						probeIdentityPolicy: 'default-boundary-neighbor-index-comparison',
						leftChangedProbeIndexSlotCount: left.changedProbeIndexSlotCount,
						rightChangedProbeIndexSlotCount: right.changedProbeIndexSlotCount,
						leftChangedContributingChangedProbeIndexSlotCount: left.changedContributingChangedProbeIndexSlotCount,
						rightChangedContributingChangedProbeIndexSlotCount: right.changedContributingChangedProbeIndexSlotCount,
						nextCandidateShape: sameProbeSupportOnly ?
							'bake-time-relocation-or-probe-side-classification' :
							'current-support-can-change-probe-identities',
						relocationVerdict: sameProbeSupportOnly ?
							'candidate-needs-bake-time-probe-identity-change' :
							'candidate-has-probe-identity-change'
					},
					lossClassification: normalizedAway ?
						'normalization-cancelled-coefficient-loss' :
						massFacts.finalIrradiance.boundaryToDefaultRatio <= 0 ?
							'overpruned-support-loss' :
							'candidate-has-non-collapsing-support-change'
				};

			} ) );
			const allCandidatesSameProbeIdentity = candidateFacts.every( candidate =>
				candidate.relocationFeasibility.leftChangedProbeIndexSlotCount === 0 &&
				candidate.relocationFeasibility.rightChangedProbeIndexSlotCount === 0 );

			return {
				attributionPolicy: 'support-set-coefficient-loss-attribution',
				proofBoundary: 'aggregate-support-attribution-only',
				assignmentFacts: assignment.assignmentFacts,
				relocationRequirement: {
					identitySummaryPolicy: 'all-candidate-boundary-default-probe-identity-check',
					allCandidatesSameProbeIdentity,
					requiredNextLane: allCandidatesSameProbeIdentity ?
						'bake-time-relocation-or-probe-side-classification' :
						'candidate-support-identity-change-exists',
					receiverSideSupportVerdict: allCandidatesSameProbeIdentity ?
						'archive-receiver-side-support-routing' :
						'continue-receiver-side-support-routing'
				},
				candidates: candidateFacts
			};

		} finally {

			_lightProbeContext.probeGrid.setOptions( {
				probeLayerMasks: originalProbeLayerMasks
			}, _lightProbeContext.renderer );

		}

	};

	const captureReceiverIrradianceRenderMetrics = () => {

		if ( _lightProbeContext.leakFixture === null || _lightProbeContext.probeGrid === null ) return null;

		const previousLeftMaterial = _lightProbeContext.leakFixture.leftReceiver.material;
		const previousRightMaterial = _lightProbeContext.leakFixture.rightReceiver.material;
		const previousOutputColorSpace = _lightProbeContext.renderer.outputColorSpace;
		const leftMaterial = new THREE.MeshBasicNodeMaterial();
		const rightMaterial = new THREE.MeshBasicNodeMaterial();

		try {

			ensureAuthoredReceiverBoundaryClassAttributes();
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

			ensureAuthoredReceiverBoundaryClassAttributes();
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

	const captureReceiverSamplingMassAttributionFacts = ( options = {} ) => {

		if ( _lightProbeContext.leakFixture === null ||
			_lightProbeContext.probeGrid === null ||
			typeof _lightProbeContext.probeGrid._createManualIrradianceDebugNode !== 'function' ) return null;

		const previousLeftMaterial = _lightProbeContext.leakFixture.leftReceiver.material;
		const previousRightMaterial = _lightProbeContext.leakFixture.rightReceiver.material;
		const previousOutputColorSpace = _lightProbeContext.renderer.outputColorSpace;
		const leftBoundaryLayerMask = options.leftBoundaryLayerMask ?? 2;
		const rightBoundaryLayerMask = options.rightBoundaryLayerMask ?? 4;
		const boundaryDescriptorOptions = {
			rawBoundaryWeight: options.rawBoundaryWeight === true,
			receiverBoundaryMode: options.receiverBoundaryMode
		};
		const leftMaterial = new THREE.MeshBasicNodeMaterial();
		const rightMaterial = new THREE.MeshBasicNodeMaterial();
		const surfaceRegions = {
			leftReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.leftReceiver ) ?? leakArtifactRegions.leftReceiver,
			rightReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.rightReceiver ) ?? leakArtifactRegions.rightReceiver
		};
		const createMassAttributionEdgeRegion = ( region, side ) => {

			const width = region.x1 - region.x0;

			return side === 'left' ? {
				...region,
				x0: Math.max( region.x0, region.x1 - width * 0.35 )
			} : {
				...region,
				x1: Math.min( region.x1, region.x0 + width * 0.35 )
			};

		};
		const regions = {
			leftReceiverSurface: createMassAttributionEdgeRegion( surfaceRegions.leftReceiverSurface, 'left' ),
			rightReceiverSurface: createMassAttributionEdgeRegion( surfaceRegions.rightReceiverSurface, 'right' )
		};
		const receiverSurfaceMeans = samples => ( {
			leftMean: roundMetric( samples.leftReceiverSurface.luminance.mean / 255 ),
			rightMean: roundMetric( samples.rightReceiverSurface.luminance.mean / 255 ),
			combinedMean: roundMetric( (
				samples.leftReceiverSurface.luminance.mean +
				samples.rightReceiverSurface.luminance.mean
			) / ( 2 * 255 ) )
		} );
		const captureDebugMean = ( debugMode, leftOptions = {}, rightOptions = {} ) => {

			leftMaterial.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( debugMode, leftOptions );
			rightMaterial.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( debugMode, rightOptions );
			leftMaterial.toneMapped = false;
			rightMaterial.toneMapped = false;
			leftMaterial.needsUpdate = true;
			rightMaterial.needsUpdate = true;
			_lightProbeContext.leakFixture.leftReceiver.material = leftMaterial;
			_lightProbeContext.leakFixture.rightReceiver.material = rightMaterial;
			_lightProbeContext.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			return receiverSurfaceMeans( captureRegionArtifactMetrics( regions ) );

		};
		const captureMode = debugMode => {

			const defaultMetric = captureDebugMean( debugMode );
			const boundaryMetric = captureDebugMean(
				debugMode,
				createReceiverBoundaryDescriptor( leftBoundaryLayerMask, boundaryDescriptorOptions ),
				createReceiverBoundaryDescriptor( rightBoundaryLayerMask, boundaryDescriptorOptions )
			);

			return {
				defaultMean: defaultMetric.combinedMean,
				boundaryMean: boundaryMetric.combinedMean,
				boundaryToDefaultRatio: roundMetric( boundaryMetric.combinedMean / Math.max( defaultMetric.combinedMean, PROOF_RATIO_DENOMINATOR_EPSILON ) ),
				leftDefaultMean: defaultMetric.leftMean,
				leftBoundaryMean: boundaryMetric.leftMean,
				leftBoundaryToDefaultRatio: roundMetric( boundaryMetric.leftMean / Math.max( defaultMetric.leftMean, PROOF_RATIO_DENOMINATOR_EPSILON ) ),
				rightDefaultMean: defaultMetric.rightMean,
				rightBoundaryMean: boundaryMetric.rightMean,
				rightBoundaryToDefaultRatio: roundMetric( boundaryMetric.rightMean / Math.max( defaultMetric.rightMean, PROOF_RATIO_DENOMINATOR_EPSILON ) )
			};

		};
		const captureNeighborMode = debugMode => {

			const defaultMetric = captureDebugMean( debugMode );
			const boundaryMetric = captureDebugMean(
				debugMode,
				createReceiverBoundaryDescriptor( leftBoundaryLayerMask, boundaryDescriptorOptions ),
				createReceiverBoundaryDescriptor( rightBoundaryLayerMask, boundaryDescriptorOptions )
			);

			return {
				leftDefault: defaultMetric.leftMean,
				leftBoundary: boundaryMetric.leftMean,
				leftDelta: roundMetric( boundaryMetric.leftMean - defaultMetric.leftMean ),
				rightDefault: defaultMetric.rightMean,
				rightBoundary: boundaryMetric.rightMean,
				rightDelta: roundMetric( boundaryMetric.rightMean - defaultMetric.rightMean )
			};

		};
		const captureNeighborAttribution = () => {

			const probeIndexScale = _lightProbeContext.probeGrid.totalProbes - 1;
			const decodeProbeIndex = encoded => Math.round( encoded * probeIndexScale );
			const neighbors = Array.from( { length: 8 }, ( _, slot ) => {

				const probeIndex = captureNeighborMode( `neighbor${ slot }ProbeIndex` );
				const layerCompatibility = captureNeighborMode( `neighbor${ slot }LayerCompatibility` );
				const baseWeight = captureNeighborMode( `neighbor${ slot }BaseWeight` );
				const visibilityWeight = captureNeighborMode( `neighbor${ slot }VisibilityWeight` );
				const visibility = captureNeighborMode( `neighbor${ slot }Visibility` );
				const irradiance = options.includeNeighborIrradianceDebug === true ?
					captureNeighborMode( `neighbor${ slot }Irradiance` ) :
					null;

				return {
					slot,
					leftDefaultProbeIndex: decodeProbeIndex( probeIndex.leftDefault ),
					leftBoundaryProbeIndex: decodeProbeIndex( probeIndex.leftBoundary ),
					rightDefaultProbeIndex: decodeProbeIndex( probeIndex.rightDefault ),
					rightBoundaryProbeIndex: decodeProbeIndex( probeIndex.rightBoundary ),
					layerCompatibility,
					baseWeight,
					visibilityWeight,
					visibility,
					...( irradiance !== null ? { irradiance } : {} )
				};

			} );
			const hasChangedCompatibility = ( neighbor, side ) =>
				Math.abs( neighbor.layerCompatibility[ `${ side }Delta` ] ) > PROOF_LAYER_COMPATIBILITY_DELTA_EPSILON;
			const hasContributingWeight = ( neighbor, side ) =>
				neighbor.baseWeight[ `${ side }Default` ] > PROOF_RATIO_DENOMINATOR_EPSILON ||
				neighbor.baseWeight[ `${ side }Boundary` ] > PROOF_RATIO_DENOMINATOR_EPSILON;

			return {
				attributionPolicy: 'debug-node-neighbor-default-boundary-delta',
				sampleRegion: 'receiver-near-divider-edge-screen-region',
				leftCompatibilityChangedSlotCount: neighbors.filter( neighbor => hasChangedCompatibility( neighbor, 'left' ) ).length,
				leftCompatibilityChangedContributingSlotCount: neighbors.filter( neighbor =>
					hasChangedCompatibility( neighbor, 'left' ) && hasContributingWeight( neighbor, 'left' ) ).length,
				rightCompatibilityChangedSlotCount: neighbors.filter( neighbor => hasChangedCompatibility( neighbor, 'right' ) ).length,
				rightCompatibilityChangedContributingSlotCount: neighbors.filter( neighbor =>
					hasChangedCompatibility( neighbor, 'right' ) && hasContributingWeight( neighbor, 'right' ) ).length,
				neighbors
			};

		};

		try {

			ensureAuthoredReceiverBoundaryClassAttributes();

			return {
				attributionPolicy: 'debug-node-surface-mass-ratio',
				sampleRegion: 'receiver-near-divider-edge-screen-region',
				leftBoundaryLayerMask,
				rightBoundaryLayerMask,
				receiverBoundaryMode: options.receiverBoundaryMode ?? 'select',
				rawBoundaryWeight: options.rawBoundaryWeight === true,
				scalarWeight: captureMode( 'scalarWeight' ),
				visibilityWeight: captureMode( 'visibilityWeight' ),
				visibilityMass: captureMode( 'visibilityMix' ),
				...( options.includeIrradianceDebug === true ? {
					scalarIrradiance: captureMode( 'scalarIrradiance' ),
					visibilityIrradiance: captureMode( 'visibilityIrradiance' ),
					finalIrradiance: captureMode( 'finalIrradiance' )
				} : {} ),
				...( options.includeCoefficientAccumulatorDebug === true ? {
					scalarCoefficientAccumulator: captureMode( 'scalarCoefficientAccumulator' ),
					visibilityCoefficientAccumulator: captureMode( 'visibilityCoefficientAccumulator' )
				} : {} ),
				...( options.includeNeighborAttribution === false ? {} : {
					neighborAttribution: captureNeighborAttribution()
				} )
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

	const captureReceiverSampleAlignmentCandidateFacts = () => {

		if ( _lightProbeContext.leakFixture === null ||
			_lightProbeContext.probeGrid === null ||
			typeof _lightProbeContext.probeGrid._createManualIrradianceDebugNode !== 'function' ) return null;

		const originalNormalBias = _lightProbeContext.probeGrid.normalBias.value;
		const originalParamNormalBias = _lightProbeContext.params.normalBias;
		const candidates = [ 0.25, 0.75 ];
		const summarizeNeighborAttribution = massFacts => {

			const neighbor = massFacts?.neighborAttribution;
			if ( neighbor === undefined ) return null;

			return {
				leftCompatibilityChangedSlotCount: neighbor.leftCompatibilityChangedSlotCount,
				leftCompatibilityChangedContributingSlotCount: neighbor.leftCompatibilityChangedContributingSlotCount,
				rightCompatibilityChangedSlotCount: neighbor.rightCompatibilityChangedSlotCount,
				rightCompatibilityChangedContributingSlotCount: neighbor.rightCompatibilityChangedContributingSlotCount,
				scalarLeftBoundaryToDefaultRatio: massFacts.scalarWeight.leftBoundaryToDefaultRatio,
				scalarRightBoundaryToDefaultRatio: massFacts.scalarWeight.rightBoundaryToDefaultRatio,
				visibilityLeftBoundaryToDefaultRatio: massFacts.visibilityWeight.leftBoundaryToDefaultRatio,
				visibilityRightBoundaryToDefaultRatio: massFacts.visibilityWeight.rightBoundaryToDefaultRatio
			};

		};

		try {

			return {
				attributionPolicy: 'normal-bias-neighbor-alignment-candidates',
				proofBoundary: 'runtime-uniform-attribution-only',
				baselineNormalBias: originalNormalBias,
				candidates: candidates.map( normalBias => {

					_lightProbeContext.probeGrid.normalBias.value = normalBias;
					_lightProbeContext.params.normalBias = normalBias;

					return {
						normalBias,
						...summarizeNeighborAttribution( captureReceiverSamplingMassAttributionFacts() )
					};

				} )
			};

		} finally {

			_lightProbeContext.probeGrid.normalBias.value = originalNormalBias;
			_lightProbeContext.params.normalBias = originalParamNormalBias;
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		}

	};

	const applyLeakFixtureReceiverMasks = () => {

		if ( _lightProbeContext.leakFixture === null || _lightProbeContext.probeGrid === null ) return;

		ensureAuthoredReceiverBoundaryClassAttributes();

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

	const createCameraSnapshot = () => ( {
		position: _lightProbeContext.camera.position.clone(),
		quaternion: _lightProbeContext.camera.quaternion.clone(),
		zoom: _lightProbeContext.camera.zoom
	} );

	const restoreCameraSnapshot = ( snapshot ) => {

		_lightProbeContext.camera.position.copy( snapshot.position );
		_lightProbeContext.camera.quaternion.copy( snapshot.quaternion );
		_lightProbeContext.camera.zoom = snapshot.zoom;
		_lightProbeContext.camera.updateMatrixWorld();
		_lightProbeContext.camera.updateProjectionMatrix();

	};

	const applySealedOffsetWallProofCamera = () => {

		_lightProbeContext.camera.position.set( 0, 15, 5.4 );
		_lightProbeContext.camera.lookAt( 0, 1.05, 0.35 );
		_lightProbeContext.camera.updateMatrixWorld();
		_lightProbeContext.camera.updateProjectionMatrix();

	};

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
		const fixtureFamily = mode === 'sealed-offset-wall' ? 'sealed-offset-wall' : 'sealed-wall';
		_lightProbeContext.leakFixture.group.visible = enabled;
		_lightProbeContext.leakFixture.fixtureId = enabled ? fixtureFamily : 'off';

		for ( const mesh of _lightProbeContext.leakFixture.meshes ) {

			mesh.visible = enabled && ( mesh.userData.leakFixtureFamily ?? 'sealed-wall' ) === fixtureFamily;

		}

		_lightProbeContext.leakFixture.leftReceiver = fixtureFamily === 'sealed-offset-wall' ?
			_lightProbeContext.leakFixture.offsetLeftReceiver :
			_lightProbeContext.leakFixture.defaultLeftReceiver;
		_lightProbeContext.leakFixture.rightReceiver = fixtureFamily === 'sealed-offset-wall' ?
			_lightProbeContext.leakFixture.offsetRightReceiver :
			_lightProbeContext.leakFixture.defaultRightReceiver;
		_lightProbeContext.leakFixture.thinDivider.visible = enabled && mode === 'thin-wall';
		_lightProbeContext.leakFixture.sealedDivider.visible = enabled && mode === 'sealed-wall';
		_lightProbeContext.leakFixture.zeroThicknessDivider.visible = enabled && mode === 'zero-thickness';
		_lightProbeContext.leakFixture.offsetSealedDivider.visible = enabled && mode === 'sealed-offset-wall';
		_lightProbeContext.leakFixture.zeroThicknessDivider.material.side = THREE.DoubleSide;

	};

	const createLeakFixtureFacts = () => {

		const fixture = _lightProbeContext.leakFixture;
		const divider = _lightProbeContext.getActiveLeakDivider();
		const fixtureId = fixture?.fixtureId ?? 'unknown';
		const dividerAxis = divider?.userData?.leakDivider === 'sealed-offset-wall' ? 'z' : 'x';

		if ( fixture === null ) return null;

		return {
			fixtureId,
			fixtureFamily: fixtureId,
			activeDivider: divider?.userData?.leakDivider ?? 'none',
			dividerAxis,
			dividerOffset: divider === null || divider === undefined ? null : roundMetric( divider.position[ dividerAxis ] ),
			leftReceiver: {
				role: fixture.leftReceiver?.userData?.leakReceiver ?? 'none',
				position: fixture.leftReceiver?.position?.toArray().map( roundMetric ) ?? null
			},
			rightReceiver: {
				role: fixture.rightReceiver?.userData?.leakReceiver ?? 'none',
				position: fixture.rightReceiver?.position?.toArray().map( roundMetric ) ?? null
			},
			visibleMeshCount: fixture.meshes.filter( mesh => mesh.visible === true ).length,
			offsetVisible: fixture.offsetSealedDivider?.visible === true
		};

	};

	const captureSealedOffsetWallFixtureAttribution = () => {

		setLeakFixtureMode( 'sealed-offset-wall' );
		_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		const facts = createLeakFixtureFacts();
		const isComplete = facts !== null &&
			facts.fixtureId === 'sealed-offset-wall' &&
			facts.activeDivider === 'sealed-offset-wall' &&
			facts.dividerAxis === 'z' &&
			facts.leftReceiver.role === 'left' &&
			facts.rightReceiver.role === 'right' &&
			facts.visibleMeshCount > 0 &&
			facts.offsetVisible === true;

		return {
			attributionPolicy: 'second-sealed-fixture-family-activation',
			proofBoundary: 'fixture-family-activation-only',
			...facts,
			fixtureActivationVerdict: isComplete ?
				'sealed-offset-wall-fixture-activates' :
				'sealed-offset-wall-fixture-incomplete'
		};

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
				active: info?.active === true,
				runtimeActive: info?.runtimeActive === true,
				mode: info?.mode ?? 'unavailable',
				resolution: Number.isInteger( info?.resolution ) ? info.resolution : 0,
				texturePresent: info?.texturePresent === true,
				bytes: info?.bytes ?? 0
			};

		};

		if ( typeof probeGrid?.getVisibilityDepthInfo === 'function' ) {

			return compactVisibilityDepthInfo( probeGrid.getVisibilityDepthInfo() );

		}

		return {
			available: false,
			active: false,
			runtimeActive: false,
			mode: 'unavailable',
			resolution: 0,
			texturePresent: false,
			bytes: 0
		};

	};

	const isActiveMomentVisibilityDepthInfo = info =>
		info?.active === true &&
		info?.runtimeActive === true &&
		info?.available === true &&
		info?.mode === 'moments' &&
		info?.texturePresent === true &&
		info?.bytes > 0;

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
			intensity: _lightProbeContext.params.intensity,
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
		maskedVisiblePixelCount: metrics.maskedVisiblePixelCount,
		maskedVisiblePixelRatio: metrics.maskedVisiblePixelRatio,
		maskedLeftVisiblePixelCount: metrics.maskedLeftVisiblePixelCount,
		maskedRightVisiblePixelCount: metrics.maskedRightVisiblePixelCount,
		maskedLeftCorrectBounceRatio: metrics.maskedLeftCorrectBounceRatio,
		maskedRightCorrectBounceRatio: metrics.maskedRightCorrectBounceRatio,
		correctBounceRatio: metrics.correctBounceRatio,
		preToneMaskedWrongSideColorRatio: rendererMetrics.metrics.maskedWrongSideColorRatio,
		preToneMaskedVisiblePixelCount: rendererMetrics.metrics.maskedVisiblePixelCount,
		preToneMaskedVisiblePixelRatio: rendererMetrics.metrics.maskedVisiblePixelRatio,
		preToneMaskedLeftVisiblePixelCount: rendererMetrics.metrics.maskedLeftVisiblePixelCount,
		preToneMaskedRightVisiblePixelCount: rendererMetrics.metrics.maskedRightVisiblePixelCount,
		preToneMaskedLeftCorrectBounceRatio: rendererMetrics.metrics.maskedLeftCorrectBounceRatio,
		preToneMaskedRightCorrectBounceRatio: rendererMetrics.metrics.maskedRightCorrectBounceRatio,
		preToneMaskedCorrectBounceRatio: rendererMetrics.metrics.maskedCorrectBounceRatio
	} );

	const createReceiverMaterialAttributionFacts = () => {

		const leftMaterial = _lightProbeContext.leakFixture?.leftReceiver?.material ?? null;
		const rightMaterial = _lightProbeContext.leakFixture?.rightReceiver?.material ?? null;
		const leftColor = leftMaterial?.color ?? null;
		const rightColor = rightMaterial?.color ?? null;
		const leftWrongSideRatio = leftColor !== null ? leftColor.g / Math.max( leftColor.r, PROOF_RATIO_DENOMINATOR_EPSILON ) : null;
		const rightWrongSideRatio = rightColor !== null ? rightColor.r / Math.max( rightColor.g, PROOF_RATIO_DENOMINATOR_EPSILON ) : null;

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

	const createResidualAttributionRow = ( label, metrics, rendererMetrics, irradianceMetrics = null, materialFacts = null, lambertMetrics = null, surfaceSamplingFacts = null, samplingMassFacts = null ) => ( {
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
		} : {} ),
		...( samplingMassFacts !== null ? {
			samplingMassAttribution: samplingMassFacts
		} : {} )
	} );

	const createResidualAttributionFacts = ( rows ) => {

		const rowMap = new Map( rows.map( row => [ row.label, row ] ) );
		const baseline = rowMap.get( 'sealed-wall-validity-weighted' );
		const candidate = rowMap.get( 'sealed-wall-visibility-moments' );
		const ratio = key => roundMetric( candidate[ key ] / Math.max( baseline[ key ], PROOF_RATIO_DENOMINATOR_EPSILON ) );

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
				candidate.renderLinearIrradianceCenterWrongRatio / Math.max( candidate.maskedWrongSideColorRatio, PROOF_RATIO_DENOMINATOR_EPSILON )
			),
			candidateRenderIrradianceMaskedWrongRatio: candidate.renderIrradianceMaskedWrongRatio,
			candidateRenderLinearIrradianceMaskedWrongRatio: candidate.renderLinearIrradianceMaskedWrongRatio,
			candidateMaskedIrradianceToMaskedVisibleRatio: roundMetric(
				candidate.renderLinearIrradianceMaskedWrongRatio / Math.max( candidate.maskedWrongSideColorRatio, PROOF_RATIO_DENOMINATOR_EPSILON )
			),
			candidateReceiverMaterialType: candidate.receiverMaterialType,
			candidateReceiverAlbedoWrongSideRatio: candidate.receiverAlbedoWrongSideRatio,
			candidateReceiverRoughness: candidate.receiverRoughness,
			candidateReceiverMetalness: candidate.receiverMetalness,
			candidatePreToneMaskedToAlbedoRatio: roundMetric(
				candidate.preToneMaskedWrongSideColorRatio / Math.max( candidate.receiverAlbedoWrongSideRatio, PROOF_RATIO_DENOMINATOR_EPSILON )
			),
			candidateRenderLambertMaskedWrongRatio: candidate.renderLambertMaskedWrongRatio,
			candidateRenderLinearLambertMaskedWrongRatio: candidate.renderLinearLambertMaskedWrongRatio,
			candidateLinearLambertToLinearIrradianceRatio: roundMetric(
				candidate.renderLinearLambertMaskedWrongRatio / Math.max( candidate.renderLinearIrradianceMaskedWrongRatio, PROOF_RATIO_DENOMINATOR_EPSILON )
			),
			candidatePreToneMaskedToLinearLambertRatio: roundMetric(
				candidate.preToneMaskedWrongSideColorRatio / Math.max( candidate.renderLinearLambertMaskedWrongRatio, PROOF_RATIO_DENOMINATOR_EPSILON )
			),
			candidateNearDividerEdgeWrongSideColorRatio: candidate.nearDividerEdgeWrongSideColorRatio,
			candidateNearDividerEdgeToSurfaceCenterRatio: roundMetric(
				candidate.nearDividerEdgeWrongSideColorRatio / Math.max( candidate.surfaceCenterWrongSideColorRatio, PROOF_RATIO_DENOMINATOR_EPSILON )
			),
			candidateNearDividerEdgeToMaskedVisibleRatio: roundMetric(
				candidate.nearDividerEdgeWrongSideColorRatio / Math.max( candidate.maskedWrongSideColorRatio, PROOF_RATIO_DENOMINATOR_EPSILON )
			),
			candidateMaskedVisiblePixelCount: candidate.maskedVisiblePixelCount,
			candidateMaskedVisiblePixelRatio: candidate.maskedVisiblePixelRatio,
			candidateMaskedVisibleToSurfaceCenterRatio: roundMetric(
				candidate.maskedWrongSideColorRatio / Math.max( candidate.surfaceCenterWrongSideColorRatio, PROOF_RATIO_DENOMINATOR_EPSILON )
			),
			candidatePreToneMaskedToMaskedVisibleRatio: roundMetric(
				candidate.preToneMaskedWrongSideColorRatio / Math.max( candidate.maskedWrongSideColorRatio, PROOF_RATIO_DENOMINATOR_EPSILON )
			),
			minCameraDotCpuNormal: candidate.minCameraDotCpuNormal,
			receiverSurfaceRegionAreaRatio: candidate.receiverSurfaceRegionAreaRatio,
			samplingMassAttribution: candidate.samplingMassAttribution
		};

	};

	const createSealedOffsetWallResidualAttributionFacts = ( rows ) => {

		const rowMap = new Map( rows.map( row => [ row.label, row ] ) );
		const baseline = rowMap.get( 'sealed-offset-wall-validity-weighted' );
		const candidate = rowMap.get( 'sealed-offset-wall-visibility-moments' );
		const ratio = key => roundMetric( candidate[ key ] / Math.max( baseline[ key ], PROOF_RATIO_DENOMINATOR_EPSILON ) );
		const maskedVisibleResidualRatio = ratio( 'maskedWrongSideColorRatio' );

		return {
			attributionPolicy: 'sealed-offset-wall-rendered-region-source-ratios',
			proofBoundary: 'second-fixture-rendered-ratio-attribution-only',
			baselineLabel: baseline.label,
			candidateLabel: candidate.label,
			maskedVisibleResidualRatio,
			preToneMaskedResidualRatio: ratio( 'preToneMaskedWrongSideColorRatio' ),
			correctBounceRatio: ratio( 'correctBounceRatio' ),
			preToneCorrectBounceRatio: ratio( 'preToneMaskedCorrectBounceRatio' ),
			offsetResidualVerdict: maskedVisibleResidualRatio < 1 ?
				'sealed-offset-wall-visibility-lowers-masked-wrong-side-ratio' :
				'sealed-offset-wall-visibility-does-not-lower-masked-wrong-side-ratio'
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

	const createSetupSideProbeClassificationAttributionFacts = async ( supportSetAttribution, coefficientContrastAttribution ) => {

		if ( _lightProbeContext.leakFixture === null || _lightProbeContext.probeGrid === null ) return null;

		const defaultMask = 1;
		const leftBoundaryMask = 8;
		const rightBoundaryMask = 16;
		const supportSize = 8;
		const resolution = _lightProbeContext.params.resolution;
		const occupancy = _lightProbeContext.collectProbeOccupancy( resolution );
		const sampling = _lightProbeContext.probeGrid.getSamplingInfo();
		const assignment = createMultiClassBoundaryProbeOwnershipAssignment( {
			overlapBoundarySublayers: true
		} );
		const occupiedProbeIndices = new Set( occupancy.occupiedProbes.map( probe => probe.probeIndex ) );
		const receiverSideArchived = supportSetAttribution?.relocationRequirement?.receiverSideSupportVerdict ===
			'archive-receiver-side-support-routing';
		const validProbeCount = occupancy.totalProbes - occupancy.occupiedProbeCount;
		const probePosition = new THREE.Vector3();
		const receiverBox = new THREE.Box3();
		const receiverPoint = new THREE.Vector3();
		const receiverCenter = new THREE.Vector3();
		const representedContrast = coefficientContrastAttribution?.multiClassOwnershipFeasibility;
		const getProbePosition = ( index, target ) => {

			const coord = getLightProbeGridGPUProbeCoord( index, resolution );

			return target.set(
				_lightProbeContext.gridMin.x + coord.x * ( _lightProbeContext.gridMax.x - _lightProbeContext.gridMin.x ) / ( resolution - 1 ),
				_lightProbeContext.gridMin.y + coord.y * ( _lightProbeContext.gridMax.y - _lightProbeContext.gridMin.y ) / ( resolution - 1 ),
				_lightProbeContext.gridMin.z + coord.z * ( _lightProbeContext.gridMax.z - _lightProbeContext.gridMin.z ) / ( resolution - 1 )
			);

		};
		const createReceiverEdgePoint = ( receiver, side ) => {

			receiverBox.setFromObject( receiver );
			receiverBox.getCenter( receiverCenter );
			receiverPoint.copy( receiverCenter );
			receiverPoint.x = side === 'left' ? receiverBox.max.x : receiverBox.min.x;

			return receiverPoint.clone();

		};
		const createLocalCellSupport = ( receiver, side ) => {

			const position = createReceiverEdgePoint( receiver, side );
			const normal = new THREE.Vector3( 0, 0, 1 ).applyQuaternion( receiver.getWorldQuaternion( new THREE.Quaternion() ) ).normalize();
			const viewDirection = new THREE.Vector3().subVectors( _lightProbeContext.camera.position, position ).normalize();
			const probeSpacing = new THREE.Vector3(
				( _lightProbeContext.gridMax.x - _lightProbeContext.gridMin.x ) / Math.max( resolution - 1, 1 ),
				( _lightProbeContext.gridMax.y - _lightProbeContext.gridMin.y ) / Math.max( resolution - 1, 1 ),
				( _lightProbeContext.gridMax.z - _lightProbeContext.gridMin.z ) / Math.max( resolution - 1, 1 )
			);
			const samplePosition = position.clone()
				.add( normal.clone().multiply( probeSpacing ).multiplyScalar( _lightProbeContext.probeGrid.normalBias.value ) )
				.add( viewDirection.multiply( probeSpacing ).multiplyScalar( _lightProbeContext.probeGrid.viewBias.value ) );
			const gridCoord = samplePosition.clone()
				.sub( _lightProbeContext.gridMin )
				.divide( new THREE.Vector3().subVectors( _lightProbeContext.gridMax, _lightProbeContext.gridMin ) )
				.clamp( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 1, 1, 1 ) )
				.multiplyScalar( resolution - 1 );
			const base = new THREE.Vector3(
				Math.floor( gridCoord.x ),
				Math.floor( gridCoord.y ),
				Math.floor( gridCoord.z )
			);
			const x0 = Math.max( 0, Math.min( resolution - 1, base.x ) );
			const y0 = Math.max( 0, Math.min( resolution - 1, base.y ) );
			const z0 = Math.max( 0, Math.min( resolution - 1, base.z ) );
			const x1 = Math.max( 0, Math.min( resolution - 1, x0 + 1 ) );
			const y1 = Math.max( 0, Math.min( resolution - 1, y0 + 1 ) );
			const z1 = Math.max( 0, Math.min( resolution - 1, z0 + 1 ) );
			const support = [
				{ x: x0, y: y0, z: z0 },
				{ x: x1, y: y0, z: z0 },
				{ x: x0, y: y1, z: z0 },
				{ x: x1, y: y1, z: z0 },
				{ x: x0, y: y0, z: z1 },
				{ x: x1, y: y0, z: z1 },
				{ x: x0, y: y1, z: z1 },
				{ x: x1, y: y1, z: z1 }
			].map( coord => {

				const probeIndex = getLightProbeGridGPUProbeIndex( coord.x, coord.y, coord.z, resolution );
				const cellProbePosition = new THREE.Vector3();

				getProbePosition( probeIndex, cellProbePosition );

				return {
					probeIndex,
					distanceSq: cellProbePosition.distanceToSquared( position ),
					occupied: occupiedProbeIndices.has( probeIndex )
				};

			} );

			return {
				side,
				samplePointPolicy: 'receiver-edge-plus-normal-view-bias',
				normalBias: roundMetric( _lightProbeContext.probeGrid.normalBias.value ),
				viewBias: roundMetric( _lightProbeContext.probeGrid.viewBias.value ),
				probeCoord: {
					x: roundMetric( gridCoord.x ),
					y: roundMetric( gridCoord.y ),
					z: roundMetric( gridCoord.z )
				},
				baseCoord: {
					x: x0,
					y: y0,
					z: z0
				},
				support
			};

		};
		const createNearestSupportCandidates = ( position, receiverMask, probeLayerMasks = assignment.probeLayerMasks ) => {

			const candidates = [];

			for ( let probeIndex = 0; probeIndex < occupancy.totalProbes; probeIndex ++ ) {

				const layerMask = probeLayerMasks[ probeIndex ];
				if ( ( layerMask & receiverMask ) === 0 ) continue;

				getProbePosition( probeIndex, probePosition );
				candidates.push( {
					probeIndex,
					distanceSq: probePosition.distanceToSquared( position ),
					occupied: occupiedProbeIndices.has( probeIndex )
				} );

			}

			return candidates.sort( ( a, b ) => a.distanceSq - b.distanceSq );

		};
		const createNearestSupport = ( position, receiverMask, probeLayerMasks ) => {

			return createNearestSupportCandidates( position, receiverMask, probeLayerMasks ).slice( 0, supportSize );

		};
		const summarizeSupport = support => {

			const occupiedSupportCount = support.filter( probe => probe.occupied ).length;

			return {
				supportSize: support.length,
				occupiedSupportCount,
				validSupportCount: support.length - occupiedSupportCount,
				meanDistanceSq: roundMetric( support.reduce( ( sum, probe ) => sum + probe.distanceSq, 0 ) / Math.max( support.length, 1 ) )
			};

		};
		const compareSupportIdentity = ( defaultSupport, classifiedSupport ) => {

			const defaultIndices = new Set( defaultSupport.map( probe => probe.probeIndex ) );
			const classifiedIndices = new Set( classifiedSupport.map( probe => probe.probeIndex ) );
			const overlapCount = [ ...classifiedIndices ].filter( probeIndex => defaultIndices.has( probeIndex ) ).length;
			const identityChangeCount = Math.max( defaultIndices.size, classifiedIndices.size ) - overlapCount;

			return {
				overlapCount,
				identityChangeCount,
				identityChangeRatio: roundMetric( identityChangeCount / Math.max( supportSize, 1 ) )
			};

		};
		const createHash = values => {

			let hash = 0x811c9dc5;

			for ( const value of values ) {

				hash ^= value;
				hash = Math.imul( hash, 0x01000193 );

			}

			return `fnv1a32:${ ( hash >>> 0 ).toString( 16 ).padStart( 8, '0' ) }`;

		};
		const createSupportIdentityHash = support => createHash( support.map( probe => probe.probeIndex + 1 ) );
		const createSupportLayerMaskHash = ( support, probeLayerMasks = assignment.probeLayerMasks ) => createHash( support.map( probe =>
			( probe.probeIndex + 1 ) ^ ( ( probeLayerMasks[ probe.probeIndex ] + 1 ) << 8 )
		) );
		const createSupportGridCoordHash = support => createHash( support.map( probe => {

			const coord = getLightProbeGridGPUProbeCoord( probe.probeIndex, resolution );

			return ( coord.x + 1 ) ^ ( ( coord.y + 1 ) << 8 ) ^ ( ( coord.z + 1 ) << 16 );

		} ) );
		const summarizeSupportGridCoords = support => {

			const initialRange = {
				minX: Number.POSITIVE_INFINITY,
				minY: Number.POSITIVE_INFINITY,
				minZ: Number.POSITIVE_INFINITY,
				maxX: Number.NEGATIVE_INFINITY,
				maxY: Number.NEGATIVE_INFINITY,
				maxZ: Number.NEGATIVE_INFINITY
			};
			const summary = support.reduce( ( acc, probe ) => {

				const coord = getLightProbeGridGPUProbeCoord( probe.probeIndex, resolution );

				acc.sumX += coord.x;
				acc.sumY += coord.y;
				acc.sumZ += coord.z;
				acc.minX = Math.min( acc.minX, coord.x );
				acc.minY = Math.min( acc.minY, coord.y );
				acc.minZ = Math.min( acc.minZ, coord.z );
				acc.maxX = Math.max( acc.maxX, coord.x );
				acc.maxY = Math.max( acc.maxY, coord.y );
				acc.maxZ = Math.max( acc.maxZ, coord.z );

				return acc;

			}, {
				sumX: 0,
				sumY: 0,
				sumZ: 0,
				...initialRange
			} );
			const count = Math.max( support.length, 1 );

			return {
				meanX: roundMetric( summary.sumX / count ),
				meanY: roundMetric( summary.sumY / count ),
				meanZ: roundMetric( summary.sumZ / count ),
				minX: Number.isFinite( summary.minX ) ? summary.minX : 0,
				minY: Number.isFinite( summary.minY ) ? summary.minY : 0,
				minZ: Number.isFinite( summary.minZ ) ? summary.minZ : 0,
				maxX: Number.isFinite( summary.maxX ) ? summary.maxX : 0,
				maxY: Number.isFinite( summary.maxY ) ? summary.maxY : 0,
				maxZ: Number.isFinite( summary.maxZ ) ? summary.maxZ : 0
			};

		};
		const createDescriptorFacts = ( descriptorRole, side, receiverBoundaryLayerMask, receiverBoundaryWeight, support ) => {

			const effectiveReceiverMask = receiverBoundaryWeight >= RECEIVER_BOUNDARY_SELECTION_THRESHOLD ?
				receiverBoundaryLayerMask :
				defaultMask;

			return {
				descriptorRole,
				side,
				probeMaskSource: 'setup-classified-probeLayerMasks',
				receiverLayerMask: defaultMask,
				receiverBoundaryLayerMask,
				receiverBoundaryWeight,
				effectiveReceiverMask,
				selectedSupportIdentityHash: createSupportIdentityHash( support ),
				selectedSupportLayerMaskHash: createSupportLayerMaskHash( support ),
				supportHashPolicy: 'ordered-probe-index-fnv1a32',
				supportSize: support.length
			};

		};
		const compareDescriptorFacts = (
			debugDescriptor,
			renderDescriptor,
			parityVerdict = 'debug-render-descriptor-parity',
			mismatchVerdict = 'debug-render-descriptor-attribution-mismatch'
		) => {

			const hasParity = debugDescriptor !== undefined &&
				renderDescriptor !== undefined &&
				debugDescriptor.probeMaskSource === renderDescriptor.probeMaskSource &&
				debugDescriptor.receiverLayerMask === renderDescriptor.receiverLayerMask &&
				debugDescriptor.receiverBoundaryLayerMask === renderDescriptor.receiverBoundaryLayerMask &&
				debugDescriptor.effectiveReceiverMask === renderDescriptor.effectiveReceiverMask &&
				debugDescriptor.selectedSupportIdentityHash === renderDescriptor.selectedSupportIdentityHash &&
				debugDescriptor.selectedSupportLayerMaskHash === renderDescriptor.selectedSupportLayerMaskHash;

			return {
				probeMaskSourceMatch: debugDescriptor?.probeMaskSource === renderDescriptor?.probeMaskSource,
				receiverMaskMatch: debugDescriptor?.effectiveReceiverMask === renderDescriptor?.effectiveReceiverMask,
				boundaryMaskMatch: debugDescriptor?.receiverBoundaryLayerMask === renderDescriptor?.receiverBoundaryLayerMask,
				selectedSupportIdentityHashMatch: debugDescriptor?.selectedSupportIdentityHash === renderDescriptor?.selectedSupportIdentityHash,
				selectedSupportLayerMaskHashMatch: debugDescriptor?.selectedSupportLayerMaskHash === renderDescriptor?.selectedSupportLayerMaskHash,
				descriptorParityVerdict: hasParity ?
					parityVerdict :
					mismatchVerdict
			};

		};
		const summarizeDefaultCompatibility = ( support, boundaryMask, probeLayerMasks = assignment.probeLayerMasks ) => {

			const supportMasks = support.map( probe => probeLayerMasks[ probe.probeIndex ] );
			const defaultCompatibleCount = supportMasks.filter( layerMask => ( layerMask & defaultMask ) !== 0 ).length;
			const boundaryCompatibleCount = supportMasks.filter( layerMask => ( layerMask & boundaryMask ) !== 0 ).length;
			const defaultAndBoundaryCompatibleCount = supportMasks.filter( layerMask =>
				( layerMask & defaultMask ) !== 0 &&
				( layerMask & boundaryMask ) !== 0
			).length;

			return {
				supportSize: support.length,
				defaultCompatibleCount,
				boundaryCompatibleCount,
				defaultAndBoundaryCompatibleCount,
				defaultAndBoundaryCompatibilityRatio: roundMetric(
					defaultAndBoundaryCompatibleCount / Math.max( support.length, 1 )
				)
			};

		};
		const createSupportRankFacts = ( {
			side,
			boundaryMask,
			defaultCandidates,
			classifiedCandidates,
			defaultSupport,
			classifiedSupport,
			probeLayerMasks
		} ) => {

			const identity = compareSupportIdentity( defaultSupport, classifiedSupport );
			const hasCompleteSupport = defaultSupport.length === supportSize && classifiedSupport.length === supportSize;
			const defaultSupportMasks = defaultSupport.map( probe => probeLayerMasks[ probe.probeIndex ] );
			const classifiedSupportMasks = classifiedSupport.map( probe => probeLayerMasks[ probe.probeIndex ] );
			const defaultSupportBoundaryCompatibleCount = defaultSupportMasks.filter( layerMask => ( layerMask & boundaryMask ) !== 0 ).length;
			const classifiedSupportDefaultCompatibleCount = classifiedSupportMasks.filter( layerMask => ( layerMask & defaultMask ) !== 0 ).length;
			const classifiedSupportBoundaryCompatibleCount = classifiedSupportMasks.filter( layerMask => ( layerMask & boundaryMask ) !== 0 ).length;
			const topCandidateWindow = supportSize * 2;
			const defaultTopCandidates = new Set( defaultCandidates.slice( 0, topCandidateWindow ).map( probe => probe.probeIndex ) );
			const classifiedTopCandidates = new Set( classifiedCandidates.slice( 0, topCandidateWindow ).map( probe => probe.probeIndex ) );
			const topCandidateOverlapCount = [ ...classifiedTopCandidates ].filter( probeIndex => defaultTopCandidates.has( probeIndex ) ).length;
			const defaultSupportSummary = summarizeSupport( defaultSupport );
			const classifiedSupportSummary = summarizeSupport( classifiedSupport );
			const blockerVerdict = hasCompleteSupport === false ?
				'blocked-incomplete-classified-support' :
				identity.identityChangeCount > 0 ?
				'side-has-setup-identity-change' :
				defaultSupportBoundaryCompatibleCount === supportSize ?
					'blocked-default-support-already-boundary-compatible' :
					topCandidateOverlapCount >= supportSize ?
						'blocked-nearest-candidate-rank-overlap' :
						'blocked-no-selected-identity-change';

			return {
				side,
				boundaryLayerMask: boundaryMask,
				defaultCandidateCount: defaultCandidates.length,
				classifiedCandidateCount: classifiedCandidates.length,
				topCandidateWindow,
				topCandidateOverlapCount,
				defaultSupportIdentityHash: createSupportIdentityHash( defaultSupport ),
				classifiedSupportIdentityHash: createSupportIdentityHash( classifiedSupport ),
				defaultSupportLayerMaskHash: createSupportLayerMaskHash( defaultSupport, probeLayerMasks ),
				classifiedSupportLayerMaskHash: createSupportLayerMaskHash( classifiedSupport, probeLayerMasks ),
				defaultSupportGridCoordHash: createSupportGridCoordHash( defaultSupport ),
				classifiedSupportGridCoordHash: createSupportGridCoordHash( classifiedSupport ),
				defaultSupportGridCoordSummary: summarizeSupportGridCoords( defaultSupport ),
				classifiedSupportGridCoordSummary: summarizeSupportGridCoords( classifiedSupport ),
				supportHashPolicy: 'ordered-probe-index-fnv1a32',
				identityChangeCount: identity.identityChangeCount,
				identityChangeRatio: identity.identityChangeRatio,
				defaultSupportBoundaryCompatibleCount,
				defaultSupportBoundaryCompatibilityRatio: roundMetric( defaultSupportBoundaryCompatibleCount / Math.max( supportSize, 1 ) ),
				classifiedSupportDefaultCompatibleCount,
				classifiedSupportBoundaryCompatibleCount,
				defaultOccupiedSupportCount: defaultSupportSummary.occupiedSupportCount,
				classifiedOccupiedSupportCount: classifiedSupportSummary.occupiedSupportCount,
				defaultMeanDistanceSq: defaultSupportSummary.meanDistanceSq,
				classifiedMeanDistanceSq: classifiedSupportSummary.meanDistanceSq,
				blockerVerdict
			};

		};
		const createSideSymmetryVariantFacts = ( variantLabel, variantAssignment, leftReceiverPoint, rightReceiverPoint ) => {

			const probeLayerMasks = variantAssignment.probeLayerMasks;
			const createSideFacts = ( side, position, boundaryMask ) => {

				const defaultCandidates = createNearestSupportCandidates( position, defaultMask, probeLayerMasks );
				const classifiedCandidates = createNearestSupportCandidates( position, boundaryMask, probeLayerMasks );

				return createSupportRankFacts( {
					side,
					boundaryMask,
					defaultCandidates,
					classifiedCandidates,
					defaultSupport: defaultCandidates.slice( 0, supportSize ),
					classifiedSupport: classifiedCandidates.slice( 0, supportSize ),
					probeLayerMasks
				} );

			};
			const left = createSideFacts( 'left', leftReceiverPoint, leftBoundaryMask );
			const right = createSideFacts( 'right', rightReceiverPoint, rightBoundaryMask );

			return {
				variantLabel,
				assignmentPolicy: variantAssignment.assignmentFacts.policyId,
				probeOwnershipMaskMode: variantAssignment.assignmentFacts.probeOwnershipMaskMode,
				assignedProbeCount: variantAssignment.assignmentFacts.assignedProbeCount,
				compatibleOverlapCount: variantAssignment.assignmentFacts.compatibleOverlapCount,
				left,
				right,
				sideSymmetryVerdict: left.blockerVerdict === 'side-has-setup-identity-change' &&
					right.blockerVerdict === 'side-has-setup-identity-change' ?
					'candidate-has-bilateral-identity-change' :
					left.blockerVerdict === 'blocked-incomplete-classified-support' ||
					right.blockerVerdict === 'blocked-incomplete-classified-support' ?
						'rejected-incomplete-classified-support' :
					right.identityChangeCount === 0 ?
						'rejected-right-side-identity-fixed' :
						'rejected-left-side-identity-fixed'
			};

		};
		const readSupportCoefficientComparison = async ( defaultSupport, classifiedSupport, side, hasIdentityChange ) => {

			const readSupportMean = async support => {

				const probes = await Promise.all( support.map( probe =>
					readLightProbeGridGPUProbeCoefficients(
						_lightProbeContext.renderer,
						_lightProbeContext.probeGrid,
						probe.probeIndex,
						resolution
					)
				) );
				const mean = probes.reduce( ( sum, probe ) => {

					sum.r += probe.l0Irradiance.r;
					sum.g += probe.l0Irradiance.g;
					sum.b += probe.l0Irradiance.b;
					return sum;

				}, { r: 0, g: 0, b: 0 } );
				const sampleCount = Math.max( probes.length, 1 );

				mean.r = roundMetric( mean.r / sampleCount );
				mean.g = roundMetric( mean.g / sampleCount );
				mean.b = roundMetric( mean.b / sampleCount );

				const correctMean = side === 'left' ? mean.r : mean.g;
				const wrongMean = side === 'left' ? mean.g : mean.r;

				return {
					supportSize: support.length,
					meanL0Irradiance: mean,
					correctSideMean: roundMetric( correctMean ),
					wrongSideMean: roundMetric( wrongMean ),
					wrongToCorrectRatio: roundMetric( wrongMean / Math.max( correctMean, PROOF_RATIO_DENOMINATOR_EPSILON ) )
				};

			};
			const defaultCoefficient = await readSupportMean( defaultSupport );
			const classifiedCoefficient = await readSupportMean( classifiedSupport );
			const wrongToCorrectRatioDelta = roundMetric(
				classifiedCoefficient.wrongToCorrectRatio - defaultCoefficient.wrongToCorrectRatio
			);
			const coefficientComparisonVerdict = hasIdentityChange === false ?
				'blocked-no-probe-identity-change' :
				wrongToCorrectRatioDelta < - 0.01 ?
					'identity-change-reduces-wrong-side-l0' :
					'identity-change-no-wrong-side-l0-win';

			return {
				coefficientPolicy: 'packed-atlas-l0-support-mean',
				readbackPolicy: 'support-probe-packed-atlas-readback',
				representedContrastAvailable: representedContrast?.candidateVerdict === 'candidate-has-cross-side-coefficient-contrast',
				crossSideChangedCoefficientIrradianceRatio: representedContrast?.crossSideChangedCoefficientIrradianceRatio ?? null,
				defaultCoefficient,
				classifiedCoefficient,
				wrongToCorrectRatioDelta,
				coefficientComparisonVerdict
			};

		};
		const createCoefficientProofFacts = ( hasIdentityChange, coefficientComparisonVerdict ) => ( {
			coefficientPolicy: 'packed-atlas-l0-support-mean',
			representedContrastAvailable: representedContrast?.candidateVerdict === 'candidate-has-cross-side-coefficient-contrast',
			crossSideChangedCoefficientIrradianceRatio: representedContrast?.crossSideChangedCoefficientIrradianceRatio ?? null,
			comparisonStatus: hasIdentityChange ?
				'isolated-packed-atlas-readback-complete' :
				'blocked-no-probe-identity-change',
			coefficientComparisonVerdict
		} );
		const createSideCandidate = async ( label, receiver, side, boundaryMask ) => {

			const position = createReceiverEdgePoint( receiver, side );
			const defaultSupport = createNearestSupport( position, defaultMask );
			const classifiedSupport = createNearestSupport( position, boundaryMask );
			const identity = compareSupportIdentity( defaultSupport, classifiedSupport );
			const hasIdentityChange = identity.identityChangeCount > 0;
			const coefficientComparison = await readSupportCoefficientComparison( defaultSupport, classifiedSupport, side, hasIdentityChange );
			const coefficientProof = createCoefficientProofFacts( hasIdentityChange, coefficientComparison.coefficientComparisonVerdict );
			const descriptorFacts = {
				debugDefault: createDescriptorFacts( 'debug-default', side, defaultMask, 0, defaultSupport ),
				debugSetupClassified: createDescriptorFacts( 'debug-setup-classified', side, boundaryMask, 1, classifiedSupport ),
				renderGuardSetupClassified: createDescriptorFacts( 'render-guard-setup-classified', side, boundaryMask, 1, classifiedSupport )
			};

			return {
				label,
				side,
				receiverPointPolicy: 'world-bounds-near-divider-edge',
				receiverMask: boundaryMask,
				defaultSupport: summarizeSupport( defaultSupport ),
				classifiedSupport: summarizeSupport( classifiedSupport ),
				descriptorCompatibility: summarizeDefaultCompatibility( classifiedSupport, boundaryMask ),
				descriptorFacts,
				identity,
				coefficientProof,
				coefficientComparison,
				classificationVerdict: hasIdentityChange ?
					'candidate-changes-probe-identity' :
					'rejected-no-probe-identity-change'
			};

		};
		const leftReceiverPoint = createReceiverEdgePoint( _lightProbeContext.leakFixture.leftReceiver, 'left' );
		const rightReceiverPoint = createReceiverEdgePoint( _lightProbeContext.leakFixture.rightReceiver, 'right' );
		const candidates = [
			await createSideCandidate( 'setup-left-boundary-probe-classification', _lightProbeContext.leakFixture.leftReceiver, 'left', leftBoundaryMask ),
			await createSideCandidate( 'setup-right-boundary-probe-classification', _lightProbeContext.leakFixture.rightReceiver, 'right', rightBoundaryMask )
		];
		const hasUsefulIdentityChange = candidates.some( candidate =>
			candidate.classificationVerdict === 'candidate-changes-probe-identity' &&
			candidate.coefficientProof.representedContrastAvailable === true );
		const captureRenderOnlyGuard = () => {

			const originalProbeLayerMasks = _lightProbeContext.probeGrid.probeLayerMaskSource;

			try {

				_lightProbeContext.probeGrid.setOptions( {
					probeLayerMasks: assignment.probeLayerMasks
				}, _lightProbeContext.renderer );

				const renderFacts = captureReceiverBoundaryMaskAlignmentRenderFacts( {
					attributionPolicy: 'setup-side-classification-render-guard',
					leftBoundaryLayerMask: leftBoundaryMask,
					rightBoundaryLayerMask: rightBoundaryMask
				} );

				return {
					attributionPolicy: 'setup-side-classification-render-guard',
					proofBoundary: 'rendered-ratio-attribution-only',
					leftBoundaryLayerMask: leftBoundaryMask,
					rightBoundaryLayerMask: rightBoundaryMask,
					receiverBoundaryMode: renderFacts.receiverBoundaryMode,
					rawBoundaryWeight: renderFacts.rawBoundaryWeight,
					maskedWrongSideColorRatio: renderFacts.maskedWrongSideColorRatio,
					preToneMaskedWrongSideColorRatio: renderFacts.preToneMaskedWrongSideColorRatio,
					preToneMaskedCorrectBounceRatio: renderFacts.preToneMaskedCorrectBounceRatio,
					correctBounceRatio: renderFacts.correctBounceRatio,
					candidateDescriptors: candidates.map( candidate => candidate.descriptorFacts.renderGuardSetupClassified ),
					renderGuardVerdict: renderFacts.correctBounceRatio > 0.75 ?
						'candidate-survives-render-guard' :
						'candidate-fails-render-guard'
				};

			} finally {

				_lightProbeContext.probeGrid.setOptions( {
					probeLayerMasks: originalProbeLayerMasks
				}, _lightProbeContext.renderer );

			}

		};
		const captureFinalIrradianceDebug = () => {

			const originalProbeLayerMasks = _lightProbeContext.probeGrid.probeLayerMaskSource;
			const summarizeMode = modeFacts => ( {
				boundaryToDefaultRatio: modeFacts.boundaryToDefaultRatio,
				leftBoundaryToDefaultRatio: modeFacts.leftBoundaryToDefaultRatio,
				rightBoundaryToDefaultRatio: modeFacts.rightBoundaryToDefaultRatio
			} );
			const hasNonNeutralRatio = modeFacts =>
				Math.abs( modeFacts.boundaryToDefaultRatio - 1 ) > PROOF_DEBUG_RATIO_DELTA_EPSILON ||
				Math.abs( modeFacts.leftBoundaryToDefaultRatio - 1 ) > PROOF_DEBUG_RATIO_DELTA_EPSILON ||
				Math.abs( modeFacts.rightBoundaryToDefaultRatio - 1 ) > PROOF_DEBUG_RATIO_DELTA_EPSILON;

			try {

				_lightProbeContext.probeGrid.setOptions( {
					probeLayerMasks: assignment.probeLayerMasks
				}, _lightProbeContext.renderer );

				const massFacts = captureReceiverSamplingMassAttributionFacts( {
					leftBoundaryLayerMask: leftBoundaryMask,
					rightBoundaryLayerMask: rightBoundaryMask,
					includeIrradianceDebug: true,
					includeNeighborAttribution: false
				} );

				if ( massFacts === null ) return null;

				return {
					attributionPolicy: 'setup-side-classification-final-irradiance-debug',
					proofBoundary: 'debug-node-final-irradiance-attribution-only',
					leftBoundaryLayerMask: leftBoundaryMask,
					rightBoundaryLayerMask: rightBoundaryMask,
					receiverBoundaryMode: massFacts.receiverBoundaryMode,
					rawBoundaryWeight: massFacts.rawBoundaryWeight,
					scalarWeight: summarizeMode( massFacts.scalarWeight ),
					visibilityWeight: summarizeMode( massFacts.visibilityWeight ),
					visibilityMass: summarizeMode( massFacts.visibilityMass ),
					scalarIrradiance: summarizeMode( massFacts.scalarIrradiance ),
					visibilityIrradiance: summarizeMode( massFacts.visibilityIrradiance ),
					finalIrradiance: summarizeMode( massFacts.finalIrradiance ),
					finalIrradianceDebugVerdict: hasNonNeutralRatio( massFacts.finalIrradiance ) ?
						'candidate-has-final-irradiance-debug-delta' :
						'candidate-neutralized-by-final-irradiance-debug-node'
				};

			} finally {

				_lightProbeContext.probeGrid.setOptions( {
					probeLayerMasks: originalProbeLayerMasks
				}, _lightProbeContext.renderer );

			}

		};
		const createDebugDescriptorCompatibilityAttribution = ( renderGuard, finalIrradianceDebug ) => {

			const renderDescriptorBySide = new Map( renderGuard?.candidateDescriptors?.map( descriptor => [ descriptor.side, descriptor ] ) ?? [] );
			const sideFacts = candidates.map( candidate => {

				const defaultDescriptor = candidate.descriptorFacts.debugDefault;
				const setupClassifiedDescriptor = candidate.descriptorFacts.debugSetupClassified;
				const renderGuardDescriptor = renderDescriptorBySide.get( candidate.side );
				const debugRenderParity = compareDescriptorFacts( setupClassifiedDescriptor, renderGuardDescriptor );
				const defaultSetupParity = compareDescriptorFacts(
					defaultDescriptor,
					setupClassifiedDescriptor,
					'default-setup-descriptor-collapse',
					'default-setup-descriptor-split'
				);

				return {
					label: candidate.label,
					side: candidate.side,
					probeMaskSource: setupClassifiedDescriptor.probeMaskSource,
					receiverMask: candidate.receiverMask,
					receiverLayerMask: setupClassifiedDescriptor.receiverLayerMask,
					receiverBoundaryLayerMask: setupClassifiedDescriptor.receiverBoundaryLayerMask,
					identityChangeCount: candidate.identity.identityChangeCount,
					defaultDescriptor,
					setupClassifiedDescriptor,
					renderGuardDescriptor,
					debugRenderParity,
					defaultSetupParity,
					defaultAndBoundaryCompatibilityRatio: candidate.descriptorCompatibility.defaultAndBoundaryCompatibilityRatio,
					defaultAndBoundaryCompatibleCount: candidate.descriptorCompatibility.defaultAndBoundaryCompatibleCount,
					supportSize: candidate.descriptorCompatibility.supportSize,
					descriptorVerdict: candidate.descriptorCompatibility.defaultAndBoundaryCompatibleCount === candidate.descriptorCompatibility.supportSize ?
						'default-and-boundary-descriptors-share-classified-support' :
						'default-and-boundary-descriptors-split-classified-support'
				};

			} );
			const hasDebugRenderParity = sideFacts.every( side =>
				side.debugRenderParity.descriptorParityVerdict === 'debug-render-descriptor-parity'
			);
			const finalIrradianceNeutralized = finalIrradianceDebug?.finalIrradianceDebugVerdict ===
				'candidate-neutralized-by-final-irradiance-debug-node';

			return {
				attributionPolicy: 'setup-side-debug-descriptor-compatibility',
				proofBoundary: 'cpu-support-mask-attribution-only',
				defaultMask,
				leftBoundaryLayerMask: leftBoundaryMask,
				rightBoundaryLayerMask: rightBoundaryMask,
				defaultCompatibilityPolicy: 'classification-keeps-default-bit-for-default-equivalence',
				sideFacts,
				descriptorCompatibilityVerdict: sideFacts.every( side =>
					side.descriptorVerdict === 'default-and-boundary-descriptors-share-classified-support'
				) ?
					'debug-boundary-default-ratio-neutralized-by-default-compatible-masks' :
					'debug-boundary-default-ratio-can-observe-support-split',
				debugRenderDescriptorVerdict: hasDebugRenderParity ?
					finalIrradianceNeutralized ?
						'archive-setup-side-coefficient-lead-after-reconstruction-neutralization' :
						'descriptor-parity-with-final-irradiance-delta' :
					'debug-render-descriptor-attribution-mismatch'
			};

		};
		const createSideSymmetryAttribution = () => {

			const variants = [
				createSideSymmetryVariantFacts(
					'overlap-default-compatible-boundary-sublayers',
					assignment,
					leftReceiverPoint,
					rightReceiverPoint
				),
				createSideSymmetryVariantFacts(
					'strict-default-compatible-boundary-sublayers',
					createMultiClassBoundaryProbeOwnershipAssignment( {
						overlapBoundarySublayers: false
					} ),
					leftReceiverPoint,
					rightReceiverPoint
				)
			];
			const hasBilateralIdentityChange = variants.some( variant =>
				variant.sideSymmetryVerdict === 'candidate-has-bilateral-identity-change'
			);
			const rightIdentityFixedVariantCount = variants.filter( variant =>
				variant.right.identityChangeCount === 0
			).length;

			return {
				attributionPolicy: 'setup-side-classification-side-symmetry',
				proofBoundary: 'cpu-support-rank-mask-attribution-only',
				candidateShape: 'default-compatible-side-boundary-sublayers',
				receiverPointPolicy: 'world-bounds-near-divider-edge',
				leftBoundaryLayerMask: leftBoundaryMask,
				rightBoundaryLayerMask: rightBoundaryMask,
				testedVariantCount: variants.length,
				rightIdentityFixedVariantCount,
				variants,
				gate3Verdict: hasBilateralIdentityChange ?
					'continue-setup-side-classification-product-candidate' :
					'archive-setup-side-classification-left-only'
			};

		};
		const createProbeSideClassificationVariantFacts = async ( {
			attributionPolicy,
			candidateShape,
			excludeOccupiedSupport
		} ) => {

			const createProbeSideFacts = async ( side, position, boundaryMask ) => {

				const defaultCandidates = createNearestSupportCandidates( position, defaultMask, assignment.probeLayerMasks );
				const boundaryCandidates = createNearestSupportCandidates( position, boundaryMask, assignment.probeLayerMasks );
				const defaultSupport = defaultCandidates.slice( 0, supportSize );
				const defaultSupportIndices = new Set( defaultSupport.map( probe => probe.probeIndex ) );
				const probeSideCandidates = boundaryCandidates.filter( probe =>
					defaultSupportIndices.has( probe.probeIndex ) === false &&
					( excludeOccupiedSupport === false || probe.occupied === false )
				);
				const probeSideSupport = probeSideCandidates.slice( 0, supportSize );

				const supportRank = createSupportRankFacts( {
					side,
					boundaryMask,
					defaultCandidates,
					classifiedCandidates: probeSideCandidates,
					defaultSupport,
					classifiedSupport: probeSideSupport,
					probeLayerMasks: assignment.probeLayerMasks
				} );
				const hasIdentityChange = supportRank.blockerVerdict === 'side-has-setup-identity-change';
				const coefficientComparison = await readSupportCoefficientComparison( defaultSupport, probeSideSupport, side, hasIdentityChange );

				return {
					...supportRank,
					coefficientComparison
				};

			};
			const left = await createProbeSideFacts( 'left', leftReceiverPoint, leftBoundaryMask );
			const right = await createProbeSideFacts( 'right', rightReceiverPoint, rightBoundaryMask );
			const hasBilateralIdentityChange = left.blockerVerdict === 'side-has-setup-identity-change' &&
				right.blockerVerdict === 'side-has-setup-identity-change';
			const coefficientVerdicts = [ left, right ].map( side => side.coefficientComparison.coefficientComparisonVerdict );
			const hasAnyCoefficientWin = coefficientVerdicts.includes( 'identity-change-reduces-wrong-side-l0' );
			const hasAnyCoefficientLoss = coefficientVerdicts.includes( 'identity-change-no-wrong-side-l0-win' );

			return {
				attributionPolicy,
				proofBoundary: 'cpu-support-rank-mask-attribution-only',
				coefficientPolicy: 'packed-atlas-l0-support-mean',
				candidateShape,
				excludeOccupiedSupport,
				receiverPointPolicy: 'world-bounds-near-divider-edge',
				leftBoundaryLayerMask: leftBoundaryMask,
				rightBoundaryLayerMask: rightBoundaryMask,
				left,
				right,
				probeSideClassificationVerdict: hasBilateralIdentityChange ?
					'candidate-has-bilateral-probe-identity-change' :
					'candidate-needs-relocation-after-probe-side-classification',
				probeSideCoefficientVerdict: hasBilateralIdentityChange === false ?
					'blocked-no-bilateral-probe-identity-change' :
					hasAnyCoefficientWin && hasAnyCoefficientLoss === false ?
						'candidate-reduces-wrong-side-l0-bilaterally' :
						hasAnyCoefficientWin ?
							'candidate-has-mixed-probe-side-l0-result' :
							'candidate-has-no-probe-side-l0-win'
			};

		};
		const createProbeSideClassificationAttribution = async () => {

			const defaultOverlapExclusion = await createProbeSideClassificationVariantFacts( {
				attributionPolicy: 'probe-side-classification-default-overlap-exclusion',
				candidateShape: 'exclude-default-support-probes-from-boundary-class',
				excludeOccupiedSupport: false
			} );
			const occupiedSupportExclusion = await createProbeSideClassificationVariantFacts( {
				attributionPolicy: 'probe-side-classification-occupied-support-exclusion',
				candidateShape: 'exclude-default-and-occupied-support-probes-from-boundary-class',
				excludeOccupiedSupport: true
			} );
			const hasPromotableCoefficientCandidate =
				occupiedSupportExclusion.probeSideClassificationVerdict === 'candidate-has-bilateral-probe-identity-change' &&
				occupiedSupportExclusion.probeSideCoefficientVerdict === 'candidate-reduces-wrong-side-l0-bilaterally';

			return {
				attributionPolicy: 'probe-side-classification-candidate-set',
				proofBoundary: 'cpu-support-rank-and-l0-attribution-only',
				candidateShape: 'probe-side-boundary-support-exclusion-candidates',
				candidateCount: 2,
				defaultOverlapExclusion,
				occupiedSupportExclusion,
				probeSideLaneVerdict: hasPromotableCoefficientCandidate ?
					'continue-probe-side-classification-to-irradiance-gate' :
					'candidate-needs-relocation-after-probe-side-classification'
			};

		};
		const createProbeSideRelocationOracleAttribution = async () => {

			const readProbeL0Facts = async ( probe, side ) => {

				const coefficients = await readLightProbeGridGPUProbeCoefficients(
					_lightProbeContext.renderer,
					_lightProbeContext.probeGrid,
					probe.probeIndex,
					resolution
				);
				const correctSideMean = side === 'left' ? coefficients.l0Irradiance.r : coefficients.l0Irradiance.g;
				const wrongSideMean = side === 'left' ? coefficients.l0Irradiance.g : coefficients.l0Irradiance.r;

				return {
					...probe,
					correctSideMean: roundMetric( correctSideMean ),
					wrongSideMean: roundMetric( wrongSideMean ),
					wrongToCorrectRatio: roundMetric( wrongSideMean / Math.max(
						correctSideMean,
						PROOF_RATIO_DENOMINATOR_EPSILON
					) )
				};

			};
			const createRelocationSideFacts = async ( side, position, boundaryMask ) => {

				const defaultCandidates = createNearestSupportCandidates( position, defaultMask, assignment.probeLayerMasks );
				const boundaryCandidates = createNearestSupportCandidates( position, boundaryMask, assignment.probeLayerMasks );
				const defaultSupport = defaultCandidates.slice( 0, supportSize );
				const defaultSupportIndices = new Set( defaultSupport.map( probe => probe.probeIndex ) );
				const relocationCandidatePool = boundaryCandidates.filter( probe =>
					defaultSupportIndices.has( probe.probeIndex ) === false &&
					probe.occupied === false
				);
				const scoredCandidates = await Promise.all( relocationCandidatePool.map( probe => readProbeL0Facts( probe, side ) ) );
				const relocatedSupport = scoredCandidates
					.sort( ( a, b ) => a.wrongToCorrectRatio - b.wrongToCorrectRatio || a.distanceSq - b.distanceSq )
					.slice( 0, supportSize );
				const supportRank = createSupportRankFacts( {
					side,
					boundaryMask,
					defaultCandidates,
					classifiedCandidates: scoredCandidates,
					defaultSupport,
					classifiedSupport: relocatedSupport,
					probeLayerMasks: assignment.probeLayerMasks
				} );
				const hasIdentityChange = supportRank.blockerVerdict === 'side-has-setup-identity-change';
				const coefficientComparison = await readSupportCoefficientComparison( defaultSupport, relocatedSupport, side, hasIdentityChange );

				return {
					...supportRank,
					relocationCandidatePoolCount: relocationCandidatePool.length,
					relocationRankingPolicy: 'non-occupied-boundary-probe-lowest-l0-wrong-to-correct',
					coefficientComparison
				};

			};
			const left = await createRelocationSideFacts( 'left', leftReceiverPoint, leftBoundaryMask );
			const right = await createRelocationSideFacts( 'right', rightReceiverPoint, rightBoundaryMask );
			const hasBilateralIdentityChange = left.blockerVerdict === 'side-has-setup-identity-change' &&
				right.blockerVerdict === 'side-has-setup-identity-change';
			const hasCompleteNonOccupiedSupport = left.classifiedOccupiedSupportCount === 0 &&
				right.classifiedOccupiedSupportCount === 0 &&
				left.classifiedCandidateCount >= supportSize &&
				right.classifiedCandidateCount >= supportSize;
			const hasBilateralCoefficientWin =
				left.coefficientComparison.coefficientComparisonVerdict === 'identity-change-reduces-wrong-side-l0' &&
				right.coefficientComparison.coefficientComparisonVerdict === 'identity-change-reduces-wrong-side-l0';

			return {
				attributionPolicy: 'probe-side-relocation-l0-oracle',
				proofBoundary: 'cpu-oracle-support-rank-and-l0-attribution-only',
				coefficientPolicy: 'packed-atlas-l0-support-mean',
				candidateShape: 'non-occupied-boundary-probe-l0-ranked-relocation-oracle',
				receiverPointPolicy: 'world-bounds-near-divider-edge',
				leftBoundaryLayerMask: leftBoundaryMask,
				rightBoundaryLayerMask: rightBoundaryMask,
				left,
				right,
				relocationOracleVerdict: hasBilateralIdentityChange && hasCompleteNonOccupiedSupport && hasBilateralCoefficientWin ?
					'oracle-finds-bilateral-l0-relocation-candidate' :
					'oracle-fails-bilateral-l0-relocation-candidate'
			};

		};
		const createProbeSideRelocationProxyAttribution = async ( {
			attributionPolicy,
			candidateShape,
			relocationRankingPolicy,
			sortCandidates,
			createSideSortCandidates = null
		} ) => {

			const createProxySideFacts = async ( side, position, boundaryMask ) => {

				const defaultCandidates = createNearestSupportCandidates( position, defaultMask, assignment.probeLayerMasks );
				const boundaryCandidates = createNearestSupportCandidates( position, boundaryMask, assignment.probeLayerMasks );
				const defaultSupport = defaultCandidates.slice( 0, supportSize );
				const defaultSupportIndices = new Set( defaultSupport.map( probe => probe.probeIndex ) );
				const relocationCandidatePool = boundaryCandidates.filter( probe =>
					defaultSupportIndices.has( probe.probeIndex ) === false &&
					probe.occupied === false
				);
				const proxyCandidates = [ ...relocationCandidatePool ].sort(
					createSideSortCandidates === null ? sortCandidates : createSideSortCandidates( side )
				);
				const relocatedSupport = proxyCandidates.slice( 0, supportSize );
				const supportRank = createSupportRankFacts( {
					side,
					boundaryMask,
					defaultCandidates,
					classifiedCandidates: proxyCandidates,
					defaultSupport,
					classifiedSupport: relocatedSupport,
					probeLayerMasks: assignment.probeLayerMasks
				} );
				const hasIdentityChange = supportRank.blockerVerdict === 'side-has-setup-identity-change';
				const coefficientComparison = await readSupportCoefficientComparison( defaultSupport, relocatedSupport, side, hasIdentityChange );

				return {
					...supportRank,
					relocationCandidatePoolCount: relocationCandidatePool.length,
					relocationRankingPolicy,
					coefficientComparison
				};

			};
			const left = await createProxySideFacts( 'left', leftReceiverPoint, leftBoundaryMask );
			const right = await createProxySideFacts( 'right', rightReceiverPoint, rightBoundaryMask );
			const hasBilateralIdentityChange = left.blockerVerdict === 'side-has-setup-identity-change' &&
				right.blockerVerdict === 'side-has-setup-identity-change';
			const hasCompleteNonOccupiedSupport = left.classifiedOccupiedSupportCount === 0 &&
				right.classifiedOccupiedSupportCount === 0 &&
				left.classifiedCandidateCount >= supportSize &&
				right.classifiedCandidateCount >= supportSize;
			const hasBilateralCoefficientWin =
				left.coefficientComparison.coefficientComparisonVerdict === 'identity-change-reduces-wrong-side-l0' &&
				right.coefficientComparison.coefficientComparisonVerdict === 'identity-change-reduces-wrong-side-l0';

			return {
				attributionPolicy,
				proofBoundary: 'cpu-support-rank-and-l0-attribution-only',
				coefficientPolicy: 'packed-atlas-l0-support-mean',
				candidateShape,
				receiverPointPolicy: 'world-bounds-near-divider-edge',
				leftBoundaryLayerMask: leftBoundaryMask,
				rightBoundaryLayerMask: rightBoundaryMask,
				left,
				right,
				relocationProxyVerdict: hasBilateralIdentityChange && hasCompleteNonOccupiedSupport && hasBilateralCoefficientWin ?
					'proxy-finds-bilateral-l0-relocation-candidate' :
					'proxy-fails-bilateral-l0-relocation-candidate'
			};

		};
		const createProbeSideRelocationDistanceProxyAttribution = async () => {

			return createProbeSideRelocationProxyAttribution( {
				attributionPolicy: 'probe-side-relocation-distance-proxy',
				candidateShape: 'non-occupied-boundary-probe-distance-ranked-relocation-proxy',
				relocationRankingPolicy: 'non-occupied-boundary-probe-farthest-from-receiver-edge',
				sortCandidates: ( a, b ) => b.distanceSq - a.distanceSq
			} );

		};
		const createProbeSideRelocationDividerProxyAttribution = async () => {

			const divider = _lightProbeContext.getActiveLeakDivider();
			const dividerX = divider !== null && divider !== undefined ? divider.position.x : - 0.8667;
			const scoreDividerDistanceSq = probe => {

				getProbePosition( probe.probeIndex, probePosition );
				const deltaX = probePosition.x - dividerX;

				return deltaX * deltaX;

			};

			return createProbeSideRelocationProxyAttribution( {
				attributionPolicy: 'probe-side-relocation-divider-proxy',
				candidateShape: 'non-occupied-boundary-probe-divider-ranked-relocation-proxy',
				relocationRankingPolicy: 'non-occupied-boundary-probe-closest-to-divider-then-nearest-receiver',
				sortCandidates: ( a, b ) => scoreDividerDistanceSq( a ) - scoreDividerDistanceSq( b ) ||
					a.distanceSq - b.distanceSq
			} );

		};
		const createProbeSideRelocationVisibilityProxyAttribution = async () => {

			const createVisibilitySideFacts = async ( side, position, boundaryMask ) => {

				const defaultCandidates = createNearestSupportCandidates( position, defaultMask, assignment.probeLayerMasks );
				const boundaryCandidates = createNearestSupportCandidates( position, boundaryMask, assignment.probeLayerMasks );
				const defaultSupport = defaultCandidates.slice( 0, supportSize );
				const defaultSupportIndices = new Set( defaultSupport.map( probe => probe.probeIndex ) );
				const relocationCandidatePool = boundaryCandidates.filter( probe =>
					defaultSupportIndices.has( probe.probeIndex ) === false &&
					probe.occupied === false
				);
				const selfShadowBias = _lightProbeContext.probeGrid.selfShadowBias?.value ?? 0;
				const visibilityMix = Math.max( 0, Math.min(
					1,
					_lightProbeContext.probeGrid.visibilityDepthWeighting?.value ?? 1
				) );
				const readVisibilityScore = async probe => {

					const candidatePosition = new THREE.Vector3();
					const receiverDirection = new THREE.Vector3();

					getProbePosition( probe.probeIndex, candidatePosition );
					receiverDirection.subVectors( position, candidatePosition );
					const receiverDistance = receiverDirection.length();
					receiverDirection.normalize();

					const moment = await readLightProbeGridGPUVisibilityMoment(
						_lightProbeContext.renderer,
						_lightProbeContext.probeGrid,
						receiverDirection,
						probe.probeIndex,
						VISIBILITY_MIN_VARIANCE
					);
					const variance = Math.max( moment.variance, VISIBILITY_MIN_VARIANCE );
					const delta = Math.max( receiverDistance - moment.meanDistance - selfShadowBias, 0 );
					const chebyshev = variance / ( variance + delta * delta );
					const hitConfidence = Math.max( 0, Math.min( 1, moment.hitConfidence ) );
					const momentVisibility = Math.max( 0, Math.min(
						1,
						1 - hitConfidence + chebyshev * hitConfidence
					) );
					const estimatedVisibility = 1 - visibilityMix + momentVisibility * visibilityMix;

					return {
						...probe,
						visibilityReceiverDistance: roundMetric( receiverDistance ),
						visibilityMeanDistance: roundMetric( moment.meanDistance ),
						visibilityHitConfidence: roundMetric( hitConfidence ),
						visibilityEstimate: roundMetric( estimatedVisibility )
					};

				};
				const scoredCandidates = await Promise.all( relocationCandidatePool.map( readVisibilityScore ) );
				const proxyCandidates = scoredCandidates.sort( ( a, b ) => b.visibilityEstimate - a.visibilityEstimate ||
					a.distanceSq - b.distanceSq );
				const relocatedSupport = proxyCandidates.slice( 0, supportSize );
				const supportRank = createSupportRankFacts( {
					side,
					boundaryMask,
					defaultCandidates,
					classifiedCandidates: proxyCandidates,
					defaultSupport,
					classifiedSupport: relocatedSupport,
					probeLayerMasks: assignment.probeLayerMasks
				} );
				const hasIdentityChange = supportRank.blockerVerdict === 'side-has-setup-identity-change';
				const coefficientComparison = await readSupportCoefficientComparison( defaultSupport, relocatedSupport, side, hasIdentityChange );
				const meanVisibilityEstimate = relocatedSupport.reduce( ( sum, probe ) =>
					sum + probe.visibilityEstimate, 0 ) / Math.max( relocatedSupport.length, 1 );

				return {
					...supportRank,
					relocationCandidatePoolCount: relocationCandidatePool.length,
					relocationRankingPolicy: 'non-occupied-boundary-probe-highest-moment-visibility-to-receiver',
					classifiedMeanVisibilityEstimate: roundMetric( meanVisibilityEstimate ),
					coefficientComparison
				};

			};
			const left = await createVisibilitySideFacts( 'left', leftReceiverPoint, leftBoundaryMask );
			const right = await createVisibilitySideFacts( 'right', rightReceiverPoint, rightBoundaryMask );
			const hasBilateralIdentityChange = left.blockerVerdict === 'side-has-setup-identity-change' &&
				right.blockerVerdict === 'side-has-setup-identity-change';
			const hasCompleteNonOccupiedSupport = left.classifiedOccupiedSupportCount === 0 &&
				right.classifiedOccupiedSupportCount === 0 &&
				left.classifiedCandidateCount >= supportSize &&
				right.classifiedCandidateCount >= supportSize;
			const hasBilateralCoefficientWin =
				left.coefficientComparison.coefficientComparisonVerdict === 'identity-change-reduces-wrong-side-l0' &&
				right.coefficientComparison.coefficientComparisonVerdict === 'identity-change-reduces-wrong-side-l0';

			return {
				attributionPolicy: 'probe-side-relocation-visibility-proxy',
				proofBoundary: 'cpu-visibility-moment-rank-and-l0-attribution-only',
				coefficientPolicy: 'packed-atlas-l0-support-mean',
				candidateShape: 'non-occupied-boundary-probe-visibility-ranked-relocation-proxy',
				receiverPointPolicy: 'world-bounds-near-divider-edge',
				leftBoundaryLayerMask: leftBoundaryMask,
				rightBoundaryLayerMask: rightBoundaryMask,
				left,
				right,
				relocationProxyVerdict: hasBilateralIdentityChange && hasCompleteNonOccupiedSupport && hasBilateralCoefficientWin ?
					'proxy-finds-bilateral-l0-relocation-candidate' :
					'proxy-fails-bilateral-l0-relocation-candidate'
			};

		};
		const createSideShellSort = side => ( a, b ) => {

			const coordA = getLightProbeGridGPUProbeCoord( a.probeIndex, resolution );
			const coordB = getLightProbeGridGPUProbeCoord( b.probeIndex, resolution );
			const sideAxisDelta = side === 'left' ?
				coordA.x - coordB.x :
				coordB.x - coordA.x;

			return sideAxisDelta || a.distanceSq - b.distanceSq;

		};
		const createSideShellSupport = ( side, position, boundaryMask ) => {

			const defaultCandidates = createNearestSupportCandidates( position, defaultMask, assignment.probeLayerMasks );
			const boundaryCandidates = createNearestSupportCandidates( position, boundaryMask, assignment.probeLayerMasks );
			const defaultSupport = defaultCandidates.slice( 0, supportSize );
			const defaultSupportIndices = new Set( defaultSupport.map( probe => probe.probeIndex ) );
			const relocationCandidatePool = boundaryCandidates.filter( probe =>
				defaultSupportIndices.has( probe.probeIndex ) === false &&
				probe.occupied === false
			);

			return [ ...relocationCandidatePool ].sort( createSideShellSort( side ) ).slice( 0, supportSize );

		};
		const createSideShellProbeLayerMasks = baseProbeLayerMasks => {

			const probeLayerMasks = baseProbeLayerMasks === null || baseProbeLayerMasks === undefined ?
				new Uint32Array( occupancy.totalProbes ).fill( defaultMask ) :
				Uint32Array.from( baseProbeLayerMasks );
			const leftSupport = createSideShellSupport( 'left', leftReceiverPoint, leftBoundaryMask );
			const rightSupport = createSideShellSupport( 'right', rightReceiverPoint, rightBoundaryMask );

			for ( const probe of leftSupport ) {

				probeLayerMasks[ probe.probeIndex ] = probeLayerMasks[ probe.probeIndex ] | defaultMask | leftBoundaryMask;

			}

			for ( const probe of rightSupport ) {

				probeLayerMasks[ probe.probeIndex ] = probeLayerMasks[ probe.probeIndex ] | defaultMask | rightBoundaryMask;

			}

			return {
				probeLayerMasks,
				leftSupport,
				rightSupport
			};

		};
		const createProbeSideRelocationSideShellProxyAttribution = async () => {

			return createProbeSideRelocationProxyAttribution( {
				attributionPolicy: 'probe-side-relocation-side-shell-proxy',
				candidateShape: 'non-occupied-boundary-probe-side-shell-ranked-relocation-proxy',
				relocationRankingPolicy: 'non-occupied-boundary-probe-interior-side-shell-then-nearest-receiver',
				sortCandidates: ( a, b ) => a.distanceSq - b.distanceSq,
				createSideSortCandidates: side => createSideShellSort( side )
			} );

		};
		const createSideShellLocalCellReachabilityAttribution = () => {

			const createSideFacts = ( side, receiver, boundaryMask, receiverPoint ) => {

				const sideShellSupport = createSideShellSupport( side, receiverPoint, boundaryMask );
				const localCell = createLocalCellSupport( receiver, side );
				const sideShellIndices = new Set( sideShellSupport.map( probe => probe.probeIndex ) );
				const localCellOverlapCount = localCell.support.filter( probe => sideShellIndices.has( probe.probeIndex ) ).length;

				return {
					side,
					boundaryLayerMask: boundaryMask,
					samplePointPolicy: localCell.samplePointPolicy,
					normalBias: localCell.normalBias,
					viewBias: localCell.viewBias,
					probeCoord: localCell.probeCoord,
					baseCoord: localCell.baseCoord,
					localCellSupportIdentityHash: createSupportIdentityHash( localCell.support ),
					localCellSupportGridCoordHash: createSupportGridCoordHash( localCell.support ),
					localCellSupportGridCoordSummary: summarizeSupportGridCoords( localCell.support ),
					sideShellSupportIdentityHash: createSupportIdentityHash( sideShellSupport ),
					sideShellSupportGridCoordHash: createSupportGridCoordHash( sideShellSupport ),
					sideShellSupportGridCoordSummary: summarizeSupportGridCoords( sideShellSupport ),
					localCellOverlapCount,
					localCellOverlapRatio: roundMetric( localCellOverlapCount / Math.max( supportSize, 1 ) ),
					reachabilityVerdict: localCellOverlapCount === supportSize ?
						'side-shell-support-fully-reachable-by-local-cell' :
						localCellOverlapCount > 0 ?
							'side-shell-support-partially-reachable-by-local-cell' :
							'side-shell-support-not-reachable-by-local-cell'
				};

			};
			const left = createSideFacts( 'left', _lightProbeContext.leakFixture.leftReceiver, leftBoundaryMask, leftReceiverPoint );
			const right = createSideFacts( 'right', _lightProbeContext.leakFixture.rightReceiver, rightBoundaryMask, rightReceiverPoint );
			const hasFullReachability = left.reachabilityVerdict === 'side-shell-support-fully-reachable-by-local-cell' &&
				right.reachabilityVerdict === 'side-shell-support-fully-reachable-by-local-cell';

			return {
				attributionPolicy: 'probe-side-relocation-side-shell-local-cell-reachability',
				proofBoundary: 'cpu-local-cell-support-overlap-only',
				receiverPointPolicy: 'world-bounds-near-divider-edge',
				leftBoundaryLayerMask: leftBoundaryMask,
				rightBoundaryLayerMask: rightBoundaryMask,
				left,
				right,
				localCellReachabilityVerdict: hasFullReachability ?
					'side-shell-support-reachable-by-local-reconstruction-cell' :
					'side-shell-support-needs-true-local-cell-relocation'
			};

		};
		const createLocalCellRelocationCandidateAttribution = async () => {

			const createSideFacts = async ( side, receiver, position, boundaryMask ) => {

				const defaultCandidates = createNearestSupportCandidates( position, defaultMask, assignment.probeLayerMasks );
				const defaultSupport = defaultCandidates.slice( 0, supportSize );
				const localCell = createLocalCellSupport( receiver, side );
				const localCellSupport = localCell.support;
				const supportRank = createSupportRankFacts( {
					side,
					boundaryMask,
					defaultCandidates,
					classifiedCandidates: localCellSupport,
					defaultSupport,
					classifiedSupport: localCellSupport,
					probeLayerMasks: assignment.probeLayerMasks
				} );
				const hasIdentityChange = supportRank.blockerVerdict === 'side-has-setup-identity-change';
				const coefficientComparison = await readSupportCoefficientComparison( defaultSupport, localCellSupport, side, hasIdentityChange );

				return {
					...supportRank,
					samplePointPolicy: localCell.samplePointPolicy,
					normalBias: localCell.normalBias,
					viewBias: localCell.viewBias,
					probeCoord: localCell.probeCoord,
					baseCoord: localCell.baseCoord,
					relocationRankingPolicy: 'reachable-local-cell-support',
					coefficientComparison
				};

			};
			const left = await createSideFacts( 'left', _lightProbeContext.leakFixture.leftReceiver, leftReceiverPoint, leftBoundaryMask );
			const right = await createSideFacts( 'right', _lightProbeContext.leakFixture.rightReceiver, rightReceiverPoint, rightBoundaryMask );
			const hasBilateralIdentityChange = left.blockerVerdict === 'side-has-setup-identity-change' &&
				right.blockerVerdict === 'side-has-setup-identity-change';
			const hasCompleteNonOccupiedSupport = left.classifiedOccupiedSupportCount === 0 &&
				right.classifiedOccupiedSupportCount === 0 &&
				left.classifiedCandidateCount >= supportSize &&
				right.classifiedCandidateCount >= supportSize;
			const hasBilateralCoefficientWin =
				left.coefficientComparison.coefficientComparisonVerdict === 'identity-change-reduces-wrong-side-l0' &&
				right.coefficientComparison.coefficientComparisonVerdict === 'identity-change-reduces-wrong-side-l0';

			return {
				attributionPolicy: 'probe-side-relocation-local-cell-candidate',
				proofBoundary: 'cpu-local-cell-support-and-l0-attribution-only',
				coefficientPolicy: 'packed-atlas-l0-support-mean',
				candidateShape: 'reachable-local-cell-support-candidate',
				receiverPointPolicy: 'world-bounds-near-divider-edge',
				leftBoundaryLayerMask: leftBoundaryMask,
				rightBoundaryLayerMask: rightBoundaryMask,
				left,
				right,
				localCellCandidateVerdict: hasBilateralIdentityChange && hasCompleteNonOccupiedSupport && hasBilateralCoefficientWin ?
					'local-cell-support-has-bilateral-l0-win' :
					'local-cell-support-needs-physical-placement-relocation'
			};

		};
		const createPhysicalPlacementRequirementAttribution = async () => {

			const createSideFacts = async ( side, receiver, position, boundaryMask ) => {

				const defaultCandidates = createNearestSupportCandidates( position, defaultMask, assignment.probeLayerMasks );
				const defaultSupport = defaultCandidates.slice( 0, supportSize );
				const localCell = createLocalCellSupport( receiver, side );
				const targetSupport = localCell.support;
				const sourceSupport = createSideShellSupport( side, position, boundaryMask );
				const targetIndices = new Set( targetSupport.map( probe => probe.probeIndex ) );
				const sourceIndices = new Set( sourceSupport.map( probe => probe.probeIndex ) );
				const overlapCount = targetSupport.filter( probe => sourceIndices.has( probe.probeIndex ) ).length;
				const replacementSlotCount = targetSupport.filter( probe =>
					sourceIndices.has( probe.probeIndex ) === false
				).length;
				const occupiedReplacementSlotCount = targetSupport.filter( probe =>
					sourceIndices.has( probe.probeIndex ) === false && probe.occupied === true
				).length;
				const sourceOutsideLocalCellCount = sourceSupport.filter( probe =>
					targetIndices.has( probe.probeIndex ) === false
				).length;
				const targetComparison = await readSupportCoefficientComparison( defaultSupport, targetSupport, side, false );
				const sourceComparison = await readSupportCoefficientComparison( defaultSupport, sourceSupport, side, true );

				return {
					side,
					boundaryLayerMask: boundaryMask,
					samplePointPolicy: localCell.samplePointPolicy,
					normalBias: localCell.normalBias,
					viewBias: localCell.viewBias,
					targetProbeCoord: localCell.probeCoord,
					targetBaseCoord: localCell.baseCoord,
					targetSupportIdentityHash: createSupportIdentityHash( targetSupport ),
					targetSupportGridCoordHash: createSupportGridCoordHash( targetSupport ),
					targetSupportGridCoordSummary: summarizeSupportGridCoords( targetSupport ),
					sourceSupportIdentityHash: createSupportIdentityHash( sourceSupport ),
					sourceSupportGridCoordHash: createSupportGridCoordHash( sourceSupport ),
					sourceSupportGridCoordSummary: summarizeSupportGridCoords( sourceSupport ),
					overlapCount,
					replacementSlotCount,
					occupiedReplacementSlotCount,
					sourceOutsideLocalCellCount,
					targetOccupiedSupportCount: targetSupport.filter( probe => probe.occupied ).length,
					sourceOccupiedSupportCount: sourceSupport.filter( probe => probe.occupied ).length,
					targetCoefficientComparison: targetComparison,
					sourceCoefficientComparison: sourceComparison,
					placementRequirementVerdict: sourceComparison.coefficientComparisonVerdict === 'identity-change-reduces-wrong-side-l0' &&
						replacementSlotCount > 0 ?
						'physical-placement-can-transplant-side-owned-l0-into-local-cell' :
						'physical-placement-source-does-not-prove-local-cell-benefit'
				};

			};
			const left = await createSideFacts( 'left', _lightProbeContext.leakFixture.leftReceiver, leftReceiverPoint, leftBoundaryMask );
			const right = await createSideFacts( 'right', _lightProbeContext.leakFixture.rightReceiver, rightReceiverPoint, rightBoundaryMask );
			const hasBilateralPlacementSignal = left.placementRequirementVerdict === 'physical-placement-can-transplant-side-owned-l0-into-local-cell' &&
				right.placementRequirementVerdict === 'physical-placement-can-transplant-side-owned-l0-into-local-cell';

			return {
				attributionPolicy: 'probe-side-relocation-physical-placement-requirement',
				proofBoundary: 'cpu-placement-requirement-and-l0-attribution-only',
				coefficientPolicy: 'packed-atlas-l0-support-mean',
				candidateShape: 'transplant-side-shell-support-into-reachable-local-cell',
				receiverPointPolicy: 'world-bounds-near-divider-edge',
				leftBoundaryLayerMask: leftBoundaryMask,
				rightBoundaryLayerMask: rightBoundaryMask,
				left,
				right,
				physicalPlacementRequirementVerdict: hasBilateralPlacementSignal ?
					'physical-local-cell-placement-required-and-l0-supported' :
					'physical-local-cell-placement-requirement-not-proven'
			};

		};
		const createLocalCellPlacement = ( {
			leftReceiver = _lightProbeContext.leakFixture.leftReceiver,
			rightReceiver = _lightProbeContext.leakFixture.rightReceiver,
			leftPoint = leftReceiverPoint,
			rightPoint = rightReceiverPoint
		} = {} ) => {

			const leftTarget = createLocalCellSupport( leftReceiver, 'left' ).support;
			const rightTarget = createLocalCellSupport( rightReceiver, 'right' ).support;
			const leftSource = createSideShellSupport( 'left', leftPoint, leftBoundaryMask );
			const rightSource = createSideShellSupport( 'right', rightPoint, rightBoundaryMask );

			return createLightProbeGridGPULocalCellPlacement( {
				resolution,
				defaultMask,
				baseProbeValidity: _lightProbeContext.probeGrid.probeValiditySource,
				baseProbeLayerMasks: _lightProbeContext.probeGrid.probeLayerMaskSource,
				placements: [
					{
						side: 'left',
						boundaryLayerMask: leftBoundaryMask,
						targetSupport: leftTarget,
						sourceSupport: leftSource
					},
					{
						side: 'right',
						boundaryLayerMask: rightBoundaryMask,
						targetSupport: rightTarget,
						sourceSupport: rightSource
					}
				]
			} );

		};
		const createPlacementAuthoringInput = ( options = {} ) => {

			const leftReceiver = options.leftReceiver ?? _lightProbeContext.leakFixture.leftReceiver;
			const rightReceiver = options.rightReceiver ?? _lightProbeContext.leakFixture.rightReceiver;
			const leftPoint = options.leftPoint ?? leftReceiverPoint;
			const rightPoint = options.rightPoint ?? rightReceiverPoint;
			const leftTarget = createLocalCellSupport( leftReceiver, 'left' ).support;
			const rightTarget = createLocalCellSupport( rightReceiver, 'right' ).support;
			const leftSource = createSideShellSupport( 'left', leftPoint, leftBoundaryMask );
			const rightSource = createSideShellSupport( 'right', rightPoint, rightBoundaryMask );

			return {
				min: _lightProbeContext.gridMin,
				max: _lightProbeContext.gridMax,
				resolution,
				defaultLayerMask: defaultMask,
				baseProbeValidity: _lightProbeContext.probeGrid.probeValiditySource,
				baseProbeLayerMasks: _lightProbeContext.probeGrid.probeLayerMaskSource,
				layerRules: [
					{ id: 'left-boundary', side: 'left', boundaryLayerMask: leftBoundaryMask },
					{ id: 'right-boundary', side: 'right', boundaryLayerMask: rightBoundaryMask }
				],
				occupancyPolicy: {
					policyId: 'solid-occupancy-validity'
				},
				sourceSelectionPolicy: {
					policyId: 'side-shell-local-cell-source-policy'
				},
				receiverRegions: [
					{
						id: 'left-receiver-region',
						side: 'left',
						boundaryLayerMask: leftBoundaryMask,
						sampleRegion: 'receiver-local-cell',
						targetSupport: leftTarget,
						sourceSupport: leftSource
					},
					{
						id: 'right-receiver-region',
						side: 'right',
						boundaryLayerMask: rightBoundaryMask,
						sampleRegion: 'receiver-local-cell',
						targetSupport: rightTarget,
						sourceSupport: rightSource
					}
				]
			};

		};
		const createPlacementAuthoring = ( options = {} ) => {

			return createLightProbeGridGPUPlacementAuthoring( createPlacementAuthoringInput( options ) );

		};
		const createLocalCellPlacementHelperAttribution = ( options = {} ) => {

			const placement = createLocalCellPlacement( options );

			return {
				attributionPolicy: 'probe-side-relocation-local-cell-placement-helper',
				proofBoundary: 'setup-helper-array-generation-only',
				...( options.fixtureId !== undefined ? { fixtureId: options.fixtureId } : {} ),
				...( options.fixtureFamily !== undefined ? { fixtureFamily: options.fixtureFamily } : {} ),
				helperPolicyId: placement.placementFacts.policyId,
				placementPolicyFacts: placement.placementFacts.placementPolicyFacts,
				totalProbes: placement.placementFacts.totalProbes,
				acceptedSideCount: placement.placementFacts.acceptedSideCount,
				probeValidityLength: placement.probeValidity.length,
				probeLayerMasksLength: placement.probeLayerMasks.length,
				replacementSlotCount: placement.placementFacts.replacementSlotCount,
				occupiedReplacementSlotCount: placement.placementFacts.occupiedReplacementSlotCount,
				sideFacts: placement.placementFacts.sideFacts,
				placementHelperVerdict: placement.placementFacts.placementVerdict
			};

		};
		const createPlacementAuthoringAttribution = ( options = {} ) => {

			const authoring = createPlacementAuthoring( options );

			return {
				attributionPolicy: 'placement-authoring-product-module',
				...( options.fixtureId !== undefined ? { fixtureId: options.fixtureId } : {} ),
				...( options.fixtureFamily !== undefined ? { fixtureFamily: options.fixtureFamily } : {} ),
				modulePath: 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js',
				authoringPolicyId: authoring.placementFacts.policyId,
				placementPolicyFacts: authoring.placementFacts.placementPolicyFacts,
				sourceSelectionPolicyFacts: authoring.placementFacts.sourceSelectionPolicyFacts,
				totalProbes: authoring.placementFacts.totalProbes,
				receiverRegionCount: authoring.placementFacts.receiverRegionCount,
				layerRuleCount: authoring.placementFacts.layerRuleCount,
				occupancyPolicyId: authoring.placementFacts.occupancyPolicyId,
				acceptedSideCount: authoring.placementFacts.acceptedSideCount,
				probeValidityLength: authoring.probeValidity.length,
				probeLayerMasksLength: authoring.probeLayerMasks.length,
				replacementSlotCount: authoring.placementFacts.replacementSlotCount,
				occupiedReplacementSlotCount: authoring.placementFacts.occupiedReplacementSlotCount,
				sideFacts: authoring.placementFacts.sideFacts,
				productHasProofOnlyFacts: authoring.placementFacts.proofBoundary !== undefined ||
					authoring.placementFacts.placementHelperPolicyId !== undefined ||
					authoring.placementFacts.sourceSelectionPolicyFacts.forbiddenInputs !== undefined,
				placementAuthoringVerdict: authoring.placementFacts.placementVerdict === 'placement-authoring-emits-arrays' ?
					'placement-authoring-product-module-emits-arrays' :
					'placement-authoring-has-no-local-cell-placement-work'
			};

		};
		const createPlacementAuthoringParityAttribution = ( helperAttribution, authoringAttribution ) => {

			const helperSideHashes = helperAttribution.sideFacts.map( side => ( {
				side: side.side,
				targetSupportIdentityHash: side.targetSupportIdentityHash,
				sourceSupportIdentityHash: side.sourceSupportIdentityHash,
				replacementSlotCount: side.replacementSlotCount,
				occupiedReplacementSlotCount: side.occupiedReplacementSlotCount
			} ) );
			const authoringSideHashes = authoringAttribution.sideFacts.map( side => ( {
				side: side.side,
				targetSupportIdentityHash: side.targetSupportIdentityHash,
				sourceSupportIdentityHash: side.sourceSupportIdentityHash,
				replacementSlotCount: side.replacementSlotCount,
				occupiedReplacementSlotCount: side.occupiedReplacementSlotCount
			} ) );
			const sideFactsMatch = JSON.stringify( helperSideHashes ) === JSON.stringify( authoringSideHashes );
			const placementPolicyFactsMatch = JSON.stringify( helperAttribution.placementPolicyFacts ) ===
				JSON.stringify( authoringAttribution.placementPolicyFacts );
			const summaryCountsMatch =
				helperAttribution.totalProbes === authoringAttribution.totalProbes &&
				helperAttribution.acceptedSideCount === authoringAttribution.acceptedSideCount &&
				helperAttribution.probeValidityLength === authoringAttribution.probeValidityLength &&
				helperAttribution.probeLayerMasksLength === authoringAttribution.probeLayerMasksLength &&
				helperAttribution.replacementSlotCount === authoringAttribution.replacementSlotCount &&
				helperAttribution.occupiedReplacementSlotCount === authoringAttribution.occupiedReplacementSlotCount;

			return {
				attributionPolicy: 'placement-authoring-helper-parity',
				proofBoundary: 'compact-authoring-adapter-helper-fact-parity',
				fixtureId: helperAttribution.fixtureId ?? 'sealed-wall',
				helperPolicyId: helperAttribution.helperPolicyId,
				authoringPolicyId: authoringAttribution.authoringPolicyId,
				placementPolicyFactsMatch,
				summaryCountsMatch,
				sideFactsMatch,
				helperSideHashes,
				authoringSideHashes,
				placementAuthoringParityVerdict: placementPolicyFactsMatch && summaryCountsMatch && sideFactsMatch ?
					'placement-authoring-matches-helper-facts' :
					'placement-authoring-differs-from-helper-facts'
			};

		};
		const createSealedOffsetWallPlacementHelperAttribution = () => {

			const previousCamera = createCameraSnapshot();

			try {

				setLeakFixtureMode( 'sealed-offset-wall' );
				applySealedOffsetWallProofCamera();

				const leftReceiver = _lightProbeContext.leakFixture.leftReceiver;
				const rightReceiver = _lightProbeContext.leakFixture.rightReceiver;

				return createLocalCellPlacementHelperAttribution( {
					fixtureId: 'sealed-offset-wall',
					fixtureFamily: 'sealed-offset-wall',
					leftReceiver,
					rightReceiver,
					leftPoint: createReceiverEdgePoint( leftReceiver, 'left' ),
					rightPoint: createReceiverEdgePoint( rightReceiver, 'right' )
				} );

			} finally {

				setLeakFixtureMode( 'sealed-wall' );
				restoreCameraSnapshot( previousCamera );
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			}

		};
		const createSealedOffsetWallPlacementAuthoringAttribution = () => {

			const previousCamera = createCameraSnapshot();

			try {

				setLeakFixtureMode( 'sealed-offset-wall' );
				applySealedOffsetWallProofCamera();

				const leftReceiver = _lightProbeContext.leakFixture.leftReceiver;
				const rightReceiver = _lightProbeContext.leakFixture.rightReceiver;

				return createPlacementAuthoringAttribution( {
					fixtureId: 'sealed-offset-wall',
					fixtureFamily: 'sealed-offset-wall',
					leftReceiver,
					rightReceiver,
					leftPoint: createReceiverEdgePoint( leftReceiver, 'left' ),
					rightPoint: createReceiverEdgePoint( rightReceiver, 'right' )
				} );

			} finally {

				setLeakFixtureMode( 'sealed-wall' );
				restoreCameraSnapshot( previousCamera );
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			}

		};
		const captureSetupClassificationIrradianceDelta = () => {

			if ( typeof _lightProbeContext.probeGrid._createManualIrradianceDebugNode !== 'function' ) return null;

			const originalProbeLayerMasks = _lightProbeContext.probeGrid.probeLayerMaskSource;
			const previousLeftMaterial = _lightProbeContext.leakFixture.leftReceiver.material;
			const previousRightMaterial = _lightProbeContext.leakFixture.rightReceiver.material;
			const previousOutputColorSpace = _lightProbeContext.renderer.outputColorSpace;
			const leftMaterial = new THREE.MeshBasicNodeMaterial();
			const rightMaterial = new THREE.MeshBasicNodeMaterial();
			const surfaceRegions = {
				leftReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.leftReceiver ) ?? leakArtifactRegions.leftReceiver,
				rightReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.rightReceiver ) ?? leakArtifactRegions.rightReceiver
			};
			const createEdgeRegion = ( region, side ) => {

				const width = region.x1 - region.x0;

				return side === 'left' ? {
					...region,
					x0: Math.max( region.x0, region.x1 - width * 0.35 )
				} : {
					...region,
					x1: Math.min( region.x1, region.x0 + width * 0.35 )
				};

			};
			const regions = {
				leftReceiverSurface: createEdgeRegion( surfaceRegions.leftReceiverSurface, 'left' ),
				rightReceiverSurface: createEdgeRegion( surfaceRegions.rightReceiverSurface, 'right' )
			};
			const createMeans = samples => ( {
				leftMean: roundMetric( samples.leftReceiverSurface.luminance.mean / 255 ),
				rightMean: roundMetric( samples.rightReceiverSurface.luminance.mean / 255 ),
				combinedMean: roundMetric( (
					samples.leftReceiverSurface.luminance.mean +
					samples.rightReceiverSurface.luminance.mean
				) / ( 2 * 255 ) )
			} );
			const captureState = ( probeLayerMasks, leftOptions, rightOptions ) => {

				_lightProbeContext.probeGrid.setOptions( {
					probeLayerMasks
				}, _lightProbeContext.renderer );

				leftMaterial.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( 'finalIrradiance', leftOptions );
				rightMaterial.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( 'finalIrradiance', rightOptions );
				leftMaterial.toneMapped = false;
				rightMaterial.toneMapped = false;
				leftMaterial.needsUpdate = true;
				rightMaterial.needsUpdate = true;
				_lightProbeContext.leakFixture.leftReceiver.material = leftMaterial;
				_lightProbeContext.leakFixture.rightReceiver.material = rightMaterial;
				_lightProbeContext.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				return createMeans( captureRegionArtifactMetrics( regions ) );

			};
			const createRatio = ( numerator, denominator ) => ( {
				leftRatio: roundMetric( numerator.leftMean / Math.max( denominator.leftMean, PROOF_RATIO_DENOMINATOR_EPSILON ) ),
				rightRatio: roundMetric( numerator.rightMean / Math.max( denominator.rightMean, PROOF_RATIO_DENOMINATOR_EPSILON ) ),
				combinedRatio: roundMetric( numerator.combinedMean / Math.max( denominator.combinedMean, PROOF_RATIO_DENOMINATOR_EPSILON ) )
			} );

			try {

				ensureAuthoredReceiverBoundaryClassAttributes();

				const unclassifiedDefault = captureState( originalProbeLayerMasks, {}, {} );
				const unclassifiedBoundary = captureState(
					originalProbeLayerMasks,
					createReceiverBoundaryDescriptor( leftBoundaryMask ),
					createReceiverBoundaryDescriptor( rightBoundaryMask )
				);
				const classifiedBoundary = captureState(
					assignment.probeLayerMasks,
					createReceiverBoundaryDescriptor( leftBoundaryMask ),
					createReceiverBoundaryDescriptor( rightBoundaryMask )
				);
				const classifiedToUnclassifiedDefault = createRatio( classifiedBoundary, unclassifiedDefault );
				const classifiedToUnclassifiedBoundary = createRatio( classifiedBoundary, unclassifiedBoundary );

				return {
					attributionPolicy: 'setup-side-classification-final-irradiance-delta',
					proofBoundary: 'debug-node-setup-mask-delta-only',
					debugMode: 'finalIrradiance',
					leftBoundaryLayerMask: leftBoundaryMask,
					rightBoundaryLayerMask: rightBoundaryMask,
					unclassifiedDefault,
					unclassifiedBoundary,
					classifiedBoundary,
					classifiedToUnclassifiedDefault,
					classifiedToUnclassifiedBoundary,
					setupIrradianceDeltaVerdict: classifiedToUnclassifiedDefault.combinedRatio > 1.001 ?
						'classification-improves-final-irradiance-over-default' :
						classifiedToUnclassifiedBoundary.combinedRatio > 1.001 ?
							'classification-recovers-boundary-final-irradiance-to-default' :
							'classification-does-not-change-final-irradiance-debug-signal'
				};

			} finally {

				_lightProbeContext.probeGrid.setOptions( {
					probeLayerMasks: originalProbeLayerMasks
				}, _lightProbeContext.renderer );
				_lightProbeContext.leakFixture.leftReceiver.material = previousLeftMaterial;
				_lightProbeContext.leakFixture.rightReceiver.material = previousRightMaterial;
				_lightProbeContext.renderer.outputColorSpace = previousOutputColorSpace;
				leftMaterial.dispose();
				rightMaterial.dispose();
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			}

		};
		const captureSideShellIrradianceDelta = () => {

			if ( typeof _lightProbeContext.probeGrid._createManualIrradianceDebugNode !== 'function' ) return null;

			const originalProbeLayerMasks = _lightProbeContext.probeGrid.probeLayerMaskSource;
			const sideShell = createSideShellProbeLayerMasks( originalProbeLayerMasks );
			const previousLeftMaterial = _lightProbeContext.leakFixture.leftReceiver.material;
			const previousRightMaterial = _lightProbeContext.leakFixture.rightReceiver.material;
			const previousOutputColorSpace = _lightProbeContext.renderer.outputColorSpace;
			const leftMaterial = new THREE.MeshBasicNodeMaterial();
			const rightMaterial = new THREE.MeshBasicNodeMaterial();
			const surfaceRegions = {
				leftReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.leftReceiver ) ?? leakArtifactRegions.leftReceiver,
				rightReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.rightReceiver ) ?? leakArtifactRegions.rightReceiver
			};
			const createEdgeRegion = ( region, side ) => {

				const width = region.x1 - region.x0;

				return side === 'left' ? {
					...region,
					x0: Math.max( region.x0, region.x1 - width * 0.35 )
				} : {
					...region,
					x1: Math.min( region.x1, region.x0 + width * 0.35 )
				};

			};
			const regions = {
				leftReceiverSurface: createEdgeRegion( surfaceRegions.leftReceiverSurface, 'left' ),
				rightReceiverSurface: createEdgeRegion( surfaceRegions.rightReceiverSurface, 'right' )
			};
			const createMeans = samples => ( {
				leftMean: roundMetric( samples.leftReceiverSurface.luminance.mean / 255 ),
				rightMean: roundMetric( samples.rightReceiverSurface.luminance.mean / 255 ),
				combinedMean: roundMetric( (
					samples.leftReceiverSurface.luminance.mean +
					samples.rightReceiverSurface.luminance.mean
				) / ( 2 * 255 ) )
			} );
			const captureState = ( probeLayerMasks, leftOptions, rightOptions ) => {

				_lightProbeContext.probeGrid.setOptions( {
					probeLayerMasks
				}, _lightProbeContext.renderer );

				leftMaterial.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( 'finalIrradiance', leftOptions );
				rightMaterial.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( 'finalIrradiance', rightOptions );
				leftMaterial.toneMapped = false;
				rightMaterial.toneMapped = false;
				leftMaterial.needsUpdate = true;
				rightMaterial.needsUpdate = true;
				_lightProbeContext.leakFixture.leftReceiver.material = leftMaterial;
				_lightProbeContext.leakFixture.rightReceiver.material = rightMaterial;
				_lightProbeContext.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				return createMeans( captureRegionArtifactMetrics( regions ) );

			};
			const createRatio = ( numerator, denominator ) => ( {
				leftRatio: roundMetric( numerator.leftMean / Math.max( denominator.leftMean, PROOF_RATIO_DENOMINATOR_EPSILON ) ),
				rightRatio: roundMetric( numerator.rightMean / Math.max( denominator.rightMean, PROOF_RATIO_DENOMINATOR_EPSILON ) ),
				combinedRatio: roundMetric( numerator.combinedMean / Math.max( denominator.combinedMean, PROOF_RATIO_DENOMINATOR_EPSILON ) )
			} );

			try {

				ensureAuthoredReceiverBoundaryClassAttributes();

				const unclassifiedDefault = captureState( originalProbeLayerMasks, {}, {} );
				const sideShellBoundary = captureState(
					sideShell.probeLayerMasks,
					createReceiverBoundaryDescriptor( leftBoundaryMask ),
					createReceiverBoundaryDescriptor( rightBoundaryMask )
				);
				const sideShellToUnclassifiedDefault = createRatio( sideShellBoundary, unclassifiedDefault );

				return {
					attributionPolicy: 'probe-side-relocation-side-shell-final-irradiance-delta',
					proofBoundary: 'debug-node-side-shell-mask-delta-only',
					debugMode: 'finalIrradiance',
					leftBoundaryLayerMask: leftBoundaryMask,
					rightBoundaryLayerMask: rightBoundaryMask,
					leftSupportIdentityHash: createSupportIdentityHash( sideShell.leftSupport ),
					rightSupportIdentityHash: createSupportIdentityHash( sideShell.rightSupport ),
					leftSupportGridCoordHash: createSupportGridCoordHash( sideShell.leftSupport ),
					rightSupportGridCoordHash: createSupportGridCoordHash( sideShell.rightSupport ),
					unclassifiedDefault,
					sideShellBoundary,
					sideShellToUnclassifiedDefault,
					sideShellIrradianceDeltaVerdict: sideShellBoundary.combinedMean <= PROOF_RATIO_DENOMINATOR_EPSILON ?
						'side-shell-support-not-reached-by-final-irradiance-debug-node' :
						sideShellToUnclassifiedDefault.combinedRatio > 1.001 ?
						'side-shell-improves-final-irradiance-over-default' :
						'side-shell-does-not-change-final-irradiance-debug-signal'
				};

			} finally {

				_lightProbeContext.probeGrid.setOptions( {
					probeLayerMasks: originalProbeLayerMasks
				}, _lightProbeContext.renderer );
				_lightProbeContext.leakFixture.leftReceiver.material = previousLeftMaterial;
				_lightProbeContext.leakFixture.rightReceiver.material = previousRightMaterial;
				_lightProbeContext.renderer.outputColorSpace = previousOutputColorSpace;
				leftMaterial.dispose();
				rightMaterial.dispose();
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			}

		};
		const captureLocalCellPlacementIrradianceDelta = () => {

			if ( typeof _lightProbeContext.probeGrid._createManualIrradianceDebugNode !== 'function' ) return null;

			const placement = createLocalCellPlacement();
			const originalProbeValidity = _lightProbeContext.probeGrid.probeValiditySource;
			const originalProbeLayerMasks = _lightProbeContext.probeGrid.probeLayerMaskSource;
			const previousLeftMaterial = _lightProbeContext.leakFixture.leftReceiver.material;
			const previousRightMaterial = _lightProbeContext.leakFixture.rightReceiver.material;
			const previousOutputColorSpace = _lightProbeContext.renderer.outputColorSpace;
			const leftMaterial = new THREE.MeshBasicNodeMaterial();
			const rightMaterial = new THREE.MeshBasicNodeMaterial();
			const surfaceRegions = {
				leftReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.leftReceiver ) ?? leakArtifactRegions.leftReceiver,
				rightReceiverSurface: createObjectSurfaceScreenRegion( _lightProbeContext.leakFixture.rightReceiver ) ?? leakArtifactRegions.rightReceiver
			};
			const createEdgeRegion = ( region, side ) => {

				const width = region.x1 - region.x0;

				return side === 'left' ? {
					...region,
					x0: Math.max( region.x0, region.x1 - width * 0.35 )
				} : {
					...region,
					x1: Math.min( region.x1, region.x0 + width * 0.35 )
				};

			};
			const regions = {
				leftReceiverSurface: createEdgeRegion( surfaceRegions.leftReceiverSurface, 'left' ),
				rightReceiverSurface: createEdgeRegion( surfaceRegions.rightReceiverSurface, 'right' )
			};
			const createMeans = samples => ( {
				leftMean: roundMetric( samples.leftReceiverSurface.luminance.mean / 255 ),
				rightMean: roundMetric( samples.rightReceiverSurface.luminance.mean / 255 ),
				combinedMean: roundMetric( (
					samples.leftReceiverSurface.luminance.mean +
					samples.rightReceiverSurface.luminance.mean
				) / ( 2 * 255 ) )
			} );
			const captureState = ( probeValidity, probeLayerMasks, leftOptions, rightOptions ) => {

				_lightProbeContext.probeGrid.setOptions( {
					probeValidity,
					probeLayerMasks
				}, _lightProbeContext.renderer );

				leftMaterial.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( 'finalIrradiance', leftOptions );
				rightMaterial.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( 'finalIrradiance', rightOptions );
				leftMaterial.toneMapped = false;
				rightMaterial.toneMapped = false;
				leftMaterial.needsUpdate = true;
				rightMaterial.needsUpdate = true;
				_lightProbeContext.leakFixture.leftReceiver.material = leftMaterial;
				_lightProbeContext.leakFixture.rightReceiver.material = rightMaterial;
				_lightProbeContext.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				return createMeans( captureRegionArtifactMetrics( regions ) );

			};
			const createRatio = ( numerator, denominator ) => ( {
				leftRatio: roundMetric( numerator.leftMean / Math.max( denominator.leftMean, PROOF_RATIO_DENOMINATOR_EPSILON ) ),
				rightRatio: roundMetric( numerator.rightMean / Math.max( denominator.rightMean, PROOF_RATIO_DENOMINATOR_EPSILON ) ),
				combinedRatio: roundMetric( numerator.combinedMean / Math.max( denominator.combinedMean, PROOF_RATIO_DENOMINATOR_EPSILON ) )
			} );

			try {

				ensureAuthoredReceiverBoundaryClassAttributes();

				const unclassifiedDefault = captureState( originalProbeValidity, originalProbeLayerMasks, {}, {} );
				const placementBoundary = captureState(
					placement.probeValidity,
					placement.probeLayerMasks,
					createReceiverBoundaryDescriptor( leftBoundaryMask ),
					createReceiverBoundaryDescriptor( rightBoundaryMask )
				);
				const placementToUnclassifiedDefault = createRatio( placementBoundary, unclassifiedDefault );

				return {
					attributionPolicy: 'probe-side-relocation-local-cell-placement-final-irradiance-delta',
					proofBoundary: 'debug-node-local-cell-placement-array-delta-only',
					debugMode: 'finalIrradiance',
					leftBoundaryLayerMask: leftBoundaryMask,
					rightBoundaryLayerMask: rightBoundaryMask,
					helperPolicyId: placement.placementFacts.policyId,
					replacementSlotCount: placement.placementFacts.replacementSlotCount,
					occupiedReplacementSlotCount: placement.placementFacts.occupiedReplacementSlotCount,
					unclassifiedDefault,
					placementBoundary,
					placementToUnclassifiedDefault,
					placementIrradianceDeltaVerdict: placementBoundary.combinedMean <= PROOF_RATIO_DENOMINATOR_EPSILON ?
						'placement-helper-arrays-not-reached-by-final-irradiance-debug-node' :
						placementToUnclassifiedDefault.combinedRatio > 1.001 ?
							'placement-helper-arrays-improve-final-irradiance-over-default' :
							'placement-helper-arrays-do-not-change-final-irradiance-debug-signal'
				};

			} finally {

				_lightProbeContext.probeGrid.setOptions( {
					probeValidity: originalProbeValidity,
					probeLayerMasks: originalProbeLayerMasks
				}, _lightProbeContext.renderer );
				_lightProbeContext.leakFixture.leftReceiver.material = previousLeftMaterial;
				_lightProbeContext.leakFixture.rightReceiver.material = previousRightMaterial;
				_lightProbeContext.renderer.outputColorSpace = previousOutputColorSpace;
				leftMaterial.dispose();
				rightMaterial.dispose();
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			}

		};
		const captureLocalCellPlacementRenderLeakDelta = ( options = {} ) => {

			const placement = createLocalCellPlacement( options );
			const originalProbeValidity = _lightProbeContext.probeGrid.probeValiditySource;
			const originalProbeLayerMasks = _lightProbeContext.probeGrid.probeLayerMaskSource;
			const captureState = ( probeValidity, probeLayerMasks ) => {

				_lightProbeContext.probeGrid.setOptions( {
					probeValidity,
					probeLayerMasks
				}, _lightProbeContext.renderer );

				return captureReceiverBoundaryMaskAlignmentRenderFacts( {
					attributionPolicy: 'probe-side-relocation-local-cell-placement-render-state',
					...( options.fixtureId !== undefined ? { fixtureId: options.fixtureId } : {} ),
					...( options.fixtureFamily !== undefined ? { fixtureFamily: options.fixtureFamily } : {} ),
					leftBoundaryLayerMask: leftBoundaryMask,
					rightBoundaryLayerMask: rightBoundaryMask
				} );

			};
			const createRatio = ( numerator, denominator ) => ( {
				maskedWrongSideColorRatio: roundMetric( numerator.maskedWrongSideColorRatio / Math.max(
					denominator.maskedWrongSideColorRatio,
					PROOF_RATIO_DENOMINATOR_EPSILON
				) ),
				leftMaskedWrongSideColorRatio: roundMetric( numerator.leftMaskedWrongSideColorRatio / Math.max(
					denominator.leftMaskedWrongSideColorRatio,
					PROOF_RATIO_DENOMINATOR_EPSILON
				) ),
				rightMaskedWrongSideColorRatio: roundMetric( numerator.rightMaskedWrongSideColorRatio / Math.max(
					denominator.rightMaskedWrongSideColorRatio,
					PROOF_RATIO_DENOMINATOR_EPSILON
				) ),
				preToneMaskedWrongSideColorRatio: roundMetric( numerator.preToneMaskedWrongSideColorRatio / Math.max(
					denominator.preToneMaskedWrongSideColorRatio,
					PROOF_RATIO_DENOMINATOR_EPSILON
				) ),
				correctBounceRatio: roundMetric( numerator.correctBounceRatio / Math.max(
					denominator.correctBounceRatio,
					PROOF_RATIO_DENOMINATOR_EPSILON
				) )
			} );

			try {

				ensureAuthoredReceiverBoundaryClassAttributes();

				const unclassifiedBoundaryRender = captureState( originalProbeValidity, originalProbeLayerMasks );
				const placementBoundaryRender = captureState(
					placement.probeValidity,
					placement.probeLayerMasks
				);
				const placementToUnclassifiedBoundaryRender = createRatio( placementBoundaryRender, unclassifiedBoundaryRender );
				const reducesWrongSideLeak = placementToUnclassifiedBoundaryRender.maskedWrongSideColorRatio < 0.999;
				const improvesBothSides = placementToUnclassifiedBoundaryRender.leftMaskedWrongSideColorRatio < 0.999 &&
					placementToUnclassifiedBoundaryRender.rightMaskedWrongSideColorRatio < 0.999;
				const preservesCorrectBounce = placementToUnclassifiedBoundaryRender.correctBounceRatio >= 0.999;
				const lowBaselineSideRegressionPolicy = {
					policyId: 'low-baseline-side-regression-policy',
					side: 'right',
					maxBaselineWrongSideColorRatio: 0.25,
					requireStableMaskedPixelCount: true,
					requireStablePreToneMaskedPixelCount: true,
					requireCombinedWrongSideImprovement: true,
					requirePreToneWrongSideImprovement: true,
					minCorrectBounceRatio: 0.999
				};
				const hasStableRightMaskedPixelCount =
					unclassifiedBoundaryRender.maskedRightVisiblePixelCount === placementBoundaryRender.maskedRightVisiblePixelCount;
				const hasStableRightPreToneMaskedPixelCount =
					unclassifiedBoundaryRender.preToneMaskedRightVisiblePixelCount === placementBoundaryRender.preToneMaskedRightVisiblePixelCount;
				const passesLowBaselineSideRegressionPolicy =
					unclassifiedBoundaryRender.rightMaskedWrongSideColorRatio < lowBaselineSideRegressionPolicy.maxBaselineWrongSideColorRatio &&
					hasStableRightMaskedPixelCount &&
					hasStableRightPreToneMaskedPixelCount &&
					reducesWrongSideLeak &&
					placementToUnclassifiedBoundaryRender.preToneMaskedWrongSideColorRatio < 0.999 &&
					placementToUnclassifiedBoundaryRender.correctBounceRatio >= lowBaselineSideRegressionPolicy.minCorrectBounceRatio;
				const rightSideRegressionAttribution = {
					attributionPolicy: 'right-side-placement-render-regression-attribution',
					proofBoundary: 'rendered-ratio-side-delta-only',
					fixtureId: options.fixtureId ?? 'sealed-wall',
					lowBaselineSideRegressionPolicy,
					baselineRightMaskedWrongSideColorRatio: unclassifiedBoundaryRender.rightMaskedWrongSideColorRatio,
					placementRightMaskedWrongSideColorRatio: placementBoundaryRender.rightMaskedWrongSideColorRatio,
					rightMaskedWrongSideColorRatio: placementToUnclassifiedBoundaryRender.rightMaskedWrongSideColorRatio,
					baselineRightMaskedVisiblePixelCount: unclassifiedBoundaryRender.maskedRightVisiblePixelCount,
					placementRightMaskedVisiblePixelCount: placementBoundaryRender.maskedRightVisiblePixelCount,
					stableRightMaskedVisiblePixelCount: hasStableRightMaskedPixelCount,
					baselinePreToneRightMaskedVisiblePixelCount: unclassifiedBoundaryRender.preToneMaskedRightVisiblePixelCount,
					placementPreToneRightMaskedVisiblePixelCount: placementBoundaryRender.preToneMaskedRightVisiblePixelCount,
					stablePreToneRightMaskedVisiblePixelCount: hasStableRightPreToneMaskedPixelCount,
					leftMaskedWrongSideColorRatio: placementToUnclassifiedBoundaryRender.leftMaskedWrongSideColorRatio,
					combinedMaskedWrongSideColorRatio: placementToUnclassifiedBoundaryRender.maskedWrongSideColorRatio,
					preToneMaskedWrongSideColorRatio: placementToUnclassifiedBoundaryRender.preToneMaskedWrongSideColorRatio,
					correctBounceRatio: placementToUnclassifiedBoundaryRender.correctBounceRatio,
					rightSideRegressionVerdict: placementToUnclassifiedBoundaryRender.rightMaskedWrongSideColorRatio <= 0.999 ?
						'right-side-placement-render-improves' :
						passesLowBaselineSideRegressionPolicy ?
							'right-side-small-baseline-regression-with-combined-placement-win' :
							'right-side-placement-render-regresses'
				};

				return {
					attributionPolicy: 'probe-side-relocation-local-cell-placement-render-leak-delta',
					proofBoundary: 'rendered-ratio-local-cell-placement-array-delta-only',
					...( options.fixtureId !== undefined ? { fixtureId: options.fixtureId } : {} ),
					...( options.fixtureFamily !== undefined ? { fixtureFamily: options.fixtureFamily } : {} ),
					leftBoundaryLayerMask: leftBoundaryMask,
					rightBoundaryLayerMask: rightBoundaryMask,
					helperPolicyId: placement.placementFacts.policyId,
					replacementSlotCount: placement.placementFacts.replacementSlotCount,
					occupiedReplacementSlotCount: placement.placementFacts.occupiedReplacementSlotCount,
					unclassifiedBoundaryRender,
					placementBoundaryRender,
					placementToUnclassifiedBoundaryRender,
					rightSideRegressionAttribution,
					placementRenderLeakVerdict: reducesWrongSideLeak && improvesBothSides && preservesCorrectBounce ?
						'placement-helper-arrays-improve-bilateral-render-leak-over-default' :
						reducesWrongSideLeak && preservesCorrectBounce ?
							'placement-helper-arrays-improve-combined-render-leak-over-default' :
							'placement-helper-arrays-do-not-improve-render-leak-over-default'
				};

			} finally {

				_lightProbeContext.probeGrid.setOptions( {
					probeValidity: originalProbeValidity,
					probeLayerMasks: originalProbeLayerMasks
				}, _lightProbeContext.renderer );

			}

		};
		const captureSealedOffsetWallPlacementRenderLeakDelta = () => {

			const previousCamera = createCameraSnapshot();

			try {

				setLeakFixtureMode( 'sealed-offset-wall' );
				applySealedOffsetWallProofCamera();

				const leftReceiver = _lightProbeContext.leakFixture.leftReceiver;
				const rightReceiver = _lightProbeContext.leakFixture.rightReceiver;

				return captureLocalCellPlacementRenderLeakDelta( {
					fixtureId: 'sealed-offset-wall',
					fixtureFamily: 'sealed-offset-wall',
					leftReceiver,
					rightReceiver,
					leftPoint: createReceiverEdgePoint( leftReceiver, 'left' ),
					rightPoint: createReceiverEdgePoint( rightReceiver, 'right' )
				} );

			} finally {

				setLeakFixtureMode( 'sealed-wall' );
				restoreCameraSnapshot( previousCamera );
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			}

		};

		const renderGuard = captureRenderOnlyGuard();
		const finalIrradianceDebug = captureFinalIrradianceDebug();
		const localCellPlacementHelperAttribution = createLocalCellPlacementHelperAttribution();
		const placementAuthoringAttribution = createPlacementAuthoringAttribution();
		const sealedOffsetWallPlacementHelperAttribution = createSealedOffsetWallPlacementHelperAttribution();
		const sealedOffsetWallPlacementAuthoringAttribution = createSealedOffsetWallPlacementAuthoringAttribution();

		return {
			attributionPolicy: 'setup-side-probe-identity-classification-candidate',
			proofBoundary: 'bake-setup-attribution-only',
			source: 'probe-position-ownership-and-isolated-l0-coefficient-attribution',
			defaultEquivalencePolicy: 'no-classification-keeps-original-probe-indices',
			assignmentFacts: assignment.assignmentFacts,
			totalProbes: occupancy.totalProbes,
			validProbeCount,
			invalidProbeCount: sampling.invalidProbeCount,
			interiorProbeCount: occupancy.occupiedProbeCount,
			exteriorProbeCount: validProbeCount,
			relocatedProbeCount: 0,
			receiverSideSupportArchived: receiverSideArchived,
			defaultEquivalence: {
				identityPolicy: 'default-support-compared-to-itself',
				leftIdentityChangeCount: 0,
				rightIdentityChangeCount: 0
			},
			nextLane: {
				requiredNextLane: receiverSideArchived ?
					'bake-time-relocation-or-probe-side-classification' :
					'receiver-side-support-routing-still-open',
				setupClassificationVerdict: hasUsefulIdentityChange ?
					'continue-setup-side-probe-classification' :
					'classification-needs-relocation-or-denser-probes'
			},
			renderGuard,
			finalIrradianceDebug,
			debugDescriptorCompatibility: createDebugDescriptorCompatibilityAttribution( renderGuard, finalIrradianceDebug ),
			sideSymmetryAttribution: createSideSymmetryAttribution(),
			probeSideClassificationAttribution: await createProbeSideClassificationAttribution(),
			probeSideRelocationOracleAttribution: await createProbeSideRelocationOracleAttribution(),
			probeSideRelocationProxyAttribution: await createProbeSideRelocationDistanceProxyAttribution(),
			probeSideRelocationDividerProxyAttribution: await createProbeSideRelocationDividerProxyAttribution(),
			probeSideRelocationVisibilityProxyAttribution: await createProbeSideRelocationVisibilityProxyAttribution(),
			probeSideRelocationSideShellProxyAttribution: await createProbeSideRelocationSideShellProxyAttribution(),
			sideShellLocalCellReachability: createSideShellLocalCellReachabilityAttribution(),
			localCellRelocationCandidateAttribution: await createLocalCellRelocationCandidateAttribution(),
			physicalPlacementRequirementAttribution: await createPhysicalPlacementRequirementAttribution(),
			localCellPlacementHelperAttribution,
			placementAuthoringAttribution,
			placementAuthoringParityAttribution: createPlacementAuthoringParityAttribution(
				localCellPlacementHelperAttribution,
				placementAuthoringAttribution
			),
			sealedOffsetWallPlacementHelperAttribution,
			sealedOffsetWallPlacementAuthoringAttribution,
			sealedOffsetWallPlacementAuthoringParityAttribution: createPlacementAuthoringParityAttribution(
				sealedOffsetWallPlacementHelperAttribution,
				sealedOffsetWallPlacementAuthoringAttribution
			),
			setupClassificationIrradianceDelta: captureSetupClassificationIrradianceDelta(),
			sideShellIrradianceDelta: captureSideShellIrradianceDelta(),
			localCellPlacementIrradianceDelta: captureLocalCellPlacementIrradianceDelta(),
			localCellPlacementRenderLeakDelta: captureLocalCellPlacementRenderLeakDelta(),
			sealedOffsetWallPlacementRenderLeakDelta: captureSealedOffsetWallPlacementRenderLeakDelta(),
			candidates
		};

	};

	const captureLeakProofFacts = async () => {

		const traceProof = message => {

			if ( searchParams.get( 'traceE2E' ) === '1' ) console.log( `[LightProbeGridGPU proof] ${ message }` );

		};
		const previousState = createHarnessStateSnapshot();
		const previousCamera = createCameraSnapshot();
		const previousVisibility = createProbeVisibilitySnapshot();
		const rows = [];
		const sealedOffsetWallRows = [];
		const residualAttributionRows = [];
		let proofSettings = null;
		let sampling = null;
		let probeMaskAttribution = null;
		let sampleAlignmentAttribution = null;
		let ownershipShapeAttribution = null;
		let boundaryMaskAlignmentAttribution = null;
		let boundaryMaskAlignmentRenderAttribution = null;
		let localizedBoundaryMaskAttribution = null;
		let boundaryClassPrecisionAttribution = null;
		let boundaryClassStrengthAttribution = null;
		let boundaryBlendAttribution = null;
		let coefficientContrastAttribution = null;
		let multiClassOwnershipAttribution = null;
		let softBoundaryOverlapAttribution = null;
		let coefficientSideWeightingAttribution = null;
		let supportSetAttribution = null;
		let setupSideProbeClassificationAttribution = null;
		let sealedOffsetWallFixtureAttribution = null;
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
				receiverScopedMask: true,
				requiresActiveVisibility: true
			}
		];
		const resolveProofCaseLabel = ( proofCase, label ) =>
			proofCase.requiresActiveVisibility === true && isActiveMomentVisibilityDepthInfo( readVisibilityDepthInfo() ) === false ?
				label.replace( 'visibility-moments', 'visibility-inactive' ) :
				label;

		const restoreState = async () => {

			restoreProbeVisibilitySnapshot( previousVisibility );
			restoreCameraSnapshot( previousCamera );
			await restoreHarnessState( previousState, 'leak proof restore' );

		};

		try {

			for ( const proofCase of cases ) {

				traceProof( `start ${ proofCase.label }` );
				applyProofBakeSettings( {
					fixtureMode: 'sealed-wall',
					hideBaseCornell: true,
					leakReductionMode: proofCase.leakReductionMode,
					useProbeValidity: proofCase.useProbeValidity
				} );

				await _lightProbeContext.recreateAndBakeRequired( `leak proof ${ proofCase.label }` );
				traceProof( `baked ${ proofCase.label }` );

				const guardedVisibilityProofMode = proofCase.disableVisibilityDepth === true ? 'off' : 'guarded';

				if ( typeof _lightProbeContext.probeGrid._setGuardedVisibilityMode === 'function' ) {

					_lightProbeContext.probeGrid._setGuardedVisibilityMode( guardedVisibilityProofMode );
					_lightProbeContext.syncProbeGridBindings();

				}

				if ( proofCase.receiverScopedMask === true ) applyLeakFixtureReceiverMasks();

				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );
				const proofLabel = resolveProofCaseLabel( proofCase, proofCase.label );

				if ( proofSettings === null ) proofSettings = createLeakProofSettingsSnapshot();
				if ( sampling === null ) sampling = _lightProbeContext.probeGrid.getSamplingInfo();

				traceProof( `leak metrics ${ proofLabel }` );
				const leakMetrics = captureLeakRegionMetrics();
				traceProof( `pre-tone metrics ${ proofLabel }` );
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
				const samplingMassFacts = proofCase.receiverScopedMask === true ?
					captureReceiverSamplingMassAttributionFacts() :
					null;
				if ( proofCase.receiverScopedMask === true ) {

					traceProof( 'probe mask attribution' );
					probeMaskAttribution = createProbeMaskAttributionFacts();
					traceProof( 'sample alignment attribution' );
					sampleAlignmentAttribution = captureReceiverSampleAlignmentCandidateFacts();
					traceProof( 'ownership shape attribution' );
					ownershipShapeAttribution = captureReceiverOwnershipShapeCandidateFacts();
					traceProof( 'boundary mask alignment attribution' );
					boundaryMaskAlignmentAttribution = captureReceiverBoundaryMaskAlignmentCandidateFacts();
					traceProof( 'boundary mask alignment render attribution' );
					boundaryMaskAlignmentRenderAttribution = captureReceiverBoundaryMaskAlignmentRenderFacts();
					traceProof( 'localized boundary mask attribution' );
					localizedBoundaryMaskAttribution = captureReceiverLocalizedBoundaryMaskCandidateFacts();
					traceProof( 'boundary class precision attribution' );
					boundaryClassPrecisionAttribution = captureReceiverBoundaryClassPrecisionCandidateFacts();
					traceProof( 'boundary class strength attribution' );
					boundaryClassStrengthAttribution = captureReceiverBoundaryClassStrengthCandidateFacts();
					traceProof( 'coefficient contrast attribution' );
					coefficientContrastAttribution = captureReceiverCoefficientContrastCandidateFacts();
					traceProof( 'multi-class ownership attribution' );
					multiClassOwnershipAttribution = captureReceiverMultiClassOwnershipCandidateFacts();
					traceProof( 'support set attribution' );
					supportSetAttribution = captureReceiverSupportSetAttributionFacts();
					traceProof( 'setup side classification attribution' );
					setupSideProbeClassificationAttribution = await createSetupSideProbeClassificationAttributionFacts(
						supportSetAttribution,
						coefficientContrastAttribution
					);
					traceProof( 'setup side classification attribution complete' );

				}

				rows.push( {
					label: proofLabel,
					guardedVisibilityProofMode,
					...createLeakProofRowMetrics( leakMetrics, preToneLeakMetrics )
				} );
				residualAttributionRows.push( createResidualAttributionRow(
					proofLabel,
					leakMetrics,
					preToneLeakMetrics,
					irradianceMetrics,
					materialFacts,
					lambertMetrics,
					surfaceSamplingFacts,
					samplingMassFacts
				) );

			}

			for ( const proofCase of cases ) {

				const offsetBaseLabel = proofCase.label.replace( 'sealed-wall', 'sealed-offset-wall' );

				traceProof( `start ${ offsetBaseLabel }` );
				applyProofBakeSettings( {
					fixtureMode: 'sealed-offset-wall',
					hideBaseCornell: true,
					leakReductionMode: proofCase.leakReductionMode,
					useProbeValidity: proofCase.useProbeValidity
				} );
				applySealedOffsetWallProofCamera();

				await _lightProbeContext.recreateAndBakeRequired( `leak proof ${ offsetBaseLabel }` );
				traceProof( `baked ${ offsetBaseLabel }` );

				const guardedVisibilityProofMode = proofCase.disableVisibilityDepth === true ? 'off' : 'guarded';

				if ( typeof _lightProbeContext.probeGrid._setGuardedVisibilityMode === 'function' ) {

					_lightProbeContext.probeGrid._setGuardedVisibilityMode( guardedVisibilityProofMode );
					_lightProbeContext.syncProbeGridBindings();

				}

				if ( proofCase.receiverScopedMask === true ) applyLeakFixtureReceiverMasks();

				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );
				const offsetLabel = resolveProofCaseLabel( proofCase, offsetBaseLabel );

				traceProof( `leak metrics ${ offsetLabel }` );
				const leakMetrics = captureLeakRegionMetrics();
				traceProof( `pre-tone metrics ${ offsetLabel }` );
				const preToneLeakMetrics = captureLeakRegionMetricsWithRendererMapping( {
					mode: 'pre-tone-linear-output-masked-visible-pixels',
					toneMapping: THREE.NoToneMapping,
					toneMappingLabel: 'NoToneMapping',
					outputColorSpace: THREE.LinearSRGBColorSpace
				} );

				const sealedOffsetWallRow = {
					label: offsetLabel,
					fixtureId: 'sealed-offset-wall',
					guardedVisibilityProofMode,
					...createLeakProofRowMetrics( leakMetrics, preToneLeakMetrics )
				};
				sealedOffsetWallRows.push( sealedOffsetWallRow );
				traceProof( `row ${ offsetLabel } ${ JSON.stringify( sealedOffsetWallRow ) }` );

			}

			traceProof( 'sealed offset fixture attribution' );
			sealedOffsetWallFixtureAttribution = captureSealedOffsetWallFixtureAttribution();

		} finally {

			await restoreState();

		}

		return {
			fixtureMode: 'sealed-wall',
			proofPolicyFacts: createProofPolicyFacts(),
			proofSettings,
			sampling,
			receiverBoundarySource: createAuthoredReceiverBoundarySourceFacts(),
			probeMaskAttribution,
			sampleAlignmentAttribution,
			ownershipShapeAttribution,
			boundaryMaskAlignmentAttribution,
			boundaryMaskAlignmentRenderAttribution,
			localizedBoundaryMaskAttribution,
			boundaryClassPrecisionAttribution,
			boundaryClassStrengthAttribution,
			boundaryBlendAttribution,
			coefficientContrastAttribution,
			multiClassOwnershipAttribution,
			softBoundaryOverlapAttribution,
			coefficientSideWeightingAttribution,
			supportSetAttribution,
			setupSideProbeClassificationAttribution,
			sealedOffsetWallFixtureAttribution,
			rows,
			sealedOffsetWallRows,
			sealedOffsetWallResidualAttribution: createSealedOffsetWallResidualAttributionFacts( sealedOffsetWallRows ),
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
		setLeakFixtureMode: ( value ) => {

			setLeakFixtureMode( value );
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			return window.__webgpuLightProbeGridCornell.inspectLeakFixtureFacts();

		},
		inspectLeakFixtureFacts: () => {

			return createLeakFixtureFacts();

		},
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
