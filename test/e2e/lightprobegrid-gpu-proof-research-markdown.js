export function appendLightProbeProofResearchMarkdown( lines, report ) {

	const pipelineDecision = report.currentEvidence.mathAndPipelineDecision;

	lines.push(
		'',
		'## Math / WebGPU Pipeline Decision',
		'',
		`- Root cause hypothesis: ${ pipelineDecision.rootCauseHypothesis }`,
		`- Action taken: ${ pipelineDecision.action }`,
		`- Pipeline flow: ${ pipelineDecision.webgpuPipelineFlow }`,
		`- WebGPU boundary: ${ pipelineDecision.webgpuQuirkBoundary }`,
		`- Deferred runtime work: ${ pipelineDecision.deferredRuntimeWork }`
	);

	const externalResearch = report.currentEvidence.externalImplementationResearch;

	lines.push(
		'',
		'## External Implementation Research',
		'',
		`- Status: ${ externalResearch.status }`,
		`- Sixteen Studio finding: ${ externalResearch.sixteenStudioFinding }`,
		'',
		'| Source | Transfer lesson | URL |',
		'|---|---|---|'
	);

	for ( const source of externalResearch.primarySources ) {

		lines.push( [ source.name, source.lesson, source.url ].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Transfer to LightProbeGridGPU',
		...externalResearch.transferToLightProbeGridGPU.map( lesson => `- ${ lesson }` ),
	);

	const researchRoadmapRevision = report.currentEvidence.researchRoadmapRevision;

	lines.push(
		'',
		'## Research / Literature Roadmap Revision',
		'',
		`- Status: ${ researchRoadmapRevision.status }`,
		`- Claim boundary: ${ researchRoadmapRevision.claimBoundary }`,
		'',
		'### Literature decisions',
		...researchRoadmapRevision.literatureDecisions.map( item => `- ${ item }` ),
		'',
		'### Next roadmap',
		...researchRoadmapRevision.nextRoadmap.map( item => `- ${ item }` ),
		'',
		'### Backlog',
		...researchRoadmapRevision.backlog.map( item => `- ${ item }` )
	);

	const parityMatrix = report.currentEvidence.implementationParityMatrix;

	lines.push(
		'',
		'## Implementation Parity Matrix',
		'',
		`- Status: ${ parityMatrix.status }`,
		`- Comparison mode: ${ parityMatrix.comparisonMode }`,
		'',
		'### Downloaded comparison refs',
		'| Label | Ref | Commit | Paths |',
		'|---|---|---|---|'
	);

	for ( const downloadedRef of parityMatrix.downloadedRefs ) {

		lines.push( [
			downloadedRef.label,
			downloadedRef.ref,
			downloadedRef.commit ? `${ downloadedRef.commit } (${ downloadedRef.commitSubject })` : 'local working ref',
			downloadedRef.paths.join( '<br>' )
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Sources read',
		...parityMatrix.sourcesRead.map( source => `- ${ source }` ),
		'',
		'| Axis | Ours | SixteenStudio branch | WebGL baseline | Where we stand | Action |',
		'|---|---|---|---|---|---|'
	);

	for ( const row of parityMatrix.rows ) {

		lines.push( [
			row.axis,
			row.ours,
			row.sixteenStudio,
			row.webglBaseline,
			row.standing,
			row.action
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'### Bugs and gaps to address',
		...parityMatrix.bugsAndGaps.map( item => `- ${ item }` ),
		'',
		'### What we do better',
		...parityMatrix.whatWeDoBetter.map( item => `- ${ item }` ),
		'',
		'### What they do better',
		...parityMatrix.whatTheyDoBetter.map( item => `- ${ item }` ),
		'',
		'### Candid comparative rating',
		`- Status: ${ parityMatrix.comparativeRating.status }`,
		`- Scale: ${ parityMatrix.comparativeRating.scale }`,
		'',
		'#### Evidence labels',
		...parityMatrix.comparativeRating.evidenceLabels.map( item => `- ${ item }` ),
		'',
		'| Axis | Ours | SixteenStudio branch | WebGL baseline |',
		'|---|---|---|---|'
	);

	for ( const row of parityMatrix.comparativeRating.rows ) {

		lines.push( [
			row.axis,
			`${ row.ours.score }/10 (${ row.ours.label }) — ${ row.ours.rationale }`,
			`${ row.sixteenStudio.score }/10 (${ row.sixteenStudio.label }) — ${ row.sixteenStudio.rationale }`,
			`${ row.webglBaseline.score }/10 (${ row.webglBaseline.label }) — ${ row.webglBaseline.rationale }`
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'#### Overall',
		`- Ours: ${ parityMatrix.comparativeRating.overall.ours.score }/10 — ${ parityMatrix.comparativeRating.overall.ours.label }. ${ parityMatrix.comparativeRating.overall.ours.verdict }`,
		`- SixteenStudio: ${ parityMatrix.comparativeRating.overall.sixteenStudio.score }/10 — ${ parityMatrix.comparativeRating.overall.sixteenStudio.label }. ${ parityMatrix.comparativeRating.overall.sixteenStudio.verdict }`,
		`- WebGL baseline: ${ parityMatrix.comparativeRating.overall.webglBaseline.score }/10 — ${ parityMatrix.comparativeRating.overall.webglBaseline.label }. ${ parityMatrix.comparativeRating.overall.webglBaseline.verdict }`,
		`- Candid verdict: ${ parityMatrix.comparativeRating.candidVerdict }`,
		'',
		'### Line placement rules',
		...parityMatrix.linePlacementRules.map( item => `- ${ item }` ),
	);

	const visibilityDepthRoadmap = report.currentEvidence.visibilityDepthRoadmap;

	lines.push(
		'',
		'## Visibility / Depth Moment Roadmap',
		'',
		`- Status: ${ visibilityDepthRoadmap.status }`,
		`- Problem: ${ visibilityDepthRoadmap.problem }`,
		`- Design thesis: ${ visibilityDepthRoadmap.designThesis }`,
		'',
		'### Private data contract',
		...visibilityDepthRoadmap.privateDataContract.map( item => `- ${ item }` ),
		'',
		'### Bake plan',
		...visibilityDepthRoadmap.bakePlan.map( item => `- ${ item }` ),
		'',
		'### Runtime plan',
		...visibilityDepthRoadmap.runtimePlan.map( item => `- ${ item }` ),
		'',
		'### Verifier additions',
		...visibilityDepthRoadmap.verifierAdditions.map( item => `- ${ item }` ),
		'',
		'### Acceptance gates',
		...visibilityDepthRoadmap.acceptanceGates.map( item => `- ${ item }` ),
		'',
		'| Alternative | Tradeoff |',
		'|---|---|'
	);

	for ( const alternative of visibilityDepthRoadmap.alternatives ) {

		lines.push( [ alternative.name, alternative.tradeoff ].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	const ddgiVisibilityDepthSpec = report.currentEvidence.ddgiVisibilityDepthSpec;

	lines.push(
		'',
		'## DDGI-lite Visibility / Depth Moment Spec',
		'',
		`- Status: ${ ddgiVisibilityDepthSpec.status }`,
		`- Scope: ${ ddgiVisibilityDepthSpec.scope }`,
		'',
		'### Data contract',
		`- Target: ${ ddgiVisibilityDepthSpec.dataContract.target }`,
		`- Layout: ${ ddgiVisibilityDepthSpec.dataContract.layout }`,
		`- Resolution: ${ ddgiVisibilityDepthSpec.dataContract.resolution }`,
		`- Format: ${ ddgiVisibilityDepthSpec.dataContract.format }`,
		`- Channels: R=${ ddgiVisibilityDepthSpec.dataContract.channels.r }; G=${ ddgiVisibilityDepthSpec.dataContract.channels.g }; B=${ ddgiVisibilityDepthSpec.dataContract.channels.b }; A=${ ddgiVisibilityDepthSpec.dataContract.channels.a }`,
		'',
		'### Bake',
		...ddgiVisibilityDepthSpec.bake.map( item => `- ${ item }` ),
		'',
		'### Runtime',
		...ddgiVisibilityDepthSpec.runtime.map( item => `- ${ item }` ),
		'',
		'### Non-goals',
		...ddgiVisibilityDepthSpec.nonGoals.map( item => `- ${ item }` ),
		'',
		'### Acceptance',
		...ddgiVisibilityDepthSpec.acceptance.map( item => `- ${ item }` )
	);


}
