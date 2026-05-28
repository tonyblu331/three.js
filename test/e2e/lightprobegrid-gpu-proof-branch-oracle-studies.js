import { roundMetric } from './lightprobegrid-gpu-report-metrics.js';

export const createLightProbeProofBranchOracleStudies = ( {
	surfaceContentAttributionFollowupStudy,
	surfaceSampleCoefficientAttributionStudy,
	sdfStaticBlockerOracleStudy
} ) => {

	const createSurfaceAttributionBranchDecision = () => {

		const summary = surfaceSampleCoefficientAttributionStudy.summary;
		const leakSampleCount = summary.leakSampleCount;
		const attributedLeakSampleCount = summary.attributedLeakSampleCount;
		const sourcePressureCount = summary.sourcePressureLeakSampleCount;
		const bandPressureCount = summary.l2DominantLeakSampleCount;
		const blockerPressureCount = summary.correctSideDominantLeakSampleCount;
		const candidates = [
			{
				branch: 'proof-7a',
				oracleFamily: 'bake-repack-source-policy',
				score: sourcePressureCount,
				reason: 'independent wrong-side source-map pressure appears in the attributed surface leak samples'
			},
			{
				branch: 'proof-7b',
				oracleFamily: 'band-deringing-policy',
				score: bandPressureCount,
				reason: 'L2 band pressure dominates the attributed surface leak samples'
			},
			{
				branch: 'proof-7c',
				oracleFamily: 'cpu-static-blocker-sdf',
				score: blockerPressureCount,
				reason: 'correct-side selected/source paths dominate but still leak through the sealed wall'
			}
		].sort( ( a, b ) => b.score - a.score );
		const topCandidate = candidates[ 0 ];
		const topScoreTie = candidates.filter( candidate =>
			candidate.score === topCandidate.score
		);
		const confidence = leakSampleCount > 0 ?
			roundMetric( topCandidate.score / Math.max( leakSampleCount, 1 ) ) :
			1;
		const selected = leakSampleCount === 0 ? {
			branch: 'none',
			oracleFamily: 'no-leak',
			score: 0,
			reason: 'surface attribution found no leaking surface samples'
		} :
			attributedLeakSampleCount === 0 || topCandidate.score === 0 ? {
				branch: 'proof-7d',
				oracleFamily: 'instrumentation-fallback',
				score: 0,
				reason: 'leaking surface samples exist but no dominant probe/source/band/blocker branch is attributable yet'
			} :
				topScoreTie.length > 1 ? {
					branch: 'proof-7d',
					oracleFamily: 'ambiguous-attribution-fallback',
					score: topCandidate.score,
					reason: `surface attribution is ambiguous across ${ topScoreTie.map( candidate => candidate.branch ).join( ', ' ) }; expand or refine instrumentation before selecting an oracle`
				} :
					topCandidate;

		return {
			status: selected.branch === 'none' ?
				'SUPPORTED-NO-SURFACE-LEAK-BRANCH' :
				selected.branch === 'proof-7d' ?
					'OPEN-ATTRIBUTION-UNDER-INSTRUMENTED' :
					'OPEN-ATTRIBUTION-BRANCH-SELECTED',
			proofBoundary: 'Report-only branch decision over surfaceSampleCoefficientAttributionStudy; selects the next proof oracle but does not authorize runtime, bake, public API, docs, or Chebyshev changes.',
			selectedBranch: selected.branch,
			selectedOracleFamily: selected.oracleFamily,
			selectedReason: selected.reason,
			confidence,
			confidenceBasis: 'selected branch score divided by leak sample count; this is a routing score, not a correctness probability.',
			candidates,
			observedSignals: {
				leakSampleCount,
				attributedLeakSampleCount,
				sourcePressureCount,
				bandPressureCount,
				blockerPressureCount,
				topScoreTieBranches: topScoreTie.map( candidate => candidate.branch ),
				weightedLeakWrongChannelPressure: summary.weightedLeakWrongChannelPressure,
				weightedLeakCorrectChannelPreservation: summary.weightedLeakCorrectChannelPreservation,
				dominantProbeHistogram: summary.dominantProbeHistogram,
				dominantBandHistogram: summary.dominantBandHistogram,
				dominantCoefficientHistogram: summary.dominantCoefficientHistogram
			},
			nextAction: selected.branch === 'proof-7a' ?
				'Evaluate proof-7a as CPU/report-only bake/repack/source-policy oracle.' :
				selected.branch === 'proof-7b' ?
					'Evaluate proof-7b as CPU/report-only band/de-ringing oracle.' :
					selected.branch === 'proof-7c' ?
						'Evaluate proof-7c as CPU-only static-blocker/SDF oracle.' :
						selected.branch === 'proof-7d' ?
							'Expand surface attribution instrumentation before any fix branch.' :
							'Keep current proof gates bounded; no leak-fix oracle is needed while surface leak samples remain absent.'
		};

	};

	const surfaceAttributionBranchDecision = createSurfaceAttributionBranchDecision();
	const createProof7cSurfaceStaticBlockerOracleStudy = () => {

		const selected = surfaceAttributionBranchDecision.selectedBranch === 'proof-7c';
		const leakSamples = surfaceSampleCoefficientAttributionStudy.receivers.flatMap( receiver =>
			receiver.samples
				.filter( sample => sample.leakSample )
				.map( sample => ( {
					...sample,
					receiverCorrectSide: receiver.correctSide
				} ) )
		);
		const attributedLeakSamples = leakSamples.filter( sample => sample.dominantProbeIndex !== null );
		const proof7cEligibleSamples = attributedLeakSamples.filter( sample =>
			sample.dominantProbeRelationToReceiver === 'correct-side'
		);
		const rows = proof7cEligibleSamples.map( sample => {

			const dominantRow = sample.attributionRows.find( row =>
				row.probeIndex === sample.dominantProbeIndex
			) ?? null;
			const surfaceSegmentDividerAudit = dominantRow?.surfaceSegmentDividerAudit ?? null;
			const hasSurfacePathAudit = surfaceSegmentDividerAudit !== null &&
				typeof surfaceSegmentDividerAudit.intersects === 'boolean';
			const staticBlocked = hasSurfacePathAudit ?
				surfaceSegmentDividerAudit.intersects :
				null;

			return {
				receiver: sample.receiver,
				sampleLabel: sample.sampleLabel,
				quadratureWeight: sample.quadratureWeight,
				samplePosition: sample.samplePosition,
				runtimeWrongOverCorrect: sample.runtimeWrongOverCorrect,
				dominantProbeIndex: sample.dominantProbeIndex,
				dominantSourceProbeIndex: sample.dominantSourceProbeIndex,
				dominantProbeRelationToReceiver: sample.dominantProbeRelationToReceiver,
				dominantSourceRelationToReceiver: sample.dominantSourceRelationToReceiver,
				dominantWeightedBand: sample.dominantWeightedBand,
				dominantWeightedCoefficient: sample.dominantWeightedCoefficient,
				dominantWrongChannelPressure: sample.dominantWrongChannelPressure,
				dominantCorrectChannelPreservation: sample.dominantCorrectChannelPreservation,
				proof7cEligible: true,
				probePosition: dominantRow?.probePosition ?? null,
				crossesDivider: dominantRow?.crossesDivider ?? null,
				visibilitySegmentDividerAudit: dominantRow?.visibilitySegmentDividerAudit ?? null,
				surfaceSegmentDividerAudit,
				hasSurfacePathAudit,
				staticBlocked,
				blockerReason: hasSurfacePathAudit ?
					staticBlocked ?
						'dominant-probe-to-surface-path-crosses-static-divider' :
						'dominant-probe-to-surface-path-clear-of-static-divider' :
					'missing-dominant-probe-to-surface-path-audit'
			};

		} );
		const missingAuditRows = rows.filter( row => row.hasSurfacePathAudit === false );
		const blockedRows = rows.filter( row => row.staticBlocked === true );
		const unblockedRows = rows.filter( row => row.staticBlocked === false );
		const safeAggregateReceivers = sdfStaticBlockerOracleStudy.receiverRows.filter( row =>
			row.bestCandidateLabel !== 'none' &&
			row.bestCandidateCorrectChannelPreservation >= sdfStaticBlockerOracleStudy.thresholds.correctChannelPreservation &&
			(
				row.bestCandidateChromaImprovement >= sdfStaticBlockerOracleStudy.thresholds.chromaImprovement ||
				row.bestCandidateWrongRatioImprovement >= sdfStaticBlockerOracleStudy.thresholds.wrongRatioImprovement
			)
		);
		const blockedReceiverNames = new Set( blockedRows.map( row => row.receiver ) );
		const overlappingSafeAggregateReceivers = safeAggregateReceivers.filter( row =>
			blockedReceiverNames.has( row.receiver )
		);
		const receiverAggregateWin = sdfStaticBlockerOracleStudy.status ===
			'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN';
		const surfacePathAggregateWin = receiverAggregateWin &&
			blockedRows.length > 0 &&
			overlappingSafeAggregateReceivers.length > 0;
		const weighted = ( sourceRows, key ) => roundMetric( sourceRows.reduce(
			( total, row ) => total + row[ key ] * row.quadratureWeight,
			0
		) );
		const weightedBlockedWrongChannelPressure = weighted( blockedRows, 'dominantWrongChannelPressure' );
		const weightedUnblockedWrongChannelPressure = weighted( unblockedRows, 'dominantWrongChannelPressure' );
		const weightedBlockedCorrectChannelPreservation = weighted( blockedRows, 'dominantCorrectChannelPreservation' );
		const weightedUnblockedCorrectChannelPreservation = weighted( unblockedRows, 'dominantCorrectChannelPreservation' );

		return {
			status: selected === false ?
				'NOT-SELECTED-PROOF-7C-SURFACE-STATIC-BLOCKER-ORACLE' :
				leakSamples.length === 0 ?
					'SUPPORTED-PROOF-7C-NO-SURFACE-LEAK-SAMPLES' :
					missingAuditRows.length > 0 ?
						'OPEN-PROOF-7C-SURFACE-STATIC-BLOCKER-MISSING-PATH-AUDIT' :
						surfacePathAggregateWin ?
							'SUPPORTED-PROOF-7C-CPU-STATIC-BLOCKER-AGGREGATE-WIN' :
							blockedRows.length > 0 ?
								receiverAggregateWin ?
									'OPEN-PROOF-7C-BLOCKED-SURFACE-PATHS-NO-SAFE-RECEIVER-OVERLAP' :
									'OPEN-PROOF-7C-BLOCKED-SURFACE-PATHS-NO-AGGREGATE-WIN' :
								'OPEN-PROOF-7C-NO-BLOCKED-DOMINANT-SURFACE-PATHS',
			proofBoundary: 'CPU/report-only proof-7c selected-oracle evaluation over dominant leaking probe-to-surface paths plus the receiver-aggregate SDF/static-blocker oracle; does not add runtime SDF, runtime visibility, public API, bake policy, docs promotion, or Chebyshev changes.',
			receiverAggregateOracleStatus: sdfStaticBlockerOracleStudy.status,
			receiverAggregateOracleSafeWinCount: sdfStaticBlockerOracleStudy.summary.safeReceiverWinCount,
			rows,
			summary: {
				selected,
				leakSampleCount: leakSamples.length,
				attributedLeakSampleCount: attributedLeakSamples.length,
				proof7cEligibleLeakSampleCount: proof7cEligibleSamples.length,
				ineligibleAttributedLeakSampleCount: attributedLeakSamples.length - proof7cEligibleSamples.length,
				evaluatedDominantPathCount: rows.length,
				missingSurfacePathAuditCount: missingAuditRows.length,
				blockedDominantPathCount: blockedRows.length,
				unblockedDominantPathCount: unblockedRows.length,
				correctSideDominantPathCount: rows.length,
				wrongSideDominantPathCount: 0,
				weightedBlockedWrongChannelPressure,
				weightedUnblockedWrongChannelPressure,
				weightedBlockedCorrectChannelPreservation,
				weightedUnblockedCorrectChannelPreservation,
				receiverAggregateOracleStatus: sdfStaticBlockerOracleStudy.status,
				receiverAggregateOracleSafeWinCount: sdfStaticBlockerOracleStudy.summary.safeReceiverWinCount,
				overlappingSafeReceiverCount: overlappingSafeAggregateReceivers.length,
				overlappingSafeReceivers: overlappingSafeAggregateReceivers.map( row => row.receiver ),
				interpretation: selected === false ?
					'proof-7c is not the selected branch for this proof artifact.' :
					missingAuditRows.length > 0 ?
						'proof-7c cannot be evaluated yet because dominant surface attribution rows do not carry probe-to-surface static blocker audits.' :
						surfacePathAggregateWin ?
							'proof-7c CPU oracle has an aggregate win; runtime design is still blocked until this report is reviewed and promoted deliberately.' :
							blockedRows.length > 0 ?
								receiverAggregateWin ?
									'proof-7c found blocked dominant surface paths and a receiver aggregate SDF/static-blocker safe win, but the safe receiver cohort does not overlap the blocked dominant surface-path receivers; do not promote runtime SDF yet.' :
									'proof-7c found blocked dominant surface paths, but the receiver aggregate SDF/static-blocker oracle did not produce a safe win; do not promote runtime SDF yet.' :
								'proof-7c found no blocked dominant surface paths for the leaking attribution rows; inspect bake content, probe density, or surface placement before runtime blocker work.'
			}
		};

	};

	const proof7cSurfaceStaticBlockerOracleStudy = createProof7cSurfaceStaticBlockerOracleStudy();
	const createProof7cDispositionStudy = () => {

		const status = proof7cSurfaceStaticBlockerOracleStudy.status;
		const supported = status === 'SUPPORTED-PROOF-7C-CPU-STATIC-BLOCKER-AGGREGATE-WIN';
		const selected = proof7cSurfaceStaticBlockerOracleStudy.summary.selected;
		const addressed = selected && proof7cSurfaceStaticBlockerOracleStudy.summary.missingSurfacePathAuditCount === 0;
		const runtimePromotionAllowed = supported === true;
		const dispositionStatus = selected === false ?
			'NOT-SELECTED-PROOF-7C-DISPOSITION' :
			supported ?
				'SUPPORTED-PROOF-7C-DISPOSITION-REVIEW-RUNTIME-PROMOTION' :
				addressed ?
					'CLOSED-PROOF-7C-DISPOSITION-NO-RUNTIME-PROMOTION' :
					'OPEN-PROOF-7C-DISPOSITION-MISSING-EVIDENCE';

		return {
			status: dispositionStatus,
			proofBoundary: 'Report-only proof-7c disposition after CPU/static-blocker oracle evaluation; documents whether proof-7c is addressed and whether runtime SDF/blocker promotion is allowed, without changing runtime, public API, bake policy, docs, or Chebyshev thresholds.',
			sourceStatus: status,
			addressed,
			runtimePromotionAllowed,
			nextProofOnlyAction: runtimePromotionAllowed ?
				'Review proof-7c aggregate support before any deliberate runtime SDF/blocker design promotion.' :
				surfaceContentAttributionFollowupStudy.summary.nextProofOnlyAction,
			summary: {
				selected,
				blockedDominantPathCount: proof7cSurfaceStaticBlockerOracleStudy.summary.blockedDominantPathCount,
				evaluatedDominantPathCount: proof7cSurfaceStaticBlockerOracleStudy.summary.evaluatedDominantPathCount,
				missingSurfacePathAuditCount: proof7cSurfaceStaticBlockerOracleStudy.summary.missingSurfacePathAuditCount,
				receiverAggregateOracleStatus: proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleStatus,
				receiverAggregateOracleSafeWinCount: proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleSafeWinCount,
				overlappingSafeReceiverCount: proof7cSurfaceStaticBlockerOracleStudy.summary.overlappingSafeReceiverCount,
				reason: selected === false ?
					'proof-7c was not selected by the surface attribution branch router.' :
					supported ?
						'proof-7c produced aggregate support and must be reviewed before any runtime promotion.' :
						addressed ?
							'proof-7c was evaluated and produced no runtime-promotable blocker evidence; continue with proof-only content/coefficient follow-up.' :
							'proof-7c cannot be closed because selected dominant surface rows are missing required path-audit evidence.'
			}
		};

	};

	const proof7cDispositionStudy = createProof7cDispositionStudy();

	return {
		surfaceAttributionBranchDecision,
		proof7cSurfaceStaticBlockerOracleStudy,
		proof7cDispositionStudy
	};

};
