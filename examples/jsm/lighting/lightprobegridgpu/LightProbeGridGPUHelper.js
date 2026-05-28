import {
	InstancedMesh,
	Matrix4,
	MeshBasicNodeMaterial,
	SphereGeometry,
	Vector3
} from 'three/webgpu';
import {
	Fn,
	If,
	instanceIndex,
	int,
	max,
	texture3D,
	vec3
} from 'three/tsl';

const _helperProbePosition = /*@__PURE__*/ new Vector3();
const _helperMatrix = /*@__PURE__*/ new Matrix4();

export const applyLightProbeGridGPUHelperDepthMode = ( helper, helperDepthMode ) => {

	if ( helper === null ) return;

	const xRay = helperDepthMode === 'x-ray';
	helper.material.depthTest = xRay === false;
	helper.material.depthWrite = false;
	helper.material.needsUpdate = true;
	helper.renderOrder = xRay ? 1000 : 0;

};

export const createLightProbeGridGPUHelper = (
	atlasTexture,
	helperDebugMode,
	helperIntensity,
	resolution,
	totalProbes,
	getPackedAtlasLoadCoord,
	getProbePosition
) => {

	const geometry = new SphereGeometry( 0.055, 12, 8 );
	const material = new MeshBasicNodeMaterial();
	const atlasLoad = texture3D( atlasTexture ).setSampler( false );

	const evaluateInstanceProbe = Fn( () => {

		const index = int( instanceIndex );
		const z = index.div( resolution * resolution );
		const y = index.sub( z.mul( resolution * resolution ) ).div( resolution );
		const x = index.sub( z.mul( resolution * resolution ) ).sub( y.mul( resolution ) );
		const s0 = atlasLoad.load( getPackedAtlasLoadCoord( x, y, z ) ).xyz;
		const validity = atlasLoad.load( getPackedAtlasLoadCoord( x, y, z, 6 ) ).w;
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

	material.colorNode = evaluateInstanceProbe().mul( helperIntensity );

	const helper = new InstancedMesh( geometry, material, totalProbes );

	for ( let i = 0; i < totalProbes; i ++ ) {

		getProbePosition( i, _helperProbePosition );
		_helperMatrix.makeTranslation( _helperProbePosition.x, _helperProbePosition.y, _helperProbePosition.z );
		helper.setMatrixAt( i, _helperMatrix );

	}

	helper.instanceMatrix.needsUpdate = true;

	return helper;

};
