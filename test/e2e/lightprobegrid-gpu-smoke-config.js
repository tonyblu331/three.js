import * as os from 'os';
import * as path from 'path';

export const smokeHarnesses = {
	webgpu_lightprobes_cornell: {
		query: 'testHarness',
		global: '__webgpuLightProbeGridCornell',
		example: 'examples/webgpu_lightprobes_cornell.html',
		source: 'examples/jsm/lighting/LightProbeGridGPU.js'
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
