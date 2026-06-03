const MAX_PROOF_GATE_COUNT = 16;
const MAX_PROOF_SUMMARY_BYTES = 6000;
const SEALED_WALL_GROUND_TRUTH_WRONG_SIDE_LEAK = 0;

export function isMomentBackedVisibility( info ) {

	return !! info &&
		info.available === true &&
		info.mode === 'moments' &&
		info.bytes > 0 &&
		info.stats &&
		info.stats.finiteSampleCount > 0 &&
		info.stats.hitSampleCount > 0;

}

const getResult = ( results, step ) => {

	const result = results.find( row => row.step === step );
	if ( result === undefined ) throw new Error( `Missing smoke result step: ${ step }` );
	return result;

};

const finiteOrNull = value => Number.isFinite( value ) ? value : null;
const roundMetric = value => Number.isFinite( value ) ? Math.round( value * 10000 ) / 10000 : null;

const hasProjectionRuntimeParity = facts =>
	facts.projection.computeBackend === 'compute-probe-reduction' &&
	facts.projection.coefficientMaxDelta !== null &&
	facts.projection.atlasMaxDelta !== null &&
	facts.projection.coefficientMaxDelta <= facts.projection.coefficientTolerance &&
	facts.projection.atlasMaxDelta <= facts.projection.atlasTolerance &&
	facts.projection.atlasCheckCount > 0 &&
	facts.projection.atlasFailedCheckCount === 0;

const hasProjectionCoefficientDelta = facts =>
	facts.projection.coefficientMaxDelta !== null &&
	facts.projection.coefficientMaxDelta <= facts.projection.coefficientTolerance;

const hasProjectionAtlasDelta = facts =>
	facts.projection.atlasMaxDelta !== null &&
	facts.projection.atlasMaxDelta <= facts.projection.atlasTolerance;

const isRuntimeReady = facts => facts.runtime.status === 'ready';

const hasRuntimeTexture = facts => facts.runtime.hasTexture === true;

const hasRuntimeBounds = facts => facts.runtime.hasBoundingBox === true;

const hasReceiverNormalAgreement = facts =>
	facts.receiverNormal.receiverCount > 0 &&
	facts.receiverNormal.frontFaceReceiverCount === facts.receiverNormal.receiverCount &&
	facts.receiverNormal.frontSideVisibleReceiverCount === 2 &&
	facts.receiverNormal.frontSideCpuNormalConventionCount === 2;

const hasReceiverNormalProof = facts =>
	facts.receiverNormal.available === true &&
	hasReceiverNormalAgreement( facts );

const hasVisibilityMomentReadback = facts =>
	facts.visibilityMoments.available === true &&
	facts.visibilityMoments.mode === 'moments' &&
	facts.visibilityMoments.bytes > 0 &&
	facts.visibilityMoments.finiteSampleCount > 0 &&
	facts.visibilityMoments.hitSampleCount > 0;

const hasDirectionalSuppression = facts =>
	facts.visibilityWeighting.fixtureMode === 'sealed-wall' &&
	facts.visibilityWeighting.comparableReceiverCount > 0 &&
	facts.visibilityWeighting.wrongMinusCorrectSuppression !== null &&
	facts.visibilityWeighting.wrongMinusCorrectSuppression <= 0;

const hasReceiverSurfaceAgreement = ( facts, surfaceCpuRenderDelta ) =>
	facts.receiverSurface.fixtureMode === 'sealed-wall' &&
	facts.receiverSurface.sampleCountPerReceiver === 9 &&
	surfaceCpuRenderDelta !== null &&
	surfaceCpuRenderDelta <= 0.15;

const deriveReceiverSurfaceDelta = receiverSurface =>
	receiverSurface.renderLinearIrradianceCenterWrongRatio !== null && receiverSurface.centerRuntimeWrongRatioMax !== null ?
		roundMetric( Math.abs( receiverSurface.renderLinearIrradianceCenterWrongRatio - receiverSurface.centerRuntimeWrongRatioMax ) ) :
		null;

const deriveDisplaySurfaceDelta = receiverSurface =>
	receiverSurface.renderSurfaceWrongRatio !== null && receiverSurface.surfaceRuntimeWrongRatioMax !== null ?
		roundMetric( Math.abs( receiverSurface.renderSurfaceWrongRatio - receiverSurface.surfaceRuntimeWrongRatioMax ) ) :
		null;

const deriveDisplayIrradianceCenterDelta = receiverSurface =>
	receiverSurface.renderIrradianceCenterWrongRatio !== null && receiverSurface.centerRuntimeWrongRatioMax !== null ?
		roundMetric( Math.abs( receiverSurface.renderIrradianceCenterWrongRatio - receiverSurface.centerRuntimeWrongRatioMax ) ) :
		null;

