import * as THREE from 'three/webgpu';

export function createLightProbeGridGPUShDiagnostics( dependencies ) {

	const {
		createAggregateEvaluation,
		createReceiverChromaPressure,
		createReceiverColorBias,
		evaluateProbeCoefficientsForReceiver,
		mixCoefficients,
		readProbeCoefficients,
		roundColor,
		roundMetric,
		visibilityWeightFloor
	} = dependencies;

	const analyzeReceiverShContributions = async ( receiver ) => {

		const normal = new THREE.Vector3(
			receiver.receiverNormal.x,
			receiver.receiverNormal.y,
			receiver.receiverNormal.z
		);
		const invertedNormal = normal.clone().multiplyScalar( - 1 );
		const rows = [];

		for ( const row of receiver.rows ) {

			const probe = await readProbeCoefficients( row.probeIndex );
			const irradiance = evaluateProbeCoefficientsForReceiver( probe.coefficients, normal );
			const l0Irradiance = roundColor( probe.l0Irradiance );

			rows.push( {
				relationToReceiver: row.relationToReceiver,
				scalarWeight: row.scalarWeight,
				visibilityWeight: row.visibilityWeight,
				chromaPressure: createReceiverChromaPressure( irradiance, receiver.correctSide ),
				colorBias: createReceiverColorBias( irradiance, receiver.correctSide ),
				l0ColorBias: createReceiverColorBias( l0Irradiance, receiver.correctSide )
			} );

		}

		const scalarAggregate = await createAggregateEvaluation( receiver, 'scalarWeight' );
		const visibilityAggregate = await createAggregateEvaluation( receiver, 'visibilityWeight' );
		const visibilityMix = Math.max(
			0,
			Math.min( visibilityAggregate.totalWeight / visibilityWeightFloor, 1 )
		);
		const runtimeCoefficients = mixCoefficients(
			scalarAggregate.coefficients,
			visibilityAggregate.coefficients,
			visibilityMix
		);
		const runtimeIrradiance = evaluateProbeCoefficientsForReceiver( runtimeCoefficients, normal );
		const invertedRuntimeIrradiance = evaluateProbeCoefficientsForReceiver( runtimeCoefficients, invertedNormal );
		const runtimeColorBias = createReceiverColorBias( runtimeIrradiance, receiver.correctSide );
		const invertedRuntimeColorBias = createReceiverColorBias( invertedRuntimeIrradiance, receiver.correctSide );

		return {
			label: receiver.label,
			correctSide: receiver.correctSide,
			rows,
			aggregates: {
				scalar: {
					colorBias: scalarAggregate.colorBias
				},
				visibility: {
					colorBias: visibilityAggregate.colorBias
				},
				runtimeFinal: {
					colorBias: runtimeColorBias,
					chromaPressure: createReceiverChromaPressure( runtimeIrradiance, receiver.correctSide )
				},
				invertedNormalRuntimeFinal: {
					label: 'runtime-final-mixed-coefficients-inverted-normal',
					colorBias: invertedRuntimeColorBias
				}
			}
		};

	};

	const analyzeShContributionDiagnostics = async ( leftReceiver, rightReceiver, escapeSummary, weightingSummary ) => {

		const receiverDiagnostics = [
			await analyzeReceiverShContributions( leftReceiver ),
			await analyzeReceiverShContributions( rightReceiver )
		];
		const scalarWrongRatioMean = roundMetric(
			receiverDiagnostics.reduce( ( total, receiver ) =>
				total + receiver.aggregates.scalar.colorBias.wrongOverCorrect, 0
			) / Math.max( receiverDiagnostics.length, 1 )
		);
		const runtimeWrongRatioMean = roundMetric(
			receiverDiagnostics.reduce( ( total, receiver ) =>
				total + receiver.aggregates.runtimeFinal.colorBias.wrongOverCorrect, 0
			) / Math.max( receiverDiagnostics.length, 1 )
		);
		const invertedNormalRuntimeWrongRatioMean = roundMetric(
			receiverDiagnostics.reduce( ( total, receiver ) =>
				total + receiver.aggregates.invertedNormalRuntimeFinal.colorBias.wrongOverCorrect, 0
			) / Math.max( receiverDiagnostics.length, 1 )
		);
		const visibilityWrongRatioMean = roundMetric(
			receiverDiagnostics.reduce( ( total, receiver ) =>
				total + receiver.aggregates.visibility.colorBias.wrongOverCorrect, 0
			) / Math.max( receiverDiagnostics.length, 1 )
		);
		const correctVisibilityRows = receiverDiagnostics.flatMap( receiver =>
			receiver.rows.filter( row =>
				row.relationToReceiver === 'correct-side' &&
						row.visibilityWeight > 0.0001
			)
		);
		const weightedCorrectLeakTotal = correctVisibilityRows.reduce(
			( total, row ) => total + row.colorBias.wrongOverCorrect * row.visibilityWeight,
			0
		);
		const weightedCorrectWeightTotal = correctVisibilityRows.reduce(
			( total, row ) => total + row.visibilityWeight,
			0
		);
		const weightedCorrectSideWrongOverCorrectMean = roundMetric(
			weightedCorrectLeakTotal / Math.max( weightedCorrectWeightTotal, 0.0001 )
		);
		const correctSideMixedColorRows = correctVisibilityRows.filter(
			row => row.colorBias.wrongOverCorrect >= 0.5
		);
		const createWeightedMean = ( rows, weightKey, read ) => {

			const totalWeight = rows.reduce( ( total, row ) => total + row[ weightKey ], 0 );
			const weightedTotal = rows.reduce(
				( total, row ) => total + read( row ) * row[ weightKey ],
				0
			);

			return roundMetric( weightedTotal / Math.max( totalWeight, 0.0001 ) );

		};

		const positiveChromaPressure = row => Math.max( row.chromaPressure.wrongMinusCorrect, 0 );
		const summarizeProbeContentReceiver = receiver => {

			const correctRows = receiver.rows.filter( row =>
				row.visibilityWeight > 0.0001 &&
				row.relationToReceiver === 'correct-side'
			);
			const maxCorrectSideChromaPressure = correctRows.reduce( ( max, row ) => Math.max( max, positiveChromaPressure( row ) ), 0 );
			const weightedCorrectSideVisibilityChromaPressureMean = createWeightedMean(
				correctRows,
				'visibilityWeight',
				positiveChromaPressure
			);
			return {
				weightedCorrectSideVisibilityChromaPressureMean,
				runtimeFinalChromaPressure: receiver.aggregates.runtimeFinal.chromaPressure,
				maxCorrectSideChromaPressure: roundMetric( maxCorrectSideChromaPressure )
			};

		};

		const probeContentReceivers = receiverDiagnostics.map( summarizeProbeContentReceiver );
		const maxCorrectSideChromaPressure = roundMetric( Math.max(
			...probeContentReceivers.map( receiver => receiver.maxCorrectSideChromaPressure )
		) );
		const maxRuntimeFinalChromaPressure = roundMetric( Math.max(
			...probeContentReceivers.map( receiver => Math.max( receiver.runtimeFinalChromaPressure.wrongMinusCorrect, 0 ) )
		) );
		const weightedCorrectSideChromaPressureMean = roundMetric(
			probeContentReceivers.reduce(
				( total, receiver ) => total + receiver.weightedCorrectSideVisibilityChromaPressureMean,
				0
			) / Math.max( probeContentReceivers.length, 1 )
		);
		const aggregateMixedColorSuspected = Math.max( visibilityWrongRatioMean, runtimeWrongRatioMean ) >= 0.25;
		const correctSideMixedColorRowPressure = correctSideMixedColorRows.length > 0;
		const bakedShMixedColorSuspected = escapeSummary.wrongSideEscapedCount === 0 &&
					weightingSummary.directionalSuppressionSupported === true &&
					correctSideMixedColorRowPressure === true &&
					aggregateMixedColorSuspected === true;

		return {
			status: bakedShMixedColorSuspected ?
				'OPEN-BAKED-SH-MIXED-COLOR-SUSPECTED' :
				correctSideMixedColorRowPressure ?
					'OPEN-CORRECT-PROBE-ROW-MIXED-COLOR-PRESSURE' :
					'OPEN-SH-CONTRIBUTION-NEEDS-MORE-EVIDENCE',
			proofBoundary: 'Readback-only packed SH atlas coefficient contribution mirror for receiver neighbors; diagnostic only, not a public API.',
			suspectedFailureDomain: bakedShMixedColorSuspected ?
				'BAKED-SH-MIXED-COLOR-CONTAMINATION' :
				'RUNTIME-SH-EVAL-OR-RENDER-METRIC',
			summary: {
				scalarWrongRatioMean,
				visibilityWrongRatioMean,
				runtimeWrongRatioMean,
				invertedNormalRuntimeWrongRatioMean,
				maxCorrectSideChromaPressure,
				maxRuntimeFinalChromaPressure,
				weightedCorrectSideChromaPressureMean,
				weightedCorrectSideWrongOverCorrectMean,
			}
		};

	};


	return {
		analyzeReceiverShContributions,
		analyzeShContributionDiagnostics
	};

}
