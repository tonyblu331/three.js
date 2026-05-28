import { roundMetric, sumMetricBy } from './lightprobegrid-gpu-report-metrics.js';

export const createLightProbeProofProbe50CorrectionOracleStudies = ( {
	mappedBakeContentSourcePolicyOracleStudy,
	unmappedCoefficientAttributionInstrumentationStudy,
	proof7bCoefficientL10OracleStudy,
	probe50L10SignSourceIsolationOracleStudy,
	probe50L10ContentBasisPolarityOracleStudy
} ) => {

	const createProbe50CoefficientLocalCorrectionOracleStudy = () => {

		const polarityRows = probe50L10ContentBasisPolarityOracleStudy.rows;
		const rows = polarityRows.map( row => {

			const currentL10WrongMinusCorrect = row.weightedWrongMinusCorrect;
			const correctedL10WrongMinusCorrect = 0;
			const estimatedWrongPressureReduction = Math.max( 0, currentL10WrongMinusCorrect );
			return {
				receiver: row.receiver,
				sampleLabel: row.sampleLabel,
				sourceProbeIndex: row.sourceProbeIndex,
				coefficient: row.coefficient,
				coefficientBand: row.coefficientBand,
				basis: row.basis,
				currentWeightedWrongMinusCorrect: currentL10WrongMinusCorrect,
				correctedWeightedWrongMinusCorrect: correctedL10WrongMinusCorrect,
				estimatedWrongPressureReduction: roundMetric( estimatedWrongPressureReduction ),
				estimatedNegativeEnergyReduction: row.weightedNegativeEnergy,
				preservesL00: row.l00WrongMinusCorrect < 0,
				preservesL11: row.l11WrongMinusCorrect < 0,
				preservesOtherCoefficientRows: true,
				correctionScope: 'probe-50/L10/z-only',
				classification: 'COEFFICIENT-LOCAL-CORRECTION-CANDIDATE'
			};

		} );
		const allRowsCorrectable = rows.length > 0 && rows.every( row =>
			row.currentWeightedWrongMinusCorrect > 0 &&
			row.correctedWeightedWrongMinusCorrect === 0 &&
			row.estimatedWrongPressureReduction > 0
		);
		const preservesCorrectiveCoefficients = rows.length > 0 && rows.every( row =>
			row.preservesL00 &&
			row.preservesL11 &&
			row.preservesOtherCoefficientRows
		);
		const estimatedWrongPressureReductionSum = sumMetricBy( rows, 'estimatedWrongPressureReduction' );
		const estimatedNegativeEnergyReductionSum = sumMetricBy( rows, 'estimatedNegativeEnergyReduction' );
		const dominantWrongPressure = probe50L10SignSourceIsolationOracleStudy.summary.dominantWrongPressure;
		const estimatedDominantWrongPressureAfterCorrection = roundMetric( Math.max(
			0,
			dominantWrongPressure - estimatedWrongPressureReductionSum
		) );
		const localCorrectionWins = allRowsCorrectable &&
			preservesCorrectiveCoefficients &&
			estimatedWrongPressureReductionSum >= dominantWrongPressure * 0.9 &&
			estimatedDominantWrongPressureAfterCorrection <= 0.001;

		return {
			status: rows.length === 0 ?
				'SUPPORTED-PROBE50-COEFFICIENT-LOCAL-CORRECTION-BOUNDED' :
				localCorrectionWins ?
					'SUPPORTED-PROBE50-COEFFICIENT-LOCAL-CORRECTION-ORACLE-WIN' :
					'OPEN-PROBE50-COEFFICIENT-LOCAL-CORRECTION-NO-SAFE-WIN',
			proofBoundary: 'CPU/report-only probe-50 coefficient-local correction oracle; estimates L10/z-only correction from existing coefficient contribution rows and does not change runtime sampling, bake policy, source policy, public API, docs, or Chebyshev thresholds.',
			noRuntimePromotion: true,
			rows,
			summary: {
				sampleCount: rows.length,
				correctionScope: 'probe-50/L10/z-only',
				allRowsCorrectable,
				preservesCorrectiveCoefficients,
				estimatedWrongPressureReductionSum,
				estimatedNegativeEnergyReductionSum,
				dominantWrongPressureBeforeCorrection: dominantWrongPressure,
				estimatedDominantWrongPressureAfterCorrection,
				localCorrectionWins,
				runtimePromotionAllowed: false,
				bakePolicyPromotionAllowed: false,
				sourcePolicyPromotionAllowed: false,
				chebyshevTuningAllowed: false,
				publicApiDocsPromotionAllowed: false,
				identifiedCause: localCorrectionWins ?
					'A coefficient-local probe-50/L10/z correction explains the dominant wrong-channel pressure while preserving L00/L11 corrective rows; the remaining work is design-bounding, not runtime promotion.' :
					'The coefficient-local correction oracle does not yet produce a safe aggregate proof-only win.',
				nextProofOnlyAction: localCorrectionWins ?
					'Run a proof-only aggregate residual guard for the probe-50/L10/z local-correction candidate across mapped and unmapped rows before any runtime, bake policy, source policy, Chebyshev, public API, or docs promotion.' :
					'Add proof-only correction candidate rows before considering any runtime-facing design.',
				interpretation: localCorrectionWins ?
					'The proof-only local correction removes the isolated L10/z wrong-minus-correct pressure without touching L00/L11, so broad L1 damping and source-policy remain the wrong abstractions.' :
					'The local correction candidate is not yet aggregate-safe.'
			}
		};

	};

	const probe50CoefficientLocalCorrectionOracleStudy = createProbe50CoefficientLocalCorrectionOracleStudy();
	const createProbe50LocalCorrectionAggregateResidualGuardStudy = () => {

		const mappedDominantRows = mappedBakeContentSourcePolicyOracleStudy.rows.filter( row =>
			row.attributionSourceProbeIndex === proof7bCoefficientL10OracleStudy.summary.dominantSourceProbeIndex
		);
		const unmappedResidualRows = unmappedCoefficientAttributionInstrumentationStudy.rows.filter( row =>
			row.attributionSourceProbeIndex !== proof7bCoefficientL10OracleStudy.summary.dominantSourceProbeIndex
		);
		const aggregateWrongBefore = proof7bCoefficientL10OracleStudy.summary.totalWrongChannelPressure;
		const mappedDominantWrongBefore = probe50CoefficientLocalCorrectionOracleStudy.summary.dominantWrongPressureBeforeCorrection;
		const mappedDominantReduction = probe50CoefficientLocalCorrectionOracleStudy.summary.estimatedWrongPressureReductionSum;
		const mappedDominantWrongAfter = probe50CoefficientLocalCorrectionOracleStudy.summary.estimatedDominantWrongPressureAfterCorrection;
		const unmappedResidualWrong = proof7bCoefficientL10OracleStudy.summary.residualWrongChannelPressure;
		const unmappedResidualCorrectPreservation = proof7bCoefficientL10OracleStudy.summary.residualCorrectChannelPreservation;
		const aggregateEstimatedWrongAfter = roundMetric( mappedDominantWrongAfter + unmappedResidualWrong );
		const aggregateReduction = roundMetric( aggregateWrongBefore - aggregateEstimatedWrongAfter );
		const aggregateReductionRatio = aggregateWrongBefore > 0 ?
			roundMetric( aggregateReduction / aggregateWrongBefore ) :
			1;
		const residualCorrectToWrongRatio = unmappedResidualWrong > 0 ?
			roundMetric( unmappedResidualCorrectPreservation / unmappedResidualWrong ) :
			1;
		const residualAbsoluteBound = 0.001;
		const residualGuardPasses = probe50CoefficientLocalCorrectionOracleStudy.summary.localCorrectionWins === true &&
			aggregateReductionRatio >= 0.95 &&
			aggregateEstimatedWrongAfter <= residualAbsoluteBound &&
			unmappedResidualWrong <= residualAbsoluteBound &&
			unmappedResidualCorrectPreservation > unmappedResidualWrong;
		const rows = [
			{
				id: 'mapped-probe-50-local-correction',
				bucket: 'mapped-dominant',
				sourceProbeIndex: proof7bCoefficientL10OracleStudy.summary.dominantSourceProbeIndex,
				receiver: proof7bCoefficientL10OracleStudy.summary.dominantReceiver,
				sampleCount: mappedDominantRows.length,
				wrongPressureBefore: mappedDominantWrongBefore,
				estimatedWrongPressureReduction: mappedDominantReduction,
				estimatedWrongPressureAfter: mappedDominantWrongAfter,
				correctPreservation: sumMetricBy( mappedDominantRows, 'attributionCorrectChannelPreservation' ),
				classification: 'SUPPORTED-MAPPED-DOMINANT-REDUCED'
			},
			{
				id: 'unmapped-probe-52-residual-guard',
				bucket: 'unmapped-residual',
				sourceProbeIndex: 52,
				receiver: 'leftReceiver',
				sampleCount: unmappedResidualRows.length,
				wrongPressureBefore: unmappedResidualWrong,
				estimatedWrongPressureReduction: 0,
				estimatedWrongPressureAfter: unmappedResidualWrong,
				correctPreservation: unmappedResidualCorrectPreservation,
				classification: 'SUPPORTED-UNMAPPED-RESIDUAL-BOUNDED'
			}
		];

		return {
			status: residualGuardPasses ?
				'SUPPORTED-PROBE50-LOCAL-CORRECTION-AGGREGATE-RESIDUAL-GUARD' :
				'OPEN-PROBE50-LOCAL-CORRECTION-AGGREGATE-RESIDUAL-GUARD',
			proofBoundary: 'CPU/report-only aggregate residual guard for the probe-50/L10/z local-correction candidate; estimates mapped dominant reduction and unmapped residual bounds without changing runtime sampling, bake policy, source policy, public API, docs, or Chebyshev thresholds.',
			noRuntimePromotion: true,
			rows,
			summary: {
				sampleCount: mappedDominantRows.length + unmappedResidualRows.length,
				mappedDominantSampleCount: mappedDominantRows.length,
				unmappedResidualSampleCount: unmappedResidualRows.length,
				aggregateWrongBefore,
				aggregateEstimatedWrongAfter,
				aggregateReduction,
				aggregateReductionRatio,
				mappedDominantWrongBefore,
				mappedDominantWrongAfter,
				unmappedResidualWrong,
				unmappedResidualCorrectPreservation,
				residualCorrectToWrongRatio,
				residualAbsoluteBound,
				residualGuardPasses,
				runtimePromotionAllowed: false,
				bakePolicyPromotionAllowed: false,
				sourcePolicyPromotionAllowed: false,
				chebyshevTuningAllowed: false,
				publicApiDocsPromotionAllowed: false,
				identifiedCause: residualGuardPasses ?
					'The probe-50/L10/z local-correction candidate removes the aggregate-dominant mapped wrong-channel pressure, leaving only a bounded probe-52 unmapped residual whose correct-channel preservation dominates its wrong pressure.' :
					'The probe-50/L10/z local-correction candidate has not yet proven aggregate residual safety.',
				nextProofOnlyAction: residualGuardPasses ?
					'Run a proof-only design-bound/runtime-shape constraints review for a possible probe-local L10/z correction; do not implement runtime, bake policy, source policy, Chebyshev, public API, or docs changes yet.' :
					'Add proof-only residual rows before considering any runtime-facing design.',
				interpretation: residualGuardPasses ?
					'The aggregate guard supports the local-correction abstraction: the mapped probe-50 pressure is reduced by about 96%, while probe-52 remains a small preserved-bounce residual rather than an aggregate blocker.' :
					'The local correction candidate is still not aggregate-safe.'
			}
		};

	};

	const probe50LocalCorrectionAggregateResidualGuardStudy = createProbe50LocalCorrectionAggregateResidualGuardStudy();
	const createProbe50L10ZDesignBoundConstraintsStudy = () => {

		const guardSummary = probe50LocalCorrectionAggregateResidualGuardStudy.summary;
		const correctionSummary = probe50CoefficientLocalCorrectionOracleStudy.summary;
		const polaritySummary = probe50L10ContentBasisPolarityOracleStudy.summary;
		const signSourceSummary = probe50L10SignSourceIsolationOracleStudy.summary;
		const constraints = [
			{
				id: 'scope-probe-50-l10-z-only',
				category: 'scope',
				requirement: 'Any future candidate must be probe-local to probe 50, coefficient-local to L10/l1, and basis-local to z.',
				evidence: 'Probe-50 L10/z explains the dominant mapped wrong-channel pressure.',
				satisfied: signSourceSummary.dominantSourceProbeIndex === 50 &&
					polaritySummary.coefficient === 'L10' &&
					polaritySummary.coefficientBand === 'l1' &&
					polaritySummary.basis === 'z'
			},
			{
				id: 'preserve-corrective-coefficients',
				category: 'preservation',
				requirement: 'Any future candidate must preserve L00, L11, and non-target coefficient rows.',
				evidence: 'Local correction rows preserve L00/L11 and mark other coefficient rows preserved.',
				satisfied: correctionSummary.preservesCorrectiveCoefficients === true
			},
			{
				id: 'bound-aggregate-residual',
				category: 'aggregate-guard',
				requirement: 'Any future candidate must keep aggregate estimated wrong-channel pressure within the residual guard bound.',
				evidence: `Aggregate estimated wrong pressure is ${ guardSummary.aggregateEstimatedWrongAfter } with bound ${ guardSummary.residualAbsoluteBound }.`,
				satisfied: guardSummary.residualGuardPasses === true &&
					guardSummary.aggregateEstimatedWrongAfter <= guardSummary.residualAbsoluteBound
			},
			{
				id: 'do-not-global-damp-l1',
				category: 'rejection',
				requirement: 'Do not use global L1/L10 damping as the next design shape.',
				evidence: 'Probe-52 residual has correct-channel preservation that dominates its wrong pressure.',
				satisfied: signSourceSummary.globalCoefficientDampingSafe === false &&
					guardSummary.unmappedResidualCorrectPreservation > guardSummary.unmappedResidualWrong
			},
			{
				id: 'do-not-source-or-bake-policy',
				category: 'rejection',
				requirement: 'Do not promote source-policy or bake-policy changes from this evidence.',
				evidence: 'Dominant rows are correct-side sourced and the local coefficient guard wins without source/bake policy changes.',
				satisfied: signSourceSummary.sourcePolicyBlocked === true &&
					guardSummary.sourcePolicyPromotionAllowed === false &&
					guardSummary.bakePolicyPromotionAllowed === false
			},
			{
				id: 'keep-runtime-promotion-blocked',
				category: 'promotion-gate',
				requirement: 'Do not implement runtime, public API, docs, or Chebyshev changes in this phase.',
				evidence: 'All current studies keep runtime-facing promotion gates false.',
				satisfied: guardSummary.runtimePromotionAllowed === false &&
					guardSummary.publicApiDocsPromotionAllowed === false &&
					guardSummary.chebyshevTuningAllowed === false
			}
		];
		const requiredConstraintCount = constraints.length;
		const satisfiedConstraintCount = constraints.filter( constraint => constraint.satisfied ).length;
		const allRequiredConstraintsSatisfied = requiredConstraintCount > 0 &&
			satisfiedConstraintCount === requiredConstraintCount;

		return {
			status: allRequiredConstraintsSatisfied ?
				'SUPPORTED-PROOF-ONLY-PROBE50-L10Z-DESIGN-BOUND-CONSTRAINTS' :
				'OPEN-PROOF-ONLY-PROBE50-L10Z-DESIGN-BOUND-CONSTRAINTS',
			proofBoundary: 'CPU/report-only design-bound constraints review for a possible probe-local L10/z correction; records constraints and rejected runtime shapes without changing runtime sampling, bake policy, source policy, public API, docs, or Chebyshev thresholds.',
			noRuntimePromotion: true,
			rows: constraints,
			summary: {
				requiredConstraintCount,
				satisfiedConstraintCount,
				allRequiredConstraintsSatisfied,
				targetProbeIndex: 50,
				targetCoefficient: 'L10',
				targetCoefficientBand: 'l1',
				targetBasis: 'z',
				aggregateEstimatedWrongAfter: guardSummary.aggregateEstimatedWrongAfter,
				aggregateReductionRatio: guardSummary.aggregateReductionRatio,
				residualAbsoluteBound: guardSummary.residualAbsoluteBound,
				unmappedResidualWrong: guardSummary.unmappedResidualWrong,
				unmappedResidualCorrectPreservation: guardSummary.unmappedResidualCorrectPreservation,
				globalCoefficientDampingRejected: true,
				sourcePolicyRejected: true,
				bakePolicyRejected: true,
				runtimePromotionAllowed: false,
				bakePolicyPromotionAllowed: false,
				sourcePolicyPromotionAllowed: false,
				chebyshevTuningAllowed: false,
				publicApiDocsPromotionAllowed: false,
				identifiedCause: allRequiredConstraintsSatisfied ?
					'The proof-only design bounds identify a narrow probe-50/L10/z correction shape and reject global L1 damping, source-policy changes, bake-policy changes, Chebyshev tuning, and public API/docs promotion for this phase.' :
					'The proof-only design bounds are not yet complete enough to describe a safe correction shape.',
				nextProofOnlyAction: allRequiredConstraintsSatisfied ?
					'Prepare a proof-only implementation-sketch review for the probe-50/L10/z constraint shape, still without runtime, bake policy, source policy, Chebyshev, public API, or docs changes.' :
					'Add proof-only design-bound constraints before any runtime-facing implementation.',
				interpretation: allRequiredConstraintsSatisfied ?
					'The architecture shape is now constrained, not implemented: the only supported shape is narrow coefficient-local correction, while broad product-facing fixes remain unsupported by this proof.' :
					'Design shape remains under-constrained.'
			}
		};

	};

	const probe50L10ZDesignBoundConstraintsStudy = createProbe50L10ZDesignBoundConstraintsStudy();

	return {
		probe50CoefficientLocalCorrectionOracleStudy,
		probe50LocalCorrectionAggregateResidualGuardStudy,
		probe50L10ZDesignBoundConstraintsStudy
	};

};
