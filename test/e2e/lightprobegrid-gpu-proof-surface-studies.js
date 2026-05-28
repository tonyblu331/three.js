import {
	histogramBy,
	maxMetricBy,
	roundMetric,
	sumMetricBy
} from './lightprobegrid-gpu-report-metrics.js';

export const createSurfaceContentAttributionSplitStudy = ( {
	surfaceShContentStudy,
	surfaceSampleCoefficientAttributionStudy
} ) => {

	const surfaceContentRowsBySample = new Map( surfaceShContentStudy.receiverRows.flatMap( receiver =>
		receiver.samples.map( sample => [ `${ receiver.receiver }/${ sample.sampleLabel }`, sample ] )
	) );
	const leakingSamples = surfaceSampleCoefficientAttributionStudy.receivers.flatMap( receiver =>
		receiver.samples
			.filter( sample => sample.leakSample )
			.map( sample => ( { receiver: receiver.receiver, sample } ) )
	);
	const leakRows = leakingSamples
		.filter( ( { sample } ) =>
			Array.isArray( sample.attributionRows ) &&
			sample.attributionRows.length > 0 &&
			Number.isInteger( sample.dominantProbeIndex )
		)
		.map( ( { receiver, sample } ) => {

			const contentSample = surfaceContentRowsBySample.get( `${ receiver }/${ sample.sampleLabel }` ) ?? null;
			const mappedToContentPressure = contentSample?.contentPressureSample === true;
			const dominantAttributionRow = sample.attributionRows.find( row =>
				row.probeIndex === sample.dominantProbeIndex
			) ?? null;

			return {
				receiver,
				sampleLabel: sample.sampleLabel,
				runtimeWrongOverCorrect: sample.runtimeWrongOverCorrect,
				mappedToContentPressure,
				contentPressureAttributionRowCount: contentSample?.contentPressureAttributionRowCount ?? 0,
				contentDominantProbeIndex: contentSample?.dominantProbeIndex ?? null,
				contentDominantBand: contentSample?.dominantProbeBandResponsibility ?? 'none',
				contentDominantPressure: contentSample?.dominantProbeContentPressure ?? 0,
				contentDominantWeightedPressure: contentSample?.dominantProbeWeightedContentPressure ?? 0,
				attributionDominantProbeIndex: sample.dominantProbeIndex,
				attributionDominantSourceProbeIndex: sample.dominantSourceProbeIndex,
				attributionProbeRelationToReceiver: sample.dominantProbeRelationToReceiver,
				attributionSourceRelationToReceiver: sample.dominantSourceRelationToReceiver,
				attributionSourceSide: dominantAttributionRow?.sourceSide ?? 'unknown',
				attributionDilationSourceDiffers: dominantAttributionRow?.dilationSourceDiffers ?? false,
				attributionSourceValidity: dominantAttributionRow?.sourceValidity ?? 0,
				attributionRuntimeFinalWeight: dominantAttributionRow?.runtimeFinalWeight ?? 0,
				attributionDominantBand: sample.dominantWeightedBand,
				attributionDominantCoefficient: sample.dominantWeightedCoefficient,
				attributionDominantCoefficientBand: sample.dominantWeightedCoefficientBand,
				attributionDominantCoefficientWrongMinusCorrect: dominantAttributionRow?.dominantWeightedCoefficientWrongMinusCorrect ?? 0,
				attributionDominantDilatedCoefficient: sample.dominantDilatedWeightedCoefficient,
				attributionDominantDilatedCoefficientBand: dominantAttributionRow?.dominantDilatedWeightedCoefficientBand ?? 'none',
				attributionDominantDilatedCoefficientWrongMinusCorrect: dominantAttributionRow?.dominantDilatedWeightedCoefficientWrongMinusCorrect ?? 0,
				attributionWrongChannelPressure: sample.dominantWrongChannelPressure,
				attributionCorrectChannelPreservation: sample.dominantCorrectChannelPreservation,
				sourcePressureAttributionRowCount: sample.sourcePressureAttributionRowCount,
				sourcePressureProbeIndex: sample.sourcePressureProbeIndex,
				sourcePressureSourceProbeIndex: sample.sourcePressureSourceProbeIndex,
				sourcePressureWrongChannelPressure: sample.sourcePressureWrongChannelPressure,
				sourcePressureDilatedWrongChannelPressure: sample.sourcePressureDilatedWrongChannelPressure,
				sourcePressureDilatedSourceWrongPressureDelta: sample.sourcePressureDilatedSourceWrongPressureDelta
			};

		} );
	const mappedRows = leakRows.filter( row => row.mappedToContentPressure );
	const unmappedRows = leakRows.filter( row => row.mappedToContentPressure === false );

	return {
		status: leakingSamples.length === 0 ?
			'SUPPORTED-SURFACE-CONTENT-ATTRIBUTION-SPLIT-BOUNDED' :
			leakRows.length === 0 ?
				'OPEN-SURFACE-CONTENT-ATTRIBUTION-UNDER-INSTRUMENTED' :
				mappedRows.length > 0 && unmappedRows.length > 0 ?
					'OPEN-SURFACE-CONTENT-ATTRIBUTION-SPLIT' :
					mappedRows.length > 0 ?
						'OPEN-SURFACE-CONTENT-ATTRIBUTION-MAPPED' :
						'OPEN-SURFACE-CONTENT-ATTRIBUTION-UNMAPPED',
		proofBoundary: 'Report-only split of canonical leaking surface attribution rows into bake-content-mapped and unmapped coefficient-attribution buckets; does not change bake capture, runtime sampling, public API, or Chebyshev thresholds.',
		rows: leakRows,
		summary: {
			leakSampleCount: leakingSamples.length,
			attributedLeakSampleCount: leakRows.length,
			unattributedLeakSampleCount: leakingSamples.length - leakRows.length,
			mappedLeakSampleCount: mappedRows.length,
			unmappedLeakSampleCount: unmappedRows.length,
			mappedCoverageRatio: leakingSamples.length > 0 ?
				roundMetric( mappedRows.length / leakingSamples.length ) :
				1,
			mappedDominantProbeHistogram: histogramBy( mappedRows, 'attributionDominantProbeIndex' ),
			unmappedDominantProbeHistogram: histogramBy( unmappedRows, 'attributionDominantProbeIndex' ),
			mappedDominantBandHistogram: histogramBy( mappedRows, 'attributionDominantBand' ),
			unmappedDominantBandHistogram: histogramBy( unmappedRows, 'attributionDominantBand' ),
			mappedDominantCoefficientHistogram: histogramBy( mappedRows, 'attributionDominantCoefficient' ),
			unmappedDominantCoefficientHistogram: histogramBy( unmappedRows, 'attributionDominantCoefficient' ),
			mappedWrongChannelPressure: sumMetricBy( mappedRows, 'attributionWrongChannelPressure' ),
			unmappedWrongChannelPressure: sumMetricBy( unmappedRows, 'attributionWrongChannelPressure' ),
			interpretation: leakingSamples.length > 0 && leakRows.length === 0 ?
				'Canonical leaking surface rows are under-instrumented for content attribution; expand coefficient/source instrumentation before bake or runtime changes.' :
				mappedRows.length > 0 && unmappedRows.length > 0 ?
					'Canonical leaking surface rows split between bake-content-mapped pressure and unmapped coefficient-attribution pressure; do not promote a single bake, density, SDF, or Chebyshev fix without a follow-up that handles both buckets.' :
					mappedRows.length > 0 ?
						'Canonical leaking surface rows all map to current bake-content pressure; a bake-content oracle can be evaluated proof-only before runtime changes.' :
						unmappedRows.length > 0 ?
							'Canonical leaking surface rows do not map to current bake-content pressure; expand coefficient/source instrumentation before bake or runtime changes.' :
							'No leaking surface rows require split attribution.'
		}
	};

};

