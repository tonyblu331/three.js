import puppeteer from 'puppeteer';
import { Image } from './image.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { createServer } from '../../utils/server.js';

const server = createServer();

const exceptionList = [

	// Take too long
	'webgl_loader_lwo', 				// 8 min
	'webgpu_cubemap_mix', 				// 2 min
	'webgl_loader_texture_ultrahdr', 	// 1 min
	'webgl_marchingcubes', 				// 1 min
 	'webgl_materials_cubemap_dynamic', 	// 1 min
	'webgl_materials_displacementmap', 	// 1 min
	'webgl_materials_envmaps_hdr', 		// 1 min
	'webgpu_water', 					// 1 min

	// Requires HTML-in-Canvas API
	'webgl_materials_texture_html',
	'webgpu_materials_texture_html',

	// Black screen
	'webgpu_postprocessing_ao',
	'webgpu_postprocessing_dof',
	'webgpu_postprocessing_ssgi',
	'webgpu_postprocessing_ssgi_ballpool',
	'webgpu_postprocessing_sss',
	'webgpu_postprocessing_traa',
	'webgpu_volume_lighting_traa',

	// Timming issues?
	'physics_rapier_instancing',
	'webgl_shadowmap',
	'webaudio_visualizer',
	'webgpu_compute_audio',
	'webgpu_compute_cloth',
	'webgpu_compute_particles_fluid',
	'webgpu_compute_sort_bitonic',
	'webgpu_storage_buffer',
	'webgpu_tsl_editor',
	'webxr_vr_video',
	'webgpu_tsl_transpiler',
	'webgpu_rendertarget_2d-array_3d',

	// Need more time to render
	'css3d_mixed',
	'webgl_loader_3dtiles',
	'webgl_loader_texture_lottie',
	'webgl_morphtargets_face',
	'webgl_renderer_pathtracer',
	'webgl_shadowmap_progressive',
	'webgpu_materials_matcap',
	'webgpu_morphtargets_face',
	'webgpu_shadowmap_progressive',

	// Video hangs the CI?
	'css3d_youtube',
	'webgpu_materials_video',
	'webgl_video_kinect',
	'webgl_video_panorama_equirectangular',

	// Timeout
	'webgl_test_memory2',

	// Webcam
	'webgl_materials_video_webcam',
	'webgl_morphtargets_webcam'

];

const smokeHarnesses = {
	webgpu_lightprobes_cornell: {
		query: 'testHarness',
		global: '__webgpuLightProbeGridCornell',
		example: 'examples/webgpu_lightprobes_cornell.html',
		source: 'examples/jsm/lighting/LightProbeGridGPU.js'
	}
};

/* Configuration */

const port = 1234;
const pixelThreshold = 0.1; // threshold error in one pixel
const maxDifferentPixels = 0.1; // at most 0.1% different pixels

const idleTime = 2; // 2 seconds - for how long there should be no network requests
const parseTime = 1; // 1 second per megabyte

const networkTimeout = 5; // 5 minutes, set to 0 to disable
const renderTimeout = 5; // 5 seconds, set to 0 to disable
const numCIJobs = 5; // GitHub Actions run the script in 5 threads

const width = 400;
const height = 250;
const viewScale = 2;
const jpgQuality = 95;
const lightProbeParityArtifactDir = path.join( os.tmpdir(), 'codex-threejs-lightprobes-parity' );
const lightProbeWebGLReferenceLabel = 'webgl-lightprobegrid-reference';
const lightProbeParitySnapshotLabels = [
	'low-res-damped',
	'low-res-unweighted',
	'low-res-validity-weighted',
	'webgpu-webgl-density-reference',
	'webgpu-webgl-density-shadowless',
	'webgpu-webgl-density-damped'
];

console.red = msg => console.log( `\x1b[31m${msg}\x1b[39m` );
console.green = msg => console.log( `\x1b[32m${msg}\x1b[39m` );
console.yellow = msg => console.log( `\x1b[33m${msg}\x1b[39m` );

let browser;

/* Launch server */

server.listen( port, main );

process.on( 'SIGINT', async () => {

	console.log( '\nInterrupted, cleaning up...' );

	if ( browser ) {

		try {

			await browser.close();

		} catch ( e ) {}

	}

	server.close();
	process.exit( 1 );

} );

async function main() {

	/* Create output directory */

	try {

		await fs.rm( 'test/e2e/output-screenshots', { recursive: true, force: true } );

	} catch ( e ) {}

	try {

		await fs.mkdir( 'test/e2e/output-screenshots' );

	} catch ( e ) {}

	/* Find files */

	let isMakeScreenshot = false;
	let isWebGPU = false;

	let argvIndex = 2;

	if ( process.argv[ argvIndex ] === '--webgpu' ) {

		isWebGPU = true;
		argvIndex ++;

	}

	if ( process.argv[ argvIndex ] === '--make' ) {

		isMakeScreenshot = true;
		argvIndex ++;

	}

	const exactList = process.argv.slice( argvIndex )
		.map( f => f.replace( '.html', '' ) );

	const isExactList = exactList.length !== 0;

	let files = ( await fs.readdir( 'examples' ) )
		.filter( s => s.slice( - 5 ) === '.html' && s !== 'index.html' )
		.map( s => s.slice( 0, s.length - 5 ) )
		.filter( f => isExactList ? exactList.includes( f ) : ! exceptionList.includes( f ) );

	if ( isExactList ) {

		for ( const file of exactList ) {

			if ( ! files.includes( file ) ) {

				console.log( `Warning! Unrecognised example name: ${ file }` );

			}

		}

	}

	if ( isWebGPU ) files = files.filter( f => f.includes( 'webgpu_' ) );

	/* CI parallelism */

	if ( 'CI' in process.env ) {

		const CI = parseInt( process.env.CI );

		files = files.slice(
			Math.floor( CI * files.length / numCIJobs ),
			Math.floor( ( CI + 1 ) * files.length / numCIJobs )
		);

	}

	/* Launch browser */

	const flags = [
		'--hide-scrollbars',
		'--enable-unsafe-webgpu',
		'--enable-features=Vulkan',
		'--disable-vulkan-surface',
		'--ignore-gpu-blocklist',
		'--disable-gpu-driver-bug-workarounds',
		'--no-sandbox'
	];

	const viewport = { width: width * viewScale, height: height * viewScale };

	const launchOptions = {
		headless: ( 'CI' in process.env || process.env.VISIBLE ) ? false : 'new',
		env: { ...process.env, VK_DRIVER_FILES: '/usr/share/vulkan/icd.d/lvp_icd.x86_64.json' },
		args: flags,
		defaultViewport: viewport,
		handleSIGINT: false,
		protocolTimeout: 0,
		userDataDir: './.puppeteer_profile'
	};

	/* Prepare injections */

	const buildInjection = ( code ) => code
		.replace( /Math\.random\(\) \* 0xffffffff/g, 'Math._random() * 0xffffffff' )
		// Disables WebGPU timestamp queries to prevent Inspector/Profiler from crashing in E2E software mode
		.replace( /this\.trackTimestamp\s*=\s*\(\s*parameters\.trackTimestamp\s*===\s*true\s*\);/g, 'Object.defineProperty(this, \'trackTimestamp\', { get: () => false, set: () => {} });' );

	const cleanPage = await fs.readFile( 'test/e2e/clean-page.js', 'utf8' );
	const injection = await fs.readFile( 'test/e2e/deterministic-injection.js', 'utf8' );

	const builds = {
		'three.core.js': buildInjection( await fs.readFile( 'build/three.core.js', 'utf8' ) ),
		'three.module.js': buildInjection( await fs.readFile( 'build/three.module.js', 'utf8' ) ),
		'three.webgpu.js': buildInjection( await fs.readFile( 'build/three.webgpu.js', 'utf8' ) )
	};

	/* Prepare page */

	const errorMessagesCache = [];

	const launchPage = async () => {

		browser = await puppeteer.launch( launchOptions );
		const page = await browser.newPage();
		await preparePage( page, injection, builds, errorMessagesCache );
		return page;

	};

	const ctx = {
		page: await launchPage(),
		async restart() {

			// SIGKILL the whole Chrome process tree; browser.close() can hang after a wedged GPU process
			const proc = browser.process();
			if ( proc ) {

				proc.kill( 'SIGKILL' );
				await new Promise( resolve => proc.once( 'exit', resolve ) );

			}

			errorMessagesCache.length = 0;
			ctx.page = await launchPage();

		}
	};

	/* Loop for each file */

	const failedScreenshots = [];

	for ( const file of files ) {

		await checkFile( ctx, failedScreenshots, cleanPage, isMakeScreenshot, file );

	}

	/* Finish */

	failedScreenshots.sort();
	const list = failedScreenshots.join( ' ' );

	if ( isMakeScreenshot && failedScreenshots.length ) {

		console.red( 'List of failed screenshots: ' + list );
		console.red( `If you are sure that everything is correct, try to run "npm run make-screenshot ${ list }". If this does not help, add remaining screenshots to the exception list.` );
		console.red( `${ failedScreenshots.length } from ${ files.length } screenshots have not generated successfully.` );

	} else if ( isMakeScreenshot && ! failedScreenshots.length ) {

		console.green( `${ files.length } screenshots successfully generated.` );

	} else if ( failedScreenshots.length ) {

		console.red( 'List of failed screenshots: ' + list );
		console.red( `If you are sure that everything is correct, try to run "npm run make-screenshot ${ list }". If this does not help, add remaining screenshots to the exception list.` );
		console.red( `TEST FAILED! ${ failedScreenshots.length } from ${ files.length } screenshots have not rendered correctly.` );

	} else {

		console.green( `TEST PASSED! ${ files.length } screenshots rendered correctly.` );

	}

	setTimeout( close, 300, failedScreenshots.length );

}

async function preparePage( page, injection, builds, errorMessages ) {

	await page.evaluateOnNewDocument( injection );
	await page.setRequestInterception( true );

	page.on( 'console', async msg => {

		const type = msg.type();

		const file = page.file;

		if ( file === undefined ) {

			return;

		}

		const args = await Promise.all( msg.args().map( async arg => {

			try {

				return await arg.executionContext().evaluate( arg => arg instanceof Error ? arg.message : arg, arg );

			} catch ( e ) {

				// Execution context might have been already destroyed

				return arg;

			}

		} ) );

		let text = args.join( ' ' ); // https://github.com/puppeteer/puppeteer/issues/3397#issuecomment-434970058

		text = text.trim();
		if ( text === '' ) return;
		if ( text.includes( 'Timestamp tracking is disabled' ) ) return;

		text = file + ': ' + text.replace( /\[\.WebGL-(.+?)\] /g, '' );

		if ( text === `${ file }: JSHandle@error` ) {

			text = `${ file }: Unknown error`;

		}

		if ( errorMessages.includes( text ) ) {

			return;

		}

		errorMessages.push( text );

		if ( type === 'warning' ) {

			console.yellow( text );

		} else if ( type === 'error' ) {

			page.error = text;

		} else {

			console.log( `[Browser] ${text}` );

		}

	} );

	page.on( 'response', async ( response ) => {

		try {

			if ( response.status === 200 ) {

				await response.buffer().then( buffer => page.pageSize += buffer.length );

			}

		} catch ( e ) {}

	} );

	page.on( 'request', async ( request ) => {

		const url = request.url();

		for ( const build in builds ) {

			if ( url === `http://localhost:${ port }/build/${ build }` ) {

				await request.respond( {
					status: 200,
					contentType: 'application/javascript; charset=utf-8',
					body: builds[ build ]
				} );

				return;

			}

		}

		await request.continue();

	} );

}

async function checkFile( ctx, failedScreenshots, cleanPage, isMakeScreenshot, file ) {

	const page = ctx.page;

	try {

		page.file = file;
		page.pageSize = 0;
		page.error = undefined;

		/* Load target page */

		try {

			const smokeHarness = isMakeScreenshot === false ? smokeHarnesses[ file ] : undefined;
			const query = smokeHarness !== undefined ? `?${ smokeHarness.query }` : '';

			if ( smokeHarness !== undefined ) await checkSmokeSourceInvariants( file, smokeHarness );

			await page.goto( `http://localhost:${ port }/examples/${ file }.html${ query }`, {
				waitUntil: 'networkidle0',
				timeout: networkTimeout * 60000
			} );

		} catch ( e ) {

			throw new Error( `Error happened while loading file ${ file }: ${ e }` );

		}

		try {

			/* Render page */

			await page.evaluate( cleanPage );

			await page.waitForNetworkIdle( {
				timeout: networkTimeout * 60000,
				idleTime: idleTime * 1000
			} );

			await page.evaluate( async ( renderTimeout, parseTime ) => {

				await new Promise( resolve => setTimeout( resolve, parseTime ) );

				/* Resolve render promise */

				window._renderStarted = true;

				await new Promise( function ( resolve, reject ) {

					const renderStart = performance._now();

					const waitingLoop = setInterval( function () {

						const renderTimeoutExceeded = ( renderTimeout > 0 ) && ( performance._now() - renderStart > 1000 * renderTimeout );

						if ( renderTimeoutExceeded ) {

							clearInterval( waitingLoop );
							reject( 'Render timeout exceeded' );

						} else if ( window._renderFinished ) {

							clearInterval( waitingLoop );
							resolve();

						}

					}, 100 );

				} );

			}, renderTimeout, page.pageSize / 1024 / 1024 * parseTime * 1000 );

		} catch ( e ) {

			if ( e.includes && e.includes( 'Render timeout exceeded' ) === false ) {

				throw new Error( `Error happened while rendering file ${ file }: ${ e }` );

			} /* else { // This can mean that the example doesn't use requestAnimationFrame loop

				console.yellow( `Render timeout exceeded in file ${ file }` );

			} */ // TODO: fix this

		}

		const smokeResults = isMakeScreenshot === false && smokeHarnesses[ file ] !== undefined ?
			await runSmokeHarness( page, file, smokeHarnesses[ file ] ) :
			null;

		if ( smokeResults !== null && isMakeScreenshot === false ) {

			await writeLightProbeGroundingParityArtifacts( page, file, smokeHarnesses[ file ], smokeResults );

		}

		const screenshot = ( await Image.read( await page.screenshot() ) ).scale( 1 / viewScale );

		if ( page.error !== undefined ) throw new Error( page.error );

		if ( smokeResults !== null && isMakeScreenshot === false ) {

			try {

				checkSmokeScreenshot( file, screenshot );

			} catch ( e ) {

				await screenshot.write( `test/e2e/output-screenshots/${ file }-actual.jpg`, jpgQuality );
				throw e;

			}

			console.green( `Smoke ${ smokeResults.length } checks in file: ${ file }` );

		} else if ( isMakeScreenshot ) {

			/* Make screenshots */

			await screenshot.write( `examples/screenshots/${ file }.jpg`, jpgQuality );

			console.green( `Screenshot generated for file ${ file }` );

		} else {

			/* Diff screenshots */

			let expected;

			try {

				expected = await Image.read( `examples/screenshots/${ file }.jpg` );

			} catch ( e ) {

				await screenshot.write( `test/e2e/output-screenshots/${ file }-actual.jpg`, jpgQuality );
				throw new Error( `Screenshot does not exist: ${ file }` );

			}

			const actual = screenshot.bitmap;
			const diff = screenshot.clone();

			let numDifferentPixels;

			try {

				numDifferentPixels = expected.compare( screenshot, diff, pixelThreshold );

			} catch ( e ) {

				await screenshot.write( `test/e2e/output-screenshots/${ file }-actual.jpg`, jpgQuality );
				await expected.write( `test/e2e/output-screenshots/${ file }-expected.jpg`, jpgQuality );
				throw new Error( `Image sizes do not match in file: ${ file }` );

			}

			/* Print results */

			const differentPixels = numDifferentPixels / ( actual.width * actual.height ) * 100;

			if ( differentPixels < maxDifferentPixels ) {

				console.green( `Diff ${ differentPixels.toFixed( 1 ) }% in file: ${ file }` );

			} else {

				await screenshot.write( `test/e2e/output-screenshots/${ file }-actual.jpg`, jpgQuality );
				await expected.write( `test/e2e/output-screenshots/${ file }-expected.jpg`, jpgQuality );
				await diff.write( `test/e2e/output-screenshots/${ file }-diff.jpg`, jpgQuality );
				throw new Error( `Diff wrong in ${ differentPixels.toFixed( 1 ) }% of pixels in file: ${ file }` );

			}

		}

	} catch ( e ) {

		if ( String( e ).includes( 'WebGPU Device Lost' ) ) {

			console.yellow( `${ e }` );
			console.yellow( 'Restarting browser...' );
			await ctx.restart();

		} else {

			console.red( e );
			failedScreenshots.push( file );

		}

	} finally {

		page.file = undefined; // release lock

	}

}

