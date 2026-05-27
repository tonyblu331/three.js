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
	viewportCoordinate,
	vec3,
	vec4
} from 'three/tsl';

const SH_COEFFICIENTS = 9;
const PACKED_SH_TEXTURES = 7;
const ATLAS_PADDING = 1;
const PROBE_VALIDITY_FLOOR = 0.05;
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

/**
 * GPU-resident L2 spherical harmonics irradiance probe grid.
 *
 * Each probe stores 9 RGB L2 spherical harmonics coefficients. That is 27 scalar
 * values, packed into 7 RGBA atlas sub-volumes because ceil( 27 / 4 ) = 7.
 * During bake, cubemap samples are projected with solid angle weighting. At
 * runtime, hardware filtering provides trilinear interpolation for filterable
 * textures. Optional leak reduction performs a manual nearest-load blend only
 * when per-neighbor weights are required.
 * Optional leak reduction translates DDGI-style wrap weighting and APV-style
 * surface bias into a small manual neighbor blend. It is not a full DDGI
 * visibility system: the atlas keeps a constant validity channel for future
 * geometry classification unless explicit validity data is provided, and
 * weights probes behind the receiver normal less
 * aggressively.
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
		if ( this.helper !== null ) {

			this.helper.geometry.dispose();
			this.helper.material.dispose();

		}

		if ( this.cubeRenderTarget !== null ) this.cubeRenderTarget.dispose();
		if ( this.coefficientTarget !== null ) this.coefficientTarget.dispose();
		if ( this.computeProjectionTexture !== null ) this.computeProjectionTexture.dispose();
		if ( this.atlasTarget !== null ) this.atlasTarget.dispose();
		if ( this.probeValidityTexture !== null ) this.probeValidityTexture.dispose();

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
		this.helper = null;
		this.cubeRenderTarget = null;
		this.cubeCamera = null;
		this.coefficientTarget = null;
		this.atlasTarget = null;
		this.probeValidityTexture = null;
		this.probeValidityTextureWidth = 0;
		this.probeValidityTextureHeight = 0;
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

		return {
			cubemapBytes,
			coefficientBytes,
			computeCoefficientBytes,
			atlasBytes,
			probeValidityBytes,
			total: cubemapBytes + coefficientBytes + computeCoefficientBytes + atlasBytes + probeValidityBytes,
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
			manualIrradianceSampling: this._usesManualIrradianceSampling(),
			weightedProbeSampling: this._usesWeightedProbeSampling()
		};

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

		const resolution = this.resolution;
		const resolutionMinusOne = resolution - 1;
		const gridMinNode = vec3( this.min.x, this.min.y, this.min.z );
		const gridExtentNode = vec3(
			this.max.x - this.min.x,
			this.max.y - this.min.y,
			this.max.z - this.min.z
		);
		const packedLoad = texture3D( this.atlasTarget.texture ).setSampler( false );

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
			const totalWeight = float( 0 ).toVar();
			const normal = normalWorld.normalize();
			const wx0 = blend.x.oneMinus();
			const wy0 = blend.y.oneMinus();
			const wz0 = blend.z.oneMinus();

			for ( let i = 0; i < PACKED_SH_TEXTURES; i ++ ) {

				weightedSamples.push( vec4( 0 ).toVar() );

			}

			const addProbe = ( coord, trilinearWeight ) => {

				const sample = loadPackedSamples( coord );
				const probePosition = gridMinNode.add( coord.toFloat().div( resolutionMinusOne ).mul( gridExtentNode ) );
				const probeDirection = this._safeNormalize( probePosition.sub( positionWorld ) );
				const wrapShading = normal.dot( probeDirection ).add( 1 ).mul( 0.5 );
				const normalWeight = wrapShading.mul( 0.5 ).add( 0.5 );
				const validityWeight = sample[ 6 ].w.max( PROBE_VALIDITY_FLOOR );
				const weight = trilinearWeight.mul( normalWeight ).mul( validityWeight );

				for ( let i = 0; i < PACKED_SH_TEXTURES; i ++ ) {

					// Accumulate packed SH coefficients. `_evaluateCoefficients()` clamps
					// negative ringing, so evaluating each probe first would break hardware
					// filtering equivalence.
					weightedSamples[ i ].addAssign( sample[ i ].mul( weight ) );

				}

				totalWeight.addAssign( weight );

			};

			addProbe( vec3( x0, y0, z0 ), wx0.mul( wy0 ).mul( wz0 ) );
			addProbe( vec3( x1, y0, z0 ), blend.x.mul( wy0 ).mul( wz0 ) );
			addProbe( vec3( x0, y1, z0 ), wx0.mul( blend.y ).mul( wz0 ) );
			addProbe( vec3( x1, y1, z0 ), blend.x.mul( blend.y ).mul( wz0 ) );
			addProbe( vec3( x0, y0, z1 ), wx0.mul( wy0 ).mul( blend.z ) );
			addProbe( vec3( x1, y0, z1 ), blend.x.mul( wy0 ).mul( blend.z ) );
			addProbe( vec3( x0, y1, z1 ), wx0.mul( blend.y ).mul( blend.z ) );
			addProbe( vec3( x1, y1, z1 ), blend.x.mul( blend.y ).mul( blend.z ) );

			const safeWeight = totalWeight.max( 0.0001 );

			return this._evaluatePackedSH(
				weightedSamples[ 0 ].div( safeWeight ),
				weightedSamples[ 1 ].div( safeWeight ),
				weightedSamples[ 2 ].div( safeWeight ),
				weightedSamples[ 3 ].div( safeWeight ),
				weightedSamples[ 4 ].div( safeWeight ),
				weightedSamples[ 5 ].div( safeWeight ),
				weightedSamples[ 6 ].div( safeWeight )
			).mul( this.probeIntensity );

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
		const hasShadowMap = renderer.shadowMap !== undefined;
		const currentShadowAutoUpdate = hasShadowMap ? renderer.shadowMap.autoUpdate : undefined;
		const currentProbeIntensity = this.probeIntensity.value;
		const currentHelperVisible = this.helper?.visible ?? false;
		const timingSource = getBakeTimingSource();
		const deterministicTimerDetected = isDeterministicPerformanceNow();
		const totalStart = getBakeTimingNow();

		let cubemapMs = 0;
		let projectionMs = 0;
		let copyMs = 0;
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

			scene.updateMatrixWorld( true );
			scene.matrixWorldAutoUpdate = false;

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

			if ( hasShadowMap ) renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

			this.probeIntensity.value = currentProbeIntensity;
			if ( this.helper !== null ) this.helper.visible = currentHelperVisible;
			this.coefficientTarget.viewport.set( 0, 0, SH_COEFFICIENTS, this.totalProbes );
			this.coefficientTarget.scissor.set( 0, 0, SH_COEFFICIENTS, this.totalProbes );

		}

		if ( retryFragmentProjection ) return this._bake( renderer, scene, options );
		if ( retryHalfFloat ) return this._bake( renderer, scene, options );

		return {
			cubemapMs: Number( cubemapMs.toFixed( 2 ) ),
			projectionMs: Number( projectionMs.toFixed( 2 ) ),
			copyMs: Number( copyMs.toFixed( 2 ) ),
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
			projectionTimingSource: timingSource,
			deterministicTimerDetected,
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

		this._createProbeValidityTexture();
		this.projectionMaterial = this._createProjectionMaterial();
		this.computeProjectionNode = this._createComputeProjectionNode();
		this.repackFragmentMaterial = this._createRepackMaterial( this.coefficientTarget.texture );
		this.repackComputeProjectionMaterial = this._createRepackMaterial( this.computeProjectionTexture );
		this.repackMaterial = this.repackFragmentMaterial;

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

		this.projectionMesh.material = this.projectionMaterial;
		this.repackMesh.material = this.repackMaterial;
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
