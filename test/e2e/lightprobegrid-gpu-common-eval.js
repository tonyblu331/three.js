import { captureLightProbeImageRegions, createLightProbeImageArtifactPressure } from './lightprobegrid-gpu-image-metrics.js';
import { Image } from './image.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export const lightProbeGridGpuCommonEvalDir = path.join( os.tmpdir(), 'codex-threejs-lightprobegrid-common-eval' );
const lightProbeGridGpuCornellParityDir = path.join( os.tmpdir(), 'codex-threejs-lightprobes-parity' );
const logLightProbeGridGpuEval = message => {

	const write = typeof console.green === 'function' ? console.green : console.log;
	write.call( console, message );

};

const getProbeCount = ( metrics ) => {

	if ( metrics === null || metrics === undefined ) return null;
	if ( Number.isFinite( metrics.probeCount ) ) return metrics.probeCount;
	if ( Array.isArray( metrics.resolution ) && metrics.resolution.length === 3 ) {

		const [ x, y, z ] = metrics.resolution;
		return Number.isFinite( x ) && Number.isFinite( y ) && Number.isFinite( z ) ? x * y * z : null;

	}

	return Number.isFinite( metrics.resolution ) ? metrics.resolution ** 3 : null;

};

const roundLeakRatio = value => Number( value.toFixed( 4 ) );

const createCornellImageLeakRatios = ( regions ) => {

	const leftWall = regions?.leftWall;
	const rightWall = regions?.rightWall;

	if ( leftWall === undefined || rightWall === undefined ) return null;

	const wrongSideColorRatio = Math.max(
		leftWall.colorBias.greenOverRed,
		rightWall.colorBias.redOverGreen
	);
	const correctBounceRatio = Math.min(
		leftWall.colorBias.redOverGreen,
		rightWall.colorBias.greenOverRed
	);

	return {
		wrongSideColorRatio: roundLeakRatio( wrongSideColorRatio ),
		maskedWrongSideColorRatio: roundLeakRatio( wrongSideColorRatio ),
		correctBounceRatio: roundLeakRatio( correctBounceRatio ),
		preToneMaskedWrongSideColorRatio: roundLeakRatio( wrongSideColorRatio ),
		preToneMaskedCorrectBounceRatio: roundLeakRatio( correctBounceRatio ),
		residualLeakRatio: null
	};

};

const createCommonEvalRows = ( file, smokeHarness, smokeResults, image ) => {

	const regionSet = smokeHarness.imageRegionSet ?? 'cornell';
	const regions = captureLightProbeImageRegions( image, regionSet );
	const artifactPressure = createLightProbeImageArtifactPressure( regions );
	const initial = smokeResults.find( row => row.step === 'initial' );
	const rebake = smokeResults.find( row => row.step === 'rebake' );
	const leakProofFacts = smokeResults.find( row => row.step === 'sealed-wall leak proof' )?.leakProofFacts ?? null;

	return {
		file,
		implementation: smokeHarness.implementation,
		capabilities: smokeHarness.capabilities ?? [],
		runtime: {
			initial: initial?.metrics ?? null,
			rebake: rebake?.metrics ?? null
		},
		image: {
			regionSet,
			artifactPressure,
			regions
		},
		leakProof: leakProofFacts
	};

};

export async function writeLightProbeGridGpuCommonEvalArtifact( file, smokeHarness, smokeResults, image ) {

	if ( smokeHarness === undefined || smokeResults === null ) return;

	await fs.mkdir( lightProbeGridGpuCommonEvalDir, { recursive: true } );

	const artifact = createCommonEvalRows( file, smokeHarness, smokeResults, image );
	const artifactPath = path.join( lightProbeGridGpuCommonEvalDir, `${ file }.json` );

	await fs.writeFile( artifactPath, `${ JSON.stringify( artifact, null, 2 ) }\n` );
	logLightProbeGridGpuEval( `LightProbeGridGPU common eval artifact written: ${ artifactPath }` );
	await writeLightProbeGridGpuComparisonArtifact();

}

async function pathExists( file ) {

	try {

		await fs.access( file );
		return true;

	} catch {

		return false;

	}

}

async function readJsonIfExists( file ) {

	if ( await pathExists( file ) === false ) return null;

	return JSON.parse( await fs.readFile( file, 'utf8' ) );

}

async function readCommonEvalArtifacts() {

	if ( await pathExists( lightProbeGridGpuCommonEvalDir ) === false ) return [];

	const entries = await fs.readdir( lightProbeGridGpuCommonEvalDir );
	const artifacts = [];

	for ( const entry of entries ) {

		if ( entry.endsWith( '.json' ) === false || entry === 'comparison.json' ) continue;

		const artifact = await readJsonIfExists( path.join( lightProbeGridGpuCommonEvalDir, entry ) );
		if ( artifact !== null ) artifacts.push( artifact );

	}

	return artifacts;

}