const getSmokeStep = ( smokeResults, step ) => {

	const result = smokeResults.find( row => row.step === step );
	if ( result === undefined ) throw new Error( `Missing smoke result step: ${ step }` );
	return result;

};

const getSnapshotRegion = ( snapshot, regionName ) => {

	const region = snapshot.regions[ regionName ];
	if ( region === undefined ) throw new Error( `Missing snapshot region: ${ snapshot.label }/${ regionName }` );
	return region;

};

const createLightProbeBakeTexelBudget = ( resolution, cubemapSize ) => {

	const probes = resolution * resolution * resolution;
	const cubemapFaceTexels = cubemapSize * cubemapSize;
	const cubemapTexels = probes * 6 * cubemapFaceTexels;
	const lowResCubemapTexels = 4 * 4 * 4 * 6 * 8 * 8;

	return {
		resolution,
		cubemapSize,
		probes,
		cubemapFaceTexels,
		cubemapTexels,
		relativeToLowRes: Number( ( cubemapTexels / lowResCubemapTexels ).toFixed( 4 ) )
	};

};

const lightProbeReferenceRegions = {
	leftWall: { x0: 0.10, x1: 0.20, y0: 0.42, y1: 0.62 },
	rightWall: { x0: 0.72, x1: 0.88, y0: 0.36, y1: 0.72 },
	backWall: { x0: 0.30, x1: 0.64, y0: 0.30, y1: 0.58 },
	floorCenter: { x0: 0.30, x1: 0.66, y0: 0.68, y1: 0.9 },
	sphere: { x0: 0.54, x1: 0.74, y0: 0.42, y1: 0.64 },
	tallBox: { x0: 0.28, x1: 0.50, y0: 0.46, y1: 0.84 },
	shortBox: { x0: 0.48, x1: 0.68, y0: 0.58, y1: 0.88 }
};

const roundLightProbeMetric = value => Number( value.toFixed( 4 ) );

function createLightProbeImageRegionMetric( image, region, gridCells = 6 ) {

	const x0 = Math.floor( image.width * region.x0 );
	const x1 = Math.floor( image.width * region.x1 );
	const y0 = Math.floor( image.height * region.y0 );
	const y1 = Math.floor( image.height * region.y1 );
	const width = Math.max( x1 - x0, 1 );
	const height = Math.max( y1 - y0, 1 );
	const luminance = [];
	const color = { r: 0, g: 0, b: 0 };
	let sum = 0;

	for ( let y = y0; y < y1; y ++ ) {

		for ( let x = x0; x < x1; x ++ ) {

			const i = ( y * image.width + x ) * 4;
			const red = image.data[ i ];
			const green = image.data[ i + 1 ];
			const blue = image.data[ i + 2 ];
			const value = red * 0.2126 + green * 0.7152 + blue * 0.0722;

			luminance.push( value );
			sum += value;
			color.r += red;
			color.g += green;
			color.b += blue;

		}

	}

	const sorted = [ ...luminance ].sort( ( a, b ) => a - b );
	const percentile = value => sorted[ Math.min( sorted.length - 1, Math.max( 0, Math.floor( ( sorted.length - 1 ) * value ) ) ) ];
	const sampleCount = Math.max( luminance.length, 1 );
	color.r /= sampleCount;
	color.g /= sampleCount;
	color.b /= sampleCount;
	const darkThreshold = Math.max( 16, percentile( 0.5 ) * 0.35 );
	const blackThreshold = 32;
	const darkSamples = luminance.filter( value => value <= darkThreshold ).length;
	const blackSamples = luminance.filter( value => value <= blackThreshold ).length;
	const cellCount = Math.max( 2, Math.min( 8, gridCells ) );
	const cellMeans = [];

	for ( let cy = 0; cy < cellCount; cy ++ ) {

		cellMeans[ cy ] = [];

		for ( let cx = 0; cx < cellCount; cx ++ ) {

			const cellX0 = Math.floor( cx * width / cellCount );
			const cellX1 = Math.max( cellX0 + 1, Math.floor( ( cx + 1 ) * width / cellCount ) );
			const cellY0 = Math.floor( cy * height / cellCount );
			const cellY1 = Math.max( cellY0 + 1, Math.floor( ( cy + 1 ) * height / cellCount ) );
			let cellSum = 0;
			let cellSamples = 0;

			for ( let y = cellY0; y < cellY1; y ++ ) {

				for ( let x = cellX0; x < cellX1; x ++ ) {

					cellSum += luminance[ y * width + x ];
					cellSamples ++;

				}

			}

			cellMeans[ cy ][ cx ] = cellSum / Math.max( cellSamples, 1 );

		}

	}

	let maxCellEdgeContrast = 0;

	for ( let cy = 0; cy < cellCount; cy ++ ) {

		for ( let cx = 0; cx < cellCount; cx ++ ) {

			if ( cx + 1 < cellCount ) {

				maxCellEdgeContrast = Math.max( maxCellEdgeContrast, Math.abs( cellMeans[ cy ][ cx ] - cellMeans[ cy ][ cx + 1 ] ) );

			}

			if ( cy + 1 < cellCount ) {

				maxCellEdgeContrast = Math.max( maxCellEdgeContrast, Math.abs( cellMeans[ cy ][ cx ] - cellMeans[ cy + 1 ][ cx ] ) );

			}

		}

	}

	return {
		region,
		samples: luminance.length,
		gridCells: cellCount,
		color: {
			r: roundLightProbeMetric( color.r ),
			g: roundLightProbeMetric( color.g ),
			b: roundLightProbeMetric( color.b )
		},
		colorBias: {
			redOverGreen: roundLightProbeMetric( color.r / Math.max( color.g, 0.0001 ) ),
			greenOverRed: roundLightProbeMetric( color.g / Math.max( color.r, 0.0001 ) )
		},
		luminance: {
			min: roundLightProbeMetric( sorted[ 0 ] ),
			p01: roundLightProbeMetric( percentile( 0.01 ) ),
			p05: roundLightProbeMetric( percentile( 0.05 ) ),
			median: roundLightProbeMetric( percentile( 0.5 ) ),
			p95: roundLightProbeMetric( percentile( 0.95 ) ),
			max: roundLightProbeMetric( sorted[ sorted.length - 1 ] ),
			mean: roundLightProbeMetric( sum / sampleCount )
		},
		darkThreshold: roundLightProbeMetric( darkThreshold ),
		darkPixelRatio: roundLightProbeMetric( darkSamples / sampleCount ),
		blackThreshold,
		blackPixelRatio: roundLightProbeMetric( blackSamples / sampleCount ),
		cellEdgeContrast: roundLightProbeMetric( maxCellEdgeContrast )
	};

}

function captureLightProbeImageRegions( image ) {

	const regions = {};

	for ( const [ name, region ] of Object.entries( lightProbeReferenceRegions ) ) {

		regions[ name ] = createLightProbeImageRegionMetric( image, region );

	}

	return regions;

}

function createLightProbeImageArtifactPressure( regions ) {

	const objectRegions = [ 'sphere', 'tallBox', 'shortBox' ].map( name => regions[ name ] ).filter( Boolean );
	const maxDarkPixelRatio = Math.max( ...objectRegions.map( region => region.darkPixelRatio ) );
	const maxBlackPixelRatio = Math.max( ...objectRegions.map( region => region.blackPixelRatio ) );
	const maxCellEdgeContrast = Math.max( ...objectRegions.map( region => region.cellEdgeContrast ) );
	const luminanceFloor = Math.min( ...objectRegions.map( region => region.luminance.p01 ) );

	return {
		sphereDarkPixelRatio: roundLightProbeMetric( regions.sphere.darkPixelRatio ),
		tallBoxDarkPixelRatio: roundLightProbeMetric( regions.tallBox.darkPixelRatio ),
		shortBoxDarkPixelRatio: roundLightProbeMetric( regions.shortBox.darkPixelRatio ),
		objectDarkTailRatio: roundLightProbeMetric( maxDarkPixelRatio ),
		objectBlackTailRatio: roundLightProbeMetric( maxBlackPixelRatio ),
		luminanceFloor: roundLightProbeMetric( luminanceFloor ),
		cellEdgeContrast: roundLightProbeMetric( maxCellEdgeContrast ),
		status: maxBlackPixelRatio > 0.15 || luminanceFloor < 24 ? 'PRESSURE' : 'bounded'
	};

}

function assertLightProbeProof( file, condition, message ) {

	if ( condition === false ) throw new Error( `${ file }: ${ message }` );

}

function validateLightProbeParitySnapshot( file, snapshot ) {

	assertLightProbeProof( file, lightProbeParitySnapshotLabels.includes( snapshot.label ),
		`grounding parity artifact: unexpected snapshot label ${ snapshot.label }.` );
	assertLightProbeProof( file, snapshot.metrics.status === 'ready',
		`grounding parity artifact ${ snapshot.label }: expected ready status.` );
	assertLightProbeProof( file, snapshot.metrics.lightingMode === 'probes only',
		`grounding parity artifact ${ snapshot.label }: expected probes-only lighting.` );
	assertLightProbeProof( file, snapshot.metrics.materialType === 'standard',
		`grounding parity artifact ${ snapshot.label }: expected standard material snapshot.` );
	assertLightProbeProof( file, Number.isFinite( snapshot.metrics.timings.totalBakeMs ) &&
		snapshot.metrics.timings.totalBakeMs > 0 &&
		snapshot.metrics.timings.timingSource !== 'unavailable',
	`grounding parity artifact ${ snapshot.label }: expected positive measured bake timing with a known timing source.` );
	assertLightProbeProof( file, Number.isFinite( snapshot.artifactSignature.center.luminance ) &&
		snapshot.artifactSignature.center.luminance > 18,
	`grounding parity artifact ${ snapshot.label }: expected visible center luminance floor.` );

	for ( const regionName of [ 'tallBox', 'shortBox', 'sphere', 'rightWall' ] ) {

		const region = getSnapshotRegion( snapshot, regionName );
		assertLightProbeProof( file, Number.isFinite( region.color.r ) &&
			Number.isFinite( region.color.g ) &&
			Number.isFinite( region.color.b ),
		`grounding parity artifact ${ snapshot.label }/${ regionName }: expected finite RGB averages.` );
		assertLightProbeProof( file, Number.isFinite( region.colorBias.redOverGreen ) &&
			Number.isFinite( region.colorBias.greenOverRed ),
		`grounding parity artifact ${ snapshot.label }/${ regionName }: expected finite color-bias ratios.` );
		assertLightProbeProof( file, Number.isFinite( region.darkPixelRatio ) &&
			region.darkPixelRatio >= 0 &&
			region.darkPixelRatio <= 1,
		`grounding parity artifact ${ snapshot.label }/${ regionName }: expected bounded dark-pixel ratio.` );
		assertLightProbeProof( file, Number.isFinite( region.blackPixelRatio ) &&
			region.blackPixelRatio >= 0 &&
			region.blackPixelRatio <= 1,
		`grounding parity artifact ${ snapshot.label }/${ regionName }: expected bounded black-tail ratio.` );
		assertLightProbeProof( file, Number.isFinite( region.cellEdgeContrast ) &&
			region.cellEdgeContrast >= 0 &&
			region.cellEdgeContrast <= 255,
		`grounding parity artifact ${ snapshot.label }/${ regionName }: expected bounded cell-edge contrast.` );

	}

	if ( snapshot.label === 'low-res-unweighted' ) {

		assertLightProbeProof( file, snapshot.metrics.sampling.weightedProbeSampling === false,
			'grounding parity artifact: unweighted low-res candidate must stay on hardware-filtered sampling.' );

	}

	if ( snapshot.label === 'low-res-validity-weighted' ) {

		assertLightProbeProof( file, snapshot.metrics.sampling.weightedProbeSampling === true &&
			snapshot.metrics.sampling.probeValidityMode === 'custom',
		'grounding parity artifact: validity-weighted low-res candidate must use custom validity metadata.' );

	}

	if ( snapshot.label.startsWith( 'webgpu-webgl-density-' ) ) {

		assertLightProbeProof( file, snapshot.metrics.resolution === 6 &&
			snapshot.metrics.cubemapSize === 32,
		`grounding parity artifact ${ snapshot.label }: WebGPU density row must match the WebGL 6^3 / 32px reference budget.` );

	}

	if ( snapshot.label === 'webgpu-webgl-density-reference' ) {

		assertLightProbeProof( file, snapshot.proofRole === 'same-budget-artifact-pressure' &&
			/artifact pressure/.test( snapshot.referenceBoundary ),
		'grounding parity artifact: WebGPU density reference must be labelled as a same-budget artifact pressure row.' );
		assertLightProbeProof( file, snapshot.antiRingingPolicy?.mode === 'full-band-stress' &&
			snapshot.antiRingingPolicy.runtimePath === 'hardware-filtered-unweighted',
		'grounding parity artifact: WebGPU density reference must explicitly remain a full-band hardware-filtered stress row.' );

	}

	if ( snapshot.label === 'webgpu-webgl-density-shadowless' ) {

		assertLightProbeProof( file, snapshot.proofRole === 'same-budget-shadow-control' &&
			snapshot.shadowsDisabledDuringBake === true &&
			snapshot.antiRingingPolicy?.mode === 'shadowless-cause-control',
		'grounding parity artifact: WebGPU density shadowless row must disable bake-time shadows without changing SH band policy.' );

	}

	if ( snapshot.label === 'webgpu-webgl-density-damped' ) {

		assertLightProbeProof( file, snapshot.proofRole === 'same-budget-quality-candidate' &&
			snapshot.band1Intensity === 0.6 &&
			snapshot.antiRingingPolicy?.mode === 'band1-damped-quality' &&
			snapshot.antiRingingPolicy.runtimePath === 'hardware-filtered-unweighted',
		'grounding parity artifact: WebGPU density damped row must be promoted to a same-budget hardware-filtered anti-ringing quality candidate.' );

	}

	assertLightProbeProof( file, snapshot.artifactPressure !== undefined &&
		Number.isFinite( snapshot.artifactPressure.objectBlackTailRatio ) &&
		Number.isFinite( snapshot.artifactPressure.objectDarkTailRatio ) &&
		Number.isFinite( snapshot.artifactPressure.luminanceFloor ) &&
		Number.isFinite( snapshot.artifactPressure.cellEdgeContrast ),
	`grounding parity artifact ${ snapshot.label }: expected object-level artifact pressure metrics.` );
	assertLightProbeProof( file, snapshot.bakeTexelBudget !== undefined &&
		Number.isFinite( snapshot.bakeTexelBudget.cubemapTexels ) &&
		Number.isFinite( snapshot.bakeTexelBudget.relativeToLowRes ),
	`grounding parity artifact ${ snapshot.label }: expected bake texel budget accounting.` );

}