const createReceiverSurfaceEvidence = ( receiverSurface, surfaceCpuRenderDelta ) => ( {
	renderSurfaceWrongRatio: receiverSurface.renderSurfaceWrongRatio,
	renderSurfaceCenterWrongRatio: receiverSurface.renderSurfaceCenterWrongRatio,
	renderIrradianceCenterWrongRatio: receiverSurface.renderIrradianceCenterWrongRatio,
	renderLinearIrradianceCenterWrongRatio: receiverSurface.renderLinearIrradianceCenterWrongRatio,
	surfaceRuntimeWrongRatioMax: receiverSurface.surfaceRuntimeWrongRatioMax,
	centerRuntimeWrongRatioMax: receiverSurface.centerRuntimeWrongRatioMax,
	displaySurfaceCpuRenderDelta: deriveDisplaySurfaceDelta( receiverSurface ),
	displayIrradianceCenterCpuRenderDelta: deriveDisplayIrradianceCenterDelta( receiverSurface ),
	surfaceCpuRenderDelta
} );

const createResidualSourceAttributionFacts = ( sealedWall, receiverSurface ) => ( {
	attributionPolicy: 'masked-residual-vs-irradiance-runtime',
	maskedVisibleResidualRatio: sealedWall.residualAttribution.maskedVisibleResidualRatio,
	preToneMaskedResidualRatio: sealedWall.residualAttribution.preToneMaskedResidualRatio,
	candidateRenderIrradianceCenterWrongRatio: sealedWall.residualAttribution.candidateRenderIrradianceCenterWrongRatio,
	candidateRenderLinearIrradianceCenterWrongRatio: sealedWall.residualAttribution.candidateRenderLinearIrradianceCenterWrongRatio,
	candidateLinearIrradianceToMaskedVisibleRatio: sealedWall.residualAttribution.candidateLinearIrradianceToMaskedVisibleRatio,
	candidateRenderIrradianceMaskedWrongRatio: sealedWall.residualAttribution.candidateRenderIrradianceMaskedWrongRatio,
	candidateRenderLinearIrradianceMaskedWrongRatio: sealedWall.residualAttribution.candidateRenderLinearIrradianceMaskedWrongRatio,
	candidateMaskedIrradianceToMaskedVisibleRatio: sealedWall.residualAttribution.candidateMaskedIrradianceToMaskedVisibleRatio,
	candidateReceiverMaterialType: sealedWall.residualAttribution.candidateReceiverMaterialType,
	candidateReceiverAlbedoWrongSideRatio: sealedWall.residualAttribution.candidateReceiverAlbedoWrongSideRatio,
	candidateReceiverRoughness: sealedWall.residualAttribution.candidateReceiverRoughness,
	candidateReceiverMetalness: sealedWall.residualAttribution.candidateReceiverMetalness,
	candidatePreToneMaskedToAlbedoRatio: sealedWall.residualAttribution.candidatePreToneMaskedToAlbedoRatio,
	candidateRenderLambertMaskedWrongRatio: sealedWall.residualAttribution.candidateRenderLambertMaskedWrongRatio,
	candidateRenderLinearLambertMaskedWrongRatio: sealedWall.residualAttribution.candidateRenderLinearLambertMaskedWrongRatio,
	candidateLinearLambertToLinearIrradianceRatio: sealedWall.residualAttribution.candidateLinearLambertToLinearIrradianceRatio,
	candidatePreToneMaskedToLinearLambertRatio: sealedWall.residualAttribution.candidatePreToneMaskedToLinearLambertRatio,
	candidateNearDividerEdgeWrongSideColorRatio: sealedWall.residualAttribution.candidateNearDividerEdgeWrongSideColorRatio,
	candidateNearDividerEdgeToSurfaceCenterRatio: sealedWall.residualAttribution.candidateNearDividerEdgeToSurfaceCenterRatio,
	candidateNearDividerEdgeToMaskedVisibleRatio: sealedWall.residualAttribution.candidateNearDividerEdgeToMaskedVisibleRatio,
	candidateMaskedVisiblePixelCount: sealedWall.residualAttribution.candidateMaskedVisiblePixelCount,
	candidateMaskedVisiblePixelRatio: sealedWall.residualAttribution.candidateMaskedVisiblePixelRatio,
	candidateMaskedVisibleToSurfaceCenterRatio: sealedWall.residualAttribution.candidateMaskedVisibleToSurfaceCenterRatio,
	candidatePreToneMaskedToMaskedVisibleRatio: sealedWall.residualAttribution.candidatePreToneMaskedToMaskedVisibleRatio,
	minCameraDotCpuNormal: sealedWall.residualAttribution.minCameraDotCpuNormal,
	receiverSurfaceRegionAreaRatio: sealedWall.residualAttribution.receiverSurfaceRegionAreaRatio,
	renderSurfaceWrongRatio: receiverSurface.renderSurfaceWrongRatio,
	renderSurfaceCenterWrongRatio: receiverSurface.renderSurfaceCenterWrongRatio,
	renderLinearIrradianceCenterWrongRatio: receiverSurface.renderLinearIrradianceCenterWrongRatio,
	centerRuntimeWrongRatioMax: receiverSurface.centerRuntimeWrongRatioMax,
	irradianceRuntimeDelta: deriveReceiverSurfaceDelta( receiverSurface )
} );

