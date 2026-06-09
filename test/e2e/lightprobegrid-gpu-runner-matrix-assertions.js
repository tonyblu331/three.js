const hasNoFields = ( object, ...fields ) => fields.every( field => object[ field ] === undefined );

const hasProbeClassificationFacts = probeOccupancy => {

	const classification = probeOccupancy.classification;

	return classification !== undefined &&
		classification.classificationPolicy === 'solid-occupancy-validity' &&
		classification.relocationPolicy === 'none' &&
		classification.validProbeCount + classification.invalidProbeCount === probeOccupancy.totalProbes &&
		classification.invalidProbeCount === probeOccupancy.occupiedProbeCount &&
		classification.interiorProbeCount === probeOccupancy.occupiedProbeCount &&
		classification.exteriorProbeCount === classification.validProbeCount &&
		classification.occludingProbeCount === probeOccupancy.occupiedProbeCount &&
		classification.relocatedProbeCount === 0 &&
		hasNoFields( classification, 'probes', 'rows', 'occupiedProbes', 'relocatedProbes', 'brightnessDerivedValidity' );

};

const hasProbeOccupancyFacts = probeOccupancy =>
	probeOccupancy.totalProbes === 64 &&
	probeOccupancy.solidMeshCount >= 3 &&
	probeOccupancy.occupiedProbeCount > 0 &&
	probeOccupancy.sampling.probeValidityMode === 'custom' &&
	probeOccupancy.sampling.invalidProbeCount === probeOccupancy.occupiedProbeCount &&
	Number.isInteger( probeOccupancy.occupiedProbeMeshHitCount ) &&
	probeOccupancy.occupiedProbeMeshHitCount >= probeOccupancy.occupiedProbeCount &&
	hasProbeClassificationFacts( probeOccupancy ) &&
	hasNoFields( probeOccupancy, 'occupiedProbes' );

const hasProofReceiverScaffoldFacts = scaffold =>
	scaffold?.policyId === 'lightprobegridgpu-proof-receiver-same-estimator-scaffold' &&
	scaffold.moduleScope === 'test/e2e' &&
	scaffold.productionRuntimeScope === false &&
	scaffold.estimatorContract === 'production-guarded-or-shared-proof-equivalent' &&
	scaffold.cpuReadbackRole === 'io-only-not-truth' &&
	scaffold.receiverStructPresent === true &&
	scaffold.receiverResultStructPresent === true &&
	scaffold.receiverStrideLanes === 16 &&
	scaffold.resultStrideLanes === 16 &&
	scaffold.bufferFactoryPresent === true &&
	scaffold.bufferScaffold?.receiverCount === 1 &&
	scaffold.bufferScaffold?.receiverStrideLanes === 16 &&
	scaffold.bufferScaffold?.resultStrideLanes === 16 &&
	scaffold.bufferScaffold?.receiverBytes === 64 &&
	scaffold.bufferScaffold?.resultBytes === 64 &&
	scaffold.bufferScaffold?.receiverStorageBuffer === true &&
	scaffold.bufferScaffold?.resultStorageBuffer === true &&
	scaffold.implemented === false &&
	scaffold.requiredResultFields.includes( 'fastIndirect' ) &&
	scaffold.requiredResultFields.includes( 'guardedIndirect' ) &&
	scaffold.requiredResultFields.includes( 'visibilityMass' ) &&
	scaffold.requiredResultFields.includes( 'invalidContribution' ) &&
	scaffold.requiredResultFields.includes( 'layerRejectedContribution' ) &&
	scaffold.requiredResultFields.includes( 'momentVsScalarDelta' ) &&
	scaffold.requiredSummaryFields.includes( 'sceneLinearIndirectAgreement' ) &&
	scaffold.requiredSummaryFields.includes( 'wrongSideLeakRatio' ) &&
	scaffold.requiredSummaryFields.includes( 'correctBouncePreservation' );

const hasProofPolicyFacts = policy =>
	policy !== undefined &&
	policy.policyId === 'lightprobegridgpu-proof-harness-semantic-epsilons' &&
	policy.ratioDenominatorEpsilon === 0.0001 &&
	policy.geometryThinAxisEpsilon === 0.0001 &&
	policy.geometryRangeEpsilonFactor === 0.0001 &&
	policy.geometryRangeMinEpsilon === 0.0001 &&
	policy.computeCandidateDeltaTolerance === 0.0001 &&
	policy.computeParityContractTolerance === 0.0001 &&
	policy.layerCompatibilityDeltaEpsilon === 0.001 &&
	policy.debugRatioDeltaEpsilon === 0.001 &&
	hasProofReceiverScaffoldFacts( policy.proofReceiverScaffold ) &&
	hasNoFields( policy, 'epsilon', 'threshold', 'tolerance' );

const hasLeakProofFixtureFacts = leakProofFacts =>
	leakProofFacts.fixtureMode === 'sealed-wall' &&
	hasProofPolicyFacts( leakProofFacts.proofPolicyFacts ) &&
	Array.isArray( leakProofFacts.rows ) &&
	leakProofFacts.rows.length === 2 &&
	leakProofFacts.proofSettings.resolution === 4 &&
	leakProofFacts.proofSettings.cubemapSize === 8 &&
	leakProofFacts.sampling.weightedProbeSampling === true &&
	leakProofFacts.sampling.probeValidityMode === 'custom' &&
	leakProofFacts.proofSettings.band1Intensity === 1 &&
	leakProofFacts.proofSettings.band2Intensity === 0.55 &&
	leakProofFacts.proofSettings.normalBias === 0.5 &&
	leakProofFacts.proofSettings.viewBias === 0 &&
	leakProofFacts.proofSettings.lightingMode === 'probes only' &&
	leakProofFacts.proofSettings.materialType === 'standard' &&
	hasNoFields( leakProofFacts, 'receiverRegionMetricMode', 'preToneMetricMode', 'proofBoundary', 'sealedWall' );

const hasReceiverFixtureEndpointFacts = endpoint =>
	endpoint !== undefined &&
	(
		endpoint.role === 'left' ||
		endpoint.role === 'right'
	) &&
	Array.isArray( endpoint.position ) &&
	endpoint.position.length === 3 &&
	endpoint.position.every( Number.isFinite );

const hasSealedOffsetWallFixtureAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'second-sealed-fixture-family-activation' &&
	attribution.proofBoundary === 'fixture-family-activation-only' &&
	attribution.fixtureId === 'sealed-offset-wall' &&
	attribution.fixtureFamily === 'sealed-offset-wall' &&
	attribution.activeDivider === 'sealed-offset-wall' &&
	attribution.dividerAxis === 'z' &&
	Number.isFinite( attribution.dividerOffset ) &&
	hasReceiverFixtureEndpointFacts( attribution.leftReceiver ) &&
	hasReceiverFixtureEndpointFacts( attribution.rightReceiver ) &&
	attribution.leftReceiver.role === 'left' &&
	attribution.rightReceiver.role === 'right' &&
	Number.isInteger( attribution.visibleMeshCount ) &&
	attribution.visibleMeshCount > 0 &&
	attribution.offsetVisible === true &&
	attribution.fixtureActivationVerdict === 'sealed-offset-wall-fixture-activates' &&
	hasNoFields( attribution, 'rows', 'samples', 'leakProof', 'verdict', 'supported' );

const hasReceiverBoundarySourceFacts = leakProofFacts => {

	const source = leakProofFacts.receiverBoundarySource;
	const coverage = source?.geometryAttributeCoverage;
	const leftCoverage = coverage?.leftReceiver;
	const rightCoverage = coverage?.rightReceiver;

	return source !== undefined &&
		source.policyId === 'authored-receiver-boundary-source' &&
		source.sourceType === 'tsl-geometry-attribute-node' &&
		source.classifier === 'saturated-binary-class' &&
		source.attributeName === 'boundaryClass' &&
		source.attributeItemSize === 1 &&
		source.defaultWeight === 0 &&
		source.activeWeight === 1 &&
		source.selectionThreshold === 0.5 &&
		source.sampleScope === 'receiver-surface-authored-attribute' &&
		source.interpolationPolicy === 'vertex-authored-varying' &&
		leftCoverage !== null &&
		leftCoverage.vertexCount === 4 &&
		leftCoverage.activeVertexCount === 2 &&
		leftCoverage.activeVertexRatio === 0.5 &&
		rightCoverage !== null &&
		rightCoverage.vertexCount === 4 &&
		rightCoverage.activeVertexCount === 2 &&
		rightCoverage.activeVertexRatio === 0.5 &&
		source.usesIrradianceAttenuation === false &&
		source.proofBoundary === 'source-facts-only' &&
		hasNoFields( source, 'verdict', 'supported', 'residualImprovement' );

};

const hasProbeMaskNearestFacts = nearest =>
	nearest !== undefined &&
	nearest.sampleCount === 8 &&
	Number.isInteger( nearest.defaultOverlapCount ) &&
	Number.isInteger( nearest.boundaryOverlapCount ) &&
	Number.isFinite( nearest.boundaryToDefaultOverlapRatio ) &&
	Array.isArray( nearest.uniqueMasks ) &&
	nearest.uniqueMasks.length > 0;

const hasProbeMaskAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.probeMaskAttribution;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'cpu-probe-layer-mask-overlap' &&
		attribution.source === 'probeLayerMaskSource' &&
		attribution.defaultMask === 1 &&
		attribution.leftBoundaryMask === 2 &&
		attribution.rightBoundaryMask === 4 &&
		attribution.totalProbes === 64 &&
		Number.isInteger( attribution.defaultOverlapCount ) &&
		Number.isInteger( attribution.leftBoundaryOverlapCount ) &&
		Number.isInteger( attribution.rightBoundaryOverlapCount ) &&
		hasProbeMaskNearestFacts( attribution.leftReceiverNearest ) &&
		hasProbeMaskNearestFacts( attribution.rightReceiverNearest ) &&
		hasNoFields( attribution, 'probes', 'rows', 'samples', 'verdict', 'supported' );

};

const hasSampleAlignmentCandidateFacts = candidate =>
	candidate !== undefined &&
	Number.isFinite( candidate.normalBias ) &&
	Number.isInteger( candidate.leftCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.leftCompatibilityChangedContributingSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedContributingSlotCount ) &&
	Number.isFinite( candidate.scalarLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityRightBoundaryToDefaultRatio );

const hasSampleAlignmentAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.sampleAlignmentAttribution;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'normal-bias-neighbor-alignment-candidates' &&
		attribution.proofBoundary === 'runtime-uniform-attribution-only' &&
		attribution.baselineNormalBias === 0.5 &&
		Array.isArray( attribution.candidates ) &&
		attribution.candidates.length === 2 &&
		attribution.candidates.every( hasSampleAlignmentCandidateFacts ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples' );

};

const hasOwnershipShapeAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.ownershipShapeAttribution;
	const assignment = attribution?.assignmentFacts;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'exclusive-region-probe-ownership-candidate' &&
		attribution.proofBoundary === 'probe-meta-mask-attribution-only' &&
		assignment !== undefined &&
		assignment.policyId === 'layer-region-probe-ownership' &&
		assignment.probeOwnershipMaskMode === 'probeMeta.b authored bitfield' &&
		assignment.layerRuleCount === 2 &&
		assignment.boundLayerRuleCount === 2 &&
		assignment.regionRuleCount === 2 &&
		Number.isInteger( assignment.assignedProbeCount ) &&
		Number.isInteger( assignment.compatibleOverlapCount ) &&
		Number.isInteger( attribution.leftCompatibilityChangedSlotCount ) &&
		Number.isInteger( attribution.leftCompatibilityChangedContributingSlotCount ) &&
		Number.isInteger( attribution.rightCompatibilityChangedSlotCount ) &&
		Number.isInteger( attribution.rightCompatibilityChangedContributingSlotCount ) &&
		Number.isFinite( attribution.scalarLeftBoundaryToDefaultRatio ) &&
		Number.isFinite( attribution.scalarRightBoundaryToDefaultRatio ) &&
		Number.isFinite( attribution.visibilityLeftBoundaryToDefaultRatio ) &&
		Number.isFinite( attribution.visibilityRightBoundaryToDefaultRatio ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples' );

};

const hasMultiClassOwnershipCandidateFacts = candidate =>
	candidate !== undefined &&
	(
		candidate.label.endsWith( '-same-side-boundary-sublayers' ) ||
		candidate.label.endsWith( '-cross-side-boundary-sublayers' )
	) &&
	Number.isFinite( candidate.leftBoundaryLayerMask ) &&
	Number.isFinite( candidate.rightBoundaryLayerMask ) &&
	Number.isInteger( candidate.leftCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.leftCompatibilityChangedContributingSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedContributingSlotCount ) &&
	Number.isFinite( candidate.scalarLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarCombinedBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityCombinedBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.finalIrradianceBoundaryToDefaultRatio ) &&
	hasCoefficientContrastSideFacts( candidate.leftCoefficientContrast ) &&
	hasCoefficientContrastSideFacts( candidate.rightCoefficientContrast ) &&
	(
		candidate.candidateVerdict === 'candidate-preserves-boundary-irradiance' ||
		candidate.candidateVerdict === 'rejected-overpruned-boundary-irradiance'
	);

