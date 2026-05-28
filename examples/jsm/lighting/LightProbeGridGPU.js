import {
	CubeCamera,
	CubeRenderTarget,
	Box3,
	DataTexture,
	FloatType,
	HalfFloatType,
	InstancedMesh,
	IrradianceNode,
	LinearFilter,
	Matrix4,
	Mesh,
	MeshBasicNodeMaterial,
	NearestFilter,
	NodeMaterial,
	Object3D,
	OrthographicCamera,
	PlaneGeometry,
	RenderTarget,
	RenderTarget3D,
	RGBAFormat,
	Scene,
	SphereGeometry,
	StorageTexture,
	Vector3,
	Vector4
} from 'three/webgpu';
import {
	clamp,
	cubeTexture,
	cameraPosition,
	float,
	floor,
	Fn,
	If,
	instanceIndex,
	int,
	ivec2,
	ivec3,
	lights,
	Loop,
	max,
	normalWorld,
	positionWorld,
	texture3D,
	textureLoad,
	textureStore,
	uint,
	uniform,
	uvec2,
	uv,
	vec2,
	viewportCoordinate,
	vec3,
	vec4
} from 'three/tsl';

const SH_COEFFICIENTS = 9;
const PACKED_SH_TEXTURES = 7;
const ATLAS_PADDING = 1;
const PROBE_VALIDITY_FLOOR = 0.05;
const VISIBILITY_DEPTH_RESOLUTION = 8;
const VISIBILITY_DEPTH_MAX_DISTANCE = 20;
const VISIBILITY_MIN_VARIANCE = 0.0004;
const VISIBILITY_DISTANCE_BIAS = 0.02;
const DEFAULT_PROBE_LAYER_MASK = 1;
const BACKEND_LABELS = {
	projection: 'fragment',
	atlas: 'render-pass',
	update: 'full'
};

const _probePosition = /*@__PURE__*/ new Vector3();
const _gridSize = /*@__PURE__*/ new Vector3();
const _currentViewport = /*@__PURE__*/ new Vector4();
const _currentScissor = /*@__PURE__*/ new Vector4();
const _matrix = /*@__PURE__*/ new Matrix4();

const getBakeTimingPerformance = () => globalThis.performance;
const getBakeTimingNow = () => {

	const timingPerformance = getBakeTimingPerformance();

	if ( timingPerformance === undefined ) return Date.now();

	const nonDeterministicNow = timingPerformance._now;

	return typeof nonDeterministicNow === 'function' ?
		nonDeterministicNow.call( timingPerformance ) :
		timingPerformance.now();

};

const isDeterministicPerformanceNow = () => {

	const timingPerformance = getBakeTimingPerformance();

	return timingPerformance !== undefined &&
		typeof timingPerformance._now === 'function' &&
		timingPerformance.now() === 0;

};

const getBakeTimingSource = () => isDeterministicPerformanceNow() ?
	'non-deterministic-performance-now' :
	'performance-now';

const getBakeTimingSourceKind = ( timingSource ) => timingSource === 'gpu-timestamp' ?
	'gpu-timestamp' :
	timingSource === 'unavailable' ?
		'unavailable' :
		'performance.now diagnostic';

/**
 * GPU-resident L2 spherical harmonics irradiance probe grid.
 *
 * Each probe stores 9 RGB L2 spherical harmonics coefficients. That is 27 scalar
 * values, packed into 7 RGBA atlas sub-volumes because ceil( 27 / 4 ) = 7.
 * During bake, cubemap samples are projected with solid angle weighting. At
 * runtime, the default path uses hardware-filtered atlas sampling. Optional
 * leak reduction performs a manual nearest-load blend only when per-neighbor
 * weights are required. Private proof hooks can additionally read a
 * moment-backed visibility target, apply a default ellipsoid support kernel,
 * and attenuate normalized SH irradiance with visibility mass. That guarded
 * visibility path is verifier-only and is not exposed as public DDGI/API
 * surface yet.
 *
 * Every packed sub-volume has one copied padding slice on both Z boundaries so
 * trilinear filtering cannot bleed into the next SH sub-volume in the atlas.
 * The WebGL LightProbeGrid baseline uses width/height/depth centered on the
 * object position. This WebGPU version uses explicit min/max corners for the
 * same axis-aligned volume model so the example can keep its probe bounds
 * independent from the grid object's transform.
 *
 * @augments Object3D
 */
class LightProbeGridGPU extends Object3D {

	/**
	 * Constructs a WebGPU irradiance probe grid.
	 *
	 * The grid owns its bake render targets and helper resources. Applications
	 * should treat the runtime fields (`texture`, `boundingBox`, and
	 * `activeProjectionPrecision`) as read-only inspection data.
	 *
	 * @param {Vector3} min - Minimum world-space grid corner.
	 * @param {Vector3} max - Maximum world-space grid corner.
	 * @param {Object} [options] - Probe grid options.
	 * @param {number} [options.resolution=4] - Probe count per axis, must be at least 2.
	 * @param {number} [options.cubemapSize=8] - Cubemap face size used during bake.
	 * @param {'auto'|'half float'|'float'} [options.projectionPrecision='auto'] - Projection texture precision policy.
	 * @param {number} [options.probeIntensity=1] - Runtime irradiance intensity.
	 * @param {number} [options.helperIntensity=1] - Helper display intensity.
	 * @param {number} [options.band1Intensity=1] - Diagnostic multiplier for first-band SH coefficients.
	 * @param {number} [options.band2Intensity=1] - Runtime multiplier for second-band SH coefficients.
	 * @param {number} [options.normalBias=0.5] - Sample offset along the receiver normal, in probe-spacing units.
	 * @param {number} [options.viewBias=0] - Sample offset toward the active camera, in probe-spacing units.
	 * @param {'off'|'normal'} [options.leakReductionMode='off'] - Optional scoped probe leak reduction.
	 * @param {?ArrayLike<number>} [options.probeValidity=null] - Optional per-probe validity weights packed during bake. Length must equal resolution^3.
	 * @param {?Renderer} [options.renderer=null] - Optional renderer for feature detection during construction.
	 */
	constructor( min, max, options = {} ) {

		super();

		/**
		 * This flag can be used for type testing.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isLightProbeGrid = true;
		this.type = 'LightProbeGridGPU';
		this.min = min.clone();
		this.max = max.clone();

		/**
		 * The world-space bounding box for the grid.
		 *
		 * @type {Box3}
		 * @readonly
		 */
		this.boundingBox = new Box3( this.min, this.max );
		this.resolution = this._validateResolution( options.resolution ?? 4 );
		this.cubemapSize = options.cubemapSize ?? 8;
		this.projectionPrecision = options.projectionPrecision ?? 'auto';

		/**
		 * The precision mode selected after WebGPU feature detection.
		 *
		 * @type {string}
		 * @readonly
		 */
		this.activeProjectionPrecision = 'half-linear';
		this.projectionFallbackType = null;

		this.probeIntensity = uniform( options.probeIntensity ?? 1 );
		this.helperIntensity = uniform( options.helperIntensity ?? 1 );
		this.helperDebugMode = uniform( this._validateHelperDebugMode( options.helperDebugMode ?? 'irradiance' ) );
		this.helperDepthMode = this._validateHelperDepthMode( options.helperDepthMode ?? 'depth-tested' );
		this.band1Intensity = uniform( options.band1Intensity ?? 1 );
		this.band2Intensity = uniform( options.band2Intensity ?? 1 );
		this.normalBias = uniform( options.normalBias ?? 0.5 );
		this.viewBias = uniform( options.viewBias ?? 0 );
		this.leakReductionMode = this._validateLeakReductionMode( options.leakReductionMode ?? 'off' );
		this.probeValiditySource = this._validateProbeValidity(
			options.probeValidity ?? null,
			this.resolution * this.resolution * this.resolution
		);

		this.cubeRenderTarget = null;
		this.cubeCamera = null;
		this.coefficientTarget = null;
		this.computeProjectionTexture = null;
		this.computeProjectionNode = null;
		this.computeProjectionProbeIndex = uniform( 0 );
		this.computeProjectionFallbackReason = null;
		this.atlasTarget = null;
		this.probeValidityTexture = null;
		this.probeValidityTextureWidth = 0;
		this.probeValidityTextureHeight = 0;
		this.invalidProbeCount = 0;
		this.visibilityDepthResolution = VISIBILITY_DEPTH_RESOLUTION;
		this.visibilityDepthTarget = null;
		this.visibilityDistanceTarget = null;
		this.visibilityDistanceCamera = null;
		this.visibilityDistanceMaterial = null;
		this.visibilityRepackScene = null;
		this.visibilityRepackCamera = null;
		this.visibilityRepackMesh = null;
		this.visibilityRepackMaterial = null;
		this.visibilityRepackProbeIndex = uniform( 0 );
		this.visibilityProbePosition = uniform( new Vector3() );
		this.visibilityProbeSpacing = uniform( 1 );
		this.visibilityMaxDistance = uniform( VISIBILITY_DEPTH_MAX_DISTANCE );
		this.visibilityBias = uniform( VISIBILITY_DISTANCE_BIAS );
		this.visibilityDepthWeighting = uniform( 1 );
		this.receiverLayerMask = uniform( DEFAULT_PROBE_LAYER_MASK, 'uint' );
		this.visibilityDepthMode = 'not-baked';
		this.visibilityCubemapMs = 0;
		this.visibilityRepackMs = 0;
		this._guardedVisibilityProofMode = 'off';
		this._probeKernelProofData = null;

		/**
		 * The atlas texture containing the packed SH coefficients.
		 *
		 * @type {?Texture}
		 * @readonly
		 */
		this.texture = null;
		this.projectionScene = null;
		this.projectionCamera = null;
		this.projectionMesh = null;
		this.projectionMaterial = null;
		this.repackScene = null;
		this.repackCamera = null;
		this.repackMesh = null;
		this.repackMaterial = null;
		this.repackFragmentMaterial = null;
		this.repackComputeProjectionMaterial = null;
		this.helper = null;
		this._activeProjectionBackend = 'fragment-coefficient-projection';
		this._projectionBackendOverride = 'auto';

		this.totalProbes = 0;
		this.paddedSlices = 0;
		this.atlasDepth = 0;

		this.repackTextureIndex = uniform( 0 );
		this.repackSliceZ = uniform( 0 );
		this.repackResolution = uniform( new Vector3() );
		this._bakePromise = null;

		this._createResources( options.renderer ?? null );

	}

