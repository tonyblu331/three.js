export async function runLightProbeGridGpuVisibilityNormalAssertions( context ) {

	const { call, assert, results } = context;

	const sealedReceiverNormalDiagnostic = await call( 'inspectLeakReceiverNormalConvention', 'sealed-wall' );
	assert( [ 'SUPPORTED-CPU-NORMAL-MATCHES-FRONT-FACE-SHADER', 'OPEN-NORMAL-CONVENTION-MISMATCH' ].includes( sealedReceiverNormalDiagnostic.status ) &&
		sealedReceiverNormalDiagnostic.fixtureMode === 'sealed-wall' &&
		sealedReceiverNormalDiagnostic.proofBoundary.includes( 'normal convention diagnostic' ),
	'sealed receiver normal diagnostic: expected explicit proof-only normal convention status.' );
	assert( Array.isArray( sealedReceiverNormalDiagnostic.receivers ) &&
		sealedReceiverNormalDiagnostic.receivers.length === 2 &&
		sealedReceiverNormalDiagnostic.receivers.every( receiver =>
			Number.isFinite( receiver.cpuNormal.x ) &&
			Number.isFinite( receiver.cpuNormal.y ) &&
			Number.isFinite( receiver.cpuNormal.z ) &&
			Number.isFinite( receiver.invertedCpuNormal.x ) &&
			Number.isFinite( receiver.cameraDotCpuNormal ) &&
			typeof receiver.expectedVisibleFaceFromCpuNormal === 'string' &&
			typeof receiver.actualRenderedSide === 'string' &&
			receiver.surfaceRegion !== null ),
	'sealed receiver normal diagnostic: expected CPU normal, inverted normal, and rendered side fields.' );
	assert( Array.isArray( sealedReceiverNormalDiagnostic.shaderNormalSamples ) &&
		sealedReceiverNormalDiagnostic.shaderNormalSamples.length === 3 &&
		sealedReceiverNormalDiagnostic.shaderNormalSamples.every( sample =>
			typeof sample.materialSide === 'string' &&
			typeof sample.leftReceiverSurface.visible === 'boolean' &&
			typeof sample.rightReceiverSurface.visible === 'boolean' &&
			typeof sample.leftReceiverSurface.closestNormalConvention === 'string' &&
			Number.isFinite( sample.leftReceiverSurface.cpuColorDistance ) &&
			Number.isFinite( sample.rightReceiverSurface.invertedColorDistance ) ),
	'sealed receiver normal diagnostic: expected shader normalWorld front/back/double-side samples.' );
	assert( typeof sealedReceiverNormalDiagnostic.summary.frontFaceAgreement === 'boolean' &&
		typeof sealedReceiverNormalDiagnostic.summary.shaderNormalAgreement === 'boolean' &&
		typeof sealedReceiverNormalDiagnostic.summary.diagnosticConclusion === 'string',
	'sealed receiver normal diagnostic: expected summary agreement fields.' );
	results.push( { step: 'sealed receiver normal convention diagnostic', sealedReceiverNormalDiagnostic } );

}
