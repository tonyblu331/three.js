import { Image } from './image.js';
import {
	hasBatch,
	hasFiniteCountHistograms,
	hasUniqueExactIds,
	isFiniteCountHistogram,
	matchesMappedBakeContentOracleRows,
	matchesUnmappedCoefficientInstrumentationRows,
	sameCountHistogramBy,
	studyRows
} from './lightprobegrid-gpu-artifact-assertion-helpers.js';
import { assertLightProbePerformanceEvidenceContract } from './lightprobegrid-gpu-artifact-performance-assertions.js';
import { createLightProbeImageArtifactPressure, captureLightProbeImageRegions } from './lightprobegrid-gpu-image-metrics.js';
import { createLightProbeProofMarkdown } from './lightprobegrid-gpu-proof-markdown.js';
import { createLightProbeProofReport } from './lightprobegrid-gpu-proof-report.js';
import {
	roundMetric,
	sumRequiredMetricBy as roundedRowSum
} from './lightprobegrid-gpu-report-metrics.js';
import { deriveVisibilityProofStatus, isMomentBackedVisibility } from './lightprobegrid-gpu-proof-visibility.js';
import {
	assertLightProbeProof,
	validateLightProbeParitySnapshot,
	validateLightProbeParitySnapshots,
	validateLightProbeWebGLReference
} from './lightprobegrid-gpu-proof-validation.js';
import {
	lightProbeParityArtifactDir,
	lightProbeParitySnapshotLabels,
	lightProbeWebGLReferenceLabel
} from './lightprobegrid-gpu-smoke-config.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function writeLightProbeGroundingParityArtifacts( page, file, smokeHarness, smokeResults, options = {} ) {

	if ( file !== 'webgpu_lightprobes_cornell' ) return;

	await fs.rm( lightProbeParityArtifactDir, { recursive: true, force: true } );
	await fs.mkdir( lightProbeParityArtifactDir, { recursive: true } );

	const snapshots = [];
	let restored;

	try {

		for ( const label of lightProbeParitySnapshotLabels ) {

			const snapshot = await page.evaluate(
				async ( globalName, label ) => await window[ globalName ].applyGroundingParitySnapshot( label ),
				smokeHarness.global,
				label
			);

			validateLightProbeParitySnapshot( file, snapshot );

			const screenshot = path.join( lightProbeParityArtifactDir, `${ label }.png` );
			await page.screenshot( { path: screenshot } );

			snapshots.push( {
				...snapshot,
				screenshot
			} );

		}

	} finally {

		restored = await page.evaluate(
			async globalName => await window[ globalName ].restoreGroundingParitySnapshot(),
			smokeHarness.global
		);

	}

	validateLightProbeParitySnapshots( file, snapshots );
	assertLightProbeProof( file, restored.status === 'ready' &&
		restored.hasTexture === true &&
		restored.hasBoundingBox === true,
	'grounding parity artifact: expected ready demo state restoration after screenshot capture.' );

	const webglReference = await captureLightProbeWebGLReference( page, options );
	validateLightProbeWebGLReference( file, webglReference );

	const report = createLightProbeProofReport( file, smokeResults, snapshots, restored, webglReference );
	const currentEvidence = report.currentEvidence;
	const proof7cStudy = currentEvidence?.proof7cSurfaceStaticBlockerOracleStudy;
	const proof7cRows = proof7cStudy?.rows ?? [];
	const proof7cBlockedReceivers = new Set( proof7cRows
		.filter( row => row.staticBlocked === true )
		.map( row => row.receiver )
	);
	const sdfStaticBlockerOracleStudy = currentEvidence?.probeBakeContaminationMap?.sdfStaticBlockerOracleStudy;
	const safeSdfAggregateReceivers = sdfStaticBlockerOracleStudy?.receiverRows
		.filter( row =>
			row.bestCandidateLabel !== 'none' &&
			row.bestCandidateCorrectChannelPreservation >= sdfStaticBlockerOracleStudy.thresholds.correctChannelPreservation &&
			(
				row.bestCandidateChromaImprovement >= sdfStaticBlockerOracleStudy.thresholds.chromaImprovement ||
				row.bestCandidateWrongRatioImprovement >= sdfStaticBlockerOracleStudy.thresholds.wrongRatioImprovement
			)
		)
		.map( row => row.receiver ) ?? [];
	const expectedProof7cOverlapReceivers = [ ...new Set( safeSdfAggregateReceivers.filter( receiver =>
		proof7cBlockedReceivers.has( receiver )
	) ) ].sort();
	const reportedProof7cOverlapReceivers = [ ...( proof7cStudy?.summary?.overlappingSafeReceivers ?? [] ) ].sort();
	const proof7cStatus = proof7cStudy?.status;
	const proof7cMissingAuditCount = proof7cStudy?.summary?.missingSurfacePathAuditCount;
	const proof7cMissingAuditStatus = proof7cStatus === 'OPEN-PROOF-7C-SURFACE-STATIC-BLOCKER-MISSING-PATH-AUDIT';
	const surfaceContentSplitStudy = surfaceContentSplitStudy;
	const surfaceContentSplitSummary = surfaceContentSplitStudy?.summary ?? {};
	const surfaceContentSplitRows = studyRows( surfaceContentSplitStudy );
	const surfaceContentMappedRows = surfaceContentSplitRows.filter( row => row.mappedToContentPressure === true );
	const surfaceContentUnmappedRows = surfaceContentSplitRows.filter( row => row.mappedToContentPressure === false );
	const expectedSurfaceContentSplitStatus = surfaceContentSplitSummary.leakSampleCount === 0 ?
		'SUPPORTED-SURFACE-CONTENT-ATTRIBUTION-SPLIT-BOUNDED' :
		surfaceContentSplitRows.length === 0 ?
			'OPEN-SURFACE-CONTENT-ATTRIBUTION-UNDER-INSTRUMENTED' :
			surfaceContentMappedRows.length > 0 && surfaceContentUnmappedRows.length > 0 ?
				'OPEN-SURFACE-CONTENT-ATTRIBUTION-SPLIT' :
				surfaceContentMappedRows.length > 0 ?
					'OPEN-SURFACE-CONTENT-ATTRIBUTION-MAPPED' :
					'OPEN-SURFACE-CONTENT-ATTRIBUTION-UNMAPPED';
	const expectedSurfaceContentMappedCoverage = surfaceContentSplitSummary.leakSampleCount > 0 ?
		roundMetric( surfaceContentMappedRows.length / surfaceContentSplitSummary.leakSampleCount ) :
		1;
	const surfaceContentFollowupStudy = surfaceContentFollowupStudy;
	const surfaceContentFollowupRows = studyRows( surfaceContentFollowupStudy );
	const mappedBakeContentSourcePolicyOracleStudy = mappedBakeContentSourcePolicyOracleStudy;
	const mappedBakeContentSourcePolicyOracleRows = studyRows( mappedBakeContentSourcePolicyOracleStudy );
	const unmappedCoefficientAttributionInstrumentationStudy = unmappedCoefficientAttributionInstrumentationStudy;
	const unmappedCoefficientAttributionInstrumentationRows = studyRows( unmappedCoefficientAttributionInstrumentationStudy );
	const aggregateExplanationComparisonStudy = aggregateExplanationComparisonStudy;
	const aggregateExplanationComparisonRows = studyRows( aggregateExplanationComparisonStudy );
	const proof7bCoefficientL10OracleStudy = proof7bCoefficientL10OracleStudy;
	const proof7bCoefficientL10OracleRows = studyRows( proof7bCoefficientL10OracleStudy );
	const probe50L10SignSourceIsolationOracleStudy =
		probe50L10SignSourceIsolationOracleStudy;
	const probe50L10SignSourceIsolationRows = studyRows( probe50L10SignSourceIsolationOracleStudy );
	const probe50L10ContentBasisPolarityOracleStudy =
		probe50L10ContentBasisPolarityOracleStudy;
	const probe50L10ContentBasisPolarityRows = studyRows( probe50L10ContentBasisPolarityOracleStudy );
	const probe50CoefficientLocalCorrectionOracleStudy =
		probe50CoefficientLocalCorrectionOracleStudy;
	const probe50CoefficientLocalCorrectionRows = studyRows( probe50CoefficientLocalCorrectionOracleStudy );
	const probe50LocalCorrectionAggregateResidualGuardStudy =
		probe50LocalCorrectionAggregateResidualGuardStudy;
	const probe50LocalCorrectionAggregateResidualGuardRows = studyRows( probe50LocalCorrectionAggregateResidualGuardStudy );
	const probe50L10ZDesignBoundConstraintsStudy =
		probe50L10ZDesignBoundConstraintsStudy;
	const probe50L10ZDesignBoundConstraintRows = studyRows( probe50L10ZDesignBoundConstraintsStudy );
	const allAggregateExplanationRows = [
		...mappedBakeContentSourcePolicyOracleRows,
		...unmappedCoefficientAttributionInstrumentationRows
	];
	const l10AggregateExplanationRows = allAggregateExplanationRows.filter( row =>
		row.attributionDominantCoefficient === 'L10' &&
		row.attributionDominantCoefficientBand === 'l1'
	);
	const l10WrongChannelPressure = roundedRowSum( l10AggregateExplanationRows, 'attributionWrongChannelPressure' );
	const l10CorrectChannelPreservation = roundedRowSum( l10AggregateExplanationRows, 'attributionCorrectChannelPreservation' );
	const probe50L10Rows = l10AggregateExplanationRows.filter( row =>
		row.attributionSourceProbeIndex === 50
	);
	const probe50PolarityRowsPositive = probe50L10ContentBasisPolarityRows.length > 0 &&
		probe50L10ContentBasisPolarityRows.every( row =>
			row.coefficient === 'L10' &&
			row.coefficientBand === 'l1' &&
			row.basis === 'z' &&
			row.basisScale > 0 &&
			row.l10RawCorrect < row.l10RawWrong &&
			row.wrongMinusCorrect > 0 &&
			row.l00WrongMinusCorrect < 0 &&
			row.l11WrongMinusCorrect < 0
		);
	const probe50LocalCorrectionRowsWin = probe50CoefficientLocalCorrectionRows.length > 0 &&
		probe50CoefficientLocalCorrectionRows.every( row =>
			row.coefficient === 'L10' &&
			row.coefficientBand === 'l1' &&
			row.basis === 'z' &&
			row.correctionScope === 'probe-50/L10/z-only' &&
			row.currentWeightedWrongMinusCorrect > 0 &&
			row.correctedWeightedWrongMinusCorrect === 0 &&
			row.estimatedWrongPressureReduction > 0 &&
			row.preservesL00 === true &&
			row.preservesL11 === true &&
			row.preservesOtherCoefficientRows === true
		);
	const expectedAggregateWrongAfter = roundMetric(
		( probe50CoefficientLocalCorrectionOracleStudy?.summary?.estimatedDominantWrongPressureAfterCorrection ?? 0 ) +
		( proof7bCoefficientL10OracleStudy?.summary?.residualWrongChannelPressure ?? 0 )
	);
	const expectedAggregateReduction = roundMetric( l10WrongChannelPressure - expectedAggregateWrongAfter );
	const expectedProof7cDispositionStatus = proof7cStudy?.summary?.selected === false ?
		'NOT-SELECTED-PROOF-7C-DISPOSITION' :
		proof7cStudy?.status === 'SUPPORTED-PROOF-7C-CPU-STATIC-BLOCKER-AGGREGATE-WIN' ?
			'SUPPORTED-PROOF-7C-DISPOSITION-REVIEW-RUNTIME-PROMOTION' :
			proof7cStudy?.summary?.missingSurfacePathAuditCount === 0 ?
				'CLOSED-PROOF-7C-DISPOSITION-NO-RUNTIME-PROMOTION' :
				'OPEN-PROOF-7C-DISPOSITION-MISSING-EVIDENCE';
	const expectedSurfaceContentFollowupStatus =
		surfaceContentSplitStudy?.status === 'SUPPORTED-SURFACE-CONTENT-ATTRIBUTION-SPLIT-BOUNDED' ?
			'SUPPORTED-SURFACE-CONTENT-FOLLOWUP-BOUNDED' :
			surfaceContentSplitStudy?.status === 'OPEN-SURFACE-CONTENT-ATTRIBUTION-UNDER-INSTRUMENTED' ?
				'OPEN-SURFACE-CONTENT-FOLLOWUP-UNDER-INSTRUMENTED' :
				surfaceContentMappedRows.length > 0 && surfaceContentUnmappedRows.length > 0 ?
					'OPEN-SURFACE-CONTENT-DUAL-BUCKET-FOLLOWUP' :
					surfaceContentMappedRows.length > 0 ?
						'OPEN-SURFACE-CONTENT-MAPPED-BUCKET-FOLLOWUP' :
						'OPEN-SURFACE-CONTENT-UNMAPPED-BUCKET-FOLLOWUP';
	const probeContentContributionAttribution = currentEvidence.probeContentContributionAttribution;
	assertLightProbeProof( file, Array.isArray( report.artifactMatrix.rows ) &&
		Array.isArray( report.regionMatrix.rows ) &&
		report.artifactMatrix.rows.length > 0 &&
		report.regionMatrix.rows.length > 0,
	'grounding parity artifact: proof report must persist raw artifact and region matrices for auditability.' );
	assertLightProbePerformanceEvidenceContract( file, currentEvidence, lightProbeWebGLReferenceLabel );
	assertLightProbeProof( file,
		currentEvidence.wgpuLeakAuditStudy !== undefined &&
		[ 'OPEN', 'SUPPORTED' ].includes( currentEvidence.wgpuLeakAuditStudy.status ) &&
		currentEvidence.wgpuLeakAuditStudy.variants.length === 4 &&
		currentEvidence.wgpuLeakAuditStudy.receivers.length === 2 &&
		currentEvidence.wgpuLeakAuditStudy.receivers.every( receiver => receiver.rows.length === 8 ) &&
		currentEvidence.wgpuLeakAuditStudy.receivers.every( receiver => Number.isFinite( receiver.maskedRegionWrongOverCorrect ) ) &&
		currentEvidence.wgpuLeakAuditStudy.receivers.every( receiver => receiver.rows.every( row =>
			Number.isFinite( row.cpuChromaWrongMinusCorrect ) &&
			Number.isFinite( row.cpuL0ChromaWrongMinusCorrect ) &&
			typeof row.sourceRelationToReceiver === 'string' &&
			Number.isFinite( row.sourceValidity ) ) ) &&
		currentEvidence.wgpuLeakAuditStudy.variants.every( variant => Number.isFinite( variant.maskedWrongSideColorRatio ) ) &&
		currentEvidence.wgpuLeakAuditStudy.variants.some( variant => variant.role === 'validity-only' ) &&

		currentEvidence.wgpuLeakAuditStudy.variants.some( variant => variant.role === 'visibility-scaffold-disabled' ) &&
		currentEvidence.wgpuLeakAuditStudy.variants.some( variant => variant.role === 'zero-thickness-control' ) &&
		currentEvidence.wgpuLeakAuditStudy.verdict.chebyshevTuning === 'UNCHANGED' &&
		[ 'OPEN', 'SUPPORTED' ].includes( currentEvidence.wgpuLeakAuditStudy.verdict.cpuGpuLinearGate ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( currentEvidence.wgpuLeakAuditStudy.verdict.weightTermGate ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( currentEvidence.wgpuLeakAuditStudy.verdict.cpuRenderAgreementGate ),
		'grounding parity artifact: proof report must persist the WebGPU leak audit study with all required leak variants and per-neighbor rows.' );
	const momentBackedVisibility = isMomentBackedVisibility( currentEvidence.visibilityMomentInspection );
	const derivedVisibilityStatus = deriveVisibilityProofStatus(
		currentEvidence.visibilityMomentInspection,
		currentEvidence.visibilityMomentInspection.evidenceStatus
	);
	assertLightProbeProof( file,
		currentEvidence.ddgiVisibilityDepthSpec !== undefined &&
		currentEvidence.ddgiVisibilityDepthSpec.momentBacked === momentBackedVisibility &&
		currentEvidence.ddgiVisibilityDepthSpec.status === derivedVisibilityStatus.ddgiStatus &&
		currentEvidence.visibilityLabel === derivedVisibilityStatus.visibilityLabel &&
		currentEvidence.visibilityStatus === derivedVisibilityStatus.visibilityStatus,
		'grounding parity artifact: proof report must not claim implemented DDGI-lite moments unless visibility readback is moment-backed.' );
	assertLightProbeProof( file,
		report.buildExecuted === false &&
		typeof report.buildNotExecutedReason === 'string' &&
		Array.isArray( report.testsExecuted ) &&
		report.testsExecuted.includes( 'visibility moment inspection' ) &&
		currentEvidence.finalColorDebugTargets?.directOnly === true &&
		currentEvidence.finalColorDebugTargets?.indirectOnlySceneLinear === true &&
		currentEvidence.finalColorDebugTargets?.indirectAfterAlbedo === true &&
		currentEvidence.finalColorDebugTargets?.finalBeforeToneMapping === true &&
		currentEvidence.finalColorDebugTargets?.finalAfterToneMapping === true &&
		currentEvidence.finalColorDebugTargets?.receiverMaskOverlay === true &&
		currentEvidence.projectionPath?.oldPathDescription === '9 coefficient pixels x cubemap sweep' &&
		typeof currentEvidence.shGuard?.enabled === 'boolean',
		'grounding parity artifact: proof report must persist no-build policy, executed proof steps, presentation debug targets, projection path, and SH guard metadata.' );
	assertLightProbeProof( file,
		currentEvidence.metricTaxonomyStudy?.status === 'DEFINED-PROMOTION-METRIC-SPLIT' &&
		currentEvidence.metricTaxonomyStudy.metrics.length >= 6 &&
		currentEvidence.metricTaxonomyStudy.metrics.some( metric => metric.key === 'cpuGpuLinearIrradiance' && metric.promotionEligible === true ) &&
		currentEvidence.metricTaxonomyStudy.metrics.some( metric => metric.key === 'offscreenSceneLinearTarget' && metric.promotionEligible === true ) &&
		currentEvidence.metricTaxonomyStudy.metrics.some( metric => metric.key === 'preToneMaskedVisiblePixels' && metric.promotionEligible === 'provisional' ) &&
		currentEvidence.metricTaxonomyStudy.metrics.some( metric => metric.key === 'presentationMaskedCanvasRatio' && metric.promotionEligible === false ) &&
		typeof currentEvidence.metricTaxonomyStudy.gates.sceneLinearTargetGate === 'string' &&
		typeof currentEvidence.metricTaxonomyStudy.gates.contributionGate === 'string' &&
		typeof currentEvidence.metricTaxonomyStudy.gates.probeContentContributionAttributionGate === 'string' &&
		currentEvidence.metricTaxonomyStudy.gates.presentationGateUse === 'DIAGNOSTIC-ONLY' &&
		currentEvidence.metricTaxonomyStudy.gates.chebyshevTuning === 'UNCHANGED',
		'grounding parity artifact: proof report must classify promotion-eligible, provisional, and presentation-only metric spaces before threshold tuning.' );
	assertLightProbeProof( file,
		probeContentContributionAttribution !== undefined &&
		[
			'SUPPORTED-CONTRIBUTION-GATE-BOUNDED',
			'OPEN-PROBE-CONTENT-BOUNCED-CHROMA-ATTRIBUTED',
			'OPEN-PROBE-CONTENT-BOUNCED-CHROMA-PARTIAL',
			'OPEN-CONTRIBUTION-ATTRIBUTION-UNDER-INSTRUMENTED'
		].includes( probeContentContributionAttribution.status ) &&
		probeContentContributionAttribution.mode === 'report-only-probe-content-contribution-attribution' &&
		probeContentContributionAttribution.proofBoundary.includes( 'Report-only attribution' ) &&
		probeContentContributionAttribution.proofBoundary.includes( 'does not change bake capture, runtime sampling, visibility moments' ) &&
		probeContentContributionAttribution.runtimePromotionAllowed === false &&
		probeContentContributionAttribution.summary.runtimePromotionAllowed === false &&
		[ 'bounded', 'strong', 'partial', 'under-instrumented' ].includes(
			probeContentContributionAttribution.summary.attributionStrength
		) &&
		typeof probeContentContributionAttribution.summary.probeContentExplainsContribution === 'boolean' &&
		typeof probeContentContributionAttribution.summary.diagnosticConclusion === 'string' &&
		/proof-only/i.test( probeContentContributionAttribution.summary.nextProofOnlyAction ) &&
		probeContentContributionAttribution.currentGate.status ===
			currentEvidence.sealedRenderMetricMismatch.presentation.offscreen.contributionGate.status &&
		probeContentContributionAttribution.currentGate.dominantContributionSource ===
			currentEvidence.sealedRenderMetricMismatch.presentation.offscreen.contributionGate.dominantContributionSource &&
		Array.isArray( probeContentContributionAttribution.currentGate.blockerKeys ) &&
		Array.isArray( probeContentContributionAttribution.openItems ) &&
		probeContentContributionAttribution.openItems.every( item =>
			typeof item.gate === 'string' &&
			typeof item.status === 'string'
		) &&
		typeof probeContentContributionAttribution.clearedNonContentSources.receiverAlbedoCleared === 'boolean' &&
		typeof probeContentContributionAttribution.clearedNonContentSources.directAmbientCleared === 'boolean' &&
		probeContentContributionAttribution.contentEvidence.probeContentChromaStatus ===
			currentEvidence.probeContentChromaStudy.status &&
		probeContentContributionAttribution.contentEvidence.probeBakeContaminationStatus ===
			currentEvidence.probeBakeContaminationMap.status &&
		probeContentContributionAttribution.contentEvidence.surfaceShContentStatus ===
			currentEvidence.surfaceShContentStudy.status &&
		probeContentContributionAttribution.contentEvidence.surfaceContentAttributionSplitStatus ===
			surfaceContentSplitStudy.status &&
		probeContentContributionAttribution.contentEvidence.mappedLeakSampleCount ===
			surfaceContentSplitStudy.summary.mappedLeakSampleCount &&
		probeContentContributionAttribution.contentEvidence.unmappedLeakSampleCount ===
			surfaceContentSplitStudy.summary.unmappedLeakSampleCount &&
		Number.isFinite( probeContentContributionAttribution.contentEvidence.maxCorrectSideChromaPressure ) &&
		Number.isFinite( probeContentContributionAttribution.contentEvidence.maxRuntimeFinalChromaPressure ) &&
		Number.isFinite( probeContentContributionAttribution.contentEvidence.surfaceLeakSampleCount ) &&
		Number.isFinite( probeContentContributionAttribution.contentEvidence.coefficientAttributionCoverageRatio ) &&
		Number.isFinite( probeContentContributionAttribution.contentEvidence.mappedCoverageRatio ),
		'grounding parity artifact: proof report must attribute the remaining contribution gate to probe-content evidence without authorizing runtime, visibility-moment, or Chebyshev changes.' );
	assertLightProbeProof( file,
		currentEvidence.sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement !== undefined &&
		[ 'OPEN', 'SUPPORTED' ].includes( currentEvidence.sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.status ) &&
		[ 'probe-indirect-only-scene-linear-vs-cpu-surface-sh', 'probe-indirect-only-scene-linear-vs-cpu-visible-pixel-sh' ].includes( currentEvidence.sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.mode ) &&
		currentEvidence.sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.comparisonSourceLabel === 'runtime-probe-indirect-scene-linear' &&
		typeof currentEvidence.sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.originalProbeOnlyAvailable === 'boolean' &&
		typeof currentEvidence.sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.neutralProbeOnlyAvailable === 'boolean' &&
		currentEvidence.sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.tolerance === currentEvidence.sealedRenderMetricMismatch.cpuRenderAgreementTolerance &&
		currentEvidence.sealedRenderMetricMismatch.presentation.sceneLinearMismatchClassifier !== undefined &&
		currentEvidence.sealedRenderMetricMismatch.presentation.sceneLinearMismatchClassifier.mode === 'receiver-mask-debug-runtime-albedo-lambert-bsdf-tone-map-classifier' &&
		typeof currentEvidence.sealedRenderMetricMismatch.presentation.sceneLinearMismatchClassifier.dominantMismatchSource === 'string' &&
		currentEvidence.sealedRenderMetricMismatch.receiverPixelParityStudy !== undefined &&
		[ 'SUPPORTED-RECEIVER-PIXEL-CPU-GPU-PARITY', 'OPEN-RECEIVER-PIXEL-CPU-GPU-MISMATCH' ].includes( currentEvidence.sealedRenderMetricMismatch.receiverPixelParityStudy.status ) &&
		typeof currentEvidence.sealedRenderMetricMismatch.receiverPixelParityDominantMismatchSource === 'string' &&
		currentEvidence.sealedRenderMetricMismatch.visiblePixelCpuMirrorStudy !== undefined &&
		[ 'SUPPORTED-VISIBLE-PIXEL-CPU-GPU-SCENE-LINEAR-PARITY', 'OPEN-VISIBLE-PIXEL-CPU-GPU-SCENE-LINEAR-MISMATCH', 'OPEN-VISIBLE-PIXEL-CPU-GPU-SCENE-LINEAR-READBACK-FAILED' ].includes( currentEvidence.sealedRenderMetricMismatch.visiblePixelCpuMirrorStudy.status ) &&
		typeof currentEvidence.sealedRenderMetricMismatch.visiblePixelCpuMirrorDominantMismatchSource === 'string' &&
		Array.isArray( currentEvidence.leakComparisons.sealedWall.promotionBlockers ) &&
		currentEvidence.leakComparisons.sealedWall.promotionRequirements.probeIndirectGate === 'SUPPORTED' &&
		typeof currentEvidence.sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.diagnosticConclusion === 'string',
		'grounding parity artifact: proof report must isolate probe-only scene-linear render agreement before using presentation color as proof.' );
	assertLightProbeProof( file,
		currentEvidence.webglLeakReferenceStudy?.status === 'OPEN-NOT-COMPARABLE' &&
		currentEvidence.webglLeakReferenceStudy.reference.label === lightProbeWebGLReferenceLabel &&
		currentEvidence.webglLeakReferenceStudy.sealedWallAttempt.comparable === false &&
		/non-comparable|sealed-wall|fixture|harness/i.test( currentEvidence.webglLeakReferenceStudy.sealedWallAttempt.reason ),
		'grounding parity artifact: WebGL leak reference must stay bounded and explicitly non-comparable when no trivial sealed-wall path exists.' );
	assertLightProbeProof( file,
		currentEvidence.researchRoadmapRevision?.status === 'REVISED-WGPU-FIRST' &&
		currentEvidence.researchRoadmapRevision.literatureDecisions.some( item => /SixteenStudio.*not visibility proof/.test( item ) ) &&
		currentEvidence.researchRoadmapRevision.literatureDecisions.some( item => /ZH3.*future compression/.test( item ) ) &&
		currentEvidence.researchRoadmapRevision.nextRoadmap[ 0 ].includes( 'WebGPU leak audit' ),
		'grounding parity artifact: proof report must persist the revised literature and WebGPU-first roadmap.' );
	assertLightProbeProof( file,
		currentEvidence.sealedShContributionDiagnostic !== undefined &&
		currentEvidence.probeContentChromaStudy !== undefined &&
		[ 'OPEN-PROBE-CONTENT-CHROMA-PRESSURE', 'SUPPORTED-PROBE-CONTENT-CHROMA-BOUNDED' ].includes( currentEvidence.probeContentChromaStudy.status ) &&
		Number.isFinite( currentEvidence.probeContentChromaStudy.summary.maxCorrectSideChromaPressure ) &&
		currentEvidence.probeBakeContaminationMap !== undefined &&
		[
			'OPEN-BAKE-CAPTURE-SIDE-WALL-VISIBILITY-BYPASS',
			'OPEN-BAKE-CONTENT-DIRECTIONAL-CHROMA-PRESSURE',
			'SUPPORTED-BAKE-CONTENT-CHROMA-BOUNDED'
		].includes( currentEvidence.probeBakeContaminationMap.status ) &&
		Number.isFinite( currentEvidence.probeBakeContaminationMap.summary.uniqueProbeCount ) &&
		Number.isFinite( currentEvidence.probeBakeContaminationMap.summary.maxCorrectReceiverChromaPressure ) &&
		typeof currentEvidence.probeBakeContaminationMap.summary.dominantProbeBandResponsibility === 'string' &&
		Number.isFinite( currentEvidence.probeBakeContaminationMap.summary.directionalBandDominantProbeCount ) &&
		currentEvidence.probeBakeContaminationMap.dominantProbeCoefficientStudy !== undefined &&
		[ 'OPEN-DOMINANT-SH-COEFFICIENT-LOBE-DRIVERS', 'SUPPORTED-NO-DOMINANT-SH-COEFFICIENT-DRIVERS' ].includes(
			currentEvidence.probeBakeContaminationMap.dominantProbeCoefficientStudy.status
		) &&
		currentEvidence.probeBakeContaminationMap.shDampingOracleStudy !== undefined &&
		[
			'SUPPORTED-SH-DAMPING-ORACLE-REDUCES-AGGREGATE-CHROMA',
			'OPEN-SH-DAMPING-ORACLE-CONTEXT-ONLY',
			'OPEN-SH-DAMPING-ORACLE-NO-SAFE-WIN'
		].includes(
			currentEvidence.probeBakeContaminationMap.shDampingOracleStudy.status
		) &&
		currentEvidence.probeBakeContaminationMap.dominantProbePlacementStudy !== undefined &&
		[
			'SUPPORTED-PLACEMENT-ORACLE-AGGREGATE-WIN',
			'OPEN-PLACEMENT-ORACLE-CONTEXT-ONLY',
			'OPEN-PLACEMENT-ORACLE-NO-SAFE-WIN'
		].includes(
			currentEvidence.probeBakeContaminationMap.dominantProbePlacementStudy.status
		) &&
		currentEvidence.probeBakeContaminationMap.combinedSourceDampingOracleStudy !== undefined &&
		[
			'SUPPORTED-COMBINED-SOURCE-DAMPING-AGGREGATE-WIN',
			'OPEN-COMBINED-SOURCE-DAMPING-CONTEXT-ONLY',
			'OPEN-COMBINED-SOURCE-DAMPING-NO-SAFE-WIN'
		].includes(
			currentEvidence.probeBakeContaminationMap.combinedSourceDampingOracleStudy.status
		) &&
		currentEvidence.probeBakeContaminationMap.dilationSourceQualityStudy !== undefined &&
		[
			'OPEN-DILATION-SOURCE-QUALITY-CANDIDATE',
			'SUPPORTED-DILATION-SOURCE-QUALITY-BOUNDED'
		].includes(
			currentEvidence.probeBakeContaminationMap.dilationSourceQualityStudy.status
		) &&
		currentEvidence.probeBakeContaminationMap.sameSideLayerMaskOracleStudy !== undefined &&
		[
			'SUPPORTED-SAME-SIDE-LAYER-AGGREGATE-WIN',
			'OPEN-SAME-SIDE-LAYER-NO-SAFE-WIN'
		].includes(
			currentEvidence.probeBakeContaminationMap.sameSideLayerMaskOracleStudy.status
		) &&
		currentEvidence.probeBakeContaminationMap.sdfStaticBlockerOracleStudy !== undefined &&
		[
			'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN',
			'OPEN-SDF-STATIC-BLOCKER-MISSED-WRONG-SIDE',
			'OPEN-SDF-STATIC-BLOCKER-NO-AGGREGATE-WIN'
		].includes(
			currentEvidence.probeBakeContaminationMap.sdfStaticBlockerOracleStudy.status
		) &&
		currentEvidence.probeBakeContaminationMap.aggregateBakePolicyOracleStudy !== undefined &&
		[
			'SUPPORTED-AGGREGATE-BAKE-POLICY-WIN',
			'OPEN-AGGREGATE-BAKE-POLICY-NO-SAFE-WIN'
		].includes(
			currentEvidence.probeBakeContaminationMap.aggregateBakePolicyOracleStudy.status
		) &&
		Number.isFinite( currentEvidence.probeBakeContaminationMap.aggregateBakePolicyOracleStudy.summary.safeReceiverWinCount ) &&
		currentEvidence.probeDensityMetricStudy !== undefined &&
		[
			'OPEN-PROBE-DENSITY-DIVIDER-STRADDLE-RISK',
			'SUPPORTED-PROBE-DENSITY-BOUNDED'
		].includes(
			currentEvidence.probeDensityMetricStudy.status
		) &&
		Number.isFinite( currentEvidence.probeDensityMetricStudy.summary.riskReceiverCount ) &&
		currentEvidence.receiverSampleMetricAlignmentStudy !== undefined &&
		[
			'OPEN-CENTER-SURFACE-SAMPLE-DIVERGENCE',
			'SUPPORTED-CENTER-SURFACE-SAMPLE-ALIGNED'
		].includes(
			currentEvidence.receiverSampleMetricAlignmentStudy.status
		) &&
		Number.isFinite( currentEvidence.receiverSampleMetricAlignmentStudy.summary.centerVsSurfaceCpuDelta ) &&
		currentEvidence.surfaceAnchorPlacementStudy !== undefined &&
		[
			'SUPPORTED-SURFACE-ANCHOR-BIAS-CANDIDATE',
			'OPEN-SURFACE-ANCHOR-CENTER-HIDES-LEAK',
			'OPEN-SURFACE-ANCHOR-BIAS-NO-WIN'
		].includes(
			currentEvidence.surfaceAnchorPlacementStudy.status
		) &&
		Number.isFinite( currentEvidence.surfaceAnchorPlacementStudy.summary.centerSurfaceDelta ) &&
		typeof currentEvidence.surfaceAnchorPlacementStudy.summary.centerHidesSurfaceLeak === 'boolean' &&
		currentEvidence.surfaceShContentStudy !== undefined &&
		[
			'OPEN-SURFACE-SH-CONTENT-PRESSURE',
			'OPEN-SURFACE-SH-CONTENT-PARTIAL-PRESSURE',
			'OPEN-SURFACE-LEAK-WITHOUT-MAPPED-CONTENT-PRESSURE',
			'SUPPORTED-SURFACE-SH-CONTENT-BOUNDED'
		].includes(
			currentEvidence.surfaceShContentStudy.status
		) &&
		Number.isFinite( currentEvidence.surfaceShContentStudy.summary.leakSampleCount ) &&
		Number.isFinite( currentEvidence.surfaceShContentStudy.summary.worstSampleWrongOverCorrect ) &&
		currentEvidence.surfaceSampleCoefficientAttributionStudy !== undefined &&
		[
			'OPEN-SURFACE-COEFFICIENT-ATTRIBUTION',
			'SUPPORTED-SURFACE-COEFFICIENT-ATTRIBUTION-BOUNDED'
		].includes(
			currentEvidence.surfaceSampleCoefficientAttributionStudy.status
		) &&
		Number.isFinite( currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.surfaceSampleCount ) &&
		Number.isFinite( currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.leakSampleCount ) &&
		Number.isFinite( currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount ) &&
		Number.isFinite( currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.weightedLeakWrongChannelPressure ) &&
		Number.isFinite( currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.weightedLeakCorrectChannelPreservation ) &&
		Number.isFinite( currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.wrongSideDominantLeakSampleCount ) &&
		Number.isFinite( currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.correctSideDominantLeakSampleCount ) &&
		Number.isFinite( currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.l2DominantLeakSampleCount ) &&
		Number.isFinite( currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.sourcePressureLeakSampleCount ) &&
		Number.isFinite( currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.sourcePressureDominantLeakSampleCount ) &&
		currentEvidence.surfaceShContentStudy.summary.surfaceSampleCount ===
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.surfaceSampleCount &&
		currentEvidence.surfaceShContentStudy.summary.leakSampleCount ===
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.leakSampleCount &&
		Number.isFinite( currentEvidence.surfaceShContentStudy.summary.leakSamplesWithoutContentPressureCount ) &&
		Number.isFinite( currentEvidence.surfaceShContentStudy.summary.leakContentPressureCoverageRatio ) &&
		currentEvidence.surfaceShContentStudy.summary.leakSampleCount ===
			currentEvidence.surfaceShContentStudy.summary.leakSamplesWithContentPressureCount +
			currentEvidence.surfaceShContentStudy.summary.leakSamplesWithoutContentPressureCount &&
		currentEvidence.surfaceShContentStudy.receiverRows.every( receiver =>
			receiver.samples.every( sample =>
				typeof sample.receiver === 'string' &&
				Number.isFinite( sample.runtimeWrongOverCorrect ) &&
				Number.isFinite( sample.dominantProbeWeightedContentPressure ) &&
				Number.isFinite( sample.contentPressureAttributionRowCount ) &&
				Array.isArray( sample.selectedProbes ) &&
				sample.selectedProbes.every( probe =>
					Number.isInteger( probe.probeIndex ) &&
					Number.isFinite( probe.runtimeFinalWeight ) &&
					Number.isFinite( probe.contentPressure ) &&
					Number.isFinite( probe.weightedContentPressure ) &&
					typeof probe.relationToReceiver === 'string' ) ) ) &&
		isFiniteCountHistogram(
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.dominantProbeHistogram,
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount
		) &&
		isFiniteCountHistogram(
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.dominantBandHistogram,
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount
		) &&
		isFiniteCountHistogram(
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.dominantCoefficientHistogram,
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount
		) &&
		surfaceContentSplitStudy !== undefined &&
		[
			'OPEN-SURFACE-CONTENT-ATTRIBUTION-SPLIT',
			'OPEN-SURFACE-CONTENT-ATTRIBUTION-MAPPED',
			'OPEN-SURFACE-CONTENT-ATTRIBUTION-UNMAPPED',
			'OPEN-SURFACE-CONTENT-ATTRIBUTION-UNDER-INSTRUMENTED',
			'SUPPORTED-SURFACE-CONTENT-ATTRIBUTION-SPLIT-BOUNDED'
		].includes( surfaceContentSplitStudy.status ) &&
		surfaceContentSplitStudy.status === expectedSurfaceContentSplitStatus &&
		surfaceContentSplitStudy.proofBoundary.includes( 'Report-only split of canonical leaking surface attribution rows' ) &&
		Array.isArray( surfaceContentSplitStudy.rows ) &&
		surfaceContentSplitStudy.summary.leakSampleCount ===
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.leakSampleCount &&
		surfaceContentSplitStudy.summary.attributedLeakSampleCount ===
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount &&
		surfaceContentSplitStudy.summary.attributedLeakSampleCount ===
			surfaceContentSplitStudy.rows.length &&
		surfaceContentSplitStudy.summary.leakSampleCount ===
			surfaceContentSplitStudy.summary.attributedLeakSampleCount +
			surfaceContentSplitStudy.summary.unattributedLeakSampleCount &&
		surfaceContentSplitStudy.summary.attributedLeakSampleCount ===
			surfaceContentSplitStudy.summary.mappedLeakSampleCount +
			surfaceContentSplitStudy.summary.unmappedLeakSampleCount &&
		surfaceContentSplitStudy.summary.mappedLeakSampleCount ===
			surfaceContentMappedRows.length &&
		surfaceContentSplitStudy.summary.unmappedLeakSampleCount ===
			surfaceContentUnmappedRows.length &&
		Number.isFinite( surfaceContentSplitStudy.summary.mappedCoverageRatio ) &&
		surfaceContentSplitStudy.summary.mappedCoverageRatio === expectedSurfaceContentMappedCoverage &&
		isFiniteCountHistogram(
			surfaceContentSplitStudy.summary.mappedDominantProbeHistogram,
			surfaceContentSplitStudy.summary.mappedLeakSampleCount
		) &&
		sameCountHistogramBy(
			surfaceContentSplitStudy.summary.mappedDominantProbeHistogram,
			surfaceContentMappedRows,
			'attributionDominantProbeIndex'
		) &&
		isFiniteCountHistogram(
			surfaceContentSplitStudy.summary.unmappedDominantProbeHistogram,
			surfaceContentSplitStudy.summary.unmappedLeakSampleCount
		) &&
		sameCountHistogramBy(
			surfaceContentSplitStudy.summary.unmappedDominantProbeHistogram,
			surfaceContentUnmappedRows,
			'attributionDominantProbeIndex'
		) &&
		isFiniteCountHistogram(
			surfaceContentSplitStudy.summary.mappedDominantBandHistogram,
			surfaceContentSplitStudy.summary.mappedLeakSampleCount
		) &&
		sameCountHistogramBy(
			surfaceContentSplitStudy.summary.mappedDominantBandHistogram,
			surfaceContentMappedRows,
			'attributionDominantBand'
		) &&
		isFiniteCountHistogram(
			surfaceContentSplitStudy.summary.unmappedDominantBandHistogram,
			surfaceContentSplitStudy.summary.unmappedLeakSampleCount
		) &&
		sameCountHistogramBy(
			surfaceContentSplitStudy.summary.unmappedDominantBandHistogram,
			surfaceContentUnmappedRows,
			'attributionDominantBand'
		) &&
		isFiniteCountHistogram(
			surfaceContentSplitStudy.summary.mappedDominantCoefficientHistogram,
			surfaceContentSplitStudy.summary.mappedLeakSampleCount
		) &&
		sameCountHistogramBy(
			surfaceContentSplitStudy.summary.mappedDominantCoefficientHistogram,
			surfaceContentMappedRows,
			'attributionDominantCoefficient'
		) &&
		isFiniteCountHistogram(
			surfaceContentSplitStudy.summary.unmappedDominantCoefficientHistogram,
			surfaceContentSplitStudy.summary.unmappedLeakSampleCount
		) &&
		sameCountHistogramBy(
			surfaceContentSplitStudy.summary.unmappedDominantCoefficientHistogram,
			surfaceContentUnmappedRows,
			'attributionDominantCoefficient'
		) &&
		surfaceContentSplitStudy.summary.mappedWrongChannelPressure ===
			roundedRowSum( surfaceContentMappedRows, 'attributionWrongChannelPressure' ) &&
		surfaceContentSplitStudy.summary.unmappedWrongChannelPressure ===
			roundedRowSum( surfaceContentUnmappedRows, 'attributionWrongChannelPressure' ) &&
		surfaceContentSplitStudy.rows.every( row =>
			typeof row.receiver === 'string' &&
			typeof row.sampleLabel === 'string' &&
			Number.isFinite( row.runtimeWrongOverCorrect ) &&
			typeof row.mappedToContentPressure === 'boolean' &&
			Number.isFinite( row.contentPressureAttributionRowCount ) &&
			Number.isFinite( row.contentDominantPressure ) &&
			( row.mappedToContentPressure === false || row.contentPressureAttributionRowCount > 0 ) &&
			( row.mappedToContentPressure === false || row.contentDominantPressure > 0 ) &&
			( row.mappedToContentPressure === true || row.contentPressureAttributionRowCount === 0 ) &&
			Number.isInteger( row.attributionDominantProbeIndex ) &&
			typeof row.attributionDominantBand === 'string' &&
			typeof row.attributionDominantCoefficient === 'string' &&
			Number.isFinite( row.attributionWrongChannelPressure ) ) &&
		surfaceContentFollowupStudy !== undefined &&
		[
			'OPEN-SURFACE-CONTENT-DUAL-BUCKET-FOLLOWUP',
			'OPEN-SURFACE-CONTENT-MAPPED-BUCKET-FOLLOWUP',
			'OPEN-SURFACE-CONTENT-UNMAPPED-BUCKET-FOLLOWUP',
			'OPEN-SURFACE-CONTENT-FOLLOWUP-UNDER-INSTRUMENTED',
			'SUPPORTED-SURFACE-CONTENT-FOLLOWUP-BOUNDED'
		].includes( surfaceContentFollowupStudy.status ) &&
		surfaceContentFollowupStudy.status === expectedSurfaceContentFollowupStatus &&
		surfaceContentFollowupStudy.proofBoundary.includes( 'Report-only follow-up prioritization' ) &&
		Array.isArray( surfaceContentFollowupStudy.rows ) &&
		surfaceContentFollowupStudy.summary.bucketCount ===
			surfaceContentFollowupStudy.rows.length &&
		surfaceContentFollowupStudy.summary.attributedLeakSampleCount ===
			surfaceContentSplitStudy.summary.attributedLeakSampleCount &&
		surfaceContentFollowupStudy.summary.unattributedLeakSampleCount ===
			surfaceContentSplitStudy.summary.unattributedLeakSampleCount &&
		surfaceContentFollowupStudy.summary.totalBucketSampleCount ===
			surfaceContentSplitStudy.summary.attributedLeakSampleCount &&
		surfaceContentFollowupStudy.summary.totalBucketSampleCount ===
			surfaceContentFollowupRows.reduce( ( total, row ) => total + row.sampleCount, 0 ) &&
		surfaceContentFollowupStudy.summary.mappedBucketSampleCount ===
			surfaceContentSplitStudy.summary.mappedLeakSampleCount &&
		surfaceContentFollowupStudy.summary.unmappedBucketSampleCount ===
			surfaceContentSplitStudy.summary.unmappedLeakSampleCount &&
		surfaceContentFollowupStudy.summary.hasMappedBucket ===
			( surfaceContentSplitStudy.summary.mappedLeakSampleCount > 0 ) &&
		surfaceContentFollowupStudy.summary.hasUnmappedBucket ===
			( surfaceContentSplitStudy.summary.unmappedLeakSampleCount > 0 ) &&
		surfaceContentFollowupStudy.summary.noRuntimePromotion === true &&
		/proof-only/i.test( surfaceContentFollowupStudy.summary.nextProofOnlyAction ) &&
		surfaceContentFollowupStudy.rows.every( row =>
			[ 'mapped-bake-content', 'unmapped-coefficient-attribution' ].includes( row.id ) &&
			Number.isInteger( row.sampleCount ) &&
			row.sampleCount >= 0 &&
			hasFiniteCountHistograms( row, [
				'receiverHistogram',
				'contentProbeHistogram',
				'contentBandHistogram',
				'attributionProbeHistogram',
				'attributionBandHistogram',
				'attributionCoefficientHistogram'
			], row.sampleCount ) &&
			Number.isFinite( row.wrongChannelPressure ) &&
			Number.isFinite( row.correctChannelPreservation ) &&
			Number.isFinite( row.maxRuntimeWrongOverCorrect ) &&
			Number.isFinite( row.maxContentDominantPressure ) &&
			typeof row.proofOnlyQuestion === 'string' &&
			/proof-only/i.test( row.recommendedFollowup ) &&
			typeof row.interpretation === 'string' ) &&
		mappedBakeContentSourcePolicyOracleStudy !== undefined &&
		[
			'OPEN-MAPPED-BAKE-CONTENT-SOURCE-POLICY-ORACLE',
			'SUPPORTED-MAPPED-BAKE-CONTENT-SOURCE-POLICY-BOUNDED'
		].includes( mappedBakeContentSourcePolicyOracleStudy.status ) &&
		mappedBakeContentSourcePolicyOracleStudy.status ===
			( surfaceContentMappedRows.length > 0 ?
				'OPEN-MAPPED-BAKE-CONTENT-SOURCE-POLICY-ORACLE' :
				'SUPPORTED-MAPPED-BAKE-CONTENT-SOURCE-POLICY-BOUNDED' ) &&
		mappedBakeContentSourcePolicyOracleStudy.proofBoundary.includes( 'CPU/report-only mapped bake-content/source-policy oracle' ) &&
		mappedBakeContentSourcePolicyOracleStudy.proofBoundary.includes( 'does not change bake capture, runtime sampling, public API, docs, or Chebyshev thresholds' ) &&
		mappedBakeContentSourcePolicyOracleStudy.noRuntimePromotion === true &&
		mappedBakeContentSourcePolicyOracleStudy.summary.noRuntimePromotion === true &&
		mappedBakeContentSourcePolicyOracleStudy.summary.sampleCount === surfaceContentMappedRows.length &&
		mappedBakeContentSourcePolicyOracleStudy.summary.sampleCount === mappedBakeContentSourcePolicyOracleRows.length &&
		matchesMappedBakeContentOracleRows(
			mappedBakeContentSourcePolicyOracleStudy.rows,
			surfaceContentMappedRows
		) &&
		mappedBakeContentSourcePolicyOracleStudy.summary.contentDominantPressureSum ===
			roundedRowSum( surfaceContentMappedRows, 'contentDominantPressure' ) &&
		mappedBakeContentSourcePolicyOracleStudy.summary.contentDominantWeightedPressureSum ===
			roundedRowSum( surfaceContentMappedRows, 'contentDominantWeightedPressure' ) &&
		mappedBakeContentSourcePolicyOracleStudy.summary.attributionWrongChannelPressureSum ===
			roundedRowSum( surfaceContentMappedRows, 'attributionWrongChannelPressure' ) &&
		mappedBakeContentSourcePolicyOracleStudy.summary.attributionCorrectChannelPreservationSum ===
			roundedRowSum( surfaceContentMappedRows, 'attributionCorrectChannelPreservation' ) &&
		mappedBakeContentSourcePolicyOracleStudy.summary.bandMismatchCount ===
			surfaceContentMappedRows.filter( row => row.contentDominantBand !== row.attributionDominantBand ).length &&
		mappedBakeContentSourcePolicyOracleStudy.summary.allMappedRowsHaveBandMismatch ===
			( surfaceContentMappedRows.length > 0 && surfaceContentMappedRows.every( row => row.contentDominantBand !== row.attributionDominantBand ) ) &&
		isFiniteCountHistogram(
			mappedBakeContentSourcePolicyOracleStudy.summary.contentProbeHistogram,
			surfaceContentMappedRows.length
		) &&
		sameCountHistogramBy(
			mappedBakeContentSourcePolicyOracleStudy.summary.contentProbeHistogram,
			surfaceContentMappedRows,
			'contentDominantProbeIndex'
		) &&
		isFiniteCountHistogram(
			mappedBakeContentSourcePolicyOracleStudy.summary.contentBandHistogram,
			surfaceContentMappedRows.length
		) &&
		sameCountHistogramBy(
			mappedBakeContentSourcePolicyOracleStudy.summary.contentBandHistogram,
			surfaceContentMappedRows,
			'contentDominantBand'
		) &&
		isFiniteCountHistogram(
			mappedBakeContentSourcePolicyOracleStudy.summary.attributionCoefficientHistogram,
			surfaceContentMappedRows.length
		) &&
		sameCountHistogramBy(
			mappedBakeContentSourcePolicyOracleStudy.summary.attributionCoefficientHistogram,
			surfaceContentMappedRows,
			'attributionDominantCoefficient'
		) &&
		sameCountHistogramBy(
			mappedBakeContentSourcePolicyOracleStudy.summary.attributionSourceProbeHistogram,
			surfaceContentMappedRows,
			'attributionDominantSourceProbeIndex'
		) &&
		sameCountHistogramBy(
			mappedBakeContentSourcePolicyOracleStudy.summary.attributionSourceRelationHistogram,
			surfaceContentMappedRows,
			'attributionSourceRelationToReceiver'
		) &&
		/proof-only/i.test( mappedBakeContentSourcePolicyOracleStudy.summary.nextProofOnlyAction ) &&
		mappedBakeContentSourcePolicyOracleStudy.rows.every( row =>
			row.mappedToContentPressure === true &&
			row.contentPressureAttributionRowCount > 0 &&
			row.contentDominantPressure > 0 &&
			Number.isInteger( row.attributionSourceProbeIndex ) &&
			typeof row.attributionSourceRelationToReceiver === 'string' &&
			typeof row.attributionDominantCoefficientBand === 'string' &&
			Number.isFinite( row.attributionDominantCoefficientWrongMinusCorrect ) &&
			typeof row.contentAttributionBandMismatch === 'boolean' &&
			row.contentAttributionBandMismatch === ( row.contentDominantBand !== row.attributionDominantBand ) &&
			Number.isFinite( row.attributionWrongChannelPressure ) &&
			Number.isFinite( row.attributionCorrectChannelPreservation ) ) &&
		unmappedCoefficientAttributionInstrumentationStudy !== undefined &&
		[
			'OPEN-UNMAPPED-COEFFICIENT-ATTRIBUTION-INSTRUMENTATION',
			'SUPPORTED-UNMAPPED-COEFFICIENT-ATTRIBUTION-BOUNDED'
		].includes( unmappedCoefficientAttributionInstrumentationStudy.status ) &&
		unmappedCoefficientAttributionInstrumentationStudy.status ===
			( surfaceContentUnmappedRows.length > 0 ?
				'OPEN-UNMAPPED-COEFFICIENT-ATTRIBUTION-INSTRUMENTATION' :
				'SUPPORTED-UNMAPPED-COEFFICIENT-ATTRIBUTION-BOUNDED' ) &&
		unmappedCoefficientAttributionInstrumentationStudy.proofBoundary.includes( 'CPU/report-only unmapped coefficient-attribution instrumentation' ) &&
		unmappedCoefficientAttributionInstrumentationStudy.proofBoundary.includes( 'does not change bake capture, runtime sampling, public API, docs, or Chebyshev thresholds' ) &&
		unmappedCoefficientAttributionInstrumentationStudy.noRuntimePromotion === true &&
		unmappedCoefficientAttributionInstrumentationStudy.summary.noRuntimePromotion === true &&
		unmappedCoefficientAttributionInstrumentationStudy.summary.sampleCount === surfaceContentUnmappedRows.length &&
		unmappedCoefficientAttributionInstrumentationStudy.summary.sampleCount === unmappedCoefficientAttributionInstrumentationRows.length &&
		matchesUnmappedCoefficientInstrumentationRows(
			unmappedCoefficientAttributionInstrumentationStudy.rows,
			surfaceContentUnmappedRows
		) &&
		unmappedCoefficientAttributionInstrumentationStudy.summary.contentPressureAttributionRowCountSum ===
			roundedRowSum( surfaceContentUnmappedRows, 'contentPressureAttributionRowCount' ) &&
		unmappedCoefficientAttributionInstrumentationStudy.summary.attributionWrongChannelPressureSum ===
			roundedRowSum( surfaceContentUnmappedRows, 'attributionWrongChannelPressure' ) &&
		unmappedCoefficientAttributionInstrumentationStudy.summary.attributionCorrectChannelPreservationSum ===
			roundedRowSum( surfaceContentUnmappedRows, 'attributionCorrectChannelPreservation' ) &&
		unmappedCoefficientAttributionInstrumentationStudy.summary.needsCoefficientSourceInstrumentation ===
			( surfaceContentUnmappedRows.length > 0 ) &&
		isFiniteCountHistogram(
			unmappedCoefficientAttributionInstrumentationStudy.summary.contentProbeHistogram,
			surfaceContentUnmappedRows.length
		) &&
		sameCountHistogramBy(
			unmappedCoefficientAttributionInstrumentationStudy.summary.contentProbeHistogram,
			surfaceContentUnmappedRows,
			'contentDominantProbeIndex'
		) &&
		isFiniteCountHistogram(
			unmappedCoefficientAttributionInstrumentationStudy.summary.contentBandHistogram,
			surfaceContentUnmappedRows.length
		) &&
		sameCountHistogramBy(
			unmappedCoefficientAttributionInstrumentationStudy.summary.contentBandHistogram,
			surfaceContentUnmappedRows,
			'contentDominantBand'
		) &&
		isFiniteCountHistogram(
			unmappedCoefficientAttributionInstrumentationStudy.summary.attributionCoefficientHistogram,
			surfaceContentUnmappedRows.length
		) &&
		sameCountHistogramBy(
			unmappedCoefficientAttributionInstrumentationStudy.summary.attributionCoefficientHistogram,
			surfaceContentUnmappedRows,
			'attributionDominantCoefficient'
		) &&
		sameCountHistogramBy(
			unmappedCoefficientAttributionInstrumentationStudy.summary.attributionSourceProbeHistogram,
			surfaceContentUnmappedRows,
			'attributionDominantSourceProbeIndex'
		) &&
		sameCountHistogramBy(
			unmappedCoefficientAttributionInstrumentationStudy.summary.attributionSourceRelationHistogram,
			surfaceContentUnmappedRows,
			'attributionSourceRelationToReceiver'
		) &&
		unmappedCoefficientAttributionInstrumentationStudy.summary.probe52L10SampleCount ===
			surfaceContentUnmappedRows.filter( row =>
				row.attributionDominantProbeIndex === 52 &&
				row.attributionDominantCoefficient === 'L10'
			).length &&
		unmappedCoefficientAttributionInstrumentationStudy.summary.sourceTraceComplete ===
			surfaceContentUnmappedRows.every( row => row.attributionDominantSourceProbeIndex !== null ) &&
		/proof-only/i.test( unmappedCoefficientAttributionInstrumentationStudy.summary.nextProofOnlyAction ) &&
		unmappedCoefficientAttributionInstrumentationStudy.rows.every( row =>
			row.mappedToContentPressure === false &&
			row.contentPressureAttributionRowCount === 0 &&
			row.needsCoefficientSourceInstrumentation === true &&
			row.coefficientSourceInstrumentationVerdict === 'AVAILABLE-COEFFICIENT-SOURCE-TRACE' &&
			Number.isInteger( row.attributionSourceProbeIndex ) &&
			typeof row.attributionSourceRelationToReceiver === 'string' &&
			typeof row.attributionDominantCoefficientBand === 'string' &&
			Number.isFinite( row.attributionDominantCoefficientWrongMinusCorrect ) &&
			Number.isFinite( row.sourcePressureAttributionRowCount ) &&
			Number.isFinite( row.contentDominantPressure ) &&
			Number.isFinite( row.attributionWrongChannelPressure ) &&
			Number.isFinite( row.attributionCorrectChannelPreservation ) ) &&
		aggregateExplanationComparisonStudy !== undefined &&
		aggregateExplanationComparisonStudy.status ===
			( allAggregateExplanationRows.length === 0 ?
				'SUPPORTED-AGGREGATE-EXPLANATION-BOUNDED' :
				allAggregateExplanationRows.every( row =>
					row.attributionDominantCoefficient === 'L10' &&
					row.attributionDominantCoefficientBand === 'l1'
				) && surfaceContentUnmappedRows.length > 0 ?
					'OPEN-AGGREGATE-L10-COEFFICIENT-EXPLANATION' :
					'OPEN-AGGREGATE-EXPLANATION-SPLIT' ) &&
		aggregateExplanationComparisonStudy.proofBoundary.includes( 'CPU/report-only aggregate explanation comparison' ) &&
		aggregateExplanationComparisonStudy.noRuntimePromotion === true &&
		aggregateExplanationComparisonStudy.summary.noRuntimePromotion === true &&
		aggregateExplanationComparisonRows.length === 2 &&
		aggregateExplanationComparisonStudy.summary.sampleCount === allAggregateExplanationRows.length &&
		aggregateExplanationComparisonStudy.summary.mappedSampleCount === mappedBakeContentSourcePolicyOracleRows.length &&
		aggregateExplanationComparisonStudy.summary.unmappedSampleCount === unmappedCoefficientAttributionInstrumentationRows.length &&
		aggregateExplanationComparisonStudy.summary.contentPressureSampleCount === mappedBakeContentSourcePolicyOracleRows.length &&
		aggregateExplanationComparisonStudy.summary.coefficientL10SampleCount === allAggregateExplanationRows.filter( row =>
			row.attributionDominantCoefficient === 'L10' &&
			row.attributionDominantCoefficientBand === 'l1'
		).length &&
		aggregateExplanationComparisonStudy.summary.bakeContentHypothesisCoversAll ===
			( allAggregateExplanationRows.length > 0 && mappedBakeContentSourcePolicyOracleRows.length === allAggregateExplanationRows.length ) &&
		aggregateExplanationComparisonStudy.summary.coefficientHypothesisCoversAll ===
			( allAggregateExplanationRows.length > 0 && allAggregateExplanationRows.every( row =>
				row.attributionDominantCoefficient === 'L10' &&
				row.attributionDominantCoefficientBand === 'l1'
			) ) &&
		aggregateExplanationComparisonStudy.summary.sourceTraceComplete ===
			( allAggregateExplanationRows.length > 0 && allAggregateExplanationRows.every( row => Number.isInteger( row.attributionSourceProbeIndex ) ) ) &&
		aggregateExplanationComparisonStudy.summary.recommendedContinuation === 'proof-7b-coefficient-L10-oracle' &&
		/proof-only/i.test( aggregateExplanationComparisonStudy.summary.nextProofOnlyAction ) &&
		proof7bCoefficientL10OracleStudy !== undefined &&
		[
			'IDENTIFIED-PROOF-7B-L10-PROBE50-DOMINANT-RESIDUAL-BOUNDED',
			'OPEN-PROOF-7B-L10-COEFFICIENT-NO-DOMINANT-SOURCE',
			'SUPPORTED-PROOF-7B-L10-COEFFICIENT-BOUNDED'
		].includes( proof7bCoefficientL10OracleStudy.status ) &&
		proof7bCoefficientL10OracleStudy.status ===
			( allAggregateExplanationRows.length === 0 ?
				'SUPPORTED-PROOF-7B-L10-COEFFICIENT-BOUNDED' :
				l10AggregateExplanationRows.length === allAggregateExplanationRows.length &&
				proof7bCoefficientL10OracleRows.length > 0 &&
				Math.max( ...proof7bCoefficientL10OracleRows.map( row => row.wrongPressureShare ) ) >= 0.9 ?
					'IDENTIFIED-PROOF-7B-L10-PROBE50-DOMINANT-RESIDUAL-BOUNDED' :
					'OPEN-PROOF-7B-L10-COEFFICIENT-NO-DOMINANT-SOURCE' ) &&
		proof7bCoefficientL10OracleStudy.proofBoundary.includes( 'CPU/report-only proof-7b L10/l1 coefficient oracle' ) &&
		proof7bCoefficientL10OracleStudy.noRuntimePromotion === true &&
		proof7bCoefficientL10OracleStudy.summary.runtimePromotionAllowed === false &&
		proof7bCoefficientL10OracleStudy.summary.sampleCount === allAggregateExplanationRows.length &&
		proof7bCoefficientL10OracleStudy.summary.l10SampleCount === l10AggregateExplanationRows.length &&
		proof7bCoefficientL10OracleStudy.summary.allRowsAreL10L1 ===
			( allAggregateExplanationRows.length > 0 && l10AggregateExplanationRows.length === allAggregateExplanationRows.length ) &&
		proof7bCoefficientL10OracleStudy.summary.sourceTraceComplete ===
			( allAggregateExplanationRows.length > 0 && allAggregateExplanationRows.every( row => Number.isInteger( row.attributionSourceProbeIndex ) ) ) &&
		proof7bCoefficientL10OracleStudy.summary.totalWrongChannelPressure === l10WrongChannelPressure &&
		proof7bCoefficientL10OracleStudy.summary.totalCorrectChannelPreservation === l10CorrectChannelPreservation &&
		proof7bCoefficientL10OracleStudy.summary.dominantSourceProbeIndex === 50 &&
		proof7bCoefficientL10OracleStudy.summary.dominantReceiver === 'rightReceiver' &&
		proof7bCoefficientL10OracleStudy.summary.dominantWrongPressureShare >= 0.9 &&
		proof7bCoefficientL10OracleStudy.summary.globalCoefficientDampingSafe === false &&
		/probe-50\/rightReceiver L10\/l1/i.test( proof7bCoefficientL10OracleStudy.summary.identifiedCause ) &&
		/proof-only/i.test( proof7bCoefficientL10OracleStudy.summary.nextProofOnlyAction ) &&
		proof7bCoefficientL10OracleRows.length === 2 &&
		proof7bCoefficientL10OracleRows.every( row =>
			Number.isInteger( row.sourceProbeIndex ) &&
			typeof row.receiver === 'string' &&
			Number.isInteger( row.sampleCount ) &&
			row.sampleCount > 0 &&
			Number.isInteger( row.mappedSampleCount ) &&
			Number.isInteger( row.unmappedSampleCount ) &&
			row.sampleCount === row.mappedSampleCount + row.unmappedSampleCount &&
			Number.isFinite( row.wrongChannelPressure ) &&
			Number.isFinite( row.correctChannelPreservation ) &&
			Number.isFinite( row.contentDominantPressure ) &&
			Number.isFinite( row.maxRuntimeWrongOverCorrect ) &&
			Number.isFinite( row.maxCoefficientWrongMinusCorrect ) &&
			Number.isFinite( row.wrongPressureShare ) &&
			[ 'PRIMARY-L10-COEFFICIENT-LEAK-DRIVER', 'RESIDUAL-L10-COEFFICIENT-TRACE-NOT-A-GLOBAL-DAMPING-WIN' ].includes( row.classification ) ) &&
		probe50L10SignSourceIsolationOracleStudy !== undefined &&
		[
			'IDENTIFIED-PROBE50-L10-POSITIVE-SOURCE-LOCALIZED',
			'OPEN-PROBE50-L10-SIGN-SOURCE-AMBIGUOUS',
			'SUPPORTED-PROBE50-L10-SIGN-SOURCE-BOUNDED'
		].includes( probe50L10SignSourceIsolationOracleStudy.status ) &&
		probe50L10SignSourceIsolationOracleStudy.status ===
			( probe50L10Rows.length === 0 ?
				'SUPPORTED-PROBE50-L10-SIGN-SOURCE-BOUNDED' :
				probe50L10Rows.every( row =>
					row.attributionDominantCoefficientWrongMinusCorrect > 0 &&
					row.attributionSourceRelationToReceiver === 'correct-side' &&
					row.mappedToContentPressure === true &&
					row.contentPressureAttributionRowCount > 0
				) ?
					'IDENTIFIED-PROBE50-L10-POSITIVE-SOURCE-LOCALIZED' :
					'OPEN-PROBE50-L10-SIGN-SOURCE-AMBIGUOUS' ) &&
		probe50L10SignSourceIsolationOracleStudy.proofBoundary.includes( 'CPU/report-only probe-50 L10 sign/source-isolation oracle' ) &&
		probe50L10SignSourceIsolationOracleStudy.noRuntimePromotion === true &&
		probe50L10SignSourceIsolationOracleStudy.summary.runtimePromotionAllowed === false &&
		probe50L10SignSourceIsolationOracleStudy.summary.globalCoefficientDampingSafe === false &&
		probe50L10SignSourceIsolationOracleStudy.summary.sampleCount === probe50L10Rows.length &&
		probe50L10SignSourceIsolationOracleStudy.summary.dominantSourceProbeIndex === 50 &&
		probe50L10SignSourceIsolationOracleStudy.summary.dominantReceiver === 'rightReceiver' &&
		probe50L10SignSourceIsolationOracleStudy.summary.allDominantRowsPositiveL10 ===
			( probe50L10Rows.length > 0 && probe50L10Rows.every( row => row.attributionDominantCoefficientWrongMinusCorrect > 0 ) ) &&
		probe50L10SignSourceIsolationOracleStudy.summary.allDominantRowsCorrectSideSource ===
			( probe50L10Rows.length > 0 && probe50L10Rows.every( row => row.attributionSourceRelationToReceiver === 'correct-side' ) ) &&
		probe50L10SignSourceIsolationOracleStudy.summary.allDominantRowsMappedContentPressure ===
			( probe50L10Rows.length > 0 && probe50L10Rows.every( row => row.mappedToContentPressure === true && row.contentPressureAttributionRowCount > 0 ) ) &&
		probe50L10SignSourceIsolationOracleStudy.summary.wrongSideSourcePressureRowCount === 0 &&
		probe50L10SignSourceIsolationOracleStudy.summary.sourcePolicyBlocked === true &&
		probe50L10SignSourceIsolationOracleStudy.summary.pressureLocalized === true &&
		probe50L10SignSourceIsolationOracleStudy.summary.dominantWrongPressure ===
			roundedRowSum( probe50L10Rows, 'attributionWrongChannelPressure' ) &&
		probe50L10SignSourceIsolationOracleStudy.summary.dominantContentPressure ===
			roundedRowSum( probe50L10Rows, 'contentDominantPressure' ) &&
		probe50L10SignSourceIsolationOracleStudy.summary.dominantCoefficientDelta ===
			roundedRowSum( probe50L10Rows, 'attributionDominantCoefficientWrongMinusCorrect' ) &&
		/probe-50 L10\/l1 leak is positive wrong-minus-correct/i.test(
			probe50L10SignSourceIsolationOracleStudy.summary.identifiedCause
		) &&
		/proof-only/i.test( probe50L10SignSourceIsolationOracleStudy.summary.nextProofOnlyAction ) &&
		probe50L10SignSourceIsolationRows.length === probe50L10Rows.length &&
		probe50L10SignSourceIsolationRows.every( row =>
			row.sourceProbeIndex === 50 &&
			row.sourceRelationToReceiver === 'correct-side' &&
			row.mappedToContentPressure === true &&
			row.contentPressureAttributionRowCount > 0 &&
			row.coefficient === 'L10' &&
			row.coefficientBand === 'l1' &&
			row.coefficientDeltaSign === 'positive-wrong-minus-correct' &&
			row.sourcePressureAttributionRowCount === 0 &&
			Number.isFinite( row.contentDominantPressure ) &&
			Number.isFinite( row.wrongChannelPressure ) &&
			Number.isFinite( row.correctChannelPreservation ) &&
			row.classification === 'POSITIVE-L10-CORRECT-SIDE-SOURCE-LOCALIZED-LEAK' ) &&
		probe50L10ContentBasisPolarityOracleStudy !== undefined &&
		[
			'IDENTIFIED-PROBE50-L10-Z-BASIS-NEGATIVE-CORRECT-POLARITY',
			'OPEN-PROBE50-L10-CONTENT-BASIS-POLARITY-AMBIGUOUS',
			'SUPPORTED-PROBE50-L10-CONTENT-BASIS-POLARITY-BOUNDED'
		].includes( probe50L10ContentBasisPolarityOracleStudy.status ) &&
		probe50L10ContentBasisPolarityOracleStudy.status ===
			( probe50L10ContentBasisPolarityRows.length === 0 ?
				'SUPPORTED-PROBE50-L10-CONTENT-BASIS-POLARITY-BOUNDED' :
				probe50PolarityRowsPositive ?
					'IDENTIFIED-PROBE50-L10-Z-BASIS-NEGATIVE-CORRECT-POLARITY' :
					'OPEN-PROBE50-L10-CONTENT-BASIS-POLARITY-AMBIGUOUS' ) &&
		probe50L10ContentBasisPolarityOracleStudy.proofBoundary.includes( 'CPU/report-only probe-50 L10 content-basis/polarity oracle' ) &&
		probe50L10ContentBasisPolarityOracleStudy.noRuntimePromotion === true &&
		probe50L10ContentBasisPolarityOracleStudy.summary.runtimePromotionAllowed === false &&
		probe50L10ContentBasisPolarityOracleStudy.summary.bakePolicyPromotionAllowed === false &&
		probe50L10ContentBasisPolarityOracleStudy.summary.sourcePolicyPromotionAllowed === false &&
		probe50L10ContentBasisPolarityOracleStudy.summary.globalCoefficientDampingSafe === false &&
		probe50L10ContentBasisPolarityOracleStudy.summary.sampleCount === probe50L10ContentBasisPolarityRows.length &&
		probe50L10ContentBasisPolarityOracleStudy.summary.sampleCount === probe50L10SignSourceIsolationRows.length &&
		probe50L10ContentBasisPolarityOracleStudy.summary.coefficient === 'L10' &&
		probe50L10ContentBasisPolarityOracleStudy.summary.coefficientBand === 'l1' &&
		probe50L10ContentBasisPolarityOracleStudy.summary.basis === 'z' &&
		probe50L10ContentBasisPolarityOracleStudy.summary.allRowsHaveBasis === true &&
		probe50L10ContentBasisPolarityOracleStudy.summary.allRowsPositiveBasisScale === true &&
		probe50L10ContentBasisPolarityOracleStudy.summary.allRowsNegativeCorrectDominance === true &&
		probe50L10ContentBasisPolarityOracleStudy.summary.l10WrongMinusCorrectSum ===
			roundedRowSum( probe50L10ContentBasisPolarityRows, 'wrongMinusCorrect' ) &&
		probe50L10ContentBasisPolarityOracleStudy.summary.l10WeightedWrongMinusCorrectSum ===
			roundedRowSum( probe50L10ContentBasisPolarityRows, 'weightedWrongMinusCorrect' ) &&
		probe50L10ContentBasisPolarityOracleStudy.summary.l10NegativeEnergySum ===
			roundedRowSum( probe50L10ContentBasisPolarityRows, 'negativeEnergy' ) &&
		probe50L10ContentBasisPolarityOracleStudy.summary.l00WrongMinusCorrectSum ===
			roundedRowSum( probe50L10ContentBasisPolarityRows, 'l00WrongMinusCorrect' ) &&
		probe50L10ContentBasisPolarityOracleStudy.summary.l11WrongMinusCorrectSum ===
			roundedRowSum( probe50L10ContentBasisPolarityRows, 'l11WrongMinusCorrect' ) &&
		probe50L10ContentBasisPolarityOracleStudy.summary.polarityIsolated === true &&
		/z-basis polarity leak/i.test( probe50L10ContentBasisPolarityOracleStudy.summary.identifiedCause ) &&
		/proof-only/i.test( probe50L10ContentBasisPolarityOracleStudy.summary.nextProofOnlyAction ) &&
		probe50L10ContentBasisPolarityRows.every( row =>
			row.receiver === 'rightReceiver' &&
			row.sourceProbeIndex === 50 &&
			row.coefficient === 'L10' &&
			row.coefficientBand === 'l1' &&
			row.basis === 'z' &&
			row.basisScale > 0 &&
			row.l10RawCorrect < row.l10RawWrong &&
			row.wrongMinusCorrect > 0 &&
			row.weightedWrongMinusCorrect > 0 &&
			row.negativeEnergy > 0 &&
			row.l00WrongMinusCorrect < 0 &&
			row.l11WrongMinusCorrect < 0 &&
			row.negativeCorrectDominance === true &&
			row.classification === 'POSITIVE-DELTA-FROM-NEGATIVE-CORRECT-CHANNEL-L10-Z-BASIS' ) &&
		probe50CoefficientLocalCorrectionOracleStudy !== undefined &&
		[
			'SUPPORTED-PROBE50-COEFFICIENT-LOCAL-CORRECTION-ORACLE-WIN',
			'OPEN-PROBE50-COEFFICIENT-LOCAL-CORRECTION-NO-SAFE-WIN',
			'SUPPORTED-PROBE50-COEFFICIENT-LOCAL-CORRECTION-BOUNDED'
		].includes( probe50CoefficientLocalCorrectionOracleStudy.status ) &&
		probe50CoefficientLocalCorrectionOracleStudy.status ===
			( probe50CoefficientLocalCorrectionRows.length === 0 ?
				'SUPPORTED-PROBE50-COEFFICIENT-LOCAL-CORRECTION-BOUNDED' :
				probe50LocalCorrectionRowsWin ?
					'SUPPORTED-PROBE50-COEFFICIENT-LOCAL-CORRECTION-ORACLE-WIN' :
					'OPEN-PROBE50-COEFFICIENT-LOCAL-CORRECTION-NO-SAFE-WIN' ) &&
		probe50CoefficientLocalCorrectionOracleStudy.proofBoundary.includes( 'CPU/report-only probe-50 coefficient-local correction oracle' ) &&
		probe50CoefficientLocalCorrectionOracleStudy.noRuntimePromotion === true &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.runtimePromotionAllowed === false &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.bakePolicyPromotionAllowed === false &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.sourcePolicyPromotionAllowed === false &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.chebyshevTuningAllowed === false &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.publicApiDocsPromotionAllowed === false &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.sampleCount === probe50CoefficientLocalCorrectionRows.length &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.sampleCount === probe50L10ContentBasisPolarityRows.length &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.correctionScope === 'probe-50/L10/z-only' &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.allRowsCorrectable === true &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.preservesCorrectiveCoefficients === true &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.estimatedWrongPressureReductionSum ===
			roundedRowSum( probe50CoefficientLocalCorrectionRows, 'estimatedWrongPressureReduction' ) &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.estimatedNegativeEnergyReductionSum ===
			roundedRowSum( probe50CoefficientLocalCorrectionRows, 'estimatedNegativeEnergyReduction' ) &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.dominantWrongPressureBeforeCorrection ===
			probe50L10SignSourceIsolationOracleStudy.summary.dominantWrongPressure &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.estimatedDominantWrongPressureAfterCorrection <= 0.001 &&
		probe50CoefficientLocalCorrectionOracleStudy.summary.localCorrectionWins === true &&
		/coefficient-local probe-50\/L10\/z correction/i.test(
			probe50CoefficientLocalCorrectionOracleStudy.summary.identifiedCause
		) &&
		/proof-only/i.test( probe50CoefficientLocalCorrectionOracleStudy.summary.nextProofOnlyAction ) &&
		probe50CoefficientLocalCorrectionRows.every( row =>
			row.receiver === 'rightReceiver' &&
			row.sourceProbeIndex === 50 &&
			row.coefficient === 'L10' &&
			row.coefficientBand === 'l1' &&
			row.basis === 'z' &&
			row.correctionScope === 'probe-50/L10/z-only' &&
			row.currentWeightedWrongMinusCorrect > 0 &&
			row.correctedWeightedWrongMinusCorrect === 0 &&
			row.estimatedWrongPressureReduction > 0 &&
			row.estimatedNegativeEnergyReduction > 0 &&
			row.preservesL00 === true &&
			row.preservesL11 === true &&
			row.preservesOtherCoefficientRows === true &&
			row.classification === 'COEFFICIENT-LOCAL-CORRECTION-CANDIDATE' ) &&
		probe50LocalCorrectionAggregateResidualGuardStudy !== undefined &&
		[
			'SUPPORTED-PROBE50-LOCAL-CORRECTION-AGGREGATE-RESIDUAL-GUARD',
			'OPEN-PROBE50-LOCAL-CORRECTION-AGGREGATE-RESIDUAL-GUARD'
		].includes( probe50LocalCorrectionAggregateResidualGuardStudy.status ) &&
		probe50LocalCorrectionAggregateResidualGuardStudy.status ===
			( probe50CoefficientLocalCorrectionOracleStudy.summary.localCorrectionWins === true &&
				expectedAggregateWrongAfter <= 0.001 &&
				proof7bCoefficientL10OracleStudy.summary.residualWrongChannelPressure <= 0.001 &&
				proof7bCoefficientL10OracleStudy.summary.residualCorrectChannelPreservation >
					proof7bCoefficientL10OracleStudy.summary.residualWrongChannelPressure ?
				'SUPPORTED-PROBE50-LOCAL-CORRECTION-AGGREGATE-RESIDUAL-GUARD' :
				'OPEN-PROBE50-LOCAL-CORRECTION-AGGREGATE-RESIDUAL-GUARD' ) &&
		probe50LocalCorrectionAggregateResidualGuardStudy.proofBoundary.includes( 'CPU/report-only aggregate residual guard' ) &&
		probe50LocalCorrectionAggregateResidualGuardStudy.noRuntimePromotion === true &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.runtimePromotionAllowed === false &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.bakePolicyPromotionAllowed === false &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.sourcePolicyPromotionAllowed === false &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.chebyshevTuningAllowed === false &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.publicApiDocsPromotionAllowed === false &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.sampleCount === allAggregateExplanationRows.length &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.mappedDominantSampleCount === mappedBakeContentSourcePolicyOracleRows.length &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.unmappedResidualSampleCount === unmappedCoefficientAttributionInstrumentationRows.length &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.aggregateWrongBefore === l10WrongChannelPressure &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.aggregateEstimatedWrongAfter === expectedAggregateWrongAfter &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.aggregateReduction === expectedAggregateReduction &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.aggregateReductionRatio >= 0.95 &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.mappedDominantWrongBefore ===
			probe50CoefficientLocalCorrectionOracleStudy.summary.dominantWrongPressureBeforeCorrection &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.mappedDominantWrongAfter ===
			probe50CoefficientLocalCorrectionOracleStudy.summary.estimatedDominantWrongPressureAfterCorrection &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.unmappedResidualWrong ===
			proof7bCoefficientL10OracleStudy.summary.residualWrongChannelPressure &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.unmappedResidualCorrectPreservation ===
			proof7bCoefficientL10OracleStudy.summary.residualCorrectChannelPreservation &&
		probe50LocalCorrectionAggregateResidualGuardStudy.summary.residualGuardPasses === true &&
		/probe-50\/L10\/z local-correction candidate/i.test(
			probe50LocalCorrectionAggregateResidualGuardStudy.summary.identifiedCause
		) &&
		/proof-only/i.test( probe50LocalCorrectionAggregateResidualGuardStudy.summary.nextProofOnlyAction ) &&
		probe50LocalCorrectionAggregateResidualGuardRows.length === 2 &&
		hasUniqueExactIds( probe50LocalCorrectionAggregateResidualGuardRows, [
			'mapped-probe-50-local-correction',
			'unmapped-probe-52-residual-guard'
		] ) &&
		probe50LocalCorrectionAggregateResidualGuardRows.every( row =>
			Number.isInteger( row.sourceProbeIndex ) &&
			typeof row.receiver === 'string' &&
			Number.isInteger( row.sampleCount ) &&
			Number.isFinite( row.wrongPressureBefore ) &&
			Number.isFinite( row.estimatedWrongPressureReduction ) &&
			Number.isFinite( row.estimatedWrongPressureAfter ) &&
			Number.isFinite( row.correctPreservation ) &&
			[
				'SUPPORTED-MAPPED-DOMINANT-REDUCED',
				'SUPPORTED-UNMAPPED-RESIDUAL-BOUNDED'
			].includes( row.classification ) ) &&
		probe50L10ZDesignBoundConstraintsStudy !== undefined &&
		[
			'SUPPORTED-PROOF-ONLY-PROBE50-L10Z-DESIGN-BOUND-CONSTRAINTS',
			'OPEN-PROOF-ONLY-PROBE50-L10Z-DESIGN-BOUND-CONSTRAINTS'
		].includes( probe50L10ZDesignBoundConstraintsStudy.status ) &&
		probe50L10ZDesignBoundConstraintsStudy.status ===
			( probe50L10ZDesignBoundConstraintRows.length > 0 &&
				probe50L10ZDesignBoundConstraintRows.every( row => row.satisfied === true ) ?
				'SUPPORTED-PROOF-ONLY-PROBE50-L10Z-DESIGN-BOUND-CONSTRAINTS' :
				'OPEN-PROOF-ONLY-PROBE50-L10Z-DESIGN-BOUND-CONSTRAINTS' ) &&
		probe50L10ZDesignBoundConstraintsStudy.proofBoundary.includes( 'CPU/report-only design-bound constraints review' ) &&
		probe50L10ZDesignBoundConstraintsStudy.noRuntimePromotion === true &&
		probe50L10ZDesignBoundConstraintsStudy.summary.runtimePromotionAllowed === false &&
		probe50L10ZDesignBoundConstraintsStudy.summary.bakePolicyPromotionAllowed === false &&
		probe50L10ZDesignBoundConstraintsStudy.summary.sourcePolicyPromotionAllowed === false &&
		probe50L10ZDesignBoundConstraintsStudy.summary.chebyshevTuningAllowed === false &&
		probe50L10ZDesignBoundConstraintsStudy.summary.publicApiDocsPromotionAllowed === false &&
		probe50L10ZDesignBoundConstraintsStudy.summary.requiredConstraintCount === probe50L10ZDesignBoundConstraintRows.length &&
		probe50L10ZDesignBoundConstraintsStudy.summary.satisfiedConstraintCount ===
			probe50L10ZDesignBoundConstraintRows.filter( row => row.satisfied === true ).length &&
		probe50L10ZDesignBoundConstraintsStudy.summary.allRequiredConstraintsSatisfied === true &&
		probe50L10ZDesignBoundConstraintsStudy.summary.targetProbeIndex === 50 &&
		probe50L10ZDesignBoundConstraintsStudy.summary.targetCoefficient === 'L10' &&
		probe50L10ZDesignBoundConstraintsStudy.summary.targetCoefficientBand === 'l1' &&
		probe50L10ZDesignBoundConstraintsStudy.summary.targetBasis === 'z' &&
		probe50L10ZDesignBoundConstraintsStudy.summary.aggregateEstimatedWrongAfter ===
			probe50LocalCorrectionAggregateResidualGuardStudy.summary.aggregateEstimatedWrongAfter &&
		probe50L10ZDesignBoundConstraintsStudy.summary.aggregateReductionRatio ===
			probe50LocalCorrectionAggregateResidualGuardStudy.summary.aggregateReductionRatio &&
		probe50L10ZDesignBoundConstraintsStudy.summary.residualAbsoluteBound ===
			probe50LocalCorrectionAggregateResidualGuardStudy.summary.residualAbsoluteBound &&
		probe50L10ZDesignBoundConstraintsStudy.summary.globalCoefficientDampingRejected === true &&
		probe50L10ZDesignBoundConstraintsStudy.summary.sourcePolicyRejected === true &&
		probe50L10ZDesignBoundConstraintsStudy.summary.bakePolicyRejected === true &&
		/probe-50\/L10\/z correction shape/i.test(
			probe50L10ZDesignBoundConstraintsStudy.summary.identifiedCause
		) &&
		/proof-only/i.test( probe50L10ZDesignBoundConstraintsStudy.summary.nextProofOnlyAction ) &&
		hasUniqueExactIds( probe50L10ZDesignBoundConstraintRows, [
			'scope-probe-50-l10-z-only',
			'preserve-corrective-coefficients',
			'bound-aggregate-residual',
			'do-not-global-damp-l1',
			'do-not-source-or-bake-policy',
			'keep-runtime-promotion-blocked'
		] ) &&
		probe50L10ZDesignBoundConstraintRows.every( row =>
			typeof row.category === 'string' &&
			typeof row.requirement === 'string' &&
			typeof row.evidence === 'string' &&
			row.satisfied === true ) &&
		currentEvidence.surfaceAttributionBranchDecision !== undefined &&
		[
			'OPEN-ATTRIBUTION-BRANCH-SELECTED',
			'OPEN-ATTRIBUTION-UNDER-INSTRUMENTED',
			'SUPPORTED-NO-SURFACE-LEAK-BRANCH'
		].includes( currentEvidence.surfaceAttributionBranchDecision.status ) &&
		[ 'proof-7a', 'proof-7b', 'proof-7c', 'proof-7d', 'none' ].includes(
			currentEvidence.surfaceAttributionBranchDecision.selectedBranch
		) &&
		Number.isFinite( currentEvidence.surfaceAttributionBranchDecision.confidence ) &&
		Array.isArray( currentEvidence.surfaceAttributionBranchDecision.candidates ) &&
		hasUniqueExactIds( currentEvidence.surfaceAttributionBranchDecision.candidates, [ 'proof-7a', 'proof-7b', 'proof-7c' ] ) &&
		currentEvidence.surfaceAttributionBranchDecision.candidates.every( candidate =>
			[ 'proof-7a', 'proof-7b', 'proof-7c' ].includes( candidate.branch ) &&
			typeof candidate.oracleFamily === 'string' &&
			Number.isInteger( candidate.score ) &&
			candidate.score >= 0 &&
			typeof candidate.reason === 'string' ) &&
		currentEvidence.surfaceAttributionBranchDecision.candidates.every( ( candidate, index, candidates ) =>
			index === 0 || candidates[ index - 1 ].score >= candidate.score ) &&
		currentEvidence.surfaceAttributionBranchDecision.candidates.find( candidate => candidate.branch === 'proof-7a' ).score ===
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.sourcePressureLeakSampleCount &&
		currentEvidence.surfaceAttributionBranchDecision.candidates.find( candidate => candidate.branch === 'proof-7b' ).score ===
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.l2DominantLeakSampleCount &&
		currentEvidence.surfaceAttributionBranchDecision.candidates.find( candidate => candidate.branch === 'proof-7c' ).score ===
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.correctSideDominantLeakSampleCount &&
		currentEvidence.surfaceAttributionBranchDecision.observedSignals.sourcePressureCount ===
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.sourcePressureLeakSampleCount &&
		currentEvidence.surfaceAttributionBranchDecision.observedSignals.bandPressureCount ===
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.l2DominantLeakSampleCount &&
		currentEvidence.surfaceAttributionBranchDecision.observedSignals.blockerPressureCount ===
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.correctSideDominantLeakSampleCount &&
		(
			(
				currentEvidence.surfaceAttributionBranchDecision.status === 'OPEN-ATTRIBUTION-BRANCH-SELECTED' &&
				currentEvidence.surfaceAttributionBranchDecision.selectedBranch === currentEvidence.surfaceAttributionBranchDecision.candidates[ 0 ].branch &&
				currentEvidence.surfaceAttributionBranchDecision.candidates[ 0 ].score > 0
			) ||
			(
				currentEvidence.surfaceAttributionBranchDecision.status === 'OPEN-ATTRIBUTION-UNDER-INSTRUMENTED' &&
				currentEvidence.surfaceAttributionBranchDecision.selectedBranch === 'proof-7d'
			) ||
			(
				currentEvidence.surfaceAttributionBranchDecision.status === 'SUPPORTED-NO-SURFACE-LEAK-BRANCH' &&
				currentEvidence.surfaceAttributionBranchDecision.selectedBranch === 'none'
			)
		) &&
		typeof currentEvidence.surfaceAttributionBranchDecision.nextAction === 'string' &&
		currentEvidence.surfaceAttributionFollowupSpec !== undefined &&
		currentEvidence.surfaceAttributionFollowupSpec.status === 'SPECIFIED-CAUSAL-ATTRIBUTION-FOLLOWUP' &&
		currentEvidence.surfaceAttributionFollowupSpec.mode === 'causal-attribution-before-fix' &&
		currentEvidence.surfaceAttributionFollowupSpec.currentEvidence.selectedBranch ===
			currentEvidence.surfaceAttributionBranchDecision.selectedBranch &&
		hasUniqueExactIds( currentEvidence.surfaceAttributionFollowupSpec.batches, [ 'proof-6', 'proof-7a', 'proof-7b', 'proof-7c', 'proof-7d' ] ) &&
		currentEvidence.surfaceAttributionFollowupSpec.batches.every( batch =>
			typeof batch.id === 'string' &&
			typeof batch.title === 'string' &&
			typeof batch.action === 'string' &&
			typeof batch.output === 'string' &&
			typeof batch.gate === 'string' ) &&
		hasBatch( currentEvidence.surfaceAttributionFollowupSpec, 'proof-6' ) &&
		hasBatch( currentEvidence.surfaceAttributionFollowupSpec, 'proof-7a' ) &&
		hasBatch( currentEvidence.surfaceAttributionFollowupSpec, 'proof-7b' ) &&
		hasBatch( currentEvidence.surfaceAttributionFollowupSpec, 'proof-7c' ) &&
		hasBatch( currentEvidence.surfaceAttributionFollowupSpec, 'proof-7d' ) &&
		currentEvidence.surfaceAttributionFollowupSpec.stopConditions.some( condition => /Chebyshev/.test( condition ) ) &&
		currentEvidence.surfaceSampleCoefficientAttributionStudy.receivers.every( receiver =>
			receiver.samples.every( sample =>
				Array.isArray( sample.attributionRows ) &&
				sample.attributionRows.length > 0 &&
				sample.attributionRows.every( row =>
					Number.isFinite( row.runtimeFinalWeight ) &&
					Number.isFinite( row.wrongChannelPressure ) &&
					Number.isFinite( row.correctChannelPreservation ) &&
					Number.isFinite( row.dilatedWrongChannelPressure ) &&
					Number.isFinite( row.dilatedSourceWrongPressureDelta ) &&
					Array.isArray( row.runtimeWeightedBandContributions ) &&
					Array.isArray( row.runtimeWeightedCoefficientContributions ) &&
					Array.isArray( row.runtimeWeightedDilatedBandContributions ) &&
					Array.isArray( row.runtimeWeightedDilatedCoefficientContributions ) ) ) ) &&
		proof7cStudy !== undefined &&
		[
			'NOT-SELECTED-PROOF-7C-SURFACE-STATIC-BLOCKER-ORACLE',
			'SUPPORTED-PROOF-7C-NO-SURFACE-LEAK-SAMPLES',
			'OPEN-PROOF-7C-SURFACE-STATIC-BLOCKER-MISSING-PATH-AUDIT',
			'SUPPORTED-PROOF-7C-CPU-STATIC-BLOCKER-AGGREGATE-WIN',
			'OPEN-PROOF-7C-BLOCKED-SURFACE-PATHS-NO-SAFE-RECEIVER-OVERLAP',
			'OPEN-PROOF-7C-BLOCKED-SURFACE-PATHS-NO-AGGREGATE-WIN',
			'OPEN-PROOF-7C-NO-BLOCKED-DOMINANT-SURFACE-PATHS'
		].includes( proof7cStudy.status ) &&
		proof7cStudy.proofBoundary.includes( 'CPU/report-only proof-7c selected-oracle evaluation' ) &&
		proof7cStudy.receiverAggregateOracleStatus ===
			currentEvidence.probeBakeContaminationMap.sdfStaticBlockerOracleStudy.status &&
		Array.isArray( proof7cStudy.rows ) &&
		Number.isFinite( proof7cStudy.summary.leakSampleCount ) &&
		Number.isFinite( proof7cStudy.summary.evaluatedDominantPathCount ) &&
		Number.isFinite( proof7cStudy.summary.missingSurfacePathAuditCount ) &&
		Number.isFinite( proof7cStudy.summary.blockedDominantPathCount ) &&
		Number.isFinite( proof7cStudy.summary.unblockedDominantPathCount ) &&
		Number.isFinite( proof7cStudy.summary.proof7cEligibleLeakSampleCount ) &&
		Number.isFinite( proof7cStudy.summary.overlappingSafeReceiverCount ) &&
		Array.isArray( proof7cStudy.summary.overlappingSafeReceivers ) &&
		reportedProof7cOverlapReceivers.length === expectedProof7cOverlapReceivers.length &&
		reportedProof7cOverlapReceivers.every( ( receiver, index ) => receiver === expectedProof7cOverlapReceivers[ index ] ) &&
		typeof proof7cStudy.summary.selected === 'boolean' &&
		proof7cStudy.summary.selected ===
			( currentEvidence.surfaceAttributionBranchDecision.selectedBranch === 'proof-7c' ) &&
		proof7cStudy.summary.proof7cEligibleLeakSampleCount ===
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.correctSideDominantLeakSampleCount &&
		proof7cStudy.summary.evaluatedDominantPathCount ===
			currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.correctSideDominantLeakSampleCount &&
		proof7cStudy.summary.evaluatedDominantPathCount ===
			proof7cStudy.rows.length &&
		proof7cStudy.summary.evaluatedDominantPathCount ===
			proof7cStudy.summary.blockedDominantPathCount +
			proof7cStudy.summary.unblockedDominantPathCount +
			proof7cStudy.summary.missingSurfacePathAuditCount &&
		(
			(
				proof7cMissingAuditStatus === true &&
				proof7cMissingAuditCount > 0
			) ||
			(
				proof7cMissingAuditStatus === false &&
				proof7cMissingAuditCount === 0
			)
		) &&
		sdfStaticBlockerOracleStudy.summary.safeReceiverWinCount === safeSdfAggregateReceivers.length &&
		(
			(
				safeSdfAggregateReceivers.length > 0 &&
				sdfStaticBlockerOracleStudy.status === 'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN'
			) ||
			(
				safeSdfAggregateReceivers.length === 0 &&
				sdfStaticBlockerOracleStudy.status !== 'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN'
			)
		) &&
		proof7cStudy.summary.blockedDominantPathCount ===
			proof7cStudy.rows.filter( row =>
				row.staticBlocked === true
			).length &&
		proof7cStudy.summary.unblockedDominantPathCount ===
			proof7cStudy.rows.filter( row =>
				row.staticBlocked === false
			).length &&
		proof7cStudy.summary.missingSurfacePathAuditCount ===
			proof7cStudy.rows.filter( row =>
				row.hasSurfacePathAudit === false
			).length &&
		proof7cStudy.summary.overlappingSafeReceiverCount ===
			proof7cStudy.summary.overlappingSafeReceivers.length &&
		proof7cStudy.summary.receiverAggregateOracleStatus ===
			currentEvidence.probeBakeContaminationMap.sdfStaticBlockerOracleStudy.status &&
		proof7cStudy.rows.every( row =>
			typeof row.receiver === 'string' &&
			typeof row.sampleLabel === 'string' &&
			Number.isFinite( row.quadratureWeight ) &&
			Number.isInteger( row.dominantProbeIndex ) &&
			row.dominantProbeRelationToReceiver === 'correct-side' &&
			row.proof7cEligible === true &&
			typeof row.hasSurfacePathAudit === 'boolean' &&
			typeof row.blockerReason === 'string' &&
			(
				(
					row.hasSurfacePathAudit === true &&
					row.probePosition !== null &&
					Number.isFinite( row.probePosition.x ) &&
					Number.isFinite( row.probePosition.y ) &&
					Number.isFinite( row.probePosition.z ) &&
					typeof row.crossesDivider === 'boolean' &&
					row.surfaceSegmentDividerAudit !== null &&
					typeof row.surfaceSegmentDividerAudit.intersects === 'boolean' &&
					typeof row.surfaceSegmentDividerAudit.reason === 'string' &&
					row.visibilitySegmentDividerAudit !== null &&
					typeof row.visibilitySegmentDividerAudit.intersects === 'boolean' &&
					typeof row.visibilitySegmentDividerAudit.reason === 'string' &&
					typeof row.staticBlocked === 'boolean' &&
					row.staticBlocked === row.surfaceSegmentDividerAudit.intersects
				) ||
				(
					row.hasSurfacePathAudit === false &&
					row.probePosition === null &&
					row.crossesDivider === null &&
					row.surfaceSegmentDividerAudit === null &&
					row.visibilitySegmentDividerAudit === null &&
					row.staticBlocked === null
				)
			) ) &&
		(
			(
				proof7cStudy.status === 'NOT-SELECTED-PROOF-7C-SURFACE-STATIC-BLOCKER-ORACLE' &&
				currentEvidence.surfaceAttributionBranchDecision.selectedBranch !== 'proof-7c' &&
				proof7cStudy.summary.selected === false
			) ||
			(
				proof7cStudy.status !== 'NOT-SELECTED-PROOF-7C-SURFACE-STATIC-BLOCKER-ORACLE' &&
				currentEvidence.surfaceAttributionBranchDecision.selectedBranch === 'proof-7c' &&
				proof7cStudy.summary.selected === true
			)
		) &&
		(
			(
				currentEvidence.surfaceAttributionBranchDecision.selectedBranch !== 'proof-7c' &&
				proof7cStudy.status === 'NOT-SELECTED-PROOF-7C-SURFACE-STATIC-BLOCKER-ORACLE'
			) ||
			(
				proof7cStudy.status === 'SUPPORTED-PROOF-7C-NO-SURFACE-LEAK-SAMPLES' &&
				proof7cStudy.summary.leakSampleCount === 0
			) ||
			(
				proof7cStudy.status === 'OPEN-PROOF-7C-SURFACE-STATIC-BLOCKER-MISSING-PATH-AUDIT' &&
				proof7cStudy.summary.missingSurfacePathAuditCount > 0
			) ||
			(
				proof7cStudy.status === 'SUPPORTED-PROOF-7C-CPU-STATIC-BLOCKER-AGGREGATE-WIN' &&
				proof7cStudy.summary.blockedDominantPathCount > 0 &&
				proof7cStudy.summary.overlappingSafeReceiverCount > 0 &&
				proof7cStudy.summary.receiverAggregateOracleStatus === 'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN'
			) ||
			(
				proof7cStudy.status === 'OPEN-PROOF-7C-BLOCKED-SURFACE-PATHS-NO-AGGREGATE-WIN' &&
				proof7cStudy.summary.blockedDominantPathCount > 0 &&
				proof7cStudy.summary.receiverAggregateOracleStatus !== 'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN'
			) ||
			(
				proof7cStudy.status === 'OPEN-PROOF-7C-BLOCKED-SURFACE-PATHS-NO-SAFE-RECEIVER-OVERLAP' &&
				proof7cStudy.summary.blockedDominantPathCount > 0 &&
				proof7cStudy.summary.overlappingSafeReceiverCount === 0 &&
				proof7cStudy.summary.receiverAggregateOracleStatus === 'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN'
			) ||
			(
				proof7cStudy.status === 'OPEN-PROOF-7C-NO-BLOCKED-DOMINANT-SURFACE-PATHS' &&
				proof7cStudy.summary.blockedDominantPathCount === 0 &&
				proof7cStudy.summary.missingSurfacePathAuditCount === 0
			)
		) &&
		currentEvidence.proof7cDispositionStudy !== undefined &&
		[
			'NOT-SELECTED-PROOF-7C-DISPOSITION',
			'SUPPORTED-PROOF-7C-DISPOSITION-REVIEW-RUNTIME-PROMOTION',
			'CLOSED-PROOF-7C-DISPOSITION-NO-RUNTIME-PROMOTION',
			'OPEN-PROOF-7C-DISPOSITION-MISSING-EVIDENCE'
		].includes( currentEvidence.proof7cDispositionStudy.status ) &&
		currentEvidence.proof7cDispositionStudy.status === expectedProof7cDispositionStatus &&
		currentEvidence.proof7cDispositionStudy.proofBoundary.includes( 'Report-only proof-7c disposition' ) &&
		currentEvidence.proof7cDispositionStudy.sourceStatus ===
			proof7cStudy.status &&
		currentEvidence.proof7cDispositionStudy.addressed ===
			(
				proof7cStudy.summary.selected === true &&
				proof7cStudy.summary.missingSurfacePathAuditCount === 0
			) &&
		currentEvidence.proof7cDispositionStudy.runtimePromotionAllowed ===
			( proof7cStudy.status === 'SUPPORTED-PROOF-7C-CPU-STATIC-BLOCKER-AGGREGATE-WIN' ) &&
		(
			currentEvidence.proof7cDispositionStudy.runtimePromotionAllowed === true ||
			currentEvidence.proof7cDispositionStudy.nextProofOnlyAction ===
				surfaceContentFollowupStudy.summary.nextProofOnlyAction
		) &&
		currentEvidence.proof7cDispositionStudy.summary.selected ===
			proof7cStudy.summary.selected &&
		currentEvidence.proof7cDispositionStudy.summary.blockedDominantPathCount ===
			proof7cStudy.summary.blockedDominantPathCount &&
		currentEvidence.proof7cDispositionStudy.summary.evaluatedDominantPathCount ===
			proof7cStudy.summary.evaluatedDominantPathCount &&
		currentEvidence.proof7cDispositionStudy.summary.missingSurfacePathAuditCount ===
			proof7cStudy.summary.missingSurfacePathAuditCount &&
		currentEvidence.proof7cDispositionStudy.summary.receiverAggregateOracleStatus ===
			proof7cStudy.summary.receiverAggregateOracleStatus &&
		currentEvidence.proof7cDispositionStudy.summary.receiverAggregateOracleSafeWinCount ===
			proof7cStudy.summary.receiverAggregateOracleSafeWinCount &&
		currentEvidence.proof7cDispositionStudy.summary.overlappingSafeReceiverCount ===
			proof7cStudy.summary.overlappingSafeReceiverCount &&
		typeof currentEvidence.proof7cDispositionStudy.summary.reason === 'string' &&
		currentEvidence.sealedReceiverNormalDiagnostic !== undefined &&
		currentEvidence.sealedReceiverSurfaceQuadratureDiagnostic !== undefined &&
		currentEvidence.sealedReceiverGpuDebugDiagnostic !== undefined &&
		typeof currentEvidence.sealedFailureDomain === 'string' &&
		[ 'OPEN-CPU-RENDER-METRIC-MISMATCH', 'BOUNDED' ].includes( currentEvidence.sealedRenderMetricMismatch.status ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( currentEvidence.sealedRenderMetricMismatch.cpuRenderAgreementGate ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( currentEvidence.sealedRenderMetricMismatch.surfaceQuadratureCpuRenderAgreementGate ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.cpuSurfaceRuntimeWrongRatioMax ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.delta ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.centerDelta ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.surfaceDelta ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.maskedWrongSideColorRatio ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.maskedCorrectBounceRatio ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.surfaceQuadratureDelta ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.surfaceQuadratureDeltaMean ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.surfaceQuadratureDeltaMax ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.maskedQuadratureDeltaMean ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.maskedQuadratureDeltaMax ) &&
		currentEvidence.sealedRenderMetricMismatch.maskedReceiverRegionMetricMode === 'receiver-id-mask-visible-pixels' &&
		typeof currentEvidence.sealedRenderMetricMismatch.surfaceQuadratureCpuRenderAgreementAggregation === 'string' &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestSurfaceCpuDelta ) &&
		typeof currentEvidence.sealedRenderMetricMismatch.gpuDebugBestSurfaceCpuAggregation === 'string' &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestScale ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestTightPointScale ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestTightPointSurfaceWrongRatio ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestTightPointSurfaceWrongRatioMax ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestTightPointSurfaceCpuDelta ) &&
		typeof currentEvidence.sealedRenderMetricMismatch.gpuDebugBestTightPointCpuAggregation === 'string' &&
		typeof currentEvidence.sealedRenderMetricMismatch.gpuDebugBestTightPointVariant === 'string' &&
		typeof currentEvidence.sealedRenderMetricMismatch.gpuDebugBestWeightTermVariant === 'string' &&
		typeof currentEvidence.sealedRenderMetricMismatch.gpuDebugBestWeightTerm === 'string' &&
		typeof currentEvidence.sealedRenderMetricMismatch.gpuDebugBestWeightTermCpuKey === 'string' &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestWeightTermScale ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestWeightTermDeltaMean ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestWeightTermDeltaMax ) &&
		typeof currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceTermVariant === 'string' &&
		[ 'scalarIrradiance', 'visibilityIrradiance', 'finalIrradiance' ].includes( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceTerm ) &&
		[ 'scalar', 'visibility', 'final' ].includes( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceCpuKey ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceTermScale ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceDeltaMean ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceDeltaMax ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceClippedSampleCount ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugLinearIrradianceAgreementTolerance ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( currentEvidence.sealedRenderMetricMismatch.gpuDebugLinearIrradianceAgreementGate ) &&
		typeof currentEvidence.sealedRenderMetricMismatch.gpuDebugLinearIrradianceAgreementMode === 'string' &&
		[ 'OPEN', 'SUPPORTED' ].includes( currentEvidence.sealedRenderMetricMismatch.gpuDebugWeightTermAgreementGate ) &&
		typeof currentEvidence.sealedRenderMetricMismatch.gpuDebugWeightTermAgreementMode === 'string' &&
		typeof currentEvidence.sealedRenderMetricMismatch.receiverPixelParityStatus === 'string' &&
		typeof currentEvidence.sealedRenderMetricMismatch.receiverPixelParityDominantMismatchSource === 'string' &&
		typeof currentEvidence.sealedRenderMetricMismatch.visiblePixelCpuMirrorStatus === 'string' &&
		typeof currentEvidence.sealedRenderMetricMismatch.visiblePixelCpuMirrorDominantMismatchSource === 'string' &&
		(
			currentEvidence.sealedRenderMetricMismatch.receiverPixelParityLegacyMaskWrongSideDelta === null ||
			Number.isFinite( currentEvidence.sealedRenderMetricMismatch.receiverPixelParityLegacyMaskWrongSideDelta )
		) &&
		typeof currentEvidence.sealedRenderMetricMismatch.gpuDebugAgreementMode === 'string' &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugComparableVariantCount ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugLinearIrradianceTermVariantCount ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugWeightTermVariantCount ) &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.gpuDebugWhiteCalibrationLuminanceMean ) &&
		typeof currentEvidence.sealedRenderMetricMismatch.gpuDebugWhiteCalibrationVisible === 'boolean' &&
		Number.isFinite( currentEvidence.sealedRenderMetricMismatch.invertedNormalCenterDelta ) &&
		typeof currentEvidence.sealedRenderMetricMismatch.normalConventionCleared === 'boolean' &&
		currentEvidence.sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement !== undefined &&
		[ 'OPEN', 'SUPPORTED' ].includes( currentEvidence.sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.status ) &&
		[ 'probe-indirect-only-scene-linear-vs-cpu-surface-sh', 'probe-indirect-only-scene-linear-vs-cpu-visible-pixel-sh' ].includes( currentEvidence.sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.mode ) &&
		currentEvidence.sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.comparisonSourceLabel === 'runtime-probe-indirect-scene-linear',
		'grounding parity artifact: proof report must persist sealed-wall normal convention, SH contribution, receiver-surface quadrature, GPU debug, and render-metric mismatch diagnostics.' );
	const reportPath = path.join( lightProbeParityArtifactDir, 'proof-report.json' );
	const tablePath = path.join( lightProbeParityArtifactDir, 'proof-table.md' );

	await fs.writeFile( reportPath, `${ JSON.stringify( report, null, '\t' ) }\n` );
	await fs.writeFile( tablePath, createLightProbeProofMarkdown( report ) );

	console.green( `Grounding parity artifacts written: ${ lightProbeParityArtifactDir }` );

}

