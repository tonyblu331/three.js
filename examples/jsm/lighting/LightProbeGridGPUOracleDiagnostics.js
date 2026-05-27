import * as THREE from 'three/webgpu';

export function createLightProbeGridGPUOracleDiagnostics( dependencies ) {

	const {
		_lightProbeContext,
		aggregateReceiverCoefficients,
		analyzeReceiver,
		analyzeReceiverShContributions,
		captureLeakRegionMetrics,
		createAggregateEvaluation,
		createGaussLegendreReceiverSamples,
		createReceiverColorBias,
		currentHitConfidencePolicy,
		currentVisibilityBiasScale,
		diagnosticState,
		evaluateIrradianceContract,
		readSourceMappedProbeCoefficients,
		roundColor,
		roundMetric
	} = dependencies;

	const createCurrentProbePipelineStudy = () => ( {
		status: 'SUPPORTED-CURRENT-PIPELINE-DOCUMENTED',
		coefficientStorage: {
			shOrder: 'L2 / 9 coefficients per RGB channel',
			rgbScalarCountPerProbe: 27,
			packedAtlasTextures: 7,
			atlasPaddingSlices: 1,
			zh3Relevance: 'research-compression-only; current storage is already full L2 RGB, not 12-scalar linear SH'
		},
		projectionMath: 'L_lm = sum( radiance(direction) * Y_lm(direction) * solidAngleWeight ) * ( 4pi / sumWeights )',
		irradianceMath: 'E(n) uses the three.js SphericalHarmonics3 L2 irradiance convolution constants and clamps negative RGB after all bands are summed.',
		runtimePaths: {
			hardwareFiltered: 'texture3D.sample() over the packed atlas when leakReductionMode is off',
			manualWeighted: '8-neighbor textureLoad() blend when per-probe normal/validity/visibility weights are required'
		},
		manualWeightMath: 'weight = trilinearWeight * normalWeight * max( diagnosticState.probeValidity, 0.05 )',
		visibilityMathBoundary: 'Moment visibility is recorded but Chebyshev constants are not tuned by this study.',
		validityVsDilation: 'Validity downweights invalid probes; source-map replacement is CPU/report-only in proof-6 and must not imply runtime packing behavior.',
		sampling: _lightProbeContext.probeGrid.getSamplingInfo(),
		memory: _lightProbeContext.probeGrid.getMemoryInfo(),
		shadowmaskDecision: 'out-of-scope: Unity-style shadowmask is direct/static-light occlusion, while this proof row runs probes-only indirect SH.'
	} );
	const createDilationOracleStudy = async ( leftReceiver, rightReceiver ) => {

		const summarizeReceiver = async ( receiver ) => {

			const currentValidity = await createAggregateEvaluation( receiver, 'scalarWeight', 'current-validity-only' );
			const dilationOnly = await createAggregateEvaluation( receiver, 'dilationOnlyWeight', 'source-map-only-oracle', () => true, readSourceMappedProbeCoefficients );
			const dilationPlusValidity = await createAggregateEvaluation( receiver, 'scalarWeight', 'source-map-plus-validity-oracle', () => true, readSourceMappedProbeCoefficients );
			const invalidRows = receiver.rows.filter( row => diagnosticState.probeValidity[ row.probeIndex ] < 1 );
			const mappedRows = invalidRows.map( row => ( {
				probeIndex: row.probeIndex,
				sourceProbeIndex: diagnosticState.probeSourceMap[ row.probeIndex ],
				relationToReceiver: row.relationToReceiver,
				scalarWeight: row.scalarWeight,
				dilationOnlyWeight: row.dilationOnlyWeight
			} ) );

			return {
				label: receiver.label,
				correctSide: receiver.correctSide,
				invalidNeighborCount: invalidRows.length,
				dilatedNeighborCount: mappedRows.filter( row => row.sourceProbeIndex !== row.probeIndex ).length,
				mappedRows,
				currentValidity: {
					irradiance: currentValidity.irradiance,
					colorBias: currentValidity.colorBias
				},
				dilationOnly: {
					irradiance: dilationOnly.irradiance,
					colorBias: dilationOnly.colorBias
				},
				dilationPlusValidity: {
					irradiance: dilationPlusValidity.irradiance,
					colorBias: dilationPlusValidity.colorBias
				}
			};

		};

		const leftOracle = await summarizeReceiver( leftReceiver );
		const rightOracle = await summarizeReceiver( rightReceiver );
		const average = ( read ) => roundMetric( ( read( leftOracle ) + read( rightOracle ) ) * 0.5 );
		const currentWrong = average( receiver => receiver.currentValidity.colorBias.wrongOverCorrect );
		const dilationOnlyWrong = average( receiver => receiver.dilationOnly.colorBias.wrongOverCorrect );
		const dilationPlusValidityWrong = average( receiver => receiver.dilationPlusValidity.colorBias.wrongOverCorrect );
		const dilationOnlyImprovement = roundMetric( ( currentWrong - dilationOnlyWrong ) / Math.max( currentWrong, 0.0001 ) );
		const dilationPlusValidityImprovement = roundMetric( ( currentWrong - dilationPlusValidityWrong ) / Math.max( currentWrong, 0.0001 ) );

		return {
			status: Math.max( dilationOnlyImprovement, dilationPlusValidityImprovement ) >= 0.05 ? 'SUPPORTED-DILATION-ORACLE-REDUCES-LEAK' : 'OPEN-DILATION-ORACLE-NOT-PROVEN',
			proofBoundary: 'CPU-only coefficient replacement simulation over packed SH readbacks; no runtime mutation in this diagnostic.',
			dilationSourceEncoding: 'CPU/report-only source map derived from probe validity; proof-6 does not pack replacement source SH coefficients into the runtime atlas.',
			sourceMap: {
				totalProbes: diagnosticState.probeSourceMap.length,
				dilatedProbeCount: Array.from( diagnosticState.probeSourceMap ).filter( ( sourceIndex, probeIndex ) => sourceIndex !== probeIndex ).length
			},
			left: leftOracle,
			right: rightOracle,
			summary: {
				currentWrongOverCorrectMean: currentWrong,
				dilationOnlyWrongOverCorrectMean: dilationOnlyWrong,
				dilationPlusValidityWrongOverCorrectMean: dilationPlusValidityWrong,
				dilationOnlyImprovement,
				dilationPlusValidityImprovement
			}
		};

	};

	const createSamplingBiasStudy = async () => {

		const previousNormalBias = _lightProbeContext.params.normalBias;
		const previousViewBias = _lightProbeContext.params.viewBias;
		const previousGridNormalBias = _lightProbeContext.probeGrid.normalBias.value;
		const previousGridViewBias = _lightProbeContext.probeGrid.viewBias.value;
		const cases = [
			{ label: 'center-no-bias', sampleMode: 'center', normalBias: 0, viewBias: 0 },
			{ label: 'surface-no-bias', sampleMode: 'surface-gauss', normalBias: 0, viewBias: 0 },
			{ label: 'surface-normal-bias', sampleMode: 'surface-gauss', normalBias: 0.5, viewBias: 0 },
			{ label: 'surface-view-bias', sampleMode: 'surface-gauss', normalBias: 0, viewBias: 0.5 }
		];
		const summarizeReceiver = async ( biasCase, label, mesh, correctSide ) => {

			const descriptors = biasCase.sampleMode === 'center' ? [ null ] : createGaussLegendreReceiverSamples( mesh );
			const samples = [];

			for ( const descriptor of descriptors ) {

				const receiver = await analyzeReceiver( label, mesh, correctSide, currentVisibilityBiasScale, currentHitConfidencePolicy, descriptor, biasCase );
				const contribution = await analyzeReceiverShContributions( receiver );
				samples.push( {
					sampleLabel: receiver.sampleLabel,
					quadratureWeight: receiver.quadratureWeight,
					receiverPosition: receiver.receiverPosition,
					samplePosition: receiver.samplePosition,
					selectedProbeIndices: receiver.rows.map( row => row.probeIndex ),
					wrongSideScalarWeight: roundMetric( receiver.totals.scalarWrong ),
					correctSideScalarWeight: roundMetric( receiver.totals.scalarCorrect ),
					cpuLinearIrradiance: contribution.aggregates.runtimeFinal.irradiance,
					runtimeWrongOverCorrect: contribution.aggregates.runtimeFinal.colorBias.wrongOverCorrect
				} );

			}

			const weightSum = samples.reduce( ( total, sample ) => total + sample.quadratureWeight, 0 );
			const weightedWrong = samples.reduce( ( total, sample ) => total + sample.runtimeWrongOverCorrect * sample.quadratureWeight, 0 ) / Math.max( weightSum, 0.0001 );

			return {
				label,
				correctSide,
				weightedWrongOverCorrect: roundMetric( weightedWrong ),
				samples
			};

		};

		try {

			const rows = [];

			for ( const biasCase of cases ) {

				_lightProbeContext.params.normalBias = biasCase.normalBias;
				_lightProbeContext.params.viewBias = biasCase.viewBias;
				_lightProbeContext.probeGrid.normalBias.value = biasCase.normalBias;
				_lightProbeContext.probeGrid.viewBias.value = biasCase.viewBias;
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				const renderMetrics = captureLeakRegionMetrics();
				const leftBias = await summarizeReceiver( biasCase, 'leftReceiver', _lightProbeContext.leakFixture.leftReceiver, 'left' );
				const rightBias = await summarizeReceiver( biasCase, 'rightReceiver', _lightProbeContext.leakFixture.rightReceiver, 'right' );
				rows.push( {
					...biasCase,
					renderSurfaceWrongSideColorRatio: renderMetrics.surfaceWrongSideColorRatio,
					cpuWrongOverCorrectMean: roundMetric( ( leftBias.weightedWrongOverCorrect + rightBias.weightedWrongOverCorrect ) * 0.5 ),
					left: leftBias,
					right: rightBias
				} );

			}

			const bestCpu = rows.reduce( ( best, row ) => row.cpuWrongOverCorrectMean < best.cpuWrongOverCorrectMean ? row : best );

			return {
				status: 'SUPPORTED-SAMPLING-BIAS-STUDY',
				proofBoundary: 'CPU/GPU-visible sample-position study using existing normalBias/viewBias uniforms; no mask/layer API added.',
				rows,
				summary: {
					bestCpuBiasCase: bestCpu.label,
					bestCpuWrongOverCorrectMean: bestCpu.cpuWrongOverCorrectMean,
					metricArtifactWarning: bestCpu.sampleMode === 'center' ? 'center-sample-can-hide-visible-surface-leaks' : 'surface-sample-required-for-render-metric-comparison'
				}
			};

		} finally {

			_lightProbeContext.params.normalBias = previousNormalBias;
			_lightProbeContext.params.viewBias = previousViewBias;
			_lightProbeContext.probeGrid.normalBias.value = previousGridNormalBias;
			_lightProbeContext.probeGrid.viewBias.value = previousGridViewBias;
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		}

	};

	const createShDeringingStudy = async ( leftReceiver, rightReceiver ) => {

		const variants = [
			{ label: 'l0-only', band1Intensity: 0, band2Intensity: 0 },
			{ label: 'l0-l1', band1Intensity: 1, band2Intensity: 0 },
			{ label: 'l2-current', band1Intensity: 1, band2Intensity: 0.55 },
			{ label: 'l2-damped', band1Intensity: 0.6, band2Intensity: 0.55 }
		];
		const summarizeReceiver = async ( receiver ) => {

			const normal = new THREE.Vector3( receiver.receiverNormal.x, receiver.receiverNormal.y, receiver.receiverNormal.z );
			const aggregate = await aggregateReceiverCoefficients( receiver.rows, 'scalarWeight' );
			const rows = variants.map( variant => {

				const unclamped = evaluateIrradianceContract( aggregate.coefficients, normal, {
					band1Intensity: variant.band1Intensity,
					band2Intensity: variant.band2Intensity,
					clampNegative: false
				} );
				const clamped = evaluateIrradianceContract( aggregate.coefficients, normal, {
					band1Intensity: variant.band1Intensity,
					band2Intensity: variant.band2Intensity,
					clampNegative: true
				} );
				const negativeEnergy = Math.max( - unclamped.r, 0 ) + Math.max( - unclamped.g, 0 ) + Math.max( - unclamped.b, 0 );
				const clampEnergyLoss = ( clamped.r - unclamped.r ) + ( clamped.g - unclamped.g ) + ( clamped.b - unclamped.b );

				return {
					...variant,
					unclamped: roundColor( unclamped ),
					clamped: roundColor( clamped ),
					negativeEnergy: roundMetric( negativeEnergy ),
					clampEnergyLoss: roundMetric( clampEnergyLoss ),
					colorBias: createReceiverColorBias( clamped, receiver.correctSide )
				};

			} );

			return {
				label: receiver.label,
				correctSide: receiver.correctSide,
				rows
			};

		};

		const leftDeringing = await summarizeReceiver( leftReceiver );
		const rightDeringing = await summarizeReceiver( rightReceiver );
		const currentRows = [ leftDeringing, rightDeringing ].flatMap( receiver => receiver.rows.filter( row => row.label === 'l2-current' ) );
		const maxNegativeEnergy = roundMetric( Math.max( ...currentRows.map( row => row.negativeEnergy ) ) );

		return {
			status: maxNegativeEnergy > 0.001 ? 'OPEN-SH-RINGING-NEGATIVE-ENERGY-PRESENT' : 'SUPPORTED-SH-RINGING-NOT-DOMINANT',
			proofBoundary: 'CPU-only SH representation study; ZH3 remains compression/reconstruction backlog because current runtime stores full L2 RGB.',
			left: leftDeringing,
			right: rightDeringing,
			summary: {
				maxCurrentNegativeEnergy: maxNegativeEnergy,
				zh3Decision: 'not-current-fix-full-l2-already-stored'
			}
		};

	};

	return {
		createCurrentProbePipelineStudy,
		createDilationOracleStudy,
		createSamplingBiasStudy,
		createShDeringingStudy
	};

}
