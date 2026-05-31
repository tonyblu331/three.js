import * as THREE from 'three/webgpu';

export function createLightProbeGridGPUShDiagnostics( dependencies ) {

	const {
		createAggregateEvaluation,
		createColorChromaticity,
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

		const scalarAggregate = await createAggregateEvaluation( receiver, 'scalarWeight', 'scalar-all-neighbors' );
		const visibilityAggregate = await createAggregateEvaluation( receiver, 'visibilityWeight', 'visibility-all-neighbors' );
		const correctVisibilityAggregate = await createAggregateEvaluation(
			receiver,
			'visibilityWeight',
			'visibility-correct-side-only',
			row => row.relationToReceiver === 'correct-side'
		);
		const wrongScalarAggregate = await createAggregateEvaluation(
			receiver,
			'scalarWeight',
			'scalar-wrong-side-only',
			row => row.relationToReceiver === 'wrong-side'
		);
		const wrongVisibilityAggregate = await createAggregateEvaluation(
			receiver,
			'visibilityWeight',
			'visibility-wrong-side-only',
			row => row.relationToReceiver === 'wrong-side'
		);
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
		const scalarWrongRatio = scalarAggregate.colorBias.wrongOverCorrect;
		const runtimeWrongRatio = createReceiverColorBias( runtimeIrradiance, receiver.correctSide ).wrongOverCorrect;
		const wrongRatioImprovement = ( scalarWrongRatio - runtimeWrongRatio ) / Math.max( scalarWrongRatio, 0.0001 );

		return {
			label: receiver.label,
			correctSide: receiver.correctSide,
			rows,
			aggregates: {
				scalar: {
					label: scalarAggregate.label,
					totalWeight: scalarAggregate.totalWeight,
					irradiance: scalarAggregate.irradiance,
					colorBias: scalarAggregate.colorBias,
					chromaticity: scalarAggregate.chromaticity,
					chromaPressure: scalarAggregate.chromaPressure
				},
				visibility: {
					label: visibilityAggregate.label,
					totalWeight: visibilityAggregate.totalWeight,
					irradiance: visibilityAggregate.irradiance,
					colorBias: visibilityAggregate.colorBias,
					chromaticity: visibilityAggregate.chromaticity,
					chromaPressure: visibilityAggregate.chromaPressure
				},
				runtimeFinal: {
					label: 'runtime-final-mixed-coefficients',
					visibilityMix: roundMetric( visibilityMix ),
					irradiance: runtimeIrradiance,
					colorBias: createReceiverColorBias( runtimeIrradiance, receiver.correctSide ),
					chromaticity: createColorChromaticity( runtimeIrradiance ),
					chromaPressure: createReceiverChromaPressure( runtimeIrradiance, receiver.correctSide ),
					wrongRatioImprovement: roundMetric( wrongRatioImprovement )
				},
				invertedNormalRuntimeFinal: {
					label: 'runtime-final-mixed-coefficients-inverted-normal',
					irradiance: invertedRuntimeIrradiance,
					colorBias: createReceiverColorBias( invertedRuntimeIrradiance, receiver.correctSide ),
					chromaticity: createColorChromaticity( invertedRuntimeIrradiance ),
					chromaPressure: createReceiverChromaPressure( invertedRuntimeIrradiance, receiver.correctSide )
				},
				correctVisibilityOnly: {
					label: correctVisibilityAggregate.label,
					totalWeight: correctVisibilityAggregate.totalWeight,
					irradiance: correctVisibilityAggregate.irradiance,
					colorBias: correctVisibilityAggregate.colorBias,
					chromaticity: correctVisibilityAggregate.chromaticity,
					chromaPressure: correctVisibilityAggregate.chromaPressure
				},
				wrongScalarOnly: {
					label: wrongScalarAggregate.label,
					totalWeight: wrongScalarAggregate.totalWeight,
					irradiance: wrongScalarAggregate.irradiance,
					colorBias: wrongScalarAggregate.colorBias,
					chromaticity: wrongScalarAggregate.chromaticity,
					chromaPressure: wrongScalarAggregate.chromaPressure
				},
				wrongVisibilityOnly: {
					label: wrongVisibilityAggregate.label,
					totalWeight: wrongVisibilityAggregate.totalWeight,
					irradiance: wrongVisibilityAggregate.irradiance,
					colorBias: wrongVisibilityAggregate.colorBias,
					chromaticity: wrongVisibilityAggregate.chromaticity,
					chromaPressure: wrongVisibilityAggregate.chromaPressure
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

			const visibilityRows = receiver.rows.filter( row => row.visibilityWeight > 0.0001 );
			const scalarRows = receiver.rows.filter( row => row.scalarWeight > 0.0001 );
			const correctRows = visibilityRows.filter( row => row.relationToReceiver === 'correct-side' );
			const wrongRows = visibilityRows.filter( row => row.relationToReceiver === 'wrong-side' );
			const maxCorrectSideChromaPressure = correctRows.reduce( ( max, row ) => Math.max( max, positiveChromaPressure( row ) ), 0 );
			const weightedVisibilityChromaPressureMean = createWeightedMean(
				visibilityRows,
				'visibilityWeight',
				positiveChromaPressure
			);
			const weightedCorrectSideVisibilityChromaPressureMean = createWeightedMean(
				correctRows,
				'visibilityWeight',
				positiveChromaPressure
			);
			const weightedCorrectSideL0WrongOverCorrectMean = createWeightedMean(
				correctRows,
				'visibilityWeight',
				row => row.l0ColorBias.wrongOverCorrect
			);
			const weightedCorrectSideIrradianceWrongOverCorrectMean = createWeightedMean(
				correctRows,
				'visibilityWeight',
				row => row.colorBias.wrongOverCorrect
			);

			return {
				label: receiver.label,
				correctSide: receiver.correctSide,
				rowCount: receiver.rows.length,
				visibilityRowCount: visibilityRows.length,
				scalarRowCount: scalarRows.length,
				correctSideVisibilityRowCount: correctRows.length,
				wrongSideVisibilityRowCount: wrongRows.length,
				weightedVisibilityChromaPressureMean,
				weightedCorrectSideVisibilityChromaPressureMean,
				weightedCorrectSideL0WrongOverCorrectMean,
				weightedCorrectSideIrradianceWrongOverCorrectMean,
				runtimeFinalChromaPressure: receiver.aggregates.runtimeFinal.chromaPressure,
				scalarChromaPressure: receiver.aggregates.scalar.chromaPressure,
				visibilityChromaPressure: receiver.aggregates.visibility.chromaPressure,
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
		const probeContentChromaStatus = Math.max( maxCorrectSideChromaPressure, maxRuntimeFinalChromaPressure ) >= 0.05 ?
			'OPEN-PROBE-CONTENT-CHROMA-PRESSURE' :
			'SUPPORTED-PROBE-CONTENT-CHROMA-BOUNDED';
		const runtimeWrongRatioImprovementMean = roundMetric(
			( scalarWrongRatioMean - runtimeWrongRatioMean ) / Math.max( scalarWrongRatioMean, 0.0001 )
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
				runtimeWrongRatioImprovementMean,
				probeContentChromaStatus,
				maxCorrectSideChromaPressure,
				maxRuntimeFinalChromaPressure,
				weightedCorrectSideChromaPressureMean,
				weightedCorrectSideWrongOverCorrectMean,
				correctSideMixedColorRowCount: correctSideMixedColorRows.length,
				correctSideVisibilityRowCount: correctVisibilityRows.length,
				correctSideMixedColorRowPressure,
				aggregateMixedColorSuspected,
				wrongSideEscapedProbeCount: escapeSummary.wrongSideEscapedCount,
				directionalSuppressionSupported: weightingSummary.directionalSuppressionSupported,
				bakedShMixedColorSuspected
			}
		};

	};


	return {
		analyzeReceiverShContributions,
		analyzeShContributionDiagnostics
	};

}