	setOptions( options = {}, renderer = null ) {

		const nextResolution = this._validateResolution( options.resolution ?? this.resolution );
		const nextCubemapSize = options.cubemapSize ?? this.cubemapSize;
		const nextProjectionPrecision = options.projectionPrecision ?? this.projectionPrecision;
		const nextLeakReductionMode = this._validateLeakReductionMode( options.leakReductionMode ?? this.leakReductionMode );
		const hasProbeValidityOption = Object.prototype.hasOwnProperty.call( options, 'probeValidity' );
		const nextProbeValiditySource = this._validateProbeValidity(
			hasProbeValidityOption ? options.probeValidity : this.probeValiditySource,
			nextResolution * nextResolution * nextResolution
		);

		const recreate = nextResolution !== this.resolution ||
			nextCubemapSize !== this.cubemapSize ||
			nextProjectionPrecision !== this.projectionPrecision ||
			nextLeakReductionMode !== this.leakReductionMode;

		this.resolution = nextResolution;
		this.cubemapSize = nextCubemapSize;
		this.projectionPrecision = nextProjectionPrecision;
		this.leakReductionMode = nextLeakReductionMode;
		this.probeValiditySource = nextProbeValiditySource;

		if ( options.probeIntensity !== undefined ) this.probeIntensity.value = options.probeIntensity;
		if ( options.helperIntensity !== undefined ) this.helperIntensity.value = options.helperIntensity;
		if ( options.helperDebugMode !== undefined ) this.setHelperDebugMode( options.helperDebugMode );
		if ( options.helperDepthMode !== undefined ) this.setHelperDepthMode( options.helperDepthMode );
		if ( options.band1Intensity !== undefined ) this.band1Intensity.value = options.band1Intensity;
		if ( options.band2Intensity !== undefined ) this.band2Intensity.value = options.band2Intensity;
		if ( options.normalBias !== undefined ) this.normalBias.value = options.normalBias;
		if ( options.viewBias !== undefined ) this.viewBias.value = options.viewBias;

		if ( recreate ) this._createResources( renderer );
		else if ( hasProbeValidityOption ) this._createProbeValidityTexture();

	}

	_validateResolution( resolution ) {

		if ( Number.isInteger( resolution ) === false || resolution < 2 ) {

			throw new Error( 'LightProbeGridGPU: resolution must be an integer greater than or equal to 2.' );

		}

		return resolution;

	}

	_validateLeakReductionMode( mode ) {

		if ( mode !== 'off' && mode !== 'normal' ) {

			throw new Error( 'LightProbeGridGPU: leakReductionMode must be "off" or "normal".' );

		}

		return mode;

	}

	_validateHelperDebugMode( mode ) {

		if ( mode === 'irradiance' ) return 0;
		if ( mode === 'validity' ) return 1;

		throw new Error( `LightProbeGridGPU: helperDebugMode must be "irradiance" or "validity", got "${ mode }".` );

	}

	_validateHelperDepthMode( mode ) {

		if ( mode === 'depth-tested' || mode === 'x-ray' ) return mode;

		throw new Error( `LightProbeGridGPU: helperDepthMode must be "depth-tested" or "x-ray", got "${ mode }".` );

	}

	_validateProbeValidity( probeValidity, totalProbes ) {

		if ( probeValidity === null || probeValidity === undefined ) return null;

		if ( typeof probeValidity.length !== 'number' ) {

			throw new Error( 'LightProbeGridGPU: probeValidity must be an array-like object.' );

		}

		if ( probeValidity.length !== totalProbes ) {

			throw new Error( `LightProbeGridGPU: probeValidity length must equal resolution^3 (${ totalProbes }).` );

		}

		for ( let i = 0; i < probeValidity.length; i ++ ) {

			const value = probeValidity[ i ];

			if ( Number.isFinite( value ) === false || value < 0 || value > 1 ) {

				throw new Error( 'LightProbeGridGPU: probeValidity values must be finite numbers between 0 and 1.' );

			}

		}

		return probeValidity;

	}

	dispose() {

		if ( this.projectionMaterial !== null ) this.projectionMaterial.dispose();
		if ( this.computeProjectionNode !== null ) this.computeProjectionNode.dispose();
		if ( this.repackFragmentMaterial !== null ) this.repackFragmentMaterial.dispose();
		if ( this.repackComputeProjectionMaterial !== null ) this.repackComputeProjectionMaterial.dispose();
		if ( this.projectionMesh !== null ) this.projectionMesh.geometry.dispose();
		if ( this.repackMesh !== null ) this.repackMesh.geometry.dispose();
		if ( this.visibilityRepackMesh !== null ) this.visibilityRepackMesh.geometry.dispose();
		if ( this.helper !== null ) {

			this.helper.geometry.dispose();
			this.helper.material.dispose();

		}

		if ( this.cubeRenderTarget !== null ) this.cubeRenderTarget.dispose();
		if ( this.coefficientTarget !== null ) this.coefficientTarget.dispose();
		if ( this.computeProjectionTexture !== null ) this.computeProjectionTexture.dispose();
		if ( this.atlasTarget !== null ) this.atlasTarget.dispose();
		if ( this.probeValidityTexture !== null ) this.probeValidityTexture.dispose();
		if ( this.visibilityDepthTarget !== null ) this.visibilityDepthTarget.dispose();
		if ( this.visibilityDistanceTarget !== null ) this.visibilityDistanceTarget.dispose();
		if ( this.visibilityDistanceMaterial !== null ) this.visibilityDistanceMaterial.dispose();
		if ( this.visibilityRepackMaterial !== null ) this.visibilityRepackMaterial.dispose();

		this.projectionMaterial = null;
		this.computeProjectionNode = null;
		this.computeProjectionTexture = null;
		this.repackMaterial = null;
		this.repackFragmentMaterial = null;
		this.repackComputeProjectionMaterial = null;
		this.projectionScene = null;
		this.projectionCamera = null;
		this.projectionMesh = null;
		this.repackScene = null;
		this.repackCamera = null;
		this.repackMesh = null;
		this.visibilityRepackScene = null;
		this.visibilityRepackCamera = null;
		this.visibilityRepackMesh = null;
		this.visibilityRepackMaterial = null;
		this.helper = null;
		this.cubeRenderTarget = null;
		this.cubeCamera = null;
		this.coefficientTarget = null;
		this.atlasTarget = null;
		this.probeValidityTexture = null;
		this.probeValidityTextureWidth = 0;
		this.probeValidityTextureHeight = 0;
		this.visibilityDepthTarget = null;
		this.visibilityDistanceTarget = null;
		this.visibilityDistanceCamera = null;
		this.visibilityDistanceMaterial = null;
		this.visibilityDepthMode = 'not-baked';
		this.visibilityCubemapMs = 0;
		this.visibilityRepackMs = 0;
		this.texture = null;

	}

	getProbePosition( index, target ) {

		const resolution = this.resolution;
		const iz = Math.floor( index / ( resolution * resolution ) );
		const iy = Math.floor( ( index - iz * resolution * resolution ) / resolution );
		const ix = index % resolution;

		_gridSize.subVectors( this.max, this.min );

		target.set(
			this.min.x + ix * _gridSize.x / ( resolution - 1 ),
			this.min.y + iy * _gridSize.y / ( resolution - 1 ),
			this.min.z + iz * _gridSize.z / ( resolution - 1 )
		);

		return target;

	}

	updateBoundingBox() {

		this.boundingBox.set( this.min, this.max );

	}

	_getMinProbeSpacing() {

		_gridSize.subVectors( this.max, this.min );

		return Math.max(
			Math.min(
				_gridSize.x / ( this.resolution - 1 ),
				_gridSize.y / ( this.resolution - 1 ),
				_gridSize.z / ( this.resolution - 1 )
			),
			0.0001
		);

	}

	createLightsNode( sceneLights = [] ) {

		return lights( [ ...sceneLights, new IrradianceNode( this.createIrradianceNode() ) ] );

	}

	getPrecisionInfo( renderer = null ) {

		return {
			requestedPrecision: this.projectionPrecision,
			activePrecision: this.activeProjectionPrecision,
			textureType: this._getTextureType() === FloatType ? 'float' : 'half float',
			float32Filterable: renderer !== null ? renderer.hasFeature( 'float32-filterable' ) : null
		};

	}

