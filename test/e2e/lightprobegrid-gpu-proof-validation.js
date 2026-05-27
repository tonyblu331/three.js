import {
	lightProbeParitySnapshotLabels,
	lightProbeWebGLReferenceLabel
} from './lightprobegrid-gpu-smoke-config.js';

const getSnapshotRegion = ( snapshot, regionName ) => {

	const region = snapshot.regions[ regionName ];
	if ( region === undefined ) throw new Error( `Missing snapshot region: ${ snapshot.label }/${ regionName }` );
	return region;

};

export function assertLightProbeProof( file, condition, message ) {

	if ( condition === false ) throw new Error( `${ file }: ${ message }` );

}

export function validateLightProbeParitySnapshot( file, snapshot ) {

	assertLightProbeProof( file, lightProbeParitySnapshotLabels.includes( snapshot.label ),
		`grounding parity artifact: unexpected snapshot label ${ snapshot.label }.` );
	assertLightProbeProof( file, snapshot.metrics.status === 'ready',
		`grounding parity artifact ${ snapshot.label }: expected ready status.` );
	assertLightProbeProof( file, snapshot.metrics.lightingMode === 'probes only',
		`grounding parity artifact ${ snapshot.label }: expected probes-only lighting.` );
	assertLightProbeProof( file, snapshot.metrics.materialType === 'standard',
		`grounding parity artifact ${ snapshot.label }: expected standard material snapshot.` );
	assertLightProbeProof( file, Number.isFinite( snapshot.metrics.timings.totalBakeMs ) &&
		snapshot.metrics.timings.totalBakeMs > 0 &&
		snapshot.metrics.timings.timingSource !== 'unavailable',
	`grounding parity artifact ${ snapshot.label }: expected positive measured bake timing with a known timing source.` );
	assertLightProbeProof( file, Number.isFinite( snapshot.artifactSignature.center.luminance ) &&
		snapshot.artifactSignature.center.luminance > 18,
	`grounding parity artifact ${ snapshot.label }: expected visible center luminance floor.` );

	for ( const regionName of [ 'tallBox', 'shortBox', 'sphere', 'rightWall' ] ) {

		const region = getSnapshotRegion( snapshot, regionName );
		assertLightProbeProof( file, Number.isFinite( region.color.r ) &&
			Number.isFinite( region.color.g ) &&
			Number.isFinite( region.color.b ),
		`grounding parity artifact ${ snapshot.label }/${ regionName }: expected finite RGB averages.` );
		assertLightProbeProof( file, Number.isFinite( region.colorBias.redOverGreen ) &&
			Number.isFinite( region.colorBias.greenOverRed ),
		`grounding parity artifact ${ snapshot.label }/${ regionName }: expected finite color-bias ratios.` );
		assertLightProbeProof( file, Number.isFinite( region.darkPixelRatio ) &&
			region.darkPixelRatio >= 0 &&
			region.darkPixelRatio <= 1,
		`grounding parity artifact ${ snapshot.label }/${ regionName }: expected bounded dark-pixel ratio.` );
		assertLightProbeProof( file, Number.isFinite( region.blackPixelRatio ) &&
			region.blackPixelRatio >= 0 &&
			region.blackPixelRatio <= 1,
		`grounding parity artifact ${ snapshot.label }/${ regionName }: expected bounded black-tail ratio.` );
		assertLightProbeProof( file, Number.isFinite( region.cellEdgeContrast ) &&
			region.cellEdgeContrast >= 0 &&
			region.cellEdgeContrast <= 255,
		`grounding parity artifact ${ snapshot.label }/${ regionName }: expected bounded cell-edge contrast.` );

	}

	if ( snapshot.label === 'low-res-unweighted' ) {

		assertLightProbeProof( file, snapshot.metrics.sampling.weightedProbeSampling === false,
			'grounding parity artifact: unweighted low-res candidate must stay on hardware-filtered sampling.' );

	}

	if ( snapshot.label === 'low-res-validity-weighted' ) {

		assertLightProbeProof( file, snapshot.metrics.sampling.weightedProbeSampling === true &&
			snapshot.metrics.sampling.probeValidityMode === 'custom',
		'grounding parity artifact: validity-weighted low-res candidate must use custom validity metadata.' );

	}

	if ( snapshot.label.startsWith( 'webgpu-webgl-density-' ) ) {

		assertLightProbeProof( file, snapshot.metrics.resolution === 6 &&
			snapshot.metrics.cubemapSize === 32,
		`grounding parity artifact ${ snapshot.label }: WebGPU density row must match the WebGL 6^3 / 32px reference budget.` );

	}

	if ( snapshot.label === 'webgpu-webgl-density-reference' ) {

		assertLightProbeProof( file, snapshot.proofRole === 'same-budget-artifact-pressure' &&
			/artifact pressure/.test( snapshot.referenceBoundary ),
		'grounding parity artifact: WebGPU density reference must be labelled as a same-budget artifact pressure row.' );
		assertLightProbeProof( file, snapshot.antiRingingPolicy?.mode === 'full-band-stress' &&
			snapshot.antiRingingPolicy.runtimePath === 'hardware-filtered-unweighted',
		'grounding parity artifact: WebGPU density reference must explicitly remain a full-band hardware-filtered stress row.' );

	}

	if ( snapshot.label === 'webgpu-webgl-density-shadowless' ) {

		assertLightProbeProof( file, snapshot.proofRole === 'same-budget-shadow-control' &&
			snapshot.shadowsDisabledDuringBake === true &&
			snapshot.antiRingingPolicy?.mode === 'shadowless-cause-control',
		'grounding parity artifact: WebGPU density shadowless row must disable bake-time shadows without changing SH band policy.' );

	}

	if ( snapshot.label === 'webgpu-webgl-density-shadow-crisp' ) {

		assertLightProbeProof( file, snapshot.proofRole === 'same-budget-direct-shadow-control' &&
			snapshot.shadowsDisabledDuringBake === false &&
			snapshot.directShadowControl?.mode === 'custom-bake-shadow-map' &&
			snapshot.directShadowControl.mapSize === 1024 &&
			snapshot.directShadowControl.radius === 0 &&
			snapshot.directShadowControl.normalBias === 0.01 &&
			snapshot.antiRingingPolicy?.mode === 'direct-shadow-crisp-cause-control',
		'grounding parity artifact: WebGPU density crisp-shadow row must change only direct shadow-map bake settings.' );

	}

	if ( snapshot.label === 'webgpu-webgl-density-damped' ) {

		assertLightProbeProof( file, snapshot.proofRole === 'same-budget-quality-candidate' &&
			snapshot.band1Intensity === 0.6 &&
			snapshot.antiRingingPolicy?.mode === 'band1-damped-quality' &&
			snapshot.antiRingingPolicy.runtimePath === 'hardware-filtered-unweighted',
		'grounding parity artifact: WebGPU density damped row must be promoted to a same-budget hardware-filtered anti-ringing quality candidate.' );

	}

	assertLightProbeProof( file, snapshot.artifactPressure !== undefined &&
		Number.isFinite( snapshot.artifactPressure.objectBlackTailRatio ) &&
		Number.isFinite( snapshot.artifactPressure.objectDarkTailRatio ) &&
		Number.isFinite( snapshot.artifactPressure.luminanceFloor ) &&
		Number.isFinite( snapshot.artifactPressure.cellEdgeContrast ),
	`grounding parity artifact ${ snapshot.label }: expected object-level artifact pressure metrics.` );
	assertLightProbeProof( file, snapshot.bakeTexelBudget !== undefined &&
		Number.isFinite( snapshot.bakeTexelBudget.cubemapTexels ) &&
		Number.isFinite( snapshot.bakeTexelBudget.relativeToLowRes ),
	`grounding parity artifact ${ snapshot.label }: expected bake texel budget accounting.` );

}