const hasMultiClassOwnershipVariantFacts = variant => {

	const assignment = variant?.assignmentFacts;

	return variant !== undefined &&
		(
			variant.variantLabel === 'strict' ||
			variant.variantLabel === 'overlap'
		) &&
		assignment !== undefined &&
		assignment.policyId === 'layer-region-probe-ownership' &&
		assignment.probeOwnershipMaskMode === 'probeMeta.b authored bitfield' &&
		assignment.layerRuleCount === 4 &&
		assignment.boundLayerRuleCount === 4 &&
		assignment.regionRuleCount === 4 &&
		Number.isInteger( assignment.assignedProbeCount ) &&
		assignment.defaultProbeCount === 0 &&
		Array.isArray( variant.candidates ) &&
		variant.candidates.length === 2 &&
		variant.candidates.every( hasMultiClassOwnershipCandidateFacts );

};

const hasMultiClassOwnershipAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.multiClassOwnershipAttribution;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'multi-class-boundary-probe-ownership-candidate' &&
		attribution.proofBoundary === 'probe-meta-mask-and-neighbor-sh-attribution-only' &&
		attribution.defaultEquivalencePolicy === 'all-assigned-probes-keep-default-layer-bit' &&
		attribution.candidateShape === 'default-compatible-side-boundary-sublayers' &&
		Array.isArray( attribution.variants ) &&
		attribution.variants.length === 2 &&
		attribution.variants.every( hasMultiClassOwnershipVariantFacts ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples', 'neighbors' );

};

const hasSoftBoundaryOverlapCandidateFacts = candidate =>
	candidate !== undefined &&
	typeof candidate.label === 'string' &&
	Number.isFinite( candidate.activeValue ) &&
	Number.isFinite( candidate.leftBoundaryLayerMask ) &&
	Number.isFinite( candidate.rightBoundaryLayerMask ) &&
	Number.isInteger( candidate.leftCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.leftCompatibilityChangedContributingSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedContributingSlotCount ) &&
	Number.isFinite( candidate.scalarLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarCombinedBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityCombinedBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.finalIrradianceBoundaryToDefaultRatio ) &&
	hasCoefficientContrastSideFacts( candidate.leftCoefficientContrast ) &&
	hasCoefficientContrastSideFacts( candidate.rightCoefficientContrast ) &&
	(
		candidate.candidateVerdict === 'candidate-changes-boundary-irradiance' ||
		candidate.candidateVerdict === 'rejected-normalization-cancelled-boundary-irradiance' ||
		candidate.candidateVerdict === 'rejected-overpruned-boundary-irradiance'
	);

const hasSoftBoundaryOverlapAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.softBoundaryOverlapAttribution;
	const assignment = attribution?.assignmentFacts;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'soft-boundary-overlap-classification-candidate' &&
		attribution.proofBoundary === 'probe-meta-mask-and-receiver-blend-attribution-only' &&
		assignment !== undefined &&
		assignment.policyId === 'layer-region-probe-ownership' &&
		assignment.probeOwnershipMaskMode === 'probeMeta.b authored bitfield' &&
		assignment.layerRuleCount === 4 &&
		assignment.boundLayerRuleCount === 4 &&
		assignment.regionRuleCount === 4 &&
		Array.isArray( attribution.candidates ) &&
		attribution.candidates.length === 2 &&
		attribution.candidates.every( hasSoftBoundaryOverlapCandidateFacts ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples', 'neighbors' );

};

const hasCoefficientSideWeightingCandidateFacts = candidate =>
	candidate !== undefined &&
	typeof candidate.label === 'string' &&
	Number.isFinite( candidate.activeValue ) &&
	Number.isFinite( candidate.leftBoundaryLayerMask ) &&
	Number.isFinite( candidate.rightBoundaryLayerMask ) &&
	Number.isInteger( candidate.leftCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.leftCompatibilityChangedContributingSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedContributingSlotCount ) &&
	Number.isFinite( candidate.scalarLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarCombinedBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityCombinedBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.finalIrradianceBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarCoefficientAccumulatorBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityCoefficientAccumulatorBoundaryToDefaultRatio ) &&
	(
		candidate.candidateVerdict === 'rejected-mass-attenuation-before-normalization' ||
		candidate.candidateVerdict === 'candidate-needs-render-ratio-promotion'
	);

const hasCoefficientSideWeightingAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.coefficientSideWeightingAttribution;
	const assignment = attribution?.assignmentFacts;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'coefficient-side-weighting-candidate' &&
		attribution.proofBoundary === 'coefficient-accumulator-attribution-only' &&
		assignment !== undefined &&
		assignment.policyId === 'layer-region-probe-ownership' &&
		assignment.probeOwnershipMaskMode === 'probeMeta.b authored bitfield' &&
		Array.isArray( attribution.candidates ) &&
		attribution.candidates.length === 2 &&
		attribution.candidates.every( hasCoefficientSideWeightingCandidateFacts ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples', 'neighbors' );

};

const hasSupportSetProbeMaskSummary = summary =>
	summary !== undefined &&
	Number.isInteger( summary.uniqueMaskCount ) &&
	(
		summary.maskMin === null ||
		Number.isInteger( summary.maskMin )
	) &&
	(
		summary.maskMax === null ||
		Number.isInteger( summary.maskMax )
	);

const hasSupportSetSideFacts = side =>
	side !== undefined &&
	Number.isInteger( side.changedSlotCount ) &&
	Number.isInteger( side.stableSlotCount ) &&
	Number.isInteger( side.contributingSlotCount ) &&
	Number.isInteger( side.changedContributingSlotCount ) &&
	Number.isInteger( side.zeroBaseChangedSlotCount ) &&
	Number.isInteger( side.overprunedChangedSlotCount ) &&
	Number.isInteger( side.sameProbeIndexSlotCount ) &&
	Number.isInteger( side.changedProbeIndexSlotCount ) &&
	Number.isInteger( side.changedContributingSameProbeIndexSlotCount ) &&
	Number.isInteger( side.changedContributingChangedProbeIndexSlotCount ) &&
	Number.isFinite( side.defaultBaseTotal ) &&
	Number.isFinite( side.boundaryBaseTotal ) &&
	Number.isFinite( side.defaultVisibilityTotal ) &&
	Number.isFinite( side.boundaryVisibilityTotal ) &&
	Number.isFinite( side.changedDefaultBaseShare ) &&
	Number.isFinite( side.changedBoundaryBaseShare ) &&
	Number.isFinite( side.changedDefaultVisibilityShare ) &&
	Number.isFinite( side.changedBoundaryVisibilityShare ) &&
	hasSupportSetProbeMaskSummary( side.defaultProbeMasks ) &&
	hasSupportSetProbeMaskSummary( side.boundaryProbeMasks );

const hasSupportSetRelocationFeasibilityFacts = feasibility =>
	feasibility !== undefined &&
	feasibility.probeIdentityPolicy === 'default-boundary-neighbor-index-comparison' &&
	Number.isInteger( feasibility.leftChangedProbeIndexSlotCount ) &&
	Number.isInteger( feasibility.rightChangedProbeIndexSlotCount ) &&
	Number.isInteger( feasibility.leftChangedContributingChangedProbeIndexSlotCount ) &&
	Number.isInteger( feasibility.rightChangedContributingChangedProbeIndexSlotCount ) &&
	(
		feasibility.nextCandidateShape === 'bake-time-relocation-or-probe-side-classification' ||
		feasibility.nextCandidateShape === 'current-support-can-change-probe-identities'
	) &&
	(
		feasibility.relocationVerdict === 'candidate-needs-bake-time-probe-identity-change' ||
		feasibility.relocationVerdict === 'candidate-has-probe-identity-change'
	);

const hasSupportSetRelocationRequirementFacts = requirement =>
	requirement !== undefined &&
	requirement.identitySummaryPolicy === 'all-candidate-boundary-default-probe-identity-check' &&
	typeof requirement.allCandidatesSameProbeIdentity === 'boolean' &&
	(
		requirement.requiredNextLane === 'bake-time-relocation-or-probe-side-classification' ||
		requirement.requiredNextLane === 'candidate-support-identity-change-exists'
	) &&
	(
		requirement.receiverSideSupportVerdict === 'archive-receiver-side-support-routing' ||
		requirement.receiverSideSupportVerdict === 'continue-receiver-side-support-routing'
	);

const hasSupportSetAttributionCandidateFacts = candidate =>
	candidate !== undefined &&
	typeof candidate.label === 'string' &&
	Number.isFinite( candidate.activeValue ) &&
	Number.isInteger( candidate.leftBoundaryLayerMask ) &&
	Number.isInteger( candidate.rightBoundaryLayerMask ) &&
	candidate.receiverBoundaryMode === 'blend' &&
	candidate.rawBoundaryWeight === true &&
	Number.isFinite( candidate.scalarCombinedBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityCombinedBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.finalIrradianceBoundaryToDefaultRatio ) &&
	hasSupportSetSideFacts( candidate.left ) &&
	hasSupportSetSideFacts( candidate.right ) &&
	hasSupportSetRelocationFeasibilityFacts( candidate.relocationFeasibility ) &&
	(
		candidate.lossClassification === 'normalization-cancelled-coefficient-loss' ||
		candidate.lossClassification === 'overpruned-support-loss' ||
		candidate.lossClassification === 'candidate-has-non-collapsing-support-change'
	);

const hasSupportSetAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.supportSetAttribution;
	const assignment = attribution?.assignmentFacts;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'support-set-coefficient-loss-attribution' &&
		attribution.proofBoundary === 'aggregate-support-attribution-only' &&
		assignment !== undefined &&
		assignment.policyId === 'layer-region-probe-ownership' &&
		assignment.probeOwnershipMaskMode === 'probeMeta.b authored bitfield' &&
		hasSupportSetRelocationRequirementFacts( attribution.relocationRequirement ) &&
		Array.isArray( attribution.candidates ) &&
		attribution.candidates.length === 2 &&
		attribution.candidates.every( hasSupportSetAttributionCandidateFacts ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples', 'neighbors' );

};

const hasSetupSideSupportFacts = support =>
	support !== undefined &&
	support.supportSize === 8 &&
	Number.isInteger( support.occupiedSupportCount ) &&
	Number.isInteger( support.validSupportCount ) &&
	support.occupiedSupportCount + support.validSupportCount === support.supportSize &&
	Number.isFinite( support.meanDistanceSq );

const hasSetupSideIdentityFacts = identity =>
	identity !== undefined &&
	Number.isInteger( identity.overlapCount ) &&
	Number.isInteger( identity.identityChangeCount ) &&
	Number.isFinite( identity.identityChangeRatio );

const hasSetupSideDescriptorCompatibilityFacts = compatibility =>
	compatibility !== undefined &&
	compatibility.supportSize === 8 &&
	Number.isInteger( compatibility.defaultCompatibleCount ) &&
	Number.isInteger( compatibility.boundaryCompatibleCount ) &&
	Number.isInteger( compatibility.defaultAndBoundaryCompatibleCount ) &&
	Number.isFinite( compatibility.defaultAndBoundaryCompatibilityRatio ) &&
	compatibility.defaultCompatibleCount <= compatibility.supportSize &&
	compatibility.boundaryCompatibleCount <= compatibility.supportSize &&
	compatibility.defaultAndBoundaryCompatibleCount <= compatibility.supportSize;

const hasSetupSideDescriptorHash = value =>
	typeof value === 'string' &&
	/^fnv1a32:[0-9a-f]{8}$/.test( value );

const hasSetupSideGridCoordSummaryFacts = summary =>
	summary !== undefined &&
	Number.isFinite( summary.meanX ) &&
	Number.isFinite( summary.meanY ) &&
	Number.isFinite( summary.meanZ ) &&
	Number.isInteger( summary.minX ) &&
	Number.isInteger( summary.minY ) &&
	Number.isInteger( summary.minZ ) &&
	Number.isInteger( summary.maxX ) &&
	Number.isInteger( summary.maxY ) &&
	Number.isInteger( summary.maxZ ) &&
	summary.minX <= summary.maxX &&
	summary.minY <= summary.maxY &&
	summary.minZ <= summary.maxZ;

const hasSetupSideDescriptorFacts = ( descriptor, role ) =>
	descriptor !== undefined &&
	descriptor.descriptorRole === role &&
	(
		descriptor.side === 'left' ||
		descriptor.side === 'right'
	) &&
	descriptor.probeMaskSource === 'setup-classified-probeLayerMasks' &&
	descriptor.receiverLayerMask === 1 &&
	Number.isInteger( descriptor.receiverBoundaryLayerMask ) &&
	Number.isFinite( descriptor.receiverBoundaryWeight ) &&
	Number.isInteger( descriptor.effectiveReceiverMask ) &&
	hasSetupSideDescriptorHash( descriptor.selectedSupportIdentityHash ) &&
	hasSetupSideDescriptorHash( descriptor.selectedSupportLayerMaskHash ) &&
	descriptor.supportHashPolicy === 'ordered-probe-index-fnv1a32' &&
	descriptor.supportSize === 8;

const hasSetupSideDescriptorFactSet = facts =>
	facts !== undefined &&
	hasSetupSideDescriptorFacts( facts.debugDefault, 'debug-default' ) &&
	hasSetupSideDescriptorFacts( facts.debugSetupClassified, 'debug-setup-classified' ) &&
	hasSetupSideDescriptorFacts( facts.renderGuardSetupClassified, 'render-guard-setup-classified' );

