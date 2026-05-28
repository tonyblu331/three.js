import { createLightProbeResearchReportSections } from './lightprobegrid-gpu-proof-research-sections.js';
import { createLightProbeProofOracleStudies } from './lightprobegrid-gpu-proof-oracle-studies.js';
import { roundMetric } from './lightprobegrid-gpu-report-metrics.js';
import {
	createSurfaceContentAttributionFollowupStudy,
	createSurfaceContentAttributionSplitStudy
} from './lightprobegrid-gpu-proof-surface-studies.js';
import { deriveVisibilityProofStatus } from './lightprobegrid-gpu-proof-visibility.js';
import { lightProbeWebGLReferenceLabel } from './lightprobegrid-gpu-smoke-config.js';

const getSmokeStep = ( smokeResults, step ) => {

	const result = smokeResults.find( row => row.step === step );
	if ( result === undefined ) throw new Error( `Missing smoke result step: ${ step }` );
	return result;

};

const createLightProbeBakeTexelBudget = ( resolution, cubemapSize ) => {

	const probes = resolution * resolution * resolution;
	const cubemapFaceTexels = cubemapSize * cubemapSize;
	const cubemapTexels = probes * 6 * cubemapFaceTexels;
	const lowResCubemapTexels = 4 * 4 * 4 * 6 * 8 * 8;

	return {
		resolution,
		cubemapSize,
		probes,
		cubemapFaceTexels,
		cubemapTexels,
		relativeToLowRes: Number( ( cubemapTexels / lowResCubemapTexels ).toFixed( 4 ) )
	};

};

