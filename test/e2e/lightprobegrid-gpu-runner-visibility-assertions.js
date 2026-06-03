const hasNoFields = ( object, ...fields ) => fields.every( field => object[ field ] === undefined );

export async function runLightProbeGridGpuVisibilitySmokeAssertions( context ) {

	const { call, assert, results } = context;
	const sealedVisibilityWeightingDiagnostic = await runLightProbeGridGpuVisibilityBaseAssertions( {
		call,
		assert,
		results
	} );

	runLightProbeGridGpuVisibilityReceiverAssertions( {
		assert,
		results,
		sealedVisibilityWeightingDiagnostic
	} );
	await runLightProbeGridGpuVisibilityNormalAssertions( {
		call,
		assert,
		results
	} );

}

function assertReceiverProbeFacts( assert, diagnostic, label ) {

	const facts = diagnostic.receiverProbeFacts;
	assert( hasNoFields( diagnostic, 'left', 'right' ) &&
		facts !== undefined,
	`${ label }: expected aggregate receiver probe counters without per-receiver payload.` );
	assert( facts.receiverCount === 2 &&
		facts.probeCount === 16 &&
		Number.isInteger( facts.correctSideProbeCount ) &&
		Number.isInteger( facts.wrongSideProbeCount ) &&
		Number.isInteger( facts.crossingProbeCount ) &&
		Number.isInteger( facts.escapedProbeCount ) &&
		facts.correctSideProbeCount + facts.wrongSideProbeCount === facts.probeCount &&
		facts.crossingProbeCount <= facts.probeCount &&
		facts.escapedProbeCount <= facts.wrongSideProbeCount,
	`${ label }: expected compact raw aggregate probe-count facts.` );

}

const hasVisibilityMomentFacts = inspection =>
	inspection.mode === 'moments' &&
	inspection.available === true &&
	inspection.bytes > 0 &&
	inspection.samples === undefined &&
	inspection.stats.sampleCount > 0 &&
	inspection.stats.finiteSampleCount > 0 &&
	inspection.stats.hitSampleCount > 0 &&
	hasNoFields( inspection, 'evidenceStatus', 'proofBoundary' ) &&
	hasNoFields( inspection,
		'encoding',
		'resolution',
		'moments',
		'texture',
		'hitConfidenceChannel',
		'backfaceConfidenceChannel',
		'momentQualityProfile'
	) &&
	hasNoFields( inspection.stats,
		'encoding',
		'bytes',
		'meanDistanceRange',
		'varianceRange',
		'hitConfidenceRange'
	);

const hasVisibilityWeightingFacts = diagnostic =>
	hasNoFields( diagnostic,
		'diagnosticScope',
		'status',
		'proofBoundary',
		'visibilityDepth'
	) &&
	diagnostic.comparableReceiverCount > 0 &&
	Number.isFinite( diagnostic.wrongMinusCorrectSuppression ) &&
	diagnostic.summary === undefined;

const hasVisibilityRepresentationFacts = diagnostic => {

	const facts = diagnostic.visibilityRepresentation;
	return facts !== undefined &&
		Number.isInteger( facts.angularResolution ) &&
		Number.isFinite( facts.effectiveBias ) &&
		facts.momentFilter === 'cardinal-dilated-9-tap-moments' &&
		facts.borderPolicy === 'clamped-oct-uv-no-gutter' &&
		Number.isInteger( facts.momentHitProbeCount ) &&
		Number.isInteger( facts.momentNoHitProbeCount ) &&
		Number.isInteger( facts.wrongSideEscapedCount ) &&
		Number.isFinite( facts.wrongMinusCorrectSuppression ) &&
		facts.momentHitProbeCount + facts.momentNoHitProbeCount === diagnostic.receiverProbeFacts.probeCount;

};

const hasReceiverScopedShapingFacts = diagnostic => {

	const facts = diagnostic.receiverScopedShaping;
	return facts !== undefined &&
		facts.shapingPolicy === 'receiver-scoped-probe-layer-mask' &&
		facts.probeLayerMaskMode === 'custom' &&
		facts.probeLayerMaskPolicy === 'default-bit-plus-side-bit' &&
		facts.receiverMaskMode === 'per-receiver-side-mask' &&
		facts.receiverLayerMaskScope === 'grid-default-or-node-input' &&
		facts.defaultLayerPreserved === true &&
		Number.isInteger( facts.compatibleProbeCount ) &&
		Number.isInteger( facts.incompatibleProbeCount ) &&
		Number.isInteger( facts.excludedWrongSideProbeCount ) &&
		Number.isInteger( facts.preservedCorrectSideProbeCount ) &&
		Number.isInteger( facts.shapedWrongSideEscapedCount ) &&
		Number.isFinite( facts.correctSideBasePreservationRatio ) &&
		Number.isFinite( facts.correctSideVisibilityPreservationRatio ) &&
		Number.isFinite( facts.wrongSideBaseExclusionRatio ) &&
		Number.isFinite( facts.wrongSideVisibilityExclusionRatio ) &&
		facts.compatibleProbeCount === diagnostic.receiverProbeFacts.correctSideProbeCount &&
		facts.incompatibleProbeCount === diagnostic.receiverProbeFacts.wrongSideProbeCount &&
		facts.shapedWrongSideEscapedCount === 0;

};