export const createSurfaceContentAttributionFollowupStudy = ( surfaceContentAttributionSplitStudy ) => {

	const rows = surfaceContentAttributionSplitStudy.rows;
	const mappedRows = rows.filter( row => row.mappedToContentPressure );
	const unmappedRows = rows.filter( row => row.mappedToContentPressure === false );
	const createBucket = ( id, bucketRows, proofOnlyQuestion, recommendedFollowup, interpretation ) => ( {
		id,
		sampleCount: bucketRows.length,
		receiverHistogram: histogramBy( bucketRows, 'receiver' ),
		contentProbeHistogram: histogramBy( bucketRows, 'contentDominantProbeIndex' ),
		contentBandHistogram: histogramBy( bucketRows, 'contentDominantBand' ),
		attributionProbeHistogram: histogramBy( bucketRows, 'attributionDominantProbeIndex' ),
		attributionBandHistogram: histogramBy( bucketRows, 'attributionDominantBand' ),
		attributionCoefficientHistogram: histogramBy( bucketRows, 'attributionDominantCoefficient' ),
		wrongChannelPressure: sumMetricBy( bucketRows, 'attributionWrongChannelPressure' ),
		correctChannelPreservation: sumMetricBy( bucketRows, 'attributionCorrectChannelPreservation' ),
		maxRuntimeWrongOverCorrect: maxMetricBy( bucketRows, 'runtimeWrongOverCorrect' ),
		maxContentDominantPressure: maxMetricBy( bucketRows, 'contentDominantPressure' ),
		proofOnlyQuestion,
		recommendedFollowup,
		interpretation
	} );
	const buckets = [
		...( mappedRows.length > 0 ? [
			createBucket(
				'mapped-bake-content',
				mappedRows,
				'Does a CPU/report-only bake-content oracle reduce the mapped probe-50 surface leaks without reducing correct-bounce preservation?',
				'Evaluate a proof-only bake-content/source-policy oracle on the mapped rows; keep runtime sampling, public API, and Chebyshev thresholds unchanged.',
				'Mapped rows have strong baked content pressure and need a bake-content oracle, but their runtime dominant coefficient is still L10, so the oracle must report coefficient-level effects.'
			)
		] : [] ),
		...( unmappedRows.length > 0 ? [
			createBucket(
				'unmapped-coefficient-attribution',
				unmappedRows,
				'Why do probe-52 L10 coefficient-attribution rows leak when the current bake-content pressure classifier marks the content bounded?',
				'Expand proof-only coefficient/source instrumentation for the unmapped rows before trying a bake, density, SDF, or Chebyshev runtime fix.',
				'Unmapped rows are coefficient-attribution leaks that do not clear the current bake-content pressure gate, so a single bake-content fix would leave part of the observed surface leak unexplained.'
			)
		] : [] )
	];
	const status = surfaceContentAttributionSplitStudy.status === 'SUPPORTED-SURFACE-CONTENT-ATTRIBUTION-SPLIT-BOUNDED' ?
		'SUPPORTED-SURFACE-CONTENT-FOLLOWUP-BOUNDED' :
		surfaceContentAttributionSplitStudy.status === 'OPEN-SURFACE-CONTENT-ATTRIBUTION-UNDER-INSTRUMENTED' ?
			'OPEN-SURFACE-CONTENT-FOLLOWUP-UNDER-INSTRUMENTED' :
			mappedRows.length > 0 && unmappedRows.length > 0 ?
				'OPEN-SURFACE-CONTENT-DUAL-BUCKET-FOLLOWUP' :
				mappedRows.length > 0 ?
					'OPEN-SURFACE-CONTENT-MAPPED-BUCKET-FOLLOWUP' :
					'OPEN-SURFACE-CONTENT-UNMAPPED-BUCKET-FOLLOWUP';

	return {
		status,
		proofBoundary: 'Report-only follow-up prioritization over surfaceContentAttributionSplitStudy buckets; does not change bake capture, runtime sampling, public API, docs, or Chebyshev thresholds.',
		rows: buckets,
		summary: {
			bucketCount: buckets.length,
			attributedLeakSampleCount: surfaceContentAttributionSplitStudy.summary.attributedLeakSampleCount,
			unattributedLeakSampleCount: surfaceContentAttributionSplitStudy.summary.unattributedLeakSampleCount,
			totalBucketSampleCount: buckets.reduce( ( total, bucket ) => total + bucket.sampleCount, 0 ),
			mappedBucketSampleCount: mappedRows.length,
			unmappedBucketSampleCount: unmappedRows.length,
			hasMappedBucket: mappedRows.length > 0,
			hasUnmappedBucket: unmappedRows.length > 0,
			noRuntimePromotion: true,
			nextProofOnlyAction: mappedRows.length > 0 && unmappedRows.length > 0 ?
				'Run a dual proof-only follow-up: a mapped bake-content/source-policy oracle for probe-50 rows and an unmapped coefficient-attribution instrumentation pass for probe-52 L10 rows.' :
				mappedRows.length > 0 ?
					'Run a proof-only mapped bake-content/source-policy oracle before runtime changes.' :
					unmappedRows.length > 0 ?
						'Run a proof-only unmapped coefficient-attribution instrumentation pass before runtime changes.' :
						'No leaking attributed surface rows require a content follow-up.'
		}
	};

};
