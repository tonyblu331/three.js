import {
	CubeCamera,
	CubeRenderTarget,
	Box3,
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
	Vector3,
	Vector4
} from 'three/webgpu';
import {
	clamp,
	cubeTexture,
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
	mix,
	normalWorld,
	positionWorld,
	texture3D,
	textureLoad,
	uint,
	uniform,
	uv,
	vec3,
	vec4
} from 'three/tsl';

const SH_COEFFICIENTS = 9;
const PACKED_SH_TEXTURES = 7;
const ATLAS_PADDING = 1;

const _probePosition = /*@__PURE__*/ new Vector3();
const _gridSize = /*@__PURE__*/ new Vector3();
const _currentViewport = /*@__PURE__*/ new Vector4();
const _currentScissor = /*@__PURE__*/ new Vector4();
const _matrix = /*@__PURE__*/ new Matrix4();

/**
 * GPU-resident L2 spherical harmonics irradiance probe grid.
 *
 * Each probe stores 9 RGB L2 spherical harmonics coefficients. That is 27 scalar
 * values, packed into 7 RGBA atlas sub-volumes because ceil( 27 / 4 ) = 7.
 * During bake, cubemap samples are projected with solid angle weighting. At
 * runtime, hardware filtering provides trilinear interpolation for filterable
 * textures, while the explicit float-manual mode performs the same interpolation
 * from nearest-loads for debugging and compatibility checks.
 *
 * Every packed sub-volume has one copied padding slice on both Z boundaries so
 * trilinear filtering cannot bleed into the next SH sub-volume in the atlas.
 *
 * @augments Object3D
 */
class LightProbeGridGPU extends Object3D {

	constructor( min, max, options = {} ) {

		super();

		this.isLightProbeGrid = true;
		this.type = 'LightProbeGridGPU';
		this.min = min.clone();
		this.max = max.clone();
		this.boundingBox = new Box3( this.min, this.max );
		this.resolution = options.resolution ?? 4;
		this.cubemapSize = options.cubemapSize ?? 8;
		this.projectionPrecision = options.projectionPrecision ?? 'auto';
		this.activeProjectionPrecision = 'half-linear';
		this.projectionFallbackType = null;

		this.probeIntensity = uniform( options.probeIntensity ?? 1 );
		this.helperIntensity = uniform( options.helperIntensity ?? 1 );

		this.cubeRenderTarget = null;
		this.cubeCamera = null;
		this.coefficientTarget = null;
		this.atlasTarget = null;
		this.texture = null;
		this.projectionScene = null;
		this.projectionCamera = null;
		this.projectionMesh = null;
		this.projectionMaterial = null;
		this.repackScene = null;
		this.repackCamera = null;
		this.repackMesh = null;
		this.repackMaterial = null;
		this.helper = null;

		this.totalProbes = 0;
		this.paddedSlices = 0;
		this.atlasDepth = 0;
		this.manualFloatSampling = false;
		this.repackTextureIndex = uniform( 0 );
		this.repackSliceZ = uniform( 0 );
		this.repackResolution = uniform( new Vector3() );
		this._bakePromise = null;

		this._createResources( options.renderer ?? null );

	}

	setOptions( options = {}, renderer = null ) {

		const nextResolution = options.resolution ?? this.resolution;
		const nextCubemapSize = options.cubemapSize ?? this.cubemapSize;
		const nextProjectionPrecision = options.projectionPrecision ?? this.projectionPrecision;

		const recreate = nextResolution !== this.resolution ||
			nextCubemapSize !== this.cubemapSize ||
			nextProjectionPrecision !== this.projectionPrecision;

		this.resolution = nextResolution;
		this.cubemapSize = nextCubemapSize;
		this.projectionPrecision = nextProjectionPrecision;

		if ( options.probeIntensity !== undefined ) this.probeIntensity.value = options.probeIntensity;
		if ( options.helperIntensity !== undefined ) this.helperIntensity.value = options.helperIntensity;

		if ( recreate ) this._createResources( renderer );

	}

