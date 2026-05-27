export function runLightProbeGridGpuVisibilityProbeAssertions( context ) {

	const { assert, sealedVisibilityWeightingDiagnostic } = context;

	const sealedProbeContentChromaStudy = sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.probeContentChromaStudy;
	assert( sealedProbeContentChromaStudy !== undefined &&
		[ 'OPEN-PROBE-CONTENT-CHROMA-PRESSURE', 'SUPPORTED-PROBE-CONTENT-CHROMA-BOUNDED' ].includes( sealedProbeContentChromaStudy.status ) &&
		sealedProbeContentChromaStudy.proofBoundary.includes( 'probe-content chroma audit' ) &&
		sealedProbeContentChromaStudy.receivers.length === 2 &&
		Number.isFinite( sealedProbeContentChromaStudy.summary.maxCorrectSideChromaPressure ) &&
		Number.isFinite( sealedProbeContentChromaStudy.summary.maxRuntimeFinalChromaPressure ) &&
		Number.isFinite( sealedProbeContentChromaStudy.summary.weightedCorrectSideChromaPressureMean ) &&
		Number.isFinite( sealedProbeContentChromaStudy.summary.invalidNeighborCount ) &&
		Number.isFinite( sealedProbeContentChromaStudy.summary.dilatedSourceRowCount ),
	'sealed visibility weighting diagnostic: expected probe-content chroma audit summary before Chebyshev tuning.' );
	const sealedProbeBakeContaminationMap = sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.probeBakeContaminationMap;
	assert( sealedProbeBakeContaminationMap !== undefined &&
		[
			'OPEN-BAKE-CAPTURE-SIDE-WALL-VISIBILITY-BYPASS',
			'OPEN-BAKE-CONTENT-DIRECTIONAL-CHROMA-PRESSURE',
			'SUPPORTED-BAKE-CONTENT-CHROMA-BOUNDED'
		].includes( sealedProbeBakeContaminationMap.status ) &&
		sealedProbeBakeContaminationMap.proofBoundary.includes( 'per-probe bake-content map' ) &&
		sealedProbeBakeContaminationMap.rows.length >= 8 &&
		Number.isFinite( sealedProbeBakeContaminationMap.summary.uniqueProbeCount ) &&
		Number.isFinite( sealedProbeBakeContaminationMap.summary.blockedOppositeWallVisibilityBypassCount ) &&
		Number.isFinite( sealedProbeBakeContaminationMap.summary.receiverDirectionalChromaProbeCount ) &&
		Number.isFinite( sealedProbeBakeContaminationMap.summary.maxCorrectReceiverChromaPressure ) &&
		typeof sealedProbeBakeContaminationMap.summary.dominantProbeBandResponsibility === 'string' &&
		Number.isFinite( sealedProbeBakeContaminationMap.summary.directionalBandDominantProbeCount ) &&
		Number.isFinite( sealedProbeBakeContaminationMap.summary.maxCorrectReceiverL1ChromaDelta ) &&
		Number.isFinite( sealedProbeBakeContaminationMap.summary.maxCorrectReceiverL2ChromaDelta ) &&
		sealedProbeBakeContaminationMap.rows.every( row =>
			Number.isInteger( row.probeIndex ) &&
			typeof row.side === 'string' &&
			Number.isInteger( row.sourceProbeIndex ) &&
			typeof row.classification === 'string' &&
			typeof row.bandResponsibility === 'string' &&
			Number.isFinite( row.maxCorrectReceiverChromaPressure ) &&
			Number.isFinite( row.maxCorrectReceiverL0L1ChromaPressure ) &&
			Number.isFinite( row.maxCorrectReceiverL1ChromaDelta ) &&
			Number.isFinite( row.maxCorrectReceiverL2ChromaDelta ) &&
			Number.isFinite( row.blockedOppositeWallChromaPressure ) &&
			row.wallVisibility.blockedOppositeWall.bandDecomposition !== undefined &&
			typeof row.wallVisibility.blockedOppositeWall.bandDecomposition.pressure.dominantBand === 'string' &&
			typeof row.wallVisibility.blockedOppositeWall.segmentIntersectsDivider === 'boolean' &&
			typeof row.wallVisibility.blockedOppositeWall.dividerAuditReason === 'string' ),
	'sealed visibility weighting diagnostic: expected per-probe bake contamination map before Chebyshev tuning.' );
	const sealedDominantProbeCoefficientStudy = sealedProbeBakeContaminationMap.dominantProbeCoefficientStudy;
	assert( sealedDominantProbeCoefficientStudy !== undefined &&
		[ 'OPEN-DOMINANT-SH-COEFFICIENT-LOBE-DRIVERS', 'SUPPORTED-NO-DOMINANT-SH-COEFFICIENT-DRIVERS' ].includes(
			sealedDominantProbeCoefficientStudy.status
		) &&
		sealedDominantProbeCoefficientStudy.proofBoundary.includes( 'raw SH coefficient/lobe contribution table' ) &&
		Number.isFinite( sealedDominantProbeCoefficientStudy.summary.candidateProbeCount ) &&
		Number.isFinite( sealedDominantProbeCoefficientStudy.summary.contextCount ) &&
		typeof sealedDominantProbeCoefficientStudy.summary.dominantCoefficientName === 'string' &&
		sealedDominantProbeCoefficientStudy.rows.every( row =>
			Number.isInteger( row.probeIndex ) &&
			typeof row.classification === 'string' &&
			typeof row.dominantCoefficientName === 'string' &&
			row.contexts.every( context =>
				typeof context.contextKind === 'string' &&
				typeof context.bandResponsibility === 'string' &&
				Number.isFinite( context.fullChromaPressure ) &&
				context.topCoefficientRows.length > 0 &&
				context.topCoefficientRows.every( coefficient =>
					Number.isInteger( coefficient.coefficientIndex ) &&
					typeof coefficient.name === 'string' &&
					typeof coefficient.band === 'string' &&
					Number.isFinite( coefficient.basisScale ) &&
					Number.isFinite( coefficient.rawCoefficient.r ) &&
					Number.isFinite( coefficient.contribution.r ) &&
					Number.isFinite( coefficient.wrongMinusCorrect ) ) ) ),
	'sealed visibility weighting diagnostic: expected dominant-probe raw SH coefficient/lobe rows before Chebyshev tuning.' );
	const sealedShDampingOracleStudy = sealedProbeBakeContaminationMap.shDampingOracleStudy;
	assert( sealedShDampingOracleStudy !== undefined &&
		[
			'SUPPORTED-SH-DAMPING-ORACLE-REDUCES-AGGREGATE-CHROMA',
			'OPEN-SH-DAMPING-ORACLE-CONTEXT-ONLY',
			'OPEN-SH-DAMPING-ORACLE-NO-SAFE-WIN'
		].includes(
			sealedShDampingOracleStudy.status
		) &&
		sealedShDampingOracleStudy.proofBoundary.includes( 'CPU-only SH damping oracle' ) &&
		Number.isFinite( sealedShDampingOracleStudy.summary.contextCount ) &&
		Number.isFinite( sealedShDampingOracleStudy.summary.receiverCount ) &&
		Number.isFinite( sealedShDampingOracleStudy.summary.safeWinCount ) &&
		Number.isFinite( sealedShDampingOracleStudy.summary.safeContextWinCount ) &&
		Number.isFinite( sealedShDampingOracleStudy.summary.safeReceiverWinCount ) &&
		typeof sealedShDampingOracleStudy.summary.bestSafeVariant === 'string' &&
		sealedShDampingOracleStudy.contextRows.every( row =>
			Number.isInteger( row.probeIndex ) &&
			typeof row.contextKind === 'string' &&
			Number.isFinite( row.baselineFullChromaPressure ) &&
			typeof row.bestVariantLabel === 'string' &&
			Number.isFinite( row.bestVariantImprovement ) &&
			Number.isFinite( row.bestVariantCorrectChannelPreservation ) &&
			row.rows.every( variant =>
				typeof variant.label === 'string' &&
				Array.isArray( variant.targetIndices ) &&
				Number.isFinite( variant.fullChromaPressure ) &&
				Number.isFinite( variant.chromaImprovement ) &&
				Number.isFinite( variant.correctChannelPreservation ) &&
				Number.isFinite( variant.negativeEnergy ) &&
				Number.isFinite( variant.clampEnergyLoss ) ) ) &&
		sealedShDampingOracleStudy.receiverRows.every( row =>
			typeof row.receiver === 'string' &&
			typeof row.bestVariantLabel === 'string' &&
			Number.isFinite( row.baselineFullChromaPressure ) &&
			Number.isFinite( row.bestVariantImprovement ) &&
			row.rows.every( variant =>
				typeof variant.label === 'string' &&
				Number.isFinite( variant.fullChromaPressure ) &&
				Number.isFinite( variant.chromaImprovement ) &&
				Number.isFinite( variant.correctChannelPreservation ) ) ),
	'sealed visibility weighting diagnostic: expected CPU-only SH damping oracle rows before runtime or Chebyshev changes.' );
	const sealedDominantProbePlacementStudy = sealedProbeBakeContaminationMap.dominantProbePlacementStudy;
	assert( sealedDominantProbePlacementStudy !== undefined &&
		[
			'SUPPORTED-PLACEMENT-ORACLE-AGGREGATE-WIN',
			'OPEN-PLACEMENT-ORACLE-CONTEXT-ONLY',
			'OPEN-PLACEMENT-ORACLE-NO-SAFE-WIN'
		].includes( sealedDominantProbePlacementStudy.status ) &&
		sealedDominantProbePlacementStudy.proofBoundary.includes( 'CPU-only dominant-probe placement/source oracle' ) &&
		Number.isFinite( sealedDominantProbePlacementStudy.summary.candidateProbeCount ) &&
		Number.isFinite( sealedDominantProbePlacementStudy.summary.safeContextWinCount ) &&
		Number.isFinite( sealedDominantProbePlacementStudy.summary.safeReceiverWinCount ) &&
		typeof sealedDominantProbePlacementStudy.summary.bestSafeCandidate === 'string' &&
		sealedDominantProbePlacementStudy.contextRows.every( row =>
			Number.isInteger( row.probeIndex ) &&
			typeof row.contextKind === 'string' &&
			Number.isFinite( row.baselineFullChromaPressure ) &&
			Number.isFinite( row.baselineWrongOverCorrect ) &&
			typeof row.bestCandidateLabel === 'string' &&
			Number.isFinite( row.bestCandidateChromaImprovement ) &&
			Number.isFinite( row.bestCandidateWrongRatioImprovement ) &&
			Number.isFinite( row.bestCandidateCorrectChannelPreservation ) &&
			row.rows.every( candidate =>
				typeof candidate.label === 'string' &&
				Number.isInteger( candidate.sourceProbeIndex ) &&
				typeof candidate.sourceSide === 'string' &&
				Number.isFinite( candidate.validity ) &&
				Number.isFinite( candidate.fullChromaPressure ) &&
				Number.isFinite( candidate.colorBias.wrongOverCorrect ) &&
				Number.isFinite( candidate.chromaImprovement ) &&
				Number.isFinite( candidate.wrongRatioImprovement ) &&
				Number.isFinite( candidate.correctChannelPreservation ) ) ) &&
		sealedDominantProbePlacementStudy.receiverRows.every( row =>
			typeof row.receiver === 'string' &&
			typeof row.bestCandidateLabel === 'string' &&
			Number.isFinite( row.baselineFullChromaPressure ) &&
			Number.isFinite( row.baselineWrongOverCorrect ) &&
			Number.isFinite( row.bestCandidateChromaImprovement ) &&
			Number.isFinite( row.bestCandidateWrongRatioImprovement ) &&
			Number.isFinite( row.bestCandidateCorrectChannelPreservation ) ),
	'sealed visibility weighting diagnostic: expected CPU-only dominant probe placement/source oracle before runtime or Chebyshev changes.' );
	const sealedCombinedSourceDampingOracleStudy = sealedProbeBakeContaminationMap.combinedSourceDampingOracleStudy;
	assert( sealedCombinedSourceDampingOracleStudy !== undefined &&
		[
			'SUPPORTED-COMBINED-SOURCE-DAMPING-AGGREGATE-WIN',
			'OPEN-COMBINED-SOURCE-DAMPING-CONTEXT-ONLY',
			'OPEN-COMBINED-SOURCE-DAMPING-NO-SAFE-WIN'
		].includes( sealedCombinedSourceDampingOracleStudy.status ) &&
		sealedCombinedSourceDampingOracleStudy.proofBoundary.includes( 'combined source-replacement plus SH damping oracle' ) &&
		Number.isFinite( sealedCombinedSourceDampingOracleStudy.summary.candidateProbeCount ) &&
		Number.isFinite( sealedCombinedSourceDampingOracleStudy.summary.safeContextWinCount ) &&
		Number.isFinite( sealedCombinedSourceDampingOracleStudy.summary.safeReceiverWinCount ) &&
		typeof sealedCombinedSourceDampingOracleStudy.summary.bestSafeSource === 'string' &&
		typeof sealedCombinedSourceDampingOracleStudy.summary.bestSafeVariant === 'string' &&
		sealedCombinedSourceDampingOracleStudy.contextRows.every( row =>
			Number.isInteger( row.probeIndex ) &&
			typeof row.contextKind === 'string' &&
			Number.isFinite( row.baselineFullChromaPressure ) &&
			Number.isFinite( row.baselineWrongOverCorrect ) &&
			typeof row.bestSourceLabel === 'string' &&
			typeof row.bestVariantLabel === 'string' &&
			Number.isFinite( row.bestChromaImprovement ) &&
			Number.isFinite( row.bestWrongRatioImprovement ) &&
			Number.isFinite( row.bestCorrectChannelPreservation ) &&
			row.rows.every( candidate =>
				typeof candidate.sourceLabel === 'string' &&
				typeof candidate.variantLabel === 'string' &&
				Array.isArray( candidate.targetIndices ) &&
				Number.isFinite( candidate.fullChromaPressure ) &&
				Number.isFinite( candidate.colorBias.wrongOverCorrect ) &&
				Number.isFinite( candidate.chromaImprovement ) &&
				Number.isFinite( candidate.wrongRatioImprovement ) &&
				Number.isFinite( candidate.correctChannelPreservation ) ) ) &&
		sealedCombinedSourceDampingOracleStudy.receiverRows.every( row =>
			typeof row.receiver === 'string' &&
			typeof row.bestSourceLabel === 'string' &&
			typeof row.bestVariantLabel === 'string' &&
			Number.isFinite( row.baselineFullChromaPressure ) &&
			Number.isFinite( row.baselineWrongOverCorrect ) &&
			Number.isFinite( row.bestChromaImprovement ) &&
			Number.isFinite( row.bestWrongRatioImprovement ) &&
			Number.isFinite( row.bestCorrectChannelPreservation ) ),
	'sealed visibility weighting diagnostic: expected CPU-only combined source+damping oracle before runtime or Chebyshev changes.' );
	const sealedDilationSourceQualityStudy = sealedProbeBakeContaminationMap.dilationSourceQualityStudy;
	assert( sealedDilationSourceQualityStudy !== undefined &&
		[
			'OPEN-DILATION-SOURCE-QUALITY-CANDIDATE',
			'SUPPORTED-DILATION-SOURCE-QUALITY-BOUNDED'
		].includes( sealedDilationSourceQualityStudy.status ) &&
		sealedDilationSourceQualityStudy.proofBoundary.includes( 'dilation-source quality audit' ) &&
		Number.isFinite( sealedDilationSourceQualityStudy.summary.auditedProbeCount ) &&
		Number.isFinite( sealedDilationSourceQualityStudy.summary.changedSourceCount ) &&
		Number.isFinite( sealedDilationSourceQualityStudy.summary.sideMismatchCount ) &&
		Number.isFinite( sealedDilationSourceQualityStudy.summary.invalidDilationSourceCount ) &&
		Number.isFinite( sealedDilationSourceQualityStudy.summary.notNearestSameSideValidCount ) &&
		Number.isFinite( sealedDilationSourceQualityStudy.summary.safeContextWinCount ) &&
		typeof sealedDilationSourceQualityStudy.summary.bestSafeCandidate === 'string' &&
		sealedDilationSourceQualityStudy.rows.every( row =>
			Number.isInteger( row.probeIndex ) &&
			typeof row.side === 'string' &&
			Number.isInteger( row.sourceProbeIndex ) &&
			typeof row.sourceSide === 'string' &&
			typeof row.sourceDiffers === 'boolean' &&
			typeof row.dilationSourceSameSide === 'boolean' &&
			typeof row.dilationSourceValid === 'boolean' &&
			typeof row.dilationSourceEqualsNearestSameSideValid === 'boolean' &&
			typeof row.bestCandidateLabel === 'string' &&
			Number.isFinite( row.bestCandidateChromaImprovement ) &&
			Number.isFinite( row.bestCandidateWrongRatioImprovement ) &&
			Number.isFinite( row.bestCandidateCorrectChannelPreservation ) &&
			row.contextRows.every( context =>
				typeof context.contextKind === 'string' &&
				Number.isFinite( context.baselineFullChromaPressure ) &&
				typeof context.bestCandidateLabel === 'string' &&
				Number.isFinite( context.bestCandidateChromaImprovement ) &&
				Number.isFinite( context.bestCandidateWrongRatioImprovement ) &&
				Number.isFinite( context.bestCandidateCorrectChannelPreservation ) ) ),
	'sealed visibility weighting diagnostic: expected CPU-only dilation-source quality audit before runtime or Chebyshev changes.' );
	const sealedSameSideLayerMaskOracleStudy = sealedProbeBakeContaminationMap.sameSideLayerMaskOracleStudy;
	assert( sealedSameSideLayerMaskOracleStudy !== undefined &&
		[
			'SUPPORTED-SAME-SIDE-LAYER-AGGREGATE-WIN',
			'OPEN-SAME-SIDE-LAYER-NO-SAFE-WIN'
		].includes( sealedSameSideLayerMaskOracleStudy.status ) &&
		sealedSameSideLayerMaskOracleStudy.proofBoundary.includes( 'same-side/rendering-layer mask oracle' ) &&
		Number.isFinite( sealedSameSideLayerMaskOracleStudy.summary.receiverCount ) &&
		Number.isFinite( sealedSameSideLayerMaskOracleStudy.summary.safeReceiverWinCount ) &&
		Number.isFinite( sealedSameSideLayerMaskOracleStudy.summary.totalRemovedWrongSideWeight ) &&
		typeof sealedSameSideLayerMaskOracleStudy.summary.bestSafeCandidate === 'string' &&
		sealedSameSideLayerMaskOracleStudy.receiverRows.every( row =>
			typeof row.receiver === 'string' &&
			typeof row.correctSide === 'string' &&
			Number.isFinite( row.correctVisibilityWeight ) &&
			Number.isFinite( row.wrongVisibilityWeight ) &&
			Number.isFinite( row.removedWrongSideWeight ) &&
			Number.isFinite( row.baselineFullChromaPressure ) &&
			Number.isFinite( row.baselineWrongOverCorrect ) &&
			typeof row.bestCandidateLabel === 'string' &&
			Number.isFinite( row.bestCandidateChromaImprovement ) &&
			Number.isFinite( row.bestCandidateWrongRatioImprovement ) &&
			Number.isFinite( row.bestCandidateCorrectChannelPreservation ) &&
			row.rows.every( candidate =>
				typeof candidate.label === 'string' &&
				Number.isFinite( candidate.fullChromaPressure ) &&
				Number.isFinite( candidate.colorBias.wrongOverCorrect ) &&
				Number.isFinite( candidate.chromaImprovement ) &&
				Number.isFinite( candidate.wrongRatioImprovement ) &&
				Number.isFinite( candidate.correctChannelPreservation ) ) ),
	'sealed visibility weighting diagnostic: expected CPU-only same-side/layer mask oracle before runtime or Chebyshev changes.' );
	const sealedSdfStaticBlockerOracleStudy = sealedProbeBakeContaminationMap.sdfStaticBlockerOracleStudy;
	assert( sealedSdfStaticBlockerOracleStudy !== undefined &&
		[
			'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN',
			'OPEN-SDF-STATIC-BLOCKER-MISSED-WRONG-SIDE',
			'OPEN-SDF-STATIC-BLOCKER-NO-AGGREGATE-WIN'
		].includes( sealedSdfStaticBlockerOracleStudy.status ) &&
		sealedSdfStaticBlockerOracleStudy.proofBoundary.includes( 'static divider box-SDF/segment oracle' ) &&
		Number.isFinite( sealedSdfStaticBlockerOracleStudy.summary.receiverCount ) &&
		Number.isFinite( sealedSdfStaticBlockerOracleStudy.summary.probeRowCount ) &&
		Number.isFinite( sealedSdfStaticBlockerOracleStudy.summary.staticBlockedProbeCount ) &&
		Number.isFinite( sealedSdfStaticBlockerOracleStudy.summary.mismatchCount ) &&
		Number.isFinite( sealedSdfStaticBlockerOracleStudy.summary.missedWrongSideCount ) &&
		Number.isFinite( sealedSdfStaticBlockerOracleStudy.summary.safeReceiverWinCount ) &&
		typeof sealedSdfStaticBlockerOracleStudy.summary.bestSafeCandidate === 'string' &&
		sealedSdfStaticBlockerOracleStudy.receiverRows.every( row =>
			typeof row.receiver === 'string' &&
			typeof row.correctSide === 'string' &&
			Number.isFinite( row.baselineFullChromaPressure ) &&
			Number.isFinite( row.baselineWrongOverCorrect ) &&
			Number.isFinite( row.blockedWrongSideWeight ) &&
			Number.isFinite( row.blockedCorrectSideWeight ) &&
			Number.isFinite( row.missedWrongSideCount ) &&
			typeof row.bestCandidateLabel === 'string' &&
			Number.isFinite( row.bestCandidateChromaImprovement ) &&
			Number.isFinite( row.bestCandidateWrongRatioImprovement ) &&
			Number.isFinite( row.bestCandidateCorrectChannelPreservation ) ) &&
		sealedSdfStaticBlockerOracleStudy.probeRows.every( row =>
			typeof row.receiver === 'string' &&
			Number.isInteger( row.probeIndex ) &&
			typeof row.relationToReceiver === 'string' &&
			typeof row.staticBlocked === 'boolean' &&
			typeof row.segmentIntersectsDivider === 'boolean' &&
			typeof row.reason === 'string' &&
			Number.isFinite( row.visibilityWeight ) &&
			typeof row.staticBlockerMismatch === 'boolean' &&
			( row.minSignedDistance === null || Number.isFinite( row.minSignedDistance ) ) ),
	'sealed visibility weighting diagnostic: expected CPU-only SDF/static blocker oracle before runtime or Chebyshev changes.' );
	const sealedAggregateBakePolicyOracleStudy = sealedProbeBakeContaminationMap.aggregateBakePolicyOracleStudy;
	assert( sealedAggregateBakePolicyOracleStudy !== undefined &&
		[
			'SUPPORTED-AGGREGATE-BAKE-POLICY-WIN',
			'OPEN-AGGREGATE-BAKE-POLICY-NO-SAFE-WIN'
		].includes( sealedAggregateBakePolicyOracleStudy.status ) &&
		sealedAggregateBakePolicyOracleStudy.proofBoundary.includes( 'aggregate bake/repack policy oracle' ) &&
		Array.isArray( sealedAggregateBakePolicyOracleStudy.sourcePolicies ) &&
		Array.isArray( sealedAggregateBakePolicyOracleStudy.bandPolicies ) &&
		Number.isFinite( sealedAggregateBakePolicyOracleStudy.summary.receiverCount ) &&
		Number.isFinite( sealedAggregateBakePolicyOracleStudy.summary.candidateCount ) &&
		Number.isFinite( sealedAggregateBakePolicyOracleStudy.summary.safeReceiverWinCount ) &&
		typeof sealedAggregateBakePolicyOracleStudy.summary.bestSafeSource === 'string' &&
		typeof sealedAggregateBakePolicyOracleStudy.summary.bestSafePolicy === 'string' &&
		sealedAggregateBakePolicyOracleStudy.bandPolicies.every( policy =>
			typeof policy.label === 'string' &&
			typeof policy.mode === 'string' &&
			Number.isFinite( policy.scale ) &&
			Array.isArray( policy.targetIndices ) ) &&
		sealedAggregateBakePolicyOracleStudy.receiverRows.every( row =>
			typeof row.receiver === 'string' &&
			typeof row.correctSide === 'string' &&
			Number.isFinite( row.baselineFullChromaPressure ) &&
			Number.isFinite( row.baselineWrongOverCorrect ) &&
			typeof row.bestSourcePolicy === 'string' &&
			typeof row.bestBandPolicy === 'string' &&
			typeof row.bestCandidateLabel === 'string' &&
			Number.isFinite( row.bestCandidateChromaImprovement ) &&
			Number.isFinite( row.bestCandidateWrongRatioImprovement ) &&
			Number.isFinite( row.bestCandidateCorrectChannelPreservation ) &&
			row.rows.every( candidate =>
				typeof candidate.label === 'string' &&
				typeof candidate.sourcePolicy === 'string' &&
				typeof candidate.bandPolicy === 'string' &&
				Number.isFinite( candidate.fullChromaPressure ) &&
				Number.isFinite( candidate.colorBias.wrongOverCorrect ) &&
				Number.isFinite( candidate.chromaImprovement ) &&
				Number.isFinite( candidate.wrongRatioImprovement ) &&
				Number.isFinite( candidate.correctChannelPreservation ) &&
				candidate.contributionRows.every( contribution =>
					Number.isInteger( contribution.probeIndex ) &&
					Number.isInteger( contribution.sourceProbeIndex ) &&
					typeof contribution.sourcePolicy === 'string' &&
					typeof contribution.bandPolicy === 'string' &&
					Number.isFinite( contribution.appliedWeight ) ) ) ),
	'sealed visibility weighting diagnostic: expected CPU-only aggregate bake-policy oracle before runtime or Chebyshev changes.' );
	const sealedProbeDensityMetricStudy = sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.probeDensityMetricStudy;
	assert( sealedProbeDensityMetricStudy !== undefined &&
		[
			'OPEN-PROBE-DENSITY-DIVIDER-STRADDLE-RISK',
			'SUPPORTED-PROBE-DENSITY-BOUNDED'
		].includes( sealedProbeDensityMetricStudy.status ) &&
		sealedProbeDensityMetricStudy.proofBoundary.includes( 'probe-density and receiver/probe geometry audit' ) &&
		Number.isFinite( sealedProbeDensityMetricStudy.grid.gridSpacing ) &&
		Number.isFinite( sealedProbeDensityMetricStudy.summary.riskReceiverCount ) &&
		Number.isFinite( sealedProbeDensityMetricStudy.summary.worstWrongVisibilityShare ) &&
		sealedProbeDensityMetricStudy.receiverRows.every( row =>
			typeof row.receiver === 'string' &&
			typeof row.correctSide === 'string' &&
			Number.isFinite( row.receiverDividerDistanceOverGridSpacing ) &&
			Number.isFinite( row.correctVisibilityWeight ) &&
			Number.isFinite( row.wrongVisibilityWeight ) &&
			Number.isFinite( row.wrongVisibilityShare ) &&
			typeof row.straddlesDivider === 'boolean' &&
			typeof row.densityRisk === 'boolean' &&
			Number.isFinite( row.runtimeWrongOverCorrect ) &&
			row.rows.every( probeRow =>
				Number.isInteger( probeRow.probeIndex ) &&
				typeof probeRow.relationToReceiver === 'string' &&
				Number.isFinite( probeRow.distanceOverGridSpacing ) &&
				Number.isFinite( probeRow.visibilityWeight ) &&
				Number.isFinite( probeRow.weightedChromaPressure ) ) ),
	'sealed visibility weighting diagnostic: expected probe-density/divider metric study before runtime or Chebyshev changes.' );
	assert( sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.left.rows.length === 8 &&
		sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.right.rows.length === 8 &&
		sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.left.rows.every( row =>
			Number.isFinite( row.colorBias.wrongOverCorrect ) &&
			Number.isFinite( row.l0ColorBias.wrongOverCorrect ) &&
			Number.isInteger( row.sourceProbeIndex ) &&
			typeof row.dilationSourceDiffers === 'boolean' &&
			typeof row.sourceRelationToReceiver === 'string' &&
			Number.isFinite( row.sourceValidity ) &&
			Number.isFinite( row.chromaticity.r ) &&
			Number.isFinite( row.chromaPressure.wrongMinusCorrect ) &&
			row.bandDecomposition !== undefined &&
			typeof row.bandDecomposition.pressure.dominantBand === 'string' &&
			Number.isFinite( row.bandDecomposition.pressure.l1Delta ) &&
			Number.isFinite( row.bandDecomposition.pressure.l2Delta ) &&
			Number.isFinite( row.l0ChromaPressure.wrongOverCorrect ) &&
			Number.isFinite( row.dilatedChromaPressure.wrongMinusCorrect ) ) &&
		sealedVisibilityWeightingDiagnostic.shContributionDiagnostic.right.rows.every( row =>
			Number.isFinite( row.colorBias.wrongOverCorrect ) &&
			Number.isFinite( row.l0ColorBias.wrongOverCorrect ) &&
			Number.isInteger( row.sourceProbeIndex ) &&
			typeof row.dilationSourceDiffers === 'boolean' &&
			typeof row.sourceRelationToReceiver === 'string' &&
			Number.isFinite( row.sourceValidity ) &&
			Number.isFinite( row.chromaticity.r ) &&
			Number.isFinite( row.chromaPressure.wrongMinusCorrect ) &&
			row.bandDecomposition !== undefined &&
			typeof row.bandDecomposition.pressure.dominantBand === 'string' &&
			Number.isFinite( row.bandDecomposition.pressure.l1Delta ) &&
			Number.isFinite( row.bandDecomposition.pressure.l2Delta ) &&
			Number.isFinite( row.l0ChromaPressure.wrongOverCorrect ) &&
			Number.isFinite( row.dilatedChromaPressure.wrongMinusCorrect ) ),
	'sealed visibility weighting diagnostic: expected per-probe SH color-bias and chroma rows for both receivers.' );

}