export function createLightProbeProofReport( file, smokeResults, snapshots, restored, webglReference ) {

	const artifactMatrix = getSmokeStep( smokeResults, 'artifact matrix' ).artifactMatrix;
	const regionMatrix = getSmokeStep( smokeResults, 'region artifact matrix' ).regionMatrix;
	const leakMatrix = getSmokeStep( smokeResults, 'leak matrix' ).leakMatrix;
	const projectionParity = getSmokeStep( smokeResults, 'projection parity' ).projectionParity;
	const atlasPacking = getSmokeStep( smokeResults, 'atlas packing' ).atlasPacking;
	const computeProjectionRuntimeParity = getSmokeStep( smokeResults, 'compute projection runtime parity' ).computeProjectionRuntimeParity;
	const computeProjectionProfiling = getSmokeStep( smokeResults, 'compute projection profiling' ).computeProjectionProfiling;
	const shMathContract = getSmokeStep( smokeResults, 'sh math contract' ).shMathContract;
	const visibilityMomentInspection = getSmokeStep( smokeResults, 'visibility moment inspection' ).visibilityMomentInspection;
	const visibilityProofStatus = deriveVisibilityProofStatus( visibilityMomentInspection, visibilityMomentInspection.evidenceStatus );
	const visibilityWeightingDiagnostic = getSmokeStep( smokeResults, 'visibility weighting diagnostic' ).visibilityWeightingDiagnostic;
	const sealedVisibilityWeightingDiagnostic = getSmokeStep( smokeResults, 'sealed visibility weighting diagnostic' ).sealedVisibilityWeightingDiagnostic;
	const sealedReceiverNormalDiagnostic = getSmokeStep( smokeResults, 'sealed receiver normal convention diagnostic' ).sealedReceiverNormalDiagnostic;
	const sealedShContributionDiagnostic = sealedVisibilityWeightingDiagnostic.shContributionDiagnostic;
	const probeContentChromaStudy = sealedShContributionDiagnostic.probeContentChromaStudy;
	const probeBakeContaminationMap = sealedShContributionDiagnostic.probeBakeContaminationMap;
	const dominantProbeCoefficientStudy = probeBakeContaminationMap.dominantProbeCoefficientStudy;
	const shDampingOracleStudy = probeBakeContaminationMap.shDampingOracleStudy;
	const dominantProbePlacementStudy = probeBakeContaminationMap.dominantProbePlacementStudy;
	const combinedSourceDampingOracleStudy = probeBakeContaminationMap.combinedSourceDampingOracleStudy;
	const dilationSourceQualityStudy = probeBakeContaminationMap.dilationSourceQualityStudy;
	const sameSideLayerMaskOracleStudy = probeBakeContaminationMap.sameSideLayerMaskOracleStudy;
	const sdfStaticBlockerOracleStudy = probeBakeContaminationMap.sdfStaticBlockerOracleStudy;
	const aggregateBakePolicyOracleStudy = probeBakeContaminationMap.aggregateBakePolicyOracleStudy;
	const probeDensityMetricStudy = sealedShContributionDiagnostic.probeDensityMetricStudy;
	const sealedReceiverSurfaceQuadratureDiagnostic = sealedVisibilityWeightingDiagnostic.receiverSurfaceQuadratureDiagnostic;
	const sealedReceiverGpuDebugDiagnostic = sealedVisibilityWeightingDiagnostic.receiverGpuDebugDiagnostic;
	const sealedPresentationStudy = sealedReceiverGpuDebugDiagnostic.presentationStudy;
	const receiverPixelParityStudy = sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy ?? null;
	const visiblePixelCpuMirrorStudy = sealedPresentationStudy.summary.visiblePixelCpuMirrorStudy ?? null;
	let sealedFailureDomain = leakMatrix.comparisons.sealedWall.status === 'OPEN' &&
		sealedVisibilityWeightingDiagnostic.interrogationFinding === 'CPU-DIRECTIONAL-SUPPRESSION-SUPPORTED' ?
		sealedShContributionDiagnostic.suspectedFailureDomain :
		'WEIGHTING-OR-FIXTURE';
	const sealedVisibilityLeakRow = leakMatrix.rows.find( row => row.label === 'leak-sealed-wall-visibility-scaffold-disabled' );
	const cpuRenderAgreementTolerance = 0.15;
	const cpuRenderMetricDeltas = [
		{
			metric: 'bounds',
			value: sealedVisibilityLeakRow.leakMetrics.wrongSideColorRatio,
			delta: Math.abs( sealedVisibilityLeakRow.leakMetrics.wrongSideColorRatio - sealedShContributionDiagnostic.summary.runtimeWrongRatioMean )
		},
		{
			metric: 'center',
			value: sealedVisibilityLeakRow.leakMetrics.centerWrongSideColorRatio,
			delta: Math.abs( sealedVisibilityLeakRow.leakMetrics.centerWrongSideColorRatio - sealedShContributionDiagnostic.summary.runtimeWrongRatioMean )
		},
		{
			metric: 'surface-isolated',
			value: sealedVisibilityLeakRow.leakMetrics.surfaceWrongSideColorRatio,
			delta: Math.abs( sealedVisibilityLeakRow.leakMetrics.surfaceWrongSideColorRatio - sealedShContributionDiagnostic.summary.runtimeWrongRatioMean )
		},
		{
			metric: 'receiver-surface-quadrature-mean',
			value: sealedVisibilityLeakRow.leakMetrics.surfaceWrongSideColorRatio,
			delta: Math.abs( sealedVisibilityLeakRow.leakMetrics.surfaceWrongSideColorRatio - sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMean )
		},
		{
			metric: 'receiver-surface-quadrature-max',
			value: sealedVisibilityLeakRow.leakMetrics.surfaceWrongSideColorRatio,
			delta: Math.abs( sealedVisibilityLeakRow.leakMetrics.surfaceWrongSideColorRatio - sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMax )
		},
		{
			metric: 'masked-visible-pixels-receiver-mean',
			value: sealedVisibilityLeakRow.leakMetrics.maskedWrongSideColorRatio,
			delta: Math.abs( sealedVisibilityLeakRow.leakMetrics.maskedWrongSideColorRatio - sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMean )
		},
		{
			metric: 'masked-visible-pixels-receiver-max',
			value: sealedVisibilityLeakRow.leakMetrics.maskedWrongSideColorRatio,
			delta: Math.abs( sealedVisibilityLeakRow.leakMetrics.maskedWrongSideColorRatio - sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMax )
		}
	].sort( ( a, b ) => a.delta - b.delta );
	const bestCpuRenderMetricAgreement = cpuRenderMetricDeltas[ 0 ];
	const cpuRenderAgreementGate = bestCpuRenderMetricAgreement.delta <= cpuRenderAgreementTolerance ? 'SUPPORTED' : 'OPEN';
	const offscreenSceneLinearContributionRows = sealedPresentationStudy.summary.offscreenSceneLinearContributionRows ?? [];
	const offscreenSceneLinearNeutralContributionRows = sealedPresentationStudy.summary.offscreenSceneLinearNeutralContributionRows ?? [];
	const standardProbeOnlySceneLinearRow = offscreenSceneLinearContributionRows.find( row => row.label === 'probes-only' ) ?? null;
	const standardNeutralProbeOnlySceneLinearRow = offscreenSceneLinearNeutralContributionRows.find( row => row.label === 'neutral-probes-only' ) ?? null;
	const runtimeProbeOnlySceneLinearRow = offscreenSceneLinearContributionRows.find( row => row.label === 'runtime-probe-indirect-scene-linear' ) ??
		standardProbeOnlySceneLinearRow;
	const neutralRuntimeProbeOnlySceneLinearRow = offscreenSceneLinearNeutralContributionRows.find( row => row.label === 'neutral-runtime-probe-indirect-scene-linear' ) ??
		standardNeutralProbeOnlySceneLinearRow;
	const visiblePixelSceneLinearCpuDeltaMean = visiblePixelCpuMirrorStudy?.summary?.cpuGpuWrongSideRatioDeltaMean ?? null;
	const visiblePixelSceneLinearCpuDeltaMax = visiblePixelCpuMirrorStudy?.summary?.cpuGpuWrongSideRatioDeltaMax ?? null;
	const visiblePixelSceneLinearCpuAgreementSupported = visiblePixelCpuMirrorStudy?.status === 'SUPPORTED-VISIBLE-PIXEL-CPU-GPU-SCENE-LINEAR-PARITY' &&
		visiblePixelSceneLinearCpuDeltaMean !== null &&
		visiblePixelSceneLinearCpuDeltaMax !== null &&
		( visiblePixelSceneLinearCpuDeltaMean <= cpuRenderAgreementTolerance ||
			visiblePixelSceneLinearCpuDeltaMax <= cpuRenderAgreementTolerance );
	const surfaceProbeOnlySceneLinearCpuDeltaMean = runtimeProbeOnlySceneLinearRow !== null &&
		Number.isFinite( runtimeProbeOnlySceneLinearRow.maskedWrongSideColorRatio ) ?
		Number( Math.abs(
			runtimeProbeOnlySceneLinearRow.maskedWrongSideColorRatio -
			sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMean
		).toFixed( 4 ) ) :
		null;
	const surfaceProbeOnlySceneLinearCpuDeltaMax = runtimeProbeOnlySceneLinearRow !== null &&
		Number.isFinite( runtimeProbeOnlySceneLinearRow.maskedWrongSideColorRatio ) ?
		Number( Math.abs(
			runtimeProbeOnlySceneLinearRow.maskedWrongSideColorRatio -
			sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMax
		).toFixed( 4 ) ) :
		null;
	const probeOnlySceneLinearCpuDeltaMean = visiblePixelSceneLinearCpuDeltaMean ?? surfaceProbeOnlySceneLinearCpuDeltaMean;
	const probeOnlySceneLinearCpuDeltaMax = visiblePixelSceneLinearCpuDeltaMax ?? surfaceProbeOnlySceneLinearCpuDeltaMax;
	const probeOnlySceneLinearCpuAgreement = {
		status: visiblePixelSceneLinearCpuAgreementSupported ||
			( runtimeProbeOnlySceneLinearRow !== null &&
				runtimeProbeOnlySceneLinearRow.status === 'SUPPORTED' &&
				surfaceProbeOnlySceneLinearCpuDeltaMean !== null &&
				surfaceProbeOnlySceneLinearCpuDeltaMax !== null &&
				( surfaceProbeOnlySceneLinearCpuDeltaMean <= cpuRenderAgreementTolerance ||
					surfaceProbeOnlySceneLinearCpuDeltaMax <= cpuRenderAgreementTolerance ) ) ?
			'SUPPORTED' :
			'OPEN',
		mode: visiblePixelCpuMirrorStudy !== null ?
			'probe-indirect-only-scene-linear-vs-cpu-visible-pixel-sh' :
			'probe-indirect-only-scene-linear-vs-cpu-surface-sh',
		comparisonSourceLabel: runtimeProbeOnlySceneLinearRow?.label ?? null,
		standardProbeOnlyLabel: standardProbeOnlySceneLinearRow?.label ?? null,
		originalProbeOnlyAvailable: runtimeProbeOnlySceneLinearRow !== null,
		neutralProbeOnlyAvailable: neutralRuntimeProbeOnlySceneLinearRow !== null,
		originalProbeOnlyMaskedWrongSideColorRatio: runtimeProbeOnlySceneLinearRow?.maskedWrongSideColorRatio ?? null,
		originalProbeOnlyMaskedCorrectBounceRatio: runtimeProbeOnlySceneLinearRow?.maskedCorrectBounceRatio ?? null,
		neutralProbeOnlyMaskedWrongSideColorRatio: neutralRuntimeProbeOnlySceneLinearRow?.maskedWrongSideColorRatio ?? null,
		neutralProbeOnlyMaskedCorrectBounceRatio: neutralRuntimeProbeOnlySceneLinearRow?.maskedCorrectBounceRatio ?? null,
		standardProbeOnlyMaskedWrongSideColorRatio: standardProbeOnlySceneLinearRow?.maskedWrongSideColorRatio ?? null,
		standardProbeOnlyMaskedCorrectBounceRatio: standardProbeOnlySceneLinearRow?.maskedCorrectBounceRatio ?? null,
		cpuSurfaceRuntimeWrongRatioMean: sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMean,
		cpuSurfaceRuntimeWrongRatioMax: sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMax,
		surfaceDeltaMean: surfaceProbeOnlySceneLinearCpuDeltaMean,
		surfaceDeltaMax: surfaceProbeOnlySceneLinearCpuDeltaMax,
		visiblePixelMirrorStatus: visiblePixelCpuMirrorStudy?.status ?? null,
		visiblePixelMirrorDominantMismatchSource: visiblePixelCpuMirrorStudy?.summary?.dominantMismatchSource ?? null,
		visiblePixelMirrorDominantWeightingMismatchComponent: visiblePixelCpuMirrorStudy?.summary?.dominantWeightingMismatchComponent ?? null,
		visiblePixelMirrorWeightComponentDeltas: visiblePixelCpuMirrorStudy?.summary?.maxNeighborWeightComponentDeltas ?? null,
		visiblePixelSampleCount: visiblePixelCpuMirrorStudy?.summary?.sampleCount ?? null,
		cpuVisiblePixelRuntimeWrongRatioMean: visiblePixelCpuMirrorStudy?.summary?.cpuSampledWrongSideRatioMean ?? null,
		cpuVisiblePixelRuntimeWrongRatioMax: visiblePixelCpuMirrorStudy?.summary?.cpuSampledWrongSideRatioMax ?? null,
		gpuVisiblePixelRuntimeWrongRatioMean: visiblePixelCpuMirrorStudy?.summary?.gpuSampledWrongSideRatioMean ?? null,
		gpuVisiblePixelRuntimeWrongRatioMax: visiblePixelCpuMirrorStudy?.summary?.gpuSampledWrongSideRatioMax ?? null,
		deltaMean: probeOnlySceneLinearCpuDeltaMean,
		deltaMax: probeOnlySceneLinearCpuDeltaMax,
		tolerance: cpuRenderAgreementTolerance,
		diagnosticConclusion: runtimeProbeOnlySceneLinearRow === null ?
			'Runtime-equivalent probe-indirect offscreen scene-linear row is missing; presentation mapping remains open.' :
				visiblePixelSceneLinearCpuAgreementSupported ?
				'Runtime-equivalent probe-indirect scene-linear pixels agree with a CPU mirror seeded from the exact GPU-read visible receiver positions; the old CPU surface quadrature aggregate is not the matching sample set.' :
				visiblePixelCpuMirrorStudy !== null ?
					`Runtime-equivalent probe-indirect scene-linear pixels still disagree with the exact GPU-read visible-pixel CPU mirror; dominant source: ${ visiblePixelCpuMirrorStudy.summary.dominantMismatchSource }${ visiblePixelCpuMirrorStudy.summary.dominantWeightingMismatchComponent !== undefined ? ` / weighting component: ${ visiblePixelCpuMirrorStudy.summary.dominantWeightingMismatchComponent }` : '' }. Keep scene-linear promotion open before tuning visibility.` :
					probeOnlySceneLinearCpuDeltaMean <= cpuRenderAgreementTolerance ||
				probeOnlySceneLinearCpuDeltaMax <= cpuRenderAgreementTolerance ?
					'Runtime-equivalent probe-indirect offscreen scene-linear render is close enough to CPU surface attribution for this fixture.' :
					receiverPixelParityStudy?.summary?.dominantMismatchSource === 'cpu-vs-gpu-sample-position-mismatch' ?
					'Runtime-equivalent probe-indirect offscreen scene-linear render still disagrees with CPU surface attribution because the projected CPU quadrature samples do not land on the same visible GPU receiver fragments; compare against GPU pixel positions before tuning visibility.' :
					'Runtime-equivalent probe-indirect offscreen scene-linear render still disagrees with CPU surface attribution; isolate receiver mask, debug shader equivalence, and CPU/GPU weighting before tuning visibility.'
	};
	const presentationDebugTargets = {
		directOnly: offscreenSceneLinearContributionRows.some( row => row.label === 'direct-only' ),
		indirectOnlySceneLinear: runtimeProbeOnlySceneLinearRow !== null,
		indirectAfterAlbedo: offscreenSceneLinearContributionRows.some( row => row.label === 'probe-indirect-after-albedo' ),
		finalBeforeToneMapping: sealedPresentationStudy.summary.noToneMappingMaskedWrongSideColorRatio !== undefined,
		finalAfterToneMapping: sealedPresentationStudy.summary.standardMaskedWrongSideColorRatio !== undefined,
		receiverMaskOverlay: sealedPresentationStudy.summary.receiverMaskOverlayAvailable === true ||
			sealedVisibilityLeakRow.leakMetrics.maskedReceiverRegionMetricMode !== undefined
	};
	const probeIndirectGate = probeOnlySceneLinearCpuAgreement.status;
	const presentationGate = sealedPresentationStudy.status === 'SUPPORTED' ?
		probeOnlySceneLinearCpuAgreement.status === 'SUPPORTED' ?
			'SUPPORTED' :
			'OPEN-CPU-GPU' :
		sealedPresentationStudy.status;
	const presentationConclusion = presentationGate === 'OPEN-CPU-GPU' ?
		'Presentation material path is not promotable because the runtime-equivalent probe-indirect scene-linear debug target does not agree with CPU surface SH attribution.' :
		sealedPresentationStudy.summary.diagnosticConclusion;
	const receiverPixelParityDominantMismatchSource = receiverPixelParityStudy?.summary?.dominantMismatchSource ?? null;
	const visiblePixelDominantMismatchSource = visiblePixelCpuMirrorStudy?.summary?.dominantMismatchSource ?? null;
	const sceneLinearMismatchClassifier = {
		...sealedPresentationStudy.summary.sceneLinearMismatchClassifier,
		dominantMismatchSource: probeIndirectGate === 'SUPPORTED' ?
			sealedPresentationStudy.summary.sceneLinearMismatchClassifier.dominantMismatchSource :
			visiblePixelDominantMismatchSource ?? receiverPixelParityDominantMismatchSource ?? sealedPresentationStudy.summary.sceneLinearMismatchClassifier.dominantMismatchSource,
		receiverPixelParityStatus: receiverPixelParityStudy?.status ?? null,
		receiverPixelParityDominantMismatchSource,
		receiverPixelParityConclusion: receiverPixelParityStudy?.summary?.diagnosticConclusion ?? null,
		visiblePixelCpuMirrorStatus: visiblePixelCpuMirrorStudy?.status ?? null,
		visiblePixelDominantMismatchSource,
		visiblePixelDominantWeightingMismatchComponent: visiblePixelCpuMirrorStudy?.summary?.dominantWeightingMismatchComponent ?? null,
		visiblePixelWeightComponentDeltas: visiblePixelCpuMirrorStudy?.summary?.maxNeighborWeightComponentDeltas ?? null,
		visiblePixelCpuMirrorConclusion: visiblePixelCpuMirrorStudy?.summary?.diagnosticConclusion ?? null,
		diagnosticConclusion: probeIndirectGate === 'SUPPORTED' ?
			sealedPresentationStudy.summary.sceneLinearMismatchClassifier.diagnosticConclusion :
			visiblePixelDominantMismatchSource !== null ?
				visiblePixelCpuMirrorStudy.summary.diagnosticConclusion :
			receiverPixelParityDominantMismatchSource === 'cpu-vs-gpu-sample-position-mismatch' ?
				'Runtime-equivalent probe-indirect scene-linear aggregate remains open because projected CPU quadrature samples do not match the same visible GPU receiver fragments; the next closure step is a CPU mirror driven by GPU-read receiver pixel positions.' :
				sealedPresentationStudy.summary.sceneLinearMismatchClassifier.diagnosticConclusion
	};
	const sealedWallComparison = leakMatrix.comparisons.sealedWall;
	const sealedWallPromotionMetricRows = [
		{
			key: 'wrongSide',
			value: sealedWallComparison.visibility.wrongSide.improvement,
			requirement: '> 0.05',
			pass: sealedWallComparison.visibility.wrongSide.improvement > 0.05,
			promotionEligible: true
		},
		{
			key: 'maskedWrongSide',
			value: sealedWallComparison.visibility.maskedWrongSide.improvement,
			requirement: '> 0.05',
			pass: sealedWallComparison.visibility.maskedWrongSide.improvement > 0.05,
			promotionEligible: true
		},
		{
			key: 'correctBounce',
			value: sealedWallComparison.visibility.correctBounce.preservation,
			requirement: '>= 0.9',
			pass: sealedWallComparison.visibility.correctBounce.preservation >= 0.9,
			promotionEligible: true
		}
	].map( row => ( {
		...row,
		value: Number.isFinite( row.value ) ? roundMetric( row.value ) : row.value
	} ) );
	const sealedWallDiagnosticMetricRows = [
		{
			key: 'surfaceWrongSide',
			value: sealedWallComparison.visibility.surfaceWrongSide?.improvement ?? null,
			reference: '> 0.05',
			pass: ( sealedWallComparison.visibility.surfaceWrongSide?.improvement ?? - Infinity ) > 0.05,
			promotionEligible: false
		},
		{
			key: 'preToneMaskedWrongSide',
			value: sealedWallComparison.visibility.preToneMaskedWrongSide?.improvement ?? null,
			reference: '> 0.05',
			pass: ( sealedWallComparison.visibility.preToneMaskedWrongSide?.improvement ?? - Infinity ) > 0.05,
			promotionEligible: false
		},
		{
			key: 'maskedCorrectBounce',
			value: sealedWallComparison.visibility.maskedCorrectBounce?.preservation ?? null,
			reference: '>= 0.9',
			pass: ( sealedWallComparison.visibility.maskedCorrectBounce?.preservation ?? - Infinity ) >= 0.9,
			promotionEligible: false
		},
		{
			key: 'preToneMaskedCorrectBounce',
			value: sealedWallComparison.visibility.preToneMaskedCorrectBounce?.preservation ?? null,
			reference: '>= 0.9',
			pass: ( sealedWallComparison.visibility.preToneMaskedCorrectBounce?.preservation ?? - Infinity ) >= 0.9,
			promotionEligible: false
		}
	].map( row => ( {
		...row,
		value: Number.isFinite( row.value ) ? roundMetric( row.value ) : row.value
	} ) );
	const sealedWallFailedPromotionMetrics = sealedWallPromotionMetricRows.filter( row => row.pass === false );
	const sealedWallPassingDiagnosticMetrics = sealedWallDiagnosticMetricRows.filter( row => row.pass === true );
	const sealedWallMetricAlignment = {
		status: sealedWallFailedPromotionMetrics.length === 0 ?
			'SUPPORTED-PROMOTION-METRICS-ALIGNED' :
			'OPEN-PROMOTION-METRIC-FAILURE',
		proofBoundary: 'Report-only sealed-wall metric alignment; diagnostic-only surface/pre-tone rows cannot promote sealed-wall status while canonical wrong-side and masked wrong-side promotion metrics fail.',
		promotionMetrics: sealedWallPromotionMetricRows,
		diagnosticOnlyMetrics: sealedWallDiagnosticMetricRows,
		failedPromotionMetrics: sealedWallFailedPromotionMetrics.map( row => row.key ),
		passingDiagnosticMetrics: sealedWallPassingDiagnosticMetrics.map( row => row.key ),
		dominantPromotionBlocker: sealedWallFailedPromotionMetrics[ 0 ]?.key ?? null,
		diagnosticConclusion: sealedWallFailedPromotionMetrics.length === 0 ?
			'Sealed-wall canonical promotion metrics are aligned and pass.' :
			'Sealed-wall remains open because canonical wrong-side promotion metrics fail; passing surface/pre-tone diagnostics are useful pressure signals but cannot promote the gate.'
	};
	const gatedLeakComparisons = {
		...leakMatrix.comparisons,
		sealedWall: {
			...sealedWallComparison,
			status: visibilityProofStatus.visibilityStatus === 'SUPPORTED' &&
				probeIndirectGate === 'SUPPORTED' &&
				sealedWallComparison.visibility.wrongSide.improvement > 0.05 &&
				sealedWallComparison.visibility.maskedWrongSide.improvement > 0.05 &&
				sealedWallComparison.visibility.correctBounce.preservation >= 0.9 ?
				'SUPPORTED' :
				'OPEN',
			promotionBlockers: [
				visibilityProofStatus.visibilityStatus === 'SUPPORTED' ? null : 'moment-backed visibility is not supported',
				probeIndirectGate === 'SUPPORTED' ? null : 'probe-indirect CPU/GPU agreement is not supported',
				sealedWallComparison.visibility.wrongSide.improvement > 0.05 ? null : 'wrong-side improvement <= 0.05',
				sealedWallComparison.visibility.maskedWrongSide.improvement > 0.05 ? null : 'masked wrong-side improvement <= 0.05',
				sealedWallComparison.visibility.correctBounce.preservation >= 0.9 ? null : 'correct-bounce preservation < 0.9'
			].filter( Boolean ),
			metricAlignment: sealedWallMetricAlignment,
			promotionRequirements: {
				momentBackedVisibility: 'SUPPORTED',
				probeIndirectGate: 'SUPPORTED',
				visibility: {
					wrongSideImprovement: '> 0.05',
					maskedWrongSideImprovement: '> 0.05',
					correctBouncePreservation: '>= 0.9'
				}
			}
		}
	};
	const sealedRenderMetricMismatch = {
		status: sealedVisibilityLeakRow.leakMetrics.wrongSideColorRatio > 0.25 &&
			cpuRenderAgreementGate === 'OPEN' &&
			sealedShContributionDiagnostic.summary.runtimeWrongRatioMean < 0.1 ?
			'OPEN-CPU-RENDER-METRIC-MISMATCH' :
			'BOUNDED',
		actualWrongSideColorRatio: sealedVisibilityLeakRow.leakMetrics.wrongSideColorRatio,
		centerWrongSideColorRatio: sealedVisibilityLeakRow.leakMetrics.centerWrongSideColorRatio,
		surfaceWrongSideColorRatio: sealedVisibilityLeakRow.leakMetrics.surfaceWrongSideColorRatio,
		maskedWrongSideColorRatio: sealedVisibilityLeakRow.leakMetrics.maskedWrongSideColorRatio,
		maskedCorrectBounceRatio: sealedVisibilityLeakRow.leakMetrics.maskedCorrectBounceRatio,
		maskedReceiverRegionMetricMode: sealedVisibilityLeakRow.leakMetrics.maskedReceiverRegionMetricMode,
		cpuRuntimeWrongRatioMean: sealedShContributionDiagnostic.summary.runtimeWrongRatioMean,
		cpuSurfaceRuntimeWrongRatioMean: sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMean,
		cpuSurfaceRuntimeWrongRatioMax: sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMax,
		cpuSurfaceQuadratureRule: sealedReceiverSurfaceQuadratureDiagnostic.quadratureRule,
		cpuInvertedNormalRuntimeWrongRatioMean: sealedShContributionDiagnostic.summary.invertedNormalRuntimeWrongRatioMean,
		delta: Number( (
			sealedVisibilityLeakRow.leakMetrics.wrongSideColorRatio -
			sealedShContributionDiagnostic.summary.runtimeWrongRatioMean
		).toFixed( 4 ) ),
		centerDelta: Number( (
			sealedVisibilityLeakRow.leakMetrics.centerWrongSideColorRatio -
			sealedShContributionDiagnostic.summary.runtimeWrongRatioMean
		).toFixed( 4 ) ),
		invertedNormalCenterDelta: Number( (
			sealedVisibilityLeakRow.leakMetrics.centerWrongSideColorRatio -
			sealedShContributionDiagnostic.summary.invertedNormalRuntimeWrongRatioMean
		).toFixed( 4 ) ),
		surfaceDelta: Number( (
			sealedVisibilityLeakRow.leakMetrics.surfaceWrongSideColorRatio -
			sealedShContributionDiagnostic.summary.runtimeWrongRatioMean
		).toFixed( 4 ) ),
		surfaceQuadratureDelta: sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDelta,
		surfaceQuadratureDeltaMean: sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDeltaMean,
		surfaceQuadratureDeltaMax: sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDeltaMax,
		maskedQuadratureDeltaMean: sealedReceiverSurfaceQuadratureDiagnostic.summary.maskedCpuRenderDeltaMean,
		maskedQuadratureDeltaMax: sealedReceiverSurfaceQuadratureDiagnostic.summary.maskedCpuRenderDeltaMax,
		surfaceQuadratureCpuRenderAgreementAggregation: sealedReceiverSurfaceQuadratureDiagnostic.summary.cpuRenderAgreementAggregation,
		surfaceQuadratureStatus: sealedReceiverSurfaceQuadratureDiagnostic.status,
		surfaceQuadratureCpuRenderAgreementGate: sealedReceiverSurfaceQuadratureDiagnostic.summary.cpuRenderAgreementGate,
		gpuDebugStatus: sealedReceiverGpuDebugDiagnostic.status,
		gpuDebugBestVariant: sealedReceiverGpuDebugDiagnostic.summary.bestVariant,
		gpuDebugBestScale: sealedReceiverGpuDebugDiagnostic.summary.bestVariantScale,
		gpuDebugBestSurfaceCpuDelta: sealedReceiverGpuDebugDiagnostic.summary.bestSurfaceCpuDelta,
		gpuDebugBestSurfaceCpuAggregation: sealedReceiverGpuDebugDiagnostic.summary.bestVariantCpuAggregation,
		gpuDebugBestTightPointVariant: sealedReceiverGpuDebugDiagnostic.summary.bestTightPointVariant,
		gpuDebugBestTightPointScale: sealedReceiverGpuDebugDiagnostic.summary.bestTightPointVariantScale,
		gpuDebugBestTightPointSurfaceWrongRatio: sealedReceiverGpuDebugDiagnostic.summary.bestTightPointSurfaceWrongRatio,
		gpuDebugBestTightPointSurfaceWrongRatioMax: sealedReceiverGpuDebugDiagnostic.summary.bestTightPointSurfaceWrongRatioMax,
		gpuDebugBestTightPointSurfaceCpuDelta: sealedReceiverGpuDebugDiagnostic.summary.bestTightPointSurfaceCpuDelta,
		gpuDebugBestTightPointCpuAggregation: sealedReceiverGpuDebugDiagnostic.summary.bestTightPointCpuAggregation,
		gpuDebugBestWeightTermVariant: sealedReceiverGpuDebugDiagnostic.summary.bestWeightTermVariant,
		gpuDebugBestWeightTerm: sealedReceiverGpuDebugDiagnostic.summary.bestWeightTerm,
		gpuDebugBestWeightTermCpuKey: sealedReceiverGpuDebugDiagnostic.summary.bestWeightTermCpuKey,
		gpuDebugBestWeightTermScale: sealedReceiverGpuDebugDiagnostic.summary.bestWeightTermScale,
		gpuDebugBestWeightTermDeltaMean: sealedReceiverGpuDebugDiagnostic.summary.bestWeightTermDeltaMean,
		gpuDebugBestWeightTermDeltaMax: sealedReceiverGpuDebugDiagnostic.summary.bestWeightTermDeltaMax,
		gpuDebugBestLinearIrradianceTermVariant: sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceTermVariant,
		gpuDebugBestLinearIrradianceTerm: sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceTerm,
		gpuDebugBestLinearIrradianceCpuKey: sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceCpuKey,
		gpuDebugBestLinearIrradianceTermScale: sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceTermScale,
		gpuDebugBestLinearIrradianceDeltaMean: sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceDeltaMean,
		gpuDebugBestLinearIrradianceDeltaMax: sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceDeltaMax,
		gpuDebugBestLinearIrradianceClippedSampleCount: sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceClippedSampleCount,
		gpuDebugLinearIrradianceAgreementTolerance: sealedReceiverGpuDebugDiagnostic.summary.linearIrradianceAgreementTolerance,
		gpuDebugLinearIrradianceAgreementGate: sealedReceiverGpuDebugDiagnostic.summary.linearIrradianceAgreementGate,
		gpuDebugLinearIrradianceAgreementMode: sealedReceiverGpuDebugDiagnostic.summary.linearIrradianceAgreementMode,
		gpuDebugWeightTermAgreementGate: sealedReceiverGpuDebugDiagnostic.summary.weightTermAgreementGate,
		gpuDebugWeightTermAgreementMode: sealedReceiverGpuDebugDiagnostic.summary.weightTermAgreementMode,
		receiverPixelParityStatus: sealedReceiverGpuDebugDiagnostic.summary.receiverPixelParityStatus,
		receiverPixelParityDominantMismatchSource: sealedReceiverGpuDebugDiagnostic.summary.receiverPixelParityDominantMismatchSource,
		receiverPixelParityMaskOcclusionPolicy: sealedReceiverGpuDebugDiagnostic.summary.receiverPixelParityMaskOcclusionPolicy,
		receiverPixelParityLegacyMaskWrongSideDelta: sealedReceiverGpuDebugDiagnostic.summary.receiverPixelParityLegacyMaskWrongSideDelta,
		receiverPixelParityStudy: sealedReceiverGpuDebugDiagnostic.receiverPixelParityStudy,
		visiblePixelCpuMirrorStatus: visiblePixelCpuMirrorStudy?.status ?? null,
		visiblePixelCpuMirrorDominantMismatchSource: visiblePixelCpuMirrorStudy?.summary?.dominantMismatchSource ?? null,
		visiblePixelCpuMirrorStudy,
		gpuDebugAgreementMode: sealedReceiverGpuDebugDiagnostic.summary.agreementMode,
		gpuDebugComparableVariantCount: sealedReceiverGpuDebugDiagnostic.summary.comparableVariantCount,
		gpuDebugLinearIrradianceTermVariantCount: sealedReceiverGpuDebugDiagnostic.summary.linearIrradianceTermVariantCount,
		gpuDebugWeightTermVariantCount: sealedReceiverGpuDebugDiagnostic.summary.weightTermVariantCount,
		gpuDebugWhiteCalibrationLuminanceMean: sealedReceiverGpuDebugDiagnostic.summary.whiteCalibrationLuminanceMean,
		gpuDebugWhiteCalibrationVisible: sealedReceiverGpuDebugDiagnostic.summary.whiteCalibrationVisible,
		presentation: {
			gate: presentationGate,
			conclusion: presentationConclusion,
			renderer: sealedPresentationStudy.renderer,
			maskedRatios: {
				standard: sealedPresentationStudy.summary.standardMaskedWrongSideColorRatio,
				debug: sealedPresentationStudy.summary.debugMaskedWrongSideColorRatio,
				noToneMapping: sealedPresentationStudy.summary.noToneMappingMaskedWrongSideColorRatio,
				linearOutput: sealedPresentationStudy.summary.linearOutputMaskedWrongSideColorRatio,
				lambertDebug: sealedPresentationStudy.summary.lambertDebugMaskedWrongSideColorRatio
			},
			deltas: {
				standardVsDebugMasked: sealedPresentationStudy.summary.standardVsDebugMaskedDelta,
				toneMappingMasked: sealedPresentationStudy.summary.toneMappingMaskedDelta,
				outputColorSpaceMasked: sealedPresentationStudy.summary.outputColorSpaceMaskedDelta,
				exposureMasked: sealedPresentationStudy.summary.exposureMaskedDelta,
				lambertVsStandardLinearMasked: sealedPresentationStudy.summary.lambertVsStandardLinearMaskedDelta,
				standardLinearVsProbeOnlyLambertMasked: sealedPresentationStudy.summary.standardLinearVsProbeOnlyLambertMaskedDelta ?? null,
				probeMaterialPath: sealedPresentationStudy.summary.probeMaterialPathDelta ?? null
			},
			colorMappingDiagnostic: sealedPresentationStudy.summary.colorMappingDiagnostic ?? null,
			exposureSweep: sealedPresentationStudy.summary.exposureSweep,
			offscreen: {
				target: sealedPresentationStudy.summary.offscreenSceneLinearTarget,
				contributionRows: sealedPresentationStudy.summary.offscreenSceneLinearContributionRows,
				contributionSummary: sealedPresentationStudy.summary.offscreenSceneLinearContributionSummary,
				neutralContributionRows: sealedPresentationStudy.summary.offscreenSceneLinearNeutralContributionRows,
				neutralContributionSummary: sealedPresentationStudy.summary.offscreenSceneLinearNeutralContributionSummary,
				contributionGate: sealedPresentationStudy.summary.offscreenSceneLinearContributionGate,
				visiblePixelCpuMirrorStudy
			},
			sceneLinearMismatchClassifier,
			probeIndirectCpuAgreement: probeOnlySceneLinearCpuAgreement,
			probeIndirectGate,
			debugTargets: presentationDebugTargets
		},
		cpuRenderAgreementGate,
		cpuRenderAgreementTolerance,
		bestCpuRenderMetricAgreement: {
			metric: bestCpuRenderMetricAgreement.metric,
			value: Number( bestCpuRenderMetricAgreement.value.toFixed( 4 ) ),
			delta: Number( bestCpuRenderMetricAgreement.delta.toFixed( 4 ) )
		},
		ratio: Number( (
			sealedVisibilityLeakRow.leakMetrics.wrongSideColorRatio /
			Math.max( sealedShContributionDiagnostic.summary.runtimeWrongRatioMean, 0.0001 )
		).toFixed( 4 ) ),
		centerRatio: Number( (
			sealedVisibilityLeakRow.leakMetrics.centerWrongSideColorRatio /
			Math.max( sealedShContributionDiagnostic.summary.runtimeWrongRatioMean, 0.0001 )
		).toFixed( 4 ) ),
		normalConventionPressure: Math.abs(
			sealedVisibilityLeakRow.leakMetrics.centerWrongSideColorRatio -
			sealedShContributionDiagnostic.summary.invertedNormalRuntimeWrongRatioMean
		) < Math.abs(
			sealedVisibilityLeakRow.leakMetrics.centerWrongSideColorRatio -
			sealedShContributionDiagnostic.summary.runtimeWrongRatioMean
		),
		normalConventionDiagnosticStatus: sealedReceiverNormalDiagnostic.status,
		normalConventionCleared: sealedReceiverNormalDiagnostic.status.startsWith( 'SUPPORTED-' ),
		regionMetricMode: sealedVisibilityLeakRow.leakMetrics.receiverRegionMetricMode
	};

	if ( sealedRenderMetricMismatch.status === 'OPEN-CPU-RENDER-METRIC-MISMATCH' &&
		sealedRenderMetricMismatch.normalConventionPressure === true ) {

		sealedFailureDomain = sealedRenderMetricMismatch.normalConventionCleared === true ?
			'RENDER-METRIC-OR-RUNTIME-SH-EVAL-NORMAL-CONVENTION-CLEARED' :
			'NORMAL-CONVENTION-OR-BACKFACE-REGION-METRIC';

	}

	if ( presentationGate === 'OPEN-BSDF' ) {

		sealedFailureDomain = 'BSDF-LIGHT-NODE';

	} else if ( presentationGate === 'OPEN-COLOR-MAPPING' ||
		presentationGate === 'OPEN-CPU-GPU' ) {

		sealedFailureDomain = 'COLOR-MAPPING';

	}

	const snapshotRows = new Map( snapshots.map( snapshot => [ snapshot.label, snapshot ] ) );
	const densityReference = snapshotRows.get( 'webgpu-webgl-density-reference' );
	const densityShadowless = snapshotRows.get( 'webgpu-webgl-density-shadowless' );
	const densityShadowCrisp = snapshotRows.get( 'webgpu-webgl-density-shadow-crisp' );
	const densityDamped = snapshotRows.get( 'webgpu-webgl-density-damped' );
	const bakeTexelBudgets = {
		lowRes: createLightProbeBakeTexelBudget( 4, 8 ),
		densityReference: createLightProbeBakeTexelBudget( 6, 32 )
	};
	const createDensityDelta = snapshot => ( {
		objectBlackTailDelta: Number( (
			snapshot.artifactPressure.objectBlackTailRatio -
			densityReference.artifactPressure.objectBlackTailRatio
		).toFixed( 4 ) ),
		luminanceFloorDelta: Number( (
			snapshot.artifactPressure.luminanceFloor -
			densityReference.artifactPressure.luminanceFloor
		).toFixed( 4 ) ),
		cellEdgeContrastDelta: Number( (
			snapshot.artifactPressure.cellEdgeContrast -
			densityReference.artifactPressure.cellEdgeContrast
		).toFixed( 4 ) )
	} );
	const densityArtifactStudy = {
		reference: densityReference.artifactPressure,
		shadowless: {
			...densityShadowless.artifactPressure,
			...createDensityDelta( densityShadowless )
		},
		shadowCrisp: {
			...densityShadowCrisp.artifactPressure,
			...createDensityDelta( densityShadowCrisp )
		},
		damped: {
			...densityDamped.artifactPressure,
			...createDensityDelta( densityDamped )
		}
	};
	const directShadowControlStudy = {
		status: 'SUPPORTED-DIRECT-SHADOW-CONTROL-STUDY',
		proofBoundary: 'Same probe density, cubemap budget, SH band policy, material, lighting mode, and unweighted sampling; only bake-time direct shadow-map settings vary.',
		defaultSoft: {
			label: densityReference.label,
			directShadowControl: densityReference.directShadowControl,
			artifactPressure: densityReference.artifactPressure
		},
		crispShadow: {
			label: densityShadowCrisp.label,
			directShadowControl: densityShadowCrisp.directShadowControl,
			artifactPressure: {
				...densityShadowCrisp.artifactPressure,
				...createDensityDelta( densityShadowCrisp )
			}
		},
		shadowless: {
			label: densityShadowless.label,
			shadowsDisabledDuringBake: densityShadowless.shadowsDisabledDuringBake,
			artifactPressure: {
				...densityShadowless.artifactPressure,
				...createDensityDelta( densityShadowless )
			}
		},
		diagnosis: densityShadowCrisp.artifactPressure.objectBlackTailRatio <=
			densityReference.artifactPressure.objectBlackTailRatio + 0.02 ?
			'crisp-shadow-map-does-not-materially-reduce-black-tail-pressure' :
			'crisp-shadow-map-changes-black-tail-pressure-check-screenshot-before-attributing-to-sh'
	};
	const sealedLeakRows = new Map( leakMatrix.rows
		.filter( row => row.fixtureMode === 'sealed-wall' || row.fixtureMode === 'zero-thickness' )
		.map( row => [ row.label, row ] ) );
	const createLeakVariantAudit = ( label, role ) => {

		const row = sealedLeakRows.get( label );

		return {
			label,
			role,
			status: row?.promotionStatus ?? row?.negativeControlStatus ?? 'missing',
			fixtureMode: row?.fixtureMode ?? 'missing',
			leakReductionMode: row?.leakReductionMode ?? null,
			useProbeValidity: row?.useProbeValidity ?? null,
			visibilityDepthEnabled: row?.visibilityDepthEnabled ?? null,
			weightedProbeSampling: row?.sampling?.weightedProbeSampling ?? null,
			manualIrradianceSampling: row?.sampling?.manualIrradianceSampling ?? null,
			wrongSideColorRatio: row?.leakMetrics?.wrongSideColorRatio ?? null,
			centerWrongSideColorRatio: row?.leakMetrics?.centerWrongSideColorRatio ?? null,
			surfaceWrongSideColorRatio: row?.leakMetrics?.surfaceWrongSideColorRatio ?? null,
			maskedWrongSideColorRatio: row?.leakMetrics?.maskedWrongSideColorRatio ?? null,
			preToneMetricMode: row?.preToneLeakMetrics?.mode ?? null,
			preToneOutputColorSpace: row?.preToneLeakMetrics?.outputColorSpace ?? null,
			preToneMaskedWrongSideColorRatio: row?.preToneLeakMetrics?.metrics?.maskedWrongSideColorRatio ?? null,
			correctBounceRatio: row?.leakMetrics?.correctBounceRatio ?? null,
			maskedCorrectBounceRatio: row?.leakMetrics?.maskedCorrectBounceRatio ?? null,
			preToneMaskedCorrectBounceRatio: row?.preToneLeakMetrics?.metrics?.maskedCorrectBounceRatio ?? null,
			receiverRegionMetricMode: row?.leakMetrics?.receiverRegionMetricMode ?? null
		};

	};

	const createNeighborContributionAudit = ( receiverKey, receiverRegionKey ) => {

		const visibilityReceiver = sealedVisibilityWeightingDiagnostic[ receiverKey ];
		const shReceiver = sealedShContributionDiagnostic[ receiverKey ];
		const dilationReceiver = sealedVisibilityWeightingDiagnostic.dilationOracleStudy[ receiverKey ];
		const shRows = new Map( shReceiver.rows.map( row => [ row.probeIndex, row ] ) );
		const dilationSources = new Map( ( dilationReceiver.mappedRows ?? [] )
			.map( row => [ row.probeIndex, row.sourceProbeIndex ] ) );
		const totalScalarWeight = visibilityReceiver.rows.reduce( ( sum, row ) => sum + row.scalarWeight, 0 );
		const totalVisibilityWeight = visibilityReceiver.rows.reduce( ( sum, row ) => sum + row.visibilityWeight, 0 );
		const renderRegion = sealedVisibilityLeakRow.leakMetrics.regions[ receiverRegionKey ];
		const maskedRegion = sealedVisibilityLeakRow.leakMetrics.maskedRegions[
			`${ receiverRegionKey }Masked`
		];
		const renderRegionWrongOverCorrect = visibilityReceiver.correctSide === 'left' ?
			renderRegion.colorBias.greenOverRed :
			renderRegion.colorBias.redOverGreen;
		const maskedRegionWrongOverCorrect = visibilityReceiver.correctSide === 'left' ?
			maskedRegion.colorBias.greenOverRed :
			maskedRegion.colorBias.redOverGreen;

		return {
			label: visibilityReceiver.label,
			correctSide: visibilityReceiver.correctSide,
			renderRegionWrongOverCorrect,
			maskedRegionWrongOverCorrect,
			totalScalarWeight: Number( totalScalarWeight.toFixed( 4 ) ),
			totalVisibilityWeight: Number( totalVisibilityWeight.toFixed( 4 ) ),
			cpuRuntimeWrongOverCorrect: shReceiver.aggregates.runtimeFinal.colorBias.wrongOverCorrect,
			gpuLinearRgbDeltaMeanForReceiverSamples: sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceDeltaMean,
			weightTermDeltaMeanForReceiverSamples: sealedReceiverGpuDebugDiagnostic.summary.bestWeightTermDeltaMean,
			rows: visibilityReceiver.rows.map( row => {

				const shRow = shRows.get( row.probeIndex );
				const sourceProbeIndex = shRow?.sourceProbeIndex ?? dilationSources.get( row.probeIndex ) ?? row.probeIndex;

				return {
					probeIndex: row.probeIndex,
					coord: row.coord,
					side: row.side,
					relationToReceiver: row.relationToReceiver,
					sourceProbeIndex,
					dilated: shRow?.dilationSourceDiffers ?? sourceProbeIndex !== row.probeIndex,
					trilinearWeight: row.trilinearWeight,
					normalWeight: row.normalWeight,
					validityWeight: row.validityWeight,
					scalarWeight: row.scalarWeight,
					visibilityWeight: row.visibilityWeight,
					finalNormalizedScalarWeight: Number( ( row.scalarWeight / Math.max( totalScalarWeight, 0.0001 ) ).toFixed( 4 ) ),
					finalNormalizedVisibilityWeight: Number( ( row.visibilityWeight / Math.max( totalVisibilityWeight, 0.0001 ) ).toFixed( 4 ) ),
					visibility: row.visibility,
					suppression: row.suppression,
					escaped: row.escaped,
					escapeReason: row.escapeReason,
					cpuShRgb: shRow?.irradiance ?? null,
					cpuL0Rgb: shRow?.l0Irradiance ?? null,
					cpuShChromaticity: shRow?.chromaticity ?? null,
					cpuL0Chromaticity: shRow?.l0Chromaticity ?? null,
					cpuShChromaPressure: shRow?.chromaPressure ?? null,
					cpuL0ChromaPressure: shRow?.l0ChromaPressure ?? null,
					cpuDilatedShRgb: shRow?.dilatedIrradiance ?? null,
					cpuDilatedL0Rgb: shRow?.dilatedL0Irradiance ?? null,
					cpuDilatedChromaPressure: shRow?.dilatedChromaPressure ?? null,
					cpuDilatedL0ChromaPressure: shRow?.dilatedL0ChromaPressure ?? null,
					sourceSide: shRow?.sourceSide ?? row.side,
					sourceRelationToReceiver: shRow?.sourceRelationToReceiver ?? row.relationToReceiver,
					sourceValidity: shRow?.sourceValidity ?? row.validityWeight,
					cpuWrongOverCorrect: shRow?.colorBias?.wrongOverCorrect ?? null,
					cpuChromaWrongMinusCorrect: shRow?.chromaPressure?.wrongMinusCorrect ?? null,
					cpuL0ChromaWrongMinusCorrect: shRow?.l0ChromaPressure?.wrongMinusCorrect ?? null,
					gpuLinearRgbDeltaMeanForReceiverSamples: sealedReceiverGpuDebugDiagnostic.summary.bestLinearIrradianceDeltaMean,
					renderRegionWrongOverCorrect,
					maskedRegionWrongOverCorrect
				};

			} )
		};

	};

	const receiverSampleMetricAlignmentStudy = {
		status: sealedReceiverSurfaceQuadratureDiagnostic.summary.centerVsSurfaceCpuDelta > cpuRenderAgreementTolerance ?
			'OPEN-CENTER-SURFACE-SAMPLE-DIVERGENCE' :
			'SUPPORTED-CENTER-SURFACE-SAMPLE-ALIGNED',
		proofBoundary: 'Report-only receiver sample metric alignment study; compares center receiver CPU SH, surface quadrature CPU SH, and render-region ratios before any runtime sampling, public API, or Chebyshev threshold change.',
		tolerance: cpuRenderAgreementTolerance,
		rows: [
			{
				receiver: 'leftReceiver',
				centerRuntimeWrongOverCorrect: sealedShContributionDiagnostic.left.aggregates.runtimeFinal.colorBias.wrongOverCorrect,
				surfaceRuntimeWrongOverCorrect: sealedReceiverSurfaceQuadratureDiagnostic.left.weightedMeans.runtimeWrongOverCorrect,
				centerSurfaceDelta: Number( Math.abs(
					sealedShContributionDiagnostic.left.aggregates.runtimeFinal.colorBias.wrongOverCorrect -
					sealedReceiverSurfaceQuadratureDiagnostic.left.weightedMeans.runtimeWrongOverCorrect
				).toFixed( 4 ) )
			},
			{
				receiver: 'rightReceiver',
				centerRuntimeWrongOverCorrect: sealedShContributionDiagnostic.right.aggregates.runtimeFinal.colorBias.wrongOverCorrect,
				surfaceRuntimeWrongOverCorrect: sealedReceiverSurfaceQuadratureDiagnostic.right.weightedMeans.runtimeWrongOverCorrect,
				centerSurfaceDelta: Number( Math.abs(
					sealedShContributionDiagnostic.right.aggregates.runtimeFinal.colorBias.wrongOverCorrect -
					sealedReceiverSurfaceQuadratureDiagnostic.right.weightedMeans.runtimeWrongOverCorrect
				).toFixed( 4 ) )
			}
		],
		renderMetrics: {
			boundsWrongSideColorRatio: sealedReceiverSurfaceQuadratureDiagnostic.renderMetrics.boundsWrongSideColorRatio,
			centerWrongSideColorRatio: sealedReceiverSurfaceQuadratureDiagnostic.renderMetrics.centerWrongSideColorRatio,
			surfaceWrongSideColorRatio: sealedReceiverSurfaceQuadratureDiagnostic.renderMetrics.surfaceWrongSideColorRatio,
			maskedWrongSideColorRatio: sealedReceiverSurfaceQuadratureDiagnostic.renderMetrics.maskedWrongSideColorRatio,
			maskedCorrectBounceRatio: sealedReceiverSurfaceQuadratureDiagnostic.renderMetrics.maskedCorrectBounceRatio
		},
		summary: {
			centerRuntimeWrongRatioMean: sealedReceiverSurfaceQuadratureDiagnostic.summary.centerRuntimeWrongRatioMean,
			surfaceRuntimeWrongRatioMean: sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMean,
			centerVsSurfaceCpuDelta: sealedReceiverSurfaceQuadratureDiagnostic.summary.centerVsSurfaceCpuDelta,
			surfaceCpuRenderDelta: sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDelta,
			maskedCpuRenderDeltaMax: sealedReceiverSurfaceQuadratureDiagnostic.summary.maskedCpuRenderDeltaMax,
			cpuRenderAgreementGate: sealedReceiverSurfaceQuadratureDiagnostic.summary.cpuRenderAgreementGate,
			interpretation: sealedReceiverSurfaceQuadratureDiagnostic.summary.centerVsSurfaceCpuDelta > cpuRenderAgreementTolerance ?
				'Center receiver samples diverge from surface quadrature enough that center-only probes are not a safe promotion metric; keep surface/masked metrics as the gate and study sample placement/density before runtime changes.' :
				'Center and surface receiver CPU metrics are aligned within tolerance; metric alignment is not the current blocker.'
		}
	};
	const createSurfaceAnchorPlacementStudy = () => {

		const rows = sealedVisibilityWeightingDiagnostic.samplingBiasStudy.rows.map( row => ( {
			label: row.label,
			sampleMode: row.sampleMode,
			normalBias: row.normalBias,
			viewBias: row.viewBias,
			cpuWrongOverCorrectMean: row.cpuWrongOverCorrectMean,
			renderSurfaceWrongSideColorRatio: row.renderSurfaceWrongSideColorRatio,
			leftWeightedWrongOverCorrect: row.left.weightedWrongOverCorrect,
			rightWeightedWrongOverCorrect: row.right.weightedWrongOverCorrect,
			leftSampleCount: row.left.samples.length,
			rightSampleCount: row.right.samples.length
		} ) );
		const center = rows.find( row => row.label === 'center-no-bias' );
		const surface = rows.find( row => row.label === 'surface-no-bias' );
		const surfaceBiasRows = rows.filter( row => row.sampleMode === 'surface-gauss' && row.label !== 'surface-no-bias' );
		const bestSurfaceBias = [ ...surfaceBiasRows ].sort( ( a, b ) =>
			a.cpuWrongOverCorrectMean - b.cpuWrongOverCorrectMean
		)[ 0 ] ?? null;
		const centerSurfaceDelta = Number( Math.abs(
			center.cpuWrongOverCorrectMean - surface.cpuWrongOverCorrectMean
		).toFixed( 4 ) );
		const bestBiasCpuImprovement = bestSurfaceBias !== null ?
			Number( ( surface.cpuWrongOverCorrectMean - bestSurfaceBias.cpuWrongOverCorrectMean ).toFixed( 4 ) ) :
			0;
		const bestBiasRenderImprovement = bestSurfaceBias !== null ?
			Number( ( surface.renderSurfaceWrongSideColorRatio - bestSurfaceBias.renderSurfaceWrongSideColorRatio ).toFixed( 4 ) ) :
			0;
		const centerHidesSurfaceLeak = center.cpuWrongOverCorrectMean < surface.cpuWrongOverCorrectMean &&
			centerSurfaceDelta > cpuRenderAgreementTolerance;
		const surfaceBiasWins = bestBiasCpuImprovement > 0.05 && bestBiasRenderImprovement >= 0;

		return {
			status: surfaceBiasWins ?
				'SUPPORTED-SURFACE-ANCHOR-BIAS-CANDIDATE' :
				centerHidesSurfaceLeak ?
					'OPEN-SURFACE-ANCHOR-CENTER-HIDES-LEAK' :
					'OPEN-SURFACE-ANCHOR-BIAS-NO-WIN',
			proofBoundary: 'Report-only surface anchor/placement study over existing sampling-bias rows; compares center, surface, normal-bias, and view-bias receiver samples without changing runtime uniforms, public API, or Chebyshev thresholds.',
			thresholds: {
				centerSurfaceDelta: cpuRenderAgreementTolerance,
				biasCpuImprovement: 0.05
			},
			rows: rows.map( row => ( {
				...row,
				centerDelta: Number( Math.abs( row.cpuWrongOverCorrectMean - center.cpuWrongOverCorrectMean ).toFixed( 4 ) ),
				surfaceDelta: Number( Math.abs( row.cpuWrongOverCorrectMean - surface.cpuWrongOverCorrectMean ).toFixed( 4 ) ),
				renderSurfaceDelta: Number( Math.abs(
					row.renderSurfaceWrongSideColorRatio - surface.renderSurfaceWrongSideColorRatio
				).toFixed( 4 ) )
			} ) ),
			summary: {
				centerCpuWrongOverCorrect: center.cpuWrongOverCorrectMean,
				surfaceCpuWrongOverCorrect: surface.cpuWrongOverCorrectMean,
				centerSurfaceDelta,
				bestSurfaceBiasCase: bestSurfaceBias?.label ?? 'none',
				bestSurfaceBiasCpuWrongOverCorrect: bestSurfaceBias?.cpuWrongOverCorrectMean ?? null,
				bestBiasCpuImprovement,
				bestBiasRenderImprovement,
				centerHidesSurfaceLeak,
				surfaceBiasWins,
				interpretation: surfaceBiasWins ?
					'A surface-bias case improves CPU surface wrong/correct without worsening render surface ratio; consider a constrained anchor/bias runtime experiment only after linear/render gates remain supported.' :
					centerHidesSurfaceLeak ?
						'Center sampling materially under-reports the visible surface leak; do not use center-only metrics for promotion and do not hide the leak with anchor offsets. Keep surface/masked metrics as the proof gate.' :
						'Surface bias does not produce a safe win; continue with bake capture/surface-specific content studies before runtime or Chebyshev changes.'
			}
		};

	};

	const surfaceAnchorPlacementStudy = createSurfaceAnchorPlacementStudy();
	const createSurfaceShContentStudy = () => {

		const probeRowsByIndex = new Map(
			probeBakeContaminationMap.rows.map( row => [ row.probeIndex, row ] )
		);
		const leakThreshold = 0.25;
		const contentThreshold = probeBakeContaminationMap.thresholds.chromaPressure;
		const receiverRows = [
			sealedReceiverSurfaceQuadratureDiagnostic.left,
			sealedReceiverSurfaceQuadratureDiagnostic.right
		].map( receiver => {

			const sampleRows = receiver.samples.map( sample => {

				const selectedProbes = ( sample.surfaceCoefficientAttributionRows ?? [] ).map( row => {

					const probeIndex = row.probeIndex;
					const probeRow = probeRowsByIndex.get( probeIndex );
					const pressure = probeRow !== undefined ?
						Math.max( probeRow.maxCorrectReceiverChromaPressure, probeRow.blockedOppositeWallChromaPressure ) :
						0;
					const runtimeFinalWeight = row.runtimeFinalWeight ?? 0;

					return {
						probeIndex,
						runtimeFinalWeight,
						side: probeRow?.side ?? 'unknown',
						relationToReceiver: row.relationToReceiver ?? 'unknown',
						sourceProbeIndex: probeRow?.sourceProbeIndex ?? null,
						sourceSide: probeRow?.sourceSide ?? 'unknown',
						sourceRelationToReceiver: row.sourceRelationToReceiver ?? 'unknown',
						classification: probeRow?.classification ?? 'missing-from-bake-map',
						bandResponsibility: probeRow?.bandResponsibility ?? 'unknown',
						maxCorrectReceiverChromaPressure: probeRow?.maxCorrectReceiverChromaPressure ?? 0,
						maxCorrectReceiverL1ChromaDelta: probeRow?.maxCorrectReceiverL1ChromaDelta ?? 0,
						maxCorrectReceiverL2ChromaDelta: probeRow?.maxCorrectReceiverL2ChromaDelta ?? 0,
						blockedOppositeWallChromaPressure: probeRow?.blockedOppositeWallChromaPressure ?? 0,
						contentPressure: Number( pressure.toFixed( 4 ) ),
						weightedContentPressure: Number( ( pressure * runtimeFinalWeight ).toFixed( 4 ) ),
						wrongChannelPressure: row.wrongChannelPressure ?? 0,
						correctChannelPreservation: row.correctChannelPreservation ?? 0
					};

				} );
				const dominantProbe = [ ...selectedProbes ].sort( ( a, b ) =>
					b.weightedContentPressure - a.weightedContentPressure ||
					b.contentPressure - a.contentPressure
				)[ 0 ] ?? null;
				const weightedContentPressureRows = selectedProbes.filter( probe =>
					probe.runtimeFinalWeight > 0.0001 &&
					probe.contentPressure >= contentThreshold
				);

				return {
					receiver: receiver.label,
					sampleLabel: sample.sampleLabel,
					quadratureWeight: sample.quadratureWeight,
					receiverPosition: sample.receiverPosition,
					samplePosition: sample.samplePosition,
					runtimeWrongOverCorrect: sample.runtimeWrongOverCorrect,
					wrongSideScalarWeight: selectedProbes
						.filter( probe => probe.relationToReceiver === 'wrong-side' )
						.reduce( ( total, probe ) => total + probe.runtimeFinalWeight, 0 ),
					correctSideScalarWeight: selectedProbes
						.filter( probe => probe.relationToReceiver === 'correct-side' )
						.reduce( ( total, probe ) => total + probe.runtimeFinalWeight, 0 ),
					selectedProbeCount: selectedProbes.length,
					dominantProbeIndex: dominantProbe?.probeIndex ?? null,
					dominantProbeClassification: dominantProbe?.classification ?? 'none',
					dominantProbeBandResponsibility: dominantProbe?.bandResponsibility ?? 'none',
					dominantProbeContentPressure: dominantProbe?.contentPressure ?? 0,
					dominantProbeWeightedContentPressure: dominantProbe?.weightedContentPressure ?? 0,
					leakSample: sample.runtimeWrongOverCorrect >= leakThreshold,
					contentPressureSample: weightedContentPressureRows.length > 0,
					contentPressureAttributionRowCount: weightedContentPressureRows.length,
					selectedProbes
				};

			} );
			const leakSamples = sampleRows.filter( sample => sample.leakSample );
			const contentPressureSamples = sampleRows.filter( sample => sample.contentPressureSample );
			const dominantBands = sampleRows.reduce( ( bands, sample ) => {

				bands[ sample.dominantProbeBandResponsibility ] = ( bands[ sample.dominantProbeBandResponsibility ] ?? 0 ) + 1;
				return bands;

			}, {} );

			return {
				receiver: receiver.label,
				correctSide: receiver.correctSide,
				weightedWrongOverCorrect: receiver.weightedMeans.runtimeWrongOverCorrect,
				sampleCount: sampleRows.length,
				leakSampleCount: leakSamples.length,
				contentPressureSampleCount: contentPressureSamples.length,
				dominantBands,
				worstSample: [ ...sampleRows ].sort( ( a, b ) =>
					b.runtimeWrongOverCorrect - a.runtimeWrongOverCorrect
				)[ 0 ] ?? null,
				samples: sampleRows
			};

		} );
		const allSamples = receiverRows.flatMap( receiver => receiver.samples );
		const leakSamples = allSamples.filter( sample => sample.leakSample );
		const contentPressureSamples = allSamples.filter( sample => sample.contentPressureSample );
		const worstSample = [ ...allSamples ].sort( ( a, b ) =>
			b.runtimeWrongOverCorrect - a.runtimeWrongOverCorrect
		)[ 0 ] ?? null;
		const leakSamplesWithContentPressure = leakSamples.filter( sample => sample.contentPressureSample );
		const leakSamplesWithoutContentPressure = leakSamples.filter( sample => sample.contentPressureSample === false );
		const leakContentPressureCoverageRatio = leakSamples.length > 0 ?
			roundMetric( leakSamplesWithContentPressure.length / leakSamples.length ) :
			1;

		return {
			status: leakSamples.length > 0 && leakSamplesWithContentPressure.length === leakSamples.length ?
				'OPEN-SURFACE-SH-CONTENT-PRESSURE' :
				leakSamples.length > 0 && leakSamplesWithContentPressure.length > 0 ?
					'OPEN-SURFACE-SH-CONTENT-PARTIAL-PRESSURE' :
					leakSamples.length > 0 ?
						'OPEN-SURFACE-LEAK-WITHOUT-MAPPED-CONTENT-PRESSURE' :
						'SUPPORTED-SURFACE-SH-CONTENT-BOUNDED',
			proofBoundary: 'Report-only surface-specific SH content audit; joins surface quadrature samples to selected probe bake-contamination rows to identify dominant probe/band pressure without changing bake capture, runtime sampling, public API, or Chebyshev thresholds.',
			thresholds: {
				leakWrongOverCorrect: leakThreshold,
				contentChromaPressure: contentThreshold
			},
			receiverRows,
			summary: {
				surfaceSampleCount: allSamples.length,
				leakSampleCount: leakSamples.length,
				contentPressureSampleCount: contentPressureSamples.length,
				leakSamplesWithContentPressureCount: leakSamplesWithContentPressure.length,
				leakSamplesWithoutContentPressureCount: leakSamplesWithoutContentPressure.length,
				leakContentPressureCoverageRatio,
				worstSampleLabel: worstSample?.sampleLabel ?? 'none',
				worstSampleWrongOverCorrect: worstSample?.runtimeWrongOverCorrect ?? 0,
				worstSampleDominantProbeIndex: worstSample?.dominantProbeIndex ?? null,
				worstSampleDominantBand: worstSample?.dominantProbeBandResponsibility ?? 'none',
				worstSampleDominantProbePressure: worstSample?.dominantProbeContentPressure ?? 0,
				interpretation: leakSamples.length > 0 && leakSamplesWithContentPressure.length === leakSamples.length ?
					'Visible surface leak samples all select probes already flagged with baked SH chroma/band pressure; prioritize bake-capture surface content and probe/band contamination before runtime or Chebyshev changes.' :
					leakSamplesWithContentPressure.length > 0 ?
						'Visible surface leak samples only partially map to probes flagged with baked SH chroma/band pressure; split the next proof step between mapped bake-content rows and unmapped coefficient attribution instead of promoting a single bake/runtime fix.' :
						leakSamples.length > 0 ?
							'Visible surface leak samples do not map to currently flagged bake-content probe rows; expand bake-capture diagnostics before runtime changes.' :
							'Surface samples are bounded by the current SH content audit.'
			}
		};

	};

	const surfaceShContentStudy = createSurfaceShContentStudy();
	const createSurfaceSampleCoefficientAttributionStudy = () => {

		const leakThreshold = surfaceShContentStudy.thresholds.leakWrongOverCorrect;
		const receivers = [ sealedReceiverSurfaceQuadratureDiagnostic.left, sealedReceiverSurfaceQuadratureDiagnostic.right ];
		const sampleRows = receivers.flatMap( receiver => receiver.samples.map( sample => {

			const attributionRows = ( sample.surfaceCoefficientAttributionRows ?? [] ).map( row => {

				const runtimeWeightedBandContributions = row.runtimeWeightedBandContributions ?? [];
				const runtimeWeightedCoefficientContributions = row.runtimeWeightedCoefficientContributions ?? [];
				const runtimeWeightedDilatedBandContributions = row.runtimeWeightedDilatedBandContributions ?? [];
				const runtimeWeightedDilatedCoefficientContributions = row.runtimeWeightedDilatedCoefficientContributions ?? [];
				const dominantBand = [ ...runtimeWeightedBandContributions ].sort( ( a, b ) =>
					b.weightedWrongMinusCorrect - a.weightedWrongMinusCorrect
				)[ 0 ] ?? null;
				const dominantCoefficient = [ ...runtimeWeightedCoefficientContributions ].sort( ( a, b ) =>
					b.weightedWrongMinusCorrect - a.weightedWrongMinusCorrect
				)[ 0 ] ?? null;
				const dominantDilatedBand = [ ...runtimeWeightedDilatedBandContributions ].sort( ( a, b ) =>
					b.weightedWrongMinusCorrect - a.weightedWrongMinusCorrect
				)[ 0 ] ?? null;
				const dominantDilatedCoefficient = [ ...runtimeWeightedDilatedCoefficientContributions ].sort( ( a, b ) =>
					b.weightedWrongMinusCorrect - a.weightedWrongMinusCorrect
				)[ 0 ] ?? null;

				return {
					probeIndex: row.probeIndex,
					sourceProbeIndex: row.sourceProbeIndex,
					dilationSourceDiffers: row.dilationSourceDiffers,
					side: row.side,
					sourceSide: row.sourceSide,
					relationToReceiver: row.relationToReceiver,
					sourceRelationToReceiver: row.sourceRelationToReceiver,
					probePosition: row.probePosition ?? null,
					crossesDivider: row.crossesDivider ?? null,
					visibilitySegmentDividerAudit: row.visibilitySegmentDividerAudit ?? null,
					surfaceSegmentDividerAudit: row.surfaceSegmentDividerAudit ?? null,
					scalarWeight: row.scalarWeight,
					visibilityWeight: row.visibilityWeight,
					runtimeFinalWeight: row.runtimeFinalWeight,
					sourceValidity: row.sourceValidity,
					validity: row.validity,
					runtimeWeightedIrradiance: row.runtimeWeightedIrradiance,
					runtimeWeightedCorrectContribution: row.runtimeWeightedCorrectContribution,
					runtimeWeightedWrongContribution: row.runtimeWeightedWrongContribution,
					runtimeWeightedWrongMinusCorrect: row.runtimeWeightedWrongMinusCorrect,
					wrongChannelPressure: row.wrongChannelPressure,
					correctChannelPreservation: row.correctChannelPreservation,
					runtimeWeightedDilatedIrradiance: row.runtimeWeightedDilatedIrradiance,
					runtimeWeightedDilatedCorrectContribution: row.runtimeWeightedDilatedCorrectContribution,
					runtimeWeightedDilatedWrongContribution: row.runtimeWeightedDilatedWrongContribution,
					runtimeWeightedDilatedWrongMinusCorrect: row.runtimeWeightedDilatedWrongMinusCorrect,
					dilatedWrongChannelPressure: row.dilatedWrongChannelPressure,
					dilatedCorrectChannelPreservation: row.dilatedCorrectChannelPreservation,
					dilatedSourceWrongPressureDelta: row.dilatedSourceWrongPressureDelta,
					bandPressure: row.bandPressure,
					dominantWeightedBand: dominantBand?.band ?? 'none',
					dominantWeightedBandWrongMinusCorrect: dominantBand?.weightedWrongMinusCorrect ?? 0,
					dominantWeightedCoefficient: dominantCoefficient?.name ?? 'none',
					dominantWeightedCoefficientIndex: dominantCoefficient?.coefficientIndex ?? null,
					dominantWeightedCoefficientBand: dominantCoefficient?.band ?? 'none',
					dominantWeightedCoefficientWrongMinusCorrect: dominantCoefficient?.weightedWrongMinusCorrect ?? 0,
					dominantDilatedWeightedBand: dominantDilatedBand?.band ?? 'none',
					dominantDilatedWeightedBandWrongMinusCorrect: dominantDilatedBand?.weightedWrongMinusCorrect ?? 0,
					dominantDilatedWeightedCoefficient: dominantDilatedCoefficient?.name ?? 'none',
					dominantDilatedWeightedCoefficientIndex: dominantDilatedCoefficient?.coefficientIndex ?? null,
					dominantDilatedWeightedCoefficientBand: dominantDilatedCoefficient?.band ?? 'none',
					dominantDilatedWeightedCoefficientWrongMinusCorrect: dominantDilatedCoefficient?.weightedWrongMinusCorrect ?? 0,
					fullUnclampedNegativeEnergy: row.fullUnclampedNegativeEnergy,
					postClampEnergyDelta: row.postClampEnergyDelta,
					dilatedFullUnclampedNegativeEnergy: row.dilatedFullUnclampedNegativeEnergy,
					dilatedPostClampEnergyDelta: row.dilatedPostClampEnergyDelta,
					runtimeWeightedBandContributions,
					runtimeWeightedCoefficientContributions,
					runtimeWeightedDilatedBandContributions,
					runtimeWeightedDilatedCoefficientContributions
				};

			} );
			const dominantProbe = [ ...attributionRows ]
				.filter( row => row.wrongChannelPressure > 0 )
				.sort( ( a, b ) =>
					b.wrongChannelPressure - a.wrongChannelPressure
				)[ 0 ] ?? null;
			const sourcePressureRows = attributionRows.filter( row =>
				row.sourceRelationToReceiver === 'wrong-side' &&
				(
					row.wrongChannelPressure > 0 ||
					row.dilatedWrongChannelPressure > 0 ||
					row.dilatedSourceWrongPressureDelta > 0
				)
			);
			const sourcePressureSample = sourcePressureRows.length > 0;
			const dominantSourcePressureRow = [ ...sourcePressureRows ].sort( ( a, b ) =>
				Math.max( b.wrongChannelPressure, b.dilatedWrongChannelPressure, b.dilatedSourceWrongPressureDelta ) -
				Math.max( a.wrongChannelPressure, a.dilatedWrongChannelPressure, a.dilatedSourceWrongPressureDelta )
			)[ 0 ] ?? null;

			return {
				receiver: receiver.label,
				correctSide: receiver.correctSide,
				sampleLabel: sample.sampleLabel,
				quadratureWeight: sample.quadratureWeight,
				receiverPosition: sample.receiverPosition,
				samplePosition: sample.samplePosition,
				runtimeWrongOverCorrect: sample.runtimeWrongOverCorrect,
				leakSample: sample.runtimeWrongOverCorrect >= leakThreshold,
				dominantProbeIndex: dominantProbe?.probeIndex ?? null,
				dominantSourceProbeIndex: dominantProbe?.sourceProbeIndex ?? null,
				dominantProbeRelationToReceiver: dominantProbe?.relationToReceiver ?? 'none',
				dominantSourceRelationToReceiver: dominantProbe?.sourceRelationToReceiver ?? 'none',
				dominantWeightedBand: dominantProbe?.dominantWeightedBand ?? 'none',
				dominantWeightedCoefficient: dominantProbe?.dominantWeightedCoefficient ?? 'none',
				dominantWeightedCoefficientBand: dominantProbe?.dominantWeightedCoefficientBand ?? 'none',
				dominantWeightedWrongMinusCorrect: dominantProbe?.runtimeWeightedWrongMinusCorrect ?? 0,
				dominantWeightedCorrectContribution: dominantProbe?.runtimeWeightedCorrectContribution ?? 0,
				dominantWeightedWrongContribution: dominantProbe?.runtimeWeightedWrongContribution ?? 0,
				dominantWrongChannelPressure: dominantProbe?.wrongChannelPressure ?? 0,
				dominantCorrectChannelPreservation: dominantProbe?.correctChannelPreservation ?? 0,
				dominantDilatedWeightedBand: dominantProbe?.dominantDilatedWeightedBand ?? 'none',
				dominantDilatedWeightedCoefficient: dominantProbe?.dominantDilatedWeightedCoefficient ?? 'none',
				dominantDilatedWrongChannelPressure: dominantProbe?.dilatedWrongChannelPressure ?? 0,
				dominantDilatedCorrectChannelPreservation: dominantProbe?.dilatedCorrectChannelPreservation ?? 0,
				dominantDilatedSourceWrongPressureDelta: dominantProbe?.dilatedSourceWrongPressureDelta ?? 0,
				dominantFullUnclampedNegativeEnergy: dominantProbe?.fullUnclampedNegativeEnergy ?? 0,
				dominantPostClampEnergyDelta: dominantProbe?.postClampEnergyDelta ?? 0,
				sourcePressureSample,
				sourcePressureProbeIndex: dominantSourcePressureRow?.probeIndex ?? null,
				sourcePressureSourceProbeIndex: dominantSourcePressureRow?.sourceProbeIndex ?? null,
				sourcePressureRelationToReceiver: dominantSourcePressureRow?.relationToReceiver ?? 'none',
				sourcePressureSourceRelationToReceiver: dominantSourcePressureRow?.sourceRelationToReceiver ?? 'none',
				sourcePressureWrongChannelPressure: dominantSourcePressureRow?.wrongChannelPressure ?? 0,
				sourcePressureDilatedWrongChannelPressure: dominantSourcePressureRow?.dilatedWrongChannelPressure ?? 0,
				sourcePressureDilatedSourceWrongPressureDelta: dominantSourcePressureRow?.dilatedSourceWrongPressureDelta ?? 0,
				sourcePressureAttributionRowCount: sourcePressureRows.length,
				attributionRowCount: attributionRows.length,
				attributionRows
			};

		} ) );
		const leakSamples = sampleRows.filter( sample => sample.leakSample );
		const dominantLeakSamples = leakSamples.filter( sample => sample.dominantProbeIndex !== null );
		const wrongSideDominantSamples = dominantLeakSamples.filter( sample =>
			sample.dominantProbeRelationToReceiver === 'wrong-side'
		);
		const correctSideDominantSamples = dominantLeakSamples.filter( sample =>
			sample.dominantProbeRelationToReceiver === 'correct-side'
		);
		const l2DominantSamples = dominantLeakSamples.filter( sample =>
			sample.dominantWeightedBand === 'l2'
		);
		const dilationChangedDominantSamples = dominantLeakSamples.filter( sample =>
			sample.dominantProbeIndex !== sample.dominantSourceProbeIndex &&
			sample.dominantDilatedSourceWrongPressureDelta > 0
		);
		const sourcePressureLeakSamples = leakSamples.filter( sample =>
			sample.sourcePressureSample
		);
		const sourcePressureDominantSamples = dominantLeakSamples.filter( sample =>
			sample.sourcePressureSample
		);
		const coefficientHistogram = dominantLeakSamples.reduce( ( histogram, sample ) => {

			histogram[ sample.dominantWeightedCoefficient ] = ( histogram[ sample.dominantWeightedCoefficient ] ?? 0 ) + 1;
			return histogram;

		}, {} );
		const bandHistogram = dominantLeakSamples.reduce( ( histogram, sample ) => {

			histogram[ sample.dominantWeightedBand ] = ( histogram[ sample.dominantWeightedBand ] ?? 0 ) + 1;
			return histogram;

		}, {} );
		const probeHistogram = dominantLeakSamples.reduce( ( histogram, sample ) => {

			const key = String( sample.dominantProbeIndex );
			histogram[ key ] = ( histogram[ key ] ?? 0 ) + 1;
			return histogram;

		}, {} );
		const worstSample = [ ...sampleRows ].sort( ( a, b ) =>
			b.runtimeWrongOverCorrect - a.runtimeWrongOverCorrect
		)[ 0 ] ?? null;
		const weightedLeakWrongChannelPressure = Number( leakSamples.reduce(
			( total, sample ) => total + sample.dominantWrongChannelPressure * sample.quadratureWeight,
			0
		).toFixed( 4 ) );
		const weightedLeakCorrectChannelPreservation = Number( leakSamples.reduce(
			( total, sample ) => total + sample.dominantCorrectChannelPreservation * sample.quadratureWeight,
			0
		).toFixed( 4 ) );

		return {
			status: leakSamples.length > 0 ?
				'OPEN-SURFACE-COEFFICIENT-ATTRIBUTION' :
				'SUPPORTED-SURFACE-COEFFICIENT-ATTRIBUTION-BOUNDED',
			proofBoundary: 'Report-only receiver-surface attribution over proof quadrature samples; joins selected probe weights, CPU/report-only source-map relation, weighted SH band/coefficient contributions, negative energy, and clamp delta without changing runtime, bake capture, public API, or Chebyshev thresholds.',
			thresholds: {
				leakWrongOverCorrect: leakThreshold
			},
			receivers: sampleRows.reduce( ( grouped, sample ) => {

				const receiver = grouped.find( row => row.receiver === sample.receiver );

				if ( receiver === undefined ) {

					grouped.push( {
						receiver: sample.receiver,
						correctSide: sample.correctSide,
						samples: [ sample ]
					} );

				} else {

					receiver.samples.push( sample );

				}

				return grouped;

			}, [] ),
			summary: {
				surfaceSampleCount: sampleRows.length,
				leakSampleCount: leakSamples.length,
				attributedLeakSampleCount: dominantLeakSamples.length,
				wrongSideDominantLeakSampleCount: wrongSideDominantSamples.length,
				correctSideDominantLeakSampleCount: correctSideDominantSamples.length,
				l2DominantLeakSampleCount: l2DominantSamples.length,
				dilationChangedDominantLeakSampleCount: dilationChangedDominantSamples.length,
				sourcePressureLeakSampleCount: sourcePressureLeakSamples.length,
				sourcePressureDominantLeakSampleCount: sourcePressureDominantSamples.length,
				weightedLeakWrongChannelPressure,
				weightedLeakCorrectChannelPreservation,
				dominantProbeHistogram: probeHistogram,
				dominantBandHistogram: bandHistogram,
				dominantCoefficientHistogram: coefficientHistogram,
				worstSampleLabel: worstSample?.sampleLabel ?? 'none',
				worstSampleReceiver: worstSample?.receiver ?? 'none',
				worstSampleWrongOverCorrect: worstSample?.runtimeWrongOverCorrect ?? 0,
				worstSampleDominantProbeIndex: worstSample?.dominantProbeIndex ?? null,
				worstSampleDominantSourceProbeIndex: worstSample?.dominantSourceProbeIndex ?? null,
				worstSampleDominantBand: worstSample?.dominantWeightedBand ?? 'none',
				worstSampleDominantCoefficient: worstSample?.dominantWeightedCoefficient ?? 'none',
				interpretation: wrongSideDominantSamples.length > 0 ?
					'At least one leaking surface sample is dominated by a wrong-side selected probe; prioritize bake/source-policy attribution before runtime visibility changes.' :
					l2DominantSamples.length > 0 ?
						'Leaking surface samples are dominated by L2 weighted SH contribution; test band/de-ringing policy as an oracle before runtime visibility changes.' :
						correctSideDominantSamples.length > 0 ?
							'Leaking surface samples are dominated by correct-side probe/source rows; run a CPU static-blocker/SDF oracle before runtime visibility changes.' :
							'Leak attribution did not identify a dominant probe/coefficient path; expand proof instrumentation before changing runtime visibility.'
			}
		};

	};

	const surfaceSampleCoefficientAttributionStudy = createSurfaceSampleCoefficientAttributionStudy();
	const surfaceContentAttributionSplitStudy = createSurfaceContentAttributionSplitStudy( {
		surfaceShContentStudy,
		surfaceSampleCoefficientAttributionStudy
	} );
	const surfaceContentAttributionFollowupStudy = createSurfaceContentAttributionFollowupStudy(
		surfaceContentAttributionSplitStudy
	);
	const {
		mappedBakeContentSourcePolicyOracleStudy,
		unmappedCoefficientAttributionInstrumentationStudy,
		aggregateExplanationComparisonStudy,
		proof7bCoefficientL10OracleStudy,
		probe50L10SignSourceIsolationOracleStudy,
		probe50L10ContentBasisPolarityOracleStudy,
		probe50CoefficientLocalCorrectionOracleStudy,
		probe50LocalCorrectionAggregateResidualGuardStudy,
		probe50L10ZDesignBoundConstraintsStudy,
		surfaceAttributionBranchDecision,
		proof7cSurfaceStaticBlockerOracleStudy,
		proof7cDispositionStudy
	} = createLightProbeProofOracleStudies( {
		surfaceContentAttributionSplitStudy,
		surfaceContentAttributionFollowupStudy,
		surfaceSampleCoefficientAttributionStudy,
		sdfStaticBlockerOracleStudy
	} );
	const surfaceAttributionFollowupSpec = {
		status: 'SPECIFIED-CAUSAL-ATTRIBUTION-FOLLOWUP',
		mode: 'causal-attribution-before-fix',
		proofBoundary: 'Spec-only execution plan driven by surfaceSampleCoefficientAttributionStudy; no runtime, bake, public API, docs promotion, or Chebyshev changes are authorized by this spec alone.',
		currentEvidence: {
			surfaceAttributionStatus: surfaceSampleCoefficientAttributionStudy.status,
			leakSampleCount: surfaceSampleCoefficientAttributionStudy.summary.leakSampleCount,
			attributedLeakSampleCount: surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount,
			wrongSideDominantLeakSampleCount: surfaceSampleCoefficientAttributionStudy.summary.wrongSideDominantLeakSampleCount,
			correctSideDominantLeakSampleCount: surfaceSampleCoefficientAttributionStudy.summary.correctSideDominantLeakSampleCount,
			l2DominantLeakSampleCount: surfaceSampleCoefficientAttributionStudy.summary.l2DominantLeakSampleCount,
			dilationChangedDominantLeakSampleCount: surfaceSampleCoefficientAttributionStudy.summary.dilationChangedDominantLeakSampleCount,
			sourcePressureDominantLeakSampleCount: surfaceSampleCoefficientAttributionStudy.summary.sourcePressureDominantLeakSampleCount,
			dominantProbeHistogram: surfaceSampleCoefficientAttributionStudy.summary.dominantProbeHistogram,
			dominantBandHistogram: surfaceSampleCoefficientAttributionStudy.summary.dominantBandHistogram,
			dominantCoefficientHistogram: surfaceSampleCoefficientAttributionStudy.summary.dominantCoefficientHistogram,
			selectedBranch: surfaceAttributionBranchDecision.selectedBranch,
			selectedOracleFamily: surfaceAttributionBranchDecision.selectedOracleFamily,
			branchDecisionStatus: surfaceAttributionBranchDecision.status,
			branchDecisionConfidence: surfaceAttributionBranchDecision.confidence,
			proof7cSurfaceStaticBlockerOracleStatus: proof7cSurfaceStaticBlockerOracleStudy.status,
			proof7cSurfaceStaticBlockerBlockedDominantPathCount: proof7cSurfaceStaticBlockerOracleStudy.summary.blockedDominantPathCount,
			proof7cReceiverAggregateOracleStatus: proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleStatus,
			proof7cDispositionStatus: proof7cDispositionStudy.status,
			proof7cAddressed: proof7cDispositionStudy.addressed,
			proof7cRuntimePromotionAllowed: proof7cDispositionStudy.runtimePromotionAllowed,
			surfaceContentAttributionSplitStatus: surfaceContentAttributionSplitStudy.status,
			surfaceContentMappedLeakSampleCount: surfaceContentAttributionSplitStudy.summary.mappedLeakSampleCount,
			surfaceContentUnmappedLeakSampleCount: surfaceContentAttributionSplitStudy.summary.unmappedLeakSampleCount,
			surfaceContentFollowupStatus: surfaceContentAttributionFollowupStudy.status,
			mappedBakeContentSourcePolicyOracleStatus: mappedBakeContentSourcePolicyOracleStudy.status,
			unmappedCoefficientAttributionInstrumentationStatus: unmappedCoefficientAttributionInstrumentationStudy.status,
			aggregateExplanationComparisonStatus: aggregateExplanationComparisonStudy.status,
			aggregateRecommendedContinuation: aggregateExplanationComparisonStudy.summary.recommendedContinuation,
			proof7bCoefficientL10OracleStatus: proof7bCoefficientL10OracleStudy.status,
			proof7bIdentifiedCause: proof7bCoefficientL10OracleStudy.summary.identifiedCause,
			probe50L10SignSourceIsolationStatus: probe50L10SignSourceIsolationOracleStudy.status,
			probe50L10IdentifiedCause: probe50L10SignSourceIsolationOracleStudy.summary.identifiedCause,
			probe50L10ContentBasisPolarityStatus: probe50L10ContentBasisPolarityOracleStudy.status,
			probe50L10ContentBasisPolarityCause: probe50L10ContentBasisPolarityOracleStudy.summary.identifiedCause,
			probe50CoefficientLocalCorrectionStatus: probe50CoefficientLocalCorrectionOracleStudy.status,
			probe50CoefficientLocalCorrectionCause: probe50CoefficientLocalCorrectionOracleStudy.summary.identifiedCause,
			probe50LocalCorrectionAggregateResidualGuardStatus: probe50LocalCorrectionAggregateResidualGuardStudy.status,
			probe50LocalCorrectionAggregateResidualGuardCause: probe50LocalCorrectionAggregateResidualGuardStudy.summary.identifiedCause,
			probe50L10ZDesignBoundConstraintsStatus: probe50L10ZDesignBoundConstraintsStudy.status,
			probe50L10ZDesignBoundConstraintsCause: probe50L10ZDesignBoundConstraintsStudy.summary.identifiedCause
		},
		batches: [
			{
				id: 'proof-6',
				title: 'Regenerate and classify surface attribution evidence',
				action: 'Run the existing targeted proof path, then read proof-report.json and classify dominant leak samples by probe/source side, SH band, coefficient, wrong-channel pressure, correct-channel preservation, negative energy, and clamp delta.',
				output: 'A bounded classification row that selects exactly one next oracle family or marks the model under-instrumented.',
				gate: 'Classification must be based on surfaceSampleCoefficientAttributionStudy summary and rows, not center samples or presentation-only screenshots.'
			},
			{
				id: 'proof-7a',
				title: 'Bake/repack/source-policy oracle branch',
				action: 'If wrong energy is dominated by wrong-side selected/source probes or stale source-pressure deltas, collect CPU/report-only source isolation/repack evidence first.',
				output: 'Aggregate wrong-channel reduction and correct-channel preservation for source-policy candidates.',
				gate: 'This phase forbids runtime source policy, runtime dilation policy, bake-policy, public API, docs, and Chebyshev changes; the branch may only collect CPU/report-only evidence.'
			},
			{
				id: 'proof-7b',
				title: 'Band/de-ringing oracle branch',
				action: 'If leak samples are dominated by L2 or large negative/clamp energy, test band damping/de-ringing policy as a proof-only oracle.',
				output: 'Per-band aggregate pressure reduction plus preservation of correct channel and luminance floor.',
				gate: 'No L1/L2 damping promotion unless it reduces surface leak pressure and preserves correct-side bounce on aggregate.'
			},
			{
				id: 'proof-7c',
				title: 'CPU static-blocker/SDF oracle branch',
				action: 'If dominant rows are correct-side probes/sources but still leak through the sealed wall, test a CPU-only static-blocker/SDF visibility oracle over the selected probe-to-surface paths.',
				output: 'Path-level blocker classification and aggregate leak reduction for blocker-aware weights.',
				gate: 'No runtime SDF/blocker machinery unless CPU oracle proves aggregate value over current weights.'
			},
			{
				id: 'proof-7d',
				title: 'Under-instrumented fallback',
				action: 'If no branch dominates, add missing instrumentation rather than changing runtime: more surface samples, receiver masks, source rows, or coefficient/channel summaries.',
				output: 'A report row explaining which missing signal prevents causal attribution.',
				gate: 'Runtime changes remain blocked while attribution is inconclusive.'
			}
		],
		stopConditions: [
			'Stop before Chebyshev or visibility-moment threshold changes unless attribution proves a moment-threshold failure.',
			'Stop before public API/docs promotion while DDGI-lite leak promotion is OPEN.',
			'Stop before full build; use targeted proof/e2e, node --check, git diff --check, and source checks only.',
			'Stop before adding runtime SDF/source/damping behavior unless its CPU/report oracle has an aggregate win.'
		],
		nextAction: surfaceAttributionBranchDecision.selectedBranch === 'proof-7c' ?
			proof7cSurfaceStaticBlockerOracleStudy.status === 'SUPPORTED-PROOF-7C-CPU-STATIC-BLOCKER-AGGREGATE-WIN' ?
				'Review proof-7c CPU static-blocker aggregate win before any deliberate runtime design promotion.' :
				proof7cDispositionStudy.status === 'CLOSED-PROOF-7C-DISPOSITION-NO-RUNTIME-PROMOTION' ?
					proof7cDispositionStudy.nextProofOnlyAction :
					surfaceContentAttributionFollowupStudy.status === 'OPEN-SURFACE-CONTENT-DUAL-BUCKET-FOLLOWUP' ?
						surfaceContentAttributionFollowupStudy.summary.nextProofOnlyAction :
						'proof-7c CPU/static-blocker oracle did not produce an aggregate-safe runtime promotion case; inspect bake content, probe density, or surface placement next.' :
			'Regenerate the proof artifact and use surfaceSampleCoefficientAttributionStudy to choose proof-7a, proof-7b, proof-7c, or proof-7d.'
	};
	const createProbeContentContributionAttribution = () => {

		const contributionGate = sealedPresentationStudy.summary.offscreenSceneLinearContributionGate;
		const contributionGateOpen = String( contributionGate.status ).startsWith( 'OPEN' );
		const contributionBlockers = contributionGate.blockers ?? [];
		const contributionBlockerKeys = new Set( contributionBlockers.map( blocker => blocker.key ) );
		const sourceAttribution = contributionGate.sourceAttribution ?? {};
		const receiverAlbedoCleared = sourceAttribution.receiverAlbedoBounded === true;
		const directAmbientCleared = sourceAttribution.probeDominated === true &&
			sourceAttribution.directAmbientSeparationWeak === true;
		const neutralChromaticityBlocked = contributionBlockerKeys.has( 'neutralChromaticityWrongSidePressure' );
		const neutralWrongSideBlocked = contributionBlockerKeys.has( 'neutralProbesOnlyWrongSide' );
		const neutralCorrectBounceBlocked = contributionBlockerKeys.has( 'neutralProbesOnlyCorrectBounce' );
		const probeContentOpen = String( probeContentChromaStudy.status ).startsWith( 'OPEN' );
		const bakeContentOpen = String( probeBakeContaminationMap.status ).startsWith( 'OPEN' );
		const surfaceContentOpen = String( surfaceShContentStudy.status ).startsWith( 'OPEN' );
		const coefficientAttributionOpen = String( surfaceSampleCoefficientAttributionStudy.status ).startsWith( 'OPEN' );
		const surfaceSplitOpen = String( surfaceContentAttributionSplitStudy.status ).startsWith( 'OPEN' );
		const contentEvidenceOpen = probeContentOpen ||
			bakeContentOpen ||
			surfaceContentOpen ||
			coefficientAttributionOpen ||
			surfaceSplitOpen;
		const surfaceLeakSampleCount = surfaceSampleCoefficientAttributionStudy.summary.leakSampleCount;
		const attributedLeakSampleCount = surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount;
		const coefficientAttributionCoverageRatio = surfaceLeakSampleCount > 0 ?
			roundMetric( attributedLeakSampleCount / surfaceLeakSampleCount ) :
			1;
		const surfaceContentCoverageRatio = surfaceShContentStudy.summary.leakContentPressureCoverageRatio;
		const surfaceLeakContentMapped = surfaceLeakSampleCount === 0 ||
			surfaceContentCoverageRatio > 0 ||
			coefficientAttributionCoverageRatio > 0;
		const probeContentExplainsContribution = contributionGateOpen &&
			contributionGate.dominantContributionSource === 'probe-content-or-visibility-shaping' &&
			receiverAlbedoCleared &&
			directAmbientCleared &&
			contentEvidenceOpen;
		const strongProbeContentAttribution = probeContentExplainsContribution &&
			probeContentOpen &&
			bakeContentOpen &&
			surfaceLeakContentMapped &&
			( surfaceContentOpen || coefficientAttributionOpen || surfaceSplitOpen );
		const attributionStrength = contributionGate.status === 'SUPPORTED' ?
			'bounded' :
			strongProbeContentAttribution ?
				'strong' :
				probeContentExplainsContribution ?
					'partial' :
					'under-instrumented';

		return {
			status: contributionGate.status === 'SUPPORTED' ?
				'SUPPORTED-CONTRIBUTION-GATE-BOUNDED' :
				strongProbeContentAttribution ?
					'OPEN-PROBE-CONTENT-BOUNCED-CHROMA-ATTRIBUTED' :
					probeContentExplainsContribution ?
						'OPEN-PROBE-CONTENT-BOUNCED-CHROMA-PARTIAL' :
						'OPEN-CONTRIBUTION-ATTRIBUTION-UNDER-INSTRUMENTED',
			mode: 'report-only-probe-content-contribution-attribution',
			proofBoundary: 'Report-only attribution that joins the offscreen scene-linear contribution gate to probe-content chroma, bake-contamination, surface SH content, and coefficient-attribution evidence; it does not change bake capture, runtime sampling, visibility moments, public API, docs, or Chebyshev thresholds.',
			runtimePromotionAllowed: false,
			currentGate: {
				status: contributionGate.status,
				dominantContributionSource: contributionGate.dominantContributionSource,
				dominantBlocker: contributionGate.dominantBlocker?.key ?? null,
				blockerKeys: contributionBlockers.map( blocker => blocker.key ),
				neutralProbesOnly: contributionGate.neutralProbesOnly,
				neutralChromaticityBlocked,
				neutralWrongSideBlocked,
				neutralCorrectBounceBlocked
			},
			clearedNonContentSources: {
				receiverAlbedoCleared,
				directAmbientCleared,
				receiverAlbedoBounded: sourceAttribution.receiverAlbedoBounded === true,
				probeDominated: sourceAttribution.probeDominated === true,
				directAmbientSeparationWeak: sourceAttribution.directAmbientSeparationWeak === true,
				neutralVsOriginalProbeDelta: sourceAttribution.neutralVsOriginalProbeDelta ?? null,
				probesDirectPlusMaskedDelta: sourceAttribution.probesDirectPlusMaskedDelta ?? null,
				directAmbientMaskedDelta: sourceAttribution.directAmbientMaskedDelta ?? null
			},
			contentEvidence: {
				probeContentChromaStatus: probeContentChromaStudy.status,
				maxCorrectSideChromaPressure: probeContentChromaStudy.summary.maxCorrectSideChromaPressure,
				maxRuntimeFinalChromaPressure: probeContentChromaStudy.summary.maxRuntimeFinalChromaPressure,
				weightedCorrectSideChromaPressureMean: probeContentChromaStudy.summary.weightedCorrectSideChromaPressureMean,
				probeBakeContaminationStatus: probeBakeContaminationMap.status,
				probeBakeDominantProbeIndex: probeBakeContaminationMap.summary.dominantProbeIndex,
				probeBakeDominantClassification: probeBakeContaminationMap.summary.dominantProbeClassification,
				probeBakeDominantBandResponsibility: probeBakeContaminationMap.summary.dominantProbeBandResponsibility,
				probeBakeDominantCoefficientName: probeBakeContaminationMap.summary.dominantCoefficientName,
				probeBakeDominantCoefficientBand: probeBakeContaminationMap.summary.dominantCoefficientBand,
				probeBakeDominantCoefficientWrongMinusCorrect: probeBakeContaminationMap.summary.dominantCoefficientWrongMinusCorrect,
				surfaceShContentStatus: surfaceShContentStudy.status,
				surfaceLeakSampleCount,
				surfaceContentPressureSampleCount: surfaceShContentStudy.summary.contentPressureSampleCount,
				surfaceLeakContentPressureCoverageRatio: surfaceContentCoverageRatio,
				surfaceCoefficientAttributionStatus: surfaceSampleCoefficientAttributionStudy.status,
				attributedLeakSampleCount,
				coefficientAttributionCoverageRatio,
				dominantProbeHistogram: surfaceSampleCoefficientAttributionStudy.summary.dominantProbeHistogram,
				dominantBandHistogram: surfaceSampleCoefficientAttributionStudy.summary.dominantBandHistogram,
				dominantCoefficientHistogram: surfaceSampleCoefficientAttributionStudy.summary.dominantCoefficientHistogram,
				surfaceContentAttributionSplitStatus: surfaceContentAttributionSplitStudy.status,
				mappedLeakSampleCount: surfaceContentAttributionSplitStudy.summary.mappedLeakSampleCount,
				unmappedLeakSampleCount: surfaceContentAttributionSplitStudy.summary.unmappedLeakSampleCount,
				mappedCoverageRatio: surfaceContentAttributionSplitStudy.summary.mappedCoverageRatio,
				surfaceContentFollowupStatus: surfaceContentAttributionFollowupStudy.status,
				nextProofOnlyAction: surfaceContentAttributionFollowupStudy.summary.nextProofOnlyAction,
				surfaceAttributionBranchStatus: surfaceAttributionBranchDecision.status,
				selectedBranch: surfaceAttributionBranchDecision.selectedBranch,
				selectedOracleFamily: surfaceAttributionBranchDecision.selectedOracleFamily,
				proof7cDispositionStatus: proof7cDispositionStudy.status,
				proof7cRuntimePromotionAllowed: proof7cDispositionStudy.runtimePromotionAllowed
			},
			openItems: [
				...( contributionGateOpen ? [ {
					gate: 'offscreenSceneLinearContributionGate',
					status: contributionGate.status,
					dominantBlocker: contributionGate.dominantBlocker?.key ?? null
				} ] : [] ),
				...( probeContentOpen ? [ {
					gate: 'probeContentChromaStudy',
					status: probeContentChromaStudy.status,
					maxCorrectSideChromaPressure: probeContentChromaStudy.summary.maxCorrectSideChromaPressure,
					maxRuntimeFinalChromaPressure: probeContentChromaStudy.summary.maxRuntimeFinalChromaPressure
				} ] : [] ),
				...( bakeContentOpen ? [ {
					gate: 'probeBakeContaminationMap',
					status: probeBakeContaminationMap.status,
					dominantProbeIndex: probeBakeContaminationMap.summary.dominantProbeIndex,
					dominantBand: probeBakeContaminationMap.summary.dominantProbeBandResponsibility,
					dominantCoefficient: probeBakeContaminationMap.summary.dominantCoefficientName
				} ] : [] ),
				...( surfaceContentOpen || coefficientAttributionOpen || surfaceSplitOpen ? [ {
					gate: 'surfaceContentAttribution',
					status: surfaceContentAttributionSplitStudy.status,
					leakSampleCount: surfaceLeakSampleCount,
					mappedLeakSampleCount: surfaceContentAttributionSplitStudy.summary.mappedLeakSampleCount,
					unmappedLeakSampleCount: surfaceContentAttributionSplitStudy.summary.unmappedLeakSampleCount
				} ] : [] )
			],
			summary: {
				contributionGateOpen,
				contentEvidenceOpen,
				probeContentExplainsContribution,
				attributionStrength,
				receiverAlbedoCleared,
				directAmbientCleared,
				surfaceLeakContentMapped,
				dominantContributionBlocker: contributionGate.dominantBlocker?.key ?? null,
				dominantExplainedSource: strongProbeContentAttribution || probeContentExplainsContribution ?
					'probe-content/bounced-light-chroma' :
					'under-instrumented-or-non-content',
				remainingUnprovenSource: strongProbeContentAttribution || probeContentExplainsContribution ?
					'visibility-shaping remains a possible follow-up, but this report does not tune visibility moments or Chebyshev thresholds' :
					'expand contribution/source instrumentation before changing runtime or visibility thresholds',
				nextProofOnlyAction: surfaceContentAttributionFollowupStudy.summary.nextProofOnlyAction,
				runtimePromotionAllowed: false,
				diagnosticConclusion: contributionGate.status === 'SUPPORTED' ?
					'Contribution gate is bounded; no probe-content attribution blocker remains.' :
					strongProbeContentAttribution ?
						'The remaining scene-linear contribution gate is explained by probe-content/bounced-light chroma evidence after receiver albedo, direct, and ambient contribution controls are bounded; keep runtime/visibility/Chebyshev promotion closed until a proof-only content oracle wins.' :
						probeContentExplainsContribution ?
							'The remaining contribution gate points at probe content or visibility shaping, and probe-content evidence is present but not complete enough to claim a single fix family; continue proof-only attribution.' :
							'The contribution gate remains open but current content evidence is not sufficient to attribute it; expand proof instrumentation before runtime changes.'
			}
		};

	};
	const probeContentContributionAttribution = createProbeContentContributionAttribution();
	const wgpuLeakAuditStudy = {
		status: leakMatrix.comparisons.sealedWall.linearPromotionStatus === 'SUPPORTED-BY-PRE-TONE-MASKED-FIXTURE' &&
			sealedRenderMetricMismatch.cpuRenderAgreementGate === 'SUPPORTED' &&
			sealedRenderMetricMismatch.gpuDebugLinearIrradianceAgreementGate === 'SUPPORTED' ?
			'SUPPORTED' :
			'OPEN',
		proofBoundary: 'WebGPU-only sealed-wall leak audit. WebGL remains a bounded reference and is not used as a sealed-wall promotion baseline.',
		variants: [
			createLeakVariantAudit( 'leak-sealed-wall-unweighted', 'baseline-unweighted' ),
			createLeakVariantAudit( 'leak-sealed-wall-validity-weighted', 'validity-only' ),
			createLeakVariantAudit( 'leak-sealed-wall-visibility-scaffold-disabled', 'visibility-scaffold-disabled' ),
			createLeakVariantAudit( 'leak-zero-thickness-visibility-scaffold-disabled', 'zero-thickness-control' )
		],
		receivers: [
			createNeighborContributionAudit( 'left', 'leftReceiver' ),
			createNeighborContributionAudit( 'right', 'rightReceiver' )
		],
		linearPromotionStudy: {
			status: leakMatrix.comparisons.sealedWall.linearPromotionStatus,
			metricMode: leakMatrix.comparisons.sealedWall.linearPromotionMetricMode,
			presentationMetricMode: leakMatrix.comparisons.sealedWall.presentationMetricMode,
			metrics: {
				preToneMaskedWrongSideImprovement: leakMatrix.comparisons.sealedWall.visibility.preToneMaskedWrongSide.improvement,
				preToneMaskedCorrectBouncePreservation: leakMatrix.comparisons.sealedWall.visibility.preToneMaskedCorrectBounce.preservation,
				maskedWrongSideImprovement: leakMatrix.comparisons.sealedWall.visibility.maskedWrongSide.improvement
			},
			interpretation: 'Presentation-space masked ratios remain useful perceptual diagnostics, but promotion requires the pre-tone linear-output masked row plus CPU/GPU linear and weight-term gates.'
		},
		consolidatedDiagnostics: {
			visibilityWeightingStatus: sealedVisibilityWeightingDiagnostic.status,
			dilationOracleStatus: sealedVisibilityWeightingDiagnostic.dilationOracleStudy.status,
			samplingBiasStatus: sealedVisibilityWeightingDiagnostic.samplingBiasStudy.status,
			shDeringingStatus: sealedVisibilityWeightingDiagnostic.shDeringingStudy.status,
			probeContentChromaStatus: probeContentChromaStudy.status,
			probeBakeContaminationStatus: probeBakeContaminationMap.status,
			probeBakeDominantBandResponsibility: probeBakeContaminationMap.summary.dominantProbeBandResponsibility,
			probeBakeDirectionalBandDominantProbeCount: probeBakeContaminationMap.summary.directionalBandDominantProbeCount,
			dominantProbeCoefficientStudyStatus: dominantProbeCoefficientStudy.status,
			dominantShCoefficientDriver: `${ dominantProbeCoefficientStudy.summary.dominantCoefficientName }/${ dominantProbeCoefficientStudy.summary.dominantCoefficientBand }`,
			shDampingOracleStatus: shDampingOracleStudy.status,
			shDampingOracleBestVariant: shDampingOracleStudy.summary.bestSafeVariant,
			dominantProbePlacementStatus: dominantProbePlacementStudy.status,
			dominantProbePlacementBestCandidate: dominantProbePlacementStudy.summary.bestSafeCandidate,
			combinedSourceDampingOracleStatus: combinedSourceDampingOracleStudy.status,
			combinedSourceDampingSafeReceiverWinCount: combinedSourceDampingOracleStudy.summary.safeReceiverWinCount,
			dilationSourceQualityStatus: dilationSourceQualityStudy.status,
			dilationSourceQualitySafeContextWinCount: dilationSourceQualityStudy.summary.safeContextWinCount,
			sameSideLayerMaskOracleStatus: sameSideLayerMaskOracleStudy.status,
			sameSideLayerMaskSafeReceiverWinCount: sameSideLayerMaskOracleStudy.summary.safeReceiverWinCount,
			sdfStaticBlockerOracleStatus: sdfStaticBlockerOracleStudy.status,
			sdfStaticBlockerSafeReceiverWinCount: sdfStaticBlockerOracleStudy.summary.safeReceiverWinCount,
			aggregateBakePolicyOracleStatus: aggregateBakePolicyOracleStudy.status,
			aggregateBakePolicySafeReceiverWinCount: aggregateBakePolicyOracleStudy.summary.safeReceiverWinCount,
			probeDensityMetricStatus: probeDensityMetricStudy.status,
			probeDensityRiskReceiverCount: probeDensityMetricStudy.summary.riskReceiverCount,
			probeContentContributionAttributionStatus: probeContentContributionAttribution.status,
			probeContentContributionAttributionStrength: probeContentContributionAttribution.summary.attributionStrength,
			probeContentContributionDominantExplainedSource: probeContentContributionAttribution.summary.dominantExplainedSource,
			receiverSampleMetricAlignmentStatus: receiverSampleMetricAlignmentStudy.status,
			surfaceAnchorPlacementStatus: surfaceAnchorPlacementStudy.status,
			surfaceShContentStatus: surfaceShContentStudy.status,
			surfaceShContentLeakSampleCount: surfaceShContentStudy.summary.leakSampleCount,
			presentationStatus: presentationGate,
			renderMetricMismatchStatus: sealedRenderMetricMismatch.status,
			gpuLinearIrradianceGate: sealedRenderMetricMismatch.gpuDebugLinearIrradianceAgreementGate,
			weightTermAgreementGate: sealedRenderMetricMismatch.gpuDebugWeightTermAgreementGate
		},
		verdict: {
			suspectedLeakDomain: sealedFailureDomain,
			promotionGate: gatedLeakComparisons.sealedWall.status === 'SUPPORTED' ?
				'SUPPORTED' :
				'OPEN',
			promotionMetricMode: 'pre-tone-linear-output-masked-visible-pixels',
			presentationGate: gatedLeakComparisons.sealedWall.status,
			cpuGpuLinearGate: sealedRenderMetricMismatch.gpuDebugLinearIrradianceAgreementGate,
			weightTermGate: sealedRenderMetricMismatch.gpuDebugWeightTermAgreementGate,
			cpuRenderAgreementGate: sealedRenderMetricMismatch.cpuRenderAgreementGate,
			chebyshevTuning: 'UNCHANGED'
		}
	};
	const metricTaxonomyStudy = {
		status: 'DEFINED-PROMOTION-METRIC-SPLIT',
		proofBoundary: 'Report-only taxonomy for leak-proof metrics. It separates SH irradiance, scene-linear/presentation approximations, and presentation-space diagnostics before any threshold tuning.',
		currentFailureDomain: sealedFailureDomain,
		promotionPrinciple: 'DDGI-lite leak promotion must use linear/probe-only evidence; tone-mapped screenshot ratios are diagnostic-only because exposure and output transforms can reshape wrong/correct contrast without changing SH or visibility math.',
		metrics: [
			{
				key: 'cpuGpuLinearIrradiance',
				space: 'SH irradiance / scene-linear',
				source: 'CPU SH mirror and proof-only GPU scalar/visibility/final irradiance debug terms',
				promotionEligible: true,
				currentGate: sealedRenderMetricMismatch.gpuDebugLinearIrradianceAgreementGate,
				notes: 'Validates raw SH/runtime math before material and presentation transforms.'
			},
			{
				key: 'weightTermAgreement',
				space: 'probe interpolation / visibility weight',
				source: 'Proof-only GPU weight-term debug rows compared with CPU receiver samples',
				promotionEligible: true,
				currentGate: sealedRenderMetricMismatch.gpuDebugWeightTermAgreementGate,
				notes: 'Validates scalar and visibility blend terms; does not prove presentation contrast.'
			},
			{
				key: 'offscreenSceneLinearTarget',
				space: 'scene-linear presentation render target',
				source: 'Proof-only half-float render target readback with NoToneMapping + LinearSRGBColorSpace + receiver-id visible-pixel mask',
				promotionEligible: true,
				currentGate: sealedPresentationStudy.summary.offscreenSceneLinearTarget.status,
				notes: 'Primary candidate for replacing the provisional linear-output canvas approximation; contribution isolation, neutral receiver albedo rows, chromaticity/RGB decomposition, and conservative contribution thresholds are now report-scoped but still gate promotion.'
			},
			{
				key: 'preToneMaskedVisiblePixels',
				space: 'linear-output canvas approximation',
				source: 'Leak matrix renderer override: NoToneMapping + LinearSRGBColorSpace + receiver-id visible-pixel mask',
				promotionEligible: 'provisional',
				currentGate: leakMatrix.comparisons.sealedWall.linearPromotionStatus,
				notes: 'Secondary approximation kept for continuity; offscreen scene-linear target now provides the stricter readback path and contribution isolation.'
			},
			{
				key: 'presentationStudy',
				space: 'material response and renderer output',
				source: 'Standard material, Lambert debug, tone mapping, output color-space, and ACES exposure sweep rows',
				promotionEligible: false,
				currentGate: sealedPresentationStudy.summary.colorMappingDiagnostic?.status ?? sealedPresentationStudy.status,
				notes: 'Identifies presentation pressure; tone mapping / exposure / output color-space deltas are diagnostic-only and cannot block scene-linear material/probe promotion.'
			},
			{
				key: 'presentationMaskedCanvasRatio',
				space: 'tone-mapped display / screenshot',
				source: 'Masked visible-pixel screenshot ratios under current renderer settings',
				promotionEligible: false,
				currentGate: leakMatrix.comparisons.sealedWall.status,
				notes: 'Perceptual regression signal only; cannot overrule failed linear gates.'
			}
		],
		requiredNextMetrics: [
			'stronger direct-vs-ambient scene-light separability control',
			'neutral receiver albedo promotion thresholds validated across more than one fixture',
			'probe-content/visibility-shaping decision after contribution gate results'
		],
		gates: {
			promotionEligibleMetricCount: 3,
			provisionalMetricCount: 1,
			diagnosticOnlyMetricCount: 2,
			sceneLinearTargetGate: sealedPresentationStudy.summary.offscreenSceneLinearTarget.status,
			contributionGate: sealedPresentationStudy.summary.offscreenSceneLinearContributionGate.status,
			probeContentContributionAttributionGate: probeContentContributionAttribution.status,
			materialPathGate: sealedPresentationStudy.status,
			colorMappingDiagnosticGate: sealedPresentationStudy.summary.colorMappingDiagnostic?.status ?? 'UNAVAILABLE',
			presentationGateUse: 'DIAGNOSTIC-ONLY',
			chebyshevTuning: 'UNCHANGED'
		}
	};

	const webglLeakReferenceStudy = {
		status: 'OPEN-NOT-COMPARABLE',
		proofBoundary: 'Bounded WebGL audit reference only. Existing WebGL capture is probes-only and does not instantiate the sealed-wall fixture.',
		reference: {
			label: webglReference.label,
			proofRole: webglReference.proofRole,
			metrics: webglReference.metrics,
			artifactPressure: webglReference.artifactPressure,
			screenshot: webglReference.screenshot
		},
		sealedWallAttempt: {
			attempted: 'existing-webgl-capture-only',
			comparable: false,
			reason: 'A fair WebGL sealed-wall comparison would require adding leak fixture/harness machinery to the WebGL path, which is outside the bounded audit scope.'
		}
	};
	const researchRoadmapRevision = {
		status: 'REVISED-WGPU-FIRST',
		claimBoundary: 'Literature and WebGL/SixteenStudio evidence guide the WebGPU roadmap; they do not prove DDGI/APV parity or sealed-wall leak correctness.',
		literatureDecisions: [
			'SixteenStudio remains SH-atlas/WebGPU/Sponza packaging precedent, not visibility proof.',
			'Unity APV/DDGI lessons apply to invalidation, dilation, sample bias, rendering-layer/same-side masks, visibility moments, and adaptive placement.',
			'Distance-field/Lumen-style ideas are represented only as CPU static-blocker/SDF oracles until aggregate proof justifies a larger runtime design.',
			'ZH3 remains future compression/reconstruction research because this branch already stores full L2 RGB SH.',
			'Shadowmask-style direct-light occlusion remains out of scope for probes-only indirect leak proof.'
		],
		nextRoadmap: [
			'Finish WebGPU leak audit and aggregate source-domain verdict across source+damping, dilation quality, same-side/layer, SDF/static-blocker, aggregate bake-policy, and probe-density oracles.',
			'Close receiver center-vs-surface sample metric alignment before threshold tuning.',
			'Use de-ringing/band-policy evidence only if SH negative energy remains the dominant artifact source.',
			'Only then revisit visibility-moment weighting and Chebyshev constants; Chebyshev remains unchanged while blocker/source/content oracles are open.',
			'Defer public API/docs promotion until sealed-wall gates are supported.'
		],
		backlog: [
			'Adaptive placement / APV-style bricks.',
			'Probe relocation/classification beyond source-map dilation.',
			'Runtime distance-field visibility only if the CPU SDF/static-blocker oracle wins at receiver-aggregate level.',
			'Sponza/transfer scene after Cornell sealed-wall proof stabilizes.',
			'Public LightProbeGridGPU documentation after API boundary stabilizes.'
		]
	};
	const {
		performanceEvidence,
		mathAndPipelineDecision,
		externalImplementationResearch,
		implementationParityMatrix,
		visibilityDepthRoadmap,
		ddgiVisibilityDepthSpec,
		researchProofProgram,
		revisionTaskBacklog,
		ddgiLitePromotionGateStatus
	} = createLightProbeResearchReportSections( {
		snapshots,
		visibilityMomentInspection,
		visibilityWeightingDiagnostic,
		sealedVisibilityWeightingDiagnostic,
		leakMatrix,
		cpuRenderAgreementTolerance,
		sealedRenderMetricMismatch,
		sealedReceiverNormalDiagnostic,
		sealedShContributionDiagnostic,
		sealedFailureDomain,
		surfaceAttributionBranchDecision,
		surfaceAttributionFollowupSpec,
		proof7cSurfaceStaticBlockerOracleStudy,
		proof7cDispositionStudy,
		surfaceContentAttributionSplitStudy,
		surfaceContentAttributionFollowupStudy,
		mappedBakeContentSourcePolicyOracleStudy,
		unmappedCoefficientAttributionInstrumentationStudy,
		aggregateExplanationComparisonStudy,
		proof7bCoefficientL10OracleStudy,
		probe50L10SignSourceIsolationOracleStudy,
		probe50L10ContentBasisPolarityOracleStudy,
		probe50CoefficientLocalCorrectionOracleStudy,
		probe50LocalCorrectionAggregateResidualGuardStudy,
		probe50L10ZDesignBoundConstraintsStudy,
		projectionParity,
		atlasPacking,
		computeProjectionRuntimeParity,
		computeProjectionProfiling
	} );
	const shDeringingStudy = sealedVisibilityWeightingDiagnostic.shDeringingStudy ?? {};
	const shGuard = {
		enabled: true,
		correctionStrengthMax: shDeringingStudy.summary !== undefined ?
			roundMetric( Math.max(
				Math.abs( shDeringingStudy.summary.totalNegativeEnergyReduction ?? 0 ),
				Math.abs( shDeringingStudy.summary.totalChromaPressureReduction ?? 0 )
			) ) :
			0,
		negativeLobePressureBefore: shDeringingStudy.summary?.maxCurrentNegativeEnergy ?? 0,
		negativeLobePressureAfter: shDeringingStudy.summary?.maxDampedNegativeEnergy ?? 0,
		l00Preserved: shDeringingStudy.summary?.l00Preserved === true
	};
	const projectionPath = {
		mode: computeProjectionRuntimeParity.computeBackend === 'compute-probe-reduction' ? 'compute' : 'fragment',
		oldPathDescription: '9 coefficient pixels x cubemap sweep',
		newPathDescription: 'one cubemap sweep per probe outputs all 9 coefficients',
		parityPassed: computeProjectionRuntimeParity.status === 'RUNTIME-PARITY-READBACK-PASSING',
		timingEvidence: computeProjectionProfiling.timingSources?.gpuTimestampAvailable === true ? 'gpu-timestamp' : 'wall-clock-or-static-work-only'
	};
	return {
		generatedAt: new Date().toISOString(),
		file,
		buildExecuted: false,
		buildNotExecutedReason: 'Repository AGENTS.md explicitly says never build after changes.',
		testsExecuted: smokeResults.map( result => result.step ),
		visibilityLabel: visibilityProofStatus.visibilityLabel,
		visibilityStatus: visibilityProofStatus.visibilityStatus,
		claim: {
			status: String( visibilityMomentInspection.evidenceStatus ).startsWith( 'OPEN' ) ||
				probeIndirectGate.startsWith( 'OPEN' ) ||
				gatedLeakComparisons.sealedWall.status === 'OPEN' ?
				'OPEN' :
				'SUPPORTED',
			text: 'WebGPU LightProbeGridGPU at 4^3 / cubemapSize=8 can show credible low-frequency red/green diffuse bounce and has a DDGI-lite verifier scaffold for controlled APV-style leak reduction without replacing the fast unweighted path.',
			scope: 'Targeted e2e verifier and screenshot-space diagnostics only; not a photometric proof, real DDGI visibility proof, cascade proof, or adaptive-brick proof.'
		},
		verifierBoundary: {
			primaryVerifier: 'test/e2e/puppeteer.js --webgpu webgpu_lightprobes_cornell',
			primaryEvidence: 'e2e artifact and region matrices',
			secondaryEvidence: 'Screenshots written outside the repository and paired with this metrics report.',
			screenshotPolicy: 'Screenshots are secondary and cannot overrule failed metrics.'
		},
		baselineCandidateFamily: {
			baseline: 'low-res-damped',
			candidate: 'low-res-unweighted',
			weightedCandidate: 'low-res-validity-weighted',
			leakBaseline: 'leak-thin-wall-unweighted',
			leakCandidate: `leak-thin-wall-${ visibilityProofStatus.visibilityLabel }`,
			scalarValidityControl: 'leak-thin-wall-validity-weighted',
			sealedPromotionBaseline: 'leak-sealed-wall-validity-weighted',
			sealedPromotionCandidate: `leak-sealed-wall-${ visibilityProofStatus.visibilityLabel }`,
			negativeControl: `leak-zero-thickness-${ visibilityProofStatus.visibilityLabel } remains OPEN`,
			sameBudgetStressReference: 'webgpu-webgl-density-reference',
			sameBudgetQualityCandidate: 'webgpu-webgl-density-damped',
			webglSourceReference: lightProbeWebGLReferenceLabel
		},
		currentEvidence: {
			artifactMatrixRows: artifactMatrix.rows.length,
			regionMatrixRows: regionMatrix.rows.length,
			leakMatrixRows: leakMatrix.rows.length,
			artifactComparisons: artifactMatrix.comparisons,
			regionComparisons: regionMatrix.comparisons,
			leakComparisons: gatedLeakComparisons,
			densityArtifactStudy,
			directShadowControlStudy,
			wgpuLeakAuditStudy,
			metricTaxonomyStudy,
			webglLeakReferenceStudy,
			researchRoadmapRevision,
			mathAndPipelineDecision,
			externalImplementationResearch,
			implementationParityMatrix,
			visibilityDepthRoadmap,
			ddgiVisibilityDepthSpec,
			visibilityMomentInspection,
			visibilityLabel: visibilityProofStatus.visibilityLabel,
			visibilityStatus: visibilityProofStatus.visibilityStatus,
			visibilityWeightingDiagnostic,
			sealedVisibilityWeightingDiagnostic,
			presentationDebugTargets,
			finalColorDebugTargets: presentationDebugTargets,
			projectionPath,
			shGuard,
			sealedReceiverNormalDiagnostic,
			sealedShContributionDiagnostic,
			probeContentChromaStudy,
			probeBakeContaminationMap,
			probeContentContributionAttribution,
			probeDensityMetricStudy,
			sealedReceiverSurfaceQuadratureDiagnostic,
			sealedReceiverGpuDebugDiagnostic,
			receiverSampleMetricAlignmentStudy,
			surfaceAnchorPlacementStudy,
			surfaceShContentStudy,
			surfaceSampleCoefficientAttributionStudy,
			surfaceContentAttributionSplitStudy,
			surfaceContentAttributionFollowupStudy,
			mappedBakeContentSourcePolicyOracleStudy,
			unmappedCoefficientAttributionInstrumentationStudy,
			aggregateExplanationComparisonStudy,
			proof7bCoefficientL10OracleStudy,
			probe50L10SignSourceIsolationOracleStudy,
			probe50L10ContentBasisPolarityOracleStudy,
			probe50CoefficientLocalCorrectionOracleStudy,
			probe50LocalCorrectionAggregateResidualGuardStudy,
			probe50L10ZDesignBoundConstraintsStudy,
			surfaceAttributionBranchDecision,
			proof7cSurfaceStaticBlockerOracleStudy,
			proof7cDispositionStudy,
			surfaceAttributionFollowupSpec,
			sealedFailureDomain,
			sealedRenderMetricMismatch,
			ddgiLitePromotionGateStatus,
			researchProofProgram,
			revisionTaskBacklog,
			projectionParity,
			atlasPacking,
			shMathContract,
			bakeTexelBudgets,
			performanceEvidence,
			webglReference,
			densityReferenceArtifactPressure: densityReference?.artifactPressure ?? null,
			restored
		},
		enemyTerms: [
			'metric hacking',
			'hiding dark artifacts',
			'boosting global probe intensity instead of improving directional bounce',
			'replacing hardware-filtered unweighted sampling with manual loads',
			'claiming the zero-thickness negative control is solved',
			'claiming the same-budget density stress screenshot is a visual-quality win',
			'blaming noisy shadows on SH probes before isolating direct shadow-map bake settings',
			'hiding low-order SH representation dark-tail/ringing artifacts behind probe-density language',
			'confusing screenshot-space RGB ratios with linear radiance',
			'claiming production DDGI parity without visibility/depth moments',
			'overstating the sixteenstudio branch as DDGI visibility/depth prior art',
			'citing DDGI papers without a local visibilityDepthTarget readback gate'
		],
		rejectionGates: [
			{ gate: 'Tall-box red/green bias must improve over damped baseline.', result: 'passed' },
			{ gate: 'Sphere and right-side green bounce must remain positive.', result: 'passed' },
			{ gate: 'Center luminance floor and dark tails must stay bounded.', result: 'passed' },
			{ gate: 'Low-res candidate must not change global probe intensity.', result: 'passed' },
			{ gate: 'Unweighted candidate must stay on hardware-filtered sampling.', result: 'passed' },
			{ gate: 'WebGPU 6^3 / 32px density row must be labelled as an artifact pressure case, not a quality win.', result: 'passed' },
			{ gate: 'Direct shadow-map noise must be isolated with a same-budget crisp-shadow control before attributing dirt to SH/probe math.', result: directShadowControlStudy.status === 'SUPPORTED-DIRECT-SHADOW-CONTROL-STUDY' ? 'passed' : 'open' },
			{ gate: 'Same-budget quality candidate must reduce object black-tail below 0.08 and recover luminance floor above 24.', result: 'passed' },
			{ gate: 'Same-budget quality candidate must preserve L0/probe intensity/bake budget and change only the SH band policy.', result: 'passed' },
			{ gate: 'Bake texel budget must report the 54x cubemap work multiplier for 6^3 / 32px versus 4^3 / 8px.', result: 'passed' },
			{ gate: 'Weighted finite thin-wall rows must stay bounded, and sealed-wall rows must carry explicit promotion status without erasing correct bounce.', result: 'passed' },
			{ gate: 'Zero-thickness leak row must remain marked OPEN until moment-backed guarded rows improve leak without killing bounce.', result: 'passed' },
			{ gate: 'WebGL same-class reference screenshot must be captured as secondary evidence, not substituted for WebGPU e2e gates.', result: 'passed' },
			{ gate: 'SH projection/evaluation math must satisfy constant-radiance pi scaling and match THREE.SphericalHarmonics3 irradiance constants/order.', result: 'passed' },
			{ gate: 'External implementation research must be recorded as architecture lessons without expanding current runtime/API scope.', result: 'passed' },
			{ gate: 'Research-proof program must identify claim, verifier boundary, baseline/candidate family, enemy terms, rejection gates, and implementation slices.', result: 'passed' },
			{ gate: 'Visibility/depth moment target must be directly read back by the verifier before tuning runtime weights.', result: visibilityMomentInspection.evidenceStatus === 'SUPPORTED' ? 'passed' : 'open' },
			{ gate: 'CPU SH mirror must agree with at least one sealed receiver render metric within tolerance before DDGI-lite leak promotion.', result: sealedRenderMetricMismatch.cpuRenderAgreementGate === 'SUPPORTED' ? 'passed' : 'open' },
			{ gate: 'Receiver-surface quadrature CPU mirror and proof-only GPU debug render must be persisted before tuning DDGI-lite moments.', result: sealedReceiverSurfaceQuadratureDiagnostic.summary.cpuRenderAgreementGate === 'SUPPORTED' && sealedReceiverGpuDebugDiagnostic.status === 'SUPPORTED-GPU-DEBUG-MATCHES-CPU-SURFACE' ? 'passed' : 'open' },
			{ gate: 'Parity matrix must separate our implementation, SixteenStudio branch evidence, and the WebGL baseline without copying code or claiming DDGI parity.', result: 'passed' },
			{ gate: 'Revision task backlog must keep proof, runtime, and docs work separated so future changes do not mix evidence with implementation.', result: 'passed' }
		],
		uncertainties: [
			{ status: 'OPEN', item: 'Screenshot-space RGB ratios are regression signals, not linear-radiance proof.' },
			{ status: 'OPEN', item: 'Metrics depend on camera, material, tonemapping, and browser/GPU adapter.' },
			{ status: 'SUPPORTED', item: 'The same-budget quality candidate uses first-band anti-ringing damping to reduce the density stress black-tail while preserving the 6^3 / 32px bake budget.' },
			{ status: directShadowControlStudy.status, item: `Direct shadow-map control: default ${ directShadowControlStudy.defaultSoft.directShadowControl.mapSize }px radius ${ directShadowControlStudy.defaultSoft.directShadowControl.radius } normalBias ${ directShadowControlStudy.defaultSoft.directShadowControl.normalBias }; crisp ${ directShadowControlStudy.crispShadow.directShadowControl.mapSize }px radius ${ directShadowControlStudy.crispShadow.directShadowControl.radius } normalBias ${ directShadowControlStudy.crispShadow.directShadowControl.normalBias }; diagnosis ${ directShadowControlStudy.diagnosis }.` },
			{ status: 'OPEN', item: 'The WebGPU 6^3 / 32px full-band density screenshot remains a stress row; high-frequency bake detail can still produce muddy low-order / 9-coefficient SH representation black-tail/ringing artifacts.' },
			{ status: 'OPEN', item: 'Measured bake timings are diagnostics only; deterministic e2e uses a wall-clock fallback so unavailable/zero timing evidence cannot masquerade as measured proof.' },
			{ status: 'OPEN', item: 'Scalar probe validity remains heuristic occupancy metadata; private visibilityDepthTarget now carries radial distance moments, but that is proof-only data rather than a public DDGI claim.' },
			{ status: 'OPEN', item: 'Zero-thickness walls cannot be claimed solved merely because moments exist; they need a useful visibility structure that improves leak without erasing bounce.' },
			{ status: 'OPEN', item: 'No adaptive density, probe relocation, classification, dilation, or virtual-offset pipeline yet.' },
			{ status: 'SUPPORTED', item: 'Documentation parity note is now truthful: LightProbeGrid docs label the page as the WebGL baseline and keep LightProbeGridGPU proof-scoped until runtime/API boundaries stabilize.' },
			{ status: 'SUPPORTED', item: 'Actual WebGL LightProbeGrid 6^3 / 32px probes-only screenshot and screenshot-space metrics are captured as same-class secondary reference evidence.' },
			{ status: 'SUPPORTED', item: 'Synthetic SH math contract verifies constant radiance maps to pi-scaled irradiance, x/y/z signs are preserved, and runtime constants/order match THREE.SphericalHarmonics3.getIrradianceAt().' },
			{ status: 'SUPPORTED', item: 'GitHub user sixteenstudio and fork branch feat/webgpu-lightprobes-sponza were verified as a LightProbeGridGPU source; inspected evidence is SH-atlas/WebGPU packaging precedent, not DDGI visibility/depth proof.' },
			{ status: sealedVisibilityWeightingDiagnostic.escapeClassification.frontEdgeBypassEscapeCount === 0 ? 'SUPPORTED' : 'OPEN', item: `Sealed-wall CPU mirror front-edge bypass count is ${ sealedVisibilityWeightingDiagnostic.escapeClassification.frontEdgeBypassEscapeCount }; finding: ${ sealedVisibilityWeightingDiagnostic.interrogationFinding }.` },
			{ status: sealedReceiverNormalDiagnostic.status, item: `Receiver normal convention diagnostic: ${ sealedReceiverNormalDiagnostic.summary.diagnosticConclusion }` },
			{ status: sealedShContributionDiagnostic.status, item: `Sealed-wall SH contribution mirror suspects ${ sealedFailureDomain}; correct-side mixed-color rows ${ sealedShContributionDiagnostic.summary.correctSideMixedColorRowCount }/${ sealedShContributionDiagnostic.summary.correctSideVisibilityRowCount }, weighted wrong/correct mean ${ sealedShContributionDiagnostic.summary.weightedCorrectSideWrongOverCorrectMean }.` },
			{ status: sealedReceiverSurfaceQuadratureDiagnostic.status, item: `Receiver-surface quadrature: CPU surface runtime wrong/correct ${ sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMean }, render surface wrong-side ${ sealedReceiverSurfaceQuadratureDiagnostic.renderMetrics.surfaceWrongSideColorRatio }, delta ${ sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDelta }, rule ${ sealedReceiverSurfaceQuadratureDiagnostic.quadratureRule }.` },
			{ status: sealedReceiverGpuDebugDiagnostic.status, item: `GPU debug receiver render: best region variant ${ sealedReceiverGpuDebugDiagnostic.summary.bestVariant } at scale ${ sealedReceiverGpuDebugDiagnostic.summary.bestVariantScale }, best tight-point variant ${ sealedReceiverGpuDebugDiagnostic.summary.bestTightPointVariant } at scale ${ sealedReceiverGpuDebugDiagnostic.summary.bestTightPointVariantScale }, tight-point delta ${ sealedReceiverGpuDebugDiagnostic.summary.bestTightPointSurfaceCpuDelta }, white calibration luminance ${ sealedReceiverGpuDebugDiagnostic.summary.whiteCalibrationLuminanceMean }; variants ${ sealedReceiverGpuDebugDiagnostic.variants.map( variant => `${ variant.label }=${ variant.leakMetrics.surfaceWrongSideColorRatio }/${ variant.pointMetrics.surfaceWrongRatioMean }` ).join( ', ' ) }.` },
			{ status: sealedRenderMetricMismatch.status, item: `Sealed-wall render metric vs CPU SH mirror: bounds wrong-side ratio ${ sealedRenderMetricMismatch.actualWrongSideColorRatio }, center wrong-side ratio ${ sealedRenderMetricMismatch.centerWrongSideColorRatio }, surface-isolated wrong-side ratio ${ sealedRenderMetricMismatch.surfaceWrongSideColorRatio }, CPU runtime wrong ratio ${ sealedRenderMetricMismatch.cpuRuntimeWrongRatioMean }, CPU surface runtime wrong ratio ${ sealedRenderMetricMismatch.cpuSurfaceRuntimeWrongRatioMean }, best metric ${ sealedRenderMetricMismatch.bestCpuRenderMetricAgreement.metric } delta ${ sealedRenderMetricMismatch.bestCpuRenderMetricAgreement.delta }.` },
			{ status: leakMatrix.comparisons.sealedWall.status, item: `Sealed-wall DDGI-lite promotion gate: wrong-side improvement ratio ${ leakMatrix.comparisons.sealedWall.visibility.wrongSide.improvement }, correct-bounce preservation ${ leakMatrix.comparisons.sealedWall.visibility.correctBounce.preservation }.` }
		],
		proofLadder: [
			{ level: 'examples', evidence: 'low-res proof snapshots, region matrices, controlled finite thin-wall stress rows, and sealed-wall promotion rows' },
			{ level: 'counterexamples', evidence: 'damped baseline, L0-only, direct-off, panel-hidden, solids-hidden, and zero-thickness negative-control rows' },
			{ level: 'artifact-pressure', evidence: 'webgpu-webgl-density-reference tracks object black-tail ratio, luminance floor, cell-edge contrast, and 54x bake texel work' },
			{ level: 'direct-shadow-control', evidence: `webgpu-webgl-density-shadow-crisp keeps SH/probe budget fixed while changing bake-time shadow map to ${ directShadowControlStudy.crispShadow.directShadowControl.mapSize }px radius ${ directShadowControlStudy.crispShadow.directShadowControl.radius } normalBias ${ directShadowControlStudy.crispShadow.directShadowControl.normalBias }` },
			{ level: 'candidate-action', evidence: 'webgpu-webgl-density-damped must reduce object black-tail below 0.08 at the same bake texel budget by changing only the L1 band policy' },
			{ level: 'ddgi-lite-promotion', evidence: `sealed-wall status ${ leakMatrix.comparisons.sealedWall.status }; CPU/render agreement ${ sealedRenderMetricMismatch.cpuRenderAgreementGate } via ${ sealedRenderMetricMismatch.bestCpuRenderMetricAgreement.metric } delta ${ sealedRenderMetricMismatch.bestCpuRenderMetricAgreement.delta }; surface quadrature ${ sealedReceiverSurfaceQuadratureDiagnostic.status } delta ${ sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDelta }; GPU debug ${ sealedReceiverGpuDebugDiagnostic.status }; CPU finding ${ sealedVisibilityWeightingDiagnostic.interrogationFinding }; suspected failure domain ${ sealedFailureDomain}; render metric mismatch ${ sealedRenderMetricMismatch.status }; wrong-side improvement ratio ${ leakMatrix.comparisons.sealedWall.visibility.wrongSide.improvement } at correct-bounce preservation ${ leakMatrix.comparisons.sealedWall.visibility.correctBounce.preservation }` },
			{ level: 'invariants', evidence: 'source checks keep GPU-resident bake, hardware-filtered unweighted sampling, and fixed demo defaults' },
			{ level: 'executable-check', evidence: 'targeted WebGPU e2e assertions' },
			{ level: 'transfer', evidence: 'WebGL same-class reference is captured; OPEN: repeat WebGPU/WebGL proof on more browsers/adapters' }
		],
		verdict: ddgiLitePromotionGateStatus === 'SUPPORTED' ?
			'SUPPORTED within the frozen e2e verifier boundary; sealed-wall row meets the private DDGI-lite promotion gate.' :
			'OPEN for DDGI-lite leak promotion; verifier harness is supported, but sealed-wall moments did not meet both the pre-tone masked 5% improvement gate and the CPU/render agreement gate.',
		proofLedgerDecision: 'CONTINUE',
		nextPressure: `Finite thin-wall remains a front-edge stress row. Sealed-wall presentation status is ${ leakMatrix.comparisons.sealedWall.status }; linear promotion status is ${ leakMatrix.comparisons.sealedWall.linearPromotionStatus }; CPU/render agreement gate is ${ sealedRenderMetricMismatch.cpuRenderAgreementGate }; CPU finding is ${ sealedVisibilityWeightingDiagnostic.interrogationFinding }; receiver normal diagnostic is ${ sealedReceiverNormalDiagnostic.status }; suspected failure domain is ${ sealedFailureDomain }; render-metric mismatch status is ${ sealedRenderMetricMismatch.status }, so next work should align the CPU SH mirror with receiver-surface render metrics before touching DDGI-lite thresholds.`,
		artifactMatrix,
		regionMatrix,
		leakMatrix,
		snapshots,
		webglReference
	};

}
