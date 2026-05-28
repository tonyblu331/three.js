import { appendLightProbeProofDiagnosticMarkdown } from './lightprobegrid-gpu-proof-diagnostics-markdown.js';
import { appendLightProbeProofResearchMarkdown } from './lightprobegrid-gpu-proof-research-markdown.js';
const getSnapshotRegion = ( snapshot, regionName ) => {

	const region = snapshot.regions[ regionName ];
	if ( region === undefined ) throw new Error( `Missing snapshot region: ${ snapshot.label }/${ regionName }` );
	return region;

};

export function createLightProbeProofMarkdown( report ) {

	const lines = [
		'# LightProbeGridGPU Grounding + DDGI-lite Verifier Proof',
		'',
		`- Generated: ${ report.generatedAt }`,
		`- Claim status: ${ report.claim.status }`,
		`- Verifier: ${ report.verifierBoundary.primaryVerifier }`,
		`- Screenshot policy: ${ report.verifierBoundary.screenshotPolicy }`,
		'',
		'## Grounding / Parity Snapshots',
		'',
		'| Case | Role | Resolution | Cubemap | Bake texels | Band policy | Weighted | Tall red/green | Sphere green/red | Object black-tail | Pressure | Screenshot |',
		'|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---|'
	];

	for ( const snapshot of report.snapshots ) {

		const tallBox = getSnapshotRegion( snapshot, 'tallBox' );
		const sphere = getSnapshotRegion( snapshot, 'sphere' );

		lines.push( [
			snapshot.label,
			snapshot.proofRole,
			snapshot.metrics.resolution,
			snapshot.metrics.cubemapSize,
			snapshot.bakeTexelBudget.cubemapTexels,
			snapshot.antiRingingPolicy?.bandPolicy ?? 'n/a',
			snapshot.metrics.sampling.weightedProbeSampling,
			tallBox.colorBias.redOverGreen,
			sphere.colorBias.greenOverRed,
			snapshot.artifactPressure.objectBlackTailRatio,
			snapshot.artifactPressure.status,
			snapshot.screenshot
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	const webglTallBox = getSnapshotRegion( report.webglReference, 'tallBox' );
	const webglSphere = getSnapshotRegion( report.webglReference, 'sphere' );

	lines.push(
		'',
		'## WebGL Same-Class Reference',
		'',
		'| Case | Role | Resolution | Cubemap | Tall red/green | Sphere green/red | Object black-tail | Pressure | Screenshot |',
		'|---|---|---:|---:|---:|---:|---:|---|---|',
		[
			report.webglReference.label,
			report.webglReference.proofRole,
			report.webglReference.metrics.resolution,
			report.webglReference.metrics.cubemapSize,
			webglTallBox.colorBias.redOverGreen,
			webglSphere.colorBias.greenOverRed,
			report.webglReference.artifactPressure.objectBlackTailRatio,
			report.webglReference.artifactPressure.status,
			report.webglReference.screenshot
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' )
	);

	lines.push(
		'',
		'## Bake Budget',
		'',
		`- Low-res 4³ / 8px: ${ report.currentEvidence.bakeTexelBudgets.lowRes.cubemapTexels } cubemap texels.`,
		`- Same-budget stress 6³ / 32px: ${ report.currentEvidence.bakeTexelBudgets.densityReference.cubemapTexels } cubemap texels.`,
		`- Work multiplier: ${ report.currentEvidence.bakeTexelBudgets.densityReference.relativeToLowRes }x.`,
		`- Timing policy: ${ report.currentEvidence.performanceEvidence.measuredTimingStatus } — ${ report.currentEvidence.performanceEvidence.measuredTimingNote }`,
		`- Projection shape profile: ${ report.currentEvidence.performanceEvidence.projectionShapeProfile.status }; ${ report.currentEvidence.performanceEvidence.projectionShapeProfile.cubemapSweepsPerProbe } cubemap sweeps per probe across ${ report.currentEvidence.performanceEvidence.projectionShapeProfile.coefficientPixelsPerProbe } coefficient pixels.`,
		`- Projection static reduction: ${ report.currentEvidence.performanceEvidence.projectionShapeProfile.cubemapSweepsPerProbe } sweeps/probe → ${ report.currentEvidence.performanceEvidence.projectionShapeProfile.computeCubemapSweepsPerProbe } sweep/probe = ${ report.currentEvidence.performanceEvidence.projectionShapeProfile.staticWorkReductionPercent }% fewer cubemap integrations.`,
		`- Projection next shape: ${ report.currentEvidence.performanceEvidence.projectionShapeProfile.nextShape }; fallback remains ${ report.currentEvidence.performanceEvidence.projectionShapeProfile.currentShape } until parity passes.`
	);

	const computeProjectionSketch = report.currentEvidence.performanceEvidence.computeProjectionDesignSketch;

	lines.push(
		'',
		'## Compute Projection Design Sketch',
		'',
		`- Status: ${ computeProjectionSketch.status }`,
		`- Non-goal: ${ computeProjectionSketch.nonGoal }`,
		`- Storage layout: ${ computeProjectionSketch.storageLayout.intermediate }; output remains ${ computeProjectionSketch.storageLayout.output }.`,
		`- Reduction contract: ${ computeProjectionSketch.reductionContract.sweepCount }; ${ computeProjectionSketch.reductionContract.basisContract }.`,
		`- Output packing: ${ computeProjectionSketch.outputPackingContract.coefficientRows }; ${ computeProjectionSketch.outputPackingContract.atlasCompatibility }.`,
		`- Parity tolerance: max coefficient delta ${ computeProjectionSketch.parityTolerance.maxCoefficientDelta } across ${ computeProjectionSketch.parityTolerance.fixtures.join( ', ' ) }.`,
		`- Fallback behavior: ${ computeProjectionSketch.fallbackBehavior.defaultPath }; ${ computeProjectionSketch.fallbackBehavior.computePath }.`,
		'',
		'```mermaid',
		...computeProjectionSketch.architectureDiagram,
		'```'
	);

	const computeProjectionEvidence = report.currentEvidence.performanceEvidence.computeProjectionParityEvidencePlan;
	const computeProjectionTransitionGuard = report.currentEvidence.performanceEvidence.computeProjectionStatusTransitionGuard;
	const computeProjectionCandidateDesign = report.currentEvidence.performanceEvidence.computeProjectionCandidateImplementationDesign;
	const computeProjectionReadiness = report.currentEvidence.performanceEvidence.computeProjectionImplementationReadinessChecklist;

	lines.push(
		'',
		'## Compute Projection Parity Evidence Plan',
		'',
		`- Status: ${ computeProjectionEvidence.status }`,
		`- Runtime boundary: ${ computeProjectionEvidence.runtimeBoundary }`,
		`- Captured evidence: ${ computeProjectionEvidence.capturedEvidence.length > 0 ? computeProjectionEvidence.capturedEvidence.join( ', ' ) : 'none' }`,
		`- Open evidence: ${ computeProjectionEvidence.openEvidence.join( ', ' ) }`,
		`- Status transition: ${ computeProjectionEvidence.statusTransition.previous } → ${ computeProjectionEvidence.statusTransition.current } → ${ computeProjectionEvidence.statusTransition.nextRuntime }`
	);

	for ( const evidence of computeProjectionEvidence.requiredEvidence ) {

		lines.push(
			`- ${ evidence.id } (${ evidence.captureStatus }): ${ evidence.source }; baseline ${ evidence.baseline }; candidate ${ evidence.candidate }; pass when ${ evidence.passCondition }${ evidence.actualMaxDelta !== undefined && evidence.actualMaxDelta !== null ? `; actual max delta ${ evidence.actualMaxDelta }` : '' }.`
		);

	}

	lines.push(
		'',
		'## Compute Projection Status Transition Guard',
		'',
		`- Status: ${ computeProjectionTransitionGuard.status }`,
		`- Current contract: ${ computeProjectionTransitionGuard.currentContractStatus }`,
		`- Evidence plan: ${ computeProjectionTransitionGuard.evidencePlanStatus }`,
		`- Allowed next contract status: ${ computeProjectionTransitionGuard.allowedNextContractStatus }`,
		`- Runtime status required: ${ computeProjectionTransitionGuard.runtimeStatusRequired }`,
		`- Runtime markers allowed: ${ computeProjectionTransitionGuard.runtimeMarkersAllowed }`,
		`- Public API change allowed: ${ computeProjectionTransitionGuard.publicApiChangeAllowed }`,
		`- Guard rule: ${ computeProjectionTransitionGuard.guardRule }`,
		`- Promotion boundary: ${ computeProjectionTransitionGuard.promotionBoundary }`
	);

	lines.push(
		'',
		'## Compute Projection Candidate Implementation Design',
		'',
		`- Status: ${ computeProjectionCandidateDesign.status }`,
		`- Non-goal: ${ computeProjectionCandidateDesign.nonGoal }`,
		`- Dispatch shape: ${ computeProjectionCandidateDesign.dispatchShape.unit }; ${ computeProjectionCandidateDesign.dispatchShape.work }.`,
		`- Storage layout: input ${ computeProjectionCandidateDesign.storageLayout.input }; scratch ${ computeProjectionCandidateDesign.storageLayout.scratch }; output ${ computeProjectionCandidateDesign.storageLayout.output }.`,
		`- Workgroup strategy: ${ computeProjectionCandidateDesign.workgroupStrategy.phase1 }; ${ computeProjectionCandidateDesign.workgroupStrategy.phase2 }; ${ computeProjectionCandidateDesign.workgroupStrategy.phase3 }.`,
		`- Output contract: ${ computeProjectionCandidateDesign.outputContract.rowOrder }; ${ computeProjectionCandidateDesign.outputContract.packing }.`,
		`- Fallback branch: ${ computeProjectionCandidateDesign.fallbackBranch.rule }.`,
		`- Precision behavior: coefficient tolerance ${ computeProjectionCandidateDesign.precisionBehavior.coefficientTolerance }; atlas readback tolerance ${ computeProjectionCandidateDesign.precisionBehavior.atlasReadbackTolerance }; ${ computeProjectionCandidateDesign.precisionBehavior.fallbackPrecision }.`
	);

	lines.push(
		'',
		'## Compute Projection Implementation Readiness Checklist',
		'',
		`- Status: ${ computeProjectionReadiness.status }`,
		`- Verdict: ${ computeProjectionReadiness.verdict }`,
		`- Current contract: ${ computeProjectionReadiness.currentContractStatus }`,
		`- Required runtime status: ${ computeProjectionReadiness.requiredRuntimeStatus }`,
		`- Runtime markers allowed: ${ computeProjectionReadiness.runtimeMarkersAllowed }`,
		`- Public API change allowed: ${ computeProjectionReadiness.publicApiChangeAllowed }`,
		`- Proof-only done: ${ computeProjectionReadiness.proofOnlyDone }`,
		`- Runtime done: ${ computeProjectionReadiness.runtimeDone }`,
		'',
		'| Completed phase | Status | Result |',
		'|---|---|---|',
		...computeProjectionReadiness.completedPhases.map( phase => [
			phase.id,
			phase.status,
			phase.result
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) ),
		'',
		'| Runtime blocker | Status | Required for | Reason |',
		'|---|---|---|---|',
		...computeProjectionReadiness.blockersBeforeRuntime.map( blocker => [
			blocker.id,
			blocker.status,
			blocker.requiredFor,
			blocker.reason
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) ),
		'',
		`- Proof-only completion: ${ computeProjectionReadiness.completionDefinition.proofOnlyCandidatePhase }`,
		`- Runtime completion: ${ computeProjectionReadiness.completionDefinition.runtimeImplementationPhase }`,
		`- Next legal state: ${ computeProjectionReadiness.completionDefinition.nextLegalState }`,
		'',
		'```mermaid',
		...computeProjectionReadiness.phaseDiagram,
		'```'
	);

	const computeProjectionOracle = report.currentEvidence.performanceEvidence.computeProjectionCandidateOracle;
	const computeProjectionFallbackOracle = report.currentEvidence.performanceEvidence.computeProjectionAdapterFallbackOracle;
	const computeProjectionAtlasOracle = report.currentEvidence.performanceEvidence.computeProjectionAtlasRepackOracle;
	const computeProjectionRuntimeParity = report.currentEvidence.performanceEvidence.computeProjectionRuntimeParityEvidence;
	const computeProjectionProfiling = report.currentEvidence.performanceEvidence.computeProjectionProfilingEvidence;

	lines.push(
		'',
		'## Compute Projection Candidate Oracle',
		'',
		`- Status: ${ computeProjectionOracle.status }`,
		`- Runtime introduced: ${ computeProjectionOracle.runtimePathIntroduced }`,
		`- Baseline: ${ computeProjectionOracle.baselinePath } (${ computeProjectionOracle.baselineCubemapSweepsPerProbe } sweeps/probe).`,
		`- Candidate: ${ computeProjectionOracle.candidatePath } (${ computeProjectionOracle.candidateCubemapSweepsPerProbe } sweep/probe).`,
		`- Max candidate-to-fragment delta: ${ computeProjectionOracle.maxCandidateToFragmentDelta } / tolerance ${ computeProjectionOracle.tolerance }.`,
		'',
		'## Compute Projection Atlas Repack Oracle',
		'',
		`- Status: ${ computeProjectionAtlasOracle.status }`,
		`- Runtime introduced: ${ computeProjectionAtlasOracle.runtimePathIntroduced }`,
		`- Source path: ${ computeProjectionAtlasOracle.sourcePath }`,
		`- Repack path: ${ computeProjectionAtlasOracle.repackPath }`,
		`- Max readback delta: ${ computeProjectionAtlasOracle.maxReadbackDelta } / tolerance ${ computeProjectionAtlasOracle.readbackTolerance }.`,
		`- Remaining evidence after pass: ${ computeProjectionAtlasOracle.openEvidenceAfterPass?.join( ', ' ) ?? 'n/a' }.`,
		'',
		'## Compute Projection Runtime Readback Parity',
		'',
		`- Status: ${ computeProjectionRuntimeParity.status }`,
		`- Baseline backend: ${ computeProjectionRuntimeParity.fragmentBackend ?? computeProjectionRuntimeParity.baselinePath }`,
		`- Compute backend: ${ computeProjectionRuntimeParity.computeBackend ?? computeProjectionRuntimeParity.candidatePath }`,
		`- Coefficient max delta: ${ computeProjectionRuntimeParity.coefficientMaxDelta } / tolerance ${ computeProjectionRuntimeParity.coefficientTolerance }.`,
		`- Atlas max delta: ${ computeProjectionRuntimeParity.atlasMaxDelta } / tolerance ${ computeProjectionRuntimeParity.atlasTolerance }.`,
		`- Tolerance validation: coefficients=${ computeProjectionRuntimeParity.coefficientPass }, atlas=${ computeProjectionRuntimeParity.atlasPass }, overall=${ computeProjectionRuntimeParity.tolerancePass }.`,
		'',
		'## Compute Projection Diagnostic Profiling',
		'',
		`- Status: ${ computeProjectionProfiling.status }`,
		`- Timing policy: ${ computeProjectionProfiling.timingPolicy }; GPU timer query: ${ computeProjectionProfiling.gpuTimerQueryStatus }; gated=${ computeProjectionProfiling.timingGated }.`,
		`- Projection phase timing: ${ computeProjectionProfiling.projectionPhaseTimingStatus }; sources=${ ( computeProjectionProfiling.projectionTimingSources ?? [] ).join( ', ' ) || 'n/a' }.`,
		`- Static work: ${ computeProjectionProfiling.staticWork.fragmentTexelVisits } → ${ computeProjectionProfiling.staticWork.computeTexelVisits } cubemap texel visits (${ computeProjectionProfiling.staticWork.reductionPercent }% fewer).`,
		`- Projection median: fragment ${ computeProjectionProfiling.fragment?.projectionMs?.median } ms, compute ${ computeProjectionProfiling.compute?.projectionMs?.median } ms, diagnostic speedup ${ computeProjectionProfiling.projectionMedianSpeedupRatio ?? 'n/a' }x.`,
		`- Total bake median: fragment ${ computeProjectionProfiling.fragment?.totalBakeMs?.median } ms, compute ${ computeProjectionProfiling.compute?.totalBakeMs?.median } ms, diagnostic speedup ${ computeProjectionProfiling.totalBakeMedianSpeedupRatio ?? 'n/a' }x.`,
		`- Claim boundary: ${ computeProjectionProfiling.claimBoundary }`,
		'',
		'## Compute Projection Adapter Fallback Oracle',
		'',
		`- Status: ${ computeProjectionFallbackOracle.status }`,
		`- Runtime introduced: ${ computeProjectionFallbackOracle.runtimePathIntroduced }`,
		`- Public API changed: ${ computeProjectionFallbackOracle.publicApiChanged }`,
		`- Default path: ${ computeProjectionFallbackOracle.defaultPath }`,
		`- Candidate path: ${ computeProjectionFallbackOracle.candidatePath }`,
		'',
		'| Scenario | Contract status | Compute | Storage texture | Selected path | Fallback |',
		'|---|---|---:|---:|---|---:|',
		...computeProjectionFallbackOracle.scenarios.map( scenario => [
			scenario.label,
			scenario.contractStatus,
			scenario.supportsComputeProjection,
			scenario.supportsStorageTexture,
			scenario.selectedPath,
			scenario.fallbackUsed
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) )
	);

	appendLightProbeProofResearchMarkdown( lines, report );


	appendLightProbeProofDiagnosticMarkdown( lines, report );
	const revisionTasks = report.currentEvidence.revisionTaskBacklog;

	lines.push(
		'',
		'## Revision Task Backlog',
		'',
		`- Status: ${ revisionTasks.status }`,
		`- Current phase: ${ revisionTasks.currentPhase }`,
		`- Execution boundary: ${ revisionTasks.executionBoundary }`,
		'',
		'| Task | Status | Output | Gate |',
		'|---|---|---|---|'
	);

	for ( const task of revisionTasks.tasks ) {

		lines.push( [
			`${ task.id }: ${ task.title }`,
			task.status,
			task.output,
			task.gate
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Next actions',
		...revisionTasks.nextActions.map( item => `- ${ item }` ),
		'',
		'### Stop conditions',
		...revisionTasks.stopConditions.map( item => `- ${ item }` ),
		'',
		'## Density Artifact Study',
		'',
		'| Control | Role | Object black-tail | Black-tail delta | Luminance floor | Luminance delta | Edge delta | Status |',
		'|---|---|---:|---:|---:|---:|---:|---|',
		[
			'reference',
			'stress',
			report.currentEvidence.densityArtifactStudy.reference.objectBlackTailRatio,
			0,
			report.currentEvidence.densityArtifactStudy.reference.luminanceFloor,
			0,
			0,
			report.currentEvidence.densityArtifactStudy.reference.status
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ),
		[
			'shadowless',
			'cause-control',
			report.currentEvidence.densityArtifactStudy.shadowless.objectBlackTailRatio,
			report.currentEvidence.densityArtifactStudy.shadowless.objectBlackTailDelta,
			report.currentEvidence.densityArtifactStudy.shadowless.luminanceFloor,
			report.currentEvidence.densityArtifactStudy.shadowless.luminanceFloorDelta,
			report.currentEvidence.densityArtifactStudy.shadowless.cellEdgeContrastDelta,
			report.currentEvidence.densityArtifactStudy.shadowless.status
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ),
		[
			'shadow-crisp',
			'direct-shadow-control',
			report.currentEvidence.densityArtifactStudy.shadowCrisp.objectBlackTailRatio,
			report.currentEvidence.densityArtifactStudy.shadowCrisp.objectBlackTailDelta,
			report.currentEvidence.densityArtifactStudy.shadowCrisp.luminanceFloor,
			report.currentEvidence.densityArtifactStudy.shadowCrisp.luminanceFloorDelta,
			report.currentEvidence.densityArtifactStudy.shadowCrisp.cellEdgeContrastDelta,
			report.currentEvidence.densityArtifactStudy.shadowCrisp.status
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ),
		[
			'damped',
			'quality-candidate',
			report.currentEvidence.densityArtifactStudy.damped.objectBlackTailRatio,
			report.currentEvidence.densityArtifactStudy.damped.objectBlackTailDelta,
			report.currentEvidence.densityArtifactStudy.damped.luminanceFloor,
			report.currentEvidence.densityArtifactStudy.damped.luminanceFloorDelta,
			report.currentEvidence.densityArtifactStudy.damped.cellEdgeContrastDelta,
			report.currentEvidence.densityArtifactStudy.damped.status
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' )
	);

	const webglLeakReferenceStudy = report.currentEvidence.webglLeakReferenceStudy;

	lines.push(
		'',
		'### Bounded WebGL Leak Reference',
		'',
		`- Status: ${ webglLeakReferenceStudy.status }`,
		`- Boundary: ${ webglLeakReferenceStudy.proofBoundary }`,
		`- Attempt: ${ webglLeakReferenceStudy.sealedWallAttempt.attempted }`,
		`- Reason: ${ webglLeakReferenceStudy.sealedWallAttempt.reason }`
	);

	const metricTaxonomyStudy = report.currentEvidence.metricTaxonomyStudy;

	lines.push(
		'',
		'## Metric Taxonomy Study',
		'',
		`- Status: ${ metricTaxonomyStudy.status }`,
		`- Boundary: ${ metricTaxonomyStudy.proofBoundary }`,
		`- Failure domain: ${ metricTaxonomyStudy.currentFailureDomain }`,
		`- Promotion principle: ${ metricTaxonomyStudy.promotionPrinciple }`,
		`- Scene-linear target gate: ${ metricTaxonomyStudy.gates.sceneLinearTargetGate }`,
		`- Contribution gate: ${ metricTaxonomyStudy.gates.contributionGate }`,
		`- Probe-content contribution attribution gate: ${ metricTaxonomyStudy.gates.probeContentContributionAttributionGate }`,
		`- Presentation use: ${ metricTaxonomyStudy.gates.presentationGateUse }`,
		`- Chebyshev tuning: ${ metricTaxonomyStudy.gates.chebyshevTuning }`,
		'',
		'| Metric | Space | Promotion eligible | Current gate | Notes |',
		'|---|---|---:|---|---|'
	);

	for ( const metric of metricTaxonomyStudy.metrics ) {

		lines.push( [
			metric.key,
			metric.space,
			metric.promotionEligible,
			metric.currentGate,
			metric.notes
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	const probeContentContributionAttribution = report.currentEvidence.probeContentContributionAttribution;

	lines.push(
		'',
		'## Probe Content Contribution Attribution',
		'',
		`- Status: ${ probeContentContributionAttribution.status }`,
		`- Boundary: ${ probeContentContributionAttribution.proofBoundary }`,
		`- Contribution gate: ${ probeContentContributionAttribution.currentGate.status }`,
		`- Dominant contribution blocker: ${ probeContentContributionAttribution.currentGate.dominantBlocker }`,
		`- Dominant explained source: ${ probeContentContributionAttribution.summary.dominantExplainedSource }`,
		`- Attribution strength: ${ probeContentContributionAttribution.summary.attributionStrength }`,
		`- Runtime promotion allowed: ${ probeContentContributionAttribution.runtimePromotionAllowed }`,
		`- Next proof-only action: ${ probeContentContributionAttribution.summary.nextProofOnlyAction }`,
		`- Conclusion: ${ probeContentContributionAttribution.summary.diagnosticConclusion }`,
		'',
		'| Evidence | Status/value |',
		'|---|---|',
		`| Receiver albedo cleared | ${ probeContentContributionAttribution.clearedNonContentSources.receiverAlbedoCleared } |`,
		`| Direct/ambient cleared | ${ probeContentContributionAttribution.clearedNonContentSources.directAmbientCleared } |`,
		`| Probe-content chroma status | ${ probeContentContributionAttribution.contentEvidence.probeContentChromaStatus } |`,
		`| Bake contamination status | ${ probeContentContributionAttribution.contentEvidence.probeBakeContaminationStatus } |`,
		`| Surface content status | ${ probeContentContributionAttribution.contentEvidence.surfaceShContentStatus } |`,
		`| Surface split status | ${ probeContentContributionAttribution.contentEvidence.surfaceContentAttributionSplitStatus } |`,
		`| Dominant probe/coefficient | ${ probeContentContributionAttribution.contentEvidence.probeBakeDominantProbeIndex } / ${ probeContentContributionAttribution.contentEvidence.probeBakeDominantCoefficientName } |`,
		`| Mapped/unmapped leak samples | ${ probeContentContributionAttribution.contentEvidence.mappedLeakSampleCount } / ${ probeContentContributionAttribution.contentEvidence.unmappedLeakSampleCount } |`
	);

	const wgpuLeakAuditStudy = report.currentEvidence.wgpuLeakAuditStudy;

	lines.push(
		'',
		'## WebGPU Leak Audit Study',
		'',
		`- Status: ${ wgpuLeakAuditStudy.status }`,
		`- Boundary: ${ wgpuLeakAuditStudy.proofBoundary }`,
		`- Suspected leak domain: ${ wgpuLeakAuditStudy.verdict.suspectedLeakDomain }`,
		`- Promotion gate: ${ wgpuLeakAuditStudy.verdict.promotionGate }`,
		`- Promotion metric: ${ wgpuLeakAuditStudy.verdict.promotionMetricMode }`,
		`- Presentation gate: ${ wgpuLeakAuditStudy.verdict.presentationGate }`,
		`- Linear promotion status: ${ wgpuLeakAuditStudy.linearPromotionStudy.status }`,
		`- Linear promotion wrong-side improvement: ${ wgpuLeakAuditStudy.linearPromotionStudy.metrics.preToneMaskedWrongSideImprovement }`,
		`- Linear promotion correct-bounce preservation: ${ wgpuLeakAuditStudy.linearPromotionStudy.metrics.preToneMaskedCorrectBouncePreservation }`,
		`- CPU/GPU linear gate: ${ wgpuLeakAuditStudy.verdict.cpuGpuLinearGate }`,
		`- Weight-term gate: ${ wgpuLeakAuditStudy.verdict.weightTermGate }`,
		`- CPU/render gate: ${ wgpuLeakAuditStudy.verdict.cpuRenderAgreementGate }`,
		`- Chebyshev tuning: ${ wgpuLeakAuditStudy.verdict.chebyshevTuning }`,
		'',
		'| Variant | Role | Fixture | Weighted | Dilation | Visibility depth | Wrong-side | Surface wrong-side | Masked wrong-side | Pre-tone masked wrong-side | Correct bounce | Pre-tone correct bounce |',
		'|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|'
	);

	for ( const variant of wgpuLeakAuditStudy.variants ) {

		lines.push( [
			variant.label,
			variant.role,
			variant.fixtureMode,
			variant.weightedProbeSampling,
			variant.probeDilationMode,
			variant.visibilityDepthEnabled,
			variant.wrongSideColorRatio,
			variant.surfaceWrongSideColorRatio,
			variant.maskedWrongSideColorRatio,
			variant.preToneMaskedWrongSideColorRatio,
			variant.correctBounceRatio,
			variant.preToneMaskedCorrectBounceRatio
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'| Receiver | Render wrong/correct | Masked wrong/correct | CPU runtime wrong/correct | Scalar weight | Visibility weight | GPU linear delta | Weight-term delta |',
		'|---|---:|---:|---:|---:|---:|---:|---:|'
	);

	for ( const receiver of wgpuLeakAuditStudy.receivers ) {

		lines.push( [
			receiver.label,
			receiver.renderRegionWrongOverCorrect,
			receiver.maskedRegionWrongOverCorrect,
			receiver.cpuRuntimeWrongOverCorrect,
			receiver.totalScalarWeight,
			receiver.totalVisibilityWeight,
			receiver.gpuLinearRgbDeltaMeanForReceiverSamples,
			receiver.weightTermDeltaMeanForReceiverSamples
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'| Receiver | Probe | Source | Side | Source side | Relation | Source relation | Scalar weight | Visibility weight | Norm visibility weight | CPU wrong/correct | CPU chroma pressure | L0 chroma pressure | Escape reason |',
		'|---|---:|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|---|'
	);

	for ( const receiver of wgpuLeakAuditStudy.receivers ) {

		for ( const row of receiver.rows ) {

			lines.push( [
				receiver.label,
				row.probeIndex,
				row.sourceProbeIndex,
				row.side,
				row.sourceSide,
				row.relationToReceiver,
				row.sourceRelationToReceiver,
				row.scalarWeight,
				row.visibilityWeight,
				row.finalNormalizedVisibilityWeight,
				row.cpuWrongOverCorrect,
				row.cpuChromaWrongMinusCorrect,
				row.cpuL0ChromaWrongMinusCorrect,
				row.escapeReason
			].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

		}

	}

	lines.push(
		'',
		'## Direct Shadow Control Study',
		'',
		`- Status: ${ report.currentEvidence.directShadowControlStudy.status }`,
		`- Boundary: ${ report.currentEvidence.directShadowControlStudy.proofBoundary }`,
		`- Diagnosis: ${ report.currentEvidence.directShadowControlStudy.diagnosis }`,
		'',
		'| Control | Shadow map | Radius | Normal bias | Object black-tail | Luminance floor | Edge contrast |',
		'|---|---:|---:|---:|---:|---:|---:|',
		[
			'default-soft',
			report.currentEvidence.directShadowControlStudy.defaultSoft.directShadowControl.mapSize,
			report.currentEvidence.directShadowControlStudy.defaultSoft.directShadowControl.radius,
			report.currentEvidence.directShadowControlStudy.defaultSoft.directShadowControl.normalBias,
			report.currentEvidence.directShadowControlStudy.defaultSoft.artifactPressure.objectBlackTailRatio,
			report.currentEvidence.directShadowControlStudy.defaultSoft.artifactPressure.luminanceFloor,
			report.currentEvidence.directShadowControlStudy.defaultSoft.artifactPressure.cellEdgeContrast
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ),
		[
			'crisp',
			report.currentEvidence.directShadowControlStudy.crispShadow.directShadowControl.mapSize,
			report.currentEvidence.directShadowControlStudy.crispShadow.directShadowControl.radius,
			report.currentEvidence.directShadowControlStudy.crispShadow.directShadowControl.normalBias,
			report.currentEvidence.directShadowControlStudy.crispShadow.artifactPressure.objectBlackTailRatio,
			report.currentEvidence.directShadowControlStudy.crispShadow.artifactPressure.luminanceFloor,
			report.currentEvidence.directShadowControlStudy.crispShadow.artifactPressure.cellEdgeContrast
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' )
	);

	lines.push(
		'',
		'## DDGI-lite Leak Verifier Matrix',
		'',
		'| Case | Fixture | Weighted | Validity | Wrong-side ratio | Correct-bounce ratio | Dark ratio | Edge contrast | Status |',
		'|---|---:|---:|---:|---:|---:|---:|---:|---|'
	);

	for ( const row of report.leakMatrix.rows ) {

		lines.push( [
			row.label,
			row.fixtureMode,
			row.sampling.weightedProbeSampling,
			row.sampling.probeValidityMode,
			row.leakMetrics.wrongSideColorRatio,
			row.leakMetrics.correctBounceRatio,
			row.leakMetrics.darkPixelRatio,
			row.leakMetrics.cellEdgeContrast,
			row.negativeControlStatus
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'## Rejection Gates',
		...report.rejectionGates.map( gate => `- ${ gate.result.toUpperCase() }: ${ gate.gate }` ),
		'',
		'## Uncertainties',
		...report.uncertainties.map( uncertainty => `- ${ uncertainty.status }: ${ uncertainty.item }` ),
		'',
		`## Verdict\n${ report.verdict }`
	);

	return `${ lines.join( '\n' ) }\n`;

}
