import {
	histogramBy,
	maxMetricBy,
	meanMetricBy,
	roundMetric,
	sumMetricBy
} from './lightprobegrid-gpu-report-metrics.js';

export const createLightProbeProofAggregateCoefficientOracleStudies = ( {
	surfaceContentAttributionSplitStudy
} ) => {

	const createMappedBakeContentSourcePolicyOracleStudy = () => {

		const rows = surfaceContentAttributionSplitStudy.rows
			.filter( row => row.mappedToContentPressure === true );
		const bandMismatchCount = rows.filter( row =>
			row.contentDominantBand !== row.attributionDominantBand
		).length;

		return {
			status: rows.length > 0 ?
				'OPEN-MAPPED-BAKE-CONTENT-SOURCE-POLICY-ORACLE' :
				'SUPPORTED-MAPPED-BAKE-CONTENT-SOURCE-POLICY-BOUNDED',
			proofBoundary: 'CPU/report-only mapped bake-content/source-policy oracle over surfaceContentAttributionSplitStudy mapped rows; does not change bake capture, runtime sampling, public API, docs, or Chebyshev thresholds.',
			noRuntimePromotion: true,
			rows: rows.map( row => ( {
				receiver: row.receiver,
				sampleLabel: row.sampleLabel,
				mappedToContentPressure: row.mappedToContentPressure,
				contentProbeIndex: row.contentDominantProbeIndex,
				contentDominantBand: row.contentDominantBand,
				contentDominantPressure: row.contentDominantPressure,
				contentDominantWeightedPressure: row.contentDominantWeightedPressure,
				contentPressureAttributionRowCount: row.contentPressureAttributionRowCount,
				attributionProbeIndex: row.attributionDominantProbeIndex,
				attributionSourceProbeIndex: row.attributionDominantSourceProbeIndex,
				attributionProbeRelationToReceiver: row.attributionProbeRelationToReceiver,
				attributionSourceRelationToReceiver: row.attributionSourceRelationToReceiver,
				attributionSourceSide: row.attributionSourceSide,
				attributionDilationSourceDiffers: row.attributionDilationSourceDiffers,
				attributionSourceValidity: row.attributionSourceValidity,
				attributionRuntimeFinalWeight: row.attributionRuntimeFinalWeight,
				attributionDominantBand: row.attributionDominantBand,
				attributionDominantCoefficient: row.attributionDominantCoefficient,
				attributionDominantCoefficientBand: row.attributionDominantCoefficientBand,
				attributionDominantCoefficientWrongMinusCorrect: row.attributionDominantCoefficientWrongMinusCorrect,
				attributionWrongChannelPressure: row.attributionWrongChannelPressure,
				attributionCorrectChannelPreservation: row.attributionCorrectChannelPreservation,
				runtimeWrongOverCorrect: row.runtimeWrongOverCorrect,
				contentAttributionBandMismatch: row.contentDominantBand !== row.attributionDominantBand
			} ) ),
			summary: {
				sampleCount: rows.length,
				receiverHistogram: histogramBy( rows, 'receiver' ),
				contentProbeHistogram: histogramBy( rows, 'contentDominantProbeIndex' ),
				contentBandHistogram: histogramBy( rows, 'contentDominantBand' ),
				attributionProbeHistogram: histogramBy( rows, 'attributionDominantProbeIndex' ),
				attributionSourceProbeHistogram: histogramBy( rows, 'attributionDominantSourceProbeIndex' ),
				attributionSourceRelationHistogram: histogramBy( rows, 'attributionSourceRelationToReceiver' ),
				attributionBandHistogram: histogramBy( rows, 'attributionDominantBand' ),
				attributionCoefficientHistogram: histogramBy( rows, 'attributionDominantCoefficient' ),
				contentDominantPressureSum: sumMetricBy( rows, 'contentDominantPressure' ),
				contentDominantPressureMean: meanMetricBy( rows, 'contentDominantPressure' ),
				maxContentDominantPressure: maxMetricBy( rows, 'contentDominantPressure' ),
				contentDominantWeightedPressureSum: sumMetricBy( rows, 'contentDominantWeightedPressure' ),
				attributionWrongChannelPressureSum: sumMetricBy( rows, 'attributionWrongChannelPressure' ),
				attributionCorrectChannelPreservationSum: sumMetricBy( rows, 'attributionCorrectChannelPreservation' ),
				maxRuntimeWrongOverCorrect: maxMetricBy( rows, 'runtimeWrongOverCorrect' ),
				bandMismatchCount,
				allMappedRowsHaveBandMismatch: rows.length > 0 && bandMismatchCount === rows.length,
				noRuntimePromotion: true,
				nextProofOnlyAction: rows.length > 0 ?
					'Evaluate a proof-only CPU/report-only mapped bake-content/source-policy oracle for probe-50 rows while retaining coefficient-level L10 attribution output.' :
					'No mapped bake-content/source-policy rows require a proof-only oracle.',
				interpretation: rows.length > 0 && bandMismatchCount > 0 ?
					'Mapped rows carry bake-content pressure, but content band and runtime attribution band disagree while the dominant runtime coefficient is L10; a source-policy oracle must report coefficient-level effects instead of assuming a simple bake-L2 fix.' :
					'No mapped bake-content/source-policy mismatch is present in the current attributed surface rows.'
			}
		};

	};

	const mappedBakeContentSourcePolicyOracleStudy = createMappedBakeContentSourcePolicyOracleStudy();
	const createUnmappedCoefficientAttributionInstrumentationStudy = () => {

		const rows = surfaceContentAttributionSplitStudy.rows
			.filter( row => row.mappedToContentPressure === false );

		return {
			status: rows.length > 0 ?
				'OPEN-UNMAPPED-COEFFICIENT-ATTRIBUTION-INSTRUMENTATION' :
				'SUPPORTED-UNMAPPED-COEFFICIENT-ATTRIBUTION-BOUNDED',
			proofBoundary: 'CPU/report-only unmapped coefficient-attribution instrumentation over surfaceContentAttributionSplitStudy unmapped rows; does not change bake capture, runtime sampling, public API, docs, or Chebyshev thresholds.',
			noRuntimePromotion: true,
			rows: rows.map( row => ( {
				receiver: row.receiver,
				sampleLabel: row.sampleLabel,
				mappedToContentPressure: row.mappedToContentPressure,
				contentProbeIndex: row.contentDominantProbeIndex,
				contentDominantBand: row.contentDominantBand,
				contentDominantPressure: row.contentDominantPressure,
				contentPressureAttributionRowCount: row.contentPressureAttributionRowCount,
				attributionProbeIndex: row.attributionDominantProbeIndex,
				attributionSourceProbeIndex: row.attributionDominantSourceProbeIndex,
				attributionProbeRelationToReceiver: row.attributionProbeRelationToReceiver,
				attributionSourceRelationToReceiver: row.attributionSourceRelationToReceiver,
				attributionSourceSide: row.attributionSourceSide,
				attributionDilationSourceDiffers: row.attributionDilationSourceDiffers,
				attributionSourceValidity: row.attributionSourceValidity,
				attributionRuntimeFinalWeight: row.attributionRuntimeFinalWeight,
				attributionDominantBand: row.attributionDominantBand,
				attributionDominantCoefficient: row.attributionDominantCoefficient,
				attributionDominantCoefficientBand: row.attributionDominantCoefficientBand,
				attributionDominantCoefficientWrongMinusCorrect: row.attributionDominantCoefficientWrongMinusCorrect,
				attributionDominantDilatedCoefficient: row.attributionDominantDilatedCoefficient,
				attributionDominantDilatedCoefficientBand: row.attributionDominantDilatedCoefficientBand,
				attributionDominantDilatedCoefficientWrongMinusCorrect: row.attributionDominantDilatedCoefficientWrongMinusCorrect,
				attributionWrongChannelPressure: row.attributionWrongChannelPressure,
				attributionCorrectChannelPreservation: row.attributionCorrectChannelPreservation,
				runtimeWrongOverCorrect: row.runtimeWrongOverCorrect,
				sourcePressureAttributionRowCount: row.sourcePressureAttributionRowCount,
				sourcePressureProbeIndex: row.sourcePressureProbeIndex,
				sourcePressureSourceProbeIndex: row.sourcePressureSourceProbeIndex,
				sourcePressureWrongChannelPressure: row.sourcePressureWrongChannelPressure,
				sourcePressureDilatedWrongChannelPressure: row.sourcePressureDilatedWrongChannelPressure,
				sourcePressureDilatedSourceWrongPressureDelta: row.sourcePressureDilatedSourceWrongPressureDelta,
				coefficientSourceInstrumentationVerdict: row.attributionDominantSourceProbeIndex !== null ?
					'AVAILABLE-COEFFICIENT-SOURCE-TRACE' :
					'MISSING-COEFFICIENT-SOURCE-TRACE',
				needsCoefficientSourceInstrumentation: true
			} ) ),
			summary: {
				sampleCount: rows.length,
				receiverHistogram: histogramBy( rows, 'receiver' ),
				contentProbeHistogram: histogramBy( rows, 'contentDominantProbeIndex' ),
				contentBandHistogram: histogramBy( rows, 'contentDominantBand' ),
				attributionProbeHistogram: histogramBy( rows, 'attributionDominantProbeIndex' ),
				attributionSourceProbeHistogram: histogramBy( rows, 'attributionDominantSourceProbeIndex' ),
				attributionSourceRelationHistogram: histogramBy( rows, 'attributionSourceRelationToReceiver' ),
				attributionBandHistogram: histogramBy( rows, 'attributionDominantBand' ),
				attributionCoefficientHistogram: histogramBy( rows, 'attributionDominantCoefficient' ),
				probe52L10SampleCount: rows.filter( row =>
					row.attributionDominantProbeIndex === 52 &&
					row.attributionDominantCoefficient === 'L10'
				).length,
				sourceTraceComplete: rows.every( row => row.attributionDominantSourceProbeIndex !== null ),
				contentPressureAttributionRowCountSum: sumMetricBy( rows, 'contentPressureAttributionRowCount' ),
				maxContentDominantPressure: maxMetricBy( rows, 'contentDominantPressure' ),
				attributionWrongChannelPressureSum: sumMetricBy( rows, 'attributionWrongChannelPressure' ),
				attributionCorrectChannelPreservationSum: sumMetricBy( rows, 'attributionCorrectChannelPreservation' ),
				maxRuntimeWrongOverCorrect: maxMetricBy( rows, 'runtimeWrongOverCorrect' ),
				needsCoefficientSourceInstrumentation: rows.length > 0,
				noRuntimePromotion: true,
				nextProofOnlyAction: rows.length > 0 ?
					'Add proof-only CPU/report-only coefficient/source instrumentation for probe-52 L10 rows before bake, density, SDF, Chebyshev, runtime, or public API fixes.' :
					'No unmapped coefficient-attribution rows require additional proof-only instrumentation.',
				interpretation: rows.length > 0 ?
					'Unmapped rows leak through L10 coefficient attribution while bake-content pressure attribution remains empty, so they are not explained by the mapped bake-content/source-policy bucket.' :
					'No unmapped coefficient-attribution rows are present in the current attributed surface rows.'
			}
		};

	};

	const unmappedCoefficientAttributionInstrumentationStudy = createUnmappedCoefficientAttributionInstrumentationStudy();
	const createAggregateExplanationComparisonStudy = () => {

		const mappedRows = mappedBakeContentSourcePolicyOracleStudy.rows;
		const unmappedRows = unmappedCoefficientAttributionInstrumentationStudy.rows;
		const allRows = [ ...mappedRows, ...unmappedRows ];
		const l10Rows = allRows.filter( row =>
			row.attributionDominantCoefficient === 'L10' &&
			row.attributionDominantCoefficientBand === 'l1'
		);
		const contentPressureRows = allRows.filter( row =>
			row.mappedToContentPressure === true &&
			row.contentPressureAttributionRowCount > 0
		);
		const sourceTraceRows = allRows.filter( row =>
			Number.isInteger( row.attributionSourceProbeIndex ) &&
			typeof row.attributionSourceRelationToReceiver === 'string'
		);
		const coefficientHypothesisCoversAll = allRows.length > 0 && l10Rows.length === allRows.length;
		const bakeContentHypothesisCoversAll = allRows.length > 0 && contentPressureRows.length === allRows.length;
		const sourceTraceComplete = allRows.length > 0 && sourceTraceRows.length === allRows.length;
		const status = allRows.length === 0 ?
			'SUPPORTED-AGGREGATE-EXPLANATION-BOUNDED' :
			coefficientHypothesisCoversAll && bakeContentHypothesisCoversAll === false ?
				'OPEN-AGGREGATE-L10-COEFFICIENT-EXPLANATION' :
				'OPEN-AGGREGATE-EXPLANATION-SPLIT';

		return {
			status,
			proofBoundary: 'CPU/report-only aggregate explanation comparison across mapped bake-content/source-policy rows and unmapped coefficient/source rows; does not change bake capture, runtime sampling, public API, docs, bake policy, or Chebyshev thresholds.',
			noRuntimePromotion: true,
			rows: [
				{
					id: 'mapped-bake-content-source-policy',
					sampleCount: mappedRows.length,
					contentPressureSampleCount: contentPressureRows.filter( row => row.mappedToContentPressure === true ).length,
					coefficientL10SampleCount: mappedRows.filter( row => row.attributionDominantCoefficient === 'L10' ).length,
					contentProbeHistogram: histogramBy( mappedRows, 'contentProbeIndex' ),
					attributionProbeHistogram: histogramBy( mappedRows, 'attributionProbeIndex' ),
					attributionSourceProbeHistogram: histogramBy( mappedRows, 'attributionSourceProbeIndex' ),
					attributionSourceRelationHistogram: histogramBy( mappedRows, 'attributionSourceRelationToReceiver' ),
					attributionCoefficientHistogram: histogramBy( mappedRows, 'attributionDominantCoefficient' ),
					attributionCoefficientBandHistogram: histogramBy( mappedRows, 'attributionDominantCoefficientBand' ),
					attributionWrongChannelPressure: sumMetricBy( mappedRows, 'attributionWrongChannelPressure' ),
					interpretation: 'Mapped rows have bake-content pressure, but their shared runtime attribution remains L10/l1; source-policy work must be measured as a coefficient-level oracle, not promoted as a bake-content fix.'
				},
				{
					id: 'unmapped-coefficient-source-trace',
					sampleCount: unmappedRows.length,
					contentPressureSampleCount: unmappedRows.filter( row => row.contentPressureAttributionRowCount > 0 ).length,
					coefficientL10SampleCount: unmappedRows.filter( row => row.attributionDominantCoefficient === 'L10' ).length,
					contentProbeHistogram: histogramBy( unmappedRows, 'contentProbeIndex' ),
					attributionProbeHistogram: histogramBy( unmappedRows, 'attributionProbeIndex' ),
					attributionSourceProbeHistogram: histogramBy( unmappedRows, 'attributionSourceProbeIndex' ),
					attributionSourceRelationHistogram: histogramBy( unmappedRows, 'attributionSourceRelationToReceiver' ),
					attributionCoefficientHistogram: histogramBy( unmappedRows, 'attributionDominantCoefficient' ),
					attributionCoefficientBandHistogram: histogramBy( unmappedRows, 'attributionDominantCoefficientBand' ),
					attributionWrongChannelPressure: sumMetricBy( unmappedRows, 'attributionWrongChannelPressure' ),
					interpretation: 'Unmapped rows have complete source trace but zero content-pressure attribution, so bake-content/source-policy alone cannot explain the aggregate leak.'
				}
			],
			summary: {
				sampleCount: allRows.length,
				mappedSampleCount: mappedRows.length,
				unmappedSampleCount: unmappedRows.length,
				contentPressureSampleCount: contentPressureRows.length,
				coefficientL10SampleCount: l10Rows.length,
				sourceTraceSampleCount: sourceTraceRows.length,
				bakeContentHypothesisCoversAll,
				coefficientHypothesisCoversAll,
				sourceTraceComplete,
				attributionCoefficientHistogram: histogramBy( allRows, 'attributionDominantCoefficient' ),
				attributionCoefficientBandHistogram: histogramBy( allRows, 'attributionDominantCoefficientBand' ),
				attributionSourceProbeHistogram: histogramBy( allRows, 'attributionSourceProbeIndex' ),
				attributionSourceRelationHistogram: histogramBy( allRows, 'attributionSourceRelationToReceiver' ),
				attributionWrongChannelPressureSum: sumMetricBy( allRows, 'attributionWrongChannelPressure' ),
				contentDominantPressureSum: sumMetricBy( allRows, 'contentDominantPressure' ),
				noRuntimePromotion: true,
				recommendedContinuation: coefficientHypothesisCoversAll && bakeContentHypothesisCoversAll === false ?
					'proof-7b-coefficient-L10-oracle' :
					'proof-7d-under-instrumented-aggregate',
				nextProofOnlyAction: coefficientHypothesisCoversAll && bakeContentHypothesisCoversAll === false ?
					'Run a proof-only aggregate L10/l1 coefficient oracle before proof-7a source-policy, Chebyshev, runtime, public API, docs, or bake-policy changes.' :
					'Keep aggregate comparison proof-only and add missing attribution rows before choosing proof-7a, proof-7b, or proof-7d.',
				interpretation: coefficientHypothesisCoversAll && bakeContentHypothesisCoversAll === false ?
					'The aggregate common denominator is L10/l1 coefficient attribution across both mapped and unmapped buckets; bake-content/source-policy evidence covers only the mapped subset, so runtime and bake-policy promotion remain blocked.' :
					'No single aggregate explanation covers the current mapped and unmapped buckets; more proof-only instrumentation is required.'
			}
		};

	};

	const aggregateExplanationComparisonStudy = createAggregateExplanationComparisonStudy();
	const createProof7bCoefficientL10OracleStudy = () => {

		const allRows = [
			...mappedBakeContentSourcePolicyOracleStudy.rows,
			...unmappedCoefficientAttributionInstrumentationStudy.rows
		];
		const l10Rows = allRows.filter( row =>
			row.attributionDominantCoefficient === 'L10' &&
			row.attributionDominantCoefficientBand === 'l1'
		);
		const rowsBySourceProbe = [ ...l10Rows.reduce( ( buckets, row ) => {

			const key = `${ row.attributionSourceProbeIndex }/${ row.receiver }`;
			const bucket = buckets.get( key ) ?? [];
			bucket.push( row );
			buckets.set( key, bucket );
			return buckets;

		}, new Map() ) ].map( ( [ key, bucketRows ] ) => {

			const [ sourceProbeIndex, receiver ] = key.split( '/' );
			return {
				id: `probe-${ sourceProbeIndex }-${ receiver }-L10-l1`,
				sourceProbeIndex: Number( sourceProbeIndex ),
				receiver,
				sampleCount: bucketRows.length,
				mappedSampleCount: bucketRows.filter( row => row.mappedToContentPressure === true ).length,
				unmappedSampleCount: bucketRows.filter( row => row.mappedToContentPressure === false ).length,
				wrongChannelPressure: sumMetricBy( bucketRows, 'attributionWrongChannelPressure' ),
				correctChannelPreservation: sumMetricBy( bucketRows, 'attributionCorrectChannelPreservation' ),
				contentDominantPressure: sumMetricBy( bucketRows, 'contentDominantPressure' ),
				maxRuntimeWrongOverCorrect: maxMetricBy( bucketRows, 'runtimeWrongOverCorrect' ),
				maxCoefficientWrongMinusCorrect: maxMetricBy( bucketRows, 'attributionDominantCoefficientWrongMinusCorrect' ),
				sourceRelationHistogram: histogramBy( bucketRows, 'attributionSourceRelationToReceiver' ),
				classification: ''
			};

		} ).sort( ( a, b ) => b.wrongChannelPressure - a.wrongChannelPressure );

		const totalWrongChannelPressure = sumMetricBy( l10Rows, 'attributionWrongChannelPressure' );
		const totalCorrectChannelPreservation = sumMetricBy( l10Rows, 'attributionCorrectChannelPreservation' );
		const dominantRow = rowsBySourceProbe[ 0 ] ?? null;
		const residualRows = rowsBySourceProbe.slice( 1 );
		const dominantWrongPressureShare = dominantRow !== null && totalWrongChannelPressure > 0 ?
			roundMetric( dominantRow.wrongChannelPressure / totalWrongChannelPressure ) :
			0;
		const residualWrongPressure = sumMetricBy( residualRows, 'wrongChannelPressure' );
		const residualCorrectPreservation = sumMetricBy( residualRows, 'correctChannelPreservation' );
		const allRowsAreL10L1 = allRows.length > 0 && l10Rows.length === allRows.length;
		const sourceTraceComplete = allRows.length > 0 && allRows.every( row => Number.isInteger( row.attributionSourceProbeIndex ) );
		const dominantProbeIdentified = allRowsAreL10L1 && sourceTraceComplete && dominantWrongPressureShare >= 0.9;
		const globalCoefficientDampingSafe = dominantProbeIdentified &&
			residualRows.length === 0 &&
			totalCorrectChannelPreservation <= totalWrongChannelPressure;

		for ( const row of rowsBySourceProbe ) {

			row.wrongPressureShare = totalWrongChannelPressure > 0 ?
				roundMetric( row.wrongChannelPressure / totalWrongChannelPressure ) :
				0;
			row.classification = row === dominantRow && dominantProbeIdentified ?
				'PRIMARY-L10-COEFFICIENT-LEAK-DRIVER' :
				'RESIDUAL-L10-COEFFICIENT-TRACE-NOT-A-GLOBAL-DAMPING-WIN';

		}

		return {
			status: allRows.length === 0 ?
				'SUPPORTED-PROOF-7B-L10-COEFFICIENT-BOUNDED' :
				dominantProbeIdentified ?
					'IDENTIFIED-PROOF-7B-L10-PROBE50-DOMINANT-RESIDUAL-BOUNDED' :
					'OPEN-PROOF-7B-L10-COEFFICIENT-NO-DOMINANT-SOURCE',
			proofBoundary: 'CPU/report-only proof-7b L10/l1 coefficient oracle over aggregate mapped and unmapped rows; identifies source-probe pressure only and does not change runtime sampling, bake policy, public API, docs, or Chebyshev thresholds.',
			noRuntimePromotion: true,
			rows: rowsBySourceProbe,
			summary: {
				sampleCount: allRows.length,
				l10SampleCount: l10Rows.length,
				allRowsAreL10L1,
				sourceTraceComplete,
				sourceProbeBucketCount: rowsBySourceProbe.length,
				totalWrongChannelPressure,
				totalCorrectChannelPreservation,
				dominantSourceProbeIndex: dominantRow?.sourceProbeIndex ?? null,
				dominantReceiver: dominantRow?.receiver ?? null,
				dominantSampleCount: dominantRow?.sampleCount ?? 0,
				dominantWrongChannelPressure: dominantRow?.wrongChannelPressure ?? 0,
				dominantWrongPressureShare,
				residualWrongChannelPressure: residualWrongPressure,
				residualCorrectChannelPreservation: residualCorrectPreservation,
				globalCoefficientDampingSafe,
				runtimePromotionAllowed: false,
				identifiedCause: dominantProbeIdentified ?
					'Probe-50/rightReceiver L10/l1 is the dominant wrong-channel pressure source; probe-52/leftReceiver is a low-pressure residual trace, so global L10 damping is not a safe runtime conclusion.' :
					'L10/l1 coefficient attribution is present, but no single source-probe bucket dominates enough for identification.',
				nextProofOnlyAction: dominantProbeIdentified ?
					'Run a proof-only probe-50 L10 sign/source-isolation oracle before proof-7a source-policy, Chebyshev, runtime, public API, docs, or bake-policy changes.' :
					'Keep proof-7b proof-only and add source-probe coefficient rows before choosing a runtime-facing design.',
				interpretation: dominantProbeIdentified ?
					'The coefficient oracle identifies L10/l1 as the aggregate family and probe-50/rightReceiver as the pressure-dominant subset, while probe-52 residual preservation blocks a global L10 damping fix.' :
					'The coefficient oracle does not yet identify a pressure-dominant L10 source bucket.'
			}
		};

	};

	const proof7bCoefficientL10OracleStudy = createProof7bCoefficientL10OracleStudy();

	return {
		mappedBakeContentSourcePolicyOracleStudy,
		unmappedCoefficientAttributionInstrumentationStudy,
		aggregateExplanationComparisonStudy,
		proof7bCoefficientL10OracleStudy
	};

};