const hasBakedShMixedColorRisk = facts => {

	return hasDirectionalSuppression( facts ) &&
		facts.shContribution.correctSideMixedColorRowCount > 0 &&
		( facts.shContribution.runtimeWrongRatioMean ?? 0 ) >= 0.25;

};

const hasNoBakedShMixedColorRisk = facts => hasBakedShMixedColorRisk( facts ) === false;

const hasNoWrongSideEscape = facts =>
	facts.visibilityWeighting.fixtureMode === 'sealed-wall' &&
	facts.visibilityWeighting.receiverScopedShaping !== undefined &&
	facts.visibilityWeighting.receiverScopedShaping.shapedWrongSideEscapedCount === 0 &&
	facts.visibilityWeighting.receiverScopedShaping.correctSideBasePreservationRatio >= 0.999 &&
	facts.visibilityWeighting.receiverScopedShaping.correctSideVisibilityPreservationRatio >= 0.999 &&
	facts.visibilityWeighting.receiverScopedShaping.wrongSideBaseExclusionRatio >= 0.999;

const createWrongSideEscapeEvidence = facts => ( {
	angularResolution: facts.visibilityWeighting.angularResolution,
	effectiveBias: facts.visibilityWeighting.effectiveBias,
	momentFilter: facts.visibilityWeighting.momentFilter,
	borderPolicy: facts.visibilityWeighting.borderPolicy,
	momentHitProbeCount: facts.visibilityWeighting.momentHitProbeCount,
	momentNoHitProbeCount: facts.visibilityWeighting.momentNoHitProbeCount,
	visibilityDepthResolution: facts.visibilityWeighting.visibilityDepthResolution,
	wrongSideEscapedCount: facts.visibilityWeighting.wrongSideEscapedCount,
	visibilityBypassEscapeCount: facts.visibilityWeighting.visibilityBypassEscapeCount,
	frontEdgeBypassEscapeCount: facts.visibilityWeighting.frontEdgeBypassEscapeCount,
	receiverScopedShaping: facts.visibilityWeighting.receiverScopedShaping,
	boundaryOwnershipShaping: facts.visibilityWeighting.boundaryOwnershipShaping
} );

const createBakedShMixedColorRiskEvidence = facts => ( {
	runtimeWrongRatioMean: facts.shContribution.runtimeWrongRatioMean,
	correctSideMixedColorRowCount: facts.shContribution.correctSideMixedColorRowCount
} );

const createSealedWallRowFacts = row => ( {
	wrongSideColorRatio: row.wrongSideColorRatio,
	maskedWrongSideColorRatio: row.maskedWrongSideColorRatio,
	preToneMaskedWrongSideColorRatio: row.preToneMaskedWrongSideColorRatio,
	correctBounceRatio: row.correctBounceRatio,
	preToneMaskedCorrectBounceRatio: row.preToneMaskedCorrectBounceRatio
} );

const createSealedWallProofFacts = leakProofFacts => {

	const rows = new Map( leakProofFacts.rows.map( row => [ row.label, row ] ) );

	return {
		baseline: createSealedWallRowFacts( rows.get( 'sealed-wall-validity-weighted' ) ),
		candidate: createSealedWallRowFacts( rows.get( 'sealed-wall-visibility-moments' ) ),
		residualAttribution: leakProofFacts.residualAttribution
	};

};

const deriveSealedWallVisibilityFacts = ( sealedWallFacts ) => {

	const { baseline, candidate } = sealedWallFacts;
	const readPreToneMaskedWrongSide = row => row.preToneMaskedWrongSideColorRatio;
	const readCorrectBounce = row => row.correctBounceRatio;
	const readPreToneMaskedCorrectBounce = row => row.preToneMaskedCorrectBounceRatio;
	const ratio = read => roundMetric( read( candidate ) / Math.max( read( baseline ), 0.0001 ) );
	const improvementRatio = read => roundMetric( ( read( baseline ) - read( candidate ) ) / Math.max( read( baseline ), 0.0001 ) );

	return {
		preToneMaskedWrongSideImprovement: improvementRatio( readPreToneMaskedWrongSide ),
		preToneMaskedWrongSideResidualLeak: readPreToneMaskedWrongSide( candidate ),
		preToneMaskedWrongSideResidualLeakRatio: ratio( readPreToneMaskedWrongSide ),
		correctBouncePreservation: ratio( readCorrectBounce ),
		preToneMaskedCorrectBouncePreservation: ratio( readPreToneMaskedCorrectBounce )
	};

};