	getMemoryInfo() {

		const bytesPerChannel = this._getTextureType() === FloatType ? 4 : 2;
		const rgbaBytes = 4 * bytesPerChannel;
		const cubemapBytes = 6 * this.cubemapSize * this.cubemapSize * rgbaBytes;
		const coefficientBytes = SH_COEFFICIENTS * this.totalProbes * rgbaBytes;
		const computeCoefficientBytes = this.computeProjectionTexture !== null ? coefficientBytes : 0;
		const atlasBytes = this.resolution * this.resolution * this.atlasDepth * rgbaBytes;
		const probeValidityBytes = this.probeValidityTextureWidth * this.probeValidityTextureHeight * 4 * 4;
		const visibilityDepthBytes = this.visibilityDepthTarget !== null ?
			this.visibilityDepthResolution * this.visibilityDepthResolution * this.totalProbes * rgbaBytes :
			0;
		const visibilityDistanceBytes = this.visibilityDistanceTarget !== null ? cubemapBytes : 0;

		return {
			cubemapBytes,
			coefficientBytes,
			computeCoefficientBytes,
			atlasBytes,
			probeValidityBytes,
			visibilityDepthBytes,
			visibilityDistanceBytes,
			total: cubemapBytes + coefficientBytes + computeCoefficientBytes + atlasBytes + probeValidityBytes + visibilityDepthBytes + visibilityDistanceBytes,
			bytesPerChannel,
			backend: {
				...BACKEND_LABELS,
				projection: this._activeProjectionBackend
			}
		};

	}

	getSamplingInfo() {

		return {
			normalBias: this.normalBias.value,
			viewBias: this.viewBias.value,
			leakReductionMode: this.leakReductionMode,
			probeValidityMode: this.probeValiditySource === null ? 'constant' : 'custom',
			invalidProbeCount: this.invalidProbeCount,
			probeMeta: {
				validityChannel: 'probeMeta.r',
				confidenceChannel: 'probeMeta.g',
				layerMaskChannel: 'probeMeta.b',
				defaultLayerMask: DEFAULT_PROBE_LAYER_MASK,
				receiverLayerMask: this.receiverLayerMask.value
			},
			visibilityDepthMode: this.visibilityDepthMode,
			visibilityDepthResolution: this.visibilityDepthResolution,
			visibilityDepthWeighting: this.visibilityDepthWeighting.value,
			guardedVisibilityProofMode: this._guardedVisibilityProofMode,
			probeKernelProofMode: this._probeKernelProofData === null ? 'default-ellipsoid' : 'custom-proof-data',
			probeKernelDefaultRegionId: 0,
			probeKernelDefaultLayerMask: 1,
			probeKernelDefaultSoftness: 1,
			manualIrradianceSampling: this._usesManualIrradianceSampling(),
			weightedProbeSampling: this._usesWeightedProbeSampling()
		};

	}

	getVisibilityDepthInfo() {

		const memory = this.getMemoryInfo();
		const available = this.visibilityDepthTarget !== null && this.visibilityDepthMode === 'moments';

		return {
			available,
			mode: this.visibilityDepthMode,
			encoding: 'radial-distance',
			resolution: available ? this.visibilityDepthResolution : 0,
			moments: available ? 2 : 0,
			bytes: available ? memory.visibilityDepthBytes : 0,
			texture: available ? {
				width: this.visibilityDepthResolution,
				height: this.visibilityDepthResolution,
				depth: this.totalProbes
			} : null,
			samples: [],
			stats: {
				sampleCount: 0,
				finiteSampleCount: 0,
				hitSampleCount: 0,
				minMeanDistance: null,
				maxMeanDistance: null,
				minVariance: null,
				maxVariance: null
			},
			hitConfidenceChannel: 'b',
			backfaceConfidenceChannel: 'a'
		};

	}

	_setGuardedVisibilityProofMode( mode ) {

		if ( mode !== 'off' && mode !== 'guarded' ) {

			throw new Error( 'LightProbeGridGPU: guarded visibility proof mode must be "off" or "guarded".' );

		}

		this._guardedVisibilityProofMode = mode;
		return this._guardedVisibilityProofMode;

	}

	_setProbeKernelProofData( data ) {

		this._probeKernelProofData = data ?? null;
		return this._probeKernelProofData;

	}

	_usesWeightedProbeSampling() {

		return this.leakReductionMode !== 'off';

	}

	_usesManualIrradianceSampling() {

		return this._usesWeightedProbeSampling();

	}

	_getPackedAtlasBaseLayer( textureIndex ) {

		return textureIndex * this.paddedSlices + ATLAS_PADDING;

	}

	_getPackedAtlasLayer( textureIndex, gridZ ) {

		return this._getPackedAtlasBaseLayer( textureIndex ) + gridZ;

	}

	_getPackedAtlasSampleZ( gridZ, textureIndex ) {

		return gridZ.add( this._getPackedAtlasBaseLayer( textureIndex ) ).div( this.atlasDepth );

	}

	_getPackedAtlasLoadCoord( x, y, gridZ, textureIndex = 0 ) {

		return ivec3( x, y, gridZ.add( this._getPackedAtlasBaseLayer( textureIndex ) ) );

	}

	createIrradianceNode() {

		return this._usesManualIrradianceSampling() ? this._createManualIrradianceNode() : this._createAtlasIrradianceNode();

	}

	_safeNormalize( vector ) {

		return vector.div( vector.length().max( 0.0001 ) );

	}

	_getBiasedSamplePosition( probeSpacing ) {

		const surfaceNormal = normalWorld.normalize();
		const viewDirection = this._safeNormalize( cameraPosition.sub( positionWorld ) );

		return positionWorld
			.add( surfaceNormal.mul( probeSpacing ).mul( this.normalBias ) )
			.add( viewDirection.mul( probeSpacing ).mul( this.viewBias ) );

	}

	_createAtlasIrradianceNode() {

		const resolution = this.resolution;
		const resolutionMinusOne = resolution - 1;
		const gridMinNode = vec3( this.min.x, this.min.y, this.min.z );
		const gridExtentNode = vec3(
			this.max.x - this.min.x,
			this.max.y - this.min.y,
			this.max.z - this.min.z
		);
		const probesSH = texture3D( this.atlasTarget.texture );

		const sampleAtlas = Fn( () => {

			const probeSpacing = gridExtentNode.div( resolutionMinusOne );
			const samplePosition = this._getBiasedSamplePosition( probeSpacing );
			const probeCoord = clamp( samplePosition.sub( gridMinNode ).div( gridExtentNode ), 0, 1 );
			const uvw = vec3(
				probeCoord.x.mul( resolutionMinusOne ).add( 0.5 ).div( resolution ),
				probeCoord.y.mul( resolutionMinusOne ).add( 0.5 ).div( resolution ),
				probeCoord.z.mul( resolutionMinusOne ).add( 0.5 ).div( resolution )
			);
			const gridZ = uvw.z.mul( resolution );

			const s0 = probesSH.sample( vec3( uvw.x, uvw.y, this._getPackedAtlasSampleZ( gridZ, 0 ) ) );
			const s1 = probesSH.sample( vec3( uvw.x, uvw.y, this._getPackedAtlasSampleZ( gridZ, 1 ) ) );
			const s2 = probesSH.sample( vec3( uvw.x, uvw.y, this._getPackedAtlasSampleZ( gridZ, 2 ) ) );
			const s3 = probesSH.sample( vec3( uvw.x, uvw.y, this._getPackedAtlasSampleZ( gridZ, 3 ) ) );
			const s4 = probesSH.sample( vec3( uvw.x, uvw.y, this._getPackedAtlasSampleZ( gridZ, 4 ) ) );
			const s5 = probesSH.sample( vec3( uvw.x, uvw.y, this._getPackedAtlasSampleZ( gridZ, 5 ) ) );
			const s6 = probesSH.sample( vec3( uvw.x, uvw.y, this._getPackedAtlasSampleZ( gridZ, 6 ) ) );

			return this._evaluatePackedSH( s0, s1, s2, s3, s4, s5, s6 ).mul( this.probeIntensity );

		} );

		return sampleAtlas();

	}

	_createManualIrradianceNode() {

		return this._createManualIrradianceDebugNode( 'finalIrradiance' );

	}