export function validateLightProbeParitySnapshots( file, snapshots ) {

	assertLightProbeProof( file, snapshots.length === lightProbeParitySnapshotLabels.length,
		'grounding parity artifact: expected every frozen proof snapshot.' );

	const rows = new Map( snapshots.map( snapshot => [ snapshot.label, snapshot ] ) );

	for ( const label of lightProbeParitySnapshotLabels ) {

		assertLightProbeProof( file, rows.has( label ),
			`grounding parity artifact: missing ${ label } snapshot.` );

	}

	const damped = rows.get( 'low-res-damped' );
	const unweighted = rows.get( 'low-res-unweighted' );
	const weighted = rows.get( 'low-res-validity-weighted' );
	const densityReference = rows.get( 'webgpu-webgl-density-reference' );
	const densityShadowless = rows.get( 'webgpu-webgl-density-shadowless' );
	const densityShadowCrisp = rows.get( 'webgpu-webgl-density-shadow-crisp' );
	const densityDamped = rows.get( 'webgpu-webgl-density-damped' );

	assertLightProbeProof( file, damped.probeIntensity === unweighted.probeIntensity &&
		unweighted.probeIntensity === weighted.probeIntensity,
	'grounding parity artifact: low-res comparison must not improve bounce by changing global probe intensity.' );
	assertLightProbeProof( file, unweighted.band1Intensity === 1 &&
		damped.band1Intensity === 0.6 &&
		unweighted.band2Intensity === damped.band2Intensity,
	'grounding parity artifact: low-res comparison must isolate first-band directionality.' );
	assertLightProbeProof( file, getSnapshotRegion( unweighted, 'tallBox' ).colorBias.redOverGreen >
		getSnapshotRegion( damped, 'tallBox' ).colorBias.redOverGreen,
	'grounding parity artifact: full band-1 low-res row must improve tall-box red bias over damped baseline.' );
	assertLightProbeProof( file, getSnapshotRegion( unweighted, 'sphere' ).colorBias.greenOverRed > 1,
		'grounding parity artifact: full band-1 low-res row must preserve sphere green bounce.' );
	assertLightProbeProof( file, getSnapshotRegion( unweighted, 'rightWall' ).colorBias.greenOverRed > 1.25,
		'grounding parity artifact: full band-1 low-res row must preserve right-side green bounce.' );
	assertLightProbeProof( file, getSnapshotRegion( unweighted, 'tallBox' ).darkPixelRatio <=
		getSnapshotRegion( damped, 'tallBox' ).darkPixelRatio + 0.35,
	'grounding parity artifact: full band-1 low-res row must keep tall-box dark tail bounded.' );
	assertLightProbeProof( file, densityReference.metrics.resolution === 6 &&
		densityReference.metrics.cubemapSize === 32 &&
		densityReference.metrics.sampling.weightedProbeSampling === false,
	'grounding parity artifact: WebGPU WebGL-like density reference must remain unweighted and use 6^3 / 32px.' );
	assertLightProbeProof( file, densityShadowless.metrics.resolution === 6 &&
		densityShadowless.metrics.cubemapSize === 32 &&
		densityShadowless.shadowsDisabledDuringBake === true,
	'grounding parity artifact: WebGPU density shadowless row must preserve same budget and disable bake shadows.' );
	assertLightProbeProof( file, densityShadowCrisp.metrics.resolution === 6 &&
		densityShadowCrisp.metrics.cubemapSize === 32 &&
		densityShadowCrisp.shadowsDisabledDuringBake === false &&
		densityShadowCrisp.directShadowControl.mapSize === 1024 &&
		densityShadowCrisp.directShadowControl.radius === 0 &&
		densityShadowCrisp.directShadowControl.normalBias === 0.01 &&
		densityShadowCrisp.band1Intensity === densityReference.band1Intensity &&
		densityShadowCrisp.band2Intensity === densityReference.band2Intensity &&
		densityShadowCrisp.metrics.sampling.weightedProbeSampling === densityReference.metrics.sampling.weightedProbeSampling,
	'grounding parity artifact: WebGPU density crisp-shadow row must preserve probe budget and SH band policy while changing direct shadow-map settings.' );
	assertLightProbeProof( file, densityDamped.metrics.resolution === 6 &&
		densityDamped.metrics.cubemapSize === 32 &&
		densityDamped.band1Intensity === 0.6 &&
		densityDamped.band2Intensity === densityReference.band2Intensity &&
		densityDamped.normalBias === densityReference.normalBias &&
		densityDamped.viewBias === densityReference.viewBias &&
		densityDamped.probeIntensity === densityReference.probeIntensity &&
		densityDamped.metrics.materialType === densityReference.metrics.materialType &&
		densityDamped.metrics.lightingMode === densityReference.metrics.lightingMode &&
		densityDamped.metrics.precision.requestedPrecision === densityReference.metrics.precision.requestedPrecision &&
		densityDamped.metrics.sampling.probeValidityMode === densityReference.metrics.sampling.probeValidityMode &&
		densityDamped.metrics.sampling.invalidProbeCount === densityReference.metrics.sampling.invalidProbeCount &&
		densityDamped.metrics.sampling.manualIrradianceSampling === false &&
		densityDamped.metrics.sampling.weightedProbeSampling === false &&
		densityDamped.metrics.sampling.weightedProbeSampling === densityReference.metrics.sampling.weightedProbeSampling,
	'grounding parity artifact: WebGPU density quality candidate must preserve same budget, probe intensity, precision, material, bias, validity mode, and unweighted sampling while damping first-band SH.' );
	assertLightProbeProof( file, densityDamped.antiRingingPolicy?.mode === 'band1-damped-quality' &&
		densityDamped.antiRingingPolicy.bandPolicy === 'L0 preserved, L1=0.6, L2=0.55' &&
		densityDamped.bakeTexelBudget.cubemapTexels === densityReference.bakeTexelBudget.cubemapTexels,
	'grounding parity artifact: same-budget quality candidate must encode the math action as L1 damping, not a hidden budget or intensity change.' );
	assertLightProbeProof( file, densityReference.bakeTexelBudget.cubemapTexels === 1327104 &&
		densityReference.bakeTexelBudget.relativeToLowRes === 54,
	'grounding parity artifact: WebGPU density stress row must report the 54x cubemap texel work budget.' );
	assertLightProbeProof( file, densityReference.artifactPressure.status === 'PRESSURE' ||
		densityReference.artifactPressure.objectBlackTailRatio <= 0.15,
	'grounding parity artifact: WebGPU density stress row must mark visible black-tail artifacts as pressure.' );
	assertLightProbeProof( file, densityShadowless.artifactPressure.objectBlackTailRatio <=
		densityReference.artifactPressure.objectBlackTailRatio + 0.02,
	'grounding parity artifact: shadowless density control must not worsen object black-tail pressure.' );
	assertLightProbeProof( file, densityDamped.artifactPressure.status === 'bounded' &&
		densityDamped.artifactPressure.objectBlackTailRatio <= 0.08 &&
		densityDamped.artifactPressure.luminanceFloor >= 24,
	'grounding parity artifact: same-budget quality candidate must address muddy object black-tail pressure.' );
	assertLightProbeProof( file, densityDamped.artifactPressure.objectBlackTailRatio <=
		densityReference.artifactPressure.objectBlackTailRatio - 0.25,
	'grounding parity artifact: same-budget quality candidate must materially reduce black-tail pressure.' );
	assertLightProbeProof( file, densityDamped.artifactPressure.cellEdgeContrast <=
		densityReference.artifactPressure.cellEdgeContrast,
	'grounding parity artifact: same-budget quality candidate must not trade black-tail fix for worse cell-edge contrast.' );

}