const hasSetupSideDescriptorParityFacts = parity =>
	parity !== undefined &&
	typeof parity.probeMaskSourceMatch === 'boolean' &&
	typeof parity.receiverMaskMatch === 'boolean' &&
	typeof parity.boundaryMaskMatch === 'boolean' &&
	typeof parity.selectedSupportIdentityHashMatch === 'boolean' &&
	typeof parity.selectedSupportLayerMaskHashMatch === 'boolean' &&
	(
		parity.descriptorParityVerdict === 'debug-render-descriptor-parity' ||
		parity.descriptorParityVerdict === 'debug-render-descriptor-attribution-mismatch' ||
		parity.descriptorParityVerdict === 'default-setup-descriptor-collapse' ||
		parity.descriptorParityVerdict === 'default-setup-descriptor-split'
	);

const hasSetupSideSupportRankFacts = side =>
	side !== undefined &&
	(
		side.side === 'left' ||
		side.side === 'right'
	) &&
	Number.isInteger( side.boundaryLayerMask ) &&
	Number.isInteger( side.defaultCandidateCount ) &&
	Number.isInteger( side.classifiedCandidateCount ) &&
	side.defaultCandidateCount >= 8 &&
	side.topCandidateWindow === 16 &&
	Number.isInteger( side.topCandidateOverlapCount ) &&
	hasSetupSideDescriptorHash( side.defaultSupportIdentityHash ) &&
	hasSetupSideDescriptorHash( side.classifiedSupportIdentityHash ) &&
	hasSetupSideDescriptorHash( side.defaultSupportLayerMaskHash ) &&
	hasSetupSideDescriptorHash( side.classifiedSupportLayerMaskHash ) &&
	hasSetupSideDescriptorHash( side.defaultSupportGridCoordHash ) &&
	hasSetupSideDescriptorHash( side.classifiedSupportGridCoordHash ) &&
	hasSetupSideGridCoordSummaryFacts( side.defaultSupportGridCoordSummary ) &&
	hasSetupSideGridCoordSummaryFacts( side.classifiedSupportGridCoordSummary ) &&
	side.supportHashPolicy === 'ordered-probe-index-fnv1a32' &&
	Number.isInteger( side.identityChangeCount ) &&
	Number.isFinite( side.identityChangeRatio ) &&
	Number.isInteger( side.defaultSupportBoundaryCompatibleCount ) &&
	Number.isFinite( side.defaultSupportBoundaryCompatibilityRatio ) &&
	Number.isInteger( side.classifiedSupportDefaultCompatibleCount ) &&
	Number.isInteger( side.classifiedSupportBoundaryCompatibleCount ) &&
	Number.isInteger( side.defaultOccupiedSupportCount ) &&
	Number.isInteger( side.classifiedOccupiedSupportCount ) &&
	Number.isFinite( side.defaultMeanDistanceSq ) &&
	Number.isFinite( side.classifiedMeanDistanceSq ) &&
	(
		side.blockerVerdict === 'side-has-setup-identity-change' ||
		side.blockerVerdict === 'blocked-incomplete-classified-support' ||
		side.blockerVerdict === 'blocked-default-support-already-boundary-compatible' ||
		side.blockerVerdict === 'blocked-nearest-candidate-rank-overlap' ||
		side.blockerVerdict === 'blocked-no-selected-identity-change'
	);

const hasSetupSideSymmetryVariantFacts = variant =>
	variant !== undefined &&
	(
		variant.variantLabel === 'overlap-default-compatible-boundary-sublayers' ||
		variant.variantLabel === 'strict-default-compatible-boundary-sublayers'
	) &&
	variant.assignmentPolicy === 'layer-region-probe-ownership' &&
	variant.probeOwnershipMaskMode === 'probeMeta.b authored bitfield' &&
	Number.isInteger( variant.assignedProbeCount ) &&
	Number.isInteger( variant.compatibleOverlapCount ) &&
	hasSetupSideSupportRankFacts( variant.left ) &&
	hasSetupSideSupportRankFacts( variant.right ) &&
	variant.left.side === 'left' &&
	variant.right.side === 'right' &&
	(
		variant.sideSymmetryVerdict === 'candidate-has-bilateral-identity-change' ||
		variant.sideSymmetryVerdict === 'rejected-incomplete-classified-support' ||
		variant.sideSymmetryVerdict === 'rejected-right-side-identity-fixed' ||
		variant.sideSymmetryVerdict === 'rejected-left-side-identity-fixed'
	);

const hasSetupSideSymmetryAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'setup-side-classification-side-symmetry' &&
	attribution.proofBoundary === 'cpu-support-rank-mask-attribution-only' &&
	attribution.candidateShape === 'default-compatible-side-boundary-sublayers' &&
	attribution.receiverPointPolicy === 'world-bounds-near-divider-edge' &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	attribution.testedVariantCount === 2 &&
	Number.isInteger( attribution.rightIdentityFixedVariantCount ) &&
	Array.isArray( attribution.variants ) &&
	attribution.variants.length === 2 &&
	attribution.variants.every( hasSetupSideSymmetryVariantFacts ) &&
	(
		attribution.gate3Verdict === 'continue-setup-side-classification-product-candidate' ||
		attribution.gate3Verdict === 'archive-setup-side-classification-left-only'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'probes', 'verdict', 'supported' );

const hasProbeSideClassificationVariantFacts = attribution =>
	attribution !== undefined &&
	(
		attribution.attributionPolicy === 'probe-side-classification-default-overlap-exclusion' ||
		attribution.attributionPolicy === 'probe-side-classification-occupied-support-exclusion'
	) &&
	attribution.proofBoundary === 'cpu-support-rank-mask-attribution-only' &&
	attribution.coefficientPolicy === 'packed-atlas-l0-support-mean' &&
	(
		attribution.candidateShape === 'exclude-default-support-probes-from-boundary-class' ||
		attribution.candidateShape === 'exclude-default-and-occupied-support-probes-from-boundary-class'
	) &&
	typeof attribution.excludeOccupiedSupport === 'boolean' &&
	attribution.receiverPointPolicy === 'world-bounds-near-divider-edge' &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	hasSetupSideSupportRankFacts( attribution.left ) &&
	hasSetupSideSupportRankFacts( attribution.right ) &&
	hasSetupSideCoefficientComparisonFacts( attribution.left.coefficientComparison ) &&
	hasSetupSideCoefficientComparisonFacts( attribution.right.coefficientComparison ) &&
	attribution.left.side === 'left' &&
	attribution.right.side === 'right' &&
	(
		attribution.probeSideClassificationVerdict === 'candidate-has-bilateral-probe-identity-change' ||
		attribution.probeSideClassificationVerdict === 'candidate-needs-relocation-after-probe-side-classification'
	) &&
	(
		attribution.probeSideCoefficientVerdict === 'blocked-no-bilateral-probe-identity-change' ||
		attribution.probeSideCoefficientVerdict === 'candidate-reduces-wrong-side-l0-bilaterally' ||
		attribution.probeSideCoefficientVerdict === 'candidate-has-mixed-probe-side-l0-result' ||
		attribution.probeSideCoefficientVerdict === 'candidate-has-no-probe-side-l0-win'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'probes', 'verdict', 'supported' );

const hasProbeSideClassificationAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'probe-side-classification-candidate-set' &&
	attribution.proofBoundary === 'cpu-support-rank-and-l0-attribution-only' &&
	attribution.candidateShape === 'probe-side-boundary-support-exclusion-candidates' &&
	attribution.candidateCount === 2 &&
	hasProbeSideClassificationVariantFacts( attribution.defaultOverlapExclusion ) &&
	hasProbeSideClassificationVariantFacts( attribution.occupiedSupportExclusion ) &&
	attribution.defaultOverlapExclusion.excludeOccupiedSupport === false &&
	attribution.occupiedSupportExclusion.excludeOccupiedSupport === true &&
	(
		attribution.probeSideLaneVerdict === 'continue-probe-side-classification-to-irradiance-gate' ||
		attribution.probeSideLaneVerdict === 'candidate-needs-relocation-after-probe-side-classification'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'probes', 'verdict', 'supported' );

const hasProbeSideRelocationOracleSideFacts = side =>
	hasSetupSideSupportRankFacts( side ) &&
	Number.isInteger( side.relocationCandidatePoolCount ) &&
	side.relocationCandidatePoolCount >= side.classifiedCandidateCount &&
	side.relocationRankingPolicy === 'non-occupied-boundary-probe-lowest-l0-wrong-to-correct' &&
	hasSetupSideCoefficientComparisonFacts( side.coefficientComparison );

const hasProbeSideRelocationOracleAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'probe-side-relocation-l0-oracle' &&
	attribution.proofBoundary === 'cpu-oracle-support-rank-and-l0-attribution-only' &&
	attribution.coefficientPolicy === 'packed-atlas-l0-support-mean' &&
	attribution.candidateShape === 'non-occupied-boundary-probe-l0-ranked-relocation-oracle' &&
	attribution.receiverPointPolicy === 'world-bounds-near-divider-edge' &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	hasProbeSideRelocationOracleSideFacts( attribution.left ) &&
	hasProbeSideRelocationOracleSideFacts( attribution.right ) &&
	attribution.left.side === 'left' &&
	attribution.right.side === 'right' &&
	(
		attribution.relocationOracleVerdict === 'oracle-finds-bilateral-l0-relocation-candidate' ||
		attribution.relocationOracleVerdict === 'oracle-fails-bilateral-l0-relocation-candidate'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'probes', 'verdict', 'supported' );

const hasProbeSideRelocationProxySideFacts = ( side, relocationRankingPolicy ) =>
	hasSetupSideSupportRankFacts( side ) &&
	Number.isInteger( side.relocationCandidatePoolCount ) &&
	side.relocationCandidatePoolCount >= side.classifiedCandidateCount &&
	side.relocationRankingPolicy === relocationRankingPolicy &&
	hasSetupSideCoefficientComparisonFacts( side.coefficientComparison );

const hasProbeSideRelocationProxyAttributionFacts = ( attribution, options ) =>
	attribution !== undefined &&
	attribution.attributionPolicy === options.attributionPolicy &&
	attribution.proofBoundary === 'cpu-support-rank-and-l0-attribution-only' &&
	attribution.coefficientPolicy === 'packed-atlas-l0-support-mean' &&
	attribution.candidateShape === options.candidateShape &&
	attribution.receiverPointPolicy === 'world-bounds-near-divider-edge' &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	hasProbeSideRelocationProxySideFacts( attribution.left, options.relocationRankingPolicy ) &&
	hasProbeSideRelocationProxySideFacts( attribution.right, options.relocationRankingPolicy ) &&
	attribution.left.side === 'left' &&
	attribution.right.side === 'right' &&
	(
		attribution.relocationProxyVerdict === 'proxy-finds-bilateral-l0-relocation-candidate' ||
		attribution.relocationProxyVerdict === 'proxy-fails-bilateral-l0-relocation-candidate'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'probes', 'verdict', 'supported' );

const hasProbeSideRelocationDistanceProxyAttributionFacts = attribution =>
	hasProbeSideRelocationProxyAttributionFacts( attribution, {
		attributionPolicy: 'probe-side-relocation-distance-proxy',
		candidateShape: 'non-occupied-boundary-probe-distance-ranked-relocation-proxy',
		relocationRankingPolicy: 'non-occupied-boundary-probe-farthest-from-receiver-edge'
	} );

const hasProbeSideRelocationDividerProxyAttributionFacts = attribution =>
	hasProbeSideRelocationProxyAttributionFacts( attribution, {
		attributionPolicy: 'probe-side-relocation-divider-proxy',
		candidateShape: 'non-occupied-boundary-probe-divider-ranked-relocation-proxy',
		relocationRankingPolicy: 'non-occupied-boundary-probe-closest-to-divider-then-nearest-receiver'
	} );

const hasProbeSideRelocationVisibilityProxySideFacts = side =>
	hasProbeSideRelocationProxySideFacts(
		side,
		'non-occupied-boundary-probe-highest-moment-visibility-to-receiver'
	) &&
	Number.isFinite( side.classifiedMeanVisibilityEstimate );

const hasProbeSideRelocationVisibilityProxyAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'probe-side-relocation-visibility-proxy' &&
	attribution.proofBoundary === 'cpu-visibility-moment-rank-and-l0-attribution-only' &&
	attribution.coefficientPolicy === 'packed-atlas-l0-support-mean' &&
	attribution.candidateShape === 'non-occupied-boundary-probe-visibility-ranked-relocation-proxy' &&
	attribution.receiverPointPolicy === 'world-bounds-near-divider-edge' &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	hasProbeSideRelocationVisibilityProxySideFacts( attribution.left ) &&
	hasProbeSideRelocationVisibilityProxySideFacts( attribution.right ) &&
	attribution.left.side === 'left' &&
	attribution.right.side === 'right' &&
	(
		attribution.relocationProxyVerdict === 'proxy-finds-bilateral-l0-relocation-candidate' ||
		attribution.relocationProxyVerdict === 'proxy-fails-bilateral-l0-relocation-candidate'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'probes', 'verdict', 'supported' );

const hasProbeSideRelocationSideShellProxyAttributionFacts = attribution =>
	hasProbeSideRelocationProxyAttributionFacts( attribution, {
		attributionPolicy: 'probe-side-relocation-side-shell-proxy',
		candidateShape: 'non-occupied-boundary-probe-side-shell-ranked-relocation-proxy',
		relocationRankingPolicy: 'non-occupied-boundary-probe-interior-side-shell-then-nearest-receiver'
	} );

