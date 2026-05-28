export function isMomentBackedVisibility( info ) {

	return !! info &&
		info.available === true &&
		info.mode === 'moments' &&
		info.texture !== null &&
		info.bytes > 0 &&
		info.stats &&
		info.stats.finiteSampleCount > 0 &&
		info.stats.hitSampleCount > 0;

}

export function deriveVisibilityProofStatus( info, rawEvidenceStatus = 'OPEN' ) {

	const momentBacked = isMomentBackedVisibility( info );
	const rawOpen = rawEvidenceStatus === 'OPEN' || String( rawEvidenceStatus ).startsWith( 'OPEN' );

	return {
		momentBacked,
		visibilityLabel: momentBacked ? 'visibility-moments' : 'visibility-scaffold-disabled',
		visibilityStatus: momentBacked && rawOpen === false ? 'SUPPORTED' : 'OPEN',
		ddgiStatus: momentBacked && rawOpen === false ?
			'IMPLEMENTED-PRIVATE-DDGI-LITE-MOMENTS' :
			'OPEN-VISIBILITY-MOMENTS-SCAFFOLD-DISABLED'
	};

}