const hasBoundaryOwnershipShapingFacts = diagnostic => {

	const facts = diagnostic.boundaryOwnershipShaping;
	return facts !== undefined &&
		facts.boundaryOwnershipPolicy === 'layer-region-probe-ownership' &&
		facts.assignmentPolicy === 'probeMeta.b authored bitfield' &&
		facts.receiverMaskMode === 'per-receiver-side-mask' &&
		Number.isInteger( facts.layerRuleCount ) &&
		Number.isInteger( facts.boundLayerRuleCount ) &&
		Number.isInteger( facts.unboundLayerRuleCount ) &&
		Number.isInteger( facts.regionRuleCount ) &&
		Number.isInteger( facts.assignedProbeCount ) &&
		Number.isInteger( facts.defaultProbeCount ) &&
		Number.isInteger( facts.compatibleOverlapCount ) &&
		Number.isInteger( facts.incompatibleOverlapCount ) &&
		Number.isFinite( facts.boundarySelectedReceiverSampleRatio ) &&
		Number.isFinite( facts.interiorCompatibleContributionRatio ) &&
		Number.isFinite( facts.boundaryCompatibleContributionRatio ) &&
		Number.isInteger( facts.boundaryWrongSideExcludedCount ) &&
		Number.isInteger( facts.boundaryCorrectSidePreservedCount ) &&
		Number.isFinite( facts.boundaryCorrectSidePreservationRatio ) &&
		Number.isFinite( facts.boundaryWrongSideExclusionRatio ) &&
		facts.boundaryWrongSideExcludedCount === diagnostic.receiverScopedShaping.excludedWrongSideProbeCount &&
		facts.boundaryCorrectSidePreservedCount === diagnostic.receiverScopedShaping.preservedCorrectSideProbeCount;

};

const hasEscapeClassificationFacts = classification =>
	classification !== undefined &&
	classification.wrongSideProbeCount > 0 &&
	Number.isInteger( classification.wrongSideEscapedCount ) &&
	hasNoFields( classification, 'escapedProbes', 'escapeReasons' );

const hasShContributionFacts = shContribution =>
	shContribution !== undefined &&
	hasNoFields( shContribution,
		'status',
		'proofBoundary',
		'suspectedFailureDomain',
		'summary',
		'scalarWrongRatioMean',
		'invertedNormalRuntimeWrongRatioMean',
		'maxCorrectSideChromaPressure',
		'maxRuntimeFinalChromaPressure',
		'weightedCorrectSideChromaPressureMean',
		'weightedCorrectSideWrongOverCorrectMean'
	) &&
	Number.isFinite( shContribution.visibilityWrongRatioMean ) &&
	Number.isFinite( shContribution.runtimeWrongRatioMean ) &&
	Number.isInteger( shContribution.correctSideMixedColorRowCount );

const hasReceiverSurfaceFacts = surface =>
	hasNoFields( surface,
		'fixtureMode',
		'status',
		'proofBoundary',
		'quadratureRule',
		'summary',
		'surfaceRuntimeWrongRatioMean',
		'surfaceCpuRenderDeltaMean',
		'surfaceCpuRenderDeltaMax',
		'surfaceCpuRenderDelta',
		'cpuRenderAgreementAggregation'
	) &&
	surface.sampleCountPerReceiver === 9 &&
	Number.isFinite( surface.surfaceRuntimeWrongRatioMax ) &&
	Number.isFinite( surface.centerRuntimeWrongRatioMax ) &&
	Number.isFinite( surface.renderSurfaceWrongRatio ) &&
	Number.isFinite( surface.renderSurfaceCenterWrongRatio ) &&
	Number.isFinite( surface.renderIrradianceCenterWrongRatio ) &&
	Number.isFinite( surface.renderLinearIrradianceCenterWrongRatio );

const hasReceiverNormalFacts = diagnostic =>
	diagnostic.available === true &&
	diagnostic.fixtureMode === 'sealed-wall' &&
	diagnostic.receiverCount === 2 &&
	diagnostic.frontFaceReceiverCount === diagnostic.receiverCount &&
	diagnostic.shaderNormalSampleCount === 3 &&
	diagnostic.frontSideVisibleReceiverCount === 2 &&
	diagnostic.frontSideCpuNormalConventionCount === 2 &&
	hasNoFields( diagnostic, 'status', 'proofBoundary', 'missingReason', 'receivers', 'shaderNormalSamples', 'summary' );