const hasGridCoordFacts = coord =>
	coord !== undefined &&
	Number.isFinite( coord.x ) &&
	Number.isFinite( coord.y ) &&
	Number.isFinite( coord.z );

const hasIntegerGridCoordFacts = coord =>
	coord !== undefined &&
	Number.isInteger( coord.x ) &&
	Number.isInteger( coord.y ) &&
	Number.isInteger( coord.z );

const hasSideShellLocalCellReachabilitySideFacts = side =>
	side !== undefined &&
	(
		side.side === 'left' ||
		side.side === 'right'
	) &&
	Number.isInteger( side.boundaryLayerMask ) &&
	side.samplePointPolicy === 'receiver-edge-plus-normal-view-bias' &&
	Number.isFinite( side.normalBias ) &&
	Number.isFinite( side.viewBias ) &&
	hasGridCoordFacts( side.probeCoord ) &&
	hasIntegerGridCoordFacts( side.baseCoord ) &&
	hasSetupSideDescriptorHash( side.localCellSupportIdentityHash ) &&
	hasSetupSideDescriptorHash( side.localCellSupportGridCoordHash ) &&
	hasSetupSideGridCoordSummaryFacts( side.localCellSupportGridCoordSummary ) &&
	hasSetupSideDescriptorHash( side.sideShellSupportIdentityHash ) &&
	hasSetupSideDescriptorHash( side.sideShellSupportGridCoordHash ) &&
	hasSetupSideGridCoordSummaryFacts( side.sideShellSupportGridCoordSummary ) &&
	Number.isInteger( side.localCellOverlapCount ) &&
	side.localCellOverlapCount >= 0 &&
	side.localCellOverlapCount <= 8 &&
	Number.isFinite( side.localCellOverlapRatio ) &&
	(
		side.reachabilityVerdict === 'side-shell-support-fully-reachable-by-local-cell' ||
		side.reachabilityVerdict === 'side-shell-support-partially-reachable-by-local-cell' ||
		side.reachabilityVerdict === 'side-shell-support-not-reachable-by-local-cell'
	);

const hasSideShellLocalCellReachabilityAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'probe-side-relocation-side-shell-local-cell-reachability' &&
	attribution.proofBoundary === 'cpu-local-cell-support-overlap-only' &&
	attribution.receiverPointPolicy === 'world-bounds-near-divider-edge' &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	hasSideShellLocalCellReachabilitySideFacts( attribution.left ) &&
	hasSideShellLocalCellReachabilitySideFacts( attribution.right ) &&
	(
		attribution.localCellReachabilityVerdict === 'side-shell-support-reachable-by-local-reconstruction-cell' ||
		attribution.localCellReachabilityVerdict === 'side-shell-support-needs-true-local-cell-relocation'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'probes', 'verdict', 'supported' );

const hasLocalCellRelocationCandidateSideFacts = side =>
	hasSetupSideSupportRankFacts( side ) &&
	side.samplePointPolicy === 'receiver-edge-plus-normal-view-bias' &&
	Number.isFinite( side.normalBias ) &&
	Number.isFinite( side.viewBias ) &&
	hasGridCoordFacts( side.probeCoord ) &&
	hasIntegerGridCoordFacts( side.baseCoord ) &&
	side.relocationRankingPolicy === 'reachable-local-cell-support' &&
	hasSetupSideCoefficientComparisonFacts( side.coefficientComparison );

const hasLocalCellRelocationCandidateAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'probe-side-relocation-local-cell-candidate' &&
	attribution.proofBoundary === 'cpu-local-cell-support-and-l0-attribution-only' &&
	attribution.coefficientPolicy === 'packed-atlas-l0-support-mean' &&
	attribution.candidateShape === 'reachable-local-cell-support-candidate' &&
	attribution.receiverPointPolicy === 'world-bounds-near-divider-edge' &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	hasLocalCellRelocationCandidateSideFacts( attribution.left ) &&
	hasLocalCellRelocationCandidateSideFacts( attribution.right ) &&
	(
		attribution.localCellCandidateVerdict === 'local-cell-support-has-bilateral-l0-win' ||
		attribution.localCellCandidateVerdict === 'local-cell-support-needs-physical-placement-relocation'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'probes', 'verdict', 'supported' );

const hasPhysicalPlacementRequirementSideFacts = side =>
	side !== undefined &&
	(
		side.side === 'left' ||
		side.side === 'right'
	) &&
	Number.isInteger( side.boundaryLayerMask ) &&
	side.samplePointPolicy === 'receiver-edge-plus-normal-view-bias' &&
	Number.isFinite( side.normalBias ) &&
	Number.isFinite( side.viewBias ) &&
	hasGridCoordFacts( side.targetProbeCoord ) &&
	hasIntegerGridCoordFacts( side.targetBaseCoord ) &&
	hasSetupSideDescriptorHash( side.targetSupportIdentityHash ) &&
	hasSetupSideDescriptorHash( side.targetSupportGridCoordHash ) &&
	hasSetupSideGridCoordSummaryFacts( side.targetSupportGridCoordSummary ) &&
	hasSetupSideDescriptorHash( side.sourceSupportIdentityHash ) &&
	hasSetupSideDescriptorHash( side.sourceSupportGridCoordHash ) &&
	hasSetupSideGridCoordSummaryFacts( side.sourceSupportGridCoordSummary ) &&
	Number.isInteger( side.overlapCount ) &&
	Number.isInteger( side.replacementSlotCount ) &&
	Number.isInteger( side.occupiedReplacementSlotCount ) &&
	Number.isInteger( side.sourceOutsideLocalCellCount ) &&
	Number.isInteger( side.targetOccupiedSupportCount ) &&
	Number.isInteger( side.sourceOccupiedSupportCount ) &&
	side.overlapCount >= 0 &&
	side.overlapCount <= 8 &&
	side.replacementSlotCount >= 0 &&
	side.replacementSlotCount <= 8 &&
	side.occupiedReplacementSlotCount >= 0 &&
	side.occupiedReplacementSlotCount <= side.replacementSlotCount &&
	side.sourceOutsideLocalCellCount >= 0 &&
	side.sourceOutsideLocalCellCount <= 8 &&
	hasSetupSideCoefficientComparisonFacts( side.targetCoefficientComparison ) &&
	hasSetupSideCoefficientComparisonFacts( side.sourceCoefficientComparison ) &&
	(
		side.placementRequirementVerdict === 'physical-placement-can-transplant-side-owned-l0-into-local-cell' ||
		side.placementRequirementVerdict === 'physical-placement-source-does-not-prove-local-cell-benefit'
	);

const hasPhysicalPlacementRequirementAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'probe-side-relocation-physical-placement-requirement' &&
	attribution.proofBoundary === 'cpu-placement-requirement-and-l0-attribution-only' &&
	attribution.coefficientPolicy === 'packed-atlas-l0-support-mean' &&
	attribution.candidateShape === 'transplant-side-shell-support-into-reachable-local-cell' &&
	attribution.receiverPointPolicy === 'world-bounds-near-divider-edge' &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	hasPhysicalPlacementRequirementSideFacts( attribution.left ) &&
	hasPhysicalPlacementRequirementSideFacts( attribution.right ) &&
	(
		attribution.physicalPlacementRequirementVerdict === 'physical-local-cell-placement-required-and-l0-supported' ||
		attribution.physicalPlacementRequirementVerdict === 'physical-local-cell-placement-requirement-not-proven'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'probes', 'verdict', 'supported' );

const hasLocalCellPlacementHelperSideFacts = side =>
	side !== undefined &&
	(
		side.side === 'left' ||
		side.side === 'right'
	) &&
	Number.isInteger( side.boundaryLayerMask ) &&
	side.placementPolicyId === 'local-cell-placement-policy' &&
	hasSetupSideDescriptorHash( side.targetSupportIdentityHash ) &&
	hasSetupSideDescriptorHash( side.targetSupportGridCoordHash ) &&
	hasSetupSideDescriptorHash( side.sourceSupportIdentityHash ) &&
	hasSetupSideDescriptorHash( side.sourceSupportGridCoordHash ) &&
	side.targetSupportSize === 8 &&
	side.sourceSupportSize === 8 &&
	Number.isInteger( side.overlapCount ) &&
	Number.isInteger( side.replacementSlotCount ) &&
	Number.isInteger( side.occupiedReplacementSlotCount ) &&
	Number.isInteger( side.sourceOutsideLocalCellCount ) &&
	Number.isInteger( side.targetOccupiedSupportCount ) &&
	Number.isInteger( side.sourceOccupiedSupportCount ) &&
	side.overlapCount >= 0 &&
	side.overlapCount <= 8 &&
	side.replacementSlotCount >= 0 &&
	side.replacementSlotCount <= 8 &&
	side.occupiedReplacementSlotCount >= 0 &&
	side.occupiedReplacementSlotCount <= side.replacementSlotCount &&
	(
		side.placementPolicyVerdict === 'side-passes-local-cell-placement-policy' ||
		side.placementPolicyVerdict === 'side-fails-local-cell-placement-policy'
	);

const hasLocalCellPlacementPolicyFacts = policy =>
	policy !== undefined &&
	policy.policyId === 'local-cell-placement-policy' &&
	policy.requiredTargetSupportSize === 8 &&
	policy.requiredSourceSupportSize === 8 &&
	policy.minReplacementSlotCount === 1 &&
	policy.minOccupiedReplacementSlotCount === 1 &&
	policy.maxSourceOccupiedSupportCount === 0;

const hasLocalCellPlacementHelperAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'probe-side-relocation-local-cell-placement-helper' &&
	attribution.proofBoundary === 'setup-helper-array-generation-only' &&
	attribution.helperPolicyId === 'local-cell-placement' &&
	hasLocalCellPlacementPolicyFacts( attribution.placementPolicyFacts ) &&
	attribution.totalProbes === 64 &&
	attribution.acceptedSideCount === 2 &&
	attribution.probeValidityLength === attribution.totalProbes &&
	attribution.probeLayerMasksLength === attribution.totalProbes &&
	Number.isInteger( attribution.replacementSlotCount ) &&
	Number.isInteger( attribution.occupiedReplacementSlotCount ) &&
	Array.isArray( attribution.sideFacts ) &&
	attribution.sideFacts.length === 2 &&
	attribution.sideFacts.every( hasLocalCellPlacementHelperSideFacts ) &&
	(
		attribution.placementHelperVerdict === 'helper-emits-local-cell-placement-arrays' ||
		attribution.placementHelperVerdict === 'helper-has-no-local-cell-placement-work'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'probes', 'verdict', 'supported' );

const hasSealedOffsetWallPlacementHelperAttributionFacts = attribution =>
	hasLocalCellPlacementHelperAttributionFacts( attribution ) &&
	attribution.fixtureId === 'sealed-offset-wall' &&
	attribution.fixtureFamily === 'sealed-offset-wall';

const hasPlacementAuthoringSourceSelectionPolicyFacts = policy =>
	policy !== undefined &&
	policy.policyId === 'side-shell-local-cell-source-policy' &&
	policy.ranking === 'side-shell-topology-then-receiver-distance' &&
	policy.forbiddenInputs === undefined;

const hasPlacementAuthoringAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'placement-authoring-product-module' &&
	attribution.modulePath === 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js' &&
	attribution.authoringPolicyId === 'placement-authoring' &&
	hasLocalCellPlacementPolicyFacts( attribution.placementPolicyFacts ) &&
	hasPlacementAuthoringSourceSelectionPolicyFacts( attribution.sourceSelectionPolicyFacts ) &&
	attribution.totalProbes === 64 &&
	attribution.receiverRegionCount === 2 &&
	attribution.layerRuleCount === 2 &&
	attribution.occupancyPolicyId === 'solid-occupancy-validity' &&
	attribution.acceptedSideCount === 2 &&
	attribution.probeValidityLength === attribution.totalProbes &&
	attribution.probeLayerMasksLength === attribution.totalProbes &&
	Number.isInteger( attribution.replacementSlotCount ) &&
	Number.isInteger( attribution.occupiedReplacementSlotCount ) &&
	Array.isArray( attribution.sideFacts ) &&
	attribution.sideFacts.length === 2 &&
	attribution.sideFacts.every( hasLocalCellPlacementHelperSideFacts ) &&
	attribution.productHasProofOnlyFacts === false &&
	(
		attribution.placementAuthoringVerdict === 'placement-authoring-product-module-emits-arrays' ||
		attribution.placementAuthoringVerdict === 'placement-authoring-has-no-local-cell-placement-work'
	) &&
	hasNoFields( attribution, 'proofBoundary', 'placementHelperPolicyId', 'rows', 'samples', 'neighbors', 'probes', 'verdict', 'supported' );

const hasSealedOffsetWallPlacementAuthoringAttributionFacts = attribution =>
	hasPlacementAuthoringAttributionFacts( attribution ) &&
	attribution.fixtureId === 'sealed-offset-wall' &&
	attribution.fixtureFamily === 'sealed-offset-wall';

const hasPlacementAuthoringParitySideHashFacts = side =>
	side !== undefined &&
	(
		side.side === 'left' ||
		side.side === 'right'
	) &&
	hasSetupSideDescriptorHash( side.targetSupportIdentityHash ) &&
	hasSetupSideDescriptorHash( side.sourceSupportIdentityHash ) &&
	Number.isInteger( side.replacementSlotCount ) &&
	Number.isInteger( side.occupiedReplacementSlotCount );

