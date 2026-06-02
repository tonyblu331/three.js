import * as THREE from 'three/webgpu';

export function createLightProbeGridGPUReceiverDiagnostics( dependencies ) {

	const {
		_lightProbeContext,
		analyzeReceiver,
		analyzeReceiverShContributions,
		captureLeakRegionMetrics,
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

				samples.push( {
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

		const summarizeReceiverSurface = async ( mesh, correctSide ) => {

			let runtimeWrongRatio = 0;
			let totalQuadratureWeight = 0;
			const sampleDescriptors = createGaussLegendreReceiverSamples( mesh );

			for ( const sampleDescriptor of sampleDescriptors ) {

				const receiver = await analyzeReceiver(
					mesh,
					correctSide,
					sampleDescriptor
				);
				const contribution = await analyzeReceiverShContributions( receiver );
				const weight = sampleDescriptor.quadratureWeight;

				totalQuadratureWeight += weight;
				runtimeWrongRatio += contribution.runtimeWrongRatio * weight;

			}

			return {
				sampleCount: sampleDescriptors.length,
				runtimeWrongRatio: roundMetric( runtimeWrongRatio / Math.max( totalQuadratureWeight, 0.0001 ) )
			};

		};

		const renderMetrics = captureLeakRegionMetrics();
		const leftSurface = await summarizeReceiverSurface( _lightProbeContext.leakFixture.leftReceiver, 'left' );
		const rightSurface = await summarizeReceiverSurface( _lightProbeContext.leakFixture.rightReceiver, 'right' );
		const surfaceRuntimeWrongRatioMax = roundMetric( Math.max( leftSurface.runtimeWrongRatio, rightSurface.runtimeWrongRatio ) );
		const renderSurfaceWrongRatio = renderMetrics.surfaceWrongSideColorRatio;

		return {
			sampleCountPerReceiver: leftSurface.sampleCount,
			surfaceRuntimeWrongRatioMax,
			renderSurfaceWrongRatio
		};

	};

	return {
		createReceiverSurfaceQuadratureDiagnostic
	};

}
