import * as THREE from 'three/webgpu';
import { normalWorld, positionWorld, vec3 } from 'three/tsl';

export function createLightProbeGridGPUReceiverDiagnostics( dependencies ) {

	const {
		_lightProbeContext,
		analyzeReceiver,
		analyzeReceiverShContributions,
		captureCanvasSample,
		captureLeakRegionMetrics,
		currentHitConfidencePolicy,
		currentVisibilityBiasScale,
		fixtureMode,
		roundColor,
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

	const createReceiverSurfaceQuadratureDiagnostic = async ( centerContributionDiagnostic ) => {

		const summarizeReceiverSurface = async ( label, mesh, correctSide ) => {

			const samples = [];
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

				samples.push( {
					sampleLabel: receiver.sampleLabel,
					sampleUv: receiver.sampleUv,
					quadratureWeight: receiver.quadratureWeight,
					receiverLocalPosition: receiver.receiverLocalPosition,
					receiverPosition: receiver.receiverPosition,
					receiverNormal: receiver.receiverNormal,
					samplePosition: receiver.samplePosition,
					probeCoord: receiver.probeCoord,
					baseProbeCoord: receiver.baseProbeCoord,
					trilinearBlend: receiver.trilinearBlend,
					selectedProbeIndices: receiver.selectedProbeIndices,
					visibilityReceiverPosition: receiver.visibilityReceiverPosition,
					cpuLinearIrradianceTerms: {
						unit: 'linear-rgb-probe-irradiance',
						scalar: contribution.aggregates.scalar.irradiance,
						visibility: contribution.aggregates.visibility.irradiance,
						final: contribution.aggregates.runtimeFinal.irradiance
					},
					scalarWrongOverCorrect: contribution.aggregates.scalar.colorBias.wrongOverCorrect,
					visibilityWrongOverCorrect: contribution.aggregates.visibility.colorBias.wrongOverCorrect,
					runtimeWrongOverCorrect: contribution.aggregates.runtimeFinal.colorBias.wrongOverCorrect,
					invertedNormalRuntimeWrongOverCorrect: contribution.aggregates.invertedNormalRuntimeFinal.colorBias.wrongOverCorrect,
					runtimeVisibilityMix: contribution.aggregates.runtimeFinal.visibilityMix,
					scalarTotalWeight: contribution.aggregates.scalar.totalWeight,
					visibilityTotalWeight: contribution.aggregates.visibility.totalWeight,
					visibilityMass: receiver.totals.visibilityMass,
					baseWeightSum: receiver.totals.baseSum,
					surfaceCoefficientAttributionRows: contribution.rows.map( row => ( {
						probeIndex: row.probeIndex,
						sourceProbeIndex: row.sourceProbeIndex,
						dilationSourceDiffers: row.dilationSourceDiffers,
						sourceSide: row.sourceSide,
						sourceRelationToReceiver: row.sourceRelationToReceiver,
						side: row.side,
						relationToReceiver: row.relationToReceiver,
						probePosition: row.probePosition,
						crossesDivider: row.crossesDivider,
						visibilitySegmentDividerAudit: row.visibilitySegmentDividerAudit,
						surfaceSegmentDividerAudit: row.surfaceSegmentDividerAudit,
						scalarWeight: row.scalarWeight,
						visibilityWeight: row.visibilityWeight,
						scalarNormalizedWeight: row.scalarNormalizedWeight,
						visibilityNormalizedWeight: row.visibilityNormalizedWeight,
						runtimeFinalWeight: row.runtimeFinalWeight,
						sourceValidity: row.sourceValidity,
						validity: row.validity,
						runtimeWeightedIrradiance: row.runtimeWeightedIrradiance,
						runtimeWeightedCorrectContribution: row.runtimeWeightedCorrectContribution,
						runtimeWeightedWrongContribution: row.runtimeWeightedWrongContribution,
						runtimeWeightedWrongMinusCorrect: row.runtimeWeightedWrongMinusCorrect,
						wrongChannelPressure: row.wrongChannelPressure,
						correctChannelPreservation: row.correctChannelPreservation,
						runtimeWeightedDilatedIrradiance: row.runtimeWeightedDilatedIrradiance,
						runtimeWeightedDilatedCorrectContribution: row.runtimeWeightedDilatedCorrectContribution,
						runtimeWeightedDilatedWrongContribution: row.runtimeWeightedDilatedWrongContribution,
						runtimeWeightedDilatedWrongMinusCorrect: row.runtimeWeightedDilatedWrongMinusCorrect,
						dilatedWrongChannelPressure: row.dilatedWrongChannelPressure,
						dilatedCorrectChannelPreservation: row.dilatedCorrectChannelPreservation,
						dilatedSourceWrongPressureDelta: row.dilatedSourceWrongPressureDelta,
						bandPressure: row.bandDecomposition.pressure,
						fullUnclampedNegativeEnergy: row.fullUnclampedNegativeEnergy,
						postClampEnergyDelta: row.postClampEnergyDelta,
						dilatedFullUnclampedNegativeEnergy: row.dilatedFullUnclampedNegativeEnergy,
						dilatedPostClampEnergyDelta: row.dilatedPostClampEnergyDelta,
						runtimeWeightedBandContributions: row.runtimeWeightedBandContributions,
						runtimeWeightedCoefficientContributions: row.runtimeWeightedCoefficientContributions,
						runtimeWeightedDilatedBandContributions: row.runtimeWeightedDilatedBandContributions,
						runtimeWeightedDilatedCoefficientContributions: row.runtimeWeightedDilatedCoefficientContributions
					} ) )
				} );

			}

			const totalQuadratureWeight = samples.reduce( ( total, sample ) => total + sample.quadratureWeight, 0 );
			const weightedMean = key => roundMetric( samples.reduce(
				( total, sample ) => total + sample[ key ] * sample.quadratureWeight,
				0
			) / Math.max( totalQuadratureWeight, 0.0001 ) );

			return {
				label,
				correctSide,
				sampleCount: samples.length,
				quadratureWeightSum: roundMetric( totalQuadratureWeight ),
				weightedMeans: {
					scalarWrongOverCorrect: weightedMean( 'scalarWrongOverCorrect' ),
					visibilityWrongOverCorrect: weightedMean( 'visibilityWrongOverCorrect' ),
					runtimeWrongOverCorrect: weightedMean( 'runtimeWrongOverCorrect' ),
					invertedNormalRuntimeWrongOverCorrect: weightedMean( 'invertedNormalRuntimeWrongOverCorrect' ),
					runtimeVisibilityMix: weightedMean( 'runtimeVisibilityMix' ),
					scalarTotalWeight: weightedMean( 'scalarTotalWeight' ),
					visibilityTotalWeight: weightedMean( 'visibilityTotalWeight' )
				},
				samples
			};

		};

		const renderMetrics = captureLeakRegionMetrics();
		const leftSurface = await summarizeReceiverSurface( 'leftReceiver', _lightProbeContext.leakFixture.leftReceiver, 'left' );
		const rightSurface = await summarizeReceiverSurface( 'rightReceiver', _lightProbeContext.leakFixture.rightReceiver, 'right' );
		const averageSurface = key => roundMetric( ( leftSurface.weightedMeans[ key ] + rightSurface.weightedMeans[ key ] ) * 0.5 );
		const maxSurface = key => roundMetric( Math.max( leftSurface.weightedMeans[ key ], rightSurface.weightedMeans[ key ] ) );
		const surfaceRuntimeWrongRatioMean = averageSurface( 'runtimeWrongOverCorrect' );
		const surfaceRuntimeWrongRatioMax = maxSurface( 'runtimeWrongOverCorrect' );
		const centerRuntimeWrongRatioMean = centerContributionDiagnostic.summary.runtimeWrongRatioMean;
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
			{ aggregation: 'surface-region-receiver-mean', delta: surfaceCpuRenderDeltaMean, cpuRatio: surfaceRuntimeWrongRatioMean },
			{ aggregation: 'surface-region-receiver-max', delta: surfaceCpuRenderDeltaMax, cpuRatio: surfaceRuntimeWrongRatioMax }
		];

		if ( maskedCpuRenderDeltaMean !== null ) {

			renderAgreementCandidates.push(
				{ aggregation: 'masked-visible-pixels-receiver-mean', delta: maskedCpuRenderDeltaMean, cpuRatio: surfaceRuntimeWrongRatioMean },
				{ aggregation: 'masked-visible-pixels-receiver-max', delta: maskedCpuRenderDeltaMax, cpuRatio: surfaceRuntimeWrongRatioMax }
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
			left: leftSurface,
			right: rightSurface,
			renderMetrics: {
				boundsWrongSideColorRatio: renderMetrics.wrongSideColorRatio,
				centerWrongSideColorRatio: renderMetrics.centerWrongSideColorRatio,
				surfaceWrongSideColorRatio: renderMetrics.surfaceWrongSideColorRatio,
				maskedWrongSideColorRatio: renderMetrics.maskedWrongSideColorRatio,
				maskedCorrectBounceRatio: renderMetrics.maskedCorrectBounceRatio,
				maskedReceiverRegionMetricMode: renderMetrics.maskedReceiverRegionMetricMode,
				receiverRegionMetricMode: renderMetrics.receiverRegionMetricMode
			},
			summary: {
				surfaceScalarWrongRatioMean: averageSurface( 'scalarWrongOverCorrect' ),
				surfaceScalarWrongRatioMax: maxSurface( 'scalarWrongOverCorrect' ),
				surfaceVisibilityWrongRatioMean: averageSurface( 'visibilityWrongOverCorrect' ),
				surfaceVisibilityWrongRatioMax: maxSurface( 'visibilityWrongOverCorrect' ),
				surfaceRuntimeWrongRatioMean,
				surfaceRuntimeWrongRatioMax,
				surfaceInvertedNormalRuntimeWrongRatioMean: averageSurface( 'invertedNormalRuntimeWrongOverCorrect' ),
				surfaceInvertedNormalRuntimeWrongRatioMax: maxSurface( 'invertedNormalRuntimeWrongOverCorrect' ),
				surfaceRuntimeVisibilityMixMean: averageSurface( 'runtimeVisibilityMix' ),
				centerRuntimeWrongRatioMean,
				centerVsSurfaceCpuDelta: roundMetric( Math.abs( surfaceRuntimeWrongRatioMean - centerRuntimeWrongRatioMean ) ),
				surfaceCpuRenderDelta,
				surfaceCpuRenderDeltaMean,
				surfaceCpuRenderDeltaMax,
				maskedCpuRenderDeltaMean,
				maskedCpuRenderDeltaMax,
				cpuRenderAgreementAggregation,
				cpuRenderAgreementCpuRatio: bestRenderAgreement.cpuRatio,
				agreementTolerance,
				cpuRenderAgreementGate: surfaceCpuRenderDelta <= agreementTolerance ? 'SUPPORTED' : 'OPEN'
			}
		};

	};

	const captureReceiverGpuDebugDiagnostics = async ( surfaceQuadratureDiagnostic ) => {

		const createUnavailableGpuDebugDiagnostic = ( reason ) => {

			const finiteRatio = surfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMax ?? 0;

			return {
				status: 'OPEN-GPU-DEBUG-CPU-SURFACE-MISMATCH',
				fixtureMode: 'sealed-wall',
				proofBoundary: 'Proof-6 unavailable GPU debug diagnostic; runtime visibility/debug nodes are inactive and this report must not re-enable them.',
				runtimeDebugUnavailable: true,
				reason,
				summary: {
					bestVariant: 'unavailable-proof-6-runtime-removed',
					bestVariantScale: 0,
					bestSurfaceCpuDelta: 0,
					bestVariantCpuAggregation: 'unavailable-proof-6-runtime-removed',
					bestTightPointVariant: 'unavailable-proof-6-runtime-removed',
					bestTightPointVariantScale: 0,
					bestTightPointSurfaceWrongRatio: finiteRatio,
					bestTightPointSurfaceWrongRatioMax: finiteRatio,
					bestTightPointSurfaceCpuDelta: 0,
					bestTightPointCpuAggregation: 'unavailable-proof-6-runtime-removed',
					bestWeightTermVariant: 'unavailable-proof-6-runtime-removed',
					bestWeightTerm: 'scalarWeight',
					bestWeightTermCpuKey: 'scalar',
					bestWeightTermScale: 0,
					bestWeightTermDeltaMean: 0,
					bestWeightTermDeltaMax: 0,
					bestLinearIrradianceTermVariant: 'unavailable-proof-6-runtime-removed',
					bestLinearIrradianceTerm: 'scalarIrradiance',
					bestLinearIrradianceCpuKey: 'scalar',
					bestLinearIrradianceTermScale: 0,
					bestLinearIrradianceDeltaMean: 0,
					bestLinearIrradianceDeltaMax: 0,
					bestLinearIrradianceClippedSampleCount: 0,
					linearIrradianceAgreementTolerance: 0.15,
					linearIrradianceAgreementGate: 'OPEN',
					linearIrradianceAgreementMode: 'unavailable-proof-6-runtime-removed',
					weightTermAgreementGate: 'OPEN',
					weightTermAgreementMode: 'unavailable-proof-6-runtime-removed',
					agreementMode: 'unavailable-proof-6-runtime-removed',
					comparableVariantCount: 0,
					linearIrradianceTermVariantCount: 0,
					weightTermVariantCount: 0,
					whiteCalibrationLuminanceMean: 0,
					whiteCalibrationVisible: false
				}
			};

		};

		if ( _lightProbeContext.probeGrid.visibilityDepthWeighting === undefined ||
			typeof _lightProbeContext.probeGrid._createManualIrradianceDebugNode !== 'function' ) {

			return createUnavailableGpuDebugDiagnostic( 'Runtime visibility/debug nodes are unavailable in proof-6; keep this evidence OPEN and proof-only.' );

		}

		const previousLeftMaterial = _lightProbeContext.leakFixture.leftReceiver.material;
		const previousRightMaterial = _lightProbeContext.leakFixture.rightReceiver.material;
		const previousVisibilityWeighting = _lightProbeContext.probeGrid.visibilityDepthWeighting.value;
		const surfaceCpuRatioMean = surfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMean;
		const surfaceCpuRatioMax = surfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMax;
		const gridMinNode = vec3( _lightProbeContext.gridMin.x, _lightProbeContext.gridMin.y, _lightProbeContext.gridMin.z );
		const gridExtentNode = vec3(
			_lightProbeContext.gridMax.x - _lightProbeContext.gridMin.x,
			_lightProbeContext.gridMax.y - _lightProbeContext.gridMin.y,
			_lightProbeContext.gridMax.z - _lightProbeContext.gridMin.z
		);
		const debugScales = [ 1, 0.25, 0.08, 0.02 ];
		const weightDebugScales = [ 1, 0.5 ];
		let whiteCalibrationLuminanceMean = null;
		const createCpuAggregationComparison = ( measuredMean, measuredMax ) => {

			const meanDelta = roundMetric( Math.abs( measuredMean - surfaceCpuRatioMean ) );
			const maxDelta = roundMetric( Math.abs( measuredMax - surfaceCpuRatioMax ) );
			const aggregation = maxDelta <= meanDelta ? 'receiver-max' : 'receiver-mean';

			return {
				aggregation,
				delta: Math.min( meanDelta, maxDelta ),
				meanDelta,
				maxDelta,
				cpuRatio: aggregation === 'receiver-max' ? surfaceCpuRatioMax : surfaceCpuRatioMean
			};

		};

		const createDebugMaterial = ( variant ) => {

			const material = new THREE.MeshBasicNodeMaterial( variant.color !== undefined ? { color: variant.color } : {} );

			if ( variant.node === 'irradiance' ) {

				material.colorNode = _lightProbeContext.probeGrid.createIrradianceNode().mul( variant.debugScale );

			} else if ( variant.node === 'normalWorld' ) {

				material.colorNode = normalWorld.normalize().mul( 0.5 ).add( 0.5 );

			} else if ( variant.node === 'positionWorldGrid' ) {

				material.colorNode = positionWorld.sub( gridMinNode ).div( gridExtentNode );

			} else if ( variant.node === 'manualIrradianceDebug' ) {

				material.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( variant.debugMode ).mul( variant.debugScale );

			} else if ( variant.node === 'manualIrradianceLambertDebug' ) {

				const diffuseColor = variant.diffuseColor ?? new THREE.Color( 0xffffff );

				material.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( variant.debugMode )
					.mul( vec3( diffuseColor.r, diffuseColor.g, diffuseColor.b ) )
					.mul( 1 / Math.PI )
					.mul( variant.debugScale );

			} else if ( variant.node === 'manualIrradianceAlbedoDebug' ) {

				const diffuseColor = variant.diffuseColor ?? new THREE.Color( 0xffffff );

				material.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( variant.debugMode )
					.mul( vec3( diffuseColor.r, diffuseColor.g, diffuseColor.b ) )
					.mul( variant.debugScale );

			}

			material.side = THREE.FrontSide;
			material.toneMapped = false;

			return material;

		};

		const createMetricSummary = ( leakMetrics ) => ( {
			boundsWrongSideColorRatio: leakMetrics.wrongSideColorRatio,
			centerWrongSideColorRatio: leakMetrics.centerWrongSideColorRatio,
			surfaceWrongSideColorRatio: leakMetrics.surfaceWrongSideColorRatio,
			maskedWrongSideColorRatio: leakMetrics.maskedWrongSideColorRatio,
			surfaceCorrectBounceRatio: leakMetrics.surfaceCorrectBounceRatio,
			maskedCorrectBounceRatio: leakMetrics.maskedCorrectBounceRatio,
			maskedReceiverRegionMetricMode: leakMetrics.maskedReceiverRegionMetricMode,
			leftSurfaceColor: leakMetrics.surfaceRegions.leftReceiverSurface.color,
			rightSurfaceColor: leakMetrics.surfaceRegions.rightReceiverSurface.color,
			leftMaskedColor: leakMetrics.maskedRegions.leftReceiverMasked.color,
			rightMaskedColor: leakMetrics.maskedRegions.rightReceiverMasked.color,
			leftMaskedSampleCount: leakMetrics.maskedRegions.leftReceiverMasked.sampleCount,
			rightMaskedSampleCount: leakMetrics.maskedRegions.rightReceiverMasked.sampleCount,
			leftSurfaceLuminance: leakMetrics.surfaceRegions.leftReceiverSurface.luminance,
			rightSurfaceLuminance: leakMetrics.surfaceRegions.rightReceiverSurface.luminance,
			leftSurfaceDarkPixelRatio: leakMetrics.surfaceRegions.leftReceiverSurface.darkPixelRatio,
			rightSurfaceDarkPixelRatio: leakMetrics.surfaceRegions.rightReceiverSurface.darkPixelRatio
		} );
		const createScreenPointSample = ( worldPosition, canvasSample, radiusPixels = 1 ) => {

			_lightProbeContext.scene.updateMatrixWorld( true );
			_lightProbeContext.camera.updateMatrixWorld( true );
			_lightProbeContext.camera.updateProjectionMatrix();

			const projected = new THREE.Vector3( worldPosition.x, worldPosition.y, worldPosition.z ).project( _lightProbeContext.camera );
			const screenX = projected.x * 0.5 + 0.5;
			const screenY = 1 - ( projected.y * 0.5 + 0.5 );
			const centerX = Math.round( screenX * ( canvasSample.width - 1 ) );
			const centerY = Math.round( screenY * ( canvasSample.height - 1 ) );
			const color = { r: 0, g: 0, b: 0 };
			let sampleCount = 0;

			for ( let y = centerY - radiusPixels; y <= centerY + radiusPixels; y ++ ) {

				for ( let x = centerX - radiusPixels; x <= centerX + radiusPixels; x ++ ) {

					if ( x < 0 || y < 0 || x >= canvasSample.width || y >= canvasSample.height ) continue;

					const pixel = canvasSample.context.getImageData( x, y, 1, 1 ).data;
					color.r += pixel[ 0 ];
					color.g += pixel[ 1 ];
					color.b += pixel[ 2 ];
					sampleCount ++;

				}

			}

			color.r /= Math.max( sampleCount, 1 );
			color.g /= Math.max( sampleCount, 1 );
			color.b /= Math.max( sampleCount, 1 );

			return {
				worldPosition,
				projected: {
					x: roundMetric( projected.x ),
					y: roundMetric( projected.y ),
					z: roundMetric( projected.z )
				},
				screen: {
					x: roundMetric( screenX ),
					y: roundMetric( screenY ),
					pixelX: centerX,
					pixelY: centerY,
					radiusPixels,
					sampleCount
				},
				color: {
					r: roundMetric( color.r ),
					g: roundMetric( color.g ),
					b: roundMetric( color.b )
				},
				luminance: roundMetric( 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b )
			};

		};

		const getQuadratureWeightTotal = samples => samples.reduce(
			( total, sample ) => total + sample.quadratureWeight,
			0
		);

		const getWeightedSampleMean = ( samples, readValue ) => {

			const weightTotal = getQuadratureWeightTotal( samples );
			return samples.reduce(
				( total, sample ) => total + readValue( sample ) * sample.quadratureWeight,
				0
			) / Math.max( weightTotal, 0.0001 );

		};

		const createTightSurfacePointMetrics = ( canvasSample ) => {

			const summarizeReceiver = ( receiver ) => {

				const pointSamples = receiver.samples.map( sample => {

					const point = createScreenPointSample( sample.receiverPosition, canvasSample );
					const correctValue = receiver.correctSide === 'left' ? point.color.r : point.color.g;
					const wrongValue = receiver.correctSide === 'left' ? point.color.g : point.color.r;

					return {
						sampleLabel: sample.sampleLabel,
						sampleUv: sample.sampleUv,
						quadratureWeight: sample.quadratureWeight,
						...point,
						colorBias: {
							correctValue: roundMetric( correctValue ),
							wrongValue: roundMetric( wrongValue ),
							wrongOverCorrect: roundMetric( wrongValue / Math.max( correctValue, 0.0001 ) )
						}
					};

				} );
				const wrongRatio = getWeightedSampleMean( pointSamples, sample => sample.colorBias.wrongOverCorrect );
				const luminanceMean = getWeightedSampleMean( pointSamples, sample => sample.luminance );

				return {
					label: receiver.label,
					correctSide: receiver.correctSide,
					wrongOverCorrect: roundMetric( wrongRatio ),
					luminanceMean: roundMetric( luminanceMean ),
					pointSamples
				};

			};

			const left = summarizeReceiver( surfaceQuadratureDiagnostic.left );
			const right = summarizeReceiver( surfaceQuadratureDiagnostic.right );
			const surfaceWrongRatioMean = roundMetric( ( left.wrongOverCorrect + right.wrongOverCorrect ) * 0.5 );
			const surfaceWrongRatioMax = roundMetric( Math.max( left.wrongOverCorrect, right.wrongOverCorrect ) );
			const cpuComparison = createCpuAggregationComparison( surfaceWrongRatioMean, surfaceWrongRatioMax );

			return {
				mode: 'projected-receiver-surface-3x3-point-samples',
				left,
				right,
				surfaceWrongRatioMean,
				surfaceWrongRatioMax,
				surfaceCpuDelta: cpuComparison.delta,
				surfaceCpuDeltaMean: cpuComparison.meanDelta,
				surfaceCpuDeltaMax: cpuComparison.maxDelta,
				surfaceCpuAggregation: cpuComparison.aggregation,
				surfaceCpuRatio: cpuComparison.cpuRatio
			};

		};

		const srgbByteToLinearUnit = ( value ) => {

			const c = Math.max( 0, Math.min( value / 255, 1 ) );

			return c <= 0.04045 ? c / 12.92 : Math.pow( ( c + 0.055 ) / 1.055, 2.4 );

		};

		const decodeCanvasColorToLinearIrradiance = ( color, debugScale ) => {

			const scale = Math.max( debugScale ?? 1, 0.0001 );

			return roundColor( {
				r: srgbByteToLinearUnit( color.r ) / scale,
				g: srgbByteToLinearUnit( color.g ) / scale,
				b: srgbByteToLinearUnit( color.b ) / scale
			} );

		};

		const createLinearColorDelta = ( gpu, cpu ) => {

			const delta = {
				r: Math.abs( gpu.r - cpu.r ),
				g: Math.abs( gpu.g - cpu.g ),
				b: Math.abs( gpu.b - cpu.b )
			};

			return {
				r: roundMetric( delta.r ),
				g: roundMetric( delta.g ),
				b: roundMetric( delta.b ),
				mean: roundMetric( ( delta.r + delta.g + delta.b ) / 3 ),
				max: roundMetric( Math.max( delta.r, delta.g, delta.b ) )
			};

		};

		const addWeightedColor = ( total, color, weight ) => {

			total.r += color.r * weight;
			total.g += color.g * weight;
			total.b += color.b * weight;

			return total;

		};

		const divideColor = ( color, scalar ) => roundColor( {
			r: color.r / Math.max( scalar, 0.0001 ),
			g: color.g / Math.max( scalar, 0.0001 ),
			b: color.b / Math.max( scalar, 0.0001 )
		} );

		const getCpuLinearIrradianceColor = ( sample, termKey ) => {

			if ( termKey === 'scalar' ) return sample.cpuLinearIrradianceTerms.scalar;
			if ( termKey === 'visibility' ) return sample.cpuLinearIrradianceTerms.visibility;

			return sample.cpuLinearIrradianceTerms.final;

		};

		const getCpuDebugTermValue = ( sample, termKey ) => {

			if ( termKey === 'visibilityOverScalar' ) {

				return sample.visibilityTotalWeight / Math.max( sample.scalarTotalWeight, 0.0001 );

			}

			return sample[ termKey ];

		};

		const createTightSurfaceTermMetrics = ( canvasSample, variant, calibrationLuminance ) => {

			const decodeGpuTerm = luminance => roundMetric(
				luminance /
						Math.max( calibrationLuminance ?? 255, 1 ) /
						Math.max( variant.debugScale ?? 1, 0.0001 )
			);
			const summarizeReceiver = ( receiver ) => {

				const pointSamples = receiver.samples.map( sample => {

					const point = createScreenPointSample( sample.receiverPosition, canvasSample );
					const cpuValue = roundMetric( getCpuDebugTermValue( sample, variant.cpuTermKey ) );
					const gpuValue = decodeGpuTerm( point.luminance );

					return {
						sampleLabel: sample.sampleLabel,
						sampleUv: sample.sampleUv,
						quadratureWeight: sample.quadratureWeight,
						...point,
						cpuValue,
						gpuValue,
						absoluteDelta: roundMetric( Math.abs( gpuValue - cpuValue ) )
					};

				} );
				const gpuWeightedMean = getWeightedSampleMean( pointSamples, sample => sample.gpuValue );
				const cpuWeightedMean = getWeightedSampleMean( pointSamples, sample => sample.cpuValue );

				return {
					label: receiver.label,
					correctSide: receiver.correctSide,
					gpuWeightedMean: roundMetric( gpuWeightedMean ),
					cpuWeightedMean: roundMetric( cpuWeightedMean ),
					weightedDelta: roundMetric( Math.abs( gpuWeightedMean - cpuWeightedMean ) ),
					pointSamples
				};

			};

			const left = summarizeReceiver( surfaceQuadratureDiagnostic.left );
			const right = summarizeReceiver( surfaceQuadratureDiagnostic.right );
			const termDeltaMean = roundMetric( ( left.weightedDelta + right.weightedDelta ) * 0.5 );
			const termDeltaMax = roundMetric( Math.max( left.weightedDelta, right.weightedDelta ) );

			return {
				mode: 'projected-receiver-surface-3x3-gpu-term-samples',
				debugMode: variant.debugMode,
				cpuTermKey: variant.cpuTermKey,
				debugScale: variant.debugScale,
				calibrationLuminance: roundMetric( calibrationLuminance ?? 255 ),
				left,
				right,
				termDeltaMean,
				termDeltaMax
			};

		};

		const createTightSurfaceIrradianceTermMetrics = ( canvasSample, variant ) => {

			const summarizeReceiver = ( receiver ) => {

				const pointSamples = receiver.samples.map( sample => {

					const point = createScreenPointSample( sample.receiverPosition, canvasSample );
					const cpuLinearRgb = getCpuLinearIrradianceColor( sample, variant.cpuIrradianceTermKey );
					const gpuLinearRgb = decodeCanvasColorToLinearIrradiance( point.color, variant.debugScale );
					const linearRgbDelta = createLinearColorDelta( gpuLinearRgb, cpuLinearRgb );
					const clippedChannel = Math.max( point.color.r, point.color.g, point.color.b ) >= 252;

					return {
						sampleLabel: sample.sampleLabel,
						sampleUv: sample.sampleUv,
						quadratureWeight: sample.quadratureWeight,
						...point,
						linearUnit: 'linear-rgb-probe-irradiance',
						cpuLinearRgb,
						gpuLinearRgb,
						linearRgbDelta,
						clippedChannel
					};

				} );
				const weightTotal = getQuadratureWeightTotal( pointSamples );
				const gpuWeightedTotal = pointSamples.reduce(
					( total, sample ) => addWeightedColor( total, sample.gpuLinearRgb, sample.quadratureWeight ),
					{ r: 0, g: 0, b: 0 }
				);
				const cpuWeightedTotal = pointSamples.reduce(
					( total, sample ) => addWeightedColor( total, sample.cpuLinearRgb, sample.quadratureWeight ),
					{ r: 0, g: 0, b: 0 }
				);
				const gpuWeightedMean = divideColor( gpuWeightedTotal, weightTotal );
				const cpuWeightedMean = divideColor( cpuWeightedTotal, weightTotal );
				const weightedDelta = createLinearColorDelta( gpuWeightedMean, cpuWeightedMean );
				const weightedSampleDeltaMean = getWeightedSampleMean( pointSamples, sample => sample.linearRgbDelta.mean );
				const weightedSampleDeltaMax = getWeightedSampleMean( pointSamples, sample => sample.linearRgbDelta.max );

				return {
					label: receiver.label,
					correctSide: receiver.correctSide,
					gpuWeightedMean,
					cpuWeightedMean,
					weightedDelta,
					weightedSampleDeltaMean: roundMetric( weightedSampleDeltaMean ),
					weightedSampleDeltaMax: roundMetric( weightedSampleDeltaMax ),
					clippedSampleCount: pointSamples.filter( sample => sample.clippedChannel ).length,
					pointSamples
				};

			};

			const left = summarizeReceiver( surfaceQuadratureDiagnostic.left );
			const right = summarizeReceiver( surfaceQuadratureDiagnostic.right );
			const linearRgbDeltaMean = roundMetric( ( left.weightedSampleDeltaMean + right.weightedSampleDeltaMean ) * 0.5 );
			const linearRgbDeltaMax = roundMetric( Math.max( left.weightedSampleDeltaMax, right.weightedSampleDeltaMax ) );

			return {
				mode: 'projected-receiver-surface-3x3-gpu-linear-irradiance-samples',
				debugMode: variant.debugMode,
				cpuIrradianceTermKey: variant.cpuIrradianceTermKey,
				debugScale: variant.debugScale,
				linearUnit: 'linear-rgb-probe-irradiance',
				decode: 'canvas-srgb-byte-to-linear-rgb-divided-by-debugScale',
				left,
				right,
				linearRgbDeltaMean,
				linearRgbDeltaMax,
				clippedSampleCount: left.clippedSampleCount + right.clippedSampleCount
			};

		};

		const captureVariant = ( variant ) => {

			const material = createDebugMaterial( variant );

			try {

				_lightProbeContext.probeGrid.visibilityDepthWeighting.value = variant.visibilityDepthWeighting;
				_lightProbeContext.leakFixture.leftReceiver.material = material;
				_lightProbeContext.leakFixture.rightReceiver.material = material;
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				const leakMetrics = captureLeakRegionMetrics();
				const canvasSample = captureCanvasSample();
				const pointMetrics = createTightSurfacePointMetrics( canvasSample );
				const termMetrics = variant.debugRenderFamily === 'probe-weight' ?
					createTightSurfaceTermMetrics( canvasSample, variant, whiteCalibrationLuminanceMean ) :
					null;
				const linearIrradianceMetrics = variant.debugRenderFamily === 'irradiance-linear-term' ?
					createTightSurfaceIrradianceTermMetrics( canvasSample, variant ) :
					null;
				const surfaceWrongSideColorRatio = leakMetrics.surfaceWrongSideColorRatio;
				const regionCpuComparison = createCpuAggregationComparison(
					roundMetric( (
						leakMetrics.surfaceRegions.leftReceiverSurface.colorBias.greenOverRed +
								leakMetrics.surfaceRegions.rightReceiverSurface.colorBias.redOverGreen
					) * 0.5 ),
					surfaceWrongSideColorRatio
				);
				const surfaceCpuDelta = variant.debugRenderFamily === 'irradiance' ?
					regionCpuComparison.delta :
					null;

				return {
					label: variant.label,
					debugRenderMode: variant.node ?? 'material-color',
					debugRenderFamily: variant.debugRenderFamily,
					visibilityDepthWeighting: variant.visibilityDepthWeighting,
					debugScale: variant.debugScale ?? null,
					debugMode: variant.debugMode ?? null,
					cpuTermKey: variant.cpuTermKey ?? null,
					cpuIrradianceTermKey: variant.cpuIrradianceTermKey ?? null,
					material: variant.material,
					leakMetrics: createMetricSummary( leakMetrics ),
					pointMetrics,
					termMetrics,
					linearIrradianceMetrics,
					termCpuDeltaMean: termMetrics === null ? null : termMetrics.termDeltaMean,
					termCpuDeltaMax: termMetrics === null ? null : termMetrics.termDeltaMax,
					linearIrradianceCpuDeltaMean: linearIrradianceMetrics === null ? null : linearIrradianceMetrics.linearRgbDeltaMean,
					linearIrradianceCpuDeltaMax: linearIrradianceMetrics === null ? null : linearIrradianceMetrics.linearRgbDeltaMax,
					surfaceCpuDelta,
					surfaceCpuDeltaMean: variant.debugRenderFamily === 'irradiance' ? regionCpuComparison.meanDelta : null,
					surfaceCpuDeltaMax: variant.debugRenderFamily === 'irradiance' ? regionCpuComparison.maxDelta : null,
					surfaceCpuAggregation: variant.debugRenderFamily === 'irradiance' ? regionCpuComparison.aggregation : null,
					surfaceCpuRatio: variant.debugRenderFamily === 'irradiance' ? regionCpuComparison.cpuRatio : null
				};

			} finally {

				material.dispose();

			}

		};

		try {

			const calibrationVariants = [
				{
					label: 'receiverWhiteCalibration',
					debugRenderFamily: 'calibration',
					visibilityDepthWeighting: previousVisibilityWeighting,
					color: 0xffffff,
					material: 'MeshBasicNodeMaterial color=white; toneMapped=false'
				},
				{
					label: 'normalWorldReceiver',
					debugRenderFamily: 'geometry',
					visibilityDepthWeighting: previousVisibilityWeighting,
					node: 'normalWorld',
					material: 'MeshBasicNodeMaterial colorNode = normalWorld * 0.5 + 0.5; toneMapped=false'
				},
				{
					label: 'positionWorldGridReceiver',
					debugRenderFamily: 'geometry',
					visibilityDepthWeighting: previousVisibilityWeighting,
					node: 'positionWorldGrid',
					material: 'MeshBasicNodeMaterial colorNode = ( positionWorld - gridMin ) / gridExtent; toneMapped=false'
				}
			];
			const calibrationResults = calibrationVariants.map( captureVariant );
			const whiteCalibration = calibrationResults.find( variant => variant.label === 'receiverWhiteCalibration' );

			whiteCalibrationLuminanceMean = roundMetric(
				(
					whiteCalibration.leakMetrics.leftSurfaceLuminance.mean +
							whiteCalibration.leakMetrics.rightSurfaceLuminance.mean
				) * 0.5
			);

			const irradianceVariants = debugScales.flatMap( debugScale => [
				{
					label: `probeIrradianceScalar-scale-${ debugScale }`,
					debugRenderFamily: 'irradiance',
					visibilityDepthWeighting: 0,
					debugScale,
					node: 'irradiance',
					material: 'MeshBasicNodeMaterial colorNode = LightProbeGridGPU.createIrradianceNode() * debugScale; toneMapped=false'
				},
				{
					label: `probeIrradianceVisibility-scale-${ debugScale }`,
					debugRenderFamily: 'irradiance',
					visibilityDepthWeighting: 1,
					debugScale,
					node: 'irradiance',
					material: 'MeshBasicNodeMaterial colorNode = LightProbeGridGPU.createIrradianceNode() * debugScale; toneMapped=false'
				}
			] );
			const irradianceTermDebugModes = [
				{
					label: 'Scalar',
					debugMode: 'scalarIrradiance',
					cpuIrradianceTermKey: 'scalar'
				},
				{
					label: 'Visibility',
					debugMode: 'visibilityIrradiance',
					cpuIrradianceTermKey: 'visibility'
				},
				{
					label: 'Final',
					debugMode: 'finalIrradiance',
					cpuIrradianceTermKey: 'final'
				}
			];
			const irradianceTermVariants = debugScales.flatMap( debugScale => irradianceTermDebugModes.map( debugMode => ( {
				label: `probe${ debugMode.label }IrradianceTerm-scale-${ debugScale }`,
				debugRenderFamily: 'irradiance-linear-term',
				visibilityDepthWeighting: 1,
				debugScale,
				node: 'manualIrradianceDebug',
				debugMode: debugMode.debugMode,
				cpuIrradianceTermKey: debugMode.cpuIrradianceTermKey,
				material: `MeshBasicNodeMaterial colorNode = LightProbeGridGPU._createManualIrradianceDebugNode( '${ debugMode.debugMode }' ) * debugScale; toneMapped=false`
			} ) ) );

			const weightDebugModes = [
				{
					label: 'ScalarTotal',
					debugMode: 'scalarWeight',
					cpuTermKey: 'scalarTotalWeight'
				},
				{
					label: 'VisibilityTotal',
					debugMode: 'visibilityWeight',
					cpuTermKey: 'visibilityTotalWeight'
				},
				{
					label: 'VisibilityMix',
					debugMode: 'visibilityMix',
					cpuTermKey: 'runtimeVisibilityMix'
				},
				{
					label: 'VisibilityOverScalar',
					debugMode: 'visibilityOverScalar',
					cpuTermKey: 'visibilityOverScalar'
				}
			];
			const weightVariants = weightDebugScales.flatMap( debugScale => weightDebugModes.map( debugMode => ( {
				label: `probeWeight${ debugMode.label }-scale-${ debugScale }`,
				debugRenderFamily: 'probe-weight',
				visibilityDepthWeighting: 1,
				debugScale,
				node: 'manualIrradianceDebug',
				debugMode: debugMode.debugMode,
				cpuTermKey: debugMode.cpuTermKey,
				material: `MeshBasicNodeMaterial colorNode = LightProbeGridGPU._createManualIrradianceDebugNode( '${ debugMode.debugMode }' ) * debugScale; toneMapped=false`
			} ) ) );
			const variants = [
				...calibrationResults,
				...irradianceVariants.map( captureVariant ),
				...irradianceTermVariants.map( captureVariant ),
				...weightVariants.map( captureVariant )
			];
			const comparableVariants = variants.filter( variant => variant.debugRenderFamily === 'irradiance' );
			const irradianceTermMetricVariants = variants.filter( variant => variant.debugRenderFamily === 'irradiance-linear-term' );
			const weightTermVariants = variants.filter( variant => variant.debugRenderFamily === 'probe-weight' );
			const bestVariant = comparableVariants.reduce( ( best, variant ) =>
				variant.surfaceCpuDelta < best.surfaceCpuDelta ? variant : best
			);
			const bestPointVariant = comparableVariants.reduce( ( best, variant ) =>
				variant.pointMetrics.surfaceCpuDelta < best.pointMetrics.surfaceCpuDelta ? variant : best
			);
			const bestWeightTermVariant = weightTermVariants.reduce( ( best, variant ) =>
				variant.termMetrics.termDeltaMean < best.termMetrics.termDeltaMean ? variant : best
			);
			const bestIrradianceTermVariant = irradianceTermMetricVariants.reduce( ( best, variant ) =>
				variant.linearIrradianceMetrics.linearRgbDeltaMean < best.linearIrradianceMetrics.linearRgbDeltaMean ? variant : best
			);

			const pointAgreementSupported = bestPointVariant.pointMetrics.surfaceCpuDelta <= surfaceQuadratureDiagnostic.summary.agreementTolerance;
			const weightTermAgreementSupported = bestWeightTermVariant.termMetrics.termDeltaMean <= surfaceQuadratureDiagnostic.summary.agreementTolerance;
			const irradianceTermAgreementTolerance = 0.08;
			const irradianceTermAgreementSupported = bestIrradianceTermVariant.linearIrradianceMetrics.linearRgbDeltaMean <= irradianceTermAgreementTolerance;

			return {
				status: pointAgreementSupported ?
					'SUPPORTED-GPU-DEBUG-MATCHES-CPU-SURFACE' :
					'OPEN-GPU-DEBUG-CPU-SURFACE-MISMATCH',
				fixtureMode,
				proofBoundary: 'Proof-only GPU debug material renders receiver calibration, normalWorld, positionWorld-grid, createIrradianceNode() scale sweeps, private _createManualIrradianceDebugNode() weight sweeps, and scalar/visibility/final irradiance linear RGB term sweeps; diagnostic canvas/readback comparison only, not runtime CPU readback or public API.',
				summary: {
					surfaceCpuRatio: surfaceCpuRatioMean,
					surfaceCpuRatioMean,
					surfaceCpuRatioMax,
					bestVariant: bestVariant.label,
					bestVariantScale: bestVariant.debugScale,
					bestSurfaceCpuDelta: bestVariant.surfaceCpuDelta,
					bestVariantCpuAggregation: bestVariant.surfaceCpuAggregation,
					bestTightPointVariant: bestPointVariant.label,
					bestTightPointVariantScale: bestPointVariant.debugScale,
					bestTightPointSurfaceWrongRatio: bestPointVariant.pointMetrics.surfaceWrongRatioMean,
					bestTightPointSurfaceWrongRatioMax: bestPointVariant.pointMetrics.surfaceWrongRatioMax,
					bestTightPointSurfaceCpuDelta: bestPointVariant.pointMetrics.surfaceCpuDelta,
					bestTightPointCpuAggregation: bestPointVariant.pointMetrics.surfaceCpuAggregation,
					bestWeightTermVariant: bestWeightTermVariant.label,
					bestWeightTerm: bestWeightTermVariant.debugMode,
					bestWeightTermCpuKey: bestWeightTermVariant.cpuTermKey,
					bestWeightTermScale: bestWeightTermVariant.debugScale,
					bestWeightTermDeltaMean: bestWeightTermVariant.termMetrics.termDeltaMean,
					bestWeightTermDeltaMax: bestWeightTermVariant.termMetrics.termDeltaMax,
					bestLinearIrradianceTermVariant: bestIrradianceTermVariant.label,
					bestLinearIrradianceTerm: bestIrradianceTermVariant.debugMode,
					bestLinearIrradianceCpuKey: bestIrradianceTermVariant.cpuIrradianceTermKey,
					bestLinearIrradianceTermScale: bestIrradianceTermVariant.debugScale,
					bestLinearIrradianceDeltaMean: bestIrradianceTermVariant.linearIrradianceMetrics.linearRgbDeltaMean,
					bestLinearIrradianceDeltaMax: bestIrradianceTermVariant.linearIrradianceMetrics.linearRgbDeltaMax,
					bestLinearIrradianceClippedSampleCount: bestIrradianceTermVariant.linearIrradianceMetrics.clippedSampleCount,
					linearIrradianceAgreementTolerance: irradianceTermAgreementTolerance,
					linearIrradianceAgreementGate: irradianceTermAgreementSupported ? 'SUPPORTED' : 'OPEN',
					linearIrradianceAgreementMode: irradianceTermAgreementSupported ? 'gpu-linear-rgb-point-samples' : 'open',
					weightTermAgreementGate: weightTermAgreementSupported ? 'SUPPORTED' : 'OPEN',
					weightTermAgreementMode: weightTermAgreementSupported ? 'gpu-term-point-samples' : 'open',
					agreementMode: pointAgreementSupported ? 'tight-surface-point-samples' : 'open',
					comparableVariantCount: comparableVariants.length,
					linearIrradianceTermVariantCount: irradianceTermMetricVariants.length,
					weightTermVariantCount: weightTermVariants.length,
					whiteCalibrationLuminanceMean,
					whiteCalibrationVisible: whiteCalibrationLuminanceMean > 32
				}
			};

		} finally {

			_lightProbeContext.leakFixture.leftReceiver.material = previousLeftMaterial;
			_lightProbeContext.leakFixture.rightReceiver.material = previousRightMaterial;
			_lightProbeContext.probeGrid.visibilityDepthWeighting.value = previousVisibilityWeighting;
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		}

	};

	return {
		createGaussLegendreReceiverSamples,
		createReceiverSurfaceQuadratureDiagnostic,
		captureReceiverGpuDebugDiagnostics
	};

}