	dispose() {

		if ( this.projectionMaterial !== null ) this.projectionMaterial.dispose();
		if ( this.repackMaterial !== null ) this.repackMaterial.dispose();
		if ( this.projectionMesh !== null ) this.projectionMesh.geometry.dispose();
		if ( this.repackMesh !== null ) this.repackMesh.geometry.dispose();
		if ( this.helper !== null ) {

			this.helper.geometry.dispose();
			this.helper.material.dispose();

		}

		if ( this.cubeRenderTarget !== null ) this.cubeRenderTarget.dispose();
		if ( this.coefficientTarget !== null ) this.coefficientTarget.dispose();
		if ( this.atlasTarget !== null ) this.atlasTarget.dispose();

		this.projectionMaterial = null;
		this.repackMaterial = null;
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
			manualFloatSampling: this.manualFloatSampling,
			float32Filterable: renderer !== null ? renderer.hasFeature( 'float32-filterable' ) : null
		};

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

		return this.manualFloatSampling ? this._createManualIrradianceNode() : this._createAtlasIrradianceNode();

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
			const samplePosition = positionWorld.add( normalWorld.normalize().mul( probeSpacing ).mul( 0.5 ) );
			const probeCoord = clamp( samplePosition.sub( gridMinNode ).div( gridExtentNode ), 0, 1 );
			const uvw = vec3(
				probeCoord.x,
				probeCoord.y,
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

		const samplePackedProbe = Fn( ( { coord } ) => {

			const x = int( coord.x );
			const y = int( coord.y );
			const z = int( coord.z );
			const s0 = packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 0 ) );
			const s1 = packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 1 ) );
			const s2 = packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 2 ) );
			const s3 = packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 3 ) );
			const s4 = packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 4 ) );
			const s5 = packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 5 ) );
			const s6 = packedLoad.load( this._getPackedAtlasLoadCoord( x, y, z, 6 ) );

			return this._evaluatePackedSH( s0, s1, s2, s3, s4, s5, s6 );

		} );

		const sampleManual = Fn( () => {

			const probeSpacing = gridExtentNode.div( resolutionMinusOne );
			const samplePosition = positionWorld.add( normalWorld.normalize().mul( probeSpacing ).mul( 0.5 ) );
			const probeCoord = clamp( samplePosition.sub( gridMinNode ).div( gridExtentNode ), 0, 1 ).mul( resolutionMinusOne );
			const base = floor( probeCoord ).toVar();
			const blend = probeCoord.sub( base );

			const x0 = int( base.x );
			const y0 = int( base.y );
			const z0 = int( base.z );
			const x1 = int( clamp( base.x.add( 1 ), 0, resolutionMinusOne ) );
			const y1 = int( clamp( base.y.add( 1 ), 0, resolutionMinusOne ) );
			const z1 = int( clamp( base.z.add( 1 ), 0, resolutionMinusOne ) );

			const c000 = samplePackedProbe( { coord: vec3( x0, y0, z0 ) } );
			const c100 = samplePackedProbe( { coord: vec3( x1, y0, z0 ) } );
			const c010 = samplePackedProbe( { coord: vec3( x0, y1, z0 ) } );
			const c110 = samplePackedProbe( { coord: vec3( x1, y1, z0 ) } );
			const c001 = samplePackedProbe( { coord: vec3( x0, y0, z1 ) } );
			const c101 = samplePackedProbe( { coord: vec3( x1, y0, z1 ) } );
			const c011 = samplePackedProbe( { coord: vec3( x0, y1, z1 ) } );
			const c111 = samplePackedProbe( { coord: vec3( x1, y1, z1 ) } );

			const x00 = mix( c000, c100, blend.x );
			const x10 = mix( c010, c110, blend.x );
			const x01 = mix( c001, c101, blend.x );
			const x11 = mix( c011, c111, blend.x );
			const y0Mix = mix( x00, x10, blend.y );
			const y1Mix = mix( x01, x11, blend.y );

			return mix( y0Mix, y1Mix, blend.z ).mul( this.probeIntensity );

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

		let result = c0.mul( 0.886227 );
		result = result.add( c1.mul( 2.0 * 0.511664 ).mul( y ) );
		result = result.add( c2.mul( 2.0 * 0.511664 ).mul( z ) );
		result = result.add( c3.mul( 2.0 * 0.511664 ).mul( x ) );
		result = result.add( c4.mul( 2.0 * 0.429043 ).mul( x ).mul( y ) );
		result = result.add( c5.mul( 2.0 * 0.429043 ).mul( y ).mul( z ) );
		result = result.add( c6.mul( z.mul( z ).mul( 0.743125 ).sub( 0.247708 ) ) );
		result = result.add( c7.mul( 2.0 * 0.429043 ).mul( x ).mul( z ) );
		result = result.add( c8.mul( 0.429043 ).mul( x.mul( x ).sub( y.mul( y ) ) ) );

		return max( result, vec3( 0 ) );

	}

	createHelper() {

		if ( this.helper !== null ) return this.helper;

		this._createHelper();
		return this.helper;

	}

	async bake( renderer, scene, options = {} ) {

		if ( this._bakePromise !== null ) return this._bakePromise;

		this._bakePromise = this._bake( renderer, scene, options ).finally( () => {

			this._bakePromise = null;

		} );

		return this._bakePromise;

	}

	async _bake( renderer, scene, options = {} ) {

		this._resolvePrecision( renderer );
		this.updateBoundingBox();

		const currentRenderTarget = renderer.getRenderTarget();
		const currentScissorTest = renderer.getScissorTest();
		const currentAutoClear = renderer.autoClear;
		const currentProbeIntensity = this.probeIntensity.value;
		const currentHelperVisible = this.helper?.visible ?? false;
		const totalStart = performance.now();

		let cubemapMs = 0;
		let projectionMs = 0;
		let copyMs = 0;
		let retryHalfFloat = false;

		renderer.getViewport( _currentViewport );
		renderer.getScissor( _currentScissor );

		try {

			this.probeIntensity.value = 0;
			if ( this.helper !== null ) this.helper.visible = false;

			this.coefficientTarget.scissorTest = false;
			renderer.setRenderTarget( this.coefficientTarget );
			renderer.clear();
			renderer.setScissorTest( false );

			for ( let i = 0; i < this.totalProbes; i ++ ) {

				this.getProbePosition( i, _probePosition );
				this.cubeCamera.position.copy( _probePosition );

				let phaseStart = performance.now();
				renderer.autoClear = true;
				this.cubeCamera.update( renderer, scene );
				cubemapMs += performance.now() - phaseStart;

				this.coefficientTarget.viewport.set( 0, i, SH_COEFFICIENTS, 1 );
				this.coefficientTarget.scissor.set( 0, i, SH_COEFFICIENTS, 1 );

				phaseStart = performance.now();
				renderer.setRenderTarget( this.coefficientTarget );
				renderer.autoClear = false;
				renderer.render( this.projectionScene, this.projectionCamera );
				projectionMs += performance.now() - phaseStart;

			}

			const copyStart = performance.now();
			await this._repackAtlas( renderer );
			copyMs = performance.now() - copyStart;

		} catch ( error ) {

			if ( this.projectionFallbackType === null &&
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

			this.probeIntensity.value = currentProbeIntensity;
			if ( this.helper !== null ) this.helper.visible = currentHelperVisible;
			this.coefficientTarget.viewport.set( 0, 0, SH_COEFFICIENTS, this.totalProbes );
			this.coefficientTarget.scissor.set( 0, 0, SH_COEFFICIENTS, this.totalProbes );

		}

		if ( retryHalfFloat ) return this._bake( renderer, scene, options );

		return {
			cubemapMs: Number( cubemapMs.toFixed( 2 ) ),
			projectionMs: Number( projectionMs.toFixed( 2 ) ),
			copyMs: Number( copyMs.toFixed( 2 ) ),
			totalBakeMs: Number( ( performance.now() - totalStart ).toFixed( 2 ) ),
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
		this.atlasTarget = new RenderTarget3D( this.resolution, this.resolution, this.atlasDepth, {
			format: RGBAFormat,
			type: this._getTextureType(),
			minFilter: this.manualFloatSampling ? NearestFilter : LinearFilter,
			magFilter: this.manualFloatSampling ? NearestFilter : LinearFilter,
			generateMipmaps: false,
			depthBuffer: false
		} );
		this.texture = this.atlasTarget.texture;

		this.projectionMaterial = this._createProjectionMaterial();
		this.repackMaterial = this._createRepackMaterial();

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

	_createHelper() {

		const geometry = new SphereGeometry( 0.055, 12, 8 );
		const material = new MeshBasicNodeMaterial();
		const atlasLoad = texture3D( this.atlasTarget.texture ).setSampler( false );
		const evaluateInstanceProbe = Fn( () => {

			const index = int( instanceIndex );
			const z = index.div( this.resolution * this.resolution );
			const y = index.sub( z.mul( this.resolution * this.resolution ) ).div( this.resolution );
			const x = index.sub( z.mul( this.resolution * this.resolution ) ).sub( y.mul( this.resolution ) );
			const s0 = atlasLoad.load( this._getPackedAtlasLoadCoord( x, y, z ) ).xyz;

			return max( s0.mul( 0.886227 ), vec3( 0 ) );

		} );

		material.colorNode = evaluateInstanceProbe().mul( this.helperIntensity );

		this.helper = new InstancedMesh( geometry, material, this.totalProbes );

		for ( let i = 0; i < this.totalProbes; i ++ ) {

			this.getProbePosition( i, _probePosition );
			_matrix.makeTranslation( _probePosition.x, _probePosition.y, _probePosition.z );
			this.helper.setMatrixAt( i, _matrix );

		}

		this.helper.instanceMatrix.needsUpdate = true;

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

	_createRepackMaterial() {

		const batch = this.coefficientTarget.texture;
		const resolution = this.repackResolution;
		const textureIndex = this.repackTextureIndex;
		const sliceZ = this.repackSliceZ;

		const loadCoefficient = ( coefficient, probeIndex ) => textureLoad( batch, ivec2( coefficient, probeIndex ) );

		const repack = Fn( () => {

			const nx = int( resolution.x );
			const ix = int( floor( uv().x.mul( resolution.x ) ) );
			const iy = int( floor( uv().y.mul( resolution.y ) ) );
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

				packed.assign( vec4( c8.x, c8.y, c8.z, 0.0 ) );

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

			this.manualFloatSampling = false;
			this.activeProjectionPrecision = this.projectionFallbackType === HalfFloatType ? 'half-linear (fallback)' : 'half-linear';
			return;

		}

		if ( requested === 'float manual' ) {

			this.manualFloatSampling = true;
			this.activeProjectionPrecision = 'float-manual';
			return;

		}

		if ( requested === 'float' ) {

			this.manualFloatSampling = false;
			this.activeProjectionPrecision = hasFloatFiltering ? 'float-linear' : 'half-linear (fallback)';
			return;

		}

		this.manualFloatSampling = false;
		this.activeProjectionPrecision = hasFloatFiltering ? 'float-linear' : 'half-linear';

	}

	_getTextureType() {

		if ( this.projectionFallbackType !== null ) return this.projectionFallbackType;
		if ( this.projectionPrecision === 'float' && this.activeProjectionPrecision === 'float-linear' ) return FloatType;
		if ( this.projectionPrecision === 'float manual' ) return FloatType;
		if ( this.projectionPrecision === 'auto' && this.activeProjectionPrecision === 'float-linear' ) return FloatType;

		return HalfFloatType;

	}

}

export { LightProbeGridGPU };
