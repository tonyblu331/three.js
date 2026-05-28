import { assertLightProbeProof } from './lightprobegrid-gpu-proof-validation.js';

export function assertLightProbePerformanceEvidenceContract( file, evidence, lightProbeWebGLReferenceLabel ) {

	const performance = evidence.performanceEvidence;
	const projectionShape = performance.projectionShapeProfile;
	const designSketch = performance.computeProjectionDesignSketch;
	const parityPlan = performance.computeProjectionParityEvidencePlan;
	const transitionGuard = performance.computeProjectionStatusTransitionGuard;
	const candidateDesign = performance.computeProjectionCandidateImplementationDesign;
	const readiness = performance.computeProjectionImplementationReadinessChecklist;
	const candidateOracle = performance.computeProjectionCandidateOracle;
	const adapterFallbackOracle = performance.computeProjectionAdapterFallbackOracle;
	const atlasRepackOracle = performance.computeProjectionAtlasRepackOracle;
	const runtimeParity = performance.computeProjectionRuntimeParityEvidence;
	const profiling = performance.computeProjectionProfilingEvidence;
	const backlog = evidence.revisionTaskBacklog;

	assertLightProbeProof( file,
		performance.bakeTexelBudgetStatus === 'asserted' &&
		performance.measuredTimingStatus === 'reported-not-gated' &&
		projectionShape?.status === 'OPEN-FRAGMENT-COEFFICIENT-PROJECTION-REDUNDANCY' &&
		projectionShape.coefficientPixelsPerProbe === 9 &&
		projectionShape.cubemapSweepsPerProbe === 9 &&
		projectionShape.computeCubemapSweepsPerProbe === 1 &&
		projectionShape.staticWorkReductionPercent === 88.8889 &&
		projectionShape.duplicatedCubemapIntegrationFactor === 9 &&
		performance.snapshotBakeTimings.every( timing => timing > 0 ) &&
		evidence.webglReference?.label === lightProbeWebGLReferenceLabel,
		'grounding parity artifact: proof report must keep cubemap texel budget as the performance gate, profile projection-shape redundancy, report positive non-gated bake timings, and persist the WebGL reference.' );

	assertLightProbeProof( file,
		designSketch?.status === 'DESIGN-SKETCH-IMPLEMENTED-AS-GUARDED-RUNTIME' &&
		/guarded TSL compute node/i.test( designSketch.nonGoal ) &&
		/current atlas repack input contract/i.test( designSketch.storageLayout.output ) &&
		/one cubemap sweep per probe/i.test( designSketch.reductionContract.sweepCount ) &&
		/current SH basis constants/i.test( designSketch.reductionContract.basisContract ) &&
		/_repackAtlas/i.test( designSketch.outputPackingContract.coefficientRows ) &&
		designSketch.parityTolerance.maxCoefficientDelta === 0.0001 &&
		designSketch.parityTolerance.fixtures.includes( 'face-asymmetric' ) &&
		designSketch.fallbackBehavior.defaultPath === 'fragment-coefficient-projection' &&
		designSketch.architectureDiagram.includes( 'flowchart LR' ) &&
		designSketch.architectureDiagram.some( line => /fragment fallback remains active/.test( line ) ),
		'grounding parity artifact: compute projection design sketch must cover guarded runtime status, storage layout, reduction, packing, parity tolerance, architecture diagram, and fragment fallback.' );

	assertLightProbeProof( file,
		[ 'CAPTURED-RUNTIME-PARITY-EVIDENCE', 'CAPTURED-PROOF-ONLY-RUNTIME-READBACK-PENDING' ].includes( parityPlan?.status ) &&
		/runtime/i.test( parityPlan.runtimeBoundary ) &&
		parityPlan.capturedEvidence.includes( 'compute-fixture-parity' ) &&
		parityPlan.capturedEvidence.includes( 'compute-atlas-repack-parity' ) &&
		parityPlan.capturedEvidence.includes( 'compute-adapter-fallback' ) &&
		( parityPlan.capturedEvidence.includes( 'compute-runtime-readback-parity' ) ||
			parityPlan.openEvidence.includes( 'compute-runtime-readback-parity' ) ) &&
		parityPlan.requiredEvidence.length === 4 &&
		parityPlan.requiredEvidence.some( evidence => evidence.id === 'compute-fixture-parity' &&
			evidence.captureStatus === 'CAPTURED-PROOF-ONLY-MOCK-PASSING' &&
			evidence.baseline === 'fragment-coefficient-projection' &&
			evidence.candidate === 'compute-probe-reduction' &&
			evidence.requiredFixtures.includes( 'face-asymmetric' ) &&
			/0\.0001/.test( evidence.passCondition ) &&
			evidence.actualMaxDelta <= 0.0001
		) &&
		parityPlan.requiredEvidence.some( evidence => evidence.id === 'compute-atlas-repack-parity' &&
			evidence.captureStatus === 'CAPTURED-PROOF-ONLY-ATLAS-REPACK-PASSING' &&
			/_repackAtlas/.test( evidence.baseline ) &&
			/padding\/validity contracts/.test( evidence.passCondition ) &&
			evidence.actualMaxDelta <= 0.008
		) &&
		parityPlan.requiredEvidence.some( evidence => evidence.id === 'compute-adapter-fallback' &&
			evidence.captureStatus === 'CAPTURED-RUNTIME-GUARDED-ADAPTER-FALLBACK-PASSING' &&
			evidence.baseline === 'fragment-coefficient-projection' &&
			/unsupported adapters keep fragment-coefficient-projection/.test( evidence.passCondition ) &&
			evidence.actualScenarioCount >= 4
		) &&
		parityPlan.requiredEvidence.some( evidence => evidence.id === 'compute-runtime-readback-parity' &&
			[ 'CAPTURED-RUNTIME-READBACK-PASSING', 'OPEN-NOT-CAPTURED' ].includes( evidence.captureStatus ) &&
			evidence.baseline === 'fragment-coefficient-projection' &&
			evidence.candidate === 'compute-probe-reduction' &&
			/runtime-low-res-cornell-coefficients/.test( evidence.requiredFixtures.join( ' ' ) ) &&
			( evidence.captureStatus === 'OPEN-NOT-CAPTURED' ||
				( evidence.actualCoefficientMaxDelta <= runtimeParity.coefficientTolerance &&
					evidence.actualAtlasMaxDelta <= runtimeParity.atlasTolerance ) )
		) &&
		parityPlan.statusTransition.previous === 'PARITY-CANDIDATE-NOT-RUNTIME' &&
		[ 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY', 'IMPLEMENTED-WITH-PARITY-EVIDENCE' ].includes( parityPlan.statusTransition.current ) &&
		parityPlan.statusTransition.nextRuntime === 'IMPLEMENTED-WITH-PARITY-EVIDENCE' &&
		parityPlan.statusTransition.promoted === 'IMPLEMENTED-WITH-PARITY-EVIDENCE',
		'grounding parity artifact: compute projection parity evidence plan must specify fixture parity, atlas repack parity, adapter fallback, runtime readback, and status transition.' );

	assertLightProbeProof( file,
		[ 'RUNTIME-PARITY-EVIDENCE-CAPTURED', 'GUARDED-RUNTIME-IMPLEMENTED-PARITY-PENDING' ].includes( transitionGuard?.status ) &&
		[ 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY', 'IMPLEMENTED-WITH-PARITY-EVIDENCE' ].includes( transitionGuard.currentContractStatus ) &&
		[ 'CAPTURED-RUNTIME-PARITY-EVIDENCE', 'CAPTURED-PROOF-ONLY-RUNTIME-READBACK-PENDING' ].includes( transitionGuard.evidencePlanStatus ) &&
		transitionGuard.allowedNextContractStatus === 'IMPLEMENTED-WITH-PARITY-EVIDENCE' &&
		transitionGuard.runtimeStatusRequired === 'IMPLEMENTED-WITH-PARITY-EVIDENCE' &&
		transitionGuard.runtimeMarkersAllowed === true &&
		transitionGuard.publicApiChangeAllowed === false &&
		transitionGuard.blockedRuntimeMarkers.includes( 'computeProjectionPipeline' ) &&
		/IMPLEMENTED-WITH-PARITY-EVIDENCE|IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY/.test( transitionGuard.guardRule ) &&
		/runtime parity readback|coefficients and atlas repack/.test( transitionGuard.promotionBoundary ),
		'grounding parity artifact: compute projection transition guard must record runtime parity evidence while retaining fallback boundaries.' );

	assertLightProbeProof( file,
		candidateDesign?.status === 'CANDIDATE-DESIGN-NOTE-PROOF-ONLY' &&
		/does not introduce hand-written WGSL/.test( candidateDesign.nonGoal ) &&
		/one logical dispatch group per probe/.test( candidateDesign.dispatchShape.unit ) &&
		/c0\.\.c8 RGB/.test( candidateDesign.dispatchShape.work ) &&
		/_repackAtlas/.test( candidateDesign.storageLayout.output ) &&
		/4π \/ totalWeight/.test( candidateDesign.workgroupStrategy.phase3 ) &&
		candidateDesign.outputContract.parityInputs.includes( 'compute-adapter-fallback' ) &&
		candidateDesign.fallbackBranch.default === 'fragment-coefficient-projection' &&
		candidateDesign.fallbackBranch.candidate === 'compute-probe-reduction' &&
		/IMPLEMENTED-WITH-PARITY-EVIDENCE/.test( candidateDesign.fallbackBranch.rule ) &&
		candidateDesign.precisionBehavior.coefficientTolerance === 0.0001 &&
		candidateDesign.precisionBehavior.atlasReadbackTolerance === 0.008,
		'grounding parity artifact: compute projection candidate design note must specify dispatch, storage, workgroup, output, fallback, and precision behavior.' );

	assertLightProbeProof( file,
		[ 'RUNTIME-PARITY-READBACK-PASSING', 'RUNTIME-IMPLEMENTED-PARITY-READBACK-PENDING' ].includes( readiness?.status ) &&
		/guarded compute projection runtime path|readback-validated/.test( readiness.verdict ) &&
		[ 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY', 'IMPLEMENTED-WITH-PARITY-EVIDENCE' ].includes( readiness.currentContractStatus ) &&
		readiness.requiredRuntimeStatus === 'IMPLEMENTED-WITH-PARITY-EVIDENCE' &&
		readiness.runtimeMarkersAllowed === true &&
		readiness.publicApiChangeAllowed === false &&
		typeof readiness.proofOnlyDone === 'boolean' &&
		typeof readiness.runtimeDone === 'boolean' &&
		typeof readiness.runtimeParityReadbackDone === 'boolean' &&
		readiness.completedPhases.some( phase => phase.id === 'contract-gate' ) &&
		readiness.completedPhases.some( phase => phase.id === 'atlas-repack-parity' ) &&
		readiness.blockersBeforeRuntime.some( blocker => blocker.id === 'wgsl-compute-entrypoint' ) &&
		readiness.blockersBeforeRuntime.some( blocker =>
			blocker.id === 'actual-runtime-parity-readback' &&
			[ 'PASSED-BROWSER-E2E', 'PENDING-BROWSER-E2E' ].includes( blocker.status ) &&
			/actual compute output|read back/.test( blocker.reason )
		) &&
		readiness.completionDefinition.nextLegalState === 'IMPLEMENTED-WITH-PARITY-EVIDENCE' &&
		readiness.phaseDiagram.includes( 'flowchart TD' ),
		'grounding parity artifact: compute projection implementation readiness checklist must record guarded runtime implementation and runtime parity readback state.' );

	assertLightProbeProof( file,
		candidateOracle?.status === 'PROOF-ONLY-MOCK-PARITY-PASSING' &&
		candidateOracle.runtimePathIntroduced === false &&
		candidateOracle.baselinePath === 'fragment-coefficient-projection' &&
		candidateOracle.candidatePath === 'compute-probe-reduction' &&
		candidateOracle.baselineCubemapSweepsPerProbe === 9 &&
		candidateOracle.candidateCubemapSweepsPerProbe === 1 &&
		candidateOracle.maxCandidateToFragmentDelta <= candidateOracle.tolerance &&
		candidateOracle.fixtures.every( fixture => fixture.candidateToFragmentDelta <= candidateOracle.tolerance ),
		'grounding parity artifact: proof-only compute projection candidate oracle must pass synthetic fixture parity without introducing runtime.' );

	assertLightProbeProof( file,
		adapterFallbackOracle?.status === 'RUNTIME-GUARDED-ADAPTER-FALLBACK-SPEC-PASSING' &&
		adapterFallbackOracle.runtimePathIntroduced === true &&
		adapterFallbackOracle.publicApiChanged === false &&
		adapterFallbackOracle.defaultPath === 'fragment-coefficient-projection' &&
		adapterFallbackOracle.candidatePath === 'compute-probe-reduction' &&
		adapterFallbackOracle.scenarios.some( scenario => scenario.label === 'runtime-implemented-adapter-supported' &&
			scenario.contractStatus === 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY' &&
			scenario.selectedPath === 'compute-probe-reduction' &&
			scenario.fallbackUsed === false
		) &&
		adapterFallbackOracle.scenarios.some( scenario => scenario.label === 'unsupported-compute-capability' &&
			scenario.selectedPath === 'fragment-coefficient-projection' &&
			scenario.fallbackUsed === true
		) &&
		adapterFallbackOracle.scenarios.some( scenario => scenario.label === 'unsupported-storage-texture-capability' &&
			scenario.selectedPath === 'fragment-coefficient-projection' &&
			scenario.fallbackUsed === true
		) &&
		adapterFallbackOracle.scenarios.some( scenario => scenario.label === 'promoted-supported-candidate' &&
			scenario.selectedPath === 'compute-probe-reduction' &&
			scenario.fallbackUsed === false
		),
		'grounding parity artifact: guarded compute adapter fallback oracle must select compute only when runtime is implemented and capabilities exist.' );

	assertLightProbeProof( file,
		atlasRepackOracle?.status === 'PROOF-ONLY-ATLAS-REPACK-PARITY-PASSING' &&
		atlasRepackOracle.runtimePathIntroduced === false &&
		atlasRepackOracle.sourcePath === 'compute-written coefficientTarget-compatible rows' &&
		atlasRepackOracle.repackPath === '_repackAtlas' &&
		atlasRepackOracle.maxReadbackDelta <= atlasRepackOracle.readbackTolerance &&
		atlasRepackOracle.openEvidenceAfterPass.includes( 'compute-adapter-fallback' ),
		'grounding parity artifact: proof-only compute atlas repack oracle must prove candidate rows survive existing atlas packing while adapter fallback remains open.' );

	assertLightProbeProof( file,
		runtimeParity?.status === 'RUNTIME-PARITY-READBACK-PASSING' &&
		runtimeParity.baselinePath === 'fragment-coefficient-projection' &&
		runtimeParity.candidatePath === 'compute-probe-reduction' &&
		runtimeParity.computeBackend === 'compute-probe-reduction' &&
		runtimeParity.computeFallbackReason === null &&
		runtimeParity.coefficientPass === true &&
		runtimeParity.atlasPass === true &&
		runtimeParity.tolerancePass === true &&
		Number.isFinite( runtimeParity.coefficientTolerance ) &&
		Number.isFinite( runtimeParity.atlasTolerance ) &&
		runtimeParity.coefficientMaxDelta <= runtimeParity.coefficientTolerance &&
		runtimeParity.atlasMaxDelta <= runtimeParity.atlasTolerance,
		'grounding parity artifact: runtime compute projection parity evidence must pass coefficients, atlas repack, and tolerance validation against fragment projection.' );

	assertLightProbeProof( file,
		profiling?.status === 'DIAGNOSTIC-PROJECTION-PROFILE-CAPTURED' &&
		profiling.timingPolicy === 'DIAGNOSTIC-PROJECTION-PHASE-NON-GATED' &&
		profiling.timingGated === false &&
		profiling.gpuTimerQueryStatus === 'NOT-CAPTURED' &&
		profiling.projectionPhaseTimingStatus === 'CAPTURED-NON-DETERMINISTIC-PERFORMANCE-NOW' &&
		profiling.projectionTimingSources.includes( 'non-deterministic-performance-now' ) &&
		profiling.staticWork.fragmentTexelVisits === 6912 &&
		profiling.staticWork.computeTexelVisits === 768 &&
		profiling.staticWork.savedTexelVisits === 6144 &&
		profiling.staticWork.reductionPercent === 88.8889 &&
		profiling.fragment.allRunsSelectedExpectedBackend === true &&
		profiling.compute.allRunsSelectedExpectedBackend === true &&
		profiling.compute.fallbackReasons.length === 0 &&
		Number.isFinite( profiling.fragment.projectionMs.median ) &&
		Number.isFinite( profiling.compute.projectionMs.median ) &&
		Number.isFinite( profiling.fragment.totalBakeMs.median ) &&
		Number.isFinite( profiling.compute.totalBakeMs.median ),
		'grounding parity artifact: compute projection profiling evidence must capture forced fragment/compute diagnostic timing while preserving the no-GPU-timer claim boundary.' );

	assertLightProbeProof( file,
		backlog.tasks.some( task => task.id === 'runtime-3' &&
			task.status === 'IMPLEMENTED-WITH-PARITY-EVIDENCE' &&
			/compute projection/i.test( `${ task.title } ${ task.output } ${ task.gate }` ) &&
			/browser\/runtime readback|browser readback/.test( `${ task.output } ${ task.gate }` )
		),
		'grounding parity artifact: compute projection runtime must be guarded and backed by actual parity readback, not an unverified full promotion.' );

	assertLightProbeProof( file,
		backlog.tasks.some( task => task.id === 'runtime-4' &&
			task.status === 'RUNTIME-PARITY-READBACK-PASSING' &&
			/compute projection candidate readiness checklist/i.test( task.title ) &&
			/guarded runtime implementation/.test( task.output ) &&
			/passing actual runtime parity readback/.test( task.output ) &&
			/fragment fallback/.test( task.gate )
		),
		'grounding parity artifact: compute projection runtime readiness must be implemented with passing parity readback and retained fragment fallback.' );

}