async function runLightProbeGridGpuVisibilityBaseAssertions( context ) {

	const { call, assert, results } = context;

	const visibilityMomentInspection = await call( 'inspectVisibilityDepthMoments' );
	assert( hasVisibilityMomentFacts( visibilityMomentInspection ),
		'visibility moment inspection: expected compact private moment-backed visibilityDepthTarget facts with direct readback counters.' );
	results.push( { step: 'visibility moment inspection', visibilityMomentInspection } );

	const visibilityWeightingDiagnostic = await call( 'inspectVisibilityWeightingAtLeakReceivers' );
	assert( visibilityWeightingDiagnostic.fixtureMode === 'thin-wall' &&
		hasVisibilityWeightingFacts( visibilityWeightingDiagnostic ),
	'visibility weighting diagnostic: expected raw receiver-level facts without proof status.' );
	assertReceiverProbeFacts( assert, visibilityWeightingDiagnostic, 'visibility weighting diagnostic' );
	assert( hasVisibilityRepresentationFacts( visibilityWeightingDiagnostic ),
		'visibility weighting diagnostic: expected compact visibility representation facts.' );
	assert( hasReceiverScopedShapingFacts( visibilityWeightingDiagnostic ),
		'visibility weighting diagnostic: expected compact receiver-scoped shaping facts.' );
	assert( hasBoundaryOwnershipShapingFacts( visibilityWeightingDiagnostic ),
		'visibility weighting diagnostic: expected compact boundary ownership shaping facts from assignment metadata.' );
	assert( hasEscapeClassificationFacts( visibilityWeightingDiagnostic.escapeClassification ) &&
		Number.isInteger( visibilityWeightingDiagnostic.escapeClassification.visibilityDepthResolution ) &&
		Number.isInteger( visibilityWeightingDiagnostic.escapeClassification.visibilityBypassEscapeCount ) &&
		visibilityWeightingDiagnostic.escapeClassification.wrongSideEscapedCount >= 0,
	'visibility weighting diagnostic: expected aggregate wrong-side escape classification.' );
	results.push( { step: 'visibility weighting diagnostic', visibilityWeightingDiagnostic } );

	const sealedVisibilityWeightingDiagnostic = await call( 'inspectVisibilityWeightingAtLeakReceivers', 'sealed-wall' );
	assert( sealedVisibilityWeightingDiagnostic.fixtureMode === 'sealed-wall' &&
		hasVisibilityWeightingFacts( sealedVisibilityWeightingDiagnostic ),
	'sealed visibility weighting diagnostic: expected raw sealed-wall receiver-level facts.' );
	assertReceiverProbeFacts( assert, sealedVisibilityWeightingDiagnostic, 'sealed visibility weighting diagnostic' );
	assert( hasVisibilityRepresentationFacts( sealedVisibilityWeightingDiagnostic ),
		'sealed visibility weighting diagnostic: expected compact visibility representation facts.' );
	assert( hasReceiverScopedShapingFacts( sealedVisibilityWeightingDiagnostic ),
		'sealed visibility weighting diagnostic: expected compact receiver-scoped shaping facts.' );
	assert( hasBoundaryOwnershipShapingFacts( sealedVisibilityWeightingDiagnostic ),
		'sealed visibility weighting diagnostic: expected compact boundary ownership shaping facts from assignment metadata.' );
	assert( hasNoFields( sealedVisibilityWeightingDiagnostic, 'directionalSuppressionSupported' ),
		'sealed visibility weighting diagnostic: expected raw suppression and escape facts without proof verdict echoes.' );
	assert( sealedVisibilityWeightingDiagnostic.escapeClassification.frontEdgeBypassEscapeCount === 0,
		'sealed visibility weighting diagnostic: sealed wall must remove the finite-wall front-edge bypass from this diagnostic.' );
	assert( hasEscapeClassificationFacts( sealedVisibilityWeightingDiagnostic.escapeClassification ),
		'sealed visibility weighting diagnostic: expected aggregate wrong-side escape classification.' );
	assert( hasShContributionFacts( sealedVisibilityWeightingDiagnostic.shContributionDiagnostic ),
		'sealed visibility weighting diagnostic: expected compact raw packed SH contribution facts.' );

	return sealedVisibilityWeightingDiagnostic;

}

function runLightProbeGridGpuVisibilityReceiverAssertions( context ) {

	const { assert, results, sealedVisibilityWeightingDiagnostic } = context;

	const surface = sealedVisibilityWeightingDiagnostic.receiverSurfaceQuadratureDiagnostic;
	assert( hasReceiverSurfaceFacts( surface ),
		'sealed visibility weighting diagnostic: expected compact receiver-surface CPU/render agreement facts.' );

	assert( sealedVisibilityWeightingDiagnostic.receiverGpuDebugDiagnostic === undefined,
		'sealed visibility weighting diagnostic: expected no placeholder GPU-debug unavailable payload.' );

	results.push( { step: 'sealed visibility weighting diagnostic', sealedVisibilityWeightingDiagnostic } );

}

async function runLightProbeGridGpuVisibilityNormalAssertions( context ) {

	const { call, assert, results } = context;

	const sealedReceiverNormalDiagnostic = await call( 'inspectLeakReceiverNormalConvention', 'sealed-wall' );
	assert( hasReceiverNormalFacts( sealedReceiverNormalDiagnostic ),
		'sealed receiver normal diagnostic: expected compact receiver and shader-normal count facts.' );
	results.push( { step: 'sealed receiver normal convention diagnostic', sealedReceiverNormalDiagnostic } );

}