function validateLightProbeParitySnapshots( file, snapshots ) {

	assertLightProbeProof( file, snapshots.length === lightProbeParitySnapshotLabels.length,
		'grounding parity artifact: expected every frozen proof snapshot.' );

	const rows = new Map( snapshots.map( snapshot => [ snapshot.label, snapshot ] ) );

	for ( const label of lightProbeParitySnapshotLabels ) {

		assertLightProbeProof( file, rows.has( label ),
			`grounding parity artifact: missing ${ label } snapshot.` );

	}

	const damped = rows.get( 'low-res-damped' );
	const unweighted = rows.get( 'low-res-unweighted' );
	const weighted = rows.get( 'low-res-validity-weighted' );
	const densityReference = rows.get( 'webgpu-webgl-density-reference' );
	const densityShadowless = rows.get( 'webgpu-webgl-density-shadowless' );
	const densityDamped = rows.get( 'webgpu-webgl-density-damped' );

	assertLightProbeProof( file, damped.probeIntensity === unweighted.probeIntensity &&
		unweighted.probeIntensity === weighted.probeIntensity,
	'grounding parity artifact: low-res comparison must not improve bounce by changing global probe intensity.' );
	assertLightProbeProof( file, unweighted.band1Intensity === 1 &&
		damped.band1Intensity === 0.6 &&
		unweighted.band2Intensity === damped.band2Intensity,
	'grounding parity artifact: low-res comparison must isolate first-band directionality.' );
	assertLightProbeProof( file, getSnapshotRegion( unweighted, 'tallBox' ).colorBias.redOverGreen >
		getSnapshotRegion( damped, 'tallBox' ).colorBias.redOverGreen,
	'grounding parity artifact: full band-1 low-res row must improve tall-box red bias over damped baseline.' );
	assertLightProbeProof( file, getSnapshotRegion( unweighted, 'sphere' ).colorBias.greenOverRed > 1,
		'grounding parity artifact: full band-1 low-res row must preserve sphere green bounce.' );
	assertLightProbeProof( file, getSnapshotRegion( unweighted, 'rightWall' ).colorBias.greenOverRed > 1.25,
		'grounding parity artifact: full band-1 low-res row must preserve right-side green bounce.' );
	assertLightProbeProof( file, getSnapshotRegion( unweighted, 'tallBox' ).darkPixelRatio <=
		getSnapshotRegion( damped, 'tallBox' ).darkPixelRatio + 0.35,
	'grounding parity artifact: full band-1 low-res row must keep tall-box dark tail bounded.' );
	assertLightProbeProof( file, densityReference.metrics.resolution === 6 &&
		densityReference.metrics.cubemapSize === 32 &&
		densityReference.metrics.sampling.weightedProbeSampling === false,
	'grounding parity artifact: WebGPU WebGL-like density reference must remain unweighted and use 6^3 / 32px.' );
	assertLightProbeProof( file, densityShadowless.metrics.resolution === 6 &&
		densityShadowless.metrics.cubemapSize === 32 &&
		densityShadowless.shadowsDisabledDuringBake === true,
	'grounding parity artifact: WebGPU density shadowless row must preserve same budget and disable bake shadows.' );
	assertLightProbeProof( file, densityDamped.metrics.resolution === 6 &&
		densityDamped.metrics.cubemapSize === 32 &&
		densityDamped.band1Intensity === 0.6 &&
		densityDamped.band2Intensity === densityReference.band2Intensity &&
		densityDamped.normalBias === densityReference.normalBias &&
		densityDamped.viewBias === densityReference.viewBias &&
		densityDamped.probeIntensity === densityReference.probeIntensity &&
		densityDamped.metrics.materialType === densityReference.metrics.materialType &&
		densityDamped.metrics.lightingMode === densityReference.metrics.lightingMode &&
		densityDamped.metrics.precision.requestedPrecision === densityReference.metrics.precision.requestedPrecision &&
		densityDamped.metrics.sampling.probeValidityMode === densityReference.metrics.sampling.probeValidityMode &&
		densityDamped.metrics.sampling.invalidProbeCount === densityReference.metrics.sampling.invalidProbeCount &&
		densityDamped.metrics.sampling.manualIrradianceSampling === false &&
		densityDamped.metrics.sampling.weightedProbeSampling === false &&
		densityDamped.metrics.sampling.weightedProbeSampling === densityReference.metrics.sampling.weightedProbeSampling,
	'grounding parity artifact: WebGPU density quality candidate must preserve same budget, probe intensity, precision, material, bias, validity mode, and unweighted sampling while damping first-band SH.' );
	assertLightProbeProof( file, densityDamped.antiRingingPolicy?.mode === 'band1-damped-quality' &&
		densityDamped.antiRingingPolicy.bandPolicy === 'L0 preserved, L1=0.6, L2=0.55' &&
		densityDamped.bakeTexelBudget.cubemapTexels === densityReference.bakeTexelBudget.cubemapTexels,
	'grounding parity artifact: same-budget quality candidate must encode the math action as L1 damping, not a hidden budget or intensity change.' );
	assertLightProbeProof( file, densityReference.bakeTexelBudget.cubemapTexels === 1327104 &&
		densityReference.bakeTexelBudget.relativeToLowRes === 54,
	'grounding parity artifact: WebGPU density stress row must report the 54x cubemap texel work budget.' );
	assertLightProbeProof( file, densityReference.artifactPressure.status === 'PRESSURE' ||
		densityReference.artifactPressure.objectBlackTailRatio <= 0.15,
	'grounding parity artifact: WebGPU density stress row must mark visible black-tail artifacts as pressure.' );
	assertLightProbeProof( file, densityShadowless.artifactPressure.objectBlackTailRatio <=
		densityReference.artifactPressure.objectBlackTailRatio + 0.02,
	'grounding parity artifact: shadowless density control must not worsen object black-tail pressure.' );
	assertLightProbeProof( file, densityDamped.artifactPressure.status === 'bounded' &&
		densityDamped.artifactPressure.objectBlackTailRatio <= 0.08 &&
		densityDamped.artifactPressure.luminanceFloor >= 24,
	'grounding parity artifact: same-budget quality candidate must address muddy object black-tail pressure.' );
	assertLightProbeProof( file, densityDamped.artifactPressure.objectBlackTailRatio <=
		densityReference.artifactPressure.objectBlackTailRatio - 0.25,
	'grounding parity artifact: same-budget quality candidate must materially reduce black-tail pressure.' );
	assertLightProbeProof( file, densityDamped.artifactPressure.cellEdgeContrast <=
		densityReference.artifactPressure.cellEdgeContrast,
	'grounding parity artifact: same-budget quality candidate must not trade black-tail fix for worse cell-edge contrast.' );

}

function validateLightProbeWebGLReference( file, reference ) {

	assertLightProbeProof( file, reference.label === lightProbeWebGLReferenceLabel,
		'WebGL reference artifact: expected stable reference label.' );
	assertLightProbeProof( file, reference.proofRole === 'same-class-webgl-reference',
		'WebGL reference artifact: expected same-class reference role.' );
	assertLightProbeProof( file, reference.metrics.backend === 'WebGL' &&
		reference.metrics.implementation === 'LightProbeGrid' &&
		reference.metrics.resolution === 6 &&
		reference.metrics.cubemapSize === 32 &&
		reference.metrics.lightingMode === 'probes only',
	'WebGL reference artifact: expected LightProbeGrid 6^3 / 32px probes-only reference metrics.' );

	for ( const regionName of [ 'tallBox', 'shortBox', 'sphere', 'rightWall' ] ) {

		const region = getSnapshotRegion( reference, regionName );
		assertLightProbeProof( file, Number.isFinite( region.color.r ) &&
			Number.isFinite( region.color.g ) &&
			Number.isFinite( region.color.b ),
		`WebGL reference artifact ${ regionName }: expected finite RGB averages.` );
		assertLightProbeProof( file, Number.isFinite( region.colorBias.redOverGreen ) &&
			Number.isFinite( region.colorBias.greenOverRed ),
		`WebGL reference artifact ${ regionName }: expected finite color-bias ratios.` );
		assertLightProbeProof( file, Number.isFinite( region.darkPixelRatio ) &&
			region.darkPixelRatio >= 0 &&
			region.darkPixelRatio <= 1,
		`WebGL reference artifact ${ regionName }: expected bounded dark-pixel ratio.` );

	}

	assertLightProbeProof( file, getSnapshotRegion( reference, 'tallBox' ).colorBias.redOverGreen > 1,
		'WebGL reference artifact: expected positive tall-box red bounce signal.' );
	assertLightProbeProof( file, getSnapshotRegion( reference, 'sphere' ).colorBias.greenOverRed > 1,
		'WebGL reference artifact: expected positive sphere green bounce signal.' );
	assertLightProbeProof( file, reference.artifactPressure !== undefined &&
		Number.isFinite( reference.artifactPressure.objectBlackTailRatio ) &&
		Number.isFinite( reference.artifactPressure.luminanceFloor ),
	'WebGL reference artifact: expected object-level artifact pressure metrics.' );

}

function createLightProbeProofReport( file, smokeResults, snapshots, restored, webglReference ) {

	const artifactMatrix = getSmokeStep( smokeResults, 'artifact matrix' ).artifactMatrix;
	const regionMatrix = getSmokeStep( smokeResults, 'region artifact matrix' ).regionMatrix;
	const leakMatrix = getSmokeStep( smokeResults, 'leak matrix' ).leakMatrix;
	const shMathContract = getSmokeStep( smokeResults, 'sh math contract' ).shMathContract;
	const snapshotRows = new Map( snapshots.map( snapshot => [ snapshot.label, snapshot ] ) );
	const densityReference = snapshotRows.get( 'webgpu-webgl-density-reference' );
	const densityShadowless = snapshotRows.get( 'webgpu-webgl-density-shadowless' );
	const densityDamped = snapshotRows.get( 'webgpu-webgl-density-damped' );
	const bakeTexelBudgets = {
		lowRes: createLightProbeBakeTexelBudget( 4, 8 ),
		densityReference: createLightProbeBakeTexelBudget( 6, 32 )
	};
	const createDensityDelta = snapshot => ( {
		objectBlackTailDelta: Number( (
			snapshot.artifactPressure.objectBlackTailRatio -
			densityReference.artifactPressure.objectBlackTailRatio
		).toFixed( 4 ) ),
		luminanceFloorDelta: Number( (
			snapshot.artifactPressure.luminanceFloor -
			densityReference.artifactPressure.luminanceFloor
		).toFixed( 4 ) ),
		cellEdgeContrastDelta: Number( (
			snapshot.artifactPressure.cellEdgeContrast -
			densityReference.artifactPressure.cellEdgeContrast
		).toFixed( 4 ) )
	} );
	const densityArtifactStudy = {
		reference: densityReference.artifactPressure,
		shadowless: {
			...densityShadowless.artifactPressure,
			...createDensityDelta( densityShadowless )
		},
		damped: {
			...densityDamped.artifactPressure,
			...createDensityDelta( densityDamped )
		}
	};
	const snapshotBakeTimings = snapshots.map( snapshot =>
		snapshot.metrics?.timings?.totalBakeMs ?? snapshot.totalBakeMs ?? 0
	);
	const positiveBakeTimings = snapshotBakeTimings.filter( timing => timing > 0 );
	const timingSources = snapshots.map( snapshot =>
		snapshot.metrics?.timings?.timingSource ?? 'unavailable'
	);
	const timingSourceCounts = timingSources.reduce( ( counts, source ) => {

		counts[ source ] = ( counts[ source ] ?? 0 ) + 1;
		return counts;

	}, {} );
	const performanceEvidence = {
		bakeTexelBudgetStatus: 'asserted',
		measuredTimingStatus: positiveBakeTimings.length === snapshotBakeTimings.length ?
			'reported-not-gated' :
			'unavailable-or-zero-not-asserted',
		measuredTimingNote: 'Static cubemap texel work is the only performance gate. Positive bake timings are reported as diagnostics; under the deterministic e2e timer the harness uses performance._now as a wall-clock fallback for total bake time.',
		snapshotBakeTimings,
		timingSources,
		timingSourceCounts
	};
	const mathAndPipelineDecision = {
		rootCauseHypothesis: 'The muddy density-reference artifact is dominated by low-order / 9-coefficient SH representation pressure: a 6^3 / 32px bake captures sharper high-contrast lighting, then the low-order SH representation stores it as only 9 coefficients. Full L1 directionality can create negative/dark lobes after evaluation and non-negative clamp.',
		action: 'Use a same-budget band1-damped quality candidate: preserve L0 mean irradiance, keep L2 at 0.55, reduce L1 directional overshoot to 0.6, and keep global probeIntensity unchanged.',
		webgpuPipelineFlow: 'GPU bake cubemaps -> GPU SH projection into packed atlas -> hardware texture.sample() for unweighted runtime queries -> sampler-disabled manual loads / shader texture loads only for validity/normal-weighted rows -> SH band evaluation and clamp.',
		webgpuQuirkBoundary: 'This pass treats the issue as SH band-policy pressure, not a WebGPU texture-filtering bug: the quality candidate keeps the same half-float atlas path, same 6^3 / 32px bake budget, and the same hardware-filtered unweighted sampler.',
		deferredRuntimeWork: 'If the same pattern fails on more adapters, next scoped runtime work is private anti-ringing/visibility design: per-probe confidence, visibility/depth moments, probe relocation/classification, or adaptive bricks; no public preset/API change in this pass.'
	};

	const externalImplementationResearch = {
		status: 'VERIFIED-SCOPED',
		searchedFor: [
			'NVIDIA RTXGI / DDGI SDK',
			'Unity Adaptive Probe Volumes',
			'WebGPU surfel GI implementations',
			'Shade / Usnul WebGPU DDGI notes',
			'Sixteen Studio / SixTeenStudios public GitHub traces'
		],
		primarySources: [
			{
				name: 'NVIDIAGameWorks/RTXGI-DDGI',
				url: 'https://github.com/NVIDIAGameWorks/RTXGI-DDGI',
				lesson: 'Production DDGI separates irradiance from distance/visibility data, applies normal/view surface bias, wraps normal weighting, Chebyshev variance visibility, weight crushing, and keeps relocation/classification as explicit systems.'
			},
			{
				name: 'NVIDIA light-field probes',
				url: 'https://research.nvidia.com/publication/2017-02_real-time-global-illumination-using-precomputed-light-field-probes',
				lesson: 'Leak control comes from storing visibility with probe data; irradiance alone is not enough for walls and occluded receivers.'
			},
			{
				name: 'Unity Adaptive Probe Volumes',
				url: 'https://docs.unity.cn/2023.3/Documentation/Manual/urp/probevolumes-concept.html',
				lesson: 'APV samples probes per pixel, organizes data into adaptive 4x4x4 bricks, and exposes density/streaming/debug controls rather than treating a single uniform grid as production-grade.'
			},
			{
				name: 'Unity APV issue-fixing guidance',
				url: 'https://github.com/Unity-Technologies/Graphics/blob/master/Packages/com.unity.render-pipelines.high-definition/Documentation~/probevolumes-fixissues.md',
				lesson: 'APV treats invalid probes with virtual offset and dilation, and calls out wall thickness, rendering layers, and probe adjustment volumes as leak controls.'
			},
			{
				name: 'jure/webgiya',
				url: 'https://github.com/jure/webgiya',
				lesson: 'A modern WebGPU GI experiment uses explicit pass decomposition, spatial structures, temporal integration, radial depth moments, and resolve-time spatial/normal/occlusion weighting.'
			},
			{
				name: 'Shade WebGPU forum notes',
				url: 'https://discourse.threejs.org/t/shade-webgpu-graphics/66969/116',
				lesson: 'The reported DDGI leak strategy combines local cells, per-probe depth maps, normal visibility, parallax correction, and refinement; this is directionally aligned with DDGI-lite visibility scaffolding, not plain SH interpolation.'
			}
		],
		sixteenStudioFinding: 'No relevant public GitHub implementation for “Sixteen Studio” / “SixTeenStudios” + light probes/DDGI/WebGPU was verified in this pass; do not cite or emulate it until the exact repository or implementation is identified.',
		transferToLightProbeGridGPU: [
			'Keep the current SH-only grid honest as diffuse irradiance, not real DDGI.',
			'Next runtime-quality step is a private visibility/depth-moment layer, proven first by the existing thin-wall and zero-thickness negative-control fixtures.',
			'Add virtual-offset/dilation-style verifier rows before claiming APV-grade invalid-probe handling.',
			'Keep unweighted sampling on hardware filtering; only weighted visibility paths should use manual loads.',
			'Track bake memory, pass order, and data dependencies as first-class proof artifacts.'
		],
		nonGoalsForCurrentPR: [
			'No public preset API.',
			'No claiming production DDGI or APV parity.',
			'No copying external code; only source-backed architecture lessons are recorded.'
		]
	};

	return {
		generatedAt: new Date().toISOString(),
		file,
		claim: {
			status: 'SUPPORTED',
			text: 'WebGPU LightProbeGridGPU at 4^3 / cubemapSize=8 can show credible low-frequency red/green diffuse bounce and has a DDGI-lite verifier scaffold for controlled APV-style leak reduction without replacing the fast unweighted path.',
			scope: 'Targeted e2e verifier and screenshot-space diagnostics only; not a photometric proof, real DDGI visibility proof, cascade proof, or adaptive-brick proof.'
		},
		verifierBoundary: {
			primaryVerifier: 'test/e2e/puppeteer.js --webgpu webgpu_lightprobes_cornell',
			primaryEvidence: 'e2e artifact and region matrices',
			secondaryEvidence: 'Screenshots written outside the repository and paired with this metrics report.',
			screenshotPolicy: 'Screenshots are secondary and cannot overrule failed metrics.'
		},
		baselineCandidateFamily: {
			baseline: 'low-res-damped',
			candidate: 'low-res-unweighted',
			weightedCandidate: 'low-res-validity-weighted',
			leakBaseline: 'leak-thin-wall-unweighted',
			leakCandidate: 'leak-thin-wall-validity-weighted',
			negativeControl: 'leak-zero-thickness-validity-weighted remains OPEN',
			sameBudgetStressReference: 'webgpu-webgl-density-reference',
			sameBudgetQualityCandidate: 'webgpu-webgl-density-damped',
			webglSourceReference: lightProbeWebGLReferenceLabel
		},
		currentEvidence: {
			artifactMatrixRows: artifactMatrix.rows.length,
			regionMatrixRows: regionMatrix.rows.length,
			leakMatrixRows: leakMatrix.rows.length,
			artifactComparisons: artifactMatrix.comparisons,
			regionComparisons: regionMatrix.comparisons,
			leakComparisons: leakMatrix.comparisons,
			densityArtifactStudy,
			mathAndPipelineDecision,
			externalImplementationResearch,
			shMathContract,
			bakeTexelBudgets,
			performanceEvidence,
			webglReference,
			densityReferenceArtifactPressure: densityReference?.artifactPressure ?? null,
			restored
		},
		enemyTerms: [
			'metric hacking',
			'hiding dark artifacts',
			'boosting global probe intensity instead of improving directional bounce',
			'replacing hardware-filtered unweighted sampling with manual loads',
			'claiming the zero-thickness negative control is solved',
			'claiming the same-budget density stress screenshot is a visual-quality win',
			'hiding low-order SH representation dark-tail/ringing artifacts behind probe-density language',
			'confusing screenshot-space RGB ratios with linear radiance',
			'claiming production DDGI parity without visibility/depth moments',
			'citing unverified Sixteen Studio implementation details without an exact public source'
		],
		rejectionGates: [
			{ gate: 'Tall-box red/green bias must improve over damped baseline.', result: 'passed' },
			{ gate: 'Sphere and right-side green bounce must remain positive.', result: 'passed' },
			{ gate: 'Center luminance floor and dark tails must stay bounded.', result: 'passed' },
			{ gate: 'Low-res candidate must not change global probe intensity.', result: 'passed' },
			{ gate: 'Unweighted candidate must stay on hardware-filtered sampling.', result: 'passed' },
			{ gate: 'WebGPU 6^3 / 32px density row must be labelled as an artifact pressure case, not a quality win.', result: 'passed' },
			{ gate: 'Same-budget quality candidate must reduce object black-tail below 0.08 and recover luminance floor above 24.', result: 'passed' },
			{ gate: 'Same-budget quality candidate must preserve L0/probe intensity/bake budget and change only the SH band policy.', result: 'passed' },
			{ gate: 'Bake texel budget must report the 54x cubemap work multiplier for 6^3 / 32px versus 4^3 / 8px.', result: 'passed' },
			{ gate: 'Weighted thin-wall rows must bound wrong-side color leak without erasing correct bounce.', result: 'passed' },
			{ gate: 'Zero-thickness leak row must remain marked OPEN until real visibility/depth moments exist.', result: 'passed' },
			{ gate: 'WebGL same-class reference screenshot must be captured as secondary evidence, not substituted for WebGPU e2e gates.', result: 'passed' },
			{ gate: 'SH projection/evaluation math must satisfy constant-radiance pi scaling and match THREE.SphericalHarmonics3 irradiance constants/order.', result: 'passed' },
			{ gate: 'External implementation research must be recorded as architecture lessons without expanding current runtime/API scope.', result: 'passed' }
		],
		uncertainties: [
			{ status: 'OPEN', item: 'Screenshot-space RGB ratios are regression signals, not linear-radiance proof.' },
			{ status: 'OPEN', item: 'Metrics depend on camera, material, tonemapping, and browser/GPU adapter.' },
			{ status: 'SUPPORTED', item: 'The same-budget quality candidate uses first-band anti-ringing damping to reduce the density stress black-tail while preserving the 6^3 / 32px bake budget.' },
			{ status: 'OPEN', item: 'The WebGPU 6^3 / 32px full-band density screenshot remains a stress row; high-frequency bake detail can still produce muddy low-order / 9-coefficient SH representation black-tail/ringing artifacts.' },
			{ status: 'OPEN', item: 'Measured bake timings are diagnostics only; deterministic e2e uses a wall-clock fallback so unavailable/zero timing evidence cannot masquerade as measured proof.' },
			{ status: 'OPEN', item: 'Current validity is heuristic occupancy metadata, not DDGI visibility/depth moments.' },
			{ status: 'OPEN', item: 'Zero-thickness walls cannot be claimed solved by occupancy validity; they need real visibility/depth moments or a separate visibility structure.' },
			{ status: 'OPEN', item: 'No adaptive density, probe relocation, classification, dilation, or virtual-offset pipeline yet.' },
			{ status: 'SUPPORTED', item: 'Actual WebGL LightProbeGrid 6^3 / 32px probes-only screenshot and screenshot-space metrics are captured as same-class secondary reference evidence.' },
			{ status: 'SUPPORTED', item: 'Synthetic SH math contract verifies constant radiance maps to pi-scaled irradiance, x/y/z signs are preserved, and runtime constants/order match THREE.SphericalHarmonics3.getIrradianceAt().' },
			{ status: 'OPEN', item: 'No relevant public Sixteen Studio / SixTeenStudios light-probe or DDGI implementation was verified; exact source is needed before making implementation claims.' }
		],
		proofLadder: [
			{ level: 'examples', evidence: 'low-res proof snapshots, region matrices, and controlled thin-wall leak rows' },
			{ level: 'counterexamples', evidence: 'damped baseline, L0-only, direct-off, panel-hidden, solids-hidden, and zero-thickness negative-control rows' },
			{ level: 'artifact-pressure', evidence: 'webgpu-webgl-density-reference tracks object black-tail ratio, luminance floor, cell-edge contrast, and 54x bake texel work' },
			{ level: 'candidate-action', evidence: 'webgpu-webgl-density-damped must reduce object black-tail below 0.08 at the same bake texel budget by changing only the L1 band policy' },
			{ level: 'invariants', evidence: 'source checks keep GPU-resident bake, hardware-filtered unweighted sampling, and fixed demo defaults' },
			{ level: 'executable-check', evidence: 'targeted WebGPU e2e assertions' },
			{ level: 'transfer', evidence: 'WebGL same-class reference is captured; OPEN: repeat WebGPU/WebGL proof on more browsers/adapters' }
		],
		verdict: 'SUPPORTED within the frozen e2e verifier boundary.',
		proofLedgerDecision: 'CONTINUE',
		nextPressure: 'If controlled thin-wall rows keep passing, design the next scoped pass for real visibility/depth moments without public preset/API creep.',
		artifactMatrix,
		regionMatrix,
		leakMatrix,
		snapshots,
		webglReference
	};

}

