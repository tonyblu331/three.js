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

const createLeakProofArtifact = leakProofFacts => ( {
	fixtureMode: leakProofFacts.fixtureMode,
	proofSettings: leakProofFacts.proofSettings,
	sampling: {
		weightedProbeSampling: leakProofFacts.sampling.weightedProbeSampling,
		probeValidityMode: leakProofFacts.sampling.probeValidityMode
	},
	rows: leakProofFacts.rows.map( row => ( {
		label: row.label,
		guardedVisibilityProofMode: row.guardedVisibilityProofMode,
		wrongSideColorRatio: row.wrongSideColorRatio,
		maskedWrongSideColorRatio: row.maskedWrongSideColorRatio,
		correctBounceRatio: row.correctBounceRatio,
		preToneMaskedWrongSideColorRatio: row.preToneMaskedWrongSideColorRatio,
		preToneMaskedCorrectBounceRatio: row.preToneMaskedCorrectBounceRatio
	} ) )
} );

const validateLeakProofArtifact = ( file, artifact ) => {

	const rows = Array.isArray( artifact.rows ) ? artifact.rows : [];
	const rowLabels = new Set( rows.map( row => row.label ) );
	const baseline = rows.find( row => row.label === 'sealed-wall-validity-weighted' );
	const candidate = rows.find( row => row.label === 'sealed-wall-visibility-moments' );
	const proofSettings = artifact.proofSettings || {};
	const sampling = artifact.sampling || {};
	const samplingKeys = Object.keys( sampling );

	assertLightProbeProof( file,
		artifact.fixtureMode === 'sealed-wall' &&
		Array.isArray( artifact.rows ) &&
		rows.length === 2 &&
		proofSettings.resolution === 4 &&
		proofSettings.cubemapSize === 8 &&
		proofSettings.band1Intensity === 1 &&
		proofSettings.band2Intensity === 0.55 &&
		proofSettings.normalBias === 0.5 &&
		proofSettings.viewBias === 0 &&
		proofSettings.lightingMode === 'probes only' &&
		proofSettings.materialType === 'standard' &&
		samplingKeys.length === 2 &&
		sampling.weightedProbeSampling === true &&
		sampling.probeValidityMode === 'custom' &&
		rowLabels.has( 'sealed-wall-validity-weighted' ) &&
		rowLabels.has( 'sealed-wall-visibility-moments' ),
		'leak proof artifact: expected compact sealed-wall baseline and visibility-moment rows.' );

	assertLightProbeProof( file,
		baseline.guardedVisibilityProofMode === 'off' &&
		candidate.guardedVisibilityProofMode === 'guarded',
		'leak proof artifact: expected scalar-validity baseline and guarded visibility-moment candidate rows.' );

	for ( const row of rows ) {

		assertLightProbeProof( file,
			Number.isFinite( row.wrongSideColorRatio ) &&
			Number.isFinite( row.maskedWrongSideColorRatio ) &&
			Number.isFinite( row.correctBounceRatio ) &&
			Number.isFinite( row.preToneMaskedWrongSideColorRatio ) &&
			Number.isFinite( row.preToneMaskedCorrectBounceRatio ),
			`leak proof artifact ${ row.label }: expected finite raw leak and bounce metrics.` );

	}

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
	const leakProofArtifact = createLeakProofArtifact( getSmokeResult( smokeResults, 'leak proof facts' ).leakProofFacts );

	assertLightProbeProofSummary( proofSummary, ( condition, message ) => assertLightProbeProof( file, condition, message ) );
	validateLeakProofArtifact( file, leakProofArtifact );

	const summaryPath = path.join( lightProbeParityArtifactDir, 'proof-summary.json' );
	const leakProofPath = path.join( lightProbeParityArtifactDir, 'leak-proof-facts.json' );

	await fs.writeFile( summaryPath, `${ JSON.stringify( proofSummary ) }\n` );
	await fs.writeFile( leakProofPath, `${ JSON.stringify( leakProofArtifact ) }\n` );

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
