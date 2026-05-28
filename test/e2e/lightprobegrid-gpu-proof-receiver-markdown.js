export function appendLightProbeProofReceiverDiagnosticsMarkdown( lines, report ) {

	const sealedReceiverSurfaceQuadratureDiagnostic = report.currentEvidence.sealedReceiverSurfaceQuadratureDiagnostic;
	const sealedReceiverGpuDebugDiagnostic = report.currentEvidence.sealedReceiverGpuDebugDiagnostic;
	const receiverSampleMetricAlignmentStudy = report.currentEvidence.receiverSampleMetricAlignmentStudy;
	const surfaceAnchorPlacementStudy = report.currentEvidence.surfaceAnchorPlacementStudy;
	const surfaceShContentStudy = report.currentEvidence.surfaceShContentStudy;
	const surfaceContentAttributionSplitStudy = report.currentEvidence.surfaceContentAttributionSplitStudy;
	const surfaceContentAttributionFollowupStudy = report.currentEvidence.surfaceContentAttributionFollowupStudy;
	const mappedBakeContentSourcePolicyOracleStudy = report.currentEvidence.mappedBakeContentSourcePolicyOracleStudy;
	const unmappedCoefficientAttributionInstrumentationStudy = report.currentEvidence.unmappedCoefficientAttributionInstrumentationStudy;
	const aggregateExplanationComparisonStudy = report.currentEvidence.aggregateExplanationComparisonStudy;
	const proof7bCoefficientL10OracleStudy = report.currentEvidence.proof7bCoefficientL10OracleStudy;
	const probe50L10SignSourceIsolationOracleStudy = report.currentEvidence.probe50L10SignSourceIsolationOracleStudy;
	const probe50L10ContentBasisPolarityOracleStudy = report.currentEvidence.probe50L10ContentBasisPolarityOracleStudy;
	const probe50CoefficientLocalCorrectionOracleStudy = report.currentEvidence.probe50CoefficientLocalCorrectionOracleStudy;
	const probe50LocalCorrectionAggregateResidualGuardStudy = report.currentEvidence.probe50LocalCorrectionAggregateResidualGuardStudy;
	const probe50L10ZDesignBoundConstraintsStudy = report.currentEvidence.probe50L10ZDesignBoundConstraintsStudy;
	const surfaceSampleCoefficientAttributionStudy = report.currentEvidence.surfaceSampleCoefficientAttributionStudy;
	const surfaceAttributionBranchDecision = report.currentEvidence.surfaceAttributionBranchDecision;
	const surfaceAttributionFollowupSpec = report.currentEvidence.surfaceAttributionFollowupSpec;
	const proof7cSurfaceStaticBlockerOracleStudy = report.currentEvidence.proof7cSurfaceStaticBlockerOracleStudy;
	const proof7cDispositionStudy = report.currentEvidence.proof7cDispositionStudy;

	lines.push(
		'',
		'### Receiver-surface quadrature / GPU debug interrogation',
		`- Surface quadrature status: ${ sealedReceiverSurfaceQuadratureDiagnostic.status }`,
		`- Quadrature rule: ${ sealedReceiverSurfaceQuadratureDiagnostic.quadratureRule }`,
		`- Samples per receiver: ${ sealedReceiverSurfaceQuadratureDiagnostic.sampleCountPerReceiver }`,
		`- CPU surface runtime wrong/correct mean: ${ sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMean }`,
		`- CPU surface runtime wrong/correct max: ${ sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMax }`,
		`- Render surface wrong-side ratio: ${ sealedReceiverSurfaceQuadratureDiagnostic.renderMetrics.surfaceWrongSideColorRatio }`,
		`- Surface CPU/render delta: ${ sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDelta } (mean ${ sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDeltaMean }, max ${ sealedReceiverSurfaceQuadratureDiagnostic.summary.surfaceCpuRenderDeltaMax }, aggregation ${ sealedReceiverSurfaceQuadratureDiagnostic.summary.cpuRenderAgreementAggregation })`,
		`- GPU debug status: ${ sealedReceiverGpuDebugDiagnostic.status }`,
		'',
		'| Receiver | Surface scalar wrong/correct | Surface visibility wrong/correct | Surface runtime wrong/correct | Surface inverted-normal wrong/correct | Avg visibility mix |',
		'|---|---:|---:|---:|---:|---:|'
	);

	for ( const receiver of [ sealedReceiverSurfaceQuadratureDiagnostic.left, sealedReceiverSurfaceQuadratureDiagnostic.right ] ) {

		lines.push( [
			receiver.label,
			receiver.weightedMeans.scalarWrongOverCorrect,
			receiver.weightedMeans.visibilityWrongOverCorrect,
			receiver.weightedMeans.runtimeWrongOverCorrect,
			receiver.weightedMeans.invertedNormalRuntimeWrongOverCorrect,
			receiver.weightedMeans.runtimeVisibilityMix
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Receiver sample metric alignment',
		`- Status: ${ receiverSampleMetricAlignmentStudy.status }`,
		`- Boundary: ${ receiverSampleMetricAlignmentStudy.proofBoundary }`,
		`- Center CPU mean: ${ receiverSampleMetricAlignmentStudy.summary.centerRuntimeWrongRatioMean }`,
		`- Surface CPU mean: ${ receiverSampleMetricAlignmentStudy.summary.surfaceRuntimeWrongRatioMean }`,
		`- Center-vs-surface CPU delta: ${ receiverSampleMetricAlignmentStudy.summary.centerVsSurfaceCpuDelta }`,
		`- Surface CPU/render delta: ${ receiverSampleMetricAlignmentStudy.summary.surfaceCpuRenderDelta }`,
		`- CPU/render agreement gate: ${ receiverSampleMetricAlignmentStudy.summary.cpuRenderAgreementGate }`,
		`- Interpretation: ${ receiverSampleMetricAlignmentStudy.summary.interpretation }`,
		'',
		'| Receiver | Center runtime wrong/correct | Surface runtime wrong/correct | Center-surface delta |',
		'|---|---:|---:|---:|'
	);

	for ( const row of receiverSampleMetricAlignmentStudy.rows ) {

		lines.push( [
			row.receiver,
			row.centerRuntimeWrongOverCorrect,
			row.surfaceRuntimeWrongOverCorrect,
			row.centerSurfaceDelta
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Surface anchor / placement study',
		`- Status: ${ surfaceAnchorPlacementStudy.status }`,
		`- Boundary: ${ surfaceAnchorPlacementStudy.proofBoundary }`,
		`- Center CPU wrong/correct: ${ surfaceAnchorPlacementStudy.summary.centerCpuWrongOverCorrect }`,
		`- Surface CPU wrong/correct: ${ surfaceAnchorPlacementStudy.summary.surfaceCpuWrongOverCorrect }`,
		`- Center-surface delta: ${ surfaceAnchorPlacementStudy.summary.centerSurfaceDelta }`,
		`- Best surface bias: ${ surfaceAnchorPlacementStudy.summary.bestSurfaceBiasCase } (${ surfaceAnchorPlacementStudy.summary.bestSurfaceBiasCpuWrongOverCorrect })`,
		`- Best bias CPU improvement: ${ surfaceAnchorPlacementStudy.summary.bestBiasCpuImprovement }`,
		`- Best bias render improvement: ${ surfaceAnchorPlacementStudy.summary.bestBiasRenderImprovement }`,
		`- Interpretation: ${ surfaceAnchorPlacementStudy.summary.interpretation }`,
		'',
		'| Case | Sample mode | Normal bias | View bias | CPU wrong/correct | Render surface ratio | Center delta | Surface delta | Render delta |',
		'|---|---|---:|---:|---:|---:|---:|---:|---:|'
	);

	for ( const row of surfaceAnchorPlacementStudy.rows ) {

		lines.push( [
			row.label,
			row.sampleMode,
			row.normalBias,
			row.viewBias,
			row.cpuWrongOverCorrectMean,
			row.renderSurfaceWrongSideColorRatio,
			row.centerDelta,
			row.surfaceDelta,
			row.renderSurfaceDelta
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Surface SH content study',
		`- Status: ${ surfaceShContentStudy.status }`,
		`- Boundary: ${ surfaceShContentStudy.proofBoundary }`,
		`- Surface samples: ${ surfaceShContentStudy.summary.surfaceSampleCount }`,
		`- Leak samples: ${ surfaceShContentStudy.summary.leakSampleCount }`,
		`- Content-pressure samples: ${ surfaceShContentStudy.summary.contentPressureSampleCount }`,
		`- Leak samples with content pressure: ${ surfaceShContentStudy.summary.leakSamplesWithContentPressureCount }`,
		`- Worst sample: ${ surfaceShContentStudy.summary.worstSampleLabel } wrong/correct ${ surfaceShContentStudy.summary.worstSampleWrongOverCorrect }, probe ${ surfaceShContentStudy.summary.worstSampleDominantProbeIndex }, band ${ surfaceShContentStudy.summary.worstSampleDominantBand }, pressure ${ surfaceShContentStudy.summary.worstSampleDominantProbePressure }`,
		`- Interpretation: ${ surfaceShContentStudy.summary.interpretation }`,
		'',
		'| Receiver | Weighted wrong/correct | Samples | Leak samples | Content-pressure samples | Dominant bands |',
		'|---|---:|---:|---:|---:|---|'
	);

	for ( const receiver of surfaceShContentStudy.receiverRows ) {

		lines.push( [
			receiver.receiver,
			receiver.weightedWrongOverCorrect,
			receiver.sampleCount,
			receiver.leakSampleCount,
			receiver.contentPressureSampleCount,
			Object.entries( receiver.dominantBands ).map( ( [ band, count ] ) => `${ band }:${ count }` ).join( ', ' )
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'| Receiver | Sample | Wrong/correct | Dominant probe | Classification | Band | Pressure | Leak sample | Content pressure |',
		'|---|---|---:|---:|---|---|---:|---|---|'
	);

	for ( const receiver of surfaceShContentStudy.receiverRows ) {

		for ( const sample of receiver.samples ) {

			lines.push( [
				receiver.receiver,
				sample.sampleLabel,
				sample.runtimeWrongOverCorrect,
				sample.dominantProbeIndex,
				sample.dominantProbeClassification,
				sample.dominantProbeBandResponsibility,
				sample.dominantProbeContentPressure,
				sample.leakSample,
				sample.contentPressureSample
			].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

		}

	}

	lines.push(
		'',
		'### Surface content attribution split',
		`- Status: ${ surfaceContentAttributionSplitStudy.status }`,
		`- Boundary: ${ surfaceContentAttributionSplitStudy.proofBoundary }`,
		`- Leak samples: ${ surfaceContentAttributionSplitStudy.summary.leakSampleCount }`,
		`- Attributed leak samples: ${ surfaceContentAttributionSplitStudy.summary.attributedLeakSampleCount }`,
		`- Unattributed leak samples: ${ surfaceContentAttributionSplitStudy.summary.unattributedLeakSampleCount }`,
		`- Mapped leak samples: ${ surfaceContentAttributionSplitStudy.summary.mappedLeakSampleCount }`,
		`- Unmapped leak samples: ${ surfaceContentAttributionSplitStudy.summary.unmappedLeakSampleCount }`,
		`- Mapped coverage ratio: ${ surfaceContentAttributionSplitStudy.summary.mappedCoverageRatio }`,
		`- Mapped dominant probes: ${ Object.entries( surfaceContentAttributionSplitStudy.summary.mappedDominantProbeHistogram ).map( ( [ probe, count ] ) => `${ probe }:${ count }` ).join( ', ' ) || 'none' }`,
		`- Unmapped dominant probes: ${ Object.entries( surfaceContentAttributionSplitStudy.summary.unmappedDominantProbeHistogram ).map( ( [ probe, count ] ) => `${ probe }:${ count }` ).join( ', ' ) || 'none' }`,
		`- Interpretation: ${ surfaceContentAttributionSplitStudy.summary.interpretation }`,
		'',
		'| Receiver | Sample | Mapped | Content probe | Content band | Content pressure | Attribution probe | Attribution band | Coeff | Wrong pressure |',
		'|---|---|---:|---:|---|---:|---:|---|---|---:|'
	);

	for ( const row of surfaceContentAttributionSplitStudy.rows ) {

		lines.push( [
			row.receiver,
			row.sampleLabel,
			row.mappedToContentPressure,
			row.contentDominantProbeIndex ?? 'n/a',
			row.contentDominantBand ?? 'n/a',
			row.contentDominantPressure ?? 'n/a',
			row.attributionDominantProbeIndex,
			row.attributionDominantBand,
			row.attributionDominantCoefficient,
			row.attributionWrongChannelPressure
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Surface content follow-up buckets',
		`- Status: ${ surfaceContentAttributionFollowupStudy.status }`,
		`- Boundary: ${ surfaceContentAttributionFollowupStudy.proofBoundary }`,
		`- Buckets: ${ surfaceContentAttributionFollowupStudy.summary.bucketCount }`,
		`- Total bucket samples: ${ surfaceContentAttributionFollowupStudy.summary.totalBucketSampleCount }`,
		`- Mapped bucket samples: ${ surfaceContentAttributionFollowupStudy.summary.mappedBucketSampleCount }`,
		`- Unmapped bucket samples: ${ surfaceContentAttributionFollowupStudy.summary.unmappedBucketSampleCount }`,
		`- No runtime promotion: ${ surfaceContentAttributionFollowupStudy.summary.noRuntimePromotion }`,
		`- Next proof-only action: ${ surfaceContentAttributionFollowupStudy.summary.nextProofOnlyAction }`,
		'',
		'| Bucket | Samples | Receivers | Content probes | Content bands | Attribution probes | Attribution coeffs | Wrong pressure | Max wrong/correct | Follow-up |',
		'|---|---:|---|---|---|---|---|---:|---:|---|'
	);

	for ( const row of surfaceContentAttributionFollowupStudy.rows ) {

		lines.push( [
			row.id,
			row.sampleCount,
			Object.entries( row.receiverHistogram ).map( ( [ receiver, count ] ) => `${ receiver }:${ count }` ).join( ', ' ),
			Object.entries( row.contentProbeHistogram ).map( ( [ probe, count ] ) => `${ probe }:${ count }` ).join( ', ' ),
			Object.entries( row.contentBandHistogram ).map( ( [ band, count ] ) => `${ band }:${ count }` ).join( ', ' ),
			Object.entries( row.attributionProbeHistogram ).map( ( [ probe, count ] ) => `${ probe }:${ count }` ).join( ', ' ),
			Object.entries( row.attributionCoefficientHistogram ).map( ( [ coefficient, count ] ) => `${ coefficient }:${ count }` ).join( ', ' ),
			row.wrongChannelPressure,
			row.maxRuntimeWrongOverCorrect,
			row.recommendedFollowup
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Mapped bake-content/source-policy oracle',
		`- Status: ${ mappedBakeContentSourcePolicyOracleStudy.status }`,
		`- Boundary: ${ mappedBakeContentSourcePolicyOracleStudy.proofBoundary }`,
		`- Samples: ${ mappedBakeContentSourcePolicyOracleStudy.summary.sampleCount }`,
		`- Content probes: ${ Object.entries( mappedBakeContentSourcePolicyOracleStudy.summary.contentProbeHistogram ).map( ( [ probe, count ] ) => `${ probe }:${ count }` ).join( ', ' ) || 'none' }`,
		`- Content bands: ${ Object.entries( mappedBakeContentSourcePolicyOracleStudy.summary.contentBandHistogram ).map( ( [ band, count ] ) => `${ band }:${ count }` ).join( ', ' ) || 'none' }`,
		`- Attribution coeffs: ${ Object.entries( mappedBakeContentSourcePolicyOracleStudy.summary.attributionCoefficientHistogram ).map( ( [ coefficient, count ] ) => `${ coefficient }:${ count }` ).join( ', ' ) || 'none' }`,
		`- Attribution source probes: ${ Object.entries( mappedBakeContentSourcePolicyOracleStudy.summary.attributionSourceProbeHistogram ).map( ( [ probe, count ] ) => `${ probe }:${ count }` ).join( ', ' ) || 'none' }`,
		`- Attribution source relations: ${ Object.entries( mappedBakeContentSourcePolicyOracleStudy.summary.attributionSourceRelationHistogram ).map( ( [ relation, count ] ) => `${ relation }:${ count }` ).join( ', ' ) || 'none' }`,
		`- Content pressure sum: ${ mappedBakeContentSourcePolicyOracleStudy.summary.contentDominantPressureSum }`,
		`- Attribution wrong pressure sum: ${ mappedBakeContentSourcePolicyOracleStudy.summary.attributionWrongChannelPressureSum }`,
		`- Band mismatch count: ${ mappedBakeContentSourcePolicyOracleStudy.summary.bandMismatchCount }`,
		`- No runtime promotion: ${ mappedBakeContentSourcePolicyOracleStudy.summary.noRuntimePromotion }`,
		`- Next proof-only action: ${ mappedBakeContentSourcePolicyOracleStudy.summary.nextProofOnlyAction }`,
		`- Interpretation: ${ mappedBakeContentSourcePolicyOracleStudy.summary.interpretation }`,
		'',
		'| Receiver | Sample | Content probe | Content band | Content pressure | Attribution probe | Source probe | Source relation | Attribution band | Coeff | Coeff band | Coeff pressure | Wrong pressure | Band mismatch |',
		'|---|---|---:|---|---:|---:|---:|---|---|---|---|---:|---:|---:|'
	);

	for ( const row of mappedBakeContentSourcePolicyOracleStudy.rows ) {

		lines.push( [
			row.receiver,
			row.sampleLabel,
			row.contentProbeIndex ?? 'n/a',
			row.contentDominantBand,
			row.contentDominantPressure,
			row.attributionProbeIndex,
			row.attributionSourceProbeIndex,
			row.attributionSourceRelationToReceiver,
			row.attributionDominantBand,
			row.attributionDominantCoefficient,
			row.attributionDominantCoefficientBand,
			row.attributionDominantCoefficientWrongMinusCorrect,
			row.attributionWrongChannelPressure,
			row.contentAttributionBandMismatch
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Unmapped coefficient-attribution instrumentation',
		`- Status: ${ unmappedCoefficientAttributionInstrumentationStudy.status }`,
		`- Boundary: ${ unmappedCoefficientAttributionInstrumentationStudy.proofBoundary }`,
		`- Samples: ${ unmappedCoefficientAttributionInstrumentationStudy.summary.sampleCount }`,
		`- Content probes: ${ Object.entries( unmappedCoefficientAttributionInstrumentationStudy.summary.contentProbeHistogram ).map( ( [ probe, count ] ) => `${ probe }:${ count }` ).join( ', ' ) || 'none' }`,
		`- Content bands: ${ Object.entries( unmappedCoefficientAttributionInstrumentationStudy.summary.contentBandHistogram ).map( ( [ band, count ] ) => `${ band }:${ count }` ).join( ', ' ) || 'none' }`,
		`- Attribution coeffs: ${ Object.entries( unmappedCoefficientAttributionInstrumentationStudy.summary.attributionCoefficientHistogram ).map( ( [ coefficient, count ] ) => `${ coefficient }:${ count }` ).join( ', ' ) || 'none' }`,
		`- Attribution source probes: ${ Object.entries( unmappedCoefficientAttributionInstrumentationStudy.summary.attributionSourceProbeHistogram ).map( ( [ probe, count ] ) => `${ probe }:${ count }` ).join( ', ' ) || 'none' }`,
		`- Attribution source relations: ${ Object.entries( unmappedCoefficientAttributionInstrumentationStudy.summary.attributionSourceRelationHistogram ).map( ( [ relation, count ] ) => `${ relation }:${ count }` ).join( ', ' ) || 'none' }`,
		`- Probe-52 L10 rows: ${ unmappedCoefficientAttributionInstrumentationStudy.summary.probe52L10SampleCount }`,
		`- Source trace complete: ${ unmappedCoefficientAttributionInstrumentationStudy.summary.sourceTraceComplete }`,
		`- Content attribution rows: ${ unmappedCoefficientAttributionInstrumentationStudy.summary.contentPressureAttributionRowCountSum }`,
		`- Attribution wrong pressure sum: ${ unmappedCoefficientAttributionInstrumentationStudy.summary.attributionWrongChannelPressureSum }`,
		`- Needs coefficient/source instrumentation: ${ unmappedCoefficientAttributionInstrumentationStudy.summary.needsCoefficientSourceInstrumentation }`,
		`- No runtime promotion: ${ unmappedCoefficientAttributionInstrumentationStudy.summary.noRuntimePromotion }`,
		`- Next proof-only action: ${ unmappedCoefficientAttributionInstrumentationStudy.summary.nextProofOnlyAction }`,
		`- Interpretation: ${ unmappedCoefficientAttributionInstrumentationStudy.summary.interpretation }`,
		'',
		'| Receiver | Sample | Content probe | Content band | Content pressure | Content rows | Attribution probe | Source probe | Source relation | Attribution band | Coeff | Coeff band | Coeff pressure | Source rows | Verdict | Wrong pressure |',
		'|---|---|---:|---|---:|---:|---:|---:|---|---|---|---|---:|---:|---|---:|'
	);

	for ( const row of unmappedCoefficientAttributionInstrumentationStudy.rows ) {

		lines.push( [
			row.receiver,
			row.sampleLabel,
			row.contentProbeIndex ?? 'n/a',
			row.contentDominantBand,
			row.contentDominantPressure,
			row.contentPressureAttributionRowCount,
			row.attributionProbeIndex,
			row.attributionSourceProbeIndex,
			row.attributionSourceRelationToReceiver,
			row.attributionDominantBand,
			row.attributionDominantCoefficient,
			row.attributionDominantCoefficientBand,
			row.attributionDominantCoefficientWrongMinusCorrect,
			row.sourcePressureAttributionRowCount,
			row.coefficientSourceInstrumentationVerdict,
			row.attributionWrongChannelPressure
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Surface sample coefficient attribution study',
		`- Status: ${ surfaceSampleCoefficientAttributionStudy.status }`,
		`- Boundary: ${ surfaceSampleCoefficientAttributionStudy.proofBoundary }`,
		`- Surface samples: ${ surfaceSampleCoefficientAttributionStudy.summary.surfaceSampleCount }`,
		`- Leak samples: ${ surfaceSampleCoefficientAttributionStudy.summary.leakSampleCount }`,
		`- Attributed leak samples: ${ surfaceSampleCoefficientAttributionStudy.summary.attributedLeakSampleCount }`,
		`- Wrong-side dominant leak samples: ${ surfaceSampleCoefficientAttributionStudy.summary.wrongSideDominantLeakSampleCount }`,
		`- Correct-side dominant leak samples: ${ surfaceSampleCoefficientAttributionStudy.summary.correctSideDominantLeakSampleCount }`,
		`- L2 dominant leak samples: ${ surfaceSampleCoefficientAttributionStudy.summary.l2DominantLeakSampleCount }`,
		`- Dilation-source changed dominant leak samples: ${ surfaceSampleCoefficientAttributionStudy.summary.dilationChangedDominantLeakSampleCount }`,
		`- Weighted leak wrong-channel pressure: ${ surfaceSampleCoefficientAttributionStudy.summary.weightedLeakWrongChannelPressure }`,
		`- Weighted leak correct-channel preservation: ${ surfaceSampleCoefficientAttributionStudy.summary.weightedLeakCorrectChannelPreservation }`,
		`- Worst sample: ${ surfaceSampleCoefficientAttributionStudy.summary.worstSampleReceiver }/${ surfaceSampleCoefficientAttributionStudy.summary.worstSampleLabel } wrong/correct ${ surfaceSampleCoefficientAttributionStudy.summary.worstSampleWrongOverCorrect }, probe ${ surfaceSampleCoefficientAttributionStudy.summary.worstSampleDominantProbeIndex }, source ${ surfaceSampleCoefficientAttributionStudy.summary.worstSampleDominantSourceProbeIndex }, band ${ surfaceSampleCoefficientAttributionStudy.summary.worstSampleDominantBand }, coeff ${ surfaceSampleCoefficientAttributionStudy.summary.worstSampleDominantCoefficient }`,
		`- Interpretation: ${ surfaceSampleCoefficientAttributionStudy.summary.interpretation }`,
		'',
		'| Receiver | Sample | Leak | Wrong/correct | Probe | Source | Probe relation | Source relation | Weight | Band | Coeff | Weighted wrong-correct | Wrong pressure | Correct preserved | Dilated pressure | Dilated pressure delta | Negative energy | Clamp delta |',
		'|---|---|---:|---:|---:|---:|---|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|'
	);

	for ( const receiver of surfaceSampleCoefficientAttributionStudy.receivers ) {

		for ( const sample of receiver.samples ) {

			lines.push( [
				receiver.receiver,
				sample.sampleLabel,
				sample.leakSample,
				sample.runtimeWrongOverCorrect,
				sample.dominantProbeIndex,
				sample.dominantSourceProbeIndex,
				sample.dominantProbeRelationToReceiver,
				sample.dominantSourceRelationToReceiver,
				sample.attributionRows.find( row => row.probeIndex === sample.dominantProbeIndex )?.runtimeFinalWeight ?? 'n/a',
				sample.dominantWeightedBand,
				sample.dominantWeightedCoefficient,
				sample.dominantWeightedWrongMinusCorrect,
				sample.dominantWrongChannelPressure,
				sample.dominantCorrectChannelPreservation,
				sample.dominantDilatedWrongChannelPressure,
				sample.dominantDilatedSourceWrongPressureDelta,
				sample.dominantFullUnclampedNegativeEnergy,
				sample.dominantPostClampEnergyDelta
			].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

		}

	}

	lines.push(
		'',
		'### Aggregate explanation comparison',
		`- Status: ${ aggregateExplanationComparisonStudy.status }`,
		`- Boundary: ${ aggregateExplanationComparisonStudy.proofBoundary }`,
		`- Samples: ${ aggregateExplanationComparisonStudy.summary.sampleCount }`,
		`- Mapped/unmapped: ${ aggregateExplanationComparisonStudy.summary.mappedSampleCount }/${ aggregateExplanationComparisonStudy.summary.unmappedSampleCount }`,
		`- Content-pressure coverage: ${ aggregateExplanationComparisonStudy.summary.contentPressureSampleCount }/${ aggregateExplanationComparisonStudy.summary.sampleCount }`,
		`- L10/l1 coefficient coverage: ${ aggregateExplanationComparisonStudy.summary.coefficientL10SampleCount }/${ aggregateExplanationComparisonStudy.summary.sampleCount }`,
		`- Source trace complete: ${ aggregateExplanationComparisonStudy.summary.sourceTraceComplete }`,
		`- Bake-content covers all: ${ aggregateExplanationComparisonStudy.summary.bakeContentHypothesisCoversAll }`,
		`- Coefficient hypothesis covers all: ${ aggregateExplanationComparisonStudy.summary.coefficientHypothesisCoversAll }`,
		`- Recommended continuation: ${ aggregateExplanationComparisonStudy.summary.recommendedContinuation }`,
		`- No runtime promotion: ${ aggregateExplanationComparisonStudy.summary.noRuntimePromotion }`,
		`- Next proof-only action: ${ aggregateExplanationComparisonStudy.summary.nextProofOnlyAction }`,
		`- Interpretation: ${ aggregateExplanationComparisonStudy.summary.interpretation }`,
		'',
		'| Bucket | Samples | Content rows | L10 rows | Content probes | Attribution probes | Source probes | Source relations | Coefficients | Coeff bands | Wrong pressure | Interpretation |',
		'|---|---:|---:|---:|---|---|---|---|---|---|---:|---|'
	);

	for ( const row of aggregateExplanationComparisonStudy.rows ) {

		lines.push( [
			row.id,
			row.sampleCount,
			row.contentPressureSampleCount,
			row.coefficientL10SampleCount,
			Object.entries( row.contentProbeHistogram ).map( ( [ probe, count ] ) => `${ probe }:${ count }` ).join( ', ' ),
			Object.entries( row.attributionProbeHistogram ).map( ( [ probe, count ] ) => `${ probe }:${ count }` ).join( ', ' ),
			Object.entries( row.attributionSourceProbeHistogram ).map( ( [ probe, count ] ) => `${ probe }:${ count }` ).join( ', ' ),
			Object.entries( row.attributionSourceRelationHistogram ).map( ( [ relation, count ] ) => `${ relation }:${ count }` ).join( ', ' ),
			Object.entries( row.attributionCoefficientHistogram ).map( ( [ coefficient, count ] ) => `${ coefficient }:${ count }` ).join( ', ' ),
			Object.entries( row.attributionCoefficientBandHistogram ).map( ( [ band, count ] ) => `${ band }:${ count }` ).join( ', ' ),
			row.attributionWrongChannelPressure,
			row.interpretation
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### proof-7b L10/l1 coefficient oracle',
		`- Status: ${ proof7bCoefficientL10OracleStudy.status }`,
		`- Boundary: ${ proof7bCoefficientL10OracleStudy.proofBoundary }`,
		`- Samples: ${ proof7bCoefficientL10OracleStudy.summary.sampleCount }`,
		`- L10/l1 rows: ${ proof7bCoefficientL10OracleStudy.summary.l10SampleCount }`,
		`- Source trace complete: ${ proof7bCoefficientL10OracleStudy.summary.sourceTraceComplete }`,
		`- Dominant source probe: ${ proof7bCoefficientL10OracleStudy.summary.dominantSourceProbeIndex }`,
		`- Dominant receiver: ${ proof7bCoefficientL10OracleStudy.summary.dominantReceiver }`,
		`- Dominant wrong-pressure share: ${ proof7bCoefficientL10OracleStudy.summary.dominantWrongPressureShare }`,
		`- Global coefficient damping safe: ${ proof7bCoefficientL10OracleStudy.summary.globalCoefficientDampingSafe }`,
		`- Runtime promotion allowed: ${ proof7bCoefficientL10OracleStudy.summary.runtimePromotionAllowed }`,
		`- Identified cause: ${ proof7bCoefficientL10OracleStudy.summary.identifiedCause }`,
		`- Next proof-only action: ${ proof7bCoefficientL10OracleStudy.summary.nextProofOnlyAction }`,
		`- Interpretation: ${ proof7bCoefficientL10OracleStudy.summary.interpretation }`,
		'',
		'| Bucket | Samples | Mapped | Unmapped | Wrong pressure | Share | Correct preservation | Content pressure | Max wrong/correct | Max coeff delta | Source relations | Classification |',
		'|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|'
	);

	for ( const row of proof7bCoefficientL10OracleStudy.rows ) {

		lines.push( [
			row.id,
			row.sampleCount,
			row.mappedSampleCount,
			row.unmappedSampleCount,
			row.wrongChannelPressure,
			row.wrongPressureShare,
			row.correctChannelPreservation,
			row.contentDominantPressure,
			row.maxRuntimeWrongOverCorrect,
			row.maxCoefficientWrongMinusCorrect,
			Object.entries( row.sourceRelationHistogram ).map( ( [ relation, count ] ) => `${ relation }:${ count }` ).join( ', ' ),
			row.classification
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Probe-50 L10 sign/source isolation oracle',
		`- Status: ${ probe50L10SignSourceIsolationOracleStudy.status }`,
		`- Boundary: ${ probe50L10SignSourceIsolationOracleStudy.proofBoundary }`,
		`- Samples: ${ probe50L10SignSourceIsolationOracleStudy.summary.sampleCount }`,
		`- Dominant source probe: ${ probe50L10SignSourceIsolationOracleStudy.summary.dominantSourceProbeIndex }`,
		`- Dominant receiver: ${ probe50L10SignSourceIsolationOracleStudy.summary.dominantReceiver }`,
		`- All dominant rows positive L10: ${ probe50L10SignSourceIsolationOracleStudy.summary.allDominantRowsPositiveL10 }`,
		`- All dominant rows correct-side source: ${ probe50L10SignSourceIsolationOracleStudy.summary.allDominantRowsCorrectSideSource }`,
		`- All dominant rows mapped content pressure: ${ probe50L10SignSourceIsolationOracleStudy.summary.allDominantRowsMappedContentPressure }`,
		`- Wrong-side source pressure rows: ${ probe50L10SignSourceIsolationOracleStudy.summary.wrongSideSourcePressureRowCount }`,
		`- Source-policy blocked: ${ probe50L10SignSourceIsolationOracleStudy.summary.sourcePolicyBlocked }`,
		`- Dominant wrong pressure/share: ${ probe50L10SignSourceIsolationOracleStudy.summary.dominantWrongPressure }/${ probe50L10SignSourceIsolationOracleStudy.summary.dominantWrongPressureShare }`,
		`- Dominant coefficient delta sum: ${ probe50L10SignSourceIsolationOracleStudy.summary.dominantCoefficientDelta }`,
		`- Runtime promotion allowed: ${ probe50L10SignSourceIsolationOracleStudy.summary.runtimePromotionAllowed }`,
		`- Global coefficient damping safe: ${ probe50L10SignSourceIsolationOracleStudy.summary.globalCoefficientDampingSafe }`,
		`- Identified cause: ${ probe50L10SignSourceIsolationOracleStudy.summary.identifiedCause }`,
		`- Next proof-only action: ${ probe50L10SignSourceIsolationOracleStudy.summary.nextProofOnlyAction }`,
		`- Interpretation: ${ probe50L10SignSourceIsolationOracleStudy.summary.interpretation }`,
		'',
		'| Receiver | Sample | Source probe | Source relation | Content rows | Content pressure | Coeff | Sign | Wrong pressure | Correct preservation | Runtime wrong/correct | Source pressure rows | Classification |',
		'|---|---|---:|---|---:|---:|---|---|---:|---:|---:|---:|---|'
	);

	for ( const row of probe50L10SignSourceIsolationOracleStudy.rows ) {

		lines.push( [
			row.receiver,
			row.sampleLabel,
			row.sourceProbeIndex,
			row.sourceRelationToReceiver,
			row.contentPressureAttributionRowCount,
			row.contentDominantPressure,
			`${ row.coefficient }/${ row.coefficientBand }`,
			row.coefficientDeltaSign,
			row.wrongChannelPressure,
			row.correctChannelPreservation,
			row.runtimeWrongOverCorrect,
			row.sourcePressureAttributionRowCount,
			row.classification
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Probe-50 L10 content-basis/polarity oracle',
		`- Status: ${ probe50L10ContentBasisPolarityOracleStudy.status }`,
		`- Boundary: ${ probe50L10ContentBasisPolarityOracleStudy.proofBoundary }`,
		`- Samples: ${ probe50L10ContentBasisPolarityOracleStudy.summary.sampleCount }`,
		`- Coefficient/basis: ${ probe50L10ContentBasisPolarityOracleStudy.summary.coefficient }/${ probe50L10ContentBasisPolarityOracleStudy.summary.coefficientBand } ${ probe50L10ContentBasisPolarityOracleStudy.summary.basis }`,
		`- All rows z basis: ${ probe50L10ContentBasisPolarityOracleStudy.summary.allRowsHaveBasis }`,
		`- All rows positive basis scale: ${ probe50L10ContentBasisPolarityOracleStudy.summary.allRowsPositiveBasisScale }`,
		`- All rows negative correct-channel dominance: ${ probe50L10ContentBasisPolarityOracleStudy.summary.allRowsNegativeCorrectDominance }`,
		`- L10 wrong-minus-correct sum: ${ probe50L10ContentBasisPolarityOracleStudy.summary.l10WrongMinusCorrectSum }`,
		`- L10 weighted wrong-minus-correct sum: ${ probe50L10ContentBasisPolarityOracleStudy.summary.l10WeightedWrongMinusCorrectSum }`,
		`- L10 negative energy sum: ${ probe50L10ContentBasisPolarityOracleStudy.summary.l10NegativeEnergySum }`,
		`- L00 wrong-minus-correct sum: ${ probe50L10ContentBasisPolarityOracleStudy.summary.l00WrongMinusCorrectSum }`,
		`- L11 wrong-minus-correct sum: ${ probe50L10ContentBasisPolarityOracleStudy.summary.l11WrongMinusCorrectSum }`,
		`- Runtime promotion allowed: ${ probe50L10ContentBasisPolarityOracleStudy.summary.runtimePromotionAllowed }`,
		`- Source-policy promotion allowed: ${ probe50L10ContentBasisPolarityOracleStudy.summary.sourcePolicyPromotionAllowed }`,
		`- Bake-policy promotion allowed: ${ probe50L10ContentBasisPolarityOracleStudy.summary.bakePolicyPromotionAllowed }`,
		`- Identified cause: ${ probe50L10ContentBasisPolarityOracleStudy.summary.identifiedCause }`,
		`- Next proof-only action: ${ probe50L10ContentBasisPolarityOracleStudy.summary.nextProofOnlyAction }`,
		`- Interpretation: ${ probe50L10ContentBasisPolarityOracleStudy.summary.interpretation }`,
		'',
		'| Receiver | Sample | Basis | Basis scale | Raw wrong | Raw correct | Wrong-minus-correct | Weighted W-C | Negative energy | L00 W-C | L11 W-C | Classification |',
		'|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|'
	);

	for ( const row of probe50L10ContentBasisPolarityOracleStudy.rows ) {

		lines.push( [
			row.receiver,
			row.sampleLabel,
			row.basis,
			row.basisScale,
			row.l10RawWrong,
			row.l10RawCorrect,
			row.wrongMinusCorrect,
			row.weightedWrongMinusCorrect,
			row.negativeEnergy,
			row.l00WrongMinusCorrect,
			row.l11WrongMinusCorrect,
			row.classification
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Probe-50 coefficient-local correction oracle',
		`- Status: ${ probe50CoefficientLocalCorrectionOracleStudy.status }`,
		`- Boundary: ${ probe50CoefficientLocalCorrectionOracleStudy.proofBoundary }`,
		`- Correction scope: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.correctionScope }`,
		`- Samples: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.sampleCount }`,
		`- All rows correctable: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.allRowsCorrectable }`,
		`- Preserves corrective coefficients: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.preservesCorrectiveCoefficients }`,
		`- Wrong-pressure before: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.dominantWrongPressureBeforeCorrection }`,
		`- Estimated wrong-pressure reduction: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.estimatedWrongPressureReductionSum }`,
		`- Estimated wrong-pressure after: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.estimatedDominantWrongPressureAfterCorrection }`,
		`- Estimated negative-energy reduction: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.estimatedNegativeEnergyReductionSum }`,
		`- Local correction wins: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.localCorrectionWins }`,
		`- Runtime promotion allowed: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.runtimePromotionAllowed }`,
		`- Source-policy promotion allowed: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.sourcePolicyPromotionAllowed }`,
		`- Bake-policy promotion allowed: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.bakePolicyPromotionAllowed }`,
		`- Chebyshev tuning allowed: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.chebyshevTuningAllowed }`,
		`- Identified cause: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.identifiedCause }`,
		`- Next proof-only action: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.nextProofOnlyAction }`,
		`- Interpretation: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.interpretation }`,
		'',
		'| Receiver | Sample | Scope | Current W-C | Corrected W-C | Reduction | Negative-energy reduction | Preserves L00 | Preserves L11 | Classification |',
		'|---|---|---|---:|---:|---:|---:|---|---|---|'
	);

	for ( const row of probe50CoefficientLocalCorrectionOracleStudy.rows ) {

		lines.push( [
			row.receiver,
			row.sampleLabel,
			row.correctionScope,
			row.currentWeightedWrongMinusCorrect,
			row.correctedWeightedWrongMinusCorrect,
			row.estimatedWrongPressureReduction,
			row.estimatedNegativeEnergyReduction,
			row.preservesL00,
			row.preservesL11,
			row.classification
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Probe-50 local-correction aggregate residual guard',
		`- Status: ${ probe50LocalCorrectionAggregateResidualGuardStudy.status }`,
		`- Boundary: ${ probe50LocalCorrectionAggregateResidualGuardStudy.proofBoundary }`,
		`- Samples: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.sampleCount }`,
		`- Aggregate wrong-pressure before: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.aggregateWrongBefore }`,
		`- Aggregate estimated wrong-pressure after: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.aggregateEstimatedWrongAfter }`,
		`- Aggregate reduction: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.aggregateReduction }`,
		`- Aggregate reduction ratio: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.aggregateReductionRatio }`,
		`- Mapped dominant after: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.mappedDominantWrongAfter }`,
		`- Unmapped residual wrong pressure: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.unmappedResidualWrong }`,
		`- Unmapped residual correct preservation: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.unmappedResidualCorrectPreservation }`,
		`- Residual correct/wrong ratio: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.residualCorrectToWrongRatio }`,
		`- Residual guard passes: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.residualGuardPasses }`,
		`- Runtime promotion allowed: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.runtimePromotionAllowed }`,
		`- Source-policy promotion allowed: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.sourcePolicyPromotionAllowed }`,
		`- Bake-policy promotion allowed: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.bakePolicyPromotionAllowed }`,
		`- Chebyshev tuning allowed: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.chebyshevTuningAllowed }`,
		`- Identified cause: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.identifiedCause }`,
		`- Next proof-only action: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.nextProofOnlyAction }`,
		`- Interpretation: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.interpretation }`,
		'',
		'| Bucket | Samples | Probe | Receiver | Wrong before | Reduction | Wrong after | Correct preservation | Classification |',
		'|---|---:|---:|---|---:|---:|---:|---:|---|'
	);

	for ( const row of probe50LocalCorrectionAggregateResidualGuardStudy.rows ) {

		lines.push( [
			row.bucket,
			row.sampleCount,
			row.sourceProbeIndex,
			row.receiver,
			row.wrongPressureBefore,
			row.estimatedWrongPressureReduction,
			row.estimatedWrongPressureAfter,
			row.correctPreservation,
			row.classification
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Probe-50 L10/z design-bound constraints',
		`- Status: ${ probe50L10ZDesignBoundConstraintsStudy.status }`,
		`- Boundary: ${ probe50L10ZDesignBoundConstraintsStudy.proofBoundary }`,
		`- Constraints satisfied: ${ probe50L10ZDesignBoundConstraintsStudy.summary.satisfiedConstraintCount }/${ probe50L10ZDesignBoundConstraintsStudy.summary.requiredConstraintCount }`,
		`- Target: probe ${ probe50L10ZDesignBoundConstraintsStudy.summary.targetProbeIndex } / ${ probe50L10ZDesignBoundConstraintsStudy.summary.targetCoefficient } / ${ probe50L10ZDesignBoundConstraintsStudy.summary.targetBasis }`,
		`- Aggregate estimated wrong after: ${ probe50L10ZDesignBoundConstraintsStudy.summary.aggregateEstimatedWrongAfter }`,
		`- Aggregate reduction ratio: ${ probe50L10ZDesignBoundConstraintsStudy.summary.aggregateReductionRatio }`,
		`- Global coefficient damping rejected: ${ probe50L10ZDesignBoundConstraintsStudy.summary.globalCoefficientDampingRejected }`,
		`- Source-policy rejected: ${ probe50L10ZDesignBoundConstraintsStudy.summary.sourcePolicyRejected }`,
		`- Bake-policy rejected: ${ probe50L10ZDesignBoundConstraintsStudy.summary.bakePolicyRejected }`,
		`- Runtime promotion allowed: ${ probe50L10ZDesignBoundConstraintsStudy.summary.runtimePromotionAllowed }`,
		`- Public API/docs promotion allowed: ${ probe50L10ZDesignBoundConstraintsStudy.summary.publicApiDocsPromotionAllowed }`,
		`- Identified cause: ${ probe50L10ZDesignBoundConstraintsStudy.summary.identifiedCause }`,
		`- Next proof-only action: ${ probe50L10ZDesignBoundConstraintsStudy.summary.nextProofOnlyAction }`,
		`- Interpretation: ${ probe50L10ZDesignBoundConstraintsStudy.summary.interpretation }`,
		'',
		'| Constraint | Category | Satisfied | Requirement | Evidence |',
		'|---|---|---|---|---|'
	);

	for ( const row of probe50L10ZDesignBoundConstraintsStudy.rows ) {

		lines.push( [
			row.id,
			row.category,
			row.satisfied,
			row.requirement,
			row.evidence
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Surface attribution follow-up spec',
		`- Status: ${ surfaceAttributionFollowupSpec.status }`,
		`- Mode: ${ surfaceAttributionFollowupSpec.mode }`,
		`- Boundary: ${ surfaceAttributionFollowupSpec.proofBoundary }`,
		`- Branch decision: ${ surfaceAttributionBranchDecision.status }`,
		`- Selected branch: ${ surfaceAttributionBranchDecision.selectedBranch } (${ surfaceAttributionBranchDecision.selectedOracleFamily })`,
		`- Confidence: ${ surfaceAttributionBranchDecision.confidence }`,
		`- Reason: ${ surfaceAttributionBranchDecision.selectedReason }`,
		`- Branch-routing action: ${ surfaceAttributionBranchDecision.nextAction }`,
		`- Next action: ${ surfaceAttributionFollowupSpec.nextAction }`,
		`- proof-7c selected oracle status: ${ proof7cSurfaceStaticBlockerOracleStudy.status }`,
		`- proof-7c disposition: ${ proof7cDispositionStudy.status }`,
		`- proof-7c addressed: ${ proof7cDispositionStudy.addressed }`,
		`- proof-7c runtime promotion allowed: ${ proof7cDispositionStudy.runtimePromotionAllowed }`,
		`- proof-7c blocked dominant paths: ${ proof7cSurfaceStaticBlockerOracleStudy.summary.blockedDominantPathCount }/${ proof7cSurfaceStaticBlockerOracleStudy.summary.evaluatedDominantPathCount }`,
		`- proof-7c receiver aggregate oracle: ${ proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleStatus } (safe wins ${ proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleSafeWinCount })`,
		`- proof-7c interpretation: ${ proof7cSurfaceStaticBlockerOracleStudy.summary.interpretation }`,
		`- proof-7c disposition reason: ${ proof7cDispositionStudy.summary.reason }`,
		'',
		'| Batch | Title | Output | Gate |',
		'|---|---|---|---|'
	);

	for ( const batch of surfaceAttributionFollowupSpec.batches ) {

		lines.push( [
			batch.id,
			batch.title,
			batch.output,
			batch.gate
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'| GPU debug variant | Family | Visibility weighting | Scale | Region wrong-side | Tight-point mean | Tight-point max | Left point luminance | Right point luminance | Region CPU delta | Region agg | Point CPU delta | Point agg |',
		'|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---|'
	);

	for ( const variant of sealedReceiverGpuDebugDiagnostic.variants ) {

		lines.push( [
			variant.label,
			variant.debugRenderFamily,
			variant.visibilityDepthWeighting,
			variant.debugScale,
			variant.leakMetrics.surfaceWrongSideColorRatio,
			variant.pointMetrics.surfaceWrongRatioMean,
			variant.pointMetrics.surfaceWrongRatioMax,
			variant.pointMetrics.left.luminanceMean,
			variant.pointMetrics.right.luminanceMean,
			variant.surfaceCpuDelta,
			variant.surfaceCpuAggregation,
			variant.pointMetrics.surfaceCpuDelta,
			variant.pointMetrics.surfaceCpuAggregation
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Presentation material / color-space audit',
		`- Status: ${ sealedReceiverGpuDebugDiagnostic.presentationStudy.status }`,
		`- Conclusion: ${ sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.diagnosticConclusion }`,
		'',
		'| Variant | Material | Tone mapping | Output color-space | Masked wrong-side | Surface wrong-side | Tight-point mean |',
		'|---|---|---|---|---:|---:|---:|'
	);

	for ( const variant of sealedReceiverGpuDebugDiagnostic.presentationStudy.variants ) {

		lines.push( [
			variant.label,
			variant.material,
			variant.toneMapping,
			variant.outputColorSpace,
			variant.leakMetrics.maskedWrongSideColorRatio,
			variant.leakMetrics.surfaceWrongSideColorRatio,
			variant.pointMetrics.surfaceWrongRatioMean
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	const offscreenSceneLinearTarget = sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearTarget;
	const offscreenSceneLinearContributionRows = sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionRows ?? [];
	const offscreenSceneLinearContributionSummary = sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionSummary ?? {
		status: 'OPEN-NOT-RECORDED',
		mode: 'offscreen-half-float-linear-target-contribution-isolation',
		diagnosticConclusion: 'Contribution isolation rows were not recorded.'
	};
	const offscreenSceneLinearNeutralContributionRows = sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearNeutralContributionRows ?? [];
	const offscreenSceneLinearNeutralContributionSummary = sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearNeutralContributionSummary ?? {
		status: 'OPEN-NOT-RECORDED',
		mode: 'offscreen-half-float-linear-target-contribution-isolation-neutral-receiver-albedo',
		diagnosticConclusion: 'Neutral receiver contribution isolation rows were not recorded.'
	};
	const offscreenSceneLinearContributionGate = sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.offscreenSceneLinearContributionGate ?? {
		status: 'OPEN-NOT-RECORDED',
		mode: 'proof-only-offscreen-scene-linear-contribution-gate',
		thresholds: {},
		diagnosticConclusion: 'Contribution gate was not recorded.'
	};
	const visiblePixelCpuMirrorStudy = sealedReceiverGpuDebugDiagnostic.presentationStudy.summary.visiblePixelCpuMirrorStudy ?? null;

	lines.push(
		'',
		'### Offscreen scene-linear presentation target',
		`- Status: ${ offscreenSceneLinearTarget.status }`,
		`- Mode: ${ offscreenSceneLinearTarget.mode }`,
		`- Type: ${ offscreenSceneLinearTarget.type }`,
		`- Masked wrong-side: ${ offscreenSceneLinearTarget.maskedWrongSideColorRatio ?? 'n/a' }`,
		`- Masked correct bounce: ${ offscreenSceneLinearTarget.maskedCorrectBounceRatio ?? 'n/a' }`,
		`- Luminance wrong/correct: ${ offscreenSceneLinearTarget.luminanceWrongOverCorrect ?? 'n/a' }`,
		`- Energy wrong/correct: ${ offscreenSceneLinearTarget.energyWrongOverCorrect ?? 'n/a' }`,
		`- Contribution isolation: ${ offscreenSceneLinearContributionSummary.status } (${ offscreenSceneLinearContributionSummary.mode })`,
		`- Contribution deltas: direct-vs-ambient ${ offscreenSceneLinearContributionSummary.directAmbientMaskedDelta ?? 'n/a' }, probes-vs-direct+probes ${ offscreenSceneLinearContributionSummary.probesDirectPlusMaskedDelta ?? 'n/a' }`,
		`- Contribution conclusion: ${ offscreenSceneLinearContributionSummary.diagnosticConclusion }`,
		`- Contribution warnings: ${ offscreenSceneLinearContributionSummary.warnings?.length > 0 ? offscreenSceneLinearContributionSummary.warnings.join( ' / ' ) : 'none' }`,
		`- Neutral receiver contribution isolation: ${ offscreenSceneLinearNeutralContributionSummary.status } (${ offscreenSceneLinearNeutralContributionSummary.mode })`,
		`- Contribution gate: ${ offscreenSceneLinearContributionGate.status } (${ offscreenSceneLinearContributionGate.mode })`,
		`- Contribution gate thresholds: wrong <= ${ offscreenSceneLinearContributionGate.thresholds.neutralProbesOnlyWrongSideMax ?? 'n/a' }, correct >= ${ offscreenSceneLinearContributionGate.thresholds.neutralProbesOnlyCorrectBounceMin ?? 'n/a' }, chroma <= ${ offscreenSceneLinearContributionGate.thresholds.neutralChromaticityWrongSidePressureMax ?? 'n/a' }`,
		`- Neutral-vs-original probe delta: ${ offscreenSceneLinearContributionGate.neutralVsOriginalProbeDelta ?? 'n/a' }`,
		`- Contribution gate warnings: ${ offscreenSceneLinearContributionGate.warnings?.length > 0 ? offscreenSceneLinearContributionGate.warnings.join( ' / ' ) : 'none' }`,
		`- GPU-read visible-pixel CPU mirror: ${ visiblePixelCpuMirrorStudy?.status ?? 'n/a' } source ${ visiblePixelCpuMirrorStudy?.summary?.dominantMismatchSource ?? 'n/a' } samples ${ visiblePixelCpuMirrorStudy?.summary?.sampleCount ?? 'n/a' } delta mean ${ visiblePixelCpuMirrorStudy?.summary?.cpuGpuWrongSideRatioDeltaMean ?? 'n/a' } delta max ${ visiblePixelCpuMirrorStudy?.summary?.cpuGpuWrongSideRatioDeltaMax ?? 'n/a' }`,
		'',
		'| Contribution | Albedo | Status | Direct | Ambient | Probe | Masked wrong-side | Correct bounce | Chroma pressure | Max-channel wrong/correct | Luminance wrong/correct | Energy wrong/correct |',
		'|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'
	);

	for ( const row of [ ...offscreenSceneLinearContributionRows, ...offscreenSceneLinearNeutralContributionRows ] ) {

		lines.push( [
			row.label,
			row.receiverAlbedoMode ?? 'n/a',
			row.status,
			row.lighting?.directIntensity ?? 'n/a',
			row.lighting?.ambientIntensity ?? 'n/a',
			row.lighting?.probeIntensity ?? 'n/a',
			row.maskedWrongSideColorRatio ?? 'n/a',
			row.maskedCorrectBounceRatio ?? 'n/a',
			row.chromaticityWrongSidePressure ?? 'n/a',
			row.maxChannelWrongOverCorrect ?? 'n/a',
			row.luminanceWrongOverCorrect ?? 'n/a',
			row.energyWrongOverCorrect ?? 'n/a'
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

}