const hasSealedWallThresholdSupport = ( actual, threshold, supportMode = 'minimum' ) =>
	supportMode === 'equals' ?
		actual === threshold :
		actual >= threshold;

const createGate = ( {
	id,
	subject,
	metric,
	actual,
	expected,
	pass,
	reason,
	evidenceRef
} ) => {

	const status = pass === true ? 'SUPPORTED' : 'OPEN';

	return {
		id,
		subject,
		metric,
		status,
		...( status === 'OPEN' ? { actual, expected } : {} ),
		...( status === 'OPEN' ? { reason } : {} ),
		...( status === 'OPEN' && evidenceRef !== undefined ? { evidenceRef } : {} )
	};

};

const SEALED_WALL_GATE_DEFINITIONS = [
	{
		metric: 'correctBouncePreservation',
		threshold: 0.9,
		reason: 'Leak reduction must not erase correct-side bounce.'
	},
	{
		metric: 'preToneMaskedWrongSideImprovement',
		threshold: 0.05,
		reason: 'Linear pre-tone masked leak improvement is the promotion metric, not tone-mapped storytelling.'
	},
	{
		metric: 'preToneMaskedCorrectBouncePreservation',
		threshold: 0.9,
		reason: 'Linear pre-tone leak gate must preserve correct bounce.'
	},
	{
		metric: 'preToneMaskedWrongSideResidualLeakRatio',
		threshold: 0,
		supportMode: 'equals',
		reason: 'Sealed-wall visibility proof must report residual wrong-side leak against the physical zero-leak oracle; baseline is not ground truth.'
	}
];