async function captureLightProbeWebGLReference( page, options = {} ) {

	const { port = 1234, networkTimeout = 5 } = options;
	const webglPage = await page.browser().newPage();
	const viewport = page.viewport();

	try {

		if ( viewport !== null ) await webglPage.setViewport( viewport );

		await webglPage.goto( `http://localhost:${ port }/examples/webgl_lightprobes.html?testHarness`, {
			waitUntil: 'networkidle0',
			timeout: networkTimeout * 60000
		} );

		await webglPage.waitForFunction(
			() => window.__webglLightProbeGridCornell !== undefined,
			{ timeout: networkTimeout * 60000 }
		);

		const metrics = await webglPage.evaluate( async () => {

			const harness = window.__webglLightProbeGridCornell;
			await harness.waitUntilReady();
			return await harness.applyReferenceSnapshot();

		} );

		const screenshot = path.join( lightProbeParityArtifactDir, `${ lightProbeWebGLReferenceLabel }.png` );
		const screenshotBuffer = await webglPage.screenshot( { path: screenshot } );
		const image = await Image.read( screenshotBuffer );
		const regions = captureLightProbeImageRegions( image );

		return {
			label: lightProbeWebGLReferenceLabel,
			proofRole: 'same-class-webgl-reference',
			referenceBoundary: 'WebGL LightProbeGrid same-class reference at 6^3 / 32px, captured as secondary screenshot-space evidence; not a production DDGI target and not a substitute for WebGPU e2e gates.',
			metrics,
			regions,
			artifactPressure: createLightProbeImageArtifactPressure( regions ),
			screenshot
		};

	} finally {

		await webglPage.close();

	}

}
