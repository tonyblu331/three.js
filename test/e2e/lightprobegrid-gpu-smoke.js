import { runLightProbeGridGpuCoreSmokeAssertions } from './lightprobegrid-gpu-runner-core-assertions.js';
import { runLightProbeGridGpuMatrixSmokeAssertions } from './lightprobegrid-gpu-runner-matrix-assertions.js';
import { runLightProbeGridGpuPlacementAuthoringInvariantAssertions } from './lightprobegrid-gpu-placement-authoring-invariants.js';
import { runLightProbeGridGpuProofGateAssertions } from './lightprobegrid-gpu-proof-gates.js';
import { runLightProbeGridGpuRuntimeSmokeAssertions } from './lightprobegrid-gpu-runner-runtime-assertions.js';
import { runLightProbeGridGpuSourceInvariantAssertions } from './lightprobegrid-gpu-source-invariants.js';
import { runLightProbeGridGpuVisibilitySmokeAssertions } from './lightprobegrid-gpu-runner-visibility-assertions.js';

export async function runSmokeHarness( page, file, smokeHarness ) {

	const traceE2E = process.env.THREEJS_E2E_TRACE === '1';
	const trace = message => {

		if ( traceE2E ) console.log( `[E2E trace] ${ message }` );

	};

	await page.evaluate( ( file, smokeHarness ) => {

		const harness = window[ smokeHarness.global ];

		if ( harness === undefined ) {

			throw new Error( `${ file }: Smoke harness ${ smokeHarness.global } was not installed.` );

		}

		for ( const method of [ 'waitUntilReady', 'getMetrics', 'inspectProbePositions', 'rebake' ] ) {

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

	const getMetrics = async () => await call( 'getMetrics' );
	const hasMethod = async method => await page.evaluate(
		( globalName, method ) => typeof window[ globalName ][ method ] === 'function',
		smokeHarness.global,
		method
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

	runLightProbeGridGpuSourceInvariantAssertions( { assert } );
	runLightProbeGridGpuPlacementAuthoringInvariantAssertions();

	const waitUntilReady = async ( step ) => {

		for ( let i = 0; i < 240; i ++ ) {

			const pendingState = await getPendingState();
			const metrics = await getMetrics();

			if ( pendingState.status === 'rejected' ) throw new Error( `${ file }: ${ step }: ${ pendingState.message }` );
			if ( metrics.status === 'failed' ) throw new Error( `${ file }: ${ step }: LightProbeGridGPU bake failed.` );
			if ( metrics.status === 'ready' && pendingState.status !== 'pending' ) return;

			await new Promise( resolve => setTimeout( resolve, 250 ) );

		}

		throw new Error( `${ file }: ${ step }: LightProbeGridGPU bake timed out.` );

	};

	const capture = async ( step ) => {

		const metrics = await getMetrics();

		assertCommonMetrics( assert, metrics, step );
		results.push( { step, metrics } );

		return metrics;

	};

	const results = [];

	trace( `${ file}: wait initial ready` );
	await waitUntilReady( 'initial' );

	trace( `${ file}: get initial metrics` );
	const initial = await getMetrics();
	assertCommonMetrics( assert, initial, 'initial' );

	trace( `${ file}: inspect probe positions` );
	const positions = await call( 'inspectProbePositions' );
	assertProbePositions( assert, positions );

	trace( `${ file}: rebake` );
	await call( 'rebake' );
	const rebaked = await getMetrics();
	assertCommonMetrics( assert, rebaked, 'rebake' );

	if ( Number.isFinite( initial.bakeCount ) && Number.isFinite( rebaked.bakeCount ) ) {

		assert( rebaked.bakeCount >= initial.bakeCount + 1, 'rebake: expected bake count to advance.' );

	}

	results.push(
		{ step: 'initial', metrics: initial },
		{ step: 'rebake', metrics: rebaked }
	);

	if ( smokeHarness.capabilities?.includes( 'proof-contracts' ) === true ) {

		trace( `${ file}: core assertions` );
		await runLightProbeGridGpuCoreSmokeAssertions( { call, assert, results } );
		trace( `${ file}: visibility assertions` );
		await runLightProbeGridGpuVisibilitySmokeAssertions( { call, assert, results } );
		trace( `${ file}: matrix assertions` );
		await runLightProbeGridGpuMatrixSmokeAssertions( { call, assert, results } );
		trace( `${ file}: runtime assertions` );
		await runLightProbeGridGpuRuntimeSmokeAssertions( {
			call,
			callRejects,
			capture,
			startOperation,
			waitUntilReady,
			assert,
			results
		} );
		trace( `${ file}: proof gate assertions` );
		runLightProbeGridGpuProofGateAssertions( { assert, results } );

	}

	if ( smokeHarness.capabilities?.includes( 'sealed-wall-leak' ) === true && await hasMethod( 'captureLeakProofFacts' ) ) {

		const existingLeakProofResult = results.find( result => result.step === 'leak proof facts' );
		trace( `${ file}: ${ existingLeakProofResult === undefined ? 'capture' : 'reuse' } leak proof facts` );
		const leakProofFacts = existingLeakProofResult?.leakProofFacts ?? await call( 'captureLeakProofFacts' );
		trace( `${ file}: assert leak proof facts` );
		assertLeakProofFacts( assert, leakProofFacts );
		results.push( { step: 'sealed-wall leak proof', leakProofFacts } );

	}

	if ( smokeHarness.capabilities?.includes( 'placement-authoring-usage' ) === true ) {

		assert(
			await hasMethod( 'inspectPlacementAuthoringUsageFacts' ),
			'placement authoring usage: expected inspectPlacementAuthoringUsageFacts().'
		);
		trace( `${ file}: placement authoring usage facts` );
		const placementAuthoringUsageFacts = await call( 'inspectPlacementAuthoringUsageFacts' );
		assertPlacementAuthoringUsageFacts( assert, placementAuthoringUsageFacts );
		results.push( { step: 'placement authoring usage', placementAuthoringUsageFacts } );

	}

	return results;

}

function assertPlacementAuthoringUsageFacts( assert, facts ) {

	assert( facts !== null && typeof facts === 'object', 'placement authoring usage: expected object payload.' );
	assert( facts.attributionPolicy === 'sponza-product-placement-authoring-usage',
		'placement authoring usage: expected product usage attribution policy.' );
	assert( facts.leakMetricStatus === 'not-applicable',
		'placement authoring usage: expected non-leak-proof status.' );
	assert( facts.modulePath === 'examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js',
		'placement authoring usage: expected product module path.' );
	assert( facts.policyId === 'placement-authoring',
		'placement authoring usage: expected placement-authoring policy.' );
	assert( facts.productHasProofOnlyFacts === false,
		'placement authoring usage: expected no proof-only product facts.' );
	assert( facts.probeValidityLength === facts.totalProbes,
		'placement authoring usage: expected probeValidity length to match total probes.' );
	assert( facts.probeLayerMasksLength === facts.totalProbes,
		'placement authoring usage: expected probeLayerMasks length to match total probes.' );
	assert( facts.totalProbes > 0,
		'placement authoring usage: expected positive total probe count.' );
	assert( facts.receiverRegionCount === 2,
		'placement authoring usage: expected two receiver regions.' );
	assert( facts.layerRuleCount === 2,
		'placement authoring usage: expected two layer rules.' );
	assert( facts.acceptedSideCount === 2,
		'placement authoring usage: expected two accepted sides.' );
	assert( facts.replacementSlotCount === 16,
		'placement authoring usage: expected sixteen replacement slots.' );
	assert( facts.occupiedReplacementSlotCount === 8,
		'placement authoring usage: expected eight occupied replacement slots.' );
	assert( facts.sourceSelectionPolicyFacts?.policyId === 'side-shell-local-cell-source-policy',
		'placement authoring usage: expected source policy id.' );
	assert( facts.sourceSelectionPolicyFacts?.ranking === 'side-shell-topology-then-receiver-distance',
		'placement authoring usage: expected source ranking.' );
	assert( facts.sourceSelectionPolicyFacts?.forbiddenInputs === undefined,
		'placement authoring usage: expected no proof-only forbidden input facts.' );
	assert( Array.isArray( facts.sideFacts ) && facts.sideFacts.length === 2,
		'placement authoring usage: expected compact side facts.' );
	assert( facts.placementAuthoringUsageVerdict === 'sponza-product-placement-authoring-usage-ready',
		'placement authoring usage: expected ready verdict.' );

}

function assertCommonMetrics( assert, metrics, step ) {

	assert( metrics.status === 'ready', `${ step }: expected ready status.` );
	assert( metrics.isLightProbeGrid === true, `${ step }: expected Object3D light probe grid flag.` );
	assert( metrics.hasTexture === true, `${ step }: expected public atlas texture reference.` );
	assert( metrics.hasBoundingBox === true, `${ step }: expected public bounding box.` );
	assert(
		Number.isFinite( metrics.probeCount ) && metrics.probeCount > 0 ||
		Number.isFinite( metrics.resolution ) && metrics.resolution >= 2,
		`${ step }: expected finite probe count or scalar probe resolution.`
	);
	assert(
		Array.isArray( metrics.resolution ) && metrics.resolution.length === 3 ||
		Number.isFinite( metrics.resolution ) && metrics.resolution >= 2,
		`${ step }: expected probe resolution facts.`
	);

}

function assertLeakProofFacts( assert, leakProofFacts ) {

	assert( leakProofFacts !== null && typeof leakProofFacts === 'object', 'leak proof facts: expected object payload.' );
	assert( Array.isArray( leakProofFacts.rows ), 'leak proof facts: expected rows array.' );

	for ( const row of leakProofFacts.rows ) {

		assert( typeof row.label === 'string', 'leak proof facts: expected row label.' );
		assert( Number.isFinite( row.wrongSideColorRatio ), 'leak proof facts: expected finite wrong-side color ratio.' );
		assert( Number.isFinite( row.maskedWrongSideColorRatio ), 'leak proof facts: expected finite masked wrong-side color ratio.' );
		assert( Number.isFinite( row.correctBounceRatio ), 'leak proof facts: expected finite correct bounce ratio.' );

	}

}

function assertProbePositions( assert, positions ) {

	if ( Array.isArray( positions.samples ) ) {

		assert( positions.samples.length >= 2, 'probe positions: expected edge probe samples.' );

		for ( const sample of positions.samples ) {

			assert( Array.isArray( sample.index ) && sample.index.length === 3, 'probe positions: expected 3D index.' );
			assert( Array.isArray( sample.position ) && sample.position.length === 3, 'probe positions: expected 3D world position.' );
			assert( sample.position.every( Number.isFinite ), 'probe positions: expected finite world position.' );

		}

		return;

	}

	assert( positions.first !== undefined && positions.last !== undefined, 'probe positions: expected first/last probe facts.' );
	assert( Number.isFinite( positions.first.x ) && Number.isFinite( positions.first.y ) && Number.isFinite( positions.first.z ), 'probe positions: expected finite first probe.' );
	assert( Number.isFinite( positions.last.x ) && Number.isFinite( positions.last.y ) && Number.isFinite( positions.last.z ), 'probe positions: expected finite last probe.' );

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

	if ( file !== 'webgpu_lightprobes_sponza' ) return;

	const center = getAverageColor( screenshot, { x0: 0.42, x1: 0.58, y0: 0.38, y1: 0.62 } );

	if ( center.r + center.g + center.b <= 8 ) {

		throw new Error( `${ file }: Smoke screenshot expected visible lit Sponza content.` );

	}

}