export function createLightProbeProofFacts( results ) {

	const initial = getResult( results, 'initial' ).metrics;
	const computeProjectionRuntimeParity = getResult( results, 'compute projection runtime parity' ).computeProjectionRuntimeParity;
	const visibilityMomentInspection = getResult( results, 'visibility moment inspection' ).visibilityMomentInspection;
	const sealedVisibilityWeightingDiagnostic = getResult( results, 'sealed visibility weighting diagnostic' ).sealedVisibilityWeightingDiagnostic;
	const leakProofFacts = getResult( results, 'leak proof facts' ).leakProofFacts;
	const sealedReceiverNormalDiagnostic = getResult( results, 'sealed receiver normal convention diagnostic' ).sealedReceiverNormalDiagnostic;
	const receiverSurfaceQuadratureDiagnostic = sealedVisibilityWeightingDiagnostic.receiverSurfaceQuadratureDiagnostic;
	const shContributionDiagnostic = sealedVisibilityWeightingDiagnostic.shContributionDiagnostic;
	const projectionCoefficientMaxDelta = finiteOrNull( computeProjectionRuntimeParity.coefficientMaxDelta );
	const projectionAtlasMaxDelta = finiteOrNull( computeProjectionRuntimeParity.atlasMaxDelta );

	const facts = {
		runtime: {
			status: initial.status,
			hasTexture: initial.hasTexture === true,
			hasBoundingBox: initial.hasBoundingBox === true
		},
		projection: {
			coefficientMaxDelta: projectionCoefficientMaxDelta,
			coefficientTolerance: computeProjectionRuntimeParity.coefficientTolerance,
			atlasMaxDelta: projectionAtlasMaxDelta,
			atlasTolerance: computeProjectionRuntimeParity.atlasTolerance,
			computeBackend: computeProjectionRuntimeParity.computeBackend,
			atlasCheckCount: computeProjectionRuntimeParity.atlasCheckCount,
			atlasFailedCheckCount: computeProjectionRuntimeParity.atlasFailedCheckCount
		},
		visibilityMoments: {
			available: visibilityMomentInspection.available === true,
			mode: visibilityMomentInspection.mode,
			bytes: visibilityMomentInspection.bytes,
			finiteSampleCount: visibilityMomentInspection.stats.finiteSampleCount,
			hitSampleCount: visibilityMomentInspection.stats.hitSampleCount
		},
		visibilityWeighting: {
			fixtureMode: sealedVisibilityWeightingDiagnostic.fixtureMode,
			comparableReceiverCount: sealedVisibilityWeightingDiagnostic.comparableReceiverCount,
			angularResolution: sealedVisibilityWeightingDiagnostic.visibilityRepresentation.angularResolution,
			effectiveBias: sealedVisibilityWeightingDiagnostic.visibilityRepresentation.effectiveBias,
			momentFilter: sealedVisibilityWeightingDiagnostic.visibilityRepresentation.momentFilter,
			borderPolicy: sealedVisibilityWeightingDiagnostic.visibilityRepresentation.borderPolicy,
			momentHitProbeCount: sealedVisibilityWeightingDiagnostic.visibilityRepresentation.momentHitProbeCount,
			momentNoHitProbeCount: sealedVisibilityWeightingDiagnostic.visibilityRepresentation.momentNoHitProbeCount,
			visibilityDepthResolution: sealedVisibilityWeightingDiagnostic.escapeClassification.visibilityDepthResolution,
			wrongSideEscapedCount: sealedVisibilityWeightingDiagnostic.escapeClassification.wrongSideEscapedCount,
			visibilityBypassEscapeCount: sealedVisibilityWeightingDiagnostic.escapeClassification.visibilityBypassEscapeCount,
			frontEdgeBypassEscapeCount: sealedVisibilityWeightingDiagnostic.escapeClassification.frontEdgeBypassEscapeCount,
			receiverScopedShaping: {
				shapingPolicy: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.shapingPolicy,
				probeLayerMaskMode: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.probeLayerMaskMode,
				probeLayerMaskPolicy: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.probeLayerMaskPolicy,
				receiverMaskMode: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.receiverMaskMode,
				defaultLayerPreserved: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.defaultLayerPreserved,
				compatibleProbeCount: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.compatibleProbeCount,
				incompatibleProbeCount: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.incompatibleProbeCount,
				excludedWrongSideProbeCount: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.excludedWrongSideProbeCount,
				preservedCorrectSideProbeCount: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.preservedCorrectSideProbeCount,
				shapedWrongSideEscapedCount: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.shapedWrongSideEscapedCount,
				correctSideBasePreservationRatio: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.correctSideBasePreservationRatio,
				correctSideVisibilityPreservationRatio: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.correctSideVisibilityPreservationRatio,
				wrongSideBaseExclusionRatio: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.wrongSideBaseExclusionRatio,
				wrongSideVisibilityExclusionRatio: sealedVisibilityWeightingDiagnostic.receiverScopedShaping.wrongSideVisibilityExclusionRatio
			},
			boundaryOwnershipShaping: {
				boundaryOwnershipPolicy: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.boundaryOwnershipPolicy,
				assignmentPolicy: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.assignmentPolicy,
				receiverMaskMode: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.receiverMaskMode,
				layerRuleCount: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.layerRuleCount,
				boundLayerRuleCount: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.boundLayerRuleCount,
				unboundLayerRuleCount: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.unboundLayerRuleCount,
				regionRuleCount: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.regionRuleCount,
				assignedProbeCount: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.assignedProbeCount,
				defaultProbeCount: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.defaultProbeCount,
				compatibleOverlapCount: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.compatibleOverlapCount,
				incompatibleOverlapCount: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.incompatibleOverlapCount,
				boundarySelectedReceiverSampleRatio: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.boundarySelectedReceiverSampleRatio,
				interiorCompatibleContributionRatio: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.interiorCompatibleContributionRatio,
				boundaryCompatibleContributionRatio: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.boundaryCompatibleContributionRatio,
				boundaryWrongSideExcludedCount: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.boundaryWrongSideExcludedCount,
				boundaryCorrectSidePreservedCount: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.boundaryCorrectSidePreservedCount,
				boundaryCorrectSidePreservationRatio: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.boundaryCorrectSidePreservationRatio,
				boundaryWrongSideExclusionRatio: sealedVisibilityWeightingDiagnostic.boundaryOwnershipShaping.boundaryWrongSideExclusionRatio
			},
			wrongMinusCorrectSuppression: finiteOrNull( sealedVisibilityWeightingDiagnostic.wrongMinusCorrectSuppression )
		},
		shContribution: {
			correctSideMixedColorRowCount: shContributionDiagnostic.correctSideMixedColorRowCount,
			visibilityWrongRatioMean: finiteOrNull( shContributionDiagnostic.visibilityWrongRatioMean ),
			runtimeWrongRatioMean: finiteOrNull( shContributionDiagnostic.runtimeWrongRatioMean )
		},
		receiverNormal: {
			available: sealedReceiverNormalDiagnostic.available === true,
			receiverCount: sealedReceiverNormalDiagnostic.receiverCount,
			frontFaceReceiverCount: sealedReceiverNormalDiagnostic.frontFaceReceiverCount,
			frontSideVisibleReceiverCount: sealedReceiverNormalDiagnostic.frontSideVisibleReceiverCount,
			frontSideCpuNormalConventionCount: sealedReceiverNormalDiagnostic.frontSideCpuNormalConventionCount,
			minCameraDotCpuNormal: finiteOrNull( sealedReceiverNormalDiagnostic.minCameraDotCpuNormal ),
			receiverSurfaceRegionAreaRatio: finiteOrNull( sealedReceiverNormalDiagnostic.receiverSurfaceRegionAreaRatio )
		},
		receiverSurface: {
			fixtureMode: sealedVisibilityWeightingDiagnostic.fixtureMode,
			sampleCountPerReceiver: receiverSurfaceQuadratureDiagnostic.sampleCountPerReceiver,
			renderSurfaceWrongRatio: finiteOrNull( receiverSurfaceQuadratureDiagnostic.renderSurfaceWrongRatio ),
			renderSurfaceCenterWrongRatio: finiteOrNull( receiverSurfaceQuadratureDiagnostic.renderSurfaceCenterWrongRatio ),
			renderIrradianceCenterWrongRatio: finiteOrNull( receiverSurfaceQuadratureDiagnostic.renderIrradianceCenterWrongRatio ),
			renderLinearIrradianceCenterWrongRatio: finiteOrNull( receiverSurfaceQuadratureDiagnostic.renderLinearIrradianceCenterWrongRatio ),
			surfaceRuntimeWrongRatioMax: finiteOrNull( receiverSurfaceQuadratureDiagnostic.surfaceRuntimeWrongRatioMax ),
			centerRuntimeWrongRatioMax: finiteOrNull( receiverSurfaceQuadratureDiagnostic.centerRuntimeWrongRatioMax )
		},
		sealedWall: createSealedWallProofFacts( leakProofFacts )
	};

	facts.sealedWall.residualAttribution.minCameraDotCpuNormal = facts.receiverNormal.minCameraDotCpuNormal;
	facts.sealedWall.residualAttribution.receiverSurfaceRegionAreaRatio = facts.receiverNormal.receiverSurfaceRegionAreaRatio;
	facts.sealedWall.residualSourceAttribution = createResidualSourceAttributionFacts( facts.sealedWall, facts.receiverSurface );

	return facts;

}

