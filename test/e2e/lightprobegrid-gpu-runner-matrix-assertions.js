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
		hasSetupSideClassificationIrradianceDeltaFacts( attribution.setupClassificationIrradianceDelta ) &&
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
	Number.isFinite( row.correctBounceRatio ) &&
	Number.isFinite( row.preToneMaskedWrongSideColorRatio ) &&
	Number.isFinite( row.preToneMaskedCorrectBounceRatio ) &&
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
