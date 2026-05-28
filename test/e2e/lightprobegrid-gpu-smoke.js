import { runLightProbeGridGpuCoreSmokeAssertions } from './lightprobegrid-gpu-runner-core-assertions.js';
import { runLightProbeGridGpuMatrixSmokeAssertions } from './lightprobegrid-gpu-runner-matrix-assertions.js';
import { runLightProbeGridGpuProofGateAssertions } from './lightprobegrid-gpu-proof-gates.js';
import { runLightProbeGridGpuRuntimeSmokeAssertions } from './lightprobegrid-gpu-runner-runtime-assertions.js';
import { runLightProbeGridGpuVisibilitySmokeAssertions } from './lightprobegrid-gpu-runner-visibility-assertions.js';

export async function runSmokeHarness( page, file, smokeHarness ) {

	await page.evaluate( ( file, smokeHarness ) => {

		const harness = window[ smokeHarness.global ];

		if ( harness === undefined ) {

			throw new Error( `${ file }: Smoke harness ${ smokeHarness.global } was not installed.` );

		}

		for ( const method of [ 'waitUntilReady', 'getMetrics', 'setPrecision', 'setLightingMode', 'setMaterialType', 'setLeakReductionMode', 'rebake', 'captureColorSanity', 'inspectAddonContract', 'inspectProbePositions', 'inspectSamplingControls', 'inspectProjectionParity', 'inspectComputeProjectionRuntimeParity', 'inspectSHMathContract', 'inspectAtlasPacking', 'inspectVisibilityDepthMoments', 'inspectVisibilityWeightingAtLeakReceivers', 'inspectProbeOccupancy', 'compareLeakReductionModes', 'captureLeakProofFacts', 'applyGroundingParitySnapshot', 'restoreGroundingParitySnapshot', 'testBakeCoalescing', 'runBenchmarkCase', 'runBenchmarkMatrix' ] ) {

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

	await runLightProbeGridGpuCoreSmokeAssertions( { call, assert, results } );
	await runLightProbeGridGpuVisibilitySmokeAssertions( { call, assert, results } );
	await runLightProbeGridGpuMatrixSmokeAssertions( { call, assert, results } );
	await runLightProbeGridGpuRuntimeSmokeAssertions( {
		call,
		callRejects,
		capture,
		startOperation,
		waitUntilReady,
		assert,
		results
	} );
	runLightProbeGridGpuProofGateAssertions( { assert, results } );

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

export function checkSmokeScreenshot( file, screenshot ) {

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