const hasPlacementAuthoringParityAttributionFacts = ( attribution, fixtureId ) =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'placement-authoring-helper-parity' &&
	attribution.proofBoundary === 'compact-authoring-adapter-helper-fact-parity' &&
	attribution.fixtureId === fixtureId &&
	attribution.helperPolicyId === 'local-cell-placement' &&
	attribution.authoringPolicyId === 'placement-authoring' &&
	attribution.placementPolicyFactsMatch === true &&
	attribution.summaryCountsMatch === true &&
	attribution.sideFactsMatch === true &&
	Array.isArray( attribution.helperSideHashes ) &&
	attribution.helperSideHashes.length === 2 &&
	attribution.helperSideHashes.every( hasPlacementAuthoringParitySideHashFacts ) &&
	Array.isArray( attribution.authoringSideHashes ) &&
	attribution.authoringSideHashes.length === 2 &&
	attribution.authoringSideHashes.every( hasPlacementAuthoringParitySideHashFacts ) &&
	attribution.placementAuthoringParityVerdict === 'placement-authoring-matches-helper-facts' &&
	hasNoFields( attribution, 'placementHelperPolicyId', 'rows', 'samples', 'neighbors', 'probes', 'verdict', 'supported' );

const hasSetupSideCoefficientProofDependencyFacts = proof =>
	proof !== undefined &&
	proof.coefficientPolicy === 'packed-atlas-l0-support-mean' &&
	typeof proof.representedContrastAvailable === 'boolean' &&
	(
		proof.crossSideChangedCoefficientIrradianceRatio === null ||
		Number.isFinite( proof.crossSideChangedCoefficientIrradianceRatio )
	) &&
	(
		proof.comparisonStatus === 'isolated-packed-atlas-readback-complete' ||
		proof.comparisonStatus === 'blocked-no-probe-identity-change'
	) &&
	(
		proof.coefficientComparisonVerdict === 'identity-change-reduces-wrong-side-l0' ||
		proof.coefficientComparisonVerdict === 'identity-change-no-wrong-side-l0-win' ||
		proof.coefficientComparisonVerdict === 'blocked-no-probe-identity-change'
	);

const hasSetupSideCoefficientMeanFacts = coefficient =>
	coefficient !== undefined &&
	Number.isInteger( coefficient.supportSize ) &&
	coefficient.supportSize > 0 &&
	coefficient.meanL0Irradiance !== undefined &&
	Number.isFinite( coefficient.meanL0Irradiance.r ) &&
	Number.isFinite( coefficient.meanL0Irradiance.g ) &&
	Number.isFinite( coefficient.meanL0Irradiance.b ) &&
	Number.isFinite( coefficient.correctSideMean ) &&
	Number.isFinite( coefficient.wrongSideMean ) &&
	Number.isFinite( coefficient.wrongToCorrectRatio );

const hasSetupSideCoefficientComparisonFacts = comparison =>
	comparison !== undefined &&
	comparison.coefficientPolicy === 'packed-atlas-l0-support-mean' &&
	comparison.readbackPolicy === 'support-probe-packed-atlas-readback' &&
	typeof comparison.representedContrastAvailable === 'boolean' &&
	(
		comparison.crossSideChangedCoefficientIrradianceRatio === null ||
		Number.isFinite( comparison.crossSideChangedCoefficientIrradianceRatio )
	) &&
	hasSetupSideCoefficientMeanFacts( comparison.defaultCoefficient ) &&
	hasSetupSideCoefficientMeanFacts( comparison.classifiedCoefficient ) &&
	Number.isFinite( comparison.wrongToCorrectRatioDelta ) &&
	(
		comparison.coefficientComparisonVerdict === 'identity-change-reduces-wrong-side-l0' ||
		comparison.coefficientComparisonVerdict === 'identity-change-no-wrong-side-l0-win' ||
		comparison.coefficientComparisonVerdict === 'blocked-no-probe-identity-change'
	);

const hasSetupSideRenderGuardFacts = renderGuard =>
	renderGuard !== undefined &&
	renderGuard.attributionPolicy === 'setup-side-classification-render-guard' &&
	renderGuard.proofBoundary === 'rendered-ratio-attribution-only' &&
	renderGuard.leftBoundaryLayerMask === 8 &&
	renderGuard.rightBoundaryLayerMask === 16 &&
	(
		renderGuard.receiverBoundaryMode === 'select' ||
		renderGuard.receiverBoundaryMode === 'blend'
	) &&
	typeof renderGuard.rawBoundaryWeight === 'boolean' &&
	Number.isFinite( renderGuard.maskedWrongSideColorRatio ) &&
	Number.isFinite( renderGuard.preToneMaskedWrongSideColorRatio ) &&
	Number.isFinite( renderGuard.preToneMaskedCorrectBounceRatio ) &&
	Number.isFinite( renderGuard.correctBounceRatio ) &&
	Array.isArray( renderGuard.candidateDescriptors ) &&
	renderGuard.candidateDescriptors.length === 2 &&
	renderGuard.candidateDescriptors.every( descriptor =>
		hasSetupSideDescriptorFacts( descriptor, 'render-guard-setup-classified' ) ) &&
	(
		renderGuard.renderGuardVerdict === 'candidate-survives-render-guard' ||
		renderGuard.renderGuardVerdict === 'candidate-fails-render-guard'
	) &&
	hasNoFields( renderGuard, 'rows', 'samples', 'finalIrradianceBoundaryToDefaultRatio' );

const hasSetupSideDebugModeRatioFacts = mode =>
	mode !== undefined &&
	Number.isFinite( mode.boundaryToDefaultRatio ) &&
	Number.isFinite( mode.leftBoundaryToDefaultRatio ) &&
	Number.isFinite( mode.rightBoundaryToDefaultRatio );

const hasSetupSideFinalIrradianceDebugFacts = debug =>
	debug !== undefined &&
	debug.attributionPolicy === 'setup-side-classification-final-irradiance-debug' &&
	debug.proofBoundary === 'debug-node-final-irradiance-attribution-only' &&
	debug.leftBoundaryLayerMask === 8 &&
	debug.rightBoundaryLayerMask === 16 &&
	(
		debug.receiverBoundaryMode === 'select' ||
		debug.receiverBoundaryMode === 'blend'
	) &&
	typeof debug.rawBoundaryWeight === 'boolean' &&
	hasSetupSideDebugModeRatioFacts( debug.scalarWeight ) &&
	hasSetupSideDebugModeRatioFacts( debug.visibilityWeight ) &&
	hasSetupSideDebugModeRatioFacts( debug.visibilityMass ) &&
	hasSetupSideDebugModeRatioFacts( debug.scalarIrradiance ) &&
	hasSetupSideDebugModeRatioFacts( debug.visibilityIrradiance ) &&
	hasSetupSideDebugModeRatioFacts( debug.finalIrradiance ) &&
	(
		debug.finalIrradianceDebugVerdict === 'candidate-has-final-irradiance-debug-delta' ||
		debug.finalIrradianceDebugVerdict === 'candidate-neutralized-by-final-irradiance-debug-node'
	) &&
	hasNoFields( debug, 'rows', 'samples', 'neighbors', 'neighborAttribution' );

const hasSetupSideDebugDescriptorSideFacts = side =>
	side !== undefined &&
	(
		side.label === 'setup-left-boundary-probe-classification' ||
		side.label === 'setup-right-boundary-probe-classification'
	) &&
	(
		side.side === 'left' ||
		side.side === 'right'
	) &&
	Number.isInteger( side.receiverMask ) &&
	side.probeMaskSource === 'setup-classified-probeLayerMasks' &&
	side.receiverLayerMask === 1 &&
	Number.isInteger( side.receiverBoundaryLayerMask ) &&
	Number.isInteger( side.identityChangeCount ) &&
	hasSetupSideDescriptorFacts( side.defaultDescriptor, 'debug-default' ) &&
	hasSetupSideDescriptorFacts( side.setupClassifiedDescriptor, 'debug-setup-classified' ) &&
	hasSetupSideDescriptorFacts( side.renderGuardDescriptor, 'render-guard-setup-classified' ) &&
	hasSetupSideDescriptorParityFacts( side.debugRenderParity ) &&
	hasSetupSideDescriptorParityFacts( side.defaultSetupParity ) &&
	Number.isFinite( side.defaultAndBoundaryCompatibilityRatio ) &&
	Number.isInteger( side.defaultAndBoundaryCompatibleCount ) &&
	side.supportSize === 8 &&
	(
		side.descriptorVerdict === 'default-and-boundary-descriptors-share-classified-support' ||
		side.descriptorVerdict === 'default-and-boundary-descriptors-split-classified-support'
	);

