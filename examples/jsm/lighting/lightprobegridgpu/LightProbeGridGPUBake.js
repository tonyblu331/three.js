import {
	Vector4
} from 'three/webgpu';

import {
	SH_COEFFICIENTS
} from './LightProbeGridGPUConstants.js';

const _bakeViewport = /*@__PURE__*/ new Vector4();
const _bakeScissor = /*@__PURE__*/ new Vector4();

const roundLightProbeGridGPUBakeMs = ( value ) => Number( value.toFixed( 2 ) );

export const captureLightProbeGridGPUBakeState = ( renderer, scene, grid ) => {

	renderer.getViewport( _bakeViewport );
	renderer.getScissor( _bakeScissor );

	const shadowMap = renderer.shadowMap;

	return {
		renderTarget: renderer.getRenderTarget(),
		scissorTest: renderer.getScissorTest(),
		autoClear: renderer.autoClear,
		matrixWorldAutoUpdate: scene.matrixWorldAutoUpdate,
		overrideMaterial: scene.overrideMaterial,
		shadowMap,
		shadowAutoUpdate: shadowMap !== undefined ? shadowMap.autoUpdate : undefined,
		probeIntensity: grid.probeIntensity.value,
		helperVisible: grid.helper?.visible ?? false
	};

};

export const restoreLightProbeGridGPUBakeState = ( renderer, scene, grid, state ) => {

	renderer.setRenderTarget( state.renderTarget );
	renderer.setViewport( _bakeViewport );
	renderer.setScissor( _bakeScissor );
	renderer.setScissorTest( state.scissorTest );
	renderer.autoClear = state.autoClear;
	scene.matrixWorldAutoUpdate = state.matrixWorldAutoUpdate;
	scene.overrideMaterial = state.overrideMaterial;

	if ( state.shadowMap !== undefined ) state.shadowMap.autoUpdate = state.shadowAutoUpdate;

	grid.probeIntensity.value = state.probeIntensity;
	if ( grid.helper !== null ) grid.helper.visible = state.helperVisible;
	grid.coefficientTarget.viewport.set( 0, 0, SH_COEFFICIENTS, grid.totalProbes );
	grid.coefficientTarget.scissor.set( 0, 0, SH_COEFFICIENTS, grid.totalProbes );

};

export const createLightProbeGridGPUBakeResult = ( grid, renderer, {
	sceneUpdateMs,
	cubemapMs,
	projectionMs,
	copyMs,
	visibilityCubemapMs,
	visibilityRepackMs,
	projectionBackendOverride,
	projectionBackend,
	projectionCubemapSweepsPerProbe,
	projectionTexelVisits,
	totalBakeMs,
	timingSource,
	timingSourceKind,
	deterministicTimerDetected
} ) => {

	const roundedSceneUpdateMs = roundLightProbeGridGPUBakeMs( sceneUpdateMs );
	const roundedCubemapMs = roundLightProbeGridGPUBakeMs( cubemapMs );
	const roundedProjectionMs = roundLightProbeGridGPUBakeMs( projectionMs );
	const roundedCopyMs = roundLightProbeGridGPUBakeMs( copyMs );

	grid.visibilityCubemapMs = roundLightProbeGridGPUBakeMs( visibilityCubemapMs );
	grid.visibilityRepackMs = roundLightProbeGridGPUBakeMs( visibilityRepackMs );

	const timingBuckets = {
		sceneUpdateMs: roundedSceneUpdateMs,
		radianceCubemapCaptureMs: roundedCubemapMs,
		distanceCubemapCaptureMs: grid.visibilityCubemapMs,
		computeShProjectionMs: roundedProjectionMs,
		visibilityRepackMs: grid.visibilityRepackMs,
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
		visibilityCubemapMs: grid.visibilityCubemapMs,
		distanceCubemapCaptureMs: grid.visibilityCubemapMs,
		visibilityRepackMs: grid.visibilityRepackMs,
		verifierReadbackMs: 0,
		verifierReadbackTimingSource: 'unavailable',
		visibilityDepthMode: grid.visibilityDepthMode,
		projectionBackendRequest: projectionBackendOverride,
		projectionBackend: grid._activeProjectionBackend,
		projectionBackendForced: projectionBackendOverride !== 'auto',
		projectionCubemapSweepsPerProbe,
		projectionTexelVisits,
		projectionTexelVisitReductionRatio: projectionBackend === 'compute-probe-reduction' ?
			Number( ( 1 - ( 1 / SH_COEFFICIENTS ) ).toFixed( 4 ) ) :
			0,
		computeProjectionFallbackReason: grid.computeProjectionFallbackReason,
		totalBakeMs: roundLightProbeGridGPUBakeMs( totalBakeMs ),
		timingSource,
		timingSourceKind,
		gpuTimestampStatus: 'unavailable',
		projectionTimingSource: timingSource,
		deterministicTimerDetected,
		timingBuckets,
		precision: grid.getPrecisionInfo( renderer )
	};

};
