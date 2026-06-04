import * as THREE from 'three/webgpu';

export function createLightProbeGridGPUShDiagnostics( dependencies ) {

	const {
		createAggregateEvaluation,
		createReceiverWrongRatio,
		evaluateProbeCoefficientsForReceiver,
		readProbeCoefficients,
		roundMetric
	} = dependencies;

	const analyzeReceiverShContributions = async ( receiver ) => {

		const normal = new THREE.Vector3(
			receiver.receiverNormal.x,
			receiver.receiverNormal.y,
			receiver.receiverNormal.z
		);
		let correctSideMixedColorRowCount = 0;

		for ( const row of receiver.rows ) {

			const probe = await readProbeCoefficients( row.probeIndex );
			const irradiance = evaluateProbeCoefficientsForReceiver( probe.coefficients, normal );
			const wrongRatio = createReceiverWrongRatio( irradiance, receiver.correctSide );

			if ( row.relationToReceiver === 'correct-side' &&
				row.visibilityWeight > 0.0001 &&
				wrongRatio >= 0.5 ) {

				correctSideMixedColorRowCount ++;

			}

		}

		const scalarAggregate = await createAggregateEvaluation( receiver, 'scalarWeight' );
		const visibilityAggregate = await createAggregateEvaluation( receiver, 'visibilityWeight' );
		const visibilityMass = Math.max(
			0,
			Math.min( visibilityAggregate.totalWeight / Math.max( scalarAggregate.totalWeight, 0.0001 ), 1 )
		);
		const visibilityIrradiance = evaluateProbeCoefficientsForReceiver( visibilityAggregate.coefficients, normal );
		const runtimeIrradiance = {
			r: visibilityIrradiance.r * visibilityMass,
			g: visibilityIrradiance.g * visibilityMass,
			b: visibilityIrradiance.b * visibilityMass
		};
		const runtimeWrongRatio = createReceiverWrongRatio( runtimeIrradiance, receiver.correctSide );

		return {
			visibilityWrongRatio: visibilityAggregate.wrongRatio,
			runtimeWrongRatio,
			correctSideMixedColorRowCount
		};

	};

	const analyzeShContributionDiagnostics = async ( leftReceiver, rightReceiver ) => {

		const leftDiagnostic = await analyzeReceiverShContributions( leftReceiver );
		const rightDiagnostic = await analyzeReceiverShContributions( rightReceiver );
		const receiverCount = 2;
		const runtimeWrongRatioMean = roundMetric(
			( leftDiagnostic.runtimeWrongRatio + rightDiagnostic.runtimeWrongRatio ) / receiverCount
		);
		const visibilityWrongRatioMean = roundMetric(
			( leftDiagnostic.visibilityWrongRatio + rightDiagnostic.visibilityWrongRatio ) / receiverCount
		);
		const correctSideMixedColorRowCount =
			leftDiagnostic.correctSideMixedColorRowCount + rightDiagnostic.correctSideMixedColorRowCount;

		return {
			visibilityWrongRatioMean,
			runtimeWrongRatioMean,
			correctSideMixedColorRowCount
		};

	};


	return {
		analyzeReceiverShContributions,
		analyzeShContributionDiagnostics
	};

}