const hasSetupSideDebugDescriptorCompatibilityAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'setup-side-debug-descriptor-compatibility' &&
	attribution.proofBoundary === 'cpu-support-mask-attribution-only' &&
	attribution.defaultMask === 1 &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	attribution.defaultCompatibilityPolicy === 'classification-keeps-default-bit-for-default-equivalence' &&
	Array.isArray( attribution.sideFacts ) &&
	attribution.sideFacts.length === 2 &&
	attribution.sideFacts.every( hasSetupSideDebugDescriptorSideFacts ) &&
	(
		attribution.descriptorCompatibilityVerdict === 'debug-boundary-default-ratio-neutralized-by-default-compatible-masks' ||
		attribution.descriptorCompatibilityVerdict === 'debug-boundary-default-ratio-can-observe-support-split'
	) &&
	(
		attribution.debugRenderDescriptorVerdict === 'debug-render-descriptor-attribution-mismatch' ||
		attribution.debugRenderDescriptorVerdict === 'archive-setup-side-coefficient-lead-after-reconstruction-neutralization' ||
		attribution.debugRenderDescriptorVerdict === 'descriptor-parity-with-final-irradiance-delta'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors' );

const hasSetupSideIrradianceMeanFacts = means =>
	means !== undefined &&
	Number.isFinite( means.leftMean ) &&
	Number.isFinite( means.rightMean ) &&
	Number.isFinite( means.combinedMean );

const hasSetupSideIrradianceRatioFacts = ratio =>
	ratio !== undefined &&
	Number.isFinite( ratio.leftRatio ) &&
	Number.isFinite( ratio.rightRatio ) &&
	Number.isFinite( ratio.combinedRatio );

const hasSetupSideClassificationIrradianceDeltaFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'setup-side-classification-final-irradiance-delta' &&
	attribution.proofBoundary === 'debug-node-setup-mask-delta-only' &&
	attribution.debugMode === 'finalIrradiance' &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	hasSetupSideIrradianceMeanFacts( attribution.unclassifiedDefault ) &&
	hasSetupSideIrradianceMeanFacts( attribution.unclassifiedBoundary ) &&
	hasSetupSideIrradianceMeanFacts( attribution.classifiedBoundary ) &&
	hasSetupSideIrradianceRatioFacts( attribution.classifiedToUnclassifiedDefault ) &&
	hasSetupSideIrradianceRatioFacts( attribution.classifiedToUnclassifiedBoundary ) &&
	(
		attribution.setupIrradianceDeltaVerdict === 'classification-improves-final-irradiance-over-default' ||
		attribution.setupIrradianceDeltaVerdict === 'classification-recovers-boundary-final-irradiance-to-default' ||
		attribution.setupIrradianceDeltaVerdict === 'classification-does-not-change-final-irradiance-debug-signal'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'neighborAttribution' );

const hasSideShellIrradianceDeltaFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'probe-side-relocation-side-shell-final-irradiance-delta' &&
	attribution.proofBoundary === 'debug-node-side-shell-mask-delta-only' &&
	attribution.debugMode === 'finalIrradiance' &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	hasSetupSideDescriptorHash( attribution.leftSupportIdentityHash ) &&
	hasSetupSideDescriptorHash( attribution.rightSupportIdentityHash ) &&
	hasSetupSideDescriptorHash( attribution.leftSupportGridCoordHash ) &&
	hasSetupSideDescriptorHash( attribution.rightSupportGridCoordHash ) &&
	hasSetupSideIrradianceMeanFacts( attribution.unclassifiedDefault ) &&
	hasSetupSideIrradianceMeanFacts( attribution.sideShellBoundary ) &&
	hasSetupSideIrradianceRatioFacts( attribution.sideShellToUnclassifiedDefault ) &&
	(
		attribution.sideShellIrradianceDeltaVerdict === 'side-shell-improves-final-irradiance-over-default' ||
		attribution.sideShellIrradianceDeltaVerdict === 'side-shell-support-not-reached-by-final-irradiance-debug-node' ||
		attribution.sideShellIrradianceDeltaVerdict === 'side-shell-does-not-change-final-irradiance-debug-signal'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'neighborAttribution' );

const hasLocalCellPlacementIrradianceDeltaFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'probe-side-relocation-local-cell-placement-final-irradiance-delta' &&
	attribution.proofBoundary === 'debug-node-local-cell-placement-array-delta-only' &&
	attribution.debugMode === 'finalIrradiance' &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	attribution.helperPolicyId === 'local-cell-placement' &&
	Number.isInteger( attribution.replacementSlotCount ) &&
	Number.isInteger( attribution.occupiedReplacementSlotCount ) &&
	hasSetupSideIrradianceMeanFacts( attribution.unclassifiedDefault ) &&
	hasSetupSideIrradianceMeanFacts( attribution.placementBoundary ) &&
	hasSetupSideIrradianceRatioFacts( attribution.placementToUnclassifiedDefault ) &&
	(
		attribution.placementIrradianceDeltaVerdict === 'placement-helper-arrays-not-reached-by-final-irradiance-debug-node' ||
		attribution.placementIrradianceDeltaVerdict === 'placement-helper-arrays-improve-final-irradiance-over-default' ||
		attribution.placementIrradianceDeltaVerdict === 'placement-helper-arrays-do-not-change-final-irradiance-debug-signal'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'neighborAttribution' );

const hasLocalCellPlacementRenderStateFacts = state =>
	state !== undefined &&
	state.attributionPolicy === 'probe-side-relocation-local-cell-placement-render-state' &&
	state.proofBoundary === 'rendered-ratio-attribution-only' &&
	state.leftBoundaryLayerMask === 8 &&
	state.rightBoundaryLayerMask === 16 &&
	(
		state.receiverBoundaryMode === 'select' ||
		state.receiverBoundaryMode === 'blend'
	) &&
	typeof state.rawBoundaryWeight === 'boolean' &&
	Number.isFinite( state.maskedWrongSideColorRatio ) &&
	Number.isFinite( state.maskedVisiblePixelCount ) &&
	Number.isFinite( state.maskedVisiblePixelRatio ) &&
	Number.isFinite( state.maskedLeftVisiblePixelCount ) &&
	Number.isFinite( state.maskedRightVisiblePixelCount ) &&
	Number.isFinite( state.leftMaskedWrongSideColorRatio ) &&
	Number.isFinite( state.rightMaskedWrongSideColorRatio ) &&
	Number.isFinite( state.preToneMaskedWrongSideColorRatio ) &&
	Number.isFinite( state.preToneMaskedVisiblePixelCount ) &&
	Number.isFinite( state.preToneMaskedVisiblePixelRatio ) &&
	Number.isFinite( state.preToneMaskedLeftVisiblePixelCount ) &&
	Number.isFinite( state.preToneMaskedRightVisiblePixelCount ) &&
	Number.isFinite( state.preToneMaskedCorrectBounceRatio ) &&
	Number.isFinite( state.leftMaskedCorrectBounceRatio ) &&
	Number.isFinite( state.rightMaskedCorrectBounceRatio ) &&
	Number.isFinite( state.correctBounceRatio ) &&
	hasNoFields( state, 'rows', 'samples', 'neighbors', 'neighborAttribution' );

const hasLocalCellPlacementRenderRatioFacts = ratio =>
	ratio !== undefined &&
	Number.isFinite( ratio.maskedWrongSideColorRatio ) &&
	Number.isFinite( ratio.leftMaskedWrongSideColorRatio ) &&
	Number.isFinite( ratio.rightMaskedWrongSideColorRatio ) &&
	Number.isFinite( ratio.preToneMaskedWrongSideColorRatio ) &&
	Number.isFinite( ratio.correctBounceRatio );

const hasRightSidePlacementRegressionAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'right-side-placement-render-regression-attribution' &&
	attribution.proofBoundary === 'rendered-ratio-side-delta-only' &&
	(
		attribution.fixtureId === 'sealed-wall' ||
		attribution.fixtureId === 'sealed-offset-wall'
	) &&
	attribution.lowBaselineSideRegressionPolicy !== undefined &&
	attribution.lowBaselineSideRegressionPolicy.policyId === 'low-baseline-side-regression-policy' &&
	attribution.lowBaselineSideRegressionPolicy.side === 'right' &&
	attribution.lowBaselineSideRegressionPolicy.maxBaselineWrongSideColorRatio === 0.25 &&
	attribution.lowBaselineSideRegressionPolicy.requireStableMaskedPixelCount === true &&
	attribution.lowBaselineSideRegressionPolicy.requireStablePreToneMaskedPixelCount === true &&
	attribution.lowBaselineSideRegressionPolicy.requireCombinedWrongSideImprovement === true &&
	attribution.lowBaselineSideRegressionPolicy.requirePreToneWrongSideImprovement === true &&
	attribution.lowBaselineSideRegressionPolicy.minCorrectBounceRatio === 0.999 &&
	Number.isFinite( attribution.baselineRightMaskedWrongSideColorRatio ) &&
	Number.isFinite( attribution.placementRightMaskedWrongSideColorRatio ) &&
	Number.isFinite( attribution.rightMaskedWrongSideColorRatio ) &&
	Number.isFinite( attribution.baselineRightMaskedVisiblePixelCount ) &&
	Number.isFinite( attribution.placementRightMaskedVisiblePixelCount ) &&
	typeof attribution.stableRightMaskedVisiblePixelCount === 'boolean' &&
	Number.isFinite( attribution.baselinePreToneRightMaskedVisiblePixelCount ) &&
	Number.isFinite( attribution.placementPreToneRightMaskedVisiblePixelCount ) &&
	typeof attribution.stablePreToneRightMaskedVisiblePixelCount === 'boolean' &&
	Number.isFinite( attribution.leftMaskedWrongSideColorRatio ) &&
	Number.isFinite( attribution.combinedMaskedWrongSideColorRatio ) &&
	Number.isFinite( attribution.preToneMaskedWrongSideColorRatio ) &&
	Number.isFinite( attribution.correctBounceRatio ) &&
	(
		attribution.rightSideRegressionVerdict === 'right-side-placement-render-improves' ||
		attribution.rightSideRegressionVerdict === 'right-side-small-baseline-regression-with-combined-placement-win' ||
		attribution.rightSideRegressionVerdict === 'right-side-placement-render-regresses'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'neighborAttribution' );

const hasLocalCellPlacementRenderLeakDeltaFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'probe-side-relocation-local-cell-placement-render-leak-delta' &&
	attribution.proofBoundary === 'rendered-ratio-local-cell-placement-array-delta-only' &&
	attribution.leftBoundaryLayerMask === 8 &&
	attribution.rightBoundaryLayerMask === 16 &&
	attribution.helperPolicyId === 'local-cell-placement' &&
	Number.isInteger( attribution.replacementSlotCount ) &&
	Number.isInteger( attribution.occupiedReplacementSlotCount ) &&
	hasLocalCellPlacementRenderStateFacts( attribution.unclassifiedBoundaryRender ) &&
	hasLocalCellPlacementRenderStateFacts( attribution.placementBoundaryRender ) &&
	hasLocalCellPlacementRenderRatioFacts( attribution.placementToUnclassifiedBoundaryRender ) &&
	hasRightSidePlacementRegressionAttributionFacts( attribution.rightSideRegressionAttribution ) &&
	(
		attribution.placementRenderLeakVerdict === 'placement-helper-arrays-improve-bilateral-render-leak-over-default' ||
		attribution.placementRenderLeakVerdict === 'placement-helper-arrays-improve-combined-render-leak-over-default' ||
		attribution.placementRenderLeakVerdict === 'placement-helper-arrays-do-not-improve-render-leak-over-default'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'neighbors', 'neighborAttribution' );

const hasSealedOffsetWallPlacementRenderLeakDeltaFacts = attribution =>
	hasLocalCellPlacementRenderLeakDeltaFacts( attribution ) &&
	attribution.fixtureId === 'sealed-offset-wall' &&
	attribution.fixtureFamily === 'sealed-offset-wall' &&
	attribution.unclassifiedBoundaryRender.fixtureId === 'sealed-offset-wall' &&
	attribution.placementBoundaryRender.fixtureId === 'sealed-offset-wall';

const hasSetupSideProbeClassificationCandidateFacts = candidate =>
	candidate !== undefined &&
	(
		candidate.label === 'setup-left-boundary-probe-classification' ||
		candidate.label === 'setup-right-boundary-probe-classification'
	) &&
	(
		candidate.side === 'left' ||
		candidate.side === 'right'
	) &&
	candidate.receiverPointPolicy === 'world-bounds-near-divider-edge' &&
	Number.isInteger( candidate.receiverMask ) &&
	hasSetupSideSupportFacts( candidate.defaultSupport ) &&
	hasSetupSideSupportFacts( candidate.classifiedSupport ) &&
	hasSetupSideDescriptorCompatibilityFacts( candidate.descriptorCompatibility ) &&
	hasSetupSideDescriptorFactSet( candidate.descriptorFacts ) &&
	hasSetupSideIdentityFacts( candidate.identity ) &&
	hasSetupSideCoefficientProofDependencyFacts( candidate.coefficientProof ) &&
	hasSetupSideCoefficientComparisonFacts( candidate.coefficientComparison ) &&
	(
		candidate.classificationVerdict === 'candidate-changes-probe-identity' ||
		candidate.classificationVerdict === 'rejected-no-probe-identity-change'
	);

const hasSetupSideProbeClassificationAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.setupSideProbeClassificationAttribution;
	const assignment = attribution?.assignmentFacts;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'setup-side-probe-identity-classification-candidate' &&
		attribution.proofBoundary === 'bake-setup-attribution-only' &&
		attribution.source === 'probe-position-ownership-and-isolated-l0-coefficient-attribution' &&
		attribution.defaultEquivalencePolicy === 'no-classification-keeps-original-probe-indices' &&
		assignment !== undefined &&
		assignment.policyId === 'layer-region-probe-ownership' &&
		assignment.probeOwnershipMaskMode === 'probeMeta.b authored bitfield' &&
		attribution.totalProbes === 64 &&
		Number.isInteger( attribution.validProbeCount ) &&
		Number.isInteger( attribution.invalidProbeCount ) &&
		attribution.validProbeCount + attribution.invalidProbeCount === attribution.totalProbes &&
		Number.isInteger( attribution.interiorProbeCount ) &&
		Number.isInteger( attribution.exteriorProbeCount ) &&
		Number.isInteger( attribution.relocatedProbeCount ) &&
		attribution.relocatedProbeCount === 0 &&
		attribution.receiverSideSupportArchived === true &&
		attribution.defaultEquivalence !== undefined &&
		attribution.defaultEquivalence.identityPolicy === 'default-support-compared-to-itself' &&
		attribution.defaultEquivalence.leftIdentityChangeCount === 0 &&
		attribution.defaultEquivalence.rightIdentityChangeCount === 0 &&
		attribution.nextLane !== undefined &&
		attribution.nextLane.requiredNextLane === 'bake-time-relocation-or-probe-side-classification' &&
		(
		attribution.nextLane.setupClassificationVerdict === 'continue-setup-side-probe-classification' ||
		attribution.nextLane.setupClassificationVerdict === 'classification-needs-relocation-or-denser-probes'
	) &&
		hasSetupSideRenderGuardFacts( attribution.renderGuard ) &&
		hasSetupSideFinalIrradianceDebugFacts( attribution.finalIrradianceDebug ) &&
		hasSetupSideDebugDescriptorCompatibilityAttributionFacts( attribution.debugDescriptorCompatibility ) &&
		hasSetupSideSymmetryAttributionFacts( attribution.sideSymmetryAttribution ) &&
		hasProbeSideClassificationAttributionFacts( attribution.probeSideClassificationAttribution ) &&
		hasProbeSideRelocationOracleAttributionFacts( attribution.probeSideRelocationOracleAttribution ) &&
		hasProbeSideRelocationDistanceProxyAttributionFacts( attribution.probeSideRelocationProxyAttribution ) &&
		hasProbeSideRelocationDividerProxyAttributionFacts( attribution.probeSideRelocationDividerProxyAttribution ) &&
		hasProbeSideRelocationVisibilityProxyAttributionFacts( attribution.probeSideRelocationVisibilityProxyAttribution ) &&
		hasProbeSideRelocationSideShellProxyAttributionFacts( attribution.probeSideRelocationSideShellProxyAttribution ) &&
		hasSideShellLocalCellReachabilityAttributionFacts( attribution.sideShellLocalCellReachability ) &&
		hasLocalCellRelocationCandidateAttributionFacts( attribution.localCellRelocationCandidateAttribution ) &&
		hasPhysicalPlacementRequirementAttributionFacts( attribution.physicalPlacementRequirementAttribution ) &&
		hasLocalCellPlacementHelperAttributionFacts( attribution.localCellPlacementHelperAttribution ) &&
		hasPlacementAuthoringAttributionFacts( attribution.placementAuthoringAttribution ) &&
		hasPlacementAuthoringParityAttributionFacts( attribution.placementAuthoringParityAttribution, 'sealed-wall' ) &&
		hasSealedOffsetWallPlacementHelperAttributionFacts( attribution.sealedOffsetWallPlacementHelperAttribution ) &&
		hasSealedOffsetWallPlacementAuthoringAttributionFacts( attribution.sealedOffsetWallPlacementAuthoringAttribution ) &&
		hasPlacementAuthoringParityAttributionFacts(
			attribution.sealedOffsetWallPlacementAuthoringParityAttribution,
			'sealed-offset-wall'
		) &&
		hasSetupSideClassificationIrradianceDeltaFacts( attribution.setupClassificationIrradianceDelta ) &&
		hasSideShellIrradianceDeltaFacts( attribution.sideShellIrradianceDelta ) &&
		hasLocalCellPlacementIrradianceDeltaFacts( attribution.localCellPlacementIrradianceDelta ) &&
		hasLocalCellPlacementRenderLeakDeltaFacts( attribution.localCellPlacementRenderLeakDelta ) &&
		hasSealedOffsetWallPlacementRenderLeakDeltaFacts( attribution.sealedOffsetWallPlacementRenderLeakDelta ) &&
		Array.isArray( attribution.candidates ) &&
		attribution.candidates.length === 2 &&
		attribution.candidates.every( hasSetupSideProbeClassificationCandidateFacts ) &&
		attribution.candidates.some( candidate =>
			candidate.classificationVerdict === 'candidate-changes-probe-identity' &&
			candidate.coefficientProof.comparisonStatus === 'isolated-packed-atlas-readback-complete' &&
			candidate.coefficientComparison.coefficientComparisonVerdict === 'identity-change-reduces-wrong-side-l0' ) &&
		hasNoFields( attribution, 'probes', 'rows', 'samples', 'relocatedProbes', 'verdict', 'supported' );

};

const hasBoundaryMaskAlignmentAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.boundaryMaskAlignmentAttribution;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'swapped-boundary-mask-alignment-candidate' &&
		attribution.proofBoundary === 'receiver-mask-attribution-only' &&
		attribution.leftBoundaryLayerMask === 4 &&
		attribution.rightBoundaryLayerMask === 2 &&
		Number.isInteger( attribution.leftCompatibilityChangedSlotCount ) &&
		Number.isInteger( attribution.leftCompatibilityChangedContributingSlotCount ) &&
		Number.isInteger( attribution.rightCompatibilityChangedSlotCount ) &&
		Number.isInteger( attribution.rightCompatibilityChangedContributingSlotCount ) &&
		Number.isFinite( attribution.scalarLeftBoundaryToDefaultRatio ) &&
		Number.isFinite( attribution.scalarRightBoundaryToDefaultRatio ) &&
		Number.isFinite( attribution.visibilityLeftBoundaryToDefaultRatio ) &&
		Number.isFinite( attribution.visibilityRightBoundaryToDefaultRatio ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples' );

};

const hasBoundaryMaskAlignmentRenderFacts = leakProofFacts => {

	const attribution = leakProofFacts.boundaryMaskAlignmentRenderAttribution;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'swapped-boundary-mask-render-candidate' &&
		attribution.proofBoundary === 'rendered-ratio-attribution-only' &&
		attribution.leftBoundaryLayerMask === 4 &&
		attribution.rightBoundaryLayerMask === 2 &&
		Number.isFinite( attribution.maskedWrongSideColorRatio ) &&
		Number.isFinite( attribution.preToneMaskedWrongSideColorRatio ) &&
		Number.isFinite( attribution.preToneMaskedCorrectBounceRatio ) &&
		Number.isFinite( attribution.correctBounceRatio ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples' );

};

const hasLocalizedBoundaryMaskCandidateFacts = candidate =>
	candidate !== undefined &&
	typeof candidate.label === 'string' &&
	Number.isInteger( candidate.leftBoundaryLayerMask ) &&
	Number.isInteger( candidate.rightBoundaryLayerMask ) &&
	Number.isInteger( candidate.leftCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.leftCompatibilityChangedContributingSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedContributingSlotCount ) &&
	Number.isFinite( candidate.scalarLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.renderMaskedWrongSideColorRatio ) &&
	Number.isFinite( candidate.renderPreToneMaskedWrongSideColorRatio ) &&
	Number.isFinite( candidate.renderPreToneMaskedCorrectBounceRatio ) &&
	Number.isFinite( candidate.renderCorrectBounceRatio );

const hasLocalizedBoundaryMaskAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.localizedBoundaryMaskAttribution;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'localized-boundary-mask-candidates' &&
		attribution.proofBoundary === 'receiver-mask-attribution-only' &&
		Array.isArray( attribution.candidates ) &&
		attribution.candidates.length === 2 &&
		attribution.candidates.every( hasLocalizedBoundaryMaskCandidateFacts ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples' );

};

const hasLocalizedBoundaryClassCandidateFacts = candidate =>
	candidate !== undefined &&
	typeof candidate.label === 'string' &&
	( candidate.classVariant === 'left-only' || candidate.classVariant === 'right-only' ) &&
	Number.isInteger( candidate.leftCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.leftCompatibilityChangedContributingSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedContributingSlotCount ) &&
	Number.isFinite( candidate.scalarLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.renderMaskedWrongSideColorRatio ) &&
	Number.isFinite( candidate.renderPreToneMaskedWrongSideColorRatio ) &&
	Number.isFinite( candidate.renderPreToneMaskedCorrectBounceRatio ) &&
	Number.isFinite( candidate.renderCorrectBounceRatio );

const hasLocalizedBoundaryClassAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.boundaryClassPrecisionAttribution;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'localized-boundary-class-candidates' &&
		attribution.proofBoundary === 'receiver-class-attribution-only' &&
		Array.isArray( attribution.candidates ) &&
		attribution.candidates.length === 2 &&
		attribution.candidates.every( hasLocalizedBoundaryClassCandidateFacts ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples' );

};

const hasBoundaryClassStrengthCandidateFacts = candidate =>
	candidate !== undefined &&
	typeof candidate.label === 'string' &&
	Number.isFinite( candidate.activeValue ) &&
	Number.isInteger( candidate.leftCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.leftCompatibilityChangedContributingSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedContributingSlotCount ) &&
	Number.isFinite( candidate.scalarLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.renderMaskedWrongSideColorRatio ) &&
	Number.isFinite( candidate.renderPreToneMaskedWrongSideColorRatio ) &&
	Number.isFinite( candidate.renderPreToneMaskedCorrectBounceRatio ) &&
	Number.isFinite( candidate.renderCorrectBounceRatio );

const hasBoundaryClassStrengthAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.boundaryClassStrengthAttribution;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'partial-boundary-class-strength-candidates' &&
		attribution.proofBoundary === 'receiver-class-attribution-only' &&
		Array.isArray( attribution.candidates ) &&
		attribution.candidates.length === 2 &&
		attribution.candidates.every( hasBoundaryClassStrengthCandidateFacts ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples' );

};

const hasCoefficientContrastRatio = ( ratio, stableSlotCount ) =>
	stableSlotCount === 0 ? ratio === null : Number.isFinite( ratio );

const hasBoundaryBlendCandidateFacts = candidate =>
	candidate !== undefined &&
	typeof candidate.label === 'string' &&
	Number.isFinite( candidate.activeValue ) &&
	Number.isInteger( candidate.leftCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.leftCompatibilityChangedContributingSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedSlotCount ) &&
	Number.isInteger( candidate.rightCompatibilityChangedContributingSlotCount ) &&
	Number.isFinite( candidate.scalarLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarCombinedBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityCombinedBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarIrradianceBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityIrradianceBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.finalIrradianceBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarIrradianceLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.scalarIrradianceRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityIrradianceLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.visibilityIrradianceRightBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.finalIrradianceLeftBoundaryToDefaultRatio ) &&
	Number.isFinite( candidate.finalIrradianceRightBoundaryToDefaultRatio ) &&
	candidate.coefficientSidePolicy === 'neighbor-sh-coefficient-contrast' &&
	Number.isInteger( candidate.leftChangedCoefficientSlotCount ) &&
	Number.isInteger( candidate.leftStableCoefficientSlotCount ) &&
	Number.isFinite( candidate.leftChangedCoefficientIrradianceMean ) &&
	Number.isFinite( candidate.leftStableCoefficientIrradianceMean ) &&
	hasCoefficientContrastRatio(
		candidate.leftChangedCoefficientIrradianceToStableRatio,
		candidate.leftStableCoefficientSlotCount
	) &&
	Number.isInteger( candidate.rightChangedCoefficientSlotCount ) &&
	Number.isInteger( candidate.rightStableCoefficientSlotCount ) &&
	Number.isFinite( candidate.rightChangedCoefficientIrradianceMean ) &&
	Number.isFinite( candidate.rightStableCoefficientIrradianceMean ) &&
	hasCoefficientContrastRatio(
		candidate.rightChangedCoefficientIrradianceToStableRatio,
		candidate.rightStableCoefficientSlotCount
	) &&
	Number.isFinite( candidate.renderMaskedWrongSideColorRatio ) &&
	Number.isFinite( candidate.renderPreToneMaskedWrongSideColorRatio ) &&
	Number.isFinite( candidate.renderPreToneMaskedCorrectBounceRatio ) &&
	Number.isFinite( candidate.renderCorrectBounceRatio );

const hasBoundaryBlendAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.boundaryBlendAttribution;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'partial-boundary-compatibility-blend-candidates' &&
		attribution.proofBoundary === 'receiver-compatibility-blend-attribution-only' &&
		Array.isArray( attribution.candidates ) &&
		attribution.candidates.length === 2 &&
		attribution.candidates.every( hasBoundaryBlendCandidateFacts ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples' );

};

const hasCoefficientContrastSideFacts = side =>
	side !== undefined &&
	Number.isInteger( side.changedContributingSlotCount ) &&
	Number.isInteger( side.stableContributingSlotCount ) &&
	Number.isFinite( side.changedCoefficientIrradianceMean ) &&
	Number.isFinite( side.stableCoefficientIrradianceMean ) &&
	hasCoefficientContrastRatio(
		side.changedToStableCoefficientIrradianceRatio,
		side.stableContributingSlotCount
	) &&
	(
		side.coefficientMaskingVerdict === 'candidate-has-stable-coefficient-comparator' ||
		side.coefficientMaskingVerdict === 'rejected-no-stable-coefficient-comparator'
	);

const hasMultiClassOwnershipFeasibilityFacts = feasibility =>
	feasibility !== undefined &&
	feasibility.contrastPolicy === 'cross-side-changed-coefficient-irradiance' &&
	Number.isFinite( feasibility.leftChangedCoefficientIrradianceMean ) &&
	Number.isFinite( feasibility.rightChangedCoefficientIrradianceMean ) &&
	Number.isFinite( feasibility.crossSideChangedCoefficientIrradianceRatio ) &&
	Number.isFinite( feasibility.crossSideChangedCoefficientIrradianceDelta ) &&
	(
		feasibility.candidateVerdict === 'candidate-has-cross-side-coefficient-contrast' ||
		feasibility.candidateVerdict === 'rejected-no-cross-side-coefficient-contrast'
	);

const hasCoefficientContrastAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.coefficientContrastAttribution;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'coefficient-side-contrast-availability-candidate' &&
		attribution.proofBoundary === 'neighbor-sh-coefficient-attribution-only' &&
		attribution.candidateShape === 'stable-contributing-coefficient-mask' &&
		attribution.nextCandidateShape === 'multi-class-ownership-or-relocation' &&
		attribution.leftBoundaryLayerMask === 4 &&
		attribution.rightBoundaryLayerMask === 2 &&
		attribution.receiverBoundaryMode === 'blend' &&
		attribution.rawBoundaryWeight === true &&
		hasCoefficientContrastSideFacts( attribution.left ) &&
		hasCoefficientContrastSideFacts( attribution.right ) &&
		hasMultiClassOwnershipFeasibilityFacts( attribution.multiClassOwnershipFeasibility ) &&
		hasNoFields( attribution, 'verdict', 'supported', 'rows', 'samples', 'neighbors' );

};

const hasLeakProofRowFacts = row =>
	Number.isFinite( row.wrongSideColorRatio ) &&
	Number.isFinite( row.maskedWrongSideColorRatio ) &&
	Number.isFinite( row.maskedVisiblePixelCount ) &&
	Number.isFinite( row.maskedVisiblePixelRatio ) &&
	Number.isFinite( row.maskedLeftVisiblePixelCount ) &&
	Number.isFinite( row.maskedRightVisiblePixelCount ) &&
	Number.isFinite( row.maskedLeftCorrectBounceRatio ) &&
	Number.isFinite( row.maskedRightCorrectBounceRatio ) &&
	Number.isFinite( row.correctBounceRatio ) &&
	Number.isFinite( row.preToneMaskedWrongSideColorRatio ) &&
	Number.isFinite( row.preToneMaskedVisiblePixelCount ) &&
	Number.isFinite( row.preToneMaskedVisiblePixelRatio ) &&
	Number.isFinite( row.preToneMaskedLeftVisiblePixelCount ) &&
	Number.isFinite( row.preToneMaskedRightVisiblePixelCount ) &&
	Number.isFinite( row.preToneMaskedLeftCorrectBounceRatio ) &&
	Number.isFinite( row.preToneMaskedRightCorrectBounceRatio ) &&
	Number.isFinite( row.preToneMaskedCorrectBounceRatio ) &&
	row.maskedLeftVisiblePixelCount > 0 &&
	row.maskedRightVisiblePixelCount > 0 &&
	row.preToneMaskedLeftVisiblePixelCount > 0 &&
	row.preToneMaskedRightVisiblePixelCount > 0 &&
	row.correctBounceRatio > 0.75 &&
	hasNoFields( row,
		'centerWrongSideColorRatio',
		'centerCorrectBounceRatio',
		'surfaceCorrectBounceRatio',
		'receiverRegionMetricMode',
		'maskedReceiverRegionMetricMode',
		'leakMetrics',
		'preToneLeakMetrics'
	);

const hasSealedOffsetWallRowFacts = row =>
	hasLeakProofRowFacts( row ) &&
	row.fixtureId === 'sealed-offset-wall' &&
	(
		row.label === 'sealed-offset-wall-validity-weighted' ||
		row.label === 'sealed-offset-wall-visibility-moments'
	) &&
	(
		row.guardedVisibilityProofMode === 'off' ||
		row.guardedVisibilityProofMode === 'guarded'
	);

