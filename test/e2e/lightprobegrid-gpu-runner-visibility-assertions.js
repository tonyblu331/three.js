import { runLightProbeGridGpuVisibilityBaseAssertions } from './lightprobegrid-gpu-runner-visibility-base-assertions.js';
import { runLightProbeGridGpuVisibilityNormalAssertions } from './lightprobegrid-gpu-runner-visibility-normal-assertions.js';
import { runLightProbeGridGpuVisibilityProbeAssertions } from './lightprobegrid-gpu-runner-visibility-probe-assertions.js';
import { runLightProbeGridGpuVisibilityReceiverAssertions } from './lightprobegrid-gpu-runner-visibility-receiver-assertions.js';

export async function runLightProbeGridGpuVisibilitySmokeAssertions( context ) {

	const { call, assert, results } = context;
	const sealedVisibilityWeightingDiagnostic = await runLightProbeGridGpuVisibilityBaseAssertions( {
		call,
		assert,
		results
	} );

	runLightProbeGridGpuVisibilityProbeAssertions( {
		assert,
		sealedVisibilityWeightingDiagnostic
	} );
	runLightProbeGridGpuVisibilityReceiverAssertions( {
		assert,
		results,
		sealedVisibilityWeightingDiagnostic
	} );
	await runLightProbeGridGpuVisibilityNormalAssertions( {
		call,
		assert,
		results
	} );

}
