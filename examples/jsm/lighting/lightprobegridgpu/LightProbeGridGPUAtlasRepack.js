import {
	NodeMaterial
} from 'three/webgpu';
import {
	floor,
	Fn,
	If,
	int,
	ivec2,
	textureLoad,
	vec4,
	viewportCoordinate
} from 'three/tsl';

import {
	PACKED_SH_COEFFICIENT_LAYOUT
} from './LightProbeGridGPUConstants.js';

const LIGHT_PROBE_GRID_GPU_PACKED_COMPONENTS = {
	r: 'x',
	g: 'y',
	b: 'z'
};

const getLightProbeGridGPUPackedSource = ( entry, coefficients, validity ) => {

	if ( entry.value === 'validity' ) return validity.x;

	return coefficients[ entry.coefficient ][ LIGHT_PROBE_GRID_GPU_PACKED_COMPONENTS[ entry.component ] ];

};

const createLightProbeGridGPUPackedSHVector = ( layout, coefficients, validity ) => vec4(
	getLightProbeGridGPUPackedSource( layout[ 0 ], coefficients, validity ),
	getLightProbeGridGPUPackedSource( layout[ 1 ], coefficients, validity ),
	getLightProbeGridGPUPackedSource( layout[ 2 ], coefficients, validity ),
	getLightProbeGridGPUPackedSource( layout[ 3 ], coefficients, validity )
);

export const createLightProbeGridGPUAtlasRepackMaterial = (
	coefficientTexture,
	probeValidityTexture,
	repackResolution,
	repackTextureIndex,
	repackSliceZ,
	probeValidityTextureWidth
) => {

	const loadCoefficient = ( coefficient, probeIndex ) => textureLoad( coefficientTexture, ivec2( coefficient, probeIndex ) );
	const loadValidity = ( probeIndex ) => textureLoad( probeValidityTexture, ivec2(
		probeIndex.mod( probeValidityTextureWidth ),
		probeIndex.div( probeValidityTextureWidth )
	) );

	const repack = Fn( () => {

		const nx = int( repackResolution.x );
		const ix = int( floor( viewportCoordinate.x ) );
		const iy = int( floor( viewportCoordinate.y ) );
		const iz = int( repackSliceZ );
		const probeIndex = ix.add( iy.mul( nx ) ).add( iz.mul( nx.mul( nx ) ) );
		const coefficients = [
			loadCoefficient( 0, probeIndex ),
			loadCoefficient( 1, probeIndex ),
			loadCoefficient( 2, probeIndex ),
			loadCoefficient( 3, probeIndex ),
			loadCoefficient( 4, probeIndex ),
			loadCoefficient( 5, probeIndex ),
			loadCoefficient( 6, probeIndex ),
			loadCoefficient( 7, probeIndex ),
			loadCoefficient( 8, probeIndex )
		];
		const validity = loadValidity( probeIndex );
		const packed = vec4( 0 ).toVar();

		If( repackTextureIndex.equal( 0 ), () => {

			packed.assign( createLightProbeGridGPUPackedSHVector( PACKED_SH_COEFFICIENT_LAYOUT[ 0 ], coefficients, validity ) );

		} ).ElseIf( repackTextureIndex.equal( 1 ), () => {

			packed.assign( createLightProbeGridGPUPackedSHVector( PACKED_SH_COEFFICIENT_LAYOUT[ 1 ], coefficients, validity ) );

		} ).ElseIf( repackTextureIndex.equal( 2 ), () => {

			packed.assign( createLightProbeGridGPUPackedSHVector( PACKED_SH_COEFFICIENT_LAYOUT[ 2 ], coefficients, validity ) );

		} ).ElseIf( repackTextureIndex.equal( 3 ), () => {

			packed.assign( createLightProbeGridGPUPackedSHVector( PACKED_SH_COEFFICIENT_LAYOUT[ 3 ], coefficients, validity ) );

		} ).ElseIf( repackTextureIndex.equal( 4 ), () => {

			packed.assign( createLightProbeGridGPUPackedSHVector( PACKED_SH_COEFFICIENT_LAYOUT[ 4 ], coefficients, validity ) );

		} ).ElseIf( repackTextureIndex.equal( 5 ), () => {

			packed.assign( createLightProbeGridGPUPackedSHVector( PACKED_SH_COEFFICIENT_LAYOUT[ 5 ], coefficients, validity ) );

		} ).Else( () => {

			packed.assign( createLightProbeGridGPUPackedSHVector( PACKED_SH_COEFFICIENT_LAYOUT[ 6 ], coefficients, validity ) );

		} );

		return packed;

	} );

	const material = new NodeMaterial();
	material.fragmentNode = repack();
	material.toneMapped = false;

	return material;

};