export function validateLightProbeWebGLReference( file, reference ) {

	assertLightProbeProof( file, reference.label === lightProbeWebGLReferenceLabel,
		'WebGL reference artifact: expected stable reference label.' );
	assertLightProbeProof( file, reference.proofRole === 'same-class-webgl-reference',
		'WebGL reference artifact: expected same-class reference role.' );
	assertLightProbeProof( file, reference.metrics.backend === 'WebGL' &&
		reference.metrics.implementation === 'LightProbeGrid' &&
		reference.metrics.resolution === 6 &&
		reference.metrics.cubemapSize === 32 &&
		reference.metrics.lightingMode === 'probes only',
	'WebGL reference artifact: expected LightProbeGrid 6^3 / 32px probes-only reference metrics.' );

	for ( const regionName of [ 'tallBox', 'shortBox', 'sphere', 'rightWall' ] ) {

		const region = getSnapshotRegion( reference, regionName );
		assertLightProbeProof( file, Number.isFinite( region.color.r ) &&
			Number.isFinite( region.color.g ) &&
			Number.isFinite( region.color.b ),
		`WebGL reference artifact ${ regionName }: expected finite RGB averages.` );
		assertLightProbeProof( file, Number.isFinite( region.colorBias.redOverGreen ) &&
			Number.isFinite( region.colorBias.greenOverRed ),
		`WebGL reference artifact ${ regionName }: expected finite color-bias ratios.` );
		assertLightProbeProof( file, Number.isFinite( region.darkPixelRatio ) &&
			region.darkPixelRatio >= 0 &&
			region.darkPixelRatio <= 1,
		`WebGL reference artifact ${ regionName }: expected bounded dark-pixel ratio.` );

	}

	assertLightProbeProof( file, getSnapshotRegion( reference, 'tallBox' ).colorBias.redOverGreen > 1,
		'WebGL reference artifact: expected positive tall-box red bounce signal.' );
	assertLightProbeProof( file, getSnapshotRegion( reference, 'sphere' ).colorBias.greenOverRed > 1,
		'WebGL reference artifact: expected positive sphere green bounce signal.' );
	assertLightProbeProof( file, reference.artifactPressure !== undefined &&
		Number.isFinite( reference.artifactPressure.objectBlackTailRatio ) &&
		Number.isFinite( reference.artifactPressure.luminanceFloor ),
	'WebGL reference artifact: expected object-level artifact pressure metrics.' );

}

