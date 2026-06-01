import { Image } from './image.js';
import { createLightProbeImageArtifactPressure, captureLightProbeImageRegions } from './lightprobegrid-gpu-image-metrics.js';
import { assertLightProbeProofSummary } from './lightprobegrid-gpu-proof-gates.js';
import {
	assertLightProbeProof,
	validateLightProbeParitySnapshot,
	validateLightProbeParitySnapshots,
	validateLightProbeWebGLReference
} from './lightprobegrid-gpu-proof-validation.js';
import {
	lightProbeParityArtifactDir,
	lightProbeParitySnapshotLabels,
	lightProbeWebGLReferenceLabel
} from './lightprobegrid-gpu-smoke-config.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const getSmokeResult = ( smokeResults, step ) => {

	const result = smokeResults.find( row => row.step === step );
	if ( result === undefined ) throw new Error( `Missing smoke result step: ${ step }` );
	return result;

};

export async function writeLightProbeGroundingParityArtifacts( page, file, smokeHarness, smokeResults, options = {} ) {

	if ( file !== 'webgpu_lightprobes_cornell' ) return;

	await fs.rm( lightProbeParityArtifactDir, { recursive: true, force: true } );
	await fs.mkdir( lightProbeParityArtifactDir, { recursive: true } );

	const snapshots = [];
	let restored;

	try {

		for ( const label of lightProbeParitySnapshotLabels ) {

			const snapshot = await page.evaluate(
				async ( globalName, label ) => await window[ globalName ].applyGroundingParitySnapshot( label ),
				smokeHarness.global,
				label
			);

			validateLightProbeParitySnapshot( file, snapshot );

			const screenshot = path.join( lightProbeParityArtifactDir, `${ label }.png` );
			await page.screenshot( { path: screenshot } );

			snapshots.push( {
				...snapshot,
				screenshot
			} );

		}

	} finally {

		restored = await page.evaluate(
			async globalName => await window[ globalName ].restoreGroundingParitySnapshot(),
			smokeHarness.global
		);

	}

	validateLightProbeParitySnapshots( file, snapshots );
	assertLightProbeProof( file, restored.status === 'ready' &&
		restored.hasTexture === true &&
		restored.hasBoundingBox === true,
	'grounding parity artifact: expected ready demo state restoration after screenshot capture.' );

	const webglReference = await captureLightProbeWebGLReference( page, options );
	validateLightProbeWebGLReference( file, webglReference );

	const proofSummary = getSmokeResult( smokeResults, 'compact proof gates' ).proofSummary;

	assertLightProbeProofSummary( proofSummary, ( condition, message ) => assertLightProbeProof( file, condition, message ) );

	const summaryPath = path.join( lightProbeParityArtifactDir, 'proof-summary.json' );

	await fs.writeFile( summaryPath, `${ JSON.stringify( proofSummary, null, '\t' ) }\n` );

	console.green( `Grounding parity artifacts written: ${ lightProbeParityArtifactDir }` );

}

async function captureLightProbeWebGLReference( page, options = {} ) {

	const { port = 1234, networkTimeout = 5 } = options;
	const webglPage = await page.browser().newPage();
	const viewport = page.viewport();

	try {

		if ( viewport !== null ) await webglPage.setViewport( viewport );

		await webglPage.goto( `http://localhost:${ port }/examples/webgl_lightprobes.html?testHarness`, {
			waitUntil: 'networkidle0',
			timeout: networkTimeout * 60000
		} );

		await webglPage.waitForFunction(
			() => window.__webglLightProbeGridCornell !== undefined,
			{ timeout: networkTimeout * 60000 }
		);

		const metrics = await webglPage.evaluate( async () => {

			const harness = window.__webglLightProbeGridCornell;
			await harness.waitUntilReady();
			return await harness.applyReferenceSnapshot();

		} );

		const screenshot = path.join( lightProbeParityArtifactDir, `${ lightProbeWebGLReferenceLabel }.png` );
		const screenshotBuffer = await webglPage.screenshot( { path: screenshot } );
		const image = await Image.read( screenshotBuffer );
		const regions = captureLightProbeImageRegions( image );

		return {
			label: lightProbeWebGLReferenceLabel,
			proofRole: 'same-class-webgl-reference',
			metrics,
			regions,
			artifactPressure: createLightProbeImageArtifactPressure( regions ),
			screenshot
		};

	} finally {

		await webglPage.close();

	}

}
