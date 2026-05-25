import puppeteer from 'puppeteer';
import { Image } from './image.js';
import * as fs from 'fs/promises';
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

async function checkSmokeSourceInvariants( file, smokeHarness ) {

	if ( file !== 'webgpu_lightprobes_cornell' ) return;

	const [ example, source ] = await Promise.all( [
		fs.readFile( smokeHarness.example, 'utf8' ),
		fs.readFile( smokeHarness.source, 'utf8' )
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
			/atlasLoad\.load\( this\._getPackedAtlasLoadCoord/.test( source ),
		'Atlas sample/load/repack/helper paths must use centralized atlas address helpers.'
	);

	requireSource(
		/probeCoord\.x\.mul\( resolutionMinusOne \)\.add\( 0\.5 \)\.div\( resolution \)/.test( source ) &&
			/probeCoord\.y\.mul\( resolutionMinusOne \)\.add\( 0\.5 \)\.div\( resolution \)/.test( source ) &&
			/probeCoord\.z\.mul\( resolutionMinusOne \)\.add\( 0\.5 \)\.div\( resolution \)/.test( source ),
		'Hardware-filtered atlas sampling must center X/Y/Z coordinates on probe texels before blending.'
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
			example.includes( 'band2Intensity: 0.55' ),
		'Probe irradiance must expose diagnostic band-1 and band-2 controls so SH ringing can be isolated from probe blending.'
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
		example.includes( 'createLocalArtifactMetric' ) &&
			example.includes( 'captureRegionArtifactMetrics' ) &&
			example.includes( 'runProbeArtifactRegionMatrix' ) &&
			example.includes( 'darkPixelRatio' ) &&
			example.includes( 'shadows-off' ) &&
			example.includes( 'ceilingEmitter' ) &&
			example.includes( 'cellEdgeContrast' ) &&
			example.includes( 'runProbeDiagnosticMatrix' ) &&
			example.includes( 'float-manual' ) &&
			example.includes( 'l0-only' ) &&
			example.includes( 'l0-l1-l2' ) &&
			example.includes( 'resolution-6' ) &&
			example.includes( 'cubemap-32' ),
		'Cornell harness must expose sampler, SH-band, density, and local artifact diagnostics without adding primary UI knobs.'
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
			source.includes( 'getSamplingInfo()' ) &&
			source.includes( '_usesWeightedProbeSampling()' ) &&
			source.includes( 'probeValidityMode: \'constant\'' ) &&
			source.includes( 'wrapShading' ) &&
			source.includes( 'validityWeight' ) &&
			source.includes( 'packed.assign( vec4( c8.x, c8.y, c8.z, 1.0 ) )' ) &&
			source.includes( 'c0Luminance' ) === false &&
			example.includes( 'leakReductionMode: \'off\'' ),
		'Probe sampling must expose scoped normal-weighted leak reduction without deriving probe validity from brightness.'
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
		source.includes( 'requested === \'float manual\'' ) &&
			source.includes( 'this.activeProjectionPrecision = hasFloatFiltering ? \'float-linear\' : \'half-linear (fallback)\'' ),
		'PR01 float precision must avoid implicit float-manual fallback.'
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

		for ( const method of [ 'waitUntilReady', 'getMetrics', 'setPrecision', 'setLightingMode', 'setMaterialType', 'setLeakReductionMode', 'rebake', 'captureColorSanity', 'inspectAddonContract', 'inspectProbePositions', 'inspectSamplingControls', 'inspectProjectionParity', 'compareLeakReductionModes', 'runArtifactMatrix', 'runProbeDiagnosticMatrix', 'runProbeArtifactRegionMatrix', 'testBakeCoalescing', 'runBenchmarkCase', 'runBenchmarkMatrix' ] ) {

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
		samplingControls.configuredSampling.probeValidityMode === 'constant' &&
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

	const artifactMatrix = await call( 'runProbeDiagnosticMatrix' );
	assert( Array.isArray( artifactMatrix.rows ) && artifactMatrix.rows.length === 9,
		'artifact matrix: expected nine bounded diagnostic rows.' );

	const artifactRows = new Map( artifactMatrix.rows.map( row => [ row.label, row ] ) );
	const l0L1L2Artifact = artifactRows.get( 'l0-l1-l2' );
	const l0OnlyArtifact = artifactRows.get( 'l0-only' );
	const l0L1Artifact = artifactRows.get( 'l0-l1' );
	const floatLinearArtifact = artifactRows.get( 'float-linear' );
	const floatManualArtifact = artifactRows.get( 'float-manual' );
	const leakNormalArtifact = artifactRows.get( 'leak-normal' );
	const resolution6Artifact = artifactRows.get( 'resolution-6' );
	const cubemap16Artifact = artifactRows.get( 'cubemap-16' );
	const cubemap32Artifact = artifactRows.get( 'cubemap-32' );

	assert( l0L1L2Artifact !== undefined &&
		l0OnlyArtifact !== undefined &&
		l0L1Artifact !== undefined &&
		floatLinearArtifact !== undefined &&
		floatManualArtifact !== undefined &&
		leakNormalArtifact !== undefined &&
		resolution6Artifact !== undefined &&
		cubemap16Artifact !== undefined &&
		cubemap32Artifact !== undefined,
	'artifact matrix: expected baseline, SH-band, sampler, leak, resolution, and cubemap labels.' );
	assert( l0L1L2Artifact.band1Intensity === 1 && l0L1L2Artifact.band2Intensity === 0.55 && l0L1L2Artifact.sampling.weightedProbeSampling === false,
		'artifact matrix: expected L0+L1+L2 row to capture unweighted band-2 probe lighting.' );
	assert( l0OnlyArtifact.band1Intensity === 0 && l0OnlyArtifact.band2Intensity === 0,
		'artifact matrix: expected L0 row to disable first and second SH bands.' );
	assert( l0L1Artifact.band1Intensity === 1 && l0L1Artifact.band2Intensity === 0,
		'artifact matrix: expected L0+L1 row to disable only second-band SH.' );
	assert( floatLinearArtifact.precision.requestedPrecision === 'float',
		'artifact matrix: expected float-linear precision row.' );
	assert( floatManualArtifact.projectionPrecision === 'float manual' &&
		floatManualArtifact.precision.manualFloatSampling === true,
	'artifact matrix: expected float-manual same-atlas sampling row.' );
	assert( leakNormalArtifact.sampling.weightedProbeSampling === true,
		'artifact matrix: expected normal leak reduction row to use weighted sampling.' );
	assert( resolution6Artifact.resolution === 6,
		'artifact matrix: expected density row to increase probe resolution.' );
	assert( cubemap16Artifact.cubemapSize === 16,
		'artifact matrix: expected cubemap-16 sampling row.' );
	assert( cubemap32Artifact.cubemapSize === 32,
		'artifact matrix: expected cubemap-32 sampling row.' );

	for ( const row of artifactMatrix.rows ) {

		assert( row.lightingMode === 'probes only', `artifact matrix ${ row.label }: expected probes-only capture.` );
		assert( Number.isFinite( row.totalBakeMs ), `artifact matrix ${ row.label }: expected finite bake timing.` );
		assert( Number.isFinite( row.artifactSignature.center.luminance ), `artifact matrix ${ row.label }: expected finite center luminance.` );
		assert( Number.isFinite( row.localArtifactMetric.luminance.min ), `artifact matrix ${ row.label }: expected finite luminance minimum.` );
		assert( Number.isFinite( row.localArtifactMetric.luminance.p05 ), `artifact matrix ${ row.label }: expected finite luminance p05.` );
		assert( Number.isFinite( row.localArtifactMetric.luminance.median ), `artifact matrix ${ row.label }: expected finite luminance median.` );
		assert( Number.isFinite( row.localArtifactMetric.luminance.p95 ), `artifact matrix ${ row.label }: expected finite luminance p95.` );
		assert( Number.isFinite( row.localArtifactMetric.cellEdgeContrast ), `artifact matrix ${ row.label }: expected finite cell-edge contrast.` );
		assert( row.colorSanity.center.r + row.colorSanity.center.g + row.colorSanity.center.b > 18,
			`artifact matrix ${ row.label }: expected visible probe-lit center geometry.` );

	}

	assert( Number.isFinite( artifactMatrix.comparisons.sampler.centerLuminanceDelta ),
		'artifact matrix: expected finite sampler parity delta.' );
	assert( Number.isFinite( artifactMatrix.comparisons.band.l0ToL1CellEdgeDelta ),
		'artifact matrix: expected finite SH band diagnostic delta.' );
	assert( Number.isFinite( artifactMatrix.comparisons.density.resolution4To6CellEdgeDelta ),
		'artifact matrix: expected finite density diagnostic delta.' );

	assert( artifactMatrix.restored.lightingMode === 'direct + probes',
		'artifact matrix: expected lighting mode restoration.' );
	assert( artifactMatrix.restored.sampling.leakReductionMode === 'off',
		'artifact matrix: expected leak reduction restoration.' );
	results.push( { step: 'artifact matrix', artifactMatrix } );

	const regionMatrix = await call( 'runProbeArtifactRegionMatrix' );
	assert( Array.isArray( regionMatrix.rows ) && regionMatrix.rows.length === 6,
		'region matrix: expected bounded cubemap and shadow diagnostic rows.' );

	const regionRows = new Map( regionMatrix.rows.map( row => [ row.label, row ] ) );
	const regionBaseline = regionRows.get( 'cubemap-8-shadows-on' );
	const regionCubemap16 = regionRows.get( 'cubemap-16-shadows-on' );
	const regionCubemap32 = regionRows.get( 'cubemap-32-shadows-on' );
	const regionShadowless8 = regionRows.get( 'cubemap-8-shadows-off' );
	const regionShadowless16 = regionRows.get( 'cubemap-16-shadows-off' );
	const regionShadowless32 = regionRows.get( 'cubemap-32-shadows-off' );

	assert( regionBaseline !== undefined &&
		regionCubemap16 !== undefined &&
		regionCubemap32 !== undefined &&
		regionShadowless8 !== undefined &&
		regionShadowless16 !== undefined &&
		regionShadowless32 !== undefined,
	'region matrix: expected cubemap 8/16/32 rows with shadows on and off.' );

	for ( const row of regionMatrix.rows ) {

		assert( row.lightingMode === 'probes only', `region matrix ${ row.label }: expected probes-only capture.` );
		assert( Number.isFinite( row.totalBakeMs ), `region matrix ${ row.label }: expected finite bake timing.` );
		assert( row.regions.leftWall !== undefined &&
			row.regions.rightWall !== undefined &&
			row.regions.backWall !== undefined &&
			row.regions.ceilingEmitter !== undefined &&
			row.regions.floorCenter !== undefined &&
			row.regions.sphere !== undefined &&
			row.regions.tallBox !== undefined,
		`region matrix ${ row.label }: expected named artifact regions.` );

		for ( const region of Object.values( row.regions ) ) {

			assert( Number.isFinite( region.luminance.p01 ), `region matrix ${ row.label }: expected finite p01.` );
			assert( Number.isFinite( region.luminance.p05 ), `region matrix ${ row.label }: expected finite p05.` );
			assert( Number.isFinite( region.darkPixelRatio ), `region matrix ${ row.label }: expected finite dark-pixel ratio.` );
			assert( Number.isFinite( region.cellEdgeContrast ), `region matrix ${ row.label }: expected finite regional edge contrast.` );

		}

	}

	assert( regionShadowless8.shadowsDisabledDuringBake === true &&
		regionShadowless16.shadowsDisabledDuringBake === true &&
		regionShadowless32.shadowsDisabledDuringBake === true,
	'region matrix: expected shadowless rows to mark bake-time shadow suppression.' );
	assert( regionMatrix.restored.lightingMode === 'direct + probes',
		'region matrix: expected lighting mode restoration.' );
	assert( regionMatrix.restored.sampling.leakReductionMode === 'off',
		'region matrix: expected leak reduction restoration.' );
	assert( Number.isFinite( regionMatrix.comparisons.cubemap.darkPixelRatioDelta16 ) &&
		Number.isFinite( regionMatrix.comparisons.shadow.darkPixelRatioDelta16 ),
	'region matrix: expected finite cubemap and shadow deltas.' );
	results.push( { step: 'region artifact matrix', regionMatrix } );

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
	assert( benchmark.precision.requestedPrecision === 'half float', 'benchmark: expected requested precision metadata.' );
	assert( Number.isFinite( benchmark.totalBakeMs ), 'benchmark: expected finite total bake timing.' );
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
		assert( floatMetrics.precision.manualFloatSampling === false,
			'float: expected hardware filtering when float32-filterable is available.' );

	} else {

		assert( floatMetrics.precision.activePrecision === 'half-linear (fallback)',
			'float: expected half-linear fallback when float32-filterable is unavailable.' );
		assert( floatMetrics.precision.manualFloatSampling === false,
			'float: expected PR01 to avoid manual sampling fallback.' );

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