export function evaluateLightProbeProofGates( facts ) {

	const sealedWallVisibilityFacts = deriveSealedWallVisibilityFacts( facts.sealedWall );
	const bakedShMixedColorRisk = hasBakedShMixedColorRisk( facts );
	const bakedShMixedColorRiskEvidence = createBakedShMixedColorRiskEvidence( facts );
	const wrongSideEscapeEvidence = createWrongSideEscapeEvidence( facts );
	const visibilityMomentReadbackPass = hasVisibilityMomentReadback( facts );
	const receiverNormalAgreement = hasReceiverNormalAgreement( facts );
	const receiverNormalGatePass = hasReceiverNormalProof( facts );
	const directionalSuppressionPass = hasDirectionalSuppression( facts );
	const wrongSideEscapePass = hasNoWrongSideEscape( facts );
	const receiverSurfaceDelta = deriveReceiverSurfaceDelta( facts.receiverSurface );
	const receiverSurfaceEvidence = createReceiverSurfaceEvidence( facts.receiverSurface, receiverSurfaceDelta );
	const receiverSurfaceGatePass = hasReceiverSurfaceAgreement( facts, receiverSurfaceDelta );
	const projectionCoefficientDeltaPass = hasProjectionCoefficientDelta( facts );
	const projectionAtlasDeltaPass = hasProjectionAtlasDelta( facts );
	const runtimeReadyPass = isRuntimeReady( facts );
	const runtimeTexturePass = hasRuntimeTexture( facts );
	const runtimeBoundsPass = hasRuntimeBounds( facts );
	const projectionRuntimeParityPass = hasProjectionRuntimeParity( facts );
	const shMixedColorRiskPass = hasNoBakedShMixedColorRisk( facts );

	return [
		createGate( {
			id: 'runtime.ready',
			subject: 'runtime',
			metric: 'status',
			actual: facts.runtime.status,
			expected: 'ready',
			pass: runtimeReadyPass,
			reason: 'LightProbeGridGPU bake must finish before proof facts are trusted.'
		} ),
		createGate( {
			id: 'runtime.texture',
			subject: 'runtime',
			metric: 'hasTexture',
			actual: facts.runtime.hasTexture,
			expected: true,
			pass: runtimeTexturePass,
			reason: 'Runtime must expose the packed SH atlas texture.'
		} ),
		createGate( {
			id: 'runtime.boundingBox',
			subject: 'runtime',
			metric: 'hasBoundingBox',
			actual: facts.runtime.hasBoundingBox,
			expected: true,
			pass: runtimeBoundsPass,
			reason: 'Runtime must expose probe-grid bounds for sampling.'
		} ),
		createGate( {
			id: 'projection.runtimeParity',
			subject: 'projection',
			metric: 'runtimeParity',
			actual: projectionRuntimeParityPass,
			expected: true,
			pass: projectionRuntimeParityPass,
			reason: 'Compute projection remains an explicit gate instead of a narrative status string.',
			evidenceRef: 'compute projection runtime parity'
		} ),
		createGate( {
			id: 'projection.coefficientDelta',
			subject: 'projection',
			metric: 'coefficientMaxDelta',
			actual: facts.projection.coefficientMaxDelta,
			expected: `<= ${ facts.projection.coefficientTolerance }`,
			pass: projectionCoefficientDeltaPass,
			reason: 'Compute and fragment coefficient targets should agree within readback tolerance.',
			evidenceRef: 'compute projection runtime parity'
		} ),
		createGate( {
			id: 'projection.atlasDelta',
			subject: 'projection',
			metric: 'atlasMaxDelta',
			actual: facts.projection.atlasMaxDelta,
			expected: `<= ${ facts.projection.atlasTolerance }`,
			pass: projectionAtlasDeltaPass,
			reason: 'Compute and fragment packed-atlas samples should agree within readback tolerance.',
			evidenceRef: 'compute projection runtime parity'
		} ),
		createGate( {
			id: 'visibility.momentReadback',
			subject: 'visibility',
			metric: 'finiteHitReadback',
			actual: visibilityMomentReadbackPass,
			expected: true,
			pass: visibilityMomentReadbackPass,
			reason: 'Private visibility moments must have direct readback evidence before leak gates are interpreted.',
			evidenceRef: 'visibility moment inspection'
		} ),
		createGate( {
			id: 'receiverNormal.frontFaceShaderAgreement',
			subject: 'receiverNormal',
			metric: 'frontFaceShaderAgreement',
			actual: receiverNormalAgreement,
			expected: true,
			pass: receiverNormalGatePass,
			reason: 'Receiver CPU normals must match rendered front faces and front-side normalWorld samples before visibility thresholds are trusted.',
			evidenceRef: 'sealed receiver normal convention diagnostic'
		} ),
		createGate( {
			id: 'visibilityWeighting.directionalSuppression',
			subject: 'visibilityWeighting',
			metric: 'wrongMinusCorrectSuppression',
			actual: facts.visibilityWeighting.wrongMinusCorrectSuppression,
			expected: '<= 0',
			pass: directionalSuppressionPass,
			reason: 'Sealed-wall CPU visibility weighting must not suppress correct-side contribution more than wrong-side contribution.',
			evidenceRef: 'sealed visibility weighting diagnostic'
		} ),
		createGate( {
			id: 'visibilityWeighting.noWrongSideEscape',
			subject: 'visibilityWeighting',
			metric: 'wrongSideEscapedCount',
			actual: wrongSideEscapeEvidence,
			expected: {
				receiverScopedShaping: {
					shapedWrongSideEscapedCount: 0,
					correctSideBasePreservationRatio: '>= 0.999',
					wrongSideBaseExclusionRatio: '>= 0.999'
				}
			},
			pass: wrongSideEscapePass,
			reason: 'Receiver-scoped probe shaping should leave no compatible wrong-side probes escaping the sealed divider while preserving correct-side contribution.',
			evidenceRef: 'sealed visibility weighting diagnostic'
		} ),
		createGate( {
			id: 'receiverSurface.cpuRenderAgreement',
			subject: 'receiverSurface',
			metric: 'surfaceCpuRenderDelta',
			actual: receiverSurfaceEvidence,
			expected: '<= 0.15',
			pass: receiverSurfaceGatePass,
			reason: 'Receiver-surface CPU quadrature should agree with rendered sealed-wall surface color within diagnostic tolerance.',
			evidenceRef: 'sealed visibility weighting diagnostic'
		} ),
		createGate( {
			id: 'shContribution.noBakedMixedColorRisk',
			subject: 'shContribution',
			metric: 'bakedShMixedColorRisk',
			actual: bakedShMixedColorRiskEvidence,
			expected: {
				runtimeWrongRatioMean: '< 0.25'
			},
			pass: shMixedColorRiskPass,
			reason: 'Packed SH contribution evidence must not indicate runtime mixed-color risk after escape and directional-suppression gates pass.',
			evidenceRef: 'sealed visibility weighting diagnostic'
		} ),
		...SEALED_WALL_GATE_DEFINITIONS.map( ( { metric, threshold, supportMode, reason } ) => {

			const actual = sealedWallVisibilityFacts[ metric ];
			const sealedWallGatePass = hasSealedWallThresholdSupport( actual, threshold, supportMode );

			return createGate( {
				id: `sealedWall.${ metric }`,
				subject: 'sealedWall',
				metric,
				actual,
				expected: metric === 'preToneMaskedWrongSideResidualLeakRatio' ?
					`ground truth wrong-side leak ${ SEALED_WALL_GROUND_TRUTH_WRONG_SIDE_LEAK }` :
					`>= ${ threshold }`,
				pass: sealedWallGatePass,
				reason,
				evidenceRef: 'leak proof facts'
			} );

		} )
	];

}

