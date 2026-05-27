import { Image } from './image.js';
import { createLightProbeImageArtifactPressure, captureLightProbeImageRegions } from './lightprobegrid-gpu-image-metrics.js';
import { createLightProbeProofMarkdown } from './lightprobegrid-gpu-proof-markdown.js';
import { createLightProbeProofReport } from './lightprobegrid-gpu-proof-report.js';
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

const isPlainFiniteHistogram = histogram =>
	histogram !== null &&
	Array.isArray( histogram ) === false &&
	typeof histogram === 'object' &&
	Object.values( histogram ).every( value => Number.isFinite( value ) );

const histogramSum = histogram =>
	Object.values( histogram ).reduce( ( sum, value ) => sum + value, 0 );

const countHistogram = ( rows, key ) => rows.reduce( ( histogram, row ) => {

	const value = String( row[ key ] ?? 'none' );
	histogram[ value ] = ( histogram[ value ] ?? 0 ) + 1;
	return histogram;

}, {} );

const sameCountHistogram = ( actual, expected ) =>
	isPlainFiniteHistogram( actual ) &&
	Object.keys( actual ).length === Object.keys( expected ).length &&
	Object.entries( expected ).every( ( [ key, value ] ) => actual[ key ] === value );

const roundMetric = value => Number( value.toFixed( 4 ) );

const roundedRowSum = ( rows, key ) =>
	roundMetric( rows.reduce( ( total, row ) => total + row[ key ], 0 ) );

const isFiniteCountHistogram = ( histogram, expectedSum ) =>
	isPlainFiniteHistogram( histogram ) &&
	( expectedSum === 0 || Object.keys( histogram ).length > 0 ) &&
	Object.values( histogram ).every( value => Number.isInteger( value ) && value >= 0 ) &&
	histogramSum( histogram ) === expectedSum;

const isMomentBackedVisibility = info => info !== null &&
	info !== undefined &&
	info.available === true &&
	info.mode === 'moments' &&
	info.texture !== null &&
	info.bytes > 0 &&
	info.stats !== null &&
	info.stats !== undefined &&
	info.stats.finiteSampleCount > 0 &&
	info.stats.hitSampleCount > 0;

const hasUniqueExactIds = ( rows, ids ) =>
	Array.isArray( rows ) &&
	rows.length === ids.length &&
	new Set( rows.map( row => row.id ?? row.branch ) ).size === ids.length &&
	ids.every( id => rows.some( row => ( row.id ?? row.branch ) === id ) );

const hasBatch = ( spec, id ) => spec.batches.some( batch => batch.id === id );

const sameUniqueRowKeys = ( actualRows, expectedRows ) => {

	const actualKeys = actualRows.map( row => `${ row.receiver }/${ row.sampleLabel }` );
	const expectedKeys = expectedRows.map( row => `${ row.receiver }/${ row.sampleLabel }` );
	if ( new Set( actualKeys ).size !== actualKeys.length ) return false;
	if ( new Set( expectedKeys ).size !== expectedKeys.length ) return false;
	if ( actualKeys.length !== expectedKeys.length ) return false;
	const expectedKeySet = new Set( expectedKeys );
	return actualKeys.every( key => expectedKeySet.has( key ) );

};

const matchesMappedBakeContentOracleRows = ( oracleRows, splitRows ) => {

	if ( oracleRows.length !== splitRows.length ) return false;
	if ( sameUniqueRowKeys( oracleRows, splitRows ) === false ) return false;

	const splitRowsBySample = new Map( splitRows.map( row => [ `${ row.receiver }/${ row.sampleLabel }`, row ] ) );
	return oracleRows.every( row => {

		const splitRow = splitRowsBySample.get( `${ row.receiver }/${ row.sampleLabel }` );
		return splitRow !== undefined &&
			row.mappedToContentPressure === splitRow.mappedToContentPressure &&
			row.contentProbeIndex === splitRow.contentDominantProbeIndex &&
			row.contentDominantBand === splitRow.contentDominantBand &&
			row.contentDominantPressure === splitRow.contentDominantPressure &&
			row.contentDominantWeightedPressure === splitRow.contentDominantWeightedPressure &&
			row.contentPressureAttributionRowCount === splitRow.contentPressureAttributionRowCount &&
			row.attributionProbeIndex === splitRow.attributionDominantProbeIndex &&
			row.attributionSourceProbeIndex === splitRow.attributionDominantSourceProbeIndex &&
			row.attributionProbeRelationToReceiver === splitRow.attributionProbeRelationToReceiver &&
			row.attributionSourceRelationToReceiver === splitRow.attributionSourceRelationToReceiver &&
			row.attributionSourceSide === splitRow.attributionSourceSide &&
			row.attributionDilationSourceDiffers === splitRow.attributionDilationSourceDiffers &&
			row.attributionSourceValidity === splitRow.attributionSourceValidity &&
			row.attributionRuntimeFinalWeight === splitRow.attributionRuntimeFinalWeight &&
			row.attributionDominantBand === splitRow.attributionDominantBand &&
			row.attributionDominantCoefficient === splitRow.attributionDominantCoefficient &&
			row.attributionDominantCoefficientBand === splitRow.attributionDominantCoefficientBand &&
			row.attributionDominantCoefficientWrongMinusCorrect === splitRow.attributionDominantCoefficientWrongMinusCorrect &&
			row.attributionWrongChannelPressure === splitRow.attributionWrongChannelPressure &&
			row.attributionCorrectChannelPreservation === splitRow.attributionCorrectChannelPreservation &&
			row.runtimeWrongOverCorrect === splitRow.runtimeWrongOverCorrect;

	} );

};