async function readCornellParityArtifact() {

	const leakProof = await readJsonIfExists( path.join( lightProbeGridGpuCornellParityDir, 'leak-proof-facts.json' ) );
	const proofSummary = await readJsonIfExists( path.join( lightProbeGridGpuCornellParityDir, 'proof-summary.json' ) );
	const imagePath = path.join( lightProbeGridGpuCornellParityDir, 'webgpu-webgl-density-damped.png' );

	if ( leakProof === null || proofSummary === null || await pathExists( imagePath ) === false ) return null;

	const image = await Image.read( imagePath );
	const regions = captureLightProbeImageRegions( image, 'cornell' );

	return {
		file: 'webgpu_lightprobes_cornell',
		implementation: 'dev-cornell-proof',
		capabilities: [ 'runtime', 'image-luma', 'sealed-wall-leak' ],
		runtime: {
			initial: {
				status: proofSummary.status,
				supported: proofSummary.supported,
				open: proofSummary.open
			},
			rebake: null
		},
		image: {
			regionSet: 'cornell',
			artifactPressure: createLightProbeImageArtifactPressure( regions ),
			regions
		},
		leakProof
	};

}

function createComparisonRows( artifacts ) {

	const rows = [];

	for ( const artifact of artifacts ) {

		const pressure = artifact.image?.artifactPressure ?? {};
		const leakRows = artifact.leakProof?.rows ?? [];
		const candidateLeakRow = leakRows.find( row => row.label === 'sealed-wall-visibility-moments' ) ?? null;
		const baselineLeakRow = leakRows.find( row => row.label === 'sealed-wall-validity-weighted' ) ?? null;
		const leakMetricTested = baselineLeakRow !== null || candidateLeakRow !== null;
		const leakMetricEligible = artifact.image?.regionSet === 'cornell';
		const leakMetricComparable = leakMetricEligible === true && baselineLeakRow !== null && candidateLeakRow !== null;
		const leakMetricStatus = leakMetricTested === true ? 'tested' : leakMetricEligible === true ? 'missing-required' : 'not-applicable';
		const leakMetricReason = leakMetricTested === true ? null : leakMetricEligible === true ?
			'sealed-wall fixture did not expose leak proof rows' :
			'not a sealed-wall Cornell fixture';
		const imageLeakRatios = leakMetricTested === false && leakMetricEligible === true ?
			createCornellImageLeakRatios( artifact.image?.regions ) :
			null;
		const commonRow = {
			file: artifact.file,
			regionSet: artifact.image?.regionSet ?? null,
			status: artifact.runtime?.initial?.status ?? null,
			probeCount: getProbeCount( artifact.runtime?.initial ),
			leakMetricStatus,
			leakMetricTested,
			leakMetricEligible,
			leakMetricComparable,
			leakMetricReason,
			darkTailRatio: pressure.darkTailRatio ?? null,
			blackTailRatio: pressure.blackTailRatio ?? null,
			luminanceFloor: pressure.luminanceFloor ?? null,
			cellEdgeContrast: pressure.cellEdgeContrast ?? null
		};

		if ( baselineLeakRow === null && candidateLeakRow === null ) {

			rows.push( {
				implementation: artifact.implementation,
				evalRole: 'implementation',
				...commonRow,
				leakMetricSource: imageLeakRatios === null ? null : 'cornell-image-proxy',
				wrongSideColorRatio: imageLeakRatios?.wrongSideColorRatio ?? null,
				maskedWrongSideColorRatio: imageLeakRatios?.maskedWrongSideColorRatio ?? null,
				correctBounceRatio: imageLeakRatios?.correctBounceRatio ?? null,
				preToneMaskedWrongSideColorRatio: imageLeakRatios?.preToneMaskedWrongSideColorRatio ?? null,
				preToneMaskedCorrectBounceRatio: imageLeakRatios?.preToneMaskedCorrectBounceRatio ?? null,
				residualLeakRatio: imageLeakRatios?.residualLeakRatio ?? null
			} );

			continue;

		}

		for ( const [ evalRole, row ] of [
			[ 'baseline', baselineLeakRow ],
			[ 'candidate', candidateLeakRow ]
		] ) {

			rows.push( {
				implementation: `${ artifact.implementation }/${ row.label }`,
				evalRole,
				...commonRow,
				leakMetricSource: 'sealed-wall-proof',
				wrongSideColorRatio: row.wrongSideColorRatio,
				maskedWrongSideColorRatio: row.maskedWrongSideColorRatio,
				correctBounceRatio: row.correctBounceRatio,
				preToneMaskedWrongSideColorRatio: row.preToneMaskedWrongSideColorRatio,
				preToneMaskedCorrectBounceRatio: row.preToneMaskedCorrectBounceRatio,
				residualLeakRatio: evalRole === 'candidate' ? artifact.leakProof?.residualAttribution?.preToneMaskedResidualRatio ?? null : null
			} );

		}

	}

	return rows;

}

export async function writeLightProbeGridGpuComparisonArtifact() {

	const artifacts = await readCommonEvalArtifacts();
	const cornellArtifact = await readCornellParityArtifact();
	const hasCurrentCornellArtifact = artifacts.some( artifact => artifact.file === 'webgpu_lightprobes_cornell' );

	if ( cornellArtifact !== null && hasCurrentCornellArtifact === false ) artifacts.push( cornellArtifact );
	if ( artifacts.length === 0 ) return;

	const comparison = {
		rows: createComparisonRows( artifacts )
	};
	const comparisonPath = path.join( lightProbeGridGpuCommonEvalDir, 'comparison.json' );

	await fs.writeFile( comparisonPath, `${ JSON.stringify( comparison, null, 2 ) }\n` );
	logLightProbeGridGpuEval( `LightProbeGridGPU comparison eval artifact written: ${ comparisonPath }` );

}
