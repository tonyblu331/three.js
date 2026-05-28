import { deriveVisibilityProofStatus, isMomentBackedVisibility } from './lightprobegrid-gpu-proof-visibility.js';

export function createLightProbeResearchReportSections( context ) {

	const {
		snapshots,
		visibilityMomentInspection,
		visibilityWeightingDiagnostic,
		sealedVisibilityWeightingDiagnostic,
		leakMatrix,
		cpuRenderAgreementTolerance,
		sealedRenderMetricMismatch,
		sealedReceiverNormalDiagnostic,
		sealedShContributionDiagnostic,
		sealedFailureDomain,
		surfaceAttributionBranchDecision,
		surfaceAttributionFollowupSpec,
		proof7cSurfaceStaticBlockerOracleStudy,
		proof7cDispositionStudy,
		surfaceContentAttributionSplitStudy,
		surfaceContentAttributionFollowupStudy,
		mappedBakeContentSourcePolicyOracleStudy,
		unmappedCoefficientAttributionInstrumentationStudy,
		aggregateExplanationComparisonStudy,
		proof7bCoefficientL10OracleStudy,
		probe50L10SignSourceIsolationOracleStudy,
		probe50L10ContentBasisPolarityOracleStudy,
		probe50CoefficientLocalCorrectionOracleStudy,
		probe50LocalCorrectionAggregateResidualGuardStudy,
		probe50L10ZDesignBoundConstraintsStudy,
		projectionParity,
		atlasPacking,
		computeProjectionRuntimeParity,
		computeProjectionProfiling
	} = context;

	const snapshotBakeTimings = snapshots.map( snapshot =>
		snapshot.metrics?.timings?.totalBakeMs ?? snapshot.totalBakeMs ?? 0
	);
	const positiveBakeTimings = snapshotBakeTimings.filter( timing => timing > 0 );
	const timingSources = snapshots.map( snapshot =>
		snapshot.metrics?.timings?.timingSource ?? 'unavailable'
	);
	const timingSourceCounts = timingSources.reduce( ( counts, source ) => {

		counts[ source ] = ( counts[ source ] ?? 0 ) + 1;
		return counts;

	}, {} );
	const computeProjectionCandidateOracle = projectionParity?.computeProjectionCandidateOracle ?? {
		status: 'UNAVAILABLE-NOT-CAPTURED',
		runtimePathIntroduced: false,
		baselinePath: 'fragment-coefficient-projection',
		candidatePath: 'compute-probe-reduction',
		maxCandidateToFragmentDelta: null,
		tolerance: 0.0001,
		fixtures: []
	};
	const computeProjectionAdapterFallbackOracle = projectionParity?.computeProjectionAdapterFallbackOracle ?? {
		status: 'UNAVAILABLE-NOT-CAPTURED',
		runtimePathIntroduced: false,
		publicApiChanged: false,
		defaultPath: 'fragment-coefficient-projection',
		candidatePath: 'compute-probe-reduction',
		scenarios: []
	};
	const computeProjectionAtlasRepackOracle = atlasPacking?.computeProjectionAtlasRepackOracle ?? {
		status: 'UNAVAILABLE-NOT-CAPTURED',
		runtimePathIntroduced: false,
		sourcePath: 'compute-written coefficientTarget-compatible rows',
		baselinePath: 'inspectAtlasPacking',
		repackPath: '_repackAtlas',
		maxReadbackDelta: null,
		readbackTolerance: 0.008,
		checkedLayers: []
	};
	const computeProjectionRuntimeParityEvidence = computeProjectionRuntimeParity ?? {
		status: 'UNAVAILABLE-NOT-CAPTURED',
		baselinePath: 'fragment-coefficient-projection',
		candidatePath: 'compute-probe-reduction',
		coefficientMaxDelta: null,
		atlasMaxDelta: null,
		coefficientTolerance: 0.035,
		atlasTolerance: 0.035,
		coefficientPass: false,
		atlasPass: false,
		tolerancePass: false,
		atlasChecks: []
	};
	const computeProjectionProfilingEvidence = computeProjectionProfiling ?? {
		status: 'UNAVAILABLE-NOT-CAPTURED',
		timingPolicy: 'DIAGNOSTIC-PROJECTION-PHASE-NON-GATED',
		timingGated: false,
		gpuTimerQueryStatus: 'NOT-CAPTURED',
		projectionPhaseTimingStatus: 'UNAVAILABLE-NOT-CAPTURED',
		projectionTimingSources: [],
		deterministicTimerDetected: false,
		staticWork: {
			fragmentCubemapSweepsPerProbe: 9,
			computeCubemapSweepsPerProbe: 1,
			reductionPercent: 88.8889
		},
		fragment: null,
		compute: null,
		projectionMedianSpeedupRatio: null,
		projectionMedianReductionPercent: null,
		totalBakeMedianSpeedupRatio: null,
		totalBakeMedianReductionPercent: null
	};
	const computeProjectionFixtureParityCaptured = computeProjectionCandidateOracle.status === 'PROOF-ONLY-MOCK-PARITY-PASSING';
	const computeProjectionAtlasRepackCaptured = computeProjectionAtlasRepackOracle.status === 'PROOF-ONLY-ATLAS-REPACK-PARITY-PASSING';
	const computeProjectionAdapterFallbackCaptured = [ 'PROOF-ONLY-ADAPTER-FALLBACK-PASSING', 'RUNTIME-GUARDED-ADAPTER-FALLBACK-SPEC-PASSING' ].includes( computeProjectionAdapterFallbackOracle.status );
	const computeProjectionRuntimeParityCaptured = computeProjectionRuntimeParityEvidence.status === 'RUNTIME-PARITY-READBACK-PASSING';
	const computeProjectionCapturedEvidence = [
		computeProjectionFixtureParityCaptured ? 'compute-fixture-parity' : null,
		computeProjectionAtlasRepackCaptured ? 'compute-atlas-repack-parity' : null,
		computeProjectionAdapterFallbackCaptured ? 'compute-adapter-fallback' : null,
		computeProjectionRuntimeParityCaptured ? 'compute-runtime-readback-parity' : null
	].filter( Boolean );
	const computeProjectionOpenEvidence = [
		computeProjectionFixtureParityCaptured ? null : 'compute-fixture-parity',
		computeProjectionAtlasRepackCaptured ? null : 'compute-atlas-repack-parity',
		computeProjectionAdapterFallbackCaptured ? null : 'compute-adapter-fallback',
		computeProjectionRuntimeParityCaptured ? null : 'compute-runtime-readback-parity'
	].filter( Boolean );
	const computeProjectionEvidencePlanStatus = computeProjectionOpenEvidence.length === 0 ?
		'CAPTURED-RUNTIME-PARITY-EVIDENCE' :
		computeProjectionOpenEvidence.length === 1 && computeProjectionOpenEvidence[ 0 ] === 'compute-runtime-readback-parity' ?
			'CAPTURED-PROOF-ONLY-RUNTIME-READBACK-PENDING' :
			computeProjectionCapturedEvidence.length > 0 ?
				'PARTIALLY-CAPTURED' :
				'SPECIFIED-NOT-CAPTURED';
	const computeProjectionContractStatus = projectionParity?.computeProjectionParityContract?.status ??
		'PLANNED-NOT-IMPLEMENTED';
	const computeProjectionPreviousContractStatus = projectionParity?.computeProjectionParityContract?.previousStatus ??
		'PLANNED-NOT-IMPLEMENTED';
	const computeProjectionRuntimeStatusRequired = projectionParity?.computeProjectionParityContract?.runtimeStatusRequired ??
		'IMPLEMENTED-WITH-PARITY-EVIDENCE';
	const computeProjectionEffectiveContractStatus = computeProjectionRuntimeParityCaptured ?
		computeProjectionRuntimeStatusRequired :
		computeProjectionContractStatus;
	const computeProjectionRuntimeMarkers = [
		'_createComputeProjection',
		'computeProjectionPipeline',
		'computeProjectionMaterial',
		'computeProjectionNode',
		'computeProjectionPass',
		'projectionCompute',
		'computeProbeReduction',
		'compute-probe-reduction'
	];
	const performanceEvidence = {
		bakeTexelBudgetStatus: 'asserted',
		measuredTimingStatus: positiveBakeTimings.length === snapshotBakeTimings.length ?
			'reported-not-gated' :
			'unavailable-or-zero-not-asserted',
		measuredTimingNote: 'Static cubemap texel work is the only performance gate. Positive bake timings are reported as diagnostics; under the deterministic e2e timer the harness uses performance._now as a wall-clock fallback for total bake time.',
		projectionShapeProfile: {
			status: 'OPEN-FRAGMENT-COEFFICIENT-PROJECTION-REDUNDANCY',
			currentShape: 'RenderTarget(SH_COEFFICIENTS,totalProbes) coefficient-fragment projection',
			coefficientPixelsPerProbe: 9,
			cubemapSweepsPerProbe: 9,
			computeCubemapSweepsPerProbe: computeProjectionProfilingEvidence.staticWork.computeCubemapSweepsPerProbe,
			duplicatedCubemapIntegrationFactor: 9,
			staticWorkReductionPercent: computeProjectionProfilingEvidence.staticWork.reductionPercent,
			nuance: 'The local shader does not compute all nine SH accumulators and then select one; each coefficient pixel selects coefficient from uv.x, then loops the full cubemap for that one coefficient.',
			nextShape: 'one WebGPU compute reduction per probe that sweeps the cubemap once and writes c0..c8 together',
			promotionBoundary: computeProjectionRuntimeParityCaptured ?
				'The guarded compute path has actual runtime readback parity evidence while fragment fallback remains retained.' :
				'The guarded compute path is implemented, but full promotion still requires actual runtime readback parity evidence and fragment fallback retention.'
		},
		computeProjectionProfilingEvidence,
		computeProjectionDesignSketch: {
			status: 'DESIGN-SKETCH-IMPLEMENTED-AS-GUARDED-RUNTIME',
			nonGoal: 'This design sketch is now implemented as a guarded TSL compute node, but it still does not authorize full parity promotion without runtime readback.',
			storageLayout: {
				input: 'existing per-probe cubeRenderTarget sampled with the same face/direction convention as fragment-coefficient-projection',
				intermediate: 'per-probe compute scratch accumulates nine RGB L2 SH coefficients plus totalWeight during one cubemap sweep',
				output: 'coefficientTarget-compatible c0..c8 RGB rows, preserving the current atlas repack input contract'
			},
			reductionContract: {
				dispatchShape: 'one logical probe reduction owns all six faces and cubemap texels for that probe',
				sweepCount: 'one cubemap sweep per probe computes c0..c8 together instead of nine coefficient-fragment sweeps',
				basisContract: 'reuse the current SH basis constants, cube-face direction convention, texel solid-angle weight, and 4π / totalWeight normalization'
			},
			outputPackingContract: {
				coefficientRows: 'write nine coefficient slots in the same coefficientTarget row order consumed by _repackAtlas',
				atlasCompatibility: 'existing PACKED_SH_TEXTURES atlas packing and padding layers remain unchanged',
				precisionBoundary: 'must match the current half-float/float fallback behavior before replacing fragment projection'
			},
			parityTolerance: {
				maxCoefficientDelta: 0.0001,
				fixtures: [ 'constant', 'face-asymmetric', 'axis-dominance' ],
				gates: [
					'compute c0..c8 must match fragment-coefficient-projection for every synthetic fixture',
					'compute output must survive existing atlas repack readback within tolerance',
					'final probe sampling must remain unchanged when fed compute-packed coefficients'
				]
			},
			fallbackBehavior: {
				defaultPath: 'fragment-coefficient-projection',
				computePath: 'compute-probe-reduction is implemented as a guarded runtime path and falls back to fragment projection when compute dispatch is unavailable or fails',
				adapterPolicy: 'unsupported compute/storage-texture adapters keep the current fragment projection path'
			},
			architectureDiagram: [
				'flowchart LR',
				'Current["fragment-coefficient-projection current runtime"] -->|"baseline c0..c8"| Contract["computeProjectionParityContract"]',
				'Contract -->|"proof-only"| Sketch["computeProjectionDesignSketch"]',
				'Sketch -->|"defines"| Evidence["computeProjectionParityEvidencePlan"]',
				'Evidence -->|"permits candidate only"| Candidate["compute-probe-reduction candidate"]',
				'Candidate -->|"must pass"| Parity["synthetic fixtures plus atlas repack parity"]',
				'Parity -->|"promotes only if supported"| Runtime["future compute runtime"]',
				'Parity -->|"otherwise"| Fallback["fragment fallback remains active"]'
			]
		},
		computeProjectionParityEvidencePlan: {
			status: computeProjectionEvidencePlanStatus,
			runtimeBoundary: computeProjectionRuntimeParityCaptured ?
				'Compute projection runtime markers are now backed by actual browser readback parity evidence; fragment fallback and public API compatibility remain mandatory.' :
				'Compute projection runtime markers may exist only under the guarded implementation status; full parity promotion still requires actual runtime readback.',
			capturedEvidence: computeProjectionCapturedEvidence,
			openEvidence: computeProjectionOpenEvidence,
			requiredEvidence: [
				{
					id: 'compute-fixture-parity',
					captureStatus: computeProjectionFixtureParityCaptured ?
						'CAPTURED-PROOF-ONLY-MOCK-PASSING' :
						'SPECIFIED-NOT-CAPTURED',
					source: 'inspectProjectionParity synthetic fixtures',
					baseline: 'fragment-coefficient-projection',
					candidate: 'compute-probe-reduction',
					requiredFixtures: [ 'constant', 'face-asymmetric', 'axis-dominance' ],
					passCondition: 'max c0..c8 RGB coefficient delta <= 0.0001 for every fixture',
					actualMaxDelta: computeProjectionCandidateOracle.maxCandidateToFragmentDelta
				},
				{
					id: 'compute-atlas-repack-parity',
					captureStatus: computeProjectionAtlasRepackCaptured ?
						'CAPTURED-PROOF-ONLY-ATLAS-REPACK-PASSING' :
						'OPEN-NOT-CAPTURED',
					source: 'inspectAtlasPacking',
					baseline: 'current coefficientTarget row order plus _repackAtlas',
					candidate: 'compute-written coefficientTarget-compatible rows',
					requiredFixtures: [ 'synthetic packed coefficient atlas' ],
					passCondition: 'packed atlas readback preserves coefficient/component order and padding/validity contracts within existing 0.008 render-path readback tolerance',
					actualMaxDelta: computeProjectionAtlasRepackOracle.maxReadbackDelta
				},
				{
					id: 'compute-adapter-fallback',
					captureStatus: computeProjectionAdapterFallbackCaptured ?
						'CAPTURED-RUNTIME-GUARDED-ADAPTER-FALLBACK-PASSING' :
						'OPEN-NOT-CAPTURED',
					source: 'target adapter capability report',
					baseline: 'fragment-coefficient-projection',
					candidate: 'compute-probe-reduction',
					requiredFixtures: [ 'unsupported compute/storage-texture adapter path' ],
					passCondition: 'unsupported adapters keep fragment-coefficient-projection without changing public API or proof output',
					actualScenarioCount: computeProjectionAdapterFallbackOracle.scenarios.length
				},
				{
					id: 'compute-runtime-readback-parity',
					captureStatus: computeProjectionRuntimeParityCaptured ?
						'CAPTURED-RUNTIME-READBACK-PASSING' :
						'OPEN-NOT-CAPTURED',
					source: 'inspectComputeProjectionRuntimeParity browser/WebGPU readback',
					baseline: 'fragment-coefficient-projection',
					candidate: 'compute-probe-reduction',
					requiredFixtures: [ 'runtime-low-res-cornell-coefficients', 'runtime-low-res-cornell-atlas' ],
					passCondition: 'compute coefficient readback and atlas repack readback both stay within tolerance against fragment baseline',
					actualCoefficientMaxDelta: computeProjectionRuntimeParityEvidence.coefficientMaxDelta,
					actualAtlasMaxDelta: computeProjectionRuntimeParityEvidence.atlasMaxDelta
				}
			],
			statusTransition: {
				previous: computeProjectionPreviousContractStatus,
				current: computeProjectionEffectiveContractStatus,
				nextRuntime: computeProjectionRuntimeStatusRequired,
				promoted: computeProjectionRuntimeStatusRequired,
				blocked: 'PLANNED-NOT-IMPLEMENTED'
			}
		},
		computeProjectionStatusTransitionGuard: {
			status: computeProjectionRuntimeParityCaptured ?
				'RUNTIME-PARITY-EVIDENCE-CAPTURED' :
				computeProjectionContractStatus === 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY' ?
					'GUARDED-RUNTIME-IMPLEMENTED-PARITY-PENDING' :
					computeProjectionEvidencePlanStatus === 'CAPTURED-PROOF-ONLY-RUNTIME-READBACK-PENDING' ?
						'GUARDED-PROOF-CAPTURED-RUNTIME-BLOCKED' :
						'GUARDED-PROOF-INCOMPLETE-RUNTIME-BLOCKED',
			currentContractStatus: computeProjectionEffectiveContractStatus,
			evidencePlanStatus: computeProjectionEvidencePlanStatus,
			allowedNextContractStatus: computeProjectionRuntimeParityCaptured ?
				computeProjectionRuntimeStatusRequired :
				[ 'PARITY-CANDIDATE-NOT-RUNTIME', 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY' ].includes( computeProjectionContractStatus ) ?
					computeProjectionRuntimeStatusRequired :
					computeProjectionEvidencePlanStatus === 'CAPTURED-PROOF-ONLY-RUNTIME-READBACK-PENDING' ?
						'PARITY-CANDIDATE-NOT-RUNTIME' :
						'PLANNED-NOT-IMPLEMENTED',
			runtimeStatusRequired: computeProjectionRuntimeStatusRequired,
			runtimeMarkersAllowed: computeProjectionContractStatus === 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY',
			publicApiChangeAllowed: false,
			blockedRuntimeMarkers: computeProjectionRuntimeMarkers,
			guardRule: computeProjectionRuntimeParityCaptured ?
				'The contract has runtime readback evidence for IMPLEMENTED-WITH-PARITY-EVIDENCE; fragment fallback and public API compatibility remain mandatory.' :
				'The contract may run as IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY with runtime markers and fragment fallback, but full parity promotion remains forbidden until actual runtime readback reaches IMPLEMENTED-WITH-PARITY-EVIDENCE.',
			promotionBoundary: computeProjectionRuntimeParityCaptured ?
				'Actual runtime parity readback is captured for coefficients and atlas repack; do not remove fragment fallback.' :
				'Guarded runtime code exists, but full promotion still requires actual runtime parity readback; fragment fallback and public API compatibility remain mandatory.'
		},
		computeProjectionCandidateImplementationDesign: {
			status: 'CANDIDATE-DESIGN-NOTE-PROOF-ONLY',
			nonGoal: 'This path does not introduce hand-written WGSL, public API, or removal of fragment-coefficient-projection fallback; runtime dispatch is implemented through a guarded TSL compute node.',
			dispatchShape: {
				unit: 'one logical dispatch group per probe',
				work: 'sweep six cubemap faces once and accumulate c0..c8 RGB plus totalWeight',
				currentContrast: 'replaces nine coefficient-fragment sweeps only after candidate status and runtime evidence are explicitly promoted'
			},
			storageLayout: {
				input: 'existing cubeRenderTarget texture sampled with shader-webgpu face/direction convention',
				scratch: 'per-probe workgroup/private accumulators for nine vec3 coefficients and one totalWeight scalar',
				output: 'coefficientTarget-compatible c0..c8 rows consumed by existing _repackAtlas'
			},
			workgroupStrategy: {
				phase1: 'parallel texel accumulation per probe face/texel tile',
				phase2: 'reduce partial SH sums into nine RGB coefficients',
				phase3: 'normalize by 4π / totalWeight before writing coefficient rows'
			},
			outputContract: {
				rowOrder: 'same c0..c8 order as fragment-coefficient-projection',
				packing: 'must continue through PACKED_SH_TEXTURES and padding/validity atlas contract',
				parityInputs: [ 'compute-fixture-parity', 'compute-atlas-repack-parity', 'compute-adapter-fallback' ]
			},
			fallbackBranch: {
				default: 'fragment-coefficient-projection',
				candidate: 'compute-probe-reduction',
				rule: 'select compute when contract status is IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY or IMPLEMENTED-WITH-PARITY-EVIDENCE and required adapter capabilities are present; otherwise use fragment fallback'
			},
			precisionBehavior: {
				coefficientTolerance: 0.0001,
				atlasReadbackTolerance: 0.008,
				fallbackPrecision: 'preserve current half-float/float projection fallback behavior'
			}
		},
		computeProjectionImplementationReadinessChecklist: {
			status: computeProjectionRuntimeParityCaptured ?
				'RUNTIME-PARITY-READBACK-PASSING' :
				'RUNTIME-IMPLEMENTED-PARITY-READBACK-PENDING',
			verdict: computeProjectionRuntimeParityCaptured ?
				'The guarded compute projection runtime path is implemented, readback-validated against fragment coefficients and atlas repack, and still keeps fragment fallback.' :
				'The guarded compute projection runtime path is implemented with fragment fallback; full parity promotion is still pending actual browser/runtime readback.',
			currentContractStatus: computeProjectionEffectiveContractStatus,
			requiredRuntimeStatus: computeProjectionRuntimeStatusRequired,
			runtimeMarkersAllowed: computeProjectionContractStatus === 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY',
			publicApiChangeAllowed: false,
			proofOnlyDone: [ 'CAPTURED-PROOF-ONLY-RUNTIME-READBACK-PENDING', 'CAPTURED-RUNTIME-PARITY-EVIDENCE' ].includes( computeProjectionEvidencePlanStatus ),
			runtimeDone: computeProjectionContractStatus === 'IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY',
			runtimeParityReadbackDone: computeProjectionRuntimeParityCaptured,
			completedPhases: [
				{
					id: 'contract-gate',
					status: computeProjectionContractStatus,
					result: 'contract promoted from candidate to guarded runtime implementation while fragment fallback remains active'
				},
				{
					id: 'fixture-parity',
					status: computeProjectionCandidateOracle.status,
					result: 'proof-only compute candidate oracle matches fragment coefficient projection across synthetic fixtures'
				},
				{
					id: 'atlas-repack-parity',
					status: computeProjectionAtlasRepackOracle.status,
					result: 'compute-shaped coefficient rows survive the existing _repackAtlas packing/readback contract'
				},
				{
					id: 'adapter-fallback',
					status: computeProjectionAdapterFallbackOracle.status,
					result: 'guarded runtime status selects compute only when capabilities exist; unsupported capabilities keep fragment-coefficient-projection selected'
				},
				{
					id: 'runtime-readback-parity',
					status: computeProjectionRuntimeParityEvidence.status,
					result: 'browser/WebGPU readback compares compute coefficients and atlas repack against fragment baseline'
				},
				{
					id: 'candidate-design',
					status: 'CANDIDATE-DESIGN-NOTE-PROOF-ONLY',
					result: 'dispatch/storage/workgroup/output/fallback/precision shape is now backed by guarded runtime code'
				}
			],
			blockersBeforeRuntime: [
				{
					id: 'wgsl-compute-entrypoint',
					status: 'IMPLEMENTED-TSL-COMPUTE-NODE',
					requiredFor: computeProjectionRuntimeStatusRequired,
					reason: 'runtime uses a TSL compute node plus renderer.compute dispatch and keeps fragment fallback for unsupported or failed compute projection'
				},
				{
					id: 'actual-runtime-parity-readback',
					status: computeProjectionRuntimeParityCaptured ?
						'PASSED-BROWSER-E2E' :
						'PENDING-BROWSER-E2E',
					requiredFor: computeProjectionRuntimeStatusRequired,
					reason: computeProjectionRuntimeParityCaptured ?
						'actual compute output was read back in browser e2e against fragment coefficients and atlas packing within tolerance' :
						'actual compute output must still be read back in browser e2e against fragment coefficients and atlas packing before full parity promotion'
				},
				{
					id: 'capability-guarded-runtime-branch',
					status: 'IMPLEMENTED-WITH-FRAGMENT-FALLBACK',
					requiredFor: computeProjectionRuntimeStatusRequired,
					reason: 'runtime selects compute only for WebGPU renderer.compute availability and falls back to fragment projection on unsupported or failed compute path'
				},
				{
					id: 'public-api-compatibility',
					status: 'LOCKED-NO-CHANGE',
					requiredFor: computeProjectionRuntimeStatusRequired,
					reason: 'compute projection must remain an internal path swap with fragment fallback, not a public API expansion'
				}
			],
			completionDefinition: {
				proofOnlyCandidatePhase: 'done: contract/evidence/readiness are captured and the runtime implementation phase has started from candidate state',
				runtimeImplementationPhase: computeProjectionRuntimeParityCaptured ?
					'done: guarded runtime path has coefficient and atlas readback parity evidence while preserving capability fallback' :
					'code path implemented: full done still requires IMPLEMENTED-WITH-PARITY-EVIDENCE with actual runtime parity readback and capability fallback tests',
				nextLegalState: computeProjectionRuntimeStatusRequired
			},
			phaseDiagram: [
				'flowchart TD',
				'Proof["proof evidence captured"] --> Candidate["PARITY-CANDIDATE-NOT-RUNTIME"]',
				'Candidate --> Readiness["implementation readiness checklist"]',
				'Readiness -->|"guarded TSL compute node"| Runtime["IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY"]',
				'Runtime -->|"pending readback"| FullParity["IMPLEMENTED-WITH-PARITY-EVIDENCE"]',
				'Runtime --> Fallback["fragment fallback on unsupported or failed compute"]',
				'FullParity -->|"only after capabilities pass"| Compute["compute-probe-reduction runtime path"]'
			]
		},
		computeProjectionCandidateOracle,
		computeProjectionAdapterFallbackOracle,
		computeProjectionAtlasRepackOracle,
		computeProjectionRuntimeParityEvidence,
		snapshotBakeTimings,
		timingSources,
		timingSourceCounts
	};
	const momentBackedVisibility = isMomentBackedVisibility( visibilityMomentInspection );
	const visibilityProofStatus = deriveVisibilityProofStatus( visibilityMomentInspection, visibilityMomentInspection.evidenceStatus );
	const mathAndPipelineDecision = {
		rootCauseHypothesis: 'The muddy density-reference artifact is dominated by low-order / 9-coefficient SH representation pressure: a 6^3 / 32px bake captures sharper high-contrast lighting, then the low-order SH representation stores it as only 9 coefficients. Full L1 directionality can create negative/dark lobes after evaluation and non-negative clamp.',
		action: 'Use a same-budget band1-damped quality candidate: preserve L0 mean irradiance, keep L2 at 0.55, reduce L1 directional overshoot to 0.6, and keep global probeIntensity unchanged.',
		webgpuPipelineFlow: 'GPU bake cubemaps -> GPU SH projection into packed atlas -> hardware texture.sample() for unweighted runtime queries -> sampler-disabled manual loads / shader texture loads only for validity/normal-weighted rows -> SH band evaluation and clamp.',
		webgpuQuirkBoundary: 'This pass treats the issue as SH band-policy pressure, not a WebGPU texture-filtering bug: the quality candidate keeps the same half-float atlas path, same 6^3 / 32px bake budget, and the same hardware-filtered unweighted sampler.',
		deferredRuntimeWork: 'If the same pattern fails on more adapters, next scoped runtime work is private anti-ringing/visibility design: per-probe confidence, visibility/depth moments, probe relocation/classification, or adaptive bricks; no public preset/API change in this pass.'
	};

	const externalImplementationResearch = {
		status: 'VERIFIED-SCOPED',
		searchedFor: [
			'NVIDIA RTXGI / DDGI SDK',
			'Unity Adaptive Probe Volumes',
			'WebGPU surfel GI implementations',
			'Shade / Usnul WebGPU DDGI notes',
			'Sixteen Studio / SixTeenStudios public GitHub traces'
		],
		primarySources: [
			{
				name: 'NVIDIAGameWorks/RTXGI-DDGI',
				url: 'https://github.com/NVIDIAGameWorks/RTXGI-DDGI',
				lesson: 'Production DDGI separates irradiance from distance/visibility data, applies normal/view surface bias, wraps normal weighting, Chebyshev variance visibility, weight crushing, and keeps relocation/classification as explicit systems.'
			},
			{
				name: 'NVIDIA light-field probes',
				url: 'https://research.nvidia.com/publication/2017-02_real-time-global-illumination-using-precomputed-light-field-probes',
				lesson: 'Leak control comes from storing visibility with probe data; irradiance alone is not enough for walls and occluded receivers.'
			},
			{
				name: 'Unity Adaptive Probe Volumes',
				url: 'https://docs.unity.cn/2023.3/Documentation/Manual/urp/probevolumes-concept.html',
				lesson: 'APV samples probes per pixel, organizes data into adaptive 4x4x4 bricks, and exposes density/streaming/debug controls rather than treating a single uniform grid as production-grade.'
			},
			{
				name: 'Unity APV issue-fixing guidance',
				url: 'https://github.com/Unity-Technologies/Graphics/blob/master/Packages/com.unity.render-pipelines.high-definition/Documentation~/probevolumes-fixissues.md',
				lesson: 'APV treats invalid probes with virtual offset and dilation, and calls out wall thickness, rendering layers, and probe adjustment volumes as leak controls.'
			},
			{
				name: 'jure/webgiya',
				url: 'https://github.com/jure/webgiya',
				lesson: 'A modern WebGPU GI experiment uses explicit pass decomposition, spatial structures, temporal integration, radial depth moments, and resolve-time spatial/normal/occlusion weighting.'
			},
			{
				name: 'Shade WebGPU forum notes',
				url: 'https://discourse.threejs.org/t/shade-webgpu-graphics/66969/116',
				lesson: 'The reported DDGI leak strategy combines local cells, per-probe depth maps, normal visibility, parallax correction, and refinement; this is directionally aligned with DDGI-lite visibility scaffolding, not plain SH interpolation.'
			},
			{
				name: 'sixteenstudio/three.js feat/webgpu-lightprobes-sponza',
				url: 'https://github.com/sixteenstudio/three.js/blob/feat/webgpu-lightprobes-sponza/examples/jsm/lighting/LightProbeGridGPU.js',
				lesson: 'The public fork/branch does contain a LightProbeGridGPU implementation and Sponza example; inspected evidence shows an SH atlas + hardware sampling implementation, not DDGI visibility/depth moments.'
			}
		],
		sixteenStudioFinding: 'Verified GitHub user “sixteenstudio”, fork “sixteenstudio/three.js”, and branch “feat/webgpu-lightprobes-sponza” with examples/jsm/lighting/LightProbeGridGPU.js. No branch literally named “lightprobesgpu” was listed, and the inspected file is not evidence of DDGI visibility/depth moments.',
		transferToLightProbeGridGPU: [
			'Keep the current SH-only grid honest as diffuse irradiance, not real DDGI.',
			'Next runtime-quality step is a private visibility/depth-moment layer, proven first by the existing thin-wall and zero-thickness negative-control fixtures.',
			'Add virtual-offset/dilation-style verifier rows before claiming APV-grade invalid-probe handling.',
			'Keep unweighted sampling on hardware filtering; only weighted visibility paths should use manual loads.',
			'Track bake memory, pass order, and data dependencies as first-class proof artifacts.'
		],
		nonGoalsForCurrentPR: [
			'No public preset API.',
			'No claiming production DDGI or APV parity.',
			'No copying external code; only source-backed architecture lessons are recorded.'
		]
	};

	const implementationParityMatrix = {
		status: 'EVIDENCE-MATRIX',
		comparisonMode: 'git-ref-not-vendored',
		downloadedRefs: [
			{
				label: 'ours',
				ref: 'HEAD / codex/runtime-lightprobe',
				paths: [
					'examples/jsm/lighting/LightProbeGridGPU.js',
					'examples/jsm/lighting/LightProbeGrid.js',
					'docs/pages/LightProbeGrid.html.md'
				]
			},
			{
				label: 'sixteenstudio',
				ref: 'refs/remotes/sixteenstudio/feat/webgpu-lightprobes-sponza',
				commit: 'e8d975a347e0d1e4756c8d51fdbe1887b1f0b210',
				commitDate: '2026-05-24 17:16:56 +0100',
				commitSubject: 'Add moving sphere to demo',
				downloadCommand: 'git fetch https://github.com/sixteenstudio/three.js.git feat/webgpu-lightprobes-sponza:refs/remotes/sixteenstudio/feat/webgpu-lightprobes-sponza',
				paths: [
					'examples/jsm/lighting/LightProbeGridGPU.js',
					'src/nodes/lighting/LightProbeGridNode.js',
					'examples/webgpu_lightprobes_sponza.html',
					'docs/pages/LightProbeGrid.html.md'
				]
			},
			{
				label: 'webgl-baseline',
				ref: 'HEAD / codex/runtime-lightprobe',
				paths: [
					'examples/jsm/lighting/LightProbeGrid.js',
					'docs/pages/LightProbeGrid.html.md'
				]
			}
		],
		sourcesRead: [
			'local examples/jsm/lighting/LightProbeGridGPU.js',
			'local examples/jsm/lighting/LightProbeGrid.js',
			'local docs/pages/LightProbeGrid.html.md',
			'sixteenstudio/three.js feat/webgpu-lightprobes-sponza examples/jsm/lighting/LightProbeGridGPU.js',
			'sixteenstudio/three.js feat/webgpu-lightprobes-sponza src/nodes/lighting/LightProbeGridNode.js',
			'sixteenstudio/three.js feat/webgpu-lightprobes-sponza docs/pages/LightProbeGrid.html.md',
			'sixteenstudio/three.js feat/webgpu-lightprobes-sponza examples/webgpu_lightprobes_sponza.html'
		],
		rows: [
			{
				axis: 'Renderer target',
				ours: 'WebGPU-only addon class named LightProbeGridGPU.',
				sixteenStudio: 'WebGPU branch file exports a LightProbeGrid class from LightProbeGridGPU.js.',
				webglBaseline: 'WebGL-only LightProbeGrid addon.',
				standing: 'Ours is clearer at runtime/type boundaries.',
				action: 'Keep explicit GPU naming in source checks; do not backslide to a WebGL-shaped class name.'
			},
			{
				axis: 'Volume contract',
				ours: 'Explicit min/max Box3-style bounds plus cubic resolution option.',
				sixteenStudio: 'Width/height/depth constructor mirrors WebGL.',
				webglBaseline: 'Width/height/depth constructor centered on object position.',
				standing: 'Ours is better for verifier-controlled bounds; Sixteen/WebGL is easier parity ergonomics.',
				action: 'Document why min/max exists and avoid adding a second constructor until API review.'
			},
			{
				axis: 'Runtime hookup',
				ours: 'Object supplies createIrradianceNode() and createLightProbeGridLights().',
				sixteenStudio: 'Branch includes src/nodes/lighting/LightProbeGridNode.js for renderer-side lookup.',
				webglBaseline: 'Renderer has established LightProbeGrid path.',
				standing: 'Sixteen has a useful integration shape; ours is more self-contained and easier to test.',
				action: 'If upstream wants renderer-native discovery, port the concept deliberately instead of hiding it in this proof pass.'
			},
			{
				axis: 'Bake residency',
				ours: 'GPU-resident RenderTarget3D atlas; source gates reject CPU readback/Data3DTexture upload.',
				sixteenStudio: 'Uses WebGPU RenderTarget3D but keeps WebGL-like Data3DTexture documentation/type traces.',
				webglBaseline: 'Publishes Data3DTexture as the baked atlas texture in docs/API.',
				standing: 'Ours is stricter for WebGPU memory path proof.',
				action: 'Keep no-readback source assertions and memory accounting as first-class proof.'
			},
			{
				axis: 'Sampling path',
				ours: 'Fast unweighted path uses hardware texture.sample(); weighted path uses manual neighbor loads only when needed.',
				sixteenStudio: 'Branch evidence is hardware SH atlas sampling; no weighted/manual visibility path found.',
				webglBaseline: 'Baseline is SH-grid interpolation without DDGI visibility.',
				standing: 'Ours has the better scoped split between fast path and leak-control experiments.',
				action: 'Never replace the unweighted fast path to make verifier rows pass.'
			},
			{
				axis: 'Leak controls',
				ours: 'Normal/view bias, scalar probeValidity, private radial distance moments, and proof-only guarded visibilityMass; explicitly not public DDGI.',
				sixteenStudio: 'No normalBias/viewBias/leakReductionMode/probeValidity evidence found in inspected file.',
				webglBaseline: 'No visibility/depth leak control contract.',
				standing: 'Ours is ahead on leak scaffolding but still not DDGI.',
				action: 'Next work must add moment-backed visibility, not rename validity to visibility.'
			},
			{
				axis: 'Visibility/depth moments',
				ours: 'Private visibilityDepthTarget exists and is moment-backed: RenderTarget3D octa slices store radial-distance mean, squared radial distance, hit confidence, and reserved/backface confidence.',
				sixteenStudio: 'Missing in inspected implementation.',
				webglBaseline: 'Missing.',
				standing: 'Ours has the strongest private proof slice in this comparison, but everyone is still below production DDGI/APV.',
				action: 'Treat moment existence as necessary but not sufficient; promotion still depends on sealed-wall improvement, bounce preservation, and CPU/render agreement.'
			},
			{
				axis: 'Docs parity',
				ours: 'Local LightProbeGrid docs now label the page as the WebGL baseline and keep LightProbeGridGPU proof-scoped.',
				sixteenStudio: 'Fetched docs say the same WebGL-only statement.',
				webglBaseline: 'Docs accurately describe WebGL baseline but not the GPU branch reality.',
				standing: 'Ours is more truthful for this branch; Sixteen docs remain stale for its GPU branch state.',
				action: 'Do not add full public GPU docs until visibility/depth semantics and API are implemented and verified.'
			},
			{
				axis: 'Demo coverage',
				ours: 'Cornell-style controlled proof rows with region/leak/density matrices.',
				sixteenStudio: 'Sponza visual demo with moving object and rebake controls.',
				webglBaseline: 'Established examples and docs baseline.',
				standing: 'Sixteen is better for visual product feel; ours is better for falsifiable regression proof.',
				action: 'Borrow the idea of a larger scene only after the Cornell verifier remains stable.'
			},
			{
				axis: 'Proof discipline',
				ours: 'Rejects production DDGI claims, tracks open uncertainties, and gates source invariants.',
				sixteenStudio: 'No comparable proof ledger found in inspected branch files.',
				webglBaseline: 'Baseline API docs exist but do not address WebGPU verifier claims.',
				standing: 'Ours is stronger for reviewability.',
				action: 'Every new line must map to source evidence, a verifier gap, or an explicit non-goal.'
			}
		],
		bugsAndGaps: [
			'Docs gap: a full public LightProbeGridGPU page is still deferred until the API boundary is stable; the existing LightProbeGrid page only labels the WebGPU addon as proof-scoped.',
			'Implementation gap: current probeValidity is scalar classification metadata; the private log-moment layer is separate proof-only visibility data.',
			'Verifier gap: zero-thickness wall rows must stay OPEN until moment-backed guarded rows improve leak without killing bounce.',
			'Integration gap: ours is self-contained via createIrradianceNode(); Sixteen branch shows a separate LightProbeGridNode path that may be worth evaluating later.',
			'Research gap: SixteenStudio evidence should be cited as WebGPU SH packaging/Sponza precedent only, not DDGI prior art.'
		],
		whatWeDoBetter: [
			'Named LightProbeGridGPU class makes renderer scope harder to confuse.',
			'GPU-resident no-readback source checks are explicit.',
			'Fast hardware sampling is preserved for the default path.',
			'Leak-control rows are falsifiable and keep negative controls OPEN.',
			'Memory and backend labels are reported instead of hidden.'
		],
		whatTheyDoBetter: [
			'Sponza demo pressure-tests product feel in a larger scene.',
			'Separate LightProbeGridNode source suggests a renderer-integrated architecture worth studying.',
			'WebGL-shaped constructor ergonomics are familiar to existing LightProbeGrid users.'
		],
		comparativeRating: {
			status: 'CANDID-EVIDENCE-RATING',
			scale: '0-10, where 10 means upstream-ready for the named axis; this is an engineering review score, not a popularity score.',
			evidenceLabels: [
				'OURS-PROOF: local Cornell verifier, proof report, source gates, and regenerated screenshots/metrics.',
				'OURS-RUNTIME1: local private visibility/depth target reports mode=moments with finite log-moment readback and refuses to call scalar validity visibility.',
				'SIXTEEN-REF: refs/remotes/sixteenstudio/feat/webgpu-lightprobes-sponza at e8d975a347e0d1e4756c8d51fdbe1887b1f0b210.',
				'WEBGL-BASELINE: established LightProbeGrid docs/source and captured WebGL reference screenshot row.',
				'OPEN-DDGI-GAP: no inspected implementation has production relocation, dilation, adaptive APV bricks, transfer-scene proof, or public DDGI parity.'
			],
			rows: [
				{
					axis: 'Runtime implementation maturity',
					ours: { score: 6.8, label: 'OURS-RUNTIME1', rationale: 'GPU-resident atlas, explicit memory/sampling reporting, private log-moment target, guarded visibilityMass, and bake coalescing; still proof-scoped.' },
					sixteenStudio: { score: 5.5, label: 'SIXTEEN-REF', rationale: 'Solid WebGPU SH-atlas draft with Sponza pressure, but fewer guardrails and no inspected leak/visibility scaffold.' },
					webglBaseline: { score: 8.0, label: 'WEBGL-BASELINE', rationale: 'More established baseline API, but not the WebGPU target and not DDGI.' }
				},
				{
					axis: 'Proof / falsifiability',
					ours: { score: 8.0, label: 'OURS-PROOF', rationale: 'Has executable e2e, source gates, metrics, screenshots, leak rows, negative controls, and open uncertainties.' },
					sixteenStudio: { score: 3.0, label: 'SIXTEEN-REF', rationale: 'Inspected branch is demo-first; no comparable proof ledger or targeted verifier was found.' },
					webglBaseline: { score: 6.0, label: 'WEBGL-BASELINE', rationale: 'Stable docs/examples exist, but not the branch-specific WebGPU proof harness.' }
				},
				{
					axis: 'Demo/product feel',
					ours: { score: 5.0, label: 'OURS-PROOF', rationale: 'Cornell scene is controlled and reviewable, but intentionally not a rich product-feel demo.' },
					sixteenStudio: { score: 8.0, label: 'SIXTEEN-REF', rationale: 'Sponza scene, moving sphere, rebake controls, and helper UI are better for first-impression validation.' },
					webglBaseline: { score: 7.0, label: 'WEBGL-BASELINE', rationale: 'Established examples, but not the new WebGPU GI branch experience.' }
				},
				{
					axis: 'Leak / visibility honesty',
					ours: { score: 6.5, label: 'OPEN-DDGI-GAP', rationale: 'Normal/view bias, scalar validity, private radial moments, and visibilityMass are honest about being a guarded proof slice, not public DDGI.' },
					sixteenStudio: { score: 3.5, label: 'OPEN-DDGI-GAP', rationale: 'No inspected evidence of validity, depth moments, or leak-specific verifier rows.' },
					webglBaseline: { score: 3.0, label: 'OPEN-DDGI-GAP', rationale: 'Baseline SH grid is useful diffuse GI, not a leak-solving visibility system.' }
				},
				{
					axis: 'Upstream ergonomics',
					ours: { score: 5.5, label: 'OURS-RUNTIME1', rationale: 'Explicit GPU naming and min/max bounds aid proof, but constructor ergonomics are less familiar.' },
					sixteenStudio: { score: 7.0, label: 'SIXTEEN-REF', rationale: 'WebGL-shaped constructor and LightProbeGridNode integration are closer to existing three.js ergonomics.' },
					webglBaseline: { score: 8.5, label: 'WEBGL-BASELINE', rationale: 'Known API shape and docs, but only for WebGL.' }
				},
				{
					axis: 'DDGI/APV readiness',
					ours: { score: 4.5, label: 'OPEN-DDGI-GAP', rationale: 'Best roadmap and private moment proof in this comparison, but no relocation, dilation, adaptive bricks, transfer-scene proof, or production visibility.' },
					sixteenStudio: { score: 2.0, label: 'OPEN-DDGI-GAP', rationale: 'No inspected DDGI/APV features beyond SH probe-grid rendering.' },
					webglBaseline: { score: 2.0, label: 'OPEN-DDGI-GAP', rationale: 'Useful baseline but not architected as DDGI/APV.' }
				}
			],
			overall: {
				ours: { score: 6.3, label: 'best engineering proof candidate', verdict: 'Best current branch for reviewability and falsifiable next steps; not production DDGI.' },
				sixteenStudio: { score: 5.0, label: 'best visual/demo candidate', verdict: 'Stronger Sponza demo and integration shape; weaker proof discipline and no verified visibility/depth layer.' },
				webglBaseline: { score: 6.4, label: 'stable baseline, wrong renderer target', verdict: 'Most mature baseline API, but it is not the WebGPU implementation and not DDGI.' }
			},
			candidVerdict: 'If the question is “which WebGPU branch should drive the next engineering pass?”, ours wins on proof and private moment-backed leak-roadmap discipline, SixteenStudio wins on demo/integration feel, and neither wins on production DDGI/APV correctness.'
		},
		linePlacementRules: [
			'Proof-only comparisons belong in test/e2e/lightprobegrid-gpu-proof-report.js because they are verifier evidence, not runtime behavior.',
			'The SixteenStudio implementation is downloaded as a Git comparison ref, not copied into examples/jsm, so we can inspect it without pretending it is ours.',
			'Runtime code must not gain public options solely to satisfy a comparison table.',
			'Docs changes should wait until the GPU API boundary is no longer proof-scoped.',
			'Any future implementation line must answer: what invariant does it protect, what source proved the need, and what verifier row fails without it?',
			'If a line cannot be tied to proof evidence, runtime correctness, or public documentation truth, it does not belong in this change.'
		]
	};

	const visibilityDepthRoadmap = {
		status: momentBackedVisibility ? 'RUNTIME-1-MOMENTS-PRIVATE-PROOF' : 'RUNTIME-1-SCAFFOLD-STARTED',
		problem: 'The current leak-reduction path has normal/view bias and optional scalar probe validity, but a scalar validity channel cannot answer whether a receiver is occluded from a probe through a thin wall or zero-thickness separator.',
		designThesis: 'Add a private DDGI-lite visibility/depth layer beside the SH irradiance atlas. Keep the fast unweighted path on hardware texture.sample(); only opt-in visibility rows take the manual eight-neighbor load path.',
		privateDataContract: [
			'Keep this.texture as the public SH irradiance atlas; visibility/depth data must live in private targets/textures so the addon API does not imply production DDGI parity.',
			'Store at least first and second distance moments per probe direction bucket or octahedral texel so runtime can perform Chebyshev/variance-style visibility weighting.',
			'Keep scalar probe validity as classification metadata only; do not rename it to visibility because it has no receiver-distance test.',
			'Report visibility texture bytes, bake pass count, and update dependency order from getMemoryInfo() / proof artifacts before enabling new claims.',
			'Runtime-1 now stores private radial distance moments when the verifier bake runs; if the target is missing, visibilityDepthMode must stay not-baked/open rather than claim visibility.'
		],
		bakePlan: [
			'During cubemap bake, produce distance/depth moments from the same probe viewpoints used for SH projection.',
			'Pack the visibility/depth layer separately from the seven SH coefficient sub-volumes so padding/filtering rules cannot corrupt coefficient sampling.',
			'Reserve dilation/virtual-offset repair as a verifier-driven post-process, not a default behavior, until invalid-probe rows prove it helps.'
		],
		runtimePlan: [
			'Default/unweighted mode remains a single hardware-filtered SH atlas sample.',
			'Guarded proof mode loads the eight neighboring probes manually, computes base = tri * validity * normalWeight * compatibleKernel, evaluates receiver radial distance against stored moments, and blends Chebyshev visibility continuously by hit confidence.',
			'The guarded shader normalizes SH by visible weights, then multiplies final irradiance by visibilityMass = visibleSum / baseSum so visibility attenuates energy instead of amplifying one surviving probe.'
		],
		verifierAdditions: [
			'Keep current finite thin-wall rows as front-edge regression/stress gates and add sealed-wall counterparts that can carry promotion evidence only if moments reduce wrong-side color without erasing correct bounce.',
			'Keep zero-thickness rows marked OPEN unless moment-backed guarded rows improve leak without erasing correct bounce.',
			'Add virtual-offset/dilation rows only after the moment layer exists; otherwise the verifier would be testing heuristic occupancy, not visibility.',
			'Add source checks that reject public API/preset expansion and reject replacing the unweighted hardware-sampling path.'
		],
		acceptanceGates: [
			'Wrong-side color ratio improves over scalar-validity baseline on sealed-wall fixtures before any promotion claim.',
			'Finite thin-wall rows remain labeled as front-edge stress while escaped probes bypass divider geometry.',
			'Correct-bounce ratio remains positive and center luminance floor stays bounded.',
			'Zero-thickness row changes status only when the report proves moment-backed visibility participated.',
			'Memory/pass accounting explicitly includes the visibility/depth layer.',
			'SixteenStudio branch evidence is cited only as SH-atlas/WebGPU packaging precedent, not visibility/depth prior art.'
		],
		alternatives: [
			{
				name: 'Keep scalar validity only',
				tradeoff: 'Cheapest and already wired, but it cannot model receiver occlusion through walls; useful as a regression baseline, not an endpoint.'
			},
			{
				name: 'Full DDGI/APV parity',
				tradeoff: 'Most correct but brings relocation, classification, adaptive bricks, streaming, dilation, and API expectations; too much scope for this PR.'
			},
			{
				name: 'Private DDGI-lite moments',
				tradeoff: 'Adds memory and manual weighted sampling only for leak-control rows, while preserving the public API and the fast SH path; this is the next scoped step.'
			}
		]
	};

	const ddgiVisibilityDepthSpec = {
		status: visibilityProofStatus.ddgiStatus,
		scope: 'Private runtime path only; no public API option, no public docs claim, no production DDGI/APV parity claim.',
		momentBacked: momentBackedVisibility,
		visibilityLabel: visibilityProofStatus.visibilityLabel,
		visibilityStatus: visibilityProofStatus.visibilityStatus,
		currentEvidence: {
			available: visibilityMomentInspection.available,
			mode: visibilityMomentInspection.mode,
			bytes: visibilityMomentInspection.bytes,
			texture: visibilityMomentInspection.texture,
			finiteSampleCount: visibilityMomentInspection.stats?.finiteSampleCount ?? 0,
			hitSampleCount: visibilityMomentInspection.stats?.hitSampleCount ?? 0
		},
		dataContract: {
			target: 'visibilityDepthTarget',
			layout: 'RenderTarget3D octahedral visibility slices, one layer per probe',
			resolution: '8x8 per probe',
			format: 'RGBA half-float',
			channels: {
				r: 'mean radial receiver distance from probe',
				g: 'mean squared radial receiver distance plus minimum variance',
				b: 'hit/confidence flag',
				a: 'backface/reserved confidence'
			}
		},
		bake: [
			'Existing irradiance cubemap -> SH projection -> packed atlas flow stays intact.',
			'Each probe then renders a private distance cubemap with overrideMaterial.',
			'Distance cubemap is repacked into the probe visibility layer using octahedral direction mapping and a five-tap octa/cubemap neighborhood average.',
			'Bake timings report visibilityCubemapMs, visibilityRepackMs, and visibilityDepthMode.'
		],
		runtime: [
			'leakReductionMode=off remains hardware-filtered SH atlas sampling and never samples visibilityDepthTexture.',
			'Manual guarded sampling accumulates scalar base weights and moment-visible weights separately.',
			'Moment visibility uses receiver radial distance, stored radial distance moments, hit confidence, minimum variance, and Chebyshev-style visibility.',
			'The shader normalizes SH by visible weights and then applies visibilityMass = visibleSum / baseSum to avoid one-probe amplification.'
		],
		nonGoals: [
			'No relocation.',
			'No dilation.',
			'No adaptive bricks/cascades.',
			'No streaming.',
			'No public DDGI preset.'
		],
		acceptance: [
			'Sealed-wall visibility row is measured against scalar-validity baseline; 5% improvement remains the promotion gate, not an excuse to fake success.',
			'Finite thin-wall visibility row remains a front-edge stress row and must not be used as promotion evidence while escaped probes bypass the divider edge.',
			'Correct bounce must remain bounded.',
			'Visibility memory bytes must be non-zero after bake.',
			'Zero-thickness visibility row remains OPEN unless moments prove improvement without erasing bounce.'
		]
	};


	const researchProofProgram = {
		status: 'SUPPORTED-BUT-NOT-PROMOTED',
		claim: 'Private LightProbeGridGPU DDGI-lite can only be argued as moment-backed visibility if the proof reads baked receiver-distance moments and compares the runtime row against scalar validity; SH-only irradiance and scalar validity are not visibility.',
		verifierBoundary: [
			'test/e2e/puppeteer.js --webgpu webgpu_lightprobes_cornell is the primary verifier.',
			'inspectVisibilityDepthMoments() must read probeGrid.visibilityDepthTarget directly; screenshots cannot prove moment data exists.',
			'Leak rows can support or reject this Cornell fixture only; they do not prove production DDGI, APV parity, relocation, dilation, cascades, or streaming.'
		],
		baselineCandidateFamily: {
			baseline: 'leak-sealed-wall-validity-weighted',
			candidate: momentBackedVisibility ?
				'leak-sealed-wall-visibility-moments' :
				'leak-sealed-wall-visibility-scaffold-disabled',
			frontEdgeStress: momentBackedVisibility ?
				'leak-thin-wall-visibility-moments' :
				'leak-thin-wall-visibility-scaffold-disabled',
			negativeControl: momentBackedVisibility ?
				'leak-zero-thickness-visibility-moments' :
				'leak-zero-thickness-visibility-scaffold-disabled',
			fastPathControl: 'leak-thin-wall-unweighted / leakReductionMode=off remains hardware-filtered SH atlas sampling'
		},
		sources: [
			{
				status: 'SUPPORTED',
				label: 'JCGT DDGI 2019',
				url: 'https://jcgt.org/published/0008/02/01/',
				lesson: 'DDGI extends irradiance probes with occlusion and moment/variance visibility; it uses octahedral spherical irradiance/depth textures and demonstrates visibility, backface, and normal-bias components separately.'
			},
			{
				status: 'SUPPORTED',
				label: 'NVIDIA production DDGI report 2020',
				url: 'https://research.nvidia.com/publication/2020-09_scaling-probe-based-real-time-dynamic-global-illumination-production-technical',
				lesson: 'Production DDGI is an irradiance-field-with-visibility system plus self-shadow bias, probe state, and cascaded-volume extensions; our private moment path is only one narrow slice.'
			},
			{
				status: 'SUPPORTED',
				label: 'RTXGI-DDGI SDK',
				url: 'https://github.com/NVIDIAGameWorks/RTXGI-DDGI',
				lesson: 'RTXGI publicly frames its SDK around DDGI from the NVIDIA/McGill/UdeM research lineage, so visibility/depth is the right comparison family, not scalar SH validity.'
			},
			{
				status: 'SUPPORTED',
				label: 'Unity APV docs',
				url: 'https://docs.unity.cn/6000.0/Documentation/Manual/urp/probevolumes-concept.html',
				lesson: 'APV is per-pixel probe sampling over adaptive bricks with streaming/bake scenarios; our uniform grid is not APV parity.'
			},
			{
				status: 'SUPPORTED',
				label: 'Unity APV artifact troubleshooting',
				url: 'https://docs.unity.cn/6000.0/Documentation/Manual/urp/probevolumes-troubleshoot-artefacts.html',
				lesson: 'Virtual offset and dilation exist because invalid probes and leaks are structural bake/layout issues, not brightness-only problems.'
			}
		],
		evidenceLabels: [
			{ label: 'PROVEN', meaning: 'Executable verifier directly checks the local implementation invariant.' },
			{ label: 'SUPPORTED', meaning: 'External source plus local verifier makes the claim reasonable in this bounded fixture.' },
			{ label: 'OPEN', meaning: 'Architecture is plausible but this branch does not yet satisfy the promotion metric.' },
			{ label: 'REJECTED', meaning: 'The verifier or source contradicts the claim.' }
		],
		enemyTerms: [
			'visibility-looking validity scalar',
			'paper-citing without a readback gate',
			'production DDGI/APV parity language',
			'zero-thickness victory claims',
			'manual-load regression in the unweighted path',
			'SixteenStudio labeled as visibility prior art instead of SH/WebGPU/Sponza precedent'
		],
		rejectionGates: [
			'No public DDGI/API/docs option may be added by this private verifier slice.',
			'visibilityDepthTarget must have non-zero bytes, mode=moments, and direct finite readback samples.',
			'Sealed-wall moment row remains OPEN for promotion unless it improves wrong-side color by at least 5% over scalar validity while preserving bounce.',
			'Finite thin-wall moment row is not promotion evidence while geometry audit reports front-edge bypass escapes.',
			'Zero-thickness row stays OPEN unless moments improve leak without killing bounce.',
			'leakReductionMode=off must remain hardware-filtered and must not sample visibilityDepthTexture.'
		],
		slices: [
			{
				id: 'slice-a-proof-ledger',
				status: 'THIS-PATCH',
				files: [ 'test/e2e/lightprobegrid-gpu-proof-report.js' ],
				purpose: 'Define claim, verifier boundary, source lessons, enemy terms, and rejection gates.'
			},
			{
				id: 'slice-b-moment-readback',
				status: 'THIS-PATCH',
				files: [ 'examples/jsm/lighting/LightProbeGridGPU.js', 'examples/jsm/lighting/LightProbeGridGPUTestHarness.js', 'test/e2e/lightprobegrid-gpu-smoke.js' ],
				purpose: 'Read the private visibilityDepthTarget so proof can distinguish missing data from weak weighting.'
			},
			{
				id: 'slice-c-runtime-weighting',
				status: 'THIS-PATCH',
				files: [ 'examples/jsm/lighting/LightProbeGridGPU.js' ],
				purpose: 'Private guarded path compares scalar base weights against moment-visible weights and applies visibilityMass without changing the public fast path.'
			},
			{
				id: 'slice-d-transfer-scenes',
				status: 'DEFERRED',
				files: [ 'examples/webgpu_lightprobes_cornell.html' ],
				purpose: 'Add Sponza/SixteenStudio-style transfer fixture after Cornell moment data passes.'
			},
			{
				id: 'slice-e-public-docs-api',
				status: 'BLOCKED',
				files: [ 'docs/pages/LightProbeGrid.html.md' ],
				purpose: 'Promote docs/API only after runtime metrics pass; not part of this private proof slice.'
			}
		],
		proofLadder: [
			{ rung: 1, status: momentBackedVisibility ? 'PROVEN' : 'OPEN', claim: 'A private visibilityDepthTarget is allocated and memory-accounted.' },
			{ rung: 2, status: momentBackedVisibility ? 'PROVEN' : 'OPEN', claim: 'Moment target contains finite receiver-distance readback samples with at least one hit/confidence sample.' },
			{ rung: 3, status: visibilityWeightingDiagnostic.status === 'SUPPORTED-DIRECTIONAL-SUPPRESSION' ? 'SUPPORTED' : 'OPEN', claim: 'CPU mirror of the current shader weighting suppresses wrong-side probes at least as much as correct-side probes.' },
			{ rung: 4, status: sealedVisibilityWeightingDiagnostic.escapeClassification.frontEdgeBypassEscapeCount === 0 ? 'PROVEN' : 'OPEN', claim: 'Sealed-wall CPU mirror removes the known finite-wall front-edge bypass from the promotion diagnostic.' },
			{ rung: 5, status: leakMatrix.comparisons.sealedWall.status === 'SUPPORTED-BY-SEALED-FIXTURE' ? 'SUPPORTED' : 'OPEN', claim: 'Moment weighting beats scalar validity by the promotion threshold in the sealed-wall fixture.' },
			{ rung: 6, status: sealedRenderMetricMismatch.cpuRenderAgreementGate, claim: `CPU SH mirror agrees with a sealed receiver render metric within ${ cpuRenderAgreementTolerance } before promotion.` },
			{ rung: 7, status: sealedReceiverNormalDiagnostic.status.startsWith( 'SUPPORTED-' ) ? 'SUPPORTED' : 'OPEN', claim: 'Receiver normal diagnostic aligns CPU +Z, shader normalWorld, and visible front/back face convention.' },
			{ rung: 8, status: sealedShContributionDiagnostic.status.startsWith( 'OPEN-' ) ? 'OPEN' : 'SUPPORTED', claim: `Packed SH contribution mirror identifies the next sealed-wall failure domain: ${ sealedFailureDomain }.` },
			{ rung: 9, status: 'OPEN', claim: 'Transfer scenes and non-Cornell layouts retain bounce while reducing leaks.' },
			{ rung: 10, status: 'REJECTED', claim: 'This branch is production DDGI/APV parity.' }
		],
		proofLedgerDecision: 'Continue private verifier-gated DDGI-lite. Do not promote public API/docs. Next pressure goes to moment readback diagnostics first, then weighting math, then transfer scene validation.',
		nextPressure: visibilityWeightingDiagnostic.status === 'OPEN-CORRECT-SIDE-SUPPRESSED' ?
			`Current comparable-receiver CPU mirror shows wrong-side probes are not suppressed more than correct-side probes; ${ visibilityWeightingDiagnostic.escapeClassification.wrongSideEscapedCount }/${ visibilityWeightingDiagnostic.escapeClassification.wrongSideProbeCount } wrong-side probes escape (${ Object.keys( visibilityWeightingDiagnostic.escapeClassification.escapeReasons ).join( ', ' ) || 'no-escape-reason' }); bias sweep best scale is ${ visibilityWeightingDiagnostic.bestBiasScale.visibilityBiasScale }, hit-confidence policy sweep best is ${ visibilityWeightingDiagnostic.bestHitConfidencePolicy.policy.label }, and policy decision is ${ visibilityWeightingDiagnostic.hitConfidencePolicyDecision }. The finite thin-wall row stays a front-edge stress row; sealed-wall promotion fixture status is ${ leakMatrix.comparisons.sealedWall.status } with wrong-side improvement ratio ${ leakMatrix.comparisons.sealedWall.visibility.wrongSide.improvement } and correct-bounce preservation ${ leakMatrix.comparisons.sealedWall.visibility.correctBounce.preservation }.` :
			`If moment readback is finite with hits but sealed-wall promotion remains OPEN, interrogate ${ sealedFailureDomain }, render-metric mismatch status ${ sealedRenderMetricMismatch.status }, CPU/render agreement gate ${ sealedRenderMetricMismatch.cpuRenderAgreementGate }, receiver normal convention ${ sealedReceiverNormalDiagnostic.status }, and receiver-surface metric isolation before increasing resolution or tuning Chebyshev.`
	};

	const revisionTaskBacklog = {
		status: 'STARTED',
		currentPhase: 'surface-coefficient-causal-attribution',
		executionBoundary: 'No build. No external code vendoring. No Chebyshev/runtime/public API change until surface coefficient attribution chooses and proves the next oracle branch.',
		tasks: [
			{
				id: 'proof-1',
				status: 'DONE',
				title: 'Fetch SixteenStudio branch as comparison ref',
				output: 'refs/remotes/sixteenstudio/feat/webgpu-lightprobes-sponza at e8d975a347e0d1e4756c8d51fdbe1887b1f0b210',
				gate: 'External code remains a Git ref, not copied into runtime source.'
			},
			{
				id: 'proof-2',
				status: 'DONE',
				title: 'Add three-way parity matrix',
				output: 'Ours, SixteenStudio branch, and WebGL baseline are compared by renderer target, volume contract, runtime hookup, bake residency, sampling, leak controls, visibility/depth, docs, demos, and proof discipline.',
				gate: 'Each matrix row states where we stand and what action follows.'
			},
			{
				id: 'proof-3',
				status: 'DONE',
				title: 'Separate evidence from implementation ownership',
				output: 'comparisonMode is git-ref-not-vendored and downloadedRefs lists all comparison inputs.',
				gate: 'Report cannot imply SixteenStudio code is owned or copied by this branch.'
			},
			{
				id: 'proof-4',
				status: 'DONE',
				title: 'Specify private visibility/depth moment roadmap',
				output: 'Roadmap defines data contract, bake plan, runtime plan, verifier additions, acceptance gates, and alternatives.',
				gate: 'Roadmap preserves hardware-sampled unweighted path and blocks public DDGI/API creep.'
			},
			{
				id: 'proof-5',
				status: 'NEXT',
				title: 'Generate repeatable diff artifact only if verifier consumes it',
				output: 'Not added yet.',
				gate: 'Do not add decorative scripts; any helper must feed source checks or proof markdown.'
			},
			{
				id: 'runtime-1',
				status: 'STARTED',
				title: 'Scaffold private moment-backed visibility layer',
				output: 'LightProbeGridGPU exposes private visibility/depth metadata, bakes receiver-distance moments, reports memory/sampling, and keeps the public API/docs closed.',
				gate: 'Scalar validity remains classification metadata; runtime promotion stays blocked until receiver-distance moments improve leak metrics.'
			},
			{
				id: 'runtime-2',
				status: 'DONE',
				title: 'Add receiver-level visibility weighting diagnostic',
				output: 'The verifier mirrors the current shader weight math at thin-wall receiver centers and reports whether correct-side or wrong-side probes are suppressed more.',
				gate: 'Do not tune Chebyshev/bias/resolution until the diagnostic distinguishes bad data from bad weighting.'
			},
			{
				id: 'runtime-3',
				status: computeProjectionRuntimeParityCaptured ?
					'IMPLEMENTED-WITH-PARITY-EVIDENCE' :
					'RUNTIME-IMPLEMENTED-PARITY-READBACK-PENDING',
				title: 'Specify compute projection parity gate',
				output: computeProjectionRuntimeParityCaptured ?
					'Projection profiling identified the fragment-coefficient path as 9 cubemap sweeps per probe; the guarded TSL compute node now performs one cubemap sweep per probe, writes c0..c8 into a storage texture, and passed browser readback against fragment coefficients plus atlas repack.' :
					'Projection profiling identified the fragment-coefficient path as 9 cubemap sweeps per probe; a guarded TSL compute node now performs one cubemap sweep per probe and writes c0..c8 into a storage texture for the existing atlas repack.',
				gate: computeProjectionRuntimeParityCaptured ?
					'Keep fragment fallback and capability guards; full parity promotion is backed by actual browser/runtime readback.' :
					'Do not mark full parity promotion until actual browser/runtime readback proves compute-probe-reduction matches fragment-coefficient-projection and atlas repack within tolerance.'
			},
			{
				id: 'runtime-4',
				status: computeProjectionRuntimeParityCaptured ?
					'RUNTIME-PARITY-READBACK-PASSING' :
					'IMPLEMENTED-PARITY-READBACK-PENDING',
				title: 'Close compute projection candidate readiness checklist',
				output: computeProjectionRuntimeParityCaptured ?
					'Candidate readiness now records completed proof-only phases, guarded runtime implementation, fragment fallback, and passing actual runtime parity readback.' :
					'Candidate readiness now records completed proof-only phases, guarded runtime implementation, fragment fallback, and pending actual runtime parity readback.',
				gate: computeProjectionRuntimeParityCaptured ?
					'Do not remove fragment fallback or public API compatibility; parity evidence authorizes the internal compute-probe-reduction path only behind guards.' :
					'Do not remove fragment fallback or claim IMPLEMENTED-WITH-PARITY-EVIDENCE until actual runtime parity readback passes.'
			},
			{
				id: 'docs-1',
				status: 'STARTED',
				title: 'Resolve stale WebGPU documentation statement',
				output: 'The LightProbeGrid page now calls itself the WebGLRenderer baseline and points to proof-scoped WebGPU addon work without promising DDGI/APV parity.',
				gate: 'Do not publish a full public LightProbeGridGPU docs page until runtime/API boundary is stable.'
			},
			{
				id: 'proof-6',
				status: surfaceAttributionBranchDecision?.status === 'OPEN-ATTRIBUTION-BRANCH-SELECTED' ||
					surfaceAttributionBranchDecision?.status === 'OPEN-ATTRIBUTION-UNDER-INSTRUMENTED' ||
					surfaceAttributionBranchDecision?.status === 'SUPPORTED-NO-SURFACE-LEAK-BRANCH' ?
					'DONE' :
					'NEXT',
				title: 'Classify surface coefficient attribution',
				output: surfaceAttributionFollowupSpec?.status === 'SPECIFIED-CAUSAL-ATTRIBUTION-FOLLOWUP' ?
					`Branch decision ${ surfaceAttributionBranchDecision.status }: selected ${ surfaceAttributionBranchDecision.selectedBranch } (${ surfaceAttributionBranchDecision.selectedOracleFamily }) with confidence ${ surfaceAttributionBranchDecision.confidence }; leak samples ${ surfaceAttributionFollowupSpec.currentEvidence.leakSampleCount }, attributed leaks ${ surfaceAttributionFollowupSpec.currentEvidence.attributedLeakSampleCount }, dominant band histogram ${ JSON.stringify( surfaceAttributionFollowupSpec.currentEvidence.dominantBandHistogram ) }.` :
					'Not added yet.',
				gate: 'Use surfaceSampleCoefficientAttributionStudy rows/histograms, not center samples or presentation-only screenshots, to choose the next oracle.'
			},
			{
				id: 'proof-7a',
				status: surfaceAttributionBranchDecision?.selectedBranch === 'proof-7a' ? 'NEXT' : 'BLOCKED-BY-PROOF-6',
				title: 'Bake/repack/source-policy oracle if source contamination dominates',
				output: 'Pending proof-6 classification.',
				gate: 'Only run if wrong-side selected/source probes or dilation-source pressure deltas dominate leak samples; no runtime source policy without aggregate win.'
			},
			{
				id: 'proof-7b',
				status: surfaceAttributionBranchDecision?.selectedBranch === 'proof-7b' ? 'NEXT' : 'BLOCKED-BY-PROOF-6',
				title: 'Band/de-ringing oracle if SH band pressure dominates',
				output: 'Pending proof-6 classification.',
				gate: 'Only run if L2/L1 coefficient pressure or negative/clamp energy dominates; no damping promotion without correct-bounce preservation.'
			},
			{
				id: 'proof-7c',
				status: surfaceAttributionBranchDecision?.selectedBranch === 'proof-7c' ?
					proof7cDispositionStudy?.status === 'CLOSED-PROOF-7C-DISPOSITION-NO-RUNTIME-PROMOTION' ?
						'DONE-NO-PROMOTION' :
						proof7cSurfaceStaticBlockerOracleStudy?.status?.startsWith( 'SUPPORTED-PROOF-7C' ) ?
							'DONE' :
							proof7cSurfaceStaticBlockerOracleStudy?.status?.startsWith( 'OPEN-PROOF-7C' ) ?
								'OPEN' :
								'NEXT' :
					'BLOCKED-BY-PROOF-6',
				title: 'CPU static-blocker/SDF oracle if correct-side probes still leak',
				output: proof7cSurfaceStaticBlockerOracleStudy !== undefined ?
					`Surface path oracle ${ proof7cSurfaceStaticBlockerOracleStudy.status }; disposition ${ proof7cDispositionStudy?.status ?? 'n/a' }; blocked dominant paths ${ proof7cSurfaceStaticBlockerOracleStudy.summary.blockedDominantPathCount }/${ proof7cSurfaceStaticBlockerOracleStudy.summary.evaluatedDominantPathCount }; receiver aggregate ${ proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleStatus } with safe wins ${ proof7cSurfaceStaticBlockerOracleStudy.summary.receiverAggregateOracleSafeWinCount }.` :
					'Pending proof-6 classification.',
				gate: 'Only run if dominant rows are correct-side probe/source paths that still see through the sealed wall; no runtime blocker machinery without CPU oracle value.'
			},
			{
				id: 'proof-7d',
				status: surfaceAttributionBranchDecision?.selectedBranch === 'proof-7d' ? 'NEXT' : 'BLOCKED-BY-PROOF-6',
				title: 'Expand instrumentation if attribution remains inconclusive',
				output: 'Pending proof-6 classification.',
				gate: 'If no branch dominates, add proof signals instead of changing runtime.'
			}
		],
		nextActions: [
			probe50L10ZDesignBoundConstraintsStudy?.status === 'SUPPORTED-PROOF-ONLY-PROBE50-L10Z-DESIGN-BOUND-CONSTRAINTS' ?
				`${ probe50L10ZDesignBoundConstraintsStudy.summary.identifiedCause } Next: ${ probe50L10ZDesignBoundConstraintsStudy.summary.nextProofOnlyAction }` :
				probe50L10ZDesignBoundConstraintsStudy?.summary?.nextProofOnlyAction,
			probe50LocalCorrectionAggregateResidualGuardStudy?.status === 'SUPPORTED-PROBE50-LOCAL-CORRECTION-AGGREGATE-RESIDUAL-GUARD' ?
				`${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.identifiedCause } Next: ${ probe50LocalCorrectionAggregateResidualGuardStudy.summary.nextProofOnlyAction }` :
				probe50LocalCorrectionAggregateResidualGuardStudy?.summary?.nextProofOnlyAction,
			probe50CoefficientLocalCorrectionOracleStudy?.status === 'SUPPORTED-PROBE50-COEFFICIENT-LOCAL-CORRECTION-ORACLE-WIN' ?
				`${ probe50CoefficientLocalCorrectionOracleStudy.summary.identifiedCause } Next: ${ probe50CoefficientLocalCorrectionOracleStudy.summary.nextProofOnlyAction }` :
				probe50CoefficientLocalCorrectionOracleStudy?.summary?.nextProofOnlyAction,
			probe50L10ContentBasisPolarityOracleStudy?.status === 'IDENTIFIED-PROBE50-L10-Z-BASIS-NEGATIVE-CORRECT-POLARITY' ?
				`${ probe50L10ContentBasisPolarityOracleStudy.summary.identifiedCause } Next: ${ probe50L10ContentBasisPolarityOracleStudy.summary.nextProofOnlyAction }` :
				probe50L10ContentBasisPolarityOracleStudy?.summary?.nextProofOnlyAction,
			probe50L10SignSourceIsolationOracleStudy?.status === 'IDENTIFIED-PROBE50-L10-POSITIVE-SOURCE-LOCALIZED' ?
				`${ probe50L10SignSourceIsolationOracleStudy.summary.identifiedCause } Next: ${ probe50L10SignSourceIsolationOracleStudy.summary.nextProofOnlyAction }` :
				probe50L10SignSourceIsolationOracleStudy?.summary?.nextProofOnlyAction,
			proof7bCoefficientL10OracleStudy?.status === 'IDENTIFIED-PROOF-7B-L10-PROBE50-DOMINANT-RESIDUAL-BOUNDED' ?
				`${ proof7bCoefficientL10OracleStudy.summary.identifiedCause } Next: ${ proof7bCoefficientL10OracleStudy.summary.nextProofOnlyAction }` :
				aggregateExplanationComparisonStudy?.summary?.nextProofOnlyAction,
			proof7cSurfaceStaticBlockerOracleStudy !== undefined ?
				surfaceAttributionFollowupSpec?.nextAction :
				surfaceAttributionBranchDecision?.nextAction ?? surfaceAttributionFollowupSpec?.nextAction ?? 'Regenerate surface coefficient attribution and choose the next oracle branch.',
			proof7cDispositionStudy?.status === 'CLOSED-PROOF-7C-DISPOSITION-NO-RUNTIME-PROMOTION' ?
				'proof-7c is addressed and closed for runtime promotion in this proof artifact; do not add runtime SDF/blocker machinery.' :
				'proof-7c remains a proof-only disposition until reviewed.',
			'If source/dilation pressure dominates, implement proof-7a as CPU/report-only source-policy oracle.',
			'If L1/L2/negative/clamp pressure dominates, implement proof-7b as CPU/report-only band/de-ringing oracle.',
			proof7cSurfaceStaticBlockerOracleStudy?.status?.startsWith( 'OPEN-PROOF-7C' ) ?
				mappedBakeContentSourcePolicyOracleStudy?.status === 'OPEN-MAPPED-BAKE-CONTENT-SOURCE-POLICY-ORACLE' &&
				unmappedCoefficientAttributionInstrumentationStudy?.status === 'OPEN-UNMAPPED-COEFFICIENT-ATTRIBUTION-INSTRUMENTATION' ?
					`Dual proof-only follow-up is materialized: ${ mappedBakeContentSourcePolicyOracleStudy.summary.sampleCount } mapped bake-content/source-policy rows and ${ unmappedCoefficientAttributionInstrumentationStudy.summary.sampleCount } unmapped coefficient-attribution rows.` :
					surfaceContentAttributionFollowupStudy?.status === 'OPEN-SURFACE-CONTENT-DUAL-BUCKET-FOLLOWUP' ?
						`${ surfaceContentAttributionFollowupStudy.summary.nextProofOnlyAction }` :
						surfaceContentAttributionSplitStudy?.status === 'OPEN-SURFACE-CONTENT-ATTRIBUTION-SPLIT' ?
							`proof-7c is OPEN and surface content attribution is split: mapped ${ surfaceContentAttributionSplitStudy.summary.mappedLeakSampleCount }, unmapped ${ surfaceContentAttributionSplitStudy.summary.unmappedLeakSampleCount }; keep the next step proof-only.` :
							'proof-7c CPU/static-blocker oracle is evaluated and still OPEN; inspect bake content, probe density, or surface placement before runtime blocker work.' :
				'If correct-side paths dominate but still leak through the wall, evaluate proof-7c as CPU static-blocker/SDF oracle.',
			'For projection performance, the guarded runtime implementation phase is in place: contract is IMPLEMENTED-GUARDED-PENDING-RUNTIME-PARITY, compute-probe-reduction can run behind capability/fallback guards, and full IMPLEMENTED-WITH-PARITY-EVIDENCE remains pending actual runtime readback.',
			'Keep Chebyshev, runtime visibility moments, public API, and docs promotion unchanged until an oracle produces aggregate evidence.'
		],
		stopConditions: [
			'Stop if a task requires build.',
			'Stop if a task would copy external SixteenStudio code into runtime paths.',
			'Stop if runtime implementation requires public API expansion before proof gates are updated.',
			'Stop if a proposed fix is based on center-only metrics while surface attribution remains OPEN.',
			'Stop if a Chebyshev change is proposed before proof-6 attributes the leak to moment threshold failure.'
		]
	};

	const ddgiLitePromotionGateStatus = leakMatrix.comparisons.sealedWall.linearPromotionStatus === 'SUPPORTED-BY-PRE-TONE-MASKED-FIXTURE' &&
		sealedRenderMetricMismatch.cpuRenderAgreementGate === 'SUPPORTED' ?
		'SUPPORTED' :
		'OPEN';


	return {
		performanceEvidence,
		mathAndPipelineDecision,
		externalImplementationResearch,
		implementationParityMatrix,
		visibilityDepthRoadmap,
		ddgiVisibilityDepthSpec,
		researchProofProgram,
		revisionTaskBacklog,
		ddgiLitePromotionGateStatus
	};

}