const matchesUnmappedCoefficientInstrumentationRows = ( instrumentationRows, splitRows ) => {

	if ( instrumentationRows.length !== splitRows.length ) return false;
	if ( sameUniqueRowKeys( instrumentationRows, splitRows ) === false ) return false;

	const splitRowsBySample = new Map( splitRows.map( row => [ `${ row.receiver }/${ row.sampleLabel }`, row ] ) );
	return instrumentationRows.every( row => {

		const splitRow = splitRowsBySample.get( `${ row.receiver }/${ row.sampleLabel }` );
		return splitRow !== undefined &&
			row.mappedToContentPressure === splitRow.mappedToContentPressure &&
			row.contentProbeIndex === splitRow.contentDominantProbeIndex &&
			row.contentDominantBand === splitRow.contentDominantBand &&
			row.contentDominantPressure === splitRow.contentDominantPressure &&
			row.contentPressureAttributionRowCount === splitRow.contentPressureAttributionRowCount &&
			row.attributionProbeIndex === splitRow.attributionDominantProbeIndex &&
			row.attributionSourceProbeIndex === splitRow.attributionDominantSourceProbeIndex &&
			row.attributionProbeRelationToReceiver === splitRow.attributionProbeRelationToReceiver &&
			row.attributionSourceRelationToReceiver === splitRow.attributionSourceRelationToReceiver &&
			row.attributionSourceSide === splitRow.attributionSourceSide &&
			row.attributionDilationSourceDiffers === splitRow.attributionDilationSourceDiffers &&
			row.attributionSourceValidity === splitRow.attributionSourceValidity &&
			row.attributionRuntimeFinalWeight === splitRow.attributionRuntimeFinalWeight &&
			row.attributionDominantBand === splitRow.attributionDominantBand &&
			row.attributionDominantCoefficient === splitRow.attributionDominantCoefficient &&
			row.attributionDominantCoefficientBand === splitRow.attributionDominantCoefficientBand &&
			row.attributionDominantCoefficientWrongMinusCorrect === splitRow.attributionDominantCoefficientWrongMinusCorrect &&
			row.attributionDominantDilatedCoefficient === splitRow.attributionDominantDilatedCoefficient &&
			row.attributionDominantDilatedCoefficientBand === splitRow.attributionDominantDilatedCoefficientBand &&
			row.attributionDominantDilatedCoefficientWrongMinusCorrect === splitRow.attributionDominantDilatedCoefficientWrongMinusCorrect &&
			row.attributionWrongChannelPressure === splitRow.attributionWrongChannelPressure &&
			row.attributionCorrectChannelPreservation === splitRow.attributionCorrectChannelPreservation &&
			row.sourcePressureAttributionRowCount === splitRow.sourcePressureAttributionRowCount &&
			row.sourcePressureProbeIndex === splitRow.sourcePressureProbeIndex &&
			row.sourcePressureSourceProbeIndex === splitRow.sourcePressureSourceProbeIndex &&
			row.sourcePressureWrongChannelPressure === splitRow.sourcePressureWrongChannelPressure &&
			row.sourcePressureDilatedWrongChannelPressure === splitRow.sourcePressureDilatedWrongChannelPressure &&
			row.sourcePressureDilatedSourceWrongPressureDelta === splitRow.sourcePressureDilatedSourceWrongPressureDelta &&
			row.runtimeWrongOverCorrect === splitRow.runtimeWrongOverCorrect;

	} );

};

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
	const proof7cStudy = report.currentEvidence?.proof7cSurfaceStaticBlockerOracleStudy;
	const proof7cRows = proof7cStudy?.rows ?? [];
	const proof7cBlockedReceivers = new Set( proof7cRows
		.filter( row => row.staticBlocked === true )
		.map( row => row.receiver )
	);
	const sdfStaticBlockerOracleStudy = report.currentEvidence?.probeBakeContaminationMap?.sdfStaticBlockerOracleStudy;
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
	const sameStringList = ( a, b ) =>
		a.length === b.length &&
		a.every( ( value, index ) => value === b[ index ] );
	const proof7cStatus = proof7cStudy?.status;
	const proof7cMissingAuditCount = proof7cStudy?.summary?.missingSurfacePathAuditCount;
	const proof7cMissingAuditStatus = proof7cStatus === 'OPEN-PROOF-7C-SURFACE-STATIC-BLOCKER-MISSING-PATH-AUDIT';
	const surfaceContentSplitStudy = report.currentEvidence.surfaceContentAttributionSplitStudy;
	const surfaceContentSplitSummary = surfaceContentSplitStudy?.summary ?? {};
	const surfaceContentSplitRows = Array.isArray( surfaceContentSplitStudy?.rows ) ? surfaceContentSplitStudy.rows : [];
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
	const surfaceContentFollowupStudy = report.currentEvidence.surfaceContentAttributionFollowupStudy;
	const surfaceContentFollowupRows = Array.isArray( surfaceContentFollowupStudy?.rows ) ? surfaceContentFollowupStudy.rows : [];
	const mappedBakeContentSourcePolicyOracleStudy = report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy;
	const mappedBakeContentSourcePolicyOracleRows = Array.isArray( mappedBakeContentSourcePolicyOracleStudy?.rows ) ?
		mappedBakeContentSourcePolicyOracleStudy.rows :
		[];
	const unmappedCoefficientAttributionInstrumentationStudy = report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy;
	const unmappedCoefficientAttributionInstrumentationRows = Array.isArray( unmappedCoefficientAttributionInstrumentationStudy?.rows ) ?
		unmappedCoefficientAttributionInstrumentationStudy.rows :
		[];
	const aggregateExplanationComparisonStudy = report.currentEvidence.aggregateExplanationComparisonStudy;
	const aggregateExplanationComparisonRows = Array.isArray( aggregateExplanationComparisonStudy?.rows ) ?
		aggregateExplanationComparisonStudy.rows :
		[];
	const proof7bCoefficientL10OracleStudy = report.currentEvidence.proof7bCoefficientL10OracleStudy;
	const proof7bCoefficientL10OracleRows = Array.isArray( proof7bCoefficientL10OracleStudy?.rows ) ?
		proof7bCoefficientL10OracleStudy.rows :
		[];
	const probe50L10SignSourceIsolationOracleStudy =
		report.currentEvidence.probe50L10SignSourceIsolationOracleStudy;
	const probe50L10SignSourceIsolationRows = Array.isArray( probe50L10SignSourceIsolationOracleStudy?.rows ) ?
		probe50L10SignSourceIsolationOracleStudy.rows :
		[];
	const probe50L10ContentBasisPolarityOracleStudy =
		report.currentEvidence.probe50L10ContentBasisPolarityOracleStudy;
	const probe50L10ContentBasisPolarityRows = Array.isArray( probe50L10ContentBasisPolarityOracleStudy?.rows ) ?
		probe50L10ContentBasisPolarityOracleStudy.rows :
		[];
	const probe50CoefficientLocalCorrectionOracleStudy =
		report.currentEvidence.probe50CoefficientLocalCorrectionOracleStudy;
	const probe50CoefficientLocalCorrectionRows = Array.isArray( probe50CoefficientLocalCorrectionOracleStudy?.rows ) ?
		probe50CoefficientLocalCorrectionOracleStudy.rows :
		[];
	const probe50LocalCorrectionAggregateResidualGuardStudy =
		report.currentEvidence.probe50LocalCorrectionAggregateResidualGuardStudy;
	const probe50LocalCorrectionAggregateResidualGuardRows = Array.isArray( probe50LocalCorrectionAggregateResidualGuardStudy?.rows ) ?
		probe50LocalCorrectionAggregateResidualGuardStudy.rows :
		[];
	const probe50L10ZDesignBoundConstraintsStudy =
		report.currentEvidence.probe50L10ZDesignBoundConstraintsStudy;
	const probe50L10ZDesignBoundConstraintRows = Array.isArray( probe50L10ZDesignBoundConstraintsStudy?.rows ) ?
		probe50L10ZDesignBoundConstraintsStudy.rows :
		[];
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
	const proof7cDispositionStudy = report.currentEvidence?.proof7cDispositionStudy;
	const expectedProof7cDispositionStatus = proof7cStudy?.summary?.selected === false ?
		'NOT-SELECTED-PROOF-7C-DISPOSITION' :
		proof7cStudy?.status === 'SUPPORTED-PROOF-7C-CPU-STATIC-BLOCKER-AGGREGATE-WIN' ?
			'SUPPORTED-PROOF-7C-DISPOSITION-REVIEW-RUNTIME-PROMOTION' :
			proof7cStudy?.summary?.missingSurfacePathAuditCount === 0 ?
				'CLOSED-PROOF-7C-DISPOSITION-NO-RUNTIME-PROMOTION' :
				'OPEN-PROOF-7C-DISPOSITION-MISSING-EVIDENCE';
	const expectedSurfaceContentFollowupStatus =
		report.currentEvidence.surfaceContentAttributionSplitStudy?.status === 'SUPPORTED-SURFACE-CONTENT-ATTRIBUTION-SPLIT-BOUNDED' ?
			'SUPPORTED-SURFACE-CONTENT-FOLLOWUP-BOUNDED' :
			report.currentEvidence.surfaceContentAttributionSplitStudy?.status === 'OPEN-SURFACE-CONTENT-ATTRIBUTION-UNDER-INSTRUMENTED' ?
				'OPEN-SURFACE-CONTENT-FOLLOWUP-UNDER-INSTRUMENTED' :
				surfaceContentMappedRows.length > 0 && surfaceContentUnmappedRows.length > 0 ?
					'OPEN-SURFACE-CONTENT-DUAL-BUCKET-FOLLOWUP' :
					surfaceContentMappedRows.length > 0 ?
					'OPEN-SURFACE-CONTENT-MAPPED-BUCKET-FOLLOWUP' :
						'OPEN-SURFACE-CONTENT-UNMAPPED-BUCKET-FOLLOWUP';
	assertLightProbeProof( file, Array.isArray( report.artifactMatrix.rows ) &&
		Array.isArray( report.regionMatrix.rows ) &&
		report.artifactMatrix.rows.length > 0 &&
		report.regionMatrix.rows.length > 0,
	'grounding parity artifact: proof report must persist raw artifact and region matrices for auditability.' );
	assertLightProbeProof( file,
		report.currentEvidence.performanceEvidence.bakeTexelBudgetStatus === 'asserted' &&
		report.currentEvidence.performanceEvidence.measuredTimingStatus === 'reported-not-gated' &&
		report.currentEvidence.performanceEvidence.projectionShapeProfile?.status === 'OPEN-FRAGMENT-COEFFICIENT-PROJECTION-REDUNDANCY' &&
		report.currentEvidence.performanceEvidence.projectionShapeProfile.coefficientPixelsPerProbe === 9 &&
		report.currentEvidence.performanceEvidence.projectionShapeProfile.cubemapSweepsPerProbe === 9 &&
		report.currentEvidence.performanceEvidence.projectionShapeProfile.computeCubemapSweepsPerProbe === 1 &&
		report.currentEvidence.performanceEvidence.projectionShapeProfile.staticWorkReductionPercent === 88.8889 &&
		report.currentEvidence.performanceEvidence.projectionShapeProfile.duplicatedCubemapIntegrationFactor === 9 &&
		report.currentEvidence.performanceEvidence.snapshotBakeTimings.every( timing => timing > 0 ) &&
		report.currentEvidence.webglReference?.label === lightProbeWebGLReferenceLabel,
		'grounding parity artifact: proof report must keep cubemap texel budget as the performance gate, profile projection-shape redundancy, report positive non-gated bake timings, and persist the WebGL reference.' );
	assertLightProbeProof( file,
		report.currentEvidence.performanceEvidence.computeProjectionDesignSketch?.status === 'DESIGN-SKETCH-IMPLEMENTED-AS-GUARDED-RUNTIME' &&
		/guarded TSL compute node/i.test( report.currentEvidence.performanceEvidence.computeProjectionDesignSketch.nonGoal ) &&
		/current atlas repack input contract/i.test( report.currentEvidence.performanceEvidence.computeProjectionDesignSketch.storageLayout.output ) &&
		/one cubemap sweep per probe/i.test( report.currentEvidence.performanceEvidence.computeProjectionDesignSketch.reductionContract.sweepCount ) &&
		/current SH basis constants/i.test( report.currentEvidence.performanceEvidence.computeProjectionDesignSketch.reductionContract.basisContract ) &&
		/_repackAtlas/i.test( report.currentEvidence.performanceEvidence.computeProjectionDesignSketch.outputPackingContract.coefficientRows ) &&
		report.currentEvidence.performanceEvidence.computeProjectionDesignSketch.parityTolerance.maxCoefficientDelta === 0.0001 &&
		report.currentEvidence.performanceEvidence.computeProjectionDesignSketch.parityTolerance.fixtures.includes( 'face-asymmetric' ) &&
		report.currentEvidence.performanceEvidence.computeProjectionDesignSketch.fallbackBehavior.defaultPath === 'fragment-coefficient-projection' &&
		report.currentEvidence.performanceEvidence.computeProjectionDesignSketch.architectureDiagram.includes( 'flowchart LR' ) &&
		report.currentEvidence.performanceEvidence.computeProjectionDesignSketch.architectureDiagram.some( line => /fragment fallback remains active/.test( line ) ),
		'grounding parity artifact: compute projection design sketch must cover guarded runtime status, storage layout, reduction, packing, parity tolerance, architecture diagram, and fragment fallback.' );
	assertLightProbeProof( file,
		[ 'CAPTURED-RUNTIME-PARITY-EVIDENCE', 'CAPTURED-PROOF-ONLY-RUNTIME-READBACK-PENDING' ].includes( report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan?.status ) &&
		/runtime/i.test( report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.runtimeBoundary ) &&
		report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.capturedEvidence.includes( 'compute-fixture-parity' ) &&
		report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.capturedEvidence.includes( 'compute-atlas-repack-parity' ) &&
		report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.capturedEvidence.includes( 'compute-adapter-fallback' ) &&
		( report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.capturedEvidence.includes( 'compute-runtime-readback-parity' ) ||
			report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.openEvidence.includes( 'compute-runtime-readback-parity' ) ) &&
		report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.requiredEvidence.length === 4 &&
		report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.requiredEvidence.some( evidence =>
			evidence.id === 'compute-fixture-parity' &&
			evidence.captureStatus === 'CAPTURED-PROOF-ONLY-MOCK-PASSING' &&
			evidence.baseline === 'fragment-coefficient-projection' &&
			evidence.candidate === 'compute-probe-reduction' &&
			evidence.requiredFixtures.includes( 'face-asymmetric' ) &&
			/0\.0001/.test( evidence.passCondition ) &&
			evidence.actualMaxDelta <= 0.0001
		) &&
		report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.requiredEvidence.some( evidence =>
			evidence.id === 'compute-atlas-repack-parity' &&
			evidence.captureStatus === 'CAPTURED-PROOF-ONLY-ATLAS-REPACK-PASSING' &&
			/_repackAtlas/.test( evidence.baseline ) &&
			/padding\/validity contracts/.test( evidence.passCondition ) &&
			evidence.actualMaxDelta <= 0.008
		) &&
		report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.requiredEvidence.some( evidence =>
			evidence.id === 'compute-adapter-fallback' &&
			evidence.captureStatus === 'CAPTURED-RUNTIME-GUARDED-ADAPTER-FALLBACK-PASSING' &&
			evidence.baseline === 'fragment-coefficient-projection' &&
			/unsupported adapters keep fragment-coefficient-projection/.test( evidence.passCondition ) &&
			evidence.actualScenarioCount >= 4
		) &&
		report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.requiredEvidence.some( evidence =>
			evidence.id === 'compute-runtime-readback-parity' &&
			[ 'CAPTURED-RUNTIME-READBACK-PASSING', 'OPEN-NOT-CAPTURED' ].includes( evidence.captureStatus ) &&
			evidence.baseline === 'fragment-coefficient-projection' &&
			evidence.candidate === 'compute-probe-reduction' &&
			/runtime-low-res-cornell-coefficients/.test( evidence.requiredFixtures.join( ' ' ) ) &&
			( evidence.captureStatus === 'OPEN-NOT-CAPTURED' ||
				( evidence.actualCoefficientMaxDelta <= report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.coefficientTolerance &&
					evidence.actualAtlasMaxDelta <= report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.atlasTolerance ) )
		) &&
		report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.statusTransition.previous === 'PARITY-CANDIDATE-NOT-RUNTIME' &&
		[ 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY', 'IMPLEMENTED-WITH-PARITY-EVIDENCE' ].includes( report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.statusTransition.current ) &&
		report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.statusTransition.nextRuntime === 'IMPLEMENTED-WITH-PARITY-EVIDENCE' &&
		report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan.statusTransition.promoted === 'IMPLEMENTED-WITH-PARITY-EVIDENCE',
		'grounding parity artifact: compute projection parity evidence plan must specify fixture parity, atlas repack parity, adapter fallback, runtime readback, and status transition.' );
	assertLightProbeProof( file,
		[ 'RUNTIME-PARITY-EVIDENCE-CAPTURED', 'GUARDED-RUNTIME-IMPLEMENTED-PARITY-PENDING' ].includes( report.currentEvidence.performanceEvidence.computeProjectionStatusTransitionGuard?.status ) &&
		[ 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY', 'IMPLEMENTED-WITH-PARITY-EVIDENCE' ].includes( report.currentEvidence.performanceEvidence.computeProjectionStatusTransitionGuard.currentContractStatus ) &&
		[ 'CAPTURED-RUNTIME-PARITY-EVIDENCE', 'CAPTURED-PROOF-ONLY-RUNTIME-READBACK-PENDING' ].includes( report.currentEvidence.performanceEvidence.computeProjectionStatusTransitionGuard.evidencePlanStatus ) &&
		report.currentEvidence.performanceEvidence.computeProjectionStatusTransitionGuard.allowedNextContractStatus === 'IMPLEMENTED-WITH-PARITY-EVIDENCE' &&
		report.currentEvidence.performanceEvidence.computeProjectionStatusTransitionGuard.runtimeStatusRequired === 'IMPLEMENTED-WITH-PARITY-EVIDENCE' &&
		report.currentEvidence.performanceEvidence.computeProjectionStatusTransitionGuard.runtimeMarkersAllowed === true &&
		report.currentEvidence.performanceEvidence.computeProjectionStatusTransitionGuard.publicApiChangeAllowed === false &&
		report.currentEvidence.performanceEvidence.computeProjectionStatusTransitionGuard.blockedRuntimeMarkers.includes( 'computeProjectionPipeline' ) &&
		/IMPLEMENTED-WITH-PARITY-EVIDENCE|IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY/.test( report.currentEvidence.performanceEvidence.computeProjectionStatusTransitionGuard.guardRule ) &&
		/runtime parity readback|coefficients and atlas repack/.test( report.currentEvidence.performanceEvidence.computeProjectionStatusTransitionGuard.promotionBoundary ),
		'grounding parity artifact: compute projection transition guard must record runtime parity evidence while retaining fallback boundaries.' );
	assertLightProbeProof( file,
		report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign?.status === 'CANDIDATE-DESIGN-NOTE-PROOF-ONLY' &&
		/does not introduce hand-written WGSL/.test( report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign.nonGoal ) &&
		/one logical dispatch group per probe/.test( report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign.dispatchShape.unit ) &&
		/c0\.\.c8 RGB/.test( report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign.dispatchShape.work ) &&
		/_repackAtlas/.test( report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign.storageLayout.output ) &&
		/4π \/ totalWeight/.test( report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign.workgroupStrategy.phase3 ) &&
		report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign.outputContract.parityInputs.includes( 'compute-adapter-fallback' ) &&
		report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign.fallbackBranch.default === 'fragment-coefficient-projection' &&
		report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign.fallbackBranch.candidate === 'compute-probe-reduction' &&
		/IMPLEMENTED-WITH-PARITY-EVIDENCE/.test( report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign.fallbackBranch.rule ) &&
		report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign.precisionBehavior.coefficientTolerance === 0.0001 &&
		report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign.precisionBehavior.atlasReadbackTolerance === 0.008,
		'grounding parity artifact: compute projection candidate design note must specify dispatch, storage, workgroup, output, fallback, and precision behavior.' );
	assertLightProbeProof( file,
		[ 'RUNTIME-PARITY-READBACK-PASSING', 'RUNTIME-IMPLEMENTED-PARITY-READBACK-PENDING' ].includes( report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist?.status ) &&
		/guarded compute projection runtime path|readback-validated/.test( report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.verdict ) &&
		[ 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY', 'IMPLEMENTED-WITH-PARITY-EVIDENCE' ].includes( report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.currentContractStatus ) &&
		report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.requiredRuntimeStatus === 'IMPLEMENTED-WITH-PARITY-EVIDENCE' &&
		report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.runtimeMarkersAllowed === true &&
		report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.publicApiChangeAllowed === false &&
		typeof report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.proofOnlyDone === 'boolean' &&
		typeof report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.runtimeDone === 'boolean' &&
		typeof report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.runtimeParityReadbackDone === 'boolean' &&
		report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.completedPhases.some( phase => phase.id === 'contract-gate' ) &&
		report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.completedPhases.some( phase => phase.id === 'atlas-repack-parity' ) &&
		report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.blockersBeforeRuntime.some( blocker => blocker.id === 'wgsl-compute-entrypoint' ) &&
		report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.blockersBeforeRuntime.some( blocker =>
			blocker.id === 'actual-runtime-parity-readback' &&
			[ 'PASSED-BROWSER-E2E', 'PENDING-BROWSER-E2E' ].includes( blocker.status ) &&
			/actual compute output|read back/.test( blocker.reason )
		) &&
		report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.completionDefinition.nextLegalState === 'IMPLEMENTED-WITH-PARITY-EVIDENCE' &&
		report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist.phaseDiagram.includes( 'flowchart TD' ),
		'grounding parity artifact: compute projection implementation readiness checklist must record guarded runtime implementation and runtime parity readback state.' );
	assertLightProbeProof( file,
		report.currentEvidence.performanceEvidence.computeProjectionCandidateOracle?.status === 'PROOF-ONLY-MOCK-PARITY-PASSING' &&
		report.currentEvidence.performanceEvidence.computeProjectionCandidateOracle.runtimePathIntroduced === false &&
		report.currentEvidence.performanceEvidence.computeProjectionCandidateOracle.baselinePath === 'fragment-coefficient-projection' &&
		report.currentEvidence.performanceEvidence.computeProjectionCandidateOracle.candidatePath === 'compute-probe-reduction' &&
		report.currentEvidence.performanceEvidence.computeProjectionCandidateOracle.baselineCubemapSweepsPerProbe === 9 &&
		report.currentEvidence.performanceEvidence.computeProjectionCandidateOracle.candidateCubemapSweepsPerProbe === 1 &&
		report.currentEvidence.performanceEvidence.computeProjectionCandidateOracle.maxCandidateToFragmentDelta <=
			report.currentEvidence.performanceEvidence.computeProjectionCandidateOracle.tolerance &&
		report.currentEvidence.performanceEvidence.computeProjectionCandidateOracle.fixtures.every( fixture =>
			fixture.candidateToFragmentDelta <= report.currentEvidence.performanceEvidence.computeProjectionCandidateOracle.tolerance ),
		'grounding parity artifact: proof-only compute projection candidate oracle must pass synthetic fixture parity without introducing runtime.' );
	assertLightProbeProof( file,
		report.currentEvidence.performanceEvidence.computeProjectionAdapterFallbackOracle?.status === 'RUNTIME-GUARDED-ADAPTER-FALLBACK-SPEC-PASSING' &&
		report.currentEvidence.performanceEvidence.computeProjectionAdapterFallbackOracle.runtimePathIntroduced === true &&
		report.currentEvidence.performanceEvidence.computeProjectionAdapterFallbackOracle.publicApiChanged === false &&
		report.currentEvidence.performanceEvidence.computeProjectionAdapterFallbackOracle.defaultPath === 'fragment-coefficient-projection' &&
		report.currentEvidence.performanceEvidence.computeProjectionAdapterFallbackOracle.candidatePath === 'compute-probe-reduction' &&
		report.currentEvidence.performanceEvidence.computeProjectionAdapterFallbackOracle.scenarios.some( scenario =>
			scenario.label === 'runtime-implemented-adapter-supported' &&
			scenario.contractStatus === 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY' &&
			scenario.selectedPath === 'compute-probe-reduction' &&
			scenario.fallbackUsed === false
		) &&
		report.currentEvidence.performanceEvidence.computeProjectionAdapterFallbackOracle.scenarios.some( scenario =>
			scenario.label === 'unsupported-compute-capability' &&
			scenario.selectedPath === 'fragment-coefficient-projection' &&
			scenario.fallbackUsed === true
		) &&
		report.currentEvidence.performanceEvidence.computeProjectionAdapterFallbackOracle.scenarios.some( scenario =>
			scenario.label === 'unsupported-storage-texture-capability' &&
			scenario.selectedPath === 'fragment-coefficient-projection' &&
			scenario.fallbackUsed === true
		) &&
		report.currentEvidence.performanceEvidence.computeProjectionAdapterFallbackOracle.scenarios.some( scenario =>
			scenario.label === 'promoted-supported-candidate' &&
			scenario.selectedPath === 'compute-probe-reduction' &&
			scenario.fallbackUsed === false
		),
		'grounding parity artifact: guarded compute adapter fallback oracle must select compute only when runtime is implemented and capabilities exist.' );
	assertLightProbeProof( file,
		report.currentEvidence.performanceEvidence.computeProjectionAtlasRepackOracle?.status === 'PROOF-ONLY-ATLAS-REPACK-PARITY-PASSING' &&
		report.currentEvidence.performanceEvidence.computeProjectionAtlasRepackOracle.runtimePathIntroduced === false &&
		report.currentEvidence.performanceEvidence.computeProjectionAtlasRepackOracle.sourcePath === 'compute-written coefficientTarget-compatible rows' &&
		report.currentEvidence.performanceEvidence.computeProjectionAtlasRepackOracle.repackPath === '_repackAtlas' &&
		report.currentEvidence.performanceEvidence.computeProjectionAtlasRepackOracle.maxReadbackDelta <=
			report.currentEvidence.performanceEvidence.computeProjectionAtlasRepackOracle.readbackTolerance &&
		report.currentEvidence.performanceEvidence.computeProjectionAtlasRepackOracle.openEvidenceAfterPass.includes( 'compute-adapter-fallback' ),
		'grounding parity artifact: proof-only compute atlas repack oracle must prove candidate rows survive existing atlas packing while adapter fallback remains open.' );
	assertLightProbeProof( file,
		report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence?.status === 'RUNTIME-PARITY-READBACK-PASSING' &&
		report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.baselinePath === 'fragment-coefficient-projection' &&
		report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.candidatePath === 'compute-probe-reduction' &&
		report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.computeBackend === 'compute-probe-reduction' &&
		report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.computeFallbackReason === null &&
		report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.coefficientPass === true &&
		report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.atlasPass === true &&
		report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.tolerancePass === true &&
		Number.isFinite( report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.coefficientTolerance ) &&
		Number.isFinite( report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.atlasTolerance ) &&
		report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.coefficientMaxDelta <= report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.coefficientTolerance &&
		report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.atlasMaxDelta <= report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence.atlasTolerance,
		'grounding parity artifact: runtime compute projection parity evidence must pass coefficients, atlas repack, and tolerance validation against fragment projection.' );
	assertLightProbeProof( file,
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence?.status === 'DIAGNOSTIC-PROJECTION-PROFILE-CAPTURED' &&
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.timingPolicy === 'DIAGNOSTIC-PROJECTION-PHASE-NON-GATED' &&
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.timingGated === false &&
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.gpuTimerQueryStatus === 'NOT-CAPTURED' &&
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.projectionPhaseTimingStatus === 'CAPTURED-NON-DETERMINISTIC-PERFORMANCE-NOW' &&
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.projectionTimingSources.includes( 'non-deterministic-performance-now' ) &&
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.staticWork.fragmentTexelVisits === 6912 &&
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.staticWork.computeTexelVisits === 768 &&
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.staticWork.savedTexelVisits === 6144 &&
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.staticWork.reductionPercent === 88.8889 &&
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.fragment.allRunsSelectedExpectedBackend === true &&
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.compute.allRunsSelectedExpectedBackend === true &&
		report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.compute.fallbackReasons.length === 0 &&
		Number.isFinite( report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.fragment.projectionMs.median ) &&
		Number.isFinite( report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.compute.projectionMs.median ) &&
		Number.isFinite( report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.fragment.totalBakeMs.median ) &&
		Number.isFinite( report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence.compute.totalBakeMs.median ),
		'grounding parity artifact: compute projection profiling evidence must capture forced fragment/compute diagnostic timing while preserving the no-GPU-timer claim boundary.' );
	assertLightProbeProof( file,
		report.currentEvidence.revisionTaskBacklog.tasks.some( task =>
			task.id === 'runtime-3' &&
			task.status === 'IMPLEMENTED-WITH-PARITY-EVIDENCE' &&
			/compute projection/i.test( `${ task.title } ${ task.output } ${ task.gate }` ) &&
			/browser\/runtime readback|browser readback/.test( `${ task.output } ${ task.gate }` )
		),
		'grounding parity artifact: compute projection runtime must be guarded and backed by actual parity readback, not an unverified full promotion.' );
	assertLightProbeProof( file,
		report.currentEvidence.revisionTaskBacklog.tasks.some( task =>
			task.id === 'runtime-4' &&
			task.status === 'RUNTIME-PARITY-READBACK-PASSING' &&
			/compute projection candidate readiness checklist/i.test( task.title ) &&
			/guarded runtime implementation/.test( task.output ) &&
			/passing actual runtime parity readback/.test( task.output ) &&
			/fragment fallback/.test( task.gate )
		),
		'grounding parity artifact: compute projection runtime readiness must be implemented with passing parity readback and retained fragment fallback.' );
	assertLightProbeProof( file,
		report.currentEvidence.wgpuLeakAuditStudy !== undefined &&
		[ 'OPEN', 'SUPPORTED' ].includes( report.currentEvidence.wgpuLeakAuditStudy.status ) &&
		report.currentEvidence.wgpuLeakAuditStudy.variants.length === 4 &&
		report.currentEvidence.wgpuLeakAuditStudy.receivers.length === 2 &&
		report.currentEvidence.wgpuLeakAuditStudy.receivers.every( receiver => receiver.rows.length === 8 ) &&
		report.currentEvidence.wgpuLeakAuditStudy.receivers.every( receiver => Number.isFinite( receiver.maskedRegionWrongOverCorrect ) ) &&
		report.currentEvidence.wgpuLeakAuditStudy.receivers.every( receiver => receiver.rows.every( row =>
			Number.isFinite( row.cpuChromaWrongMinusCorrect ) &&
			Number.isFinite( row.cpuL0ChromaWrongMinusCorrect ) &&
			typeof row.sourceRelationToReceiver === 'string' &&
			Number.isFinite( row.sourceValidity ) ) ) &&
		report.currentEvidence.wgpuLeakAuditStudy.variants.every( variant => Number.isFinite( variant.maskedWrongSideColorRatio ) ) &&
		report.currentEvidence.wgpuLeakAuditStudy.variants.some( variant => variant.role === 'validity-only' ) &&

		report.currentEvidence.wgpuLeakAuditStudy.variants.some( variant => variant.role === 'visibility-scaffold-disabled' ) &&
		report.currentEvidence.wgpuLeakAuditStudy.variants.some( variant => variant.role === 'zero-thickness-control' ) &&
		report.currentEvidence.wgpuLeakAuditStudy.verdict.chebyshevTuning === 'UNCHANGED' &&
		[ 'OPEN', 'SUPPORTED' ].includes( report.currentEvidence.wgpuLeakAuditStudy.verdict.cpuGpuLinearGate ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( report.currentEvidence.wgpuLeakAuditStudy.verdict.weightTermGate ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( report.currentEvidence.wgpuLeakAuditStudy.verdict.cpuRenderAgreementGate ),
		'grounding parity artifact: proof report must persist the WebGPU leak audit study with all required leak variants and per-neighbor rows.' );
	const momentBackedVisibility = isMomentBackedVisibility( report.currentEvidence.visibilityMomentInspection );
	assertLightProbeProof( file,
		report.currentEvidence.ddgiVisibilityDepthSpec !== undefined &&
		report.currentEvidence.ddgiVisibilityDepthSpec.momentBacked === momentBackedVisibility &&
		(
			( momentBackedVisibility === true &&
				report.currentEvidence.ddgiVisibilityDepthSpec.status === 'IMPLEMENTED-PRIVATE-DDGI-LITE-MOMENTS' ) ||
			( momentBackedVisibility === false &&
				report.currentEvidence.ddgiVisibilityDepthSpec.status === 'OPEN-VISIBILITY-MOMENTS-SCAFFOLD-DISABLED' )
		),
		'grounding parity artifact: proof report must not claim implemented DDGI-lite moments unless visibility readback is moment-backed.' );
	assertLightProbeProof( file,
		report.currentEvidence.metricTaxonomyStudy?.status === 'DEFINED-PROMOTION-METRIC-SPLIT' &&
		report.currentEvidence.metricTaxonomyStudy.metrics.length >= 6 &&
		report.currentEvidence.metricTaxonomyStudy.metrics.some( metric => metric.key === 'cpuGpuLinearIrradiance' && metric.promotionEligible === true ) &&
		report.currentEvidence.metricTaxonomyStudy.metrics.some( metric => metric.key === 'offscreenSceneLinearFinalVisible' && metric.promotionEligible === true ) &&
		report.currentEvidence.metricTaxonomyStudy.metrics.some( metric => metric.key === 'preToneMaskedVisiblePixels' && metric.promotionEligible === 'provisional' ) &&
		report.currentEvidence.metricTaxonomyStudy.metrics.some( metric => metric.key === 'presentationMaskedCanvasRatio' && metric.promotionEligible === false ) &&
		typeof report.currentEvidence.metricTaxonomyStudy.gates.sceneLinearTargetGate === 'string' &&
		typeof report.currentEvidence.metricTaxonomyStudy.gates.contributionGate === 'string' &&
		report.currentEvidence.metricTaxonomyStudy.gates.presentationGateUse === 'DIAGNOSTIC-ONLY' &&
		report.currentEvidence.metricTaxonomyStudy.gates.chebyshevTuning === 'UNCHANGED',
		'grounding parity artifact: proof report must classify promotion-eligible, provisional, and presentation-only metric spaces before threshold tuning.' );
	assertLightProbeProof( file,
		report.currentEvidence.sealedRenderMetricMismatch.finalVisibleProbeOnlySceneLinearCpuAgreement !== undefined &&
		[ 'OPEN', 'SUPPORTED' ].includes( report.currentEvidence.sealedRenderMetricMismatch.finalVisibleProbeOnlySceneLinearCpuAgreement.status ) &&
		report.currentEvidence.sealedRenderMetricMismatch.finalVisibleProbeOnlySceneLinearCpuAgreement.mode === 'probe-indirect-only-scene-linear-vs-cpu-surface-sh' &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.finalVisibleProbeOnlySceneLinearCpuAgreement.originalProbeOnlyAvailable === 'boolean' &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.finalVisibleProbeOnlySceneLinearCpuAgreement.neutralProbeOnlyAvailable === 'boolean' &&
		report.currentEvidence.sealedRenderMetricMismatch.finalVisibleProbeOnlySceneLinearCpuAgreement.tolerance === report.currentEvidence.sealedRenderMetricMismatch.cpuRenderAgreementTolerance &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.finalVisibleProbeOnlySceneLinearCpuAgreement.diagnosticConclusion === 'string',
		'grounding parity artifact: proof report must isolate probe-only scene-linear render agreement before using final visible color as proof.' );
	assertLightProbeProof( file,
		report.currentEvidence.webglLeakReferenceStudy?.status === 'OPEN-NOT-COMPARABLE' &&
		report.currentEvidence.webglLeakReferenceStudy.reference.label === lightProbeWebGLReferenceLabel &&
		report.currentEvidence.webglLeakReferenceStudy.sealedWallAttempt.comparable === false &&
		/non-comparable|sealed-wall|fixture|harness/i.test( report.currentEvidence.webglLeakReferenceStudy.sealedWallAttempt.reason ),
		'grounding parity artifact: WebGL leak reference must stay bounded and explicitly non-comparable when no trivial sealed-wall path exists.' );
	assertLightProbeProof( file,
		report.currentEvidence.researchRoadmapRevision?.status === 'REVISED-WGPU-FIRST' &&
		report.currentEvidence.researchRoadmapRevision.literatureDecisions.some( item => /SixteenStudio.*not visibility proof/.test( item ) ) &&
		report.currentEvidence.researchRoadmapRevision.literatureDecisions.some( item => /ZH3.*future compression/.test( item ) ) &&
		report.currentEvidence.researchRoadmapRevision.nextRoadmap[ 0 ].includes( 'WebGPU leak audit' ),
		'grounding parity artifact: proof report must persist the revised literature and WebGPU-first roadmap.' );
	assertLightProbeProof( file,
		report.currentEvidence.sealedShContributionDiagnostic !== undefined &&
		report.currentEvidence.probeContentChromaStudy !== undefined &&
		[ 'OPEN-PROBE-CONTENT-CHROMA-PRESSURE', 'SUPPORTED-PROBE-CONTENT-CHROMA-BOUNDED' ].includes( report.currentEvidence.probeContentChromaStudy.status ) &&
		Number.isFinite( report.currentEvidence.probeContentChromaStudy.summary.maxCorrectSideChromaPressure ) &&
		report.currentEvidence.probeBakeContaminationMap !== undefined &&
		[
			'OPEN-BAKE-CAPTURE-SIDE-WALL-VISIBILITY-BYPASS',
			'OPEN-BAKE-CONTENT-DIRECTIONAL-CHROMA-PRESSURE',
			'SUPPORTED-BAKE-CONTENT-CHROMA-BOUNDED'
		].includes( report.currentEvidence.probeBakeContaminationMap.status ) &&
		Number.isFinite( report.currentEvidence.probeBakeContaminationMap.summary.uniqueProbeCount ) &&
		Number.isFinite( report.currentEvidence.probeBakeContaminationMap.summary.maxCorrectReceiverChromaPressure ) &&
		typeof report.currentEvidence.probeBakeContaminationMap.summary.dominantProbeBandResponsibility === 'string' &&
		Number.isFinite( report.currentEvidence.probeBakeContaminationMap.summary.directionalBandDominantProbeCount ) &&
		report.currentEvidence.probeBakeContaminationMap.dominantProbeCoefficientStudy !== undefined &&
		[ 'OPEN-DOMINANT-SH-COEFFICIENT-LOBE-DRIVERS', 'SUPPORTED-NO-DOMINANT-SH-COEFFICIENT-DRIVERS' ].includes(
			report.currentEvidence.probeBakeContaminationMap.dominantProbeCoefficientStudy.status
		) &&
		report.currentEvidence.probeBakeContaminationMap.shDampingOracleStudy !== undefined &&
		[
			'SUPPORTED-SH-DAMPING-ORACLE-REDUCES-AGGREGATE-CHROMA',
			'OPEN-SH-DAMPING-ORACLE-CONTEXT-ONLY',
			'OPEN-SH-DAMPING-ORACLE-NO-SAFE-WIN'
		].includes(
			report.currentEvidence.probeBakeContaminationMap.shDampingOracleStudy.status
		) &&
		report.currentEvidence.probeBakeContaminationMap.dominantProbePlacementStudy !== undefined &&
		[
			'SUPPORTED-PLACEMENT-ORACLE-AGGREGATE-WIN',
			'OPEN-PLACEMENT-ORACLE-CONTEXT-ONLY',
			'OPEN-PLACEMENT-ORACLE-NO-SAFE-WIN'
		].includes(
			report.currentEvidence.probeBakeContaminationMap.dominantProbePlacementStudy.status
		) &&
		report.currentEvidence.probeBakeContaminationMap.combinedSourceDampingOracleStudy !== undefined &&
		[
			'SUPPORTED-COMBINED-SOURCE-DAMPING-AGGREGATE-WIN',
			'OPEN-COMBINED-SOURCE-DAMPING-CONTEXT-ONLY',
			'OPEN-COMBINED-SOURCE-DAMPING-NO-SAFE-WIN'
		].includes(
			report.currentEvidence.probeBakeContaminationMap.combinedSourceDampingOracleStudy.status
		) &&
		report.currentEvidence.probeBakeContaminationMap.dilationSourceQualityStudy !== undefined &&
		[
			'OPEN-DILATION-SOURCE-QUALITY-CANDIDATE',
			'SUPPORTED-DILATION-SOURCE-QUALITY-BOUNDED'
		].includes(
			report.currentEvidence.probeBakeContaminationMap.dilationSourceQualityStudy.status
		) &&
		report.currentEvidence.probeBakeContaminationMap.sameSideLayerMaskOracleStudy !== undefined &&
		[
			'SUPPORTED-SAME-SIDE-LAYER-AGGREGATE-WIN',
			'OPEN-SAME-SIDE-LAYER-NO-SAFE-WIN'
		].includes(
			report.currentEvidence.probeBakeContaminationMap.sameSideLayerMaskOracleStudy.status
		) &&
		report.currentEvidence.probeBakeContaminationMap.sdfStaticBlockerOracleStudy !== undefined &&
		[
			'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN',
			'OPEN-SDF-STATIC-BLOCKER-MISSED-WRONG-SIDE',
			'OPEN-SDF-STATIC-BLOCKER-NO-AGGREGATE-WIN'
		].includes(
			report.currentEvidence.probeBakeContaminationMap.sdfStaticBlockerOracleStudy.status
		) &&
		report.currentEvidence.probeBakeContaminationMap.aggregateBakePolicyOracleStudy !== undefined &&
		[
			'SUPPORTED-AGGREGATE-BAKE-POLICY-WIN',
			'OPEN-AGGREGATE-BAKE-POLICY-NO-SAFE-WIN'
		].includes(
			report.currentEvidence.probeBakeContaminationMap.aggregateBakePolicyOracleStudy.status
		) &&
		Number.isFinite( report.currentEvidence.probeBakeContaminationMap.aggregateBakePolicyOracleStudy.summary.safeReceiverWinCount ) &&
		report.currentEvidence.probeDensityMetricStudy !== undefined &&
		[
			'OPEN-PROBE-DENSITY-DIVIDER-STRADDLE-RISK',
			'SUPPORTED-PROBE-DENSITY-BOUNDED'
		].includes(
			report.currentEvidence.probeDensityMetricStudy.status
		) &&
		Number.isFinite( report.currentEvidence.probeDensityMetricStudy.summary.riskReceiverCount ) &&
		report.currentEvidence.receiverSampleMetricAlignmentStudy !== undefined &&
		[
			'OPEN-CENTER-SURFACE-SAMPLE-DIVERGENCE',
			'SUPPORTED-CENTER-SURFACE-SAMPLE-ALIGNED'
		].includes(
			report.currentEvidence.receiverSampleMetricAlignmentStudy.status
		) &&
		Number.isFinite( report.currentEvidence.receiverSampleMetricAlignmentStudy.summary.centerVsSurfaceCpuDelta ) &&
		report.currentEvidence.surfaceAnchorPlacementStudy !== undefined &&
		[
			'SUPPORTED-SURFACE-ANCHOR-BIAS-CANDIDATE',
			'OPEN-SURFACE-ANCHOR-CENTER-HIDES-LEAK',
			'OPEN-SURFACE-ANCHOR-BIAS-NO-WIN'
		].includes(
			report.currentEvidence.surfaceAnchorPlacementStudy.status
		) &&
		Number.isFinite( report.currentEvidence.surfaceAnchorPlacementStudy.summary.centerSurfaceDelta ) &&
		typeof report.currentEvidence.surfaceAnchorPlacementStudy.summary.centerHidesSurfaceLeak === 'boolean' &&
		report.currentEvidence.surfaceShContentStudy !== undefined &&
		[
			'OPEN-SURFACE-SH-CONTENT-PRESSURE',
			'OPEN-SURFACE-SH-CONTENT-PARTIAL-PRESSURE',
			'OPEN-SURFACE-LEAK-WITHOUT-MAPPED-CONTENT-PRESSURE',
			'SUPPORTED-SURFACE-SH-CONTENT-BOUNDED'
		].includes(
			report.currentEvidence.surfaceShContentStudy.status
		) &&
		Number.isFinite( report.currentEvidence.surfaceShContentStudy.summary.leakSampleCount ) &&
		Number.isFinite( report.currentEvidence.surfaceShContentStudy.summary.worstSampleWrongOverCorrect ) &&
		report.currentEvidence.surfaceSampleCoefficientAttributionStudy !== undefined &&
		[
			'OPEN-SURFACE-COEFFICIENT-ATTRIBUTION',
			'SUPPORTED-SURFACE-COEFFICIENT-ATTRIBUTION-BOUNDED'
		].includes(
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.status
		) &&
		Number.isFinite( report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.surfaceSampleCount ) &&
		Number.isFinite( report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.leakSampleCount ) &&
		Number.isFinite( report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount ) &&
		Number.isFinite( report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.weightedLeakWrongChannelPressure ) &&
		Number.isFinite( report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.weightedLeakCorrectChannelPreservation ) &&
		Number.isFinite( report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.wrongSideDominantLeakSampleCount ) &&
		Number.isFinite( report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.correctSideDominantLeakSampleCount ) &&
		Number.isFinite( report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.l2DominantLeakSampleCount ) &&
		Number.isFinite( report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.sourcePressureLeakSampleCount ) &&
		Number.isFinite( report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.sourcePressureDominantLeakSampleCount ) &&
		report.currentEvidence.surfaceShContentStudy.summary.surfaceSampleCount ===
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.surfaceSampleCount &&
		report.currentEvidence.surfaceShContentStudy.summary.leakSampleCount ===
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.leakSampleCount &&
		Number.isFinite( report.currentEvidence.surfaceShContentStudy.summary.leakSamplesWithoutContentPressureCount ) &&
		Number.isFinite( report.currentEvidence.surfaceShContentStudy.summary.leakContentPressureCoverageRatio ) &&
		report.currentEvidence.surfaceShContentStudy.summary.leakSampleCount ===
			report.currentEvidence.surfaceShContentStudy.summary.leakSamplesWithContentPressureCount +
			report.currentEvidence.surfaceShContentStudy.summary.leakSamplesWithoutContentPressureCount &&
		report.currentEvidence.surfaceShContentStudy.receiverRows.every( receiver =>
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
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.dominantProbeHistogram,
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount
		) &&
		isFiniteCountHistogram(
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.dominantBandHistogram,
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount
		) &&
		isFiniteCountHistogram(
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.dominantCoefficientHistogram,
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount
		) &&
		report.currentEvidence.surfaceContentAttributionSplitStudy !== undefined &&
		[
			'OPEN-SURFACE-CONTENT-ATTRIBUTION-SPLIT',
			'OPEN-SURFACE-CONTENT-ATTRIBUTION-MAPPED',
			'OPEN-SURFACE-CONTENT-ATTRIBUTION-UNMAPPED',
			'OPEN-SURFACE-CONTENT-ATTRIBUTION-UNDER-INSTRUMENTED',
			'SUPPORTED-SURFACE-CONTENT-ATTRIBUTION-SPLIT-BOUNDED'
		].includes( report.currentEvidence.surfaceContentAttributionSplitStudy.status ) &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.status === expectedSurfaceContentSplitStatus &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.proofBoundary.includes( 'Report-only split of canonical leaking surface attribution rows' ) &&
		Array.isArray( report.currentEvidence.surfaceContentAttributionSplitStudy.rows ) &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.summary.leakSampleCount ===
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.leakSampleCount &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.summary.attributedLeakSampleCount ===
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.summary.attributedLeakSampleCount ===
			report.currentEvidence.surfaceContentAttributionSplitStudy.rows.length &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.summary.leakSampleCount ===
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.attributedLeakSampleCount +
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unattributedLeakSampleCount &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.summary.attributedLeakSampleCount ===
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedLeakSampleCount +
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedLeakSampleCount &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedLeakSampleCount ===
			surfaceContentMappedRows.length &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedLeakSampleCount ===
			surfaceContentUnmappedRows.length &&
		Number.isFinite( report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedCoverageRatio ) &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedCoverageRatio === expectedSurfaceContentMappedCoverage &&
		isFiniteCountHistogram(
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedDominantProbeHistogram,
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedLeakSampleCount
		) &&
		sameCountHistogram(
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedDominantProbeHistogram,
			countHistogram( surfaceContentMappedRows, 'attributionDominantProbeIndex' )
		) &&
		isFiniteCountHistogram(
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedDominantProbeHistogram,
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedLeakSampleCount
		) &&
		sameCountHistogram(
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedDominantProbeHistogram,
			countHistogram( surfaceContentUnmappedRows, 'attributionDominantProbeIndex' )
		) &&
		isFiniteCountHistogram(
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedDominantBandHistogram,
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedLeakSampleCount
		) &&
		sameCountHistogram(
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedDominantBandHistogram,
			countHistogram( surfaceContentMappedRows, 'attributionDominantBand' )
		) &&
		isFiniteCountHistogram(
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedDominantBandHistogram,
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedLeakSampleCount
		) &&
		sameCountHistogram(
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedDominantBandHistogram,
			countHistogram( surfaceContentUnmappedRows, 'attributionDominantBand' )
		) &&
		isFiniteCountHistogram(
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedDominantCoefficientHistogram,
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedLeakSampleCount
		) &&
		sameCountHistogram(
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedDominantCoefficientHistogram,
			countHistogram( surfaceContentMappedRows, 'attributionDominantCoefficient' )
		) &&
		isFiniteCountHistogram(
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedDominantCoefficientHistogram,
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedLeakSampleCount
		) &&
		sameCountHistogram(
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedDominantCoefficientHistogram,
			countHistogram( surfaceContentUnmappedRows, 'attributionDominantCoefficient' )
		) &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedWrongChannelPressure ===
			roundedRowSum( surfaceContentMappedRows, 'attributionWrongChannelPressure' ) &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedWrongChannelPressure ===
			roundedRowSum( surfaceContentUnmappedRows, 'attributionWrongChannelPressure' ) &&
		report.currentEvidence.surfaceContentAttributionSplitStudy.rows.every( row =>
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
		report.currentEvidence.surfaceContentAttributionFollowupStudy !== undefined &&
		[
			'OPEN-SURFACE-CONTENT-DUAL-BUCKET-FOLLOWUP',
			'OPEN-SURFACE-CONTENT-MAPPED-BUCKET-FOLLOWUP',
			'OPEN-SURFACE-CONTENT-UNMAPPED-BUCKET-FOLLOWUP',
			'OPEN-SURFACE-CONTENT-FOLLOWUP-UNDER-INSTRUMENTED',
			'SUPPORTED-SURFACE-CONTENT-FOLLOWUP-BOUNDED'
		].includes( report.currentEvidence.surfaceContentAttributionFollowupStudy.status ) &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.status === expectedSurfaceContentFollowupStatus &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.proofBoundary.includes( 'Report-only follow-up prioritization' ) &&
		Array.isArray( report.currentEvidence.surfaceContentAttributionFollowupStudy.rows ) &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.summary.bucketCount ===
			report.currentEvidence.surfaceContentAttributionFollowupStudy.rows.length &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.summary.attributedLeakSampleCount ===
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.attributedLeakSampleCount &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.summary.unattributedLeakSampleCount ===
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unattributedLeakSampleCount &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.summary.totalBucketSampleCount ===
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.attributedLeakSampleCount &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.summary.totalBucketSampleCount ===
			surfaceContentFollowupRows.reduce( ( total, row ) => total + row.sampleCount, 0 ) &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.summary.mappedBucketSampleCount ===
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedLeakSampleCount &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.summary.unmappedBucketSampleCount ===
			report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedLeakSampleCount &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.summary.hasMappedBucket ===
			( report.currentEvidence.surfaceContentAttributionSplitStudy.summary.mappedLeakSampleCount > 0 ) &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.summary.hasUnmappedBucket ===
			( report.currentEvidence.surfaceContentAttributionSplitStudy.summary.unmappedLeakSampleCount > 0 ) &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.summary.noRuntimePromotion === true &&
		/proof-only/i.test( report.currentEvidence.surfaceContentAttributionFollowupStudy.summary.nextProofOnlyAction ) &&
		report.currentEvidence.surfaceContentAttributionFollowupStudy.rows.every( row =>
			[ 'mapped-bake-content', 'unmapped-coefficient-attribution' ].includes( row.id ) &&
			Number.isInteger( row.sampleCount ) &&
			row.sampleCount >= 0 &&
			isFiniteCountHistogram( row.receiverHistogram, row.sampleCount ) &&
			isFiniteCountHistogram( row.contentProbeHistogram, row.sampleCount ) &&
			isFiniteCountHistogram( row.contentBandHistogram, row.sampleCount ) &&
			isFiniteCountHistogram( row.attributionProbeHistogram, row.sampleCount ) &&
			isFiniteCountHistogram( row.attributionBandHistogram, row.sampleCount ) &&
			isFiniteCountHistogram( row.attributionCoefficientHistogram, row.sampleCount ) &&
			Number.isFinite( row.wrongChannelPressure ) &&
			Number.isFinite( row.correctChannelPreservation ) &&
			Number.isFinite( row.maxRuntimeWrongOverCorrect ) &&
			Number.isFinite( row.maxContentDominantPressure ) &&
			typeof row.proofOnlyQuestion === 'string' &&
			/proof-only/i.test( row.recommendedFollowup ) &&
			typeof row.interpretation === 'string' ) &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy !== undefined &&
		[
			'OPEN-MAPPED-BAKE-CONTENT-SOURCE-POLICY-ORACLE',
			'SUPPORTED-MAPPED-BAKE-CONTENT-SOURCE-POLICY-BOUNDED'
		].includes( report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.status ) &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.status ===
			( surfaceContentMappedRows.length > 0 ?
				'OPEN-MAPPED-BAKE-CONTENT-SOURCE-POLICY-ORACLE' :
				'SUPPORTED-MAPPED-BAKE-CONTENT-SOURCE-POLICY-BOUNDED' ) &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.proofBoundary.includes( 'CPU/report-only mapped bake-content/source-policy oracle' ) &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.proofBoundary.includes( 'does not change bake capture, runtime sampling, public API, docs, or Chebyshev thresholds' ) &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.noRuntimePromotion === true &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.noRuntimePromotion === true &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.sampleCount === surfaceContentMappedRows.length &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.sampleCount === mappedBakeContentSourcePolicyOracleRows.length &&
		matchesMappedBakeContentOracleRows(
			report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.rows,
			surfaceContentMappedRows
		) &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.contentDominantPressureSum ===
			roundedRowSum( surfaceContentMappedRows, 'contentDominantPressure' ) &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.contentDominantWeightedPressureSum ===
			roundedRowSum( surfaceContentMappedRows, 'contentDominantWeightedPressure' ) &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.attributionWrongChannelPressureSum ===
			roundedRowSum( surfaceContentMappedRows, 'attributionWrongChannelPressure' ) &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.attributionCorrectChannelPreservationSum ===
			roundedRowSum( surfaceContentMappedRows, 'attributionCorrectChannelPreservation' ) &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.bandMismatchCount ===
			surfaceContentMappedRows.filter( row => row.contentDominantBand !== row.attributionDominantBand ).length &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.allMappedRowsHaveBandMismatch ===
			( surfaceContentMappedRows.length > 0 && surfaceContentMappedRows.every( row => row.contentDominantBand !== row.attributionDominantBand ) ) &&
		isFiniteCountHistogram(
			report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.contentProbeHistogram,
			surfaceContentMappedRows.length
		) &&
		sameCountHistogram(
			report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.contentProbeHistogram,
			countHistogram( surfaceContentMappedRows, 'contentDominantProbeIndex' )
		) &&
		isFiniteCountHistogram(
			report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.contentBandHistogram,
			surfaceContentMappedRows.length
		) &&
		sameCountHistogram(
			report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.contentBandHistogram,
			countHistogram( surfaceContentMappedRows, 'contentDominantBand' )
		) &&
		isFiniteCountHistogram(
			report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.attributionCoefficientHistogram,
			surfaceContentMappedRows.length
		) &&
		sameCountHistogram(
			report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.attributionCoefficientHistogram,
			countHistogram( surfaceContentMappedRows, 'attributionDominantCoefficient' )
		) &&
		sameCountHistogram(
			report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.attributionSourceProbeHistogram,
			countHistogram( surfaceContentMappedRows, 'attributionDominantSourceProbeIndex' )
		) &&
		sameCountHistogram(
			report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.attributionSourceRelationHistogram,
			countHistogram( surfaceContentMappedRows, 'attributionSourceRelationToReceiver' )
		) &&
		/proof-only/i.test( report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.summary.nextProofOnlyAction ) &&
		report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy.rows.every( row =>
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
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy !== undefined &&
		[
			'OPEN-UNMAPPED-COEFFICIENT-ATTRIBUTION-INSTRUMENTATION',
			'SUPPORTED-UNMAPPED-COEFFICIENT-ATTRIBUTION-BOUNDED'
		].includes( report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.status ) &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.status ===
			( surfaceContentUnmappedRows.length > 0 ?
				'OPEN-UNMAPPED-COEFFICIENT-ATTRIBUTION-INSTRUMENTATION' :
				'SUPPORTED-UNMAPPED-COEFFICIENT-ATTRIBUTION-BOUNDED' ) &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.proofBoundary.includes( 'CPU/report-only unmapped coefficient-attribution instrumentation' ) &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.proofBoundary.includes( 'does not change bake capture, runtime sampling, public API, docs, or Chebyshev thresholds' ) &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.noRuntimePromotion === true &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.noRuntimePromotion === true &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.sampleCount === surfaceContentUnmappedRows.length &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.sampleCount === unmappedCoefficientAttributionInstrumentationRows.length &&
		matchesUnmappedCoefficientInstrumentationRows(
			report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.rows,
			surfaceContentUnmappedRows
		) &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.contentPressureAttributionRowCountSum ===
			roundedRowSum( surfaceContentUnmappedRows, 'contentPressureAttributionRowCount' ) &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.attributionWrongChannelPressureSum ===
			roundedRowSum( surfaceContentUnmappedRows, 'attributionWrongChannelPressure' ) &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.attributionCorrectChannelPreservationSum ===
			roundedRowSum( surfaceContentUnmappedRows, 'attributionCorrectChannelPreservation' ) &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.needsCoefficientSourceInstrumentation ===
			( surfaceContentUnmappedRows.length > 0 ) &&
		isFiniteCountHistogram(
			report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.contentProbeHistogram,
			surfaceContentUnmappedRows.length
		) &&
		sameCountHistogram(
			report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.contentProbeHistogram,
			countHistogram( surfaceContentUnmappedRows, 'contentDominantProbeIndex' )
		) &&
		isFiniteCountHistogram(
			report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.contentBandHistogram,
			surfaceContentUnmappedRows.length
		) &&
		sameCountHistogram(
			report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.contentBandHistogram,
			countHistogram( surfaceContentUnmappedRows, 'contentDominantBand' )
		) &&
		isFiniteCountHistogram(
			report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.attributionCoefficientHistogram,
			surfaceContentUnmappedRows.length
		) &&
		sameCountHistogram(
			report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.attributionCoefficientHistogram,
			countHistogram( surfaceContentUnmappedRows, 'attributionDominantCoefficient' )
		) &&
		sameCountHistogram(
			report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.attributionSourceProbeHistogram,
			countHistogram( surfaceContentUnmappedRows, 'attributionDominantSourceProbeIndex' )
		) &&
		sameCountHistogram(
			report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.attributionSourceRelationHistogram,
			countHistogram( surfaceContentUnmappedRows, 'attributionSourceRelationToReceiver' )
		) &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.probe52L10SampleCount ===
			surfaceContentUnmappedRows.filter( row =>
				row.attributionDominantProbeIndex === 52 &&
				row.attributionDominantCoefficient === 'L10'
			).length &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.sourceTraceComplete ===
			surfaceContentUnmappedRows.every( row => row.attributionDominantSourceProbeIndex !== null ) &&
		/proof-only/i.test( report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.summary.nextProofOnlyAction ) &&
		report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy.rows.every( row =>
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
		report.currentEvidence.surfaceAttributionBranchDecision !== undefined &&
		[
			'OPEN-ATTRIBUTION-BRANCH-SELECTED',
			'OPEN-ATTRIBUTION-UNDER-INSTRUMENTED',
			'SUPPORTED-NO-SURFACE-LEAK-BRANCH'
		].includes( report.currentEvidence.surfaceAttributionBranchDecision.status ) &&
		[ 'proof-7a', 'proof-7b', 'proof-7c', 'proof-7d', 'none' ].includes(
			report.currentEvidence.surfaceAttributionBranchDecision.selectedBranch
		) &&
		Number.isFinite( report.currentEvidence.surfaceAttributionBranchDecision.confidence ) &&
		Array.isArray( report.currentEvidence.surfaceAttributionBranchDecision.candidates ) &&
		hasUniqueExactIds( report.currentEvidence.surfaceAttributionBranchDecision.candidates, [ 'proof-7a', 'proof-7b', 'proof-7c' ] ) &&
		report.currentEvidence.surfaceAttributionBranchDecision.candidates.every( candidate =>
			[ 'proof-7a', 'proof-7b', 'proof-7c' ].includes( candidate.branch ) &&
			typeof candidate.oracleFamily === 'string' &&
			Number.isInteger( candidate.score ) &&
			candidate.score >= 0 &&
			typeof candidate.reason === 'string' ) &&
		report.currentEvidence.surfaceAttributionBranchDecision.candidates.every( ( candidate, index, candidates ) =>
			index === 0 || candidates[ index - 1 ].score >= candidate.score ) &&
		report.currentEvidence.surfaceAttributionBranchDecision.candidates.find( candidate => candidate.branch === 'proof-7a' ).score ===
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.sourcePressureLeakSampleCount &&
		report.currentEvidence.surfaceAttributionBranchDecision.candidates.find( candidate => candidate.branch === 'proof-7b' ).score ===
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.l2DominantLeakSampleCount &&
		report.currentEvidence.surfaceAttributionBranchDecision.candidates.find( candidate => candidate.branch === 'proof-7c' ).score ===
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.correctSideDominantLeakSampleCount &&
		report.currentEvidence.surfaceAttributionBranchDecision.observedSignals.sourcePressureCount ===
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.sourcePressureLeakSampleCount &&
		report.currentEvidence.surfaceAttributionBranchDecision.observedSignals.bandPressureCount ===
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.l2DominantLeakSampleCount &&
		report.currentEvidence.surfaceAttributionBranchDecision.observedSignals.blockerPressureCount ===
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.correctSideDominantLeakSampleCount &&
		(
			(
				report.currentEvidence.surfaceAttributionBranchDecision.status === 'OPEN-ATTRIBUTION-BRANCH-SELECTED' &&
				report.currentEvidence.surfaceAttributionBranchDecision.selectedBranch === report.currentEvidence.surfaceAttributionBranchDecision.candidates[ 0 ].branch &&
				report.currentEvidence.surfaceAttributionBranchDecision.candidates[ 0 ].score > 0
			) ||
			(
				report.currentEvidence.surfaceAttributionBranchDecision.status === 'OPEN-ATTRIBUTION-UNDER-INSTRUMENTED' &&
				report.currentEvidence.surfaceAttributionBranchDecision.selectedBranch === 'proof-7d'
			) ||
			(
				report.currentEvidence.surfaceAttributionBranchDecision.status === 'SUPPORTED-NO-SURFACE-LEAK-BRANCH' &&
				report.currentEvidence.surfaceAttributionBranchDecision.selectedBranch === 'none'
			)
		) &&
		typeof report.currentEvidence.surfaceAttributionBranchDecision.nextAction === 'string' &&
		report.currentEvidence.surfaceAttributionFollowupSpec !== undefined &&
		report.currentEvidence.surfaceAttributionFollowupSpec.status === 'SPECIFIED-CAUSAL-ATTRIBUTION-FOLLOWUP' &&
		report.currentEvidence.surfaceAttributionFollowupSpec.mode === 'causal-attribution-before-fix' &&
		report.currentEvidence.surfaceAttributionFollowupSpec.currentEvidence.selectedBranch ===
			report.currentEvidence.surfaceAttributionBranchDecision.selectedBranch &&
		hasUniqueExactIds( report.currentEvidence.surfaceAttributionFollowupSpec.batches, [ 'proof-6', 'proof-7a', 'proof-7b', 'proof-7c', 'proof-7d' ] ) &&
		report.currentEvidence.surfaceAttributionFollowupSpec.batches.every( batch =>
			typeof batch.id === 'string' &&
			typeof batch.title === 'string' &&
			typeof batch.action === 'string' &&
			typeof batch.output === 'string' &&
			typeof batch.gate === 'string' ) &&
		hasBatch( report.currentEvidence.surfaceAttributionFollowupSpec, 'proof-6' ) &&
		hasBatch( report.currentEvidence.surfaceAttributionFollowupSpec, 'proof-7a' ) &&
		hasBatch( report.currentEvidence.surfaceAttributionFollowupSpec, 'proof-7b' ) &&
		hasBatch( report.currentEvidence.surfaceAttributionFollowupSpec, 'proof-7c' ) &&
		hasBatch( report.currentEvidence.surfaceAttributionFollowupSpec, 'proof-7d' ) &&
		report.currentEvidence.surfaceAttributionFollowupSpec.stopConditions.some( condition => /Chebyshev/.test( condition ) ) &&
		report.currentEvidence.surfaceSampleCoefficientAttributionStudy.receivers.every( receiver =>
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
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy !== undefined &&
		[
			'NOT-SELECTED-PROOF-7C-SURFACE-STATIC-BLOCKER-ORACLE',
			'SUPPORTED-PROOF-7C-NO-SURFACE-LEAK-SAMPLES',
			'OPEN-PROOF-7C-SURFACE-STATIC-BLOCKER-MISSING-PATH-AUDIT',
			'SUPPORTED-PROOF-7C-CPU-STATIC-BLOCKER-AGGREGATE-WIN',
			'OPEN-PROOF-7C-BLOCKED-SURFACE-PATHS-NO-SAFE-RECEIVER-OVERLAP',
			'OPEN-PROOF-7C-BLOCKED-SURFACE-PATHS-NO-AGGREGATE-WIN',
			'OPEN-PROOF-7C-NO-BLOCKED-DOMINANT-SURFACE-PATHS'
		].includes( report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.status ) &&
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.proofBoundary.includes( 'CPU/report-only proof-7c selected-oracle evaluation' ) &&
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.receiverAggregateOracleStatus ===
			report.currentEvidence.probeBakeContaminationMap.sdfStaticBlockerOracleStudy.status &&
		Array.isArray( report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.rows ) &&
		Number.isFinite( report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.leakSampleCount ) &&
		Number.isFinite( report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.evaluatedDominantPathCount ) &&
		Number.isFinite( report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.missingSurfacePathAuditCount ) &&
		Number.isFinite( report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.blockedDominantPathCount ) &&
		Number.isFinite( report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.unblockedDominantPathCount ) &&
		Number.isFinite( report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.proof7cEligibleLeakSampleCount ) &&
		Number.isFinite( report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.overlappingSafeReceiverCount ) &&
		Array.isArray( report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.overlappingSafeReceivers ) &&
		sameStringList( reportedProof7cOverlapReceivers, expectedProof7cOverlapReceivers ) &&
		typeof report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.selected === 'boolean' &&
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.selected ===
			( report.currentEvidence.surfaceAttributionBranchDecision.selectedBranch === 'proof-7c' ) &&
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.proof7cEligibleLeakSampleCount ===
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.correctSideDominantLeakSampleCount &&
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.evaluatedDominantPathCount ===
			report.currentEvidence.surfaceSampleCoefficientAttributionStudy.summary.correctSideDominantLeakSampleCount &&
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.evaluatedDominantPathCount ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.rows.length &&
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.evaluatedDominantPathCount ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.blockedDominantPathCount +
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.unblockedDominantPathCount +
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.missingSurfacePathAuditCount &&
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
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.blockedDominantPathCount ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.rows.filter( row =>
				row.staticBlocked === true
			).length &&
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.unblockedDominantPathCount ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.rows.filter( row =>
				row.staticBlocked === false
			).length &&
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.missingSurfacePathAuditCount ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.rows.filter( row =>
				row.hasSurfacePathAudit === false
			).length &&
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.overlappingSafeReceiverCount ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.overlappingSafeReceivers.length &&
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleStatus ===
			report.currentEvidence.probeBakeContaminationMap.sdfStaticBlockerOracleStudy.status &&
		report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.rows.every( row =>
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
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.status === 'NOT-SELECTED-PROOF-7C-SURFACE-STATIC-BLOCKER-ORACLE' &&
				report.currentEvidence.surfaceAttributionBranchDecision.selectedBranch !== 'proof-7c' &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.selected === false
			) ||
			(
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.status !== 'NOT-SELECTED-PROOF-7C-SURFACE-STATIC-BLOCKER-ORACLE' &&
				report.currentEvidence.surfaceAttributionBranchDecision.selectedBranch === 'proof-7c' &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.selected === true
			)
		) &&
		(
			(
				report.currentEvidence.surfaceAttributionBranchDecision.selectedBranch !== 'proof-7c' &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.status === 'NOT-SELECTED-PROOF-7C-SURFACE-STATIC-BLOCKER-ORACLE'
			) ||
			(
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.status === 'SUPPORTED-PROOF-7C-NO-SURFACE-LEAK-SAMPLES' &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.leakSampleCount === 0
			) ||
			(
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.status === 'OPEN-PROOF-7C-SURFACE-STATIC-BLOCKER-MISSING-PATH-AUDIT' &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.missingSurfacePathAuditCount > 0
			) ||
			(
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.status === 'SUPPORTED-PROOF-7C-CPU-STATIC-BLOCKER-AGGREGATE-WIN' &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.blockedDominantPathCount > 0 &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.overlappingSafeReceiverCount > 0 &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleStatus === 'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN'
			) ||
			(
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.status === 'OPEN-PROOF-7C-BLOCKED-SURFACE-PATHS-NO-AGGREGATE-WIN' &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.blockedDominantPathCount > 0 &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleStatus !== 'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN'
			) ||
			(
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.status === 'OPEN-PROOF-7C-BLOCKED-SURFACE-PATHS-NO-SAFE-RECEIVER-OVERLAP' &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.blockedDominantPathCount > 0 &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.overlappingSafeReceiverCount === 0 &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleStatus === 'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN'
			) ||
			(
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.status === 'OPEN-PROOF-7C-NO-BLOCKED-DOMINANT-SURFACE-PATHS' &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.blockedDominantPathCount === 0 &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.missingSurfacePathAuditCount === 0
			)
		) &&
		report.currentEvidence.proof7cDispositionStudy !== undefined &&
		[
			'NOT-SELECTED-PROOF-7C-DISPOSITION',
			'SUPPORTED-PROOF-7C-DISPOSITION-REVIEW-RUNTIME-PROMOTION',
			'CLOSED-PROOF-7C-DISPOSITION-NO-RUNTIME-PROMOTION',
			'OPEN-PROOF-7C-DISPOSITION-MISSING-EVIDENCE'
		].includes( report.currentEvidence.proof7cDispositionStudy.status ) &&
		report.currentEvidence.proof7cDispositionStudy.status === expectedProof7cDispositionStatus &&
		report.currentEvidence.proof7cDispositionStudy.proofBoundary.includes( 'Report-only proof-7c disposition' ) &&
		report.currentEvidence.proof7cDispositionStudy.sourceStatus ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.status &&
		report.currentEvidence.proof7cDispositionStudy.addressed ===
			(
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.selected === true &&
				report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.missingSurfacePathAuditCount === 0
			) &&
		report.currentEvidence.proof7cDispositionStudy.runtimePromotionAllowed ===
			( report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.status === 'SUPPORTED-PROOF-7C-CPU-STATIC-BLOCKER-AGGREGATE-WIN' ) &&
		(
			report.currentEvidence.proof7cDispositionStudy.runtimePromotionAllowed === true ||
			report.currentEvidence.proof7cDispositionStudy.nextProofOnlyAction ===
				report.currentEvidence.surfaceContentAttributionFollowupStudy.summary.nextProofOnlyAction
		) &&
		report.currentEvidence.proof7cDispositionStudy.summary.selected ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.selected &&
		report.currentEvidence.proof7cDispositionStudy.summary.blockedDominantPathCount ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.blockedDominantPathCount &&
		report.currentEvidence.proof7cDispositionStudy.summary.evaluatedDominantPathCount ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.evaluatedDominantPathCount &&
		report.currentEvidence.proof7cDispositionStudy.summary.missingSurfacePathAuditCount ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.missingSurfacePathAuditCount &&
		report.currentEvidence.proof7cDispositionStudy.summary.receiverAggregateOracleStatus ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleStatus &&
		report.currentEvidence.proof7cDispositionStudy.summary.receiverAggregateOracleSafeWinCount ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleSafeWinCount &&
		report.currentEvidence.proof7cDispositionStudy.summary.overlappingSafeReceiverCount ===
			report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy.summary.overlappingSafeReceiverCount &&
		typeof report.currentEvidence.proof7cDispositionStudy.summary.reason === 'string' &&
		report.currentEvidence.sealedReceiverNormalDiagnostic !== undefined &&
		report.currentEvidence.sealedReceiverSurfaceQuadratureDiagnostic !== undefined &&
		report.currentEvidence.sealedReceiverGpuDebugDiagnostic !== undefined &&
		typeof report.currentEvidence.sealedFailureDomain === 'string' &&
		[ 'OPEN-CPU-RENDER-METRIC-MISMATCH', 'BOUNDED' ].includes( report.currentEvidence.sealedRenderMetricMismatch.status ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( report.currentEvidence.sealedRenderMetricMismatch.cpuRenderAgreementGate ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( report.currentEvidence.sealedRenderMetricMismatch.surfaceQuadratureCpuRenderAgreementGate ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.cpuSurfaceRuntimeWrongRatioMax ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.delta ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.centerDelta ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.surfaceDelta ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.maskedWrongSideColorRatio ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.maskedCorrectBounceRatio ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.surfaceQuadratureDelta ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.surfaceQuadratureDeltaMean ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.surfaceQuadratureDeltaMax ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.maskedQuadratureDeltaMean ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.maskedQuadratureDeltaMax ) &&
		report.currentEvidence.sealedRenderMetricMismatch.maskedReceiverRegionMetricMode === 'receiver-id-mask-visible-pixels' &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.surfaceQuadratureCpuRenderAgreementAggregation === 'string' &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestSurfaceCpuDelta ) &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestSurfaceCpuAggregation === 'string' &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestScale ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestTightPointScale ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestTightPointSurfaceWrongRatio ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestTightPointSurfaceWrongRatioMax ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestTightPointSurfaceCpuDelta ) &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestTightPointCpuAggregation === 'string' &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestTightPointVariant === 'string' &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestWeightTermVariant === 'string' &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestWeightTerm === 'string' &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestWeightTermCpuKey === 'string' &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestWeightTermScale ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestWeightTermDeltaMean ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestWeightTermDeltaMax ) &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceTermVariant === 'string' &&
		[ 'scalarIrradiance', 'visibilityIrradiance', 'finalIrradiance' ].includes( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceTerm ) &&
		[ 'scalar', 'visibility', 'final' ].includes( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceCpuKey ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceTermScale ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceDeltaMean ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceDeltaMax ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceClippedSampleCount ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugLinearIrradianceAgreementTolerance ) &&
		[ 'OPEN', 'SUPPORTED' ].includes( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugLinearIrradianceAgreementGate ) &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.gpuDebugLinearIrradianceAgreementMode === 'string' &&
		[ 'OPEN', 'SUPPORTED' ].includes( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugWeightTermAgreementGate ) &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.gpuDebugWeightTermAgreementMode === 'string' &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.gpuDebugAgreementMode === 'string' &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugComparableVariantCount ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugLinearIrradianceTermVariantCount ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugWeightTermVariantCount ) &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.gpuDebugWhiteCalibrationLuminanceMean ) &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.gpuDebugWhiteCalibrationVisible === 'boolean' &&
		Number.isFinite( report.currentEvidence.sealedRenderMetricMismatch.invertedNormalCenterDelta ) &&
		typeof report.currentEvidence.sealedRenderMetricMismatch.normalConventionCleared === 'boolean' &&
		report.currentEvidence.sealedRenderMetricMismatch.finalVisibleProbeOnlySceneLinearCpuAgreement !== undefined &&
		[ 'OPEN', 'SUPPORTED' ].includes( report.currentEvidence.sealedRenderMetricMismatch.finalVisibleProbeOnlySceneLinearCpuAgreement.status ) &&
		report.currentEvidence.sealedRenderMetricMismatch.finalVisibleProbeOnlySceneLinearCpuAgreement.mode === 'probe-indirect-only-scene-linear-vs-cpu-surface-sh',
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
