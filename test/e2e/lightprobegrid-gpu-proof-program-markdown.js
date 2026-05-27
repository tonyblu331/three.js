export function appendLightProbeProofProgramMarkdown( lines, report ) {

	const visibilityMomentInspection = report.currentEvidence.visibilityMomentInspection;
	const visibilityWeightingDiagnostic = report.currentEvidence.visibilityWeightingDiagnostic;
	const sealedVisibilityWeightingDiagnostic = report.currentEvidence.sealedVisibilityWeightingDiagnostic;
	const sealedReceiverNormalDiagnostic = report.currentEvidence.sealedReceiverNormalDiagnostic;
	const researchProofProgram = report.currentEvidence.researchProofProgram;

	lines.push(
		'',
		'## DDGI-lite Research Proof Program',
		'',
		`- Status: ${ researchProofProgram.status }`,
		`- Claim: ${ researchProofProgram.claim }`,
		`- Proof ledger decision: ${ researchProofProgram.proofLedgerDecision }`,
		`- Next pressure: ${ researchProofProgram.nextPressure }`,
		'',
		'### Verifier boundary',
		...researchProofProgram.verifierBoundary.map( item => `- ${ item }` ),
		'',
		'### Baseline / candidate family',
		`- Baseline: ${ researchProofProgram.baselineCandidateFamily.baseline }`,
		`- Candidate: ${ researchProofProgram.baselineCandidateFamily.candidate }`,
		`- Negative control: ${ researchProofProgram.baselineCandidateFamily.negativeControl }`,
		`- Fast path control: ${ researchProofProgram.baselineCandidateFamily.fastPathControl }`,
		'',
		'### Sources and source-derived lessons',
		'| Status | Source | Lesson |',
		'|---|---|---|'
	);

	for ( const source of researchProofProgram.sources ) {

		lines.push( [
			source.status,
			`[${ source.label }](${ source.url })`,
			source.lesson
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Evidence labels',
		...researchProofProgram.evidenceLabels.map( item => `- ${ item.label }: ${ item.meaning }` ),
		'',
		'### Enemy terms',
		...researchProofProgram.enemyTerms.map( item => `- ${ item }` ),
		'',
		'### Rejection gates',
		...researchProofProgram.rejectionGates.map( item => `- ${ item }` ),
		'',
		'### Slices',
		'| Slice | Status | Files | Purpose |',
		'|---|---|---|---|'
	);

	for ( const slice of researchProofProgram.slices ) {

		lines.push( [
			slice.id,
			slice.status,
			slice.files.join( ', ' ),
			slice.purpose
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Proof ladder',
		...researchProofProgram.proofLadder.map( item => `- Rung ${ item.rung } [${ item.status }]: ${ item.claim }` ),
		'',
		'### Visibility moment inspection',
		`- Evidence status: ${ visibilityMomentInspection.evidenceStatus }`,
		`- Mode: ${ visibilityMomentInspection.mode }`,
		`- Bytes: ${ visibilityMomentInspection.bytes }`,
		`- Resolution: ${ visibilityMomentInspection.resolution }`,
		`- Finite samples: ${ visibilityMomentInspection.stats.finiteSampleCount } / ${ visibilityMomentInspection.stats.sampleCount }`,
		`- Hit/confidence samples: ${ visibilityMomentInspection.stats.hitSampleCount }`,
		`- Mean distance range: ${ visibilityMomentInspection.stats.minMeanDistance } .. ${ visibilityMomentInspection.stats.maxMeanDistance }`,
		`- Variance range: ${ visibilityMomentInspection.stats.minVariance } .. ${ visibilityMomentInspection.stats.maxVariance }`,
		'',
		'### Visibility weighting receiver diagnostic',
		`- Status: ${ visibilityWeightingDiagnostic.status }`,
		`- Comparable receivers: ${ visibilityWeightingDiagnostic.summary.comparableReceiverCount }`,
		`- Correct-side suppression mean: ${ visibilityWeightingDiagnostic.summary.correctSuppressionMean }`,
		`- Wrong-side suppression mean: ${ visibilityWeightingDiagnostic.summary.wrongSuppressionMean }`,
		`- Wrong minus correct suppression: ${ visibilityWeightingDiagnostic.summary.wrongMinusCorrectSuppression }`,
		`- Best visibility bias scale: ${ visibilityWeightingDiagnostic.bestBiasScale.visibilityBiasScale }`,
		`- Best wrong minus correct suppression: ${ visibilityWeightingDiagnostic.bestBiasScale.summary.wrongMinusCorrectSuppression }`,
		`- Best hit-confidence policy: ${ visibilityWeightingDiagnostic.bestHitConfidencePolicy.policy.label }`,
		`- Best policy wrong minus correct suppression: ${ visibilityWeightingDiagnostic.bestHitConfidencePolicy.summary.wrongMinusCorrectSuppression }`,
		`- Hit-confidence policy decision: ${ visibilityWeightingDiagnostic.hitConfidencePolicyDecision }`,
		`- Wrong-side escaped probes: ${ visibilityWeightingDiagnostic.escapeClassification.wrongSideEscapedCount } / ${ visibilityWeightingDiagnostic.escapeClassification.wrongSideProbeCount }`,
		`- Crossing wrong-side escaped probes: ${ visibilityWeightingDiagnostic.escapeClassification.crossingWrongSideEscapedCount }`,
		`- Low-hit-confidence escapes: ${ visibilityWeightingDiagnostic.escapeClassification.lowHitConfidenceEscapeCount }`,
		`- Visibility-bias bypass escapes: ${ visibilityWeightingDiagnostic.escapeClassification.visibilityBypassEscapeCount }`,
		`- Front-edge bypass escapes: ${ visibilityWeightingDiagnostic.escapeClassification.frontEdgeBypassEscapeCount }`,
		`- Left receiver correct/wrong suppression: ${ visibilityWeightingDiagnostic.left.totals.correctSuppression } / ${ visibilityWeightingDiagnostic.left.totals.wrongSuppression }`,
		`- Right receiver correct/wrong suppression: ${ visibilityWeightingDiagnostic.right.totals.correctSuppression } / ${ visibilityWeightingDiagnostic.right.totals.wrongSuppression }`
	);

	if ( visibilityWeightingDiagnostic.escapeClassification.escapedProbes.length > 0 ) {

		lines.push(
			'',
			'#### Escaped wrong-side probes',
			'| Receiver | Probe | Octa texel | Reason | Hit confidence | Mean distance | Receiver distance | Delta | Visibility | Suppression | Crosses divider | Visibility segment | Surface segment |',
			'|---|---:|---|---|---:|---:|---:|---:|---:|---:|---|---|---|'
		);

		for ( const probe of visibilityWeightingDiagnostic.escapeClassification.escapedProbes ) {

			lines.push( [
				probe.receiver,
				probe.probeIndex,
				`${ probe.octaTexel.x },${ probe.octaTexel.y }`,
				probe.escapeReason,
				probe.hitConfidence,
				probe.meanDistance,
				probe.receiverDistance,
				probe.delta,
				probe.visibility,
				probe.suppression,
				probe.crossesDivider,
				probe.visibilitySegmentDividerAudit.reason,
				probe.surfaceSegmentDividerAudit.reason
			].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

		}

	}

	lines.push(
		'',
		'### Sealed-wall visibility weighting interrogation',
		`- Status: ${ sealedVisibilityWeightingDiagnostic.status }`,
		`- Finding: ${ sealedVisibilityWeightingDiagnostic.interrogationFinding }`,
		`- Dominant escape reason: ${ sealedVisibilityWeightingDiagnostic.dominantEscapeReason.reason } (${ sealedVisibilityWeightingDiagnostic.dominantEscapeReason.count })`,
		`- Comparable receivers: ${ sealedVisibilityWeightingDiagnostic.summary.comparableReceiverCount }`,
		`- Correct-side suppression mean: ${ sealedVisibilityWeightingDiagnostic.summary.correctSuppressionMean }`,
		`- Wrong-side suppression mean: ${ sealedVisibilityWeightingDiagnostic.summary.wrongSuppressionMean }`,
		`- Wrong minus correct suppression: ${ sealedVisibilityWeightingDiagnostic.summary.wrongMinusCorrectSuppression }`,
		`- Wrong-side escaped probes: ${ sealedVisibilityWeightingDiagnostic.escapeClassification.wrongSideEscapedCount } / ${ sealedVisibilityWeightingDiagnostic.escapeClassification.wrongSideProbeCount }`,
		`- Front-edge bypass escapes: ${ sealedVisibilityWeightingDiagnostic.escapeClassification.frontEdgeBypassEscapeCount }`,
		`- Hit-confidence policy decision: ${ sealedVisibilityWeightingDiagnostic.hitConfidencePolicyDecision }`
	);

	if ( sealedVisibilityWeightingDiagnostic.escapeClassification.escapedProbes.length > 0 ) {

		lines.push(
			'',
			'#### Sealed escaped wrong-side probes',
			'| Receiver | Probe | Octa texel | Reason | Hit confidence | Mean distance | Receiver distance | Delta | Visibility | Suppression | Crosses divider | Visibility segment | Surface segment |',
			'|---|---:|---|---|---:|---:|---:|---:|---:|---:|---|---|---|'
		);

		for ( const probe of sealedVisibilityWeightingDiagnostic.escapeClassification.escapedProbes ) {

			lines.push( [
				probe.receiver,
				probe.probeIndex,
				`${ probe.octaTexel.x },${ probe.octaTexel.y }`,
				probe.escapeReason,
				probe.hitConfidence,
				probe.meanDistance,
				probe.receiverDistance,
				probe.delta,
				probe.visibility,
				probe.suppression,
				probe.crossesDivider,
				probe.visibilitySegmentDividerAudit.reason,
				probe.surfaceSegmentDividerAudit.reason
			].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

		}

	}

	lines.push(
		'',
		'### Sealed-wall receiver normal convention diagnostic',
		`- Status: ${ sealedReceiverNormalDiagnostic.status }`,
		`- Conclusion: ${ sealedReceiverNormalDiagnostic.summary.diagnosticConclusion }`,
		`- Front-face agreement: ${ sealedReceiverNormalDiagnostic.summary.frontFaceAgreement }`,
		`- Shader normal agreement: ${ sealedReceiverNormalDiagnostic.summary.shaderNormalAgreement }`,
		`- BackSide cull supported: ${ sealedReceiverNormalDiagnostic.summary.backSideCullSupported }`,
		'',
		'| Receiver | Material side | CPU normal | Inverted CPU normal | Expected visible face | Actual rendered side | Camera dot normal |',
		'|---|---|---|---|---|---|---:|'
	);

	for ( const receiver of sealedReceiverNormalDiagnostic.receivers ) {

		lines.push( [
			receiver.label,
			receiver.materialSide,
			`${ receiver.cpuNormal.x },${ receiver.cpuNormal.y },${ receiver.cpuNormal.z }`,
			`${ receiver.invertedCpuNormal.x },${ receiver.invertedCpuNormal.y },${ receiver.invertedCpuNormal.z }`,
			receiver.expectedVisibleFaceFromCpuNormal,
			receiver.actualRenderedSide,
			receiver.cameraDotCpuNormal
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'| Shader sample | Side | Left visible | Left closest | Right visible | Right closest |',
		'|---|---|---|---|---|---|'
	);

	for ( const sample of sealedReceiverNormalDiagnostic.shaderNormalSamples ) {

		lines.push( [
			sample.label,
			sample.materialSide,
			sample.leftReceiverSurface.visible,
			sample.leftReceiverSurface.closestNormalConvention,
			sample.rightReceiverSurface.visible,
			sample.rightReceiverSurface.closestNormalConvention
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

}