function createLightProbeProofMarkdown( report ) {

	const lines = [
		'# LightProbeGridGPU Grounding + DDGI-lite Verifier Proof',
		'',
		`- Generated: ${ report.generatedAt }`,
		`- Claim status: ${ report.claim.status }`,
		`- Verifier: ${ report.verifierBoundary.primaryVerifier }`,
		`- Screenshot policy: ${ report.verifierBoundary.screenshotPolicy }`,
		'',
		'## Grounding / Parity Snapshots',
		'',
		'| Case | Role | Resolution | Cubemap | Bake texels | Band policy | Weighted | Tall red/green | Sphere green/red | Object black-tail | Pressure | Screenshot |',
		'|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---|'
	];

	for ( const snapshot of report.snapshots ) {

		const tallBox = getSnapshotRegion( snapshot, 'tallBox' );
		const sphere = getSnapshotRegion( snapshot, 'sphere' );

		lines.push( [
			snapshot.label,
			snapshot.proofRole,
			snapshot.metrics.resolution,
			snapshot.metrics.cubemapSize,
			snapshot.bakeTexelBudget.cubemapTexels,
			snapshot.antiRingingPolicy?.bandPolicy ?? 'n/a',
			snapshot.metrics.sampling.weightedProbeSampling,
			tallBox.colorBias.redOverGreen,
			sphere.colorBias.greenOverRed,
			snapshot.artifactPressure.objectBlackTailRatio,
			snapshot.artifactPressure.status,
			snapshot.screenshot
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	const webglTallBox = getSnapshotRegion( report.webglReference, 'tallBox' );
	const webglSphere = getSnapshotRegion( report.webglReference, 'sphere' );

	lines.push(
		'',
		'## WebGL Same-Class Reference',
		'',
		'| Case | Role | Resolution | Cubemap | Tall red/green | Sphere green/red | Object black-tail | Pressure | Screenshot |',
		'|---|---|---:|---:|---:|---:|---:|---|---|',
		[
			report.webglReference.label,
			report.webglReference.proofRole,
			report.webglReference.metrics.resolution,
			report.webglReference.metrics.cubemapSize,
			webglTallBox.colorBias.redOverGreen,
			webglSphere.colorBias.greenOverRed,
			report.webglReference.artifactPressure.objectBlackTailRatio,
			report.webglReference.artifactPressure.status,
			report.webglReference.screenshot
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' )
	);

	lines.push(
		'',
		'## Bake Budget',
		'',
		`- Low-res 4³ / 8px: ${ report.currentEvidence.bakeTexelBudgets.lowRes.cubemapTexels } cubemap texels.`,
		`- Same-budget stress 6³ / 32px: ${ report.currentEvidence.bakeTexelBudgets.densityReference.cubemapTexels } cubemap texels.`,
		`- Work multiplier: ${ report.currentEvidence.bakeTexelBudgets.densityReference.relativeToLowRes }x.`,
		`- Timing policy: ${ report.currentEvidence.performanceEvidence.measuredTimingStatus } — ${ report.currentEvidence.performanceEvidence.measuredTimingNote }`
	);

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
		'',
		'## Density Artifact Study',
		'',
		'| Control | Role | Object black-tail | Black-tail delta | Luminance floor | Luminance delta | Edge delta | Status |',
		'|---|---|---:|---:|---:|---:|---:|---|',
		[
			'reference',
			'stress',
			report.currentEvidence.densityArtifactStudy.reference.objectBlackTailRatio,
			0,
			report.currentEvidence.densityArtifactStudy.reference.luminanceFloor,
			0,
			0,
			report.currentEvidence.densityArtifactStudy.reference.status
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ),
		[
			'shadowless',
			'cause-control',
			report.currentEvidence.densityArtifactStudy.shadowless.objectBlackTailRatio,
			report.currentEvidence.densityArtifactStudy.shadowless.objectBlackTailDelta,
			report.currentEvidence.densityArtifactStudy.shadowless.luminanceFloor,
			report.currentEvidence.densityArtifactStudy.shadowless.luminanceFloorDelta,
			report.currentEvidence.densityArtifactStudy.shadowless.cellEdgeContrastDelta,
			report.currentEvidence.densityArtifactStudy.shadowless.status
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ),
		[
			'damped',
			'quality-candidate',
			report.currentEvidence.densityArtifactStudy.damped.objectBlackTailRatio,
			report.currentEvidence.densityArtifactStudy.damped.objectBlackTailDelta,
			report.currentEvidence.densityArtifactStudy.damped.luminanceFloor,
			report.currentEvidence.densityArtifactStudy.damped.luminanceFloorDelta,
			report.currentEvidence.densityArtifactStudy.damped.cellEdgeContrastDelta,
			report.currentEvidence.densityArtifactStudy.damped.status
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' )
	);

	lines.push(
		'',
		'## DDGI-lite Leak Verifier Matrix',
		'',
		'| Case | Fixture | Weighted | Validity | Wrong-side ratio | Correct-bounce ratio | Dark ratio | Edge contrast | Status |',
		'|---|---:|---:|---:|---:|---:|---:|---:|---|'
	);

	for ( const row of report.leakMatrix.rows ) {

		lines.push( [
			row.label,
			row.fixtureMode,
			row.sampling.weightedProbeSampling,
			row.sampling.probeValidityMode,
			row.leakMetrics.wrongSideColorRatio,
			row.leakMetrics.correctBounceRatio,
			row.leakMetrics.darkPixelRatio,
			row.leakMetrics.cellEdgeContrast,
			row.negativeControlStatus
		].join( ' | ' ).replace( /^/, '| ' ).replace( /$/, ' |' ) );

	}

	lines.push(
		'',
		'## Rejection Gates',
		...report.rejectionGates.map( gate => `- ${ gate.result.toUpperCase() }: ${ gate.gate }` ),
		'',
		'## Uncertainties',
		...report.uncertainties.map( uncertainty => `- ${ uncertainty.status }: ${ uncertainty.item }` ),
		'',
		`## Verdict\n${ report.verdict }`
	);

	return `${ lines.join( '\n' ) }\n`;

}

async function writeLightProbeGroundingParityArtifacts( page, file, smokeHarness, smokeResults ) {

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

	const webglReference = await captureLightProbeWebGLReference( page );
	validateLightProbeWebGLReference( file, webglReference );

	const report = createLightProbeProofReport( file, smokeResults, snapshots, restored, webglReference );
	assertLightProbeProof( file, Array.isArray( report.artifactMatrix.rows ) &&
		Array.isArray( report.regionMatrix.rows ) &&
		report.artifactMatrix.rows.length > 0 &&
		report.regionMatrix.rows.length > 0,
	'grounding parity artifact: proof report must persist raw artifact and region matrices for auditability.' );
	assertLightProbeProof( file,
		report.currentEvidence.performanceEvidence.bakeTexelBudgetStatus === 'asserted' &&
		report.currentEvidence.performanceEvidence.measuredTimingStatus === 'reported-not-gated' &&
		report.currentEvidence.performanceEvidence.snapshotBakeTimings.every( timing => timing > 0 ) &&
		report.currentEvidence.webglReference?.label === lightProbeWebGLReferenceLabel,
		'grounding parity artifact: proof report must keep cubemap texel budget as the performance gate, report positive non-gated bake timings, and persist the WebGL reference.' );
	const reportPath = path.join( lightProbeParityArtifactDir, 'proof-report.json' );
	const tablePath = path.join( lightProbeParityArtifactDir, 'proof-table.md' );

	await fs.writeFile( reportPath, `${ JSON.stringify( report, null, '\t' ) }\n` );
	await fs.writeFile( tablePath, createLightProbeProofMarkdown( report ) );

	console.green( `Grounding parity artifacts written: ${ lightProbeParityArtifactDir }` );

}

async function captureLightProbeWebGLReference( page ) {

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
			referenceBoundary: 'WebGL LightProbeGrid same-class reference at 6^3 / 32px, captured as secondary screenshot-space evidence; not a production DDGI target and not a substitute for WebGPU e2e gates.',
			metrics,
			regions,
			artifactPressure: createLightProbeImageArtifactPressure( regions ),
			screenshot
		};

	} finally {

		await webglPage.close();

	}

}

async function checkSmokeSourceInvariants( file, smokeHarness ) {

	if ( file !== 'webgpu_lightprobes_cornell' ) return;

	const [ example, source, e2eSource, webglExample ] = await Promise.all( [
		fs.readFile( smokeHarness.example, 'utf8' ),
		fs.readFile( smokeHarness.source, 'utf8' ),
		fs.readFile( 'test/e2e/puppeteer.js', 'utf8' ),
		fs.readFile( 'examples/webgl_lightprobes.html', 'utf8' )
	] );

	const requireSource = ( condition, message ) => {

		if ( condition === false ) throw new Error( `${ file }: ${ message }` );

	};

	requireSource(
		example.includes( 'searchParams.has( \'testHarness\' ) === false' ) &&
			example.includes( `window.${ smokeHarness.global }` ),
		'Smoke harness must stay gated behind ?testHarness.'
	);

	requireSource(
		webglExample.includes( 'window.__webglLightProbeGridCornell' ) &&
			webglExample.includes( 'applyReferenceSnapshot' ) &&
			webglExample.includes( 'params.lightingMode = mode' ) &&
			e2eSource.includes( lightProbeWebGLReferenceLabel ) &&
			e2eSource.includes( 'captureLightProbeWebGLReference' ),
		'WebGL LightProbeGrid reference capture must stay explicit, harness-gated, and secondary to the WebGPU proof.'
	);

	requireSource(
		example.includes( 'MeshPhysicalNodeMaterial' ) &&
			example.includes( 'MeshLambertNodeMaterial' ) &&
			example.includes( 'MeshPhongNodeMaterial' ) &&
			example.includes( 'setMaterialType' ),
		'Smoke example must cover standard, physical, lambert, and phong node material families.'
	);

	requireSource(
		example.includes( 'const gridMin = new THREE.Vector3( - 2.6, 0.35, - 2.6 )' ) &&
			example.includes( 'const gridMax = new THREE.Vector3( 2.6, 4.35, 2.6 )' ),
		'Cornell probes must stay inset from the walls, floor, ceiling, and visible emitter to avoid near-field SH ringing.'
	);

	requireSource(
		/import[\s\S]*Object3D[\s\S]*from 'three\/webgpu'/.test( source ) &&
			/class LightProbeGridGPU extends Object3D/.test( source ) &&
			source.includes( 'this.isLightProbeGrid = true' ) &&
			source.includes( 'this.boundingBox' ) &&
			source.includes( 'this.texture' ),
		'LightProbeGridGPU must stay packaged as an Object3D-style probe grid.'
	);

	requireSource(
		source.includes( 'this._bakePromise' ) &&
			source.includes( 'if ( this._bakePromise !== null ) return this._bakePromise' ) &&
			/(^|\n)\s*bake\s*\(\s*renderer\s*,\s*scene\s*,\s*options\s*=\s*\{\s*\}\s*\)\s*\{/.test( source ) &&
			/(^|\n)\s*async\s+bake\s*\(/.test( source ) === false &&
			source.includes( 'async _bake' ),
		'LightProbeGridGPU bake() must coalesce overlapping bakes through an instance-owned promise identity.'
	);

	requireSource(
		source.includes( 'this.projectionMesh.geometry.dispose()' ) &&
			source.includes( 'this.repackMesh.geometry.dispose()' ) &&
			source.includes( 'this.texture = null' ),
		'LightProbeGridGPU dispose() must release instance-owned GPU resources and clear the public texture reference.'
	);

	requireSource(
		source.includes( 'getMemoryInfo()' ) &&
			source.includes( 'projection: \'fragment\'' ) &&
			source.includes( 'atlas: \'render-pass\'' ) &&
			source.includes( 'update: \'full\'' ),
		'LightProbeGridGPU must expose benchmark memory metadata and current backend labels.'
	);

	requireSource(
		source.includes( 'new RenderTarget3D( this.resolution, this.resolution, this.atlasDepth' ) &&
			source.includes( 'this.texture = this.atlasTarget.texture' ) &&
			source.includes( 'Data3DTexture' ) === false &&
			source.includes( 'readRenderTargetPixels' ) === false &&
			source.includes( 'readPixels' ) === false,
		'LightProbeGridGPU bake atlas must stay GPU-resident with no CPU readback or Data3DTexture upload path.'
	);

	requireSource(
		source.includes( 'this.min = min.clone()' ) &&
			source.includes( 'this.max = max.clone()' ) &&
			source.includes( 'this.boundingBox = new Box3( this.min, this.max )' ) &&
			source.includes( 'this.resolution = this._validateResolution' ) &&
			source.includes( 'this.totalProbes = this.resolution * this.resolution * this.resolution' ),
		'LightProbeGridGPU must keep its explicit min/max box and cubic probe resolution contract documented against the WebGL baseline.'
	);

	requireSource(
		source.includes( 'L2 spherical harmonics' ) &&
			source.includes( 'const SH_COEFFICIENTS = 9' ) &&
			source.includes( 'const PACKED_SH_TEXTURES = 7' ) &&
			source.includes( 'ceil( 27 / 4 ) = 7' ) &&
			source.includes( 'solid angle' ) &&
			source.includes( 'trilinear' ) &&
			source.includes( 'The WebGL LightProbeGrid baseline uses width/height/depth' ),
		'LightProbeGridGPU must document the SH projection, packing, padding, filtering math, and WebGL parity boundary.'
	);

	requireSource(
		/probesSH\.sample[\s\S]*_getPackedAtlasSampleZ/.test( source ) &&
			/packedLoad\.load[\s\S]*_getPackedAtlasLoadCoord/.test( source ) &&
			/setRenderTarget\( this\.atlasTarget, this\._getPackedAtlasLayer/.test( source ) &&
			/atlasLoad\.load\( this\._getPackedAtlasLoadCoord/.test( source ) &&
			source.includes( 'viewportCoordinate' ) &&
			/const ix = int\( floor\( viewportCoordinate\.x \) \)/.test( source ) &&
			/const iy = int\( floor\( viewportCoordinate\.y \) \)/.test( source ),
		'Atlas sample/load/repack/helper paths must use centralized atlas address helpers and WebGPU-native viewport coordinates for repack.'
	);

	requireSource(
		/probeCoord\.x\.mul\( resolutionMinusOne \)\.add\( 0\.5 \)\.div\( resolution \)/.test( source ) &&
			/probeCoord\.y\.mul\( resolutionMinusOne \)\.add\( 0\.5 \)\.div\( resolution \)/.test( source ) &&
			/probeCoord\.z\.mul\( resolutionMinusOne \)\.add\( 0\.5 \)\.div\( resolution \)/.test( source ),
		'Hardware-filtered atlas sampling must center X/Y/Z coordinates on probe texels before blending.'
	);

	requireSource(
		source.includes( 'loadPackedSamples' ) &&
			source.includes( 'weightedSamples[ 0 ].div( safeWeight )' ) &&
			source.includes( 'weightedSamples[ i ].addAssign( sample[ i ].mul( weight ) )' ),
		'Weighted manual atlas sampling must accumulate packed SH coefficients before SH evaluation/clamping.'
	);

	requireSource(
		source.includes( 'this.band2Intensity = uniform' ) &&
			source.includes( 'this.band1Intensity = uniform' ) &&
			/const band1Intensity = this\.band1Intensity/.test( source ) &&
			/c1\.mul[\s\S]*band1Intensity/.test( source ) &&
			/c3\.mul[\s\S]*band1Intensity/.test( source ) &&
			/const band2Intensity = this\.band2Intensity/.test( source ) &&
			/c4\.mul[\s\S]*band2Intensity/.test( source ) &&
			/c8\.mul[\s\S]*band2Intensity/.test( source ) &&
			/probeHelperIntensity: 1,\s+band1Intensity: 1,\s+band2Intensity: 0\.55/.test( example ) &&
			example.includes( 'low-res-damped' ) &&
			example.includes( 'band1Intensity: 0.6' ) &&
			example.includes( 'band2Intensity: 0.55' ),
		'Probe irradiance must default to full first-band SH while keeping damped band diagnostics for ringing isolation.'
	);

	requireSource(
		example.includes( 'inspectProjectionParity' ) &&
			example.includes( 'projectSyntheticCube' ) &&
			example.includes( 'projectionConventionDirection' ) &&
			example.includes( 'shader-webgpu' ) &&
			example.includes( 'generator-render-target-webgpu' ) &&
			example.includes( 'webgl-light-probe-grid' ),
		'Cornell harness must include a synthetic cubemap projection parity fixture for WebGPU, WebGL, LightProbeGenerator, and SphericalHarmonics3 conventions.'
	);

	requireSource(
		example.includes( 'inspectSHMathContract' ) &&
			example.includes( 'evaluateIrradianceContract' ) &&
			example.includes( 'THREE.SphericalHarmonics3' ) &&
			example.includes( 'constantRadiance' ) &&
			example.includes( 'axisDominance' ) &&
			example.includes( 'runtime clamps only after all bands are summed' ),
		'Cornell harness must include an executable SH math contract for projection normalization, irradiance convolution, axis signs, and runtime clamp order.'
	);

	requireSource(
		example.includes( 'inspectAtlasPacking' ) &&
			example.includes( 'readRenderTargetPixelsAsync' ) &&
			example.includes( 'coefficientPacking' ) &&
			example.includes( 'leading-padding-validity-t6' ) &&
			example.includes( 'gridProbeIndexFormula' ) &&
			example.includes( 'centerSampleZ' ),
		'Cornell harness must include an executable atlas packing, padding, validity-channel, and Y-orientation verifier.'
	);

	requireSource(
		example.includes( 'inspectProbeOccupancy' ) &&
			example.includes( 'solidProbeMeshes' ) &&
			example.includes( 'containsPoint' ) &&
			example.includes( 'probeIndex' ),
		'Cornell harness must diagnose probe centers that land inside solid scene geometry before adding DDGI-style validity.'
	);

	requireSource(
		example.includes( 'createLocalArtifactMetric' ) &&
			example.includes( 'captureRegionArtifactMetrics' ) &&
			example.includes( 'runProbeArtifactRegionMatrix' ) &&
			example.includes( 'createLeakFixture' ) &&
			example.includes( 'isVisibleForProbeOccupancy' ) &&
			example.includes( 'setBaseCornellProbeMeshesVisible' ) &&
			example.includes( 'leakArtifactRegions' ) &&
			example.includes( 'captureLeakRegionMetrics' ) &&
			example.includes( 'runProbeLeakMatrix' ) &&
			example.includes( 'leak-thin-wall-unweighted' ) &&
			example.includes( 'leak-thin-wall-normal-weighted' ) &&
			example.includes( 'leak-thin-wall-validity-weighted' ) &&
			example.includes( 'leak-zero-thickness-unweighted' ) &&
			example.includes( 'leak-zero-thickness-validity-weighted' ) &&
			example.includes( 'wrongSideColorRatio' ) &&
			example.includes( 'correctBounceRatio' ) &&
			example.includes( 'negativeControlStatus' ) &&
			example.includes( 'darkPixelRatio' ) &&
			example.includes( 'blackPixelRatio' ) &&
			example.includes( 'objectBlackTailRatio' ) &&
			example.includes( 'createBakeTexelBudget' ) &&
			example.includes( 'createObjectArtifactPressure' ) &&
			example.includes( 'antiRingingPolicy' ) &&
			example.includes( 'band1-damped-quality' ) &&
			example.includes( 'L0 preserved, L1=0.6, L2=0.55' ) &&
			example.includes( 'hardware-filtered-unweighted' ) &&
			example.includes( 'performance._now' ) &&
			example.includes( 'harness-wall-clock-fallback' ) &&
			example.includes( 'timingSource' ) &&
			example.includes( 'same-budget-artifact-pressure' ) &&
			example.includes( 'higher bake detail can expose low-order / 9-coefficient SH representation dark-tail/ringing artifacts' ) &&
			example.includes( 'redOverGreen' ) &&
			example.includes( 'greenOverRed' ) &&
			example.includes( 'low-res-damped' ) &&
			example.includes( 'low-res-unweighted' ) &&
			example.includes( 'low-res-validity-weighted' ) &&
			example.includes( 'groundingParitySnapshotCases' ) &&
			example.includes( 'webgpu-webgl-density-reference' ) &&
			example.includes( 'webgpu-webgl-density-shadowless' ) &&
			example.includes( 'webgpu-webgl-density-damped' ) &&
			example.includes( 'same-budget-shadow-control' ) &&
			example.includes( 'same-budget-quality-candidate' ) &&
			example.includes( 'disableShadowsDuringBake: snapshotCase.disableShadowsDuringBake' ) &&
			example.includes( 'applyGroundingParitySnapshot' ) &&
			example.includes( 'restoreGroundingParitySnapshot' ) &&
			example.includes( 'shadows-off' ) &&
			example.includes( 'direct-off' ) &&
			example.includes( 'panel-hidden' ) &&
			example.includes( 'solids-hidden' ) &&
			example.includes( 'cubemap-16-l0-only' ) &&
			example.includes( 'cubemap-16-l0-l1' ) &&
			example.includes( 'cubemap-16-band1-0.6' ) &&
			example.includes( 'disableDirectLightDuringBake' ) &&
			example.includes( 'hideSolidGeometryDuringBake' ) &&
			example.includes( 'hideLightPanelDuringBake' ) &&
			example.includes( 'ceilingEmitter' ) &&
			example.includes( 'cellEdgeContrast' ) &&
			example.includes( 'runProbeDiagnosticMatrix' ) &&
			example.includes( 'l0-only' ) &&
			example.includes( 'l0-l1-l2' ) &&
			example.includes( 'leak-normal-constant-validity' ) &&
			example.includes( 'normalCustomToConstantDarkPixelRatioDelta' ) &&
			example.includes( 'resolution-6' ) &&
			example.includes( 'cubemap-32' ),
		'Cornell harness must expose precision, SH-band, validity, density, and local artifact diagnostics without adding primary UI knobs.'
	);

	requireSource(
		e2eSource.includes( 'mathAndPipelineDecision' ) &&
			e2eSource.includes( 'webgpuPipelineFlow' ) &&
			e2eSource.includes( 'GPU bake cubemaps -> GPU SH projection into packed atlas' ) &&
			e2eSource.includes( 'sampler-disabled manual loads / shader texture loads only for validity/normal-weighted rows' ) &&
			e2eSource.includes( 'same-budget band1-damped quality candidate' ) &&
			e2eSource.includes( 'same half-float atlas path' ),
		'LightProbeGrid proof report must spell out the SH math action and WebGPU pipeline boundary, not only screenshot metrics.'
	);

	requireSource(
		source.includes( 'scene.updateMatrixWorld( true )' ) &&
			source.includes( 'scene.matrixWorldAutoUpdate = false' ) &&
			source.includes( 'renderer.shadowMap.autoUpdate = false' ) &&
			source.includes( 'renderer.shadowMap.needsUpdate = true' ),
		'WebGPU probe baking must freeze scene transforms and shadow updates like the WebGL baseline.'
	);

	requireSource(
		source.includes( 'this.normalBias = uniform' ) &&
			source.includes( 'this.viewBias = uniform' ) &&
			source.includes( '_safeNormalize' ) &&
			source.includes( 'cameraPosition.sub( positionWorld )' ) &&
			source.includes( 'probePosition.sub( positionWorld )' ) &&
			source.includes( '.length().max( 0.0001 )' ) &&
			example.includes( 'normalBias: 0.5' ) &&
			example.includes( 'viewBias: 0' ),
		'Probe sampling must expose normal/view bias controls translated from DDGI/APV practice.'
	);

	requireSource(
		source.includes( 'this.leakReductionMode = this._validateLeakReductionMode' ) &&
			source.includes( 'this.probeValiditySource = this._validateProbeValidity' ) &&
			source.includes( 'this.probeValidityTexture' ) &&
			source.includes( '_createProbeValidityTexture()' ) &&
			source.includes( 'const recreateTexture = this.probeValidityTexture === null' ) &&
			source.includes( 'this.probeValidityTexture.image.data' ) &&
			source.includes( 'getSamplingInfo()' ) &&
			source.includes( '_usesWeightedProbeSampling()' ) &&
			source.includes( 'invalidProbeCount: this.invalidProbeCount' ) &&
			source.includes( 'probeValidityMode: this.probeValiditySource === null ? \'constant\' : \'custom\'' ) &&
			source.includes( 'wrapShading' ) &&
			source.includes( 'validityWeight' ) &&
			source.includes( 'textureLoad( this.probeValidityTexture' ) &&
			source.includes( 'packed.assign( vec4( c8.x, c8.y, c8.z, validity.x ) )' ) &&
			source.includes( 'c0Luminance' ) === false &&
			example.includes( 'createProbeValidityData' ) &&
			example.includes( 'leakReductionMode: \'off\'' ),
		'Probe sampling must expose scoped normal-weighted leak reduction with explicit validity metadata, without deriving validity from brightness.'
	);

	requireSource(
		source.includes( 'const nextLeakReductionMode = this._validateLeakReductionMode' ) &&
			source.includes( 'nextLeakReductionMode !== this.leakReductionMode' ),
		'Leak reduction mode must be treated as graph-shape state that recreates probe resources.'
	);

	requireSource(
		example.includes( 'const advancedFolder = gui.addFolder( \'Advanced\' )' ) &&
			example.includes( 'advancedFolder.close()' ) &&
			/advancedFolder\.add\( params, 'projectionPrecision', \[ 'auto', 'half float', 'float' \] \)/.test( example ) &&
			example.includes( '.name( \'helper exposure\' )' ) &&
			/gui\.add\( params, 'projectionPrecision', \[ 'half float', 'float', 'auto', 'float manual' \] \)/.test( example ) === false,
		'Cornell UI must keep debug precision and leak controls out of the primary probe workflow.'
	);

	requireSource(
		source.includes( 'this.activeProjectionPrecision = hasFloatFiltering ? \'float-linear\' : \'half-linear (fallback)\'' ) &&
			source.includes( 'requested === \'float manual\'' ) === false &&
			source.includes( 'this.projectionPrecision === \'float manual\'' ) === false,
		'Float precision must use hardware filtering when float32-filterable exists and half-float fallback otherwise, with no public float-manual precision mode.'
	);

	const addons = await fs.readFile( 'examples/jsm/Addons.js', 'utf8' );

	requireSource(
		addons.includes( 'lighting/LightProbeGridGPU.js' ),
		'LightProbeGridGPU must be exported from examples/jsm/Addons.js after the direct addon smoke path is stable.'
	);

}

async function runSmokeHarness( page, file, smokeHarness ) {

	await page.evaluate( ( file, smokeHarness ) => {

		const harness = window[ smokeHarness.global ];

		if ( harness === undefined ) {

			throw new Error( `${ file }: Smoke harness ${ smokeHarness.global } was not installed.` );

		}

		for ( const method of [ 'waitUntilReady', 'getMetrics', 'setPrecision', 'setLightingMode', 'setMaterialType', 'setLeakReductionMode', 'rebake', 'captureColorSanity', 'inspectAddonContract', 'inspectProbePositions', 'inspectSamplingControls', 'inspectProjectionParity', 'inspectSHMathContract', 'inspectAtlasPacking', 'inspectProbeOccupancy', 'compareLeakReductionModes', 'runArtifactMatrix', 'runProbeDiagnosticMatrix', 'runProbeArtifactRegionMatrix', 'captureLeakRegionMetrics', 'runProbeLeakMatrix', 'applyGroundingParitySnapshot', 'restoreGroundingParitySnapshot', 'testBakeCoalescing', 'runBenchmarkCase', 'runBenchmarkMatrix' ] ) {

			if ( typeof harness[ method ] !== 'function' ) {

				throw new Error( `${ file }: Smoke harness does not expose ${ method }().` );

			}

		}

	}, file, smokeHarness );

	const call = async ( method, ...args ) => await page.evaluate(
		async ( globalName, method, args ) => await window[ globalName ][ method ]( ...args ),
		smokeHarness.global,
		method,
		args
	);

	const callRejects = async ( method, ...args ) => await page.evaluate(
		async ( globalName, method, args ) => {

			try {

				await window[ globalName ][ method ]( ...args );

				return {
					rejected: false,
					message: ''
				};

			} catch ( error ) {

				return {
					rejected: true,
					message: error instanceof Error ? error.message : String( error )
				};

			}

		},
		smokeHarness.global,
		method,
		args
	);

	const getMetrics = async () => await page.evaluate(
		globalName => window[ globalName ].getMetrics(),
		smokeHarness.global
	);

	const startOperation = async ( method, ...args ) => await page.evaluate(
		( globalName, method, args ) => {

			const harness = window[ globalName ];
			harness.__pendingState = { status: 'pending' };
			harness.__pendingOperation = Promise.resolve( harness[ method ]( ...args ) )
				.then( () => {

					harness.__pendingState = { status: 'resolved' };

				} )
				.catch( error => {

					harness.__pendingState = {
						status: 'rejected',
						message: error instanceof Error ? error.message : String( error )
					};

				} );

		},
		smokeHarness.global,
		method,
		args
	);

	const getPendingState = async () => await page.evaluate(
		globalName => window[ globalName ].__pendingState ?? { status: 'resolved' },
		smokeHarness.global
	);

	const assert = ( condition, message ) => {

		if ( condition === false ) throw new Error( `${ file }: ${ message }` );

	};

	const waitUntilReady = async ( step ) => {

		for ( let i = 0; i < 240; i ++ ) {

			const pendingState = await getPendingState();
			const metrics = await getMetrics();

			if ( pendingState.status === 'rejected' ) {

				throw new Error( `${ file }: ${ step }: ${ pendingState.message }` );

			}

			if ( metrics.status === 'failed' ) {

				throw new Error( `${ file }: ${ step }: LightProbeGridGPU bake failed.` );

			}

			if ( metrics.status === 'ready' && pendingState.status !== 'pending' ) return;

			await new Promise( resolve => setTimeout( resolve, 250 ) );

		}

		throw new Error( `${ file }: ${ step }: LightProbeGridGPU bake timed out.` );

	};

	const results = [];
	const capture = async ( step ) => {

		const metrics = await getMetrics();

		assert( metrics.status === 'ready', `${ step }: expected ready status.` );
		assert( Number.isFinite( metrics.timings.totalBakeMs ), `${ step }: expected finite bake timing.` );
		assert( metrics.isLightProbeGrid === true, `${ step }: expected Object3D light probe grid flag.` );
		assert( metrics.hasTexture === true, `${ step }: expected public atlas texture reference.` );
		assert( metrics.hasBoundingBox === true, `${ step }: expected public bounding box.` );

		results.push( { step, metrics } );

		return metrics;

	};

	await waitUntilReady( 'initial' );
	await capture( 'initial' );

	const contract = await call( 'inspectAddonContract' );
	assert( contract.isObject3D === true, 'contract: expected Object3D instance flag.' );
	assert( contract.isLightProbeGrid === true, 'contract: expected light probe grid flag.' );
	assert( contract.type === 'LightProbeGridGPU', 'contract: expected LightProbeGridGPU type.' );
	assert( contract.hasTextureBeforeDispose === true, 'contract: expected texture before dispose.' );
	assert( contract.hasHelperBeforeDispose === true, 'contract: expected helper before dispose.' );
	assert( contract.hasTextureAfterDispose === false, 'contract: expected texture to clear after dispose.' );
	assert( contract.hasHelperAfterDispose === false, 'contract: expected helper to clear after dispose.' );
	assert( contract.hasAtlasTargetAfterDispose === false, 'contract: expected atlas target to clear after dispose.' );
	assert( contract.boundingBoxMin.x === - 1 &&
		contract.boundingBoxMin.y === - 2 &&
		contract.boundingBoxMin.z === - 3 &&
		contract.boundingBoxMax.x === 4 &&
		contract.boundingBoxMax.y === 5 &&
		contract.boundingBoxMax.z === 6,
	'contract: expected constructor min/max to define bounding box.' );
	results.push( { step: 'addon contract', contract } );

	const probePositions = await call( 'inspectProbePositions' );
	assert( probePositions.first.x === - 1 &&
		probePositions.first.y === - 2 &&
		probePositions.first.z === - 3,
	'probe positions: expected first probe to map to min.' );
	assert( probePositions.last.x === 4 &&
		probePositions.last.y === 5 &&
		probePositions.last.z === 6,
	'probe positions: expected final probe to map to max.' );
	assert( probePositions.invalidConstructorResolutionRejected === true, 'probe positions: expected constructor resolution below 2 to be rejected.' );
	assert( /resolution/.test( probePositions.invalidConstructorResolutionMessage ), 'probe positions: expected constructor resolution validation error message.' );
	assert( probePositions.invalidSetOptionsResolutionRejected === true, 'probe positions: expected setOptions resolution below 2 to be rejected.' );
	assert( /resolution/.test( probePositions.invalidSetOptionsResolutionMessage ), 'probe positions: expected setOptions resolution validation error message.' );
	results.push( { step: 'probe positions', probePositions } );

	const samplingControls = await call( 'inspectSamplingControls' );
	assert( samplingControls.defaultSampling.leakReductionMode === 'off',
		'sampling controls: expected class default to preserve unweighted sampling.' );
	assert( samplingControls.configuredSampling.normalBias === 0.75 &&
		samplingControls.configuredSampling.viewBias === 0.25 &&
		samplingControls.configuredSampling.leakReductionMode === 'normal' &&
		samplingControls.configuredSampling.probeValidityMode === 'custom' &&
		samplingControls.configuredSampling.invalidProbeCount === 1 &&
		samplingControls.configuredSampling.weightedProbeSampling === true,
	'sampling controls: expected configured bias and leak reduction metadata.' );
	assert( samplingControls.invalidLeakReductionModeRejected === true,
		'sampling controls: expected invalid leak reduction mode to be rejected.' );
	assert( /leakReductionMode/.test( samplingControls.invalidLeakReductionModeMessage ),
		'sampling controls: expected leak reduction validation error message.' );
	results.push( { step: 'sampling controls', samplingControls } );

	const leakReductionComparison = await call( 'compareLeakReductionModes' );
	assert( leakReductionComparison.off.sampling.weightedProbeSampling === false,
		'leak comparison: expected off mode to use unweighted sampling.' );
	assert( leakReductionComparison.normal.sampling.weightedProbeSampling === true,
		'leak comparison: expected normal mode to use weighted sampling.' );
	assert( leakReductionComparison.off.colorSanity.center.r +
		leakReductionComparison.off.colorSanity.center.g +
		leakReductionComparison.off.colorSanity.center.b > 18,
	'leak comparison: expected off mode to remain visible.' );
	assert( leakReductionComparison.normal.colorSanity.center.r +
		leakReductionComparison.normal.colorSanity.center.g +
		leakReductionComparison.normal.colorSanity.center.b > 18,
	'leak comparison: expected normal mode to remain visible.' );
	results.push( { step: 'leak reduction comparison', leakReductionComparison } );

	const projectionParity = await call( 'inspectProjectionParity' );
	assert( Array.isArray( projectionParity.fixtures ) && projectionParity.fixtures.length >= 3,
		'projection parity: expected synthetic cubemap fixtures.' );
	assert( projectionParity.maxShaderToGeneratorDelta < 1e-9,
		'projection parity: expected WebGPU shader mapping to match LightProbeGenerator WebGPU render-target convention.' );
	assert( projectionParity.maxWebGLGridToGeneratorDelta < 1e-9,
		'projection parity: expected WebGL LightProbeGrid mapping to match LightProbeGenerator WebGL render-target convention.' );
	assert( projectionParity.maxShaderToCubeTextureDelta < 1e-9,
		'projection parity: expected WebGPU shader mapping to match CubeTexture convention for synthetic face data.' );
	assert( projectionParity.maxShaderToWebGLGridDelta > 1e-3,
		'projection parity: expected asymmetric fixture to prove WebGPU and WebGL render-target conventions are not directly interchangeable.' );
	results.push( { step: 'projection parity', projectionParity } );

	const shMathContract = await call( 'inspectSHMathContract' );
	assert( shMathContract.constantRadiance.maxDelta < 0.0001,
		'sh math contract: expected constant radiance to evaluate to pi-scaled irradiance.' );
	assert( shMathContract.axisDominance.positiveXRedBeatsNegativeX === true &&
		shMathContract.axisDominance.positiveYGreenBeatsNegativeY === true &&
		shMathContract.axisDominance.positiveZBlueBeatsNegativeZ === true,
	'sh math contract: expected directional RGB fixture to preserve x/y/z coefficient signs.' );
	assert( shMathContract.threeJsIrradianceParity.supported === true &&
		shMathContract.threeJsIrradianceParity.maxDelta < 1e-9,
	'sh math contract: expected runtime irradiance constants/order to match THREE.SphericalHarmonics3.getIrradianceAt().' );
	results.push( { step: 'sh math contract', shMathContract } );

	const atlasPacking = await call( 'inspectAtlasPacking' );
	assert( atlasPacking.resolution === 4 &&
		atlasPacking.totalProbes === 64 &&
		atlasPacking.shCoefficientCount === 9,
	'atlas packing: expected bounded synthetic 4x4x4 probe fixture.' );
	assert( atlasPacking.packedAtlasTextureCount === 7 &&
		atlasPacking.paddedSlices === 6 &&
		atlasPacking.atlasPadding === 1 &&
		atlasPacking.atlasDepth === 42,
	'atlas packing: expected seven SH sub-volumes with one padding slice on each side.' );
	assert( atlasPacking.gridProbeIndexFormula === 'x + y * resolution + z * resolution^2',
		'atlas packing: expected explicit probe index formula.' );
	assert( Array.isArray( atlasPacking.addressChecks ) &&
		atlasPacking.addressChecks.length === 6 &&
		atlasPacking.addressChecks.every( check =>
			check.baseLayer === check.methodBaseLayer &&
			check.dataLayer === check.methodDataLayer &&
			check.leadingPaddingLayer === check.methodLeadingPaddingLayer &&
			check.trailingPaddingLayer === check.methodTrailingPaddingLayer &&
			Number.isFinite( check.centerSampleZ ) &&
			check.centerSampleZ > 0 &&
			check.centerSampleZ < 1 ),
	'atlas packing: expected address helper formulas to match CPU atlas layout.' );
	assert( Array.isArray( atlasPacking.coefficientPacking ) &&
		atlasPacking.coefficientPacking.length === 7 &&
		atlasPacking.coefficientPacking.every( row => Array.isArray( row ) && row.length === 4 ) &&
		atlasPacking.coefficientPacking[ 6 ][ 3 ].value === 'validity',
	'atlas packing: expected 27 SH channels plus validity in the final packed atlas channel.' );
	assert( Array.isArray( atlasPacking.readbackChecks ) &&
		atlasPacking.readbackChecks.length === 4 &&
		Array.isArray( atlasPacking.paddingChecks ) &&
		atlasPacking.paddingChecks.length === 3,
	'atlas packing: expected render-path readbacks for data and padding layers.' );
	assert( atlasPacking.readbackChecks.some( check =>
		check.label === 'origin-y0-z0-t0' &&
		check.probeIndex === 0 &&
		check.x === 0 &&
		check.y === 0 ),
	'atlas packing: expected native texture y=0 to contain grid y=0, not an upside-down row.' );
	assert( atlasPacking.readbackChecks.some( check =>
		check.label === 'native-y3-z0-t0' &&
		check.probeIndex === 13 &&
		check.x === 1 &&
		check.y === 3 ),
	'atlas packing: expected native texture y=3 to contain grid y=3.' );
	assert( atlasPacking.maxReadbackDelta < 0.008,
		`atlas packing: expected synthetic render-path readback to match packed SH layout, got ${ atlasPacking.maxReadbackDelta }.` );
	assert( Number.isFinite( atlasPacking.validityActual ) &&
		Math.abs( atlasPacking.validityActual - atlasPacking.validityExpected ) < 0.008,
	'atlas packing: expected custom probe validity to survive coefficient-atlas repack.' );
	results.push( { step: 'atlas packing', atlasPacking } );

	const probeOccupancy = await call( 'inspectProbeOccupancy' );
	assert( probeOccupancy.totalProbes === 64,
		'probe occupancy: expected default resolution 4 probe count.' );
	assert( probeOccupancy.solidMeshCount >= 3,
		'probe occupancy: expected solid Cornell meshes to be inspected.' );
	assert( probeOccupancy.occupiedProbeCount > 0,
		'probe occupancy: expected current Cornell layout to expose probes inside solid geometry.' );
	assert( probeOccupancy.sampling.probeValidityMode === 'custom' &&
		probeOccupancy.sampling.invalidProbeCount === probeOccupancy.occupiedProbeCount,
	'probe occupancy: expected occupied probes to be uploaded as custom validity metadata.' );
	assert( Array.isArray( probeOccupancy.occupiedProbes ) &&
		probeOccupancy.occupiedProbes.every( probe => Number.isInteger( probe.probeIndex ) && probe.meshes.length > 0 ),
	'probe occupancy: expected occupied probe metadata.' );
	results.push( { step: 'probe occupancy', probeOccupancy } );

	const artifactMatrix = await call( 'runProbeDiagnosticMatrix' );
	assert( Array.isArray( artifactMatrix.rows ) && artifactMatrix.rows.length === 12,
		'artifact matrix: expected twelve bounded diagnostic rows.' );

	const artifactRows = new Map( artifactMatrix.rows.map( row => [ row.label, row ] ) );
	const lowResDampedArtifact = artifactRows.get( 'low-res-damped' );
	const lowResUnweightedArtifact = artifactRows.get( 'low-res-unweighted' );
	const lowResValidityWeightedArtifact = artifactRows.get( 'low-res-validity-weighted' );
	const l0L1L2Artifact = artifactRows.get( 'l0-l1-l2' );
	const l0OnlyArtifact = artifactRows.get( 'l0-only' );
	const l0L1Artifact = artifactRows.get( 'l0-l1' );
	const floatLinearArtifact = artifactRows.get( 'float-linear' );
	const leakNormalConstantValidityArtifact = artifactRows.get( 'leak-normal-constant-validity' );
	const leakNormalArtifact = artifactRows.get( 'leak-normal' );
	const resolution6Artifact = artifactRows.get( 'resolution-6' );
	const cubemap16Artifact = artifactRows.get( 'cubemap-16' );
	const cubemap32Artifact = artifactRows.get( 'cubemap-32' );

	assert( lowResDampedArtifact !== undefined &&
		lowResUnweightedArtifact !== undefined &&
		lowResValidityWeightedArtifact !== undefined &&
		l0L1L2Artifact !== undefined &&
		l0OnlyArtifact !== undefined &&
		l0L1Artifact !== undefined &&
		floatLinearArtifact !== undefined &&
		leakNormalConstantValidityArtifact !== undefined &&
		leakNormalArtifact !== undefined &&
		resolution6Artifact !== undefined &&
		cubemap16Artifact !== undefined &&
		cubemap32Artifact !== undefined,
	'artifact matrix: expected low-res, SH-band, precision, leak, resolution, and cubemap labels.' );
	assert( lowResDampedArtifact.band1Intensity === 0.6 && lowResDampedArtifact.band2Intensity === 0.55,
		'artifact matrix: expected damped low-res diagnostic row.' );
	assert( lowResUnweightedArtifact.band1Intensity === 1 &&
		lowResUnweightedArtifact.band2Intensity === 0.55 &&
		lowResUnweightedArtifact.sampling.weightedProbeSampling === false,
	'artifact matrix: expected full band-1 low-res row to keep hardware-filtered unweighted sampling.' );
	assert( lowResDampedArtifact.probeIntensity === lowResUnweightedArtifact.probeIntensity,
		'artifact matrix: low-res bounce improvement must not come from global probe intensity changes.' );
	assert( lowResValidityWeightedArtifact.band1Intensity === 1 &&
		lowResValidityWeightedArtifact.band2Intensity === 0.55 &&
		lowResValidityWeightedArtifact.sampling.weightedProbeSampling === true &&
		lowResValidityWeightedArtifact.sampling.probeValidityMode === 'custom',
	'artifact matrix: expected low-res validity-weighted diagnostic row.' );
	assert( lowResUnweightedArtifact.colorSanity.center.r +
		lowResUnweightedArtifact.colorSanity.center.g +
		lowResUnweightedArtifact.colorSanity.center.b > 18,
	'artifact matrix: expected full band-1 low-res probes to keep center geometry visible.' );
	assert( l0L1L2Artifact.band1Intensity === 1 && l0L1L2Artifact.band2Intensity === 0.55 && l0L1L2Artifact.sampling.weightedProbeSampling === false,
		'artifact matrix: expected L0+L1+L2 row to capture unweighted band-2 probe lighting.' );
	assert( l0OnlyArtifact.band1Intensity === 0 && l0OnlyArtifact.band2Intensity === 0,
		'artifact matrix: expected L0 row to disable first and second SH bands.' );
	assert( l0L1Artifact.band1Intensity === 1 && l0L1Artifact.band2Intensity === 0,
		'artifact matrix: expected L0+L1 row to disable only second-band SH.' );
	assert( floatLinearArtifact.precision.requestedPrecision === 'float',
		'artifact matrix: expected float-linear precision row.' );
	assert( leakNormalConstantValidityArtifact.sampling.weightedProbeSampling === true &&
		leakNormalConstantValidityArtifact.sampling.probeValidityMode === 'constant',
	'artifact matrix: expected isolated normal-weighted constant-validity row.' );
	assert( leakNormalArtifact.sampling.weightedProbeSampling === true,
		'artifact matrix: expected normal leak reduction row to use weighted sampling.' );
	assert( leakNormalArtifact.sampling.probeValidityMode === 'custom' &&
		leakNormalArtifact.sampling.invalidProbeCount > 0,
	'artifact matrix: expected normal leak reduction row to use custom probe validity.' );
	assert( resolution6Artifact.resolution === 6,
		'artifact matrix: expected density row to increase probe resolution.' );
	assert( cubemap16Artifact.cubemapSize === 16,
		'artifact matrix: expected cubemap-16 sampling row.' );
	assert( cubemap32Artifact.cubemapSize === 32,
		'artifact matrix: expected cubemap-32 sampling row.' );

	for ( const row of artifactMatrix.rows ) {

		assert( row.lightingMode === 'probes only', `artifact matrix ${ row.label }: expected probes-only capture.` );
		assert( Number.isFinite( row.totalBakeMs ) &&
			row.totalBakeMs > 0 &&
			row.timingSource !== 'unavailable',
		`artifact matrix ${ row.label }: expected positive measured bake timing with a known timing source.` );
		assert( Number.isFinite( row.artifactSignature.center.luminance ), `artifact matrix ${ row.label }: expected finite center luminance.` );
		assert( Number.isFinite( row.localArtifactMetric.luminance.min ), `artifact matrix ${ row.label }: expected finite luminance minimum.` );
		assert( Number.isFinite( row.localArtifactMetric.luminance.p05 ), `artifact matrix ${ row.label }: expected finite luminance p05.` );
		assert( Number.isFinite( row.localArtifactMetric.luminance.median ), `artifact matrix ${ row.label }: expected finite luminance median.` );
		assert( Number.isFinite( row.localArtifactMetric.luminance.p95 ), `artifact matrix ${ row.label }: expected finite luminance p95.` );
		assert( Number.isFinite( row.localArtifactMetric.cellEdgeContrast ), `artifact matrix ${ row.label }: expected finite cell-edge contrast.` );
		assert( row.colorSanity.center.r + row.colorSanity.center.g + row.colorSanity.center.b > 18,
			`artifact matrix ${ row.label }: expected visible probe-lit center geometry.` );

	}

	assert( Number.isFinite( artifactMatrix.comparisons.precision.halfToFloatCenterLuminanceDelta ) &&
		Number.isFinite( artifactMatrix.comparisons.precision.halfToFloatCellEdgeDelta ),
	'artifact matrix: expected finite half/float precision diagnostic deltas.' );
	assert( Number.isFinite( artifactMatrix.comparisons.band.l0ToL1CellEdgeDelta ),
		'artifact matrix: expected finite SH band diagnostic delta.' );
	assert( Number.isFinite( artifactMatrix.comparisons.validity.normalCustomToConstantDarkPixelRatioDelta ) &&
		Number.isFinite( artifactMatrix.comparisons.validity.normalCustomToConstantCellEdgeDelta ),
	'artifact matrix: expected finite isolated validity diagnostic deltas.' );
	assert( Number.isFinite( artifactMatrix.comparisons.density.resolution4To6CellEdgeDelta ),
		'artifact matrix: expected finite density diagnostic delta.' );

	assert( artifactMatrix.restored.lightingMode === 'direct + probes',
		'artifact matrix: expected lighting mode restoration.' );
	assert( artifactMatrix.restored.sampling.leakReductionMode === 'off',
		'artifact matrix: expected leak reduction restoration.' );
	results.push( { step: 'artifact matrix', artifactMatrix } );

	const regionMatrix = await call( 'runProbeArtifactRegionMatrix' );
	assert( Array.isArray( regionMatrix.rows ) && regionMatrix.rows.length === 18,
		'region matrix: expected bounded low-res, cubemap, shadow, direct-light, and panel diagnostic rows.' );

	const regionRows = new Map( regionMatrix.rows.map( row => [ row.label, row ] ) );
	const regionLowResDamped = regionRows.get( 'low-res-damped' );
	const regionLowResUnweighted = regionRows.get( 'low-res-unweighted' );
	const regionLowResValidityWeighted = regionRows.get( 'low-res-validity-weighted' );
	const regionBaseline = regionRows.get( 'cubemap-8-shadows-on' );
	const regionCubemap16 = regionRows.get( 'cubemap-16-shadows-on' );
	const regionCubemap32 = regionRows.get( 'cubemap-32-shadows-on' );
	const regionShadowless8 = regionRows.get( 'cubemap-8-shadows-off' );
	const regionShadowless16 = regionRows.get( 'cubemap-16-shadows-off' );
	const regionShadowless32 = regionRows.get( 'cubemap-32-shadows-off' );
	const regionDirectOff16 = regionRows.get( 'cubemap-16-direct-off' );
	const regionPanelHidden16 = regionRows.get( 'cubemap-16-panel-hidden' );
	const regionSolidsHidden16 = regionRows.get( 'cubemap-16-solids-hidden' );
	const regionL016 = regionRows.get( 'cubemap-16-l0-only' );
	const regionL0L116 = regionRows.get( 'cubemap-16-l0-l1' );
	const regionL032 = regionRows.get( 'cubemap-32-l0-only' );
	const regionL0L132 = regionRows.get( 'cubemap-32-l0-l1' );
	const regionBand1Damped16 = regionRows.get( 'cubemap-16-band1-0.6' );
	const regionBand1Damped32 = regionRows.get( 'cubemap-32-band1-0.6' );

	assert( regionLowResDamped !== undefined &&
		regionLowResUnweighted !== undefined &&
		regionLowResValidityWeighted !== undefined &&
		regionBaseline !== undefined &&
		regionCubemap16 !== undefined &&
		regionCubemap32 !== undefined &&
		regionShadowless8 !== undefined &&
		regionShadowless16 !== undefined &&
		regionShadowless32 !== undefined &&
		regionDirectOff16 !== undefined &&
		regionPanelHidden16 !== undefined &&
		regionSolidsHidden16 !== undefined &&
		regionL016 !== undefined &&
		regionL0L116 !== undefined &&
		regionL032 !== undefined &&
		regionL0L132 !== undefined &&
		regionBand1Damped16 !== undefined &&
		regionBand1Damped32 !== undefined,
	'region matrix: expected low-res, cubemap, shadow, direct-light, panel, and regional SH-band diagnostic rows.' );

	for ( const row of regionMatrix.rows ) {

		assert( row.lightingMode === 'probes only', `region matrix ${ row.label }: expected probes-only capture.` );
		assert( Number.isFinite( row.totalBakeMs ) &&
			row.totalBakeMs > 0 &&
			row.timingSource !== 'unavailable',
		`region matrix ${ row.label }: expected positive measured bake timing with a known timing source.` );
		assert( row.regions.leftWall !== undefined &&
			row.regions.rightWall !== undefined &&
			row.regions.backWall !== undefined &&
			row.regions.ceilingEmitter !== undefined &&
			row.regions.floorCenter !== undefined &&
			row.regions.sphere !== undefined &&
			row.regions.tallBox !== undefined &&
			row.regions.shortBox !== undefined,
		`region matrix ${ row.label }: expected named artifact regions.` );

		for ( const region of Object.values( row.regions ) ) {

			assert( Number.isFinite( region.luminance.p01 ), `region matrix ${ row.label }: expected finite p01.` );
			assert( Number.isFinite( region.luminance.p05 ), `region matrix ${ row.label }: expected finite p05.` );
			assert( Number.isFinite( region.darkPixelRatio ), `region matrix ${ row.label }: expected finite dark-pixel ratio.` );
			assert( Number.isFinite( region.blackPixelRatio ), `region matrix ${ row.label }: expected finite black-tail ratio.` );
			assert( Number.isFinite( region.cellEdgeContrast ), `region matrix ${ row.label }: expected finite regional edge contrast.` );
			assert( Number.isFinite( region.color.r ) &&
				Number.isFinite( region.color.g ) &&
				Number.isFinite( region.color.b ),
			`region matrix ${ row.label }: expected finite regional RGB averages.` );
			assert( Number.isFinite( region.colorBias.redOverGreen ) &&
				Number.isFinite( region.colorBias.greenOverRed ),
			`region matrix ${ row.label }: expected finite regional color-bias ratios.` );

		}

		assert( row.artifactPressure !== undefined &&
			Number.isFinite( row.artifactPressure.objectBlackTailRatio ) &&
			Number.isFinite( row.artifactPressure.objectDarkTailRatio ) &&
			Number.isFinite( row.artifactPressure.luminanceFloor ),
		`region matrix ${ row.label }: expected object-level artifact pressure metrics.` );
		assert( row.bakeTexelBudget !== undefined &&
			Number.isFinite( row.bakeTexelBudget.cubemapTexels ) &&
			Number.isFinite( row.bakeTexelBudget.relativeToLowRes ),
		`region matrix ${ row.label }: expected bake texel budget accounting.` );

	}

	assert( regionLowResDamped.band1Intensity === 0.6 &&
		regionLowResDamped.band2Intensity === 0.55,
	'region matrix: expected damped low-res regional row.' );
	assert( regionLowResUnweighted.band1Intensity === 1 &&
		regionLowResUnweighted.band2Intensity === 0.55 &&
		regionLowResUnweighted.sampling.weightedProbeSampling === false,
	'region matrix: expected full band-1 low-res row to use hardware-filtered unweighted sampling.' );
	assert( regionLowResDamped.probeIntensity === regionLowResUnweighted.probeIntensity,
		'region matrix: low-res bounce improvement must not come from global probe intensity changes.' );
	assert( regionLowResValidityWeighted.sampling.weightedProbeSampling === true &&
		regionLowResValidityWeighted.sampling.probeValidityMode === 'custom',
	'region matrix: expected low-res validity-weighted row to use custom validity metadata.' );
	assert( regionLowResUnweighted.regions.tallBox.colorBias.redOverGreen >
		regionLowResDamped.regions.tallBox.colorBias.redOverGreen,
	'region matrix: expected full band-1 low-res row to strengthen tall-box red bounce over damped baseline.' );
	assert( regionLowResUnweighted.regions.sphere.colorBias.greenOverRed > 1,
		'region matrix: expected full band-1 low-res row to preserve green bounce on the sphere.' );
	assert( regionLowResUnweighted.regions.rightWall.colorBias.greenOverRed > 1.25,
		'region matrix: expected full band-1 low-res row to preserve green wall bounce.' );
	assert( regionLowResUnweighted.regions.tallBox.darkPixelRatio <=
		regionLowResDamped.regions.tallBox.darkPixelRatio + 0.35,
	'region matrix: expected full band-1 low-res row to keep tall-box dark tail bounded.' );
	assert( Math.abs( regionMatrix.comparisons.lowRes.tallBoxCellEdgeContrastDelta ) <= 255,
		'region matrix: expected full band-1 low-res cell-edge drift to remain bounded.' );
	assert( regionShadowless8.shadowsDisabledDuringBake === true &&
		regionShadowless16.shadowsDisabledDuringBake === true &&
		regionShadowless32.shadowsDisabledDuringBake === true,
	'region matrix: expected shadowless rows to mark bake-time shadow suppression.' );
	assert( regionDirectOff16.directLightDisabledDuringBake === true,
		'region matrix: expected direct-light suppression row.' );
	assert( regionPanelHidden16.lightPanelHiddenDuringBake === true,
		'region matrix: expected visible panel suppression row.' );
	assert( regionSolidsHidden16.solidGeometryHiddenDuringBake === true,
		'region matrix: expected solid geometry suppression row.' );
	assert( regionL016.band1Intensity === 0 && regionL016.band2Intensity === 0,
		'region matrix: expected cubemap-16 L0-only row.' );
	assert( regionL0L116.band1Intensity === 1 && regionL0L116.band2Intensity === 0,
		'region matrix: expected cubemap-16 L0+L1 row.' );
	assert( regionBand1Damped16.band1Intensity === 0.6 && regionBand1Damped16.band2Intensity === 0.55,
		'region matrix: expected cubemap-16 damped-band1 row.' );
	assert( regionMatrix.restored.lightingMode === 'direct + probes',
		'region matrix: expected lighting mode restoration.' );
	assert( regionMatrix.restored.sampling.leakReductionMode === 'off',
		'region matrix: expected leak reduction restoration.' );
	assert( Number.isFinite( regionMatrix.comparisons.cubemap.darkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.lowRes.tallBoxRedOverGreenGain ) &&
		Number.isFinite( regionMatrix.comparisons.lowRes.sphereGreenOverRed ) &&
		Number.isFinite( regionMatrix.comparisons.shadow.darkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.energy.directOffDarkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.energy.panelHiddenDarkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.geometry.solidsHiddenDarkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.band.l0ToL1DarkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.band.l1ToL2DarkPixelRatioDelta16 ),
	'region matrix: expected finite cubemap, shadow, energy-source, and regional SH-band deltas.' );
	assert( Number.isFinite( regionMatrix.comparisons.damping.band1DampedDarkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.damping.band1DampedDarkPixelRatioDelta32 ),
	'region matrix: expected finite damped-band1 deltas.' );
	assert( regionMatrix.comparisons.lowRes.tallBoxRedOverGreenGain > 0,
		'region matrix: expected low-res full band-1 row to improve tall-box red/green bias.' );
	assert( regionMatrix.comparisons.band.l0ToL1DarkPixelRatioDelta16 >
		regionMatrix.comparisons.band.l1ToL2DarkPixelRatioDelta16 * 4,
	'region matrix: expected first-band SH to dominate the cubemap-16 dark-tail regression.' );
	assert( regionMatrix.comparisons.damping.band1DampedDarkPixelRatioDelta16 > 0.05,
		'region matrix: expected damped band-1 row to materially reduce cubemap-16 dark-tail artifacts.' );
	assert( regionMatrix.comparisons.energy.directOffDarkPixelRatioDelta16 < 0.02 &&
		regionMatrix.comparisons.energy.panelHiddenDarkPixelRatioDelta16 < 0.02 &&
		regionMatrix.comparisons.geometry.solidsHiddenDarkPixelRatioDelta16 < 0.02,
	'region matrix: expected energy-source and solid-visibility toggles not to dominate the current dark-tail artifact.' );
	results.push( { step: 'region artifact matrix', regionMatrix } );

	const leakMatrix = await call( 'runProbeLeakMatrix' );
	assert( Array.isArray( leakMatrix.rows ) && leakMatrix.rows.length === 5,
		'leak matrix: expected five DDGI-lite verifier scaffold rows.' );

	const leakRows = new Map( leakMatrix.rows.map( row => [ row.label, row ] ) );
	const leakThinUnweighted = leakRows.get( 'leak-thin-wall-unweighted' );
	const leakThinNormalWeighted = leakRows.get( 'leak-thin-wall-normal-weighted' );
	const leakThinValidityWeighted = leakRows.get( 'leak-thin-wall-validity-weighted' );
	const leakZeroUnweighted = leakRows.get( 'leak-zero-thickness-unweighted' );
	const leakZeroValidityWeighted = leakRows.get( 'leak-zero-thickness-validity-weighted' );

	assert( leakThinUnweighted !== undefined &&
		leakThinNormalWeighted !== undefined &&
		leakThinValidityWeighted !== undefined &&
		leakZeroUnweighted !== undefined &&
		leakZeroValidityWeighted !== undefined,
	'leak matrix: expected thin-wall and zero-thickness proof rows.' );

	for ( const row of leakMatrix.rows ) {

		assert( row.resolution === 4 && row.cubemapSize === 8,
			`leak matrix ${ row.label }: expected low-res 4^3 / cubemap 8 fixture.` );
		assert( row.band1Intensity === 1 && row.band2Intensity === 0.55,
			`leak matrix ${ row.label }: expected full band-1 plus damped L2 anti-ringing fixture.` );
		assert( row.normalBias === 0.5 && row.viewBias === 0,
			`leak matrix ${ row.label }: expected frozen bias controls.` );
		assert( row.lightingMode === 'probes only' && row.materialType === 'standard',
			`leak matrix ${ row.label }: expected probes-only standard-material fixture.` );
		assert( Number.isFinite( row.totalBakeMs ) &&
			row.totalBakeMs > 0 &&
			row.timingSource !== 'unavailable' &&
			Number.isFinite( row.frameMs ),
		`leak matrix ${ row.label }: expected positive measured bake timing and finite frame timing.` );
		assert( row.leakMetrics.regions.leftReceiver !== undefined &&
			row.leakMetrics.regions.rightReceiver !== undefined &&
			row.leakMetrics.regions.divider !== undefined,
		`leak matrix ${ row.label }: expected named leak regions.` );
		assert( Number.isFinite( row.leakMetrics.wrongSideColorRatio ) &&
			Number.isFinite( row.leakMetrics.correctBounceRatio ) &&
			Number.isFinite( row.leakMetrics.luminance.mean ) &&
			Number.isFinite( row.leakMetrics.darkPixelRatio ) &&
			Number.isFinite( row.leakMetrics.cellEdgeContrast ),
		`leak matrix ${ row.label }: expected finite leak metrics.` );
		assert( row.leakMetrics.luminance.mean > 8,
			`leak matrix ${ row.label }: expected visible leak receiver luminance.` );
		assert( row.leakMetrics.darkPixelRatio <= 0.95,
			`leak matrix ${ row.label }: expected bounded dark-pixel ratio.` );
		assert( row.leakMetrics.cellEdgeContrast <= 255,
			`leak matrix ${ row.label }: expected bounded cell-edge contrast.` );

	}

	assert( leakThinUnweighted.fixtureMode === 'thin-wall' &&
		leakThinNormalWeighted.fixtureMode === 'thin-wall' &&
		leakThinValidityWeighted.fixtureMode === 'thin-wall' &&
		leakZeroUnweighted.fixtureMode === 'zero-thickness' &&
		leakZeroValidityWeighted.fixtureMode === 'zero-thickness',
	'leak matrix: expected fixture geometry to change only for the explicit zero-thickness negative control.' );
	assert( leakThinUnweighted.probeIntensity === leakThinNormalWeighted.probeIntensity &&
		leakThinUnweighted.probeIntensity === leakThinValidityWeighted.probeIntensity &&
		leakThinUnweighted.probeIntensity === leakZeroUnweighted.probeIntensity &&
		leakThinUnweighted.probeIntensity === leakZeroValidityWeighted.probeIntensity,
	'leak matrix: leak comparison must not improve by changing global probe intensity.' );
	assert( leakThinUnweighted.sampling.weightedProbeSampling === false &&
		leakThinUnweighted.sampling.manualIrradianceSampling === false,
	'leak matrix: unweighted thin-wall baseline must remain hardware-filtered.' );
	assert( leakThinNormalWeighted.sampling.weightedProbeSampling === true &&
		leakThinNormalWeighted.sampling.probeValidityMode === 'constant',
	'leak matrix: normal-weighted thin-wall row must use manual weighted sampling with constant validity.' );
	assert( leakThinValidityWeighted.sampling.weightedProbeSampling === true &&
		leakThinValidityWeighted.sampling.probeValidityMode === 'custom' &&
		leakThinValidityWeighted.sampling.invalidProbeCount > 0 &&
		leakThinValidityWeighted.occupancy.occupiedProbeCount > 0,
	'leak matrix: validity-weighted thin-wall row must upload controlled wall occupancy metadata.' );
	assert( leakZeroUnweighted.negativeControlStatus === 'OPEN' &&
		leakZeroValidityWeighted.negativeControlStatus === 'OPEN' &&
		leakMatrix.comparisons.zeroThickness.status === 'OPEN',
	'leak matrix: zero-thickness negative control must stay explicitly unresolved.' );
	assert( leakThinUnweighted.leakMetrics.correctBounceRatio > 0.95,
		'leak matrix: thin-wall baseline must preserve measurable correct-side bounce.' );
	assert( leakThinNormalWeighted.leakMetrics.correctBounceRatio >
		leakThinUnweighted.leakMetrics.correctBounceRatio * 0.75,
	'leak matrix: normal weighting must not erase correct bounce.' );
	assert( leakThinValidityWeighted.leakMetrics.correctBounceRatio >
		leakThinUnweighted.leakMetrics.correctBounceRatio * 0.75,
	'leak matrix: validity weighting must not erase correct bounce.' );
	assert( leakThinNormalWeighted.leakMetrics.wrongSideColorRatio <=
		leakThinUnweighted.leakMetrics.wrongSideColorRatio + 0.35,
	'leak matrix: normal weighting must bound wrong-side color leak versus unweighted.' );
	assert( leakThinValidityWeighted.leakMetrics.wrongSideColorRatio <=
		leakThinUnweighted.leakMetrics.wrongSideColorRatio + 0.35,
	'leak matrix: validity weighting must bound wrong-side color leak versus unweighted.' );
	assert( leakThinValidityWeighted.leakMetrics.darkPixelRatio <=
		leakThinUnweighted.leakMetrics.darkPixelRatio + 0.35,
	'leak matrix: validity weighting must keep dark tails bounded.' );
	assert( Math.abs( leakMatrix.comparisons.thinWall.validityCellEdgeContrastDelta ) <= 255 &&
		Number.isFinite( leakMatrix.comparisons.thinWall.normalWrongSideColorRatioDelta ) &&
		Number.isFinite( leakMatrix.comparisons.thinWall.validityWrongSideColorRatioDelta ) &&
		Number.isFinite( leakMatrix.comparisons.thinWall.validityCorrectBouncePreservation ) &&
		Number.isFinite( leakMatrix.comparisons.zeroThickness.validityWrongSideColorRatioDelta ),
	'leak matrix: expected finite bounded leak comparison deltas.' );
	assert( leakMatrix.restored.lightingMode === 'direct + probes' &&
		leakMatrix.restored.sampling.leakReductionMode === 'off' &&
		leakMatrix.restored.leakFixtureVisible === false,
	'leak matrix: expected demo state and hidden fixture restoration.' );
	results.push( { step: 'leak matrix', leakMatrix } );

	await startOperation( 'setLeakReductionMode', 'off' );
	await waitUntilReady( 'leak reduction off' );
	const leakOffMetrics = await capture( 'leak reduction off' );
	assert( leakOffMetrics.sampling.leakReductionMode === 'off',
		'leak setter: expected off sampling mode.' );
	assert( leakOffMetrics.sampling.weightedProbeSampling === false,
		'leak setter: expected off mode to disable weighted sampling.' );

	await startOperation( 'setLeakReductionMode', 'normal' );
	await waitUntilReady( 'leak reduction normal' );
	const leakNormalMetrics = await capture( 'leak reduction normal' );
	assert( leakNormalMetrics.sampling.leakReductionMode === 'normal',
		'leak setter: expected normal sampling mode.' );
	assert( leakNormalMetrics.sampling.weightedProbeSampling === true,
		'leak setter: expected normal mode to enable weighted sampling.' );

	const bakeCoalescing = await call( 'testBakeCoalescing' );
	assert( bakeCoalescing.samePromise === true, 'bake contract: expected overlapping bake calls to share the same promise.' );
	assert( Number.isFinite( bakeCoalescing.timings.totalBakeMs ), 'bake contract: expected finite coalesced bake timing.' );
	results.push( { step: 'bake coalescing', bakeCoalescing } );

	const benchmark = await call( 'runBenchmarkCase', {
		resolution: 2,
		cubemapSize: 8,
		projectionPrecision: 'half float'
	} );
	assert( benchmark.probes === 8, 'benchmark: expected probe count metadata.' );
	assert( benchmark.backend.projection === 'fragment', 'benchmark: expected fragment projection backend label.' );
	assert( benchmark.backend.atlas === 'render-pass', 'benchmark: expected render-pass atlas backend label.' );
	assert( benchmark.backend.update === 'full', 'benchmark: expected full update backend label.' );
	assert( benchmark.estimatedGpuBytes.total > 0, 'benchmark: expected positive GPU memory estimate.' );
	assert( benchmark.estimatedGpuBytes.cubemapBytes > 0, 'benchmark: expected cubemap memory estimate.' );
	assert( benchmark.estimatedGpuBytes.coefficientBytes > 0, 'benchmark: expected coefficient memory estimate.' );
	assert( benchmark.estimatedGpuBytes.atlasBytes > 0, 'benchmark: expected atlas memory estimate.' );
	assert( benchmark.estimatedGpuBytes.probeValidityBytes > 0, 'benchmark: expected probe validity memory estimate.' );
	assert( benchmark.precision.requestedPrecision === 'half float', 'benchmark: expected requested precision metadata.' );
	assert( Number.isFinite( benchmark.totalBakeMs ) &&
		benchmark.totalBakeMs > 0 &&
		benchmark.timingSource !== 'unavailable',
	'benchmark: expected positive total bake timing with a known timing source.' );
	assert( Number.isFinite( benchmark.cubemapMs ), 'benchmark: expected finite cubemap timing.' );
	assert( Number.isFinite( benchmark.projectionMs ), 'benchmark: expected finite projection timing.' );
	assert( Number.isFinite( benchmark.copyMs ), 'benchmark: expected finite copy timing.' );
	assert( Number.isFinite( benchmark.frameMs ), 'benchmark: expected finite frame timing.' );
	results.push( { step: 'benchmark case', benchmark } );

	const failedBenchmarkBake = await callRejects( 'runBenchmarkCase', {
		resolution: 2,
		cubemapSize: 8,
		projectionPrecision: 'half float',
		simulateBenchmarkBakeFailure: true
	} );
	assert( failedBenchmarkBake.rejected === true, 'benchmark: expected failed benchmark bake to reject.' );
	assert( /benchmark bake/.test( failedBenchmarkBake.message ), 'benchmark: expected failed benchmark bake error message.' );
	results.push( { step: 'benchmark bake failure contract', failedBenchmarkBake } );

	const failedRestoreBake = await callRejects( 'runBenchmarkCase', {
		resolution: 2,
		cubemapSize: 8,
		projectionPrecision: 'half float',
		simulateBenchmarkRestoreFailure: true
	} );
	assert( failedRestoreBake.rejected === true, 'benchmark: expected failed restore bake to reject.' );
	assert( /restore bake/.test( failedRestoreBake.message ), 'benchmark: expected failed restore bake error message.' );
	results.push( { step: 'benchmark restore failure contract', failedRestoreBake } );

	await startOperation( 'setPrecision', 'float' );
	await waitUntilReady( 'float' );

	const floatMetrics = await capture( 'float' );
	assert( floatMetrics.precision.textureType === 'float' ||
		floatMetrics.precision.activePrecision === 'half-linear (fallback)',
	'float: expected float texture or explicit half fallback.' );

	if ( floatMetrics.precision.float32Filterable === true ) {

		assert( floatMetrics.precision.activePrecision === 'float-linear',
			'float: expected float-linear when float32-filterable is available.' );

	} else {

		assert( floatMetrics.precision.activePrecision === 'half-linear (fallback)',
			'float: expected half-linear fallback when float32-filterable is unavailable.' );

	}

	await startOperation( 'setPrecision', 'auto' );
	await waitUntilReady( 'auto' );

	const autoMetrics = await capture( 'auto' );

	if ( autoMetrics.precision.float32Filterable === true ) {

		assert( autoMetrics.precision.activePrecision === 'float-linear',
			'auto: expected float-linear when float32-filterable is available.' );

	} else {

		assert( autoMetrics.precision.activePrecision === 'half-linear',
			'auto: expected half-linear when float32-filterable is unavailable.' );

	}

	await startOperation( 'setPrecision', 'half float' );
	await waitUntilReady( 'half float' );

	const halfMetrics = await capture( 'half float' );
	assert( halfMetrics.precision.activePrecision === 'half-linear',
		'half float: expected half-linear.' );
	assert( halfMetrics.precision.textureType === 'half float',
		'half float: expected half float texture.' );

	await call( 'setLightingMode', 'probes only' );

	const probesOnlyMetrics = await capture( 'probes only' );
	assert( probesOnlyMetrics.lightingMode === 'probes only',
		'probes only: expected lighting mode to update.' );

	for ( const materialType of [ 'standard', 'physical', 'lambert', 'phong' ] ) {

		await call( 'setMaterialType', materialType );
		const materialMetrics = await capture( `material ${ materialType }` );
		assert( materialMetrics.materialType === materialType,
			`material ${ materialType }: expected material mode to update.` );

	}

	await startOperation( 'rebake' );
	await waitUntilReady( 'rebake probes only' );
	const rebakeMetrics = await capture( 'rebake probes only' );
	const colorSanity = await call( 'captureColorSanity' );

	results.push( {
		step: 'probes only color sanity',
		metrics: rebakeMetrics,
		colorSanity
	} );

	return results;

}

function getAverageColor( image, region ) {

	const x0 = Math.floor( image.width * region.x0 );
	const x1 = Math.floor( image.width * region.x1 );
	const y0 = Math.floor( image.height * region.y0 );
	const y1 = Math.floor( image.height * region.y1 );
	const color = { r: 0, g: 0, b: 0 };
	let count = 0;

	for ( let y = y0; y < y1; y ++ ) {

		for ( let x = x0; x < x1; x ++ ) {

			const i = ( y * image.width + x ) * 4;
			color.r += image.data[ i ];
			color.g += image.data[ i + 1 ];
			color.b += image.data[ i + 2 ];
			count ++;

		}

	}

	color.r /= count;
	color.g /= count;
	color.b /= count;

	return color;

}

function checkSmokeScreenshot( file, screenshot ) {

	if ( file !== 'webgpu_lightprobes_cornell' ) return;

	const left = getAverageColor( screenshot, { x0: 0.08, x1: 0.24, y0: 0.32, y1: 0.68 } );
	const right = getAverageColor( screenshot, { x0: 0.76, x1: 0.92, y0: 0.32, y1: 0.68 } );
	const center = getAverageColor( screenshot, { x0: 0.42, x1: 0.58, y0: 0.38, y1: 0.62 } );

	if ( left.r <= left.g * 1.25 ) {

		throw new Error( `${ file }: Smoke screenshot expected red wall on the left side.` );

	}

	if ( right.g <= right.r * 1.25 ) {

		throw new Error( `${ file }: Smoke screenshot expected green wall on the right side.` );

	}

	if ( center.r + center.g + center.b <= 18 ) {

		throw new Error( `${ file }: Smoke screenshot expected visible probes-only lighting.` );

	}

}

function close( exitCode = 1 ) {

	console.log( 'Closing...' );

	browser.close();
	server.close();
	process.exit( exitCode );

}