export function createLightProbeProofSummary( gates ) {

	const counts = gates.reduce( ( result, gate ) => {

		result[ gate.status ] ++;
		return result;

	}, {
		SUPPORTED: 0,
		OPEN: 0
	} );

	return {
		status: counts.OPEN === 0 ? 'SUPPORTED' : 'OPEN',
		supported: counts.SUPPORTED,
		open: counts.OPEN,
		gates
	};

}

const hasBoundedProofGateCount = summary =>
	summary.gates.length > 0 &&
	summary.gates.length <= MAX_PROOF_GATE_COUNT;

const hasUniqueGateIds = ( summary, gateIds ) => gateIds.size === summary.gates.length;

const hasRequiredGateIds = ( gateIds, requiredGateIds ) => requiredGateIds.every( id => gateIds.has( id ) );

const hasCompactGateShape = gate =>
	typeof gate.id === 'string' &&
	typeof gate.subject === 'string' &&
	typeof gate.metric === 'string' &&
	[ 'SUPPORTED', 'OPEN' ].includes( gate.status ) &&
	( gate.status === 'SUPPORTED' || ( typeof gate.reason === 'string' && gate.reason.length > 0 ) ) &&
	( gate.status === 'SUPPORTED' || ( gate.actual !== undefined && gate.expected !== undefined ) );