	_createManualIrradianceDebugNode( debugMode = 'finalIrradiance' ) {

		const resolution = this.resolution;
		const resolutionMinusOne = resolution - 1;
		const gridMinNode = vec3( this.min.x, this.min.y, this.min.z );
		const gridExtentNode = vec3(
			this.max.x - this.min.x,
			this.max.y - this.min.y,
			this.max.z - this.min.z
		);
		const packedLoad = texture3D( this.atlasTarget.texture ).setSampler( false );
		const useGuardedVisibility = this._guardedVisibilityProofMode === 'guarded' && this.visibilityDepthTarget !== null;
		const visibilityLoad = useGuardedVisibility ? texture3D( this.visibilityDepthTarget.texture ).setSampler( false ) : null;
		const probeMetaTextureWidth = this.probeValidityTextureWidth;

		const loadPackedSamples = ( coord ) => {

			const x = int( coord.x );
			const y = int( coord.y );
			const z = int( coord.z );

			return [
				packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 0 ) ),
				packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 1 ) ),
				packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 2 ) ),
				packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 3 ) ),
				packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 4 ) ),
				packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 5 ) ),
				packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 6 ) )
			];

		};

		const loadProbeMeta = ( probeIndex ) => textureLoad( this.probeValidityTexture, ivec2(
			probeIndex.mod( probeMetaTextureWidth ),
			probeIndex.div( probeMetaTextureWidth )
		) );

		const loadVisibilityMoment = useGuardedVisibility ? ( coord, direction ) => {

			const probeIndex = int( coord.x ).add( int( coord.y ).mul( resolution ) ).add( int( coord.z ).mul( resolution * resolution ) );
			const dir = this._safeNormalize( direction );
			const denominator = dir.x.abs().add( dir.y.abs() ).add( dir.z.abs() ).max( 0.0001 );
			const octX = dir.x.div( denominator ).toVar();
			const octY = dir.y.div( denominator ).toVar();

			If( dir.z.lessThan( 0 ), () => {

				const oldX = octX.toVar();
				octX.assign( float( 1 ).sub( octY.abs() ).mul( oldX.greaterThanEqual( 0 ).select( float( 1 ), float( - 1 ) ) ) );
				octY.assign( float( 1 ).sub( oldX.abs() ).mul( octY.greaterThanEqual( 0 ).select( float( 1 ), float( - 1 ) ) ) );

			} );

			const ix = int( clamp( octX.mul( 0.5 ).add( 0.5 ).mul( this.visibilityDepthResolution ), 0, this.visibilityDepthResolution - 1 ) );
			const iy = int( clamp( octY.mul( 0.5 ).add( 0.5 ).mul( this.visibilityDepthResolution ), 0, this.visibilityDepthResolution - 1 ) );

			return visibilityLoad.load( ivec3( ix, iy, probeIndex ) );

		} : null;

		const sampleManual = Fn( () => {

			const probeSpacing = gridExtentNode.div( resolutionMinusOne );
			const samplePosition = this._getBiasedSamplePosition( probeSpacing );
			const probeCoord = clamp( samplePosition.sub( gridMinNode ).div( gridExtentNode ), 0, 1 ).mul( resolutionMinusOne );
			const base = floor( probeCoord ).toVar();
			const blend = probeCoord.sub( base );

			const x0 = int( base.x );
			const y0 = int( base.y );
			const z0 = int( base.z );
			const x1 = int( clamp( base.x.add( 1 ), 0, resolutionMinusOne ) );
			const y1 = int( clamp( base.y.add( 1 ), 0, resolutionMinusOne ) );
			const z1 = int( clamp( base.z.add( 1 ), 0, resolutionMinusOne ) );

			const weightedSamples = [];
			const scalarSamples = [];
			const debugProbeBaseWeights = [];
			const debugProbeVisibilityWeights = [];
			const debugProbeVisibilities = [];
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

				debugProbeBaseWeights.push( float( 0 ).toVar() );
				debugProbeVisibilityWeights.push( float( 0 ).toVar() );
				debugProbeVisibilities.push( float( 0 ).toVar() );
				debugProbeIndices.push( float( 0 ).toVar() );

			}

			const addProbe = ( coord, trilinearWeight, debugSlot ) => {

				const sample = loadPackedSamples( coord );
				const probeIndex = int( coord.x ).add( int( coord.y ).mul( resolution ) ).add( int( coord.z ).mul( resolution * resolution ) );
				const meta = loadProbeMeta( probeIndex );
				const probePosition = gridMinNode.add( coord.toFloat().div( resolutionMinusOne ).mul( gridExtentNode ) );
				const probeDirection = this._safeNormalize( probePosition.sub( positionWorld ) );
				const wrapShading = normal.dot( probeDirection ).add( 1 ).mul( 0.5 );
				const normalWeight = wrapShading.mul( 0.5 ).add( 0.5 );
				const validityWeight = meta.x.max( PROBE_VALIDITY_FLOOR );
				const confidenceWeight = meta.y.clamp( 0, 1 );
				const sameLayer = meta.z.toUint().bitAnd( this.receiverLayerMask ).notEqual( uint( 0 ) ).select( float( 1 ), float( 0 ) );
				const kernelOffset = positionWorld.sub( probePosition ).div( probeSpacing.max( vec3( 0.0001 ) ) );
				const compatibleKernel = useGuardedVisibility ? kernelOffset.dot( kernelOffset ).negate().exp2() : float( 1 );
				const layerCompatibility = useGuardedVisibility ? sameLayer : float( 1 );
				const base = trilinearWeight.mul( normalWeight ).mul( validityWeight ).mul( confidenceWeight ).mul( layerCompatibility ).mul( compatibleKernel );
				const visibility = float( 1 ).toVar();

				if ( useGuardedVisibility ) {

					const receiverDirection = positionWorld.sub( probePosition );
					const receiverDistance = receiverDirection.length();
					const moment = loadVisibilityMoment( coord, receiverDirection );
					const variance = max( moment.y.sub( moment.x.mul( moment.x ) ), VISIBILITY_MIN_VARIANCE );
					const delta = max( receiverDistance.sub( moment.x ).sub( this.visibilityBias ), 0 );
					const chebyshev = variance.div( variance.add( delta.mul( delta ) ) );

					const hitConfidence = moment.z.clamp( 0, 1 );
					const momentVisibility = float( 1 ).sub( hitConfidence ).add( chebyshev.mul( hitConfidence ) ).clamp( 0, 1 );
					const visibilityMix = this.visibilityDepthWeighting.clamp( 0, 1 );

					visibility.assign( float( 1 ).sub( visibilityMix ).add( momentVisibility.mul( visibilityMix ) ).clamp( 0, 1 ) );

				}

				const weight = base.mul( visibility );

				debugProbeBaseWeights[ debugSlot ].assign( base );
				debugProbeVisibilityWeights[ debugSlot ].assign( weight );
				debugProbeVisibilities[ debugSlot ].assign( visibility );
				debugProbeIndices[ debugSlot ].assign( probeIndex.toFloat() );

				for ( let i = 0; i < PACKED_SH_TEXTURES; i ++ ) {

					// Accumulate packed SH coefficients. `_evaluateCoefficients()` clamps
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
			const visibilityMass = useGuardedVisibility ? totalWeight.div( baseWeight.max( 0.0001 ) ).clamp( 0, 1 ) : float( 1 );
			const scalarIrradiance = this._evaluatePackedSH(
				scalarSamples[ 0 ].div( safeBaseWeight ),
				scalarSamples[ 1 ].div( safeBaseWeight ),
				scalarSamples[ 2 ].div( safeBaseWeight ),
				scalarSamples[ 3 ].div( safeBaseWeight ),
				scalarSamples[ 4 ].div( safeBaseWeight ),
				scalarSamples[ 5 ].div( safeBaseWeight ),
				scalarSamples[ 6 ].div( safeBaseWeight )
			).mul( this.probeIntensity );
			const visibilityIrradiance = this._evaluatePackedSH(
				weightedSamples[ 0 ].div( safeWeight ),
				weightedSamples[ 1 ].div( safeWeight ),
				weightedSamples[ 2 ].div( safeWeight ),
				weightedSamples[ 3 ].div( safeWeight ),
				weightedSamples[ 4 ].div( safeWeight ),
				weightedSamples[ 5 ].div( safeWeight ),
				weightedSamples[ 6 ].div( safeWeight )
			).mul( this.probeIntensity );
			const finalVisibilityIrradiance = visibilityIrradiance.mul( visibilityMass );
			const visibilityBlend = this.visibilityDepthWeighting.clamp( 0, 1 );
			const finalIrradiance = scalarIrradiance.mul( float( 1 ).sub( visibilityBlend ) ).add( finalVisibilityIrradiance.mul( visibilityBlend ) );
			const probeIndexScale = float( resolution * resolution * resolution - 1 ).max( 1 );

			if ( debugMode === 'samplePositionGrid' ) return clamp( samplePosition.sub( gridMinNode ).div( gridExtentNode ), 0, 1 );
			if ( debugMode === 'baseProbeCoordGrid' ) return base.div( resolutionMinusOne );
			if ( debugMode === 'trilinearBlend' ) return blend;
			if ( debugMode === 'probeCoordGrid' ) return probeCoord.div( resolutionMinusOne );

			for ( let i = 0; i < 8; i ++ ) {

				if ( debugMode === `neighbor${ i }BaseWeight` ) return vec3( debugProbeBaseWeights[ i ] );
				if ( debugMode === `neighbor${ i }VisibilityWeight` ) return vec3( debugProbeVisibilityWeights[ i ] );
				if ( debugMode === `neighbor${ i }Visibility` ) return vec3( debugProbeVisibilities[ i ] );
				if ( debugMode === `neighbor${ i }ProbeIndex` ) return vec3( debugProbeIndices[ i ].div( probeIndexScale ) );

			}

			if ( debugMode === 'scalarWeight' ) return vec3( baseWeight );
			if ( debugMode === 'visibilityWeight' ) return vec3( totalWeight );
			if ( debugMode === 'visibilityMix' || debugMode === 'visibilityOverScalar' ) return vec3( visibilityMass );
			if ( debugMode === 'scalarIrradiance' ) return scalarIrradiance;
			if ( debugMode === 'visibilityIrradiance' ) return visibilityIrradiance;

			return finalIrradiance;

		} );

		return sampleManual();

	}

	_evaluatePackedSH( s0, s1, s2, s3, s4, s5, s6 ) {

		const c0 = s0.xyz;
		const c1 = vec3( s0.w, s1.x, s1.y );
		const c2 = vec3( s1.z, s1.w, s2.x );
		const c3 = s2.yzw;
		const c4 = s3.xyz;
		const c5 = vec3( s3.w, s4.x, s4.y );
		const c6 = vec3( s4.z, s4.w, s5.x );
		const c7 = s5.yzw;
		const c8 = s6.xyz;

		return this._evaluateCoefficients( c0, c1, c2, c3, c4, c5, c6, c7, c8 );

	}

	_evaluateCoefficients( c0, c1, c2, c3, c4, c5, c6, c7, c8 ) {

		const normal = normalWorld.normalize();
		const x = normal.x;
		const y = normal.y;
		const z = normal.z;
		const band1Intensity = this.band1Intensity;
		const band2Intensity = this.band2Intensity;

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

	}

	createHelper() {

		if ( this.helper !== null ) return this.helper;

		this._createHelper();
		return this.helper;

	}

	setHelperDebugMode( mode ) {

		this.helperDebugMode.value = this._validateHelperDebugMode( mode );
		return this;

	}

	setHelperDepthMode( mode ) {

		this.helperDepthMode = this._validateHelperDepthMode( mode );
		this._applyHelperDepthMode();

		return this;

	}

	_applyHelperDepthMode() {

		if ( this.helper === null ) return;

		const xRay = this.helperDepthMode === 'x-ray';
		this.helper.material.depthTest = xRay === false;
		this.helper.material.depthWrite = false;
		this.helper.material.needsUpdate = true;
		this.helper.renderOrder = xRay ? 1000 : 0;

	}

	/**
	 * Bakes the probe grid and returns the in-flight bake promise.
	 *
	 * Calling this method again while a bake is running returns the same promise
	 * so overlapping bake requests cannot allocate or render concurrently.
	 *
	 * @param {Renderer} renderer - The renderer.
	 * @param {Scene} scene - The scene to bake.
	 * @param {Object} [options] - Bake options.
	 * @param {Function} [options.onResourcesChanged] - Callback fired when fallback resources are recreated.
	 * @return {Promise<Object>} Resolves with bake timing and precision metadata.
	 */
	bake( renderer, scene, options = {} ) {

		if ( this._bakePromise !== null ) return this._bakePromise;

		this._bakePromise = Promise.resolve()
			.then( () => this._bake( renderer, scene, options ) )
			.finally( () => {

				this._bakePromise = null;

			} );

		return this._bakePromise;

	}

	_canUseComputeProjection( renderer ) {

		return renderer !== null &&
			renderer.isWebGPURenderer === true &&
			typeof renderer.compute === 'function' &&
			this.computeProjectionNode !== null &&
			this.computeProjectionTexture !== null &&
			this.computeProjectionFallbackReason === null;

	}

	_validateProjectionBackendOverride( projectionBackendOverride ) {

		if ( projectionBackendOverride !== 'auto' &&
			projectionBackendOverride !== 'force-fragment' &&
			projectionBackendOverride !== 'force-compute' ) {

			throw new Error( 'LightProbeGridGPU: projectionBackendOverride must be "auto", "force-fragment", or "force-compute".' );

		}

		return projectionBackendOverride;

	}

	_setProjectionBackendOverrideForProfiling( projectionBackendOverride ) {

		this._projectionBackendOverride = this._validateProjectionBackendOverride( projectionBackendOverride );
		return this._projectionBackendOverride;

	}

	_selectProjectionBackend( renderer, projectionBackendOverride = this._projectionBackendOverride ) {

		const override = this._validateProjectionBackendOverride( projectionBackendOverride );

		if ( override === 'force-fragment' ) return 'fragment-coefficient-projection';

		return this._canUseComputeProjection( renderer ) ?
			'compute-probe-reduction' :
			'fragment-coefficient-projection';

	}

	_setRepackSource( projectionBackend ) {

		const material = projectionBackend === 'compute-probe-reduction' ?
			this.repackComputeProjectionMaterial :
			this.repackFragmentMaterial;

		this.repackMaterial = material;

		if ( this.repackMesh !== null ) this.repackMesh.material = material;

	}

	_runFragmentCoefficientProjection( renderer, probeIndex ) {

		this.coefficientTarget.viewport.set( 0, probeIndex, SH_COEFFICIENTS, 1 );
		this.coefficientTarget.scissor.set( 0, probeIndex, SH_COEFFICIENTS, 1 );

		renderer.setRenderTarget( this.coefficientTarget );
		renderer.autoClear = false;
		renderer.render( this.projectionScene, this.projectionCamera );

	}

	_runComputeProjection( renderer, probeIndex ) {

		this.computeProjectionProbeIndex.value = probeIndex;
		renderer.compute( this.computeProjectionNode );

	}

	async _bake( renderer, scene, options = {} ) {

		this._resolvePrecision( renderer );
		this.updateBoundingBox();

		const currentRenderTarget = renderer.getRenderTarget();
		const currentScissorTest = renderer.getScissorTest();
		const currentAutoClear = renderer.autoClear;
		const currentMatrixWorldAutoUpdate = scene.matrixWorldAutoUpdate;
		const currentOverrideMaterial = scene.overrideMaterial;
		const hasShadowMap = renderer.shadowMap !== undefined;
		const currentShadowAutoUpdate = hasShadowMap ? renderer.shadowMap.autoUpdate : undefined;
		const currentProbeIntensity = this.probeIntensity.value;
		const currentHelperVisible = this.helper?.visible ?? false;
		const timingSource = getBakeTimingSource();
		const deterministicTimerDetected = isDeterministicPerformanceNow();
		const totalStart = getBakeTimingNow();

		let cubemapMs = 0;
		let projectionMs = 0;
		let sceneUpdateMs = 0;
		let copyMs = 0;
		let visibilityCubemapMs = 0;
		let visibilityRepackMs = 0;
		let retryHalfFloat = false;
		let retryFragmentProjection = false;
		const projectionBackendOverride = this._validateProjectionBackendOverride( options.projectionBackendOverride ?? this._projectionBackendOverride );
		const projectionBackend = this._selectProjectionBackend( renderer, projectionBackendOverride );
		const projectionCubemapSweepsPerProbe = projectionBackend === 'compute-probe-reduction' ? 1 : SH_COEFFICIENTS;
		const projectionTexelVisits = this.totalProbes * projectionCubemapSweepsPerProbe * 6 * this.cubemapSize * this.cubemapSize;

		this._activeProjectionBackend = projectionBackend;
		this._setRepackSource( projectionBackend );

		renderer.getViewport( _currentViewport );
		renderer.getScissor( _currentScissor );

		try {

			const sceneUpdateStart = getBakeTimingNow();
			scene.updateMatrixWorld( true );
			scene.matrixWorldAutoUpdate = false;
			sceneUpdateMs += getBakeTimingNow() - sceneUpdateStart;

			if ( hasShadowMap ) {

				renderer.shadowMap.autoUpdate = false;
				renderer.shadowMap.needsUpdate = true;

			}

			this.probeIntensity.value = 0;
			if ( this.helper !== null ) this.helper.visible = false;

			this.coefficientTarget.scissorTest = false;
			renderer.setRenderTarget( this.coefficientTarget );
			renderer.clear();
			renderer.setScissorTest( false );

			for ( let i = 0; i < this.totalProbes; i ++ ) {

				this.getProbePosition( i, _probePosition );
				this.cubeCamera.position.copy( _probePosition );
				this.visibilityDistanceCamera.position.copy( _probePosition );
				this.visibilityProbePosition.value.copy( _probePosition );
				this.visibilityProbeSpacing.value = this._getMinProbeSpacing();

				let phaseStart = getBakeTimingNow();
				renderer.autoClear = true;
				this.cubeCamera.update( renderer, scene );
				cubemapMs += getBakeTimingNow() - phaseStart;

				phaseStart = getBakeTimingNow();

				if ( projectionBackend === 'compute-probe-reduction' ) {

					this._runComputeProjection( renderer, i );

				} else {

					this._runFragmentCoefficientProjection( renderer, i );

				}

				projectionMs += getBakeTimingNow() - phaseStart;

				phaseStart = getBakeTimingNow();
				scene.overrideMaterial = this.visibilityDistanceMaterial;
				this.visibilityDistanceCamera.update( renderer, scene );
				scene.overrideMaterial = currentOverrideMaterial;
				visibilityCubemapMs += getBakeTimingNow() - phaseStart;

				phaseStart = getBakeTimingNow();
				await this._repackVisibilityDepth( renderer, i );
				visibilityRepackMs += getBakeTimingNow() - phaseStart;

			}

			const copyStart = getBakeTimingNow();
			await this._repackAtlas( renderer );
			copyMs = getBakeTimingNow() - copyStart;

		} catch ( error ) {

			if ( projectionBackend === 'compute-probe-reduction' ) {

				retryFragmentProjection = true;
				this.computeProjectionFallbackReason = error instanceof Error ? error.message : String( error );
				this._activeProjectionBackend = 'fragment-coefficient-projection';
				this._setRepackSource( 'fragment-coefficient-projection' );

			} else if ( this.projectionFallbackType === null &&
				this.projectionPrecision === 'float' &&
				( this.coefficientTarget.texture.type === FloatType || this.atlasTarget.texture.type === FloatType ) ) {

				retryHalfFloat = true;
				this.projectionFallbackType = HalfFloatType;
				this._createResources( renderer );
				if ( options.onResourcesChanged !== undefined ) options.onResourcesChanged();

			} else {

				throw error;

			}

		} finally {

			renderer.setRenderTarget( currentRenderTarget );
			renderer.setViewport( _currentViewport );
			renderer.setScissor( _currentScissor );
			renderer.setScissorTest( currentScissorTest );
			renderer.autoClear = currentAutoClear;
			scene.matrixWorldAutoUpdate = currentMatrixWorldAutoUpdate;
			scene.overrideMaterial = currentOverrideMaterial;

			if ( hasShadowMap ) renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

			this.probeIntensity.value = currentProbeIntensity;
			if ( this.helper !== null ) this.helper.visible = currentHelperVisible;
			this.coefficientTarget.viewport.set( 0, 0, SH_COEFFICIENTS, this.totalProbes );
			this.coefficientTarget.scissor.set( 0, 0, SH_COEFFICIENTS, this.totalProbes );

		}

		if ( retryFragmentProjection ) return this._bake( renderer, scene, options );
		if ( retryHalfFloat ) return this._bake( renderer, scene, options );

		const roundedSceneUpdateMs = Number( sceneUpdateMs.toFixed( 2 ) );
		const roundedCubemapMs = Number( cubemapMs.toFixed( 2 ) );
		const roundedProjectionMs = Number( projectionMs.toFixed( 2 ) );
		const roundedCopyMs = Number( copyMs.toFixed( 2 ) );
		const timingSourceKind = getBakeTimingSourceKind( timingSource );

		this.visibilityCubemapMs = Number( visibilityCubemapMs.toFixed( 2 ) );
		this.visibilityRepackMs = Number( visibilityRepackMs.toFixed( 2 ) );

		const timingBuckets = {
			sceneUpdateMs: roundedSceneUpdateMs,
			radianceCubemapCaptureMs: roundedCubemapMs,
			distanceCubemapCaptureMs: this.visibilityCubemapMs,
			computeShProjectionMs: roundedProjectionMs,
			visibilityRepackMs: this.visibilityRepackMs,
			atlasRepackMs: roundedCopyMs,
			verifierReadbackMs: 0,
			runtimeFastAtlasMs: null,
			runtimeGuardedGatherMs: null,
			runtimeMomentTextureLoadMs: null,
			runtimeKernelMathMs: null,
			runtimeVisibilityMassMs: null,
			runtimeShEvaluationMs: null,
			source: timingSourceKind,
			legacySource: timingSource,
			verifierReadbackTimingSource: 'unavailable',
			runtimeTimingSource: 'unavailable'
		};

		return {
			sceneUpdateMs: roundedSceneUpdateMs,
			cubemapMs: roundedCubemapMs,
			radianceCubemapCaptureMs: roundedCubemapMs,
			projectionMs: roundedProjectionMs,
			computeShProjectionMs: roundedProjectionMs,
			copyMs: roundedCopyMs,
			atlasRepackMs: roundedCopyMs,
			visibilityCubemapMs: this.visibilityCubemapMs,
			distanceCubemapCaptureMs: this.visibilityCubemapMs,
			visibilityRepackMs: this.visibilityRepackMs,
			verifierReadbackMs: 0,
			verifierReadbackTimingSource: 'unavailable',
			visibilityDepthMode: this.visibilityDepthMode,
			projectionBackendRequest: projectionBackendOverride,
			projectionBackend: this._activeProjectionBackend,
			projectionBackendForced: projectionBackendOverride !== 'auto',
			projectionCubemapSweepsPerProbe,
			projectionTexelVisits,
			projectionTexelVisitReductionRatio: projectionBackend === 'compute-probe-reduction' ?
				Number( ( 1 - ( 1 / SH_COEFFICIENTS ) ).toFixed( 4 ) ) :
				0,
			computeProjectionFallbackReason: this.computeProjectionFallbackReason,
			totalBakeMs: Number( ( getBakeTimingNow() - totalStart ).toFixed( 2 ) ),
			timingSource,
			timingSourceKind,
			gpuTimestampStatus: 'unavailable',
			projectionTimingSource: timingSource,
			deterministicTimerDetected,
			timingBuckets,
			precision: this.getPrecisionInfo( renderer )
		};

	}

	async _repackAtlas( renderer ) {

		this.atlasTarget.viewport.set( 0, 0, this.resolution, this.resolution );
		this.atlasTarget.scissor.set( 0, 0, this.resolution, this.resolution );
		this.atlasTarget.scissorTest = false;
		this.repackResolution.value.set( this.resolution, this.resolution, this.resolution );

		renderer.autoClear = false;

		for ( let textureIndex = 0; textureIndex < PACKED_SH_TEXTURES; textureIndex ++ ) {

			this.repackTextureIndex.value = textureIndex;

			for ( let iz = 0; iz < this.resolution; iz ++ ) {

				this.repackSliceZ.value = iz;
				renderer.setRenderTarget( this.atlasTarget, this._getPackedAtlasLayer( textureIndex, iz ) );
				renderer.render( this.repackScene, this.repackCamera );

			}

			this.repackSliceZ.value = 0;
			renderer.setRenderTarget( this.atlasTarget, this._getPackedAtlasLayer( textureIndex, - ATLAS_PADDING ) );
			renderer.render( this.repackScene, this.repackCamera );

			this.repackSliceZ.value = this.resolution - 1;
			renderer.setRenderTarget( this.atlasTarget, this._getPackedAtlasLayer( textureIndex, this.resolution ) );
			renderer.render( this.repackScene, this.repackCamera );

		}

	}

	async _repackVisibilityDepth( renderer, probeIndex ) {

		this.visibilityDepthTarget.viewport.set( 0, 0, this.visibilityDepthResolution, this.visibilityDepthResolution );
		this.visibilityDepthTarget.scissor.set( 0, 0, this.visibilityDepthResolution, this.visibilityDepthResolution );
		this.visibilityDepthTarget.scissorTest = false;
		this.visibilityRepackProbeIndex.value = probeIndex;

		renderer.autoClear = false;
		renderer.setRenderTarget( this.visibilityDepthTarget, probeIndex );
		renderer.render( this.visibilityRepackScene, this.visibilityRepackCamera );
		this.visibilityDepthMode = 'moments';

	}

	_createResources( renderer = null ) {

		const oldHelperVisible = this.helper?.visible ?? false;
		this.dispose();
		this.computeProjectionFallbackReason = null;

		this.totalProbes = this.resolution * this.resolution * this.resolution;
		this.paddedSlices = this.resolution + 2 * ATLAS_PADDING;
		this.atlasDepth = PACKED_SH_TEXTURES * this.paddedSlices;

		this._resolvePrecision( renderer );

		this.cubeRenderTarget = new CubeRenderTarget( this.cubemapSize, {
			type: HalfFloatType,
			generateMipmaps: false
		} );

		this.cubeCamera = new CubeCamera( 0.05, 20, this.cubeRenderTarget );
		this.visibilityDistanceTarget = new CubeRenderTarget( this.cubemapSize, {
			type: this._getTextureType(),
			generateMipmaps: false
		} );
		this.visibilityDistanceCamera = new CubeCamera( 0.05, VISIBILITY_DEPTH_MAX_DISTANCE, this.visibilityDistanceTarget );
		this.coefficientTarget = new RenderTarget( SH_COEFFICIENTS, this.totalProbes, {
			format: RGBAFormat,
			type: this._getTextureType(),
			minFilter: NearestFilter,
			magFilter: NearestFilter,
			depthBuffer: false
		} );
		this.computeProjectionTexture = new StorageTexture( SH_COEFFICIENTS, this.totalProbes );
		this.computeProjectionTexture.format = RGBAFormat;
		this.computeProjectionTexture.type = this._getTextureType();
		this.computeProjectionTexture.minFilter = NearestFilter;
		this.computeProjectionTexture.magFilter = NearestFilter;
		this.computeProjectionTexture.generateMipmaps = false;
		this.computeProjectionTexture.mipmapsAutoUpdate = false;

		this.atlasTarget = new RenderTarget3D( this.resolution, this.resolution, this.atlasDepth, {
			format: RGBAFormat,
			type: this._getTextureType(),
			minFilter: LinearFilter,
			magFilter: LinearFilter,
			generateMipmaps: false,
			depthBuffer: false
		} );
		this.texture = this.atlasTarget.texture;
		this.visibilityDepthTarget = new RenderTarget3D(
			this.visibilityDepthResolution,
			this.visibilityDepthResolution,
			this.totalProbes,
			{
				format: RGBAFormat,
				type: this._getTextureType(),
				minFilter: NearestFilter,
				magFilter: NearestFilter,
				generateMipmaps: false,
				depthBuffer: false
			}
		);

		this._createProbeValidityTexture();
		this.projectionMaterial = this._createProjectionMaterial();
		this.computeProjectionNode = this._createComputeProjectionNode();
		this.repackFragmentMaterial = this._createRepackMaterial( this.coefficientTarget.texture );
		this.repackComputeProjectionMaterial = this._createRepackMaterial( this.computeProjectionTexture );
		this.repackMaterial = this.repackFragmentMaterial;
		this.visibilityDistanceMaterial = this._createVisibilityDistanceMaterial();
		this.visibilityRepackMaterial = this._createVisibilityRepackMaterial();

		if ( this.projectionScene === null ) {

			this.projectionCamera = new OrthographicCamera( - 1, 1, 1, - 1, - 1, 1 );
			this.projectionMesh = new Mesh( new PlaneGeometry( 2, 2 ), this.projectionMaterial );
			this.projectionScene = new Scene();
			this.projectionScene.add( this.projectionMesh );

		}

		if ( this.repackScene === null ) {

			this.repackCamera = new OrthographicCamera( - 1, 1, 1, - 1, - 1, 1 );
			this.repackMesh = new Mesh( new PlaneGeometry( 2, 2 ), this.repackMaterial );
			this.repackScene = new Scene();
			this.repackScene.add( this.repackMesh );

		}

		if ( this.visibilityRepackScene === null ) {

			this.visibilityRepackCamera = new OrthographicCamera( - 1, 1, 1, - 1, - 1, 1 );
			this.visibilityRepackMesh = new Mesh( new PlaneGeometry( 2, 2 ), this.visibilityRepackMaterial );
			this.visibilityRepackScene = new Scene();
			this.visibilityRepackScene.add( this.visibilityRepackMesh );

		}

		this.projectionMesh.material = this.projectionMaterial;
		this.repackMesh.material = this.repackMaterial;
		this.visibilityRepackMesh.material = this.visibilityRepackMaterial;
		this._createHelper();
		this.helper.visible = oldHelperVisible;

	}

	_createProbeValidityTexture() {

		const textureWidth = Math.ceil( Math.sqrt( this.totalProbes ) );
		const textureHeight = Math.ceil( this.totalProbes / textureWidth );
		const recreateTexture = this.probeValidityTexture === null ||
			this.probeValidityTextureWidth !== textureWidth ||
			this.probeValidityTextureHeight !== textureHeight;

		if ( recreateTexture && this.probeValidityTexture !== null ) this.probeValidityTexture.dispose();

		this.probeValidityTextureWidth = textureWidth;
		this.probeValidityTextureHeight = textureHeight;
		this.invalidProbeCount = 0;

		const data = recreateTexture ?
			new Float32Array( this.probeValidityTextureWidth * this.probeValidityTextureHeight * 4 ) :
			this.probeValidityTexture.image.data;

		data.fill( 0 );

		for ( let i = 0; i < this.totalProbes; i ++ ) {

			const validity = this.probeValiditySource === null ? 1 : this.probeValiditySource[ i ];
			const offset = i * 4;

			data[ offset ] = validity;
			data[ offset + 1 ] = validity;
			data[ offset + 2 ] = DEFAULT_PROBE_LAYER_MASK;
			data[ offset + 3 ] = 1;

			if ( validity < 1 ) this.invalidProbeCount ++;

		}

		if ( recreateTexture ) {

			this.probeValidityTexture = new DataTexture(
				data,
				this.probeValidityTextureWidth,
				this.probeValidityTextureHeight,
				RGBAFormat,
				FloatType
			);
			this.probeValidityTexture.minFilter = NearestFilter;
			this.probeValidityTexture.magFilter = NearestFilter;
			this.probeValidityTexture.generateMipmaps = false;

		}

		this.probeValidityTexture.needsUpdate = true;

	}

	_createHelper() {

		const geometry = new SphereGeometry( 0.055, 12, 8 );
		const material = new MeshBasicNodeMaterial();
		const atlasLoad = texture3D( this.atlasTarget.texture ).setSampler( false );
		const helperDebugMode = this.helperDebugMode;
		const evaluateInstanceProbe = Fn( () => {

			const index = int( instanceIndex );
			const z = index.div( this.resolution * this.resolution );
			const y = index.sub( z.mul( this.resolution * this.resolution ) ).div( this.resolution );
			const x = index.sub( z.mul( this.resolution * this.resolution ) ).sub( y.mul( this.resolution ) );
			const s0 = atlasLoad.load( this._getPackedAtlasLoadCoord( x, y, z ) ).xyz;
			const validity = atlasLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 6 ) ).w;
			const irradianceColor = max( s0.mul( 0.886227 ), vec3( 0 ) );
			const validityColor = vec3( 1.0, 0.12, 0.08 ).toVar();
			const helperColor = irradianceColor.toVar();

			If( validity.greaterThanEqual( 0.999 ), () => {

				validityColor.assign( vec3( 0.08, 1.0, 0.22 ) );

			} ).ElseIf( validity.greaterThanEqual( 0.5 ), () => {

				validityColor.assign( vec3( 1.0, 0.72, 0.05 ) );

			} );

			If( helperDebugMode.greaterThan( 0.5 ), () => {

				helperColor.assign( validityColor );

			} );

			return helperColor;

		} );

		material.colorNode = evaluateInstanceProbe().mul( this.helperIntensity );

		this.helper = new InstancedMesh( geometry, material, this.totalProbes );

		for ( let i = 0; i < this.totalProbes; i ++ ) {

			this.getProbePosition( i, _probePosition );
			_matrix.makeTranslation( _probePosition.x, _probePosition.y, _probePosition.z );
			this.helper.setMatrixAt( i, _matrix );

		}

		this.helper.instanceMatrix.needsUpdate = true;
		this._applyHelperDepthMode();

	}

	_createVisibilityDistanceMaterial() {

		const material = new MeshBasicNodeMaterial();
		const distance = positionWorld.sub( this.visibilityProbePosition ).length();
		const normalizedDistance = distance.div( this.visibilityMaxDistance ).clamp( 0, 1 );

		material.colorNode = vec3( normalizedDistance );
		material.toneMapped = false;

		return material;

	}

	_createVisibilityRepackMaterial() {

		const pixelSize = float( 1 ).div( this.visibilityDepthResolution );
		const halfPixel = pixelSize.mul( 0.5 );
		const negativeHalfPixel = float( 0 ).sub( halfPixel );
		const distanceCube = this.visibilityDistanceTarget.texture;

		const octaDirection = Fn( ( { octUv } ) => {

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

		const sampleRadialDistance = Fn( ( { octUv } ) => {

			const dir = octaDirection( { octUv } );
			const normalizedDistance = cubeTexture( distanceCube, dir, 0 ).r.clamp( 0, 1 );
			const receiverDistance = normalizedDistance.mul( this.visibilityMaxDistance );
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
				.add( VISIBILITY_MIN_VARIANCE );
			const hitConfidence = hitSum.div( 5 ).clamp( 0, 1 );

			return vec4( meanDistance, meanSquaredDistance, hitConfidence, float( 0 ) );

		} );

		const material = new NodeMaterial();
		material.fragmentNode = repack();
		material.toneMapped = false;

		return material;

	}

	_createProjectionMaterial() {

		const cubemapSize = this.cubemapSize;
		const pixelSize = 2 / cubemapSize;

		const shBasis = Fn( ( { coefficient, dir } ) => {

			const basis = float( 0 ).toVar();
			const x = dir.x;
			const y = dir.y;
			const z = dir.z;

			If( coefficient.equal( uint( 0 ) ), () => {

				basis.assign( 0.282095 );

			} ).ElseIf( coefficient.equal( uint( 1 ) ), () => {

				basis.assign( y.mul( 0.488603 ) );

			} ).ElseIf( coefficient.equal( uint( 2 ) ), () => {

				basis.assign( z.mul( 0.488603 ) );

			} ).ElseIf( coefficient.equal( uint( 3 ) ), () => {

				basis.assign( x.mul( 0.488603 ) );

			} ).ElseIf( coefficient.equal( uint( 4 ) ), () => {

				basis.assign( x.mul( y ).mul( 1.092548 ) );

			} ).ElseIf( coefficient.equal( uint( 5 ) ), () => {

				basis.assign( y.mul( z ).mul( 1.092548 ) );

			} ).ElseIf( coefficient.equal( uint( 6 ) ), () => {

				basis.assign( z.mul( z ).mul( 3.0 ).sub( 1.0 ).mul( 0.315392 ) );

			} ).ElseIf( coefficient.equal( uint( 7 ) ), () => {

				basis.assign( x.mul( z ).mul( 1.092548 ) );

			} ).Else( () => {

				basis.assign( x.mul( x ).sub( y.mul( y ) ).mul( 0.546274 ) );

			} );

			return basis;

		} );

		const projectCube = Fn( () => {

			const coefficient = uint( uv().x.mul( SH_COEFFICIENTS ).floor() );
			const accum = vec3( 0 ).toVar();
			const totalWeight = float( 0 ).toVar();

			Loop( { start: int( 0 ), end: int( 6 ), type: 'int', condition: '<' }, ( { i: face } ) => {

				Loop( { start: int( 0 ), end: int( cubemapSize ), type: 'int', condition: '<' }, ( { i: iy } ) => {

					Loop( { start: int( 0 ), end: int( cubemapSize ), type: 'int', condition: '<' }, ( { i: ix } ) => {

						const col = float( 1.0 ).sub( float( ix ).add( 0.5 ).mul( pixelSize ) );
						const row = float( 1.0 ).sub( float( iy ).add( 0.5 ).mul( pixelSize ) );
						const coord = vec3( 0 ).toVar();

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

						const lengthSq = coord.dot( coord );
						const weight = float( 4.0 ).div( lengthSq.sqrt().mul( lengthSq ) );
						const dir = coord.normalize();
						const radiance = cubeTexture( this.cubeRenderTarget.texture, coord, 0 ).rgb;

						totalWeight.addAssign( weight );
						accum.addAssign( radiance.mul( weight ).mul( shBasis( { coefficient, dir } ) ) );

					} );

				} );

			} );

			const norm = float( 4 * Math.PI ).div( totalWeight );
			return accum.mul( norm );

		} );

		const material = new NodeMaterial();
		material.fragmentNode = projectCube();
		material.toneMapped = false;

		return material;

	}

	_createComputeProjectionNode() {

		const cubemapSize = this.cubemapSize;
		const pixelSize = 2 / cubemapSize;

		const computeProjection = Fn( () => {

			const probeIndex = uint( this.computeProjectionProbeIndex );
			const c0 = vec3( 0 ).toVar();
			const c1 = vec3( 0 ).toVar();
			const c2 = vec3( 0 ).toVar();
			const c3 = vec3( 0 ).toVar();
			const c4 = vec3( 0 ).toVar();
			const c5 = vec3( 0 ).toVar();
			const c6 = vec3( 0 ).toVar();
			const c7 = vec3( 0 ).toVar();
			const c8 = vec3( 0 ).toVar();
			const totalWeight = float( 0 ).toVar();

			Loop( { start: int( 0 ), end: int( 6 ), type: 'int', condition: '<' }, ( { i: face } ) => {

				Loop( { start: int( 0 ), end: int( cubemapSize ), type: 'int', condition: '<' }, ( { i: iy } ) => {

					Loop( { start: int( 0 ), end: int( cubemapSize ), type: 'int', condition: '<' }, ( { i: ix } ) => {

						const col = float( 1.0 ).sub( float( ix ).add( 0.5 ).mul( pixelSize ) );
						const row = float( 1.0 ).sub( float( iy ).add( 0.5 ).mul( pixelSize ) );
						const coord = vec3( 0 ).toVar();

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

						const lengthSq = coord.dot( coord );
						const weight = float( 4.0 ).div( lengthSq.sqrt().mul( lengthSq ) );
						const dir = coord.normalize();
						const x = dir.x;
						const y = dir.y;
						const z = dir.z;
						const radiance = cubeTexture( this.cubeRenderTarget.texture, coord, 0 ).rgb;
						const weightedRadiance = radiance.mul( weight );

						totalWeight.addAssign( weight );
						c0.addAssign( weightedRadiance.mul( 0.282095 ) );
						c1.addAssign( weightedRadiance.mul( y.mul( 0.488603 ) ) );
						c2.addAssign( weightedRadiance.mul( z.mul( 0.488603 ) ) );
						c3.addAssign( weightedRadiance.mul( x.mul( 0.488603 ) ) );
						c4.addAssign( weightedRadiance.mul( x.mul( y ).mul( 1.092548 ) ) );
						c5.addAssign( weightedRadiance.mul( y.mul( z ).mul( 1.092548 ) ) );
						c6.addAssign( weightedRadiance.mul( z.mul( z ).mul( 3.0 ).sub( 1.0 ).mul( 0.315392 ) ) );
						c7.addAssign( weightedRadiance.mul( x.mul( z ).mul( 1.092548 ) ) );
						c8.addAssign( weightedRadiance.mul( x.mul( x ).sub( y.mul( y ) ).mul( 0.546274 ) ) );

					} );

				} );

			} );

			const norm = float( 4 * Math.PI ).div( totalWeight );

			textureStore( this.computeProjectionTexture, uvec2( uint( 0 ), probeIndex ), vec4( c0.mul( norm ), 1 ) ).toWriteOnly();
			textureStore( this.computeProjectionTexture, uvec2( uint( 1 ), probeIndex ), vec4( c1.mul( norm ), 1 ) ).toWriteOnly();
			textureStore( this.computeProjectionTexture, uvec2( uint( 2 ), probeIndex ), vec4( c2.mul( norm ), 1 ) ).toWriteOnly();
			textureStore( this.computeProjectionTexture, uvec2( uint( 3 ), probeIndex ), vec4( c3.mul( norm ), 1 ) ).toWriteOnly();
			textureStore( this.computeProjectionTexture, uvec2( uint( 4 ), probeIndex ), vec4( c4.mul( norm ), 1 ) ).toWriteOnly();
			textureStore( this.computeProjectionTexture, uvec2( uint( 5 ), probeIndex ), vec4( c5.mul( norm ), 1 ) ).toWriteOnly();
			textureStore( this.computeProjectionTexture, uvec2( uint( 6 ), probeIndex ), vec4( c6.mul( norm ), 1 ) ).toWriteOnly();
			textureStore( this.computeProjectionTexture, uvec2( uint( 7 ), probeIndex ), vec4( c7.mul( norm ), 1 ) ).toWriteOnly();
			textureStore( this.computeProjectionTexture, uvec2( uint( 8 ), probeIndex ), vec4( c8.mul( norm ), 1 ) ).toWriteOnly();

		} );

		return computeProjection().compute( 1 ).setName( 'LightProbeGridGPU compute projection' );

	}

	_createRepackMaterial( coefficientTexture ) {

		const batch = coefficientTexture;
		const resolution = this.repackResolution;
		const textureIndex = this.repackTextureIndex;
		const sliceZ = this.repackSliceZ;
		const validityTextureWidth = this.probeValidityTextureWidth;

		const loadCoefficient = ( coefficient, probeIndex ) => textureLoad( batch, ivec2( coefficient, probeIndex ) );
		const loadValidity = ( probeIndex ) => textureLoad( this.probeValidityTexture, ivec2(
			probeIndex.mod( validityTextureWidth ),
			probeIndex.div( validityTextureWidth )
		) );

		const repack = Fn( () => {

			const nx = int( resolution.x );
			const ix = int( floor( viewportCoordinate.x ) );
			const iy = int( floor( viewportCoordinate.y ) );
			const iz = int( sliceZ );
			const probeIndex = ix.add( iy.mul( nx ) ).add( iz.mul( nx.mul( nx ) ) );

			const c0 = loadCoefficient( 0, probeIndex );
			const c1 = loadCoefficient( 1, probeIndex );
			const c2 = loadCoefficient( 2, probeIndex );
			const c3 = loadCoefficient( 3, probeIndex );
			const c4 = loadCoefficient( 4, probeIndex );
			const c5 = loadCoefficient( 5, probeIndex );
			const c6 = loadCoefficient( 6, probeIndex );
			const c7 = loadCoefficient( 7, probeIndex );
			const c8 = loadCoefficient( 8, probeIndex );
			const packed = vec4( 0 ).toVar();

			If( textureIndex.equal( 0 ), () => {

				packed.assign( vec4( c0.x, c0.y, c0.z, c1.x ) );

			} ).ElseIf( textureIndex.equal( 1 ), () => {

				packed.assign( vec4( c1.y, c1.z, c2.x, c2.y ) );

			} ).ElseIf( textureIndex.equal( 2 ), () => {

				packed.assign( vec4( c2.z, c3.x, c3.y, c3.z ) );

			} ).ElseIf( textureIndex.equal( 3 ), () => {

				packed.assign( vec4( c4.x, c4.y, c4.z, c5.x ) );

			} ).ElseIf( textureIndex.equal( 4 ), () => {

				packed.assign( vec4( c5.y, c5.z, c6.x, c6.y ) );

			} ).ElseIf( textureIndex.equal( 5 ), () => {

				packed.assign( vec4( c6.z, c7.x, c7.y, c7.z ) );

			} ).Else( () => {

				const validity = loadValidity( probeIndex );

				packed.assign( vec4( c8.x, c8.y, c8.z, validity.x ) );

			} );

			return packed;

		} );

		const material = new NodeMaterial();
		material.fragmentNode = repack();
		material.toneMapped = false;

		return material;

	}

	_resolvePrecision( renderer ) {

		const requested = this.projectionPrecision;
		const hasFloatFiltering = renderer !== null && renderer.hasFeature( 'float32-filterable' );

		if ( this.projectionFallbackType === HalfFloatType || requested === 'half' || requested === 'half float' ) {

			this.activeProjectionPrecision = this.projectionFallbackType === HalfFloatType ? 'half-linear (fallback)' : 'half-linear';
			return;

		}

		if ( requested === 'float' ) {

			this.activeProjectionPrecision = hasFloatFiltering ? 'float-linear' : 'half-linear (fallback)';
			return;

		}

		this.activeProjectionPrecision = hasFloatFiltering ? 'float-linear' : 'half-linear';

	}

	_getTextureType() {

		if ( this.projectionFallbackType !== null ) return this.projectionFallbackType;
		if ( this.projectionPrecision === 'float' && this.activeProjectionPrecision === 'float-linear' ) return FloatType;
		if ( this.projectionPrecision === 'auto' && this.activeProjectionPrecision === 'float-linear' ) return FloatType;

		return HalfFloatType;

	}

}

export { LightProbeGridGPU };
