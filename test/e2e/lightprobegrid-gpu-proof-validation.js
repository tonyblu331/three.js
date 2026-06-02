import {
	lightProbeParitySnapshotLabels,
	lightProbeWebGLReferenceLabel
} from './lightprobegrid-gpu-smoke-config.js';

const getSnapshotRegion = ( snapshot, regionName ) => {

	const region = snapshot.regions[ regionName ];
	if ( region === undefined ) throw new Error( `Missing snapshot region: ${ snapshot.label }/${ regionName }` );
	return region;

};

const getSnapshotCubemapTexels = ( snapshot ) =>
	snapshot.metrics.resolution * snapshot.metrics.resolution * snapshot.metrics.resolution * 6 *
	snapshot.metrics.cubemapSize * snapshot.metrics.cubemapSize;

const getSnapshotRelativeToLowRes = ( snapshot ) =>
	getSnapshotCubemapTexels( snapshot ) / ( 4 * 4 * 4 * 6 * 8 * 8 );

const hasSnapshotBudget = ( snapshot, resolution, cubemapSize ) =>
	snapshot.metrics.resolution === resolution && snapshot.metrics.cubemapSize === cubemapSize;

const hasDensitySnapshotBudget = snapshot => hasSnapshotBudget( snapshot, 6, 32 );

const hasUnweightedSampling = snapshot => snapshot.metrics.sampling.weightedProbeSampling === false;

const hasHardwareFilteredSampling = snapshot =>
	snapshot.metrics.sampling.manualIrradianceSampling === false &&
	hasUnweightedSampling( snapshot );

const hasHardwareFilteredDensitySnapshot = snapshot =>
	hasDensitySnapshotBudget( snapshot ) &&
	hasHardwareFilteredSampling( snapshot );

const hasSameDensityFixture = ( snapshot, reference ) =>
	snapshot.band2Intensity === reference.band2Intensity &&
	snapshot.normalBias === reference.normalBias &&
	snapshot.viewBias === reference.viewBias &&
	snapshot.probeIntensity === reference.probeIntensity &&
	snapshot.metrics.materialType === reference.metrics.materialType &&
	snapshot.metrics.lightingMode === reference.metrics.lightingMode &&
	snapshot.metrics.precision.requestedPrecision === reference.metrics.precision.requestedPrecision &&
	snapshot.metrics.sampling.probeValidityMode === reference.metrics.sampling.probeValidityMode &&
	snapshot.metrics.sampling.invalidProbeCount === reference.metrics.sampling.invalidProbeCount &&
	hasHardwareFilteredDensitySnapshot( snapshot ) &&
	hasHardwareFilteredDensitySnapshot( reference );

const hasDensityReferenceFacts = snapshot =>
	snapshot.directShadowControl === undefined &&
	snapshot.antiRingingPolicy === undefined &&
	snapshot.band1Intensity === 1 &&
	snapshot.band2Intensity === 0.55 &&
	hasHardwareFilteredSampling( snapshot );

const hasDensityShadowlessFacts = snapshot =>
	hasDensitySnapshotBudget( snapshot ) &&
	snapshot.shadowsDisabledDuringBake === true &&
	snapshot.directShadowControl === undefined &&
	snapshot.antiRingingPolicy === undefined;

const hasDensityCrispShadowRowFacts = snapshot =>
	hasDensitySnapshotBudget( snapshot ) &&
	snapshot.shadowsDisabledDuringBake === undefined &&
	hasCrispDirectShadowControl( snapshot ) &&
	snapshot.antiRingingPolicy === undefined &&
	hasHardwareFilteredSampling( snapshot );

const hasDensityCrispShadowComparisonFacts = ( snapshot, reference ) =>
	hasDensityCrispShadowRowFacts( snapshot ) &&
	snapshot.band1Intensity === reference.band1Intensity &&
	snapshot.band2Intensity === reference.band2Intensity &&
	hasHardwareFilteredSampling( reference );

const hasDensityDampedFixtureFacts = ( snapshot, reference ) =>
	hasSameDensityFixture( snapshot, reference ) &&
	snapshot.antiRingingPolicy === undefined &&
	snapshot.band1Intensity === 0.6;

