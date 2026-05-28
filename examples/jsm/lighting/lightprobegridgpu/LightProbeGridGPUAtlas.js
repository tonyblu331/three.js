import {
	ATLAS_PADDING,
	PACKED_SH_TEXTURES
} from './LightProbeGridGPUConstants.js';

export const getLightProbeGridGPUPaddedAtlasSlices = ( resolution, atlasPadding = ATLAS_PADDING ) => resolution + 2 * atlasPadding;

export const getLightProbeGridGPUAtlasDepth = (
	resolution,
	packedTextureCount = PACKED_SH_TEXTURES,
	atlasPadding = ATLAS_PADDING
) => packedTextureCount * getLightProbeGridGPUPaddedAtlasSlices( resolution, atlasPadding );

export const getLightProbeGridGPUPackedAtlasBaseLayer = (
	textureIndex,
	paddedSlices,
	atlasPadding = ATLAS_PADDING
) => textureIndex * paddedSlices + atlasPadding;

export const getLightProbeGridGPUPackedAtlasLayer = (
	textureIndex,
	gridZ,
	paddedSlices,
	atlasPadding = ATLAS_PADDING
) => getLightProbeGridGPUPackedAtlasBaseLayer( textureIndex, paddedSlices, atlasPadding ) + gridZ;

export const getLightProbeGridGPUPackedAtlasCenterSampleZ = (
	textureIndex,
	gridZ,
	paddedSlices,
	atlasDepth,
	atlasPadding = ATLAS_PADDING
) => ( getLightProbeGridGPUPackedAtlasLayer( textureIndex, gridZ, paddedSlices, atlasPadding ) + 0.5 ) / atlasDepth;

export const getLightProbeGridGPUProbeIndex = ( x, y, z, resolution ) => x + y * resolution + z * resolution * resolution;

export const getLightProbeGridGPUProbeCoord = ( probeIndex, resolution ) => {

	const z = Math.floor( probeIndex / ( resolution * resolution ) );
	const y = Math.floor( probeIndex / resolution ) % resolution;
	const x = probeIndex % resolution;

	return { x, y, z };

};
