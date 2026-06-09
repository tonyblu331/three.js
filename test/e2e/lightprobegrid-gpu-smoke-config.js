import * as os from 'os';
import * as path from 'path';

export const smokeHarnesses = {
	webgpu_lightprobes_cornell: {
		query: 'testHarness',
		global: '__webgpuLightProbeGridCornell',
		example: 'examples/webgpu_lightprobes_cornell.html',
		source: 'examples/jsm/lighting/LightProbeGridGPU.js',
		implementation: 'ours-cornell',
		imageRegionSet: 'cornell',
		capabilities: [ 'runtime', 'rebake', 'probe-positions', 'image-luma', 'sealed-wall-leak', 'proof-contracts' ]
	},
	webgpu_lightprobes_sponza: {
		query: 'testHarness',
		global: '__webgpuLightProbeGridSponzaControl',
		example: 'examples/webgpu_lightprobes_sponza.html',
		source: 'examples/jsm/lighting/LightProbeGridGPU.js',
		implementation: 'ours-sponza-control',
		imageRegionSet: 'sponza',
		capabilities: [ 'runtime', 'rebake', 'probe-positions', 'image-luma' ]
	},
	webgpu_lightprobes_sponza_ours: {
		query: 'testHarness',
		global: '__webgpuLightProbeGridSponzaControl',
		example: 'examples/webgpu_lightprobes_sponza_ours.html',
		source: 'examples/jsm/lighting/LightProbeGridGPU.js',
		implementation: 'ours-sponza',
		imageRegionSet: 'sponza',
		capabilities: [ 'runtime', 'rebake', 'probe-positions', 'image-luma', 'placement-authoring-usage' ]
	}
};

export const lightProbeParityArtifactDir = path.join( os.tmpdir(), 'codex-threejs-lightprobes-parity' );
export const lightProbeWebGLReferenceLabel = 'webgl-lightprobegrid-reference';
export const lightProbeParitySnapshotLabels = [
	'low-res-damped',
	'low-res-unweighted',
	'low-res-validity-weighted',
	'webgpu-webgl-density-reference',
	'webgpu-webgl-density-shadowless',
	'webgpu-webgl-density-shadow-crisp',
	'webgpu-webgl-density-damped'
];