const hasDensityDampedMathActionFacts = ( snapshot, reference ) =>
	snapshot.antiRingingPolicy === undefined &&
	snapshot.band1Intensity === 0.6 &&
	snapshot.band2Intensity === reference.band2Intensity &&
	getSnapshotCubemapTexels( snapshot ) === getSnapshotCubemapTexels( reference );

const hasLowResSharedProbeIntensity = ( damped, unweighted, weighted ) =>
	damped.probeIntensity === unweighted.probeIntensity &&
	unweighted.probeIntensity === weighted.probeIntensity;

const hasLowResBandIsolation = ( damped, unweighted ) =>
	unweighted.band1Intensity === 1 &&
	damped.band1Intensity === 0.6 &&
	unweighted.band2Intensity === damped.band2Intensity;

const hasLowResBounceFacts = unweighted =>
	getSnapshotRegion( unweighted, 'sphere' ).colorBias.greenOverRed > 1 &&
	getSnapshotRegion( unweighted, 'rightWall' ).colorBias.greenOverRed > 1.25;

const hasLowResDampedComparisonFacts = ( damped, unweighted ) =>
	getSnapshotRegion( unweighted, 'tallBox' ).colorBias.redOverGreen >
		getSnapshotRegion( damped, 'tallBox' ).colorBias.redOverGreen &&
	getSnapshotRegion( unweighted, 'tallBox' ).darkPixelRatio <=
		getSnapshotRegion( damped, 'tallBox' ).darkPixelRatio + 0.35;

const hasNoFields = ( object, ...fields ) => fields.every( field => object[ field ] === undefined );

const hasArtifactPressureFacts = ( artifactPressure, ...fields ) =>
	artifactPressure !== undefined &&
	fields.every( field => Number.isFinite( artifactPressure[ field ] ) ) &&
	artifactPressure.status === undefined;

const hasCrispDirectShadowControl = snapshot =>
	snapshot.directShadowControl !== undefined &&
	snapshot.directShadowControl.mode === undefined &&
	snapshot.directShadowControl.mapSize === 1024 &&
	snapshot.directShadowControl.radius === 0 &&
	snapshot.directShadowControl.normalBias === 0.01;

const assertRegionFacts = ( file, ownerLabel, region, { requireBlackTail = false, requireCellEdge = false } = {} ) => {

	assertLightProbeProof( file, Number.isFinite( region.color.r ) &&
		Number.isFinite( region.color.g ) &&
		Number.isFinite( region.color.b ),
	`${ ownerLabel }: expected finite RGB averages.` );
	assertLightProbeProof( file, Number.isFinite( region.colorBias.redOverGreen ) &&
		Number.isFinite( region.colorBias.greenOverRed ),
	`${ ownerLabel }: expected finite color-bias ratios.` );
	assertLightProbeProof( file, Number.isFinite( region.darkPixelRatio ) &&
		region.darkPixelRatio >= 0 &&
		region.darkPixelRatio <= 1,
	`${ ownerLabel }: expected bounded dark-pixel ratio.` );

	if ( requireBlackTail === true ) {

		assertLightProbeProof( file, Number.isFinite( region.blackPixelRatio ) &&
			region.blackPixelRatio >= 0 &&
			region.blackPixelRatio <= 1,
		`${ ownerLabel }: expected bounded black-tail ratio.` );

	}

	if ( requireCellEdge === true ) {

		assertLightProbeProof( file, Number.isFinite( region.cellEdgeContrast ) &&
			region.cellEdgeContrast >= 0 &&
			region.cellEdgeContrast <= 255,
		`${ ownerLabel }: expected bounded cell-edge contrast.` );

	}

};

export function assertLightProbeProof( file, condition, message ) {

	if ( condition === false ) throw new Error( `${ file }: ${ message }` );

}

