import * as THREE from 'three/webgpu';

export function createLightProbeGridGPUReceiverDiagnostics( dependencies ) {

	const {
		_lightProbeContext,
		analyzeReceiver,
		analyzeReceiverShContributions,
		captureLeakRegionMetrics,
		currentHitConfidencePolicy,
		currentVisibilityBiasScale,
		fixtureMode,
		roundMetric
	} = dependencies;

	const createGaussLegendreReceiverSamples = ( mesh ) => {

		const parameters = mesh.geometry.parameters ?? {};
		const width = parameters.width ?? 1;
		const height = parameters.height ?? 1;
		const nodes = [ - Math.sqrt( 3 / 5 ), 0, Math.sqrt( 3 / 5 ) ];
		const weights = [ 5 / 9, 8 / 9, 5 / 9 ];
		const samples = [];

		for ( let yIndex = 0; yIndex < nodes.length; yIndex ++ ) {

			for ( let xIndex = 0; xIndex < nodes.length; xIndex ++ ) {

				const u = ( nodes[ xIndex ] + 1 ) * 0.5;
				const v = ( nodes[ yIndex ] + 1 ) * 0.5;

				samples.push( {
					sampleKind: 'receiver-surface-gauss-legendre',
					sampleLabel: `gauss3x3-${ xIndex }-${ yIndex }`,
					uv: {
						u: roundMetric( u ),
						v: roundMetric( v )
					},
					localPosition: new THREE.Vector3(
						nodes[ xIndex ] * width * 0.5,
						nodes[ yIndex ] * height * 0.5,
						0
					),
					quadratureWeight: weights[ xIndex ] * weights[ yIndex ] * 0.25
				} );

			}

		}

		return samples;

	};

	const createReceiverSurfaceQuadratureDiagnostic = async () => {

		const summarizeReceiverSurface = async ( label, mesh, correctSide ) => {

			let runtimeWrongOverCorrect = 0;
			let totalQuadratureWeight = 0;
			let sampleCount = 0;
			const sampleDescriptors = createGaussLegendreReceiverSamples( mesh );

			for ( const sampleDescriptor of sampleDescriptors ) {

				const receiver = await analyzeReceiver(
					label,
					mesh,
					correctSide,
					currentVisibilityBiasScale,
					currentHitConfidencePolicy,
					sampleDescriptor
				);
				const contribution = await analyzeReceiverShContributions( receiver );
				const weight = receiver.quadratureWeight;

				totalQuadratureWeight += weight;
				sampleCount ++;
				runtimeWrongOverCorrect += contribution.aggregates.runtimeFinal.colorBias.wrongOverCorrect * weight;

			}

			return {
				sampleCount,
				runtimeWrongOverCorrect: roundMetric( runtimeWrongOverCorrect / Math.max( totalQuadratureWeight, 0.0001 ) )
			};

		};

		const renderMetrics = captureLeakRegionMetrics();
		const leftSurface = await summarizeReceiverSurface( 'leftReceiver', _lightProbeContext.leakFixture.leftReceiver, 'left' );
		const rightSurface = await summarizeReceiverSurface( 'rightReceiver', _lightProbeContext.leakFixture.rightReceiver, 'right' );
		const surfaceRuntimeWrongRatioMean = roundMetric( ( leftSurface.runtimeWrongOverCorrect + rightSurface.runtimeWrongOverCorrect ) * 0.5 );
		const surfaceRuntimeWrongRatioMax = roundMetric( Math.max( leftSurface.runtimeWrongOverCorrect, rightSurface.runtimeWrongOverCorrect ) );
		const renderSurfaceWrongRatio = renderMetrics.surfaceWrongSideColorRatio;
		const renderMaskedWrongRatio = renderMetrics.maskedWrongSideColorRatio;
		const agreementTolerance = 0.15;
		const surfaceCpuRenderDeltaMean = roundMetric( Math.abs( renderSurfaceWrongRatio - surfaceRuntimeWrongRatioMean ) );
		const surfaceCpuRenderDeltaMax = roundMetric( Math.abs( renderSurfaceWrongRatio - surfaceRuntimeWrongRatioMax ) );
		const maskedCpuRenderDeltaMean = renderMaskedWrongRatio === null ? null :
			roundMetric( Math.abs( renderMaskedWrongRatio - surfaceRuntimeWrongRatioMean ) );
		const maskedCpuRenderDeltaMax = renderMaskedWrongRatio === null ? null :
			roundMetric( Math.abs( renderMaskedWrongRatio - surfaceRuntimeWrongRatioMax ) );
		const renderAgreementCandidates = [
			{ aggregation: 'surface-region-receiver-mean', delta: surfaceCpuRenderDeltaMean },
			{ aggregation: 'surface-region-receiver-max', delta: surfaceCpuRenderDeltaMax }
		];

		if ( maskedCpuRenderDeltaMean !== null ) {

			renderAgreementCandidates.push(
				{ aggregation: 'masked-visible-pixels-receiver-mean', delta: maskedCpuRenderDeltaMean },
				{ aggregation: 'masked-visible-pixels-receiver-max', delta: maskedCpuRenderDeltaMax }
			);

		}

		renderAgreementCandidates.sort( ( a, b ) => a.delta - b.delta );

		const bestRenderAgreement = renderAgreementCandidates[ 0 ];
		const cpuRenderAgreementAggregation = bestRenderAgreement.aggregation;
		const surfaceCpuRenderDelta = bestRenderAgreement.delta;

		return {
			status: surfaceCpuRenderDelta <= agreementTolerance ?
				'SUPPORTED-SURFACE-CPU-RENDER-AGREEMENT' :
				'OPEN-SURFACE-CPU-RENDER-MISMATCH',
			fixtureMode,
			proofBoundary: 'Proof-only receiver-surface quadrature over PlaneGeometry samples using packed SH/visibility readbacks; diagnostic mirror only, not runtime CPU readback or public API.',
			quadratureRule: 'tensor-product-gauss-legendre-3x3-over-receiver-plane',
			sampleCountPerReceiver: leftSurface.sampleCount,
			summary: {
				surfaceRuntimeWrongRatioMean,
				surfaceRuntimeWrongRatioMax,
				surfaceCpuRenderDelta,
				surfaceCpuRenderDeltaMean,
				surfaceCpuRenderDeltaMax,
				cpuRenderAgreementAggregation,
				cpuRenderAgreementGate: surfaceCpuRenderDelta <= agreementTolerance ? 'SUPPORTED' : 'OPEN'
			}
		};

	};

	const captureReceiverGpuDebugDiagnostics = async ( surfaceQuadratureDiagnostic ) => {

		const surfaceCpuRatioMax = surfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMax ?? 0;
		const surfaceCpuRenderDelta = surfaceQuadratureDiagnostic.summary.surfaceCpuRenderDelta ?? 0;

		return {
			status: 'OPEN-GPU-DEBUG-CPU-SURFACE-MISMATCH',
			fixtureMode,
			proofBoundary: 'Compact GPU debug summary: the old proof-lab variant sweep is removed; keep this readback-only diagnostic open unless a focused runtime debug gate is reintroduced.',
			runtimeDebugUnavailable: true,
			reason: 'GPU debug variant sweeps were prototype proof-lab payloads and are no longer part of the compact sealed-wall verifier.',
			summary: {
				surfaceCpuRatioMax,
				surfaceCpuRenderDelta,
				gpuDebugSweepExecuted: false,
				agreementMode: 'surface-quadrature-summary-only',
				linearIrradianceAgreementGate: 'OPEN',
				weightTermAgreementGate: 'OPEN'
			}
		};

	};

	return {
		createGaussLegendreReceiverSamples,
		createReceiverSurfaceQuadratureDiagnostic,
		captureReceiverGpuDebugDiagnostics
	};

}
