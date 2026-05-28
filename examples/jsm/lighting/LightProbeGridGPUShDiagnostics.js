import * as THREE from 'three/webgpu';

export function createLightProbeGridGPUShDiagnostics( dependencies ) {

	const {
		_lightProbeContext,
		addScaledCoefficients,
		auditDividerSegment,
		createAggregateEvaluation,
		createColorChromaticity,
		createReceiverChromaPressure,
		createReceiverColorBias,
		createShBandDecomposition,
		createShCoefficientContributionStudy,
		createZeroCoefficients,
		diagnosticState,
		dividerX,
		evaluateIrradianceContract,
		evaluateProbeCoefficientsForReceiver,
		getColorChannel,
		getWrongColorChannel,
		measureNegativeEnergy,
		mixCoefficients,
		readSourceMappedProbeCoefficients,
		readProbeCoefficients,
		resolution,
		roundColor,
		roundMetric,
		roundVector,
		scaleCoefficients,
		shCoefficientTerms,
		visibilityWeightFloor
	} = dependencies;

	const analyzeReceiverShContributions = async ( receiver ) => {

		const normal = new THREE.Vector3(
			receiver.receiverNormal.x,
			receiver.receiverNormal.y,
			receiver.receiverNormal.z
		);
		const invertedNormal = normal.clone().multiplyScalar( - 1 );
		const scaleColorValue = ( color, scale ) => ( {
			r: color.r * scale,
			g: color.g * scale,
			b: color.b * scale
		} );
		const createWeightedContributionRow = ( contribution, scale ) => {

			const scaledContribution = scaleColorValue( contribution.contribution, scale );
			const correctContribution = getColorChannel( scaledContribution, receiver.correctSide );
			const wrongContribution = getWrongColorChannel( scaledContribution, receiver.correctSide );

			return {
				...contribution,
				weightedContribution: roundColor( scaledContribution ),
				weightedCorrectContribution: roundMetric( correctContribution ),
				weightedWrongContribution: roundMetric( wrongContribution ),
				weightedWrongMinusCorrect: roundMetric( wrongContribution - correctContribution ),
				weightedNegativeEnergy: measureNegativeEnergy( scaledContribution )
			};

		};
		const rows = [];

		for ( const row of receiver.rows ) {

			const probe = await readProbeCoefficients( row.probeIndex );
			const dilatedProbe = await readSourceMappedProbeCoefficients( row.probeIndex );
			const irradiance = evaluateProbeCoefficientsForReceiver( probe.coefficients, normal );
			const l0Irradiance = roundColor( probe.l0Irradiance );
			const bandDecomposition = createShBandDecomposition( probe.coefficients, normal, receiver.correctSide );
			const coefficientContributionStudy = createShCoefficientContributionStudy( probe.coefficients, normal, receiver.correctSide );
			const dilatedIrradiance = evaluateProbeCoefficientsForReceiver( dilatedProbe.coefficients, normal );
			const dilatedL0Irradiance = roundColor( dilatedProbe.l0Irradiance );
			const dilatedBandDecomposition = createShBandDecomposition(
				dilatedProbe.coefficients,
				normal,
				receiver.correctSide
			);
			const dilatedCoefficientContributionStudy = createShCoefficientContributionStudy(
				dilatedProbe.coefficients,
				normal,
				receiver.correctSide
			);
			const dilationSourcePosition = new THREE.Vector3();
			_lightProbeContext.getGridProbePosition( dilatedProbe.sourceProbeIndex, resolution, dilationSourcePosition );
			const dilationSourceSide = dilationSourcePosition.x < dividerX ? 'left' : 'right';
			const dilationSourceRelationToReceiver = dilationSourceSide === receiver.correctSide ?
				'correct-side' :
				'wrong-side';

			rows.push( {
				probeIndex: row.probeIndex,
				sourceProbeIndex: dilatedProbe.sourceProbeIndex,
				dilationSourceDiffers: dilatedProbe.dilated,
				sourceSide: dilationSourceSide,
				sourceRelationToReceiver: dilationSourceRelationToReceiver,
				sourceValidity: roundMetric( diagnosticState.probeValidity[ dilatedProbe.sourceProbeIndex ] ?? 1 ),
				coord: row.coord,
				side: row.side,
				relationToReceiver: row.relationToReceiver,
				probePosition: row.probePosition,
				crossesDivider: row.crossesDivider,
				visibilitySegmentDividerAudit: row.visibilitySegmentDividerAudit,
				surfaceSegmentDividerAudit: row.surfaceSegmentDividerAudit,
				scalarWeight: row.scalarWeight,
				visibilityWeight: row.visibilityWeight,
				visibility: row.visibility,
				validity: roundMetric( probe.validity ),
				irradiance,
				l0Irradiance,
				chromaticity: createColorChromaticity( irradiance ),
				l0Chromaticity: createColorChromaticity( l0Irradiance ),
				chromaPressure: createReceiverChromaPressure( irradiance, receiver.correctSide ),
				l0ChromaPressure: createReceiverChromaPressure( l0Irradiance, receiver.correctSide ),
				bandDecomposition,
				coefficientContributionStudy,
				energy: roundMetric( irradiance.r + irradiance.g + irradiance.b ),
				l0Energy: roundMetric( l0Irradiance.r + l0Irradiance.g + l0Irradiance.b ),
				dilatedIrradiance,
				dilatedL0Irradiance,
				dilatedBandDecomposition,
				dilatedCoefficientContributionStudy,
				dilatedChromaPressure: createReceiverChromaPressure( dilatedIrradiance, receiver.correctSide ),
				dilatedL0ChromaPressure: createReceiverChromaPressure( dilatedL0Irradiance, receiver.correctSide ),
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
		const runtimeRows = rows.map( row => {

			const scalarNormalizedWeight = row.scalarWeight / Math.max( scalarAggregate.totalWeight, 0.0001 );
			const visibilityNormalizedWeight = row.visibilityWeight / Math.max( visibilityAggregate.totalWeight, 0.0001 );
			const runtimeFinalWeight = ( scalarNormalizedWeight * ( 1 - visibilityMix ) ) +
				( visibilityNormalizedWeight * visibilityMix );
			const runtimeWeightedIrradiance = scaleColorValue( row.irradiance, runtimeFinalWeight );
			const runtimeWeightedDilatedIrradiance = scaleColorValue( row.dilatedIrradiance, runtimeFinalWeight );
			const correctContribution = getColorChannel( runtimeWeightedIrradiance, receiver.correctSide );
			const wrongContribution = getWrongColorChannel( runtimeWeightedIrradiance, receiver.correctSide );
			const dilatedCorrectContribution = getColorChannel( runtimeWeightedDilatedIrradiance, receiver.correctSide );
			const dilatedWrongContribution = getWrongColorChannel( runtimeWeightedDilatedIrradiance, receiver.correctSide );
			const fullUnclamped = row.bandDecomposition.fullUnclamped.irradiance;
			const fullClamped = row.bandDecomposition.fullClamped.irradiance;
			const dilatedFullUnclamped = row.dilatedBandDecomposition.fullUnclamped.irradiance;
			const dilatedFullClamped = row.dilatedBandDecomposition.fullClamped.irradiance;

			return {
				...row,
				scalarNormalizedWeight: roundMetric( scalarNormalizedWeight ),
				visibilityNormalizedWeight: roundMetric( visibilityNormalizedWeight ),
				runtimeFinalWeight: roundMetric( runtimeFinalWeight ),
				runtimeWeightedIrradiance: roundColor( runtimeWeightedIrradiance ),
				runtimeWeightedCorrectContribution: roundMetric( correctContribution ),
				runtimeWeightedWrongContribution: roundMetric( wrongContribution ),
				runtimeWeightedWrongMinusCorrect: roundMetric( wrongContribution - correctContribution ),
				wrongChannelPressure: roundMetric( Math.max( wrongContribution - correctContribution, 0 ) ),
				correctChannelPreservation: roundMetric( correctContribution ),
				runtimeWeightedDilatedIrradiance: roundColor( runtimeWeightedDilatedIrradiance ),
				runtimeWeightedDilatedCorrectContribution: roundMetric( dilatedCorrectContribution ),
				runtimeWeightedDilatedWrongContribution: roundMetric( dilatedWrongContribution ),
				runtimeWeightedDilatedWrongMinusCorrect: roundMetric( dilatedWrongContribution - dilatedCorrectContribution ),
				dilatedWrongChannelPressure: roundMetric( Math.max( dilatedWrongContribution - dilatedCorrectContribution, 0 ) ),
				dilatedCorrectChannelPreservation: roundMetric( dilatedCorrectContribution ),
				dilatedSourceWrongPressureDelta: roundMetric(
					Math.max( dilatedWrongContribution - dilatedCorrectContribution, 0 ) -
					Math.max( wrongContribution - correctContribution, 0 )
				),
				fullUnclampedNegativeEnergy: row.bandDecomposition.fullUnclamped.negativeEnergy,
				postClampEnergyDelta: roundMetric(
					( fullClamped.r - fullUnclamped.r ) +
					( fullClamped.g - fullUnclamped.g ) +
					( fullClamped.b - fullUnclamped.b )
				),
				dilatedFullUnclampedNegativeEnergy: row.dilatedBandDecomposition.fullUnclamped.negativeEnergy,
				dilatedPostClampEnergyDelta: roundMetric(
					( dilatedFullClamped.r - dilatedFullUnclamped.r ) +
					( dilatedFullClamped.g - dilatedFullUnclamped.g ) +
					( dilatedFullClamped.b - dilatedFullUnclamped.b )
				),
				runtimeWeightedBandContributions: row.coefficientContributionStudy.bands.map( band =>
					createWeightedContributionRow( band, runtimeFinalWeight )
				),
				runtimeWeightedCoefficientContributions: row.coefficientContributionStudy.rows.map( coefficient =>
					createWeightedContributionRow( coefficient, runtimeFinalWeight )
				),
				runtimeWeightedDilatedBandContributions: row.dilatedCoefficientContributionStudy.bands.map( band =>
					createWeightedContributionRow( band, runtimeFinalWeight )
				),
				runtimeWeightedDilatedCoefficientContributions: row.dilatedCoefficientContributionStudy.rows.map( coefficient =>
					createWeightedContributionRow( coefficient, runtimeFinalWeight )
				)
			};

		} );

		return {
			label: receiver.label,
			correctSide: receiver.correctSide,
			receiverPosition: receiver.receiverPosition,
			receiverNormal: receiver.receiverNormal,
			proofBoundary: 'Readback-only packed SH atlas coefficient contribution mirror for receiver neighbors; diagnostic only, not a public API.',
			rows: runtimeRows,
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
			const maxChromaRow = correctRows.reduce( ( best, row ) => (
				best === null || positiveChromaPressure( row ) > positiveChromaPressure( best ) ? row : best
			), null );
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
				invalidNeighborCount: receiver.rows.filter( row => row.validity < 1 ).length,
				dilatedSourceRowCount: receiver.rows.filter( row => row.dilationSourceDiffers === true ).length,
				weightedVisibilityChromaPressureMean,
				weightedCorrectSideVisibilityChromaPressureMean,
				weightedCorrectSideL0WrongOverCorrectMean,
				weightedCorrectSideIrradianceWrongOverCorrectMean,
				runtimeFinalChromaPressure: receiver.aggregates.runtimeFinal.chromaPressure,
				scalarChromaPressure: receiver.aggregates.scalar.chromaPressure,
				visibilityChromaPressure: receiver.aggregates.visibility.chromaPressure,
				maxCorrectSideChromaPressure: maxChromaRow === null ? 0 : roundMetric( positiveChromaPressure( maxChromaRow ) ),
				dominantCorrectSideProbe: maxChromaRow === null ? null : {
					probeIndex: maxChromaRow.probeIndex,
					sourceProbeIndex: maxChromaRow.sourceProbeIndex,
					dilationSourceDiffers: maxChromaRow.dilationSourceDiffers,
					side: maxChromaRow.side,
					sourceSide: maxChromaRow.sourceSide,
					validity: maxChromaRow.validity,
					visibilityWeight: maxChromaRow.visibilityWeight,
					scalarWeight: maxChromaRow.scalarWeight,
					irradiance: maxChromaRow.irradiance,
					l0Irradiance: maxChromaRow.l0Irradiance,
					chromaticity: maxChromaRow.chromaticity,
					chromaPressure: maxChromaRow.chromaPressure,
					l0ChromaPressure: maxChromaRow.l0ChromaPressure,
					colorBias: maxChromaRow.colorBias,
					l0ColorBias: maxChromaRow.l0ColorBias
				}
			};

		};

		const createProbeDensityMetricStudy = diagnostics => {

			const probeCount = resolution * resolution * resolution;
			const probePositions = [];
			const uniqueX = new Set();

			for ( let probeIndex = 0; probeIndex < probeCount; probeIndex ++ ) {

				const position = new THREE.Vector3();
				_lightProbeContext.getGridProbePosition( probeIndex, resolution, position );
				probePositions.push( position );
				uniqueX.add( roundMetric( position.x ) );

			}

			const sortedX = [ ...uniqueX ].sort( ( a, b ) => a - b );
			const xSpacings = sortedX
				.slice( 1 )
				.map( ( value, index ) => Math.abs( value - sortedX[ index ] ) )
				.filter( value => value > 0.0001 );
			const gridSpacing = roundMetric( xSpacings.length > 0 ? Math.min( ...xSpacings ) : 0 );
			const densityRiskThreshold = Math.max( gridSpacing, 0.0001 );
			const receiverRows = diagnostics.map( receiver => {

				const receiverPosition = new THREE.Vector3(
					receiver.receiverPosition.x,
					receiver.receiverPosition.y,
					receiver.receiverPosition.z
				);
				const rows = receiver.rows.map( row => {

					const probePosition = probePositions[ row.probeIndex ];
					const distance = receiverPosition.distanceTo( probePosition );
					const dividerDistance = Math.abs( probePosition.x - dividerX );
					const receiverDividerDistance = Math.abs( receiverPosition.x - dividerX );
					const weightedChromaPressure = Math.max( row.chromaPressure.wrongMinusCorrect, 0 ) * row.visibilityWeight;

					return {
						probeIndex: row.probeIndex,
						side: row.side,
						relationToReceiver: row.relationToReceiver,
						position: roundVector( probePosition ),
						distance: roundMetric( distance ),
						distanceOverGridSpacing: roundMetric( distance / densityRiskThreshold ),
						probeDividerDistance: roundMetric( dividerDistance ),
						receiverDividerDistance: roundMetric( receiverDividerDistance ),
						scalarWeight: row.scalarWeight,
						visibilityWeight: row.visibilityWeight,
						chromaPressure: roundMetric( Math.max( row.chromaPressure.wrongMinusCorrect, 0 ) ),
						weightedChromaPressure: roundMetric( weightedChromaPressure )
					};

				} );
				const correctRows = rows.filter( row => row.relationToReceiver === 'correct-side' );
				const wrongRows = rows.filter( row => row.relationToReceiver === 'wrong-side' );
				const visibilityWeight = rows.reduce( ( total, row ) => total + row.visibilityWeight, 0 );
				const correctVisibilityWeight = correctRows.reduce( ( total, row ) => total + row.visibilityWeight, 0 );
				const wrongVisibilityWeight = wrongRows.reduce( ( total, row ) => total + row.visibilityWeight, 0 );
				const weightedDistance = rows.reduce( ( total, row ) =>
					total + row.distance * row.visibilityWeight, 0
				) / Math.max( visibilityWeight, 0.0001 );
				const nearestCorrect = [ ...correctRows ].sort( ( a, b ) => a.distance - b.distance )[ 0 ] ?? null;
				const nearestWrong = [ ...wrongRows ].sort( ( a, b ) => a.distance - b.distance )[ 0 ] ?? null;
				const dominantWeightedChroma = [ ...rows ].sort( ( a, b ) =>
					b.weightedChromaPressure - a.weightedChromaPressure
				)[ 0 ] ?? null;
				const wrongCloserThanCorrect = nearestWrong !== null &&
					nearestCorrect !== null &&
					nearestWrong.distance <= nearestCorrect.distance;
				const receiverNearDivider = Math.abs( receiverPosition.x - dividerX ) <= densityRiskThreshold;
				const straddlesDivider = correctVisibilityWeight > 0.0001 && wrongVisibilityWeight > 0.0001;
				const densityRisk = receiverNearDivider && straddlesDivider && (
					wrongVisibilityWeight > correctVisibilityWeight * 0.25 ||
					wrongCloserThanCorrect
				);

				return {
					receiver: receiver.label,
					correctSide: receiver.correctSide,
					receiverPosition: receiver.receiverPosition,
					gridSpacing,
					receiverDividerDistance: roundMetric( Math.abs( receiverPosition.x - dividerX ) ),
					receiverDividerDistanceOverGridSpacing: roundMetric(
						Math.abs( receiverPosition.x - dividerX ) / densityRiskThreshold
					),
					visibilityWeight: roundMetric( visibilityWeight ),
					correctVisibilityWeight: roundMetric( correctVisibilityWeight ),
					wrongVisibilityWeight: roundMetric( wrongVisibilityWeight ),
					wrongVisibilityShare: roundMetric( wrongVisibilityWeight / Math.max( visibilityWeight, 0.0001 ) ),
					weightedProbeDistance: roundMetric( weightedDistance ),
					nearestCorrectProbeIndex: nearestCorrect?.probeIndex ?? null,
					nearestCorrectDistance: nearestCorrect?.distance ?? null,
					nearestWrongProbeIndex: nearestWrong?.probeIndex ?? null,
					nearestWrongDistance: nearestWrong?.distance ?? null,
					wrongCloserThanCorrect,
					straddlesDivider,
					receiverNearDivider,
					densityRisk,
					dominantWeightedChromaProbeIndex: dominantWeightedChroma?.probeIndex ?? null,
					dominantWeightedChromaRelation: dominantWeightedChroma?.relationToReceiver ?? 'none',
					dominantWeightedChromaPressure: dominantWeightedChroma?.weightedChromaPressure ?? 0,
					runtimeWrongOverCorrect: receiver.aggregates.runtimeFinal.colorBias.wrongOverCorrect,
					rows
				};

			} );
			const riskRows = receiverRows.filter( row => row.densityRisk );
			const worstWrongShareRow = [ ...receiverRows ].sort( ( a, b ) =>
				b.wrongVisibilityShare - a.wrongVisibilityShare
			)[ 0 ] ?? null;

			return {
				status: riskRows.length > 0 ?
					'OPEN-PROBE-DENSITY-DIVIDER-STRADDLE-RISK' :
					'SUPPORTED-PROBE-DENSITY-BOUNDED',
				proofBoundary: 'Readback-only probe-density and receiver/probe geometry audit; measures divider distance, trilinear straddling, neighbor distances, and weighted chroma pressure without changing bake density, runtime sampling, public API, or Chebyshev thresholds.',
				grid: {
					resolution,
					probeCount,
					gridSpacing,
					dividerX: roundMetric( dividerX )
				},
				receiverRows,
				summary: {
					receiverCount: receiverRows.length,
					riskReceiverCount: riskRows.length,
					worstWrongShareReceiver: worstWrongShareRow?.receiver ?? 'none',
					worstWrongVisibilityShare: worstWrongShareRow?.wrongVisibilityShare ?? 0,
					maxRuntimeWrongOverCorrect: roundMetric( Math.max(
						0,
						...receiverRows.map( row => row.runtimeWrongOverCorrect )
					) ),
					maxReceiverDividerDistanceOverGridSpacing: roundMetric( Math.max(
						0,
						...receiverRows.map( row => row.receiverDividerDistanceOverGridSpacing )
					) ),
					interpretation: riskRows.length > 0 ?
						'Receiver samples are within roughly one probe spacing of the divider and their interpolation cells straddle both sides; this supports studying probe density, sample placement, and bake capture before runtime threshold changes.' :
						'Receiver/probe density geometry is bounded for the audited center samples; continue with surface-sample metric alignment or bake capture quality before runtime threshold changes.'
				}
			};

		};

		const createProbeBakeContaminationMap = async ( diagnostics ) => {

			const chromaPressureThreshold = 0.05;
			const leftWallTarget = new THREE.Vector3( - 2.52, 1.78, 0 );
			const rightWallTarget = new THREE.Vector3( 2.52, 1.78, 0 );
			const appearancesByProbe = new Map();

			for ( const receiver of diagnostics ) {

				for ( const row of receiver.rows ) {

					if ( appearancesByProbe.has( row.probeIndex ) === false ) appearancesByProbe.set( row.probeIndex, [] );

					appearancesByProbe.get( row.probeIndex ).push( {
						receiver: receiver.label,
						receiverCorrectSide: receiver.correctSide,
						receiverNormal: receiver.receiverNormal,
						relationToReceiver: row.relationToReceiver,
						scalarWeight: row.scalarWeight,
						visibilityWeight: row.visibilityWeight,
						visibility: row.visibility,
						irradiance: row.irradiance,
						l0Irradiance: row.l0Irradiance,
						chromaPressure: row.chromaPressure,
						l0ChromaPressure: row.l0ChromaPressure,
						bandDecomposition: row.bandDecomposition,
						colorBias: row.colorBias,
						l0ColorBias: row.l0ColorBias
					} );

				}

			}

			const evaluateWallTarget = ( probe, probePosition, target, targetSide, probeSide ) => {

				const direction = target.clone().sub( probePosition ).normalize();
				const dividerAudit = auditDividerSegment( probePosition, target );
				const irradiance = evaluateProbeCoefficientsForReceiver( probe.coefficients, direction );
				const l0Irradiance = roundColor( probe.l0Irradiance );
				const bandDecomposition = createShBandDecomposition( probe.coefficients, direction, probeSide );
				const expectedBlockedByDivider = probeSide !== targetSide;

				return {
					targetSide,
					targetPosition: roundVector( target ),
					direction: roundVector( direction ),
					expectedBlockedByDivider,
					segmentIntersectsDivider: dividerAudit.intersects,
					dividerAuditReason: dividerAudit.reason,
					dividerIntersectionDistance: dividerAudit.distance,
					dividerIntersectionPoint: dividerAudit.point,
					blockedButSegmentBypassesDivider: expectedBlockedByDivider && dividerAudit.intersects === false,
					irradiance,
					l0Irradiance,
					chromaticity: createColorChromaticity( irradiance ),
					l0Chromaticity: createColorChromaticity( l0Irradiance ),
					chromaPressure: createReceiverChromaPressure( irradiance, probeSide ),
					l0ChromaPressure: createReceiverChromaPressure( l0Irradiance, probeSide ),
					bandDecomposition,
					colorBias: createReceiverColorBias( irradiance, probeSide ),
					l0ColorBias: createReceiverColorBias( l0Irradiance, probeSide )
				};

			};

			const vectorFromPlain = vector => new THREE.Vector3(
				vector?.x ?? 0,
				vector?.y ?? 0,
				vector?.z ?? 0
			).normalize();
			const createCoefficientContext = ( probe, context ) => {

				const direction = vectorFromPlain( context.direction );
				const decomposition = createShBandDecomposition( probe.coefficients, direction, context.correctSide );
				const coefficientStudy = createShCoefficientContributionStudy( probe.coefficients, direction, context.correctSide );
				const fullPressure = Math.max( decomposition.pressure.full, 0 );
				const dominantCoefficientPressure = Math.max(
					coefficientStudy.dominantCoefficient?.wrongMinusCorrect ?? 0,
					0
				);

				return {
					contextKind: context.contextKind,
					label: context.label,
					relation: context.relation,
					correctSide: context.correctSide,
					targetPosition: context.targetPosition ?? null,
					direction: roundVector( direction ),
					fullChromaPressure: roundMetric( fullPressure ),
					bandResponsibility: decomposition.pressure.dominantBand,
					bandPressure: decomposition.pressure,
					bandTotals: coefficientStudy.bands,
					dominantCoefficient: coefficientStudy.dominantCoefficient,
					dominantCoefficientPressure: roundMetric( dominantCoefficientPressure ),
					topCoefficientRows: coefficientStudy.rows.slice( 0, 5 )
				};

			};

			const createDominantProbeCoefficientStudy = async ( sortedRows ) => {

				const candidateRows = sortedRows
					.filter( row => row.classification !== 'bounded' )
					.slice( 0, 4 );
				const rows = [];

				for ( const row of candidateRows ) {

					const probe = await readProbeCoefficients( row.probeIndex );
					const dominantReceiverAppearance = row.appearances
						.filter( appearance =>
							appearance.relationToReceiver === 'correct-side' &&
									appearance.visibilityWeight > 0.0001
						)
						.sort( ( a, b ) =>
							Math.max( b.chromaPressure.wrongMinusCorrect, 0 ) -
									Math.max( a.chromaPressure.wrongMinusCorrect, 0 )
						)[ 0 ];
					const contexts = [];

					if ( dominantReceiverAppearance !== undefined ) {

						contexts.push( {
							contextKind: 'receiver-normal',
							label: dominantReceiverAppearance.receiver,
							relation: dominantReceiverAppearance.relationToReceiver,
							correctSide: dominantReceiverAppearance.receiverCorrectSide,
							direction: dominantReceiverAppearance.receiverNormal
						} );

					}

					contexts.push( {
						contextKind: 'blocked-opposite-wall',
						label: `${ row.side }-probe-to-${ row.wallVisibility.blockedOppositeWall.targetSide }-wall`,
						relation: 'blocked-opposite-wall',
						correctSide: row.side,
						targetPosition: row.wallVisibility.blockedOppositeWall.targetPosition,
						direction: row.wallVisibility.blockedOppositeWall.direction
					} );

					const contextStudies = contexts.map( context =>
						createCoefficientContext( probe, context )
					);
					const dominantContext = [ ...contextStudies ].sort( ( a, b ) =>
						b.fullChromaPressure - a.fullChromaPressure
					)[ 0 ] ?? null;

					rows.push( {
						probeIndex: row.probeIndex,
						side: row.side,
						sourceProbeIndex: row.sourceProbeIndex,
						validity: row.validity,
						classification: row.classification,
						bandResponsibility: row.bandResponsibility,
						maxCorrectReceiverChromaPressure: row.maxCorrectReceiverChromaPressure,
						blockedOppositeWallChromaPressure: row.blockedOppositeWallChromaPressure,
						dominantContextKind: dominantContext?.contextKind ?? 'none',
						dominantContextBand: dominantContext?.bandResponsibility ?? 'none',
						dominantCoefficientIndex: dominantContext?.dominantCoefficient?.coefficientIndex ?? null,
						dominantCoefficientName: dominantContext?.dominantCoefficient?.name ?? 'none',
						dominantCoefficientBand: dominantContext?.dominantCoefficient?.band ?? 'none',
						dominantCoefficientWrongMinusCorrect: dominantContext?.dominantCoefficient?.wrongMinusCorrect ?? 0,
						contexts: contextStudies
					} );

				}

				const contextRows = rows.flatMap( row =>
					row.contexts.map( context => ( {
						probeIndex: row.probeIndex,
						classification: row.classification,
						contextKind: context.contextKind,
						bandResponsibility: context.bandResponsibility,
						fullChromaPressure: context.fullChromaPressure,
						dominantCoefficient: context.dominantCoefficient
					} ) )
				);
				const dominantContext = [ ...contextRows ].sort( ( a, b ) =>
					b.fullChromaPressure - a.fullChromaPressure
				)[ 0 ] ?? null;

				return {
					status: rows.length > 0 ?
						'OPEN-DOMINANT-SH-COEFFICIENT-LOBE-DRIVERS' :
						'SUPPORTED-NO-DOMINANT-SH-COEFFICIENT-DRIVERS',
					proofBoundary: 'Readback-only dominant-probe raw SH coefficient/lobe contribution table for the sealed-wall bake contamination map; identifies which L1/L2 coefficient rows drive wrong-channel pressure before Chebyshev tuning.',
					rows,
					summary: {
						candidateProbeCount: rows.length,
						contextCount: contextRows.length,
						dominantProbeIndex: dominantContext?.probeIndex ?? null,
						dominantContextKind: dominantContext?.contextKind ?? 'none',
						dominantContextBandResponsibility: dominantContext?.bandResponsibility ?? 'none',
						dominantCoefficientIndex: dominantContext?.dominantCoefficient?.coefficientIndex ?? null,
						dominantCoefficientName: dominantContext?.dominantCoefficient?.name ?? 'none',
						dominantCoefficientBand: dominantContext?.dominantCoefficient?.band ?? 'none',
						dominantCoefficientWrongMinusCorrect: dominantContext?.dominantCoefficient?.wrongMinusCorrect ?? 0,
						interpretation: rows.length > 0 ?
							'Dominant probes now expose raw coefficient rows and directional basis scales; cumulative band responsibility and single-coefficient drivers can differ because later bands, cancellation, and final clamping change chromaticity. Inspect these drivers before changing runtime visibility or Chebyshev thresholds.' :
							'No dominant contaminated probe rows were available for coefficient-driver inspection.'
					}
				};

			};

			const cloneShCoefficients = coefficients => coefficients.map( coefficient => ( {
				r: coefficient.r,
				g: coefficient.g,
				b: coefficient.b
			} ) );
			const coefficientIndicesForBand = band => shCoefficientTerms
				.filter( term => term.band === band )
				.map( term => term.index );
			const dampingVariants = [
				{ label: 'baseline', mode: 'none', scale: 1 },
				{ label: 'zero-l10', mode: 'indices', indices: [ 2 ], scale: 0 },
				{ label: 'zero-l11', mode: 'indices', indices: [ 3 ], scale: 0 },
				{ label: 'damp-l1-50', mode: 'band', band: 'l1', scale: 0.5 },
				{ label: 'damp-l2-50', mode: 'band', band: 'l2', scale: 0.5 },
				{ label: 'zero-l2', mode: 'band', band: 'l2', scale: 0 },
				{ label: 'damp-dominant-coefficient-50', mode: 'dominant-coefficient', scale: 0.5 },
				{ label: 'zero-dominant-coefficient', mode: 'dominant-coefficient', scale: 0 },
				{ label: 'damp-dominant-band-50', mode: 'dominant-band', scale: 0.5 }
			];
			const aggregateDampingVariants = dampingVariants.filter( variant =>
				[ 'none', 'indices', 'band' ].includes( variant.mode )
			);
			const resolveDampingIndices = ( variant, context ) => {

				if ( variant.mode === 'none' ) return [];
				if ( variant.mode === 'indices' ) return variant.indices;
				if ( variant.mode === 'band' ) return coefficientIndicesForBand( variant.band );
				if ( variant.mode === 'bands' ) {

					return variant.bands.flatMap( band => coefficientIndicesForBand( band ) );

				}

				if ( variant.mode === 'dominant-coefficient' ) {

					return Number.isInteger( context.dominantCoefficient?.coefficientIndex ) ?
						[ context.dominantCoefficient.coefficientIndex ] :
						[];

				}

				if ( variant.mode === 'dominant-band' ) return coefficientIndicesForBand( context.bandResponsibility );

				return [];

			};

			const applyDampingVariant = ( coefficients, variant, context = {} ) => {

				const dampedCoefficients = cloneShCoefficients( coefficients );
				const indices = resolveDampingIndices( variant, context );

				for ( const index of indices ) {

					dampedCoefficients[ index ].r *= variant.scale;
					dampedCoefficients[ index ].g *= variant.scale;
					dampedCoefficients[ index ].b *= variant.scale;

				}

				return {
					coefficients: dampedCoefficients,
					indices
				};

			};

			const evaluateDampedCoefficients = ( coefficients, direction, correctSide ) => {

				const unclamped = evaluateIrradianceContract( coefficients, direction, {
					band1Intensity: _lightProbeContext.params.band1Intensity,
					band2Intensity: _lightProbeContext.params.band2Intensity,
					clampNegative: false
				} );
				const clamped = evaluateIrradianceContract( coefficients, direction, {
					band1Intensity: _lightProbeContext.params.band1Intensity,
					band2Intensity: _lightProbeContext.params.band2Intensity,
					clampNegative: true
				} );
				const chromaPressure = createReceiverChromaPressure( clamped, correctSide );

				return {
					unclamped: roundColor( unclamped ),
					clamped: roundColor( clamped ),
					negativeEnergy: measureNegativeEnergy( unclamped ),
					clampEnergyLoss: roundMetric(
						( clamped.r - unclamped.r ) +
								( clamped.g - unclamped.g ) +
								( clamped.b - unclamped.b )
					),
					chromaticity: createColorChromaticity( clamped ),
					colorBias: createReceiverColorBias( clamped, correctSide ),
					chromaPressure,
					fullChromaPressure: roundMetric( Math.max( chromaPressure.wrongMinusCorrect, 0 ) ),
					correctValue: roundMetric( getColorChannel( clamped, correctSide ) ),
					wrongValue: roundMetric( getWrongColorChannel( clamped, correctSide ) ),
					energy: roundMetric( clamped.r + clamped.g + clamped.b )
				};

			};

			const createDampingVariantRows = ( coefficients, direction, correctSide, context, variants ) => {

				const baselineApplication = applyDampingVariant(
					coefficients,
					variants.find( variant => variant.label === 'baseline' ),
					context
				);
				const baseline = evaluateDampedCoefficients(
					baselineApplication.coefficients,
					direction,
					correctSide
				);

				return variants.map( variant => {

					const application = applyDampingVariant( coefficients, variant, context );
					const evaluation = evaluateDampedCoefficients(
						application.coefficients,
						direction,
						correctSide
					);

					return {
						label: variant.label,
						mode: variant.mode,
						scale: variant.scale,
						targetIndices: application.indices,
						...evaluation,
						chromaImprovement: roundMetric( baseline.fullChromaPressure - evaluation.fullChromaPressure ),
						correctChannelPreservation: roundMetric(
							evaluation.correctValue / Math.max( baseline.correctValue, 0.0001 )
						),
						energyPreservation: roundMetric(
							evaluation.energy / Math.max( baseline.energy, 0.0001 )
						)
					};

				} );

			};

			const createShDampingOracleStudy = async ( coefficientStudy, diagnostics ) => {

				const chromaImprovementThreshold = 0.05;
				const correctChannelPreservationThreshold = 0.5;
				const contextRows = [];

				for ( const row of coefficientStudy.rows ) {

					const probe = await readProbeCoefficients( row.probeIndex );

					for ( const context of row.contexts ) {

						const direction = vectorFromPlain( context.direction );
						const variants = createDampingVariantRows(
							probe.coefficients,
							direction,
							context.correctSide,
							context,
							dampingVariants
						);
						const bestVariant = [ ...variants ]
							.filter( variant => variant.label !== 'baseline' )
							.sort( ( a, b ) => b.chromaImprovement - a.chromaImprovement )[ 0 ] ?? null;

						contextRows.push( {
							probeIndex: row.probeIndex,
							classification: row.classification,
							contextKind: context.contextKind,
							correctSide: context.correctSide,
							baselineFullChromaPressure: variants.find( variant => variant.label === 'baseline' ).fullChromaPressure,
							bestVariantLabel: bestVariant?.label ?? 'none',
							bestVariantImprovement: bestVariant?.chromaImprovement ?? 0,
							bestVariantCorrectChannelPreservation: bestVariant?.correctChannelPreservation ?? 0,
							bestVariantEnergyPreservation: bestVariant?.energyPreservation ?? 0,
							rows: variants
						} );

					}

				}

				const receiverRows = [];

				for ( const receiver of diagnostics ) {

					const normal = vectorFromPlain( receiver.receiverNormal );
					const aggregateRows = [];

					for ( const variant of aggregateDampingVariants ) {

						const coefficients = createZeroCoefficients();
						let totalWeight = 0;

						for ( const row of receiver.rows ) {

							const weight = row.visibilityWeight;

							if ( weight <= 0 ) continue;

							const probe = await readProbeCoefficients( row.probeIndex );
							const damped = applyDampingVariant( probe.coefficients, variant );
							addScaledCoefficients( coefficients, damped.coefficients, weight );
							totalWeight += weight;

						}

						const normalizedCoefficients = scaleCoefficients( coefficients, 1 / Math.max( totalWeight, 0.0001 ) );
						const evaluation = evaluateDampedCoefficients(
							normalizedCoefficients,
							normal,
							receiver.correctSide
						);

						aggregateRows.push( {
							label: variant.label,
							mode: variant.mode,
							scale: variant.scale,
							totalWeight: roundMetric( totalWeight ),
							...evaluation
						} );

					}

					const baseline = aggregateRows.find( row => row.label === 'baseline' );
					const rowsWithDeltas = aggregateRows.map( row => ( {
						...row,
						chromaImprovement: roundMetric( baseline.fullChromaPressure - row.fullChromaPressure ),
						correctChannelPreservation: roundMetric(
							row.correctValue / Math.max( baseline.correctValue, 0.0001 )
						),
						energyPreservation: roundMetric(
							row.energy / Math.max( baseline.energy, 0.0001 )
						)
					} ) );
					const bestVariant = [ ...rowsWithDeltas ]
						.filter( row => row.label !== 'baseline' )
						.sort( ( a, b ) => b.chromaImprovement - a.chromaImprovement )[ 0 ] ?? null;

					receiverRows.push( {
						receiver: receiver.label,
						correctSide: receiver.correctSide,
						baselineFullChromaPressure: baseline.fullChromaPressure,
						bestVariantLabel: bestVariant?.label ?? 'none',
						bestVariantImprovement: bestVariant?.chromaImprovement ?? 0,
						bestVariantCorrectChannelPreservation: bestVariant?.correctChannelPreservation ?? 0,
						rows: rowsWithDeltas
					} );

				}

				const candidateRows = [
					...contextRows.map( row => ( {
						scope: 'context',
						probeIndex: row.probeIndex,
						label: row.bestVariantLabel,
						chromaImprovement: row.bestVariantImprovement,
						correctChannelPreservation: row.bestVariantCorrectChannelPreservation
					} ) ),
					...receiverRows.map( row => ( {
						scope: 'receiver',
						probeIndex: null,
						label: row.bestVariantLabel,
						chromaImprovement: row.bestVariantImprovement,
						correctChannelPreservation: row.bestVariantCorrectChannelPreservation
					} ) )
				].filter( row => row.label !== 'none' );
				const safeRows = candidateRows.filter( row =>
					row.chromaImprovement >= chromaImprovementThreshold &&
							row.correctChannelPreservation >= correctChannelPreservationThreshold
				);
				const safeReceiverRows = safeRows.filter( row => row.scope === 'receiver' );
				const safeContextRows = safeRows.filter( row => row.scope === 'context' );
				const bestSafeRow = [ ...safeRows ].sort( ( a, b ) =>
					b.chromaImprovement - a.chromaImprovement
				)[ 0 ] ?? null;
				const status = safeReceiverRows.length > 0 ?
					'SUPPORTED-SH-DAMPING-ORACLE-REDUCES-AGGREGATE-CHROMA' :
					safeContextRows.length > 0 ?
						'OPEN-SH-DAMPING-ORACLE-CONTEXT-ONLY' :
						'OPEN-SH-DAMPING-ORACLE-NO-SAFE-WIN';

				return {
					status,
					proofBoundary: 'CPU-only SH damping oracle over dominant sealed-wall probe contexts and receiver aggregates; does not change bake data, runtime shader code, public API, or Chebyshev thresholds.',
					thresholds: {
						chromaImprovement: chromaImprovementThreshold,
						correctChannelPreservation: correctChannelPreservationThreshold
					},
					contextRows,
					receiverRows,
					summary: {
						contextCount: contextRows.length,
						receiverCount: receiverRows.length,
						safeWinCount: safeRows.length,
						safeContextWinCount: safeContextRows.length,
						safeReceiverWinCount: safeReceiverRows.length,
						bestSafeScope: bestSafeRow?.scope ?? 'none',
						bestSafeProbeIndex: bestSafeRow?.probeIndex ?? null,
						bestSafeVariant: bestSafeRow?.label ?? 'none',
						bestSafeChromaImprovement: bestSafeRow?.chromaImprovement ?? 0,
						bestSafeCorrectChannelPreservation: bestSafeRow?.correctChannelPreservation ?? 0,
						interpretation: safeReceiverRows.length > 0 ?
							'A CPU-only damping variant reduces receiver-aggregate wrong-channel chroma while preserving enough correct channel; prefer bake/repack band-window experiments before runtime visibility or Chebyshev changes.' :
							safeContextRows.length > 0 ?
								'A CPU-only damping variant reduces isolated dominant-probe context chroma, but receiver aggregates do not yet pass; treat damping as a candidate to test with placement/dilation controls before runtime visibility or Chebyshev changes.' :
								'No CPU-only damping variant met the safe improvement gate; prioritize placement, dilation source quality, or bake capture before runtime visibility or Chebyshev changes.'
					}
				};

			};

			const getProbeIndexFromCoord = coord => {

				if (
					coord.x < 0 || coord.x >= resolution ||
							coord.y < 0 || coord.y >= resolution ||
							coord.z < 0 || coord.z >= resolution
				) {

					return null;

				}

				return coord.x + coord.y * resolution + coord.z * resolution * resolution;

			};

			const getProbeSide = probeIndex => {

				const position = new THREE.Vector3();
				_lightProbeContext.getGridProbePosition( probeIndex, resolution, position );

				return position.x < dividerX ? 'left' : 'right';

			};

			const getProbePositionRounded = probeIndex => {

				const position = new THREE.Vector3();
				_lightProbeContext.getGridProbePosition( probeIndex, resolution, position );

				return {
					position,
					rounded: roundVector( position )
				};

			};

			const findNearestSameSideValidProbe = ( sourceRow, options = {} ) => {

				const sourcePosition = new THREE.Vector3(
					sourceRow.position.x,
					sourceRow.position.y,
					sourceRow.position.z
				);
				const sourceDividerDistance = Math.abs( sourcePosition.x - dividerX );
				let best = null;

				for ( let probeIndex = 0; probeIndex < resolution * resolution * resolution; probeIndex ++ ) {

					if ( probeIndex === sourceRow.probeIndex ) continue;
					if ( getProbeSide( probeIndex ) !== sourceRow.side ) continue;

					const validity = diagnosticState.probeValidity[ probeIndex ] ?? 1;

					if ( validity < 0.99 ) continue;

					const candidatePosition = getProbePositionRounded( probeIndex ).position;
					const dividerDistance = Math.abs( candidatePosition.x - dividerX );

					if ( options.requireFartherFromDivider === true && dividerDistance <= sourceDividerDistance + 0.0001 ) continue;

					const distance = sourcePosition.distanceTo( candidatePosition );

					if ( best === null || distance < best.distance ) {

						best = {
							probeIndex,
							distance,
							dividerDistance,
							validity
						};

					}

				}

				return best;

			};

			const createPlacementSourceCandidate = async ( label, sourceProbeIndex, reason ) => {

				if ( sourceProbeIndex === null ) return null;

				const probe = await readProbeCoefficients( sourceProbeIndex );
				const placement = getProbePositionRounded( sourceProbeIndex );

				return {
					label,
					sourceProbeIndex,
					sourceSide: getProbeSide( sourceProbeIndex ),
					validity: roundMetric( probe.validity ),
					position: placement.rounded,
					reason,
					coefficients: probe.coefficients
				};

			};

			const createPlacementSourceCandidates = async row => {

				const candidates = [];
				const current = await createPlacementSourceCandidate( 'current-probe', row.probeIndex, 'original receiver-neighbor probe' );

				if ( current !== null ) candidates.push( current );

				const dilationSource = await createPlacementSourceCandidate(
					'dilation-source',
					row.sourceProbeIndex,
					'existing dilation/source map entry'
				);

				if ( dilationSource !== null ) candidates.push( dilationSource );

				const shiftDirection = row.side === 'left' ? - 1 : 1;
				const shiftedIndex = getProbeIndexFromCoord( {
					x: row.coord.x + shiftDirection,
					y: row.coord.y,
					z: row.coord.z
				} );
				const shifted = await createPlacementSourceCandidate(
					'same-side-x-shift-away',
					shiftedIndex,
					'one grid cell farther from the divider on the same side'
				);

				if ( shifted !== null && shifted.sourceSide === row.side ) candidates.push( shifted );

				const nearest = findNearestSameSideValidProbe( row );
				const nearestCandidate = await createPlacementSourceCandidate(
					'nearest-same-side-valid',
					nearest?.probeIndex ?? null,
					'nearest valid same-side probe excluding the current probe'
				);

				if ( nearestCandidate !== null ) candidates.push( nearestCandidate );

				const farther = findNearestSameSideValidProbe( row, { requireFartherFromDivider: true } );
				const fartherCandidate = await createPlacementSourceCandidate(
					'nearest-same-side-valid-away-from-divider',
					farther?.probeIndex ?? null,
					'nearest valid same-side probe farther from the divider'
				);

				if ( fartherCandidate !== null ) candidates.push( fartherCandidate );

				return candidates.filter( ( candidate, index, all ) =>
					all.findIndex( other =>
						other.label === candidate.label &&
								other.sourceProbeIndex === candidate.sourceProbeIndex
					) === index
				);

			};

			const getPlacementSourceCandidates = async ( row, sourceCandidatesByProbe ) => {

				if ( sourceCandidatesByProbe.has( row.probeIndex ) === false ) {

					sourceCandidatesByProbe.set( row.probeIndex, await createPlacementSourceCandidates( row ) );

				}

				return sourceCandidatesByProbe.get( row.probeIndex );

			};

			const resolvePlacementDirection = ( candidate, context ) => {

				if ( context.targetPosition !== null && context.targetPosition !== undefined ) {

					const targetPosition = new THREE.Vector3(
						context.targetPosition.x,
						context.targetPosition.y,
						context.targetPosition.z
					);
					const candidatePosition = new THREE.Vector3(
						candidate.position.x,
						candidate.position.y,
						candidate.position.z
					);

					return targetPosition.sub( candidatePosition ).normalize();

				}

				return vectorFromPlain( context.direction );

			};

			const evaluatePlacementCandidate = ( candidate, context ) => {

				const direction = resolvePlacementDirection( candidate, context );
				const evaluation = evaluateDampedCoefficients(
					candidate.coefficients,
					direction,
					context.correctSide
				);

				return {
					label: candidate.label,
					sourceProbeIndex: candidate.sourceProbeIndex,
					sourceSide: candidate.sourceSide,
					validity: candidate.validity,
					position: candidate.position,
					reason: candidate.reason,
					direction: roundVector( direction ),
					...evaluation
				};

			};

			const createReceiverAggregateFromWeightedRows = async ( receiver, label, weightedRows ) => {

				const coefficients = createZeroCoefficients();
				let totalWeight = 0;

				for ( const row of weightedRows ) {

					const weight = row.weight;

					if ( weight <= 0 ) continue;

					const probe = await readProbeCoefficients( row.probeIndex );

					addScaledCoefficients( coefficients, probe.coefficients, weight );
					totalWeight += weight;

				}

				const normal = vectorFromPlain( receiver.receiverNormal );
				const normalizedCoefficients = scaleCoefficients( coefficients, 1 / Math.max( totalWeight, 0.0001 ) );
				const evaluation = evaluateDampedCoefficients(
					normalizedCoefficients,
					normal,
					receiver.correctSide
				);

				return {
					label,
					totalWeight: roundMetric( totalWeight ),
					...evaluation
				};

			};

			const createReceiverVariantDeltas = ( rows, baselineLabel ) => {

				const baseline = rows.find( row => row.label === baselineLabel );

				return rows.map( row => ( {
					...row,
					chromaImprovement: roundMetric( baseline.fullChromaPressure - row.fullChromaPressure ),
					wrongRatioImprovement: roundMetric(
						baseline.colorBias.wrongOverCorrect - row.colorBias.wrongOverCorrect
					),
					correctChannelPreservation: roundMetric(
						row.correctValue / Math.max( baseline.correctValue, 0.0001 )
					),
					energyPreservation: roundMetric(
						row.energy / Math.max( baseline.energy, 0.0001 )
					)
				} ) );

			};

			const getBestImprovementRow = rows => [ ...rows ]
				.filter( row => row.label !== 'visibility-baseline' )
				.sort( ( a, b ) =>
					Math.max( b.chromaImprovement, b.wrongRatioImprovement ) -
					Math.max( a.chromaImprovement, a.wrongRatioImprovement )
				)[ 0 ] ?? null;

			const isSafeAggregateRow = ( row, thresholds ) =>
				row.correctChannelPreservation >= thresholds.correctChannelPreservation &&
				(
					row.chromaImprovement >= thresholds.chromaImprovement ||
					row.wrongRatioImprovement >= thresholds.wrongRatioImprovement
				);

			const createSameSideLayerMaskOracleStudy = async ( diagnostics ) => {

				const thresholds = {
					chromaImprovement: 0.05,
					wrongRatioImprovement: 0.1,
					correctChannelPreservation: 0.5
				};
				const receiverRows = [];

				for ( const receiver of diagnostics ) {

					const correctVisibilityWeight = receiver.rows
						.filter( row => row.relationToReceiver === 'correct-side' )
						.reduce( ( total, row ) => total + row.visibilityWeight, 0 );
					const wrongVisibilityWeight = receiver.rows
						.filter( row => row.relationToReceiver === 'wrong-side' )
						.reduce( ( total, row ) => total + row.visibilityWeight, 0 );
					const aggregateRows = [
						await createReceiverAggregateFromWeightedRows(
							receiver,
							'visibility-baseline',
							receiver.rows.map( row => ( {
								probeIndex: row.probeIndex,
								weight: row.visibilityWeight
							} ) )
						),
						await createReceiverAggregateFromWeightedRows(
							receiver,
							'visibility-same-side-layer',
							receiver.rows.map( row => ( {
								probeIndex: row.probeIndex,
								weight: row.relationToReceiver === 'correct-side' ? row.visibilityWeight : 0
							} ) )
						),
						await createReceiverAggregateFromWeightedRows(
							receiver,
							'scalar-same-side-layer',
							receiver.rows.map( row => ( {
								probeIndex: row.probeIndex,
								weight: row.relationToReceiver === 'correct-side' ? row.scalarWeight : 0
							} ) )
						)
					];
					const rows = createReceiverVariantDeltas( aggregateRows, 'visibility-baseline' );
					const bestCandidate = getBestImprovementRow( rows );

					receiverRows.push( {
						receiver: receiver.label,
						correctSide: receiver.correctSide,
						correctVisibilityWeight: roundMetric( correctVisibilityWeight ),
						wrongVisibilityWeight: roundMetric( wrongVisibilityWeight ),
						removedWrongSideWeight: roundMetric( wrongVisibilityWeight ),
						correctWeightPreservation: roundMetric(
							correctVisibilityWeight / Math.max( correctVisibilityWeight + wrongVisibilityWeight, 0.0001 )
						),
						baselineFullChromaPressure: rows.find( row => row.label === 'visibility-baseline' ).fullChromaPressure,
						baselineWrongOverCorrect: rows.find( row => row.label === 'visibility-baseline' ).colorBias.wrongOverCorrect,
						bestCandidateLabel: bestCandidate?.label ?? 'none',
						bestCandidateChromaImprovement: bestCandidate?.chromaImprovement ?? 0,
						bestCandidateWrongRatioImprovement: bestCandidate?.wrongRatioImprovement ?? 0,
						bestCandidateCorrectChannelPreservation: bestCandidate?.correctChannelPreservation ?? 0,
						rows
					} );

				}

				const safeReceiverRows = receiverRows.filter( row =>
					isSafeAggregateRow( {
						chromaImprovement: row.bestCandidateChromaImprovement,
						wrongRatioImprovement: row.bestCandidateWrongRatioImprovement,
						correctChannelPreservation: row.bestCandidateCorrectChannelPreservation
					}, thresholds )
				);
				const bestSafeRow = [ ...safeReceiverRows ].sort( ( a, b ) =>
					Math.max( b.bestCandidateChromaImprovement, b.bestCandidateWrongRatioImprovement ) -
					Math.max( a.bestCandidateChromaImprovement, a.bestCandidateWrongRatioImprovement )
				)[ 0 ] ?? null;

				return {
					status: safeReceiverRows.length > 0 ?
						'SUPPORTED-SAME-SIDE-LAYER-AGGREGATE-WIN' :
						'OPEN-SAME-SIDE-LAYER-NO-SAFE-WIN',
					proofBoundary: 'CPU-only same-side/rendering-layer mask oracle; removes cross-divider probe contributions by receiver/probe side classification without changing runtime sampling, bake data, public API, or Chebyshev thresholds.',
					thresholds,
					receiverRows,
					summary: {
						receiverCount: receiverRows.length,
						safeReceiverWinCount: safeReceiverRows.length,
						bestSafeReceiver: bestSafeRow?.receiver ?? 'none',
						bestSafeCandidate: bestSafeRow?.bestCandidateLabel ?? 'none',
						bestSafeChromaImprovement: bestSafeRow?.bestCandidateChromaImprovement ?? 0,
						bestSafeWrongRatioImprovement: bestSafeRow?.bestCandidateWrongRatioImprovement ?? 0,
						bestSafeCorrectChannelPreservation: bestSafeRow?.bestCandidateCorrectChannelPreservation ?? 0,
						totalRemovedWrongSideWeight: roundMetric(
							receiverRows.reduce( ( total, row ) => total + row.removedWrongSideWeight, 0 )
						),
						interpretation: safeReceiverRows.length > 0 ?
							'Same-side/layer masking improves a receiver aggregate in CPU proof; consider metadata/layer-gated sampling only after CPU/GPU/render gates remain supported.' :
							'Same-side/layer masking does not pass the aggregate safe gate; keep runtime unchanged and continue with static blocker/SDF or bake-density studies.'
					}
				};

			};

			const createStaticBlockerSdfAudit = ( origin, target ) => {

				if ( _lightProbeContext.leakFixture === null ) {

					return {
						blocked: false,
						segmentIntersectsDivider: false,
						minSignedDistance: null,
						nearestSampleT: null,
						reason: 'no-leak-fixture'
					};

				}

				const divider = _lightProbeContext.getActiveLeakDivider() ?? _lightProbeContext.leakFixture.thinDivider;
				const dividerBox = new THREE.Box3().setFromObject( divider );
				const segmentAudit = auditDividerSegment( origin, target );
				const samplePoint = new THREE.Vector3();
				let minSignedDistance = Infinity;
				let nearestSampleT = 0;

				const signedDistanceToBox = point => {

					const dx = Math.max( dividerBox.min.x - point.x, 0, point.x - dividerBox.max.x );
					const dy = Math.max( dividerBox.min.y - point.y, 0, point.y - dividerBox.max.y );
					const dz = Math.max( dividerBox.min.z - point.z, 0, point.z - dividerBox.max.z );
					const outsideDistance = Math.sqrt( dx * dx + dy * dy + dz * dz );

					if ( outsideDistance > 0 ) return outsideDistance;

					return - Math.min(
						point.x - dividerBox.min.x,
						dividerBox.max.x - point.x,
						point.y - dividerBox.min.y,
						dividerBox.max.y - point.y,
						point.z - dividerBox.min.z,
						dividerBox.max.z - point.z
					);

				};

				for ( let i = 0; i <= 8; i ++ ) {

					const t = i / 8;

					samplePoint.lerpVectors( origin, target, t );

					const signedDistance = signedDistanceToBox( samplePoint );

					if ( signedDistance < minSignedDistance ) {

						minSignedDistance = signedDistance;
						nearestSampleT = t;

					}

				}

				const blocked = segmentAudit.intersects === true || minSignedDistance <= 0;

				return {
					blocked,
					segmentIntersectsDivider: segmentAudit.intersects,
					segmentAuditReason: segmentAudit.reason,
					segmentIntersectionDistance: segmentAudit.distance,
					minSignedDistance: roundMetric( minSignedDistance ),
					nearestSampleT: roundMetric( nearestSampleT ),
					reason: blocked ? 'static-divider-blocked' : 'clear-static-divider'
				};

			};

			const createSdfStaticBlockerOracleStudy = async ( diagnostics ) => {

				const thresholds = {
					chromaImprovement: 0.05,
					wrongRatioImprovement: 0.1,
					correctChannelPreservation: 0.5
				};
				const receiverRows = [];
				const probeRows = [];

				for ( const receiver of diagnostics ) {

					const receiverPosition = new THREE.Vector3(
						receiver.receiverPosition.x,
						receiver.receiverPosition.y,
						receiver.receiverPosition.z
					);
					const sdfRows = [];

					for ( const row of receiver.rows ) {

						const probePosition = new THREE.Vector3();

						_lightProbeContext.getGridProbePosition( row.probeIndex, resolution, probePosition );

						const audit = createStaticBlockerSdfAudit( probePosition, receiverPosition );
						const expectedBlockedBySide = row.relationToReceiver === 'wrong-side';

						sdfRows.push( {
							probeIndex: row.probeIndex,
							side: row.side,
							relationToReceiver: row.relationToReceiver,
							scalarWeight: row.scalarWeight,
							visibilityWeight: row.visibilityWeight,
							expectedBlockedBySide,
							staticBlocked: audit.blocked,
							staticBlockerMismatch: expectedBlockedBySide !== audit.blocked,
							...audit
						} );

					}

					const aggregateRows = [
						await createReceiverAggregateFromWeightedRows(
							receiver,
							'visibility-baseline',
							receiver.rows.map( row => ( {
								probeIndex: row.probeIndex,
								weight: row.visibilityWeight
							} ) )
						),
						await createReceiverAggregateFromWeightedRows(
							receiver,
							'scalar-static-blocker',
							receiver.rows.map( row => {

								const audit = sdfRows.find( sdfRow => sdfRow.probeIndex === row.probeIndex );

								return {
									probeIndex: row.probeIndex,
									weight: audit.staticBlocked ? 0 : row.scalarWeight
								};

							} )
						),
						await createReceiverAggregateFromWeightedRows(
							receiver,
							'visibility-static-blocker',
							receiver.rows.map( row => {

								const audit = sdfRows.find( sdfRow => sdfRow.probeIndex === row.probeIndex );

								return {
									probeIndex: row.probeIndex,
									weight: audit.staticBlocked ? 0 : row.visibilityWeight
								};

							} )
						)
					];
					const rows = createReceiverVariantDeltas( aggregateRows, 'visibility-baseline' );
					const bestCandidate = getBestImprovementRow( rows );
					const blockedWrongSideWeight = sdfRows
						.filter( row => row.relationToReceiver === 'wrong-side' && row.staticBlocked === true )
						.reduce( ( total, row ) => total + row.visibilityWeight, 0 );
					const blockedCorrectSideWeight = sdfRows
						.filter( row => row.relationToReceiver === 'correct-side' && row.staticBlocked === true )
						.reduce( ( total, row ) => total + row.visibilityWeight, 0 );
					const missedWrongSideRows = sdfRows.filter( row =>
						row.relationToReceiver === 'wrong-side' &&
						row.staticBlocked === false &&
						row.visibilityWeight > 0.0001
					);

					probeRows.push( ...sdfRows.map( row => ( {
						receiver: receiver.label,
						...row
					} ) ) );
					receiverRows.push( {
						receiver: receiver.label,
						correctSide: receiver.correctSide,
						baselineFullChromaPressure: rows.find( row => row.label === 'visibility-baseline' ).fullChromaPressure,
						baselineWrongOverCorrect: rows.find( row => row.label === 'visibility-baseline' ).colorBias.wrongOverCorrect,
						blockedWrongSideWeight: roundMetric( blockedWrongSideWeight ),
						blockedCorrectSideWeight: roundMetric( blockedCorrectSideWeight ),
						missedWrongSideCount: missedWrongSideRows.length,
						bestCandidateLabel: bestCandidate?.label ?? 'none',
						bestCandidateChromaImprovement: bestCandidate?.chromaImprovement ?? 0,
						bestCandidateWrongRatioImprovement: bestCandidate?.wrongRatioImprovement ?? 0,
						bestCandidateCorrectChannelPreservation: bestCandidate?.correctChannelPreservation ?? 0,
						rows
					} );

				}

				const safeReceiverRows = receiverRows.filter( row =>
					isSafeAggregateRow( {
						chromaImprovement: row.bestCandidateChromaImprovement,
						wrongRatioImprovement: row.bestCandidateWrongRatioImprovement,
						correctChannelPreservation: row.bestCandidateCorrectChannelPreservation
					}, thresholds )
				);
				const bestSafeRow = [ ...safeReceiverRows ].sort( ( a, b ) =>
					Math.max( b.bestCandidateChromaImprovement, b.bestCandidateWrongRatioImprovement ) -
					Math.max( a.bestCandidateChromaImprovement, a.bestCandidateWrongRatioImprovement )
				)[ 0 ] ?? null;
				const mismatchRows = probeRows.filter( row => row.staticBlockerMismatch === true );
				const missedWrongSideRows = probeRows.filter( row =>
					row.relationToReceiver === 'wrong-side' &&
					row.staticBlocked === false &&
					row.visibilityWeight > 0.0001
				);
				const signedDistanceRows = probeRows
					.map( row => row.minSignedDistance )
					.filter( value => Number.isFinite( value ) );

				return {
					status: safeReceiverRows.length > 0 ?
						'SUPPORTED-SDF-STATIC-BLOCKER-AGGREGATE-WIN' :
						missedWrongSideRows.length > 0 ?
							'OPEN-SDF-STATIC-BLOCKER-MISSED-WRONG-SIDE' :
							'OPEN-SDF-STATIC-BLOCKER-NO-AGGREGATE-WIN',
					proofBoundary: 'CPU-only static divider box-SDF/segment oracle; uses a conservative signed-distance proxy plus segment intersection to test geometry visibility before any WebGPU SDF, runtime sampling, public API, or Chebyshev threshold change.',
					thresholds,
					receiverRows,
					probeRows,
					summary: {
						receiverCount: receiverRows.length,
						probeRowCount: probeRows.length,
						staticBlockedProbeCount: probeRows.filter( row => row.staticBlocked ).length,
						mismatchCount: mismatchRows.length,
						missedWrongSideCount: missedWrongSideRows.length,
						safeReceiverWinCount: safeReceiverRows.length,
						bestSafeReceiver: bestSafeRow?.receiver ?? 'none',
						bestSafeCandidate: bestSafeRow?.bestCandidateLabel ?? 'none',
						bestSafeChromaImprovement: bestSafeRow?.bestCandidateChromaImprovement ?? 0,
						bestSafeWrongRatioImprovement: bestSafeRow?.bestCandidateWrongRatioImprovement ?? 0,
						bestSafeCorrectChannelPreservation: bestSafeRow?.bestCandidateCorrectChannelPreservation ?? 0,
						minSignedDistance: signedDistanceRows.length > 0 ?
							roundMetric( Math.min( ...signedDistanceRows ) ) :
							null,
						interpretation: safeReceiverRows.length > 0 ?
							'Static blocker/SDF-like oracle improves a receiver aggregate; treat this as a larger distance-field visibility design candidate, not a quick Chebyshev tweak.' :
							missedWrongSideRows.length > 0 ?
								'Static blocker/SDF-like oracle misses some wrong-side weighted probes; inspect fixture geometry, sampling position, or probe placement before runtime work.' :
								'Static blocker/SDF-like oracle classifies the sealed-wall segments but does not produce an aggregate safe win; keep runtime unchanged and inspect bake content/density.'
					}
				};

			};

			const createAggregateBakePolicyOracleStudy = async ( sortedRows, diagnostics ) => {

				const thresholds = {
					chromaImprovement: 0.05,
					wrongRatioImprovement: 0.1,
					correctChannelPreservation: 0.5
				};
				const sourcePolicies = [
					'current-probe',
					'dilation-source',
					'same-side-x-shift-away',
					'nearest-same-side-valid',
					'nearest-same-side-valid-away-from-divider'
				];
				const bandPolicies = [
					{ label: 'full-l2', mode: 'none', scale: 1 },
					{ label: 'l0-only', mode: 'bands', bands: [ 'l1', 'l2' ], scale: 0 },
					{ label: 'l0-l1', mode: 'band', band: 'l2', scale: 0 },
					{ label: 'damp-l2-50', mode: 'band', band: 'l2', scale: 0.5 },
					{ label: 'damp-l1l2-50', mode: 'bands', bands: [ 'l1', 'l2' ], scale: 0.5 }
				];
				const mapRowsByProbe = new Map( sortedRows.map( row => [ row.probeIndex, row ] ) );
				const sourceCandidatesByProbe = new Map();
				const receiverRows = [];
				let candidateCount = 0;

				for ( const receiver of diagnostics ) {

					const normal = vectorFromPlain( receiver.receiverNormal );
					const aggregateRows = [];

					for ( const sourcePolicy of sourcePolicies ) {

						for ( const bandPolicy of bandPolicies ) {

							const coefficients = createZeroCoefficients();
							const contributionRows = [];
							let totalWeight = 0;

							for ( const row of receiver.rows ) {

								const weight = row.visibilityWeight;

								if ( weight <= 0 ) continue;

								const mapRow = mapRowsByProbe.get( row.probeIndex );
								const sourceCandidates = mapRow !== undefined ?
									await getPlacementSourceCandidates( mapRow, sourceCandidatesByProbe ) :
									[];
								const replacement = sourceCandidates.find( candidate => candidate.label === sourcePolicy );
								const source = replacement !== undefined ?
									replacement :
									await readProbeCoefficients( row.probeIndex );
								const application = applyDampingVariant( source.coefficients, bandPolicy );

								addScaledCoefficients( coefficients, application.coefficients, weight );
								totalWeight += weight;
								contributionRows.push( {
									probeIndex: row.probeIndex,
									sourceProbeIndex: source.sourceProbeIndex ?? row.probeIndex,
									sourcePolicy,
									bandPolicy: bandPolicy.label,
									side: row.side,
									relationToReceiver: row.relationToReceiver,
									visibilityWeight: row.visibilityWeight,
									scalarWeight: row.scalarWeight,
									appliedWeight: roundMetric( weight ),
									sourceSide: source.sourceSide ?? getProbeSide( row.probeIndex ),
									sourceValidity: source.validity ?? roundMetric( diagnosticState.probeValidity[ row.probeIndex ] ?? 1 ),
									sourceReason: source.reason ?? 'fallback current probe coefficients',
									targetIndices: application.indices
								} );

							}

							const normalizedCoefficients = scaleCoefficients(
								coefficients,
								1 / Math.max( totalWeight, 0.0001 )
							);
							const evaluation = evaluateDampedCoefficients(
								normalizedCoefficients,
								normal,
								receiver.correctSide
							);

							aggregateRows.push( {
								label: `${ sourcePolicy }+${ bandPolicy.label }`,
								sourcePolicy,
								bandPolicy: bandPolicy.label,
								mode: bandPolicy.mode,
								scale: bandPolicy.scale,
								targetIndices: resolveDampingIndices( bandPolicy, {} ),
								totalWeight: roundMetric( totalWeight ),
								contributionRows,
								...evaluation
							} );
							candidateCount ++;

						}

					}

					const rows = createReceiverVariantDeltas(
						aggregateRows,
						'current-probe+full-l2'
					);
					const baseline = rows.find( row => row.label === 'current-probe+full-l2' );
					const bestCandidate = [ ...rows ]
						.filter( row => row.label !== 'current-probe+full-l2' )
						.sort( ( a, b ) =>
							Math.max( b.chromaImprovement, b.wrongRatioImprovement ) -
							Math.max( a.chromaImprovement, a.wrongRatioImprovement )
						)[ 0 ] ?? null;

					receiverRows.push( {
						receiver: receiver.label,
						correctSide: receiver.correctSide,
						baselineFullChromaPressure: baseline.fullChromaPressure,
						baselineWrongOverCorrect: baseline.colorBias.wrongOverCorrect,
						bestSourcePolicy: bestCandidate?.sourcePolicy ?? 'none',
						bestBandPolicy: bestCandidate?.bandPolicy ?? 'none',
						bestCandidateLabel: bestCandidate?.label ?? 'none',
						bestCandidateChromaImprovement: bestCandidate?.chromaImprovement ?? 0,
						bestCandidateWrongRatioImprovement: bestCandidate?.wrongRatioImprovement ?? 0,
						bestCandidateCorrectChannelPreservation: bestCandidate?.correctChannelPreservation ?? 0,
						rows
					} );

				}

				const safeReceiverRows = receiverRows.filter( row =>
					isSafeAggregateRow( {
						chromaImprovement: row.bestCandidateChromaImprovement,
						wrongRatioImprovement: row.bestCandidateWrongRatioImprovement,
						correctChannelPreservation: row.bestCandidateCorrectChannelPreservation
					}, thresholds )
				);
				const bestSafeRow = [ ...safeReceiverRows ].sort( ( a, b ) =>
					Math.max( b.bestCandidateChromaImprovement, b.bestCandidateWrongRatioImprovement ) -
					Math.max( a.bestCandidateChromaImprovement, a.bestCandidateWrongRatioImprovement )
				)[ 0 ] ?? null;

				return {
					status: safeReceiverRows.length > 0 ?
						'SUPPORTED-AGGREGATE-BAKE-POLICY-WIN' :
						'OPEN-AGGREGATE-BAKE-POLICY-NO-SAFE-WIN',
					proofBoundary: 'CPU-only aggregate bake/repack policy oracle; crosses source-repair policies with SH band/window policies over all sealed-wall receiver samples without changing runtime sampling, bake data, public API, or Chebyshev thresholds.',
					thresholds,
					sourcePolicies,
					bandPolicies: bandPolicies.map( policy => ( {
						label: policy.label,
						mode: policy.mode,
						band: policy.band ?? null,
						bands: policy.bands ?? null,
						scale: policy.scale,
						targetIndices: resolveDampingIndices( policy, {} )
					} ) ),
					receiverRows,
					summary: {
						receiverCount: receiverRows.length,
						candidateCount,
						sourcePolicyCount: sourcePolicies.length,
						bandPolicyCount: bandPolicies.length,
						safeReceiverWinCount: safeReceiverRows.length,
						bestSafeReceiver: bestSafeRow?.receiver ?? 'none',
						bestSafeSource: bestSafeRow?.bestSourcePolicy ?? 'none',
						bestSafePolicy: bestSafeRow?.bestBandPolicy ?? 'none',
						bestSafeCandidate: bestSafeRow?.bestCandidateLabel ?? 'none',
						bestSafeChromaImprovement: bestSafeRow?.bestCandidateChromaImprovement ?? 0,
						bestSafeWrongRatioImprovement: bestSafeRow?.bestCandidateWrongRatioImprovement ?? 0,
						bestSafeCorrectChannelPreservation: bestSafeRow?.bestCandidateCorrectChannelPreservation ?? 0,
						interpretation: safeReceiverRows.length > 0 ?
							'An aggregate source-repair plus band-window policy passes the safe receiver gate; next step is a constrained repack-time bake-policy experiment, still gated by CPU/GPU linear and render-region agreement.' :
							'No aggregate source-repair plus band-window policy passes the safe receiver gate; do not promote runtime changes, Chebyshev tuning, or public API, and inspect bake capture, probe density, and receiver/sample metric alignment next.'
					}
				};

			};

			const createDominantProbePlacementStudy = async ( sortedRows, coefficientStudy, diagnostics ) => {

				const chromaImprovementThreshold = 0.05;
				const wrongRatioImprovementThreshold = 0.1;
				const correctChannelPreservationThreshold = 0.5;
				const candidateRows = sortedRows
					.filter( row => row.classification !== 'bounded' )
					.slice( 0, 4 );
				const sourceCandidatesByProbe = new Map();
				const contextRows = [];

				for ( const coefficientRow of coefficientStudy.rows ) {

					const mapRow = candidateRows.find( row => row.probeIndex === coefficientRow.probeIndex );

					if ( mapRow === undefined ) continue;

					const sourceCandidates = await createPlacementSourceCandidates( mapRow );
					sourceCandidatesByProbe.set( mapRow.probeIndex, sourceCandidates );

					for ( const context of coefficientRow.contexts ) {

						const candidateEvaluations = sourceCandidates.map( candidate =>
							evaluatePlacementCandidate( candidate, context )
						);
						const baseline = candidateEvaluations.find( candidate => candidate.label === 'current-probe' );
						const rows = candidateEvaluations.map( candidate => ( {
							...candidate,
							chromaImprovement: roundMetric( baseline.fullChromaPressure - candidate.fullChromaPressure ),
							wrongRatioImprovement: roundMetric(
								baseline.colorBias.wrongOverCorrect - candidate.colorBias.wrongOverCorrect
							),
							correctChannelPreservation: roundMetric(
								candidate.correctValue / Math.max( baseline.correctValue, 0.0001 )
							),
							energyPreservation: roundMetric(
								candidate.energy / Math.max( baseline.energy, 0.0001 )
							)
						} ) );
						const bestCandidate = [ ...rows ]
							.filter( candidate => candidate.label !== 'current-probe' )
							.sort( ( a, b ) =>
								Math.max( b.chromaImprovement, b.wrongRatioImprovement ) -
										Math.max( a.chromaImprovement, a.wrongRatioImprovement )
							)[ 0 ] ?? null;

						contextRows.push( {
							probeIndex: mapRow.probeIndex,
							classification: mapRow.classification,
							contextKind: context.contextKind,
							correctSide: context.correctSide,
							baselineFullChromaPressure: baseline.fullChromaPressure,
							baselineWrongOverCorrect: baseline.colorBias.wrongOverCorrect,
							bestCandidateLabel: bestCandidate?.label ?? 'none',
							bestCandidateSourceProbeIndex: bestCandidate?.sourceProbeIndex ?? null,
							bestCandidateChromaImprovement: bestCandidate?.chromaImprovement ?? 0,
							bestCandidateWrongRatioImprovement: bestCandidate?.wrongRatioImprovement ?? 0,
							bestCandidateCorrectChannelPreservation: bestCandidate?.correctChannelPreservation ?? 0,
							rows
						} );

					}

				}

				const replacementStrategies = [
					'current-probe',
					'dilation-source',
					'same-side-x-shift-away',
					'nearest-same-side-valid',
					'nearest-same-side-valid-away-from-divider'
				];
				const receiverRows = [];

				for ( const receiver of diagnostics ) {

					const normal = vectorFromPlain( receiver.receiverNormal );
					const strategyRows = [];

					for ( const strategy of replacementStrategies ) {

						const coefficients = createZeroCoefficients();
						let totalWeight = 0;

						for ( const row of receiver.rows ) {

							const weight = row.visibilityWeight;

							if ( weight <= 0 ) continue;

							const sourceCandidates = sourceCandidatesByProbe.get( row.probeIndex );
							const replacement = sourceCandidates?.find( candidate => candidate.label === strategy );
							const probe = replacement !== undefined ?
								replacement :
								await readProbeCoefficients( row.probeIndex );

							addScaledCoefficients( coefficients, probe.coefficients, weight );
							totalWeight += weight;

						}

						const normalizedCoefficients = scaleCoefficients( coefficients, 1 / Math.max( totalWeight, 0.0001 ) );
						const evaluation = evaluateDampedCoefficients(
							normalizedCoefficients,
							normal,
							receiver.correctSide
						);

						strategyRows.push( {
							label: strategy,
							totalWeight: roundMetric( totalWeight ),
							...evaluation
						} );

					}

					const baseline = strategyRows.find( row => row.label === 'current-probe' );
					const rows = strategyRows.map( row => ( {
						...row,
						chromaImprovement: roundMetric( baseline.fullChromaPressure - row.fullChromaPressure ),
						wrongRatioImprovement: roundMetric(
							baseline.colorBias.wrongOverCorrect - row.colorBias.wrongOverCorrect
						),
						correctChannelPreservation: roundMetric(
							row.correctValue / Math.max( baseline.correctValue, 0.0001 )
						),
						energyPreservation: roundMetric(
							row.energy / Math.max( baseline.energy, 0.0001 )
						)
					} ) );
					const bestCandidate = [ ...rows ]
						.filter( row => row.label !== 'current-probe' )
						.sort( ( a, b ) =>
							Math.max( b.chromaImprovement, b.wrongRatioImprovement ) -
									Math.max( a.chromaImprovement, a.wrongRatioImprovement )
						)[ 0 ] ?? null;

					receiverRows.push( {
						receiver: receiver.label,
						correctSide: receiver.correctSide,
						baselineFullChromaPressure: baseline.fullChromaPressure,
						baselineWrongOverCorrect: baseline.colorBias.wrongOverCorrect,
						bestCandidateLabel: bestCandidate?.label ?? 'none',
						bestCandidateChromaImprovement: bestCandidate?.chromaImprovement ?? 0,
						bestCandidateWrongRatioImprovement: bestCandidate?.wrongRatioImprovement ?? 0,
						bestCandidateCorrectChannelPreservation: bestCandidate?.correctChannelPreservation ?? 0,
						rows
					} );

				}

				const isSafe = row =>
					row.correctChannelPreservation >= correctChannelPreservationThreshold &&
							(
								row.chromaImprovement >= chromaImprovementThreshold ||
								row.wrongRatioImprovement >= wrongRatioImprovementThreshold
							);
				const safeContextRows = contextRows.filter( row =>
					isSafe( {
						chromaImprovement: row.bestCandidateChromaImprovement,
						wrongRatioImprovement: row.bestCandidateWrongRatioImprovement,
						correctChannelPreservation: row.bestCandidateCorrectChannelPreservation
					} )
				);
				const safeReceiverRows = receiverRows.filter( row =>
					isSafe( {
						chromaImprovement: row.bestCandidateChromaImprovement,
						wrongRatioImprovement: row.bestCandidateWrongRatioImprovement,
						correctChannelPreservation: row.bestCandidateCorrectChannelPreservation
					} )
				);
				const safeRows = [
					...safeContextRows.map( row => ( {
						scope: 'context',
						label: row.bestCandidateLabel,
						probeIndex: row.probeIndex,
						chromaImprovement: row.bestCandidateChromaImprovement,
						wrongRatioImprovement: row.bestCandidateWrongRatioImprovement,
						correctChannelPreservation: row.bestCandidateCorrectChannelPreservation
					} ) ),
					...safeReceiverRows.map( row => ( {
						scope: 'receiver',
						label: row.bestCandidateLabel,
						probeIndex: null,
						chromaImprovement: row.bestCandidateChromaImprovement,
						wrongRatioImprovement: row.bestCandidateWrongRatioImprovement,
						correctChannelPreservation: row.bestCandidateCorrectChannelPreservation
					} ) )
				];
				const bestSafeRow = [ ...safeRows ].sort( ( a, b ) =>
					Math.max( b.chromaImprovement, b.wrongRatioImprovement ) -
							Math.max( a.chromaImprovement, a.wrongRatioImprovement )
				)[ 0 ] ?? null;
				const status = safeReceiverRows.length > 0 ?
					'SUPPORTED-PLACEMENT-ORACLE-AGGREGATE-WIN' :
					safeContextRows.length > 0 ?
						'OPEN-PLACEMENT-ORACLE-CONTEXT-ONLY' :
						'OPEN-PLACEMENT-ORACLE-NO-SAFE-WIN';

				return {
					status,
					proofBoundary: 'CPU-only dominant-probe placement/source oracle; compares current probe, dilation source, same-side shifted source, and nearest same-side valid sources without changing runtime sampling, bake data, public API, or Chebyshev thresholds.',
					thresholds: {
						chromaImprovement: chromaImprovementThreshold,
						wrongRatioImprovement: wrongRatioImprovementThreshold,
						correctChannelPreservation: correctChannelPreservationThreshold
					},
					contextRows,
					receiverRows,
					summary: {
						candidateProbeCount: candidateRows.length,
						contextCount: contextRows.length,
						receiverCount: receiverRows.length,
						safeContextWinCount: safeContextRows.length,
						safeReceiverWinCount: safeReceiverRows.length,
						bestSafeScope: bestSafeRow?.scope ?? 'none',
						bestSafeProbeIndex: bestSafeRow?.probeIndex ?? null,
						bestSafeCandidate: bestSafeRow?.label ?? 'none',
						bestSafeChromaImprovement: bestSafeRow?.chromaImprovement ?? 0,
						bestSafeWrongRatioImprovement: bestSafeRow?.wrongRatioImprovement ?? 0,
						bestSafeCorrectChannelPreservation: bestSafeRow?.correctChannelPreservation ?? 0,
						interpretation: safeReceiverRows.length > 0 ?
							'A same-side placement/source replacement improves a receiver aggregate; prioritize probe placement, dilation-source repair, or sampling-bias shaping before damping or Chebyshev changes.' :
							safeContextRows.length > 0 ?
								'A same-side placement/source replacement improves isolated dominant contexts, but receiver aggregates do not yet pass; combine placement with dilation-source quality and damping oracles before runtime visibility or Chebyshev changes.' :
								'No placement/source replacement met the safe improvement gate; inspect bake capture quality, probe density, and coefficient damping interactions before runtime visibility or Chebyshev changes.'
					}
				};

			};

			const createCombinedSourceDampingOracleStudy = async ( sortedRows, coefficientStudy, diagnostics ) => {

				const chromaImprovementThreshold = 0.05;
				const wrongRatioImprovementThreshold = 0.1;
				const correctChannelPreservationThreshold = 0.5;
				const candidateRows = sortedRows
					.filter( row => row.classification !== 'bounded' )
					.slice( 0, 4 );
				const sourceCandidatesByProbe = new Map();
				const contextRows = [];

				for ( const coefficientRow of coefficientStudy.rows ) {

					const mapRow = candidateRows.find( row => row.probeIndex === coefficientRow.probeIndex );

					if ( mapRow === undefined ) continue;

					const sourceCandidates = await getPlacementSourceCandidates( mapRow, sourceCandidatesByProbe );

					for ( const context of coefficientRow.contexts ) {

						const evaluatedRows = [];

						for ( const candidate of sourceCandidates ) {

							const direction = resolvePlacementDirection( candidate, context );

							for ( const variant of aggregateDampingVariants ) {

								const application = applyDampingVariant( candidate.coefficients, variant, context );
								const evaluation = evaluateDampedCoefficients(
									application.coefficients,
									direction,
									context.correctSide
								);

								evaluatedRows.push( {
									label: `${ candidate.label }+${ variant.label }`,
									sourceLabel: candidate.label,
									variantLabel: variant.label,
									mode: variant.mode,
									scale: variant.scale,
									targetIndices: application.indices,
									sourceProbeIndex: candidate.sourceProbeIndex,
									sourceSide: candidate.sourceSide,
									validity: candidate.validity,
									position: candidate.position,
									reason: `${ candidate.reason }; ${ variant.label } coefficient policy`,
									direction: roundVector( direction ),
									...evaluation
								} );

							}

						}

						const baseline = evaluatedRows.find( row =>
							row.sourceLabel === 'current-probe' &&
									row.variantLabel === 'baseline'
						);
						const rows = evaluatedRows.map( row => ( {
							...row,
							chromaImprovement: roundMetric( baseline.fullChromaPressure - row.fullChromaPressure ),
							wrongRatioImprovement: roundMetric(
								baseline.colorBias.wrongOverCorrect - row.colorBias.wrongOverCorrect
							),
							correctChannelPreservation: roundMetric(
								row.correctValue / Math.max( baseline.correctValue, 0.0001 )
							),
							energyPreservation: roundMetric(
								row.energy / Math.max( baseline.energy, 0.0001 )
							)
						} ) );
						const bestCandidate = [ ...rows ]
							.filter( row =>
								row.sourceLabel !== 'current-probe' ||
										row.variantLabel !== 'baseline'
							)
							.sort( ( a, b ) =>
								Math.max( b.chromaImprovement, b.wrongRatioImprovement ) -
										Math.max( a.chromaImprovement, a.wrongRatioImprovement )
							)[ 0 ] ?? null;

						contextRows.push( {
							probeIndex: mapRow.probeIndex,
							classification: mapRow.classification,
							contextKind: context.contextKind,
							correctSide: context.correctSide,
							baselineFullChromaPressure: baseline.fullChromaPressure,
							baselineWrongOverCorrect: baseline.colorBias.wrongOverCorrect,
							bestSourceLabel: bestCandidate?.sourceLabel ?? 'none',
							bestVariantLabel: bestCandidate?.variantLabel ?? 'none',
							bestSourceProbeIndex: bestCandidate?.sourceProbeIndex ?? null,
							bestChromaImprovement: bestCandidate?.chromaImprovement ?? 0,
							bestWrongRatioImprovement: bestCandidate?.wrongRatioImprovement ?? 0,
							bestCorrectChannelPreservation: bestCandidate?.correctChannelPreservation ?? 0,
							rows
						} );

					}

				}

				const replacementStrategies = [
					'current-probe',
					'dilation-source',
					'same-side-x-shift-away',
					'nearest-same-side-valid',
					'nearest-same-side-valid-away-from-divider'
				];
				const receiverRows = [];

				for ( const receiver of diagnostics ) {

					const normal = vectorFromPlain( receiver.receiverNormal );
					const aggregateRows = [];

					for ( const strategy of replacementStrategies ) {

						for ( const variant of aggregateDampingVariants ) {

							const coefficients = createZeroCoefficients();
							let totalWeight = 0;

							for ( const row of receiver.rows ) {

								const weight = row.visibilityWeight;

								if ( weight <= 0 ) continue;

								const sourceCandidates = sourceCandidatesByProbe.get( row.probeIndex );
								const replacement = sourceCandidates?.find( candidate => candidate.label === strategy );
								const probe = replacement !== undefined ?
									replacement :
									await readProbeCoefficients( row.probeIndex );
								const application = applyDampingVariant( probe.coefficients, variant );

								addScaledCoefficients( coefficients, application.coefficients, weight );
								totalWeight += weight;

							}

							const normalizedCoefficients = scaleCoefficients( coefficients, 1 / Math.max( totalWeight, 0.0001 ) );
							const evaluation = evaluateDampedCoefficients(
								normalizedCoefficients,
								normal,
								receiver.correctSide
							);

							aggregateRows.push( {
								label: `${ strategy }+${ variant.label }`,
								sourceLabel: strategy,
								variantLabel: variant.label,
								mode: variant.mode,
								scale: variant.scale,
								targetIndices: resolveDampingIndices( variant, {} ),
								totalWeight: roundMetric( totalWeight ),
								...evaluation
							} );

						}

					}

					const baseline = aggregateRows.find( row =>
						row.sourceLabel === 'current-probe' &&
								row.variantLabel === 'baseline'
					);
					const rows = aggregateRows.map( row => ( {
						...row,
						chromaImprovement: roundMetric( baseline.fullChromaPressure - row.fullChromaPressure ),
						wrongRatioImprovement: roundMetric(
							baseline.colorBias.wrongOverCorrect - row.colorBias.wrongOverCorrect
						),
						correctChannelPreservation: roundMetric(
							row.correctValue / Math.max( baseline.correctValue, 0.0001 )
						),
						energyPreservation: roundMetric(
							row.energy / Math.max( baseline.energy, 0.0001 )
						)
					} ) );
					const bestCandidate = [ ...rows ]
						.filter( row =>
							row.sourceLabel !== 'current-probe' ||
									row.variantLabel !== 'baseline'
						)
						.sort( ( a, b ) =>
							Math.max( b.chromaImprovement, b.wrongRatioImprovement ) -
									Math.max( a.chromaImprovement, a.wrongRatioImprovement )
						)[ 0 ] ?? null;

					receiverRows.push( {
						receiver: receiver.label,
						correctSide: receiver.correctSide,
						baselineFullChromaPressure: baseline.fullChromaPressure,
						baselineWrongOverCorrect: baseline.colorBias.wrongOverCorrect,
						bestSourceLabel: bestCandidate?.sourceLabel ?? 'none',
						bestVariantLabel: bestCandidate?.variantLabel ?? 'none',
						bestChromaImprovement: bestCandidate?.chromaImprovement ?? 0,
						bestWrongRatioImprovement: bestCandidate?.wrongRatioImprovement ?? 0,
						bestCorrectChannelPreservation: bestCandidate?.correctChannelPreservation ?? 0,
						rows
					} );

				}

				const isSafe = row =>
					row.correctChannelPreservation >= correctChannelPreservationThreshold &&
							(
								row.chromaImprovement >= chromaImprovementThreshold ||
								row.wrongRatioImprovement >= wrongRatioImprovementThreshold
							);
				const safeContextRows = contextRows.filter( row =>
					isSafe( {
						chromaImprovement: row.bestChromaImprovement,
						wrongRatioImprovement: row.bestWrongRatioImprovement,
						correctChannelPreservation: row.bestCorrectChannelPreservation
					} )
				);
				const safeReceiverRows = receiverRows.filter( row =>
					isSafe( {
						chromaImprovement: row.bestChromaImprovement,
						wrongRatioImprovement: row.bestWrongRatioImprovement,
						correctChannelPreservation: row.bestCorrectChannelPreservation
					} )
				);
				const safeRows = [
					...safeContextRows.map( row => ( {
						scope: 'context',
						probeIndex: row.probeIndex,
						sourceLabel: row.bestSourceLabel,
						variantLabel: row.bestVariantLabel,
						chromaImprovement: row.bestChromaImprovement,
						wrongRatioImprovement: row.bestWrongRatioImprovement,
						correctChannelPreservation: row.bestCorrectChannelPreservation
					} ) ),
					...safeReceiverRows.map( row => ( {
						scope: 'receiver',
						probeIndex: null,
						sourceLabel: row.bestSourceLabel,
						variantLabel: row.bestVariantLabel,
						chromaImprovement: row.bestChromaImprovement,
						wrongRatioImprovement: row.bestWrongRatioImprovement,
						correctChannelPreservation: row.bestCorrectChannelPreservation
					} ) )
				];
				const bestSafeRow = [ ...safeRows ].sort( ( a, b ) =>
					Math.max( b.chromaImprovement, b.wrongRatioImprovement ) -
							Math.max( a.chromaImprovement, a.wrongRatioImprovement )
				)[ 0 ] ?? null;
				const status = safeReceiverRows.length > 0 ?
					'SUPPORTED-COMBINED-SOURCE-DAMPING-AGGREGATE-WIN' :
					safeContextRows.length > 0 ?
						'OPEN-COMBINED-SOURCE-DAMPING-CONTEXT-ONLY' :
						'OPEN-COMBINED-SOURCE-DAMPING-NO-SAFE-WIN';

				return {
					status,
					proofBoundary: 'CPU-only combined source-replacement plus SH damping oracle; composes dilation/placement candidates with coefficient band policies without changing runtime sampling, bake data, public API, or Chebyshev thresholds.',
					thresholds: {
						chromaImprovement: chromaImprovementThreshold,
						wrongRatioImprovement: wrongRatioImprovementThreshold,
						correctChannelPreservation: correctChannelPreservationThreshold
					},
					contextRows,
					receiverRows,
					summary: {
						candidateProbeCount: candidateRows.length,
						contextCount: contextRows.length,
						receiverCount: receiverRows.length,
						safeContextWinCount: safeContextRows.length,
						safeReceiverWinCount: safeReceiverRows.length,
						bestSafeScope: bestSafeRow?.scope ?? 'none',
						bestSafeProbeIndex: bestSafeRow?.probeIndex ?? null,
						bestSafeSource: bestSafeRow?.sourceLabel ?? 'none',
						bestSafeVariant: bestSafeRow?.variantLabel ?? 'none',
						bestSafeChromaImprovement: bestSafeRow?.chromaImprovement ?? 0,
						bestSafeWrongRatioImprovement: bestSafeRow?.wrongRatioImprovement ?? 0,
						bestSafeCorrectChannelPreservation: bestSafeRow?.correctChannelPreservation ?? 0,
						interpretation: safeReceiverRows.length > 0 ?
							'Combined source repair plus coefficient damping improves a receiver aggregate; runtime work may be considered only as repack-time source repair and band policy after CPU/GPU/render gates are rechecked.' :
							safeContextRows.length > 0 ?
								'Combined source repair plus coefficient damping improves isolated dominant contexts only; keep this proof-only and continue with dilation-source quality, same-side/layer, and SDF/blocker oracles before runtime work.' :
								'Combined source repair plus coefficient damping does not pass a safe gate; keep runtime unchanged and inspect source quality, layers, SDF blockers, or bake/probe density next.'
					}
				};

			};

			const createDilationSourceQualityStudy = async ( sortedRows, coefficientStudy ) => {

				const chromaImprovementThreshold = 0.05;
				const wrongRatioImprovementThreshold = 0.1;
				const correctChannelPreservationThreshold = 0.5;
				const coefficientRowsByProbe = new Map(
					coefficientStudy.rows.map( row => [ row.probeIndex, row ] )
				);
				const sourceCandidatesByProbe = new Map();
				const rows = [];

				for ( const mapRow of sortedRows ) {

					const sourceCandidates = await getPlacementSourceCandidates( mapRow, sourceCandidatesByProbe );
					const current = sourceCandidates.find( candidate => candidate.label === 'current-probe' );
					const dilation = sourceCandidates.find( candidate => candidate.label === 'dilation-source' );
					const nearest = sourceCandidates.find( candidate => candidate.label === 'nearest-same-side-valid' );
					const farther = sourceCandidates.find( candidate => candidate.label === 'nearest-same-side-valid-away-from-divider' );
					const coefficientRow = coefficientRowsByProbe.get( mapRow.probeIndex );
					const contextRows = [];

					if ( coefficientRow !== undefined && current !== undefined ) {

						const metricCandidates = [ current, dilation, nearest, farther ].filter( candidate => candidate !== undefined );

						for ( const context of coefficientRow.contexts ) {

							const candidateRows = metricCandidates.map( candidate =>
								evaluatePlacementCandidate( candidate, context )
							);
							const baseline = candidateRows.find( candidate => candidate.label === 'current-probe' );
							const evaluatedRows = candidateRows.map( candidate => ( {
								...candidate,
								chromaImprovement: roundMetric( baseline.fullChromaPressure - candidate.fullChromaPressure ),
								wrongRatioImprovement: roundMetric(
									baseline.colorBias.wrongOverCorrect - candidate.colorBias.wrongOverCorrect
								),
								correctChannelPreservation: roundMetric(
									candidate.correctValue / Math.max( baseline.correctValue, 0.0001 )
								),
								energyPreservation: roundMetric(
									candidate.energy / Math.max( baseline.energy, 0.0001 )
								)
							} ) );
							const bestCandidate = [ ...evaluatedRows ]
								.filter( candidate => candidate.label !== 'current-probe' )
								.sort( ( a, b ) =>
									Math.max( b.chromaImprovement, b.wrongRatioImprovement ) -
											Math.max( a.chromaImprovement, a.wrongRatioImprovement )
								)[ 0 ] ?? null;

							contextRows.push( {
								contextKind: context.contextKind,
								correctSide: context.correctSide,
								baselineFullChromaPressure: baseline.fullChromaPressure,
								baselineWrongOverCorrect: baseline.colorBias.wrongOverCorrect,
								bestCandidateLabel: bestCandidate?.label ?? 'none',
								bestCandidateSourceProbeIndex: bestCandidate?.sourceProbeIndex ?? null,
								bestCandidateChromaImprovement: bestCandidate?.chromaImprovement ?? 0,
								bestCandidateWrongRatioImprovement: bestCandidate?.wrongRatioImprovement ?? 0,
								bestCandidateCorrectChannelPreservation: bestCandidate?.correctChannelPreservation ?? 0,
								rows: evaluatedRows
							} );

						}

					}

					const bestContext = [ ...contextRows ].sort( ( a, b ) =>
						Math.max( b.bestCandidateChromaImprovement, b.bestCandidateWrongRatioImprovement ) -
								Math.max( a.bestCandidateChromaImprovement, a.bestCandidateWrongRatioImprovement )
					)[ 0 ] ?? null;
					const pressureMetric = Math.max(
						mapRow.maxCorrectReceiverChromaPressure ?? 0,
						mapRow.blockedOppositeWallChromaPressure ?? 0,
						mapRow.maxCorrectReceiverL0ChromaPressure ?? 0,
						mapRow.maxCorrectReceiverL0L1ChromaPressure ?? 0,
						mapRow.dilatedSourceWrongPressureDelta ?? 0
					);
					const hasSourceQualityEvidence = (
						pressureMetric > 0 &&
						(
							mapRow.sourceSide !== mapRow.side ||
							mapRow.dilatedSourceWrongPressureDelta > 0
						)
					);

					rows.push( {
						probeIndex: mapRow.probeIndex,
						side: mapRow.side,
						validity: mapRow.validity,
						classification: mapRow.classification,
						sourceProbeIndex: mapRow.sourceProbeIndex,
						sourceSide: mapRow.sourceSide,
						sourceDiffers: mapRow.sourceDiffers,
						dilationSourceValid: ( dilation?.validity ?? 0 ) >= 0.99,
						dilationSourceSameSide: dilation?.sourceSide === mapRow.side,
						dilationSourceEqualsCurrent: dilation?.sourceProbeIndex === current?.sourceProbeIndex,
						dilationSourceEqualsNearestSameSideValid: dilation?.sourceProbeIndex === nearest?.sourceProbeIndex,
						nearestSameSideValidProbeIndex: nearest?.sourceProbeIndex ?? null,
						nearestSameSideValidSourceSide: nearest?.sourceSide ?? 'none',
						awayFromDividerProbeIndex: farther?.sourceProbeIndex ?? null,
						bestCandidateLabel: bestContext?.bestCandidateLabel ?? 'none',
						bestCandidateSourceProbeIndex: bestContext?.bestCandidateSourceProbeIndex ?? null,
						bestCandidateChromaImprovement: bestContext?.bestCandidateChromaImprovement ?? 0,
						bestCandidateWrongRatioImprovement: bestContext?.bestCandidateWrongRatioImprovement ?? 0,
						bestCandidateCorrectChannelPreservation: bestContext?.bestCandidateCorrectChannelPreservation ?? 0,
						sourceQualityPressureMetric: roundMetric( pressureMetric ),
						hasSourceQualityEvidence,
						contextRows
					} );

				}

				const isSafe = row =>
					row.bestCandidateCorrectChannelPreservation >= correctChannelPreservationThreshold &&
							(
								row.bestCandidateChromaImprovement >= chromaImprovementThreshold ||
								row.bestCandidateWrongRatioImprovement >= wrongRatioImprovementThreshold
							);
				const sideMismatchRows = rows.filter( row => row.dilationSourceSameSide === false );
				const evidenceRows = rows.filter( row => row.hasSourceQualityEvidence );
				const sideMismatchEvidenceRows = evidenceRows.filter( row => row.dilationSourceSameSide === false );
				const invalidSourceRows = evidenceRows.filter( row => row.dilationSourceValid === false );
				const notNearestRows = evidenceRows.filter( row =>
					row.sourceDiffers === true &&
							row.nearestSameSideValidProbeIndex !== null &&
							row.dilationSourceEqualsNearestSameSideValid === false
				);
				const safeContextRows = evidenceRows.filter( isSafe );
				const bestSafeRow = [ ...safeContextRows ].sort( ( a, b ) =>
					Math.max( b.bestCandidateChromaImprovement, b.bestCandidateWrongRatioImprovement ) -
							Math.max( a.bestCandidateChromaImprovement, a.bestCandidateWrongRatioImprovement )
				)[ 0 ] ?? null;
				const issueProbeIds = new Set( [
					...sideMismatchEvidenceRows,
					...invalidSourceRows,
					...notNearestRows
				].map( row => row.probeIndex ) );
				const issueCount = issueProbeIds.size;
				const status = safeContextRows.length > 0 || issueCount > 0 ?
					'OPEN-DILATION-SOURCE-QUALITY-CANDIDATE' :
					'SUPPORTED-DILATION-SOURCE-QUALITY-BOUNDED';

				return {
					status,
					proofBoundary: 'CPU-only dilation-source quality audit; compares existing dilation-source map against same-side valid source candidates and per-context chroma pressure before any WebGPU repack/runtime change.',
					thresholds: {
						chromaImprovement: chromaImprovementThreshold,
						wrongRatioImprovement: wrongRatioImprovementThreshold,
						correctChannelPreservation: correctChannelPreservationThreshold
					},
					rows,
					summary: {
						auditedProbeCount: rows.length,
						evidenceProbeCount: evidenceRows.length,
						metadataOnlyProbeCount: rows.length - evidenceRows.length,
						changedSourceCount: rows.filter( row => row.sourceDiffers ).length,
						sideMismatchCount: sideMismatchEvidenceRows.length,
						invalidDilationSourceCount: invalidSourceRows.length,
						notNearestSameSideValidCount: notNearestRows.length,
						issueProbeCount: issueCount,
						metricContextProbeCount: rows.filter( row => row.contextRows.length > 0 ).length,
						safeContextWinCount: safeContextRows.length,
						bestSafeProbeIndex: bestSafeRow?.probeIndex ?? null,
						bestSafeCandidate: bestSafeRow?.bestCandidateLabel ?? 'none',
						bestSafeChromaImprovement: bestSafeRow?.bestCandidateChromaImprovement ?? 0,
						bestSafeWrongRatioImprovement: bestSafeRow?.bestCandidateWrongRatioImprovement ?? 0,
						bestSafeCorrectChannelPreservation: bestSafeRow?.bestCandidateCorrectChannelPreservation ?? 0,
						interpretation: safeContextRows.length > 0 ?
							'Dilation/source alternatives improve at least one dominant context; continue with aggregate source+damping and layer/SDF oracles before repack/runtime changes.' :
							issueCount > 0 ?
								'Dilation-source metadata has quality issues but no safe context win yet; keep as audit evidence and do not promote a runtime fix.' :
								'Existing dilation-source metadata is bounded by the current audit; prioritize same-side/layer, SDF blocker, or bake/probe-density studies next.'
					}
				};

			};

			const rows = [];

			for ( const [ probeIndex, appearances ] of appearancesByProbe ) {

				const probe = await readProbeCoefficients( probeIndex );
				const probePosition = new THREE.Vector3();
				_lightProbeContext.getGridProbePosition( probeIndex, resolution, probePosition );

				const probeSide = probePosition.x < dividerX ? 'left' : 'right';
				const sourceProbeIndex = diagnosticState.probeSourceMap[ probeIndex ] ?? probeIndex;
				const sourcePosition = new THREE.Vector3();
				_lightProbeContext.getGridProbePosition( sourceProbeIndex, resolution, sourcePosition );

				const sourceSide = sourcePosition.x < dividerX ? 'left' : 'right';
				const correctAppearances = appearances.filter( row =>
					row.relationToReceiver === 'correct-side' &&
							row.visibilityWeight > 0.0001
				);
				const maxCorrectReceiverChromaPressure = roundMetric( Math.max(
					0,
					...correctAppearances.map( row => Math.max( row.chromaPressure.wrongMinusCorrect, 0 ) )
				) );
				const maxCorrectReceiverL0ChromaPressure = roundMetric( Math.max(
					0,
					...correctAppearances.map( row => Math.max( row.l0ChromaPressure.wrongMinusCorrect, 0 ) )
				) );
				const maxCorrectReceiverL0L1ChromaPressure = roundMetric( Math.max(
					0,
					...correctAppearances.map( row => row.bandDecomposition?.pressure.l0L1 ?? 0 )
				) );
				const maxCorrectReceiverL1ChromaDelta = roundMetric( Math.max(
					0,
					...correctAppearances.map( row => row.bandDecomposition?.pressure.l1Delta ?? 0 )
				) );
				const maxCorrectReceiverL2ChromaDelta = roundMetric( Math.max(
					0,
					...correctAppearances.map( row => row.bandDecomposition?.pressure.l2Delta ?? 0 )
				) );
				const dominantCorrectAppearance = correctAppearances.reduce( ( best, row ) => {

					const pressure = Math.max( row.chromaPressure.wrongMinusCorrect, 0 );

					if ( best === null || pressure > best.pressure ) {

						return {
							pressure,
							bandDecomposition: row.bandDecomposition
						};

					}

					return best;

				}, null );
				const leftWallEvaluation = evaluateWallTarget( probe, probePosition, leftWallTarget, 'left', probeSide );
				const rightWallEvaluation = evaluateWallTarget( probe, probePosition, rightWallTarget, 'right', probeSide );
				const blockedOppositeWallEvaluation = probeSide === 'left' ? rightWallEvaluation : leftWallEvaluation;
				const sameSideWallEvaluation = probeSide === 'left' ? leftWallEvaluation : rightWallEvaluation;
				const blockedOppositeWallChromaPressure = roundMetric(
					Math.max( blockedOppositeWallEvaluation.chromaPressure.wrongMinusCorrect, 0 )
				);
				const sameSideWallChromaPressure = roundMetric(
					Math.max( sameSideWallEvaluation.chromaPressure.wrongMinusCorrect, 0 )
				);
				const correctReceiverDominantBand = dominantCorrectAppearance?.bandDecomposition?.pressure.dominantBand ?? 'none';
				const blockedOppositeWallDominantBand = blockedOppositeWallEvaluation.bandDecomposition.pressure.dominantBand;
				const bandResponsibility = maxCorrectReceiverChromaPressure >= chromaPressureThreshold ?
					correctReceiverDominantBand :
					blockedOppositeWallChromaPressure >= chromaPressureThreshold ?
						blockedOppositeWallDominantBand :
						'bounded';
				let classification = 'bounded';

				if ( blockedOppositeWallEvaluation.blockedButSegmentBypassesDivider ) {

					classification = 'blocked-wall-segment-bypasses-divider';

				} else if ( maxCorrectReceiverChromaPressure >= chromaPressureThreshold ) {

					classification = 'receiver-direction-wrong-chroma';

				} else if ( blockedOppositeWallChromaPressure >= chromaPressureThreshold ) {

					classification = 'blocked-wall-directional-chroma';

				}

				rows.push( {
					probeIndex,
					coord: probe.coord,
					position: roundVector( probePosition ),
					side: probeSide,
					expectedDominantChannel: probeSide === 'left' ? 'red' : 'green',
					sourceProbeIndex,
					sourceSide,
					sourceDiffers: sourceProbeIndex !== probeIndex,
					validity: roundMetric( probe.validity ),
					appearanceCount: appearances.length,
					correctSideAppearanceCount: correctAppearances.length,
					maxCorrectReceiverChromaPressure,
					maxCorrectReceiverL0ChromaPressure,
					maxCorrectReceiverL0L1ChromaPressure,
					maxCorrectReceiverL1ChromaDelta,
					maxCorrectReceiverL2ChromaDelta,
					blockedOppositeWallChromaPressure,
					sameSideWallChromaPressure,
					correctReceiverDominantBand,
					blockedOppositeWallDominantBand,
					bandResponsibility,
					classification,
					appearances,
					wallVisibility: {
						leftWall: leftWallEvaluation,
						rightWall: rightWallEvaluation,
						blockedOppositeWall: blockedOppositeWallEvaluation,
						sameSideWall: sameSideWallEvaluation
					}
				} );

			}

			const maxCorrectReceiverChromaPressure = roundMetric( Math.max(
				0,
				...rows.map( row => row.maxCorrectReceiverChromaPressure )
			) );
			const maxBlockedOppositeWallChromaPressure = roundMetric( Math.max(
				0,
				...rows.map( row => row.blockedOppositeWallChromaPressure )
			) );
			const maxCorrectReceiverL0L1ChromaPressure = roundMetric( Math.max(
				0,
				...rows.map( row => row.maxCorrectReceiverL0L1ChromaPressure )
			) );
			const maxCorrectReceiverL1ChromaDelta = roundMetric( Math.max(
				0,
				...rows.map( row => row.maxCorrectReceiverL1ChromaDelta )
			) );
			const maxCorrectReceiverL2ChromaDelta = roundMetric( Math.max(
				0,
				...rows.map( row => row.maxCorrectReceiverL2ChromaDelta )
			) );
			const blockedOppositeWallVisibilityBypassCount = rows.filter( row =>
				row.wallVisibility.blockedOppositeWall.blockedButSegmentBypassesDivider
			).length;
			const receiverDirectionalChromaProbeCount = rows.filter( row =>
				row.maxCorrectReceiverChromaPressure >= chromaPressureThreshold
			).length;
			const blockedWallDirectionalChromaProbeCount = rows.filter( row =>
				row.blockedOppositeWallChromaPressure >= chromaPressureThreshold
			).length;
			const l0DominantProbeCount = rows.filter( row => row.bandResponsibility === 'l0' ).length;
			const l1DominantProbeCount = rows.filter( row => row.bandResponsibility === 'l1' ).length;
			const l2DominantProbeCount = rows.filter( row => row.bandResponsibility === 'l2' ).length;
			const directionalBandDominantProbeCount = l1DominantProbeCount + l2DominantProbeCount;
			const sortedRows = [ ...rows ].sort( ( a, b ) =>
				Math.max( b.maxCorrectReceiverChromaPressure, b.blockedOppositeWallChromaPressure ) -
						Math.max( a.maxCorrectReceiverChromaPressure, a.blockedOppositeWallChromaPressure )
			);
			const dominantProbe = sortedRows[ 0 ] ?? null;
			const dominantProbeCoefficientStudy = await createDominantProbeCoefficientStudy( sortedRows );
			const shDampingOracleStudy = await createShDampingOracleStudy(
				dominantProbeCoefficientStudy,
				diagnostics
			);
			const dominantProbePlacementStudy = await createDominantProbePlacementStudy(
				sortedRows,
				dominantProbeCoefficientStudy,
				diagnostics
			);
			const combinedSourceDampingOracleStudy = await createCombinedSourceDampingOracleStudy(
				sortedRows,
				dominantProbeCoefficientStudy,
				diagnostics
			);
			const dilationSourceQualityStudy = await createDilationSourceQualityStudy(
				sortedRows,
				dominantProbeCoefficientStudy
			);
			const sameSideLayerMaskOracleStudy = await createSameSideLayerMaskOracleStudy( diagnostics );
			const sdfStaticBlockerOracleStudy = await createSdfStaticBlockerOracleStudy( diagnostics );
			const aggregateBakePolicyOracleStudy = await createAggregateBakePolicyOracleStudy(
				sortedRows,
				diagnostics
			);

			return {
				status: blockedOppositeWallVisibilityBypassCount > 0 ?
					'OPEN-BAKE-CAPTURE-SIDE-WALL-VISIBILITY-BYPASS' :
					Math.max( maxCorrectReceiverChromaPressure, maxBlockedOppositeWallChromaPressure ) >= chromaPressureThreshold ?
						'OPEN-BAKE-CONTENT-DIRECTIONAL-CHROMA-PRESSURE' :
						'SUPPORTED-BAKE-CONTENT-CHROMA-BOUNDED',
				proofBoundary: 'Readback-only per-probe bake-content map over sealed-wall receiver-neighbor probes; classifies probe side, dilation source side, wall-segment divider visibility, and L0/L1/L2 directional SH chroma before Chebyshev tuning.',
				thresholds: {
					chromaPressure: chromaPressureThreshold
				},
				rows: sortedRows,
				summary: {
					uniqueProbeCount: rows.length,
					invalidProbeCount: rows.filter( row => row.validity < 1 ).length,
					dilationSourceChangedCount: rows.filter( row => row.sourceDiffers ).length,
					blockedOppositeWallVisibilityBypassCount,
					receiverDirectionalChromaProbeCount,
					blockedWallDirectionalChromaProbeCount,
					l0DominantProbeCount,
					l1DominantProbeCount,
					l2DominantProbeCount,
					directionalBandDominantProbeCount,
					maxCorrectReceiverChromaPressure,
					maxCorrectReceiverL0L1ChromaPressure,
					maxCorrectReceiverL1ChromaDelta,
					maxCorrectReceiverL2ChromaDelta,
					maxBlockedOppositeWallChromaPressure,
					dominantProbeIndex: dominantProbe?.probeIndex ?? null,
					dominantProbeClassification: dominantProbe?.classification ?? 'none',
					dominantProbeBandResponsibility: dominantProbe?.bandResponsibility ?? 'none',
					dominantCoefficientName: dominantProbeCoefficientStudy.summary.dominantCoefficientName,
					dominantCoefficientBand: dominantProbeCoefficientStudy.summary.dominantCoefficientBand,
					dominantCoefficientWrongMinusCorrect: dominantProbeCoefficientStudy.summary.dominantCoefficientWrongMinusCorrect,
					shDampingOracleStatus: shDampingOracleStudy.status,
					shDampingOracleBestVariant: shDampingOracleStudy.summary.bestSafeVariant,
					shDampingOracleBestChromaImprovement: shDampingOracleStudy.summary.bestSafeChromaImprovement,
					dominantProbePlacementStatus: dominantProbePlacementStudy.status,
					dominantProbePlacementBestCandidate: dominantProbePlacementStudy.summary.bestSafeCandidate,
					dominantProbePlacementBestWrongRatioImprovement: dominantProbePlacementStudy.summary.bestSafeWrongRatioImprovement,
					combinedSourceDampingOracleStatus: combinedSourceDampingOracleStudy.status,
					combinedSourceDampingSafeReceiverWinCount: combinedSourceDampingOracleStudy.summary.safeReceiverWinCount,
					dilationSourceQualityStatus: dilationSourceQualityStudy.status,
					dilationSourceQualitySafeContextWinCount: dilationSourceQualityStudy.summary.safeContextWinCount,
					sameSideLayerMaskOracleStatus: sameSideLayerMaskOracleStudy.status,
					sameSideLayerMaskSafeReceiverWinCount: sameSideLayerMaskOracleStudy.summary.safeReceiverWinCount,
					sdfStaticBlockerOracleStatus: sdfStaticBlockerOracleStudy.status,
					sdfStaticBlockerSafeReceiverWinCount: sdfStaticBlockerOracleStudy.summary.safeReceiverWinCount,
					aggregateBakePolicyOracleStatus: aggregateBakePolicyOracleStudy.status,
					aggregateBakePolicySafeReceiverWinCount: aggregateBakePolicyOracleStudy.summary.safeReceiverWinCount,
					interpretation: blockedOppositeWallVisibilityBypassCount > 0 ?
						'At least one opposite-wall segment bypasses divider geometry; fix capture-side geometry/classification before tuning visibility thresholds.' :
						Math.max( maxCorrectReceiverChromaPressure, maxBlockedOppositeWallChromaPressure ) >= chromaPressureThreshold ?
							`Receiver-neighbor probes show directional wrong-channel chroma in baked SH content while divider segment audits remain blocked; dominant audited band is ${ dominantProbe?.bandResponsibility ?? 'none' }, so inspect bake contamination, SH ringing, probe placement, and dilation-source quality before Chebyshev tuning.` :
							'Probe content chroma is bounded for the audited sealed-wall receiver-neighbor probes.'
				},
				dominantProbe,
				dominantProbeCoefficientStudy,
				shDampingOracleStudy,
				dominantProbePlacementStudy,
				combinedSourceDampingOracleStudy,
				dilationSourceQualityStudy,
				sameSideLayerMaskOracleStudy,
				sdfStaticBlockerOracleStudy,
				aggregateBakePolicyOracleStudy
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
		const probeContentChromaStudy = {
			status: Math.max( maxCorrectSideChromaPressure, maxRuntimeFinalChromaPressure ) >= 0.05 ?
				'OPEN-PROBE-CONTENT-CHROMA-PRESSURE' :
				'SUPPORTED-PROBE-CONTENT-CHROMA-BOUNDED',
			proofBoundary: 'Readback-only probe-content chroma audit over the same receiver neighbor rows; compares L0 and final SH irradiance chromaticity before any Chebyshev tuning.',
			receivers: probeContentReceivers,
			summary: {
				maxCorrectSideChromaPressure,
				maxRuntimeFinalChromaPressure,
				weightedCorrectSideChromaPressureMean,
				dilatedSourceRowCount: probeContentReceivers.reduce( ( total, receiver ) => total + receiver.dilatedSourceRowCount, 0 ),
				invalidNeighborCount: probeContentReceivers.reduce( ( total, receiver ) => total + receiver.invalidNeighborCount, 0 ),
				interpretation: Math.max( maxCorrectSideChromaPressure, maxRuntimeFinalChromaPressure ) >= 0.05 ?
					'Correct-side probe rows already carry wrong-channel chroma pressure in baked SH content; inspect bake contamination, bounced-light chroma, dilation sources, and sample placement before visibility-threshold tuning.' :
					'Correct-side probe rows have bounded wrong-channel chroma pressure; visibility/sample weighting can be investigated next.'
			}
		};
		const probeBakeContaminationMap = await createProbeBakeContaminationMap( receiverDiagnostics );
		const probeDensityMetricStudy = createProbeDensityMetricStudy( receiverDiagnostics );
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
			left: receiverDiagnostics[ 0 ],
			right: receiverDiagnostics[ 1 ],
			probeContentChromaStudy,
			probeBakeContaminationMap,
			probeDensityMetricStudy,
			summary: {
				scalarWrongRatioMean,
				visibilityWrongRatioMean,
				runtimeWrongRatioMean,
				invertedNormalRuntimeWrongRatioMean,
				runtimeWrongRatioImprovementMean,
				probeContentChromaStatus: probeContentChromaStudy.status,
				maxCorrectSideChromaPressure: probeContentChromaStudy.summary.maxCorrectSideChromaPressure,
				maxRuntimeFinalChromaPressure: probeContentChromaStudy.summary.maxRuntimeFinalChromaPressure,
				weightedCorrectSideChromaPressureMean: probeContentChromaStudy.summary.weightedCorrectSideChromaPressureMean,
				probeBakeContaminationStatus: probeBakeContaminationMap.status,
				probeBakeDominantClassification: probeBakeContaminationMap.summary.dominantProbeClassification,
				probeBakeDominantBandResponsibility: probeBakeContaminationMap.summary.dominantProbeBandResponsibility,
				probeBakeMaxCorrectReceiverChromaPressure: probeBakeContaminationMap.summary.maxCorrectReceiverChromaPressure,
				probeBakeMaxCorrectReceiverL1ChromaDelta: probeBakeContaminationMap.summary.maxCorrectReceiverL1ChromaDelta,
				probeBakeMaxCorrectReceiverL2ChromaDelta: probeBakeContaminationMap.summary.maxCorrectReceiverL2ChromaDelta,
				probeBakeMaxBlockedOppositeWallChromaPressure: probeBakeContaminationMap.summary.maxBlockedOppositeWallChromaPressure,
				probeBakeDominantCoefficientName: probeBakeContaminationMap.summary.dominantCoefficientName,
				probeBakeDominantCoefficientBand: probeBakeContaminationMap.summary.dominantCoefficientBand,
				probeDensityMetricStatus: probeDensityMetricStudy.status,
				probeDensityRiskReceiverCount: probeDensityMetricStudy.summary.riskReceiverCount,
				probeDensityWorstWrongVisibilityShare: probeDensityMetricStudy.summary.worstWrongVisibilityShare,
				shDampingOracleStatus: probeBakeContaminationMap.shDampingOracleStudy.status,
				shDampingOracleBestVariant: probeBakeContaminationMap.shDampingOracleStudy.summary.bestSafeVariant,
				shDampingOracleBestChromaImprovement: probeBakeContaminationMap.shDampingOracleStudy.summary.bestSafeChromaImprovement,
				dominantProbePlacementStatus: probeBakeContaminationMap.dominantProbePlacementStudy.status,
				dominantProbePlacementBestCandidate: probeBakeContaminationMap.dominantProbePlacementStudy.summary.bestSafeCandidate,
				dominantProbePlacementBestWrongRatioImprovement: probeBakeContaminationMap.dominantProbePlacementStudy.summary.bestSafeWrongRatioImprovement,
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