const hasSupportedRequiredGates = ( summary, requiredSupportedGateIds ) =>
	requiredSupportedGateIds.every( id =>
		summary.gates.find( gate => gate.id === id )?.status === 'SUPPORTED' );

const hasCompactProofSummarySize = summary => JSON.stringify( summary ).length <= MAX_PROOF_SUMMARY_BYTES;

export function assertLightProbeProofSummary( summary, assert ) {

	const gateIds = new Set( summary.gates.map( gate => gate.id ) );
	const requiredSupportedGateIds = [
		'runtime.ready',
		'runtime.texture',
		'runtime.boundingBox',
		'visibility.momentReadback',
		'sealedWall.correctBouncePreservation',
		'sealedWall.preToneMaskedCorrectBouncePreservation'
	];
	const requiredGateIds = [
		...requiredSupportedGateIds,
		'projection.runtimeParity',
		'projection.coefficientDelta',
		'projection.atlasDelta',
		'visibilityWeighting.directionalSuppression',
		'visibilityWeighting.noWrongSideEscape',
		'receiverNormal.frontFaceShaderAgreement',
		'receiverSurface.cpuRenderAgreement',
		'shContribution.noBakedMixedColorRisk',
		'sealedWall.preToneMaskedWrongSideImprovement',
		'sealedWall.preToneMaskedWrongSideResidualLeakRatio'
	];

	assert( hasBoundedProofGateCount( summary ),
	`compact proof gates: expected 1-${ MAX_PROOF_GATE_COUNT } bounded gates.` );
	assert( hasUniqueGateIds( summary, gateIds ),
		'compact proof gates: expected unique gate ids.' );
	assert( hasRequiredGateIds( gateIds, requiredGateIds ),
		'compact proof gates: expected required runtime, projection, visibility, receiver-normal, and sealed-wall gate ids.' );
	assert( summary.gates.every( hasCompactGateShape ),
	'compact proof gates: expected every gate to have id, subject, metric, status, and open-gate actual, expected, and reason.' );
	assert( hasSupportedRequiredGates( summary, requiredSupportedGateIds ),
	'compact proof gates: expected product-readiness gates to be supported.' );
	assert( hasCompactProofSummarySize( summary ),
	`compact proof gates: summary exceeded ${ MAX_PROOF_SUMMARY_BYTES } bytes.` );

}

export function runLightProbeGridGpuProofGateAssertions( context ) {

	const { assert, results } = context;
	const facts = createLightProbeProofFacts( results );
	const gates = evaluateLightProbeProofGates( facts );
	const proofSummary = createLightProbeProofSummary( gates );

	assertLightProbeProofSummary( proofSummary, assert );
	results.push( { step: 'compact proof gates', proofSummary } );

	return proofSummary;

}
