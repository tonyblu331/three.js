export function appendLightProbeProofProbeDiagnosticsMarkdown( lines, report ) {

	const sealedShContributionDiagnostic = report.currentEvidence.sealedShContributionDiagnostic;
	const probeContentChromaStudy = report.currentEvidence.probeContentChromaStudy;
	const probeBakeContaminationMap = report.currentEvidence.probeBakeContaminationMap;
	const dominantProbeCoefficientStudy = probeBakeContaminationMap.dominantProbeCoefficientStudy;
	const shDampingOracleStudy = probeBakeContaminationMap.shDampingOracleStudy;
	const dominantProbePlacementStudy = probeBakeContaminationMap.dominantProbePlacementStudy;
	const combinedSourceDampingOracleStudy = probeBakeContaminationMap.combinedSourceDampingOracleStudy;
	const dilationSourceQualityStudy = probeBakeContaminationMap.dilationSourceQualityStudy;
	const sameSideLayerMaskOracleStudy = probeBakeContaminationMap.sameSideLayerMaskOracleStudy;
	const sdfStaticBlockerOracleStudy = probeBakeContaminationMap.sdfStaticBlockerOracleStudy;
	const aggregateBakePolicyOracleStudy = probeBakeContaminationMap.aggregateBakePolicyOracleStudy;
	const probeDensityMetricStudy = sealedShContributionDiagnostic.probeDensityMetricStudy;
	const sealedRenderMetricMismatch = report.currentEvidence.sealedRenderMetricMismatch;
	const presentation = sealedRenderMetricMismatch.presentation;

	lines.push(
		'',
		'### Sealed-wall packed SH contribution interrogation',
		`- Status: ${ sealedShContributionDiagnostic.status }`,
		`- Suspected failure domain: ${ sealedShContributionDiagnostic.suspectedFailureDomain }`,
		`- Scalar wrong/correct mean: ${ sealedShContributionDiagnostic.summary.scalarWrongRatioMean }`,
		`- Visibility wrong/correct mean: ${ sealedShContributionDiagnostic.summary.visibilityWrongRatioMean }`,
		`- Runtime final wrong/correct mean: ${ sealedShContributionDiagnostic.summary.runtimeWrongRatioMean }`,
		`- Runtime wrong-ratio improvement mean: ${ sealedShContributionDiagnostic.summary.runtimeWrongRatioImprovementMean }`,
		`- Correct-side mixed-color rows: ${ sealedShContributionDiagnostic.summary.correctSideMixedColorRowCount } / ${ sealedShContributionDiagnostic.summary.correctSideVisibilityRowCount }`,
		`- Weighted correct-side wrong/correct mean: ${ sealedShContributionDiagnostic.summary.weightedCorrectSideWrongOverCorrectMean }`,
		`- Wrong-side escaped probes at weighting layer: ${ sealedShContributionDiagnostic.summary.wrongSideEscapedProbeCount }`,
		`- Directional suppression supported: ${ sealedShContributionDiagnostic.summary.directionalSuppressionSupported }`,
		`- Baked SH mixed-color suspected: ${ sealedShContributionDiagnostic.summary.bakedShMixedColorSuspected }`,
		`- Render metric mismatch status: ${ sealedRenderMetricMismatch.status }`,
		`- Render metric bounds wrong-side ratio: ${ sealedRenderMetricMismatch.actualWrongSideColorRatio }`,
		`- Render metric center wrong-side ratio: ${ sealedRenderMetricMismatch.centerWrongSideColorRatio }`,
		`- Render metric surface-isolated wrong-side ratio: ${ sealedRenderMetricMismatch.surfaceWrongSideColorRatio }`,
		`- Render metric masked visible-pixel wrong-side ratio: ${ sealedRenderMetricMismatch.maskedWrongSideColorRatio }`,
		`- CPU SH mirror runtime wrong ratio: ${ sealedRenderMetricMismatch.cpuRuntimeWrongRatioMean }`,
		`- CPU receiver-surface quadrature runtime wrong ratio: ${ sealedRenderMetricMismatch.cpuSurfaceRuntimeWrongRatioMean }`,
		`- CPU receiver-surface quadrature runtime wrong ratio max: ${ sealedRenderMetricMismatch.cpuSurfaceRuntimeWrongRatioMax }`,
		`- CPU receiver-surface quadrature rule: ${ sealedRenderMetricMismatch.cpuSurfaceQuadratureRule }`,
		`- CPU SH mirror inverted-normal wrong ratio: ${ sealedRenderMetricMismatch.cpuInvertedNormalRuntimeWrongRatioMean }`,
		`- Render/CPU wrong-ratio delta: ${ sealedRenderMetricMismatch.delta }`,
		`- Center/CPU wrong-ratio delta: ${ sealedRenderMetricMismatch.centerDelta }`,
		`- Surface/CPU wrong-ratio delta: ${ sealedRenderMetricMismatch.surfaceDelta }`,
		`- Surface/quadrature-CPU wrong-ratio delta: ${ sealedRenderMetricMismatch.surfaceQuadratureDelta } (mean ${ sealedRenderMetricMismatch.surfaceQuadratureDeltaMean }, max ${ sealedRenderMetricMismatch.surfaceQuadratureDeltaMax }, aggregation ${ sealedRenderMetricMismatch.surfaceQuadratureCpuRenderAgreementAggregation })`,
		`- Masked/quadrature-CPU wrong-ratio delta: mean ${ sealedRenderMetricMismatch.maskedQuadratureDeltaMean }, max ${ sealedRenderMetricMismatch.maskedQuadratureDeltaMax }, mode ${ sealedRenderMetricMismatch.maskedReceiverRegionMetricMode }`,
		`- Surface quadrature gate: ${ sealedRenderMetricMismatch.surfaceQuadratureCpuRenderAgreementGate } (${ sealedRenderMetricMismatch.surfaceQuadratureStatus })`,
		`- GPU debug gate: ${ sealedRenderMetricMismatch.gpuDebugStatus } (best region ${ sealedRenderMetricMismatch.gpuDebugBestVariant } scale ${ sealedRenderMetricMismatch.gpuDebugBestScale } delta ${ sealedRenderMetricMismatch.gpuDebugBestSurfaceCpuDelta } aggregation ${ sealedRenderMetricMismatch.gpuDebugBestSurfaceCpuAggregation })`,
		`- GPU debug tight-point best: ${ sealedRenderMetricMismatch.gpuDebugBestTightPointVariant } scale ${ sealedRenderMetricMismatch.gpuDebugBestTightPointScale } ratio ${ sealedRenderMetricMismatch.gpuDebugBestTightPointSurfaceWrongRatio } max ${ sealedRenderMetricMismatch.gpuDebugBestTightPointSurfaceWrongRatioMax } delta ${ sealedRenderMetricMismatch.gpuDebugBestTightPointSurfaceCpuDelta } aggregation ${ sealedRenderMetricMismatch.gpuDebugBestTightPointCpuAggregation } mode ${ sealedRenderMetricMismatch.gpuDebugAgreementMode }`,
		`- GPU debug weight-term best: ${ sealedRenderMetricMismatch.gpuDebugBestWeightTermVariant } term ${ sealedRenderMetricMismatch.gpuDebugBestWeightTerm } cpu ${ sealedRenderMetricMismatch.gpuDebugBestWeightTermCpuKey } scale ${ sealedRenderMetricMismatch.gpuDebugBestWeightTermScale } delta mean ${ sealedRenderMetricMismatch.gpuDebugBestWeightTermDeltaMean } delta max ${ sealedRenderMetricMismatch.gpuDebugBestWeightTermDeltaMax } gate ${ sealedRenderMetricMismatch.gpuDebugWeightTermAgreementGate } mode ${ sealedRenderMetricMismatch.gpuDebugWeightTermAgreementMode }`,
		`- GPU debug linear irradiance best: ${ sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceTermVariant } term ${ sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceTerm } cpu ${ sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceCpuKey } scale ${ sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceTermScale } linear RGB delta mean ${ sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceDeltaMean } delta max ${ sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceDeltaMax } clipped samples ${ sealedRenderMetricMismatch.gpuDebugBestLinearIrradianceClippedSampleCount } gate ${ sealedRenderMetricMismatch.gpuDebugLinearIrradianceAgreementGate } mode ${ sealedRenderMetricMismatch.gpuDebugLinearIrradianceAgreementMode }`,
		`- Receiver-pixel parity: ${ sealedRenderMetricMismatch.receiverPixelParityStatus } source ${ sealedRenderMetricMismatch.receiverPixelParityDominantMismatchSource } mask ${ sealedRenderMetricMismatch.receiverPixelParityMaskOcclusionPolicy ?? 'n/a' } legacy-mask delta ${ sealedRenderMetricMismatch.receiverPixelParityLegacyMaskWrongSideDelta ?? 'n/a' }`,
		`- GPU-read visible-pixel CPU mirror: ${ sealedRenderMetricMismatch.visiblePixelCpuMirrorStatus ?? 'n/a' } source ${ sealedRenderMetricMismatch.visiblePixelCpuMirrorDominantMismatchSource ?? 'n/a' } samples ${ sealedRenderMetricMismatch.visiblePixelCpuMirrorStudy?.summary?.sampleCount ?? 'n/a' } delta mean ${ sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.visiblePixelMirrorStatus === null ? 'n/a' : sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.deltaMean } delta max ${ sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.visiblePixelMirrorStatus === null ? 'n/a' : sealedRenderMetricMismatch.presentation.probeIndirectCpuAgreement.deltaMax }`,
		`- GPU debug comparable variants: ${ sealedRenderMetricMismatch.gpuDebugComparableVariantCount }`,
		`- GPU debug linear-irradiance variants: ${ sealedRenderMetricMismatch.gpuDebugLinearIrradianceTermVariantCount }`,
		`- GPU debug weight-term variants: ${ sealedRenderMetricMismatch.gpuDebugWeightTermVariantCount }`,
		`- GPU debug white calibration luminance: ${ sealedRenderMetricMismatch.gpuDebugWhiteCalibrationLuminanceMean } (visible=${ sealedRenderMetricMismatch.gpuDebugWhiteCalibrationVisible })`,
		`- Presentation gate: ${ presentation.gate }`,
		`- Presentation masked ratios: standard ${ presentation.maskedRatios.standard }, raw-debug ${ presentation.maskedRatios.debug }, no-tone ${ presentation.maskedRatios.noToneMapping }, linear-output ${ presentation.maskedRatios.linearOutput }, lambert-debug ${ presentation.maskedRatios.lambertDebug }`,
		`- Presentation deltas: standard-vs-debug masked ${ presentation.deltas.standardVsDebugMasked }, tone-mapping masked ${ presentation.deltas.toneMappingMasked }, output-color masked ${ presentation.deltas.outputColorSpaceMasked }, exposure masked ${ presentation.deltas.exposureMasked }, lambert-vs-standard-linear masked ${ presentation.deltas.lambertVsStandardLinearMasked }, renderer ${ presentation.renderer.currentToneMapping } / ${ presentation.renderer.outputColorSpace }`,
		`- Offscreen scene-linear target: ${ presentation.offscreen.target.status } mode ${ presentation.offscreen.target.mode } masked wrong-side ${ presentation.offscreen.target.maskedWrongSideColorRatio ?? 'n/a' } correct bounce ${ presentation.offscreen.target.maskedCorrectBounceRatio ?? 'n/a' }`,
		`- Offscreen contribution isolation: ${ presentation.offscreen.contributionSummary.status } dominant ${ presentation.offscreen.contributionSummary.dominantWrongSideLabel ?? 'n/a' } wrong-side ${ presentation.offscreen.contributionSummary.dominantWrongSideColorRatio ?? 'n/a' }`,
		`- Offscreen contribution deltas: direct-vs-ambient ${ presentation.offscreen.contributionSummary.directAmbientMaskedDelta ?? 'n/a' }, probes-vs-direct+probes ${ presentation.offscreen.contributionSummary.probesDirectPlusMaskedDelta ?? 'n/a' }`,
		`- Neutral receiver contribution gate: ${ presentation.offscreen.contributionGate.status } neutral probe wrong ${ presentation.offscreen.contributionGate.neutralProbesOnly?.maskedWrongSideColorRatio ?? 'n/a' } chroma pressure ${ presentation.offscreen.contributionGate.neutralProbesOnly?.chromaticityWrongSidePressure ?? 'n/a' }`,
		`- CPU/render agreement gate: ${ sealedRenderMetricMismatch.cpuRenderAgreementGate } (best ${ sealedRenderMetricMismatch.bestCpuRenderMetricAgreement.metric } delta ${ sealedRenderMetricMismatch.bestCpuRenderMetricAgreement.delta }, tolerance ${ sealedRenderMetricMismatch.cpuRenderAgreementTolerance })`,
		`- Center/inverted-normal wrong-ratio delta: ${ sealedRenderMetricMismatch.invertedNormalCenterDelta }`,
		`- Normal convention pressure: ${ sealedRenderMetricMismatch.normalConventionPressure }`,
		`- Normal convention diagnostic: ${ sealedRenderMetricMismatch.normalConventionDiagnosticStatus } (cleared=${ sealedRenderMetricMismatch.normalConventionCleared })`,
		`- Region metric mode: ${ sealedRenderMetricMismatch.regionMetricMode }`,
		'',
		'| Receiver | Scalar wrong/correct | Visibility wrong/correct | Runtime final wrong/correct | Inverted-normal final wrong/correct | Correct-only visibility wrong/correct | Wrong visibility weight |',
		'|---|---:|---:|---:|---:|---:|---:|'
	);

	for ( const receiver of [ sealedShContributionDiagnostic.left, sealedShContributionDiagnostic.right ] ) {

		lines.push( [
			receiver.label,
			receiver.aggregates.scalar.colorBias.wrongOverCorrect,
			receiver.aggregates.visibility.colorBias.wrongOverCorrect,
			receiver.aggregates.runtimeFinal.colorBias.wrongOverCorrect,
			receiver.aggregates.invertedNormalRuntimeFinal.colorBias.wrongOverCorrect,
			receiver.aggregates.correctVisibilityOnly.colorBias.wrongOverCorrect,
			receiver.aggregates.wrongVisibilityOnly.totalWeight
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Probe Content Chroma Study',
		`- Status: ${ probeContentChromaStudy.status }`,
		`- Boundary: ${ probeContentChromaStudy.proofBoundary }`,
		`- Max correct-side chroma pressure: ${ probeContentChromaStudy.summary.maxCorrectSideChromaPressure }`,
		`- Max runtime-final chroma pressure: ${ probeContentChromaStudy.summary.maxRuntimeFinalChromaPressure }`,
		`- Weighted correct-side chroma pressure mean: ${ probeContentChromaStudy.summary.weightedCorrectSideChromaPressureMean }`,
		`- Invalid neighbor rows: ${ probeContentChromaStudy.summary.invalidNeighborCount }`,
		`- Dilated source rows: ${ probeContentChromaStudy.summary.dilatedSourceRowCount }`,
		`- Interpretation: ${ probeContentChromaStudy.summary.interpretation }`,
		'',
		'| Receiver | Correct side | Rows | Correct-side rows | Invalid rows | Dilated source rows | Weighted correct chroma | Max correct chroma | Runtime chroma pressure | Dominant probe | Source probe | Source changed | Dominant L0 wrong/correct |',
		'|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'
	);

	for ( const receiver of probeContentChromaStudy.receivers ) {

		lines.push( [
			receiver.label,
			receiver.correctSide,
			receiver.rowCount,
			receiver.correctSideVisibilityRowCount,
			receiver.invalidNeighborCount,
			receiver.dilatedSourceRowCount,
			receiver.weightedCorrectSideVisibilityChromaPressureMean,
			receiver.maxCorrectSideChromaPressure,
			receiver.runtimeFinalChromaPressure.wrongMinusCorrect,
			receiver.dominantCorrectSideProbe?.probeIndex ?? 'n/a',
			receiver.dominantCorrectSideProbe?.sourceProbeIndex ?? 'n/a',
			receiver.dominantCorrectSideProbe?.dilationSourceDiffers ?? 'n/a',
			receiver.dominantCorrectSideProbe?.l0ColorBias?.wrongOverCorrect ?? 'n/a'
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Probe Bake Contamination Map',
		`- Status: ${ probeBakeContaminationMap.status }`,
		`- Boundary: ${ probeBakeContaminationMap.proofBoundary }`,
		`- Unique probes: ${ probeBakeContaminationMap.summary.uniqueProbeCount }`,
		`- Invalid probes: ${ probeBakeContaminationMap.summary.invalidProbeCount }`,
		`- Dilation source changes: ${ probeBakeContaminationMap.summary.dilationSourceChangedCount }`,
		`- Blocked opposite-wall visibility bypasses: ${ probeBakeContaminationMap.summary.blockedOppositeWallVisibilityBypassCount }`,
		`- Receiver directional chroma probes: ${ probeBakeContaminationMap.summary.receiverDirectionalChromaProbeCount }`,
		`- Blocked-wall directional chroma probes: ${ probeBakeContaminationMap.summary.blockedWallDirectionalChromaProbeCount }`,
		`- Band responsibility counts: L0 ${ probeBakeContaminationMap.summary.l0DominantProbeCount }, L1 ${ probeBakeContaminationMap.summary.l1DominantProbeCount }, L2 ${ probeBakeContaminationMap.summary.l2DominantProbeCount }`,
		`- Max correct-receiver chroma pressure: ${ probeBakeContaminationMap.summary.maxCorrectReceiverChromaPressure }`,
		`- Max correct-receiver L0+L1 chroma pressure: ${ probeBakeContaminationMap.summary.maxCorrectReceiverL0L1ChromaPressure }`,
		`- Max correct-receiver L1 chroma delta: ${ probeBakeContaminationMap.summary.maxCorrectReceiverL1ChromaDelta }`,
		`- Max correct-receiver L2 chroma delta: ${ probeBakeContaminationMap.summary.maxCorrectReceiverL2ChromaDelta }`,
		`- Max blocked-opposite-wall chroma pressure: ${ probeBakeContaminationMap.summary.maxBlockedOppositeWallChromaPressure }`,
		`- Dominant probe: ${ probeBakeContaminationMap.summary.dominantProbeIndex } (${ probeBakeContaminationMap.summary.dominantProbeClassification }, band ${ probeBakeContaminationMap.summary.dominantProbeBandResponsibility })`,
		`- Interpretation: ${ probeBakeContaminationMap.summary.interpretation }`,
		'',
		'| Probe | Side | Source | Source side | Validity | Classification | Band | Appearances | Correct appearances | Max receiver chroma | L0+L1 chroma | L1 delta | L2 delta | Blocked-wall chroma | Same-side wall chroma | Blocked wall intersects divider | Blocked wall reason |',
		'|---:|---|---:|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|'
	);

	for ( const row of probeBakeContaminationMap.rows.slice( 0, 12 ) ) {

		lines.push( [
			row.probeIndex,
			row.side,
			row.sourceProbeIndex,
			row.sourceSide,
			row.validity,
			row.classification,
			row.bandResponsibility,
			row.appearanceCount,
			row.correctSideAppearanceCount,
			row.maxCorrectReceiverChromaPressure,
			row.maxCorrectReceiverL0L1ChromaPressure,
			row.maxCorrectReceiverL1ChromaDelta,
			row.maxCorrectReceiverL2ChromaDelta,
			row.blockedOppositeWallChromaPressure,
			row.sameSideWallChromaPressure,
			row.wallVisibility.blockedOppositeWall.segmentIntersectsDivider,
			row.wallVisibility.blockedOppositeWall.dividerAuditReason
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Dominant Probe Coefficient / Lobe Study',
		`- Status: ${ dominantProbeCoefficientStudy.status }`,
		`- Boundary: ${ dominantProbeCoefficientStudy.proofBoundary }`,
		`- Candidate probes: ${ dominantProbeCoefficientStudy.summary.candidateProbeCount }`,
		`- Contexts: ${ dominantProbeCoefficientStudy.summary.contextCount }`,
		`- Dominant probe/context: ${ dominantProbeCoefficientStudy.summary.dominantProbeIndex } / ${ dominantProbeCoefficientStudy.summary.dominantContextKind }`,
		`- Dominant coefficient: ${ dominantProbeCoefficientStudy.summary.dominantCoefficientName } (${ dominantProbeCoefficientStudy.summary.dominantCoefficientBand }, wrong-minus-correct ${ dominantProbeCoefficientStudy.summary.dominantCoefficientWrongMinusCorrect })`,
		`- Interpretation: ${ dominantProbeCoefficientStudy.summary.interpretation }`,
		'',
		'| Probe | Classification | Context | Context band | Full chroma | Coeff | Coeff band | Basis | Basis scale | Raw coeff RGB | Contribution RGB | Wrong-minus-correct |',
		'|---:|---|---|---|---:|---|---|---|---:|---|---|---:|'
	);

	for ( const row of dominantProbeCoefficientStudy.rows ) {

		for ( const context of row.contexts ) {

			for ( const coefficient of context.topCoefficientRows.slice( 0, 3 ) ) {

				lines.push( [
					row.probeIndex,
					row.classification,
					context.contextKind,
					context.bandResponsibility,
					context.fullChromaPressure,
					coefficient.name,
					coefficient.band,
					coefficient.basis,
					coefficient.basisScale,
					`${ coefficient.rawCoefficient.r }/${ coefficient.rawCoefficient.g }/${ coefficient.rawCoefficient.b }`,
					`${ coefficient.contribution.r }/${ coefficient.contribution.g }/${ coefficient.contribution.b }`,
					coefficient.wrongMinusCorrect
				].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

			}

		}

	}

	lines.push(
		'',
		'### SH Damping Oracle Study',
		`- Status: ${ shDampingOracleStudy.status }`,
		`- Boundary: ${ shDampingOracleStudy.proofBoundary }`,
		`- Context rows: ${ shDampingOracleStudy.summary.contextCount }`,
		`- Receiver rows: ${ shDampingOracleStudy.summary.receiverCount }`,
		`- Safe wins: ${ shDampingOracleStudy.summary.safeWinCount } (context ${ shDampingOracleStudy.summary.safeContextWinCount }, receiver ${ shDampingOracleStudy.summary.safeReceiverWinCount })`,
		`- Best safe variant: ${ shDampingOracleStudy.summary.bestSafeVariant } (${ shDampingOracleStudy.summary.bestSafeScope }, probe ${ shDampingOracleStudy.summary.bestSafeProbeIndex }, improvement ${ shDampingOracleStudy.summary.bestSafeChromaImprovement }, preservation ${ shDampingOracleStudy.summary.bestSafeCorrectChannelPreservation })`,
		`- Interpretation: ${ shDampingOracleStudy.summary.interpretation }`,
		'',
		'| Scope | Probe/receiver | Context | Baseline chroma | Best variant | Improvement | Correct preservation | Energy preservation |',
		'|---|---|---|---:|---|---:|---:|---:|'
	);

	for ( const row of shDampingOracleStudy.contextRows ) {

		lines.push( [
			'context',
			row.probeIndex,
			row.contextKind,
			row.baselineFullChromaPressure,
			row.bestVariantLabel,
			row.bestVariantImprovement,
			row.bestVariantCorrectChannelPreservation,
			row.bestVariantEnergyPreservation
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	for ( const row of shDampingOracleStudy.receiverRows ) {

		lines.push( [
			'receiver',
			row.receiver,
			row.correctSide,
			row.baselineFullChromaPressure,
			row.bestVariantLabel,
			row.bestVariantImprovement,
			row.bestVariantCorrectChannelPreservation,
			'n/a'
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'| Oracle variant scope | Label | Mode | Target indices | Full chroma | Improvement | Correct preservation | Negative energy | Clamp energy loss |',
		'|---|---|---|---|---:|---:|---:|---:|---:|'
	);

	for ( const row of shDampingOracleStudy.contextRows.slice( 0, 4 ) ) {

		for ( const variant of row.rows ) {

			lines.push( [
				`${ row.probeIndex }/${ row.contextKind }`,
				variant.label,
				variant.mode,
				variant.targetIndices.join( ',' ),
				variant.fullChromaPressure,
				variant.chromaImprovement,
				variant.correctChannelPreservation,
				variant.negativeEnergy,
				variant.clampEnergyLoss
			].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

		}

	}

	lines.push(
		'',
		'### Dominant Probe Placement / Source Oracle',
		`- Status: ${ dominantProbePlacementStudy.status }`,
		`- Boundary: ${ dominantProbePlacementStudy.proofBoundary }`,
		`- Candidate probes: ${ dominantProbePlacementStudy.summary.candidateProbeCount }`,
		`- Context rows: ${ dominantProbePlacementStudy.summary.contextCount }`,
		`- Receiver rows: ${ dominantProbePlacementStudy.summary.receiverCount }`,
		`- Safe context wins: ${ dominantProbePlacementStudy.summary.safeContextWinCount }`,
		`- Safe receiver wins: ${ dominantProbePlacementStudy.summary.safeReceiverWinCount }`,
		`- Best safe candidate: ${ dominantProbePlacementStudy.summary.bestSafeCandidate } (${ dominantProbePlacementStudy.summary.bestSafeScope }, probe ${ dominantProbePlacementStudy.summary.bestSafeProbeIndex }, chroma ${ dominantProbePlacementStudy.summary.bestSafeChromaImprovement }, wrong-ratio ${ dominantProbePlacementStudy.summary.bestSafeWrongRatioImprovement }, preservation ${ dominantProbePlacementStudy.summary.bestSafeCorrectChannelPreservation })`,
		`- Interpretation: ${ dominantProbePlacementStudy.summary.interpretation }`,
		'',
		'| Scope | Probe/receiver | Context | Baseline chroma | Baseline wrong/correct | Best candidate | Source | Chroma improvement | Wrong-ratio improvement | Correct preservation |',
		'|---|---|---|---:|---:|---|---:|---:|---:|---:|'
	);

	for ( const row of dominantProbePlacementStudy.contextRows ) {

		lines.push( [
			'context',
			row.probeIndex,
			row.contextKind,
			row.baselineFullChromaPressure,
			row.baselineWrongOverCorrect,
			row.bestCandidateLabel,
			row.bestCandidateSourceProbeIndex,
			row.bestCandidateChromaImprovement,
			row.bestCandidateWrongRatioImprovement,
			row.bestCandidateCorrectChannelPreservation
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	for ( const row of dominantProbePlacementStudy.receiverRows ) {

		lines.push( [
			'receiver',
			row.receiver,
			row.correctSide,
			row.baselineFullChromaPressure,
			row.baselineWrongOverCorrect,
			row.bestCandidateLabel,
			'n/a',
			row.bestCandidateChromaImprovement,
			row.bestCandidateWrongRatioImprovement,
			row.bestCandidateCorrectChannelPreservation
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'| Placement variant scope | Label | Source | Side | Validity | Full chroma | Wrong/correct | Chroma improvement | Wrong-ratio improvement | Correct preservation | Reason |',
		'|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|'
	);

	for ( const row of dominantProbePlacementStudy.contextRows.slice( 0, 4 ) ) {

		for ( const candidate of row.rows ) {

			lines.push( [
				`${ row.probeIndex }/${ row.contextKind }`,
				candidate.label,
				candidate.sourceProbeIndex,
				candidate.sourceSide,
				candidate.validity,
				candidate.fullChromaPressure,
				candidate.colorBias.wrongOverCorrect,
				candidate.chromaImprovement,
				candidate.wrongRatioImprovement,
				candidate.correctChannelPreservation,
				candidate.reason
			].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

		}

	}

	lines.push(
		'',
		'### Combined Source + SH Damping Oracle',
		`- Status: ${ combinedSourceDampingOracleStudy.status }`,
		`- Boundary: ${ combinedSourceDampingOracleStudy.proofBoundary }`,
		`- Candidate probes: ${ combinedSourceDampingOracleStudy.summary.candidateProbeCount }`,
		`- Context rows: ${ combinedSourceDampingOracleStudy.summary.contextCount }`,
		`- Receiver rows: ${ combinedSourceDampingOracleStudy.summary.receiverCount }`,
		`- Safe context wins: ${ combinedSourceDampingOracleStudy.summary.safeContextWinCount }`,
		`- Safe receiver wins: ${ combinedSourceDampingOracleStudy.summary.safeReceiverWinCount }`,
		`- Best safe combination: source ${ combinedSourceDampingOracleStudy.summary.bestSafeSource } + variant ${ combinedSourceDampingOracleStudy.summary.bestSafeVariant } (${ combinedSourceDampingOracleStudy.summary.bestSafeScope }, probe ${ combinedSourceDampingOracleStudy.summary.bestSafeProbeIndex }, chroma ${ combinedSourceDampingOracleStudy.summary.bestSafeChromaImprovement }, wrong-ratio ${ combinedSourceDampingOracleStudy.summary.bestSafeWrongRatioImprovement }, preservation ${ combinedSourceDampingOracleStudy.summary.bestSafeCorrectChannelPreservation })`,
		`- Interpretation: ${ combinedSourceDampingOracleStudy.summary.interpretation }`,
		'',
		'| Scope | Probe/receiver | Context | Baseline chroma | Baseline wrong/correct | Best source | Best variant | Chroma improvement | Wrong-ratio improvement | Correct preservation |',
		'|---|---|---|---:|---:|---|---|---:|---:|---:|'
	);

	for ( const row of combinedSourceDampingOracleStudy.contextRows ) {

		lines.push( [
			'context',
			row.probeIndex,
			row.contextKind,
			row.baselineFullChromaPressure,
			row.baselineWrongOverCorrect,
			row.bestSourceLabel,
			row.bestVariantLabel,
			row.bestChromaImprovement,
			row.bestWrongRatioImprovement,
			row.bestCorrectChannelPreservation
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	for ( const row of combinedSourceDampingOracleStudy.receiverRows ) {

		lines.push( [
			'receiver',
			row.receiver,
			row.correctSide,
			row.baselineFullChromaPressure,
			row.baselineWrongOverCorrect,
			row.bestSourceLabel,
			row.bestVariantLabel,
			row.bestChromaImprovement,
			row.bestWrongRatioImprovement,
			row.bestCorrectChannelPreservation
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'| Combined variant scope | Source | Variant | Source probe | Full chroma | Wrong/correct | Chroma improvement | Wrong-ratio improvement | Correct preservation | Target indices |',
		'|---|---|---|---:|---:|---:|---:|---:|---:|---|'
	);

	for ( const row of combinedSourceDampingOracleStudy.contextRows.slice( 0, 4 ) ) {

		for ( const candidate of row.rows.slice( 0, 12 ) ) {

			lines.push( [
				`${ row.probeIndex }/${ row.contextKind }`,
				candidate.sourceLabel,
				candidate.variantLabel,
				candidate.sourceProbeIndex,
				candidate.fullChromaPressure,
				candidate.colorBias.wrongOverCorrect,
				candidate.chromaImprovement,
				candidate.wrongRatioImprovement,
				candidate.correctChannelPreservation,
				candidate.targetIndices.join( ',' )
			].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

		}

	}

	lines.push(
		'',
		'### Dilation Source Quality Study',
		`- Status: ${ dilationSourceQualityStudy.status }`,
		`- Boundary: ${ dilationSourceQualityStudy.proofBoundary }`,
		`- Audited probes: ${ dilationSourceQualityStudy.summary.auditedProbeCount }`,
		`- Changed sources: ${ dilationSourceQualityStudy.summary.changedSourceCount }`,
		`- Side mismatches: ${ dilationSourceQualityStudy.summary.sideMismatchCount }`,
		`- Invalid dilation sources: ${ dilationSourceQualityStudy.summary.invalidDilationSourceCount }`,
		`- Non-nearest same-side-valid sources: ${ dilationSourceQualityStudy.summary.notNearestSameSideValidCount }`,
		`- Metric context probes: ${ dilationSourceQualityStudy.summary.metricContextProbeCount }`,
		`- Safe context wins: ${ dilationSourceQualityStudy.summary.safeContextWinCount }`,
		`- Best safe candidate: ${ dilationSourceQualityStudy.summary.bestSafeCandidate } (probe ${ dilationSourceQualityStudy.summary.bestSafeProbeIndex }, chroma ${ dilationSourceQualityStudy.summary.bestSafeChromaImprovement }, wrong-ratio ${ dilationSourceQualityStudy.summary.bestSafeWrongRatioImprovement }, preservation ${ dilationSourceQualityStudy.summary.bestSafeCorrectChannelPreservation })`,
		`- Interpretation: ${ dilationSourceQualityStudy.summary.interpretation }`,
		'',
		'| Probe | Side | Current source | Source side | Changed | Same-side | Valid source | Nearest same-side valid | Equals nearest | Best candidate | Chroma improvement | Wrong-ratio improvement | Correct preservation |',
		'|---:|---|---:|---|---|---|---|---:|---|---|---:|---:|---:|'
	);

	for ( const row of dilationSourceQualityStudy.rows.slice( 0, 12 ) ) {

		lines.push( [
			row.probeIndex,
			row.side,
			row.sourceProbeIndex,
			row.sourceSide,
			row.sourceDiffers,
			row.dilationSourceSameSide,
			row.dilationSourceValid,
			row.nearestSameSideValidProbeIndex,
			row.dilationSourceEqualsNearestSameSideValid,
			row.bestCandidateLabel,
			row.bestCandidateChromaImprovement,
			row.bestCandidateWrongRatioImprovement,
			row.bestCandidateCorrectChannelPreservation
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Same-side / Layer Mask Oracle',
		`- Status: ${ sameSideLayerMaskOracleStudy.status }`,
		`- Boundary: ${ sameSideLayerMaskOracleStudy.proofBoundary }`,
		`- Receiver rows: ${ sameSideLayerMaskOracleStudy.summary.receiverCount }`,
		`- Safe receiver wins: ${ sameSideLayerMaskOracleStudy.summary.safeReceiverWinCount }`,
		`- Removed wrong-side weight: ${ sameSideLayerMaskOracleStudy.summary.totalRemovedWrongSideWeight }`,
		`- Best safe candidate: ${ sameSideLayerMaskOracleStudy.summary.bestSafeCandidate } (${ sameSideLayerMaskOracleStudy.summary.bestSafeReceiver }, chroma ${ sameSideLayerMaskOracleStudy.summary.bestSafeChromaImprovement }, wrong-ratio ${ sameSideLayerMaskOracleStudy.summary.bestSafeWrongRatioImprovement }, preservation ${ sameSideLayerMaskOracleStudy.summary.bestSafeCorrectChannelPreservation })`,
		`- Interpretation: ${ sameSideLayerMaskOracleStudy.summary.interpretation }`,
		'',
		'| Receiver | Baseline chroma | Baseline wrong/correct | Correct weight | Removed wrong weight | Best candidate | Chroma improvement | Wrong-ratio improvement | Correct preservation |',
		'|---|---:|---:|---:|---:|---|---:|---:|---:|'
	);

	for ( const row of sameSideLayerMaskOracleStudy.receiverRows ) {

		lines.push( [
			row.receiver,
			row.baselineFullChromaPressure,
			row.baselineWrongOverCorrect,
			row.correctVisibilityWeight,
			row.removedWrongSideWeight,
			row.bestCandidateLabel,
			row.bestCandidateChromaImprovement,
			row.bestCandidateWrongRatioImprovement,
			row.bestCandidateCorrectChannelPreservation
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### SDF / Static Blocker Oracle',
		`- Status: ${ sdfStaticBlockerOracleStudy.status }`,
		`- Boundary: ${ sdfStaticBlockerOracleStudy.proofBoundary }`,
		`- Receiver rows: ${ sdfStaticBlockerOracleStudy.summary.receiverCount }`,
		`- Probe rows: ${ sdfStaticBlockerOracleStudy.summary.probeRowCount }`,
		`- Static blocked probes: ${ sdfStaticBlockerOracleStudy.summary.staticBlockedProbeCount }`,
		`- Blocker/side mismatches: ${ sdfStaticBlockerOracleStudy.summary.mismatchCount }`,
		`- Missed wrong-side probes: ${ sdfStaticBlockerOracleStudy.summary.missedWrongSideCount }`,
		`- Safe receiver wins: ${ sdfStaticBlockerOracleStudy.summary.safeReceiverWinCount }`,
		`- Min signed-distance sample: ${ sdfStaticBlockerOracleStudy.summary.minSignedDistance }`,
		`- Best safe candidate: ${ sdfStaticBlockerOracleStudy.summary.bestSafeCandidate } (${ sdfStaticBlockerOracleStudy.summary.bestSafeReceiver }, chroma ${ sdfStaticBlockerOracleStudy.summary.bestSafeChromaImprovement }, wrong-ratio ${ sdfStaticBlockerOracleStudy.summary.bestSafeWrongRatioImprovement }, preservation ${ sdfStaticBlockerOracleStudy.summary.bestSafeCorrectChannelPreservation })`,
		`- Interpretation: ${ sdfStaticBlockerOracleStudy.summary.interpretation }`,
		'',
		'| Receiver | Baseline chroma | Baseline wrong/correct | Blocked wrong weight | Blocked correct weight | Missed wrong probes | Best candidate | Chroma improvement | Wrong-ratio improvement | Correct preservation |',
		'|---|---:|---:|---:|---:|---:|---|---:|---:|---:|'
	);

	for ( const row of sdfStaticBlockerOracleStudy.receiverRows ) {

		lines.push( [
			row.receiver,
			row.baselineFullChromaPressure,
			row.baselineWrongOverCorrect,
			row.blockedWrongSideWeight,
			row.blockedCorrectSideWeight,
			row.missedWrongSideCount,
			row.bestCandidateLabel,
			row.bestCandidateChromaImprovement,
			row.bestCandidateWrongRatioImprovement,
			row.bestCandidateCorrectChannelPreservation
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'| Receiver | Probe | Relation | Static blocked | SDF min | Segment hit | Reason | Weight | Mismatch |',
		'|---|---:|---|---|---:|---|---|---:|---|'
	);

	for ( const row of sdfStaticBlockerOracleStudy.probeRows.slice( 0, 16 ) ) {

		lines.push( [
			row.receiver,
			row.probeIndex,
			row.relationToReceiver,
			row.staticBlocked,
			row.minSignedDistance,
			row.segmentIntersectsDivider,
			row.reason,
			row.visibilityWeight,
			row.staticBlockerMismatch
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Aggregate Bake Policy Oracle',
		`- Status: ${ aggregateBakePolicyOracleStudy.status }`,
		`- Boundary: ${ aggregateBakePolicyOracleStudy.proofBoundary }`,
		`- Receiver rows: ${ aggregateBakePolicyOracleStudy.summary.receiverCount }`,
		`- Candidate rows: ${ aggregateBakePolicyOracleStudy.summary.candidateCount }`,
		`- Source policies: ${ aggregateBakePolicyOracleStudy.sourcePolicies.join( ', ' ) }`,
		`- Band policies: ${ aggregateBakePolicyOracleStudy.bandPolicies.map( policy => policy.label ).join( ', ' ) }`,
		`- Safe receiver wins: ${ aggregateBakePolicyOracleStudy.summary.safeReceiverWinCount }`,
		`- Best safe candidate: ${ aggregateBakePolicyOracleStudy.summary.bestSafeCandidate } (${ aggregateBakePolicyOracleStudy.summary.bestSafeReceiver }, source ${ aggregateBakePolicyOracleStudy.summary.bestSafeSource }, policy ${ aggregateBakePolicyOracleStudy.summary.bestSafePolicy }, chroma ${ aggregateBakePolicyOracleStudy.summary.bestSafeChromaImprovement }, wrong-ratio ${ aggregateBakePolicyOracleStudy.summary.bestSafeWrongRatioImprovement }, preservation ${ aggregateBakePolicyOracleStudy.summary.bestSafeCorrectChannelPreservation })`,
		`- Interpretation: ${ aggregateBakePolicyOracleStudy.summary.interpretation }`,
		'',
		'| Receiver | Baseline chroma | Baseline wrong/correct | Best source | Best band policy | Best candidate | Chroma improvement | Wrong-ratio improvement | Correct preservation |',
		'|---|---:|---:|---|---|---|---:|---:|---:|'
	);

	for ( const row of aggregateBakePolicyOracleStudy.receiverRows ) {

		lines.push( [
			row.receiver,
			row.baselineFullChromaPressure,
			row.baselineWrongOverCorrect,
			row.bestSourcePolicy,
			row.bestBandPolicy,
			row.bestCandidateLabel,
			row.bestCandidateChromaImprovement,
			row.bestCandidateWrongRatioImprovement,
			row.bestCandidateCorrectChannelPreservation
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'| Receiver | Candidate | Source | Band policy | Full chroma | Wrong/correct | Correct preservation | Energy preservation | Weight |',
		'|---|---|---|---|---:|---:|---:|---:|---:|'
	);

	for ( const row of aggregateBakePolicyOracleStudy.receiverRows ) {

		for ( const candidate of row.rows.slice( 0, 12 ) ) {

			lines.push( [
				row.receiver,
				candidate.label,
				candidate.sourcePolicy,
				candidate.bandPolicy,
				candidate.fullChromaPressure,
				candidate.colorBias.wrongOverCorrect,
				candidate.correctChannelPreservation,
				candidate.energyPreservation,
				candidate.totalWeight
			].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

		}

	}

	lines.push(
		'',
		'### Probe Density / Divider Metric Study',
		`- Status: ${ probeDensityMetricStudy.status }`,
		`- Boundary: ${ probeDensityMetricStudy.proofBoundary }`,
		`- Grid: ${ probeDensityMetricStudy.grid.resolution }^3, spacing ${ probeDensityMetricStudy.grid.gridSpacing }, divider x=${ probeDensityMetricStudy.grid.dividerX }`,
		`- Risk receivers: ${ probeDensityMetricStudy.summary.riskReceiverCount } / ${ probeDensityMetricStudy.summary.receiverCount }`,
		`- Worst wrong visibility share: ${ probeDensityMetricStudy.summary.worstWrongVisibilityShare } (${ probeDensityMetricStudy.summary.worstWrongShareReceiver })`,
		`- Interpretation: ${ probeDensityMetricStudy.summary.interpretation }`,
		'',
		'| Receiver | Divider dist/grid | Correct weight | Wrong weight | Wrong share | Nearest correct | Nearest wrong | Straddles divider | Density risk | Runtime wrong/correct |',
		'|---|---:|---:|---:|---:|---:|---:|---|---|---:|'
	);

	for ( const row of probeDensityMetricStudy.receiverRows ) {

		lines.push( [
			row.receiver,
			row.receiverDividerDistanceOverGridSpacing,
			row.correctVisibilityWeight,
			row.wrongVisibilityWeight,
			row.wrongVisibilityShare,
			row.nearestCorrectDistance,
			row.nearestWrongDistance,
			row.straddlesDivider,
			row.densityRisk,
			row.runtimeWrongOverCorrect
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'| Receiver | Probe | Relation | Distance/grid | Divider distance | Visibility weight | Chroma pressure | Weighted chroma |',
		'|---|---:|---|---:|---:|---:|---:|---:|'
	);

	for ( const row of probeDensityMetricStudy.receiverRows ) {

		for ( const probeRow of row.rows.slice( 0, 8 ) ) {

			lines.push( [
				row.receiver,
				probeRow.probeIndex,
				probeRow.relationToReceiver,
				probeRow.distanceOverGridSpacing,
				probeRow.probeDividerDistance,
				probeRow.visibilityWeight,
				probeRow.chromaPressure,
				probeRow.weightedChromaPressure
			].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

		}

	}


}