const hasSealedOffsetWallRowsFacts = rows => {

	if ( Array.isArray( rows ) === false || rows.length !== 2 ) return false;

	const rowMap = new Map( rows.map( row => [ row.label, row ] ) );
	const scalarValidity = rowMap.get( 'sealed-offset-wall-validity-weighted' );
	const visibilityMoments = rowMap.get( 'sealed-offset-wall-visibility-moments' );

	return scalarValidity !== undefined &&
		visibilityMoments !== undefined &&
		scalarValidity.guardedVisibilityProofMode === 'off' &&
		visibilityMoments.guardedVisibilityProofMode === 'guarded' &&
		rows.every( hasSealedOffsetWallRowFacts );

};

const hasSealedOffsetWallResidualAttributionFacts = attribution =>
	attribution !== undefined &&
	attribution.attributionPolicy === 'sealed-offset-wall-rendered-region-source-ratios' &&
	attribution.proofBoundary === 'second-fixture-rendered-ratio-attribution-only' &&
	attribution.baselineLabel === 'sealed-offset-wall-validity-weighted' &&
	attribution.candidateLabel === 'sealed-offset-wall-visibility-moments' &&
	Number.isFinite( attribution.maskedVisibleResidualRatio ) &&
	Number.isFinite( attribution.preToneMaskedResidualRatio ) &&
	Number.isFinite( attribution.correctBounceRatio ) &&
	Number.isFinite( attribution.preToneCorrectBounceRatio ) &&
	(
		attribution.offsetResidualVerdict === 'sealed-offset-wall-visibility-lowers-masked-wrong-side-ratio' ||
		attribution.offsetResidualVerdict === 'sealed-offset-wall-visibility-does-not-lower-masked-wrong-side-ratio'
	) &&
	hasNoFields( attribution, 'rows', 'samples', 'verdict', 'supported' );

const hasSamplingMassMetricFacts = metric =>
	metric !== undefined &&
	Number.isFinite( metric.defaultMean ) &&
	Number.isFinite( metric.boundaryMean ) &&
	Number.isFinite( metric.boundaryToDefaultRatio ) &&
	Number.isFinite( metric.leftDefaultMean ) &&
	Number.isFinite( metric.leftBoundaryMean ) &&
	Number.isFinite( metric.leftBoundaryToDefaultRatio ) &&
	Number.isFinite( metric.rightDefaultMean ) &&
	Number.isFinite( metric.rightBoundaryMean ) &&
	Number.isFinite( metric.rightBoundaryToDefaultRatio );

const hasNeighborDeltaMetricFacts = metric =>
	metric !== undefined &&
	Number.isFinite( metric.leftDefault ) &&
	Number.isFinite( metric.leftBoundary ) &&
	Number.isFinite( metric.leftDelta ) &&
	Number.isFinite( metric.rightDefault ) &&
	Number.isFinite( metric.rightBoundary ) &&
	Number.isFinite( metric.rightDelta );

const hasSamplingNeighborFacts = neighbor =>
	neighbor !== undefined &&
	Number.isInteger( neighbor.slot ) &&
	neighbor.slot >= 0 &&
	neighbor.slot < 8 &&
	Number.isInteger( neighbor.leftDefaultProbeIndex ) &&
	Number.isInteger( neighbor.leftBoundaryProbeIndex ) &&
	Number.isInteger( neighbor.rightDefaultProbeIndex ) &&
	Number.isInteger( neighbor.rightBoundaryProbeIndex ) &&
	hasNeighborDeltaMetricFacts( neighbor.layerCompatibility ) &&
	hasNeighborDeltaMetricFacts( neighbor.baseWeight ) &&
	hasNeighborDeltaMetricFacts( neighbor.visibilityWeight ) &&
	hasNeighborDeltaMetricFacts( neighbor.visibility );

const hasSamplingNeighborAttributionFacts = mass => {

	const neighborAttribution = mass.neighborAttribution;

	return neighborAttribution !== undefined &&
		neighborAttribution.attributionPolicy === 'debug-node-neighbor-default-boundary-delta' &&
		neighborAttribution.sampleRegion === 'receiver-near-divider-edge-screen-region' &&
		Number.isInteger( neighborAttribution.leftCompatibilityChangedSlotCount ) &&
		Number.isInteger( neighborAttribution.leftCompatibilityChangedContributingSlotCount ) &&
		Number.isInteger( neighborAttribution.rightCompatibilityChangedSlotCount ) &&
		Number.isInteger( neighborAttribution.rightCompatibilityChangedContributingSlotCount ) &&
		Array.isArray( neighborAttribution.neighbors ) &&
		neighborAttribution.neighbors.length === 8 &&
		neighborAttribution.neighbors.every( hasSamplingNeighborFacts ) &&
		hasNoFields( neighborAttribution, 'verdict', 'supported', 'samples' );

};

const hasSamplingMassAttributionFacts = attribution => {

	const mass = attribution.samplingMassAttribution;

	return mass !== undefined &&
		mass.attributionPolicy === 'debug-node-surface-mass-ratio' &&
		mass.sampleRegion === 'receiver-near-divider-edge-screen-region' &&
		hasSamplingMassMetricFacts( mass.scalarWeight ) &&
		hasSamplingMassMetricFacts( mass.visibilityWeight ) &&
		hasSamplingMassMetricFacts( mass.visibilityMass ) &&
		hasSamplingNeighborAttributionFacts( mass ) &&
		hasNoFields( mass, 'verdict', 'supported', 'rows', 'samples' );

};

const hasResidualAttributionFacts = leakProofFacts => {

	const attribution = leakProofFacts.residualAttribution;

	return attribution !== undefined &&
		attribution.attributionPolicy === 'rendered-region-source-ratios' &&
		attribution.baselineLabel === 'sealed-wall-validity-weighted' &&
		attribution.candidateLabel === 'sealed-wall-visibility-moments' &&
		Number.isFinite( attribution.screenRegionResidualRatio ) &&
		Number.isFinite( attribution.surfaceResidualRatio ) &&
		Number.isFinite( attribution.surfaceCenterResidualRatio ) &&
		Number.isFinite( attribution.maskedVisibleResidualRatio ) &&
		Number.isFinite( attribution.preToneMaskedResidualRatio ) &&
		Number.isFinite( attribution.candidateRenderIrradianceCenterWrongRatio ) &&
		Number.isFinite( attribution.candidateRenderLinearIrradianceCenterWrongRatio ) &&
		Number.isFinite( attribution.candidateLinearIrradianceToMaskedVisibleRatio ) &&
		Number.isFinite( attribution.candidateRenderIrradianceMaskedWrongRatio ) &&
		Number.isFinite( attribution.candidateRenderLinearIrradianceMaskedWrongRatio ) &&
		Number.isFinite( attribution.candidateMaskedIrradianceToMaskedVisibleRatio ) &&
		attribution.candidateReceiverMaterialType === 'standard' &&
		Number.isFinite( attribution.candidateReceiverAlbedoWrongSideRatio ) &&
		Number.isFinite( attribution.candidateReceiverRoughness ) &&
		Number.isFinite( attribution.candidateReceiverMetalness ) &&
		Number.isFinite( attribution.candidatePreToneMaskedToAlbedoRatio ) &&
		Number.isFinite( attribution.candidateRenderLambertMaskedWrongRatio ) &&
		Number.isFinite( attribution.candidateRenderLinearLambertMaskedWrongRatio ) &&
		Number.isFinite( attribution.candidateLinearLambertToLinearIrradianceRatio ) &&
		Number.isFinite( attribution.candidatePreToneMaskedToLinearLambertRatio ) &&
		Number.isFinite( attribution.candidateNearDividerEdgeWrongSideColorRatio ) &&
		Number.isFinite( attribution.candidateNearDividerEdgeToSurfaceCenterRatio ) &&
		Number.isFinite( attribution.candidateNearDividerEdgeToMaskedVisibleRatio ) &&
		Number.isInteger( attribution.candidateMaskedVisiblePixelCount ) &&
		Number.isFinite( attribution.candidateMaskedVisiblePixelRatio ) &&
		Number.isFinite( attribution.candidateMaskedVisibleToSurfaceCenterRatio ) &&
		Number.isFinite( attribution.candidatePreToneMaskedToMaskedVisibleRatio ) &&
		Number.isFinite( attribution.minCameraDotCpuNormal ) &&
		Number.isFinite( attribution.receiverSurfaceRegionAreaRatio ) &&
		hasSamplingMassAttributionFacts( attribution ) &&
		hasNoFields( attribution, 'rows', 'samples', 'verdict', 'supported' );

};

const hasLeakProofRestorationFacts = leakProofFacts =>
	leakProofFacts.restored.lightingMode === 'direct + probes' &&
	leakProofFacts.restored.leakReductionMode === 'off' &&
	leakProofFacts.restored.leakFixtureVisible === false &&
	hasNoFields( leakProofFacts.restored, 'sampling', 'timings', 'visibilityDepth' );

export async function runLightProbeGridGpuMatrixSmokeAssertions( context ) {

	const { call, assert, results } = context;
	const traceE2E = process.env.THREEJS_E2E_TRACE === '1';
	const trace = message => {

		if ( traceE2E ) console.log( `[E2E trace] ${ message }` );

	};

	trace( 'matrix: inspect probe occupancy' );
	const probeOccupancy = await call( 'inspectProbeOccupancy' );
	assert( hasProbeOccupancyFacts( probeOccupancy ),
		'probe occupancy: expected compact occupied probe mesh-hit facts without per-probe metadata.' );
	results.push( { step: 'probe occupancy', probeOccupancy } );

	trace( 'matrix: capture leak proof facts' );
	const leakProofFacts = await call( 'captureLeakProofFacts' );
	trace( 'matrix: leak proof facts captured' );
	trace( `matrix: support set ${ JSON.stringify( {
		candidateCount: leakProofFacts.supportSetAttribution?.candidates?.length,
		firstCandidateKeys: Object.keys( leakProofFacts.supportSetAttribution?.candidates?.[ 0 ] ?? {} ),
		firstLossClassification: leakProofFacts.supportSetAttribution?.candidates?.[ 0 ]?.lossClassification,
		relocationRequirement: leakProofFacts.supportSetAttribution?.relocationRequirement
	} ) }` );
	assert( hasLeakProofFixtureFacts( leakProofFacts ),
		'leak proof facts: expected compact sealed-wall fixture, sampling, and proof-setting facts.' );
	assert( hasSealedOffsetWallFixtureAttributionFacts( leakProofFacts.sealedOffsetWallFixtureAttribution ),
		'leak proof facts: expected compact sealed-offset-wall fixture activation facts before promotion.' );
	assert( hasSealedOffsetWallRowsFacts( leakProofFacts.sealedOffsetWallRows ),
		'leak proof facts: expected finite sealed-offset-wall leak rows before promotion.' );
	assert( hasSealedOffsetWallResidualAttributionFacts( leakProofFacts.sealedOffsetWallResidualAttribution ),
		'leak proof facts: expected compact sealed-offset-wall residual attribution before promotion.' );

	const leakRows = new Map( leakProofFacts.rows.map( row => [ row.label, row ] ) );
	const scalarValidity = leakRows.get( 'sealed-wall-validity-weighted' );
	const visibilityMoments = leakRows.get( 'sealed-wall-visibility-moments' );

	assert( scalarValidity !== undefined && visibilityMoments !== undefined,
		'leak proof facts: expected sealed-wall validity and visibility rows.' );
	assert( scalarValidity.guardedVisibilityProofMode === 'off' &&
		visibilityMoments.guardedVisibilityProofMode === 'guarded',
	'leak proof facts: expected moment visibility to be isolated against scalar validity control.' );
	assert( hasNoFields( visibilityMoments, 'visibilityDepth' ),
		'leak proof facts: expected custom validity control without duplicating moment-readback facts owned by visibility diagnostics.' );

	for ( const row of leakProofFacts.rows ) {

		assert( hasLeakProofRowFacts( row ),
			`leak proof facts ${ row.label }: expected finite leak and bounce metrics.` );

	}

	assert( hasResidualAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact residual attribution ratios without verdict payloads.' );
	assert( hasReceiverBoundarySourceFacts( leakProofFacts ),
		'leak proof facts: expected compact authored receiver-boundary source facts.' );
	assert( hasProbeMaskAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact probe-mask attribution facts.' );
	assert( hasSampleAlignmentAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact sample-alignment attribution facts.' );
	assert( hasOwnershipShapeAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact ownership-shape attribution facts.' );
	assert( hasMultiClassOwnershipAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact multi-class ownership attribution facts.' );
	assert( hasSupportSetAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact support-set attribution facts.' );
	assert( hasSetupSideProbeClassificationAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact setup-side probe classification attribution facts.' );
	assert( hasBoundaryMaskAlignmentAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact boundary-mask alignment attribution facts.' );
	assert( hasBoundaryMaskAlignmentRenderFacts( leakProofFacts ),
		'leak proof facts: expected compact boundary-mask alignment render facts.' );
	assert( hasLocalizedBoundaryMaskAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact localized boundary-mask attribution facts.' );
	assert( hasLocalizedBoundaryClassAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact localized boundary-class attribution facts.' );
	assert( hasBoundaryClassStrengthAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact boundary-class strength attribution facts.' );
	assert( hasCoefficientContrastAttributionFacts( leakProofFacts ),
		'leak proof facts: expected compact coefficient-contrast attribution facts.' );

	assert( hasLeakProofRestorationFacts( leakProofFacts ),
		'leak proof facts: expected demo state and hidden fixture restoration.' );
	results.push( { step: 'leak proof facts', leakProofFacts } );


}
