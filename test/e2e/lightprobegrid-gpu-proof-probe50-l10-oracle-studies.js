import {
	histogramBy,
	maxMetricBy,
	minMetricBy,
	sumMetricBy,
	sumMetricValues
} from './lightprobegrid-gpu-report-metrics.js';

export const createLightProbeProofProbe50L10OracleStudies = ( {
	mappedBakeContentSourcePolicyOracleStudy,
	unmappedCoefficientAttributionInstrumentationStudy,
	proof7bCoefficientL10OracleStudy,
	surfaceSampleCoefficientAttributionStudy
} ) => {

	const createProbe50L10SignSourceIsolationOracleStudy = () => {

		const allRows = [
			...mappedBakeContentSourcePolicyOracleStudy.rows,
			...unmappedCoefficientAttributionInstrumentationStudy.rows
		];
		const dominantSourceProbeIndex = proof7bCoefficientL10OracleStudy.summary.dominantSourceProbeIndex;
		const dominantRows = allRows.filter( row =>
			row.attributionSourceProbeIndex === dominantSourceProbeIndex &&
			row.attributionDominantCoefficient === 'L10' &&
			row.attributionDominantCoefficientBand === 'l1'
		);
		const residualRows = allRows.filter( row =>
			row.attributionSourceProbeIndex !== dominantSourceProbeIndex &&
			row.attributionDominantCoefficient === 'L10' &&
			row.attributionDominantCoefficientBand === 'l1'
		);
		const allDominantRowsPositiveL10 = dominantRows.length > 0 && dominantRows.every( row =>
			row.attributionDominantCoefficientWrongMinusCorrect > 0
		);
		const allDominantRowsCorrectSideSource = dominantRows.length > 0 && dominantRows.every( row =>
			row.attributionSourceRelationToReceiver === 'correct-side'
		);
		const allDominantRowsMappedContentPressure = dominantRows.length > 0 && dominantRows.every( row =>
			row.mappedToContentPressure === true &&
			row.contentPressureAttributionRowCount > 0
		);
		const wrongSideSourcePressureRows = dominantRows.filter( row =>
			( row.sourcePressureAttributionRowCount ?? 0 ) > 0 ||
			( row.sourcePressureWrongChannelPressure ?? 0 ) > 0 ||
			( row.sourcePressureDilatedSourceWrongPressureDelta ?? 0 ) > 0
		);
		const dominantWrongPressure = sumMetricBy( dominantRows, 'attributionWrongChannelPressure' );
		const residualWrongPressure = sumMetricBy( residualRows, 'attributionWrongChannelPressure' );
		const dominantContentPressure = sumMetricBy( dominantRows, 'contentDominantPressure' );
		const dominantCoefficientDelta = sumMetricBy( dominantRows, 'attributionDominantCoefficientWrongMinusCorrect' );
		const residualCorrectPreservation = sumMetricBy( residualRows, 'attributionCorrectChannelPreservation' );
		const pressureLocalized = proof7bCoefficientL10OracleStudy.summary.dominantWrongPressureShare >= 0.9;
		const sourcePolicyBlocked = allDominantRowsCorrectSideSource && wrongSideSourcePressureRows.length === 0;
		const signSourceIsolated = pressureLocalized &&
			allDominantRowsPositiveL10 &&
			allDominantRowsMappedContentPressure &&
			sourcePolicyBlocked;

		return {
			status: dominantRows.length === 0 ?
				'SUPPORTED-PROBE50-L10-SIGN-SOURCE-BOUNDED' :
				signSourceIsolated ?
					'IDENTIFIED-PROBE50-L10-POSITIVE-SOURCE-LOCALIZED' :
					'OPEN-PROBE50-L10-SIGN-SOURCE-AMBIGUOUS',
			proofBoundary: 'CPU/report-only probe-50 L10 sign/source-isolation oracle; classifies dominant coefficient polarity and source locality only and does not change runtime sampling, bake policy, source policy, public API, docs, or Chebyshev thresholds.',
			noRuntimePromotion: true,
			rows: dominantRows.map( row => ( {
				receiver: row.receiver,
				sampleLabel: row.sampleLabel,
				sourceProbeIndex: row.attributionSourceProbeIndex,
				sourceRelationToReceiver: row.attributionSourceRelationToReceiver,
				mappedToContentPressure: row.mappedToContentPressure,
				contentPressureAttributionRowCount: row.contentPressureAttributionRowCount,
				contentDominantPressure: row.contentDominantPressure,
				coefficient: row.attributionDominantCoefficient,
				coefficientBand: row.attributionDominantCoefficientBand,
				coefficientWrongMinusCorrect: row.attributionDominantCoefficientWrongMinusCorrect,
				coefficientDeltaSign: row.attributionDominantCoefficientWrongMinusCorrect > 0 ?
					'positive-wrong-minus-correct' :
					row.attributionDominantCoefficientWrongMinusCorrect < 0 ?
						'negative-wrong-minus-correct' :
						'zero',
				wrongChannelPressure: row.attributionWrongChannelPressure,
				correctChannelPreservation: row.attributionCorrectChannelPreservation,
				runtimeWrongOverCorrect: row.runtimeWrongOverCorrect,
				sourcePressureAttributionRowCount: row.sourcePressureAttributionRowCount ?? 0,
				sourcePressureWrongChannelPressure: row.sourcePressureWrongChannelPressure ?? 0,
				sourcePressureDilatedSourceWrongPressureDelta: row.sourcePressureDilatedSourceWrongPressureDelta ?? 0,
				classification: signSourceIsolated ?
					'POSITIVE-L10-CORRECT-SIDE-SOURCE-LOCALIZED-LEAK' :
					'PROBE50-L10-SIGN-SOURCE-NEEDS-MORE-PROOF'
			} ) ),
			summary: {
				sampleCount: dominantRows.length,
				residualSampleCount: residualRows.length,
				dominantSourceProbeIndex,
				dominantReceiver: proof7bCoefficientL10OracleStudy.summary.dominantReceiver,
				coefficient: 'L10',
				coefficientBand: 'l1',
				allDominantRowsPositiveL10,
				allDominantRowsCorrectSideSource,
				allDominantRowsMappedContentPressure,
				wrongSideSourcePressureRowCount: wrongSideSourcePressureRows.length,
				sourcePolicyBlocked,
				pressureLocalized,
				dominantWrongPressure,
				residualWrongPressure,
				dominantWrongPressureShare: proof7bCoefficientL10OracleStudy.summary.dominantWrongPressureShare,
				dominantContentPressure,
				dominantCoefficientDelta,
				minCoefficientWrongMinusCorrect: minMetricBy( dominantRows, 'attributionDominantCoefficientWrongMinusCorrect' ),
				maxCoefficientWrongMinusCorrect: maxMetricBy( dominantRows, 'attributionDominantCoefficientWrongMinusCorrect' ),
				residualCorrectPreservation,
				sourceRelationHistogram: histogramBy( dominantRows, 'attributionSourceRelationToReceiver' ),
				contentProbeHistogram: histogramBy( dominantRows, 'contentProbeIndex' ),
				runtimePromotionAllowed: false,
				globalCoefficientDampingSafe: false,
				identifiedCause: signSourceIsolated ?
					'Probe-50 L10/l1 leak is positive wrong-minus-correct, mapped to bake-content pressure, and localized to a correct-side source trace; this identifies a probe-local coefficient/content polarity problem, not a wrong-side source-policy or global L10 damping fix.' :
					'Probe-50 L10/l1 remains dominant, but sign/source isolation is not yet complete.',
				nextProofOnlyAction: signSourceIsolated ?
					'Run a proof-only probe-50 L10 content-basis/polarity oracle before proof-7a source-policy, Chebyshev, runtime, public API, docs, or bake-policy changes.' :
					'Add proof-only sign/source rows for probe-50 L10 before choosing any runtime-facing design.',
				interpretation: signSourceIsolated ?
					'The dominant leak is localized to positive L10/l1 content from probe-50 on rightReceiver; source-policy is blocked because the source trace is correct-side and wrong-side source pressure is absent.' :
					'The oracle cannot yet separate coefficient polarity from source-policy pressure.'
			}
		};

	};

	const probe50L10SignSourceIsolationOracleStudy = createProbe50L10SignSourceIsolationOracleStudy();
	const createProbe50L10ContentBasisPolarityOracleStudy = () => {

		const dominantRows = probe50L10SignSourceIsolationOracleStudy.rows;
		const findSample = row => surfaceSampleCoefficientAttributionStudy.receivers
			.flatMap( receiver => receiver.samples )
			.find( sample =>
				sample.receiver === row.receiver &&
				sample.sampleLabel === row.sampleLabel
			);
		const findAttributionRow = row => {

			const sample = findSample( row );
			return sample?.attributionRows.find( attributionRow =>
				attributionRow.sourceProbeIndex === 50 &&
				attributionRow.dominantWeightedCoefficient === 'L10'
			) ?? sample?.attributionRows.find( attributionRow =>
				attributionRow.probeIndex === 50 &&
				attributionRow.dominantWeightedCoefficient === 'L10'
			) ?? null;

		};

		const rows = dominantRows.map( row => {

			const attributionRow = findAttributionRow( row );
			const coefficientRows = attributionRow?.runtimeWeightedCoefficientContributions ?? [];
			const l10 = coefficientRows.find( coefficient => coefficient.name === 'L10' ) ?? null;
			const l00 = coefficientRows.find( coefficient => coefficient.name === 'L00' ) ?? null;
			const l11 = coefficientRows.find( coefficient => coefficient.name === 'L11' ) ?? null;
			const negativeCorrectDominance = l10 !== null &&
				l10.contribution.g < 0 &&
				l10.contribution.r < 0 &&
				l10.contribution.g < l10.contribution.r &&
				l10.wrongMinusCorrect > 0;

			return {
				receiver: row.receiver,
				sampleLabel: row.sampleLabel,
				sourceProbeIndex: row.sourceProbeIndex,
				coefficient: 'L10',
				coefficientBand: 'l1',
				basis: l10?.basis ?? 'unknown',
				basisScale: l10?.basisScale ?? 0,
				rawCoefficient: l10?.rawCoefficient ?? null,
				contribution: l10?.contribution ?? null,
				weightedContribution: l10?.weightedContribution ?? null,
				wrongMinusCorrect: l10?.wrongMinusCorrect ?? 0,
				weightedWrongMinusCorrect: l10?.weightedWrongMinusCorrect ?? 0,
				negativeEnergy: l10?.negativeEnergy ?? 0,
				weightedNegativeEnergy: l10?.weightedNegativeEnergy ?? 0,
				l00WrongMinusCorrect: l00?.wrongMinusCorrect ?? 0,
				l11WrongMinusCorrect: l11?.wrongMinusCorrect ?? 0,
				l10CorrectContribution: l10?.correctContribution ?? 0,
				l10WrongContribution: l10?.wrongContribution ?? 0,
				l10RawCorrect: l10?.rawCoefficient?.g ?? 0,
				l10RawWrong: l10?.rawCoefficient?.r ?? 0,
				negativeCorrectDominance,
				classification: negativeCorrectDominance ?
					'POSITIVE-DELTA-FROM-NEGATIVE-CORRECT-CHANNEL-L10-Z-BASIS' :
					'PROBE50-L10-BASIS-POLARITY-AMBIGUOUS'
			};

		} );
		const allRowsHaveBasis = rows.length > 0 && rows.every( row => row.basis === 'z' );
		const allRowsPositiveBasisScale = rows.length > 0 && rows.every( row => row.basisScale > 0 );
		const allRowsNegativeCorrectDominance = rows.length > 0 && rows.every( row => row.negativeCorrectDominance );
		const l10WrongMinusCorrectSum = sumMetricValues( rows.map( row => row.wrongMinusCorrect ) );
		const l10WeightedWrongMinusCorrectSum = sumMetricValues( rows.map( row => row.weightedWrongMinusCorrect ) );
		const l10NegativeEnergySum = sumMetricValues( rows.map( row => row.negativeEnergy ) );
		const l10WeightedNegativeEnergySum = sumMetricValues( rows.map( row => row.weightedNegativeEnergy ) );
		const l00WrongMinusCorrectSum = sumMetricValues( rows.map( row => row.l00WrongMinusCorrect ) );
		const l11WrongMinusCorrectSum = sumMetricValues( rows.map( row => row.l11WrongMinusCorrect ) );
		const polarityIsolated = allRowsHaveBasis &&
			allRowsPositiveBasisScale &&
			allRowsNegativeCorrectDominance &&
			l10WrongMinusCorrectSum > 0 &&
			l00WrongMinusCorrectSum < 0 &&
			l11WrongMinusCorrectSum < 0;

		return {
			status: rows.length === 0 ?
				'SUPPORTED-PROBE50-L10-CONTENT-BASIS-POLARITY-BOUNDED' :
				polarityIsolated ?
					'IDENTIFIED-PROBE50-L10-Z-BASIS-NEGATIVE-CORRECT-POLARITY' :
					'OPEN-PROBE50-L10-CONTENT-BASIS-POLARITY-AMBIGUOUS',
			proofBoundary: 'CPU/report-only probe-50 L10 content-basis/polarity oracle over existing coefficient contribution rows; does not change runtime sampling, bake policy, source policy, public API, docs, or Chebyshev thresholds.',
			noRuntimePromotion: true,
			rows,
			summary: {
				sampleCount: rows.length,
				coefficient: 'L10',
				coefficientBand: 'l1',
				basis: 'z',
				allRowsHaveBasis,
				allRowsPositiveBasisScale,
				allRowsNegativeCorrectDominance,
				l10WrongMinusCorrectSum,
				l10WeightedWrongMinusCorrectSum,
				l10NegativeEnergySum,
				l10WeightedNegativeEnergySum,
				l00WrongMinusCorrectSum,
				l11WrongMinusCorrectSum,
				polarityIsolated,
				runtimePromotionAllowed: false,
				bakePolicyPromotionAllowed: false,
				sourcePolicyPromotionAllowed: false,
				globalCoefficientDampingSafe: false,
				identifiedCause: polarityIsolated ?
					'Probe-50 L10/l1 is a z-basis polarity leak: the correct green channel is driven more negative than the wrong red channel, making wrong-minus-correct positive while L00 and L11 remain corrective.' :
					'Probe-50 L10/l1 basis polarity is not yet isolated from other coefficient contributions.',
				nextProofOnlyAction: polarityIsolated ?
					'Run a proof-only probe-50 coefficient-local correction oracle that isolates L10/z contribution effects while preserving L00/L11 correct-channel bounce; do not promote runtime, bake policy, source policy, Chebyshev, public API, or docs.' :
					'Add proof-only coefficient contribution rows before choosing any runtime-facing design.',
				interpretation: polarityIsolated ?
					'The leak is now narrowed from source policy to coefficient content polarity: L10/z contributes positive wrong-minus-correct by over-negating the correct channel, so a broad source-policy or global damping fix would be the wrong abstraction.' :
					'Basis/polarity evidence is incomplete.'
			}
		};

	};

	const probe50L10ContentBasisPolarityOracleStudy = createProbe50L10ContentBasisPolarityOracleStudy();

	return {
		probe50L10SignSourceIsolationOracleStudy,
		probe50L10ContentBasisPolarityOracleStudy
	};

};