export function validateLightProbeParitySnapshot( file, snapshot ) {

	assertLightProbeProof( file, lightProbeParitySnapshotLabels.includes( snapshot.label ),
		`grounding parity artifact: unexpected snapshot label ${ snapshot.label }.` );
	assertLightProbeProof( file, snapshot.proofRole === undefined,
		`grounding parity artifact ${ snapshot.label }: expected label-owned proof role without artifact role echo.` );
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
	assertLightProbeProof( file, hasNoFields( snapshot.metrics,
		'memory',
		'visibilityDepth',
		'isLightProbeGrid',
		'hasTexture',
		'hasBoundingBox',
		'probeHelper'
	),
	`grounding parity artifact ${ snapshot.label }: expected compact snapshot metrics without runtime/debug echoes.` );
	assertLightProbeProof( file, hasNoFields( snapshot.metrics.timings,
		'cubemapMs',
		'projectionMs',
		'copyMs',
		'timingBuckets'
	),
	`grounding parity artifact ${ snapshot.label }: expected compact metric timing facts without phase timing payload.` );
	assertLightProbeProof( file, Number.isFinite( snapshot.artifactSignature.center.luminance ) &&
		snapshot.artifactSignature.center.luminance > 18,
	`grounding parity artifact ${ snapshot.label }: expected visible center luminance floor.` );
	assertLightProbeProof( file, hasNoFields( snapshot.artifactSignature.center,
		'r',
		'g',
		'b',
		'chromaSpread'
	),
	`grounding parity artifact ${ snapshot.label }: expected compact center signature without unused RGB/chroma payload.` );

	for ( const regionName of [ 'tallBox', 'shortBox', 'sphere', 'rightWall' ] ) {

		const region = getSnapshotRegion( snapshot, regionName );
		assertRegionFacts( file, `grounding parity artifact ${ snapshot.label }/${ regionName }`, region, {
			requireBlackTail: true,
			requireCellEdge: true
		} );

	}

	if ( snapshot.label === 'low-res-unweighted' ) {

		assertLightProbeProof( file, hasUnweightedSampling( snapshot ),
			'grounding parity artifact: unweighted low-res candidate must stay on hardware-filtered sampling.' );

	}

	if ( snapshot.label === 'low-res-validity-weighted' ) {

		assertLightProbeProof( file, snapshot.metrics.sampling.weightedProbeSampling === true &&
			snapshot.metrics.sampling.probeValidityMode === 'custom',
		'grounding parity artifact: validity-weighted low-res candidate must use custom validity metadata.' );

	}

	if ( snapshot.label.startsWith( 'webgpu-webgl-density-' ) ) {

		assertLightProbeProof( file, hasDensitySnapshotBudget( snapshot ),
		`grounding parity artifact ${ snapshot.label }: WebGPU density row must match the WebGL 6^3 / 32px reference budget.` );

	}

	if ( snapshot.label === 'webgpu-webgl-density-reference' ) {

		assertLightProbeProof( file, hasDensityReferenceFacts( snapshot ),
		'grounding parity artifact: WebGPU density reference must explicitly remain a full-band hardware-filtered stress row.' );

	}

	if ( snapshot.label === 'webgpu-webgl-density-shadowless' ) {

		assertLightProbeProof( file, hasDensityShadowlessFacts( snapshot ),
		'grounding parity artifact: WebGPU density shadowless row must disable bake-time shadows without changing SH band policy.' );

	}

	if ( snapshot.label === 'webgpu-webgl-density-shadow-crisp' ) {

		assertLightProbeProof( file, hasDensityCrispShadowRowFacts( snapshot ),
		'grounding parity artifact: WebGPU density crisp-shadow row must change only direct shadow-map bake settings.' );

	}

	if ( snapshot.label === 'webgpu-webgl-density-damped' ) {

		assertLightProbeProof( file, snapshot.band1Intensity === 0.6 &&
			snapshot.antiRingingPolicy === undefined &&
			hasHardwareFilteredSampling( snapshot ),
		'grounding parity artifact: WebGPU density damped row must be promoted to a same-budget hardware-filtered anti-ringing quality candidate.' );

	}

	assertLightProbeProof( file, hasArtifactPressureFacts(
		snapshot.artifactPressure,
		'objectBlackTailRatio',
		'objectDarkTailRatio',
		'luminanceFloor',
		'cellEdgeContrast'
	),
	`grounding parity artifact ${ snapshot.label }: expected raw object-level artifact pressure metrics without a local verdict status.` );
	assertLightProbeProof( file, snapshot.bakeTexelBudget === undefined,
	`grounding parity artifact ${ snapshot.label }: expected no derived bake-texel budget echo.` );
	assertLightProbeProof( file, snapshot.probeHelperIntensity === undefined,
	`grounding parity artifact ${ snapshot.label }: expected no unused probe-helper intensity echo.` );

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

	assertLightProbeProof( file, hasLowResSharedProbeIntensity( damped, unweighted, weighted ),
	'grounding parity artifact: low-res comparison must not improve bounce by changing global probe intensity.' );
	assertLightProbeProof( file, hasLowResBandIsolation( damped, unweighted ),
	'grounding parity artifact: low-res comparison must isolate first-band directionality.' );
	assertLightProbeProof( file, hasLowResDampedComparisonFacts( damped, unweighted ),
	'grounding parity artifact: full band-1 low-res row must improve tall-box red bias over damped baseline and keep dark tail bounded.' );
	assertLightProbeProof( file, hasLowResBounceFacts( unweighted ),
		'grounding parity artifact: full band-1 low-res row must preserve sphere and right-side green bounce.' );
	assertLightProbeProof( file, hasHardwareFilteredDensitySnapshot( densityReference ),
	'grounding parity artifact: WebGPU WebGL-like density reference must remain unweighted and use 6^3 / 32px.' );
	assertLightProbeProof( file, hasDensityShadowlessFacts( densityShadowless ),
	'grounding parity artifact: WebGPU density shadowless row must preserve same budget and disable bake shadows.' );
	assertLightProbeProof( file, hasDensityCrispShadowComparisonFacts( densityShadowCrisp, densityReference ),
	'grounding parity artifact: WebGPU density crisp-shadow row must preserve probe budget and SH band policy while changing direct shadow-map settings.' );
	assertLightProbeProof( file, hasDensityDampedFixtureFacts( densityDamped, densityReference ),
	'grounding parity artifact: WebGPU density quality candidate must preserve same budget, probe intensity, precision, material, bias, validity mode, and unweighted sampling while damping first-band SH.' );
	assertLightProbeProof( file, hasDensityDampedMathActionFacts( densityDamped, densityReference ),
	'grounding parity artifact: same-budget quality candidate must encode the math action as L1 damping, not a hidden budget or intensity change.' );
	assertLightProbeProof( file, getSnapshotCubemapTexels( densityReference ) === 1327104 &&
		getSnapshotRelativeToLowRes( densityReference ) === 54,
	'grounding parity artifact: WebGPU density stress row must report the 54x cubemap texel work budget.' );
	assertLightProbeProof( file, densityReference.artifactPressure.objectBlackTailRatio > 0.15 ||
		densityReference.artifactPressure.luminanceFloor < 24,
	'grounding parity artifact: WebGPU density stress row must expose raw black-tail or luminance pressure.' );
	assertLightProbeProof( file, densityShadowless.artifactPressure.objectBlackTailRatio <=
		densityReference.artifactPressure.objectBlackTailRatio + 0.02,
	'grounding parity artifact: shadowless density control must not worsen object black-tail pressure.' );
	assertLightProbeProof( file, densityDamped.artifactPressure.objectBlackTailRatio <= 0.08 &&
		densityDamped.artifactPressure.luminanceFloor >= 24,
	'grounding parity artifact: same-budget quality candidate must satisfy raw black-tail and luminance pressure thresholds.' );
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
		assertRegionFacts( file, `WebGL reference artifact ${ regionName }`, region );

	}

	assertLightProbeProof( file, getSnapshotRegion( reference, 'tallBox' ).colorBias.redOverGreen > 1,
		'WebGL reference artifact: expected positive tall-box red bounce signal.' );
	assertLightProbeProof( file, getSnapshotRegion( reference, 'sphere' ).colorBias.greenOverRed > 1,
		'WebGL reference artifact: expected positive sphere green bounce signal.' );
	assertLightProbeProof( file, hasArtifactPressureFacts(
		reference.artifactPressure,
		'objectBlackTailRatio',
		'luminanceFloor'
	),
	'WebGL reference artifact: expected raw object-level artifact pressure metrics without a local verdict status.' );

}

